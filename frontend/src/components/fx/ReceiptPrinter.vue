<script setup lang="ts">
/* 原生 Vue 3 可撕下热敏小票打印机（ReceiptPrinter）
 * 效果：暗黑极简工业风出票机 -> 分段步进吐出锯齿边热敏小票 -> 支持鼠标/触摸下拉撕下或点击一键撕票
 * 严守合规红线：凭证仅记录套餐公开资费、SKU、首充提醒与凭证流水号，绝不含身份证/手机号/地址
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { ArrowUpRight, Check, Copy, RotateCcw, Scissors } from 'lucide-vue-next';
import { calc24MonthTotal, calcEffectiveMonthly } from '@/composables/useStorefront';
import { triggerSpark } from '@/composables/useSpark';
import type { SimPlan } from '@/types/sim';

const props = defineProps<{
  plan: SimPlan;
  province?: string;
  officialUrl?: string;
  verifiedNotice?: string;
}>();

const emit = defineEmits<{
  (e: 'torn'): void;
  (e: 'copied'): void;
}>();

type PrinterState = 'printing' | 'ready' | 'torn';

const state = ref<PrinterState>('printing');
const printKey = ref(0);
const dragY = ref(0);
const dragX = ref(0);
const isDragging = ref(false);
const copied = ref(false);

let dragStartY = 0;
let dragStartX = 0;
let printTimer: ReturnType<typeof setTimeout> | null = null;
let copyTimer: ReturnType<typeof setTimeout> | null = null;

const TEAR_THRESHOLD = 66;

/** 根据当前日期 + SKU 生成极具真实感的凭证单号 */
const voucherNo = computed(() => {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  let hash = 0;
  for (const ch of props.plan.skuCode + String(printKey.value)) {
    hash = (hash * 31 + ch.charCodeAt(0)) % 9000;
  }
  return `NS-${y}${m}${d}-${1000 + hash}`;
});

const printedAt = computed(() => {
  const now = new Date();
  return now.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
});

/** 根据 SKU 确定性生成逼真的热敏条形码竖条 */
const barcodeBars = computed(() => {
  const seedStr = `${props.plan.skuCode}-${voucherNo.value}`;
  const bars: Array<{ x: number; w: number }> = [];
  let cursor = 4;
  for (let i = 0; i < 42; i++) {
    const code = seedStr.charCodeAt(i % seedStr.length) + i * 13;
    const w = (code % 3) + 1;
    const gap = ((code >> 2) % 2) + 1.4;
    if (cursor + w > 212) break;
    bars.push({ x: cursor, w });
    cursor += w + gap;
  }
  return bars;
});

const tearProgress = computed(() =>
  Math.min(1, Math.max(0, dragY.value / TEAR_THRESHOLD)),
);

const receiptPaperStyle = computed(() => {
  if (state.value === 'torn') {
    return {
      transform: 'translate3d(0, 26px, 0) rotate(-1.6deg)',
      transition: 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
    };
  }
  if (isDragging.value) {
    const rot = Math.max(-5, Math.min(5, dragX.value * 0.06 + tearProgress.value * 2.2));
    return {
      transform: `translate3d(${dragX.value * 0.18}px, ${dragY.value}px, 0) rotate(${rot}deg)`,
      transition: 'none',
    };
  }
  return {
    transform: 'translate3d(0, 0, 0) rotate(0deg)',
    transition: 'transform 360ms cubic-bezier(0.22, 1, 0.36, 1)',
  };
});

function startPrinting() {
  if (printTimer) clearTimeout(printTimer);
  state.value = 'printing';
  dragY.value = 0;
  dragX.value = 0;
  isDragging.value = false;
  printKey.value += 1;

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  printTimer = setTimeout(
    () => {
      state.value = 'ready';
    },
    reduced ? 80 : 1280,
  );
}

function finishTear(sparkCenter?: { x: number; y: number }) {
  if (state.value !== 'ready') return;
  isDragging.value = false;
  dragY.value = 0;
  dragX.value = 0;
  state.value = 'torn';
  if (sparkCenter) {
    triggerSpark(sparkCenter, ['#494fdf', '#00c495', '#f59e0b', '#191c1f']);
  }
  emit('torn');
}

function handlePointerDown(e: PointerEvent) {
  if (state.value !== 'ready') return;
  const target = e.target as HTMLElement | null;
  if (target?.closest('button')) return;
  isDragging.value = true;
  dragStartY = e.clientY;
  dragStartX = e.clientX;
  (e.currentTarget as HTMLElement | null)?.setPointerCapture?.(e.pointerId);
}

