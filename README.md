# magpie-sensenova

**中文简介** —— 这是 [Magpie](https://usemagpie.ai) 的 **SenseNova**（商量 / 日日新，商汤）provider 插件：通过 OpenAI 兼容接口接入 Token Plan 模型，并把控制台的**积分额度**映射成 Magpie 原生的额度窗口。平台把这两件事放在不同主机、用两套互不相关的凭据，所以一个包同时做两件事——模型调用走 `token.sensenova.cn` 用 API Key，额度读取走控制台主机用控制台 OAuth token。安装只需 `magpie plugin add <path to this repository>`，随后 `magpie plugin login sensenova`。

额度出现在账号行、`magpie quota` 与网关的 `GET /v1/magpie/quotas` 三处（窗口名与单位中英并列，见下例）。存储内容、会连哪些主机与已知风险，见下方「⚠️ 安全须知」；完整中文文档在下面的「中文」一节，完整英文文档在其后的「English」一节。

**English** — A [Magpie](https://usemagpie.ai) provider plugin for **SenseNova** (商量 / 日日新, SenseTime): it brings the Token Plan models in over the OpenAI-compatible API and maps the console's **credit quota** onto native Magpie quota windows. The platform keeps the two in different places with two unrelated credentials, so one package does both — model calls go to `token.sensenova.cn` with an API key, quota reads go to the console host with a console OAuth token. Installing is `magpie plugin add <path to this repository>` followed by `magpie plugin login sensenova`.

The quota appears in three places: the account row, `magpie quota`, and the gateway's `GET /v1/magpie/quotas` (window names and the unit carry both languages, as in the example below). What is stored, which hosts it contacts and what the known risks are, is spelled out in the ⚠️ security notice below; the full Chinese document is under the 中文 section, the full English one under the English section.

```
$ magpie quota
sensenova  通用积分池 · 5 小时窗口 / General Pool · 5h window   0% used ↻ 2h  ·  Flash-Lite积分池 · 本周 / Flash-Lite Dedicated Pool · This week  22.8% used ↻ 2h
```

*（额度端点无论 `Accept-Language` 都返回中文池名——**实测**；英文半因此沿用控制台英文站自己的命名：**General Pool**、**Flash-Lite Dedicated Pool**、**credits**。）*

*The quota endpoint answers its pool names in Chinese whatever `Accept-Language` says — **observed** — so the English half follows the console's own English naming, taken from [its English site](https://platform.sensenova.cn/en/console): **General Pool**, **Flash-Lite Dedicated Pool**, **credits**.*

---

## 中文

#### 账号行显示什么

Magpie 给账号行取名字的顺序是 `accountId` → `metadata.email` → `email`，三者都不存在时才退回用凭据指代账号——也就是你可能见过的 `API key …HohJ`。

所以这个名字在**登录那一刻**就定下来了，取自你当时填的内容：填了账号栏，行上就是你填的手机号或邮箱；留空，就保留 Magpie 的 API-key 兜底命名。

让 `api` 类型的方法也能设置这个名字费了一番实测，这些结论值得记下来，因为两种看起来可行的做法其实都不行：

- **决定名字的是 prompt 的 `key`。** 本插件用 `email` 这个 key 索要账号，因此答案落进 `metadata.email`——Magpie 读的就是这个字段。已做端到端验证：账号栏填 `139…7777` 登录后，行上显示的正是这个号码。
- **`authorize` 返回的 `accountId` 对 `api` 类型方法无效。** 它只对 oauth 结果有文档说明；带着它的登录结果仍然是 `API key`。
- **`authorize` 返回的 `metadata` 对象会被丢弃。** Magpie 会用 prompt 收集到的答案覆盖它，塞进去的 `email` 不会留下。
- **`usage.user` 也不能给行改名。** 钩子返回的 `user` 只会存进 Magpie 的额度缓存（`quotas.json` → `quota.user`），行和 `magpie quota` 仍显示登录时的名字；缓存键也一直是 `sensenova/api key …hohj`。

旧版登录把账号存在 `metadata.username` 下，所以 `consoleAuthOf` 仍会读这个拼写（以及 `account`）作为兜底；只有新登录才能享受新的命名方式。

**如果你在支持这个行为之前就登录过**，已存的名称仍是 API-key 那个。重跑一次 `magpie plugin login sensenova` 即可改好。

---

### ⚠️ 安全须知 —— 请先读

**本插件是本地第三方客户端，与商汤没有隶属关系。** 下面每一条都标明证据来源，共三类：

- **实测**（observed）—— 对真实 API 或本机的测量，附命令或现象；
- **控制台前端代码**（console code）—— 引自 SenseNova 控制台前端的代码；
- **本仓库代码**（plugin code）—— 本仓库源码实际做了什么，附文件与函数。

前两类描述外部世界，可能因平台改动而失效；第三类描述这个包本身，随其版本变化。**如果标着「本仓库代码」的结论与你的观察不符，请相信代码并提 issue。**

#### 1. 存了什么，存在哪里

两套凭据，范围差别很大：

| 凭据 | 存在哪 | 字段 | 能做什么 |
| --- | --- | --- | --- |
| API Key | `~/.config/magpie/plugin-auth.json` | `key`（`type: "api"`） | 调用 Token Plan 模型 |
| 账号 + 密码（仅当你提供） | 同一文件的 `metadata` | `metadata.username` / `metadata.password` | **整个账号** |
| 控制台 OAuth token | 同一文件的 `metadata`，或 `~/.sensenova-quota.json` | `access` / `refresh` / `cookie` / `iamBase` | 读额度、续期 token |
| 会话 cookie（仅当你提供） | 同上 | `metadata.cookie` | 不用密码换控制台 token |

**账号密码能做的远不止读额度。** 它能登录 SenseNova 控制台、创建和删除 API Key，以及该账号能做的一切。把它交给插件，等于把整个账号交给 Magpie 的凭据文件——这是本插件请求的最重权限。**留空完全可用**（见第 5 节）。

`metadata` 里的账号和密码有两种来源，且都经过同意：你在插件登录提示里输入的内容，或你之前用 `snquota login --save-password` 存进 `~/.sensenova-quota.json` 的内容（该文件存在时插件会读它）。**它不从浏览器、系统钥匙串或其它 provider 的登录里扒凭据**，也不写 SenseNova 服务端的任何凭据设置。

**确实会写一个本地文件，这一点要说清楚：** 如果凭据来自 `~/.sensenova-quota.json`——也就是你没填账号字段、走了第 5 节的第二条路——那么在续期 token 之后，插件会**把新 token 写回该文件**，免得 CLI 手里那份过期。代码里的条件是「登录时既没给用户名也没给 cookie」；**任给其一就不会回写。**（`credentialsFile` 只改变写入目标，不能关掉回写。）

#### 2. 密码是明文存储的

**内容没有加密。** 就是明文 JSON。这一部分与平台无关。

至于谁能读到，别指望文件权限兜底。在 Linux 和 macOS 上 Magpie 会把它建成 600（仅你可读），但在 Windows 上这层保护实际不生效——在本机实测，`plugin-auth.json` 和 `~/.sensenova-quota.json` 的有效 mode 都是 `666`，`ls -l` 打印的 `-rw-r--r--` 是 Git Bash 伪装的。真实 ACL 是这样：

```
<your account>          FullControl
<some local group>      Modify        ← 不止你能读
NT AUTHORITY\SYSTEM     FullControl
BUILTIN\Administrators  FullControl
```

也就是说，以你的身份运行的任何进程、或该组的成员，都能读到密码。**密码的安全边界是「本机所有本地进程」，不是「只有你」。**

所以实用建议是：把这两个路径排除在云同步目录、备份任务和 dotfiles 仓库之外。密码一旦随备份走，就是明文在旅行。

#### 3. 密码是明文传输的，与浏览器不同

**控制台前端代码**长这样（`U` 加密，`h.bK` 是登录请求）：

```js
// When the JWKS is available, encrypt with the server's public key before submitting
if (s) { let t = await U(s, e.password); t && (r = t, a = !0) }
await h.bK({ username: e.username, password: r, challenge: t, is_encrypt: a })
```

浏览器会带 `is_encrypt: true` 和 RSA-OAEP（JWE，`alg: RSA-OAEP, enc: A256GCM`）密文提交。**本插件发的是明文（`is_encrypt: false`）**——这部分是**实测**：服务端接受，且不强制加密。

两者最终在服务端都是明文，因为校验密码需要明文。区别在**路径上有多少环节暴露**：HTTPS 仍保护传输，但任何能看到 TLS 明文的环节——企业代理、抓包、请求体日志——都能看到密码。如果你处在这样的环境里，不要填密码。

#### 4. 密码几乎不会被用到

续期顺序是 `refresh_token` → 会话 cookie → 账号密码，且**第一步成功即止**。只要 refresh token 还活着，密码根本不会被发送。它只是 refresh token 失效后的最后手段。

#### 5. 不想存密码就留空

登录时的账号栏和密码栏都可以留空。三种用法及各自代价：

| 做法 | 会落到哪 | 适合谁 |
| --- | --- | --- |
| **只填 API Key** | 只有 `key` | 只想调模型、不在意额度显示 |
| **账号和密码留空** | 插件读 `snquota` CLI 写的 `~/.sensenova-quota.json`（通常含 refresh token） | 想看到额度，但不愿把账号密码交给 Magpie |
| **填写账号** | 明文写进 `plugin-auth.json` | 没有别的 token 来源，且接受第 1、7 节的风险 |

如果两栏都留空、该配置文件也不存在，额度会报一个要求重新登录的错误——**两种情况都不影响模型调用。**

#### 6. 会连哪些主机，且没有遥测

默认部署（`platform.sensenova.cn`）下有三台：

| 主机 | 用途 | 发送什么 |
| --- | --- | --- |
| `token.sensenova.cn` | 模型请求、模型列表 | API Key |
| `platform.sensenova.cn` | 读额度；图标 URL 也在这 | 控制台 token |
| `iam.sensecoreapi.cn` | 续期控制台 token | 账号和密码（仅第 4 节的后备情形） |

源码里还有第四台：`iam.sensecoreapi.tech`。它是**另一个部署** `nova.sensecore.tech` 的 IAM 基址，只有当账号属于那个部署时才会用到（`iam_base` 可覆盖）。如果你在 `platform.sensenova.cn`，它不会出现。

除此之外不往任何地方发东西——没有遥测、没有上报、没有第三方 SDK。它**不读其它 provider 的凭据**（技术上能读同一个 `plugin-auth.json`，见第 7 节；重点在代码不这么做，而不是环境阻止了它），不碰 Magpie 之外的配置，也不创建或删除 API Key（控制台 token 有这个能力，但插件只调用那一个只读端点）。

额度读取默认缓存 60 秒（`quotaTtlMs`），所以被轮询的 `usage` 钩子不会打爆端点。

#### 7. Magpie 与其他插件能看到什么

Magpie 官方文档的 FAQ 里有这段：

> **What can a plugin see about the user?** Everything in the requests it makes: the conversation, the
> tools and their results. Send it only where the user asked, and do not put it in a log.

这条同样适用于本插件，而且必须说透：**它是 provider 插件，就坐在请求路径上。** 它注册一个 provider 并包装 `fetch`，在请求发出前把 `authorization` 头换成当前 API Key：

```js
async fetch(input, init) {
  const headers = new Headers(init?.headers ?? source?.headers);
  headers.set("authorization", `Bearer ${current}`);
  return fetch(new Request(source, { ...init, headers }));   // body passes through
}
```

所以按能力说，它**处在能看到你整段对话、工具调用及其结果的位置上。**

代码实际做的事是：**只读头并改写 `authorization` 这一个字段**，不读请求体（`body` 由 `{...init}` 原样带过），不把内容写到任何地方，不缓存 prompt 或响应，也不往第 6 节名单以外的主机发送任何东西。**但这是代码在自我克制，不是平台给的隔离**——只能靠读代码确认，Magpie 无法为你保证。

Magpie 插件机制的三条事实决定了这份克制值多少：

- **插件没有沙箱。** 插件就是跑在 Magpie 进程里的普通代码，能用 `fs` 读文件。Magpie 文档正是因此建议「把 magpie 跑在沙箱里」，并给它单独的 HOME。
- **插件没有审核。** 从 GitHub topic 安装的插件，Magpie 明确标注为无人审核。本插件同样是不受审查的第三方代码。
- **所有插件的凭据都在一个文件里。** `plugin-auth.json` 是单个文件，装着每个 provider、每个插件的登录信息，不是一插件一文件。既然插件无沙箱且有 `fs`，**你装的任何其它插件都能读到本插件存在这里的账号密码。** 这是决定「要不要填密码」时最重要的一条——机器上有来源不明的插件，就留空（见第 5 节）。

没有插件自带的 UI 面要交代：本插件在 Magpie 的页面里什么都不渲染，可见输出只有额度窗口和它返回的错误文案，两者都在 Magpie 自己的 UI 里。

Magpie 自己会读 `plugin-auth.json`（管理登录）、`plugins.json`（插件及其选项）和 `plugin-providers.json`（最近列出的 provider 与模型）。另外**插件详情页展示的是 npm 上的 README**——所以这份 README 是本插件唯一的披露面，这也是这里每条结论都写成可复核的原因。

#### 8. 风险声明：额度端点是控制台内部 API，不是公开 API

额度数字由控制台主机上的一个端点提供，**控制台自己的前端**用它画积分面板。它没有文档，随时可能变化或消失。具体路径故意不写在这里；需要的话在 `quota.mjs` 里。

存在这条路由，是因为平台**根本没有 API Key 可访问的额度端点**——**实测**：在公开 LLM 主机上逐个试了十几个候选路径（`/v1/llm/usage`、`/v1/llm/quota`、`/v1/llm/balance`、`/v1/dashboard/billing/subscription` 等），全部 404。

**风险不止于「它可能坏掉」。** 直说：

| 风险 | 意味着什么 |
| --- | --- |
| **可能违反服务条款** | 该端点是控制台前端自己的，不是承诺的 API。脚本化访问是否被允许由平台判定，**请自行确认**。本插件不改变也不绕过任何条款。 |
| **可能突然失效** | 无文档端点没有任何兼容承诺。改版、加签名、限流都可能让它变成 404 或 403，届时额度显示会报错（模型调用不受影响）。 |
| **可能触发滥用控制** | 自动登录加周期性读额度，在服务端看来像非常规客户端。本插件已经把额度读取缓存 60 秒、把密码降为最后手段以缩小足迹，但**无法承诺你不会被标记。** |
| **扩大凭据暴露** | 访问该端点需要持有控制台 token（可选地还需要账号密码）。这部分风险由第 1 到第 7 节覆盖。 |

四条里只有第一条需要你判断——技术上的几条插件能扛，合规的不能。**如果这让你不安，就别用额度功能**：只填 API Key 时，插件退化成纯模型 provider，永不触碰控制台 API，第 2 到第 4 条风险也随之消失。

#### 9. 它不做什么

- 不请求、轮换或吊销你的 API Key。
- 不修改你的 SenseNova 账号设置。
- 不读取、不记录、不转发你的模型请求内容——它只改写 `authorization` 头，把请求体原样转发给 `token.sensenova.cn`（见第 7 节的代码）。
- 不缓存 prompt 或响应。
- 不写 SenseNova 服务端的任何凭据设置。
- 不在 Magpie 里渲染自己的任何 UI，也不声明自己的设置：没有语言选项可改，因为它显示的每段文字都是固定的中英同显。
- 不回写 `~/.sensenova-quota.json`，**除非**凭据来自该文件且续期过 token（见第 1 节末尾）。

---

### 一个包，两件事

平台把这两件事放在完全不同的地方，所以插件同时做两件事：

| | 位置 | 凭据 |
| --- | --- | --- |
| **模型调用** | `https://token.sensenova.cn/v1`（OpenAI 兼容） | API Key |
| **积分额度** | 控制台主机上的内部 API | 控制台 OAuth token |

**没有 API Key 可访问的额度端点。** 十几个候选路径逐个试过，全部 404；额度只存在于控制台自己的端点后面，需要 Ory bearer token。所以两套凭据**确实互相独立**，插件在登录时一并收集。

---

### 额度出现在哪里

插件唯一的额度通道是 `auth.usage`，也没有任何东西能往用量总览的分析页里塞内容——那由 Magpie 自己的请求计量驱动。`auth.usage` 返回的内容出现在三处：

- provider 的**账号行**
- `magpie quota`
- 网关的 `GET /v1/magpie/quotas`

好消息是 Magpie 的额度模型与 SenseNova 的数据几乎一一对应，什么都不丢：

| SenseNova | Magpie |
| --- | --- |
| 通用池 5 小时窗口（`window_5h`） | 一条 `windows[]`，`span: 18000` |
| 通用池本周窗口（`window_7d`） | 一条 `windows[]`，`span: 604800` |
| 池覆盖哪些模型（`model_ids`） | `models[]`（含义是「恰好这些 id」） |
| 套餐名（`plan.name`，实际为 `Free Plan`） | `plan` |
| 已授予的积分余额（`grant_balance`） | `balance` |
| 窗口重置时间（`reset_at`） | `resetsAt`（Unix 秒时间戳） |

模型作用域用的是服务端自己的 `model_ids`，而不是从名字猜——专属池的 `model_ids` 是 `["sensenova-6.7-flash-lite","sensenova-6.8-flash-lite"]`，比任何关键词匹配都准（只有 `model_ids` 缺失时才退回匹配 `flash-lite`）。套餐名同理，取自端点的 `plan.name`。

#### ⚠️ 必须给 `amount`，官方文档没写

除了 `used`（已用百分比）和 `limit`（额度上限），每个窗口还必须带 **`amount`（已用数量）**。

这是踩坑得来的：只给 `used` 和 `limit` 时，百分比是对的，但 UI 里的数字显示成 `0 / 600000`——和真实余额完全不像。Magpie 把卡片渲染成「已用 / 上限」，并提供一个「已用 | 剩余」开关，两者都由 `amount` 计算；缺了它，数量一律当作 0。

这个字段**不在插件文档的窗口字段列表里**（文档只列了 `name`/`used`/`resetsAt`/`resetSecs`/`span`/`display`/`model`/`models`/`notModels`/`aside`）。它是靠读两个社区插件找回来的——`@magpie-community/opencode-workbuddy-auth` 和 `opencode-zcode-auth` 都设了它，后者的注释说明了用途：

> the count is told carries it as **amount of limit**, so magpie's card says …

所以本插件发出的每个窗口都带 `used`（百分比）、`amount`（已用数量）、`limit`、`unit`、`display`、`span`、`resetsAt`，专属池另加 `models`。`display` 用 Magpie 自己的紧凑格式生成（`compact()`：整数按整数，否则两位小数），以便与 `amount`/`limit` 并排渲染时对齐。

对账很简单：`limit - amount` 必须等于控制台显示的当周剩余余额。**实测**：四个窗口全部吻合。

---

### 安装

```bash
magpie plugin add <path to this repository>
magpie plugin login sensenova
```

登录会问三件事：

1. **SenseNova API Key**（必填）——控制台 → API-Key 管理。没有它 provider 发不出任何请求。
2. **账号**（可选）——用来读控制台的积分额度。
3. **密码**（可选）——同上。

后两项留空没问题：插件会退回读 `~/.sensenova-quota.json`，它由本机的 `snquota` CLI 写入。

安装不再问别的：没有语言设置。插件显示的每个标签都同时带两种语言，`中文 / English`（见页首）。

#### Windows 下登录提示失败

Magpie 的提示读取器要一个真正的 Windows 控制台。从不给它的 shell 启动——Git Bash/mintty 是常见情况——第一个提示就会这样死掉：

```
magpie: read /dev/stdin: The handle is invalid.
```

这是 Magpie 宿主自己在读标准输入（`/dev/stdin` 是 Go 对它的叫法），不是本插件的问题：任何用文本提示的包都一样。两种绕法。

**改在命令行里答。** 管道输入可用，答案按提示顺序读取——key、账号、密码。末尾那行很关键：只有三行时，读取器在最后一个提示前就用完并报 EOF。

```bash
printf '%s\n%s\n%s\n.\n' "$SENSENOVA_API_KEY" "$ACCOUNT" "$PASSWORD" | magpie plugin login sensenova
```

**或者用 Magpie 应用自带的登录**，它完全不经过 CLI 的读取器。

#### 关于那两套控制台凭据

额度端点要一个控制台 token，而该 token 约 2.4 小时过期。插件实现了三条续期路径，按可靠性排序：

1. `refresh_token`（标准续期）
2. 浏览器会话 cookie（重放授权码 + PKCE 流程）
3. 账号和密码（完整自动登录：`login_challenge` → challenge 校验 → 提交 → 跟随重定向链 → 换取 token）

如果你已经在用 `snquota` CLI，最省事的安排是让插件读那份配置，两边共用一套凭据：

```bash
snquota login --username <your account> --password <your password> --save-password
```

**密码以明文存进 `plugin-auth.json`**（存储与权限细节见第 2 节）。如果这不可接受，就不要填密码——用 cookie，或让插件读 `snquota` 配置。

---

### 配置

`plugins.json` 中该条目的 `options`：

```json
{
  "spec": "…/magpie-sensenova",
  "options": {
    "baseURL": "https://token.sensenova.cn/v1",
    "quotaTtlMs": 60000,
    "scopeModel": "flash-lite",
    "credentialsFile": "~/.sensenova-quota.json"
  }
}
```

| 选项 | 默认值 | 含义 |
| --- | --- | --- |
| `baseURL` | `https://token.sensenova.cn/v1` | Token Plan 地址 |
| `quotaTtlMs` | `60000` | 额度读取缓存时长。`usage` 会被轮询，缓存避免端点被打爆 |
| `scopeModel` | `flash-lite` | 用于限定专属池模型的关键词 |
| `credentialsFile` | `~/.sensenova-quota.json` | 控制台凭据所在文件 |

---

### 额度按账户计算：同一个账号的 Key 共用一个池

**积分额度不按 API Key 拆分。同一账号下的每个 Key 共用一个池。**

三条证据：

1. 控制台自己的横幅写着「**同账户所有 Key 共享**」。
2. 额度端点的响应里**完全没有 Key 维度**——顶层只有 `{plan, pools}`，每个 pool 带 `id`/`name`/`model_ids`/`window_5h`/`window_7d`/`grant_balance`/`pool_type`，任何地方都没有 Key 标识。插件拿到的是一个账户级数字。
3. 按 Key 的拆分在别处：控制台的**用量记录**页。那个端点支持按 `apiKey` 过滤，每条调用记录带自己的 Key，可导出 CSV 或 Excel。

所以这是两个不同的层：

| | 维度 | 是什么 |
| --- | --- | --- |
| **积分池（本插件显示的）** | 账户级 | 账号下所有 Key 共享；Key 是入口，不是独立账本 |
| **用量记录** | 按调用 | 每条记录带自己的 Key，可按 Key 过滤与导出 |

#### 这对 Magpie 实际意味着什么

provider 卡片标题是「API key …HohJ」，但它显示的额度是**账户级**的。于是：

- 加**同一 SenseNova 账号下的两个 Key**，两行显示**完全相同的数字**。
- Magpie「一个用完就切下一个」的行为在这种情况下失效——它假设每个 Key 各有 600,000 额度，实际共用一个池。**多填 Key 不会多额度。**
- 想要更多额度，得换**另一个 SenseNova 账号**。

---

### 图标

它用平台自己的图标：`assets/sensenova.png` 是 `https://platform.sensenova.cn/favicon.ico` 的原始字节。那个地址后缀是 `.ico`、响应头也是 `image/x-icon`，但内容实际是 65×65 PNG，所以 data URI 声明 `image/png` 以匹配字节而不是响应头。

图标是**随仓库内置而不是按 URL 引用**的，这样 provider 离线时仍可识别，也不依赖平台继续提供该文件。`package.json` 里的 `magpie.icon` 仍指向那个地址，供发布到 npm 后的发现卡片使用。

---

### 模型

内置快照里的四个 id 不是编的——它们是平台自己的用量报告输出的（`credit-usage-trend` 的 `series[].model_id`）：

- `sensenova-6.8-flash-lite`（多模态）
- `deepseek-flash`
- `glm-5.2`
- `kimi-k3`

登录后，`provider.models` 用 API Key 从 `GET /v1/models` 拉活列表（该端点存在——无 Key 时返回 401 而不是 404）。有活列表就用活列表；否则插件回退，并给列表打上 Magpie 的回退标记。Magpie 还会合并它自己 models.dev 里的 `sensenova` 条目，实际会加上 `deepseek-v4-pro` 和 `deepseek-v4-flash` 两个 1M 上下文的模型。

上下文长度与输出上限在平台的公开文档里没有发布，所以内置快照用保守占位值；带元数据的活列表会覆盖它们。

---

### 已知限制

- **额度只出现在三处**——账号行、`magpie quota`、`/v1/magpie/quotas`——无法进入用量总览。这是 Magpie 的设计，不是本插件没做到。
- 如果控制台 token 过期且三条续期路径都失败（refresh token 被吊销、cookie 过期、密码错误），账号行会显示一个 `error`，要求重新登录。
- 额度端点是控制台内部 API 而非公开 API，改版可能让它失效。
- 没有活列表时，模型能力字段（上下文长度等）是占位值。
- 每个标签都带两种语言，所以窗口名和错误行约为单语的两倍长，且无法只显示一半。

---

### 作为插件分发

把仓库推到 GitHub 本身不会让它出现在 Magpie 里。按官方文档，插件通过三条途径被发现，满足一条即可：

**1. GitHub topic（最省事）**

给仓库打上 `magpie-plugin` topic，它就会出现在 Plugins → Discover → **unofficial plugins**，按 star 排序并标注为无人审核。要求：

- `package.json` 必须在**仓库根**（已满足）。
- 如果包同时在 npm 上且其 `repository` 指向本仓库，安装走 npm；否则安装的是仓库当前代码，所以**被加载的文件必须已提交**（本仓库是纯源码、无构建产物，已满足）。
- fork、归档仓库和 `magpie-community` 自己的仓库被排除。
- GitHub 最多每十分钟轮询一次，新 topic 几分钟内就会出现。

**2. npm**

插件浏览器在 npm 上搜 `<keyword> opencode`，匹配名称或 keywords 同时含 **`opencode`** 与 auth / plugin / provider 之一的包。本仓库 keywords 已含 `opencode`、`opencode-plugin`、`opencode-auth`，符合条件。普通插件**不需要 scope**；`@magpie-community/` 只给贡献进官方社区仓库的包。

**3. 推荐列表（`registry.json`）**

这条不对独立包开放。对照线上文件核对：全部 21 条都是 `@magpie-community/*`，且每条都带 `"community": true`，无一例外。所以上榜意味着**成为社区包**，而不是提一个把外部包加进去的 PR。

要走这条路，就在 `magpie-community/plugins` 的 `packages/<name>` 下贡献，provider 包命名为 `@magpie-community/opencode-sensenova-auth`，加进去的条目与其它条目一样：

```json
{
  "package": "@magpie-community/opencode-sensenova-auth",
  "name": "SenseNova",
  "icon": "sensenova",
  "providers": ["sensenova"],
  "community": true,
  "summary": {
    "en": "SenseNova Token Plan models, with the console's credit quota reported as native quota windows.",
    "zh": "接入商量/日日新 Token Plan 模型，并把控制台积分额度上报成原生额度窗口。"
  }
}
```

注意这里的 `icon` 是短名（其它条目用 `opencode`、`zcode`、`qoder`…），不是 `magpie.icon` 接受的 URL。它带来两个好处：往 `main` 推版本即发布，且包会在**每个 Magpie 里自动更新**，用户不用重装。本仓库**零依赖**，迁过去不需要改代码——但那意味着包在别人的仓库里开发，所以默认不这么做。

列表最多每六小时拉一次，Magpie 自带一份内置副本作为兜底。`MAGPIE_PLUGIN_MARKET=<url>` 可换用另一份列表（`off` 表示只用内置副本）。

`package.json` 的 `repository` / `homepage` / `bugs` 指向 `XTsat/magpie-sensenova`，仓库也带着 `magpie-plugin` topic，所以今天可通过第 1 条途径被发现。第 2、3 条是可选路线，未做。

---

### 开发与测试

```bash
node --test test/*.test.mjs
```

52 个测试覆盖：把池映射成窗口（含 `used` 百分比、`amount`、`limit`、`span`、`resetsAt`、专属池的模型作用域、已授予余额）；`limit - amount` 还原控制台余额；用量未知的窗口被跳过而不是报成 0；字段缺失时的降级；JWT 过期；refresh token 续期；没有凭据时抛出的错误；`fetch` 钩子在 `(url, init)` 与 `Request` 两种入参下都保留 body 与 headers；内部 `__` 前缀键不会落进凭据文件；模型归一化的两种信封；表里每条都是 `中文 / English`、两半键集合一致、中英相同的文字只写一次、且表里没有 `locale` 这一项；池的英文半遵循控制台自己的命名、专属池规则绝不套用到通用池；`accountNameOf` 读 token、拿不到名字时返回空而不是编一个；账号 prompt 声明在 `email` 键下、`consoleAuthOf` 仍认旧的 `username`/`account` 拼写；`usage` 钩子端到端，含双语窗口名、单位与余额；以及 Magpie 读取的包元数据——不再声明任何自带 UI 或面板，也没有示例 options。

全程不联网、不用浏览器、不用真实凭据：对外调用全部打桩。

---

## English

#### What the account row shows

Magpie names an account from `accountId`, then `metadata.email`, then `email`, and only when none of those
exist does it fall back to labelling the account by the credential — the `API key …HohJ` you may have seen.

So the label is fixed **at sign-in**, from what you type there: fill in the account field and the row shows
that phone number or email; leave it blank and the row keeps Magpie's API-key fallback.

Getting an `api`-type method to set it took some measuring, and the findings are worth recording because two
plausible approaches do not work:

- **The prompt's `key` is what decides it.** This plugin asks for the account under the key `email`, so the
  answer lands in `metadata.email` — the field Magpie reads. Verified end to end: a sign-in with the account
  field set to `139…7777` produced a row labelled exactly that.
- **`accountId` returned from `authorize` is ignored** for an `api`-type method. It is documented for oauth
  results, and a sign-in that carried it still came out labelled `API key`.
- **A `metadata` object returned from `authorize` is discarded.** Magpie replaces it with the answers the
  prompts collected, so an `email` planted there never survives.
- **`usage.user` does not rename the row either.** A `user` from the hook is stored in Magpie's quota cache
  (`quotas.json` → `quota.user`) while the row and `magpie quota` keep rendering the login-time label; the
  cache key stays `sensenova/api key …hohj` either way.

Older sign-ins stored the account under `metadata.username`, so `consoleAuthOf` still reads that spelling
(and `account`) as a fallback; only new sign-ins get the naming benefit.

**If you signed in before this behaviour existed**, your stored label is still the API-key one. Re-run
`magpie plugin login sensenova` to set it.

---

### ⚠️ Security notice — read this first

**This plugin is a local third-party client. It is not affiliated with SenseTime.** Every point below
says where its evidence comes from, in one of three kinds:

- **observed** — a measurement against the real API or this machine, with the command or symptom;
- **console code** — a quotation from SenseNova's own console frontend;
- **plugin code** — what this repository's source actually does, with file and function.

The first two describe the outside world and can be invalidated by a platform change. The third
describes this package and moves with its version. **If something labelled "plugin code" disagrees with
what you observe, trust the code and open an issue.**

#### 1. What is stored, and where

Two credential sets, with very different scopes:

| Credential | Stored in | Fields | What it can do |
| --- | --- | --- | --- |
| API key | `~/.config/magpie/plugin-auth.json` | `key` (`type: "api"`) | Call the Token Plan models |
| Account + password (only if you supply them) | same file, under `metadata` | `metadata.username` / `metadata.password` | **The whole account** |
| Console OAuth tokens | same file's `metadata`, or `~/.sensenova-quota.json` | `access` / `refresh` / `cookie` / `iamBase` | Read quota, renew tokens |
| Session cookie (only if you supply it) | as above | `metadata.cookie` | Trade for console tokens without a password |

**The account password does more than read quota.** It can sign in to the SenseNova console, create and
delete API keys, and do anything else that account can do. Handing it to the plugin means handing the
whole account to Magpie's credential file — the heaviest permission this plugin asks for. **Leaving it
blank works fine** (see 5).

The account and password in `metadata` have two possible origins, both consented to: what you typed into
the plugin's sign-in prompt, or what you previously saved to `~/.sensenova-quota.json` with
`snquota login --save-password` (the plugin reads that file when it exists). **It does not scrape
credentials from a browser, the system keychain, or another provider's sign-in**, and it does not write
to any credential setting on SenseNova's servers.

**One local file does get written, and it should be stated:** if the credentials came from
`~/.sensenova-quota.json` — that is, you did not fill in the account fields and took the second route in
5 — then after renewing a token the plugin **writes the new token back to that file**, so the CLI's copy
does not go stale. In code the condition is "neither a username nor a cookie was supplied at sign-in";
**supply either one and nothing is written back.** (The `credentialsFile` option only redirects the
write; it does not turn it off.)

#### 2. The password is stored in plaintext

**The content is not encrypted.** It is plain JSON. That part is platform-independent.

As for who can read it, do not rely on file permissions to save you. On Linux and macOS Magpie creates
it as 600 (readable only by you), but on Windows that protection does not actually land — measured on
this machine, both `plugin-auth.json` and `~/.sensenova-quota.json` have an effective mode of `666`, and
the `-rw-r--r--` that `ls -l` prints is a Git Bash fabrication. The real ACL looks like this:

```
<your account>          FullControl
<some local group>      Modify        ← more than just you can read it
NT AUTHORITY\SYSTEM     FullControl
BUILTIN\Administrators  FullControl
```

In other words, any process running as you, or as a member of that group, can read the password.
**The password's security boundary is "every local process on this machine", not "only you".**

The practical advice is therefore: keep these two paths out of cloud-sync folders, backup jobs, and
dotfiles repositories. Once the password rides along in a backup, it travels in plaintext.

#### 3. The password travels in plaintext, unlike the browser's

The **console code** looks like this (`U` encrypts, `h.bK` is the sign-in request):

```js
// When the JWKS is available, encrypt with the server's public key before submitting
if (s) { let t = await U(s, e.password); t && (r = t, a = !0) }
await h.bK({ username: e.username, password: r, challenge: t, is_encrypt: a })
```

The browser sends `is_encrypt: true` with an RSA-OAEP (JWE, `alg: RSA-OAEP, enc: A256GCM`) ciphertext.
**This plugin sends plaintext (`is_encrypt: false`)** — this part is **observed**: the server accepts it
and does not require encryption.

Both end up as plaintext on the server, which is what it needs in order to check the password. The
difference is **how much of the path is exposed**: HTTPS still protects the transport, but anything that
can see TLS plaintext — a corporate proxy, a packet capture, request-body logging — can see the
password. If you are behind one of those, do not fill in the password.

#### 4. The password is almost never used

The renewal order is `refresh_token` → session cookie → account password, and **the first step that
succeeds stops the chain**. As long as the refresh token is alive, the password is never sent at all. It
is only a fallback for when the refresh token has died.

#### 5. If you would rather not store a password, leave it blank

Both the account and password fields at sign-in can be left empty. Three ways to run this, and what each
costs you:

| Approach | What lands where | For whom |
| --- | --- | --- |
| **API key only** | Just `key` | You want model calls and do not care about the quota display |
| **Leave account and password blank** | The plugin reads `~/.sensenova-quota.json`, written by the `snquota` CLI (usually holds a refresh token) | You want the quota shown but will not hand the account password to Magpie |
| **Fill in the account** | Plaintext into `plugin-auth.json` | You have no other token source and accept the risks in 1 and 7 |

If you leave them blank and that config file does not exist either, the quota reports an error asking you
to sign in — **model calls are unaffected either way.**

#### 6. Which hosts it talks to, and no telemetry

On the default deployment (`platform.sensenova.cn`) there are three:

| Host | Purpose | What is sent |
| --- | --- | --- |
| `token.sensenova.cn` | Model requests, model listing | API key |
| `platform.sensenova.cn` | Reading quota; the icon URL also lives here | Console token |
| `iam.sensecoreapi.cn` | Renewing the console token | Account and password (only in the fallback case in 4) |

There is a fourth in the source: `iam.sensecoreapi.tech`. It is the IAM base for a **separate
deployment**, `nova.sensecore.tech`, and is only reached when the account belongs to that deployment
(`iam_base` overrides it). If you are on `platform.sensenova.cn`, it never appears.

Nothing else is sent anywhere — no telemetry, no reporting, no third-party SDK. It **does not read other
providers' credentials** (it technically could read the same `plugin-auth.json`, see 7; the point is
that the code does not, not that the environment prevents it), does not touch configuration outside
Magpie, and does not create or delete API keys (the console token could, but the plugin only calls the
one read-only endpoint).

Quota reads are cached for 60 seconds by default (`quotaTtlMs`), so a polled `usage` hook does not hammer
the endpoint.

#### 7. What Magpie — and other plugins — can see

Magpie's own documentation has this in its FAQ:

> **What can a plugin see about the user?** Everything in the requests it makes: the conversation, the
> tools and their results. Send it only where the user asked, and do not put it in a log.

That applies to this plugin too, and it has to be spelled out: **this is a provider plugin, so it sits in
the request path.** It registers a provider and wraps `fetch`, swapping the `authorization` header for
the current API key before the request leaves:

```js
async fetch(input, init) {
  const headers = new Headers(init?.headers ?? source?.headers);
  headers.set("authorization", `Bearer ${current}`);
  return fetch(new Request(source, { ...init, headers }));   // body passes through
}
```

So by capability it **is positioned to see your entire conversation, your tool calls, and their
results.**

What the code actually does: **it reads headers and rewrites the single `authorization` field**, does not
read the request body (the `body` is carried through by `{...init}`), does not write the content
anywhere, does not cache prompts or responses, and does not send anything to a host outside the list in
6. **But that is the code restraining itself, not isolation granted by the platform** — you can only
confirm it by reading the code, and Magpie cannot guarantee it for you.

Three facts about Magpie's plugin mechanism decide how much that restraint is worth:

- **Plugins are not sandboxed.** A plugin is ordinary code running inside Magpie's process, and it can
  read files with `fs`. Magpie's documentation recommends "running magpie in a sandbox" with a separate
  HOME for exactly this reason.
- **Plugins are not reviewed.** For plugins installed from the GitHub topic, Magpie explicitly labels
  them as reviewed by nobody. This plugin is unvetted third-party code in the same way.
- **Every plugin's credentials live in one file.** `plugin-auth.json` is a single file holding the
  sign-in for every provider and every plugin, not one file per plugin. Since plugins are unsandboxed and
  have `fs`, **any other plugin you install can read the account password this one stored there.** This
  is the single most important consideration when deciding whether to fill in a password — if there are
  plugins of unknown provenance on the machine, leave it blank (see 5).

There is no plugin-owned UI surface to account for: this plugin renders nothing in Magpie's pages. Its
only visible outputs are the quota windows and the error messages it returns, both inside Magpie's own UI.

Magpie itself reads `plugin-auth.json` (to manage sign-ins), `plugins.json` (plugins and their options),
and `plugin-providers.json` (the last listed providers and models). And **the plugin detail page shows
the README from npm** — so this README is this plugin's only disclosure surface, which is why every point
here is written to be checkable.

#### 8. Risk statement: the quota endpoint is a console-internal API, not a public one

The quota figure is served by an endpoint on the console host that **the console's own frontend** uses to
draw its credit panel. It is undocumented, and it can change or disappear at any time. The exact path is
deliberately not written down here; it is in `quota.mjs` if you need to see it.

That route exists because the platform **offers no API-key-accessible quota endpoint at all** —
**observed**: a dozen candidate paths on the public LLM host (`/v1/llm/usage`, `/v1/llm/quota`,
`/v1/llm/balance`, `/v1/dashboard/billing/subscription`, and others) all return 404.

**The risk is not limited to "it might break".** Stated plainly:

| Risk | What it means |
| --- | --- |
| **It may breach the terms of service** | The endpoint is the console frontend's own, not a promised API. Whether scripted access is permitted is the platform's call, and **you should confirm it yourself**. This plugin neither changes nor circumvents any term. |
| **It may stop working** | An undocumented endpoint makes no compatibility promise. A redesign, a signature requirement, or rate limiting could turn it into a 404 or 403, at which point the quota display reports an error (model calls are unaffected). |
| **It may trip abuse controls** | Automatic sign-in plus periodic quota reads look like a non-standard client from the server's side. This plugin already caches quota reads for 60 seconds and demotes the password to a last resort in order to keep the footprint small, but **it cannot promise you will not be flagged.** |
| **It widens credential exposure** | Reaching this endpoint requires holding a console token (and optionally an account password). That part of the risk is covered by 1 through 7. |

Of these four, the first is the only one that needs your judgement — the plugin can handle the technical
ones, not the compliance one. **If that bothers you, do not use the quota feature**: with only an API key
filled in, the plugin degrades to a plain model provider and never touches the console API, and risks 2
through 4 go away with it.

#### 9. What it does not do

- It does not request, rotate, or revoke your API keys.
- It does not change your SenseNova account settings.
- It does not read, log, or forward your model request content — it rewrites the single `authorization`
  header and passes the body through to `token.sensenova.cn` (see the code in 7).
- It does not cache prompts or responses.
- It does not write to any credential setting on SenseNova's servers.
- It does not render any UI of its own inside Magpie, and it declares no settings of its own: there is no language option to change, because every string it shows is fixed and bilingual.
- It does not write back to `~/.sensenova-quota.json`, **except** when the credentials came from that
  file and a token was renewed (see the end of 1).

---

### Two things, one package

The platform puts these two in completely different places, so the plugin does two things at once:

| | Where | Auth |
| --- | --- | --- |
| **Model calls** | `https://token.sensenova.cn/v1` (OpenAI-compatible) | API key |
| **Credit quota** | An internal API on the console host | Console OAuth token |

**There is no API-key-accessible quota endpoint.** A dozen candidate paths were probed one by one and all
returned 404; the quota exists only behind the console's own endpoint, which needs an Ory bearer token.
So the two credentials are **genuinely independent**, and the plugin collects both at sign-in.

---

### Where the quota is reported

The only quota channel a plugin has is `auth.usage`, and nothing can feed content into the usage-overview
analytics page — that is driven by Magpie's own request metering. What `auth.usage` returns shows up in
three places:

- the provider's **account row**
- `magpie quota`
- the gateway's `GET /v1/magpie/quotas`

The good news is that Magpie's quota model maps almost one-to-one onto SenseNova's data, so nothing is
lost:

| SenseNova | Magpie |
| --- | --- |
| General pool, 5-hour window (`window_5h`) | one `windows[]` entry, `span: 18000` |
| General pool, this week (`window_7d`) | one `windows[]` entry, `span: 604800` |
| Which models a pool covers (`model_ids`) | `models[]` (meaning "exactly these ids") |
| Plan name (`plan.name`, in practice `Free Plan`) | `plan` |
| Granted credit balance (`grant_balance`) | `balance` |
| Window reset time (`reset_at`) | `resetsAt` (a Unix timestamp in seconds) |

Model scoping uses the server's own `model_ids` rather than guessing from names — the dedicated pool's
`model_ids` is `["sensenova-6.7-flash-lite","sensenova-6.8-flash-lite"]`, which beats any keyword
matching (the plugin only falls back to matching `flash-lite` when `model_ids` is absent). The plan name
works the same way, taken from the endpoint's `plan.name`.

#### ⚠️ `amount` is required, and the docs do not say so

Besides `used` (percent used) and `limit` (the allowance), every window must carry **`amount` (the used
quantity)**.

This was learned the hard way: with only `used` and `limit`, the percentage is right but the number in
the UI reads `0 / 600000` — which looks nothing like the real balance. Magpie renders the card as
"used / limit" and offers a "used | remaining" toggle, and both are computed from `amount`; without it,
the count is simply treated as 0.

The field **is not in the plugin documentation's list of window fields** (the docs list only
`name`/`used`/`resetsAt`/`resetSecs`/`span`/`display`/`model`/`models`/`notModels`/`aside`). It was
recovered by reading two community plugins — `@magpie-community/opencode-workbuddy-auth` and
`opencode-zcode-auth` both set it, and the latter's comment states its purpose:

