import { computed, ref, watch } from 'vue';
import {
  CardshopApiError,
  checkBackendHealth,
  compareProducts,
  createPurchaseIntent,
  createSupportTicket,
  discoverPublicCategories,
  peekProduct,
  refreshCatalog,
  refreshProduct,
  sendChatMessage,
  type CatalogMeta,
  type PurchaseIntentResponse,
  type SupportTicketCategory,
  type SupportTicketResponse,
} from '@/api/cardshop';
import {
  adaptCatalogItem,
  assignFeaturedTiers,
  formatVerifyTimestamp,
  mergeCompareItem,
  mergeProductDetail,
} from '@/adapters/cardshopAdapter';
import { PROVINCES, SIM_PLANS } from '@/data/plans';
import type {
  AdvisorMessage,
  BackendMode,
  Carrier,
  QuickTag,
  SimPlan,
  SortMode,
} from '@/types/sim';

const COMPARE_KEY = 'novasim_compare_ids_v1';
const PROVINCE_KEY = 'novasim_selected_province_v1';
const CHAT_SESSION_KEY = 'novasim_chat_session_v1';
export const MAX_COMPARE_COUNT = 3;

const DEMO_FALLBACK_PLANS: SimPlan[] = SIM_PLANS.map((p) => ({
  ...p,
  isDemoFallback: true,
}));

function safeLoadCompare(validIds: Set<string>): string[] {
  try {
    const raw = localStorage.getItem(COMPARE_KEY);
    if (!raw) return ['ct-xingyao-29', 'cu-jiguang-39'].filter((id) => validIds.has(id));
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return ['ct-xingyao-29', 'cu-jiguang-39'].filter((id) => validIds.has(id));
    return parsed
      .filter((id): id is string => typeof id === 'string' && validIds.has(id))
      .slice(0, MAX_COMPARE_COUNT);
  } catch {
    return ['ct-xingyao-29', 'cu-jiguang-39'].filter((id) => validIds.has(id));
  }
}

function safeLoadProvince(): string {
  try {
    const raw = localStorage.getItem(PROVINCE_KEY);
    return raw && PROVINCES.includes(raw) ? raw : '';
  } catch {
    return '';
  }
}

function safeLoadChatToken(): string {
  try {
    return localStorage.getItem(CHAT_SESSION_KEY) || '';
  } catch {
    return '';
  }
}

/** 计算指定号卡在连续 24 个月内的总实付金额（元），精确按分阶段资费累加 */
export function calc24MonthTotal(plan: SimPlan): number {
  let total = 0;
  for (let m = 1; m <= 24; m++) {
    const phase =
      plan.phases.find(
        (ph) => m >= ph.startMonth && (ph.endMonth === null || m <= ph.endMonth),
      ) ?? plan.phases[plan.phases.length - 1];
    total += phase ? phase.monthlyPrice : plan.monthlyPrice;
  }
  return Number(total.toFixed(2));
}

/** 计算 24 个月综合折合月均实付（元/月） */
export function calcEffectiveMonthly(plan: SimPlan): number {
  return Number((calc24MonthTotal(plan) / 24).toFixed(1));
}

/** 计算每 GB 通用流量折算单价（基于优惠期月租；不限量或未知返回 0） */
export function calcPricePerGb(plan: SimPlan): number {
  if (plan.generalDataGb <= 0) return 0;
  return Number((plan.monthlyPrice / plan.generalDataGb).toFixed(2));
}

/** 格式化通用流量展示文案 */
export function formatGeneralDataLabel(gb: number): string {
  if (gb < 0) return '不限量';
  if (gb === 0) return '待核验';
  return `${gb}GB`;
}

/** 判断套餐在指定省份是否禁发（仅在配送范围已核验或本地规则明确时判定） */
export function isBlockedInProvince(plan: SimPlan, province: string): boolean {
  if (!province) return false;
  if (plan.regionStatus === 'unverified') return false;
  return plan.blockedProvinces.includes(province);
}

// ===== 模块级单例状态，供全部章节、抽屉、弹窗无缝共享 =====
const plans = ref<SimPlan[]>([...DEMO_FALLBACK_PLANS]);
const backendMode = ref<BackendMode>('connecting');
const backendLatencyMs = ref<number | null>(null);
const publicCategories = ref<string[]>([]);
const catalogLoading = ref(false);
const catalogRefreshing = ref(false);
const lastCatalogMeta = ref<CatalogMeta | null>(null);
const categoryPages = ref<Record<string, { page: number; hasMore: boolean }>>({});
const detailLoading = ref(false);
const detailError = ref('');
const compareLoading = ref(false);
const chatSessionToken = ref<string>(safeLoadChatToken());
const lastFocusedBackendId = ref<number | null>(null);

let initialized = false;
let lastRefreshAt = 0;

