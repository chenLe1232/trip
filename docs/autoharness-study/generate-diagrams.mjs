import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const imageDir = join(__dirname, "images");
mkdirSync(imageDir, { recursive: true });

const palette = {
  ink: "#17202a",
  muted: "#5f6b7a",
  line: "#c8d2df",
  page: "#f7f9fc",
  blue: "#2f6fed",
  green: "#169b72",
  orange: "#f28c28",
  red: "#d94b4b",
  purple: "#7557d8",
  teal: "#0d8fa6",
  yellow: "#f5c542",
  gray: "#e9eef5",
  white: "#ffffff",
};

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function base({ width = 1600, height = 960, title, subtitle, body }) {
  const normalizedBody = body.trim();
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}">
  <defs>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L0,6 L9,3 z" fill="${palette.ink}" />
    </marker>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="10" flood-color="#14213d" flood-opacity="0.12"/>
    </filter>
  </defs>
  <rect width="100%" height="100%" fill="${palette.page}"/>
  <text x="70" y="72" font-family="PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="38" font-weight="700" fill="${palette.ink}">${esc(title)}</text>
  <text x="70" y="112" font-family="PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="20" fill="${palette.muted}">${esc(subtitle)}</text>
${normalizedBody}
</svg>
`;
}

function rect({ x, y, w, h, fill = palette.white, stroke = palette.line, r = 14, shadow = true }) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="2"${shadow ? ' filter="url(#shadow)"' : ""}/>`;
}

