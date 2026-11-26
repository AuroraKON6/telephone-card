<script setup lang="ts">
/* Ecommerce 13 风格合规跳转确认与号卡选配弹窗 + 成功后可撕下热敏出票机（ReceiptPrinter）
 * 左侧：4 视角缩略图交互画廊（实景 3D 卡面 / 24 期明账 / 三合一卡板 / 合规激活流程）
 * 右侧：首充优惠 vs 官方原价双模式（含首充档位）、4 档卡型/激活偏好选择器、合规份数步进器（1~2 张）
 * 合规红线：零实名信息收集、¥0 购卡费，确认后立即打印热敏办理核验凭证
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Check,
  CheckCircle2,
  Cpu,
  Loader2,
  Minus,
  PackageCheck,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  UserCheck,
  Wifi,
  X,
} from 'lucide-vue-next';
import { CardshopApiError, type PurchaseIntentResponse } from '@/api/cardshop';
import { formatConflictFieldValue } from '@/adapters/cardshopAdapter';
import { CARRIER_META } from '@/data/plans';
import {
  calc24MonthTotal,
  calcEffectiveMonthly,
  calcPricePerGb,
  isBlockedInProvince,
  useStorefront,
} from '@/composables/useStorefront';
import { triggerSpark } from '@/composables/useSpark';
import SimCardVisual from './SimCardVisual.vue';
import ReceiptPrinter from './fx/ReceiptPrinter.vue';

const {
  activeApplyPlan,
  selectedProvince,
  closeApply,
  openSoldOut,
  verifyPurchaseIntent,
  showToast,
} = useStorefront();

type GallerySlideId = 'card' | 'timeline' | 'kit' | 'process';
type PlanMode = 'promo' | 'standard';
type SimOptionId = 'triple' | 'self' | 'courier' | 'hotspot';

const completed = ref(false);
const hasTorn = ref(false);
const isVerifying = ref(false);
const verifyError = ref('');
const conflictData = ref<Extract<PurchaseIntentResponse, { action: 'version_conflict' }> | null>(null);
const verifiedRedirect = ref<{ url: string; versionId: number | null; notice: string } | null>(null);
const activeSlide = ref<GallerySlideId>('card');
const planMode = ref<PlanMode>('promo');
const rechargeTierIdx = ref<0 | 1>(0);
const selectedSimOption = ref<SimOptionId>('triple');
const quantity = ref(1);

watch(activeApplyPlan, (plan) => {
  completed.value = false;
  hasTorn.value = false;
  isVerifying.value = false;
  verifyError.value = '';
  conflictData.value = null;
  verifiedRedirect.value = null;
  activeSlide.value = 'card';
  planMode.value = 'promo';
  rechargeTierIdx.value = 0;
  quantity.value = 1;
  selectedSimOption.value = plan?.activationMethod.includes('上门') ? 'courier' : 'triple';
});

const gallerySlides: { id: GallerySlideId; label: string; short: string }[] = [
  { id: 'card', label: '实体卡面实景', short: '实景卡面' },
  { id: 'timeline', label: '24 个月账单透视', short: '24期明账' },
  { id: 'kit', label: '三合一卡板套件', short: '三合一卡板' },
  { id: 'process', label: '官方激活合规流', short: '激活流程' },
];

const simOptions: { id: SimOptionId; title: string; sub: string; icon: typeof Cpu }[] = [
  { id: 'triple', title: '三合一标准卡', sub: 'Nano / Micro 全适配', icon: Cpu },
  { id: 'self', title: '自主扫码激活', sub: '顺丰包邮到家自办', icon: PackageCheck },
  { id: 'courier', title: '上门协助激活', sub: '快递员现场核验', icon: UserCheck },
  { id: 'hotspot', title: '副卡 / 随身 WiFi', sub: '纯流量热点插槽', icon: Wifi },
];

const rechargeTiers = computed(() => {
  const plan = activeApplyPlan.value;
  if (!plan) return [];
  const base = plan.firstRechargeAmount;
  return [
    { amount: base, label: `首充 ¥${base}（达标档）` },
    { amount: base + 50, label: `首充 ¥${base + 50}（话费充裕）` },
  ];
});

const monthlySavings = computed(() => {
  const plan = activeApplyPlan.value;
  if (!plan) return 0;
  return Math.max(0, plan.originalPrice - plan.monthlyPrice);
});

const twoYearSavings = computed(() => {
  const plan = activeApplyPlan.value;
  if (!plan) return 0;
  return Math.max(0, plan.originalPrice * 24 - calc24MonthTotal(plan));
});

const activeDisplayPrice = computed(() => {
  const plan = activeApplyPlan.value;
  if (!plan) return 0;
  return planMode.value === 'promo' ? plan.monthlyPrice : plan.originalPrice;
});

/** 生成 24 个月微缩柱状图高度数据 */
const mini24Bars = computed(() => {
  const plan = activeApplyPlan.value;
  if (!plan) return [];
  const prices: number[] = [];
  for (let m = 1; m <= 24; m++) {
    const ph =
      plan.phases.find((p) => m >= p.startMonth && (p.endMonth === null || m <= p.endMonth)) ??
      plan.phases[plan.phases.length - 1];
    prices.push(ph ? ph.monthlyPrice : plan.monthlyPrice);
  }
  const maxP = Math.max(...prices, plan.originalPrice, 1);
  return prices.map((price, idx) => ({
    month: idx + 1,
    price,
    pct: price === 0 ? 10 : Math.max(18, Math.round((price / maxP) * 100)),
  }));
});