const searchQuery = ref('');
const selectedCarrier = ref<Carrier | '全部'>('全部');
const selectedQuickTag = ref<QuickTag>('all');
const sortMode = ref<SortMode>('recommend');
const selectedProvince = ref<string>(safeLoadProvince());
const hideBlocked = ref(false);

const compareIds = ref<string[]>(safeLoadCompare(new Set(plans.value.map((p) => p.id))));
const activeDetailPlanId = ref<string | null>(null);
const activeApplyPlanId = ref<string | null>(null);
const soldOutPlanId = ref<string | null>(null);
const activeGuideId = ref<string | null>(null);
const isAdvisorOpen = ref(false);
const isContactOpen = ref(false);
const slowNetworkState = ref<{
  active: boolean;
  title: string;
  subtitle: string;
}>({
  active: false,
  title: '正在检测服务器节点延迟…',
  subtitle: '正在探测 cardshop 后端服务健康度与商品缓存状态，请稍候片刻。',
});
let slowNetworkTimer: ReturnType<typeof setTimeout> | null = null;
const toastMessage = ref<string>('');
let toastTimer: ReturnType<typeof setTimeout> | null = null;

const advisorMessages = ref<AdvisorMessage[]>([
  {
    id: 'welcome',
    role: 'assistant',
    text: '你好，我是 NovaSIM 选卡顾问（已接入服务器 cardshop 核验引擎）。直接告诉我你的【预算】【收货省份】【流量/通话需求】或具体套餐疑问，系统会在保护隐私的前提下为你核验解答。',
    sourceLabel: '隐私门已就绪',
    timestamp: '刚刚',
  },
]);

watch(
  compareIds,
  (val) => {
    try {
      localStorage.setItem(COMPARE_KEY, JSON.stringify(val.slice(0, MAX_COMPARE_COUNT)));
    } catch {
      // 忽略隐私模式写入失败
    }
  },
  { deep: true },
);

watch(selectedProvince, (val) => {
  try {
    if (val) localStorage.setItem(PROVINCE_KEY, val);
    else localStorage.removeItem(PROVINCE_KEY);
  } catch {
    // 忽略隐私模式写入失败
  }
});

watch(chatSessionToken, (val) => {
  try {
    if (val) localStorage.setItem(CHAT_SESSION_KEY, val);
  } catch {
    // 忽略隐私模式写入失败
  }
});

function showToast(msg: string) {
  toastMessage.value = msg;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastMessage.value = '';
  }, 2800);
}

/** 隐私拦截门：禁止在站内 AI 咨询中输入身份证号、手机号、银行卡号等敏感实名信息 */
function detectSensitivePersonalInfo(text: string): string | null {
  const cleaned = text.replace(/\s+/g, '');
  if (/(?<!\d)[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/.test(cleaned)) {
    return '疑似 18 位身份证号码';
  }
  if (/(?<!\d)1[3-9]\d{9}(?!\d)/.test(cleaned)) {
    return '疑似 11 位手机号码';
  }
  if (/(?<!\d)\d{16,19}(?!\d)/.test(cleaned)) {
    return '疑似银行卡号或长敏感证件号';
  }
  return null;
}

/** 合并后端拉取到的目录页到 livePlans 列表中（按 backendId 去重） */
function mergeLiveCatalogPages(
  entries: Array<{ category: string; products: import('@/api/cardshop').BackendCardItem[] }>,
  existingPlans: SimPlan[],
): SimPlan[] {
  const byBackendId = new Map<number, SimPlan>();
  for (const existing of existingPlans) {
    if (existing.backendId != null) {
      byBackendId.set(existing.backendId, existing);
    }
  }

  const ordered: SimPlan[] = [];
  const seen = new Set<number>();
  let idx = 0;

  for (const { category, products } of entries) {
    for (const item of products) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const adapted = adaptCatalogItem(item, category, idx);
      const prev = byBackendId.get(item.id);
      // 若之前已核验过详情且版本号一致，保留已核验详情字段，避免被目录快照降级
      if (prev && prev.detailSource === 'detail' && prev.versionId === item.version_id) {
        ordered.push({
          ...prev,
          saleStatus: item.sale_status,
          publishState: item.publish_state,
          soldOut: adapted.soldOut,
          soldOutReason: adapted.soldOutReason,
        });
      } else {
        ordered.push(adapted);
      }
      idx += 1;
    }
  }

  return assignFeaturedTiers(ordered);
}