> the count is told carries it as **amount of limit**, so magpie's card says …

So every window this plugin emits carries `used` (percent), `amount` (used quantity), `limit`, `unit`,
`display`, `span`, `resetsAt`, plus `models` on the dedicated pool. `display` is generated with Magpie's
own compact formatting (`compact()`: integers as integers, otherwise two decimals) so it lines up with
`amount`/`limit` when rendered side by side.

Reconciling is easy: `limit - amount` must equal the console's displayed weekly remaining balance.
**Observed**: all four windows match exactly.

---

### Install

```bash
magpie plugin add <path to this repository>
magpie plugin login sensenova
```

Sign-in asks three things:

1. **SenseNova API key** (required) — console → API-Key management. Without it the provider cannot make
   any request.
2. **Account** (optional) — used to read the console's credit quota.
3. **Password** (optional) — same.

Leaving the last two blank is fine: the plugin falls back to `~/.sensenova-quota.json`, written on this
machine by the `snquota` CLI.

Installing asks for nothing else: there is no language setting. Every label the plugin shows carries both languages at once, `中文 / English` (see the top of this page).

#### If the prompts fail on Windows

Magpie's prompt reader wants a real Windows console. Started from a shell that does not give it one — Git
Bash/mintty is the usual case — the first prompt dies with

