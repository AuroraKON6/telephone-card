# 日常运维方法

## 每天检查

1. 本地客服模型是否在线：运行 `.\scripts\health-check.ps1`。
2. `handoff/customer-handoff.md` 是否有未解答问题。
3. `handoff/approval-inbox.md` 是否有待审批营销方案。
4. `logs/` 是否有模型超时、工具失败、签名失败等错误。

## 运行时选择

统一入口：

```powershell
.\scripts\start-ai-ops.ps1
```

- 输入 `1`：使用 OpenClaw。
- 输入 `2`：使用 ClaudeCode。

随后选择营销 API：

- 输入 `1`：DeepSeek V4 Flash。
- 输入 `2`：Mimo V2.5 Pro。

运行时只影响调度外壳，不改变业务职责：客服本地私有化，营销外部 API，172 API 默认关闭。

## 营销方案处理

1. Marketing Agent 每天学习公开资料，每周生成一套推广方案草案。
2. 草案进入 `handoff/approval-inbox.md`，默认 `draft`。
3. 你审核后把状态改为 `approved`、`needs_change` 或 `rejected`。
4. 只有 `approved` 才能进入发布队列。
5. 发布后的数据反馈再写入 `marketing-memory.yaml` 的 `approved_campaigns`。

## 客服知识库更新

1. 客服 Agent 对不确定问题写入 `handoff/customer-handoff.md`。
2. 人工核实后台规则后，把通用答案写入 `knowledge/customer-service-kb.md`。
3. 不要把完整手机号、身份证、地址、证件照写入长期知识库。

## 172 API 启用前检查

1. 拿到 `user_id` 和 `secret`。
2. 配置 HTTPS 回调公网地址。
3. 用测试订单验证 MD5 签名。
4. 验证 `DownOrderID` 唯一性。
5. 验证订单回调签名和幂等处理。
6. 将 `.env` 中 `API_172_ENABLED=false` 改为 `true`。

## 风险处理

- 本地模型宕机：客服不切到外部模型，直接提示维护并人工转接。
- 营销 API 宕机：营销任务排队，不能使用本地客服小模型替代。
- 产品信息不确定：一律标记“需核对后台”，不要让模型猜。
- 合规风险：先暂停发布，修改审批状态为 `needs_change`。