/** 将新的实盘列表应用到全局状态，并同步修复已选对比清单 */
function applyLivePlans(nextLivePlans: SimPlan[]) {
  if (nextLivePlans.length > 0) {
    plans.value = nextLivePlans;
    backendMode.value = 'live';
    const validIds = new Set(nextLivePlans.map((p) => p.id));
    const kept = compareIds.value.filter((id) => validIds.has(id)).slice(0, MAX_COMPARE_COUNT);
    if (kept.length >= 2) {
      compareIds.value = kept;
    } else {
      const avail = nextLivePlans.filter((p) => !p.soldOut).slice(0, 2).map((p) => p.id);
      compareIds.value = avail.length > 0 ? avail : nextLivePlans.slice(0, 2).map((p) => p.id);
    }
  } else {
    plans.value = [...DEMO_FALLBACK_PLANS];
    backendMode.value = 'connected_empty';
    const validDemo = new Set(DEMO_FALLBACK_PLANS.map((p) => p.id));
    const kept = compareIds.value.filter((id) => validDemo.has(id)).slice(0, MAX_COMPARE_COUNT);
    compareIds.value = kept.length >= 2 ? kept : ['ct-xingyao-29', 'cu-jiguang-39'];
  }
}

/** 首次挂载同步服务器后端（严禁 setInterval 轮询；仅在首屏必要时执行一次受限刷新） */
async function initStorefront() {
  if (initialized) return;
  initialized = true;
  catalogLoading.value = true;
  backendMode.value = 'connecting';

  try {
    const health = await checkBackendHealth();
    backendLatencyMs.value = health.latencyMs;
    if (!health.ok) {
      backendMode.value = 'offline';
      plans.value = [...DEMO_FALLBACK_PLANS];
      return;
    }

    const { categories, peeks } = await discoverPublicCategories();
    publicCategories.value = categories;

    if (categories.length === 0) {
      backendMode.value = 'connected_empty';
      plans.value = [...DEMO_FALLBACK_PLANS];
      return;
    }

    // 先利用只读缓存首屏渲染
    const initialEntries: Array<{
      category: string;
      products: import('@/api/cardshop').BackendCardItem[];
    }> = [];
    const needRefreshCats: string[] = [];

    for (const cat of categories) {
      const peek = peeks[cat];
      if (!peek) continue;
      lastCatalogMeta.value = peek.meta;
      categoryPages.value[cat] = { page: 1, hasMore: Boolean(peek.has_more) };
      initialEntries.push({ category: cat, products: peek.products ?? [] });
      if (peek.meta?.state !== 'fresh' || (peek.products?.length ?? 0) === 0) {
        needRefreshCats.push(cat);
      }
    }

    const initialLive = mergeLiveCatalogPages(initialEntries, []);
    if (initialLive.length > 0) {
      applyLivePlans(initialLive);
    }

    // 仅对缓存过期或为空的分类执行一次受限刷新（顺序串行，遵守后端单并发上游预算）
    if (needRefreshCats.length > 0) {
      lastRefreshAt = Date.now();
      const refreshedMap = new Map<string, import('@/api/cardshop').BackendCardItem[]>();
      for (const e of initialEntries) {
        refreshedMap.set(e.category, e.products);
      }

      for (const cat of needRefreshCats) {
        try {
          const fresh = await refreshCatalog(cat, 1, 20, '');
          lastCatalogMeta.value = fresh.meta;
          categoryPages.value[cat] = { page: 1, hasMore: Boolean(fresh.has_more) };
          refreshedMap.set(cat, fresh.products ?? []);
        } catch {
          // 单个分类刷新失败时保留已有缓存结果
        }
      }

      const finalEntries = categories.map((cat) => ({
        category: cat,
        products: refreshedMap.get(cat) ?? [],
      }));
      const finalLive = mergeLiveCatalogPages(finalEntries, plans.value);
      applyLivePlans(finalLive);
    } else if (initialLive.length === 0) {
      applyLivePlans([]);
    }
  } catch {
    backendMode.value = 'offline';
    plans.value = [...DEMO_FALLBACK_PLANS];
  } finally {
    catalogLoading.value = false;
  }
}

/** 用户主动触发受限刷新（内置 3 秒客户端节流，保护上游并发预算） */
async function refreshLiveCatalog() {
  if (catalogRefreshing.value) return;
  const now = Date.now();
  if (now - lastRefreshAt < 3000) {
    showToast('刚刚已核验过库存，请 3 秒后再试');
    return;
  }
  lastRefreshAt = now;
  catalogRefreshing.value = true;

  try {
    const health = await checkBackendHealth();
    backendLatencyMs.value = health.latencyMs;
    if (!health.ok) {
      backendMode.value = 'offline';
      showToast('暂时无法连接服务器后端，请稍后再试');
      return;
    }

    let cats = publicCategories.value;
    if (cats.length === 0) {
      const discovered = await discoverPublicCategories();
      cats = discovered.categories;
      publicCategories.value = cats;
    }

    if (cats.length === 0) {
      applyLivePlans([]);
      showToast('服务器尚未开放公开分类');
      return;
    }

    const entries: Array<{
      category: string;
      products: import('@/api/cardshop').BackendCardItem[];
    }> = [];

    for (const cat of cats) {
      const res = await refreshCatalog(cat, 1, 20, '');
      lastCatalogMeta.value = res.meta;
      categoryPages.value[cat] = { page: 1, hasMore: Boolean(res.has_more) };
      entries.push({ category: cat, products: res.products ?? [] });
    }

    const nextLive = mergeLiveCatalogPages(entries, plans.value);
    applyLivePlans(nextLive);
    if (nextLive.length > 0) {
      showToast(`已同步服务器最新在售库存（共 ${nextLive.length} 款）`);
    } else {
      showToast('已连通服务器，当前上游渠道返回 0 款商品（请检查服务器 channel_token 配置）');
    }
  } catch (err) {
    if (err instanceof CardshopApiError && err.status === 429) {
      showToast('刷新过于频繁，请稍等片刻再试');
    } else {
      showToast('拉取服务器库存失败，请稍后重试');
    }
  } finally {
    catalogRefreshing.value = false;
  }
}

