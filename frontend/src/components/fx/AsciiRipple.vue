<script setup lang="ts">
/* 原生 Vue 3 字符水波涟漪背景组件（AsciiRipple）
 * 物理引擎：2D 离散浅水波波动方程（支持真实波纹扩散、干涉叠加与阻尼衰减）
 * 视觉表现：
 * - 静止态呈轻盈克制的等宽字符微点阵，完美融入 Revolut 浅灰卡片画布（#f5f6f8）
 * - 鼠标滑过或点击容器内任意区域（含前景卡片上方）即激起连贯尾迹与同心水波，字符按波高动态切换密度字形并随波面法向发生水波折射偏移
 * - 完整支持 IntersectionObserver 离屏休眠、全局流光开关（fxEnabled）与 prefers-reduced-motion
 */
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { fxEnabled } from '@/composables/useSpark';

const props = withDefaults(
  defineProps<{
    /** 字符网格列宽（CSS px） */
    cellWidth?: number;
    /** 字符网格行高（CSS px） */
    cellHeight?: number;
    /** 静止基底字符色 */
    baseColor?: string;
    /** 波峰强调色（默认 Revolut 钴紫） */
    crestColor?: string;
    /** 波谷点缀色（默认清透青绿） */
    troughColor?: string;
    /** 阻尼系数（越接近 1 涟漪传播越远） */
    damping?: number;
    /** 是否定时滴落轻柔自然水滴涟漪 */
    ambientDrops?: boolean;
  }>(),
  {
    cellWidth: 14,
    cellHeight: 18,
    baseColor: '#b5bcc8',
    crestColor: '#494fdf',
    troughColor: '#0f766e',
    damping: 0.962,
    ambientDrops: true,
  },
);

// 从静水微点到高能波峰的 ASCII 字符密度梯度
const RAMP = ['·', ':', '-', '~', '+', '=', '*', '%', '#', '@'] as const;

type RGB = [number, number, number];

function hexToRgb(hex: string, fallback: RGB): RGB {
  try {
    const clean = hex.trim().replace('#', '');
    if (clean.length === 3) {
      return [
        parseInt(clean[0] + clean[0], 16),
        parseInt(clean[1] + clean[1], 16),
        parseInt(clean[2] + clean[2], 16),
      ];
    }
    if (clean.length >= 6) {
      return [
        parseInt(clean.slice(0, 2), 16),
        parseInt(clean.slice(2, 4), 16),
        parseInt(clean.slice(4, 6), 16),
      ];
    }
    return fallback;
  } catch {
    return fallback;
  }
}

function lerpChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

const hostRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);

let startLoopFn: (() => void) | null = null;
let stopLoopFn: (() => void) | null = null;
let cleanupFn: (() => void) | null = null;

watch(fxEnabled, (enabled) => {
  if (enabled) {
    startLoopFn?.();
  } else {
    stopLoopFn?.();
  }
});

