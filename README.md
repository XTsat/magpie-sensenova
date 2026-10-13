# magpie-sensenova

[Magpie](https://usemagpie.ai) 的 **SenseNova（商量 / 日日新）** 供应商插件：
把 Token Plan 的模型接进来，并把控制台里的**积分额度**上报成 Magpie 原生的额度窗口。

```
$ magpie quota
sensenova  通用积分池 · 5 小时窗口   0% used ↻ 2h  ·  Flash-Lite积分池 · 5 小时窗口  22.8% used ↻ 2h
```

---

## ⚠️ 安全须知（请先读这一节）

**本插件是本机第三方客户端，与商汤无隶属关系。下面每一条都标注了依据：标注「实测」的是对真实 API 的观察，标注「代码」的是控制台前端代码里的原文。**

### 1. 它会存两套凭据，第二套权限很大

| 凭据 | 存到哪 | 字段 |
| --- | --- | --- |
| API Key | `~/.config/magpie/plugin-auth.json` | `key` |
| 账号 + 密码（如果填了） | 同一文件 | `metadata.username` / `metadata.password` |
| 控制台 access/refresh 令牌 | 同一文件，或 `~/.sensenova-quota.json` | `access` / `refresh` |

**账号密码不只能读额度。** 用它可以登录 SenseNova 控制台、创建和删除 API Key、以及做账号下的一切操作。填进插件就等于把这个能力交给了 Magpie 的配置文件——这是本插件要求的最重的一项授权，不填也能正常用（见第 5 条）。

### 2. 密码是明文存储的

**内容没有加密**，是明文 JSON。这一点和平台无关。

至于「谁能读到」，别指望文件权限兜底。Linux/macOS 上 Magpie 按 600 创建（只有你自己可读），但 Windows 上实际拿不到这个保护——实测这台机器上 `plugin-auth.json` 和 `~/.sensenova-quota.json` 的有效模式都是 `666`，`ls -l` 显示的 `-rw-r--r--` 是 Git Bash 合成出来的假象。真实 ACL 是这样的：

```
<你的账户>              FullControl
<某个本地用户组>        Modify        ← 不止你一个人能读
NT AUTHORITY\SYSTEM     FullControl
BUILTIN\Administrators  FullControl
```

也就是说，同一台机器上任何以你的身份、或属于那个用户组运行的进程，都能读到密码。**密码的安全边界等于「这台机器上所有本地进程」，不等于「只有你」。**

所以实际的建议是：别把这两个路径放进云同步目录、备份任务或 dotfiles 仓库。密码一旦跟着备份走了，它走的是明文的。

### 3. 密码是明文传输的，和浏览器不一样

这一条是**实测**的。控制台登录页的代码是这样的：

```js
// 能取到 JWKS 时，先用服务器公钥把密码加密再提交
if (s) { let t = await U(s, e.password); t && (r = t, a = !0) }
await h.bK({ username: e.username, password: r, challenge: t, is_encrypt: a })
```

浏览器发的是 `is_encrypt: true` + RSA-OAEP（JWE，`alg: RSA-OAEP, enc: A256GCM`）密文；**本插件直接发明文（`is_encrypt: false`）**，实测服务端同样接受。

两者最终服务端都能拿到明文（它本来就要拿明文去校验），差别在**链路暴露面**：HTTPS 仍然保护传输，但任何能看到 TLS 明文的东西——企业代理、抓包工具、带请求体的日志——都能看到密码。如果你在这种环境里，别填密码。

### 4. 密码基本不会被用到

续期顺序是 `refresh_token` → 会话 cookie → 账号密码，**任一步成功就不会往下走**。只要 refresh_token 还活着，密码一次都不会被发送。它只是 refresh_token 失效后的兜底。

### 5. 不想存密码就别填

登录时的账号和密码两栏都可以留空。留空时插件退回去读 `~/.sensenova-quota.json`（由 `snquota` 命令行写入），那份配置里通常有 refresh_token，够用。

### 6. 它只和三个域名通信，没有遥测

| 域名 | 用途 | 发送什么 |
| --- | --- | --- |
| `token.sensenova.cn` | 模型请求 | API Key |
| `platform.sensenova.cn` | 读积分额度 | 控制台令牌 |
| `iam.sensecoreapi.cn` | 续期控制台令牌 | 账号密码（仅第 4 条说的兜底场景） |

除此之外不向任何地方发送数据，不读其它供应商的凭据，不改 Magpie 之外的配置，也不创建或删除 API Key（虽然控制台令牌有这个权限，插件只调读取额度的那个接口）。

额度读取默认缓存 60 秒（`quotaTtlMs`），避免 `usage` 被轮询时把接口刷爆。

### 7. 额度接口是控制台内部接口，不是公开 API

`platform.sensenova.cn/lite/console/v1/tokenplan/pool-usage` 是**控制台自己的前端**用来画「积分额度」面板的接口（代码原文：`window.location.origin + "/lite"` 拼出来的路径）。它未公开、可能随时变更或消失。

之所以走这条路，是因为平台**没有提供任何 API Key 可访问的额度接口**——实测 `/v1/llm/usage`、`/v1/llm/quota`、`/v1/llm/balance`、`/v1/dashboard/billing/subscription` 等十几个候选路径全部返回 404。

**用这种方式访问是否在平台服务条款允许范围内，请自行确认。** 本插件不改变也不规避任何条款。

### 8. 它不做的事

- 不申请、不轮换、不撤销你的 API Key。
- 不改你的 SenseNova 账号设置。
- 不代理、不记录你的模型请求内容——请求由 Magpie 的网关直连 Token Plan，插件只加了 `Authorization` 头。
- 不缓存任何提示词或响应。

---

## 两件事，一个包

平台把这两样东西放在了完全不同的地方，所以插件同时做两件事：

| | 地址 | 鉴权 |
| --- | --- | --- |
| **模型调用** | `https://token.sensenova.cn/v1`（OpenAI 兼容） | API Key |
| **积分额度** | `https://platform.sensenova.cn/lite/console/v1/tokenplan/pool-usage` | 控制台 OAuth 令牌 |

**没有任何 API Key 可访问的额度接口。** 我逐个探过 `/v1/llm/usage`、`/v1/llm/quota`、`/v1/llm/balance`、`/v1/dashboard/billing/subscription` 等十来个候选路径，全部返回 404；额度只存在于控制台自己的接口里，而那需要 Ory 的 Bearer 令牌。所以这两个凭据是**真的彼此独立**，插件在登录时一起收集。

---

## 额度上报到哪

Magpie 的插件系统**不允许插件添加面板或页面**，也没有任何东西能往「用量-概览」这个分析页里塞内容——那是 Magpie 自己的请求计量驱动的。

插件能用的唯一额度通道是 `auth.usage`。它返回的内容会出现在三个地方：

- 供应商里的**账号行**上
- `magpie quota`
- 网关的 `GET /v1/magpie/quotas`

好消息是 Magpie 的额度模型和 SenseNova 的数据几乎一一对应，所以信息不会丢：

| SenseNova | Magpie |
| --- | --- |
| 通用积分池 5 小时窗口（`window_5h`） | `windows[]` 一项，`span: 18000` |
| 通用积分池本周（`window_7d`） | `windows[]` 一项，`span: 604800` |
| 池覆盖哪些模型（`model_ids`） | `models[]`（语义是「恰好这些 id」） |
| 套餐名（`plan.name`，实际是 `Free Plan`） | `plan` |
| 活动固定积分总量余额（`grant_balance`） | `balance` |
| 窗口重置时间（`reset_at`） | `resetsAt`（秒级时间戳） |

模型归属直接用服务器给的 `model_ids`，不按名字猜——专属池的 `model_ids` 就是 `["sensenova-6.7-flash-lite","sensenova-6.8-flash-lite"]`，比任何关键词匹配都准（只有拿不到 `model_ids` 时才退回按 `flash-lite` 匹配）。套餐名同理，用接口返回的 `plan.name`。

### ⚠️ `amount` 是必须的，文档里没写

每个窗口除了 `used`（已用百分比）和 `limit`（配额），还必须给 **`amount`（已用数量）**。

这是踩过的坑：只给 `used` 和 `limit` 的话，百分比是对的，但界面上的数量会显示成 `0 / 600000` —— 看起来和真实余额完全对不上。原因是 Magpie 的界面按「已用 / 配额」渲染，并且有「已用 | 剩余」的切换，两边都从 `amount` 算；缺了它就只能按 0 处理。

这个字段**没有出现在插件文档的窗口字段列表里**（文档只列了 `name`/`used`/`resetsAt`/`resetSecs`/`span`/`display`/`model`/`models`/`notModels`/`aside`）。我是从两个社区插件的实现里对出来的——`@magpie-community/opencode-workbuddy-auth` 和 `opencode-zcode-auth` 都设了它，后者的注释也写明了用途：

> the count is told carries it as **amount of limit**, so magpie's card says …

所以本插件给的每个窗口是：`used`（百分比）、`amount`（已用数量）、`limit`、`unit`、`display`、`span`、`resetsAt`，专属池再加 `models`。`display` 按 Magpie 自己的紧凑写法（`compact()`，整数给整数、否则两位小数）生成，和 `amount`/`limit` 并排渲染时格式一致。

对账方式很简单：`limit - amount` 必须等于控制台显示的「本周余额」。实测四个窗口全部精确相等。

---

## 安装

```bash
magpie plugin add <本仓库路径>
magpie plugin login sensenova
```

登录时会问三件事：

1. **SenseNova API Key**（必填）——控制台 → API-Key 管理。没有它这个供应商发不出任何请求。
2. **账号**（选填）——用来读控制台积分额度。
3. **密码**（选填）——同上。

后两项留空也没关系：插件会退回去读 `snquota` 命令行工具写在本机的 `~/.sensenova-quota.json`。

### 关于那两项控制台凭据

额度接口要的是控制台令牌，而令牌约 2.4 小时过期。插件内部实现了三条续期路径，按可靠性排序：

1. `refresh_token`（标准续期）
2. 浏览器会话 cookie（重放授权码 + PKCE 流程）
3. 账号密码（完整自动登录，含 `login_challenge` → 校验 → 提交 → 跟随跳转 → 换令牌）

如果你已经在用 [snquota](https://github.com/) 命令行，直接让插件读那份配置最省事，两条命令都能用同一份凭据：

```bash
snquota login --username 你的账号 --password 你的密码 --save-password
```

**密码是明文存在 `plugin-auth.json` 里的**（存储和权限的细节见上面第 2 条）。不接受的话就别填密码，改用 cookie 或让插件读 snquota 的配置。

---

## 配置

`plugins.json` 里这一项的 `options`：

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

| 选项 | 默认 | 说明 |
| --- | --- | --- |
| `baseURL` | `https://token.sensenova.cn/v1` | Token Plan 地址 |
| `quotaTtlMs` | `60000` | 额度缓存多久。`usage` 会被轮询，缓存是为了别把额度接口刷爆 |
| `scopeModel` | `flash-lite` | 专属积分池用哪个关键词限定模型 |
| `credentialsFile` | `~/.sensenova-quota.json` | 控制台凭据的位置 |

---

## 额度和 Key 的关系：额度是账户级的

**积分额度不按 API Key 分开，同账户所有 Key 共享同一个池。**

三条证据：

1. 控制台自己的横幅就写着「**同账户所有 Key 共享**」。
2. `pool-usage` 的响应里**完全没有 Key 维度**——顶层只有 `{plan, pools}`，每个池的字段是 `id`/`name`/`model_ids`/`window_5h`/`window_7d`/`grant_balance`/`pool_type`，没有任何 key 标识。插件拿到的就是账户级的数字。
3. 按 Key 的拆分存在于另一个地方：**使用明细**。`/console/v1/metered/usage-records` 支持按 `apiKey` 筛选（页面代码里有 `apiKeyValuesById` 和 `t.apiKey === a.apiKey`），每条调用记录带 Key，还能导出 CSV / Excel。

所以是两层不同的东西：

| | 维度 | 说明 |
| --- | --- | --- |
| **积分池（本插件显示的）** | 账户级 | 同账户所有 Key 共享；Key 只是入口，不各自记账 |
| **使用明细** | 逐条记录 | 每条带 Key，可按 Key 拆分和导出 |

### 对 Magpie 的实际影响

供应商卡片标题写的是「API key …HohJ」，但它显示的额度是**账户级**的。所以：

- 把**同一个 SenseNova 账户的两个 Key** 都加进 Magpie，两行会显示**完全相同的数字**。
- Magpie 那句「前一个额度用完自动换下一个」在这种情况下会失效——它会以为每个 Key 各有独立的 600,000 额度，实际它们共用一个池。**加 Key 不会多出额度。**
- 想要更多额度只能是**不同的 SenseNova 账户**。

---

## 图标

用的是平台自己的图标：`assets/sensenova.png` 就是 `https://platform.sensenova.cn/favicon.ico` 的原始字节。那个地址虽然叫 `.ico`、响应头也写着 `image/x-icon`，但内容其实是一张 65×65 的 PNG，所以 data URI 按真实字节声明成 `image/png`。

图标**内置而不是引用 URL**：这样离线也能认出来，也不依赖平台继续提供这个文件。`package.json` 里的 `magpie.icon` 仍然指向那个地址，供将来发到 npm 后的「发现」卡片使用。

---

## 模型

内置快照里的 4 个 id 不是我编的，是平台自己的用量报表真正吐出来的（`credit-usage-trend` 的 `series[].model_id`）：

- `sensenova-6.8-flash-lite`（多模态）
- `deepseek-flash`
- `glm-5.2`
- `kimi-k3`

登录后 `provider.models` 会用 API Key 去 `GET /v1/models` 拉实时清单（这个端点是存在的，无 key 返回 401 而不是 404），拉到就用实时的，拉不到就回落并打上 Magpie 的回落标记。Magpie 还会把它自己 models.dev 里的 `sensenova` 条目合并进来，实测多出 `deepseek-v4-pro`、`deepseek-v4-flash` 两个 1M 上下文的模型。

上下文长度和输出上限在平台公开文档里查不到，内置快照里用的是保守占位值；实时清单若带元数据会覆盖它们。

---

## 已知边界

- **额度只在账号行 / `magpie quota` / `/v1/magpie/quotas` 三处出现**，塞不进「用量-概览」。这是 Magpie 的设计，不是本插件没做到。
- 控制台令牌过期后如果三条续期路径都失效（refresh_token 被撤销、cookie 过期、密码错），账号行会显示一条 `error`，提示重新登录。
- 额度接口是控制台内部接口，不是公开 API，改版可能失效。
- 模型能力字段（上下文长度等）在没有实时清单时是占位值。

---

## 作为插件分发（提交到 GitHub 之后）

仓库推到 GitHub 还不会自动出现在 Magpie 里。按官方文档，插件通过三条路被发现，可以只走一条：

**1. GitHub topic（最省事）**

给仓库打上 `magpie-plugin` 这个 topic，就会出现在 Magpie 的 Plugins → Discover → **unofficial plugins** 里，按 star 排序，并标注为「未审核」。要求：

- `package.json` 必须在**仓库根目录**（本仓库满足）。
- 如果同时发布到了 npm 且 `repository` 指向该仓库，安装走 npm；否则直接装仓库当前代码，所以**加载的文件必须已提交**（本仓库是纯源码，没有构建产物，满足）。
- fork、归档仓库、`magpie-community` 自己的仓库会被排除。
- GitHub 最多每 10 分钟轮询一次，打完 topic 几分钟内可见。

**2. npm**

插件浏览器会拿关键词 `<关键词> opencode` 去搜 npm，命中条件是包名或 keywords 里**同时**含有 `opencode` 和 auth / plugin / provider 之一。本仓库的 keywords 已经带上了 `opencode`、`opencode-plugin`、`opencode-auth`，满足条件。普通插件**不要求任何 scope**，`@magpie-community/` 只用于收进官方社区仓库的包。

**3. 进推荐列表（`registry.json`）**

向社区仓库提 PR，在 `registry.json` 里加一条：

```json
{
  "package": "magpie-sensenova",
  "name": "SenseNova",
  "icon": "https://platform.sensenova.cn/favicon.ico",
  "providers": ["sensenova"],
  "summary": "商量/日日新 Token Plan 模型，并把控制台积分额度上报成原生额度窗口"
}
```

这个列表最多每 6 小时拉一次，Magpie 内置了一份快照作为兜底。也可以用 `MAGPIE_PLUGIN_MARKET=<url>` 换成自己的列表（`off` 表示用内置的）。

> 想让插件自动跟随更新（推新版本就自动发到所有 Magpie），得走社区包路线：在 `magpie-community/plugins` 的 `packages/<name>` 下贡献，供应商包命名为 `@magpie-community/opencode-sensenova-auth`，并且尽量避免运行时依赖。本仓库目前**零依赖**，迁过去不需要改代码。

**当前状态**：本地仓库已提交，尚未推送到 GitHub、未发布到 npm、未打 topic。`repository` / `homepage` / `bugs` 三个字段都已按 `aqiu817/magpie-sensenova` 填好，推送后即可直接使用。

---

## 开发

```bash
node --test test/*.test.mjs
```

20 个单测覆盖：额度池到窗口的映射（含 `used` 百分比、`amount` 已用数量、`limit`、`span`、`resetsAt`、专属池的模型限定、固定积分余额）、`limit - amount` 能还原控制台余额、字段缺失时的降级、JWT 过期判断、refresh_token 续期、无凭据时的报错，以及模型规范化的两种信封。
