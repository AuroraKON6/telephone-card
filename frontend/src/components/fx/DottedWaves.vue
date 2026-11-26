<script setup lang="ts">
/* 原生 Vue 3 + OGL WebGL2 3D 翻涌点阵波浪（DottedWaves）
 * 效果：数千颗抗锯齿发光圆点组成 3D 透视矩阵，随多组波浪连续起伏翻涌
 * 特性：支持实时平滑 RGB 换色、鼠标涟漪扰动、IntersectionObserver 视口外自动休眠
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { Geometry, Mesh, Program, Renderer } from 'ogl';
import { fxEnabled } from '@/composables/useSpark';

const props = withDefaults(
  defineProps<{
    /** 波谷与主体圆点颜色（HEX，支持响应式平滑切换） */
    color?: string;
    /** 波峰高光圆点颜色（HEX） */
    crestColor?: string;
    /** 波浪翻涌速度 */
    speed?: number;
    /** 波幅高度 */
    amplitude?: number;
    /** 网格列数 */
    cols?: number;
    /** 网格行数 */
    rows?: number;
    /** 基准圆点像素大小 */
    dotSize?: number;
    /** 整体亮度倍率 */
    intensity?: number;
    /** 是否响应鼠标涟漪 */
    interactive?: boolean;
  }>(),
  {
    color: '#6366f1',
    crestColor: '#e0e7ff',
    speed: 0.9,
    amplitude: 0.62,
    cols: 86,
    rows: 52,
    dotSize: 5.2,
    intensity: 1.0,
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
precision highp float;

in vec3 position;
in vec2 uv;

uniform float uTime;
uniform float uAmplitude;
uniform float uDotSize;
uniform float uDpr;
uniform float uAspect;
uniform vec2 uMouse;
uniform float uMouseActive;

out float vCrest;
out float vDepthFade;
out float vEdgeFade;

void main() {
  // 网格铺展范围：x ∈ [-10.5, 10.5]，z ∈ [-8.0, 8.0]
  vec3 pos = position;
  float t = uTime;

  // 三组不同方向的翻涌海浪叠加（Rolling Waves）
  float w1 = sin(pos.x * 0.52 + pos.z * 0.34 - t * 1.15);
  float w2 = cos(pos.x * 0.31 - pos.z * 0.58 - t * 0.85) * 0.68;
  float w3 = sin((pos.x + pos.z) * 0.78 + t * 0.62) * 0.32;
  float wave = (w1 + w2 + w3) / 2.0;

  // 鼠标指针投影到波面的柔和圆形涟漪
  vec2 mouseWorld = vec2((uMouse.x - 0.5) * 16.0, (0.5 - uMouse.y) * 11.0);
  float mouseDist = length(pos.xz - mouseWorld);
  float ripple =
    sin(mouseDist * 1.9 - t * 5.2) *
    exp(-mouseDist * 0.34) *
    0.58 *
    uMouseActive;

  float h = (wave + ripple) * uAmplitude;
  pos.y += h;

  // 3D 俯视角透视投影（相机在斜上方望向绵延浪海）
  float pitch = 0.50; // ~28.6 度俯角
  float cp = cos(pitch);
  float sp = sin(pitch);

  // 相机平移至 (0, 4.2, 10.6)
  vec3 viewPos = pos - vec3(0.0, 3.6, 10.8);
  vec3 rotPos = vec3(
    viewPos.x,
    viewPos.y * cp - viewPos.z * sp,
    viewPos.y * sp + viewPos.z * cp
  );

  // 简易透视矩阵（fov ~ 48deg）
  float depth = max(0.8, -rotPos.z);
  float fovScale = 1.65;
  vec2 ndc = vec2(
    (rotPos.x * fovScale) / (depth * max(uAspect, 0.5)),
    (rotPos.y * fovScale) / depth
  );

  // 整体微微下移，把绵延浪海托在屏幕中下及四周视野最舒展的位置
  ndc.y -= 0.08;

  gl_Position = vec4(ndc, clamp(depth / 32.0, -0.99, 0.99), 1.0);

  // 归一化波峰高度（0 = 波谷，1 = 波峰）
  vCrest = clamp(0.5 + (wave + ripple * 1.15) * 0.62, 0.0, 1.0);

  // 近大远小 + 远景平滑雾化隐入纯黑
  float perspectiveScale = clamp(10.5 / depth, 0.38, 1.85);
  gl_PointSize = uDotSize * uDpr * perspectiveScale * (0.72 + 0.52 * vCrest);

  vDepthFade = smoothstep(23.5, 9.5, depth) * smoothstep(2.0, 5.5, depth);
  vEdgeFade =
    smoothstep(0.0, 0.14, uv.x) *
    smoothstep(1.0, 0.86, uv.x) *
    smoothstep(0.0, 0.16, uv.y) *
    smoothstep(1.0, 0.84, uv.y);
}
`;

const fragmentShader = `#version 300 es
precision highp float;

in float vCrest;
in float vDepthFade;
in float vEdgeFade;

uniform vec3 uColor;
uniform vec3 uCrestColor;
uniform float uIntensity;

out vec4 fragColor;

void main() {
  // 抗锯齿发光圆点 SDF
  vec2 centered = gl_PointCoord - 0.5;
  float dist = length(centered);
  if (dist > 0.5) discard;

  float core = smoothstep(0.5, 0.14, dist);
  float halo = smoothstep(0.5, 0.0, dist) * 0.35;
  float shape = clamp(core + halo * vCrest, 0.0, 1.0);

  vec3 col = mix(uColor * 0.58, uCrestColor, pow(vCrest, 1.75));
  float alpha = shape * (0.28 + 0.72 * vCrest) * vDepthFade * vEdgeFade * uIntensity;

  fragColor = vec4(col * alpha, alpha);
}
`;

const hostRef = ref<HTMLDivElement | null>(null);

const targetColors = computed(() => ({
  base: hexToRgb(props.color, [0.39, 0.4, 0.95]),
  crest: hexToRgb(props.crestColor, [0.88, 0.91, 1.0]),
}));

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

  gl.clearColor(0, 0, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const canvas = gl.canvas as HTMLCanvasElement;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  // 构建 3D 点阵网格顶点数据
  const cols = props.cols;
  const rows = props.rows;
  const total = cols * rows;
  const positions = new Float32Array(total * 3);
  const uvs = new Float32Array(total * 2);

  let pIdx = 0;
  let uIdx = 0;
  for (let r = 0; r < rows; r++) {
    const v = r / Math.max(1, rows - 1);
    const z = (v - 0.5) * 16.5;
    for (let c = 0; c < cols; c++) {
      const u = c / Math.max(1, cols - 1);
      const x = (u - 0.5) * 23.0;
      positions[pIdx++] = x;
      positions[pIdx++] = 0;
      positions[pIdx++] = z;
      uvs[uIdx++] = u;
      uvs[uIdx++] = v;
    }
  }

  const geometry = new Geometry(renderer.gl, {
    position: { size: 3, data: positions },
    uv: { size: 2, data: uvs },
  });

  const curBase: RGB = [...targetColors.value.base];
  const curCrest: RGB = [...targetColors.value.crest];
  const mouse: [number, number] = [0.5, 0.5];
  const targetMouse: [number, number] = [0.5, 0.5];
  let mouseActive = 0;
  let targetMouseActive = 0;

  const uniforms = {
    uTime: { value: 0 },
    uAmplitude: { value: props.amplitude },
    uDotSize: { value: props.dotSize },
    uDpr: { value: 1 },
    uAspect: { value: 1.6 },
    uMouse: { value: mouse },
    uMouseActive: { value: 0 },
    uColor: { value: curBase },
    uCrestColor: { value: curCrest },
    uIntensity: { value: props.intensity },
  };

  const program = new Program(renderer.gl, {
    vertex: vertexShader,
    fragment: fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const mesh = new Mesh(renderer.gl, {
    geometry,
    program,
    mode: gl.POINTS,
  });

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
    uniforms.uDpr.value = dpr;
    uniforms.uAspect.value = w / h;
    start();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!props.interactive || !fxEnabled.value) return;
    const rect = host.getBoundingClientRect();
    const x = (e.clientX - rect.left) / Math.max(1, rect.width);
    const y = (e.clientY - rect.top) / Math.max(1, rect.height);
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

    // 350ms 平滑 RGB 配色过渡
    const lerpRate = Math.min(1, dt * 7);
    const tgt = targetColors.value;
    for (let i = 0; i < 3; i++) {
      curBase[i] += (tgt.base[i] - curBase[i]) * lerpRate;
      curCrest[i] += (tgt.crest[i] - curCrest[i]) * lerpRate;
    }

    mouse[0] += (targetMouse[0] - mouse[0]) * Math.min(1, dt * 6);
    mouse[1] += (targetMouse[1] - mouse[1]) * Math.min(1, dt * 6);
    mouseActive += (targetMouseActive - mouseActive) * Math.min(1, dt * 5);

    uniforms.uTime.value = elapsed;
    uniforms.uAmplitude.value = props.amplitude;
    uniforms.uDotSize.value = props.dotSize;
    uniforms.uMouse.value = mouse;
    uniforms.uMouseActive.value = mouseActive;
    uniforms.uColor.value = curBase;
    uniforms.uCrestColor.value = curCrest;
    uniforms.uIntensity.value = props.intensity;

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
    class="dotted-waves pointer-events-none relative h-full w-full overflow-hidden"
    aria-hidden="true"
  />
</template>
