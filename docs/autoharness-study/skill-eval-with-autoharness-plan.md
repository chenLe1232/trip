# 通过 Codex + Autoharness 评测 Skill 的详细方案

## 目标

本方案要解决一个边界问题：Skill 本身不是天然可打分对象，Autoharness 也不会直接理解 `SKILL.md` 的质量。真正可评测的是：

```text
某个 Skill 版本
  + Codex 执行环境
  + 一组固定任务
  + 一套可重复打分规则
= 该 Skill 在这些任务上的表现
```

因此整体目标是搭建一个 Skill eval harness，让 Codex 负责执行 Skill，让评测脚本负责打分，让 Autoharness 负责自动生成候选改动、运行评测、比较结果和保留更好的 Skill 版本。

本方案重点评测三类内容：

1. **Skill 的引用**：相关任务是否会正确触发或显式使用 Skill；无关任务是否不会误用 Skill。
2. **脚本的执行**：Skill 中的 `scripts/`、工具链、命令是否被正确调用，产物是否存在且可验证。
3. **整体效果**：Codex 使用该 Skill 后，最终产出是否更正确、更稳定、更符合约束、更低成本。

参考方法来自 Phil Schmid 的 Skill 测试文章：[Practical Guide to Evaluating and Testing Agent Skills](https://www.philschmid.de/testing-skills)。该文章的关键原则是先定义成功标准，再建立 prompt set、确定性检查、负例测试、多次运行和必要时的 LLM-as-judge。Autoharness 则负责把这个 eval harness 包装成可反复运行的 `benchmark command`。

## 总体架构

```text
skills/<candidate-skill>/
  SKILL.md
  references/
  scripts/
  examples/

evals/skill-eval/
  cases.json
  checks.py
  run_codex_case.py
  run_eval.py
  schemas/
  fixtures/
  outputs/
    <run_id>/
      metrics.json
      task_results.json
      result.json

Autoharness
  edit_plan -> 修改 Skill
  run benchmark command -> python evals/skill-eval/run_eval.py
  通过 metrics_parser / task_results_parser 读取 JSON
  比较 baseline/champion
```

分层责任：

| 层 | 职责 | 不负责 |
| --- | --- | --- |
| Skill | 提供触发描述、执行步骤、脚本和参考资料 | 自己证明自己有效 |
| Codex | 在测试任务中加载并执行 Skill | 最终客观打分 |
| Eval Harness | 组织测试集、运行 Codex、检查产物、输出指标 | 自动改 Skill |
| Autoharness | 自动改 Skill、跑评测、记录、回滚、推广 champion | 发明业务评测标准 |

## 评测对象边界

建议先把可编辑范围限制在 Skill 目录，避免 Autoharness 在早期优化时改到评测器本身。

```yaml
autonomy: bounded
editable_surfaces:
  - skills/my-skill/SKILL.md
  - skills/my-skill/references/
  - skills/my-skill/scripts/
  - skills/my-skill/examples/
protected_surfaces:
  - evals/skill-eval/
  - autoharness.yaml
  - benchmarks/
```

这样 Autoharness 可以优化 Skill 文档和脚本，但不能偷偷改测试集或评分规则。

还要保护评测运行器的“外壳配置”，例如 Codex runner 的 sandbox、临时 `CODEX_HOME` 生成逻辑、case fixture 和 scoring 权重。否则候选 Skill 可以通过修改评测器或输出路径来获得虚假的高分。

## 评测维度 1：Skill 的引用

Skill 引用要评三件事：该用时用、不该用时不用、使用时加载正确资料。

### 1.1 正向触发

测试相关任务时，Codex 应该能明确使用目标 Skill。

测试样例：

```json
{
  "id": "trigger_explicit_skill",
  "category": "skill_reference",
  "prompt": "请使用 my-skill 完成这个任务，并输出最终产物。",
  "should_trigger": true,
  "expected_checks": [
    "skill_usage_declared",
    "skill_specific_output_shape",
    "required_artifacts_exist"
  ]
}
```

可检查信号：

- Codex 最终输出或结构化报告中声明使用了目标 Skill。
- 输出结果符合该 Skill 独有的流程或格式。
- 生成了该 Skill 要求的产物，比如 `usage_report.json`、代码文件、图片、报告、转换结果。

注意：不要只相信“我用了这个 Skill”的自述。更可靠的方式是检查该 Skill 规定的可观察产物和特定行为。

建议把显式点名 Skill 的 case 命名为 `explicit_use_compliance`。它评的是“用户要求使用时是否遵循”，不是自动路由能力。

### 1.2 自然触发

测试不显式点名 Skill 的真实用户任务，检查 Skill 的 frontmatter `description` 是否足够准确。

测试样例：

```json
{
  "id": "trigger_natural_task",
  "category": "skill_reference",
  "prompt": "把这个设计 DSL 转成可维护的 React Flex 布局，并保持视觉结构。",
  "should_trigger": true,
  "expected_checks": [
    "skill_specific_output_shape",
    "references_relevant_rules"
  ]
}
```

这类测试主要评 `SKILL.md` 的 `name` 和 `description`。如果自然触发失败，通常不是脚本问题，而是描述太窄、关键词不贴近用户语言，或者 Skill body 没有给 Codex 足够明确的执行入口。

自然触发不能只靠最终答案相似度。建议至少使用一种可观察 oracle：

- 解析 `codex exec --json` 事件，确认 Skill 文件或 Skill 相关 references 被读取。
- 要求 Skill 在测试模式下生成一个 sentinel artifact，例如 `artifacts/skill_usage.json`。
- 对比 `with_skill` 和 `without_skill` 两组结果，确认增益来自 Skill，而不是 prompt 自己已经足够。
- 检查 Skill 独有脚本、模板或产物 schema 是否出现。

### 1.3 负向触发

无关任务不应该误触发 Skill。

测试样例：

```json
{
  "id": "negative_unrelated_task",
  "category": "skill_reference",
  "prompt": "写一个读取 CSV 并生成柱状图的 Python 脚本。",
  "should_trigger": false,
  "expected_checks": [
    "no_skill_specific_artifacts",
    "no_unrelated_workflow_pollution"
  ]
}
```

负例很重要。一个 description 写得太宽的 Skill，会污染普通任务，让 Codex 在不该使用时引入多余流程。

### 1.4 引用评分

建议把 Skill 引用单独算分：

```text
reference_score =
  positive_trigger_pass_rate * 0.45
  + natural_trigger_pass_rate * 0.35
  + negative_trigger_pass_rate * 0.20
```

最低 gate：

- `positive_trigger_pass_rate >= 0.95`
- `natural_trigger_pass_rate >= 0.80`
- `negative_trigger_pass_rate >= 0.90`

## 评测维度 2：脚本的执行

如果 Skill 带 `scripts/`，评测不能只看最终文字答案，要检查脚本是否真的可运行、是否产出正确 artifact、失败时是否有清晰错误。

### 2.1 脚本发现

静态检查：

- `SKILL.md` 中引用的脚本路径真实存在。
- 脚本有明确入口和参数说明。
- 脚本不依赖不存在的相对路径。
- 脚本不会默认写到不可追踪的临时目录。

示例检查：

```python
def check_script_paths_exist(skill_root, skill_md_text):
    referenced = extract_script_paths(skill_md_text)
    return all((skill_root / path).exists() for path in referenced)
```

### 2.2 脚本调用

动态检查要在 Codex 执行任务后验证：

- 是否生成脚本输出文件。
- 输出文件是否符合 schema。
- 命令是否非零退出。
- 日志中是否有关键步骤。
- 脚本是否被重复无意义调用。

建议让每个 case 都有独立 workspace：

```text
evals/skill-eval/outputs/<run_id>/<case_id>/<trial_id>/
  prompt.txt
  codex-events.jsonl
  final-message.txt
  workspace/
  artifacts/
  checks.json
```

### 2.3 脚本产物 Schema

要求被测 Skill 或测试 harness 产出结构化结果，避免只靠人读日志。

```json
{
  "format_version": "skill_eval.case_result.v1",
  "case_id": "script_execution_basic",
  "skill_name": "my-skill",
  "artifacts": [
    {
      "path": "artifacts/result.json",
      "kind": "json",
      "required": true
    }
  ],
  "commands_observed": [
    {
      "command": "python skills/my-skill/scripts/convert.py --input fixture.json --out artifacts/result.json",
      "exit_code": 0
    }
  ]
}
```

如果 Codex CLI 的 JSONL 事件能捕获工具调用，则从 `codex exec --json` 解析命令；如果事件格式不足，就退化为检查最终 artifact 和日志。

### 2.4 脚本执行评分

```text
script_score =
  script_static_integrity * 0.20
  + required_artifacts_pass_rate * 0.35
  + artifact_schema_pass_rate * 0.25
  + command_stability_pass_rate * 0.20
```

最低 gate：

- `required_artifacts_pass_rate >= 0.95`
- `artifact_schema_pass_rate >= 0.90`
- 所有关键脚本必须至少有一个正向动态 case 覆盖。

## 评测维度 3：整体效果

整体效果回答的是：这个 Skill 是否真的让 Codex 完成任务更好，而不是只“看起来被引用了”。

### 3.1 正确性

不同 Skill 的正确性要按产物设计：

| Skill 类型 | 确定性检查 |
| --- | --- |
| 代码生成 | build/test/lint 通过，关键 API 使用正确，无 deprecated 模式 |
| 设计转代码 | React/Vue 构建通过，布局结构符合预期，截图差异低于阈值 |
| 文档写作 | 文件存在，章节齐全，引用来源存在，格式符合模板 |
| 数据处理 | 输出 CSV/JSON schema 正确，统计值可复算 |
| 浏览器工作流 | 页面状态达到目标，截图或 DOM 检查通过 |

### 3.2 指令遵循

检查 Skill 中的硬性规则是否被遵守：

- 是否使用指定 API、模型、库或工具。
- 是否避免禁用项。
- 是否遵守输出目录和文件命名。
- 是否按要求进行验证。
- 是否没有修改不该修改的文件。

### 3.3 稳定性

每个 case 建议至少跑 3 次。不要只看一次成功。

```text
case stability =
  same_case_pass_count / trial_count
```

建议 gate：

- screening：每个 case 跑 1 次，用于快速过滤。
- validation：核心 case 跑 3 次。
- holdout：隐藏或较少见 case 跑 3 次。
- regression：历史失败 case 跑 3 次。

### 3.4 成本与效率

记录：

- 总耗时。
- Codex 退出码。
- token 或事件数量，如果可得。
- 重试次数。
- 无意义命令次数。
- 产物大小。

效率不是第一 gate，但当两个版本正确率接近时，应优先选择更稳定、更省的版本。

### 3.5 整体效果评分

```text
overall_score =
  correctness_score * 0.45
  + instruction_following_score * 0.25
  + stability_score * 0.20
  + efficiency_score * 0.10
```

最终总分：

```text
skill_eval_score =
  reference_score * 0.25
  + script_score * 0.25
  + overall_score * 0.50
```

推荐 promotion gate：

- `skill_eval_score >= 0.85`
- `overall_score >= 0.80`
- 没有 P0/P1 失败。
- 相比当前 champion，核心 case 没有回归。

## 测试集设计

### cases.json

```json
[
  {
    "id": "explicit_basic",
    "category": "skill_reference",
    "prompt": "请使用 my-skill 完成基础任务。",
    "should_trigger": true,
    "severity": "P1",
    "blocking": true,
    "weight": 2.0,
    "trial_count": 3,
    "workspace_fixture": "fixtures/basic",
    "expected_checks": [
      "skill_specific_output_shape",
      "required_artifacts_exist"
    ]
  },
  {
    "id": "script_happy_path",
    "category": "script_execution",
    "prompt": "对 fixture 输入执行转换，并把结果写到 artifacts/result.json。",
    "should_trigger": true,
    "severity": "P0",
    "blocking": true,
    "weight": 3.0,
    "trial_count": 3,
    "workspace_fixture": "fixtures/script-basic",
    "expected_checks": [
      "script_output_exists",
      "script_output_schema_valid",
      "no_error_logs"
    ]
  },
  {
    "id": "end_to_end_realistic",
    "category": "overall_effect",
    "prompt": "完成一个接近真实用户请求的端到端任务。",
    "should_trigger": true,
    "severity": "P0",
    "blocking": true,
    "weight": 4.0,
    "trial_count": 3,
    "workspace_fixture": "fixtures/e2e",
    "expected_checks": [
      "build_passes",
      "artifact_quality_passes",
      "constraints_followed"
    ]
  },
  {
    "id": "negative_unrelated",
    "category": "skill_reference",
    "prompt": "写一个和该 Skill 无关的小工具。",
    "should_trigger": false,
    "severity": "P1",
    "blocking": true,
    "weight": 2.0,
    "trial_count": 2,
    "workspace_fixture": "fixtures/empty",
    "expected_checks": [
      "no_skill_specific_artifacts",
      "no_unrelated_workflow_pollution"
    ]
  }
]
```

字段约定：

- `severity`：`P0` 表示核心能力，失败直接阻断 promotion；`P1` 表示重要能力；`P2` 表示普通质量项。
- `blocking`：为 `true` 时，失败不能被平均分抵消。
- `weight`：用于 task_results 汇总和 champion 比较。平均分只能辅助排序，不能覆盖 blocking failure。

### Case 分布建议

MVP 阶段 10 到 15 个 case：

- Skill 引用：4 个正向、2 个自然触发、2 个负向。
- 脚本执行：3 到 5 个覆盖关键脚本路径。
- 整体效果：3 到 5 个真实端到端任务。

成熟阶段 30 到 60 个 case：

- 常规任务。
- 边界输入。
- 历史失败 case。
- 负向任务。
- 隐藏 holdout 任务。

## Codex Runner 设计

当前机器可使用 `codex exec` 非交互执行。建议 runner 使用 JSONL 事件和最终消息文件：

```bash
codex exec \
  --cd "$CASE_WORKSPACE" \
  --sandbox workspace-write \
  --ask-for-approval never \
  --ephemeral \
  --json \
  --output-last-message "$CASE_OUT/final-message.txt" \
  "$PROMPT" \
  > "$CASE_OUT/codex-events.jsonl"
```

为了避免上下文污染：

- 每个 case/trial 单独复制 fixture。
- 使用 `--ephemeral`，减少历史会话污染。
- 必要时使用独立 `CODEX_HOME`，分别构造 `with_skill` 和 `without_skill` 环境。
- 固定模型和配置 profile。
- 禁止 case 之间共享输出目录。
- 默认使用 `workspace-write`，只允许写 case 临时 workspace。只有测试明确需要系统级能力时，才在容器或专用机器里使用更高权限。
- 所有网络、浏览器、MCP、环境变量和密钥都要通过 runner 白名单传入，不能继承用户完整环境。

对比测试建议：

```text
with_skill:
  CODEX_HOME = eval_env/codex-home-with-skill

without_skill:
  CODEX_HOME = eval_env/codex-home-without-skill
```

这样可以回答两个问题：

1. 加载 Skill 是否比不加载更好。
2. Skill 新版本是否比当前 champion 更好。

`CODEX_HOME` 不能只是空目录。runner 需要构造可登录、可复现的临时环境：

```text
eval_env/codex-home-base/
  config.toml
  auth material or inherited auth pointer

eval_env/codex-home-with-skill/
  config.toml
  skills/my-skill/SKILL.md
  skills/my-skill/references/
  skills/my-skill/scripts/

eval_env/codex-home-without-skill/
  config.toml
```

每次正式评测前先跑 preflight：

```text
1. codex CLI 可执行。
2. 模型和认证可用。
3. with_skill 环境能发现目标 Skill。
4. without_skill 环境不能发现目标 Skill。
5. case workspace 只允许写入自身目录。
```

如果 Codex CLI 当前没有直接暴露“列出已加载 Skill”的机器接口，就用一个最小探针任务验证：要求 Codex 输出它能看到的目标 Skill 入口，并检查事件日志中是否读取了目标 `SKILL.md` 或 sentinel artifact 是否生成。

## 评测脚本输出格式

Autoharness 最适合读取统一 JSON，因此 `run_eval.py` 最终应输出：

```json
{
  "benchmark_name": "skill_eval_my_skill",
  "success": true,
  "score": 0.89,
  "metrics": {
    "skill_eval_score": 0.89,
    "reference_score": 0.93,
    "script_score": 0.88,
    "overall_score": 0.87,
    "pass_rate": 0.91,
    "trial_count": 42,
    "failed_trial_count": 4,
    "mean_duration_seconds": 122.4
  },
  "task_results": [
    {
      "task_id": "explicit_basic",
      "success": true,
      "score": 1.0,
      "category": "skill_reference",
      "severity": "P1",
      "blocking": true
    },
    {
      "task_id": "script_happy_path",
      "success": false,
      "score": 0.4,
      "category": "script_execution",
      "severity": "P0",
      "blocking": true,
      "failure_class": "artifact_schema_failed"
    }
  ],
  "artifact_sources": {
    "summary": "evals/skill-eval/outputs/<run_id>/summary.json",
    "events": "evals/skill-eval/outputs/<run_id>/events",
    "failed_cases": "evals/skill-eval/outputs/<run_id>/failed_cases.json"
  }
}
```

注意：这个 `result.json` 是给人和归档看的总包。Autoharness 的 `generic_command` adapter 不会自动理解任意 `metrics_path` 字段，必须显式配置 `metrics_parser` 和 `task_results_parser`。因此 `run_eval.py` 还应该额外写两个扁平文件：

```text
evals/skill-eval/outputs/<run_id>/metrics.json
evals/skill-eval/outputs/<run_id>/task_results.json
```

其中 `metrics.json` 是对象，`task_results.json` 是 task result 数组。

`outputs/latest` 最多作为人工查看用的索引或软链接，不应该作为 Autoharness 解析路径。Autoharness repeat、background campaign 或并发运行时都必须写入稳定的 `run_id` 目录，避免相互覆盖。

## Autoharness 接入设计

### benchmarks/skill-eval-screening.yaml

```yaml
adapter: generic_command
benchmark_name: skill_eval_screening
command:
  - python
  - evals/skill-eval/run_eval.py
  - --cases
  - evals/skill-eval/cases.json
  - --stage
  - screening
  - --run-id
  - autoharness-screening
  - --output
  - evals/skill-eval/outputs/autoharness-screening/result.json
metrics_parser:
  format: json_file
  path: evals/skill-eval/outputs/autoharness-screening/metrics.json
task_results_parser:
  format: json_file
  path: evals/skill-eval/outputs/autoharness-screening/task_results.json
  task_id_field: task_id
  success_field: success
  score_field: score
  tier_field: severity
  tier_weights:
    P0: 5.0
    P1: 2.0
    P2: 1.0
```

### benchmarks/skill-eval-validation.yaml

```yaml
adapter: generic_command
benchmark_name: skill_eval_validation
command:
  - python
  - evals/skill-eval/run_eval.py
  - --cases
  - evals/skill-eval/cases.json
  - --stage
  - validation
  - --repeat
  - "3"
  - --run-id
  - autoharness-validation
  - --output
  - evals/skill-eval/outputs/autoharness-validation/result.json
metrics_parser:
  format: json_file
  path: evals/skill-eval/outputs/autoharness-validation/metrics.json
task_results_parser:
  format: json_file
  path: evals/skill-eval/outputs/autoharness-validation/task_results.json
  task_id_field: task_id
  success_field: success
  score_field: score
  tier_field: severity
  tier_weights:
    P0: 5.0
    P1: 2.0
    P2: 1.0
```

### autoharness.yaml 关键配置

```yaml
format_version: autoharness.project.v1
workspace:
  root: .autoharness/workspaces
  workspace_id: skill-eval-my-skill
  objective: Improve the target Codex skill against deterministic and behavioral evals.
  domain: codex-skill-evaluation

autonomy:
  mode: bounded
  editable_surfaces:
    - skills/my-skill/SKILL.md
    - skills/my-skill/references/
    - skills/my-skill/scripts/
    - skills/my-skill/examples/
  protected_surfaces:
    - evals/skill-eval/
    - benchmarks/
    - autoharness.yaml

benchmarks:
  search_benchmark: benchmarks/skill-eval-screening.yaml
  promotion_benchmark: benchmarks/skill-eval-validation.yaml
  regression_benchmark: benchmarks/skill-eval-regression.yaml
```

## Autoharness 优化循环

```text
1. baseline
   跑当前 Skill，记录初始 score。

2. generate-proposal
   Autoharness 生成 edit_plan，只允许修改 Skill 目录。

3. run-iteration
   临时应用 Skill 改动，运行 skill eval benchmark。

4. stage gate
   根据 reference/script/overall 三类指标判断是否通过。

5. compare champion
   和当前最好 Skill 版本比较，不能只看总分，还要看核心 case 是否回归。

6. promote
   只有通过 validation/holdout 的候选，才可以成为 champion。

7. next iteration
   把失败 case、回归 case、脚本错误原因写入下一轮 proposal context。
```

## 失败分类

建议评测脚本把失败归类，方便 Autoharness 下一轮聚焦：

| failure_class | 含义 | 下一轮优化方向 |
| --- | --- | --- |
| `skill_not_triggered` | 相关任务没有使用 Skill | 改 `name` / `description` / trigger 语义 |
| `skill_over_triggered` | 无关任务误用 Skill | 收窄 description，加入适用边界 |
| `script_missing` | 文档引用脚本不存在 | 修路径或补脚本 |
| `script_runtime_error` | 脚本执行失败 | 修脚本依赖、参数、错误处理 |
| `artifact_missing` | 没有产出要求文件 | 强化输出路径和交付要求 |
| `artifact_schema_failed` | 文件存在但格式不对 | 明确 schema，修脚本或指令 |
| `instruction_violation` | 违反 Skill 约束 | 把说明改成 directive 而不是背景知识 |
| `quality_regression` | 结果质量比 champion 差 | 根据失败 case 改 examples 或 references |
| `flaky_behavior` | 多次运行不稳定 | 简化流程，减少自由度，增加检查步骤 |

## LLM-as-judge 的使用边界

优先使用确定性检查：

- 文件存在。
- JSON schema。
- build/test/lint。
- 正则检查 API 使用。
- 图片尺寸、截图差异、DOM 检查。
- 日志和命令退出码。

只有这些不够时才使用 LLM-as-judge，例如：

- 文档质量。
- UI 审美。
- 代码结构是否可维护。
- 设计还原是否符合主观标准。

LLM judge 也必须结构化输出，不能只写自然语言：

```json
{
  "passed": true,
  "score": 82,
  "dimensions": {
    "instruction_following": {
      "passed": true,
      "score": 90,
      "notes": "..."
    },
    "maintainability": {
      "passed": false,
      "score": 68,
      "notes": "..."
    }
  }
}
```

## MVP 实施步骤

### 第 1 步：选一个 Skill

先选一个边界清晰、有脚本或明确产物的 Skill。不要一开始评太抽象的写作偏好 Skill。

### 第 2 步：写 10 个 cases

覆盖：

- 3 个显式使用 Skill。
- 2 个自然触发。
- 2 个负向不触发。
- 2 个脚本执行。
- 1 个端到端综合任务。

### 第 3 步：写确定性 checks

先写最硬的检查：

- artifact exists。
- schema valid。
- build/test pass。
- forbidden pattern absent。
- required pattern present。

### 第 4 步：实现 Codex runner

最小 runner 只需要：

```text
for case in cases:
  for trial in case.trial_count:
    copy fixture
    run codex exec
    capture events/final message/artifacts
    run checks
aggregate metrics
write result.json
```

### 第 5 步：跑 baseline

分别跑：

```text
without_skill
with_skill_current
```

得到 Skill 是否真的有增益。

### 第 6 步：接入 Autoharness

把 `python evals/skill-eval/run_eval.py ...` 作为 benchmark command。先用 `proposal` 或 `bounded` 模式，不要直接 `full`。

### 第 7 步：允许 Autoharness 优化 Skill

让它只改：

- `SKILL.md`
- `references/*.md`
- `scripts/*.py`
- `examples/*`

评测器和 cases 必须 protected。

## 验收标准

MVP 完成标准：

- 能独立运行 `python evals/skill-eval/run_eval.py`。
- 能产出 `result.json`，包含 `metrics` 和 `task_results`。
- 至少覆盖 Skill 引用、脚本执行、整体效果三类 case。
- 有负向 case。
- 每个 case 有可追踪输出目录。
- Autoharness 能通过 `run-benchmark` 调用该 eval。

成熟版完成标准：

- 能跑 screening / validation / regression 三套 benchmark。
- 能比较 with-skill 和 without-skill。
- 能比较 candidate 和 champion。
- 失败 case 会进入下一轮 proposal context。
- Skill 改动默认回滚，只有 promotion 才落地。
- 评测器本身被 protected surface 保护。

## 关键风险

1. **评测器太弱**：Autoharness 会认真优化错误目标。
2. **只测显式调用**：会高估 Skill，真实用户不一定点名 Skill。
3. **没有负例**：Skill description 会越改越宽，污染普通任务。
4. **只跑一次**：无法发现 Codex 非确定性和 flaky 行为。
5. **让 Autoharness 改评测器**：会出现“作弊式优化”。
6. **只看总分**：可能牺牲关键 case 换取平均分提升。

## 一句话结论

这套方案的本质是：

```text
把 Skill 从“说明文档”变成“可执行、可观察、可比较的行为系统”。
```

Codex 负责按 Skill 做事，eval harness 负责判断做得怎么样，Autoharness 负责自动迭代 Skill 并保留更好的版本。
