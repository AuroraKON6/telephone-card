# 后续待办事项

本文档列出电话卡娘项目后续需要完成的工作，按优先级排列。

## 微信开发者工具验收（P0）

- [ ] 用微信开发者工具导入 `frontend/wechat-miniprogram`
- [ ] 编译运行，确认无报错
- [ ] iPhone SE (375px) 适配检查
  - [ ] 看板娘区域是否裁剪
  - [ ] 底部输入框是否被键盘遮挡
  - [ ] 套餐卡片文字是否溢出
  - [ ] 表情叠加层是否对齐
- [ ] iPhone 15 (390px) 适配检查
  - [ ] 表情叠加层与看板娘图对齐
  - [ ] 流程步骤卡片布局
- [ ] Android 常见尺寸 (360-412px) 适配检查
  - [ ] 套餐卡片价格数字是否溢出
  - [ ] 客服聊天区域高度
- [ ] 真机预览二维码测试
- [ ] 检查所有交互：
  - [ ] 触摸跟随
  - [ ] 点击 smile
  - [ ] 下滑 tsundere
  - [ ] 套餐筛选
  - [ ] 预检结果
  - [ ] 客服回复

## 图片优化（P1）

- [ ] mascot-front.png 当前 606KB，准备压缩版 mascot-front-mini.png（目标 < 200KB）
- [ ] 压缩时保持透明通道和画质
- [ ] 在 index.wxml 中按需切换图片路径
- [ ] 网页端 codex/assets/ 下的图片同步优化

## 真实 API 接入（P1）

- [ ] 获取 172 API 文档和密钥
- [ ] 在 `utils/api.js` 中封装 wx.request 基础方法
- [ ] 接入套餐列表接口（`/api/v1/plans`）
- [ ] 接入套餐分类接口（`/api/v1/plans/categories`）
- [ ] 接入办卡预检接口（`/api/v1/precheck`）
- [ ] 接入咨询单提交接口（`/api/v1/consult/sheets`）
- [ ] 接入客服对话接口（`/api/v1/consult/messages`）
- [ ] 接入订单状态查询接口（`/api/v1/orders/{id}/status`）
- [ ] 详细字段映射见 `frontend/wechat-miniprogram/docs/API_MAPPING.md`

## 客服 Agent 接入（P2）

- [ ] 确定客服系统方案（自建 / 第三方 / 172 内置）
- [ ] 实现消息 WebSocket 长连接或轮询
- [ ] 接入真实客服回复逻辑
- [ ] 保留本地 mock 作为降级方案

## 订单系统接入（P2）

- [ ] 对接 172 订单状态回调
- [ ] 实现订单进度展示页面
- [ ] 实现选号功能（如有）
- [ ] 实现激活指引页面

## 上线前合规检查（P3）

- [ ] 小程序类目审核（电信业务相关类目）
- [ ] 用户隐私协议弹窗
- [ ] 实名认证流程合规性
- [ ] 套餐价格标注合规性
- [ ] 敏感词检查（禁发区、运营商名称等）
- [ ] 小程序体验版内测
- [ ] 提交微信审核

## 网页端优化（P3）

- [ ] 网页端接入同一套 API 服务层
- [ ] 移动端响应式优化
- [ ] SEO meta 标签完善
- [ ] 性能优化（图片懒加载、代码分割）

## GitHub 上传前确认

- [ ] 确认 `.gitignore` 已排除所有敏感文件
- [ ] 确认 `ops-system/.env` 不会被提交（已在 .gitignore 中）
- [ ] 确认 `project.config.json` 中 appid 为占位符 `wxXXXXXXXXXXXXXXXX`
- [ ] 确认无真实 API key、token、手机号、身份证等信息
- [ ] 确认 node_modules、dist、log 文件不会被提交
