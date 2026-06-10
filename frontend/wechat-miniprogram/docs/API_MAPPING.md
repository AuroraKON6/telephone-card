# API 接口映射文档

本文档整理了电话卡娘微信小程序后续接入 172 真实 API 时的接口设计，以及当前 mock 字段到真实字段的映射关系。

---

## 1. 套餐列表接口

**用途**：获取套餐列表，支持按分类筛选

| 项目 | 说明 |
|------|------|
| 请求方法 | GET |
| 请求路径建议 | `/api/v1/plans` |
| 请求参数 | `category` (string, 可选) — 筛选分类：`all` / `large` / `budget` / `work` |
| | `page` (int, 可选) — 页码，默认 1 |
| | `pageSize` (int, 可选) — 每页条数，默认 20 |

**响应字段**：

| 真实字段 | 类型 | 含义 | mock 字段 | 页面使用位置 |
|----------|------|------|-----------|-------------|
| `id` | string | 套餐唯一 ID | `id` | 套餐卡片 wx:key |
| `category` | string | 分类标识 | `category` | 筛选逻辑 |
| `tone` | string | 展示色调 | `tone` | 卡片颜色 |
| `tag` | string | 标签文案 | `tag` | 卡片标签 |
| `name` | string | 套餐名称 | `name` | 卡片标题 |
| `summary` | string | 套餐简介 | `summary` | 卡片描述 |
| `monthlyData` | string | 月流量 | `monthlyData` | 规格行 |
| `monthlyPrice` | string | 月租价格 | `monthlyPrice` | 价格显示 |
| `carrier` | string | 运营商 | `carrier` | 规格行 |
| `tip` | string | 提醒事项 | `tip` | 规格行 |
| `firstChargeRule` | string | 首充规则 | (无) | 预检 / 详情 |
| `restrictedRegions` | string[] | 禁发地区列表 | (无) | 预检逻辑 |
| `activationMethod` | string | 激活方式 | (无) | 套餐详情 |

**错误状态**：

| HTTP 状态码 | code | 含义 | 处理方式 |
|-------------|------|------|----------|
| 200 | 0 | 成功 | 正常渲染 |
| 500 | -1 | 服务异常 | wx.showToast 提示稍后重试 |
| 429 | -2 | 请求过频 | wx.showToast 提示稍后重试 |

---

## 2. 套餐分类接口

**用途**：获取套餐分类列表（用于筛选栏）

| 项目 | 说明 |
|------|------|
| 请求方法 | GET |
| 请求路径建议 | `/api/v1/plans/categories` |
| 请求参数 | 无 |

**响应字段**：

| 真实字段 | 类型 | 含义 | mock 字段 |
|----------|------|------|-----------|
| `label` | string | 显示文案 | `label` |
| `value` | string | 分类标识 | `value` |

---

## 3. 办卡预检接口

**用途**：地区 + 年龄 + 套餐 ID 综合预检，返回风险等级

| 项目 | 说明 |
|------|------|
| 请求方法 | POST |
| 请求路径建议 | `/api/v1/precheck` |
| 请求参数 | `city` (string, 必填) — 用户输入地区 |
| | `age` (int, 必填) — 实名年龄 |
| | `planId` (string, 可选) — 关联套餐 ID |

**响应字段**：

| 真实字段 | 类型 | 含义 | mock 映射 |
|----------|------|------|-----------|
| `status` | string | 预检结果：`ready` / `warn` / `danger` | `status` |
| `title` | string | 结果标题 | `data.title` |
| `desc` | string | 结果详细说明 | `data.desc` |
| `checks` | object[] | 逐项检查结果 | (无) |
| `checks[].name` | string | 检查项名称 | — |
| `checks[].passed` | bool | 是否通过 | — |
| `checks[].message` | string | 检查项说明 | — |

**错误状态**：

| code | 含义 | 处理方式 |
|------|------|----------|
| 0 | 全部通过 | 显示 ready 卡片 |
| 1 | 输入不完整 | 内联提示 + wx.showToast |
| 2 | 年龄风险 | 显示 danger 卡片 + 傲娇台词 |
| 3 | 地区风险 | 显示 warn 卡片 + 傲娇台词 |
| -1 | 服务异常 | wx.showToast 提示 |

