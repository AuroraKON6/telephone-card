# 172 号卡全自动化 AI 运营系统

这是 172 号卡 AI 运营系统配置包，不包含真实 172 API 调用代码。

## Agent

- `customer_service_agent`：本地千问 3.5 9B，私有化客服接待，不调用外部 API。
- `marketing_ops_agent`：外部高阶模型 API，负责公开内容学习、营销文案、活动方案和审批上报。

## 运行时选择

```powershell
.\scripts\start-ai-ops.ps1
```

输入 `1` 使用 OpenClaw，输入 `2` 使用 ClaudeCode。随后再输入 `1` 选择 DeepSeek V4 Flash，或输入 `2` 选择 Mimo V2.5 Pro。

## 关键文件

- `openclaw/openclaw.yaml`：OpenClaw 总配置。
- `openclaw/routing/model-routing.yaml`：双模型分流。
- `openclaw/routing/self-learning-triggers.yaml`：自主学习触发。
- `openclaw/workflows/approval-pipeline.yaml`：人工审批流程。
- `openclaw/workspaces/customer-service/tools/172-card-api-adapter.yaml`：172 API 插槽。
- `claudecode/CLAUDECODE_SYSTEM_PROMPT.md`：ClaudeCode 替代运行时提示。
- `runtime/runtime-selector.yaml`：运行时菜单定义。
- `runtime/api-providers.yaml`：DeepSeek/Mimo 菜单定义。
- `knowledge/`：客服、营销和合规知识库。
- `docs/DEPLOYMENT.md`：部署教程。

## 启动顺序

```powershell
Copy-Item .env.example .env
.\scripts\start-local-llm.ps1
.\scripts\health-check.ps1
.\scripts\start-ai-ops.ps1
```
