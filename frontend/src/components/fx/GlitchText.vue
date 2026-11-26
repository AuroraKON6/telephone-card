<script setup lang="ts">
/* 原生 Vue 3 光标局部故障解码文字组件（GlitchText）
 * 效果：鼠标滑过文本时，光标附近字符触发 RGB 色差裂变、水平切片抖动与信号符号瞬态解码；
 *       离开光标后平滑锁定回清晰原字；点击文字可触发一次全句从左到右的扫码故障波。
 * 稳定性：单字占位盒严格锁定原始宽度，故障层绝对定位叠加，零布局抖动、零 setInterval。
 */
import { computed, onUnmounted, ref } from 'vue';
import { fxEnabled } from '@/composables/useSpark';

const props = withDefaults(
  defineProps<{
    /** 支持多行数组或 \n 换行文本 */
    lines?: string[];
    text?: string;
    as?: 'h1' | 'h2' | 'h3' | 'p' | 'div' | 'span';
    /** 光标感应半径（px） */
    radius?: number;
    /** 色差裂变色 A（偏青/主色） */
    accentA?: string;
    /** 色差裂变色 B（偏红/紫） */
    accentB?: string;
  }>(),
  {
    lines: undefined,
    text: '',
    as: 'h2',
    radius: 135,
    accentA: '#00e5a8',
    accentB: '#e61e49',
  },
);

interface CharRuntime {
  /** 0 ~ 1 故障强度 */
  energy: number;
  /** RGB 通道水平错位像素 */
  shiftX: number;
  shiftY: number;
  /** 上下切片范围 */
  sliceTop: number;
  sliceBottom: number;
  /** 瞬态故障乱码字符（null 表示显示原字） */
  scramble: string | null;
}

const SCRAMBLE_POOL = '01#¥%$<>/{}[]§∆≡≠';

const normalizedLines = computed<string[]>(() => {
  if (props.lines && props.lines.length > 0) return props.lines;
  return props.text.split('\n').filter((s) => s.length > 0);
});

const fullAccessibleText = computed(() => normalizedLines.value.join(''));

const charMatrix = computed(() => {
  let idx = 0;
  return normalizedLines.value.map((line) =>
    Array.from(line).map((ch) => ({
      char: ch === ' ' ? '\u00A0' : ch,
      isSpace: ch === ' ',
      index: idx++,
    })),
  );
});

const totalChars = computed(() =>
  charMatrix.value.reduce((acc, row) => acc + row.length, 0),
);

const rootRef = ref<HTMLElement | null>(null);
const charEls = ref<Array<HTMLElement | null>>([]);
const states = ref<CharRuntime[]>([]);

function ensureStates() {
  if (states.value.length !== totalChars.value) {
    states.value = Array.from({ length: totalChars.value }, () => ({
      energy: 0,
      shiftX: 0,
      shiftY: 0,
      sliceTop: 0,
      sliceBottom: 100,
      scramble: null,
    }));
  }
}

function setCharRef(el: unknown, idx: number) {
  charEls.value[idx] = el instanceof HTMLElement ? el : null;
}

const pointer = { x: -9999, y: -9999, active: false };
let sweepProgress = -1; // >= 0 时表示点击触发的全句扫描故障波
let rafId = 0;
let lastFrame = 0;
let lastScrambleTick = 0;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function startLoop() {
  if (rafId || !fxEnabled.value || prefersReducedMotion()) return;
  lastFrame = performance.now();
  rafId = requestAnimationFrame(tick);
}

