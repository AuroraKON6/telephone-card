<script setup lang="ts">
/* 原生 Vue 3 + OGL WebGL2 柔焦竖向光谱光束背景（BlurredRays）
 * 效果：多层景深柔焦竖向光柱在纯黑底面上缓慢呼吸、明暗摇曳，并伴随色散晕染平顺穿过全光谱
 * 特性：
 * - 支持全光谱模式与双色自定义模式，内置 RGB 独立色散通道（colorShiftR/G/B）与软光晕 Bloom
 * - 四周柔边暗角无缝融入纯黑画布；含防色带微噪点抖动
 * - IntersectionObserver 离屏自动休眠，完整响应 fxEnabled 与 prefers-reduced-motion
 */
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { fxEnabled } from '@/composables/useSpark';

const props = withDefaults(
  defineProps<{
    /** 光柱数量（1 ~ 32） */
    rayCount?: number;
    /** 光柱间距离散度 */
    raySpacing?: number;
    /** 光柱粗细系数 */
    rayThickness?: number;
    /** 景深层次强度（0 扁平 ~ 1 多层远近虚实） */
    depth?: number;
    /** 光谱漂移与光束律动速度 */
    speed?: number;
    /** 柔和闪烁明暗频率（平滑防频闪） */
    flickerRate?: number;
    /** 柔光外溢 Bloom 强度 */
    bloom?: number;
    /** 整体曝光亮度 */
    brightness?: number;
    /** 独立 RGB 水平色散偏移 */
    colorShiftR?: number;
    colorShiftG?: number;
    colorShiftB?: number;
    /** 可选双色模式（留空则启用经典全光谱流动模式） */
    colorA?: string;
    colorB?: string;
    /** 四周暗角衰减比例 */
    vignetteTop?: number;
    vignetteBottom?: number;
    vignetteLeft?: number;
    vignetteRight?: number;
  }>(),
  {
    rayCount: 25,
    raySpacing: 1.0,
    rayThickness: 1.08,
    depth: 1.0,
    speed: 0.72,
    flickerRate: 0.95,
    bloom: 0.78,
    brightness: 0.92,
    colorShiftR: 0.011,
    colorShiftG: 0.0,
    colorShiftB: -0.011,
    colorA: '',
    colorB: '',
    vignetteTop: 0.24,
    vignetteBottom: 0.34,
    vignetteLeft: 0.14,
    vignetteRight: 0.14,
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

/* 多层景深竖向柔焦光谱光束 + RGB 棱镜色散 + ACES 色调映射（GLSL 300 es） */
const fragmentShader = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uRayCount;
uniform float uRaySpacing;
uniform float uRayThickness;
uniform float uDepth;
uniform float uFlickerRate;
uniform float uBloom;
uniform float uBrightness;
uniform vec3 uColorShift;
uniform float uUseCustomColors;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec4 uVignette; // top, bottom, left, right

float hash11(float p) {
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// 柔和光学全光谱调色板（电光青蓝 -> 碧青 -> 暖琥珀 -> 霓虹洋红 -> 钴紫循环）
vec3 spectrumPalette(float h) {
  vec3 a = vec3(0.47, 0.45, 0.56);
  vec3 b = vec3(0.45, 0.41, 0.44);
  vec3 d = vec3(0.62, 0.84, 0.12);
  return clamp(a + b * cos(6.2831853 * (h + d)), 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  float t = uTime;
  int count = clamp(int(uRayCount + 0.5), 1, 32);
  float fCount = float(count);

  // 轻微鼠标水平视差偏移
  float mouseBias = (uMouse.x - 0.5) * 0.045;

  vec3 accum = vec3(0.0);

  for (int i = 0; i < 32; i++) {
    if (i >= count) break;
    float fi = float(i);

    // 景深层：0 = 远景（更宽、更柔、偏暗），1 = 近景（束芯更凝聚、更明亮）
    float rawDepth = hash11(fi * 1.37 + 0.19);
    float depthLayer = mix(0.55, rawDepth, clamp(uDepth, 0.0, 1.0));

    // 沿横轴铺满分布并叠加自然随机间距与缓慢水平摆动
    float baseSlot = (fi + 0.5) / fCount;
    float jitter = (hash11(fi * 2.17 + 0.51) - 0.5) * (1.28 / fCount) * uRaySpacing;
    float driftFreq = 0.18 + 0.24 * hash11(fi * 3.41 + 0.23);
    float driftAmp = (0.016 + 0.024 * depthLayer);
    float drift = sin(t * driftFreq + fi * 2.37) * driftAmp;
    float parallax = mouseBias * mix(0.35, 1.25, depthLayer);

    float rayX = baseSlot + jitter + drift + parallax;

    // 竖向高斯柔焦轮廓（纵向拉长，让竖向光柱清晰贯穿大标题与四档卡片区域）
    float centerY = 0.56 + (hash11(fi * 4.73 + 0.83) - 0.5) * 0.24 + sin(t * 0.26 + fi * 1.9) * 0.04;
    float halfH = mix(0.74, 0.56, depthLayer) * (0.86 + 0.28 * hash11(fi * 5.29));
    float dy = (uv.y - centerY) / max(halfH, 0.15);
    float vertEnv = exp(-dy * dy * 1.15);

    // 轻微纵向流光呼吸纹理，增强空气体积感
    float shimmer = 0.86 + 0.14 * sin(uv.y * 4.8 - t * (0.45 + 0.35 * depthLayer) + fi * 2.1);

    // 平滑无频闪的有机明暗摇曳（拉开明暗对比，凸显独立光柱的闪烁呼吸感）
    float fPhase = t * uFlickerRate * (0.62 + 0.72 * hash11(fi * 6.13 + 0.31)) + fi * 9.31;
    float w1 = 0.5 + 0.5 * sin(fPhase);
    float w2 = 0.5 + 0.5 * sin(fPhase * 1.61803 + 2.17);
    float w3 = 0.5 + 0.5 * sin(fPhase * 0.41 + fi * 3.7);
    float flicker = 0.14 + 0.86 * pow(w1 * 0.48 + w2 * 0.32 + w3 * 0.20, 1.55);

    // 水平核宽与柔焦光晕宽（束芯更凝练、边缘保持柔焦，清晰呈现竖向光束感）
    float coreW = mix(0.032, 0.0085, depthLayer) * uRayThickness;
    float haloW = coreW * 2.35;
    float inv2Core2 = 0.5 / max(coreW * coreW, 0.00003);
    float inv2Halo2 = 0.5 / max(haloW * haloW, 0.00015);

    // RGB 三通道独立微距色散，形成柔和棱镜折射边缘
    vec3 dx = vec3(uv.x - rayX) - uColorShift * mix(0.45, 1.05, depthLayer);
    vec3 core = exp(-dx * dx * inv2Core2);
    vec3 halo = exp(-dx * dx * inv2Halo2) * uBloom;

    // 沿光谱平滑流动或双色渐变
    float hue = fract(baseSlot * 0.86 + t * 0.055 + hash11(fi * 7.87) * 0.24 + sin(t * 0.14 + fi) * 0.05);
    vec3 rayCol = mix(
      spectrumPalette(hue),
      mix(uColorA, uColorB, 0.5 + 0.5 * sin(hue * 6.2831853)),
      uUseCustomColors
    );

    float depthFade = mix(0.32, 1.0, depthLayer);
    vec3 beamEnergy = rayCol * (core * 0.94 + halo * 0.28);
    // 亮芯带一抹轻微白炽透光感
    beamEnergy += vec3(0.95, 0.97, 1.0) * (core * core) * 0.24 * depthLayer;

    accum += beamEnergy * vertEnv * shimmer * flicker * depthFade;
  }

  // 根据光柱数量做能量归一化，确保曝光通透且不遮挡文字
  vec3 col = accum * (uBrightness / (sqrt(fCount) * 0.38));

  // 指针靠近处微弱光学提亮
  float mouseLift = 1.0 + 0.16 * exp(-pow((uv.x - uMouse.x) * 3.4, 2.0));
  col *= mouseLift;

  // ACES 电影级色调映射：保留深邃黑底的同时让光束高光柔顺不发死
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

  // 四周柔黑暗角，让光场上下左右自然融进纯黑 #000000 边界
  float vTop = smoothstep(0.0, max(uVignette.x, 0.001), 1.0 - uv.y);
  float vBottom = smoothstep(0.0, max(uVignette.y, 0.001), uv.y);
  float vLeft = smoothstep(0.0, max(uVignette.z, 0.001), uv.x);
  float vRight = smoothstep(0.0, max(uVignette.w, 0.001), 1.0 - uv.x);
  float edgeMask = vTop * vBottom * vLeft * vRight;
  col *= edgeMask;

  // 微弱抖动防 8-bit 深色渐变色带
  float dither = (hash12(gl_FragCoord.xy + fract(t) * 64.0) - 0.5) * (1.8 / 255.0);
  col = max(col + dither, 0.0);

  fragColor = vec4(col, 1.0);
}
`;

const hostRef = ref<HTMLDivElement | null>(null);
let startRenderLoop: (() => void) | null = null;
let stopRenderLoop: (() => void) | null = null;
let cleanupFn: (() => void) | null = null;

watch(fxEnabled, (enabled) => {
  if (enabled) {
    startRenderLoop?.();
  } else {
    stopRenderLoop?.();
  }
});

onMounted(() => {
  const host = hostRef.value;
  if (!host) return;

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

  const mouse: [number, number] = [0.5, 0.5];
  const targetMouse: [number, number] = [0.5, 0.5];
  const hasCustom = Boolean(props.colorA && props.colorB);

  const uniforms = {
    uTime: { value: 3.2 },
    uResolution: { value: [1, 1] },
    uMouse: { value: mouse },
    uRayCount: { value: props.rayCount },
    uRaySpacing: { value: props.raySpacing },
    uRayThickness: { value: props.rayThickness },
    uDepth: { value: props.depth },
    uFlickerRate: { value: props.flickerRate },
    uBloom: { value: props.bloom },
    uBrightness: { value: props.brightness },
    uColorShift: { value: [props.colorShiftR, props.colorShiftG, props.colorShiftB] },
    uUseCustomColors: { value: hasCustom ? 1.0 : 0.0 },
    uColorA: { value: hexToRgb(props.colorA || '#494fdf', [0.29, 0.31, 0.87]) },
    uColorB: { value: hexToRgb(props.colorB || '#22d3ee', [0.13, 0.83, 0.93]) },
    uVignette: {
      value: [props.vignetteTop, props.vignetteBottom, props.vignetteLeft, props.vignetteRight],
    },
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
  let elapsed = 3.2;

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    // 柔焦光束对超高分辨率不敏感，1.5x 上限既丝滑又省 GPU
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.dpr = dpr;
    renderer.setSize(w, h);
    uniforms.uResolution.value = [w * dpr, h * dpr];
    renderer.render({ scene: mesh });
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!fxEnabled.value || !visible) return;
    const rect = host.getBoundingClientRect();
    const x = (e.clientX - rect.left) / Math.max(1, rect.width);
    const y = 1 - (e.clientY - rect.top) / Math.max(1, rect.height);
    if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
      targetMouse[0] = x;
      targetMouse[1] = y;
    }
  };

  const tick = (now: number) => {
    rafId = 0;
    if (!alive || !visible || !fxEnabled.value) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;

    if (!reducedMotion) {
      elapsed += dt * props.speed;
    }

    mouse[0] += (targetMouse[0] - mouse[0]) * Math.min(1, dt * 3.5);
    mouse[1] += (targetMouse[1] - mouse[1]) * Math.min(1, dt * 3.5);

    uniforms.uTime.value = elapsed;
    uniforms.uMouse.value = mouse;
    renderer.render({ scene: mesh });

    if (!reducedMotion) {
      rafId = requestAnimationFrame(tick);
    }
  };

  startRenderLoop = () => {
    if (!alive || !visible || !fxEnabled.value || rafId) return;
    last = performance.now();
    renderer.render({ scene: mesh });
    if (!reducedMotion) {
      rafId = requestAnimationFrame(tick);
    }
  };

  stopRenderLoop = () => {
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
        startRenderLoop?.();
      } else {
        stopRenderLoop?.();
      }
    },
    { threshold: 0.02 },
  );
  io.observe(host);

  window.addEventListener('pointermove', onPointerMove, { passive: true });

  resize();
  if (fxEnabled.value) {
    startRenderLoop();
  }

  cleanupFn = () => {
    alive = false;
    stopRenderLoop?.();
    startRenderLoop = null;
    stopRenderLoop = null;
    ro.disconnect();
    io.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
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
    class="blurred-rays-bg pointer-events-none relative h-full w-full overflow-hidden"
    aria-hidden="true"
  />
</template>
