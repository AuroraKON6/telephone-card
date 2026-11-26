<script setup lang="ts">
/* 原生 Vue 3 星芒微光包裹背景组件（GlimmerWrap）
 * 效果：多层景深微细光粒随柔和气流漂移，在无形光带扫掠与光标靠近瞬间因镜面夹角对齐而闪现纤细十字星芒
 * 架构：
 * - 采用高 DPR Canvas 2D + 光学叠加混合（lighter），既呈现极细腻的星芒衍射尖刺，又避免额外占用浏览器 WebGL 上下文配额
 * - 支持直接作为容器包裹层（<GlimmerWrap as="footer">...</GlimmerWrap>），前景插槽自动置于 z-10
 * - 完整支持 IntersectionObserver 离屏休眠、全局流光开关（fxEnabled）与 prefers-reduced-motion
 */
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { fxEnabled } from '@/composables/useSpark';

const props = withDefaults(
  defineProps<{
    /** 包裹根元素标签 */
    as?: 'div' | 'section' | 'footer' | 'article';
    /** 粒子密度系数（默认 1.0，按容器面积自适应） */
    density?: number;
    /** 整体漂移与光带扫掠速度 */
    speed?: number;
    /** 主星芒高光色（默认冷银白） */
    glintColor?: string;
    /** 品牌点缀星芒色（默认电光钴紫） */
    accentColor?: string;
    /** 辅助点缀星芒色（默认清透青绿） */
    secondaryAccent?: string;
  }>(),
  {
    as: 'div',
    density: 1.0,
    speed: 1.0,
    glintColor: '#ffffff',
    accentColor: '#7b82ff',
    secondaryAccent: '#4ade80',
  },
);

interface GlintParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 景深层 [0.25, 1.0] */
  depth: number;
  /** 基础星核半径 */
  radius: number;
  /** 微晶面翻转相位与角速度（模拟金属微尘受光瞬闪） */
  tumblePhase: number;
  tumbleSpeed: number;
  /** 星芒十字衍射微倾角 */
  tilt: number;
  /** 漂移曲线相位 */
  driftPhase: number;
  /** 颜色分类：0=冷白，1=钴紫，2=清青 */
  tone: 0 | 1 | 2;
  /** 个体基础亮度 */
  baseAlpha: number;
}

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