onMounted(() => {
  const host = hostRef.value;
  const canvas = canvasRef.value;
  if (!host || !canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const baseRgb = hexToRgb(props.baseColor, [181, 188, 200]);
  const crestRgb = hexToRgb(props.crestColor, [73, 79, 223]);
  const troughRgb = hexToRgb(props.troughColor, [15, 118, 110]);

  const reducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  let width = 1;
  let height = 1;
  let cols = 1;
  let rows = 1;
  let prev = new Float32Array(1);
  let curr = new Float32Array(1);
  let next = new Float32Array(1);

  let alive = true;
  let visible = true;
  let rafId = 0;
  let lastNow = performance.now();
  let stepAcc = 0;
  let ambientClock = 0;
  let lastPointerCol = -1;
  let lastPointerRow = -1;
  let isInside = false;

  /** 在指定网格坐标注入平滑高斯水波脉冲 */
  const injectRipple = (cx: number, cy: number, strength: number, radius = 2.2) => {
    const rCeil = Math.ceil(radius);
    const r2 = radius * radius;
    const minY = Math.max(1, Math.floor(cy) - rCeil);
    const maxY = Math.min(rows - 2, Math.ceil(cy) + rCeil);
    const minX = Math.max(1, Math.floor(cx) - rCeil);
    const maxX = Math.min(cols - 2, Math.ceil(cx) + rCeil);

    for (let y = minY; y <= maxY; y++) {
      const dy = y - cy;
      for (let x = minX; x <= maxX; x++) {
        const dx = x - cx;
        const d2 = dx * dx + dy * dy;
        if (d2 <= r2) {
          const falloff = Math.exp((-d2 / r2) * 2.4);
          const idx = y * cols + x;
          curr[idx] = Math.max(-2.6, Math.min(2.6, curr[idx] + strength * falloff));
        }
      }
    }
  };

  /** 推进 1 步 2D 浅水波波动方程 */
  const stepWave = () => {
    const damp = props.damping;
    for (let y = 1; y < rows - 1; y++) {
      const rowOff = y * cols;
      for (let x = 1; x < cols - 1; x++) {
        const i = rowOff + x;
        const avgNeighbors =
          (curr[i - 1] + curr[i + 1] + curr[i - cols] + curr[i + cols]) * 0.5;
        let val = (avgNeighbors - prev[i]) * damp;
        // 极小尾波清零避免无意义浮点抖动
        if (val > -0.0008 && val < 0.0008) val = 0;
        next[i] = val;
      }
    }
    // 软吸收边界，防止硬反射造成边缘噪点
    for (let x = 0; x < cols; x++) {
      next[x] = next[cols + x] * 0.45;
      next[(rows - 1) * cols + x] = next[(rows - 2) * cols + x] * 0.45;
    }
    for (let y = 0; y < rows; y++) {
      next[y * cols] = next[y * cols + 1] * 0.45;
      next[y * cols + (cols - 1)] = next[y * cols + (cols - 2)] * 0.45;
    }

    const tmp = prev;
    prev = curr;
    curr = next;
    next = tmp;
  };

  /** 渲染等宽 ASCII 水波字符阵 */
  const render = () => {
    ctx.clearRect(0, 0, width, height);
    const cw = props.cellWidth;
    const ch = props.cellHeight;
    const offsetX = (width - cols * cw) * 0.5 + cw * 0.5;
    const offsetY = (height - rows * ch) * 0.5 + ch * 0.5;

    ctx.font = `500 ${Math.round(cw * 0.86)}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let y = 0; y < rows; y++) {
      const rowOff = y * cols;
      const basePy = offsetY + y * ch;
      for (let x = 0; x < cols; x++) {
        const i = rowOff + x;
        const h = curr[i];
        const absH = Math.abs(h);

        // 计算局部水面斜率用于轻微折射偏移
        const left = x > 0 ? curr[i - 1] : h;
        const right = x < cols - 1 ? curr[i + 1] : h;
        const up = y > 0 ? curr[i - cols] : h;
        const down = y < rows - 1 ? curr[i + cols] : h;
        const gx = right - left;
        const gy = down - up;

        const energy = Math.min(1, absH * 1.15 + Math.hypot(gx, gy) * 0.42);

        // 选取 ASCII 字形：静水呈极细微点，波浪涌起渐次演变为 ~ + = * % # @
        let glyph: string;
        if (energy < 0.045) {
          glyph = RAMP[0];
        } else {
          const rampIdx = Math.min(
            RAMP.length - 1,
            Math.max(1, Math.floor(energy * (RAMP.length - 0.15))),
          );
          // 陡峭波斜面上偶现折射斜杠增强液态流动感
          if (rampIdx >= 3 && rampIdx <= 5 && Math.abs(gx) > 0.35 && Math.abs(gy) > 0.25) {
            glyph = gx * gy > 0 ? '/' : '\\';
          } else {
            glyph = RAMP[rampIdx];
          }
        }

        // 波峰染 Revolut 钴紫、波谷染深青，静水保持克制中性灰
        const targetRgb = h >= 0 ? crestRgb : troughRgb;
        const colorMix = Math.min(1, Math.pow(energy, 0.78));
        const r = lerpChannel(baseRgb[0], targetRgb[0], colorMix);
        const g = lerpChannel(baseRgb[1], targetRgb[1], colorMix);
        const b = lerpChannel(baseRgb[2], targetRgb[2], colorMix);
        const alpha = 0.26 + Math.min(0.68, energy * 0.78);

        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
        const px = offsetX + x * cw + gx * 3.8;
        const py = basePy + gy * 3.8;
        ctx.fillText(glyph, px, py);
      }
    }
  };

  const resize = () => {
    const rect = host.getBoundingClientRect();
    width = Math.max(1, Math.ceil(rect.width));
    height = Math.max(1, Math.ceil(rect.height));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const newCols = Math.max(8, Math.floor(width / props.cellWidth));
    const newRows = Math.max(6, Math.floor(height / props.cellHeight));
    if (newCols !== cols || newRows !== rows) {
      cols = newCols;
      rows = newRows;
      const total = cols * rows;
      prev = new Float32Array(total);
      curr = new Float32Array(total);
      next = new Float32Array(total);

      // 初始注入两朵轻柔涟漪，入镜即现清透水波质感
      if (!reducedMotion && fxEnabled.value) {
        injectRipple(cols * 0.76, rows * 0.24, 1.35, 3.0);
        injectRipple(cols * 0.22, rows * 0.68, 0.95, 2.6);
      }
    }

    render();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!fxEnabled.value || reducedMotion || !visible) return;
    const rect = host.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;
    if (lx < 0 || ly < 0 || lx > rect.width || ly > rect.height) {
      isInside = false;
      lastPointerCol = -1;
      lastPointerRow = -1;
      return;
    }

    const col = (lx / Math.max(1, rect.width)) * (cols - 1);
    const row = (ly / Math.max(1, rect.height)) * (rows - 1);

    if (isInside && lastPointerCol >= 0) {
      // 沿鼠标轨迹插值补点，快速划过也能拉出丝滑连续水波尾迹
      const dist = Math.hypot(col - lastPointerCol, row - lastPointerRow);
      const steps = Math.min(10, Math.max(1, Math.ceil(dist * 0.9)));
      for (let s = 1; s <= steps; s++) {
        const frac = s / steps;
        const ix = lastPointerCol + (col - lastPointerCol) * frac;
        const iy = lastPointerRow + (row - lastPointerRow) * frac;
        injectRipple(ix, iy, 0.85, 2.2);
      }
    } else {
      injectRipple(col, row, 1.15, 2.5);
    }

    isInside = true;
    lastPointerCol = col;
    lastPointerRow = row;
  };

  const onPointerDown = (e: PointerEvent) => {
    if (!fxEnabled.value || reducedMotion || !visible) return;
    const rect = host.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;
    if (lx < 0 || ly < 0 || lx > rect.width || ly > rect.height) return;
    const col = (lx / Math.max(1, rect.width)) * (cols - 1);
    const row = (ly / Math.max(1, rect.height)) * (rows - 1);
    injectRipple(col, row, 2.1, 3.2);
  };

  const tick = (now: number) => {
    rafId = 0;
    if (!alive || !visible || !fxEnabled.value) return;

    const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;

    if (!reducedMotion) {
      // 固定 48Hz 物理步进，确保不同刷新率屏幕上的波速均匀一致
      const FIXED_STEP = 1 / 48;
      stepAcc += dt;
      let stepped = 0;
      while (stepAcc >= FIXED_STEP && stepped < 3) {
        stepWave();
        stepAcc -= FIXED_STEP;
        stepped++;
      }

      // 若长时间无指针交互，轻柔落下一滴环境水波保持生命力
      if (props.ambientDrops) {
        ambientClock += dt;
        if (ambientClock >= 2.6) {
          ambientClock = 0;
          const rx = cols * (0.14 + Math.random() * 0.72);
          const ry = rows * (0.16 + Math.random() * 0.68);
          injectRipple(rx, ry, 1.25, 2.8);
        }
      }
    }

    render();

    if (!reducedMotion) {
      rafId = requestAnimationFrame(tick);
    }
  };

  startLoopFn = () => {
    if (!alive || !visible || !fxEnabled.value || rafId) return;
    lastNow = performance.now();
    render();
    if (!reducedMotion) {
      rafId = requestAnimationFrame(tick);
    }
  };

  stopLoopFn = () => {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  };

  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry ? entry.isIntersecting : true;
      if (visible) {
        if (!reducedMotion && fxEnabled.value) {
          injectRipple(cols * 0.74, rows * 0.25, 1.3, 2.9);
        }
        startLoopFn?.();
      } else {
        stopLoopFn?.();
      }
    },
    { threshold: 0.05 },
  );
  io.observe(host);

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });

  resize();
  if (fxEnabled.value) {
    startLoopFn();
  }

  cleanupFn = () => {
    alive = false;
    stopLoopFn?.();
    startLoopFn = null;
    stopLoopFn = null;
    ro.disconnect();
    io.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerdown', onPointerDown);
  };
});

onUnmounted(() => {
  cleanupFn?.();
  cleanupFn = null;
});
</script>

<template>
  <div
    v-show="fxEnabled"
    ref="hostRef"
    class="ascii-ripple-bg pointer-events-none relative h-full w-full overflow-hidden"
    aria-hidden="true"
  >
    <canvas
      ref="canvasRef"
      class="block h-full w-full"
    />
  </div>
</template>
