# 电话卡娘 · 微信小程序版

二次元高级流量卡导购微信小程序，基于「电话卡娘」品牌设计。

## 设计语言

- **瓷白 / 墨蓝 / SIM 金 / 电信青** 四色体系
- 二次元看板娘 + CSS 表情叠加层（眉毛、嘴型、腮红、生气符号、闪光点）
- 高级感、克制排版，类似 Claude 的气质
- 看板娘跟随手指触摸方向轻微转向
- 点击看板娘 → smile 状态（害羞 / 开心台词）
- 页面下滑 → tsundere 状态（皱眉、生气、傲娇台词）
- 滚动停止后恢复 idle

## 项目结构

```
wechat-miniprogram/
├── app.js                  # 小程序入口
├── app.json                # 全局配置
├── app.wxss                # 全局样式 + 设计令牌
├── project.config.json     # 开发者工具配置（appid 需替换）
├── sitemap.json            # 站点地图
├── data/
│   └── mock.js             # 所有演示数据集中管理
├── utils/
│   └── api.js              # 统一 API 服务层（当前返回 mock，后续替换为真实请求）
├── assets/
│   └── mascot-front.png    # 看板娘素材
├── pages/
│   └── index/
│       ├── index.wxml      # 首页模板
│       ├── index.wxss      # 首页样式
│       ├── index.js        # 首页逻辑（仅页面状态和事件处理）
│       └── index.json      # 首页配置
├── docs/
│   └── API_MAPPING.md      # 真实 API 接口设计文档
└── README.md
```

## 核心文件说明

| 文件 | 职责 |
|------|------|
| `data/mock.js` | 套餐列表、分类、流程、台词、预检规则等所有静态数据 |
| `utils/api.js` | 统一 API 服务层，所有数据请求和业务提交通过此文件 |
| `pages/index/index.js` | 页面状态管理、事件处理，调用 api.js 取数 |
| `docs/API_MAPPING.md` | 后续接入 172 API 的接口设计和字段映射 |

## 功能模块

1. **顶部品牌区** — 电话卡娘 / Flow Atelier 标识
2. **首屏导购区** — 标题、简介、看板娘展柜、数据计数器
3. **套餐卡片筛选** — 全部 / 大流量 / 低月租 / 办公热点
4. **办卡预检** — 地区、年龄、预算、使用场景 → ready / warn / danger
5. **客服 Agent** — 快捷问题、输入框、本地模拟回复
6. **办理流程** — 套餐匹配 → 规则预检 → 咨询归档 → API 接入

## 已实现的交互

| 操作 | 效果 |
|------|------|
| 手指触摸滑动看板娘 | 看板娘轻微转向 / 位移，跟随触摸方向 |
| 点击看板娘 | 进入 smile 状态，出现腮红、嘴型、闪光点 |
| 页面向下滚动 | 进入 tsundere 状态，皱眉 + 生气符号 |
| 滚动停止 | 恢复 idle 状态 |
| 套餐筛选按钮 | 按分类过滤套餐卡片 |
| 输入地区 / 年龄 | 实时预检，显示 ready / warn / danger |
| 禁发地区输入 | warn 状态 + 傲娇台词 + wx.showToast |
| 年龄过低 / 过高 | danger 状态 + 傲娇台词 + wx.showToast |
| 点击快捷问题 | 自动发送 + 模拟客服回复 |
| 手动输入咨询 | 发送后获取模拟回复 |

## 使用方式

### 1. 导入项目

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 打开微信开发者工具，选择「导入项目」
3. 目录选择 `wechat-miniprogram` 文件夹
4. AppID 填写你的真实 AppID（见下方说明）
5. 点击「导入」即可编译预览

### 2. 修改 AppID

打开 `project.config.json`，将 `appid` 字段改为你的真实小程序 AppID：

```json
{
  "appid": "wx你的真实AppID",
  ...
}
```

如果没有 AppID，可以选择「测试号」模式导入，大部分功能仍可预览。

### 3. 预览调试

- 点击工具栏「编译」按钮预览
- 点击「预览」生成二维码真机预览
- 点击「调试」查看控制台日志

## API 服务层

所有数据请求通过 `utils/api.js` 统一管理，当前返回 mock 数据：

```javascript
const api = require('../../utils/api')

// 获取套餐
const res = await api.getPlans('all')
// res.data → 套餐数组

// 提交预检
const res = await api.submitPrecheck({ city: '广东深圳', age: 28 })
// res.status → 'ready' / 'warn' / 'danger'
```

后续接入真实 172 API 时，只需修改 `utils/api.js` 内部实现，页面代码无需改动。

## Mock 数据位置

所有演示数据集中在 `data/mock.js`：

- `plans` — 套餐列表
- `planCategories` — 分类列表
- `orderSteps` — 办理流程
- `quickReplies` — 快捷问题
- `chatScriptedReplies` — 预设回复
- `budgetOptions` — 预算选项
- `needOptions` — 场景选项
- `restrictedRegions` — 禁发地区
- `mascotIdleLines` — 看板娘待机台词
- `mascotEmotionLines` — 情绪台词

## 后续接真实 172 API 步骤

1. 在 `utils/api.js` 中引入请求封装
2. 将 `Promise.resolve(mockData)` 替换为 `wx.request`
3. 处理响应格式转换
4. 添加 loading 和错误处理
5. 详细接口设计见 `docs/API_MAPPING.md`

建议按以下顺序接入：
1. 套餐列表 + 分类
2. 预检接口
3. 客服对话
4. 咨询单提交
5. 订单查询

## 已知限制

### 看板娘图片体积

`assets/mascot-front.png` 当前约 606KB，对小程序包体积有影响。后续建议：

1. 准备压缩版 `mascot-front-mini.png`（目标 < 200KB）
2. 在 `index.wxml` 中按需切换图片路径
3. 或使用 CDN 托管图片，小程序通过网络加载

### 其他限制

- 套餐数据、客服回复均为本地 mock，未接入真实 172 API
- 表情通过 CSS 叠加层实现，仅一张看板娘底图
- 未接入真实客服系统和订单系统

## 常见问题

### Q: 导入后页面空白？

检查 `project.config.json` 中 `appid` 是否正确，或切换为测试号模式。

### Q: 看板娘图片不显示？

确认 `assets/mascot-front.png` 文件存在，且 `index.wxml` 中路径为 `/assets/mascot-front.png`。

### Q: 编译报错？

确认微信开发者工具版本 >= 3.3.4，支持 `async/await` 和 ES6 语法。

### Q: 真机预览样式异常？

部分 CSS 特性（如 `backdrop-filter`）在低版本微信不支持，工具会自动降级处理。

### Q: 如何添加新套餐？

编辑 `data/mock.js` 中的 `plans` 数组，按现有格式添加新对象即可。
