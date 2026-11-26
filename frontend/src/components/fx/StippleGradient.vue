<script setup lang="ts">
/* 原生 Vue 3 + OGL WebGL2 蓝噪声点彩慢折渐变背景（StippleGradient）
 * 效果：如丝绸般缓慢折叠流动的柔和渐变，经高频蓝噪声抖动量化为细腻版画点彩颗粒
 * 特性：白底高可读性、鼠标微扰动、IntersectionObserver 视口外自动休眠、联动 fxEnabled
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { fxEnabled } from '@/composables/useSpark';

const props = withDefaults(
  defineProps<{
    /** 画布底纸颜色 */
    backgroundColor?: string;
    /** 主点彩墨色 */
    colorA?: string;
    /** 辅助点彩墨色 1 */
    colorB?: string;
    /** 辅助点彩墨色 2 */
    colorC?: string;
    /** 折叠流动速度 */
    speed?: number;
    /** 点彩颗粒尺寸（CSS px，越小越细腻） */
    dotScale?: number;
    /** 点彩整体浓淡强度 (0.2 ~ 1.0) */
    strength?: number;
    /** 是否响应鼠标轻扰动 */
    interactive?: boolean;
  }>(),
  {
    backgroundColor: '#ffffff',
    colorA: '#494fdf',
    colorB: '#9333ea',
    colorC: '#00a87e',
    speed: 0.28,
    dotScale: 2.2,
    strength: 0.56,
    interactive: true,
  },
);

type RGB = [number, number, number];

function hexToRgb(hex: string, fallback: RGB): RGB {
  try {
    const clean = hex.trim().replace('#', '');
    if (clean.length === 3) {
      return [
        parseInt(clean[0] + clean[0], 16) / 255,
        parseInt(clean[1] + clean[1], 16) / 255,
        parseInt(clean[2] + clean[2], 16) / 255,
      ];
    }
    if (clean.length >= 6) {
      return [
        parseInt(clean.slice(0, 2), 16) / 255,
        parseInt(clean.slice(2, 4), 16) / 255,
        parseInt(clean.slice(4, 6), 16) / 255,
      ];
    }
    return fallback;
  } catch {
    return fallback;
  }
}

const vertexShader = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/* 慢折丝缎梯度场 + 高频蓝噪声近似点彩抖动（Interleaved Gradient Noise + Blue-Noise High-Pass） */
const fragmentShader = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform vec2 uResolution;
uniform float uDpr;
uniform float uDotScale;
uniform float uStrength;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform vec3 uBg;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;

