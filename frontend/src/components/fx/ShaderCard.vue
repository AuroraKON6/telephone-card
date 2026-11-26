<script setup lang="ts">
/* 原生 Vue 3 + OGL WebGL2 升腾流光火焰卡片（ShaderCard）
 * 效果：卡片背后持续升腾的 FBM 域扭曲发光光焰（Luminous Rising Flame）
 * 特性：支持任意主色/副色实时平滑过渡换色、鼠标微风场牵引、自动资源释放与流光总开关联动
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { fxEnabled } from '@/composables/useSpark';

const props = withDefaults(
  defineProps<{
    /** 主火焰颜色（HEX，支持动态响应式切换） */
    color?: string;
    /** 辅助余烬/渐变副色（HEX，不传则自动基于主色提亮推导） */
    secondaryColor?: string;
    /** 火焰核心高光色 */
    coreColor?: string;
    /** 升腾速度倍率 */
    speed?: number;
    /** 光焰强度 (0.4 ~ 1.6) */
    intensity?: number;
    /** 是否响应鼠标风场牵引 */
    interactive?: boolean;
  }>(),
  {
    color: '#A855F7',
    secondaryColor: '',
    coreColor: '#ffffff',
    speed: 1.0,
    intensity: 1.05,
    interactive: true,
  },
);

type RGB = [number, number, number];

function parseHexToRgb(hex: string, fallback: RGB): RGB {
  try {
    const clean = hex.trim().replace('#', '');
    if (clean.length === 3) {
      const r = parseInt(clean[0] + clean[0], 16) / 255;
      const g = parseInt(clean[1] + clean[1], 16) / 255;
      const b = parseInt(clean[2] + clean[2], 16) / 255;
      return [r, g, b];
    }
    if (clean.length >= 6) {
      const r = parseInt(clean.slice(0, 2), 16) / 255;
      const g = parseInt(clean.slice(2, 4), 16) / 255;
      const b = parseInt(clean.slice(4, 6), 16) / 255;
      return [r, g, b];
    }
    return fallback;
  } catch {
    return fallback;
  }
}

/** 若未显式传入副色，基于主色生成一个略微偏暖/偏青的层次过渡色 */
function deriveSecondary(rgb: RGB): RGB {
  return [
    Math.min(1, rgb[0] * 0.72 + 0.14),
    Math.min(1, rgb[1] * 0.85 + 0.18),
    Math.min(1, rgb[2] * 1.12 + 0.08),
  ];
}

const vertexShader = `#version 300 es
in vec2 position;
out vec2 vUv;
void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/* 原创 FBM 域扭曲升腾光焰着色器（丝滑火焰气流 + 底部炽热光核 + 顶部渐隐） */
const fragmentShader = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uMouseActive;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uCoreColor;
uniform float uIntensity;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float val = 0.0;
  float amp = 0.52;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 5; i++) {
    val += amp * noise(p);
    p = rot * p * 2.04 + vec2(1.7, 9.2);
    amp *= 0.5;
  }
  return val;
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);

  // 鼠标微风牵引（在指针附近略微拉升火焰气流）
  vec2 pointerVec = uv - uMouse;
  pointerVec.x *= aspect;
  float pointerPull = exp(-dot(pointerVec, pointerVec) * 5.2) * uMouseActive;

  vec2 p = vec2((uv.x - 0.5) * aspect, uv.y);
  p.x += (uMouse.x - 0.5) * 0.14 * uv.y * uMouseActive;

  float t = uTime;

  // 双层域扭曲产生丝滑向上升腾的火焰舌流
  vec2 q = vec2(
    fbm(p * vec2(2.1, 1.45) - vec2(0.0, t * 0.68)),
    fbm(p * vec2(2.3, 1.75) - vec2(0.35, t * 0.92))
  );

  float flameNoise = fbm(p * vec2(2.6, 2.0) + q * 1.45 - vec2(0.0, t * 1.15));

  // 底部饱满升腾、中上部随噪声渐细渐散的火焰包络
  float centerWeight = 1.0 - smoothstep(0.0, 0.98 * aspect * 0.68, abs(p.x));
  float verticalFade = pow(clamp(1.0 - uv.y * 0.96, 0.0, 1.0), 1.25);
  float baseHeat = exp(-uv.y * 3.8) * (0.58 + 0.42 * centerWeight);

  float body = flameNoise * (0.62 + 0.55 * centerWeight) * verticalFade + baseHeat * 0.72;
  body += pointerPull * 0.24 * flameNoise;

  // 细腻边缘塑形与多色阶光焰混合
  float ember = smoothstep(0.16, 0.62, body);
  float midFlame = smoothstep(0.38, 0.86, body);
  float hotCore = smoothstep(0.72, 1.18, body);

  vec3 col = vec3(0.0);
  col = mix(col, uColorB * 0.62, ember);
  col = mix(col, uColorA * 1.18, midFlame);
  col += uCoreColor * hotCore * 0.78;

  // 顶部与左右极边缘平滑融合至纯黑 #000000
  float edgeMask =
    smoothstep(0.0, 0.10, uv.x) *
    smoothstep(1.0, 0.90, uv.x) *
    smoothstep(1.0, 0.78, uv.y);

  // 底部极亮流光边缘线，托起前方悬浮玻璃卡
  float rimLight = exp(-uv.y * 14.0) * (0.35 + 0.65 * centerWeight);
  col += mix(uColorA, uCoreColor, 0.55) * rimLight * 0.42;

  col *= (0.78 + 0.22 * edgeMask) * uIntensity;

  // 轻度 Reinhard 色调映射防止过曝死白，保留绚丽色彩饱和度
  col = col / (1.0 + col * 0.42);

  fragColor = vec4(col, 1.0);
}
`;