function tick(now: number) {
  rafId = 0;
  ensureStates();

  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;

  const canScrambleStep = now - lastScrambleTick > 46;
  if (canScrambleStep) lastScrambleTick = now;

  if (sweepProgress >= 0) {
    sweepProgress += dt * 1.9;
    if (sweepProgress > 1.35) sweepProgress = -1;
  }

  let anyActive = pointer.active || sweepProgress >= 0;
  const radius = props.radius;
  const total = Math.max(1, totalChars.value);

  for (let i = 0; i < states.value.length; i++) {
    const st = states.value[i];
    const el = charEls.value[i];

    let targetEnergy = 0;

    // 1. 光标邻近感应故障场
    if (pointer.active && el) {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const dist = Math.hypot(pointer.x - cx, pointer.y - cy);
      if (dist < radius) {
        const proximity = 1 - dist / radius;
        targetEnergy = Math.max(targetEnergy, Math.pow(proximity, 1.35));
      }
    }

    // 2. 点击触发的全句扫频解码波
    if (sweepProgress >= 0) {
      const charNorm = i / total;
      const waveDist = Math.abs(charNorm - sweepProgress);
      if (waveDist < 0.2) {
        targetEnergy = Math.max(targetEnergy, (1 - waveDist / 0.2) * 0.95);
      }
    }

    // 快速起振，离开光标后干脆解码回正
    if (targetEnergy > st.energy) {
      st.energy += (targetEnergy - st.energy) * Math.min(1, dt * 26);
    } else {
      st.energy = Math.max(0, st.energy - dt * 5.2);
    }

    if (st.energy > 0.03) {
      anyActive = true;
      if (canScrambleStep) {
        const amp = st.energy;
        st.shiftX = (Math.random() - 0.5) * 14 * amp;
        st.shiftY = (Math.random() - 0.5) * 5 * amp;
        const top = Math.floor(Math.random() * 56);
        const height = 18 + Math.floor(Math.random() * 34);
        st.sliceTop = top;
        st.sliceBottom = Math.min(100, top + height);

        // 仅在光标最核心处短暂闪现解码符号（概率克制，保持可读性）
        if (amp > 0.52 && Math.random() < 0.32) {
          st.scramble =
            SCRAMBLE_POOL[Math.floor(Math.random() * SCRAMBLE_POOL.length)];
        } else {
          st.scramble = null;
        }
      }
    } else {
      st.energy = 0;
      st.shiftX = 0;
      st.shiftY = 0;
      st.scramble = null;
    }
  }

  if (anyActive && fxEnabled.value && !prefersReducedMotion()) {
    rafId = requestAnimationFrame(tick);
  }
}

function handlePointerMove(e: PointerEvent) {
  if (!fxEnabled.value || prefersReducedMotion()) return;
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.active = true;
  startLoop();
}

function handlePointerLeave() {
  pointer.active = false;
  if (states.value.some((s) => s.energy > 0)) {
    startLoop();
  }
}

function triggerSweep() {
  if (!fxEnabled.value || prefersReducedMotion()) return;
  sweepProgress = 0;
  startLoop();
}

onUnmounted(() => {
  cancelAnimationFrame(rafId);
});
</script>

<template>
  <component
    :is="as"
    ref="rootRef"
    :aria-label="fullAccessibleText"
    class="glitch-text-root cursor-default select-none"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
    @click="triggerSweep"
  >
    <span
      v-for="(row, rIdx) in charMatrix"
      :key="rIdx"
      aria-hidden="true"
      class="block"
    >
      <span
        v-for="item in row"
        :key="item.index"
        :ref="(el) => setCharRef(el, item.index)"
        class="glitch-char relative inline-block align-baseline"
      >
        <!-- 锁定原字宽的基准占位层，绝不造成整行跳动 -->
        <span
          class="relative z-10 inline-block transition-opacity duration-75"
          :style="
            states[item.index] && states[item.index].energy > 0.04 && !item.isSpace
              ? {
                  transform: `translate3d(${(states[item.index].shiftX * 0.22).toFixed(1)}px, ${(states[item.index].shiftY * 0.25).toFixed(1)}px, 0)`,
                  opacity: states[item.index].scramble ? 0.16 : 1,
                }
              : undefined
          "
        >{{ item.char }}</span>

        <!-- 光标核心瞬态解码符号叠层（严格居中在原字盒内，不撑开宽度） -->
        <span
          v-if="states[item.index]?.scramble && !item.isSpace"
          class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center font-mono font-semibold"
          :style="{ color: accentA }"
        >{{ states[item.index].scramble }}</span>

        <!-- RGB 裂变青绿切片通道 A -->
        <span
          v-if="states[item.index] && states[item.index].energy > 0.05 && !item.isSpace"
          class="pointer-events-none absolute inset-0 z-20 inline-block"
          :style="{
            color: accentA,
            opacity: Math.min(0.95, states[item.index].energy * 0.95),
            transform: `translate3d(${states[item.index].shiftX.toFixed(1)}px, ${states[item.index].shiftY.toFixed(1)}px, 0)`,
            clipPath: `inset(${states[item.index].sliceTop}% 0 ${100 - states[item.index].sliceBottom}% 0)`,
            mixBlendMode: 'screen',
          }"
        >{{ item.char }}</span>

        <!-- RGB 裂变绯红/紫切片通道 B -->
        <span
          v-if="states[item.index] && states[item.index].energy > 0.05 && !item.isSpace"
          class="pointer-events-none absolute inset-0 z-20 inline-block"
          :style="{
            color: accentB,
            opacity: Math.min(0.92, states[item.index].energy * 0.92),
            transform: `translate3d(${(-states[item.index].shiftX * 1.05).toFixed(1)}px, ${(-states[item.index].shiftY * 0.8).toFixed(1)}px, 0)`,
            clipPath: `inset(${100 - states[item.index].sliceBottom}% 0 ${states[item.index].sliceTop}% 0)`,
            mixBlendMode: 'screen',
          }"
        >{{ item.char }}</span>
      </span>
    </span>
  </component>
</template>
