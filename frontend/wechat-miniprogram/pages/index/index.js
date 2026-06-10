// pages/index/index.js
const api = require('../../utils/api')

let msgIdCounter = 0
let lineIndex = 0
let ignoreScrollUntil = 0
let tsundereTimer = null
let lastScrollTop = 0

Page({
  data: {
    emotion: 'idle',
    mascotLine: '',
    gazeLabel: '正在等待触摸',
    mascotTap: false,
    lookX: 0,
    lookY: 0,
    imgX: 0,
    imgY: 0,
    exprX: 0,
    exprY: 0,

    filters: [],
    activeFilter: 'all',
    filteredPlans: [],

    city: '',
    age: '',
    budgetIndex: 2,
    budgetOptions: [],
    needIndex: 0,
    needOptions: [],
    precheckStatus: 'idle',
    precheckTitle: '',
    precheckDesc: '',

    messages: [],
    quickReplies: [],
    chatDraft: '',
    chatScrollTarget: '',

    displayCount1: 0,
    displayCount2: 0,
    displayCount3: 0,

    orderSteps: []
  },

  async onLoad() {
    await this.loadInitialData()
    this.animateCounters()
    this.startIdleRotation()
  },

  onUnload() {
    if (tsundereTimer) clearTimeout(tsundereTimer)
  },

  async loadInitialData() {
    const [
      categoriesRes,
      plansRes,
      budgetRes,
      needRes,
      quickRes,
      welcomeRes,
      stepsRes,
      idleRes,
      ledgerRes
    ] = await Promise.all([
      api.getPlanCategories(),
      api.getPlans('all'),
      api.getBudgetOptions(),
      api.getNeedOptions(),
      api.getQuickReplies(),
      api.getChatWelcome(),
      api.getOrderSteps(),
      api.getMascotIdleLines(),
      api.getLedgerDefaults()
    ])

    const ledger = ledgerRes.data
    this.setData({
      filters: categoriesRes.data,
      filteredPlans: plansRes.data,
      budgetOptions: budgetRes.data,
      needOptions: needRes.data,
      quickReplies: quickRes.data,
      messages: [welcomeRes.data],
      orderSteps: stepsRes.data,
      mascotLine: idleRes.data[0],
      precheckTitle: '等待输入地区和年龄',
      precheckDesc: '电话卡娘会先看禁发区、年龄、首充和重复下单风险。',
      displayCount1: ledger[0].count,
      displayCount2: ledger[1].count,
      displayCount3: ledger[2].count
    })
  },

  onPageScroll(e) {
    const scrollTop = e.scrollTop || 0
    const goingDown = scrollTop > lastScrollTop + 15
    lastScrollTop = scrollTop

    if (Date.now() < ignoreScrollUntil) return

    if (goingDown && scrollTop > 200) {
      if (tsundereTimer) clearTimeout(tsundereTimer)
      api.getMascotEmotionLine('tsundere').then(res => {
        this.setData({ emotion: 'tsundere', mascotLine: res.data.line, gazeLabel: '有点傲娇' })
      })
      tsundereTimer = setTimeout(() => {
        if (this.data.emotion === 'tsundere') {
          api.getMascotEmotionLine('tsundereRecover').then(res => {
            this.setData({ emotion: 'idle', mascotLine: res.data.line })
          })
        }
      }, 2200)
    }
  },

  animateCounters() {
    const targets = [128, 76, 19]
    const duration = 760
    const start = Date.now()
    const tick = () => {
      const progress = Math.min(1, (Date.now() - start) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      this.setData({
        displayCount1: Math.round(targets[0] * eased),
        displayCount2: Math.round(targets[1] * eased),
        displayCount3: Math.round(targets[2] * eased)
      })
      if (progress < 1) setTimeout(tick, 16)
    }
    tick()
  },

  startIdleRotation() {
    api.getMascotIdleLines().then(res => {
      const lines = res.data
      setInterval(() => {
        lineIndex = (lineIndex + 1) % lines.length
        if (this.data.emotion !== 'tsundere' && this.data.emotion !== 'smile') {
          this.setData({ mascotLine: lines[lineIndex] })
        }
      }, 5800)
    })
  },

  // ===== Mascot Touch Tracking =====
  onMascotTouchStart(e) {
    this._touchStartX = e.touches[0].clientX
    this._touchStartY = e.touches[0].clientY
  },

  onMascotTouchMove(e) {
    const touch = e.touches[0]
    wx.createSelectorQuery().select('#mascotPortrait').boundingClientRect(rect => {
      if (!rect) return
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const dx = clamp((touch.clientX - cx) / (rect.width / 2), -1, 1)
      const dy = clamp((touch.clientY - cy) / (rect.height / 2), -1, 1)

      const h = dx < -0.28 ? '左侧' : dx > 0.28 ? '右侧' : '正前方'
      const v = dy < -0.25 ? '上方' : dy > 0.25 ? '下方' : ''

      this.setData({
        lookX: dx * 12, lookY: dy * 9,
        imgX: dx * 4.32, imgY: dy * 1.92,
        exprX: dx * 1.68, exprY: dy * 1.2,
        gazeLabel: `看向${v}${h}`
      })
    }).exec()
  },

  onMascotTouchEnd() {
    setTimeout(() => {
      this.setData({
        lookX: 0, lookY: 0, imgX: 0, imgY: 0, exprX: 0, exprY: 0,
        gazeLabel: '正在等待触摸'
      })
    }, 200)
  },

  onMascotTap() {
    ignoreScrollUntil = Date.now() + 1100
    this.setData({ mascotTap: false })
    setTimeout(() => {
      api.getMascotEmotionLine('smile').then(res => {
        this.setData({
          mascotTap: true, emotion: 'smile',
          mascotLine: res.data.line, gazeLabel: '笑了一下'
        })
      })
    }, 10)
    setTimeout(() => {
      if (this.data.emotion === 'smile') {
        this.setData({ emotion: 'idle', mascotTap: false })
      }
    }, 2600)
  },

  // ===== Plan Filtering =====
  async onFilterTap(e) {
    const filter = e.currentTarget.dataset.filter
    const res = await api.getPlans(filter)
    this.setData({ activeFilter: filter, filteredPlans: res.data })
  },

  // ===== Precheck =====
  onCityInput(e) {
    this.setData({ city: e.detail.value })
    this.runPrecheck()
  },

  onAgeInput(e) {
    this.setData({ age: e.detail.value })
    this.runPrecheck()
  },

  onBudgetChange(e) {
    this.setData({ budgetIndex: e.detail.value })
  },

  onNeedChange(e) {
    this.setData({ needIndex: e.detail.value })
  },

  async runPrecheck() {
    const res = await api.submitPrecheck({
      city: this.data.city,
      age: this.data.age
    })

    const status = res.status
    const msg = res.data

    this.setData({ precheckStatus: status, precheckTitle: msg.title, precheckDesc: msg.desc })

    if (status === 'danger') {
      this.triggerTsundere('这个年龄段要谨慎，我会先提醒客服人工复核。', 1800)
      wx.showToast({ title: msg.title, icon: 'none', duration: 2000 })
    } else if (status === 'warn') {
      this.triggerTsundere('这个地区我会先标记为需查规则，不急着下单。', 1800)
      wx.showToast({ title: msg.title, icon: 'none', duration: 2000 })
    } else if (status === 'ready') {
      this.triggerSmile('基础条件看起来不错，我可以继续帮你匹配套餐。', 1800)
    }
  },

  triggerTsundere(line, hold) {
    this.setData({ emotion: 'tsundere', mascotLine: line, gazeLabel: '有点傲娇' })
    if (hold) {
      setTimeout(() => {
        if (this.data.emotion === 'tsundere') this.setData({ emotion: 'idle' })
      }, hold)
    }
  },

  triggerSmile(line, hold) {
    this.setData({ emotion: 'smile', mascotLine: line, gazeLabel: '笑了一下' })
    if (hold) {
      setTimeout(() => {
        if (this.data.emotion === 'smile') this.setData({ emotion: 'idle' })
      }, hold)
    }
  },

  // ===== Chat =====
  onChatInput(e) {
    this.setData({ chatDraft: e.detail.value })
  },

  onChatSend() {
    const text = this.data.chatDraft.trim()
    if (!text) return
    this.sendChat(text)
    this.setData({ chatDraft: '' })
  },

  onQuickReply(e) {
    this.sendChat(e.currentTarget.dataset.text)
  },

  async sendChat(text) {
    const userMsg = { id: ++msgIdCounter, role: 'user', text }
    this.setData({
      messages: [...this.data.messages, userMsg],
      chatScrollTarget: `msg-${userMsg.id}`
    })

    const res = await api.sendConsultMessage({ text })
    const botMsg = { id: ++msgIdCounter, role: 'assistant', text: res.data.reply }

    this.setData({
      messages: [...this.data.messages, botMsg],
      chatScrollTarget: `msg-${botMsg.id}`
    })

    api.getMascotEmotionLine('chatSent').then(r => {
      this.triggerSmile(r.data.line, 1700)
    })
  },

  scrollToPlans() {
    wx.pageScrollTo({ selector: '#plans', duration: 300 })
  },

  scrollToPrecheck() {
    wx.pageScrollTo({ selector: '#precheck', duration: 300 })
  }
})

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}