const rootRef = ref<HTMLDivElement | null>(null);
const canvasHostRef = ref<HTMLDivElement | null>(null);

const targetColors = computed(() => {
  const primary = parseHexToRgb(props.color, [0.66, 0.33, 0.97]);
  const secondary = props.secondaryColor
    ? parseHexToRgb(props.secondaryColor, deriveSecondary(primary))
    : deriveSecondary(primary);
  const core = parseHexToRgb(props.coreColor, [1, 1, 1]);
  return { primary, secondary, core };
});

let cleanupFn: (() => void) | null = null;

onMounted(() => {
  const host = canvasHostRef.value;
  const root = rootRef.value;
  if (!host || !root) return;

  let renderer: Renderer;
  try {
    renderer = new Renderer({
      alpha: false,
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

  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const curA: RGB = [...targetColors.value.primary];
  const curB: RGB = [...targetColors.value.secondary];
  const curCore: RGB = [...targetColors.value.core];
  const mouse: [number, number] = [0.5, 0.35];
  const targetMouse: [number, number] = [0.5, 0.35];
  let mouseActive = 0;
  let targetMouseActive = 0;

  const uniforms = {
    uTime: { value: 0 },
    uResolution: { value: [1, 1] },
    uMouse: { value: mouse },
    uMouseActive: { value: 0 },
    uColorA: { value: curA },
    uColorB: { value: curB },
    uCoreColor: { value: curCore },
    uIntensity: { value: props.intensity },
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
  let rafId = 0;
  let last = performance.now();
  let elapsed = 0;

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setSize(w, h);
    uniforms.uResolution.value = [w * renderer.dpr, h * renderer.dpr];
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!props.interactive || !fxEnabled.value) return;
    const rect = root.getBoundingClientRect();
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
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;

    if (!reducedMotion && fxEnabled.value) {
      elapsed += dt * props.speed;
    }

    // 丝滑 RGB 颜色过渡（切换火焰配色时 350ms 柔顺融合）
    const lerpRate = Math.min(1, dt * 7.5);
    const tgt = targetColors.value;
    for (let i = 0; i < 3; i++) {
      curA[i] += (tgt.primary[i] - curA[i]) * lerpRate;
      curB[i] += (tgt.secondary[i] - curB[i]) * lerpRate;
      curCore[i] += (tgt.core[i] - curCore[i]) * lerpRate;
    }

    mouse[0] += (targetMouse[0] - mouse[0]) * Math.min(1, dt * 6);
    mouse[1] += (targetMouse[1] - mouse[1]) * Math.min(1, dt * 6);
    mouseActive += (targetMouseActive - mouseActive) * Math.min(1, dt * 5);

    uniforms.uTime.value = elapsed;
    uniforms.uMouse.value = mouse;
    uniforms.uMouseActive.value = mouseActive;
    uniforms.uColorA.value = curA;
    uniforms.uColorB.value = curB;
    uniforms.uCoreColor.value = curCore;
    uniforms.uIntensity.value = props.intensity;

    renderer.render({ scene: mesh });

    rafId = requestAnimationFrame(tick);
  };

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  root.addEventListener('pointermove', onPointerMove, { passive: true });
  root.addEventListener('pointerleave', onPointerLeave);

  resize();
  rafId = requestAnimationFrame(tick);

  cleanupFn = () => {
    alive = false;
    cancelAnimationFrame(rafId);
    ro.disconnect();
    root.removeEventListener('pointermove', onPointerMove);
    root.removeEventListener('pointerleave', onPointerLeave);
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
    ref="rootRef"
    class="shader-card relative overflow-hidden bg-canvas-dark"
  >
    <!-- 背后升腾的 WebGL2 发光火焰层（极简模式下自动隐退为纯黑） -->
    <div
      v-show="fxEnabled"
      ref="canvasHostRef"
      class="pointer-events-none absolute inset-0"
      aria-hidden="true"
    />

    <!-- 柔和径向护眼遮罩 + 底部光晕托底，保证前方卡片文字清晰锐利 -->
    <div
      v-if="fxEnabled"
      class="pointer-events-none absolute inset-0"
      style="background: radial-gradient(ellipse 90% 80% at 50% 42%, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.62) 100%);"
      aria-hidden="true"
    />

    <!-- 前方悬浮深邃玻璃态内容层 -->
    <div class="relative z-10">
      <slot />
    </div>
  </div>
</template>