/** 翻页加载更多在售号卡 */
async function loadMoreCatalog() {
  if (catalogRefreshing.value || backendMode.value !== 'live') return;
  const nextCats = Object.entries(categoryPages.value).filter(([, state]) => state.hasMore);
  if (nextCats.length === 0) return;

  catalogRefreshing.value = true;
  try {
    const appended: SimPlan[] = [...plans.value];
    const existingIds = new Set(appended.map((p) => p.backendId).filter((v): v is number => v != null));
    let addedCount = 0;

    for (const [cat, state] of nextCats) {
      const targetPage = state.page + 1;
      const res = await refreshCatalog(cat, targetPage, 20, '');
      lastCatalogMeta.value = res.meta;
      categoryPages.value[cat] = { page: targetPage, hasMore: Boolean(res.has_more) };
      for (const item of res.products ?? []) {
        if (existingIds.has(item.id)) continue;
        existingIds.add(item.id);
        appended.push(adaptCatalogItem(item, cat, appended.length));
        addedCount += 1;
      }
    }
    plans.value = assignFeaturedTiers(appended);
    showToast(addedCount > 0 ? `已追加加载 ${addedCount} 款号卡` : '当前已加载全部在售号卡');
  } catch {
    showToast('加载更多号卡失败，请稍后再试');
  } finally {
    catalogRefreshing.value = false;
  }
}

/** 更新全局 plans 中指定 backendId 的记录 */
function updatePlanByBackendId(backendId: number, updater: (prev: SimPlan) => SimPlan) {
  const idx = plans.value.findIndex((p) => p.backendId === backendId);
  if (idx < 0) return;
  const next = [...plans.value];
  next[idx] = updater(next[idx]);
  plans.value = next;
}

/** 按需核验单商品详情（先读缓存，再在需要时触发受限刷新） */
async function hydratePlanDetail(plan: SimPlan, forceRefresh = false) {
  if (plan.backendId == null) return;
  const pid = plan.backendId;
  lastFocusedBackendId.value = pid;
  detailLoading.value = true;
  detailError.value = '';

  try {
    if (!forceRefresh) {
      const cached = await peekProduct(pid);
      updatePlanByBackendId(pid, (prev) => mergeProductDetail(prev, cached));
      if (cached.source === 'detail' && cached.meta?.state === 'fresh') {
        return;
      }
    }
    const fresh = await refreshProduct(pid);
    updatePlanByBackendId(pid, (prev) => mergeProductDetail(prev, fresh));
    if (forceRefresh) {
      showToast(`已核验最新条款（v${fresh.version_no ?? '?'}）`);
    }
  } catch (err) {
    if (err instanceof CardshopApiError && err.status === 429) {
      detailError.value = '核验频率受限，请稍后再试';
    } else {
      detailError.value = '详情实时核验暂时不可用，当前展示本地缓存快照';
    }
  } finally {
    detailLoading.value = false;
  }
}

/** 服务端实时核验当前对比清单（POST /api/v1/comparisons，最多 3 款） */
async function syncCompareWithBackend() {
  const targetBackendIds = compareIds.value
    .map((id) => plans.value.find((p) => p.id === id)?.backendId)
    .filter((id): id is number => typeof id === 'number')
    .slice(0, MAX_COMPARE_COUNT);

  if (targetBackendIds.length === 0 || compareLoading.value) return;
  compareLoading.value = true;
  try {
    const res = await compareProducts(targetBackendIds);
    for (const item of res.items ?? []) {
      updatePlanByBackendId(item.id, (prev) => mergeCompareItem(prev, item));
    }
    showToast('已通过服务器实时核验对比参数');
  } catch (err) {
    if (err instanceof CardshopApiError && err.status === 429) {
      showToast('对比核验过于频繁，请稍等片刻');
    } else {
      showToast('对比核验暂时不可用，已保留当前参数');
    }
  } finally {
    compareLoading.value = false;
  }
}

