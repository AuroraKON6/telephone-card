// utils/api.js
// 统一 API 服务层 —— 当前返回 mock 数据，后续替换为真实 172 API 请求
// 所有方法返回 Promise，调用方用 async/await 或 .then() 取值

const mock = require('../data/mock')

// ===== 套餐相关 =====

function getPlans(category) {
  return new Promise((resolve) => {
    const all = mock.plans
    const result = category && category !== 'all'
      ? all.filter(p => p.category === category)
      : all
    resolve({ code: 0, data: result })
  })
}

function getPlanCategories() {
  return new Promise((resolve) => {
    resolve({ code: 0, data: mock.planCategories })
  })
}

// ===== 预检相关 =====

function submitPrecheck(params) {
  return new Promise((resolve) => {
    const { city, age } = params
    const ageNum = Number(age)

    if (!city || !city.trim()) {
      resolve({ code: 1, status: 'emptyCity', data: mock.precheckMessages.emptyCity })
      return
    }

    if (!age && age !== 0) {
      resolve({ code: 1, status: 'emptyAge', data: mock.precheckMessages.emptyAge })
      return
    }

    if (isNaN(ageNum) || ageNum <= 0) {
      resolve({ code: 1, status: 'invalidAge', data: mock.precheckMessages.invalidAge })
      return
    }

    if (ageNum < mock.ageLimits.min || ageNum > mock.ageLimits.max) {
      resolve({ code: 2, status: 'danger', data: mock.precheckMessages.danger })
      return
    }

    const hasRestricted = mock.restrictedRegions.some(r => city.includes(r))
    if (hasRestricted) {
      resolve({ code: 3, status: 'warn', data: mock.precheckMessages.warn })
      return
    }

    resolve({ code: 0, status: 'ready', data: mock.precheckMessages.ready })
  })
}

// ===== 咨询 / 客服相关 =====

function sendConsultMessage(params) {
  return new Promise((resolve) => {
    const { text } = params
    const reply = mock.chatScriptedReplies[text] || mock.chatDefaultReply
    resolve({ code: 0, data: { reply } })
  })
}

function createConsultSheet(params) {
  return new Promise((resolve) => {
    resolve({
      code: 0,
      data: {
        sheetId: 'DEMO-' + Date.now(),
        status: 'created',
        message: '咨询单已创建，客服会尽快跟进。'
      }
    })
  })
}

// ===== 流程相关 =====

function getOrderSteps() {
  return new Promise((resolve) => {
    resolve({ code: 0, data: mock.orderSteps })
  })
}

// ===== 看板娘相关 =====

function getMascotIdleLines() {
  return new Promise((resolve) => {
    resolve({ code: 0, data: mock.mascotIdleLines })
  })
}

function getMascotEmotionLine(emotion) {
  return new Promise((resolve) => {
    const line = mock.mascotEmotionLines[emotion] || ''
    resolve({ code: 0, data: { line } })
  })
}

// ===== 公共配置 =====

function getBudgetOptions() {
  return new Promise((resolve) => {
    resolve({ code: 0, data: mock.budgetOptions })
  })
}

function getNeedOptions() {
  return new Promise((resolve) => {
    resolve({ code: 0, data: mock.needOptions })
  })
}

function getLedgerDefaults() {
  return new Promise((resolve) => {
    resolve({ code: 0, data: mock.ledgerDefaults })
  })
}

function getQuickReplies() {
  return new Promise((resolve) => {
    resolve({ code: 0, data: mock.quickReplies })
  })
}

function getChatWelcome() {
  return new Promise((resolve) => {
    resolve({ code: 0, data: mock.chatWelcomeMessage })
  })
}

module.exports = {
  getPlans,
  getPlanCategories,
  submitPrecheck,
  sendConsultMessage,
  createConsultSheet,
  getOrderSteps,
  getMascotIdleLines,
  getMascotEmotionLine,
  getBudgetOptions,
  getNeedOptions,
  getLedgerDefaults,
  getQuickReplies,
  getChatWelcome
}