```
magpie: read /dev/stdin: The handle is invalid.
```

That is Magpie's own host code reading its standard input (`/dev/stdin` is Go's name for it), not this
plugin: every package using a text prompt behaves the same way. Two ways round it.

**Answer on the command line instead.** Piped input works, and the answers are read in prompt order — key,
account, password. The trailing line matters: with only three lines the reader runs out before the last
prompt and reports EOF.

```bash
printf '%s\n%s\n%s\n.\n' "$SENSENOVA_API_KEY" "$ACCOUNT" "$PASSWORD" | magpie plugin login sensenova
```

**Or use the Magpie app's own sign-in**, which does not go through the CLI reader at all.

#### About those two console credentials

The quota endpoint wants a console token, and that token expires in about 2.4 hours. The plugin
implements three renewal paths, in order of reliability:

1. `refresh_token` (the standard renewal)
2. Browser session cookie (replaying the authorization-code + PKCE flow)
3. Account and password (a full automated sign-in: `login_challenge` → challenge check → submit →
   follow the redirect chain → exchange for a token)

If you already use the `snquota` CLI, the simplest arrangement is to let the plugin read that config, so
both share one set of credentials:

```bash
snquota login --username <your account> --password <your password> --save-password
```

**The password is stored in plaintext in `plugin-auth.json`** (storage and permission details are in 2
above). If that is not acceptable, do not fill in a password — use a cookie, or let the plugin read the
`snquota` config.