/** 办理前向服务器发起 15 秒新鲜度与链接校验（POST /api/v1/purchase-intents） */
async function verifyPurchaseIntent(
  planId: string,
  overrideVersionId?: number | null,
): Promise<PurchaseIntentResponse | null> {
  const target = plans.value.find((p) => p.id === planId);
  if (!target || target.backendId == null) return null;

  const seenVersion = overrideVersionId !== undefined ? overrideVersionId : (target.versionId ?? null);
  const res = await createPurchaseIntent(target.backendId, seenVersion);

  if (res.action === 'unavailable') {
    updatePlanByBackendId(target.backendId, (prev) => ({
      ...prev,
      soldOut: true,
      saleStatus: 'off_shelf_verified',
      soldOutReason: res.reason || '该商品经实时核验暂不可办理。',
    }));
  } else if (res.action === 'version_conflict' && res.current_version_id != null) {
    updatePlanByBackendId(target.backendId, (prev) => ({
      ...prev,
      versionId: res.current_version_id,
      monthlyPrice:
        typeof res.new_version?.now_price_cents === 'number'
          ? Number((res.new_version.now_price_cents / 100).toFixed(2))
          : prev.monthlyPrice,
      offerDetailText: res.new_version?.offer_detail_text || prev.offerDetailText,
      firstRechargeText: res.new_version?.first_recharge_text || prev.firstRechargeText,
      contractText: res.new_version?.contract_text || prev.contractText,
    }));
  }

  return res;
}

