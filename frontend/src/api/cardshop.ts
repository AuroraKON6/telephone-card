/** cardshop FastAPI 后端类型化客户端（零轮询 · 同源/代理直连）
 * 严格遵循后端安全与合规红线：
 * - GET 只读缓存（peek），POST 显式触发受限刷新
 * - purchase-intents 只发送 { product_id, seen_version_id }，绝不传客户端 URL
 * - support-tickets 只发送枚举 category，绝不提交自由文本 PII
 */

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/+$/, '') ?? '';

export class CardshopApiError extends Error {
  status: number;
  detail: string;
  payload: unknown;

  constructor(status: number, detail: string, payload?: unknown) {
    super(detail || `HTTP ${status}`);
    this.name = 'CardshopApiError';
    this.status = status;
    this.detail = detail;
    this.payload = payload;
  }
}

export interface CatalogMeta {
  state: 'fresh' | 'stale' | 'expired' | 'missing' | string;
  error_class: string | null;
  fetched_at: number | null;
  stale_until: number | null;
  content_version: number | null;
  job: {
    id: number;
    status: string;
    error_code: string | null;
    updated_at: number;
  } | null;
  triggered_refresh: boolean;
}

export interface BackendCardItem {
  id: number;
  name: string;
  operator: string;
  summary: string;
  now_price_cents: number | null;
  old_price_cents: number | null;
  traffic_generic_gb: number | null;
  traffic_directional_gb: number | null;
  call_minutes: number | null;
  image_url: string | null;
  tags: string[];
  featured: boolean;
  display_status: string;
  hidden: boolean;
  version_id: number | null;
  publish_state: string;
  sale_status: string;
  excluded_regions: string[];
  region_status: 'verified' | 'unverified';
  expire_price_cents: number | null;
}

export interface CatalogResponse {
  params: {
    category: string;
    page: number;
    limit: number;
    title: string;
    province: string;
    city: string;
  };
  products: BackendCardItem[];
  has_more: boolean;
  meta: CatalogMeta;
}

export interface BackendOfferStage {
  kind: 'proration' | 'range' | 'from' | string;
  start: number;
  end: number | null;
  label: string;
  price_cents: number | null;
  note: string;
  final: boolean;
  permanent: boolean;
}

export interface BackendProductDetail {
  id: number;
  upstream_ref?: string;
  fields: {
    name?: string;
    operator?: string;
    summary?: string;
    now_price_cents?: number | null;
    old_price_cents?: number | null;
    traffic_generic_gb?: number | null;
    traffic_directional_gb?: number | null;
    call_minutes?: number | null;
    age_min?: number | null;
    age_max?: number | null;
    age_text?: string;
    image_url?: string | null;
    tags?: string[];
    package_name?: string;
    package_detail_text?: string;
    offer_detail_text?: string;
    first_recharge_text?: string;
    contract_text?: string;
    contract_months?: number | null;
    excluded_regions?: string[];
    express?: string;
    activation?: string;
    off_method_text?: string;
    acquire_model?: string;
  };
  version_id: number | null;
  version_no: number | null;
  source: 'list' | 'detail';
  offer_stages: BackendOfferStage[] | null;
  expire_price_cents: number | null;
  publish_state: string;
  quote_eligible: boolean;
  quarantine_reasons: string[];
  display_status: string;
  sale_status: string;
  fetched_at: number | null;
  link_status?: string | null;
  meta: CatalogMeta;
}

export interface BackendCompareItem {
  id: number;
  error?: string;
  name?: string;
  now_price_cents?: number | null;
  traffic_generic_gb?: number | null;
  traffic_directional_gb?: number | null;
  call_minutes?: number | null;
  offer_detail_text?: string;
  first_recharge_text?: string;
  contract_text?: string;
  age_text?: string;
  excluded_regions?: string[];
  expire_price_cents?: number | null;
  unknown_fields?: string[];
  verified?: boolean;
  fetched_at?: number | null;
  version_id?: number | null;
}

