<script setup lang="ts">
/* 号卡完整详情抽屉/模态窗：
 * 上半部为 ShaderCard 升腾流光火焰舞台（每次打开自动随机选取精选光焰配色）
 * 下半部为白底 24 个月真实资费时间轴 + 禁发省份实时校验 + 合规外链办理
 */
import { onMounted, onUnmounted, ref, watch } from 'vue';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Copy,
  MapPin,
  RefreshCw,
  Scale,
  ShieldCheck,
  X,
} from 'lucide-vue-next';
import { formatVerifyTimestamp } from '@/adapters/cardshopAdapter';
import {
  calc24MonthTotal,
  calcEffectiveMonthly,
  calcPricePerGb,
  isBlockedInProvince,
  useStorefront,
} from '@/composables/useStorefront';
import { triggerSpark } from '@/composables/useSpark';
import SimCardVisual from './SimCardVisual.vue';
import ShaderCard from './fx/ShaderCard.vue';

const {
  activeDetailPlan,
  selectedProvince,
  detailLoading,
  detailError,
  isCompared,
  toggleCompare,
  refreshActiveDetail,
  closeDetail,
  openApply,
  showToast,
} = useStorefront();

interface FlameTheme {
  color: string;
  secondary: string;
}

/** 精选随机光焰配色池（每次打开详情自动随机换色，相邻两次不重复） */
const FLAME_THEMES: FlameTheme[] = [
  { color: '#A855F7', secondary: '#494FDF' },
  { color: '#4F55F1', secondary: '#00C495' },
  { color: '#00C495', secondary: '#007BC2' },
  { color: '#F59E0B', secondary: '#EA580C' },
  { color: '#F43F5E', secondary: '#A855F7' },
  { color: '#06B6D4', secondary: '#6366F1' },
  { color: '#EC4899', secondary: '#F97316' },
  { color: '#10B981', secondary: '#22D3EE' },
];

const flameColor = ref('#4F55F1');
const flameSecondary = ref('#00C495');
let lastThemeIdx = -1;

function pickRandomFlame() {
  let idx = Math.floor(Math.random() * FLAME_THEMES.length);
  if (FLAME_THEMES.length > 1 && idx === lastThemeIdx) {
    idx = (idx + 1 + Math.floor(Math.random() * (FLAME_THEMES.length - 1))) % FLAME_THEMES.length;
  }
  lastThemeIdx = idx;
  const theme = FLAME_THEMES[idx];
  flameColor.value = theme.color;
  flameSecondary.value = theme.secondary;
}

