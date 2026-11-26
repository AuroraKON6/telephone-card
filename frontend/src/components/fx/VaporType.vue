<script setup lang="ts">
/* 原生 Vue 3 像素采样微粒汽化与凝结标题组件（VaporType）
 * 效果：文字由细碎水汽微粒聚拢凝结为锐利 DOM 正字 -> 清晰停留 -> 从左向右解体为升腾蒸汽微粒随风飘散 -> 凝结下一句
 * 性能与稳定性：
 * - 定格态渲染原生 DOM 文字确保 100% 清晰无发糊；凝结/汽化过渡由高 DPR Canvas 2D 驱动
 * - IntersectionObserver 滚出视口自动休眠，零 setInterval，完整兼容 fxEnabled 与 prefers-reduced-motion
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { fxEnabled } from '@/composables/useSpark';

const props = withDefaults(
  defineProps<{
    /** 轮播标语列表，每项为多行数组（保持工整断行） */
    phrases: string[][];
    as?: 'h1' | 'h2' | 'h3' | 'p' | 'div';
    /** 字体主色（白底默认 Revolut Ink #191c1f） */
    color?: string;
    /** 汽化边缘一抹点缀色（柔和钴紫） */
    vaporAccent?: string;
    /** 凝结时长（秒） */
    condenseSec?: number;
    /** 清晰定格停留时长（秒） */
    holdSec?: number;
    /** 汽化飘散时长（秒） */
    vaporizeSec?: number;
  }>(),
  {
    as: 'h2',
    color: '#191c1f',
    vaporAccent: '#494fdf',
    condenseSec: 1.15,
    holdSec: 3.4,
    vaporizeSec: 1.25,
  },
);

interface VaporParticle {
  /** 目标文字像素坐标（CSS px） */
  tx: number;
  ty: number;
  /** 凝结起点偏移 */
  sx: number;
  sy: number;
  /** 汽化飘散速度向量 */
  vx: number;
  vy: number;
  /** 从左到右错峰启动归一化时间 [0, 0.52] */
  stagger: number;
  size: number;
  alpha: number;
  swirlPhase: number;
  tinted: boolean;
}

type Phase = 'condensing' | 'holding' | 'vaporizing';

const wrapRef = ref<HTMLDivElement | null>(null);
const textRef = ref<HTMLElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

const activeIdx = ref(0);
const phase = ref<Phase>('holding');
const domOpacity = ref(1);
const canvasW = ref(1);
const canvasH = ref(1);

const PAD_TOP = 44;
const PAD_RIGHT = 84;
const PAD_BOTTOM = 12;

const currentLines = computed(() => props.phrases[activeIdx.value] ?? props.phrases[0] ?? []);
const fullAccessibleText = computed(() => currentLines.value.join(''));

