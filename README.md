# magpie-sensenova

**中文** ｜ [English](https://github.com/XTsat/magpie-sensenova/blob/main/README_en.md)

这是 [Magpie](https://usemagpie.ai) 的 **SenseNova**（商量 / 日日新，商汤）provider 插件。装上之后，你可以在 Magpie 里直接用 SenseNova Token Plan 的模型，并在账号行与 `magpie quota` 里看到控制台的积分额度，不用另开网页。装完执行 `magpie plugin login sensenova`（填 API Key，可选填账号与密码以显示额度）即可开始使用。

额度出现在账号行、`magpie quota` 与网关的 `GET /v1/magpie/quotas` 三处（窗口名与单位中英并列，见下例）。本插件在你的机器上存了什么、会连哪些主机、有哪些已知风险，见下方「⚠️ 隐私与安全须知」。

```
$ magpie quota
sensenova  通用积分池 · 5 小时窗口 / General Pool · 5h window   0% used ↻ 2h  ·  Flash-Lite积分池 · 本周 / Flash-Lite Dedicated Pool · This week  22.8% used ↻ 2h
```

*（池名由控制台返回；英文半沿用控制台英文站自己的命名：**General Pool**、**Flash-Lite Dedicated Pool**、**credits**。）*

---

## 额度出现在哪里

额度只会出现在三处：provider 的**账号行**、`magpie quota`、网关的 `GET /v1/magpie/quotas`。它不会进入 Magpie 的用量总览——那个页面由 Magpie 自己的请求计量驱动，插件写不进去。

窗口里的百分比、已用数量与上限取自控制台同一份数据，卡片上的「已用 / 上限」与控制台显示的一致；取不到的窗口宁可跳过，也不会显示成 `0 / 上限`。

## 安装

```bash
magpie plugin add github:XTsat/magpie-sensenova
magpie plugin login sensenova
```

也可以把仓库路径直接交给 `magpie plugin add <path to this repository>`。

登录会先让你选一种方式把控制台账号交出来（读额度用），两种都通向同一件事：

1. **填账号密码**——账号填了会显示在账号行上；密码输入时不回显，且明文存在本机凭据文件里（见「隐私与安全须知」）。两项都可以留空。
2. **浏览器登录**——密码不用交给插件：网页版会直接替你把控制台的授权页打开，登录完浏览器会落到一条 `https://platform.sensenova.cn/?code=…` 地址——落地后页面很快会自己刷新、地址会被清掉，要立刻复制整条地址粘回提示框；没赶上的话点提示框下面的「重新打开」再来一遍就行。命令行下没有浏览器可开，插件会打印这条地址让你自己打开，然后等一个 `Code:`。

两种方式都要 **API Key**（必填，输入时不回显）——在控制台 → API-Key 管理里创建。没有它，provider 发不出任何请求；第 2 种方式先问 API Key，再开浏览器。

第 1 种方式两项留空没问题：插件会改读 `~/.sensenova-quota.json`，那是本机 `snquota` CLI 写的配置。第 2 种方式换到的控制台 token 也写进同一个文件，下次读额度直接用。

浏览器登录成功后会更新这个控制台账号原来那一行：写入你填的 API Key 与控制台 token，账号行按控制台账号名显示。这一行之前用第 1 种方式存下的密码不会保留——还要它做续期兜底的话，回头再跑一次第 1 种方式即可。

浏览器登录为什么要把地址粘回来：控制台的登录客户端只登记了 `https://platform.sensenova.cn` 这一个回调地址，`http://127.0.0.1:<端口>` 会被直接拒（实测），插件没法自己把浏览器跳转接回来。

### Windows 下登录提示失败

Magpie 的提示读取器需要一个真正的 Windows 控制台。从不给它的 shell 启动——Git Bash / mintty 是常见情况——第一个提示就会这样失败：

```
magpie: read /dev/stdin: The handle is invalid.
```

这是 Magpie 宿主自己在读标准输入，不是本插件的问题，任何用文本提示的插件都一样。两种绕法：

**改在命令行里答。** 管道输入可用，答案按提示顺序读取——先一个方式序号（`1` 账号密码 / `2` 浏览器登录），再是该方法要的内容，最后 API Key（第 2 种方式先 API Key，再粘 `?code=…` 那条地址）。下面是最常见的第 1 种方式（序号、账号、密码、API Key），末尾那行 `.` 很关键：读取器要在最后一个提示前用完输入，否则先报 EOF。

```bash
printf '1\n%s\n%s\n%s\n.\n' "$ACCOUNT" "$PASSWORD" "$SENSENOVA_API_KEY" | magpie plugin login sensenova
```

选第 2、3 种方式时只有一行粘贴内容：`printf '3\n%s\n%s\n.\n' "$COOKIE" "$SENSENOVA_API_KEY"`。

**或者用 Magpie 应用自带的登录界面**，它不经过 CLI 的读取器。

## 配置

`plugins.json` 中该条目的 `options`：

```json
{
  "baseURL": "https://token.sensenova.cn/v1",
  "quotaTtlMs": 60000,
  "scopeModel": "flash-lite",
  "credentialsFile": "~/.sensenova-quota.json"
}
```

| 选项 | 默认值 | 含义 |
| --- | --- | --- |
| `baseURL` | `https://token.sensenova.cn/v1` | Token Plan 地址 |
| `quotaTtlMs` | `60000` | 额度读取的缓存时长（毫秒）。额度会被轮询，缓存避免把控制台端点打爆 |
| `scopeModel` | `flash-lite` | 专属池没有给出模型清单时，用来匹配模型的关键词 |
| `credentialsFile` | `~/.sensenova-quota.json` | 控制台凭据所在文件（只改写入位置，不能关掉回写，见安全须知第 1 节） |

## 模型

内置快照包含四个模型，取自平台自己的用量报告：

- `sensenova-6.8-flash-lite`（多模态）
- `deepseek-flash`
- `glm-5.2`
- `kimi-k3`

登录后插件会向平台拉一次当前可用的模型列表：拉到就用列表，拉不到就用上面的内置快照。Magpie 还会合并它 models.dev 里的 `sensenova` 条目，实际会多出 `deepseek-v4-pro` 与 `deepseek-v4-flash` 两个 100 万上下文的模型。

上下文长度与输出上限平台没有公开发布，内置快照用的是保守占位值；带元数据的可用列表会覆盖它们。

## 额度按账户计算

**积分额度不按 API Key 拆分：同一账号下的每个 Key 共用一个池。** 控制台自己写着「同账户所有 Key 共享」，额度数据里也没有 Key 这个维度；按 Key 的拆分在控制台的**用量记录**页，那里每条调用记录带自己的 Key，可以按 Key 筛选并导出 CSV 或 Excel。

这对 Magpie 意味着：

- 同一账号下加两个 Key，两行显示**完全相同的数字**。
- Magpie「一个用完就切下一个」的行为在这里失效——它假设每个 Key 各有额度，实际共用一个池。**多填 Key 不会多额度。**
- 想要更多额度，只能换**另一个 SenseNova 账号**。

## 已知限制

- **额度只出现在三处**——账号行、`magpie quota`、`/v1/magpie/quotas`——无法进入用量总览。这是 Magpie 的设计，不是本插件没做到。
- 控制台 token 过期且三条续期路径都失败（refresh token 被吊销、cookie 过期、密码错误）时，账号行会显示一个 `error`，要求重新登录。
- 额度读的是控制台内部 API 而非公开 API，平台改版可能让它失效（模型调用不受影响）。
- 没有可用的模型列表时，模型能力字段（上下文长度等）是占位值。
- 窗口名与错误行中英并列，长度约为单一语言的两倍，且无法只显示一种语言。

## ⚠️ 隐私与安全须知

**本插件是本地第三方客户端，与商汤没有隶属关系。** 下面九节说明它在你机器上存什么、发往哪些主机、谁能看到；标「实测」的是对真实环境的测量。

### 1. 存了什么，存在哪里

| 凭据 | 存在哪 | 能做什么 |
| --- | --- | --- |
| API Key | `~/.config/magpie/plugin-auth.json` 的 `key` | 调用 Token Plan 模型 |
| 账号 + 密码（仅当你提供） | 同一文件的 `metadata.username` / `metadata.password` | **整个账号** |
| 控制台 token | 同一文件的 `metadata`，或 `~/.sensenova-quota.json` | 读额度、续期 token |
| 会话 cookie（本来就写在那个文件里时） | 同上 | 不用密码换控制台 token |
| 用「浏览器登录」换到的控制台 token | `~/.sensenova-quota.json` | 读额度、续期 token |

**账号密码能做的远不止读额度。** 它能登录 SenseNova 控制台、创建和删除 API Key，以及该账号能做的一切。把它交给插件，等于把整个账号交给 Magpie 的凭据文件——这是本插件请求的最重权限。**留空完全可用**（见第 5 节）。

账号和密码只有两种来源，且都经过同意：你在登录提示里输入的内容，或你之前用 `snquota login --save-password` 存进 `~/.sensenova-quota.json` 的内容。**插件不从浏览器、系统钥匙串或其它 provider 的登录里扒凭据**，也不写 SenseNova 服务端的任何凭据设置。

本地文件有两处会被写，都指向同一个 `~/.sensenova-quota.json`：一是用「浏览器登录」时，换到的 token **当场写进该文件**——Magpie 每个账号只存一份凭据，那份装的是 API Key，控制台 token 没有别的地方可放；二是凭据本来就来自该文件时（也就是你没填账号、走了登录的第 2 种方式或直接留空），续期 token 后插件会把新 token **写回该文件**，免得 CLI 手里那份过期。后者的条件是「登录时既没给账号也没给 cookie」——任给其一就不会回写。

### 2. 密码是明文存储的

**内容没有加密，就是明文 JSON。** 也别指望文件权限兜底：在 Linux 和 macOS 上 Magpie 会把它建成 600（仅你可读），但 Windows 上这层保护实际不生效——本机实测两个文件的有效权限都是 `666`，`ls -l` 显示的 `-rw-r--r--` 是 Git Bash 的伪装，真实 ACL 里同组用户拥有修改权限。

也就是说，**密码的安全边界是「本机所有本地进程」，不是「只有你」**。实用建议：把这两条路径排除在云同步目录、备份任务和 dotfiles 仓库之外——密码一旦随备份走，就是明文在旅行。

### 3. 密码是明文传输的

浏览器登录时，控制台前端会先用服务端公钥加密密码（`is_encrypt: true`，RSA-OAEP）。**本插件发的是明文**（`is_encrypt: false`）——实测服务端接受，且不强制加密。

两者最终在服务端都是明文（校验密码需要明文），区别在路径上暴露的环节：HTTPS 仍保护传输，但能看到 TLS 明文的环节——企业代理、抓包、请求体日志——都能看到密码。如果你在这样的环境里，不要填密码。

### 4. 密码几乎不会被用到

续期顺序是 `refresh_token` → 会话 cookie → 账号密码，**第一步成功即止**。只要 refresh token 还活着，密码根本不会被发送，它只是最后手段。

### 5. 不想存密码就留空

登录时的账号栏和密码栏都可以留空，三种用法及各自代价：

| 做法 | 会落到哪 | 适合谁 |
| --- | --- | --- |
| **只填 API Key** | 只有 `key` | 只想调模型、不在意额度显示 |
| **账号和密码留空** | 插件读 `snquota` 写的 `~/.sensenova-quota.json`（通常含 refresh token） | 想看到额度，但不愿把账号密码交给 Magpie |
| **填写账号** | 明文写进 `plugin-auth.json` | 没有别的 token 来源，且接受第 1、7 节的风险 |

两栏都留空、该配置文件也不存在时，额度会报一个要求重新登录的错误——**两种情况都不影响模型调用。**

### 6. 会连哪些主机

默认部署（`platform.sensenova.cn`）下有三台：

| 主机 | 用途 | 发送什么 |
| --- | --- | --- |
| `token.sensenova.cn` | 模型请求、模型列表 | API Key |
| `platform.sensenova.cn` | 读额度；图标地址也在这 | 控制台 token |
| `iam.sensecoreapi.cn` | 续期控制台 token | 账号和密码（仅第 4 节的后备情形） |

源码里还有第四台 `iam.sensecoreapi.tech`：它属于另一个部署 `nova.sensecore.tech`，只有账号属于那个部署时才会用到。在 `platform.sensenova.cn` 上不会出现。

除此之外不往任何地方发东西——没有遥测、没有上报、没有第三方 SDK。它**不读其它 provider 的凭据**（技术上能读同一个 `plugin-auth.json`，见第 7 节；重点是代码不这么做），不碰 Magpie 之外的配置，也不创建或删除 API Key。

### 7. Magpie 与其他插件能看到什么

Magpie 官方文档的 FAQ 写着：插件能看到它所发请求里的一切——对话、工具调用及其结果。**本插件是 provider 插件，就坐在请求路径上**，所以按能力说，它处在能看到你整段对话的位置。

代码实际做的是：只改写请求里的 `authorization` 头，把凭证换成当前的 API Key；不读请求体，不把内容写到任何地方，不缓存 prompt 或响应，也不往第 6 节名单以外的主机发送。**但这是代码在自我克制，不是平台给的隔离**——只能靠读代码确认，Magpie 无法为你保证。

Magpie 插件机制的三条事实决定了这份克制值多少：

- **插件没有沙箱。** 插件是跑在 Magpie 进程里的普通代码，能读文件。Magpie 文档正是因此建议给 Magpie 单独的 HOME 或沙箱。
- **插件没有审核。** 从 GitHub topic 安装的插件，Magpie 明确标注为无人审核；本插件同样是不受审查的第三方代码。
- **所有插件的凭据都在一个文件里。** `plugin-auth.json` 装着每个 provider、每个插件的登录信息。既然插件无沙箱又能读文件，**你装的任何其它插件都能读到本插件存在这里的账号密码**——这是决定「要不要填密码」时最重要的一条，机器上有来源不明的插件就留空（见第 5 节）。

本插件在 Magpie 的页面里什么都不渲染，可见输出只有额度窗口和它返回的错误文案，两者都在 Magpie 自己的 UI 里。Magpie 自己会读 `plugin-auth.json`（管理登录）、`plugins.json`（插件及其选项）和 `plugin-providers.json`（最近列出的 provider 与模型）；插件详情页展示的就是这份文档，所以它是本插件唯一的披露面。

### 8. 风险声明：额度端点是控制台内部 API

额度数字由控制台主机上的一个端点提供，控制台自己的前端用它画积分面板。它没有文档，随时可能变化或消失；具体路径不在本文档公开。

存在这条路由，是因为平台**没有 API Key 可访问的额度端点**——实测在公开主机上逐个试了十几个候选路径，全部 404。

风险不止「它可能坏掉」：

| 风险 | 意味着什么 |
| --- | --- |
| **可能违反服务条款** | 该端点是控制台前端自己的，不是承诺的 API。脚本化访问是否被允许由平台判定，**请自行确认**；本插件不改变也不绕过任何条款。 |
| **可能突然失效** | 无文档端点没有兼容承诺，改版、加签名、限流都可能让它变成 404 或 403，届时额度显示会报错（模型调用不受影响）。 |
| **可能触发滥用控制** | 自动登录加周期性读额度，在服务端看来像非常规客户端。插件已把额度读取缓存 60 秒、把密码降为最后手段，但**无法承诺你不会被标记**。 |
| **扩大凭据暴露** | 访问该端点需要持有控制台 token（可选地还要账号密码），这部分风险由第 1 到第 7 节覆盖。 |

四条里只有第一条需要你判断——技术上的几条插件能扛，合规的不能。**如果这让你不安，就别用额度功能**：只填 API Key 时，插件退化成纯模型 provider，永不触碰控制台 API，第 2 到第 4 条风险也随之消失。

### 9. 它不做什么

- 不请求、轮换或吊销你的 API Key。
- 不修改你的 SenseNova 账号设置。
- 不读取、不记录、不转发你的模型请求内容——它只改写 `authorization` 头，把请求体原样转发给 `token.sensenova.cn`。
- 不缓存 prompt 或响应。
- 不写 SenseNova 服务端的任何凭据设置。
- 不在 Magpie 里渲染自己的 UI，也没有语言设置：每段文字都固定中英并列。
- 不回写 `~/.sensenova-quota.json`，**除非**凭据来自该文件且续期过 token（见第 1 节末尾）。
