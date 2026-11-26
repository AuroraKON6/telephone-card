/** 运营商类型 */
export type Carrier = '中国电信' | '中国联通' | '中国移动' | '中国广电';

/** Revolut 风格套餐层级标签（用于主推 4-up 阶梯区） */
export type PlanTier = 'Standard' | 'Plus' | 'Premium' | 'Metal';

/** 实体 SIM 卡面视觉材质（严格限定于产品模型插画，绝不用作按钮背景） */
export type CardMaterial = 'obsidian' | 'cobalt' | 'metal' | 'emerald' | 'crimson';

/** 后端连接运行模式 */
export type BackendMode = 'connecting' | 'live' | 'connected_empty' | 'offline';

/** 分阶段资费明细，彻底杜绝“首月低价套路” */
export interface OfferPhase {
  /** 阶段名称，如“第 1 个月”、“第 2–24 个月”、“第 25 个月起” */
  period: string;
  /** 起始月（1-based） */
  startMonth: number;
  /** 结束月（null 表示长期自动续约/保持） */
  endMonth: number | null;
  /** 实际月租（元）；0 表示免租，若为首月按天折算则在 note 中注明 */
  monthlyPrice: number;
  /** 是否为首月按天折算（真实金额随激活日期变化） */
  isProration?: boolean;
  /** 阶段说明，如“激活赠体验金抵扣首月月租” */
  note: string;
}

/** 单款号卡产品数据结构（同时兼容真实 cardshop 后端与本地演示回退） */
export interface SimPlan {
  id: string;
  /** 套餐名称 */
  name: string;
  /** 副标题/一句话定位 */
  tagline: string;
  /** 所属运营商 */
  carrier: Carrier;
  /** 若属于首页主推 4-up 阶梯，则标识其档位 */
  featuredTier?: PlanTier;
  /** 是否为整屏唯一钴紫主推卡（plan-card-featured） */
  isFeaturedHighlight?: boolean;
  /** 卡片实体视觉材质 */
  material: CardMaterial;
  /** 优惠期月租（元） */
  monthlyPrice: number;
  /** 官方原套餐月租（元） */
  originalPrice: number;
  /** 通用流量（GB），-1 表示运营商标称不限量 */
  generalDataGb: number;
  /** 定向流量（GB），-1 表示不限量 */
  directionalDataGb: number;
  /** 语音通话分钟数（0 表示无赠送分钟或按 0.1 元/分钟计费） */
  voiceMinutes: number;
  /** 5G 速率/网络说明 */
  networkSpeed: string;
  /** 优惠周期文案 */
  offerDuration: string;
  /** 是否属于长期优惠 */
  isLongTerm: boolean;
  /** 合约期（月），0 表示无合约，-1 表示待核验 */
  contractMonths: number;
  /** 首充金额门槛（元），0 表示未提供/待核验 */
  firstRechargeAmount: number;
  /** 首充渠道说明 */
  firstRechargeNote: string;
  /** 归属地策略 */
  attribution: string;
  /** 办理年龄范围 */
  ageRange: string;
  /** 配送与激活方式 */
  activationMethod: string;
  /** 禁发省份（精确省名，用于实时禁发检测） */
  blockedProvinces: string[];
  /** 禁发地补充说明 */
  blockedDetailNote: string;
  /** 核心卖点标签（最多 3 条） */
  highlights: string[];
  /** 适合人群 */
  bestFor: string;
  /** 分阶段资费时间轴 */
  phases: OfferPhase[];
  /** 官方渠道名称说明 */
  officialChannelName: string;
  /** 渠道套餐编码 */
  skuCode: string;
  /** 定向流量覆盖 App 示例 */
  directionalApps?: string;
  /** 是否本期已售罄 / 通道临时下架（点击办理时自动触发 404 5 掉落替代推荐页） */
  soldOut?: boolean;
  /** 售罄原因补充说明 */
  soldOutReason?: string;

  // ===== 真实 cardshop 后端扩展字段 =====
  /** cardshop 后端数据库主键 ID（存在即代表来自服务器真实商品池） */
  backendId?: number;
  /** 当前展示对应的后端版本 ID（办理校验必传） */
  versionId?: number | null;
  /** 当前后端版本号（v1 / v2...） */
  versionNo?: number | null;
  /** 当前数据来源：list（目录快照）或 detail（已核验详情） */
  detailSource?: 'list' | 'detail';
  /** 后端发布状态（published / quarantine / none） */
  publishState?: string;
  /** 后端在售状态（on_sale / off_shelf_verified / paused / unknown） */
  saleStatus?: string;
  /** 配送范围核验状态：unverified 时绝不推断“全国可发” */
  regionStatus?: 'verified' | 'unverified';
  /** 上游原始限制地区数组 */
  excludedRegionsRaw?: string[];
  /** 分阶段资费是否由后端 offer_stages 交叉印证生成 */
  offerStagesVerified?: boolean;
  /** 后端已核验优惠说明原文 */
  offerDetailText?: string;
  /** 后端原套餐说明原文 */
  packageDetailText?: string;
  /** 后端首充说明原文 */
  firstRechargeText?: string;
  /** 后端合约说明原文 */
  contractText?: string;
  /** 后端销户说明原文 */
  offMethodText?: string;
  /** 后端快递说明 */
  expressText?: string;
  /** 后端办理模式 */
  acquireModel?: string;
  /** 上游商品图 */
  imageUrl?: string | null;
  /** 最后核验时间戳（秒） */
  fetchedAt?: number | null;
  /** 已确认的到期后月租（元，null 表示未知或未变价） */
  expirePriceYuan?: number | null;
  /** 待核验/隔离原因清单 */
  quarantineReasons?: string[];
  /** 对比核验状态（来自 POST /api/v1/comparisons） */
  compareVerified?: boolean;
  /** 是否为渠道未配置时的本地演示回退卡 */
  isDemoFallback?: boolean;
}

export interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
}

export interface GuideTile {
  id: string;
  title: string;
  subtitle: string;
  tag: string;
  steps: string[];
  notice: string;
}

export interface AdvisorMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** 若触发隐私拦截，显示合规提醒样式 */
  isPrivacyWarning?: boolean;
  /** 推荐的号卡 ID 列表 */
  recommendedIds?: string[];
  /** 后端返回的会话处理结果标记 */
  outcome?: string;
  /** 来源标签（如“服务器 AI 核验”/“服务器 FAQ 兜底”/“本地演示”） */
  sourceLabel?: string;
  timestamp: string;
}

export type SortMode = 'recommend' | 'price-asc' | 'data-desc' | 'unit-cost';
export type QuickTag = 'all' | 'under-30' | 'long-term' | 'big-data' | 'no-contract' | 'with-voice';