// Jorge Jimenez Interleaved Gradient Noise — 极高空间均匀度的类蓝噪声基准
float ign(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

// 3x3 空间高通锐化，进一步抑制低频团块，呈现清脆干净的蓝噪声点彩分布
float blueNoiseThreshold(vec2 cell) {
  float c = ign(cell);
  float avg =
    (ign(cell + vec2(1.0, 0.0)) +
      ign(cell - vec2(1.0, 0.0)) +
      ign(cell + vec2(0.0, 1.0)) +
      ign(cell - vec2(0.0, 1.0))) *
    0.25;
  float hp = clamp(0.5 + (c - avg) * 1.15, 0.02, 0.98);
  return mix(c, hp, 0.55);
}

// 慢速丝缎折叠渐变场（Slow-Folding Gradient）
vec3 foldingField(vec2 p, float t) {
  vec2 q = p;
  // 2 次连续温和折褶，形成宽阔柔缓的光缎波带
  q += 0.36 * vec2(sin(q.y * 1.55 + t * 0.85), cos(q.x * 1.35 - t * 0.72));
  q += 0.24 * vec2(cos(q.y * 2.15 - t * 0.62 + 1.1), sin(q.x * 1.85 + t * 0.54));

  float fold1 = 0.5 + 0.5 * sin(q.x * 1.9 + q.y * 1.25 - t * 0.7);
  float fold2 = 0.5 + 0.5 * cos(q.x * 1.35 - q.y * 1.85 + t * 0.55);
  float ridge = 1.0 - abs(sin((q.x * 1.15 + q.y * 0.95) * 1.55 - t * 0.45));
  ridge = pow(clamp(ridge, 0.0, 1.0), 1.65);

  float density = clamp(fold1 * 0.44 + fold2 * 0.26 + ridge * 0.48, 0.0, 1.0);
  // 用平滑 S 曲线拉开留白白纸与点彩光带的呼吸对比
  density = smoothstep(0.24, 0.96, density);

  return vec3(density, fold1, fold2);
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5) * 2.2;

  // 鼠标轻微牵引折褶
  vec2 mDistVec = uv - uMouse;
  mDistVec.x *= aspect;
  float mGlow = exp(-dot(mDistVec, mDistVec) * 7.5) * uMouseActive;
  p += mDistVec * mGlow * 0.28;

  vec3 f = foldingField(p, uTime);
  float density = clamp(f.x + mGlow * 0.22, 0.0, 1.0);

  // 像素量化为精细蓝噪声点彩格（随 DPR 保持物理尺寸一致）
  float cellPx = max(1.5, uDotScale * uDpr);
  vec2 cell = floor(gl_FragCoord.xy / cellPx);
  vec2 sub = fract(gl_FragCoord.xy / cellPx) - 0.5;

  float threshold = blueNoiseThreshold(cell);

  // 柔滑的蓝噪声点彩判断 + 圆润微粒轮廓
  float stippleHit = smoothstep(threshold - 0.06, threshold + 0.06, density * 0.86);
  float dotShape = smoothstep(0.56, 0.22, length(sub));
  float stippleMask = stippleHit * dotShape;

  // 在三色版画墨色间平滑过渡
  vec3 inkAB = mix(uColorA, uColorB, smoothstep(0.2, 0.85, f.y));
  vec3 inkColor = mix(inkAB, uColorC, smoothstep(0.35, 0.92, f.z) * 0.65);

  // 底部柔和底雾（极淡 6% 渐变衬底） + 清晰细腻点彩墨点
  float wash = density * 0.065 * uStrength;
  float inkAmount = clamp(wash + stippleMask * 0.34 * uStrength, 0.0, 0.45);

  // 顶部与底部边缘渐隐回纯净画布色，避免区块交界生硬
  float verticalMask = smoothstep(0.0, 0.12, uv.y) * smoothstep(1.0, 0.88, uv.y);
  inkAmount *= verticalMask;

  vec3 finalCol = mix(uBg, inkColor, inkAmount);
  fragColor = vec4(finalCol, 1.0);
}
`;

const hostRef = ref<HTMLDivElement | null>(null);
let cleanupFn: (() => void) | null = null;

onMounted(() => {
  const host = hostRef.value;
  if (!host) return;

  let renderer: Renderer;
  try {
    renderer = new Renderer({
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
    });
  } catch {
    return;
  }

  const gl = renderer.gl as WebGL2RenderingContext;
  if (!renderer.isWebgl2) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return;
  }

  gl.clearColor(1, 1, 1, 0);
  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const mouse: [number, number] = [0.5, 0.5];
  const targetMouse: [number, number] = [0.5, 0.5];
  let mouseActive = 0;
  let targetMouseActive = 0;

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: [1, 1] },
    uDpr: { value: 1 },
    uDotScale: { value: props.dotScale },
    uStrength: { value: props.strength },
    uMouse: { value: mouse },
    uMouseActive: { value: 0 },
    uBg: { value: hexToRgb(props.backgroundColor, [1, 1, 1]) },
    uColorA: { value: hexToRgb(props.colorA, [0.29, 0.31, 0.87]) },
    uColorB: { value: hexToRgb(props.colorB, [0.58, 0.2, 0.92]) },
    uColorC: { value: hexToRgb(props.colorC, [0, 0.66, 0.49]) },
  };

  const geometry = new Triangle(renderer.gl);
  const program = new Program(renderer.gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new Mesh(renderer.gl, { geometry, program });

  const reducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  let alive = true;
  let visible = true;
  let rafId = 0;
  let last = performance.now();
  let elapsed = 0;

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.dpr = dpr;
    renderer.setSize(w, h);
    uniforms.uResolution.value = [w * dpr, h * dpr];
    uniforms.uDpr.value = dpr;
    // 立即同步补绘一帧，彻底消除窗口缩放瞬间的清屏空白
    renderer.render({ scene: mesh });
    start();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!props.interactive || !fxEnabled.value) return;
    const rect = host.getBoundingClientRect();
    const x = (e.clientX - rect.left) / Math.max(1, rect.width);
    const y = 1 - (e.clientY - rect.top) / Math.max(1, rect.height);
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      targetMouse[0] = x;
      targetMouse[1] = y;
      targetMouseActive = 1;
    } else {
      targetMouseActive = 0;
    }
  };

  const onPointerLeave = () => {
    targetMouseActive = 0;
  };

  const tick = (now: number) => {
    rafId = 0;
    if (!alive || !visible) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;

    if (!reducedMotion && fxEnabled.value) {
      elapsed += dt * props.speed;
    }

    mouse[0] += (targetMouse[0] - mouse[0]) * Math.min(1, dt * 5);
    mouse[1] += (targetMouse[1] - mouse[1]) * Math.min(1, dt * 5);
    mouseActive += (targetMouseActive - mouseActive) * Math.min(1, dt * 4);

    uniforms.uTime.value = elapsed;
    uniforms.uMouse.value = mouse;
    uniforms.uMouseActive.value = mouseActive;
    uniforms.uDotScale.value = props.dotScale;
    uniforms.uStrength.value = props.strength;

    renderer.render({ scene: mesh });

    if (fxEnabled.value && !reducedMotion) {
      rafId = requestAnimationFrame(tick);
    }
  };

  const start = () => {
    if (rafId || !visible || !alive) return;
    last = performance.now();
    rafId = requestAnimationFrame(tick);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(host);

  const io = new IntersectionObserver(([entry]) => {
    visible = entry ? entry.isIntersecting : true;
    if (visible) start();
  });
  io.observe(host);

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('pointerleave', onPointerLeave);

  resize();

  cleanupFn = () => {
    alive = false;
    visible = false;
    cancelAnimationFrame(rafId);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('pointerleave', onPointerLeave);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
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
    class="stipple-gradient pointer-events-none relative h-full w-full overflow-hidden"
    aria-hidden="true"
  />
</template>
