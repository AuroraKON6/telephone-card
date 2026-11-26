<script setup lang="ts">
/* 原生 Vue 3 24 个月账单标尺推演器（借鉴 React Bits Pro · Stats 21）
 * 交互结构：
 * 1. 顶部 3 组大号核心增长指标（累计实付账单 / 累计可用流量 / 实时折合月均），随标尺拖拽实时滚变
 * 2. 中部 24 期月度实付柱状图（已推演区间高亮 + 未来区间柔和退后 + 纵向激光准星 + 柱顶浮标读数）
 * 3. 底部可拖拽精密刻度时间标尺（YEAR 01 / YEAR 02 分段 + 47 格游标刻度 + 键盘无障碍支持 + 快捷节点跳转）
 * 4. 联动下方分阶段白话明细卡片，标尺落入哪一阶段即高亮对应条款，点击条款反推标尺跳转
 */
import { computed, ref } from 'vue';
import { CheckCircle2, GripVertical } from 'lucide-vue-next';
import type { SimPlan } from '@/types/sim';
type PlanPhase = SimPlan['phases'][number];
import { fxEnabled } from '@/composables/useSpark';
import AnimatedNumber from './AnimatedNumber.vue';

const props = defineProps<{
  plan: SimPlan;
}>();

const TOTAL_MONTHS = 24;
/** 默认停在满 1 年（第 12 月），首屏即直观呈现已推演/待推演对照与中置游标手柄 */
const activeMonth = ref<number>(12);
const isDragging = ref(false);
const hasInteracted = ref(false);
/** 拖拽中保持丝滑连续百分位，松手后精准吸附至目标柱条中心 */
const dragPercent = ref<number | null>(null);

const rulerTrackRef = ref<HTMLDivElement | null>(null);
const barsStageRef = ref<HTMLDivElement | null>(null);

interface MonthBarItem {
  month: number;
  price: number;
  heightPct: number;
  isZero: boolean;
  isRegular: boolean;
  phaseIndex: number;
  phaseLabel: string;
}

const maxMonthlyPrice = computed(() =>
  Math.max(props.plan.originalPrice, ...props.plan.phases.map((p) => p.monthlyPrice), 1),
);

const monthlySeries = computed<MonthBarItem[]>(() => {
  const plan = props.plan;
  const maxPrice = maxMonthlyPrice.value;
  return Array.from({ length: TOTAL_MONTHS }, (_, i) => {
    const month = i + 1;
    let phaseIndex = plan.phases.findIndex(
      (ph) => month >= ph.startMonth && (ph.endMonth === null || month <= ph.endMonth),
    );
    if (phaseIndex < 0) phaseIndex = plan.phases.length - 1;
    const phase = plan.phases[phaseIndex];
    const price = phase ? phase.monthlyPrice : plan.monthlyPrice;
    return {
      month,
      price,
      heightPct: price === 0 ? 0 : Math.max(20, Math.round((price / maxPrice) * 100)),
      isZero: price === 0,
      isRegular: price >= plan.originalPrice && plan.originalPrice > plan.monthlyPrice,
      phaseIndex,
      phaseLabel:
        price === 0
          ? '首月免租'
          : price >= plan.originalPrice && plan.originalPrice > plan.monthlyPrice
            ? '原价期'
            : '优惠期',
    };
  });
});

const activeBar = computed<MonthBarItem>(
  () => monthlySeries.value[activeMonth.value - 1] ?? monthlySeries.value[0],
);

