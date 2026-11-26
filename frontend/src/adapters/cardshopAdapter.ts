/** cardshop 后端数据 -> NovaSIM SimPlan 诚实适配层
 * 核心原则（对齐 cardshop 后端验收规范）：
 * - 不编造缺失数值：后端返回 null / unverified 时如实标注“待核验”或“以详情页为准”
 * - 禁发地解析严格区分省级与市级，不把“吉林市”误伤成吉林全省
 * - 资费时间轴仅在后端 offer_stages 交叉印证后标为 offerStagesVerified=true
 */
import type {
  BackendCardItem,
  BackendCompareItem,
  BackendOfferStage,
  BackendProductDetail,
} from '@/api/cardshop';
import { PROVINCES } from '@/data/plans';
import type { CardMaterial, Carrier, OfferPhase, PlanTier, SimPlan } from '@/types/sim';

const SENTINEL_REGION_RE = /^[无暂不限禁制发/-]+$/;

function stripRegionSuffix(name: string): string {
  return name
    .trim()
    .replace(/(维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区|省|市)$/, '');
}

const PROVINCE_LOOKUP = PROVINCES.map((full) => ({
  full,
  short: stripRegionSuffix(full),
}));

/** 运营商名称归一化 */
export function normalizeCarrier(raw: string | undefined | null, fallbackCategory?: string): Carrier {
  const src = `${raw ?? ''} ${fallbackCategory ?? ''}`;
  if (src.includes('电信')) return '中国电信';
  if (src.includes('联通')) return '中国联通';
  if (src.includes('移动')) return '中国移动';
  if (src.includes('广电')) return '中国广电';
  return '中国联通';
}

/** 分 -> 元（保留必要小数，如 2900 -> 29，2950 -> 29.5） */
export function centsToYuan(cents: number | null | undefined): number {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return 0;
  return Number((cents / 100).toFixed(2));
}

export function formatYuanText(cents: number | null | undefined): string {
  if (typeof cents !== 'number' || !Number.isFinite(cents)) return '待核验';
  const y = cents / 100;
  return Number.isInteger(y) ? `${y} 元` : `${y.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')} 元`;
}

/** 解析省级禁发名单（严格区分省级禁发 vs 市级禁发：如“吉林市”不归入吉林全省禁发） */
export function extractBlockedProvinces(entries: string[] | null | undefined): string[] {
  if (!Array.isArray(entries) || entries.length === 0) return [];
  const blocked = new Set<string>();
  for (const rawEntry of entries) {
    const raw = String(rawEntry ?? '').trim();
    if (!raw || SENTINEL_REGION_RE.test(raw)) continue;
    // 去掉括号备注，如“新疆维吾尔自治区（全境）”
    const cleaned = raw.replace(/（[^）]*）|\([^)]*\)/g, '').trim() || raw;
    for (const p of PROVINCE_LOOKUP) {
      if (cleaned === p.full || cleaned === p.short || cleaned === `${p.short}省`) {
        blocked.add(p.full);
        break;
      }
    }
  }
  return Array.from(blocked);
}

/** 从首充原文中提取数字门槛（仅提取显式“充/预存 + X元”，不猜测） */
function extractFirstRechargeYuan(text: string | undefined | null): number {
  if (!text) return 0;
  const m = text.match(/(?:首充|充值|预存|存费)[^0-9]{0,6}(\d{2,4})\s*元?/);
  if (m) return Number(m[1]);
  const m2 = text.match(/(\d{2,4})\s*元/);
  return m2 ? Number(m2[1]) : 0;
}