/** 基于当前可用号卡池的本地智能匹配算法（仅在后端离线时作为兜底，或辅助推荐） */
function matchPlansLocally(query: string): { reply: string; ids: string[] } {
  const q = query.trim();
  const matchedProvince = PROVINCES.find(
    (p) => q.includes(p) || q.includes(p.replace(/(省|市|壮族自治区|维吾尔自治区|回族自治区|自治区)$/, '')),
  );

  let maxBudget: number | null = null;
  const budgetMatch = q.match(/(\d{1,3})\s*(元|块|以下|以内)/);
  if (budgetMatch) {
    maxBudget = Number(budgetMatch[1]);
  } else if (q.includes('便宜') || q.includes('省钱') || q.includes('保号') || q.includes('副卡')) {
    maxBudget = 20;
  }

  let prefCarrier: Carrier | null = null;
  if (q.includes('电信')) prefCarrier = '中国电信';
  else if (q.includes('联通')) prefCarrier = '中国联通';
  else if (q.includes('移动')) prefCarrier = '中国移动';
  else if (q.includes('广电')) prefCarrier = '中国广电';

  const needLongTerm = /长期|不变价|不涨价|稳定|主力/.test(q);
  const needNoContract = /无合约|没合约|0合约|随时销户|短期/.test(q);
  const needVoice = /通话|电话|语音|老人|父母|商务|差旅/.test(q);
  const needBigData = /大流量|热点|刷剧|追剧|游戏|宿舍|wifi|wi-fi|学生/i.test(q);
  const needLocalAttr = /本地|归属地|收货地/.test(q);

  const scored = plans.value
    .map((plan) => {
      if (plan.soldOut) return { plan, score: -999 };
      if (matchedProvince && isBlockedInProvince(plan, matchedProvince)) {
        return { plan, score: -999 };
      }
      let score = 20;
      if (plan.isFeaturedHighlight) score += 6;
      if (prefCarrier && plan.carrier === prefCarrier) score += 30;
      if (maxBudget !== null) {
        if (plan.monthlyPrice <= maxBudget) score += 28;
        else score -= (plan.monthlyPrice - maxBudget) * 1.5;
      }
      if (needLongTerm) score += plan.isLongTerm ? 24 : -10;
      if (needNoContract) score += plan.contractMonths === 0 ? 24 : -14;
      if (needVoice) score += plan.voiceMinutes >= 200 ? 28 : plan.voiceMinutes >= 100 ? 14 : -12;
      if (needBigData) {
        const gb = plan.generalDataGb < 0 ? 999 : plan.generalDataGb;
        score += gb >= 180 ? 28 : gb >= 120 ? 16 : -8;
      }
      if (needLocalAttr) score += plan.attribution.includes('收货地') || plan.attribution.includes('广东') ? 22 : 0;

      score += Math.max(0, 12 - calcPricePerGb(plan) * 20);
      return { plan, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 3).map((s) => s.plan);
  if (top.length === 0) {
    return {
      reply: `当前条件较为严格（例如在${matchedProvince ?? '目标地区'}可发且满足全部限制），建议放宽预算或更换运营商再试。`,
      ids: [],
    };
  }

  return {
    reply: `（当前离线演示匹配）为你挑选出以下 ${top.length} 款参考方案，点击卡片可查看 24 期明账或加入对比：`,
    ids: top.map((p) => p.id),
  };
}

export function useStorefront() {
  const allPlans = computed(() => plans.value);

  const featuredPlans = computed(() => {
    const tagged = plans.value.filter((p) => Boolean(p.featuredTier));
    return tagged.length > 0 ? tagged : plans.value.slice(0, 4);
  });

  const comparePlans = computed(() =>
    compareIds.value
      .map((id) => plans.value.find((p) => p.id === id))
      .filter((p): p is SimPlan => Boolean(p)),
  );

  const hasMoreCatalog = computed(() =>
    Object.values(categoryPages.value).some((s) => s.hasMore),
  );

  const catalogMetaText = computed(() => {
    if (backendMode.value === 'connecting') return '正在连接服务器 cardshop 后端…';
    if (backendMode.value === 'offline') return '服务器暂不可达 · 当前为离线演示数据';
    const ts = formatVerifyTimestamp(lastCatalogMeta.value?.fetched_at);
    const cats = publicCategories.value.length > 0 ? publicCategories.value.join(' / ') : '未开放';
    if (backendMode.value === 'connected_empty') {
      return `已直连服务器后端（开放分类：${cats} · ${ts}）· 上游渠道待配置 channel_token，当前展示演示卡池`;
    }
    const stateMap: Record<string, string> = {
      fresh: '数据新鲜',
      stale: '缓存参考中',
      expired: '等待更新',
      missing: '暂无缓存',
    };
    const st = stateMap[lastCatalogMeta.value?.state ?? 'fresh'] ?? '已同步';
    return `已直连服务器实时库存（${cats} · ${st} · ${ts} 核验）`;
  });

  const filteredPlans = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    let list = plans.value.filter((plan) => {
      if (selectedCarrier.value !== '全部' && plan.carrier !== selectedCarrier.value) {
        return false;
      }
      if (hideBlocked.value && selectedProvince.value && isBlockedInProvince(plan, selectedProvince.value)) {
        return false;
      }
      switch (selectedQuickTag.value) {
        case 'under-30':
          if (plan.monthlyPrice > 29) return false;
          break;
        case 'long-term':
          if (!plan.isLongTerm) return false;
          break;
        case 'big-data':
          if (plan.generalDataGb >= 0 && plan.generalDataGb < 150) return false;
          break;
        case 'no-contract':
          if (plan.contractMonths !== 0) return false;
          break;
        case 'with-voice':
          if (plan.voiceMinutes < 100) return false;
          break;
      }
      if (q) {
        const hay = [
          plan.name,
          plan.tagline,
          plan.carrier,
          plan.attribution,
          plan.bestFor,
          plan.offerDetailText ?? '',
          ...plan.highlights,
          `${plan.monthlyPrice}元`,
          `${plan.generalDataGb}g`,
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    list = [...list];
    switch (sortMode.value) {
      case 'price-asc':
        list.sort((a, b) => a.monthlyPrice - b.monthlyPrice || b.generalDataGb - a.generalDataGb);
        break;
      case 'data-desc':
        list.sort((a, b) => {
          const ga = a.generalDataGb < 0 ? 99999 : a.generalDataGb;
          const gb = b.generalDataGb < 0 ? 99999 : b.generalDataGb;
          return gb - ga || a.monthlyPrice - b.monthlyPrice;
        });
        break;
      case 'unit-cost':
        list.sort((a, b) => {
          const ua = calcPricePerGb(a) || 999;
          const ub = calcPricePerGb(b) || 999;
          return ua - ub;
        });
        break;
      default:
        list.sort((a, b) => {
          const aBlocked = selectedProvince.value && isBlockedInProvince(a, selectedProvince.value) ? 1 : 0;
          const bBlocked = selectedProvince.value && isBlockedInProvince(b, selectedProvince.value) ? 1 : 0;
          if (aBlocked !== bBlocked) return aBlocked - bBlocked;
          if (a.isFeaturedHighlight && !b.isFeaturedHighlight) return -1;
          if (!a.isFeaturedHighlight && b.isFeaturedHighlight) return 1;
          return (b.featuredTier ? 1 : 0) - (a.featuredTier ? 1 : 0);
        });
    }
    return list;
  });

  const activeDetailPlan = computed(() =>
    plans.value.find((p) => p.id === activeDetailPlanId.value) ?? null,
  );

  const activeApplyPlan = computed(() =>
    plans.value.find((p) => p.id === activeApplyPlanId.value) ?? null,
  );

  const soldOutPlan = computed(() =>
    plans.value.find((p) => p.id === soldOutPlanId.value) ?? null,
  );

  function isCompared(id: string): boolean {
    return compareIds.value.includes(id);
  }

  function toggleCompare(id: string) {
    const idx = compareIds.value.indexOf(id);
    if (idx >= 0) {
      compareIds.value.splice(idx, 1);
      showToast('已从对比清单移出');
      return;
    }
    if (compareIds.value.length >= MAX_COMPARE_COUNT) {
      showToast(`最多同时对比 ${MAX_COMPARE_COUNT} 张号卡，请先移出 1 张`);
      return;
    }
    compareIds.value.push(id);
    showToast(`已加入对比（当前 ${compareIds.value.length}/${MAX_COMPARE_COUNT} 张）`);
  }

  function clearCompare() {
    compareIds.value = [];
    showToast('已清空对比清单');
  }

  function applyPresetCompare() {
    const avail = plans.value.filter((p) => !p.soldOut);
    const chosen = (avail.length >= 2 ? avail : plans.value).slice(0, MAX_COMPARE_COUNT).map((p) => p.id);
    compareIds.value = chosen;
    showToast(`已载入 ${chosen.length} 款对比组合`);
    if (backendMode.value === 'live') {
      void syncCompareWithBackend();
    }
  }

  function resetFilters() {
    searchQuery.value = '';
    selectedCarrier.value = '全部';
    selectedQuickTag.value = 'all';
    sortMode.value = 'recommend';
    hideBlocked.value = false;
  }

  function openDetail(id: string) {
    activeDetailPlanId.value = id;
    detailError.value = '';
    const target = plans.value.find((p) => p.id === id);
    if (target?.backendId != null) {
      void hydratePlanDetail(target, false);
    }
  }

  function refreshActiveDetail() {
    const target = activeDetailPlan.value;
    if (target?.backendId != null) {
      void hydratePlanDetail(target, true);
    }
  }

  function closeDetail() {
    activeDetailPlanId.value = null;
    detailError.value = '';
  }

  function openApply(id: string) {
    const target = plans.value.find((p) => p.id === id);
    if (target?.soldOut) {
      soldOutPlanId.value = id;
      return;
    }
    if (target?.backendId != null) {
      lastFocusedBackendId.value = target.backendId;
    }
    activeApplyPlanId.value = id;
  }

  function closeApply() {
    activeApplyPlanId.value = null;
  }

  function openSoldOut(id: string) {
    soldOutPlanId.value = id;
  }

  function closeSoldOut() {
    soldOutPlanId.value = null;
  }

  function openGuide(id: string) {
    activeGuideId.value = id;
  }

  function closeGuide() {
    activeGuideId.value = null;
  }

  function openAdvisor() {
    isAdvisorOpen.value = true;
  }

  function closeAdvisor() {
    isAdvisorOpen.value = false;
  }

  function openContact() {
    isContactOpen.value = true;
  }

  function closeContact() {
    isContactOpen.value = false;
  }

  /** 真实服务器节点延迟检测（实际请求 GET /health/ready） */
  async function triggerSlowNetworkCheck() {
    if (slowNetworkTimer) clearTimeout(slowNetworkTimer);
    slowNetworkState.value = {
      active: true,
      title: '正在探测服务器后端节点延迟…',
      subtitle: '小仓鼠正在向阿里云深圳 ECS cardshop 后端发送健康探针并校对缓存状态。',
    };
    const [health] = await Promise.all([
      checkBackendHealth(),
      new Promise((resolve) => {
        slowNetworkTimer = setTimeout(resolve, 900);
      }),
    ]);
    slowNetworkTimer = null;
    slowNetworkState.value.active = false;
    backendLatencyMs.value = health.latencyMs;

    if (health.ok) {
      showToast(`服务器节点连通正常 · 实时延迟 ${health.latencyMs}ms`);
    } else {
      showToast('服务器探针超时，当前处于离线演示模式');
    }
  }

  function dismissSlowNetwork() {
    if (slowNetworkTimer) {
      clearTimeout(slowNetworkTimer);
      slowNetworkTimer = null;
    }
    slowNetworkState.value.active = false;
  }

  /** 发送 AI 顾问咨询：本地零 PII 拦截 -> 直连后端 POST /api/v1/chat/messages */
  async function sendAdvisorPrompt(rawText: string): Promise<void> {
    const text = rawText.trim();
    if (!text) return;

    const nowLabel = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    });

    // 第一道隐私红线：前端本地拦截，敏感原文绝不发往网络
    const sensitiveType = detectSensitivePersonalInfo(text);
    if (sensitiveType) {
      advisorMessages.value.push({
        id: `priv-${Date.now()}`,
        role: 'assistant',
        isPrivacyWarning: true,
        sourceLabel: '本地隐私门拦截',
        text: `已触发站内隐私保护拦截：检测到${sensitiveType}。NovaSIM 不收集、不存储任何实名身份证号、手机号或银行卡信息，原文已被拦截丢弃。请仅输入预算、省份及流量/通话偏好继续咨询。`,
        timestamp: nowLabel,
      });
      return;
    }

    advisorMessages.value.push({
      id: `u-${Date.now()}`,
      role: 'user',
      text,
      timestamp: nowLabel,
    });

    // 若后端已连接（live 或 connected_empty），全部走真实后端 /api/v1/chat/messages
    if (backendMode.value !== 'offline') {
      const contextBackendIds: number[] = [];
      if (lastFocusedBackendId.value != null) {
        contextBackendIds.push(lastFocusedBackendId.value);
      }
      for (const cid of compareIds.value) {
        const bid = plans.value.find((p) => p.id === cid)?.backendId;
        if (bid != null && !contextBackendIds.includes(bid)) {
          contextBackendIds.push(bid);
        }
      }

      try {
        const res = await sendChatMessage({
          session_token: chatSessionToken.value || undefined,
          text,
          product_ids: contextBackendIds.slice(0, MAX_COMPARE_COUNT),
        });
        if (res.session_token) {
          chatSessionToken.value = res.session_token;
        }
        const refPlanIds = (res.refs ?? [])
          .map((r) => `cs-${r.product_id}`)
          .filter((id) => plans.value.some((p) => p.id === id));

        // 渠道尚未填充且后端走了 FAQ 兜底时，如用户有明确选卡条件，附带本地参考卡方便体验
        let fallbackDemoIds: string[] | undefined;
        if (backendMode.value === 'connected_empty' && refPlanIds.length === 0 && res.outcome === 'fallback') {
          const localMatch = matchPlansLocally(text);
          if (localMatch.ids.length > 0) {
            fallbackDemoIds = localMatch.ids;
          }
        }

        const sourceLabel =
          res.outcome === 'refused'
            ? '服务器隐私门拦截'
            : res.outcome === 'fallback'
              ? '服务器 FAQ 知识库兜底'
              : '服务器 AI 核验引擎';

        advisorMessages.value.push({
          id: `a-${Date.now() + 1}`,
          role: 'assistant',
          text: res.reply,
          isPrivacyWarning: res.outcome === 'refused',
          outcome: res.outcome,
          sourceLabel,
          recommendedIds: refPlanIds.length > 0 ? refPlanIds : fallbackDemoIds,
          timestamp: nowLabel,
        });
        return;
      } catch (err) {
        if (err instanceof CardshopApiError && err.status === 429) {
          advisorMessages.value.push({
            id: `a-${Date.now() + 1}`,
            role: 'assistant',
            sourceLabel: '服务端限流保护',
            text: '当前提问频率偏高，请稍等片刻后再试。',
            timestamp: nowLabel,
          });
          return;
        }
        // 网络异常时诚实回退本地匹配
      }
    }

    const { reply, ids } = matchPlansLocally(text);
    advisorMessages.value.push({
      id: `a-${Date.now() + 1}`,
      role: 'assistant',
      text: reply,
      sourceLabel: '离线本地匹配',
      recommendedIds: ids,
      timestamp: nowLabel,
    });
  }

  /** 提交服务端工单（严格仅发枚举 category，绝不提交自由文本或联系方式） */
  async function submitBackendSupportTicket(
    category: SupportTicketCategory,
  ): Promise<SupportTicketResponse> {
    return createSupportTicket({
      category,
      session_token: chatSessionToken.value || undefined,
    });
  }

  return {
    allPlans,
    featuredPlans,
    filteredPlans,
    comparePlans,
    compareIds,
    backendMode,
    backendLatencyMs,
    publicCategories,
    catalogLoading,
    catalogRefreshing,
    catalogMetaText,
    hasMoreCatalog,
    detailLoading,
    detailError,
    compareLoading,
    searchQuery,
    selectedCarrier,
    selectedQuickTag,
    sortMode,
    selectedProvince,
    hideBlocked,
    activeDetailPlan,
    activeApplyPlan,
    soldOutPlan,
    activeGuideId,
    isAdvisorOpen,
    isContactOpen,
    slowNetworkState,
    advisorMessages,
    toastMessage,
    initStorefront,
    refreshLiveCatalog,
    loadMoreCatalog,
    refreshActiveDetail,
    syncCompareWithBackend,
    verifyPurchaseIntent,
    submitBackendSupportTicket,
    isCompared,
    toggleCompare,
    clearCompare,
    applyPresetCompare,
    resetFilters,
    openDetail,
    closeDetail,
    openApply,
    closeApply,
    openSoldOut,
    closeSoldOut,
    openGuide,
    closeGuide,
    openAdvisor,
    closeAdvisor,
    openContact,
    closeContact,
    triggerSlowNetworkCheck,
    dismissSlowNetwork,
    sendAdvisorPrompt,
    showToast,
  };
}