export interface ComparisonResponse {
  items: BackendCompareItem[];
  max_products: number;
  error?: string;
}

export interface ChangedDetailItem {
  field: string;
  label: string;
  old: unknown;
  new: unknown;
}

export type PurchaseIntentResponse =
  | {
      action: 'h5_redirect';
      url: string;
      version_id: number | null;
      notice: string;
    }
  | {
      action: 'unavailable';
      reason: string;
    }
  | {
      action: 'version_conflict';
      reason: string;
      changed_fields: string[];
      changed_details: ChangedDetailItem[];
      new_version: {
        name?: string;
        now_price_cents?: number | null;
        traffic_generic_gb?: number | null;
        call_minutes?: number | null;
        first_recharge_text?: string;
        offer_detail_text?: string;
        contract_text?: string;
        age_text?: string;
        excluded_regions?: string[];
      };
      current_version_id: number | null;
    }
  | {
      action: 'verify_failed';
      reason: string;
      error_class?: string | null;
      retry_after?: number;
    }
  | {
      action: 'not_found';
      reason?: string;
    };

export interface ChatMessageResponse {
  reply: string;
  outcome: 'answered' | 'refused' | 'refused_product' | 'partial' | 'superseded' | 'fallback' | string;
  refs?: Array<{ product_id: number; version_id: number }>;
  session_token: string;
}

export type SupportTicketCategory = '人工咨询' | '商品问题' | '办理问题' | '投诉建议';

export interface SupportTicketResponse {
  ticket_no: string;
  hint: string;
}

export interface HealthReadyResponse {
  status: string;
}

async function requestJson<T>(path: string, init?: RequestInit, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init?.headers ?? {}),
      },
    });
    const text = await resp.text();
    let data: unknown = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { detail: text };
      }
    }
    if (!resp.ok) {
      const detail =
        typeof (data as { detail?: unknown })?.detail === 'string'
          ? (data as { detail: string }).detail
          : resp.statusText || `HTTP ${resp.status}`;
      throw new CardshopApiError(resp.status, detail, data);
    }
    return data as T;
  } finally {
    window.clearTimeout(timer);
  }
}

/** 后端就绪探针 */
export async function checkBackendHealth(): Promise<{ ok: boolean; latencyMs: number }> {
  const start = performance.now();
  try {
    const res = await requestJson<HealthReadyResponse>('/health/ready', { method: 'GET' }, 6000);
    return {
      ok: res.status === 'ok',
      latencyMs: Math.max(1, Math.round(performance.now() - start)),
    };
  } catch {
    return {
      ok: false,
      latencyMs: Math.max(1, Math.round(performance.now() - start)),
    };
  }
}

/** 只读缓存目录（GET /api/v1/catalog，不触发上游请求） */
export async function peekCatalog(
  category: string,
  page = 1,
  limit = 20,
  title = '',
): Promise<CatalogResponse> {
  const qs = new URLSearchParams({
    category,
    page: String(page),
    limit: String(limit),
    title,
  });
  return requestJson<CatalogResponse>(`/api/v1/catalog?${qs.toString()}`, { method: 'GET' }, 8000);
}

/** 显式受限刷新目录（POST /api/v1/catalog/refresh） */
export async function refreshCatalog(
  category: string,
  page = 1,
  limit = 20,
  title = '',
): Promise<CatalogResponse> {
  return requestJson<CatalogResponse>(
    '/api/v1/catalog/refresh',
    {
      method: 'POST',
      body: JSON.stringify({ category, page, limit, title }),
    },
    35000,
  );
}

/** 读取由 Nginx 暴露的非敏感公共站点配置（来自 /etc/cardshop/cardshop.toml 公开字段） */
export interface PublicSiteConfig {
  public_categories?: string[];
  brand_name?: string;
  site_notice?: string;
  manual_service_entry?: string;
  order_query_entry?: string;
}