---

### Configuration

The `options` for this entry in `plugins.json`:

```json
{
  "spec": "…/magpie-sensenova",
  "options": {
    "baseURL": "https://token.sensenova.cn/v1",
    "quotaTtlMs": 60000,
    "scopeModel": "flash-lite",
    "credentialsFile": "~/.sensenova-quota.json"
  }
}
```

| Option | Default | Meaning |
| --- | --- | --- |
| `baseURL` | `https://token.sensenova.cn/v1` | Token Plan address |
| `quotaTtlMs` | `60000` | How long a quota read is cached. `usage` gets polled; the cache keeps the endpoint from being hammered |
| `scopeModel` | `flash-lite` | Which keyword scopes the dedicated pool's models |
| `credentialsFile` | `~/.sensenova-quota.json` | Where the console credentials live |

---

### Quota and API keys: the quota is account-level

**The credit quota is not split per API key. Every key on the same account shares one pool.**

Three pieces of evidence:

1. The console's own banner says 「**同账户所有 Key 共享**」 ("shared by all keys on the account").
2. The quota endpoint's response has **no key dimension at all** — the top level is only `{plan, pools}`,
   and each pool carries `id`/`name`/`model_ids`/`window_5h`/`window_7d`/`grant_balance`/`pool_type`
   with no key identifier anywhere. What the plugin receives is an account-level number.
