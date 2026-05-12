"use client";

import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { html as diffToHtml } from "diff2html";
import { ColorSchemeType } from "diff2html/lib/types";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { bundledLanguages, bundledLanguagesAlias, codeToHtml, type BundledLanguage } from "shiki/bundle/web";
import { Check, ChevronDown, Copy, FileImage, Loader2, Play, Square, Terminal, Trash2, Wrench, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ImageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
};

type CodexStreamEvent = {
  type?: string;
  id?: string;
  text?: string;
  code?: number | null;
  signal?: string | null;
  inputTokens?: number;
  outputTokens?: number;
  phase?: "started" | "completed";
  itemType?: string;
  title?: string;
  command?: string;
  output?: string;
  diff?: string;
  exitCode?: number | null;
  status?: string;
  name?: string;
  changes?: FileChangeSummary[];
};

type FileChangeSummary = {
  path?: string;
  kind?: string;
  diff?: string;
  move_path?: string | null;
};

type ActivityEvent = {
  id: string;
  phase: "started" | "completed";
  itemType: string;
  title: string;
  command?: string;
  output?: string;
  diff?: string;
  exitCode?: number | null;
  status?: string;
  text?: string;
  name?: string;
  changes?: FileChangeSummary[];
};

type MarkdownCodeProps = React.HTMLAttributes<HTMLElement> & {
  inline?: boolean;
  children?: ReactNode;
};

const samplePrompt = "请查看当前项目结构，并用三句话说明这个项目是做什么的。";
const runnerInstructionText = [
  "Runner instruction:",
  "When running shell commands under zsh, quote any path that contains glob characters like [, ], *, ?, (, or ).",
  "For example, use sed -n '1,220p' 'app/[...slug]/page.tsx' instead of leaving that path unquoted."
].join("\n");

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripMarkdownCommand(value: string) {
  return value.trimStart().replace(/^\/md(?:\s+|$)/i, "").trim();
}

function readImageFile(file: File) {
  return new Promise<ImageAttachment>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        name: file.name,
        mimeType: file.type || "image/png",
        size: file.size,
        dataUrl: String(reader.result)
      });
    };
    reader.onerror = () => reject(reader.error ?? new Error("image read failed"));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function filterCodexOutput(raw: string, submittedPrompt: string) {
  let text = raw.replace(/\r\n/g, "\n");

  text = text.replace(
    /\d{4}-\d{2}-\d{2}T[^\n]*WARN codex_core_plugins::manager: failed to warm featured plugin ids cache[\s\S]*?<\/html>\s*/g,
    ""
  );
  text = text.replace(/^\$ codex .*\n/gm, "");
  text = text.replace(/^cwd: .*\n/gm, "");
  text = text.replace(/^images: \d+\n/gm, "");
  text = text.replace(/OpenAI Codex v[^\n]*\n--------\n[\s\S]*?\n--------\n/g, "");
  text = text.replace(new RegExp(`${escapeRegExp(runnerInstructionText)}\\n\\n`, "g"), "");
  text = text.replace(new RegExp(`^user\\n${escapeRegExp(stripMarkdownCommand(submittedPrompt))}\\n?`, "m"), "");
  text = text.replace(/^\d{4}-\d{2}-\d{2}T[^\n]*\s+WARN\s+.*$/gm, "");
  text = text.replace(/^\[codex api\] process finished.*$/gm, "");
  text = text.replace(/^codex\n/gm, "");
  const finalAnswer = text.match(/\ntokens used\n[\d,]+\n([\s\S]*)$/);
  if (finalAnswer?.[1]?.trim()) {
    text = finalAnswer[1];
  }
  text = text.replace(/\n{3,}/g, "\n\n");

  return text.trim();
}

function normalizeShikiLanguage(language: string): BundledLanguage | "text" {
  const normalized = language.toLowerCase();
  if (normalized in bundledLanguages || normalized in bundledLanguagesAlias) {
    return normalized as BundledLanguage;
  }

  const aliases: Record<string, BundledLanguage> = {
    shell: "bash",
    sh: "bash",
    console: "bash",
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    py: "python"
  };

  return aliases[normalized] ?? "text";
}

function extractUnifiedDiff(value?: string) {
  if (!value) {
    return "";
  }

  const lines = value.replace(/\r\n/g, "\n").split("\n");
  const startIndex = lines.findIndex((line) => line.startsWith("diff --git ") || line.startsWith("--- "));
  if (startIndex === -1) {
    return "";
  }

  const diff = lines.slice(startIndex).join("\n").trim();
  return /(^|\n)(diff --git |--- |\+\+\+ |@@ )/.test(diff) ? diff : "";
}

