<div align="center">

# CodeGraph

### 为 Claude Code、Cursor、Codex、OpenCode、Hermes Agent、Gemini、Antigravity 和 Kiro 注入语义级代码智能

**约节省 35% 费用 · 减少 70% 工具调用 · 100% 本地运行**

### [文档与网站 →](https://colbymchenry.github.io/codegraph/)

[![npm version](https://img.shields.io/npm/v/@colbymchenry/codegraph.svg)](https://www.npmjs.com/package/@colbymchenry/codegraph)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Self-contained](https://img.shields.io/badge/Node.js-bundled%20%C2%B7%20none%20required-brightgreen.svg)](https://nodejs.org/)

[![Windows](https://img.shields.io/badge/Windows-supported-blue.svg)](#%E6%94%AF%E6%8C%81%E7%9A%84%E5%B9%B3%E5%8F%B0)
[![macOS](https://img.shields.io/badge/macOS-supported-blue.svg)](#%E6%94%AF%E6%8C%81%E7%9A%84%E5%B9%B3%E5%8F%B0)
[![Linux](https://img.shields.io/badge/Linux-supported-blue.svg)](#%E6%94%AF%E6%8C%81%E7%9A%84%E5%B9%B3%E5%8F%B0)

[![Claude Code](https://img.shields.io/badge/Claude_Code-supported-blueviolet.svg)](#%E6%94%AF%E6%8C%81%E7%9A%84%E4%BB%A3%E7%90%86)
[![Cursor](https://img.shields.io/badge/Cursor-supported-blueviolet.svg)](#%E6%94%AF%E6%8C%81%E7%9A%84%E4%BB%A3%E7%90%86)
[![Codex](https://img.shields.io/badge/Codex-supported-blueviolet.svg)](#%E6%94%AF%E6%8C%81%E7%9A%84%E4%BB%A3%E7%90%86)
[![opencode](https://img.shields.io/badge/opencode-supported-blueviolet.svg)](#%E6%94%AF%E6%8C%81%E7%9A%84%E4%BB%A3%E7%90%86)
[![Hermes Agent](https://img.shields.io/badge/Hermes_Agent-supported-blueviolet.svg)](#%E6%94%AF%E6%8C%81%E7%9A%84%E4%BB%A3%E7%90%86)
[![Gemini](https://img.shields.io/badge/Gemini-supported-blueviolet.svg)](#%E6%94%AF%E6%8C%81%E7%9A%84%E4%BB%A3%E7%90%86)
[![Antigravity](https://img.shields.io/badge/Antigravity-supported-blueviolet.svg)](#%E6%94%AF%E6%8C%81%E7%9A%84%E4%BB%A3%E7%90%86)
[![Kiro](https://img.shields.io/badge/Kiro-supported-blueviolet.svg)](#%E6%94%AF%E6%8C%81%E7%9A%84%E4%BB%A3%E7%90%86)

</div>

[English](README.md) | [中文](README.zh-CN.md)

---

## 关于本分支

本仓库是基于 CodeGraph 的分支，核心新增特性是**基于 git 分支的独立代码索引管理**。

### 为什么需要这个特性？

在多人协作或多分支开发的项目中，不同分支的代码结构和符号定义往往存在差异。当 AI 编程助手需要理解代码时，如果索引了错误分支的代码，就会给出不准确甚至错误的回答。传统方案每次切换分支都需重新索引，耗时且低效。

### 实现原理

- **自动感知分支**：启动时自动检测当前 git 分支，加载对应的索引数据库
- **分支独立存储**：每个分支的索引数据独立存储在 `.codegraph/branches/<分支名>/` 目录下
- **即时切换**：切换到已索引过的分支时，瞬间加载，无需重新索引
- **自动淘汰**：保留最近使用的分支缓存（默认 10 个），自动清理最久未用的旧数据
- **平滑迁移**：旧版单数据库项目首次运行时自动迁移至分支结构，无需手动操作

### 核心优势

| 优势 | 说明 |
|------|------|
| **精准上下文** | AI 助手只看到当前分支的代码符号，不会因跨分支混淆而给出错误答案 |
| **零等待切换** | 分支索引持久化存储，`git checkout` 后即开即用，无需等待 |
| **分支隔离** | 一个分支的索引变更不会影响其他分支，互不干扰 |
| **完全透明** | 正常工作流，无需额外操作或配置 |

---

## 快速开始

**无需安装 Node.js** — 一条命令即可获取适合你系统的构建版本：

```bash
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh

# Windows (PowerShell)
irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex
```

已安装 Node？也可使用 npm（兼容任意版本）：

```bash
npx @colbymchenry/codegraph        # 零安装，直接运行
npm i -g @colbymchenry/codegraph
```

<sub>CodeGraph 自带运行时 — 无需编译、无需原生构建，跨平台一致运行。交互式安装程序会自动配置你的 AI 编程助手 —— Claude Code、Cursor、Codex CLI、opencode、Hermes Agent、Gemini CLI、Antigravity IDE、Kiro。</sub>

### 初始化项目

```bash
cd your-project
codegraph init -i
```

<div align="center">

![1_C_VYnhpys0UHrOuOgpgoyw](https://github.com/user-attachments/assets/f168182f-4d9a-44e0-94d7-08d018cc8a3a)

</div>

### 卸载

改变主意了？一条命令即可从所有配置过的 AI 助手中移除 CodeGraph：

```bash
codegraph uninstall
```

<sub>逆向安装过程 — 从每个已配置的代理中移除 CodeGraph 的 MCP 服务器配置、使用说明和权限设置。项目索引文件（`.codegraph/`）不受影响；可使用 `codegraph uninit` 逐项目移除。使用 `--target` 指定移除目标代理，或 `--yes` 静默运行。</sub>

---

## 为什么选择 CodeGraph？

当 Claude Code 探索代码库时，它会启动 **Explore 子代理**扫描文件 —— 每次工具调用都在消耗 Token。

**CodeGraph 为这些子代理提供预构建的知识图谱** —— 符号关系、调用图和代码结构。代理直接查询图谱，无需逐文件扫描。

### 基准测试结果

在 **7 个真实世界开源代码库**（覆盖 7 种语言）上测试，对比 AI 代理（Claude Code，无头模式）回答同一个架构问题时 **有** 和 **没有** CodeGraph 的表现。每个数据为 **每组 4 次运行的中位数**。_于 **v0.9.4**（2026-05-24）重新验证。_

> **平均：费用节省 35% · Token 减少 57% · 速度提升 46% · 工具调用减少 71%**

| 代码库 | 语言 | 费用 | Token | 时间 | 工具调用 |
|----------|----------|------|--------|------|------------|
| **VS Code** | TypeScript · ~10k 文件 | 节省 26% | 减少 78% | 快 52% | 减少 85% |
| **Excalidraw** | TypeScript · ~640 | 节省 52% | 减少 90% | 快 73% | 减少 96% |
| **Django** | Python · ~3k | 节省 12% | 减少 36% | 快 19% | 减少 53% |
| **Tokio** | Rust · ~790 | 节省 82% | 减少 86% | 快 71% | 减少 92% |
| **OkHttp** | Java · ~645 | 节省 2% | 减少 13% | 快 31% | 减少 45% |
| **Gin** | Go · ~110 | 节省 21% | 减少 34% | 快 27% | 减少 40% |
| **Alamofire** | Swift · ~110 | 节省 47% | 减少 64% | 快 48% | 减少 83% |

代码库越大，收益越显著：大型仓库中，带 CodeGraph 的代理只需少量调用即可从索引获取答案，**零文件读取**；而不带 CodeGraph 的代理则需大量 grep/find/Read 操作（以及它派生的子代理）。对于像 Gin（~150 文件）这样的小仓库，原生搜索本身已很快，差距会缩小。

<details>
<summary><strong>完整基准测试详情</strong></summary>

**方法论。** 每组为 `claude -p`（Claude Opus 4.7）以无头模式运行，针对仓库使用 `--strict-mcp-config`：**有** = 启用 CodeGraph 的 MCP 服务器，**无** = 空的 MCP 配置。内置的 Read/Grep/Bash 两者均可使用。每个仓库同一问题，**每组 4 次运行，报告中位数**。费用 = 运行的总成本（美元）；Token = 处理的 Token 总数（含缓存的输入 + 输出）；时间 = 墙钟时间；工具调用 = 所有工具调用，包括模型派生的子代理中的调用。仓库以 `--depth 1` 克隆，并由提供服务的同一 CodeGraph 构建版本索引。于 **v0.9.4**（2026-05-24）重新验证；各仓库数据会因无 CodeGraph 组的波动而变动（中位数 4 次可平滑，但尾部仍存在 — 例如 Tokio 的无 CodeGraph 组某批次达到了 $2.41/3 分钟）。

**问题：**
| 代码库 | 问题 |
|----------|-------|
| VS Code | "扩展主机如何与主进程通信？" |
| Excalidraw | "Excalidraw 如何渲染和更新画布元素？" |
| Django | "Django 的 ORM 如何从 QuerySet 构建并执行查询？" |
| Tokio | "tokio 如何在其运行时上调度和执行异步任务？" |
| OkHttp | "OkHttp 如何通过其拦截器链处理请求？" |
| Gin | "gin 如何通过其中间件链路由请求？" |
| Alamofire | "Alamofire 如何构建、发送和验证请求？" |

**原始中位数 — 有 → 无：**
| 代码库 | 费用 | Token | 时间 | 工具调用 |
|----------|------|--------|------|------------|
| VS Code | $0.60 → $0.80 | 601k → 2.8M | 1m 10s → 2m 26s | 8 → 55 |
| Excalidraw | $0.43 → $0.90 | 344k → 3.5M | 48s → 2m 58s | 3 → 79 |
| Django | $0.59 → $0.67 | 739k → 1.2M | 1m 19s → 1m 38s | 9 → 19 |
| Tokio | $0.42 → $2.41 | 379k → 2.6M | 53s → 3m 2s | 4 → 53 |
| OkHttp | $0.47 → $0.47 | 636k → 730k | 42s → 1m 1s | 6 → 11 |
| Gin | $0.37 → $0.47 | 444k → 675k | 44s → 1m 0s | 6 → 10 |
| Alamofire | $0.61 → $1.14 | 1.0M → 2.8M | 1m 17s → 2m 27s | 12 → 69 |

**CodeGraph 制胜原因：** 有了索引，代理可以直接回答 —— 用 `codegraph_context` 定位代码区域，再用一个 `codegraph_explore` 获取相关源码 —— 然后停止，通常零文件读取。反之，代理（以及它派生的 Explore 子代理）将大部分预算花在发现（find/ls/grep）上，然后才读取正确的代码。CodeGraph 仅在**直接**查询时有效，因此其使用说明引导代理直接回答，而不是将探索委托给文件读取子代理 —— 否则子代理无论如何都会读取文件，CodeGraph 反而成了负担。

</details>

---

## 主要特性

| | |
|---|---|
| **智能上下文构建** | 一次工具调用即可返回入口点、相关符号和代码片段 —— 无需昂贵的探索代理 |
| **全文搜索** | 基于 FTS5，在整个代码库中按名称快速查找代码 |
| **影响分析** | 在修改代码前，追踪任意符号的调用者、被调用者和完整影响范围 |
| **始终新鲜** | 文件监视器使用原生 OS 事件（FSEvents/inotify/ReadDirectoryChangesW），带防抖自动同步 —— 索引随编码自动更新，零配置 |
| **20+ 种语言** | TypeScript, JavaScript, Python, Go, Rust, Java, C#, PHP, Ruby, C, C++, Objective-C, Swift, Kotlin, Dart, Lua, Luau, Svelte, Liquid, Pascal/Delphi |
| **框架感知路由** | 识别 Web 框架路由文件，将 URL 模式链接到其处理器，覆盖 14 个框架 |
| **跨语言桥接** | 闭合静态解析无法跨越的语言边界：Swift ↔ ObjC 桥接、React Native 桥接 + TurboModules + Fabric 视图组件、原生 → JS 事件发射器、Expo 模块 |
| **100% 本地** | 数据不离开你的机器。无需 API 密钥。无需外部服务。仅使用 SQLite 数据库 |

<details>
<summary><strong>自动同步的工作方式 —— 以及为什么你不需要手动运行 <code>codegraph sync</code></strong></summary>

当你的 AI 编程助手（Claude Code、Cursor、Codex、opencode）启动 `codegraph serve --mcp` 时，三个层面确保索引与你的代码保持同步 —— 并确保在编辑与下一次同步之间的短暂窗口内，代理不会得到错误的回答：

1. **文件监视器 + 防抖自动同步。** 原生 FSEvents / inotify / ReadDirectoryChangesW 监视器捕获每个源文件的创建/修改/删除，在防抖窗口（默认 `2000ms`，可通过 `CODEGRAPH_WATCH_DEBOUNCE_MS` 调整，范围 `[100ms, 60s]`）后触发重新索引。批量编辑合并为单次同步。

2. **逐文件过期提示。** 在短暂的防抖窗口期间，如果 MCP 工具响应会引用到待处理的文件，会在响应前附加 `⚠️` 横幅提示，告知代理**直接读取**该文件。未被响应引用的待处理文件则以小型页脚形式呈现。无论哪种方式，代理都会收到明确信号 —— 已在 Claude Code 上验证，代理会主动说"直接读取文件以获取最新内容"然后打开它。

3. **连接时追赶同步。** MCP 服务器（重）连接时，codegraph 在回答第一个查询前，会先对工作目录执行快速的（大小，修改时间）+ 内容哈希比对 —— 这样在 MCP 服务器未运行时产生的编辑（终端的 `git pull`、其他编辑器的修改、上一个代理会话退出后的修改）会在下次会话的第一次工具调用时被吸收。

```
代理写入 src/Widget.ts
  → 监视器触发 (<100ms)
  → 防抖 (默认 2s)
  → 同步；Widget.ts 已加入索引
  → 下一个代理查询即可看到
```

**随时验证**：通过 `codegraph_status`（MCP）或 `codegraph status`（命令行）。如果有待处理内容，会显示 `### 待同步：` 部分，列出文件名及其编辑时长。

少数需要手动 `codegraph sync` 的情况：监视器被禁用（沙箱环境，或设置了 `CODEGRAPH_NO_DAEMON=1`），或者你在代理会话之外编写脚本操作索引，需要在脚本开始时预先同步。

→ 详情参见[指南 → 索引项目](https://colbymchenry.github.io/codegraph/guides/indexing/#stay-fresh-automatically)。

</details>

---

## 框架感知路由

CodeGraph 检测 Web 框架路由文件，生成 `route` 节点，通过 `references` 边链接到其处理器类或函数。查询视图/控制器的调用者时，现在可以显示绑定它的 URL 模式。

| 框架 | 识别格式 |
|---|---|
| **Django** | `path()`、`re_path()`、`url()`、`include()` in `urls.py`（CBV `.as_view()`、点路径） |
| **Flask** | `@app.route('/path', methods=[...])`、蓝图路由 |
| **FastAPI** | `@app.get(...)`、`@router.post(...)`、所有标准方法 |
| **Express** | `app.get(...)`、`router.post(...)` 及中间件链 |
| **NestJS** | `@Controller` + `@Get/@Post/...`、GraphQL `@Resolver` + `@Query/@Mutation`、`@MessagePattern`/`@EventPattern`、`@SubscribeMessage` |
| **Laravel** | `Route::get()`、`Route::resource()`、`Controller@action`、元组语法 |
| **Drupal** | `*.routing.yml` 路由（`_controller`、`_form`、实体处理器）；`.module`/`.theme`/`.install`/`.inc` 中的 `hook_*` 实现 |
| **Rails** | `get '/x', to: 'users#index'`、hash-rocket `=>` 语法 |
| **Spring** | 方法上的 `@GetMapping`、`@PostMapping`、`@RequestMapping` |
| **Gin / chi / gorilla / mux** | `r.GET(...)`、`router.HandleFunc(...)` |
| **Axum / actix / Rocket** | `.route("/x", get(handler))` |
| **ASP.NET** | Action 方法上的 `[HttpGet("/x")]` 属性 |
| **Vapor** | `app.get("x", use: handler)` |
| **React Router** / **SvelteKit** | 路由组件节点 |

---

## 混合 iOS / React Native / Expo 桥接

真实的 iOS 和 React Native 代码库跨越多种语言 —— Swift 调用者调用通过自动桥接的 Objective-C 选择器，JS 文件通过 React Native 桥接调用原生模块，JSX 组件委托给原生视图管理器。静态 tree-sitter 提取在每个语言边界处停止。CodeGraph 桥接这些边界，使 `trace`、`callers`、`callees` 和 `impact` 能够跨越间隙进行端到端连接。

| 边界 | JS / Swift 端 | 原生端 | 桥接方式 |
|---|---|---|---|
| **Swift → ObjC** | Swift `obj.foo(bar:)` | ObjC 选择器 `-fooWithBar:` | `@objc` 自动桥接规则（含 init/property/protocol 形式）+ Cocoa 介词前缀（`With`/`For`/`By`/`In`/`On`/`At`/…） |
| **ObjC → Swift** | ObjC `[obj fooWithBar:]` | Swift `@objc func foo(bar:)` | 反向桥接名称候选；从源码验证 `@objc` 暴露 |
| **React Native 传统桥接** | JS `NativeModules.X.fn(...)` | ObjC `RCT_EXPORT_METHOD` / `RCT_REMAP_METHOD` · Java/Kotlin `@ReactMethod` | 解析宏/注解声明，构建 JS 名称 → 原生方法映射 |
| **React Native TurboModules** | JS `import M from './NativeM'; M.fn(...)` | 匹配 Codegen 规范的原生实现 | 以 `Native<X>.ts` 规范接口为准 |
| **RN 原生 → JS 事件** | JS `new NativeEventEmitter(...).addListener('e', cb)` | ObjC `[self sendEventWithName:@"e" body:...]` · Swift `sendEvent(withName: "e", ...)` · Java/Kotlin `.emit("e", ...)` | 以字面事件名称为键，合成跨语言事件通道 |
| **Expo 模块** | JS `requireNativeModule('X').fn(...)` | Swift / Kotlin `Module { Name("X"); AsyncFunction("fn") { ... } }` | 解析 Expo DSL 字面量；合成方法节点通过现有名称匹配解析 |
| **Fabric 视图组件** | JSX `<MyView prop={v}/>` | TS Codegen 规范 + 原生实现类 | 规范 → `component` 节点；基于约定名称+后缀查找（`View`/`ComponentView`/`Manager`/`ViewManager`）桥接到原生 |
| **传统 Paper 视图管理器** | JSX `<MyView prop={v}/>` | ObjC `RCT_EXPORT_VIEW_PROPERTY` · Java/Kotlin `@ReactProp` | 与 Fabric 相同——Paper 时代的声明也生成 `component` + `property` 节点 |

**在真实代码库上验证**（每种桥接的小/中/大型）：

| 桥接 | 小型 | 中型 | 大型 |
|---|---|---|---|
| Swift ↔ ObjC | [Charts](https://github.com/danielgindi/Charts) | [realm-swift](https://github.com/realm/realm-swift) | [Wikipedia-iOS](https://github.com/wikimedia/wikipedia-ios) |
| RN 传统桥接 | [AsyncStorage](https://github.com/react-native-async-storage/async-storage) | [react-native-svg](https://github.com/software-mansion/react-native-svg) | [react-native-firebase](https://github.com/invertase/react-native-firebase) |
| RN 原生 → JS 事件 | [RNGeolocation](https://github.com/Agontuk/react-native-geolocation-service) | — | react-native-firebase |
| Expo 模块 | expo-haptics | expo-camera | Expo SDK 全面扫描（7 个包） |
| Fabric / Paper 视图 | [react-native-segmented-control](https://github.com/react-native-segmented-control/segmented-control) | [react-native-screens](https://github.com/software-mansion/react-native-screens) | [react-native-skia](https://github.com/Shopify/react-native-skia) |

每种桥接都生成带有 `provenance:'heuristic'` 标记的边，`metadata.synthesizedBy` 设置为稳定的通道名称（例如 `swift-objc-bridge`、`rn-event-channel`、`fabric-native-impl`、`expo-module-extract`），使代理能够一眼看出跳转是如何进入图谱的。

---

## 快速开始

### 1. 运行安装程序

```bash
npx @colbymchenry/codegraph
```

安装程序会：
- 询问配置哪些 AI 编程助手 —— 自动检测已安装的：**Claude Code**、**Cursor**、**Codex CLI**、**opencode**、**Hermes Agent**、**Gemini CLI**、**Antigravity IDE**、**Kiro**
- 提示将 `codegraph` 添加到 PATH（以便代理可以启动 MCP 服务器）
- 询问配置适用于所有项目还是仅当前项目
- 为每个选中的代理写入 MCP 服务器配置（codegraph 使用指南由 MCP 服务器本身提供，因此无需向 `CLAUDE.md` / `AGENTS.md` 等文件中添加说明文件）
- 如果 Claude Code 是目标之一，设置自动允许权限
- 初始化当前项目（仅本地安装）

**非交互式（脚本 / CI）：**

```bash
codegraph install --yes                              # 自动检测代理，全局安装
codegraph install --target=cursor,claude --yes       # 明确指定目标代理
codegraph install --target=auto --location=local     # 检测到的代理，项目本地安装
codegraph install --print-config codex               # 打印配置片段，不写入文件
```

| 参数 | 可选值 | 默认 |
|---|---|---|
| `--target` | `auto`、`all`、`none` 或 csv（`claude,cursor,...`） | 交互提示 |
| `--location` | `global`、`local` | 交互提示 |
| `--yes` | （布尔值） | 逐步骤提示 |
| `--no-permissions` | （布尔值）跳过 Claude 自动允许列表 | 启用权限 |
| `--print-config <id>` | 导出指定代理的配置片段并退出 | — |

### 2. 重启你的 AI 编程助手

重启你的 AI 编程助手（Claude Code / Cursor / Codex CLI / opencode / Hermes Agent / Gemini CLI / Antigravity IDE / Kiro）以使 MCP 服务器加载。

### 3. 初始化项目

```bash
cd your-project
codegraph init -i
```

构建每项目知识图谱索引。一次全局 `codegraph install` 可在你打开的所有项目中使用 —— 无需为每个项目重新运行安装程序。

这样就可以了 —— 当存在 `.codegraph/` 目录时，你的 AI 编程助手会自动使用 CodeGraph 工具。

<details>
<summary><strong>手动设置（备选方案）</strong></summary>

**全局安装：**
```bash
npm install -g @colbymchenry/codegraph
```

**添加到 `~/.claude.json`：**
```json
{
  "mcpServers": {
    "codegraph": {
      "type": "stdio",
      "command": "codegraph",
      "args": ["serve", "--mcp"]
    }
  }
}
```

**添加到 `~/.claude/settings.json`（可选，用于自动允许）：**
```json
{
  "permissions": {
    "allow": [
      "mcp__codegraph__codegraph_search",
      "mcp__codegraph__codegraph_context",
      "mcp__codegraph__codegraph_callers",
      "mcp__codegraph__codegraph_callees",
      "mcp__codegraph__codegraph_impact",
      "mcp__codegraph__codegraph_node",
      "mcp__codegraph__codegraph_status",
      "mcp__codegraph__codegraph_files"
    ]
  }
}
```

</details>

<details>
<summary><strong>代理工具使用指南</strong></summary>

CodeGraph 的 MCP 服务器会在 MCP 初始化响应中**自动**向其使用指南传递给您的代理 —— 没有需要管理的说明文件，也不会向 `CLAUDE.md` / `AGENTS.md` / `GEMINI.md` 添加内容。简而言之，它会告诉代理：

- **直接使用 CodeGraph 回答结构性问题** —— 它就是预构建的索引，grep/read 循环只是重复它已完成的工作。将返回的源码视为已读取。
- **按意图选择工具：** `codegraph_context` 定位代码区域、`codegraph_trace` 追踪"X 如何到达 Y"、`codegraph_explore` 浏览多个符号、`codegraph_search` 查找符号、`codegraph_callers`/`codegraph_callees` 遍历调用流、`codegraph_impact` 在修改前分析影响、`codegraph_node` 获取单个符号的源码。
- **信任结果 —— 不要用 grep 重新验证**，并在编辑后检查过期提示。
- 如果 `.codegraph/` 不存在，主动提供运行 `codegraph init -i`。

确切文本位于 `src/mcp/server-instructions.ts` —— 这是唯一的事实来源。

</details>

---

## 工作原理

```
┌───────────────────────────────────────────────────────────────────┐
│                         Claude Code                               │
│                                                                   │
│   "一个请求如何到达数据库？"                                        │
│       直接调用 CodeGraph 工具 —— 无需 Explore 子代理               │
│                                 │                                 │
└─────────────────────────────────┬─────────────────────────────────┘
                                  │
                                  ▼
┌───────────────────────────────────────────────────────────────────┐
│                       CodeGraph MCP 服务器                        │
│                                                                   │
│       context · trace · explore · callers · callees · impact      │
│                                 │                                 │
│                                 ▼                                 │
│                       SQLite 知识图谱                              │
│                  符号 · 边 · 文件 · FTS5 全文搜索                  │
└───────────────────────────────────────────────────────────────────┘
```

1. **提取** — [tree-sitter](https://tree-sitter.github.io/) 将源代码解析为 AST。语言特定的查询提取节点（函数、类、方法）和边（调用、导入、继承、实现）。

2. **存储** — 所有数据存入本地 SQLite 数据库（`.codegraph/codegraph.db`），配备 FTS5 全文搜索。

3. **解析** — 提取后，解析引用：函数调用 → 定义、导入 → 源文件、类继承和框架特定模式。

4. **自动同步** — MCP 服务器使用原生 OS 文件事件监视你的项目。变更经过防抖处理（2 秒静默窗口），仅过滤源文件，增量同步。图谱随你的编码自动更新 —— 无需配置。

---

## 命令行参考

```bash
codegraph                         # 运行交互式安装程序
codegraph install                 # 运行安装程序（显式）
codegraph uninstall               # 从你的 AI 编程助手中移除 CodeGraph（安装的逆操作）
codegraph init [path]             # 在项目中初始化（--index 也同时索引）
codegraph uninit [path]           # 从项目中移除 CodeGraph（--force 跳过确认）
codegraph index [path]            # 完整索引（--force 重新索引，--quiet 减少输出）
codegraph sync [path]             # 增量更新
codegraph status [path]           # 显示统计信息
codegraph query <search>          # 搜索符号（--kind、--limit、--json）
codegraph files [path]            # 显示文件结构（--format、--filter、--max-depth、--json）
codegraph context <task>          # 为 AI 构建上下文（--format、--max-nodes）
codegraph callers <symbol>        # 查找哪些代码调用了某个函数/方法（--limit、--json）
codegraph callees <symbol>        # 查找某个函数/方法调用了什么（--limit、--json）
codegraph impact <symbol>         # 分析修改某个符号会影响哪些代码（--depth、--json）
codegraph affected [files...]     # 查找受变更影响的测试文件（见下方说明）
codegraph serve --mcp             # 启动 MCP 服务器
```

### `codegraph affected`

通过传递依赖关系追踪，查找受变更源文件影响的测试文件。

```bash
codegraph affected src/utils.ts src/api.ts         # 直接传入文件作为参数
git diff --name-only | codegraph affected --stdin   # 从 git diff 管道传入
codegraph affected src/auth.ts --filter "e2e/*"     # 自定义测试文件匹配模式
```

| 选项 | 描述 | 默认 |
|--------|-------------|---------|
| `--stdin` | 从标准输入读取文件列表 | `false` |
| `-d, --depth <n>` | 最大依赖遍历深度 | `5` |
| `-f, --filter <glob>` | 自定义识别测试文件的 glob | 自动检测 |
| `-j, --json` | 输出为 JSON | `false` |
| `-q, --quiet` | 仅输出文件路径 | `false` |

**CI/钩子示例：**

```bash
#!/usr/bin/env bash
AFFECTED=$(git diff --name-only HEAD | codegraph affected --stdin --quiet)
if [ -n "$AFFECTED" ]; then
  npx vitest run $AFFECTED
fi
```

---

## MCP 工具

作为 MCP 服务器运行时，CodeGraph 向 Claude Code 暴露以下工具：

| 工具 | 用途 |
|------|---------|
| `codegraph_search` | 在整个代码库中按名称查找符号 |
| `codegraph_context` | 为某个任务构建相关的代码上下文 |
| `codegraph_trace` | 一次性追踪两个符号之间的调用路径（"X 如何到达 Y"）—— 每跳包含内联代码体，跟随 grep 无法追踪的动态分发跳转（回调、React 重新渲染、接口→实现） |
| `codegraph_callers` | 查找哪些代码调用了某个函数 |
| `codegraph_callees` | 查找某个函数调用了什么 |
| `codegraph_impact` | 分析修改某个符号的影响范围 |
| `codegraph_node` | 获取特定符号的详细信息（可选含源码） |
| `codegraph_explore` | 一次调用返回多个相关符号的源码（按文件分组）及关系图 |
| `codegraph_files` | 获取已索引的文件结构（比文件系统扫描更快） |
| `codegraph_status` | 检查索引健康状况和统计信息 |

---

## 作为库使用

```typescript
import CodeGraph from '@colbymchenry/codegraph';

const cg = await CodeGraph.init('/path/to/project');
// 或者：const cg = await CodeGraph.open('/path/to/project');

await cg.indexAll({
  onProgress: (p) => console.log(`${p.phase}: ${p.current}/${p.total}`)
});

const results = cg.searchNodes('UserService');
const callers = cg.getCallers(results[0].node.id);
const context = await cg.buildContext('修复登录 bug', { maxNodes: 20, includeCode: true, format: 'markdown' });
const impact = cg.getImpactRadius(results[0].node.id, 2);

cg.watch();   // 文件变更时自动同步
cg.unwatch(); // 停止监视
cg.close();
```

---

## 配置

CodeGraph 是**零配置**的 —— 无需编写或维护任何配置文件。语言支持根据文件扩展名自动识别，无需为每种语言进行配置。

默认排除项：

- **依赖、构建和缓存目录** —— `node_modules`、`vendor`、`dist`、`build`、`target`、`.venv`、`Pods`、`.next` 等（涵盖所有[支持的语言栈](#%E6%94%AF%E6%8C%81%E7%9A%84%E8%AF%AD%E8%A8%80)）—— 确保图谱中的是你自己的代码，而非第三方噪音。即使没有 `.gitignore` 也生效。
- **`.gitignore` 中的内容** —— 在 git 仓库中通过 git 规则执行，在非 git 项目中直接读取 `.gitignore`（支持根目录和嵌套）。
- **超过 1 MB 的文件** —— 生成的 bundle、压缩的 JS、供应商 blob。

如需排除其他目录，添加到 `.gitignore`。如需将默认排除的目录**重新纳入**（例如你真的需要索引某个供应商依赖），添加否定规则 —— `!vendor/`。默认设置统一适用，因此提交依赖或构建目录不会强制将其纳入图谱；`.gitignore` 的否定规则是显式的选择加入。

## 支持的平台

每个版本都提供自包含构建版本（捆绑了 Node 运行时 —— 无需编译），适用于所有三大桌面操作系统，同时支持 Intel/AMD（x64）和 ARM（arm64）：

| 平台 | 架构 | 安装方式 |
|----------|---------------|---------|
| Windows | x64, arm64 | PowerShell 安装程序或 npm |
| macOS | x64, arm64 | shell 安装程序或 npm |
| Linux | x64, arm64 | shell 安装程序或 npm |

有关一行安装命令，请参见[快速开始](#1-%E8%BF%90%E8%A1%8C%E5%AE%89%E8%A3%85%E7%A8%8B%E5%BA%8F)。

## 支持的代理

交互式安装程序自动检测并配置以下每个代理 —— 连接 MCP 服务器（服务器提供自身的使用指南，因此无需写入说明文件）：

- **Claude Code**
- **Cursor**
- **Codex CLI**
- **opencode**
- **Hermes Agent**
- **Gemini CLI**
- **Antigravity IDE**
- **Kiro**

## 支持的语言

| 语言 | 扩展名 | 状态 |
|----------|-----------|--------|
| TypeScript | `.ts`, `.tsx` | 完整支持 |
| JavaScript | `.js`, `.jsx`, `.mjs` | 完整支持 |
| Python | `.py` | 完整支持 |
| Go | `.go` | 完整支持 |
| Rust | `.rs` | 完整支持 |
| Java | `.java` | 完整支持 |
| C# | `.cs` | 完整支持 |
| PHP | `.php` | 完整支持 |
| Ruby | `.rb` | 完整支持 |
| C | `.c`, `.h` | 完整支持 |
| C++ | `.cpp`, `.hpp`, `.cc` | 完整支持 |
| Objective-C | `.m`, `.mm`, `.h` | 部分支持（类、协议、方法、`@property`、`#import`、消息发送；`.mm` ObjC++ 可能解析不完整） |
| Swift | `.swift` | 完整支持 |
| Kotlin | `.kt`, `.kts` | 完整支持 |
| Scala | `.scala`, `.sc` | 完整支持（类、特质、方法、类型别名、Scala 3 枚举） |
| Dart | `.dart` | 完整支持 |
| Svelte | `.svelte` | 完整支持（脚本提取、Svelte 5 runes、SvelteKit 路由） |
| Vue | `.vue` | 完整支持（script + script-setup 提取、Nuxt 页面/API/中间件路由） |
| Liquid | `.liquid` | 完整支持 |
| Pascal / Delphi | `.pas`, `.dpr`, `.dpk`, `.lpr` | 完整支持（类、记录、接口、枚举、DFM/FMX 表单文件） |
| Lua | `.lua` | 完整支持（函数、带接收器的方法、局部变量、`require` 导入、调用边） |
| Luau | `.luau` | 完整支持（Lua 全部功能，外加 `type`/`export type` 别名、类型化签名、Roblox 实例路径 `require`） |

## 故障排除

**"CodeGraph 未初始化"** —— 首先在你的项目目录中运行 `codegraph init`。

**索引速度慢** —— 检查是否排除了 `node_modules` 和其他大型目录。使用 `--quiet` 减少输出开销。

**MCP 报告 "database is locked"** —— 当前的构建版本不应出现此问题：CodeGraph 捆绑了自己的 Node 运行时，使用 Node 内置的 `node:sqlite` 并启用 WAL 模式，在此模式下并发读取从不阻塞写入操作。如果仍然遇到：

- **你使用的是旧版本（0.9 之前）。** 重新安装以获取捆绑的运行时 —— `curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh`（macOS/Linux）、`irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex`（Windows）或 `npm i -g @colbymchenry/codegraph@latest`。
- **`codegraph status` 显示 `Journal:` 不是 `wal`** —— 在此文件系统上无法启用 WAL（常见于网络共享和 WSL2 `/mnt` 目录），因此读取可能阻塞写入。请将项目（及其 `.codegraph/` 文件夹）移动到本地磁盘。

**MCP 服务器无法连接** —— 确保项目已初始化/索引，验证 MCP 配置中的路径，并从命令行检查 `codegraph serve --mcp` 是否能正常运行。

**缺少符号** —— MCP 服务器在保存时会自动同步（等待几秒钟）。如果需要，可手动运行 `codegraph sync`。检查文件的语言是否受支持，以及是否未位于 `.gitignore` 或默认排除的目录中（例如 `node_modules`、`dist`）。

## Star 历史

<a href="https://www.star-history.com/?repos=colbymchenry%2Fcodegraph&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/chart?repos=colbymchenry/codegraph&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/chart?repos=colbymchenry/codegraph&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/chart?repos=colbymchenry/codegraph&type=date&legend=top-left" />
 </picture>
</a>

## 许可证

MIT

---

<div align="center">

**专为 AI 编程助手打造 —— Claude Code、Cursor、Codex CLI、opencode、Hermes Agent、Gemini CLI、Antigravity IDE 和 Kiro**

[报告 Bug](https://github.com/colbymchenry/codegraph/issues) · [请求功能](https://github.com/colbymchenry/codegraph/issues)

</div>