3. Per-key breakdown lives somewhere else: the console's **usage records** page. That endpoint supports
   filtering by `apiKey`, and each call record carries its key and can be exported as CSV or Excel.

So these are two different layers:

| | Dimension | What it is |
| --- | --- | --- |
| **Credit pool (what this plugin shows)** | Account-level | Shared by every key on the account; a key is an entry point, not a separate ledger |
| **Usage records** | Per call | Each record carries its key, filterable and exportable by key |

#### What this means for Magpie in practice

The provider card is titled "API key …HohJ", but the quota it shows is **account-level**. So:

- Add **two keys from the same SenseNova account** and both rows show **exactly the same numbers**.
- Magpie's "when one runs out, switch to the next" behaviour fails in this case — it assumes each key has
  its own 600,000 allowance, when they actually share one pool. **Adding keys does not add quota.**
- More quota means **a different SenseNova account**.

---

### Icon

It uses the platform's own icon: `assets/sensenova.png` is the raw bytes of
`https://platform.sensenova.cn/favicon.ico`. That address is named `.ico` and served with an
`image/x-icon` header, but the payload is actually a 65×65 PNG, so the data URI declares `image/png` to
match the bytes rather than the header.

The icon is **vendored rather than referenced by URL** so the provider stays identifiable offline and
does not depend on the platform continuing to serve the file. The `magpie.icon` field in `package.json`
still points at that address, for the discovery card once this is published to npm.