function DiffViewer({ diff }: { diff: string }) {
  const renderedDiff = useMemo(() => {
    if (!diff.trim()) {
      return "";
    }

    try {
      return diffToHtml(diff, {
        colorScheme: ColorSchemeType.LIGHT,
        drawFileList: false,
        matching: "words",
        outputFormat: "line-by-line"
      });
    } catch {
      return "";
    }
  }, [diff]);

  if (!renderedDiff) {
    return (
      <pre className="max-h-80 overflow-auto rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-zinc-600">
        <code>{diff}</code>
      </pre>
    );
  }

  return <div className="codex-diff overflow-hidden rounded-lg border border-zinc-200 bg-white" dangerouslySetInnerHTML={{ __html: renderedDiff }} />;
}

function CodePanel({ children, className, language }: { children: string; className?: string; language: string }) {
  return <CodeBlock className={cn(`language-${language}`, className)}>{children}</CodeBlock>;
}

function CodeBlock({ className, children, inline, ...props }: MarkdownCodeProps) {
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState("");
  const code = String(children ?? "").replace(/\n$/, "");
  const language = /language-([\w-]+)/.exec(className ?? "")?.[1] ?? "text";

  useEffect(() => {
    let cancelled = false;

    codeToHtml(code, {
      lang: normalizeShikiLanguage(language),
      theme: "github-light-default"
    })
      .then((html) => {
        if (!cancelled) {
          setHighlightedHtml(html);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHighlightedHtml("");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, language]);

  if (inline) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="my-4 overflow-hidden rounded-xl border border-zinc-200 bg-[#f8fafc] shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-200 bg-white px-3 py-2">
        <span className="text-xs font-medium text-zinc-500">{language}</span>
        <button
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
          onClick={copyCode}
          type="button"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "已复制" : "复制"}
        </button>
      </div>
      {highlightedHtml ? (
        <div className="codex-shiki" dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      ) : (
        <pre className="overflow-auto px-4 py-3 text-[13px] leading-6 text-zinc-800">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}

const markdownComponents: Components = {
  code(props) {
    return <CodeBlock {...(props as MarkdownCodeProps)} />;
  }
};

function activityTone(event: ActivityEvent) {
  if (event.phase === "started") {
    return "border-blue-100 bg-blue-50/60 text-blue-700";
  }

  if (event.itemType === "reasoning") {
    return "border-violet-100 bg-violet-50/70 text-violet-700";
  }

  if (event.itemType === "command_execution" && event.exitCode && event.exitCode !== 0) {
    return "border-amber-100 bg-amber-50/70 text-amber-700";
  }

  return "border-emerald-100 bg-emerald-50/60 text-emerald-700";
}

function ActivityTimeline({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 min-w-0 space-y-2">
      {events.map((event) => (
        <details key={`${event.id}-${event.phase}`} className="group min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80" open={event.phase === "started"}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:hidden [&::-webkit-details-marker]:hidden">
            <div className="flex min-w-0 items-center gap-2">
              <span className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border", activityTone(event))}>
                {event.phase === "started" ? <Loader2 className="animate-spin" size={13} /> : event.itemType === "command_execution" ? <Terminal size={13} /> : <Wrench size={13} />}
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-zinc-700">{event.title}</p>
                <p className="text-[11px] text-zinc-400">
                  {event.itemType}
                  {typeof event.exitCode === "number" ? ` · exit ${event.exitCode}` : ""}
                </p>
              </div>
            </div>
            <span className="flex shrink-0 items-center gap-2 text-[11px] text-zinc-400">
              {event.phase === "started" ? "进行中" : "完成"}
              <ChevronDown className="transition group-open:rotate-180" size={14} />
            </span>
          </summary>

          <div className="border-t border-zinc-200 px-3 pb-3 pt-2">
            {event.changes?.length ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {event.changes.map((change, index) => (
                  <span key={`${change.path}-${index}`} className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600">
                    {change.kind ?? "change"} · {change.path ?? "unknown"}
                    {change.move_path ? ` -> ${change.move_path}` : ""}
                  </span>
                ))}
              </div>
            ) : null}

            {event.diff ? (
              <DiffViewer diff={event.diff} />
            ) : null}

            {event.command ? (
              <div className={event.diff ? "mt-2" : ""}>
                <CodePanel language="bash">{event.command}</CodePanel>
              </div>
            ) : null}

            {event.output && !event.diff ? (
              <div className="mt-2 max-h-64 overflow-auto">
                <CodePanel language="text">{event.output}</CodePanel>
              </div>
            ) : null}

            {event.text ? <p className="whitespace-pre-wrap text-xs leading-5 text-zinc-600">{event.text}</p> : null}
            {!event.command && !event.output && !event.text ? <p className="text-xs leading-5 text-zinc-500">{event.phase === "started" ? "等待可见事件..." : "无额外输出"}</p> : null}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function CodexPage() {
  const [prompt, setPrompt] = useState(samplePrompt);
  const [submittedPrompt, setSubmittedPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [images, setImages] = useState<ImageAttachment[]>([]);
  const [submittedImages, setSubmittedImages] = useState<ImageAttachment[]>([]);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("待运行");
  const abortRef = useRef<AbortController | null>(null);
  const outputEndRef = useRef<HTMLDivElement | null>(null);
  const queuedTextRef = useRef("");
  const typingTimerRef = useRef<number | null>(null);

  const filteredOutput = useMemo(() => filterCodexOutput(output, submittedPrompt), [output, submittedPrompt]);
  const promptForCodex = stripMarkdownCommand(prompt) || (images.length > 0 ? "请分析这些图片，并结合图片内容继续处理。" : "");
  useEffect(() => {
    outputEndRef.current?.scrollIntoView({ block: "end" });
  }, [filteredOutput, activityEvents]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  const pumpQueuedText = () => {
    if (!queuedTextRef.current) {
      typingTimerRef.current = null;
      return;
    }

    const nextChunk = queuedTextRef.current.slice(0, 10);
    queuedTextRef.current = queuedTextRef.current.slice(nextChunk.length);
    setOutput((current) => current + nextChunk);
    typingTimerRef.current = window.setTimeout(pumpQueuedText, 18);
  };

  const appendStreamingText = (text: string) => {
    queuedTextRef.current += text;
    if (!typingTimerRef.current) {
      pumpQueuedText();
    }
  };

  const handleStreamEvent = (event: CodexStreamEvent) => {
    if (event.type === "delta" && event.text) {
      appendStreamingText(event.text);
      return;
    }

    if (event.type === "status" && event.text) {
      setStatus(event.text);
      return;
    }

    if (event.type === "thread" && event.text) {
      setStatus(event.text);
      return;
    }

    if (event.type === "log" && event.text) {
      setStatus(event.text);
      return;
    }

    if (event.type === "activity" && event.itemType && event.phase) {
      const activity: ActivityEvent = {
        id: event.id || `${event.itemType}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        phase: event.phase,
        itemType: event.itemType,
        title: event.title || event.itemType,
        command: event.command,
        output: event.output,
        exitCode: event.exitCode,
        status: event.status,
        text: event.text,
        name: event.name,
        changes: event.changes,
        diff: event.diff || extractUnifiedDiff(event.output)
      };

      setActivityEvents((current) => {
        const index = current.findIndex((item) => item.id === activity.id);
        if (index === -1) {
          return [...current, activity];
        }

        return current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...activity } : item));
      });
      return;
    }

    if (event.type === "error" && event.text) {
      setOutput((current) => `${current}\n${event.text}`);
      setStatus("运行异常");
      return;
    }

    if (event.type === "completed") {
      const tokenText =
        typeof event.inputTokens === "number" && typeof event.outputTokens === "number"
          ? `CLI 已结束 · ${event.inputTokens.toLocaleString()} in / ${event.outputTokens.toLocaleString()} out`
          : "CLI 已结束";
      setStatus(tokenText);
      return;
    }

    if (event.type === "closed" && event.code !== 0) {
      setStatus(`CLI 已退出：${event.code ?? "null"}`);
    }
  };

  const runCodex = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if ((!promptForCodex && images.length === 0) || running) {
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    queuedTextRef.current = "";
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    setOutput("");
    setActivityEvents([]);
    setSubmittedPrompt(prompt);
    setSubmittedImages(images);
    setRunning(true);
    setStatus("CLI 正在运行");

    try {
      const res = await fetch("/api/codex", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: promptForCodex,
          images: images.map((image) => ({
            name: image.name,
            mimeType: image.mimeType,
            dataUrl: image.dataUrl
          }))
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        const message = await res.text();
        setOutput(message || `请求失败：${res.status}`);
        setStatus("请求失败");
        return;
      }

      if (!res.body) {
        setStatus("当前浏览器不支持流式读取");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = "";

      const flushLine = (line: string) => {
        if (!line.trim()) {
          return;
        }

        try {
          handleStreamEvent(JSON.parse(line) as CodexStreamEvent);
        } catch {
          setOutput((current) => `${current}${line}\n`);
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        streamBuffer += decoder.decode(value, { stream: true });
        const lines = streamBuffer.split("\n");
        streamBuffer = lines.pop() ?? "";

        for (const line of lines) {
          flushLine(line);
        }
      }

      if (streamBuffer.trim()) {
        flushLine(streamBuffer);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("已停止");
        setOutput((current) => `${current}\n[codex page] request aborted by user\n`);
      } else {
        setStatus("运行异常");
        setOutput((current) => `${current}\n[codex page] ${(error as Error).message}\n`);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  };

  const stopCodex = () => {
    abortRef.current?.abort();
  };

  const copyOutput = async () => {
    await navigator.clipboard.writeText(filteredOutput || output);
    setStatus("输出已复制");
  };

  const onImagesChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) {
      return;
    }

    const nextImages = await Promise.all(files.map(readImageFile));
    setImages((current) => [...current, ...nextImages]);
    event.target.value = "";
  };

  const removeImage = (id: string) => {
    setImages((current) => current.filter((image) => image.id !== id));
  };

  return (
    <main className="min-h-screen bg-[#f7f7f8] text-zinc-950">
      <header className="border-b border-zinc-200 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-950 text-white">
              <Terminal size={17} />
            </span>
            <div>
              <p className="text-sm font-semibold">Codex CLI Runner</p>
              <p className="text-xs text-zinc-500">Markdown 渲染 · 代码高亮 · 图片输入</p>
            </div>
          </div>
          <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href="/">
            返回首页
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-5 lg:grid-cols-[410px_1fr]">
        <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base">输入对话</CardTitle>
            <CardDescription>默认按 Markdown 渲染输出，也可以上传图片给 Codex CLI 消费。</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={runCodex}>
              <textarea
                className="min-h-64 w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-3 text-sm leading-6 outline-none transition-[color,box-shadow] placeholder:text-zinc-400 focus-visible:ring-2 focus-visible:ring-zinc-300"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="输入要交给 Codex CLI 的内容"
              />

              <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-3">
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                  <span className="flex items-center gap-2 text-zinc-700">
                    <FileImage size={16} />
                    上传图片
                  </span>
                  <span className="rounded-md border bg-white px-2 py-1 text-xs text-zinc-500">Base64 → --image</span>
                  <input accept="image/*" className="hidden" multiple onChange={onImagesChange} type="file" />
                </label>
                {images.length > 0 ? (
                  <div className="mt-3 grid gap-2">
                    {images.map((image) => (
                      <div key={image.id} className="flex items-center gap-3 rounded-md border bg-white p-2">
                        <Image alt={image.name} className="h-10 w-10 rounded-md object-cover" height={40} src={image.dataUrl} unoptimized width={40} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{image.name}</p>
                          <p className="text-xs text-zinc-500">{formatBytes(image.size)}</p>
                        </div>
                        <button
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
                          onClick={() => removeImage(image.id)}
                          type="button"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button disabled={running || (!promptForCodex && images.length === 0)} type="submit">
                  {running ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
                  {running ? "运行中" : "运行"}
                </Button>
                <Button disabled={!running} onClick={stopCodex} type="button" variant="outline">
                  <Square size={16} />
                  停止
                </Button>
                <Button disabled={running} onClick={() => setPrompt(samplePrompt)} type="button" variant="secondary">
                  示例
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="rounded-lg border-zinc-200 bg-white shadow-sm">
          <CardHeader className="gap-3 border-b border-zinc-100 pb-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "inline-flex h-2.5 w-2.5 rounded-full",
                  running ? "bg-emerald-500" : status === "已停止" || status === "运行异常" ? "bg-amber-500" : "bg-zinc-300"
                )}
              />
              <div>
                <CardTitle className="text-base">CLI 输出</CardTitle>
                <CardDescription>{status} · warnings 已过滤</CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button disabled={!filteredOutput && !output} onClick={copyOutput} type="button" variant="outline" size="sm">
                <Copy size={15} />
                复制
              </Button>
              <Button
                disabled={(!filteredOutput && !output && activityEvents.length === 0) || running}
                onClick={() => {
                  setOutput("");
                  setActivityEvents([]);
                }}
                type="button"
                variant="outline"
                size="sm"
              >
                <Trash2 size={15} />
                清空
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[calc(100vh-145px)] min-h-[600px] overflow-auto px-5 py-4">
              {submittedPrompt ? (
                <div className="mb-5 flex justify-end">
                  <div className="max-w-[84%] rounded-2xl bg-zinc-950 px-4 py-3 text-sm leading-6 text-white shadow-sm">
                    <p className="whitespace-pre-wrap">{submittedPrompt}</p>
                    {submittedImages.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {submittedImages.map((image) => (
                          <Image
                            key={image.id}
                            alt={image.name}
                            className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/20"
                            height={64}
                            src={image.dataUrl}
                            unoptimized
                            width={64}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="flex gap-3">
                <span className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-800">
                  <Terminal size={15} />
                </span>
                <div className="min-w-0 flex-1 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
                  <ActivityTimeline events={activityEvents} />
                  {filteredOutput ? (
                    <div className="codex-markdown">
                      <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                        {filteredOutput}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                      {running ? <Loader2 className="animate-spin" size={15} /> : null}
                      {running ? "正在等待 Codex 输出..." : "等待输出..."}
                    </div>
                  )}
                  <div ref={outputEndRef} />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
