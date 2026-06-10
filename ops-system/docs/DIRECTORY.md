# 项目目录结构

```text
ops-system/
  .env.example                         # 环境变量模板
  openclaw/
    openclaw.yaml                      # OpenClaw 总配置
    routing/
      model-routing.yaml               # 双模型分流和 API 选择
      self-learning-triggers.yaml      # 自主学习触发逻辑
    workflows/
      customer-service-loop.yaml       # 本地客服闭环
      marketing-learning-loop.yaml     # 营销学习与文案生成闭环
      approval-pipeline.yaml           # 方案上报审批流程
    workspaces/
      customer-service/
        agent.yaml
        prompts/customer-service-agent.md
        tools/172-card-api-adapter.yaml
      marketing-ops/
        agent.yaml
        prompts/marketing-agent.md
    memory/
      customer-service-memory.yaml
      marketing-memory.yaml
  claudecode/
    CLAUDECODE_SYSTEM_PROMPT.md        # ClaudeCode 替代运行时系统提示
    settings.deepseek.template.json    # DeepSeek provider 模板
    settings.mimo.template.json        # Mimo provider 模板
    settings.selected.json             # 启动菜单自动生成
  runtime/
    runtime-selector.yaml              # 1 OpenClaw / 2 ClaudeCode
    api-providers.yaml                 # 1 DeepSeek / 2 Mimo
  knowledge/
    172-product-rules.md
    compliance-rules.md
    customer-service-kb.md
    marketing-playbook.md
  handoff/
    approval-inbox.md
    customer-handoff.md
  scripts/
    _env.ps1
    start-ai-ops.ps1                   # 统一菜单入口
    start-local-llm.ps1
    start-openclaw.ps1
    start-claudecode.ps1
    health-check.ps1
  docs/
    DEPLOYMENT.md
    OPERATIONS.md
    DIRECTORY.md
```

旁边的 `frontend/` 是独立官网前端原型，不属于运营系统本体。域名、官网部署和 172 API 对接后续再接。