let particles: VaporParticle[] = [];
let rafId = 0;
let alive = true;
let visible = true;
let phaseClock = 0;
let lastFrame = performance.now();
let ro: ResizeObserver | null = null;
let io: IntersectionObserver | null = null;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** 将当前 DOM 标题的真实排版精确栅格化到离屏 Canvas 并采样出文字微粒 */
function sampleCurrentTextParticles() {
  const wrap = wrapRef.value;
  const textEl = textRef.value;
  const canvas = canvasRef.value;
  if (!wrap || !textEl || !canvas) return;

  const wrapRect = wrap.getBoundingClientRect();
  const w = Math.max(1, Math.ceil(wrapRect.width));
  const h = Math.max(1, Math.ceil(wrapRect.height));
  canvasW.value = w + PAD_RIGHT;
  canvasH.value = h + PAD_TOP + PAD_BOTTOM;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(canvasW.value * dpr);
  canvas.height = Math.floor(canvasH.value * dpr);
  const mainCtx = canvas.getContext('2d');
  if (mainCtx) mainCtx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // 离屏 1x 采样画布（采样精度高且构建毫秒级完成）
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  const computedStyle = window.getComputedStyle(textEl);
  const fontSize = parseFloat(computedStyle.fontSize) || 56;
  const fontWeight = computedStyle.fontWeight || '500';
  const fontFamily = computedStyle.fontFamily || 'sans-serif';
  const lineHeightRaw = parseFloat(computedStyle.lineHeight);
  const lineHeight = Number.isFinite(lineHeightRaw) ? lineHeightRaw : fontSize * 1.08;

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#000000';
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  if ('letterSpacing' in ctx && computedStyle.letterSpacing && computedStyle.letterSpacing !== 'normal') {
    (ctx as CanvasRenderingContext2D & { letterSpacing?: string }).letterSpacing = computedStyle.letterSpacing;
  }
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  // 按真实 DOM span 中心线绘制，保证微粒与正字像素级重合无垂直跳动
  const lineEls = textEl.querySelectorAll('span');
  const lines = currentLines.value;
  lines.forEach((line, i) => {
    const spanEl = lineEls[i];
    if (spanEl) {
      const spanRect = spanEl.getBoundingClientRect();
      const x = Math.max(0, spanRect.left - wrapRect.left);
      const cy = spanRect.top - wrapRect.top + spanRect.height * 0.52;
      ctx.fillText(line, x, cy);
    } else {
      const cy = i * lineHeight + lineHeight * 0.52;
      ctx.fillText(line, 0, cy);
    }
  });

  const img = ctx.getImageData(0, 0, w, h).data;
  // 按实际文字绘制宽度归一化 X，让从左向右的汽化波完整扫过整句
  const maxTextX = Math.max(
    1,
    ...lines.map((line) => ctx.measureText(line).width),
  );
  // 动态步长控制在 ~1800-3200 颗微粒，既细腻如雾又保持 60fps
  const step = w < 620 ? 2 : 3;
  const sampled: VaporParticle[] = [];

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const a = img[(y * w + x) * 4 + 3];
      if (a > 72) {
        const normX = Math.min(1, x / maxTextX);
        const jitterX = (Math.random() - 0.5) * 1.6;
        const jitterY = (Math.random() - 0.5) * 1.6;
        const tx = x + jitterX;
        const ty = y + PAD_TOP + jitterY;

        sampled.push({
          tx,
          ty,
          // 凝结起点：从右上方柔和飘散的水汽回拢
          sx: tx + 18 + Math.random() * 52,
          sy: ty - 16 - Math.random() * 42,
          // 汽化飘散向量：向右上方随风吹散上升
          vx: 42 + Math.random() * 108,
          vy: -(26 + Math.random() * 72),
          stagger: normX * 0.48 + Math.random() * 0.12,
          size: step * (0.5 + Math.random() * 0.4),
          alpha: (a / 255) * (0.76 + Math.random() * 0.24),
          swirlPhase: Math.random() * Math.PI * 2,
          tinted: Math.random() < 0.26,
        });
      }
    }
  }

  particles = sampled;
}

function clearCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.clearRect(0, 0, canvasW.value, canvasH.value);
}

