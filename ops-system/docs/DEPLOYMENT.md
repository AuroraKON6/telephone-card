# 部署教程

## 0. 当前交付边界

本项目已经完成：

- OpenClaw 多 Agent 架构配置。
- ClaudeCode 替代运行时适配。
- 本地客服 Agent 与外部营销 Agent 的双模型分流规则。
- DeepSeek V4 Flash / Mimo V2.5 Pro 外部 API 预留。
- 172 官方 API 插槽，仅保留契约，不发起真实调用。
- 自主学习触发逻辑与人工审批流程。
- RTX4060 本地部署千问 3.5 9B 的推荐路径。

当前不做：

- 不对接真实 172 API。
- 不购买或绑定域名。
- 不自动发布营销内容。

## 1. 安装 OpenClaw

以 OpenClaw 官方文档为准，先完成 CLI 和运行时安装：

- 安装入口：https://docs.openclaw.ai/install
- 多 Agent 概念：https://docs.openclaw.ai/concepts/multi-agent
- 模型提供商配置：https://docs.openclaw.ai/concepts/model-providers

安装完成后确认：

```powershell
openclaw --version
```

如果 CLI 命令不同，以你安装版本的官方说明为准，然后把 `scripts/start-openclaw.ps1` 里的 `openclaw run --config` 改成对应命令。

## 2. RTX4060 本地部署千问 3.5 9B

RTX4060 常见显存为 8GB，9B 模型建议使用 4-bit GGUF 量化版本。不要直接用 BF16 权重硬跑，否则容易显存不足。

### 2.1 安装 NVIDIA 驱动

```powershell
nvidia-smi
```

能看到 RTX4060 和显存占用即可。

### 2.2 安装 Ollama

下载并安装 Ollama：https://ollama.com/download

确认服务：

```powershell
ollama --version
ollama list
```

### 2.3 准备千问 3.5 9B 量化模型

1. 下载 `Qwen3.5-9B` 的 GGUF 4-bit 量化文件，例如 `Q4_K_M`。
2. 放到：

```text
ops-system/models/Qwen3.5-9B-Q4_K_M.gguf
```

3. 新建 `ops-system/models/Modelfile`：

```text
FROM ./Qwen3.5-9B-Q4_K_M.gguf
PARAMETER num_ctx 4096
PARAMETER temperature 0.4
SYSTEM 你是电话卡娘本地智能客服，只能根据本地知识库回答，不调用外部 API。
```

4. 导入 Ollama：

```powershell
cd "E:\telephone card\ops-system\models"
ollama create qwen3.5-9b-local -f .\Modelfile
ollama run qwen3.5-9b-local
```

### 2.4 验证本地 OpenAI-compatible 接口

```powershell
cd "E:\telephone card\ops-system"
Copy-Item .env.example .env
.\scripts\health-check.ps1
```

如果 9B 量化仍显存紧张：

- 把 `num_ctx` 从 4096 降到 2048。
- 换更小的 4-bit 量化。
- 关闭占显存的软件。
- 暂时改用 7B/8B 本地模型，等显存更大的机器再切回 9B。

## 3. 配置外部营销 API

编辑 `ops-system/.env`：

```env
MARKETING_API_PROVIDER=interactive

DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_THINKING_ENABLED=true
DEEPSEEK_API_KEY=你的 DeepSeek 密钥

MIMO_BASE_URL=https://token-plan-sgp.xiaomimimo.com/v1
MIMO_MODEL=mimoV2.5pro
MIMO_API_KEY=你的 Mimo 密钥
```

当前启动菜单支持两种营销 API：

- `1` DeepSeek V4 Flash
- `2` Mimo V2.5 Pro

两个供应商都按 OpenAI-compatible 入口预留。你稍后给 API 后，只需要把 `.env` 里的 key、base url、model 名称改成官方实际值。

## 4. 统一菜单启动

```powershell
cd "E:\telephone card\ops-system"
Copy-Item .env.example .env
.\scripts\start-ai-ops.ps1
```

命令行会提示：

```text
请选择 172 号卡 AI 运营系统运行时：
1. OpenClaw
2. ClaudeCode

请选择营销运营 Agent 外部 API：
1. DeepSeek V4 Flash
2. Mimo V2.5 Pro
```

你输入 `1` 会走 OpenClaw；输入 `2` 会走本地 ClaudeCode：

```text
E:\telephone card\claude-code-rev-main (2)deepseek版 - 副本\claude-code-rev-main
```

不管选哪个运行时，整体业务架构都不变：客服仍然是本地千问 3.5 9B，营销才使用外部 API。

## 5. 单独启动

OpenClaw：

```powershell
cd "E:\telephone card\ops-system"
.\scripts\start-openclaw.ps1 -Provider deepseek
.\scripts\start-openclaw.ps1 -Provider mimo
```

ClaudeCode：

```powershell
cd "E:\telephone card\ops-system"
.\scripts\start-claudecode.ps1 -Provider deepseek
.\scripts\start-claudecode.ps1 -Provider mimo
```

只检查命令和配置，不真正启动：

```powershell
.\scripts\start-claudecode.ps1 -Provider deepseek -DryRun
.\scripts\start-openclaw.ps1 -Provider mimo -DryRun
.\scripts\start-ai-ops.ps1 -RuntimeChoice 2 -ApiChoice 1 -DryRun
```

## 6. 连接 172 API 的后续步骤

拿到接口权限后：

1. 在 `.env` 填入 `API_172_USER_ID`、`API_172_SECRET`。
2. 配置 `API_172_CALLBACK_PUBLIC_URL`。
3. 阅读 `openclaw/workspaces/customer-service/tools/172-card-api-adapter.yaml`。
4. 先用沙盒或测试订单验证签名。
5. 确认身份证、手机号、证件照的加密存储和日志脱敏。
6. 将 `API_172_ENABLED=false` 改为 `true`。

## 7. 前端原型启动

```powershell
cd "E:\telephone card\frontend"
npm install
npm run dev -- --port 5173
```

浏览器打开：

```text
http://127.0.0.1:5173/
```
