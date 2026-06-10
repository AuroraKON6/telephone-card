# 电话卡娘 · 172 号卡项目

二次元风格流量卡高级导购系统，包含网页端和微信小程序端。

## 项目简介

「电话卡娘」是一个以二次元看板娘为交互核心的流量卡导购系统。用户可以通过看板娘的引导完成套餐浏览、办卡预检、客服咨询等流程。

**设计方向**：二次元看板娘 + 高级感克制排版（类似 Claude 气质）  
**配色体系**：瓷白 / 墨蓝 / SIM 金 / 电信青

## 目录结构

```
telephone card/
├── frontend/
│   ├── codex/                      # 网页端（静态 HTML，可直接浏览器打开）
│   │   ├── index.html
│   │   ├── styles.css
│   │   ├── app.js
│   │   └── assets/mascot-front.png
│   ├── wechat-miniprogram/         # 微信小程序端（原生小程序）
│   │   ├── app.js / app.json / app.wxss
│   │   ├── data/mock.js            # 演示数据（后续替换为 API）
│   │   ├── utils/api.js            # 统一 API 服务层
│   │   ├── pages/index/            # 首页
│   │   ├── assets/mascot-front.png
│   │   ├── docs/API_MAPPING.md     # 真实 API 接口设计
│   │   └── README.md
│   ├── src/                        # Vite + React 版（早期原型）
│   ├── public/
│   ├── package.json
│   └── vite.config.js
├── ops-system/                     # AI 运营系统配置包
│   ├── scripts/
│   ├── knowledge/
│   ├── handoff/
│   └── docs/
├── docs/
│   └── NEXT_STEPS.md               # 后续待办事项
├── .gitignore
└── README.md                       # ← 本文件
```

## 功能实现

### 网页端 (frontend/codex)

- 看板娘鼠标追踪（跟随鼠标方向轻微转向 / 位移）
- 点击看板娘 → smile 表情（腮红、嘴型、闪光点）
- 页面下滑 → tsundere 表情（皱眉、生气符号、傲娇台词）
- 套餐卡片筛选（全部 / 大流量 / 低月租 / 办公热点）
- 办卡预检（地区 + 年龄 → ready / warn / danger）
- 客服 Agent 咨询（快捷问题 + 输入框 + 本地模拟回复）
- Tweaks 面板（视觉变体切换、密度、跟随开关）
- 随行看板娘（滚动时底部浮层）

### 微信小程序端 (frontend/wechat-miniprogram)

- 看板娘触摸跟随（touchmove 时轻微转向 / 位移）
- 点击看板娘 → smile 表情 + 害羞台词
- 页面下滑 → tsundere 傲娇皱眉 + 生气符号
- 套餐筛选（全部 / 大流量 / 低月租 / 办公热点）
- 办卡预检（地区、年龄、预算、场景 → ready / warn / danger）
- 客服 Agent 咨询（快捷问题 + 输入框 + 本地模拟回复）
- 办理流程四步展示
- 表情叠加层（眉毛、嘴型、腮红、生气符号、闪光点）

## 快速启动

### 网页端

```powershell
cd "frontend/codex"
# 直接用浏览器打开 index.html 即可
```

或使用 Vite 开发服务器：

```powershell
cd "frontend"
npm install
npm run dev -- --port 5173
```

打开 `http://127.0.0.1:5173/`。

### 微信小程序端

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开微信开发者工具，选择「导入项目」
3. 目录选择 `frontend/wechat-miniprogram`
4. AppID 填写你的真实 AppID（或选择「测试号」）
5. 点击「导入」即可编译预览

**配置 AppID**：打开 `frontend/wechat-miniprogram/project.config.json`，将 `appid` 字段改为你的真实小程序 AppID：

```json
{
  "appid": "wx你的真实AppID"
}
```

## 接入真实 172 API

当前所有数据为演示 mock，接入真实 API 的步骤：

1. 在 `frontend/wechat-miniprogram/utils/api.js` 中引入请求封装
2. 将各 `Promise.resolve(mockData)` 替换为 `wx.request` 调用
3. 详细接口设计见 `frontend/wechat-miniprogram/docs/API_MAPPING.md`

建议接入顺序：套餐列表 → 预检接口 → 客服对话 → 咨询单 → 订单查询

## 运营系统

```powershell
cd "ops-system"
.\scripts\start-ai-ops.ps1
```

- 输入 `1` 启动 OpenClaw，输入 `2` 启动 ClaudeCode
- 营销 API 可选 `1 DeepSeek V4 Flash` 或 `2 Mimo V2.5 Pro`

运营系统文档：
- `ops-system/docs/DIRECTORY.md`
- `ops-system/docs/DEPLOYMENT.md`
- `ops-system/docs/OPERATIONS.md`

## 当前限制

- 套餐数据、客服回复均为本地 mock，未接入真实 172 API
- 看板娘素材仅一张正面图，表情通过 CSS 叠加层实现
- mascot-front.png 体积约 606KB，建议后续准备压缩版 mascot-front-mini.png
- 未接入真实客服系统和订单系统
- 网页端为静态 HTML，未做 SSR

## 后续计划

详见 [docs/NEXT_STEPS.md](docs/NEXT_STEPS.md)
