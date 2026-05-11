import { spawn } from "child_process";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { extname, join } from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CodexRequest = {
  prompt?: string;
  images?: CodexImage[];
};

type CodexImage = {
  name?: string;
  mimeType?: string;
  dataUrl?: string;
};

const encoder = new TextEncoder();
const runnerInstructions = [
  "Runner instruction:",
  "When running shell commands under zsh, quote any path that contains glob characters like [, ], *, ?, (, or ).",
  "For example, use sed -n '1,220p' 'app/[...slug]/page.tsx' instead of leaving that path unquoted."
].join("\n");

function writeLine(controller: ReadableStreamDefaultController<Uint8Array>, line: string) {
  controller.enqueue(encoder.encode(`${line}\n`));
}

function eventLine(type: string, payload: Record<string, unknown> = {}) {
  return JSON.stringify({ type, ...payload });
}

function cleanCliNoise(value: string) {
  return value
    .replace(/\d{4}-\d{2}-\d{2}T[^\n]*WARN codex_core_plugins::manager: failed to warm featured plugin ids cache[\s\S]*?<\/html>\s*/g, "")
    .replace(/^\d{4}-\d{2}-\d{2}T[^\n]*\s+WARN\s+.*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function itemLabel(type: string) {
  const labels: Record<string, string> = {
    agent_message: "回复",
    command_execution: "命令",
    file_change: "文件变更",
    reasoning: "思考",
    tool_call: "工具调用"
  };

  return labels[type] ?? type.replaceAll("_", " ");
}

function itemPreview(item: {
  type?: string;
  text?: string;
  name?: string;
  command?: string;
  aggregated_output?: string;
  exit_code?: number | null;
  status?: string;
  changes?: Array<{
    path?: string;
    kind?: string;
    diff?: string;
    move_path?: string | null;
  }>;
}) {
  if (item.type === "command_execution") {
    return {
      command: item.command,
      output: cleanCliNoise(item.aggregated_output ?? ""),
      exitCode: item.exit_code,
      status: item.status
    };
  }

  if (item.type === "file_change") {
    const changes = item.changes ?? [];
    return {
      changes,
      diff: changes
        .map((change) => change.diff)
        .filter((diff): diff is string => Boolean(diff?.trim()))
        .join("\n")
        .trim(),
      status: item.status
    };
  }

  if (item.type === "agent_message") {
    return {};
  }

  if (item.text) {
    return { text: cleanCliNoise(item.text) };
  }

  return {
    name: item.name,
    status: item.status
  };
}

function imageExtension(image: CodexImage) {
  const fromName = image.name ? extname(image.name).toLowerCase() : "";
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(fromName)) {
    return fromName;
  }

  if (image.mimeType === "image/png") {
    return ".png";
  }

  if (image.mimeType === "image/webp") {
    return ".webp";
  }

  if (image.mimeType === "image/gif") {
    return ".gif";
  }

  return ".jpg";
}

async function writeImages(images: CodexImage[] = []) {
  const validImages = images.filter((image) => image.dataUrl?.startsWith("data:image/"));
  if (validImages.length === 0) {
    return { dir: null, paths: [] as string[] };
  }

  const dir = await mkdtemp(join(tmpdir(), "trip-codex-images-"));
  const paths: string[] = [];

  for (const [index, image] of validImages.entries()) {
    const base64 = image.dataUrl?.split(",")[1];
    if (!base64) {
      continue;
    }

    const filePath = join(dir, `image-${index + 1}${imageExtension(image)}`);
    await writeFile(filePath, Buffer.from(base64, "base64"));
    paths.push(filePath);
  }

  return { dir, paths };
}

export async function POST(request: Request) {
  let payload: CodexRequest;

  try {
    payload = (await request.json()) as CodexRequest;
  } catch {
    return Response.json({ message: "invalid json" }, { status: 400 });
  }

  const prompt = payload.prompt?.trim();
  if (!prompt) {
    return Response.json({ message: "prompt is required" }, { status: 400 });
  }

  const codexCommand = process.env.CODEX_CLI_PATH ?? "codex";
  const cwd = process.cwd();
  const { dir: imageDir, paths: imagePaths } = await writeImages(payload.images);
  const args = [
    "-a",
    "never",
    "--sandbox",
    "workspace-write",
    "--cd",
    cwd,
    "exec",
    "--color",
    "never",
    "--json"
  ];

  for (const imagePath of imagePaths) {
    args.push("--image", imagePath);
  }

  args.push("-");

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const safeWriteLine = (line: string) => {
        if (!closed) {
          writeLine(controller, line);
        }
      };

      const finish = () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      };

      const cleanupImages = () => {
        if (imageDir) {
          void rm(imageDir, { recursive: true, force: true });
        }
      };

      safeWriteLine(
        eventLine("started", {
          command: `${codexCommand} ${args.join(" ")}`,
          cwd,
          images: imagePaths.length
        })
      );
      if (imagePaths.length > 0) {
        safeWriteLine(eventLine("status", { text: `已附加 ${imagePaths.length} 张图片` }));
      }

      const child = spawn(codexCommand, args, {
        cwd,
        env: {
          ...process.env,
          FORCE_COLOR: "0",
          NO_COLOR: "1"
        },
        stdio: ["pipe", "pipe", "pipe"]
      });

      const killChild = () => {
        if (!child.killed) {
          child.kill("SIGTERM");
        }
        cleanupImages();
      };

      request.signal.addEventListener("abort", killChild, { once: true });

      child.stdin.write(`${runnerInstructions}\n\n${prompt}`);
      child.stdin.end();

      let stdoutBuffer = "";
      let stderrBuffer = "";

      const handleJsonEvent = (line: string) => {
        if (!line.trim()) {
          return;
        }

        try {
          const event = JSON.parse(line) as {
            type?: string;
            item?: {
              id?: string;
              type?: string;
              text?: string;
              name?: string;
              command?: string;
              aggregated_output?: string;
              exit_code?: number | null;
              status?: string;
              changes?: Array<{
                path?: string;
                kind?: string;
                diff?: string;
                move_path?: string | null;
              }>;
            };
            usage?: { input_tokens?: number; output_tokens?: number };
          };

          if (event.type === "thread.started") {
            safeWriteLine(eventLine("thread", { text: "Codex 会话已创建" }));
            return;
          }

          if (event.type === "turn.started") {
            safeWriteLine(
              eventLine("activity", {
                id: "turn",
                phase: "started",
                itemType: "reasoning",
                title: "Codex 正在思考",
                status: "in_progress"
              })
            );
            safeWriteLine(eventLine("status", { text: "Codex 正在思考" }));
            return;
          }

          if (event.type === "item.started" && event.item?.type) {
            safeWriteLine(
              eventLine("activity", {
                id: event.item.id,
                phase: "started",
                itemType: event.item.type,
                title: `开始${itemLabel(event.item.type)}`,
                ...itemPreview(event.item)
              })
            );
            safeWriteLine(eventLine("status", { text: `开始${itemLabel(event.item.type)}` }));
            return;
          }

          if (event.type === "item.completed" && event.item?.type === "agent_message" && event.item.text) {
            safeWriteLine(eventLine("delta", { text: event.item.text }));
            return;
          }

          if (event.type === "item.completed" && event.item?.type) {
            safeWriteLine(
              eventLine("activity", {
                id: event.item.id,
                phase: "completed",
                itemType: event.item.type,
                title: `完成${itemLabel(event.item.type)}`,
                ...itemPreview(event.item)
              })
            );
            safeWriteLine(eventLine("status", { text: `完成${itemLabel(event.item.type)}` }));
            return;
          }

          if (event.type === "turn.completed") {
            const tokenText =
              typeof event.usage?.input_tokens === "number" && typeof event.usage?.output_tokens === "number"
                ? `${event.usage.input_tokens.toLocaleString()} input tokens / ${event.usage.output_tokens.toLocaleString()} output tokens`
                : undefined;
            safeWriteLine(
              eventLine("activity", {
                id: "turn",
                phase: "completed",
                itemType: "reasoning",
                title: "Codex 思考完成",
                status: "completed",
                text: tokenText
              })
            );
            safeWriteLine(
              eventLine("completed", {
                inputTokens: event.usage?.input_tokens,
                outputTokens: event.usage?.output_tokens
              })
            );
          }
        } catch {
          const cleanLine = cleanCliNoise(line);
          if (cleanLine) {
            safeWriteLine(eventLine("log", { text: cleanLine }));
          }
        }
      };

      child.stdout.on("data", (chunk: Buffer) => {
        stdoutBuffer += chunk.toString();
        const lines = stdoutBuffer.split("\n");
        stdoutBuffer = lines.pop() ?? "";
        for (const line of lines) {
          handleJsonEvent(line);
        }
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderrBuffer += chunk.toString();
      });

      child.on("error", (error) => {
        safeWriteLine(eventLine("error", { text: `failed to start: ${error.message}` }));
        request.signal.removeEventListener("abort", killChild);
        cleanupImages();
        finish();
      });

      child.on("close", (code, signal) => {
        if (stdoutBuffer.trim()) {
          handleJsonEvent(stdoutBuffer);
        }

        const cleanStderr = cleanCliNoise(stderrBuffer);
        if (code !== 0 && cleanStderr) {
          safeWriteLine(eventLine("error", { text: cleanStderr }));
        }

        safeWriteLine(eventLine("closed", { code, signal }));
        request.signal.removeEventListener("abort", killChild);
        cleanupImages();
        finish();
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "X-Accel-Buffering": "no"
    }
  });
}