---

### Models

The four ids in the built-in snapshot are not invented — they are what the platform's own usage report
emits (`credit-usage-trend`'s `series[].model_id`):

- `sensenova-6.8-flash-lite` (multimodal)
- `deepseek-flash`
- `glm-5.2`
- `kimi-k3`

After sign-in, `provider.models` uses the API key to fetch the live list from `GET /v1/models` (that
endpoint exists — it answers 401 without a key rather than 404). A live list is used when available;
otherwise the plugin falls back and marks the list with Magpie's fallback flag. Magpie also merges its
own models.dev entry for `sensenova`, which in practice adds `deepseek-v4-pro` and `deepseek-v4-flash`,
two 1M-context models.

Context length and output ceiling are not published anywhere in the platform's public documentation, so
the built-in snapshot uses conservative placeholders; a live list that carries metadata overrides them.

---

### Known limits

- **The quota appears in exactly three places** — the account row, `magpie quota`, and
  `/v1/magpie/quotas` — and cannot be put into the usage overview. That is Magpie's design, not something this
  plugin failed to do.
- If the console token expires and all three renewal paths fail (refresh token revoked, cookie expired,
  wrong password), the account row shows an `error` asking you to sign in again.
- The quota endpoint is a console-internal API rather than a public one, so a redesign may break it.
- Model capability fields (context length and so on) are placeholders when there is no live list.
- Every label carries both languages, so window names and error lines are about twice as long as one language would be, and there is no way to show only one half.

---

### Distributing this as a plugin

Pushing the repository to GitHub does not by itself make it show up in Magpie. Per the official docs,
plugins are discovered through three routes, and one is enough:

**1. GitHub topic (least work)**

Tag the repository `magpie-plugin` and it appears under Plugins → Discover → **unofficial plugins**,
sorted by stars and labelled as reviewed by nobody. Requirements:

- `package.json` must be at the **repository root** (satisfied here).
- If the package is also on npm and its `repository` points at this repo, installs come from npm;
  otherwise they install the repository's current code, so **the loaded files must be committed** (this
  repo is pure source with no build output, so this is satisfied).