function line({ x1, y1, x2, y2, color = palette.ink, width = 2, arrow = true, dash = false }) {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${width}" ${dash ? 'stroke-dasharray="8 8"' : ""} ${arrow ? 'marker-end="url(#arrow)"' : ""}/>`;
}

function text({ x, y, value, size = 20, weight = 400, color = palette.ink, anchor = "start" }) {
  return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-family="PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${esc(value)}</text>`;
}

function wrap(value, maxChars) {
  const raw = String(value);
  const parts = raw.split(/\s+/);
  const lines = [];
  let current = "";
  for (const part of parts) {
    const candidate = current ? `${current} ${part}` : part;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = part;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.flatMap((line) => {
    if (line.length <= maxChars + 6) return [line];
    const chunks = [];
    for (let i = 0; i < line.length; i += maxChars) chunks.push(line.slice(i, i + maxChars));
    return chunks;
  });
}

function card({ x, y, w, h, title, lines = [], accent = palette.blue, fill = palette.white, titleSize = 23 }) {
  const rendered = [
    rect({ x, y, w, h, fill }),
    `<rect x="${x}" y="${y}" width="8" height="${h}" rx="4" fill="${accent}"/>`,
    text({ x: x + 28, y: y + 39, value: title, size: titleSize, weight: 700 }),
  ];
  let yy = y + 72;
  for (const item of lines) {
    for (const wrapped of wrap(item, Math.floor((w - 56) / 10.5))) {
      rendered.push(text({ x: x + 28, y: yy, value: wrapped, size: 16, color: palette.muted }));
      yy += 23;
    }
    yy += 1;
  }
  return rendered.join("\n");
}

function badge({ x, y, value, fill = palette.gray, color = palette.ink }) {
  const w = Math.max(92, value.length * 13 + 32);
  return `${rect({ x, y, w, h: 38, fill, stroke: "transparent", r: 19, shadow: false })}
${text({ x: x + w / 2, y: y + 25, value, size: 17, weight: 700, color, anchor: "middle" })}`;
}

function diagram1() {
  const body = `
${card({ x: 80, y: 190, w: 310, h: 190, title: "目标 Harness 仓库", accent: palette.teal, lines: ["被优化的 agent harness / prompt / middleware / config / source", "autoharness 只把它当作 target_root"] })}
${card({ x: 645, y: 170, w: 330, h: 230, title: "autoharness 控制平面", accent: palette.blue, lines: ["CLI 命令：guide、run-benchmark、generate-proposal、run-iteration、optimize", "统一管理候选、运行、比较、推广"] })}
${card({ x: 1200, y: 190, w: 300, h: 190, title: "Benchmark Adapter", accent: palette.orange, lines: ["generic_command / pytest / harbor / tau2 / hal / car_bench", "把不同评测统一成 BenchmarkRunResult"] })}
${card({ x: 120, y: 610, w: 360, h: 190, title: ".autoharness 状态层", accent: palette.green, lines: ["workspace.json、state.json", "registry/run_*.json", "proposals、iterations、champion.json"] })}
${card({ x: 650, y: 610, w: 330, h: 190, title: "Proposal Generator", accent: palette.purple, lines: ["manual / failure_summary / local_template", "openai_responses / codex_cli / claude_code"] })}
${card({ x: 1180, y: 610, w: 330, h: 190, title: "Promotion / Champion", accent: palette.red, lines: ["候选达到阶段 gate", "和当前 champion 比较", "胜者写入 champion manifest"] })}
${line({ x1: 390, y1: 285, x2: 645, y2: 285 })}
${line({ x1: 975, y1: 285, x2: 1200, y2: 285 })}
${line({ x1: 810, y1: 400, x2: 810, y2: 610 })}
${line({ x1: 480, y1: 705, x2: 650, y2: 705 })}
${line({ x1: 980, y1: 705, x2: 1180, y2: 705 })}
${line({ x1: 1350, y1: 610, x2: 1350, y2: 380, color: palette.red })}
${line({ x1: 645, y1: 340, x2: 480, y2: 610, color: palette.green })}
${badge({ x: 703, y: 465, value: "外层循环，不替代业务 harness", fill: "#dfe9ff", color: palette.blue })}
`;
  return base({
    title: "Autoharness 的位置：外层优化控制平面",
    subtitle: "它不实现业务 agent，而是围绕已有 harness 建立候选生成、评测、记录和推广闭环。",
    body,
  });
}

function diagram2() {
  const steps = [
    ["1 读取 workspace/state", "解析 track、stage、baseline、autonomy policy"],
    ["2 生成 proposal", "根据失败信号、目标、benchmark config 产出 edit_plan"],
    ["3 持久化预览", "写 proposal.json、edit_plan.json、candidate.patch"],
    ["4 应用或隔离执行", "按 proposal/bounded/full 决定 preview、blocked、applied；必要时 copy staging"],
    ["5 preflight + benchmark", "先跑预检查，再由 adapter 执行 repeat validation"],
    ["6 事务恢复", "默认还原候选改动，避免污染目标仓库"],
    ["7 记录结果", "写 registry、iterations、events，并更新 state 指针"],
  ];
  const body = steps
    .map(([title, desc], index) => {
      const x = 92 + (index % 4) * 370;
      const y = index < 4 ? 210 : 560;
      return `${card({ x, y, w: 310, h: 170, title, accent: [palette.blue, palette.purple, palette.green, palette.orange, palette.teal, palette.red, palette.yellow][index], lines: [desc], titleSize: 22 })}
${index < steps.length - 1 ? line({
        x1: index === 3 ? x + 155 : x + 310,
        y1: index === 3 ? y + 170 : y + 85,
        x2: index === 3 ? 247 : x + 370,
        y2: index === 3 ? 560 : y + 85,
        color: palette.ink,
        dash: index === 3,
      }) : ""}`;
    })
    .join("\n");
  return base({
    title: "一次 run-iteration 的生命周期",
    subtitle: "单次候选从 edit_plan 到 benchmark record 的完整路径，关键点是可预览、可恢复、可追踪。",
    body: `${body}
${badge({ x: 575, y: 835, value: "默认 keep_applied_edits=false：跑完候选后恢复现场", fill: "#e8f6ef", color: palette.green })}`,
  });
}

function diagram3() {
  const body = `
${card({ x: 90, y: 180, w: 310, h: 160, title: "CampaignRun", accent: palette.blue, lines: ["持久化 campaign_run_*.json", "保存候选、预算、租约、决策日志"] })}
${card({ x: 500, y: 180, w: 310, h: 160, title: "候选池", accent: palette.purple, lines: ["manual_edit_plan_list 或 generator_loop", "beam / scored 策略会先扩展候选池"] })}
${card({ x: 910, y: 180, w: 310, h: 160, title: "执行候选", accent: palette.orange, lines: ["生成 proposal", "run-proposal -> run-iteration"] })}
${card({ x: 500, y: 470, w: 310, h: 170, title: "结果分类", accent: palette.teal, lines: ["success / failed / inconclusive / error", "按生成、执行、评测、预检查分类失败"] })}
${card({ x: 910, y: 470, w: 310, h: 170, title: "重试与预算", accent: palette.red, lines: ["每类失败有独立重试上限", "检查次数、时间、成本、失败数、无提升次数"] })}
${card({ x: 500, y: 760, w: 310, h: 130, title: "评分 / Beam", accent: palette.yellow, lines: ["branch_score 排序", "胜出后 prune 同组未跑候选"] })}
${card({ x: 910, y: 760, w: 310, h: 130, title: "自动推广", accent: palette.green, lines: ["stage gate 通过", "比 champion 更好则 promote"] })}
${line({ x1: 400, y1: 260, x2: 500, y2: 260 })}
${line({ x1: 810, y1: 260, x2: 910, y2: 260 })}
${line({ x1: 1065, y1: 340, x2: 655, y2: 470 })}
${line({ x1: 810, y1: 555, x2: 910, y2: 555 })}
${line({ x1: 655, y1: 640, x2: 655, y2: 760 })}
${line({ x1: 1065, y1: 640, x2: 1065, y2: 760 })}
${line({ x1: 500, y1: 825, x2: 360, y2: 350, color: palette.purple, dash: true })}
${line({ x1: 1220, y1: 825, x2: 1390, y2: 340, color: palette.green, dash: true })}
${badge({ x: 1260, y: 240, value: "每一步 checkpoint", fill: "#fff0da", color: palette.orange })}
${badge({ x: 1290, y: 575, value: "失败可恢复，不靠记忆", fill: "#ffe5e5", color: palette.red })}
`;
  return base({
    title: "optimize / campaign 的可恢复自主搜索循环",
    subtitle: "自主迭代的关键不是无限循环，而是候选状态机 + 预算闸门 + retry 分类 + checkpoint。",
    body,
  });
}

function diagram4() {
  const body = `
${card({ x: 100, y: 210, w: 390, h: 230, title: "proposal", accent: palette.gray, lines: ["may_generate_proposals=true", "may_apply_patches=false", "永远只产出候选和 patch 预览"] })}
${card({ x: 605, y: 210, w: 390, h: 230, title: "bounded", accent: palette.blue, lines: ["may_apply_patches=true", "requires_explicit_edit_allowlist=true", "只允许 editable_surfaces 内修改"] })}
${card({ x: 1110, y: 210, w: 390, h: 230, title: "full", accent: palette.red, lines: ["allows_repo_wide_edits=true", "仍尊重 protected_surfaces", "适合成熟且隔离良好的 harness"] })}
${card({ x: 210, y: 590, w: 1180, h: 220, title: "editing.py 的保护动作", accent: palette.green, lines: ["所有 edit_plan 都先规范化为 search_replace / write_file / delete_file / move_path / unified_diff", "start_edit_session 在应用前记录每个文件快照；finalize 默认恢复；blocked / proposal_only / preview 都会写入结果", "路径会解析到 target_root 内，受 protected_surfaces 和 editable_surfaces 约束"] })}
${line({ x1: 490, y1: 325, x2: 605, y2: 325 })}
${line({ x1: 995, y1: 325, x2: 1110, y2: 325 })}
${line({ x1: 295, y1: 440, x2: 470, y2: 590, color: palette.gray })}
${line({ x1: 800, y1: 440, x2: 800, y2: 590, color: palette.blue })}
${line({ x1: 1305, y1: 440, x2: 1130, y2: 590, color: palette.red })}
`;
  return base({
    title: "自主权限不是一个开关，而是三档策略",
    subtitle: "autoharness 用 AutonomyPolicy 把“能不能改、改哪里、保护哪里”显式建模。",
    body,
  });
}

function diagram5() {
  const body = `
${card({ x: 80, y: 205, w: 330, h: 200, title: "screening", accent: palette.blue, lines: ["search_benchmark", "repeat=1", "threshold：快速筛掉明显坏候选"] })}
${card({ x: 455, y: 205, w: 330, h: 200, title: "validation", accent: palette.green, lines: ["search_benchmark", "repeat=3", "confidence interval + stability gate"] })}
${card({ x: 830, y: 205, w: 330, h: 200, title: "holdout", accent: palette.orange, lines: ["promotion_benchmark", "repeat=3", "用于推广前的保守验证"] })}
${card({ x: 1205, y: 205, w: 330, h: 200, title: "transfer", accent: palette.purple, lines: ["regression_benchmark", "repeat=3", "验证泛化和回归风险"] })}
${line({ x1: 410, y1: 305, x2: 455, y2: 305 })}
${line({ x1: 785, y1: 305, x2: 830, y2: 305 })}
${line({ x1: 1160, y1: 305, x2: 1205, y2: 305 })}
${card({ x: 165, y: 565, w: 560, h: 210, title: "evaluate_stage_result", accent: palette.teal, lines: ["把 adapter 输出转换成 passed / failed / inconclusive / planned", "支持 baseline comparison、min_improvement、regressed tasks 限制"] })}
${card({ x: 875, y: 565, w: 560, h: 210, title: "run_validation", accent: palette.red, lines: ["重复执行、聚合 success_rate、cost、duration、task_results", "识别 flaky、稳定性分数和置信区间宽度"] })}
${line({ x1: 618, y1: 405, x2: 445, y2: 565, color: palette.teal })}
${line({ x1: 995, y1: 405, x2: 1155, y2: 565, color: palette.red })}
`;
  return base({
    title: "分阶段 Gate：让“更好”变成可判定",
    subtitle: "候选必须先过快速筛选，再通过稳定性、holdout 和回归验证，才适合成为 champion。",
    body,
  });
}

function diagram6() {
  const body = `
${card({ x: 90, y: 190, w: 380, h: 170, title: "workspace.json", accent: palette.blue, lines: ["objective、domain、tracks、autonomy", "优化任务的长期配置"] })}
${card({ x: 610, y: 190, w: 380, h: 170, title: "state.json", accent: palette.green, lines: ["active_track、last_iteration_id", "last_experiment_id、current_champion"] })}
${card({ x: 1130, y: 190, w: 380, h: 170, title: "track policy", accent: palette.orange, lines: ["search / promotion / regression benchmark", "promotion policy 和 stage 目标"] })}
${card({ x: 90, y: 500, w: 380, h: 190, title: "proposals/", accent: palette.purple, lines: ["proposal.json", "edit_plan.json", "preview_application.json", "candidate.patch"] })}
${card({ x: 610, y: 500, w: 380, h: 190, title: "iterations/", accent: palette.teal, lines: ["summary.json", "linked_records.json", "edit.diff", "source_plan 快照"] })}
${card({ x: 1130, y: 500, w: 380, h: 190, title: "registry + champion", accent: palette.red, lines: ["registry/run_*.json 保存每次 benchmark", "champion.json 指向当前获胜记录"] })}
${line({ x1: 470, y1: 275, x2: 610, y2: 275 })}
${line({ x1: 990, y1: 275, x2: 1130, y2: 275 })}
${line({ x1: 280, y1: 360, x2: 280, y2: 500 })}
${line({ x1: 800, y1: 360, x2: 800, y2: 500 })}
${line({ x1: 1320, y1: 360, x2: 1320, y2: 500 })}
${badge({ x: 520, y: 785, value: "核心设计：所有判断都有文件证据，campaign 中断后可 resume", fill: "#dff4ff", color: palette.teal })}
`;
  return base({
    title: ".autoharness 持久化证据地图",
    subtitle: "自主迭代能过夜运行，靠的是文件化状态、原子写入、事件日志和可追溯 artifact。",
    body,
  });
}

function diagram7() {
  const body = `
${card({ x: 110, y: 195, w: 360, h: 190, title: "最新失败信号", accent: palette.red, lines: ["latest_failure_summary", "latest_regression_summary", "task_keys / regressed_tasks"] })}
${card({ x: 625, y: 195, w: 360, h: 190, title: "ProposalGenerationContext", accent: palette.blue, lines: ["objective、stage、autonomy", "effective_config、benchmark_target", "latest_record_status"] })}
${card({ x: 1140, y: 195, w: 360, h: 190, title: "Generator Request", accent: palette.purple, lines: ["candidate_index、strategy_id", "intervention_class", "failure_focus / regressed_tasks", "hypothesis_seed"] })}
${card({ x: 375, y: 575, w: 360, h: 190, title: "Edit Plan JSON", accent: palette.orange, lines: ["summary + operations", "输出必须能被 editing.py 解析"] })}
${card({ x: 890, y: 575, w: 360, h: 190, title: "下一轮更聪明", accent: palette.green, lines: ["benchmark 结果回写 registry", "失败/回归被提炼后进入下一次 context"] })}
${line({ x1: 470, y1: 290, x2: 625, y2: 290 })}
${line({ x1: 985, y1: 290, x2: 1140, y2: 290 })}
${line({ x1: 1320, y1: 385, x2: 735, y2: 575 })}
${line({ x1: 735, y1: 670, x2: 890, y2: 670 })}
${line({ x1: 1070, y1: 575, x2: 290, y2: 385, color: palette.green, dash: true })}
${badge({ x: 580, y: 815, value: "反馈闭环：不是随机试错，而是失败聚焦 + 回归优先 + 策略选择", fill: "#e8f6ef", color: palette.green })}
`;
  return base({
    title: "候选生成为什么会越来越聚焦",
    subtitle: "生成器拿到的不只是源码，还有上一轮失败、回归、stage 和权限上下文。",
    body,
  });
}

const diagrams = [
  ["01-control-plane.svg", diagram1()],
  ["02-iteration-lifecycle.svg", diagram2()],
  ["03-campaign-loop.svg", diagram3()],
  ["04-autonomy-policy.svg", diagram4()],
  ["05-stage-gates.svg", diagram5()],
  ["06-artifact-map.svg", diagram6()],
  ["07-feedback-context.svg", diagram7()],
];

for (const [name, svg] of diagrams) {
  writeFileSync(join(imageDir, name), svg, "utf8");
}

console.log(`Wrote ${diagrams.length} SVG teaching images to ${imageDir}`);