async function fetchPublicSiteConfig(): Promise<PublicSiteConfig | null> {
  try {
    return await requestJson<PublicSiteConfig>('/site-config.json', { method: 'GET' }, 4000);
  } catch {
    return null;
  }
}

/** 获取后端在 cardshop.toml 中已开放的 public_categories（优先读 /site-config.json 零 400 探测） */
export const CANDIDATE_CATEGORIES = ['联通', '电信', '移动', '广电'] as const;

export async function discoverPublicCategories(): Promise<{
  categories: string[];
  peeks: Record<string, CatalogResponse>;
  siteConfig: PublicSiteConfig | null;
}> {
  const siteConfig = await fetchPublicSiteConfig();
  const targetCategories =
    Array.isArray(siteConfig?.public_categories) && siteConfig.public_categories.length > 0
      ? siteConfig.public_categories
      : ['联通'];

  const peeks: Record<string, CatalogResponse> = {};
  const categories: string[] = [];

  const results = await Promise.allSettled(
    targetCategories.map(async (cat) => {
      const res = await peekCatalog(cat, 1, 20, '');
      return { cat, res };
    }),
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      categories.push(r.value.cat);
      peeks[r.value.cat] = r.value.res;
    }
  }
  return { categories, peeks, siteConfig };
}

/** 只读缓存详情（GET /api/v1/products/:id） */
export async function peekProduct(productId: number): Promise<BackendProductDetail> {
  return requestJson<BackendProductDetail>(`/api/v1/products/${productId}`, { method: 'GET' }, 8000);
}

/** 按需核验单商品最新详情（POST /api/v1/products/:id/refresh） */
export async function refreshProduct(productId: number): Promise<BackendProductDetail> {
  return requestJson<BackendProductDetail>(
    `/api/v1/products/${productId}/refresh`,
    {
      method: 'POST',
      body: JSON.stringify({}),
    },
    35000,
  );
}

/** 多卡对比核验（POST /api/v1/comparisons，后端限制最多 3 款） */
export async function compareProducts(productIds: number[]): Promise<ComparisonResponse> {
  const ids = Array.from(new Set(productIds)).slice(0, 3);
  return requestJson<ComparisonResponse>(
    '/api/v1/comparisons',
    {
      method: 'POST',
      body: JSON.stringify({ product_ids: ids }),
    },
    35000,
  );
}

/** 办理前 15 秒实时核验与 H5 链接签发（POST /api/v1/purchase-intents） */
export async function createPurchaseIntent(
  productId: number,
  seenVersionId: number | null,
): Promise<PurchaseIntentResponse> {
  return requestJson<PurchaseIntentResponse>(
    '/api/v1/purchase-intents',
    {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        seen_version_id: seenVersionId,
      }),
    },
    35000,
  );
}

/** 服务器 AI 顾问对话（POST /api/v1/chat/messages） */
export async function sendChatMessage(params: {
  session_token?: string;
  text: string;
  product_ids?: number[];
}): Promise<ChatMessageResponse> {
  return requestJson<ChatMessageResponse>(
    '/api/v1/chat/messages',
    {
      method: 'POST',
      body: JSON.stringify({
        session_token: params.session_token || null,
        text: params.text.slice(0, 500),
        product_ids: (params.product_ids ?? []).slice(0, 3),
      }),
    },
    38000,
  );
}

/** 生成服务端工单（POST /api/v1/support-tickets，仅发送枚举类别，严格零 PII） */
export async function createSupportTicket(params: {
  category: SupportTicketCategory;
  session_token?: string;
}): Promise<SupportTicketResponse> {
  return requestJson<SupportTicketResponse>(
    '/api/v1/support-tickets',
    {
      method: 'POST',
      body: JSON.stringify({
        category: params.category,
        session_token: params.session_token || null,
      }),
    },
    12000,
  );
}