function adjustQuantity(delta: number) {
  quantity.value = Math.min(2, Math.max(1, quantity.value + delta));
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && activeApplyPlan.value) {
    closeApply();
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

async function confirmOrder(e: MouseEvent, overrideVersionId?: number | null) {
  const plan = activeApplyPlan.value;
  if (!plan || isVerifying.value) return;
  verifyError.value = '';

  // 真实服务器商品：调用 POST /api/v1/purchase-intents 执行 15 秒新鲜度核验并签发官方 H5 链接
  if (plan.backendId != null) {
    isVerifying.value = true;
    try {
      const res = await verifyPurchaseIntent(plan.id, overrideVersionId);
      if (!res) return;

      if (res.action === 'h5_redirect') {
        conflictData.value = null;
        verifiedRedirect.value = {
          url: res.url,
          versionId: res.version_id,
          notice: res.notice,
        };
        triggerSpark(e, ['#494fdf', '#00c495', '#ffffff']);
        completed.value = true;
        hasTorn.value = false;
        showToast('服务器实时核验通过，官方办理通道与热敏凭证已就绪');
        return;
      }

      if (res.action === 'version_conflict') {
        conflictData.value = res;
        showToast('检测到该号卡办理条件有最新变动，请核对后确认');
        return;
      }

      if (res.action === 'unavailable') {
        const pid = plan.id;
        closeApply();
        openSoldOut(pid);
        showToast(res.reason || '该商品刚刚下架，已为你切换替代推荐');
        return;
      }

      const retryText =
        res.action === 'verify_failed' && typeof res.retry_after === 'number' && res.retry_after > 0
          ? `（约 ${Math.ceil(res.retry_after)} 秒后可重试）`
          : '';
      verifyError.value = `${res.reason || '暂时无法完成 15 秒实时核验，请稍后再试'}${retryText}`;
      return;
    } catch (err) {
      if (err instanceof CardshopApiError && err.status === 429) {
        verifyError.value = '办理核验频率偏高，请稍等片刻后重试。';
      } else {
        verifyError.value = '连接服务器核验接口失败，请稍后重试。';
      }
      return;
    } finally {
      isVerifying.value = false;
    }
  }

  // 本地演示卡回退（渠道未配置 channel_token 时保留交互演示）
  triggerSpark(e, ['#494fdf', '#00c495', '#ffffff']);
  verifiedRedirect.value = null;
  completed.value = true;
  hasTorn.value = false;
  showToast('演示办理凭证已生成（服务器配置 channel_token 后将直连官方 H5 通道）');
}

function handleReceiptTorn() {
  hasTorn.value = true;
  showToast('已撕下号卡办理凭证，可复制保存或核对官方 SKU');
}

function handleReceiptCopied() {
  showToast('办理凭证摘要已复制到剪贴板');
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="activeApplyPlan"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-label="前往官方授权页办理确认"
        @click.self="closeApply"
      >
        <div
          class="modal-panel flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-xl bg-canvas-light text-ink transition-[max-width] duration-300"
          :class="completed ? 'max-w-lg' : 'max-w-5xl'"
        >
          <!-- 顶部精简导航条 -->
          <div class="flex flex-shrink-0 items-center justify-between border-b border-hairline-light px-5 py-3.5 sm:px-7">
            <div class="flex min-w-0 items-center gap-2.5">
              <span
                class="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                :style="{ backgroundColor: CARRIER_META[activeApplyPlan.carrier].dotColor }"
              />
              <p class="truncate text-[12px] font-semibold uppercase tracking-[0.12em] text-mute">
                {{
                  completed
                    ? 'ORDER VOUCHER · 申领凭证已出票'
                    : `OFFICIAL REDIRECT · ${activeApplyPlan.officialChannelName}`
                }}
              </p>
              <span
                v-if="!completed"
                class="hidden rounded-full bg-surface-soft px-2.5 py-0.5 text-[11px] font-semibold text-charcoal tabular sm:inline-block"
              >
                SKU {{ activeApplyPlan.skuCode }}
              </span>
            </div>

            <button
              type="button"
              class="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-soft text-ink transition-colors hover:bg-[#e6e6eb]"
              aria-label="关闭弹窗"
              @click="closeApply"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <!-- 主体内容区（可滚动防矮屏溢出） -->
          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
            <!-- ===== 步骤一：Ecommerce 13 双栏商品画廊 + 选配确认页 ===== -->
            <div
              v-if="!completed"
              class="grid grid-cols-1 gap-7 lg:grid-cols-12 lg:gap-9"
            >
              <!-- 左栏（5列）：主展台 + 4 视角缩略图画廊 -->
              <div class="flex flex-col lg:col-span-5">
                <!-- 主视觉展台（雕塑半透明磨砂玻璃） -->
                <div class="ns-frosted-card-light relative flex min-h-[300px] flex-1 flex-col justify-between overflow-hidden p-5 sm:min-h-[350px] sm:p-6">
                  <div class="flex items-center justify-between gap-2">
                    <span class="rounded-full bg-canvas-light px-3 py-1 text-[11px] font-semibold text-ink">
                      {{ gallerySlides.find((s) => s.id === activeSlide)?.label }}
                    </span>
                    <span class="inline-flex items-center gap-1 rounded-full bg-accent-light-green/15 px-2.5 py-1 text-[11px] font-semibold text-accent-green-text">
                      <ShieldCheck class="h-3.5 w-3.5" />
                      <span>官方核验</span>
                    </span>
                  </div>

                  <!-- 视角 1：3D 实体金属卡面 -->
                  <div v-if="activeSlide === 'card'" class="my-auto py-5">
                    <div class="mx-auto max-w-[330px]">
                      <SimCardVisual
                        :material="activeApplyPlan.material"
                        :name="activeApplyPlan.name"
                        :carrier="activeApplyPlan.carrier"
                        :monthly-price="activeDisplayPrice"
                        :general-data-gb="activeApplyPlan.generalDataGb"
                        :voice-minutes="activeApplyPlan.voiceMinutes"
                        :sku-code="activeApplyPlan.skuCode"
                        compact
                      />
                    </div>
                  </div>

                  <!-- 视角 2：24 个月账单微缩柱状图 -->
                  <div v-else-if="activeSlide === 'timeline'" class="my-auto py-4">
                    <div class="rounded-lg border border-hairline-light bg-canvas-light p-4">
                      <div class="flex items-baseline justify-between">
                        <div>
                          <div class="text-[11px] font-semibold uppercase tracking-wider text-mute">
                            24 个月总实付估算
                          </div>
                          <div class="mt-0.5 font-display text-[28px] font-medium text-ink tabular">
                            ¥{{ calc24MonthTotal(activeApplyPlan) }}
                          </div>
                        </div>
                        <div class="text-right tabular">
                          <div class="text-[12px] font-semibold text-primary">
                            均 ¥{{ calcEffectiveMonthly(activeApplyPlan) }}/月
                          </div>
                          <div class="text-[11px] text-mute">
                            ¥{{ calcPricePerGb(activeApplyPlan) }}/GB
                          </div>
                        </div>
                      </div>

                      <div class="mt-4 flex h-24 items-end gap-1">
                        <div
                          v-for="bar in mini24Bars"
                          :key="bar.month"
                          class="flex-1 rounded-t-sm transition-all"
                          :class="
                            bar.price === 0
                              ? 'bg-accent-teal'
                              : bar.price <= activeApplyPlan.monthlyPrice
                                ? 'bg-primary'
                                : 'bg-stone/50'
                          "
                          :style="{ height: `${bar.pct}%` }"
                          :title="`第 ${bar.month} 月：¥${bar.price}`"
                        />
                      </div>
                      <div class="mt-2 flex justify-between text-[11px] text-mute tabular">
                        <span>第 1 月</span>
                        <span>第 12 月</span>
                        <span>第 24 月</span>
                      </div>
                    </div>
                  </div>

                  <!-- 视角 3：三合一卡板实物套件示意图 -->
                  <div v-else-if="activeSlide === 'kit'" class="my-auto py-4">
                    <div class="mx-auto max-w-[300px] rounded-lg border border-hairline-light bg-canvas-light p-5">
                      <div class="flex items-center justify-between text-[11px] font-semibold text-mute">
                        <span>TRIPLE-CUT SIM KIT</span>
                        <span>免邮寄送</span>
                      </div>
                      <div class="mt-4 flex items-center justify-center gap-4">
                        <!-- 三合一卡板 SVG -->
                        <svg class="h-24 w-36 text-ink" viewBox="0 0 150 96" fill="none" aria-hidden="true">
                          <rect x="2" y="2" width="146" height="92" rx="10" fill="#f5f6f8" stroke="#d1d5db" stroke-width="1.6" />
                          <rect x="16" y="14" width="76" height="68" rx="6" fill="#ffffff" stroke="#9ca3af" stroke-dasharray="3 2" />
                          <rect x="24" y="22" width="52" height="48" rx="5" fill="#f9fafb" stroke="#6b7280" stroke-dasharray="3 2" />
                          <rect x="32" y="30" width="32" height="30" rx="4" fill="#e8c888" stroke="#8a6c37" stroke-width="1.2" />
                          <path d="M42 30V60M54 30V60M32 45H64" stroke="#6b4e1d" stroke-width="1" opacity="0.55" />
                          <circle cx="118" cy="34" r="10" stroke="#494fdf" stroke-width="1.8" />
                          <path d="M118 44V76" stroke="#494fdf" stroke-width="2" stroke-linecap="round" />
                        </svg>
                      </div>
                      <p class="mt-3 text-center text-[12px] text-mute">
                        内含标准 / Micro / Nano 三合一卡板与取卡针，兼容全部 5G 手机与随身 WiFi
                      </p>
                    </div>
                  </div>

                  <!-- 视角 4：合规办理 3 步流程 -->
                  <div v-else class="my-auto py-3">
                    <ol class="space-y-3 rounded-lg border border-hairline-light bg-canvas-light p-4 text-[13px]">
                      <li class="flex items-start gap-2.5">
                        <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">1</span>
                        <div>
                          <div class="font-semibold text-ink">打印核验凭证并跳转官方页</div>
                          <div class="text-[12px] text-mute">核对 SKU {{ activeApplyPlan.skuCode }}，站内不留存任何实名信息</div>
                        </div>
                      </li>
                      <li class="flex items-start gap-2.5">
                        <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white">2</span>
                        <div>
                          <div class="font-semibold text-ink">运营商审核制卡免费包邮</div>
                          <div class="text-[12px] text-mute">{{ activeApplyPlan.activationMethod }}</div>
                        </div>
                      </li>
                      <li class="flex items-start gap-2.5">
                        <span class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">3</span>
                        <div>
                          <div class="font-semibold text-ink">激活后完成首充立即生效</div>
                          <div class="text-[12px] text-mute">一次性充值 ¥{{ activeApplyPlan.firstRechargeAmount }} 全额入话费余额</div>
                        </div>
                      </li>
                    </ol>
                  </div>

                  <div class="flex items-center justify-between text-[12px] text-mute tabular">
                    <span>{{ activeApplyPlan.generalDataGb }}GB 通用高速</span>
                    <span>{{ activeApplyPlan.offerDuration }}</span>
                  </div>
                </div>

                <!-- 4-Up 缩略图切换条（Ecommerce 13 Thumbnail Gallery） -->
                <div class="mt-3 grid grid-cols-4 gap-2">
                  <button
                    v-for="slide in gallerySlides"
                    :key="slide.id"
                    type="button"
                    class="flex flex-col items-center justify-center gap-1 rounded-lg border px-2 py-2.5 text-center transition-all"
                    :class="
                      activeSlide === slide.id
                        ? 'border-ink bg-canvas-light text-ink ring-1 ring-ink'
                        : 'border-hairline-light bg-surface-soft/75 text-mute hover:border-ink/40 hover:text-ink'
                    "
                    @click="activeSlide = slide.id"
                  >
                    <Sparkles v-if="slide.id === 'card'" class="h-4 w-4" />
                    <BarChart3 v-else-if="slide.id === 'timeline'" class="h-4 w-4" />
                    <Cpu v-else-if="slide.id === 'kit'" class="h-4 w-4" />
                    <ShieldCheck v-else class="h-4 w-4" />
                    <span class="text-[11px] font-semibold leading-tight">{{ slide.short }}</span>
                  </button>
                </div>

                <!-- 底部轻量信任条 -->
                <div class="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-surface-soft/75 px-3.5 py-2.5 text-[12px] text-mute">
                  <span class="inline-flex items-center gap-1">
                    <Truck class="h-3.5 w-3.5 text-ink" />
                    <span>全国免费包邮</span>
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <ShieldCheck class="h-3.5 w-3.5 text-primary" />
                    <span>站内零实名收集</span>
                  </span>
                  <span class="inline-flex items-center gap-1">
                    <CheckCircle2 class="h-3.5 w-3.5 text-accent-green-text" />
                    <span>0 元购卡费</span>
                  </span>
                </div>
              </div>

              <!-- 右栏（7列）：Ecommerce 13 方案选配区（首充省钱选项 + 卡型偏好 + 份数与提交） -->
              <div class="flex flex-col justify-between lg:col-span-7">
                <div class="space-y-5">
                  <!-- 顶部标题、透明评分与实时月租 -->
                  <div>
                    <div class="flex flex-wrap items-center gap-2 text-[12px]">
                      <span class="inline-flex items-center gap-1 font-semibold text-ink">
                        <Star class="h-3.5 w-3.5 fill-ink text-ink" />
                        <span>4.9 账单透明度</span>
                      </span>
                      <span class="text-hairline-light">|</span>
                      <span class="text-mute">{{ activeApplyPlan.carrier }} · {{ activeApplyPlan.attribution }}</span>
                    </div>

                    <div class="mt-2 flex items-baseline justify-between gap-4">
                      <h3 class="font-display text-[26px] font-semibold leading-[1.18] tracking-[-0.02em] text-ink sm:text-[30px]">
                        {{ activeApplyPlan.name }}
                      </h3>
                      <div class="flex-shrink-0 text-right tabular">
                        <span class="hero-num text-[32px] text-ink">
                          ¥{{ activeDisplayPrice }}
                        </span>
                        <span class="text-[13px] text-mute">/月</span>
                      </div>
                    </div>
                    <p class="mt-1.5 text-[14px] leading-[1.55] text-mute">
                      {{ activeApplyPlan.tagline }}
                    </p>
                  </div>

                  <!-- 禁发省风险提醒（若命中禁发地置顶警示） -->
                  <div
                    v-if="selectedProvince && isBlockedInProvince(activeApplyPlan, selectedProvince)"
                    class="flex items-start gap-2.5 rounded-lg border border-accent-danger/40 bg-[#fff5f5] p-3.5 text-[13px] text-accent-deep-red"
                  >
                    <AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <div>
                      <span class="font-semibold">禁发风险提醒：</span>
                      <span>你选择的【{{ selectedProvince }}】位于此套餐禁发名单内，强行提交极可能退单，建议返回换选支持该省的方案。</span>
                    </div>
                  </div>

                  <!-- 1. Subscribe & Save 风格：首充优惠激活 vs 标准原价单选卡 -->
                  <div>
                    <div class="mb-2 flex items-center justify-between text-[12px] font-semibold uppercase tracking-wider text-mute">
                      <span>资费激活模式</span>
                      <span v-if="twoYearSavings > 0" class="text-accent-green-text tabular">
                        首充激活 2 年立省 ¥{{ twoYearSavings }}
                      </span>
                    </div>

                    <div class="space-y-2.5">
                      <!-- 模式 A：首充激活享长期优惠（类似 Subscribe & Save） -->
                      <div
                        class="cursor-pointer rounded-xl border p-4 transition-all"
                        :class="
                          planMode === 'promo'
                            ? 'border-ink bg-surface-soft/80 ring-1 ring-ink'
                            : 'border-hairline-light bg-canvas-light hover:border-ink/40'
                        "
                        @click="planMode = 'promo'"
                      >
                        <div class="flex items-start justify-between gap-3">
                          <div class="flex items-start gap-3">
                            <span
                              class="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2"
                              :class="planMode === 'promo' ? 'border-ink bg-ink text-white' : 'border-stone/50'"
                            >
                              <Check v-if="planMode === 'promo'" class="h-3 w-3" />
                            </span>
                            <div>
                              <div class="flex flex-wrap items-center gap-2">
                                <span class="text-[15px] font-semibold text-ink">首充激活享优惠</span>
                                <span
                                  v-if="monthlySavings > 0"
                                  class="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary tabular"
                                >
                                  立省 ¥{{ monthlySavings }}/月
                                </span>
                              </div>
                              <p class="mt-0.5 text-[12px] text-mute">
                                激活后按官方页指引首充话费（全额入账抵扣月租），自动叠加全部通用流量与优惠月租。
                              </p>
                            </div>
                          </div>

                          <div class="flex-shrink-0 text-right tabular">
                            <div class="text-[16px] font-semibold text-ink">¥{{ activeApplyPlan.monthlyPrice }}/月</div>
                            <div
                              v-if="monthlySavings > 0"
                              class="text-[12px] text-stone line-through"
                            >
                              ¥{{ activeApplyPlan.originalPrice }}/月
                            </div>
                          </div>
                        </div>

                        <!-- 展开的首充档位选择（对应 Subscribe & Save 内部周期胶囊） -->
                        <div
                          v-if="planMode === 'promo'"
                          class="mt-3.5 border-t border-hairline-light pt-3"
                        >
                          <div class="mb-2 text-[11px] font-semibold text-mute">
                            预计收卡后首充档位（均在运营商官方渠道直接充值）：
                          </div>
                          <div class="grid grid-cols-2 gap-2">
                            <button
                              v-for="(tier, tIdx) in rechargeTiers"
                              :key="tier.amount"
                              type="button"
                              class="rounded-lg border px-3 py-2 text-left text-[12px] font-semibold transition-colors tabular"
                              :class="
                                rechargeTierIdx === tIdx
                                  ? 'border-ink bg-canvas-light text-ink'
                                  : 'border-hairline-light bg-canvas-light/60 text-mute hover:border-ink/40'
                              "
                              @click.stop="rechargeTierIdx = tIdx as 0 | 1"
                            >
                              {{ tier.label }}
                            </button>
                          </div>
                        </div>
                      </div>

                      <!-- 模式 B：不参与首充（官方原价） -->
                      <div
                        class="cursor-pointer rounded-xl border p-3.5 transition-all"
                        :class="
                          planMode === 'standard'
                            ? 'border-ink bg-surface-soft/80 ring-1 ring-ink'
                            : 'border-hairline-light bg-canvas-light hover:border-ink/40'
                        "
                        @click="planMode = 'standard'"
                      >
                        <div class="flex items-center justify-between gap-3">
                          <div class="flex items-center gap-3">
                            <span
                              class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2"
                              :class="planMode === 'standard' ? 'border-ink bg-ink text-white' : 'border-stone/50'"
                            >
                              <Check v-if="planMode === 'standard'" class="h-3 w-3" />
                            </span>
                            <div>
                              <span class="text-[14px] font-semibold text-ink">不参与首充（官方基础原价）</span>
                              <p class="text-[12px] text-mute">不触发定向减免与赠送流量包，不推荐常规选卡用户</p>
                            </div>
                          </div>
                          <span class="flex-shrink-0 text-[15px] font-semibold text-ink tabular">
                            ¥{{ activeApplyPlan.originalPrice }}/月
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 2. Grind Picker 风格：4 档卡型与激活偏好选择器 -->
                  <div>
                    <div class="mb-2 flex items-center justify-between text-[12px] font-semibold uppercase tracking-wider text-mute">
                      <span>卡型与激活偏好</span>
                      <span class="text-[11px] font-normal normal-case text-mute">
                        {{ activeApplyPlan.contractMonths === 0 ? '无合约期 · 随时线上销户' : `合约期 ${activeApplyPlan.contractMonths} 个月` }}
                      </span>
                    </div>
                    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <button
                        v-for="opt in simOptions"
                        :key="opt.id"
                        type="button"
                        class="flex flex-col items-start rounded-lg border p-3 text-left transition-all"
                        :class="
                          selectedSimOption === opt.id
                            ? 'border-ink bg-ink text-white'
                            : 'border-hairline-light bg-canvas-light text-ink hover:border-ink/40'
                        "
                        @click="selectedSimOption = opt.id"
                      >
                        <component
                          :is="opt.icon"
                          class="h-4 w-4"
                          :class="selectedSimOption === opt.id ? 'text-white' : 'text-mute'"
                        />
                        <span class="mt-2 text-[12px] font-semibold leading-tight">{{ opt.title }}</span>
                        <span
                          class="mt-0.5 text-[11px] leading-tight"
                          :class="selectedSimOption === opt.id ? 'text-white/75' : 'text-mute'"
                        >
                          {{ opt.sub }}
                        </span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- 3. 底部 Quantity Stepper + 主提交按钮 + 版本冲突确认面板 + 零实名红线承诺 -->
                <div class="mt-6 border-t border-hairline-light pt-5">
                  <!-- 服务端版本冲突提示（评审 #15：原值 -> 新值 + 最新优惠原文） -->
                  <div
                    v-if="conflictData"
                    class="mb-4 rounded-xl border border-amber-400/55 bg-amber-50 p-4 text-[13px] text-amber-950"
                  >
                    <div class="flex items-center gap-2 font-semibold">
                      <AlertTriangle class="h-4 w-4 flex-shrink-0 text-amber-700" />
                      <span>{{ conflictData.reason }}</span>
                    </div>
                    <div v-if="conflictData.changed_details?.length" class="mt-2.5 overflow-x-auto">
                      <table class="w-full border-collapse text-left text-[12px]">
                        <thead>
                          <tr class="border-b border-amber-300/70 text-amber-800">
                            <th class="py-1.5 pr-3">变动项</th>
                            <th class="py-1.5 pr-3">刚才看到</th>
                            <th class="py-1.5">最新核验</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="chg in conflictData.changed_details"
                            :key="chg.field"
                            class="border-b border-amber-200/70"
                          >
                            <td class="py-1.5 pr-3 font-semibold">{{ chg.label || chg.field }}</td>
                            <td class="py-1.5 pr-3 text-amber-800/80 line-through">
                              {{ formatConflictFieldValue(chg.field, chg.old) }}
                            </td>
                            <td class="py-1.5 font-semibold text-amber-950">
                              {{ formatConflictFieldValue(chg.field, chg.new) }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <p
                      v-if="conflictData.new_version?.offer_detail_text"
                      class="mt-2.5 rounded bg-white/80 p-2.5 text-[12px] leading-relaxed text-ink whitespace-pre-line"
                    >
                      {{ conflictData.new_version.offer_detail_text }}
                    </p>
                    <div class="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        class="btn-dark h-10 px-4 text-[13px]"
                        :disabled="isVerifying"
                        @click="confirmOrder($event, conflictData.current_version_id)"
                      >
                        <Loader2 v-if="isVerifying" class="h-4 w-4 animate-spin" />
                        <span>按最新条件确认并继续办理</span>
                      </button>
                      <button
                        type="button"
                        class="btn-outline-light h-10 px-4 text-[13px]"
                        @click="conflictData = null"
                      >
                        取消
                      </button>
                    </div>
                  </div>

                  <!-- 服务端核验失败错误提醒 -->
                  <div
                    v-if="verifyError"
                    class="mb-4 flex items-start gap-2 rounded-lg border border-accent-danger/40 bg-[#fff5f5] p-3 text-[13px] text-accent-deep-red"
                  >
                    <AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <span>{{ verifyError }}</span>
                  </div>

                  <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <!-- 份数步进器（合规限领 1~2 张） -->
                    <div class="flex h-[50px] items-center justify-between rounded-full border border-hairline-light bg-surface-soft px-2 sm:w-36">
                      <button
                        type="button"
                        class="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas-light disabled:opacity-35"
                        :disabled="quantity <= 1"
                        aria-label="减少份数"
                        @click="adjustQuantity(-1)"
                      >
                        <Minus class="h-4 w-4" />
                      </button>
                      <span class="text-[14px] font-semibold text-ink tabular">{{ quantity }} 张</span>
                      <button
                        type="button"
                        class="inline-flex h-8 w-8 items-center justify-center rounded-full text-ink transition-colors hover:bg-canvas-light disabled:opacity-35"
                        :disabled="quantity >= 2"
                        aria-label="增加份数"
                        @click="adjustQuantity(1)"
                      >
                        <Plus class="h-4 w-4" />
                      </button>
                    </div>

                    <button
                      type="button"
                      class="btn-dark btn-shine h-[50px] flex-1 px-6 text-[15px] disabled:opacity-60"
                      :disabled="isVerifying"
                      @click="confirmOrder($event)"
                    >
                      <Loader2 v-if="isVerifying" class="h-4 w-4 animate-spin" />
                      <span>
                        {{
                          isVerifying
                            ? '正在向服务器核验实时办理链接…'
                            : activeApplyPlan.backendId != null
                              ? '实时核验并获取官方办理链接 · ¥0 购卡费'
                              : '确认申领并打印凭证 · ¥0 购卡费'
                        }}
                      </span>
                      <ArrowUpRight v-if="!isVerifying" class="h-4 w-4" />
                    </button>
                  </div>

                  <p class="mt-3 flex items-center justify-between gap-2 text-[12px] text-mute">
                    <span>站内严禁收集身份证号、手机号与收货地址；凭核验码前往「{{ activeApplyPlan.officialChannelName }}」完成实名办理。</span>
                    <button
                      type="button"
                      class="flex-shrink-0 font-semibold text-charcoal underline-offset-2 hover:text-ink hover:underline"
                      @click="closeApply"
                    >
                      返回比价
                    </button>
                  </p>
                </div>
              </div>
            </div>

            <!-- ===== 步骤二：办理成功 / 通道生成后的热敏小票打印与可撕下动画 ===== -->
            <div v-else class="flex flex-col items-center">
              <div class="mb-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#ecfdf5] px-4 py-2 text-[13px] font-semibold text-accent-green-text">
                <CheckCircle2 class="h-4 w-4 flex-shrink-0" />
                <span>
                  {{
                    hasTorn
                      ? '办理凭证已撕下保存，前往官方页核对 SKU 即可'
                      : '申领通道已就绪！热敏凭证出票后可向下拖拽撕下'
                  }}
                </span>
              </div>

              <ReceiptPrinter
                :plan="activeApplyPlan"
                :province="selectedProvince"
                :official-url="verifiedRedirect?.url"
                :verified-notice="verifiedRedirect?.notice"
                @torn="handleReceiptTorn"
                @copied="handleReceiptCopied"
              />
            </div>
          </div>

          <!-- 步骤二底部收口栏 -->
          <div
            v-if="completed"
            class="flex flex-shrink-0 flex-wrap items-center justify-between gap-3 border-t border-hairline-light px-6 py-4"
          >
            <a
              v-if="verifiedRedirect?.url"
              :href="verifiedRedirect.url"
              target="_blank"
              rel="noopener noreferrer"
              class="btn-dark btn-shine flex-1 px-6 text-[14px] sm:flex-initial"
            >
              <span>立即前往运营商官方办理页</span>
              <ArrowUpRight class="h-4 w-4" />
            </a>
            <span v-else class="text-[12px] text-mute">
              演示凭证预览 · 配置服务器 channel_token 后将直跳上游官方页
            </span>
            <button type="button" class="btn-outline-light px-5 text-[14px]" @click="closeApply">
              完成并返回商城
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