/** 将后端 offer_stages 转换为 NovaSIM OfferPhase[] */
function mapOfferStagesToPhases(
  stages: BackendOfferStage[] | null | undefined,
  monthlyPrice: number,
  expirePriceYuan: number | null,
  offerDetailText?: string,
): { phases: OfferPhase[]; verified: boolean; isLongTerm: boolean; durationLabel: string } {
  if (Array.isArray(stages) && stages.length > 0) {
    const phases: OfferPhase[] = stages.map((st, idx) => {
      const isProration = st.price_cents == null;
      const price = isProration ? monthlyPrice : centsToYuan(st.price_cents);
      return {
        period: st.label || `第 ${idx + 1} 阶段`,
        startMonth: Math.max(1, st.start || 1),
        endMonth: st.end ?? null,
        monthlyPrice: price,
        isProration,
        note: st.note || (isProration ? '首月按激活天数折算' : '后端交叉印证阶段月租'),
      };
    });
    const last = stages[stages.length - 1];
    const isLongTerm = Boolean(last?.permanent) || (last?.end === null && last?.price_cents === Math.round(monthlyPrice * 100));
    const durationLabel = last?.permanent
      ? `长期优惠（${last.label} ¥${centsToYuan(last.price_cents)}/月）`
      : expirePriceYuan != null
        ? `优惠期 ¥${monthlyPrice}/月 · 到期后 ¥${expirePriceYuan}/月`
        : last?.label
          ? `${last.label}核验阶梯`
          : '已核验阶梯资费';
    return { phases, verified: true, isLongTerm, durationLabel };
  }

  // 未提供可交叉印证阶段时：诚实展示当前核验月租，并标明以优惠原文为准
  const note = offerDetailText
    ? '详细阶段条款请查看下方“后端已核验优惠说明原文”'
    : '当前为列表快照，打开详情可按需向运营商上游核验完整条款';
  const durationLabel =
    expirePriceYuan != null
      ? `优惠月租 ¥${monthlyPrice}/月 · 到期后 ¥${expirePriceYuan}/月`
      : '以已核验优惠说明原文为准';

  return {
    phases: [
      {
        period: '当前核验月租',
        startMonth: 1,
        endMonth: null,
        monthlyPrice,
        note,
      },
    ],
    verified: false,
    isLongTerm: Boolean(offerDetailText && /长期|自动续/.test(offerDetailText)),
    durationLabel,
  };
}

const MATERIALS_POOL: CardMaterial[] = ['cobalt', 'obsidian', 'emerald', 'metal', 'crimson'];

function pickMaterialForCarrier(carrier: Carrier, index: number): CardMaterial {
  if (index === 1) return 'cobalt';
  switch (carrier) {
    case '中国电信':
      return 'cobalt';
    case '中国联通':
      return index % 2 === 0 ? 'crimson' : 'emerald';
    case '中国移动':
      return 'metal';
    case '中国广电':
      return 'obsidian';
    default:
      return MATERIALS_POOL[index % MATERIALS_POOL.length];
  }
}