/** 3 组实时联动增长大数字（M01 ~ activeMonth 累计推演） */
const scrubbedStats = computed(() => {
  const m = activeMonth.value;
  const plan = props.plan;
  let cumulativeCost = 0;
  for (let i = 0; i < m; i++) {
    cumulativeCost += monthlySeries.value[i]?.price ?? plan.monthlyPrice;
  }
  const originalTotal = plan.originalPrice * m;
  const savedVsOriginal = Math.max(0, originalTotal - cumulativeCost);
  const monthlyGeneralGb = Math.max(0, plan.generalDataGb);
  const monthlyDirectionalGb = Math.max(0, plan.directionalDataGb);
  const cumulativeGeneralGb = monthlyGeneralGb * m;
  const cumulativeTotalGb = (monthlyGeneralGb + monthlyDirectionalGb) * m;
  const cumulativeVoice = plan.voiceMinutes * m;
  const effectiveMonthly = Number((cumulativeCost / m).toFixed(1));
  const effectivePricePerGb =
    cumulativeGeneralGb > 0 ? (cumulativeCost / cumulativeGeneralGb).toFixed(2) : '0.00';

  return {
    month: m,
    cumulativeCost,
    savedVsOriginal,
    cumulativeGeneralGb,
    cumulativeGeneralTb: Number((cumulativeGeneralGb / 1000).toFixed(2)),
    useTbUnit: cumulativeGeneralGb >= 1000,
    cumulativeTotalGb,
    cumulativeVoice,
    effectiveMonthly,
    effectivePricePerGb,
    currentMonthPrice: activeBar.value.price,
  };
});

/** 游标中心精确百分位（与 24 根柱条中轴 1:1 像素对齐） */
const snappedPercent = computed(() => ((activeMonth.value - 0.5) / TOTAL_MONTHS) * 100);
const thumbPercent = computed(() =>
  dragPercent.value !== null ? dragPercent.value : snappedPercent.value,
);

/** 拖拽中给超快 90ms 跟手阻尼，点击/切卡给 320ms 丝滑滚变 */
const numberAnimDuration = computed(() => (isDragging.value ? 90 : 320));

const activeYearTag = computed(() => (activeMonth.value <= 12 ? 'YEAR 01' : 'YEAR 02'));

/** 47 格精密游标刻度（24 根月份主刻度 + 23 根半格副刻度） */
const rulerTicks = computed(() => {
  const totalSlots = TOTAL_MONTHS * 2 - 1; // 47 ticks (idx 0..46)
  return Array.from({ length: totalSlots }, (_, idx) => {
    const isMonthTick = idx % 2 === 0;
    const month = Math.floor(idx / 2) + 1;
    const isMajor =
      isMonthTick && (month === 1 || month === 6 || month === 12 || month === 18 || month === 24);
    const pct = ((idx / 2 + 0.5) / TOTAL_MONTHS) * 100;
    return {
      idx,
      month,
      isMonthTick,
      isMajor,
      pct,
    };
  });
});

const milestones = [
  { month: 1, desktopLabel: '第 1 月', mobileLabel: '1M' },
  { month: 6, desktopLabel: '第 6 月', mobileLabel: '6M' },
  { month: 12, desktopLabel: '满 1 年', mobileLabel: '12M' },
  { month: 18, desktopLabel: '第 18 月', mobileLabel: '18M' },
  { month: 24, desktopLabel: '满 2 年', mobileLabel: '24M' },
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function clampMonth(m: number): number {
  return Math.max(1, Math.min(TOTAL_MONTHS, Math.round(m)));
}

function updateFromClientX(clientX: number, container: HTMLElement | null) {
  if (!container) return;
  const rect = container.getBoundingClientRect();
  if (rect.width <= 0) return;
  const minPct = (0.5 / TOTAL_MONTHS) * 100;
  const maxPct = ((TOTAL_MONTHS - 0.5) / TOTAL_MONTHS) * 100;
  const rawPct = ((clientX - rect.left) / rect.width) * 100;
  const clampedPct = Math.max(minPct, Math.min(maxPct, rawPct));
  dragPercent.value = clampedPct;
  const monthIdx = Math.floor((rawPct / 100) * TOTAL_MONTHS) + 1;
  activeMonth.value = clampMonth(monthIdx);
}

function onScrubStart(e: PointerEvent, source: 'ruler' | 'bars') {
  const container = source === 'ruler' ? rulerTrackRef.value : barsStageRef.value;
  if (!container) return;
  e.preventDefault();
  isDragging.value = true;
  hasInteracted.value = true;
  (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
  updateFromClientX(e.clientX, container);
}

function onScrubMove(e: PointerEvent, source: 'ruler' | 'bars') {
  if (!isDragging.value) return;
  const container = source === 'ruler' ? rulerTrackRef.value : barsStageRef.value;
  updateFromClientX(e.clientX, container);
}

function onScrubEnd(e: PointerEvent) {
  if (!isDragging.value) return;
  isDragging.value = false;
  dragPercent.value = null;
  (e.currentTarget as HTMLElement | null)?.releasePointerCapture?.(e.pointerId);
}

function jumpToMonth(month: number) {
  hasInteracted.value = true;
  dragPercent.value = null;
  activeMonth.value = clampMonth(month);
}

function jumpToPhase(phase: PlanPhase) {
  const target =
    phase.endMonth === null
      ? TOTAL_MONTHS
      : Math.min(TOTAL_MONTHS, Math.max(phase.startMonth, phase.endMonth));
  jumpToMonth(target);
}

function isPhaseActive(phaseIdx: number): boolean {
  return activeBar.value.phaseIndex === phaseIdx;
}

function onRulerKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
    e.preventDefault();
    jumpToMonth(activeMonth.value + 1);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
    e.preventDefault();
    jumpToMonth(activeMonth.value - 1);
  } else if (e.key === 'Home') {
    e.preventDefault();
    jumpToMonth(1);
  } else if (e.key === 'End') {
    e.preventDefault();
    jumpToMonth(TOTAL_MONTHS);
  } else if (e.key === 'PageUp') {
    e.preventDefault();
    jumpToMonth(activeMonth.value + 6);
  } else if (e.key === 'PageDown') {
    e.preventDefault();
    jumpToMonth(activeMonth.value - 6);
  }
}
</script>