function handlePointerMove(e: PointerEvent) {
  if (!isDragging.value || state.value !== 'ready') return;
  const dy = Math.max(0, e.clientY - dragStartY);
  const dx = e.clientX - dragStartX;
  // 超出阈值后带微阻尼拉伸
  dragY.value = dy > TEAR_THRESHOLD ? TEAR_THRESHOLD + (dy - TEAR_THRESHOLD) * 0.25 : dy;
  dragX.value = Math.max(-45, Math.min(45, dx));

  if (dy >= TEAR_THRESHOLD + 24) {
    finishTear({ x: e.clientX, y: e.clientY });
  }
}

function handlePointerUp(e: PointerEvent) {
  if (!isDragging.value) return;
  const pulled = dragY.value >= TEAR_THRESHOLD;
  isDragging.value = false;
  if (pulled) {
    finishTear({ x: e.clientX, y: e.clientY });
  } else {
    dragY.value = 0;
    dragX.value = 0;
  }
}

function handleTearButton(e: MouseEvent) {
  finishTear({ x: e.clientX, y: e.clientY });
}

async function copyVoucher(e: MouseEvent) {
  const lines = [
    `【NovaSIM 号卡办理凭证】${voucherNo.value}`,
    `套餐：${props.plan.name}（${props.plan.carrier} · ${props.plan.skuCode}）`,
    `月租：¥${props.plan.monthlyPrice}/月（24个月总计 ¥${calc24MonthTotal(props.plan)}，均 ¥${calcEffectiveMonthly(props.plan)}/月）`,
    `流量语音：${props.plan.generalDataGb}G通用${props.plan.directionalDataGb > 0 ? `+${props.plan.directionalDataGb}G定向` : ''} / ${props.plan.voiceMinutes > 0 ? `${props.plan.voiceMinutes}分钟` : '0.1元/分'}`,
    `首充要求：一次性首充 ¥${props.plan.firstRechargeAmount}（${props.plan.officialChannelName}）`,
  ].join('\n');

  try {
    await navigator.clipboard.writeText(lines);
  } catch {
    // 忽略受限环境剪贴板权限错误
  }
  copied.value = true;
  triggerSpark(e, ['#00c495', '#494fdf']);
  emit('copied');
  if (copyTimer) clearTimeout(copyTimer);
  copyTimer = setTimeout(() => {
    copied.value = false;
  }, 2000);
}

watch(
  () => props.plan.id,
  () => startPrinting(),
);

onMounted(() => startPrinting());

onUnmounted(() => {
  if (printTimer) clearTimeout(printTimer);
  if (copyTimer) clearTimeout(copyTimer);
});
</script>