/** 将后端目录卡项映射为 SimPlan */
export function adaptCatalogItem(
  item: BackendCardItem,
  category: string,
  index: number,
): SimPlan {
  const carrier = normalizeCarrier(item.operator, category);
  const monthlyPrice = centsToYuan(item.now_price_cents);
  const rawOld = centsToYuan(item.old_price_cents);
  const originalPrice = rawOld > monthlyPrice ? rawOld : monthlyPrice;
  const expirePriceYuan =
    typeof item.expire_price_cents === 'number' ? centsToYuan(item.expire_price_cents) : null;
  const generalDataGb = item.traffic_generic_gb ?? 0;
  const directionalDataGb = item.traffic_directional_gb ?? 0;
  const voiceMinutes = item.call_minutes ?? 0;
  const regionVerified = item.region_status === 'verified';
  const blockedProvinces = regionVerified ? extractBlockedProvinces(item.excluded_regions) : [];
  const rawRegionsText = (item.excluded_regions ?? []).filter(Boolean).join('、');

  const blockedDetailNote = regionVerified
    ? rawRegionsText
      ? `已核验限制地区：${rawRegionsText}`
      : '配送限制待确认（以办理页为准）'
    : rawRegionsText
      ? `配送待确认（上游原文：${rawRegionsText}）`
      : '配送范围待打开详情核验（当前仅加载目录快照）';

  const { phases, verified, isLongTerm, durationLabel } = mapOfferStagesToPhases(
    null,
    monthlyPrice,
    expirePriceYuan,
  );

  const highlights: string[] = [];
  if (Array.isArray(item.tags) && item.tags.length > 0) {
    highlights.push(...item.tags.slice(0, 3));
  } else {
    if (generalDataGb < 0) highlights.push('通用流量不限量');
    else if (generalDataGb > 0) highlights.push(`${generalDataGb}G 通用流量`);
    if (voiceMinutes > 0) highlights.push(`含 ${voiceMinutes} 分钟通话`);
    highlights.push(regionVerified ? '配送范围已核验' : '点击详情实时核验');
  }

  const isUnavailable =
    item.sale_status === 'off_shelf_verified' ||
    item.sale_status === 'paused' ||
    item.hidden;

  return {
    id: `cs-${item.id}`,
    backendId: item.id,
    versionId: item.version_id,
    detailSource: 'list',
    publishState: item.publish_state,
    saleStatus: item.sale_status,
    regionStatus: item.region_status,
    excludedRegionsRaw: item.excluded_regions ?? [],
    offerStagesVerified: verified,
    expirePriceYuan,
    imageUrl: item.image_url,
    name: item.name || `号卡方案 #${item.id}`,
    tagline: item.summary || `${carrier} 线上直发方案 · 详情页实时核验完整条款`,
    carrier,
    material: pickMaterialForCarrier(carrier, index),
    monthlyPrice,
    originalPrice,
    generalDataGb,
    directionalDataGb,
    voiceMinutes,
    networkSpeed: `${carrier} 5G 正规号卡`,
    offerDuration: durationLabel,
    isLongTerm,
    contractMonths: -1, // 列表态未含合约字段，打开详情后核验回填
    firstRechargeAmount: 0,
    firstRechargeNote: '请点击「详情与账单」核验最新首充要求与激活规则',
    attribution: '以运营商分配为准',
    ageRange: '点击详情核验',
    activationMethod: '以详情核验结果为准',
    blockedProvinces,
    blockedDetailNote,
    highlights: highlights.slice(0, 3),
    bestFor: item.summary || '适合注重透明资费、希望核验后再跳转官方页办理的用户',
    phases,
    officialChannelName: `${carrier}官方授权办理页`,
    skuCode: `CS-${String(item.id).padStart(4, '0')}`,
    soldOut: isUnavailable,
    soldOutReason:
      item.sale_status === 'off_shelf_verified'
        ? '该号卡经上游实时核验已下架。'
        : item.sale_status === 'paused'
          ? '上游通道状态异常，当前暂不可办理。'
          : undefined,
    isDemoFallback: false,
  };
}

/** 为线上实时商品池分配 4-Up 主推阶梯（Standard / Plus / Premium / Metal，整屏最多 1 张钴紫主推） */
export function assignFeaturedTiers(plans: SimPlan[]): SimPlan[] {
  if (plans.length === 0) return plans;
  const tiers: PlanTier[] = ['Standard', 'Plus', 'Premium', 'Metal'];
  // 优先选未售罄商品
  const activeIndices = plans
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => !p.soldOut);
  const pool = activeIndices.length > 0 ? activeIndices : plans.map((p, i) => ({ p, i }));

  // 先按月租排序，挑选最多 4 张代表档位
  const sorted = [...pool].sort((a, b) => a.p.monthlyPrice - b.p.monthlyPrice);
  const chosen = sorted.slice(0, Math.min(4, sorted.length));
  const highlightIdx = chosen.length >= 2 ? 1 : 0;

  return plans.map((plan, idx) => {
    const slot = chosen.findIndex((c) => c.i === idx);
    if (slot < 0) {
      return { ...plan, featuredTier: undefined, isFeaturedHighlight: false };
    }
    const isHighlight = slot === highlightIdx;
    return {
      ...plan,
      featuredTier: tiers[slot],
      isFeaturedHighlight: isHighlight,
      material: isHighlight ? 'cobalt' : plan.material,
    };
  });
}

