<script setup lang="ts">
/* Hero 纯黑画布底层：60fps 交互式 5G 信号微粒星云连线 + 极光光晕
 * 借鉴 fx_glow_particles_catalog 中的 Aura / ShaderGradient / canvas-particle-network
 * 严守 Revolut 高对比度原则：整体低亮度克制发光，确保纯白主标题阅读对比度始终顶级
 */
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { fxEnabled } from '@/composables/useSpark';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  alpha: number;
  phase: number;
}

const canvasRef = ref<HTMLCanvasElement | null>(null);
const pointer = { x: -9999, y: -9999, active: false };

let rafId: number | null = null;
let particles: Particle[] = [];
let width = 0;
let height = 0;

const PALETTE = [
  'rgba(79, 85, 241, 0.95)',  // Revolut Cobalt Bright
  'rgba(124, 131, 255, 0.85)', // Soft Indigo
  'rgba(0, 168, 126, 0.85)',  // Accent Teal
  'rgba(255, 255, 255, 0.72)', // Crisp White star
];

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function initParticles() {
  const count = width < 768 ? 28 : 54;
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * 0.36,
    vy: (Math.random() - 0.5) * 0.36,
    radius: 1.1 + Math.random() * 1.8,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
    alpha: 0.3 + Math.random() * 0.55,
    phase: Math.random() * Math.PI * 2,
  }));
}

function resizeCanvas() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const parent = canvas.parentElement;
  if (!parent) return;
  const rect = parent.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  initParticles();
}

function drawFrame(time: number) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, width, height);

  if (!fxEnabled.value) return;

  const linkDist = width < 768 ? 95 : 132;
  const pointerDist = 170;

  // 1. 推进微粒位置与脉冲亮度
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;

    if (p.x < -10) p.x = width + 10;
    else if (p.x > width + 10) p.x = -10;
    if (p.y < -10) p.y = height + 10;
    else if (p.y > height + 10) p.y = -10;

    // 鼠标附近产生极轻柔的磁力偏移
    if (pointer.active) {
      const dx = pointer.x - p.x;
      const dy = pointer.y - p.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 18 && dist < pointerDist) {
        const pull = (1 - dist / pointerDist) * 0.015;
        p.x += dx * pull;
        p.y += dy * pull;
      }
    }
  }

  // 2. 绘制 5G 节点间纤细连线
  ctx.lineWidth = 0.75;
  for (let i = 0; i < particles.length; i++) {
    const a = particles[i];
    for (let j = i + 1; j < particles.length; j++) {
      const b = particles[j];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (dist < linkDist) {
        const ratio = 1 - dist / linkDist;
        ctx.strokeStyle = `rgba(116, 124, 255, ${(ratio * 0.22).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }

    // 鼠标连线（交互式星轨信号）
    if (pointer.active) {
      const distP = Math.hypot(a.x - pointer.x, a.y - pointer.y);
      if (distP < pointerDist) {
        const ratio = 1 - distP / pointerDist;
        ctx.strokeStyle = `rgba(0, 196, 149, ${(ratio * 0.36).toFixed(3)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(pointer.x, pointer.y);
        ctx.stroke();
      }
    }
  }

  // 3. 绘制星尘微粒节点
  for (const p of particles) {
    const twinkle = 0.65 + 0.35 * Math.sin(time * 0.0018 + p.phase);
    ctx.globalAlpha = p.alpha * twinkle;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (!prefersReducedMotion()) {
    rafId = requestAnimationFrame(drawFrame);
  }
}

function startLoop() {
  stopLoop();
  if (!fxEnabled.value) {
    const ctx = canvasRef.value?.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, width, height);
    return;
  }
  rafId = requestAnimationFrame(drawFrame);
}

function stopLoop() {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

function handlePointerMove(e: PointerEvent) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
    pointer.x = x;
    pointer.y = y;
    pointer.active = true;
  } else {
    pointer.active = false;
  }
}

function handlePointerLeave() {
  pointer.active = false;
}

watch(fxEnabled, () => startLoop());

onMounted(() => {
  resizeCanvas();
  startLoop();
  window.addEventListener('resize', resizeCanvas, { passive: true });
  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  document.addEventListener('pointerleave', handlePointerLeave);
});

onUnmounted(() => {
  stopLoop();
  window.removeEventListener('resize', resizeCanvas);
  window.removeEventListener('pointermove', handlePointerMove);
  document.removeEventListener('pointerleave', handlePointerLeave);
});
</script>

<template>
  <div
    v-show="fxEnabled"
    class="pointer-events-none absolute inset-0 overflow-hidden"
    aria-hidden="true"
  >
    <!-- 柔和流动极光大气层（Cobalt Violet × Emerald Teal，低透明不抢文字对比度） -->
    <div class="aurora-blob aurora-blob-1" />
    <div class="aurora-blob aurora-blob-2" />
    <div class="aurora-blob aurora-blob-3" />

    <!-- 细腻点阵坐标底纹（中心到边缘径向淡出，借鉴 pattern-craft） -->
    <div class="dot-matrix-dark absolute inset-0 opacity-55" />

    <!-- 实时 5G 信号微粒连线画布 -->
    <canvas ref="canvasRef" class="absolute inset-0 h-full w-full" />

    <!-- 底部平滑过渡回纯黑 #000000，保证与下一章节无缝衔接 -->
    <div
      class="absolute inset-x-0 bottom-0 h-28"
      style="background: linear-gradient(to bottom, rgba(0,0,0,0), #000000);"
    />
  </div>
</template>