- Forks, archived repositories, and `magpie-community`'s own repositories are excluded.
- GitHub is polled at most every ten minutes, so a fresh topic shows up within minutes.

**2. npm**

The plugin browser searches npm for `<keyword> opencode`, matching packages whose name or keywords
contain **both** `opencode` and one of auth / plugin / provider. This repository's keywords already
include `opencode`, `opencode-plugin`, and `opencode-auth`, so it qualifies. Ordinary plugins **require
no scope**; `@magpie-community/` is only for packages contributed into the official community repo.

**3. The recommended list (`registry.json`)**

This one is not open to standalone packages. Checked against the live file: all 21 entries are
`@magpie-community/*` and every one carries `"community": true`, with no exception. So being listed means
**becoming a community package** rather than opening a PR that adds an outside package.

To take that route, contribute under `packages/<name>` in `magpie-community/plugins`, naming a provider
package `@magpie-community/opencode-sensenova-auth`, and the entry added looks like the others:

```json
{
  "package": "@magpie-community/opencode-sensenova-auth",
  "name": "SenseNova",
  "icon": "sensenova",
  "providers": ["sensenova"],
  "community": true,
  "summary": {
    "en": "SenseNova Token Plan models, with the console's credit quota reported as native quota windows.",
    "zh": "接入商量/日日新 Token Plan 模型，并把控制台积分额度上报成原生额度窗口。"
  }
}
```

