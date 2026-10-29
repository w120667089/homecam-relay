# 家用监控 · 中继服务器

这是「家用监控」两个 App（**摄像端** / **查看端**）背后的中转服务器。
两端手机都只和这台服务器建立 WebSocket，由它转发视频帧与控制指令，
因此**不需要公网 IP、不需要路由器端口映射、国内网络也能稳定连通**。

> 视频只在两端之间实时转发，**服务器不存储任何画面**。

---

## 我（AI）已经帮你准备好的

- `server.js`：中继核心，纯转发，内存占用极低
- `package.json`：含 `start` 脚本、`ws` 依赖、声明 `node >= 18`
- `render.yaml`：**一键部署配置**（含健康检查 `/healthz`、free 套餐）
- `test_relay.js`：本地自检脚本（`node server.js &` 后跑它，应输出 PASS）

你**不需要**改任何代码，也不用敲构建命令。

---

## 部署到 Render（免费 · 长期可用 · 推荐）—— 约 3 分钟

> 为什么选 Render：免信用卡、原生支持 WebSocket、免费 750 小时/月、部署全自动。
> 唯一缺点：免费服务**空闲 15 分钟会休眠**，下次访问约 1 分钟冷启动唤醒（家庭监控偶尔看一眼完全够用）。

### 你需要做的（3 步，注册那步只能本人）
1. **注册 Render**：打开 https://render.com → 用邮箱注册（免费，无需信用卡）。
2. **把代码传到 GitHub**：
   - 在 GitHub 新建一个**空仓库**（如 `homecam-relay`）。
   - 把本目录（`relay/`）下的文件上传进去：可以直接在 GitHub 网页「Add file → Upload files」拖拽 `server.js / package.json / package-lock.json / render.yaml` 这四个文件即可（无需上传 `node_modules`、`README`）。
3. **一键部署**：
   - Render 控制台 → **New → Web Service** → 选你的 GitHub 仓库。
   - Render 会自动读取 `render.yaml`，你**什么都不用配**，直接点 **Create Web Service**。
   - 等约 1 分钟，状态变绿，会给你一个固定地址，形如：
     `https://homecam-relay.onrender.com`

### 部署完成后，在手机 App 里填地址（不用重装）
- 打开「摄像端」或「查看端」App → 右上角 **⚙ 中继服务器设置**
- 填：`wss://你的地址`（把 `https` 换成 `wss`，例如 `wss://homecam-relay.onrender.com`）
- **两端都填同一个地址** → 保存

---

## 备选方案（如果你受不了“休眠”）

| 平台 | 特点 | 代价 |
|---|---|---|
| **Northflank** | 免费 Sandbox **2 个服务永不休眠**，支持 WebSocket | 需绑信用卡验证（不扣费） |
| **Oracle Cloud** | **永久免费** ARM VM（4 核 / 24GB），完全自控、永不休眠 | 需绑信用卡；要自己装 Node + 反向代理 + 防火墙 |
| **Railway** | 新账户 $5 信用 30 天，之后每月 $1 | 免信用卡 |

如果选 Northflank / Oracle，告诉我，我给你对应的部署配置和步骤。

---

## 本地调试（你自己的电脑）

```bash
cd relay
npm install
PORT=3000 node server.js
curl http://127.0.0.1:3000/healthz      # 应返回 ok
node test_relay.js                       # 应输出 PASS ✅
```

---

## 常见问题

- **App 显示“连接中 / 正在初始化”一直不动？** 说明连不上中继。检查：① App 里填的中继地址对不对（wss:// 开头）；② 服务器是否在运行（Render 休眠后首次访问要等约 1 分钟唤醒）；③ 手机有没有联网。
- **填 `ws://IP:端口`（无证书）能连吗？** 能，因为 App 内部页面是本地 http，允许明文 ws；但不安全，仅临时测试用。长期请用 `wss://域名`。
- **带宽够吗？** 中转会经过服务器全部视频流量，1 对 1 看 ≈ 一路码率；多人同时看按路数叠加。普通家用监控几十 Mbps 足够。