function drawParticles(mode: 'condensing' | 'vaporizing', normalizedClock: number) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvasW.value, canvasH.value);

  // 凝结尾段柔和淡出微粒，与原生 DOM 正字平滑衔接零闪烁
  const condenseFadeOut =
    mode === 'condensing' && normalizedClock > 0.82
      ? Math.max(0, 1 - (normalizedClock - 0.82) / 0.18)
      : 1;

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];

    if (mode === 'condensing') {
      const localT = Math.min(1, Math.max(0, (normalizedClock - p.stagger * 0.72) / 0.56));
      if (localT <= 0) continue;
      // Out-Cubic 柔和聚拢归位
      const ease = 1 - Math.pow(1 - localT, 3);
      const inv = 1 - ease;
      const swirl = Math.sin(localT * Math.PI * 1.6 + p.swirlPhase) * inv * 10;
      const x = p.tx + (p.sx - p.tx) * inv + swirl;
      const y = p.ty + (p.sy - p.ty) * inv;
      const radius = p.size * (0.85 + inv * 1.25);
      const alpha = p.alpha * Math.pow(localT, 0.72) * condenseFadeOut;

      if (alpha <= 0.01) continue;
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = inv > 0.32 && p.tinted ? props.vaporAccent : props.color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const localT = Math.min(1, Math.max(0, (normalizedClock - p.stagger * 0.85) / 0.6));
      if (localT >= 1) continue;
      // In-Quad 轻盈加速随风汽化吹散
      const drift = localT * localT;
      const swirl = Math.sin(localT * 5.2 + p.swirlPhase) * localT * 14;
      const x = p.tx + p.vx * drift + swirl;
      const y = p.ty + p.vy * drift;
      const radius = p.size * (1 + localT * 1.38);
      const alpha = p.alpha * Math.pow(1 - localT, 1.5);

      if (alpha <= 0.01) continue;
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = localT > 0.22 && p.tinted ? props.vaporAccent : props.color;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function advancePhraseAndCondense() {
  activeIdx.value = (activeIdx.value + 1) % Math.max(1, props.phrases.length);
  phase.value = 'condensing';
  phaseClock = 0;
  domOpacity.value = 0;
  particles = [];
  nextTick(() => {
    sampleCurrentTextParticles();
  });
}

function tick(now: number) {
  rafId = 0;
  if (!alive || !visible) return;

  if (!fxEnabled.value || prefersReducedMotion()) {
    phase.value = 'holding';
    domOpacity.value = 1;
    clearCanvas();
    return;
  }

  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;
  phaseClock += dt;

  if (phase.value === 'condensing') {
    const t = Math.min(1, phaseClock / props.condenseSec);
    domOpacity.value = t > 0.78 ? Math.min(1, (t - 0.78) / 0.22) : 0;
    drawParticles('condensing', t);
    if (t >= 1) {
      phase.value = 'holding';
      phaseClock = 0;
      domOpacity.value = 1;
      clearCanvas();
    }
  } else if (phase.value === 'holding') {
    domOpacity.value = 1;
    if (phaseClock >= props.holdSec && props.phrases.length > 1) {
      phase.value = 'vaporizing';
      phaseClock = 0;
      sampleCurrentTextParticles();
      domOpacity.value = 0;
      drawParticles('vaporizing', 0);
    }
  } else if (phase.value === 'vaporizing') {
    const t = Math.min(1, phaseClock / props.vaporizeSec);
    domOpacity.value = 0;
    drawParticles('vaporizing', t);
    if (t >= 1) {
      clearCanvas();
      advancePhraseAndCondense();
    }
  }

  rafId = requestAnimationFrame(tick);
}

function startLoop() {
  if (rafId || !alive || !visible) return;
  if (!fxEnabled.value || prefersReducedMotion()) {
    domOpacity.value = 1;
    clearCanvas();
    return;
  }
  lastFrame = performance.now();
  rafId = requestAnimationFrame(tick);
}

/** 点击立即把当前字形汽化并凝结下一句 */
function triggerVaporNow() {
  if (!fxEnabled.value || prefersReducedMotion()) return;
  if (phase.value === 'holding') {
    sampleCurrentTextParticles();
    phase.value = 'vaporizing';
    phaseClock = 0;
    domOpacity.value = 0;
    drawParticles('vaporizing', 0);
    startLoop();
  }
}

watch(fxEnabled, (enabled) => {
  if (!enabled) {
    cancelAnimationFrame(rafId);
    rafId = 0;
    phase.value = 'holding';
    domOpacity.value = 1;
    clearCanvas();
  } else {
    phase.value = 'condensing';
    phaseClock = 0;
    domOpacity.value = 0;
    nextTick(() => {
      sampleCurrentTextParticles();
      startLoop();
    });
  }
});

onMounted(async () => {
  alive = true;
  if (document.fonts?.ready) {
    await document.fonts.ready;
  }
  if (!alive) return;

  if (!fxEnabled.value || prefersReducedMotion()) {
    phase.value = 'holding';
    domOpacity.value = 1;
    return;
  }

  sampleCurrentTextParticles();

  if (wrapRef.value) {
    ro = new ResizeObserver(() => {
      if (phase.value !== 'holding') {
        sampleCurrentTextParticles();
      }
    });
    ro.observe(wrapRef.value);

    io = new IntersectionObserver(
      ([entry]) => {
        const nowVis = entry ? entry.isIntersecting : true;
        if (nowVis && !visible) {
          visible = true;
          if (phase.value === 'holding' && phaseClock === 0) {
            phase.value = 'condensing';
            domOpacity.value = 0;
            sampleCurrentTextParticles();
          }
          startLoop();
        } else if (!nowVis) {
          visible = false;
          cancelAnimationFrame(rafId);
          rafId = 0;
        }
      },
      { threshold: 0.15 },
    );
    visible = false;
    io.observe(wrapRef.value);
  }
});

onUnmounted(() => {
  alive = false;
  visible = false;
  cancelAnimationFrame(rafId);
  ro?.disconnect();
  io?.disconnect();
});
</script>

<template>
  <div
    ref="wrapRef"
    class="vapor-type-root relative select-none"
    :class="fxEnabled ? 'cursor-pointer' : ''"
    :title="fxEnabled ? '点击立即汽化切换下一句' : undefined"
    @click="triggerVaporNow"
  >
    <!-- 原生语义标题层（定格时 100% 锐利显示，凝结/汽化时占位保高度零跳动） -->
    <component
      :is="as"
      ref="textRef"
      :aria-label="fullAccessibleText"
      :style="{ opacity: domOpacity }"
    >
      <span
        v-for="(line, idx) in currentLines"
        :key="idx"
        class="block"
      >
        {{ line }}
      </span>
    </component>

    <!-- 高 DPR 像素微粒蒸汽画布（向上与向右适度溢出，容纳飘散水汽） -->
    <canvas
      ref="canvasRef"
      aria-hidden="true"
      class="pointer-events-none absolute left-0"
      :style="{
        top: `-${PAD_TOP}px`,
        width: `${canvasW}px`,
        height: `${canvasH}px`,
      }"
    />
  </div>
</template>