const wrapRef = ref<HTMLElement | null>(null);
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
  const wrap = wrapRef.value;
  const canvas = canvasRef.value;
  if (!wrap || !canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const palette: [RGB, RGB, RGB] = [
    hexToRgb(props.glintColor, [255, 255, 255]),
    hexToRgb(props.accentColor, [123, 130, 255]),
    hexToRgb(props.secondaryAccent, [74, 222, 128]),
  ];

  const reducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  let width = 1;
  let height = 1;
  let particles: GlintParticle[] = [];
  let alive = true;
  let visible = true;
  let rafId = 0;
  let lastNow = performance.now();
  let elapsed = 2.4;

  // 光标平滑位置（光照捕捉源）
  let pointerActive = false;
  let targetPx = -9999;
  let targetPy = -9999;
  let smoothPx = -9999;
  let smoothPy = -9999;
  let pointerGlow = 0;

  const buildParticles = (w: number, h: number) => {
    const area = w * h;
    const count = Math.max(
      110,
      Math.min(340, Math.round((area / 3600) * props.density)),
    );
    const list: GlintParticle[] = [];
    for (let i = 0; i < count; i++) {
      const depth = 0.28 + Math.random() * 0.72;
      const roll = Math.random();
      const tone: 0 | 1 | 2 = roll < 0.64 ? 0 : roll < 0.9 ? 1 : 2;
      list.push({
        x: Math.random() * w,
        y: Math.random() * h,
        // 细碎光尘整体轻缓斜向右上方漂流
        vx: (10 + Math.random() * 24) * depth,
        vy: -(4 + Math.random() * 14) * depth,
        depth,
        radius: 0.75 + depth * 1.15,
        tumblePhase: Math.random() * Math.PI * 2,
        tumbleSpeed: 0.7 + Math.random() * 1.85,
        tilt: (Math.random() - 0.5) * 0.42,
        driftPhase: Math.random() * Math.PI * 2,
        tone,
        baseAlpha: 0.14 + depth * 0.24,
      });
    }
    particles = list;
  };

  /** 绘制单颗精密光学微尘 + 受光闪耀时的纤细 4 向星芒 */
  const drawGlint = (
    p: GlintParticle,
    flash: number,
    edgeFade: number,
  ) => {
    const [r, g, b] = palette[p.tone];
    const totalAlpha = Math.min(1, (p.baseAlpha + flash * 0.88) * edgeFade);
    if (totalAlpha < 0.025) return;

    // 1. 柔和外晕（仅在受光闪耀时轻微绽开）
    if (flash > 0.18) {
      const haloR = p.radius * (3.2 + flash * 7.5);
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, haloR);
      grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${(flash * 0.36 * edgeFade).toFixed(3)})`);
      grad.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${(flash * 0.1 * edgeFade).toFixed(3)})`);
      grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, haloR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. 纤细十字光学星芒（闪光峰值时像金属丝面掠过光束）
    if (flash > 0.26) {
      const flareAlpha = Math.min(0.95, (flash - 0.22) * 1.25 * edgeFade);
      const lenLong = (6.5 + p.depth * 14.5) * flash;
      const lenShort = lenLong * 0.62;
      const thick = 0.55 + p.depth * 0.55;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.tilt);

      // 主光轴（水平偏长，模拟电影变形镜头微光）
      const hGrad = ctx.createLinearGradient(-lenLong, 0, lenLong, 0);
      hGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
      hGrad.addColorStop(0.5, `rgba(255, 255, 255, ${flareAlpha.toFixed(3)})`);
      hGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = hGrad;
      ctx.fillRect(-lenLong, -thick * 0.5, lenLong * 2, thick);

      // 副光轴（垂直十字衍射芒）
      const vGrad = ctx.createLinearGradient(0, -lenShort, 0, lenShort);
      vGrad.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0)`);
      vGrad.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, ${(flareAlpha * 0.85).toFixed(3)})`);
      vGrad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = vGrad;
      ctx.fillRect(-thick * 0.45, -lenShort, thick * 0.9, lenShort * 2);

      ctx.restore();
    }

    // 3. 锐利星核针尖点
    const coreR = p.radius * (0.75 + flash * 0.85);
    ctx.fillStyle =
      flash > 0.42
        ? `rgba(255, 255, 255, ${totalAlpha.toFixed(3)})`
        : `rgba(${r}, ${g}, ${b}, ${totalAlpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2);
    ctx.fill();
  };

  const render = (dt: number) => {
    ctx.clearRect(0, 0, width, height);

    // 平滑更新光标光照捕捉点
    const targetGlow = pointerActive ? 1 : 0;
    pointerGlow += (targetGlow - pointerGlow) * Math.min(1, dt * 6);
    if (pointerActive) {
      if (smoothPx < -1000) {
        smoothPx = targetPx;
        smoothPy = targetPy;
      } else {
        smoothPx += (targetPx - smoothPx) * Math.min(1, dt * 10);
        smoothPy += (targetPy - smoothPy) * Math.min(1, dt * 10);
      }
    }

    // 两道缓慢游走的柔和斜向光带（驱动整片微尘如丝绸般依次受光闪烁）
    const sweep1 = ((elapsed * 0.14) % 1.8) - 0.4; // [-0.4, 1.4]
    const sweep2 = 1.2 - ((elapsed * 0.095 + 0.55) % 1.8);

    // 底层极淡斜向环境光纱，让光带扫过时有丝绒般的受光语境
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    const bandCenterX = sweep1 * width;
    const sheenGrad = ctx.createRadialGradient(
      bandCenterX,
      height * 0.34,
      0,
      bandCenterX,
      height * 0.34,
      Math.max(width * 0.38, 280),
    );
    sheenGrad.addColorStop(0, 'rgba(73, 79, 223, 0.095)');
    sheenGrad.addColorStop(0.55, 'rgba(73, 79, 223, 0.03)');
    sheenGrad.addColorStop(1, 'rgba(73, 79, 223, 0)');
    ctx.fillStyle = sheenGrad;
    ctx.fillRect(0, 0, width, height);

    // 若光标位于页脚内，在光标周围形成轻柔聚光圈激活附近微尘
    if (pointerGlow > 0.02 && smoothPx > -500) {
      const pGrad = ctx.createRadialGradient(smoothPx, smoothPy, 0, smoothPx, smoothPy, 220);
      pGrad.addColorStop(0, `rgba(123, 130, 255, ${(0.085 * pointerGlow).toFixed(3)})`);
      pGrad.addColorStop(1, 'rgba(123, 130, 255, 0)');
      ctx.fillStyle = pGrad;
      ctx.fillRect(0, 0, width, height);
    }

    const invW = 1 / Math.max(1, width);
    const invH = 1 / Math.max(1, height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];

      if (!reducedMotion) {
        const waveY = Math.sin(elapsed * 0.75 + p.driftPhase) * 6 * p.depth;
        p.x += p.vx * dt * props.speed;
        p.y += (p.vy + waveY * 0.35) * dt * props.speed;

        // 环形边界循环，保证光尘永续连贯飘过
        if (p.x > width + 24) p.x = -24;
        else if (p.x < -24) p.x = width + 24;
        if (p.y < -24) p.y = height + 24;
        else if (p.y > height + 24) p.y = -24;
      }

      const nx = p.x * invW;
      const ny = p.y * invH;

      // 计算微尘位于两条斜向扫掠光带中的受光强度
      const dBand1 = Math.abs(nx * 0.85 + ny * 0.32 - sweep1);
      const dBand2 = Math.abs(nx * 0.78 - ny * 0.28 + 0.14 - sweep2);
      const beam1 = Math.exp(-dBand1 * dBand1 * 24.0);
      const beam2 = Math.exp(-dBand2 * dBand2 * 18.0) * 0.78;
      let catchLight = Math.max(beam1, beam2);

      // 叠加光标近场捕捉光效
      if (pointerGlow > 0.02 && smoothPx > -500) {
        const dCursor = Math.hypot(p.x - smoothPx, p.y - smoothPy);
        if (dCursor < 240) {
          const near = Math.pow(1 - dCursor / 240, 1.8) * pointerGlow;
          catchLight = Math.max(catchLight, near * 1.15);
        }
      }

      // 模拟微晶面镜面反射瞬闪（窄角高光瓣 + 光带调制）
      const facet = Math.max(0, Math.cos(elapsed * p.tumbleSpeed + p.tumblePhase));
      const specular = Math.pow(facet, 7.0);
      const ambientTwinkle = Math.pow(facet, 14.0) * 0.58;
      const flash = Math.min(1, catchLight * (0.32 + specular * 1.18) + ambientTwinkle);

      // 上下柔和羽化，让光场在板块顶部与底部无缝融于纯黑
      const fadeTop = Math.min(1, p.y / 52);
      const fadeBottom = Math.min(1, (height - p.y) / 48);
      const edgeFade = Math.max(0, Math.min(fadeTop, fadeBottom));

      drawGlint(p, flash, edgeFade);
    }

    ctx.restore();
  };

  const resize = () => {
    const rect = wrap.getBoundingClientRect();
    width = Math.max(1, Math.ceil(rect.width));
    height = Math.max(1, Math.ceil(rect.height));

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildParticles(width, height);
    render(0.016);
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!fxEnabled.value || !visible) return;
    const rect = wrap.getBoundingClientRect();
    const lx = e.clientX - rect.left;
    const ly = e.clientY - rect.top;
    if (lx >= 0 && ly >= 0 && lx <= rect.width && ly <= rect.height) {
      pointerActive = true;
      targetPx = lx;
      targetPy = ly;
    } else {
      pointerActive = false;
    }
  };

  const tick = (now: number) => {
    rafId = 0;
    if (!alive || !visible || !fxEnabled.value) return;

    const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000));
    lastNow = now;
    if (!reducedMotion) {
      elapsed += dt * props.speed;
    }

    render(dt);

    if (!reducedMotion) {
      rafId = requestAnimationFrame(tick);
    }
  };

  startLoopFn = () => {
    if (!alive || !visible || !fxEnabled.value || rafId) return;
    lastNow = performance.now();
    render(0.016);
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
  ro.observe(wrap);

  const io = new IntersectionObserver(
    ([entry]) => {
      visible = entry ? entry.isIntersecting : true;
      if (visible) {
        startLoopFn?.();
      } else {
        stopLoopFn?.();
      }
    },
    { threshold: 0.02 },
  );
  io.observe(wrap);

  window.addEventListener('pointermove', onPointerMove, { passive: true });

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
  };
});

onUnmounted(() => {
  cleanupFn?.();
  cleanupFn = null;
});
</script>

<template>
  <component
    :is="as"
    ref="wrapRef"
    class="glimmer-wrap-root relative overflow-hidden"
  >
    <!-- 高 DPR 飘散微光与受光十字星芒底层 -->
    <canvas
      v-show="fxEnabled"
      ref="canvasRef"
      aria-hidden="true"
      class="glimmer-wrap-canvas pointer-events-none absolute inset-0 z-0 block h-full w-full"
    />

    <!-- 前景内容层 -->
    <div class="relative z-10">
      <slot />
    </div>
  </component>
</template>
