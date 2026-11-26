<script setup lang="ts">
/* 原生 Vue 3 烟雾逐字凝结标题组件（SmokeType）
 * 效果：文字逐字从随风飘散的淡墨烟雾与 SVG 流体置换畸变中聚拢凝结为锐利字形
 * 细节：
 * - 凝结期间驱动 SVG feTurbulence + feDisplacementMap 流体烟雾边缘翻卷，并叠加柔和烟缕
 * - 凝结结束后自动撤销滤镜，保证最终大字 100% 原生清晰无发虚
 * - 支持滚入视口自动播放（IntersectionObserver）+ 点击标题重播整段烟雾凝结
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { fxEnabled } from '@/composables/useSpark';

const props = withDefaults(
  defineProps<{
    lines?: string[];
    text?: string;
    as?: 'h1' | 'h2' | 'h3' | 'p' | 'div';
    /** 每个字的起凝间隔（毫秒） */
    staggerMs?: number;
    /** 单个字从烟雾凝结成实字的时长（毫秒） */
    condenseMs?: number;
    /** 烟雾色彩（默认契合白底深墨与微靛青） */
    smokeColor?: string;
    /** 是否支持点击标题重新播放凝结动画 */
    replayOnClick?: boolean;
  }>(),
  {
    lines: undefined,
    text: '',
    as: 'h2',
    staggerMs: 85,
    condenseMs: 1050,
    smokeColor: 'rgba(42, 48, 72, 0.24)',
    replayOnClick: true,
  },
);

let uidCounter = 0;
const filterId = `smoke-type-filter-${++uidCounter}-${Math.random().toString(36).slice(2, 6)}`;

const normalizedLines = computed<string[]>(() => {
  if (props.lines && props.lines.length > 0) return props.lines;
  return props.text.split('\n').filter((l) => l.length > 0);
});

const fullAccessibleText = computed(() => normalizedLines.value.join(''));

interface SmokeChar {
  char: string;
  isSpace: boolean;
  index: number;
  /** 每个字独立的漂移风向起点 */
  driftX: number;
  driftY: number;
  driftRot: number;
}

const charLines = computed(() => {
  let cursor = 0;
  return normalizedLines.value.map((line) =>
    Array.from(line).map((ch): SmokeChar => {
      const idx = cursor++;
      const seed = (idx * 37 + 13) % 11;
      return {
        char: ch === ' ' ? '\u00A0' : ch,
        isSpace: ch === ' ',
        index: idx,
        driftX: 16 + (seed % 5) * 6,
        driftY: -14 - ((seed * 3) % 5) * 4,
        driftRot: (seed % 2 === 0 ? 1 : -1) * (3 + (seed % 4) * 1.4),
      };
    }),
  );
});

const totalChars = computed(() =>
  charLines.value.reduce((acc, row) => acc + row.length, 0),
);

const rootRef = ref<HTMLElement | null>(null);
const dispScale = ref(0);
const turbFreq = ref('0.028 0.042');
/** 每个字的凝结进度：0 = 尚未出现（烟散状态），1 = 100% 锐利凝结 */
const progressList = ref<number[]>([]);
const isAnimating = ref(false);
const hasPlayed = ref(false);
const hoveredIdx = ref<number | null>(null);

let observer: IntersectionObserver | null = null;
let rafId = 0;
let startTime = 0;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function setAllSettled() {
  progressList.value = Array.from({ length: totalChars.value }, () => 1);
  dispScale.value = 0;
  isAnimating.value = false;
  hasPlayed.value = true;
}

function startCondenseAnimation() {
  cancelAnimationFrame(rafId);

  if (!fxEnabled.value || prefersReducedMotion()) {
    setAllSettled();
    return;
  }

  progressList.value = Array.from({ length: totalChars.value }, () => 0);
  isAnimating.value = true;
  hasPlayed.value = true;
  startTime = performance.now();

  const totalDuration =
    Math.max(0, totalChars.value - 1) * props.staggerMs + props.condenseMs;

  const step = (now: number) => {
    const elapsed = now - startTime;
    let activeCount = 0;
    let maxTurbulenceWeight = 0;

    const next = progressList.value.slice();
    for (let i = 0; i < totalChars.value; i++) {
      const localElapsed = elapsed - i * props.staggerMs;
      if (localElapsed <= 0) {
        next[i] = 0;
      } else if (localElapsed >= props.condenseMs) {
        next[i] = 1;
      } else {
        const t = localElapsed / props.condenseMs;
        // 先柔缓聚雾、后段干脆凝实（Out-Quart）
        const eased = 1 - Math.pow(1 - t, 3.6);
        next[i] = eased;
        activeCount++;
        // 处于中前段聚雾时烟雾置换力度最强
        const w = Math.sin(t * Math.PI) * (1 - t * 0.45);
        if (w > maxTurbulenceWeight) maxTurbulenceWeight = w;
      }
    }
    progressList.value = next;

    // 动态推动烟雾湍流频率，产生缓缓飘移的流动感
    const fx = (0.022 + Math.sin(elapsed * 0.0022) * 0.006).toFixed(4);
    const fy = (0.036 + Math.cos(elapsed * 0.0018) * 0.008).toFixed(4);
    turbFreq.value = `${fx} ${fy}`;
    dispScale.value = Number((maxTurbulenceWeight * 24).toFixed(2));

    if (elapsed < totalDuration + 30 || activeCount > 0) {
      rafId = requestAnimationFrame(step);
    } else {
      setAllSettled();
    }
  };

  rafId = requestAnimationFrame(step);
}

