<script setup lang="ts">
/* 全局轻量点击微光粒子火花层（借鉴 vue-bits ClickSpark）
 * 仅在有激活粒子时启动 requestAnimationFrame，静止时 CPU 占用为 0
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { onSparkBurst } from '@/composables/useSpark';

interface Spark {
  x: number;
  y: number;
  angle: number;
  speed: number;
  length: number;
  color: string;
  age: number;
  maxAge: number;
}

const canvasRef = ref<HTMLCanvasElement | null>(null);
const sparks: Spark[] = [];
let rafId: number | null = null;
let unsubscribe: (() => void) | null = null;

const DEFAULT_COLORS = ['#6d73ff', '#ffffff', '#00c495', '#a5a9ff'];

function syncSize() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function tick() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.age += 1;
    const t = s.age / s.maxAge;
    if (t >= 1) {
      sparks.splice(i, 1);
      continue;
    }

    // 指数减速扩散，干净利落不拖泥带水
    const ease = 1 - Math.pow(1 - t, 3);
    const dist = s.speed * ease * 34;
    const lineLen = s.length * (1 - t);
    const x1 = s.x + Math.cos(s.angle) * dist;
    const y1 = s.y + Math.sin(s.angle) * dist;
    const x2 = s.x + Math.cos(s.angle) * (dist + lineLen);
    const y2 = s.y + Math.sin(s.angle) * (dist + lineLen);

    ctx.save();
    ctx.globalAlpha = Math.max(0, 1 - t * t);
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  if (sparks.length > 0) {
    rafId = requestAnimationFrame(tick);
  } else {
    rafId = null;
  }
}

function spawnBurst(x: number, y: number, colors?: string[]) {
  const palette = colors && colors.length > 0 ? colors : DEFAULT_COLORS;
  const count = 10;
  const baseOffset = Math.random() * Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const angle = baseOffset + (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.25;
    sparks.push({
      x,
      y,
      angle,
      speed: 0.8 + Math.random() * 0.65,
      length: 7 + Math.random() * 6,
      color: palette[i % palette.length],
      age: 0,
      maxAge: 22 + Math.floor(Math.random() * 10),
    });
  }
  if (rafId === null) {
    rafId = requestAnimationFrame(tick);
  }
}

onMounted(() => {
  syncSize();
  window.addEventListener('resize', syncSize, { passive: true });
  unsubscribe = onSparkBurst(({ x, y, colors }) => spawnBurst(x, y, colors));
});

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
  window.removeEventListener('resize', syncSize);
  if (unsubscribe) unsubscribe();
});
</script>

<template>
  <canvas
    ref="canvasRef"
    class="pointer-events-none fixed inset-0 z-[70] h-full w-full"
    aria-hidden="true"
  />
</template>