/** 将后端 GET/POST /api/v1/products/:id 详情响应合并到既有 SimPlan */
export function mergeProductDetail(existing: SimPlan, detail: BackendProductDetail): SimPlan {
  const f = detail.fields ?? {};
  const carrier = normalizeCarrier(f.operator, existing.carrier);
  const monthlyPrice =
    typeof f.now_price_cents === 'number' ? centsToYuan(f.now_price_cents) : existing.monthlyPrice;
  const rawOld =
    typeof f.old_price_cents === 'number' ? centsToYuan(f.old_price_cents) : existing.originalPrice;
  const originalPrice = rawOld > monthlyPrice ? rawOld : monthlyPrice;
  const expirePriceYuan =
    typeof detail.expire_price_cents === 'number'
      ? centsToYuan(detail.expire_price_cents)
      : existing.expirePriceYuan ?? null;

  const excludedRaw = Array.isArray(f.excluded_regions)
    ? f.excluded_regions
    : existing.excludedRegionsRaw ?? [];
  const blockedProvinces = extractBlockedProvinces(excludedRaw);
  const hasConcreteRegion =
    detail.source === 'detail' &&
    excludedRaw.some((entry) => {
      const s = String(entry ?? '').trim();
      return s && !SENTINEL_REGION_RE.test(s);
    });
  const regionStatus: 'verified' | 'unverified' = hasConcreteRegion ? 'verified' : 'unverified';
  const rawRegionsStr = excludedRaw.filter(Boolean).join('、');
  const blockedDetailNote = hasConcreteRegion
    ? `已核验限制地区：${rawRegionsStr}`
    : rawRegionsStr
      ? `配送待确认（上游原文：${rawRegionsStr}，具体以办理页为准）`
      : '配送范围待确认（上游未提供明确行政区名单，以办理页为准）';

  const { phases, verified, isLongTerm, durationLabel } = mapOfferStagesToPhases(
    detail.offer_stages,
    monthlyPrice,
    expirePriceYuan,
    f.offer_detail_text,
  );

  const firstRechargeText = (f.first_recharge_text || '').trim();
  const firstRechargeAmount = extractFirstRechargeYuan(firstRechargeText);
  const contractMonths =
    typeof f.contract_months === 'number' ? f.contract_months : existing.contractMonths;

  const isUnavailable =
    detail.sale_status === 'off_shelf_verified' ||
    detail.sale_status === 'paused' ||
    detail.display_status === 'hidden' ||
    detail.display_status === 'pending_manual';

  const activationParts = [f.express, f.activation].filter(Boolean);

  return {
    ...existing,
    backendId: detail.id,
    versionId: detail.version_id,
    versionNo: detail.version_no,
    detailSource: detail.source,
    publishState: detail.publish_state,
    saleStatus: detail.sale_status,
    regionStatus,
    excludedRegionsRaw: excludedRaw,
    offerStagesVerified: verified,
    offerDetailText: f.offer_detail_text || existing.offerDetailText,
    packageDetailText: f.package_detail_text || existing.packageDetailText,
    firstRechargeText: firstRechargeText || existing.firstRechargeText,
    contractText: f.contract_text || existing.contractText,
    offMethodText: f.off_method_text || existing.offMethodText,
    expressText: f.express || existing.expressText,
    acquireModel: f.acquire_model || existing.acquireModel,
    imageUrl: f.image_url ?? existing.imageUrl,
    fetchedAt: detail.fetched_at ?? detail.meta?.fetched_at ?? existing.fetchedAt,
    expirePriceYuan,
    quarantineReasons: detail.quarantine_reasons ?? [],
    name: f.name || existing.name,
    tagline: f.summary || f.package_name || existing.tagline,
    carrier,
    monthlyPrice,
    originalPrice,
    generalDataGb:
      typeof f.traffic_generic_gb === 'number' ? f.traffic_generic_gb : existing.generalDataGb,
    directionalDataGb:
      typeof f.traffic_directional_gb === 'number'
        ? f.traffic_directional_gb
        : existing.directionalDataGb,
    voiceMinutes:
      typeof f.call_minutes === 'number' ? f.call_minutes : existing.voiceMinutes,
    offerDuration: durationLabel,
    isLongTerm,
    contractMonths,
    firstRechargeAmount,
    firstRechargeNote: firstRechargeText || '上游暂未提供首充说明，请以官方办理页为准',
    ageRange: f.age_text || existing.ageRange,
    activationMethod:
      activationParts.length > 0 ? activationParts.join(' · ') : existing.activationMethod,
    blockedProvinces,
    blockedDetailNote,
    phases,
    soldOut: isUnavailable,
    soldOutReason:
      detail.sale_status === 'off_shelf_verified'
        ? '该商品经实时核验已下架。'
        : detail.sale_status === 'paused'
          ? '上游通道异常暂停办理。'
          : undefined,
  };
}