<template>
  <div class="receipt-printer mx-auto w-full max-w-[360px] select-none">
    <!-- 顶部暗黑金属热敏出票机机身 -->
    <div class="relative z-20 rounded-lg border border-white/15 bg-[#141618] px-4 pb-3.5 pt-3.5 text-white">
      <div class="flex items-center justify-between text-[11px]">
        <div class="flex items-center gap-2">
          <span class="font-mono font-semibold tracking-[0.14em] text-white/85">
            NOVASIM · T80
          </span>
          <span class="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-white/65">
            THERMAL
          </span>
        </div>

        <div class="flex items-center gap-1.5 font-mono text-[10px] tracking-wider">
          <span
            class="h-2 w-2 rounded-full"
            :class="
              state === 'printing'
                ? 'signal-dot bg-accent-teal'
                : state === 'ready'
                  ? 'bg-[#f59e0b]'
                  : 'bg-accent-teal'
            "
          />
          <span class="text-white/75">
            {{
              state === 'printing'
                ? 'PRINTING'
                : state === 'ready'
                  ? 'TEAR READY'
                  : 'DETACHED'
            }}
          </span>
        </div>
      </div>

      <!-- 精密出纸凹槽（纸张从这条深黑缝隙里步进吐出） -->
      <div class="mt-3 h-3 w-full rounded-full border border-white/10 bg-black p-[2px]">
        <div class="h-full w-full rounded-full bg-gradient-to-b from-black via-[#0c0d0f] to-[#1e2126]" />
      </div>
    </div>

    <!-- 出纸口视口遮罩：打印时从出纸槽内部向下分段吐出，撕下后脱离自由悬停 -->
    <div
      class="relative -mt-2 px-3 pb-4"
      :class="state === 'torn' ? 'overflow-visible' : 'overflow-hidden'"
    >
      <div
        :key="printKey"
        class="thermal-paper relative mx-auto w-full text-ink"
        :class="[
          state === 'printing' ? 'is-printing' : '',
          state === 'ready' ? 'cursor-grab active:cursor-grabbing' : '',
          state === 'torn' ? 'is-torn' : '',
        ]"
        :style="receiptPaperStyle"
        @pointerdown="handlePointerDown"
        @pointermove="handlePointerMove"
        @pointerup="handlePointerUp"
        @pointercancel="handlePointerUp"
      >
        <!-- 撕下后顶部呈现锯齿撕裂边（SVG） -->
        <svg
          v-if="state === 'torn'"
          class="block h-[8px] w-full text-[#fbfbfa]"
          viewBox="0 0 320 8"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            fill="currentColor"
            points="0,8 8,0 16,8 24,0 32,8 40,0 48,8 56,0 64,8 72,0 80,8 88,0 96,8 104,0 112,8 120,0 128,8 136,0 144,8 152,0 160,8 168,0 176,8 184,0 192,8 200,0 208,8 216,0 224,8 232,0 240,8 248,0 256,8 264,0 272,8 280,0 288,8 296,0 304,8 312,0 320,8"
          />
        </svg>

        <!-- 热敏小票纸面主体 -->
        <div class="relative border-x border-[#e5e5e0] bg-[#fbfbfa] px-5 pb-4 pt-4">
          <!-- 未撕下时顶部出纸口压暗阴影 + 虚线撕纸引导 -->
          <div
            v-if="state !== 'torn'"
            class="pointer-events-none absolute inset-x-0 top-0 h-4"
            style="background: linear-gradient(to bottom, rgba(0,0,0,0.20), rgba(0,0,0,0));"
          />

          <div
            v-if="state === 'ready'"
            class="mb-3 flex items-center justify-between border-b border-dashed pb-2 text-[11px] font-semibold transition-colors"
            :class="
              tearProgress > 0.35
                ? 'border-accent-danger text-accent-danger'
                : 'border-[#c8c8c0] text-mute'
            "
          >
            <span class="inline-flex items-center gap-1">
              <Scissors class="h-3 w-3" />
              <span>{{ tearProgress > 0.5 ? '继续下拉即可撕断！' : '按住向下拖拽撕下小票' }}</span>
            </span>
            <span class="font-mono tabular">{{ Math.round(tearProgress * 100) }}%</span>
          </div>

          <!-- 票头品牌与状态章 -->
          <div class="flex items-start justify-between gap-2 border-b border-dashed border-[#d4d4cc] pb-3">
            <div>
              <div class="font-display text-[17px] font-semibold tracking-tight text-ink">
                NovaSIM · 办理凭证
              </div>
              <div class="mt-0.5 font-mono text-[11px] text-mute tabular">
                NO. {{ voucherNo }}
              </div>
            </div>
            <span class="rounded border border-accent-green-text/40 bg-[#ecfdf5] px-2 py-0.5 text-[11px] font-semibold text-accent-green-text">
              核验通过
            </span>
          </div>

          <!-- 核心套餐明账 -->
          <div class="mt-3 space-y-1.5 text-[12px]">
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-mute">申领方案</span>
              <span class="font-semibold text-ink text-right">{{ plan.name }}</span>
            </div>
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-mute">运营商 / SKU</span>
              <span class="font-mono font-semibold text-ink tabular">
                {{ plan.carrier.replace('中国', '') }} · {{ plan.skuCode }}
              </span>
            </div>
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-mute">流量与语音</span>
              <span class="font-semibold text-ink tabular text-right">
                {{ plan.generalDataGb }}G通用{{ plan.directionalDataGb > 0 ? `+${plan.directionalDataGb}G定向` : '' }}
                / {{ plan.voiceMinutes > 0 ? `${plan.voiceMinutes}分` : '0.1/分' }}
              </span>
            </div>
            <div v-if="province" class="flex items-baseline justify-between gap-2">
              <span class="text-mute">收货省份校验</span>
              <span class="font-semibold text-ink">{{ province }}</span>
            </div>
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-mute">出票时间</span>
              <span class="font-mono text-charcoal tabular">{{ printedAt }}</span>
            </div>
          </div>

          <!-- 财务合计栏 -->
          <div class="mt-3 border-y border-dashed border-[#d4d4cc] py-2.5">
            <div class="flex items-baseline justify-between">
              <span class="text-[12px] font-semibold text-mute">优惠期实付月租</span>
              <span class="font-display text-[24px] font-semibold leading-none text-ink tabular">
                ¥{{ plan.monthlyPrice }}<span class="text-[12px] font-normal text-mute">/月</span>
              </span>
            </div>
            <div class="mt-1 flex items-center justify-between text-[11px] text-mute tabular">
              <span>24 个月总计 ¥{{ calc24MonthTotal(plan) }}</span>
              <span>均 ¥{{ calcEffectiveMonthly(plan) }}/月</span>
            </div>
          </div>

          <!-- 首充关键提示框 -->
          <div class="mt-3 rounded bg-[#f1f1ec] px-3 py-2 text-[11px] leading-[1.45] text-charcoal">
            <span class="font-semibold text-ink">首充提示：</span>
            收卡激活后请一次性首充 <strong class="tabular">¥{{ plan.firstRechargeAmount }}</strong>，
            以触发全部流量包与月租优惠（{{ plan.contractMonths === 0 ? '无合约随时可销' : `${plan.contractMonths}个月合约` }}）。
          </div>

          <!-- Code-128 风格矢量条形码 -->
          <div class="mt-3.5 flex flex-col items-center">
            <svg
              class="h-9 w-full max-w-[220px] text-ink"
              viewBox="0 0 220 34"
              fill="currentColor"
              aria-hidden="true"
            >
              <rect
                v-for="(bar, idx) in barcodeBars"
                :key="idx"
                :x="bar.x"
                y="2"
                :width="bar.w"
                height="28"
              />
            </svg>
            <div class="mt-1 font-mono text-[10px] tracking-[0.22em] text-mute tabular">
              {{ voucherNo }}
            </div>
            <p class="mt-1.5 text-center text-[10px] text-stone">
              {{ verifiedNotice || '站内零实名留存 · 凭此码核对官方办理页 SKU' }}
            </p>
          </div>
        </div>

        <!-- 底部锯齿纸边（SVG） -->
        <svg
          class="block h-[8px] w-full text-[#fbfbfa]"
          viewBox="0 0 320 8"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <polygon
            fill="currentColor"
            points="0,0 320,0 320,2 312,8 304,0 296,8 288,0 280,8 272,0 264,8 256,0 248,8 240,0 232,8 224,0 216,8 208,0 200,8 192,0 184,8 176,0 168,8 160,0 152,8 144,0 136,8 128,0 120,8 112,0 104,8 96,0 88,8 80,0 72,8 64,0 56,8 48,0 40,8 32,0 24,8 16,0 8,8 0,2"
          />
        </svg>
      </div>
    </div>

    <!-- 下方互动操作胶囊 -->
    <div class="mt-2 flex flex-wrap items-center justify-center gap-2.5">
      <a
        v-if="officialUrl"
        :href="officialUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex h-10 items-center gap-1.5 rounded-full bg-primary px-5 text-[13px] font-semibold text-white transition-transform hover:bg-primary-bright active:scale-[0.97]"
      >
        <span>打开官方办理通道</span>
        <ArrowUpRight class="h-3.5 w-3.5" />
      </a>
      <button
        v-if="state === 'ready'"
        type="button"
        class="inline-flex h-10 items-center gap-1.5 rounded-full bg-canvas-dark px-5 text-[13px] font-semibold text-white transition-transform hover:bg-[#26292e] active:scale-[0.97]"
        @click="handleTearButton"
      >
        <Scissors class="h-3.5 w-3.5" />
        <span>撕下办理凭证</span>
      </button>

      <button
        v-if="state === 'torn'"
        type="button"
        class="inline-flex h-10 items-center gap-1.5 rounded-full bg-canvas-dark px-4 text-[13px] font-semibold text-white transition-transform hover:bg-[#26292e] active:scale-[0.97]"
        @click="copyVoucher"
      >
        <Check v-if="copied" class="h-3.5 w-3.5 text-accent-teal" />
        <Copy v-else class="h-3.5 w-3.5" />
        <span>{{ copied ? '已复制凭证' : '复制凭证摘要' }}</span>
      </button>

      <button
        v-if="state === 'torn'"
        type="button"
        class="inline-flex h-10 items-center gap-1.5 rounded-full border border-hairline-strong bg-canvas-light px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-surface-soft active:scale-[0.97]"
        @click="startPrinting"
      >
        <RotateCcw class="h-3.5 w-3.5" />
        <span>再打一张</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* 分段步进模拟真实热敏出票机逐行吐纸节奏 */
@keyframes thermalFeed {
  0% {
    transform: translate3d(0, -100%, 0);
  }
  20% {
    transform: translate3d(0, -78%, 0);
  }
  26% {
    transform: translate3d(0, -76%, 0);
  }
  46% {
    transform: translate3d(0, -52%, 0);
  }
  52% {
    transform: translate3d(0, -50%, 0);
  }
  72% {
    transform: translate3d(0, -24%, 0);
  }
  78% {
    transform: translate3d(0, -22%, 0);
  }
  100% {
    transform: translate3d(0, 0, 0);
  }
}

.thermal-paper.is-printing {
  animation: thermalFeed 1.25s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
}

.thermal-paper.is-torn {
  filter: drop-shadow(0 16px 26px rgba(0, 0, 0, 0.14));
}

@media (prefers-reduced-motion: reduce) {
  .thermal-paper.is-printing {
    animation: none;
  }
}
</style>
