// data/mock.js
// 所有演示数据集中管理，后续接入 172 API 时只需替换本文件或改为接口返回

const plans = [
  {
    id: 'aurora',
    category: 'large',
    tone: 'blue',
    tag: '当前推荐',
    name: '极光追番卡',
    summary: '视频、直播、热点共享',
    monthlyData: '180G',
    monthlyPrice: '39',
    carrier: '电信 / 联通',
    tip: '首充规则待同步，禁发区需预检'
  },
  {
    id: 'commute',
    category: 'budget',
    tone: 'gold',
    tag: '低月租',
    name: '星蓝通勤卡',
    summary: '导航、短视频、轻办公',
    monthlyData: '135G',
    monthlyPrice: '29',
    carrier: '电信 / 广电',
    tip: '适合日常副卡，规则清晰'
  },
  {
    id: 'cloud',
    category: 'work',
    tone: 'cyan',
    tag: '办公热点',
    name: '云端办公卡',
    summary: '外勤、移动办公、备用热点',
    monthlyData: '220G',
    monthlyPrice: '49',
    carrier: '联通 / 电信',
    tip: '建议先查热点共享限制'
  },
  {
    id: 'guard',
    category: 'budget',
    tone: 'rose',
    tag: '家人副卡',
    name: '长期守护卡',
    summary: '家人备用机、低预算咨询',
    monthlyData: '100G',
    monthlyPrice: '19',
    carrier: '运营商可选',
    tip: '适合备用机和家人副卡'
  }
]

const planCategories = [
  { label: '全部', value: 'all' },
  { label: '大流量', value: 'large' },
  { label: '低月租', value: 'budget' },
  { label: '办公热点', value: 'work' }
]

const orderSteps = [
  { num: '01', name: '套餐匹配', desc: '根据预算、地区和流量场景缩小选择范围。' },
  { num: '02', name: '规则预检', desc: '年龄、禁发区、首充、实名信息先确认。' },
  { num: '03', name: '咨询归档', desc: '把有效咨询整理成客服可跟进的线索。' },
  { num: '04', name: 'API 接入', desc: '后续同步套餐、选号、订单和回调状态。' }
]

const quickReplies = ['我想要大流量', '先查禁发区', '首充规则怎么确认']

const chatScriptedReplies = {
  '我想要大流量': '大流量套餐我会先核对热点共享和限速规则，再看禁发区。目前推荐极光追番卡 180G，不过首充规则要先确认。',
  '先查禁发区': '好的，请告诉我你的收货地区。新疆、西藏、云南、广西、海南、内蒙古这些地区常见禁发或审核差异，需要先查。',
  '首充规则怎么确认': '首充规则通常在激活页面或包裹说明里。建议收到卡后先看首充金额和入口，再激活使用。我可以帮你整理首充注意事项。'
}

const chatDefaultReply = '收到。我会先核对地区、年龄、首充入口和激活方式，再把咨询单交给客服跟进。'

const chatWelcomeMessage = {
  id: 0,
  role: 'assistant',
  text: '你好，我是电话卡娘。先告诉我地区、预算和流量需求，我帮你做第一轮判断。'
}

const budgetOptions = [
  { label: '19 元左右', value: '19' },
  { label: '29 元左右', value: '29' },
  { label: '39 元左右', value: '39' },
  { label: '49 元以上', value: '49' }
]

const needOptions = [
  { label: '追剧 / 视频', value: 'large' },
  { label: '办公 / 热点', value: 'work' },
  { label: '家人副卡', value: 'family' },
  { label: '游戏 / 直播', value: 'game' }
]

const restrictedRegions = ['新疆', '西藏', '云南', '广西', '海南', '内蒙古']

const ageLimits = { min: 18, max: 65 }

const mascotIdleLines = [
  '告诉我你的地区和预算，我先帮你避开办卡坑点。',
  '手指划过屏幕时，我会跟着你看套餐细节。',
  '首充、禁发区、激活方式，建议都先查一遍。',
  '如果你要大流量，我会优先核对热点和限速规则。'
]

const mascotEmotionLines = {
  smile: '哼，既然你点我了，那我就认真帮你看套餐吧。',
  tsundere: '喂，别划太快啦。套餐规则还没看完呢，真是的。',
  tsundereRecover: '好吧，继续看也可以。我会把重点给你留着。',
  precheckAgeDanger: '这个年龄段要谨慎，我会先提醒客服人工复核。',
  precheckRegionWarn: '这个地区我会先标记为需查规则，不急着下单。',
  precheckReady: '基础条件看起来不错，我可以继续帮你匹配套餐。',
  chatSent: '我已经把咨询重点记下来了。'
}

const ledgerDefaults = [
  { label: '今日咨询', count: 128, note: '演示数据' },
  { label: '预检通过', count: 76, note: '规则命中' },
  { label: '待跟进', count: 19, note: '客服队列' }
]

const precheckMessages = {
  idle: { title: '等待输入地区和年龄', desc: '电话卡娘会先看禁发区、年龄、首充和重复下单风险。' },
  ready: { title: '可以进入套餐匹配', desc: '基础条件看起来可继续沟通，下一步确认首充、实名和收货信息。' },
  warn: { title: '地区可能存在限制', desc: '该地区常见禁发或审核差异，建议先查 172 后台规则再推荐套餐。' },
  danger: { title: '年龄需要人工复核', desc: '多数号卡对实名年龄有区间要求，建议先让客服核对可办范围。' },
  emptyCity: { title: '请输入所在地区', desc: '地区信息用于判断禁发区和配送范围，不能为空。' },
  emptyAge: { title: '请输入实名年龄', desc: '年龄信息用于判断办卡资格，不能为空。' },
  invalidAge: { title: '年龄格式不正确', desc: '请输入有效的数字年龄，例如 28。' }
}

module.exports = {
  plans,
  planCategories,
  orderSteps,
  quickReplies,
  chatScriptedReplies,
  chatDefaultReply,
  chatWelcomeMessage,
  budgetOptions,
  needOptions,
  restrictedRegions,
  ageLimits,
  mascotIdleLines,
  mascotEmotionLines,
  ledgerDefaults,
  precheckMessages
}
