# AGENTS.md — magpie-sensenova

> 本文件是任何 AI 编码代理（agent）进入本仓库时的**必读**工作说明书，约定目录结构、技术栈、代码规范、配置契约、文档维护与提交流程。任何对代码、配置、文档、发版行为的改动，都必须同时遵守本文档的规则。
>
> 项目：`magpie-sensenova` —— [Magpie](https://usemagpie.ai) 的 SenseNova provider 插件；纯源码 npm 包，零第三方依赖，无构建步骤。
>
> **模板版本**：v0.1.0（2026-10-21） —— 本行标记本文件对应的 `generic` 模板版本。回填项目内容时**不要改动本行**；只有从上游合并到新版本时才把它更新为合并到的版本。
> **来源**：本文件由 [agent-templates](https://github.com/XTsat/agent-templates) 的 `templates/generic/AGENTS.md` 派生（模板版本 v0.1.0），并按本项目实际情况回填；最新版见该仓库 `main` 分支。
> 用户说「更新 AGENTS」时按此流程：① 打开来源仓库该模板的 `AGENTS.md`，比对头部「模板版本」与本地是否一致——一致说明已是最新，直接结束，不必拉取逐节比对 → ② 不一致才拉取来源模板最新版 → ③ 与本地逐节比对 → ④ 合并（保留本项目已回填的技术栈、目录结构与项目特有约定，见 2.3，**禁止把已填内容改回 `{{ 占位 }}`**）→ ⑤ 展示 diff 与改动清单，等用户确认后再落盘，并把头部「模板版本」同步改为合并到的版本。**禁止整文件覆盖**。

---

## 1. 项目概览

`magpie-sensenova` 是 [Magpie](https://usemagpie.ai) 的 provider 插件，接入商汤 SenseNova（商量 / 日日新）的 Token Plan 模型（OpenAI 兼容端点 `https://token.sensenova.cn/v1`），并把 SenseNova 控制台的**积分额度**映射为 Magpie 原生额度窗口。

一个包同时承担两件事，因为平台把它们放在不同主机、两套互不相关的凭据上：

- **模型调用**：`https://token.sensenova.cn/v1`，凭据是 API Key；
- **额度上报**：控制台主机上的一个内部端点，凭据是控制台 OAuth token。

额度只出现在三个地方：provider 的账号行、`magpie quota`、网关的 `GET /v1/magpie/quotas`（Magpie 不允许插件新增面板，这是宿主设计而非本插件的缺陷）。

**项目类型**：Magpie provider 插件 / 纯源码 npm 包（仓库即产物，无构建、无打包步骤）。
**主语言与版本**：JavaScript（ESM，`.mjs`），Node.js ≥ 20（`package.json` 的 `engines`）；无 TypeScript。
**包管理器 / 构建工具**：npm；无 lock 文件（运行时零依赖）；无 bundler、无 lint/format 工具链。

核心文件清单（新增文件时按此表归位）：

| 文件 | 必选 | 职责 |
|------|------|------|
| `README.md` | ✅ | 英文主文档；同时是 Magpie 插件详情页渲染的**唯一披露面** |
| `CHANGELOG.md` | ✅ | 变更日志（格式见 7.1）；日常改动只追加到 `[Unreleased]`，发版时才切版本段 |
| `LICENSE` | ✅ | 许可证（MIT，`Copyright (c) 2026 XTsat`） |
| `index.mjs` | ✅ | 插件入口：导出唯一函数 `SenseNovaPlugin`，返回宿主要调用的 `config` / `provider` / `auth` 钩子 |
| `internal.mjs` | ✅ | 与入口、测试共享的小工具：`PROVIDER`、`ICON`、`normalizeKey`、`readAuth`、`apiKeyOf`、`fellBack`、`consoleAuthOf` |
| `quota.mjs` | ✅ | 控制台额度客户端：凭据读写、cookie jar、三条 token 续期路径、取数与额度映射；**控制台内部端点路径的唯一存放处** |
| `models.mjs` | ✅ | 模型目录：内置快照、`GET /models` 抓取缓存、Magpie 模型对象形状 |
| `i18n.mjs` | ✅ | zh/en 文案表、`fill`、`strings`、`resolveLocale`、`poolLabel` |
| `package.json` | ✅ | 元数据、`exports`/`files`、`engines`、`test` 脚本、`magpie.icon`；**唯一版本源** |
| `NOTICE.md` | ✅ | 商标与图标归属、端点说明、与 CLI `snquota` 的共享逻辑声明 |
| `assets/sensenova.png` | ✅ | 供应商图标（65×65 PNG），由 `internal.mjs` 内联成 data URI |
| `.gitattributes` | ✅ | 换行锁：`* text=auto eol=lf`、`*.png binary` |
| `.gitignore` | ✅ | Git 排除清单：`node_modules/`、`*.log`、`.DS_Store` |
| `test/` | ✅ | `node:test` 测试（`plugin.test.mjs`、`quota.test.mjs`、`i18n.test.mjs`），**不随包发布** |

> **权威上游**：`github.com/XTsat/magpie-sensenova`（2026-10-25 经用户确认）。`package.json` 的 `repository` / `homepage` / `bugs`、`README.md`、`LICENSE` 已统一指向此处，本机 clone 的 `origin` 与之一致。旧的 `aqiu817/magpie-sensenova` 只保留在历史提交中，**不要再写回任何元数据**。

---

## 2. 目录结构与架构

### 2.1 标准目录结构

```
magpie-sensenova/
├── index.mjs              # 入口：把各模块接成宿主钩子（唯一对外导出的模块）
├── internal.mjs           # 共享小工具（读 auth、图标、key 归一化、回退标记）
├── models.mjs             # 模型目录（快照 + 活列表 + 形状转换）
├── quota.mjs              # 控制台凭据与额度（含三条续期路径）
├── i18n.mjs               # zh/en 文案表与 locale 解析
├── package.json           # 元数据 / exports / files / engines / test
├── assets/sensenova.png   # 供应商图标
├── test/                  # node:test 测试，不发布
├── README.md              # 英文主文档（用户可见的唯一披露面）
├── CHANGELOG.md           # 变更日志（面向使用者，见 7.1）
├── NOTICE.md              # 商标、端点、共享逻辑声明
├── LICENSE
├── .gitattributes
└── .gitignore
```

**运行时源码平铺在仓库根**，没有 `src/`：这是 npm 包与 Magpie「按仓库安装」两条路径的共同要求——按仓库安装时加载的就是仓库里的当前代码，没有构建产物可依赖。新增运行时代码放根目录，**并同步加入 `package.json` 的 `files` 白名单**，否则不会进 npm 包。

### 2.2 架构原则

- 依赖方向严格单向，只允许这一张 import 图：

  ```
  index.mjs ──┬─→ internal.mjs   (PROVIDER, ICON, apiKeyOf, consoleAuthOf, fellBack, normalizeKey, readAuth)
              ├─→ models.mjs     (FALLBACK_MODELS, NPM, createCatalog, toConfigModel, toProviderModel)
              ├─→ quota.mjs      (accountNameOf, QuotaError, readCredentials, readQuota, writeCredentials)
              └─→ i18n.mjs       (fill, resolveLocale, strings)
  quota.mjs ─────→ i18n.mjs
  internal.mjs ──→ node:fs 只有内置依赖
  models.mjs / i18n.mjs ──→ 无内部依赖（最底层）
  ```

  底层模块不得反向依赖 `index.mjs`；`models.mjs`、`i18n.mjs` 不得引入新的内部依赖。

- `index.mjs` **只能导出恰好一个函数**（`SenseNovaPlugin`），这是兼容 OpenCode 宿主的要求；新助手一律落到 `internal.mjs` / `models.mjs` / `quota.mjs` / `i18n.mjs`。
- `package.json` 的 `exports` 只有 `".": "./index.mjs"`：内部模块不对外暴露，测试用相对路径直接 import。
- 单一职责：模型目录、额度、文案、宿主接线各归其位；公共常量（默认端点、超时、刷新周期、JS 包名）放各模块顶部的 `UPPER_SNAKE` 常量，禁止在函数里散落硬编码。
- 网络访问只通过全局 `fetch`，并且**必须支持注入**（`{ fetchImpl = fetch }`）以便测试；外部端点集中在 `models.mjs` 与 `quota.mjs`。

### 2.3 项目特有约定与坑（改动前必读）

1. **控制台内部端点路径不得写进 `README.md` / `NOTICE.md`**（历史提交明确删除过两次）；用户文档只写「路径在 `quota.mjs` 里」。代码中只允许出现在必需处：`quota.mjs` 的实现与文件头注释、`index.mjs` 的文件头注释、以及测试夹具。
2. **账号行命名只能靠 sign-in prompt 的 key 名，必须是 `email`**：`authorize` 返回 `accountId`、`metadata` 都无效，`usage.user` 也不改行名。`consoleAuthOf` 仍兼容旧的 `username` / `account` 拼写；回归测试钉住了 prompt key，别「优化」回去。
3. **额度窗口必须带 `amount`（已用量）**：只有 `used` + `limit` 时 Magpie 会渲染成 `0 / limit`；`display` 必须用 `compact()` 生成，才能与 Magpie 自身格式对齐。`amount` 不在官方插件文档的窗口字段列表里，属于实测结论。
4. **`remaining` 缺失或非有限值时跳过该窗口，绝不默认 0**：宁可不上报，也不要在卡片上编造 `0 / limit`。
5. **凭据文件里 `__` 前缀键按前缀整体剥离，不用手写白名单**：曾因白名单漏掉 `__writable` 而把内部标记写进用户的 CLI 配置文件。
6. **只有「控制台凭据来自 `~/.sensenova-quota.json`」时才回写该文件**（`__writable = !fromAuth.username && !fromAuth.cookie`）；`credentialsFile` 只改写入路径，不能关闭回写。
7. **额度是账户级语义**：同一账号下所有 API Key 共用一个积分池，多填 Key 不会多额度。文档中这条警告必须保留。
8. **续期顺序固定为 `refresh_token` → 会话 cookie → 账号密码，第一步成功即止**；密码是最后手段，调整顺序等于扩大暴露面。密码明文存储、明文传输是**已披露事实**，任何文档都不得写成「已加密」。
9. **中英两张文案表必须键集合一致**：新增任何一条面向用户的文案都要同时进 `ZH` 与 `EN`，否则 `test/i18n.test.mjs` 的对称性测试直接失败；英文措辞沿用控制台自己的（General Pool / Flash-Lite Dedicated Pool / credits）。
10. **`fetch` 钩子必须克隆 `Request`，不能按 URL 重建**：否则 POST 的 body 会静默丢失（曾是两个真实 bug 之一，有回归测试）。
11. **零依赖是硬约束**：只用 Node 内置模块（`node:` 前缀）与全局 `fetch`；新增第三方依赖会破坏「迁入 community 仓库无需改代码」的承诺，必须先与用户确认。
12. **纯源码仓库**：被 Magpie 按仓库安装时读的是当前代码，所以被加载的文件必须已提交，且不要引入任何构建产物。
13. **`README.md` 的测试段与测试数保持同步**：该段逐一列举覆盖点，历史提交都记录测试数（50 → 53 → 55）；增删测试时同步改这里。
14. 不要提交 `node_modules/`、`*.log`、`.DS_Store`；全仓库强制 LF。

---

## 3. 技术栈与依赖

- **语言版本**：JavaScript（ESM，`"type": "module"`，文件后缀 `.mjs`），Node.js **≥ 20**（`package.json` 的 `engines.node`）。当前开发机实测 Node v24.15.0。
- **包管理**：npm；**无 lock 文件**（运行时零依赖，不生成 `package-lock.json`）；依赖清单文件 `package.json` 是唯一声明来源。
- **构建/运行**：**无构建步骤**。安装方式是 `magpie plugin add <本仓库路径>`，随后 `magpie plugin login sensenova`；开发时的入口就是 `index.mjs`。
- **测试**：`node --test test/*.test.mjs`（等价 `npm test`），当前 **55 个测试全部通过**，全程无网络（fetch 全部打桩）。
- **禁止引入**：不引入与原功能无关的依赖；**运行时依赖必须保持为零**，需要装包时先与用户确认并说明理由；重活一律走 Node 内置能力。
- 技术栈升级（Node 版本下限、宿主契约、主要依赖）属于用户可见变更：必须同步更新 `README.md` 对应章节，并先与用户确认。

---

## 4. 核心代码规范

### 4.1 命名约定

| 元素 | 约定 |
|------|------|
| 类 / 类型 | `PascalCase`（本项目只有 `QuotaError`，以及不导出的 `CookieJar`） |
| 文件 | 小写单词 + `.mjs`（`index`、`internal`、`models`、`quota`、`i18n`）；测试为 `test/<模块>.test.mjs` |
| 函数 / 变量 | `camelCase`；短助手惯用 `const f = (x) => …` |
| 模块级常量 | `UPPER_SNAKE`（`PROVIDER`、`ICON`、`NPM`、`DEFAULT_BASE_URL`、`FALLBACK_MODELS`、`IAM_BASE`、`TABLES`、`ZH`、`EN`） |
| 私有成员 | 不导出即为私有；凭据文件里的内部记账键统一 `__` 前缀，**绝不落盘** |

### 4.2 类型与语法

- 纯 JavaScript ESM，**不引入 TypeScript、不引入转译/打包步骤**。
- 用 **JSDoc** 表达类型：每个文件头部加 `@module`，关键函数写 `@param` / `@returns`（中文说明用途）。
- 内置模块一律带 `node:` 前缀（`node:fs`、`node:os`、`node:path`、`node:crypto`）；导入顺序为「`node:` 内置 → 空行 → `./` 相对」，与现有文件一致。
- 不用 `require`，不用 polyfill；网络用全局 `fetch` / `Request` / `Headers` / `Response`。
- 禁止无理由的类型抑制（`// @ts-ignore` 等）；本项目无 TS 工具链，不要新增。
- 格式沿用现状：2 空格缩进、双引号、语句分号、多行尾逗号。

### 4.3 注释规范

- **注释只写 non-obvious reason**：解释「为什么这么做」，而不是「做了什么」（代码本身应自文档化）。
  - 坏：`// 把 headers 里的 authorization 换掉`（代码已经这么写）
  - 好：`// prompt 的 key 决定账号行的名字，Magpie 读的是 metadata.email`（这是实测结论，代码看不出来）
- 注释语言**中英混排是现状**（`index.mjs` / `internal.mjs` / `models.mjs` / `i18n.mjs` 偏英文，`quota.mjs` 与测试偏中文）；新增注释跟随所在文件的既有语言，同一文件内不要来回切换。
- **禁止残留 intermediate attempts**：不保留被注释掉的旧代码、未完成的 TODO、调试输出。
- 每个模块头部写 `/** @module … */`，说明该文件的职责与边界。

### 4.4 日志

- **本项目不写常规日志**：插件运行在 Magpie 进程内，`console.*` 会污染宿主输出，**禁止把 `console.log` / `console.error` 提交进来**。
- 唯一的日志出口是宿主注入的 logger，且必须 best-effort、包在 try/catch 里（见 `index.mjs` 的 `client?.app?.log?.({ body: { service: "sensenova", level, message } })`），目前只用于额度读取失败的 `warn`。
- 面向用户的错误信息一律走 `i18n.mjs` 的文案表（返回 `{ error }` 或抛 `QuotaError`），不要拼裸字符串，也不要写进日志了事。

### 4.5 错误处理与防御性编程

- 外部 IO / 网络调用必须 try/catch：凭据读写、图标读取失败一律降级（读不到就当没有），**不允许静默吞掉会影响用户的错误**。
- 精确捕获，禁止裸 `except` 式的空 catch（JS 里即 `catch {}` 不作处理）；确需忽略时写明理由。
- 唯一自定义异常是 `QuotaError extends Error`（带 `kind`，默认 `"auth"`），额度链路的失败用它表达；其它异常在入口处套上本地化文案（`readFailed`）后返回。
- 脏数据降级：`normalizeModel` 用 `positive` / `text` / `list` 守卫逐字段校验，缺字段跳过而不是抛错或编造；额度窗口缺 `remaining` 就跳过（见 2.3 第 4 条）。
- 失败链路要清晰：无 API Key → `authorize` 抛「key 必填」、模型列表走 `fellBack` 快照、`fetch` 删除 `authorization` 头；无控制台凭据 → 额度返回错误文案，**模型调用不受影响**。

### 4.6 并发

- 全部使用 `async/await`，禁止阻塞宿主；额度读取有 `quotaTtlMs`（默认 60 秒）缓存，模型目录抓取有 6 小时缓存 + 单飞（single-flight）——**这两处缓存是防止轮询打爆上游端点的设计，不得移除**。
- 读取失败的额度结果只缓存约 15 秒即允许重试，避免把刚过期的 token 钉在缓存里。
- 网络调用必须带超时（模型目录 15 秒）并能被取消；资源在 `finally` 中释放。

### 4.7 数据与文件

- 凭据文件路径来自 `credentialsFile` / `SENSENOVA_QUOTA_CONFIG` / `os.homedir()` 兜底，**不要往仓库内写用户数据**。
- 写凭据文件：`utf-8`、原子写入（先写临时文件再替换）、`mode 0o600`（写后 `chmodSync` 兜底）、按前缀剥离 `__` 键。
- 回写 `~/.sensenova-quota.json` **只在 2.3 第 6 条那一种情形下发生**；任何扩大回写范围的改动都要先与用户确认。

---

## 5. 配置与数据文件

插件在 `plugins.json` 中该条目的 `options`（README「Configuration」章节是用户文档，两处必须一致）：

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `baseURL` | string | `https://token.sensenova.cn/v1` | Token Plan 地址 |
| `quotaTtlMs` | number | `60000` | 额度读取缓存时长（毫秒）；非正数回退默认值 |
| `scopeModel` | string | `flash-lite` | 专属池没有 `model_ids` 时用于作用域匹配的关键词 |
| `locale` | string | `auto` | `zh` / `en` / `auto`（`auto` 走 `Intl`，再兜底环境变量，最后 `en`） |
| `credentialsFile` | string | `~/.sensenova-quota.json` | 控制台凭据文件位置（只改写入目标，不能关闭回写） |

环境变量：`SENSENOVA_QUOTA_CONFIG` 覆盖凭据文件路径。其余配置项一律通过 `options` 传入——宿主不给插件 locale 通道，也没有插件的设置界面。

凭据存放在哪（**不要改动这三处语义，它们同时被 README 的安全披露章节描述**）：

| 凭据 | 位置 | 字段 |
|------|------|------|
| API Key | `~/.config/magpie/plugin-auth.json` | `key`（`type: "api"`） |
| 账号 / 密码（可选） | 同一文件的 `metadata` | `metadata.email` / `metadata.password` |
| 控制台 OAuth token（可选） | 同上，或 `~/.sensenova-quota.json` | `access_token` / `refresh_token` / `cookie` / `iam_base` 等 |

- **新增配置项必须三处同步**：代码中的默认值定义 + README 的配置表 + CHANGELOG 条目。
- 配置解析失败时要有明确行为（回退默认值或给出本地化错误文案），不要静默吞掉。
- 任何改变「存了什么、发往哪些主机、宿主与其它插件能看见什么」的改动，**必须同步更新 README 的「Security notice」九个小节**——那是本插件唯一的披露面。
- 仓库内不得出现任何真实凭据、账号、token。

---

## 6. 对外接口 / 命令清单

本包没有 CLI，对外接口就是插件的导出与宿主钩子（README 的「Install」「Configuration」「Models」「Known limits」章节是用户视角的说明）：

- **导出**：`index.mjs` 只导出 `SenseNovaPlugin`（恰好一个函数）。
- **`config(cfg)`**：就地写入 `cfg.provider.sensenova`（`name` / `npm` / `api` / `models`）。
- **`provider`**：`id = "sensenova"`，`models(provider, { auth })` 有 key 时拉活列表，否则返回带回退标记的内置快照。
- **`auth`**：`icon`（data URI）、`loader(getAuth)`（返回 `{ baseURL, apiKey, fetch }`，`fetch` 每次重读凭据、只重写 `authorization`）、`usage(getAuth)`、`methods[0]`（`type: "api"`，prompt 顺序固定为 `key` → `email` → `password`，`authorize` 只返回 `{ type: "success", key }`）。
- **外部端点**：公开的 `token.sensenova.cn/v1`（模型调用与 `GET /models`，默认值在 `models.mjs`，`index.mjs` 仅重复同一字面量）、`platform.sensenova.cn` 上的控制台内部端点（额度，**完整路径只写在 `quota.mjs`**：实现与文件头注释，另见 `index.mjs` 文件头与测试夹具）、`iam.sensecoreapi.cn` / `iam.sensecoreapi.tech`（控制台 token 续期，映射表在 `quota.mjs`）。
- 命名保持一致：新增的 prompt、配置项、文案 key 都沿用现有拼写风格，不混用两套。
- 用户可见行为变更（新增/删除配置项、prompt 变化、额度窗口形状、错误文案）必须先更新 README，再改代码。

---

## 7. 文档维护规范（强制，不可省略）

> 本项目的**硬性要求**：任何改动在合并前，必须同步维护 `README.md` 与 `CHANGELOG.md`。未同步文档 = 任务未完成。

### 7.1 CHANGELOG 维护

> 现状：`CHANGELOG.md` 已按本格式建立（首个条目是仓库地址迁移）；更早的历史变更只写在 `git log` 的提交正文里，不回填。

#### 流程

- 日常改动先记在 `## [Unreleased]` 段（顶部固定）。**发版时**再把内容移动到带版本号的新段。
- **先记后合**：记录阶段同一工作周期内的改动各自独立记入 `[Unreleased]`（同一功能的多处调整也先各记一条，避免遗漏）；提交或发版前的整理阶段统一过一遍 `[Unreleased]`，把描述同一件事的多条合并成一条，不相关改动保持独立。
- **发版日期**：版本段日期 `(YYYY-MM-DD)` 填**当前日期**（以发版当天的系统时间为准）。

#### 格式

统一使用**分组式**：按分类用 `###` 子标题分组，条目用「标题 + 冒号 + 说明」，**仅重点条目加粗**：

```markdown
# Changelog

## [Unreleased]

> 一句话总结这个版本（可选）

### 新增
- 支持 `--timeout` 参数：自定义请求超时时间，默认 30 秒
- **新增额度窗口 `amount` 字段**：卡片从 `0 / 600000` 修正为真实用量

### 修复
- 修复缺少控件字段时命令直接崩溃的问题
```

分组子标题分类：`新增` / `修复` / `变更` / `移除` / `性能`（只保留本次有内容的分类，无内容的分类不写空标题）。

#### 写作视角（面向使用者）

CHANGELOG 的读者是插件的使用者（Magpie 用户），不是开发者。条目只写「使用者能感知到的变化」：

- **写使用者视角的结果**：能做什么、输出/行为有什么不同、配置与默认值如何变化。
- **禁止内部实现细节**：模块与函数拆分、数据结构、算法、缓存与并发策略、日志埋点、重构过程，一律不写。
- **禁止出现代码标识符与文件路径**（如 `_load_config`、`quota.mjs`）；使用者直接接触的**命令名、配置项 key、公开 API 名**除外。
- **无使用者感知的改动不记入 CHANGELOG**：纯内部重构、格式化、注释与测试调整等。
- **只写相对上一版的变化**：不复述仍然有效的旧功能，不写「继续优化」这类空话。
- **同一个变化合并成一条**：同一功能的多处调整、跨多个提交的同一件事，整理阶段合并。
- 判断标准：使用者读完一条，能决定「要不要升级、升级后有什么不同」。

正反例：

```markdown
### 新增
- ✅ 支持 `locale` 配置项：`zh` / `en` / `auto`，默认跟随系统语言
- ❌ 新增 `resolveLocale` 并在 `strings()` 里引入 `TABLES` 查表缓存

### 修复
- ✅ 修复额度窗口缺少用量时卡片显示为 `0 / limit` 的问题
- ❌ 修复 `toQuota` 里 `Number(undefined)` 未判有限值导致的窗口伪造
```

#### 版本号（准备发布时才确认）

- **日常开发不碰版本号**：只往 `[Unreleased]` 追加条目，版本源里的版本号保持原值；每个功能、每个修复各自是一次独立提交，提交里不带版本号变更。
- **准备发布时才确认并递增一次**：一次发版汇总多个独立提交，等合并到指定版本、把 `[Unreleased]` 内容移入 `## vX.Y.Z (YYYY-MM-DD)` 的同一次操作里，才确认版本号（SemVer 见 8.2）、写进唯一的版本源文件、把辅助位置同步成同一个版本号并打 `git tag vX.Y.Z`。**不能每改一点就递增**。
- **唯一版本源**：`package.json` 的 `version` 字段。当前仓库没有 README 徽章、没有代码内版本字样、没有 i18n 版本号——**不要新增这类重复版本号**；需要展示版本时从 `package.json` 读取。
- README 正文里的版本字样、i18n 文案等属于**辅助信息**：不决定版本号，但**准备发布时必须同步到同一个新版本号**，日常提交不动它们。

#### 多会话并行开发

**⚠️ 更新 `CHANGELOG.md` 前必须先读取当前文件内容**，识别并保留其他会话已写入的既有条目（含 `[Unreleased]` 下未提交的功能），只追加自己的条目，**严禁整文件覆盖或删除他人记录**。

### 7.2 README 维护

- **功能/介绍**：项目是什么、核心能力、限制。
- **快速开始**：安装、登录、最小可用配置（放在 README 前部）。
- **配置**：配置项表格（配置项、类型、默认值、说明）。
- **其它**：额度出现在哪里、已知限制、插件分发方式、开发与测试。

#### 写作视角（面向使用者）

README 的读者是使用者，不是开发者。只写使用者能直接用到的东西：

- **该写的**：能做什么、怎么装、怎么配、怎么用、用之前要知道的前提与限制。
- **不该写的**：实现原理与设计理念、内部调用流程、私有函数名/文件路径、性能优化手段。
- **技术细节翻译成使用者语言**：不写「用 60 秒 TTL 的 Map 缓存」，写「额度读取默认缓存 60 秒，可调」。
- 判断标准：使用者只读 README，就能独立完成安装 → 登录 → 配置 → 使用。

#### 本项目 README 的强制约定

- **语言**：当前**英文单语**，没有中文版。若日后新增中文版，按模板「中文为源、外文跟随」执行（禁止先改外文再回填中文，禁止用外文版覆盖中文版）。
- **披露面**：Magpie 插件详情页展示的就是 npm 上的这份 README，所以它同时承担安全披露职责。改动「存了什么 / 发往哪些主机 / 谁能看到」时，必须同步改「Security notice」九个小节。
- **证据标注**：文中用 **observed**（实测）/ **console code**（控制台前端代码）/ **plugin code**（本仓库代码）三类来源标注结论——新增断言时沿用这套写法，并给出可复核的细节。
- **不得写内部端点路径**（见 2.3 第 1 条），只指到 `quota.mjs`。
- **测试段落**：`Development` 章节的「N tests cover: …」要随测试增删同步更新。
- **禁止无意义的换行**：正文长句不要人为软换行；空行只用于分隔标题、表格、列表、代码块。
- **多会话并行修改**：更新 `README.md` 前必须先读取当前内容，保留他人已写入的部分，**严禁整文件覆盖**。

#### 何时必须更新 README

| 改动类型 | 必须更新位置 |
|----------|-------------|
| 功能新增/删除 | 顶部定位、`Known limits` |
| 使用方式 / 登录流程变化 | `Install` 章节 |
| 配置项变化 | `Configuration` 表格 |
| 依赖 / Node 版本要求变化 | `Install`、`Development` |
| 前提与限制变化 | `Known limits`、安全披露章节 |
| 存储、网络、可见性变化 | `Security notice` 九个小节 |

**何时不需要更新 README：** 纯内部重构（行为完全不变）、注释与测试调整。

### 7.3 PR / 提交正文规范

- **只写最终行为**：描述最终完成了什么，而不是过程中尝试了什么。
- 禁止提及：尝试过的方案、被否定的设计、从未合入的中间状态。
- 只写 diff 里看不出来的取舍理由，以及本次改动依据的**实测证据**（沿用本仓库历史提交的写法：问题与证据 → 改法 → 验证方式与测试数）。

---

## 8. 提交与发布流程

### 8.1 提交规范（Conventional Commits）

提交信息遵循 **Conventional Commits**：

```
<type>(<scope>): <subject>
```

- `<type>` 用英文小写，可选：`feat` / `fix` / `docs` / `refactor` / `perf` / `test` / `build` / `ci` / `chore` / `style`。
- `<scope>` 可选：受影响模块名（如 `quota`、`models`、`i18n`、`readme`、`agents`）。
- `<subject>` 用**中文短句式**描述最终行为，不带句号。
- 破坏性变更：`<type>!:` 或在正文写 `BREAKING CHANGE:` 说明。
- 正文保留本仓库的历史习惯：**问题与证据 → 改法 → 验证方式（测试数）**；引用平台原文时可保留中文/英文原样。
- 说明：仓库已有的 10 条历史提交是英文散句（遗留），**不回改**；新提交起统一按本规范。

示例：

```
feat(quota): 新增额度窗口用量字段
fix(auth): 修复 POST 请求体在转发时丢失
docs(readme): 补充 Windows 下登录提示失败的绕行方式
refactor(i18n): 合并两处重复的池名归一逻辑
```

- **禁止**将未完成的功能、多轮迭代的中间状态、被废弃的方案写进提交信息。
- **提交前必须先向用户展示，等用户确认后再执行 commit**，展示内容缺一不可：
  - 待提交文件清单
  - 改动概要（如 `git diff --stat`）
  - **提交标题，尽量给 2–3 个候选**（同一改动的不同侧重点：做了什么 / 为什么改 / 是否带 scope），逐条注明侧重供用户挑选并标出推荐项；确实只有一种合理写法时才只给一个
  - 用户选定标题（或自拟）后才 commit；涉及推送时另附提交 hash、提交信息、目标分支与改动概要
- 推荐顺序：完成功能代码 → 跑通验证 → 更新 CHANGELOG 与 README → 提交。
- 文档更新与代码改动**在同一提交中完成**（不单独拆「补文档」提交）。
- 只有用户明确要求时才 commit / push。
- **授权一次性，不延续**（「上一轮说过推送」≠ 本轮可以提交）：
  - 用户的确认**只对当次动作生效**；下一次改动必须重新展示改动内容与提交标题，重新确认。
  - 展示后改动内容又变了（用户提了新要求、你又改了文件，哪怕只改一行），**原确认立即失效**，必须重新展示并再次确认。
  - 下列情形**都不算授权**：上一轮 / 上一个任务 / 上一个会话说过「提交」「推送」；会话恢复（resume / fork）后继承的历史授权；用户对功能或代码表示满意；用户正在讨论其它需求；用户未回复。
  - 授权范围逐项独立：确认 commit ≠ 授权 push；确认推送某分支 ≠ 授权后续继续提交或推送；确认一个提交 ≠ 授权 `--amend` 或追加提交。
  - 执行前自检：能指出用户**本轮**对**本次改动**的明确同意原话；指不出来就先问，不要执行。

### 8.2 版本号与发布

- 采用 **SemVer**：新功能 → `minor`；bug 修复 / 小改进 → `patch`。
- **只在准备发布时递增**（规则见 7.1）：单个功能/修复提交不碰版本号；一次发版汇总多个独立提交、合并到指定版本时才确认版本号，改 `package.json` 的 `version`，并把 README 等辅助位置同步到同一版本号。
- 发版一致性：`package.json` 的 version = CHANGELOG 新版本段号 = `git tag vX.Y.Z`，tag 推送同样需用户确认。
- 发布面检查：改动新增了运行时文件时，确认 `package.json` 的 `files` 白名单已包含它（必要时 `npm pack --dry-run` 核对产物清单）；`test/` 不发布。
- 分发路径（README「Distributing this as a plugin」）：GitHub topic `magpie-plugin` 已启用；npm 与 `registry.json` 推荐列表是**可选**路线，未启用——要改变分发方式先与用户确认。

### 8.3 测试与验证

提交前必须运行：

- **测试**：`node --test test/*.test.mjs`（或 `npm test`），必须 **55/55 通过**；新增行为要补测试（`test/` 下按模块归档）。
- **冒烟**：`node -e 'import("./index.mjs").then((m) => console.log(typeof m.SenseNovaPlugin))'` 输出 `function`（验证入口可加载、图标与模块图未坏）。
- **无构建、无 lint**：本项目没有 lint/format 命令，改动靠人工保持与相邻文件一致。
- 测试不得依赖网络与真实凭据：一律打桩 `globalThis.fetch`（并在 `finally` 还原）或通过 `fetchImpl` 注入；临时文件用 `fs.mkdtempSync(os.tmpdir())` 并在 `finally` 清理。
- 新行为若无法测试（例如需要真实控制台响应），在提交正文说明「未覆盖路径」，不要假装已覆盖。

---

## 9. 最终检查清单（每次任务完成前）

- [ ] 依赖方向：新代码没有让底层模块反向依赖 `index.mjs`，`index.mjs` 仍只导出一个函数
- [ ] 新增运行时文件：已加入 `package.json` 的 `files` 白名单
- [ ] 约定与坑：核对了 2.3 的 14 条（尤其额度 `amount`、`remaining` 缺失跳过、`__` 键剥离、回写条件、续期顺序）
- [ ] 注释：只写 non-obvious reason，语言跟随所在文件，无残留中间状态、无被注释掉的旧代码
- [ ] 日志：没有新增 `console.*`；需要日志时走宿主 logger 且包 try/catch；用户可见文案进 `i18n.mjs`
- [ ] i18n：新增文案已同时进 `ZH` 与 `EN`（键集合一致），`test/i18n.test.mjs` 通过
- [ ] CHANGELOG：`[Unreleased]` 已追加条目（或首次创建该文件），条目面向使用者、同一变化已合并为一条，保留了他人的既有记录
- [ ] README：涉及用户可见变更（配置、登录、额度形状、存储/网络/可见性、测试数）时已同步，改动「存了什么/发往哪里/谁能看见」时已同步 Security notice 九节
- [ ] 版本号：日常任务不递增；仅发版任务改 `package.json`（与 CHANGELOG 新版本段、tag 一致）
- [ ] 配置：新增配置项已在默认值定义 + README 配置表 + CHANGELOG 中同步
- [ ] 提交信息：Conventional Commits 格式，中文短句式 subject，正文含证据与验证方式
- [ ] 提交前展示：已给出待提交文件清单、`git diff --stat`、2–3 个候选提交标题（逐条注明侧重并标出推荐项），并取得用户对本次改动的明确确认（一次性授权，未沿用上一轮）
- [ ] 验证：`node --test test/*.test.mjs` 全通过，入口冒烟命令已跑通