/** 每次打开号卡详情时自动随机赋予一组光焰配色 */
watch(
  activeDetailPlan,
  (plan) => {
    if (!plan) return;
    pickRandomFlame();
  },
  { immediate: true },
);

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && activeDetailPlan.value) {
    closeDetail();
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

async function copyPlanSummary() {
  const plan = activeDetailPlan.value;
  if (!plan) return;
  const summary = [
    `【${plan.name}】(${plan.carrier} · ${plan.skuCode})`,
    `优惠月租：¥${plan.monthlyPrice}/月（官方原价 ¥${plan.originalPrice}，2年均价 ¥${calcEffectiveMonthly(plan)}/月）`,
    `流量语音：${plan.generalDataGb}G 通用 + ${plan.directionalDataGb}G 定向 / ${plan.voiceMinutes > 0 ? `${plan.voiceMinutes}分钟` : '通话0.1元/分'}`,
    `优惠与合约：${plan.offerDuration} · ${plan.contractMonths === 0 ? '无合约' : `${plan.contractMonths}个月合约`} · 首充 ¥${plan.firstRechargeAmount}`,
    `归属地与禁发：${plan.attribution} | ${plan.blockedDetailNote}`,
  ].join('\n');

  try {
    await navigator.clipboard.writeText(summary);
    showToast('已复制该号卡完整参数摘要');
  } catch {
    showToast('当前环境不支持自动剪贴板写入');
  }
}

function handleGoApply() {
  const plan = activeDetailPlan.value;
  if (!plan) return;
  const id = plan.id;
  closeDetail();
  openApply(id);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="activeDetailPlan"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="`${activeDetailPlan.name} 完整资费详情`"
        @click.self="closeDetail"
      >
        <div class="modal-panel flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-xl bg-canvas-light sm:rounded-xl">
        <!-- 上半部 ShaderCard 升腾流光火焰硬件头图区（flex-shrink-0 杜绝被下方滚动区挤压） -->
        <ShaderCard
          :color="flameColor"
          :secondary-color="flameSecondary"
          :intensity="1.08"
          class="flex-shrink-0 px-5 py-5 text-on-dark sm:px-8 sm:py-6"
        >
          <div class="flex items-start justify-between gap-4">
            <div class="min-w-0">
              <p class="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/75">
                {{ activeDetailPlan.carrier }} · {{ activeDetailPlan.skuCode }}
              </p>
              <h3 class="mt-1 font-display text-[26px] font-medium leading-[1.2] text-white sm:text-[32px]">
                {{ activeDetailPlan.name }}
              </h3>
            </div>
            <button
              type="button"
              class="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white backdrop-blur-md transition-colors hover:bg-black/75"
              aria-label="关闭详情"
              @click="closeDetail"
            >
              <X class="h-5 w-5" />
            </button>
          </div>

          <div class="mt-5 grid grid-cols-1 items-center gap-5 sm:grid-cols-12">
            <div class="sm:col-span-6">
              <SimCardVisual
                :material="activeDetailPlan.material"
                :name="activeDetailPlan.name"
                :carrier="activeDetailPlan.carrier"
                :monthly-price="activeDetailPlan.monthlyPrice"
                :general-data-gb="activeDetailPlan.generalDataGb"
                :voice-minutes="activeDetailPlan.voiceMinutes"
                :sku-code="activeDetailPlan.skuCode"
                compact
              />
            </div>

            <!-- 悬浮在升腾光焰前的深黑磨砂玻璃指标卡组 -->
            <div class="grid grid-cols-2 gap-3 sm:col-span-6">
              <div class="rounded-md border border-white/15 bg-black/55 p-4 backdrop-blur-md">
                <div class="text-[12px] text-white/75">2 年实付总计</div>
                <div class="mt-1 font-display text-[24px] font-medium text-white tabular">
                  ¥{{ calc24MonthTotal(activeDetailPlan) }}
                </div>
                <div class="mt-0.5 text-[12px] text-white/70 tabular">
                  均 ¥{{ calcEffectiveMonthly(activeDetailPlan) }}/月
                </div>
              </div>
              <div class="rounded-md border border-white/15 bg-black/55 p-4 backdrop-blur-md">
                <div class="text-[12px] text-white/75">单 GB 折算价</div>
                <div class="mt-1 font-display text-[24px] font-medium text-white tabular">
                  ¥{{ calcPricePerGb(activeDetailPlan) }}
                </div>
                <div class="mt-0.5 text-[12px] text-white/70">
                  {{ activeDetailPlan.networkSpeed.split('·')[0] }}
                </div>
              </div>
              <div class="col-span-2 rounded-md border border-white/15 bg-black/55 px-4 py-3 text-[13px] text-white/80 backdrop-blur-md">
                <span class="font-semibold text-white">适合人群：</span>
                {{ activeDetailPlan.bestFor }}
              </div>
            </div>
          </div>
        </ShaderCard>

        <!-- 下半部可滚动纯白详单区 -->
        <div class="min-h-0 flex-1 overflow-y-auto px-5 py-6 text-ink sm:px-8 sm:py-7">
          <!-- 真实后端版本核验状态条（仅服务器实时商品展示） -->
          <div
            v-if="activeDetailPlan.backendId != null"
            class="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-md border border-hairline-light bg-surface-soft px-4 py-2.5 text-[12.5px]"
          >
            <div class="flex flex-wrap items-center gap-2 text-charcoal">
              <span class="h-2 w-2 rounded-full bg-accent-teal" />
              <span class="font-semibold">
                服务器档案 v{{ activeDetailPlan.versionNo ?? '?' }}
              </span>
              <span class="text-mute">
                · {{ activeDetailPlan.detailSource === 'detail' ? '已核验详情' : '目录快照' }}
                · {{ formatVerifyTimestamp(activeDetailPlan.fetchedAt) }}
              </span>
            </div>
            <button
              type="button"
              class="inline-flex items-center gap-1 rounded-full border border-hairline-strong bg-canvas-light px-3 py-1 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-soft disabled:opacity-50"
              :disabled="detailLoading"
              @click="refreshActiveDetail"
            >
              <RefreshCw class="h-3 w-3" :class="detailLoading ? 'animate-spin' : ''" />
              <span>{{ detailLoading ? '正在核验最新条款…' : '重新核验最新条款' }}</span>
            </button>
          </div>

          <div
            v-if="detailError"
            class="mb-5 flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"
          >
            <AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{{ detailError }}</span>
          </div>

          <div
            v-if="activeDetailPlan.quarantineReasons && activeDetailPlan.quarantineReasons.length > 0"
            class="mb-5 flex items-start gap-2 rounded-md border border-amber-400/45 bg-amber-50 px-4 py-3 text-[13px] text-amber-900"
          >
            <AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div>
              <span class="font-semibold">部分资料待核验：</span>
              <span>{{ activeDetailPlan.quarantineReasons.join('、') }}，最终条件请以上游官方办理页为准。</span>
            </div>
          </div>

          <!-- 所选省份发货状态提醒（配送未核实绝不误报“支持发货”） -->
          <div
            v-if="selectedProvince"
            class="mb-6 flex items-start gap-3 rounded-md border px-4 py-3.5 text-[14px]"
            :class="
              activeDetailPlan.regionStatus === 'unverified'
                ? 'border-amber-400/45 bg-amber-50 text-amber-900'
                : isBlockedInProvince(activeDetailPlan, selectedProvince)
                  ? 'border-accent-danger/40 bg-[#fff5f5] text-accent-deep-red'
                  : 'border-accent-light-green/35 bg-[#f4fbf2] text-accent-green-text'
            "
          >
            <AlertTriangle
              v-if="activeDetailPlan.regionStatus === 'unverified' || isBlockedInProvince(activeDetailPlan, selectedProvince)"
              class="mt-0.5 h-5 w-5 flex-shrink-0"
            />
            <CheckCircle2 v-else class="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>
              <div class="font-semibold">
                {{
                  activeDetailPlan.regionStatus === 'unverified'
                    ? `配送范围待确认：上游暂未提供【${selectedProvince}】明确配送名单，请以官方办理页为准`
                    : isBlockedInProvince(activeDetailPlan, selectedProvince)
                      ? `注意：当前所选【${selectedProvince}】位于该套餐禁发名单内`
                      : `当前所选【${selectedProvince}】支持常规申领发货`
                }}
              </div>
              <p class="mt-0.5 text-[13px] opacity-90">
                {{ activeDetailPlan.blockedDetailNote }}
              </p>
            </div>
          </div>

          <!-- 分阶段资费时间轴 -->
          <div>
            <h4 class="font-display text-[20px] font-medium text-ink">
              真实资费阶段时间轴
            </h4>
            <div class="mt-4 space-y-3">
              <div
                v-for="phase in activeDetailPlan.phases"
                :key="phase.period"
                class="flex flex-col justify-between gap-2 rounded-md border border-hairline-light bg-surface-soft px-4 py-3.5 sm:flex-row sm:items-center"
              >
                <div>
                  <div class="text-[15px] font-semibold text-ink">{{ phase.period }}</div>
                  <p class="mt-0.5 text-[13px] text-mute">{{ phase.note }}</p>
                </div>
                <div class="flex-shrink-0 font-display text-[22px] font-medium text-ink tabular">
                  <template v-if="phase.isProration">按天折算</template>
                  <template v-else>
                    ¥{{ phase.monthlyPrice }}<span class="text-[13px] font-sans font-normal text-mute">/月</span>
                  </template>
                </div>
              </div>
            </div>

            <!-- 后端已核验的优惠与原套餐原文（如实展示，不删减条件） -->
            <div
              v-if="activeDetailPlan.offerDetailText"
              class="mt-4 rounded-md border border-hairline-light bg-surface-soft/70 p-4 text-[13px] leading-[1.65] text-body"
            >
              <div class="mb-1.5 font-semibold text-ink">已核验优惠说明原文</div>
              <p class="whitespace-pre-line">{{ activeDetailPlan.offerDetailText }}</p>
              <p v-if="activeDetailPlan.packageDetailText" class="mt-2.5 border-t border-hairline-light pt-2.5 text-mute">
                <span class="font-semibold text-ink">原套餐说明：</span>{{ activeDetailPlan.packageDetailText }}
              </p>
            </div>
          </div>

          <!-- 关键办理条件与细则 -->
          <div class="mt-7">
            <h4 class="font-display text-[20px] font-medium text-ink">
              首充门槛与办理条件
            </h4>
            <dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div class="rounded-md border border-hairline-light p-4">
                <dt class="text-[12px] font-semibold text-mute">首充要求</dt>
                <dd class="mt-1 text-[14px] font-semibold text-ink tabular">
                  {{
                    activeDetailPlan.firstRechargeAmount > 0
                      ? `一次性首充 ¥${activeDetailPlan.firstRechargeAmount}`
                      : '以官方核验原文为准'
                  }}
                </dd>
                <p class="mt-1 text-[13px] text-mute">{{ activeDetailPlan.firstRechargeText || activeDetailPlan.firstRechargeNote }}</p>
              </div>
              <div class="rounded-md border border-hairline-light p-4">
                <dt class="text-[12px] font-semibold text-mute">合约与销户</dt>
                <dd class="mt-1 text-[14px] font-semibold text-ink">
                  {{
                    activeDetailPlan.contractText
                      ? activeDetailPlan.contractText
                      : activeDetailPlan.contractMonths < 0
                        ? '合约期以官方办理页为准'
                        : activeDetailPlan.contractMonths === 0
                          ? '0 合约 · 随时可在运营商 App 线上销户'
                          : `${activeDetailPlan.contractMonths} 个月合约期`
                  }}
                </dd>
                <p class="mt-1 text-[13px] text-mute">
                  办理年龄：{{ activeDetailPlan.ageRange }} · {{ activeDetailPlan.activationMethod }}
                </p>
                <p v-if="activeDetailPlan.offMethodText" class="mt-1 text-[12px] text-mute">
                  销户说明：{{ activeDetailPlan.offMethodText }}（销户费用以运营商口径为准）
                </p>
              </div>
              <div class="rounded-md border border-hairline-light p-4">
                <dt class="text-[12px] font-semibold text-mute">号码归属地与网络</dt>
                <dd class="mt-1 text-[14px] font-semibold text-ink">
                  {{ activeDetailPlan.attribution }}
                </dd>
                <p class="mt-1 text-[13px] text-mute">{{ activeDetailPlan.networkSpeed }}</p>
              </div>
              <div class="rounded-md border border-hairline-light p-4">
                <dt class="flex items-center gap-1 text-[12px] font-semibold text-mute">
                  <MapPin class="h-3.5 w-3.5" />
                  <span>禁发区域说明</span>
                </dt>
                <dd class="mt-1 text-[13px] leading-[1.5] text-body">
                  {{ activeDetailPlan.blockedDetailNote }}
                </dd>
              </div>
            </dl>

            <div
              v-if="activeDetailPlan.directionalApps"
              class="mt-3 rounded-md bg-surface-soft px-4 py-3 text-[13px] text-mute"
            >
              <span class="font-semibold text-ink">定向流量覆盖常用 App：</span>
              {{ activeDetailPlan.directionalApps }}
            </div>
          </div>

          <!-- 隐私合规提示 -->
          <div class="mt-6 flex items-center gap-2 text-[13px] text-mute">
            <ShieldCheck class="h-4 w-4 flex-shrink-0 text-ink" />
            <span>本页仅展示公开资费，下一步跳转至「{{ activeDetailPlan.officialChannelName }}」完成实名办理。</span>
          </div>
        </div>

        <!-- 底部吸底操作栏（含手机底部安全区适配） -->
        <div class="pb-safe flex flex-wrap items-center justify-between gap-2.5 border-t border-hairline-light bg-canvas-light px-4 py-3.5 sm:gap-3 sm:px-8 sm:py-4">
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="btn-soft px-4 text-[14px]"
              @click="triggerSpark($event, ['#494fdf', '#00a87e']); copyPlanSummary()"
            >
              <Copy class="h-4 w-4" />
              <span>复制参数</span>
            </button>
            <button
              type="button"
              class="btn-outline-light px-4 text-[14px]"
              @click="
                !isCompared(activeDetailPlan.id) && triggerSpark($event, ['#494fdf', '#00a87e']);
                toggleCompare(activeDetailPlan.id);
              "
            >
              <Scale class="h-4 w-4" />
              <span>{{ isCompared(activeDetailPlan.id) ? '移出对比' : '加入对比' }}</span>
            </button>
          </div>

          <button
            type="button"
            class="btn-dark btn-shine flex-1 sm:flex-initial"
            @click="triggerSpark($event); handleGoApply()"
          >
            <span>前往官方授权页办理</span>
            <ArrowUpRight class="h-4 w-4" />
          </button>
        </div>
      </div>
      </div>
    </Transition>
  </Teleport>
</template>