Note `icon` here is a short name (the entries use `opencode`, `zcode`, `qoder`…), not the URL that
`magpie.icon` takes. Two benefits come with it: pushing a version bump to `main` publishes it, and the
package then **auto-updates in every Magpie** instead of users re-installing. This repository has **zero
dependencies**, so moving it there needs no code changes — but it does mean the package is developed inside
someone else's repository, which is why it is not done here by default.

The list is fetched at most every six hours, and Magpie ships a built-in copy as a fallback.
`MAGPIE_PLUGIN_MARKET=<url>` swaps in another list (`off` means use only the built-in copy).

The `repository` / `homepage` / `bugs` fields in `package.json` point at `XTsat/magpie-sensenova`, and the
repository carries the `magpie-plugin` topic, so it is discoverable through route 1 today. Routes 2 and 3
are opt-in and not done.

---

### Development

```bash
node --test test/*.test.mjs
```

52 tests cover: mapping pools to windows (including the `used` percentage, `amount`, `limit`, `span`,
`resetsAt`, the dedicated pool's model scoping, and the granted balance); that `limit - amount`
reproduces the console balance; that a window with an unknown usage is skipped rather than reported as
zero; degradation when fields are missing; JWT expiry; refresh-token renewal; the error raised when
there are no credentials; the `fetch` hook preserving the body and headers for both `(url, init)` and
`Request` inputs; that internal `__`-prefixed keys never reach the credentials file; both envelopes for
model normalization; that every string in the table is `中文 / English`, that the two halves carry the same
keys, that a string identical in both languages is written only once, and that the table has no `locale`
entry; that a pool's English half follows the console's own naming and that the dedicated-pool rule is
never applied to the shared pool; that `accountNameOf` reads the token and yields nothing rather than
inventing a name; that the account prompt is declared under the `email` key and that `consoleAuthOf` still
reads the older `username`/`account` spelling; the `usage` hook end to end, with its bilingual window names,
unit and balance; and the package metadata Magpie reads — that it declares no in-app UI or panel and no
example options.

No network, browser or real credentials are involved: outbound calls are stubbed.
