# NovaSIM · 正规号卡透明选卡商城前端

基于 **Vue 3 + TypeScript + Vite + Tailwind CSS** 构建的正规号卡透明选卡工作台，采用纯黑/纯白双模全宽章节节奏与统一 **思源宋体可变字体（`@fontsource-variable/noto-serif-sc`）**，已完整对接 `cardshop` FastAPI 后端 `/api/v1/*` 接口体系。

## 核心特性

1. **硬件级实体 SIM 卡舞台**：1.586:1 实体金属芯片卡 3D 交互模型与自动轮播流体微栅（`MicroSlats`），支持点击切换档位卡面并实时预览资费结构。
2. **4-Up 主推方案阶梯**：支持一键切换「优惠期月租」与「24 个月真实月均」，直观披露真实长期成本。
3. **全量号卡目录与禁发省份实时检测**：支持关键词搜索、运营商筛选、场景标签与单 GB 成本排序；对接 `GET /api/v1/catalog`（只读缓存）与 `POST /api/v1/catalog/refresh`（受限刷新），配送范围未核验时诚实标注「配送待确认」。
4. **24 个月可拖拽账单标尺透视仪**：内置 47 格游标刻度尺与 24 期逐月实付柱状图，拖动标尺实时推演累计账单、累计流量与折合月均。
5. **多卡横向对比（最多 3 款）**：并排逐行规格对照，对接 `POST /api/v1/comparisons` 实时核验对比数据。
6. **15 秒办理核验与售罄替代推荐**：对接 `POST /api/v1/purchase-intents`，支持真实官方 H5 跳转与可撕下热敏办理凭证、条款变动 `version_conflict` 逐项确认，以及下架自动触发 404 物理掉落替代卡页。
7. **AI 智能选卡顾问与零 PII 合规红线**：前端本地隐私门拦截身份证号/手机号/银行卡号；直连 `POST /api/v1/chat/messages` 与枚举工单 `POST /api/v1/support-tickets`，站内零实名信息留存。

## 本地运行与联调

```bash
npm install

# 如需联调远程后端，复制 .env.example 为 .env.local 并修改 VITE_PROXY_TARGET
cp .env.example .env.local

npm run dev       # 本地开发：http://127.0.0.1:5178
npm run build     # TypeScript 检查 + 生产打包（输出至 dist/）
npm run preview   # 生产产物预览：http://127.0.0.1:4178
```