<template>
  <div class="flex h-full flex-col justify-between">
    <div>
      <!-- 顶部标题 + 图例与当前年份月份标牌 -->
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div class="flex flex-wrap items-center gap-2.5">
            <h3 class="font-display text-[22px] font-semibold tracking-[-0.02em] text-white sm:text-[24px]">
              未来 24 个月实付走势
            </h3>
            <span
              class="ns-data-mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-colors"
              :class="
                isDragging
                  ? 'border-primary-bright/70 bg-primary/25 text-white'
                  : 'border-white/15 bg-white/5 text-white/80'
              "
            >
              <span
                class="h-1.5 w-1.5 rounded-full"
                :class="
                  activeBar.isZero
                    ? 'bg-accent-teal'
                    : activeBar.isRegular
                      ? 'bg-accent-warning'
                      : 'bg-primary-bright'
                "
              />
              <span>{{ activeYearTag }} · M{{ pad2(activeMonth) }}</span>
            </span>
          </div>
          <p class="mt-1 text-[13.5px] text-on-dark-mute">
            {{ plan.offerDuration }} · 官方原价 ¥{{ plan.originalPrice }}/月
            <span v-if="plan.backendId != null && !plan.offerStagesVerified" class="ml-1 text-white/55">
              （按当前核验月租推演，完整条款见详情原文）
            </span>
          </p>
        </div>

        <div class="flex items-center gap-3.5 text-[12px] text-on-dark-mute">
          <span class="inline-flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full bg-accent-teal" /> 首月免租
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full bg-primary-bright" /> 优惠月租
          </span>
          <span class="inline-flex items-center gap-1.5">
            <span class="h-2 w-2 rounded-full bg-accent-warning" /> 原价期
          </span>
        </div>
      </div>

      <!-- ===== Stats 21 核心区 ①：3 组随标尺实时滚变的大号增长指标 ===== -->
      <div
        class="mt-6 grid grid-cols-1 divide-y divide-white/10 rounded-xl border border-white/10 bg-canvas-dark/90 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        <!-- 指标 1：累计实付账单 -->
        <div class="px-4 py-4 sm:px-5 sm:py-4">
          <div class="ns-data-mono flex items-center justify-between text-[11px] tracking-[0.12em] text-white/55">
            <span>累计实付账单</span>
            <span>M01–M{{ pad2(activeMonth) }}</span>
          </div>
          <div class="mt-2 flex items-baseline gap-1">
            <span class="font-display text-[17px] font-medium text-white/65">¥</span>
            <span
              class="hero-num text-[32px] text-white transition-colors sm:text-[36px]"
              :class="isDragging ? 'text-[#c7cbff]' : 'text-white'"
            >
              <AnimatedNumber :value="scrubbedStats.cumulativeCost" :duration="numberAnimDuration" />
            </span>
          </div>
          <div class="ns-data-mono mt-1.5 truncate text-[11.5px]">
            <span v-if="scrubbedStats.savedVsOriginal > 0" class="text-accent-teal">
              较原价已省 ¥{{ scrubbedStats.savedVsOriginal }}
            </span>
            <span v-else class="text-white/55">
              当月实付 ¥{{ scrubbedStats.currentMonthPrice }}
            </span>
          </div>
        </div>

        <!-- 指标 2：累计通用流量 -->
        <div class="px-4 py-4 sm:px-5 sm:py-4">
          <div class="ns-data-mono flex items-center justify-between text-[11px] tracking-[0.12em] text-white/55">
            <span>累计通用流量</span>
            <span>{{ plan.generalDataGb < 0 ? '不限量' : `${plan.generalDataGb}G/月` }}</span>
          </div>
          <div class="mt-2 flex items-baseline gap-1">
            <template v-if="plan.generalDataGb < 0">
              <span class="hero-num text-[32px] text-white sm:text-[36px]">不限量</span>
            </template>
            <template v-else>
              <span
                class="hero-num text-[32px] text-white transition-colors sm:text-[36px]"
                :class="isDragging ? 'text-[#8df5d8]' : 'text-white'"
              >
                <AnimatedNumber
                  v-if="scrubbedStats.useTbUnit"
                  :value="scrubbedStats.cumulativeGeneralTb"
                  :decimals="2"
                  :duration="numberAnimDuration"
                />
                <AnimatedNumber
                  v-else
                  :value="scrubbedStats.cumulativeGeneralGb"
                  :duration="numberAnimDuration"
                />
              </span>
              <span class="ns-data-mono text-[13px] font-medium text-white/60">
                {{ scrubbedStats.useTbUnit ? 'TB' : 'GB' }}
              </span>
            </template>
          </div>
          <div class="ns-data-mono mt-1.5 truncate text-[11.5px] text-white/55">
            <template v-if="plan.voiceMinutes > 0">
              含累计 {{ scrubbedStats.cumulativeVoice }} 分钟通话
            </template>
            <template v-else-if="plan.directionalDataGb > 0">
              另含 {{ plan.directionalDataGb * activeMonth }}G 定向流量
            </template>
            <template v-else>
              全通用不限速 · 零定向套路
            </template>
          </div>
        </div>

        <!-- 指标 3：实时折合月均 -->
        <div class="px-4 py-4 sm:px-5 sm:py-4">
          <div class="ns-data-mono flex items-center justify-between text-[11px] tracking-[0.12em] text-white/55">
            <span>实时折合月均</span>
            <span>{{ activeBar.phaseLabel }}</span>
          </div>
          <div class="mt-2 flex items-baseline gap-1">
            <span class="font-display text-[17px] font-medium text-white/65">¥</span>
            <span class="hero-num text-[32px] text-white sm:text-[36px]">
              <AnimatedNumber
                :value="scrubbedStats.effectiveMonthly"
                :decimals="1"
                :duration="numberAnimDuration"
              />
            </span>
            <span class="text-[12px] text-white/55">/月</span>
          </div>
          <div class="ns-data-mono mt-1.5 truncate text-[11.5px] text-white/55">
            当月 ¥{{ scrubbedStats.currentMonthPrice }} · 约 ¥{{ scrubbedStats.effectivePricePerGb }}/GB
          </div>
        </div>
      </div>

      <!-- ===== Stats 21 核心区 ② & ③：24 期联动柱状图 + 可拖拽精密时间标尺 ===== -->
      <div class="mt-4 rounded-xl border border-white/10 bg-canvas-dark px-4 pb-4 pt-4 sm:px-6 sm:pb-5">
        <!-- 舞台顶部状态提示条 -->
        <div class="mb-4 flex flex-wrap items-center justify-between gap-2 text-[12px]">
          <span class="inline-flex items-center gap-1.5 text-white/60">
            <span
              class="h-1.5 w-1.5 rounded-full transition-colors"
              :class="isDragging ? 'bg-accent-teal' : 'bg-primary-bright'"
            />
            <span v-if="isDragging" class="text-white/90">
              松手吸附 · 正在推演至第 {{ activeMonth }} 个月（{{ activeBar.phaseLabel }}）
            </span>
            <span v-else-if="!hasInteracted">
              拖动下方时间标尺或点击任意柱条，实时推演累计账单
            </span>
            <span v-else>
              已锁定第 {{ activeMonth }} 个月 · 支持左右拖拽标尺或键盘方向键微调
            </span>
          </span>

          <span class="ns-data-mono inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-3 py-0.5 text-[11.5px] font-semibold text-white">
            <span>第 {{ pad2(activeMonth) }} 月实付</span>
            <span
              :class="
                activeBar.isZero
                  ? 'text-accent-teal'
                  : activeBar.isRegular
                    ? 'text-accent-warning'
                    : 'text-[#9ea4ff]'
              "
            >
              ¥{{ activeBar.price }}
            </span>
          </span>
        </div>

        <!-- 24 期交互柱状图舞台（直接拖拽或点击同样可推演） -->
        <div
          ref="barsStageRef"
          class="relative select-none touch-none cursor-ew-resize pt-6"
          @pointerdown="onScrubStart($event, 'bars')"
          @pointermove="onScrubMove($event, 'bars')"
          @pointerup="onScrubEnd"
          @pointercancel="onScrubEnd"
        >
          <!-- 极细腻参考基准横线 -->
          <div class="pointer-events-none absolute inset-x-0 bottom-0 top-6 flex flex-col justify-between" aria-hidden="true">
            <div class="flex items-center border-t border-dashed border-white/10">
              <span class="ns-data-mono -mt-4 text-[10px] text-white/30">¥{{ maxMonthlyPrice }}</span>
            </div>
            <div class="border-t border-dashed border-white/5" />
            <div class="border-t border-dashed border-white/5" />
            <div class="border-t border-white/10" />
          </div>

          <!-- 纵向激光准星线（从激活柱条中心直连下方游标手柄） -->
          <div
            class="pointer-events-none absolute bottom-0 top-4 z-20 w-px -translate-x-1/2"
            :class="isDragging ? '' : 'transition-[left] duration-150 ease-out'"
            :style="{
              left: `${thumbPercent}%`,
              background:
                'linear-gradient(to bottom, rgba(145, 152, 255, 0.08) 0%, rgba(124, 131, 255, 0.85) 35%, rgba(255, 255, 255, 0.9) 100%)',
            }"
            aria-hidden="true"
          />

          <!-- 24 根等宽月度柱条 -->
          <div
            :key="plan.id"
            class="chart-24-cols relative z-10 grid h-36 items-end gap-[3px] sm:h-40 sm:gap-1.5"
          >
            <div
              v-for="(bar, idx) in monthlySeries"
              :key="bar.month"
              class="relative flex h-full flex-col items-center justify-end"
            >
              <!-- 激活柱条顶部浮动金额气泡 -->
              <span
                v-if="bar.month === activeMonth"
                class="ns-data-mono pointer-events-none absolute -top-6 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded bg-white px-1.5 py-0.5 text-[10.5px] font-bold leading-none text-canvas-dark shadow-sm"
              >
                ¥{{ bar.price }}
              </span>

              <!-- 0 元首月柱条 -->
              <template v-if="bar.isZero">
                <span
                  v-if="bar.month !== activeMonth"
                  class="ns-data-mono mb-1 text-[9.5px] font-semibold leading-none transition-opacity"
                  :class="bar.month <= activeMonth ? 'text-accent-teal opacity-100' : 'text-white/30 opacity-60'"
                >
                  ¥0
                </span>
                <div
                  class="chart-bar-rise h-[5px] w-full rounded-full transition-all duration-150"
                  :class="
                    bar.month <= activeMonth
                      ? 'bg-accent-teal opacity-100'
                      : 'bg-white/20 opacity-40'
                  "
                  :style="{
                    '--bar-delay': `${idx * 14}ms`,
                    boxShadow:
                      fxEnabled && bar.month === activeMonth
                        ? '0 0 14px rgba(0, 168, 126, 0.95)'
                        : 'none',
                  }"
                />
              </template>

              <!-- 常规/优惠/原价月度柱条（已推演亮色 vs 未推演退后暗阶） -->
              <div
                v-else
                class="chart-bar-rise relative w-full overflow-hidden rounded-t-[4px] transition-all duration-150"
                :class="[
                  bar.month <= activeMonth
                    ? bar.isRegular
                      ? 'bg-accent-warning'
                      : 'bg-primary'
                    : 'bg-white/15',
                  bar.month === activeMonth
                    ? 'opacity-100'
                    : bar.month < activeMonth
                      ? 'opacity-85'
                      : 'opacity-40',
                ]"
                :style="{
                  height: `${bar.heightPct}%`,
                  '--bar-delay': `${idx * 14}ms`,
                  filter:
                    fxEnabled && bar.month === activeMonth
                      ? bar.isRegular
                        ? 'drop-shadow(0 0 12px rgba(236, 126, 0, 0.85)) brightness(1.18)'
                        : 'drop-shadow(0 0 12px rgba(108, 115, 255, 0.92)) brightness(1.22)'
                      : 'none',
                }"
              >
                <span
                  v-if="fxEnabled && bar.month <= activeMonth"
                  class="block h-[2px] w-full"
                  :class="bar.month === activeMonth ? 'bg-white' : 'bg-white/50'"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- ===== 精密可拖拽游标时间标尺（Stats 21 Signature Ruler） ===== -->
        <div class="mt-1 pt-2">
          <!-- YEAR 01 / YEAR 02 双年分区括号提示 -->
          <div class="ns-data-mono mb-1.5 grid grid-cols-2 gap-2 text-[10px] tracking-[0.12em]">
            <div
              class="flex items-center justify-between gap-1 border-b pb-1 transition-colors"
              :class="
                activeMonth <= 12
                  ? 'border-primary-bright/60 text-white/85'
                  : 'border-white/10 text-white/40'
              "
            >
              <span class="whitespace-nowrap">YEAR 01<span class="hidden sm:inline"> · 首年</span></span>
              <span class="whitespace-nowrap">M01–M12</span>
            </div>
            <div
              class="flex items-center justify-between gap-1 border-b pb-1 transition-colors"
              :class="
                activeMonth > 12
                  ? 'border-primary-bright/60 text-white/85'
                  : 'border-white/10 text-white/40'
              "
            >
              <span class="whitespace-nowrap">YEAR 02<span class="hidden sm:inline"> · 次年</span></span>
              <span class="whitespace-nowrap">M13–M24</span>
            </div>
          </div>

          <!-- 可拖拽标尺轨道 + 47 格精密游标刻度 + 实体金属感游标手柄 -->
          <div
            ref="rulerTrackRef"
            role="slider"
            tabindex="0"
            aria-label="拖动推演 24 个月账单时间标尺"
            :aria-valuemin="1"
            :aria-valuemax="TOTAL_MONTHS"
            :aria-valuenow="activeMonth"
            :aria-valuetext="`第 ${activeMonth} 个月，累计实付 ¥${scrubbedStats.cumulativeCost}，折合月均 ¥${scrubbedStats.effectiveMonthly}`"
            class="ruler-track relative h-12 select-none touch-none cursor-ew-resize rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-bright"
            @pointerdown="onScrubStart($event, 'ruler')"
            @pointermove="onScrubMove($event, 'ruler')"
            @pointerup="onScrubEnd"
            @pointercancel="onScrubEnd"
            @keydown="onRulerKeydown"
          >
            <!-- 底部基线轨道 + 已推演流光进度轨 -->
            <div class="pointer-events-none absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/10">
              <div
                class="h-full rounded-full"
                :class="isDragging ? '' : 'transition-[width] duration-150 ease-out'"
                :style="{
                  width: `${thumbPercent}%`,
                  background: 'linear-gradient(90deg, #00a87e 0%, #494fdf 60%, #8b90ff 100%)',
                }"
              />
            </div>

            <!-- 47 格游标刻度尺（已划过区间高亮点亮） -->
            <div class="pointer-events-none absolute inset-0" aria-hidden="true">
              <span
                v-for="tick in rulerTicks"
                :key="tick.idx"
                class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-100"
                :style="{
                  left: `${tick.pct}%`,
                  width: tick.isMajor ? '1.5px' : '1px',
                  height: tick.isMajor ? '20px' : tick.isMonthTick ? '12px' : '6px',
                  backgroundColor:
                    tick.pct <= thumbPercent + 0.5
                      ? tick.isMajor
                        ? 'rgba(255,255,255,0.9)'
                        : 'rgba(139,144,255,0.7)'
                      : tick.isMajor
                        ? 'rgba(255,255,255,0.28)'
                        : 'rgba(255,255,255,0.14)',
                }"
              />
            </div>

            <!-- 向上延伸的精密指针头（严格对齐柱条中心） -->
            <div
              class="pointer-events-none absolute top-0 z-20 -translate-x-1/2"
              :class="isDragging ? '' : 'transition-[left] duration-150 ease-out'"
              :style="{ left: `${thumbPercent}%` }"
              aria-hidden="true"
            >
              <span class="block h-3 w-[2px] rounded-full bg-white/95" />
            </div>

            <!-- 可拖拽游标手柄（两端智能限位，首尾月绝不溢出边界） -->
            <div
              class="pointer-events-none absolute top-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
              :class="isDragging ? '' : 'transition-[left] duration-150 ease-out'"
              :style="{ left: `clamp(32px, ${thumbPercent}%, calc(100% - 32px))` }"
            >
              <!-- 滚花手感手柄主体 -->
              <div
                class="flex h-8 items-center gap-1 rounded-full border px-2.5 transition-transform duration-150"
                :class="
                  isDragging
                    ? 'scale-105 border-white bg-primary text-white shadow-[0_0_20px_rgba(99,106,255,0.85)]'
                    : 'border-white/75 bg-[#12141c] text-white shadow-[0_0_12px_rgba(73,79,223,0.45)] hover:border-white'
                "
              >
                <GripVertical class="h-3.5 w-3.5 text-white/75" />
                <span class="ns-data-mono text-[11px] font-semibold leading-none tracking-[0.04em]">
                  {{ pad2(activeMonth) }}M
                </span>
              </div>
            </div>
          </div>

          <!-- 底部快捷里程碑按钮（5 列等分防溢出，移动端精简为 1M..24M，桌面端单行展示） -->
          <div class="mt-2 grid grid-cols-5 gap-1">
            <button
              v-for="ms in milestones"
              :key="ms.month"
              type="button"
              class="ns-data-mono flex items-center justify-center rounded-full px-1.5 py-1 text-[11px] whitespace-nowrap transition-colors"
              :class="
                activeMonth === ms.month
                  ? 'bg-white/15 font-semibold text-white'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/90'
              "
              @click="jumpToMonth(ms.month)"
            >
              <span class="sm:hidden">{{ ms.mobileLabel }}</span>
              <span class="hidden sm:inline">{{ ms.desktopLabel }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ===== 联动分阶段白话明细卡片（高亮当前标尺所在阶段，点击可反推标尺） ===== -->
      <div class="mt-5 space-y-2.5">
        <button
          v-for="(phase, idx) in plan.phases"
          :key="phase.period"
          type="button"
          class="flex w-full flex-col justify-between gap-2 rounded-lg border px-4 py-3 text-left transition-all duration-200 sm:flex-row sm:items-center"
          :class="
            isPhaseActive(idx)
              ? 'border-primary-bright/65 bg-primary/15'
              : 'border-hairline-dark bg-surface-deep/90 hover:border-white/25 hover:bg-surface-elevated/80'
          "
          @click="jumpToPhase(phase)"
        >
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <CheckCircle2
                class="h-4 w-4 flex-shrink-0 transition-colors"
                :class="isPhaseActive(idx) ? 'text-accent-teal' : 'text-white/45'"
              />
              <span class="text-[14.5px] font-semibold text-white">{{ phase.period }}</span>
              <span
                v-if="isPhaseActive(idx)"
                class="ns-data-mono rounded-full bg-primary/30 px-2 py-0.5 text-[10px] font-medium text-[#c7cbff]"
              >
                当前标尺区间
              </span>
            </div>
            <p class="mt-1 pl-6 text-[13px] leading-[1.48] text-on-dark-mute">
              {{ phase.note }}
            </p>
          </div>
          <div class="flex-shrink-0 pl-6 sm:pl-0 sm:text-right">
            <span class="hero-num text-[22px] text-white">
              ¥{{ phase.monthlyPrice }}
            </span>
            <span class="text-[12px] text-on-dark-mute">/月</span>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chart-24-cols {
  grid-template-columns: repeat(24, minmax(0, 1fr));
}
</style>