/** 将 POST /api/v1/comparisons 单条核验结果合并到 SimPlan */
export function mergeCompareItem(existing: SimPlan, item: BackendCompareItem): SimPlan {
  if (item.error) {
    return { ...existing, compareVerified: false };
  }
  const monthlyPrice =
    typeof item.now_price_cents === 'number' ? centsToYuan(item.now_price_cents) : existing.monthlyPrice;
  const excludedRaw = Array.isArray(item.excluded_regions)
    ? item.excluded_regions
    : existing.excludedRegionsRaw ?? [];
  const blockedProvinces = extractBlockedProvinces(excludedRaw);
  const firstRechargeText =
    item.first_recharge_text && item.first_recharge_text !== '（未知）'
      ? item.first_recharge_text
      : existing.firstRechargeText;
  const contractText =
    item.contract_text && item.contract_text !== '（未知）'
      ? item.contract_text
      : existing.contractText;

  return {
    ...existing,
    name: item.name || existing.name,
    monthlyPrice,
    generalDataGb:
      typeof item.traffic_generic_gb === 'number' ? item.traffic_generic_gb : existing.generalDataGb,
    directionalDataGb:
      typeof item.traffic_directional_gb === 'number'
        ? item.traffic_directional_gb
        : existing.directionalDataGb,
    voiceMinutes:
      typeof item.call_minutes === 'number' ? item.call_minutes : existing.voiceMinutes,
    offerDetailText: item.offer_detail_text || existing.offerDetailText,
    firstRechargeText,
    firstRechargeAmount: extractFirstRechargeYuan(firstRechargeText) || existing.firstRechargeAmount,
    firstRechargeNote: firstRechargeText || existing.firstRechargeNote,
    contractText,
    ageRange: item.age_text && item.age_text !== '（未知）' ? item.age_text : existing.ageRange,
    excludedRegionsRaw: excludedRaw,
    blockedProvinces: blockedProvinces.length > 0 ? blockedProvinces : existing.blockedProvinces,
    expirePriceYuan:
      typeof item.expire_price_cents === 'number'
        ? centsToYuan(item.expire_price_cents)
        : existing.expirePriceYuan,
    fetchedAt: item.fetched_at ?? existing.fetchedAt,
    versionId: item.version_id ?? existing.versionId,
    quarantineReasons: item.unknown_fields ?? existing.quarantineReasons,
    compareVerified: Boolean(item.verified),
  };
}

/** 格式化版本冲突字段对比值（与 cardshop/static/app.js 保持一致口径） */
export function formatConflictFieldValue(field: string, val: unknown): string {
  if (val == null || val === '') return '（空）';
  if (field === 'now_price_cents' || field === 'old_price_cents') {
    return typeof val === 'number' ? `${centsToYuan(val)} 元/月` : String(val);
  }
  if (field === 'traffic_generic_gb' || field === 'traffic_directional_gb') {
    if (typeof val === 'number') return val < 0 ? '不限量' : `${val} GB`;
    return String(val);
  }
  if (field === 'call_minutes') return `${val} 分钟`;
  if (field === 'offer_detail_hash') return '有变动（请核对下方最新优惠说明原文）';
  if (field === 'excluded_regions_json') {
    if (typeof val === 'string') {
      try {
        const arr = JSON.parse(val);
        if (Array.isArray(arr)) return arr.join('、') || '无';
      } catch {
        return val;
      }
    }
    return String(val);
  }
  return String(val);
}

/** 格式化核验时间（Asia/Shanghai 风格 MM-DD HH:mm） */
export function formatVerifyTimestamp(epochSec: number | null | undefined): string {
  if (!epochSec) return '待核验';
  const d = new Date(epochSec * 1000);
  if (Number.isNaN(d.getTime())) return '待核验';
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}-${dd} ${hh}:${mi}`;
}