---

## 4. 咨询单提交接口

**用途**：创建客服咨询单，记录用户信息和咨询内容

| 项目 | 说明 |
|------|------|
| 请求方法 | POST |
| 请求路径建议 | `/api/v1/consult/sheets` |
| 请求参数 | `city` (string) — 地区 |
| | `age` (int) — 年龄 |
| | `budget` (string) — 预算 |
| | `need` (string) — 使用场景 |
| | `planId` (string, 可选) — 关联套餐 |
| | `messages` (object[]) — 聊天记录 |

**响应字段**：

| 真实字段 | 类型 | 含义 | mock 映射 |
|----------|------|------|-----------|
| `sheetId` | string | 咨询单 ID | `'DEMO-' + Date.now()` |
| `status` | string | 单据状态 | `'created'` |
| `message` | string | 提示文案 | 内置文案 |

---

## 5. 客服 Agent 对话接口

**用途**：发送用户消息，获取客服 / AI 回复

| 项目 | 说明 |
|------|------|
| 请求方法 | POST |
| 请求路径建议 | `/api/v1/consult/messages` |
| 请求参数 | `text` (string, 必填) — 用户消息 |
| | `sheetId` (string, 可选) — 关联咨询单 |
| | `context` (object, 可选) — 上下文（地区、年龄等） |

**响应字段**：

| 真实字段 | 类型 | 含义 | mock 映射 |
|----------|------|------|-----------|
| `reply` | string | 客服回复文本 | `chatScriptedReplies[text]` 或 `chatDefaultReply` |
| `suggestions` | string[] | 后续建议问题 | (无) |
| `sheetUpdated` | bool | 咨询单是否更新 | (无) |

**错误状态**：

| code | 含义 | 处理方式 |
|------|------|----------|
| 0 | 成功 | 显示回复消息 |
| -1 | 服务异常 | 显示默认兜底回复 |

---

## 6. 订单状态查询接口

**用途**：查询办理流程 / 订单进度

| 项目 | 说明 |
|------|------|
| 请求方法 | GET |
| 请求路径建议 | `/api/v1/orders/{orderId}/status` |
| 请求参数 | `orderId` (string, 路径) — 订单 ID |

**响应字段**：

| 真实字段 | 类型 | 含义 |
|----------|------|------|
| `orderId` | string | 订单 ID |
| `currentStep` | int | 当前步骤编号 |
| `steps` | object[] | 步骤列表 |
| `steps[].num` | string | 步骤序号 |
| `steps[].name` | string | 步骤名称 |
| `steps[].desc` | string | 步骤说明 |
| `steps[].status` | string | 状态：`pending` / `active` / `done` |

---

## 7. 素材 / 话术接口

**用途**：获取看板娘台词、快捷问题、客服话术

| 项目 | 说明 |
|------|------|
| 请求方法 | GET |
| 请求路径建议 | `/api/v1/assets/scripts` |
| 请求参数 | `type` (string) — `idle` / `smile` / `tsundere` / `quick_replies` |

**响应字段**：

| 真实字段 | 类型 | 含义 | mock 映射 |
|----------|------|------|-----------|
| `lines` | string[] | 台词列表 | `mascotIdleLines` / `mascotEmotionLines` |
| `quickReplies` | string[] | 快捷问题 | `quickReplies` |
| `scriptedReplies` | object | 预设回复映射 | `chatScriptedReplies` |

---

## 接入步骤

1. 在 `utils/api.js` 中引入 `wx.request` 或封装请求工具
2. 将各 `Promise.resolve(mockData)` 替换为真实 HTTP 请求
3. 处理响应数据格式转换（真实字段 → 页面字段）
4. 添加 loading 状态（setData 中加 `loading: true`）
5. 添加错误处理（catch → wx.showToast）
6. 在 `project.config.json` 中配置合法域名
7. 逐步替换，建议按以下顺序：
   - 套餐列表 + 分类（最简单）
   - 预检接口（核心逻辑）
   - 客服对话（依赖预检上下文）
   - 咨询单提交（需要用户体系）
   - 订单查询（需要下单流程）