function getCharStyle(item: SmokeChar) {
  const p = progressList.value[item.index] ?? (hasPlayed.value ? 1 : 0);
  if (p >= 0.999) {
    return {
      opacity: 1,
      transform: 'translate3d(0, 0, 0) scale(1) rotate(0deg)',
      filter: 'none',
    };
  }
  const inv = 1 - p;
  const x = (item.driftX * inv * inv).toFixed(2);
  const y = (item.driftY * inv * inv).toFixed(2);
  const scale = (1 + inv * 0.24).toFixed(3);
  const rot = (item.driftRot * inv).toFixed(2);
  const blur = (inv * inv * 13).toFixed(2);
  const opacity = Math.min(1, Math.pow(p, 0.72)).toFixed(3);

  // 仅在正在凝结的过程中挂上 SVG 流体烟雾置换，凝实后自动撤除保证绝对清晰
  const useDisp = isAnimating.value && p > 0.02 && p < 0.88 && dispScale.value > 0.4;
  return {
    opacity: Number(opacity),
    transform: `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rot}deg)`,
    filter: useDisp ? `url(#${filterId}) blur(${blur}px)` : `blur(${blur}px)`,
  };
}

/** 单字凝结中段散发的一缕淡墨烟雾气团透明度 */
function getWispOpacity(idx: number): number {
  const p = progressList.value[idx] ?? 1;
  if (p <= 0.01 || p >= 0.94) return 0;
  return Number((Math.sin(p * Math.PI) * 0.92).toFixed(3));
}

function getWispStyle(item: SmokeChar) {
  const p = progressList.value[item.index] ?? 1;
  const inv = 1 - p;
  return {
    opacity: getWispOpacity(item.index),
    transform: `translate3d(${(item.driftX * inv * 0.85).toFixed(1)}px, ${(item.driftY * inv * 0.95 - p * 12).toFixed(1)}px, 0) scale(${(0.75 + inv * 0.95).toFixed(2)})`,
    background: `radial-gradient(circle, ${props.smokeColor} 0%, rgba(73,79,223,0.10) 46%, rgba(255,255,255,0) 74%)`,
  };
}

function handleClick() {
  if (!props.replayOnClick || !fxEnabled.value) return;
  startCondenseAnimation();
}

onMounted(() => {
  if (!fxEnabled.value || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
    setAllSettled();
    return;
  }

  progressList.value = Array.from({ length: totalChars.value }, () => 0);

  if (!rootRef.value) {
    startCondenseAnimation();
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          startCondenseAnimation();
          observer?.disconnect();
          observer = null;
          break;
        }
      }
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -20px 0px',
    },
  );
  observer.observe(rootRef.value);
});

onUnmounted(() => {
  cancelAnimationFrame(rafId);
  observer?.disconnect();
  observer = null;
});
</script>

<template>
  <component
    :is="as"
    ref="rootRef"
    :aria-label="fullAccessibleText"
    class="smoke-type-root relative select-none"
    :class="replayOnClick && fxEnabled ? 'cursor-pointer' : ''"
    :title="replayOnClick && fxEnabled ? '点击重播烟雾凝结效果' : undefined"
    @click="handleClick"
  >
    <!-- 动态 SVG 流体烟雾边缘置换滤镜（仅凝结中生效，落字后自动卸载保清晰） -->
    <svg class="pointer-events-none absolute h-0 w-0 overflow-hidden" aria-hidden="true">
      <defs>
        <filter :id="filterId" x="-40%" y="-40%" width="180%" height="180%">
          <feTurbulence
            type="fractalNoise"
            :baseFrequency="turbFreq"
            numOctaves="2"
            seed="7"
            result="smokeNoise"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="smokeNoise"
            :scale="dispScale"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
    </svg>

    <span
      v-for="(line, lIdx) in charLines"
      :key="lIdx"
      aria-hidden="true"
      class="block"
    >
      <span
        v-for="item in line"
        :key="item.index"
        class="smoke-char-wrap relative inline-block align-baseline"
        @pointerenter="hoveredIdx = item.index"
        @pointerleave="hoveredIdx = null"
      >
        <!-- 凝结时飘散的一缕淡墨烟雾团 -->
        <span
          v-if="!item.isSpace && fxEnabled"
          class="pointer-events-none absolute -inset-x-3 -inset-y-2 rounded-full blur-[9px]"
          :style="getWispStyle(item)"
        />

        <!-- 悬停轻拂淡墨余烟反馈 -->
        <span
          v-if="!item.isSpace && fxEnabled && !isAnimating"
          class="smoke-hover-wisp pointer-events-none absolute -inset-x-2 -inset-y-1 rounded-full blur-[10px] transition-all duration-500"
          :class="hoveredIdx === item.index ? 'opacity-100 -translate-y-2 scale-110' : 'opacity-0 translate-y-0 scale-90'"
          :style="{
            background: `radial-gradient(circle, ${smokeColor} 0%, rgba(73,79,223,0.12) 48%, transparent 72%)`,
          }"
        />

        <!-- 逐字凝结的实体字形 -->
        <span
          class="smoke-char relative z-10 inline-block will-change-transform"
          :style="getCharStyle(item)"
        >{{ item.char }}</span>
      </span>
    </span>
  </component>
</template>
