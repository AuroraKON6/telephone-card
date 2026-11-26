<script setup lang="ts">
/* 原生 Vue 3 + OGL WebGL2 发光玻璃态 AI 光球（AiBlob）
 * 效果：具有真实玻璃折射、色散菲涅尔边缘高光与内部三维流光丝带的发光玻璃光球
 * 四态实时联动：
 * - idle（待机）：澄澈深邃的玻璃球内缓慢呼吸流转的冷钴×青碧×兰紫等离子光带
 * - listening（聆听）：输入聚焦/键入时球面产生柔和声波微涟漪，青蓝光环点亮倾听感
 * - thinking（思考）：内部丝带加速聚拢旋涡流转，释放高频白炽×钴紫运算光辉
 * - speaking（播报）：AI 输出推荐后激发有节律的多谐波声浪脉冲与柔和外扩光环
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { fxEnabled } from '@/composables/useSpark';

export type AiBlobState = 'idle' | 'listening' | 'thinking' | 'speaking';

const props = withDefaults(
  defineProps<{
    /** 光球交互状态 */
    state?: AiBlobState;
    /** 光球主品牌色（默认 Revolut 电光钴紫） */
    primaryColor?: string;
    /** 光球流动副色（默认冰澈青蓝） */
    secondaryColor?: string;
    /** 光球幻彩点缀色（默认霓虹兰紫） */
    accentColor?: string;
    /** 光球屏幕中心 Y 位置（归一化 0~1，默认偏中下避开顶部消息区） */
    centerY?: number;
    /** 光球半径比例（相对短边，默认 0.27） */
    radius?: number;
  }>(),
  {
    state: 'idle',
    primaryColor: '#494fdf',
    secondaryColor: '#22d3ee',
    accentColor: '#c084fc',
    centerY: 0.34,
    radius: 0.27,
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

/* 3D 光学玻璃球壳 + 内部三维折射流光丝带 + 色散菲涅尔高光 + 四态声波脉冲（GLSL 300 es） */
const fragmentShader = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uCenterY;
uniform float uRadius;
uniform vec4 uStateWeights; // x: idle, y: listening, z: thinking, w: speaking
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uAccent;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

mat2 rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

// 平滑 3D 旋度势场，用于生成丝绸般的内部三维等离子流光（无接缝、极高效）
vec3 curlRibbonField(vec3 p, float t, float swirlSpeed) {
  vec3 q = p;
  q.xz = rot2(t * 0.42 * swirlSpeed + p.y * 1.15) * q.xz;
  q.xy = rot2(-t * 0.31 * swirlSpeed + p.z * 0.95) * q.xy;

  // 三重正交谐波扭曲，模拟液态光带在玻璃球内的立体缠绕
  q += 0.34 * sin(q.yzx * 2.45 + vec3(t * 0.9, -t * 0.75, t * 1.1));
  q += 0.18 * cos(q.zxy * 4.20 - vec3(t * 1.35, t * 0.85, -t * 1.05));
  return q;
}

// 评估三维玻璃球内部的体积光带能量与色彩
void sampleInnerFluid(
  vec3 p,
  float t,
  float swirlSpeed,
  vec4 sw,
  out vec3 col,
  out float energy
) {
  vec3 f = curlRibbonField(p, t, swirlSpeed);

  // 三条纤细锐利的交织发光丝绸带：主钴蓝丝带 / 冰青光丝 / 霓虹兰紫丝带（保留深邃晶莹玻璃暗腔）
  float r1 = exp(-pow(abs(sin(f.y * 2.15 + f.x * 1.45 - t * 0.65)), 1.35) * 14.5);
  float r2 = exp(-pow(abs(cos(f.x * 2.35 - f.z * 1.55 + t * 0.82)), 1.35) * 15.5);
  float r3 = exp(-pow(abs(sin(f.z * 2.25 + f.y * 1.50 - t * 0.55)), 1.40) * 16.5);

  // 丝带内部的丝绸质感细纹
  float silk = 0.68 + 0.32 * sin(f.x * 5.2 + f.y * 4.6 - f.z * 3.8);

  // 思考态增强旋转核心丝束；播报态叠加有节律的声波脉冲
  float speakPulse = 1.0 + sw.w * (0.32 * sin(t * 8.5 - length(p) * 5.2) + 0.18 * sin(t * 13.0));
  float listenLift = 1.0 + sw.y * 0.25;

  // 靠球心聚光、近玻璃内壁柔和收敛留出透亮暗缘
  float radial = smoothstep(1.02, 0.24, length(p));
  float coreGlow = exp(-dot(p, p) * 4.8) * (0.18 + 0.22 * sw.z + 0.20 * sw.w);

  // 高饱和宝石级光色，经 ACES 色调映射后仍清澈艳丽不发灰白
  vec3 c1 = mix(uPrimary, vec3(0.32, 0.42, 1.0), sw.z * 0.45);
  vec3 c2 = mix(uSecondary, vec3(0.06, 0.92, 0.88), sw.y * 0.45 + sw.w * 0.35);
  vec3 c3 = mix(uAccent, vec3(0.95, 0.28, 0.78), 0.35 + sw.w * 0.40);

  col = (c1 * r1 * 1.35 + c2 * r2 * 1.25 + c3 * r3 * 1.15) * silk;
  col += mix(c1, c2, 0.5) * coreGlow;
  col *= radial * speakPulse * listenLift;
  energy = (r1 + r2 + r3) * 0.36 * radial + coreGlow * 0.35;
}

void main() {
  float minDim = min(uResolution.x, uResolution.y);
  vec2 mouseShift = (uMouse - 0.5) * 0.032;
  vec2 center = vec2(0.5, uCenterY) + mouseShift * 0.65;
  vec2 p = (gl_FragCoord.xy - center * uResolution) / max(minDim, 1.0);

  vec4 sw = uStateWeights; // idle, listening, thinking, speaking
  float t = uTime;

  // 各状态下的动态速率与微有机形变幅度
  float swirlSpeed = 1.0 + sw.y * 0.35 + sw.z * 1.45 + sw.w * 0.95;
  float angle = atan(p.y, p.x);

  // 极克制的玻璃球面声波有机呼吸微变形（保持饱满球体质感，不沦为松垮史莱姆）
  float breathe = sin(t * 1.6) * 0.008;
  float listenWave = sw.y * 0.011 * sin(angle * 3.0 - t * 3.4) * sin(t * 2.2);
  float thinkWave = sw.z * 0.014 * sin(angle * 4.0 + t * 5.2);
  float speakWave = sw.w * (
    0.016 * sin(angle * 3.0 + t * 7.2) +
    0.011 * cos(angle * 5.0 - t * 9.5) +
    0.009 * sin(t * 11.0)
  );
  float R = uRadius + breathe + listenWave + thinkWave + speakWave;

  float dist = length(p);
  vec2 np = p / max(R, 0.001);
  float nr = length(np);

  vec3 col = vec3(0.0);

  // 1. 球体外围柔和光学环境光晕（将球体优雅融入纯黑抽屉画布）
  float outerDist = max(dist - R, 0.0);
  float haloTight = exp(-outerDist * 14.5);
  float haloWide = exp(-outerDist * 4.6);

  // 外晕随方位角平滑流转的冷钴 / 冰青 / 兰紫光彩
  float auraPhase = angle + t * 0.42 * swirlSpeed;
  vec3 auraCol = mix(uPrimary, uSecondary, 0.5 + 0.5 * sin(auraPhase));
  auraCol = mix(auraCol, uAccent, 0.34 * (0.5 + 0.5 * cos(auraPhase * 1.5 - 1.1)));

  float auraBoost = 0.72 + sw.y * 0.25 + sw.z * 0.32 + sw.w * 0.42;
  col += auraCol * (haloTight * 0.48 + haloWide * 0.19) * auraBoost;

  // 聆听与播报态外扩的柔和声波扩散光环
  if (sw.y + sw.w > 0.02) {
    float wavePhase1 = fract(t * (0.42 + sw.w * 0.38));
    float wavePhase2 = fract(wavePhase1 + 0.5);
    float ringR1 = R + wavePhase1 * 0.22;
    float ringR2 = R + wavePhase2 * 0.22;
    float echo1 = exp(-abs(dist - ringR1) * 75.0) * (1.0 - wavePhase1) * smoothstep(0.0, 0.12, wavePhase1);
    float echo2 = exp(-abs(dist - ringR2) * 75.0) * (1.0 - wavePhase2) * smoothstep(0.0, 0.12, wavePhase2);
    vec3 echoCol = mix(uSecondary, uAccent, sw.w * 0.5);
    col += echoCol * (echo1 + echo2) * (sw.y * 0.26 + sw.w * 0.44);
  }

  // 2. 玻璃球主体光学渲染（球内 12 层三维折射体积步进 + 玻璃菲涅尔色散 + 棚拍弧面高光）
  float sphereAA = 1.0 - smoothstep(1.0 - 0.012, 1.0 + 0.012, nr);
  if (sphereAA > 0.001) {
    vec2 sp = np / max(nr, 1.0); // 防止边界外 AA 像素 sqrt 为负
    float z = sqrt(max(0.0, 1.0 - dot(sp, sp)));
    vec3 N = normalize(vec3(sp, z));
    vec3 V = vec3(0.0, 0.0, 1.0);

    // 轻微玻璃表面液态波纹法线扰动（增强通透流动折射感）
    vec3 rippleN = vec3(
      sin(sp.y * 6.5 + t * 1.7 * swirlSpeed) * cos(sp.x * 5.2 - t * 1.3),
      cos(sp.x * 6.2 - t * 1.5 * swirlSpeed) * sin(sp.y * 5.4 + t * 1.1),
      0.0
    ) * (0.045 + sw.z * 0.035 + sw.w * 0.055);
    vec3 Nglass = normalize(N + rippleN);

    // 透射进入玻璃球内部的折射光线（玻璃折射率 IOR ≈ 1.42）
    vec3 refrDir = refract(-V, Nglass, 1.0 / 1.42);
    vec3 entryPos = vec3(sp, z) * 0.92;

    // 深邃黑曜石靛蓝水晶基底（确保丝带与玻璃通透感拥有高贵暗部反差）
    vec3 glassCol = vec3(0.008, 0.012, 0.042);
    float accumTrans = 1.0;

    // 沿折射光线在球体内部做 14 步体积丝带积分（真实前后景立体穿插）
    const int STEPS = 14;
    float maxTravel = 1.88 * max(z, 0.15);
    float dtStep = maxTravel / float(STEPS);

    for (int i = 0; i < STEPS; i++) {
      float frac = (float(i) + 0.5) / float(STEPS);
      vec3 samplePos = entryPos + refrDir * (frac * maxTravel);
      // 随鼠标轻微转动球内视差
      samplePos.xz = rot2(mouseShift.x * 6.0) * samplePos.xz;
      samplePos.yz = rot2(-mouseShift.y * 6.0) * samplePos.yz;

      vec3 sCol;
      float sDens;
      sampleInnerFluid(samplePos, t, swirlSpeed, sw, sCol, sDens);

      float weight = dtStep * 0.62;
      glassCol += accumTrans * sCol * weight;
      accumTrans *= exp(-sDens * weight * 0.55);
    }

    // 玻璃球内壁底部的透镜焦散反光（Caustic Rim Bounce）
    vec3 causticDir = normalize(vec3(0.40 - mouseShift.x * 3.0, -0.64 - mouseShift.y * 3.0, 0.50));
    float caustic = pow(max(dot(Nglass, causticDir), 0.0), 9.0);
    glassCol += mix(uSecondary, uPrimary, 0.45) * caustic * 0.45;

    // 纤细锐利的色散玻璃菲涅尔边缘反光（高指数收敛至玻璃最外弧，告别发粉厚边）
    float ndotv = max(dot(Nglass, V), 0.0);
    vec3 fresnelRGB = vec3(
      pow(1.0 - ndotv, 3.8),
      pow(1.0 - ndotv, 4.6),
      pow(1.0 - ndotv, 5.5)
    );
    vec3 rimTint = mix(uSecondary, uAccent, 0.5 + 0.5 * sin(angle * 2.0 - t * 0.9));
    vec3 rimCol = mix(rimTint, vec3(0.95, 0.98, 1.0), 0.32) * fresnelRGB;
    glassCol += rimCol * (1.05 + sw.z * 0.3 + sw.w * 0.3);

    // 棚拍弧面玻璃主高光（左上角纤细弧形窗反射 + 锐利针尖镜面高光）
    vec3 keyLight = normalize(vec3(-0.48 + mouseShift.x * 4.0, 0.68 + mouseShift.y * 4.0, 0.72));
    vec3 H1 = normalize(keyLight + V);
    float specSharp = pow(max(dot(Nglass, H1), 0.0), 110.0);
    float specSoft = pow(max(dot(Nglass, H1), 0.0), 22.0);
    float crescent = smoothstep(0.68, 0.90, dot(N, normalize(vec3(-0.56, 0.64, 0.52)))) *
                     smoothstep(0.93, 0.76, dot(N, normalize(vec3(-0.24, 0.34, 0.91))));

    glassCol += vec3(1.0) * (specSharp * 1.25 + specSoft * 0.14 + crescent * 0.28);

    // 极细水晶外轮廓微光描边
    float crispEdge = smoothstep(0.92, 0.99, nr) * smoothstep(1.01, 0.978, nr);
    glassCol += mix(uSecondary, vec3(1.0), 0.6) * crispEdge * 0.38;

    col = mix(col, glassCol, sphereAA);
  }

  // ACES 电影级色调映射：既保留晶莹玻璃通透高光，又维持柔和深黑底色不刺眼
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

  // 抽屉上下柔和暗角，让玻璃光球自然悬浮在纯黑抽屉空间中
  vec2 vigUv = (vUv - vec2(0.5, uCenterY)) * vec2(0.92, 1.04);
  float vig = smoothstep(1.24, 0.26, length(vigUv));
  col *= (0.3 + 0.7 * vig);

  // 极微抖动防 8-bit 暗部色带
  float dither = (hash12(gl_FragCoord.xy + fract(t) * 23.0) - 0.5) * (1.5 / 255.0);
  col = max(col + dither, 0.0);

  fragColor = vec4(col, 1.0);
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
  const stateWeights: [number, number, number, number] = [1, 0, 0, 0];

  const uniforms = {
    uTime: { value: 2.6 },
    uResolution: { value: [1, 1] },
    uMouse: { value: mouse },
    uCenterY: { value: props.centerY },
    uRadius: { value: props.radius },
    uStateWeights: { value: stateWeights },
    uPrimary: { value: hexToRgb(props.primaryColor, [0.29, 0.31, 0.87]) },
    uSecondary: { value: hexToRgb(props.secondaryColor, [0.13, 0.83, 0.93]) },
    uAccent: { value: hexToRgb(props.accentColor, [0.75, 0.52, 0.99]) },
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
  let elapsed = 2.6;

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.dpr = dpr;
    renderer.setSize(w, h);
    uniforms.uResolution.value = [w * dpr, h * dpr];
    renderer.render({ scene: mesh });
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!fxEnabled.value) return;
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
    if (!alive || document.hidden) return;
    const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
    last = now;

    // 平滑插值四态权重（idle / listening / thinking / speaking）
    const curState = props.state;
    const targets: [number, number, number, number] = [
      curState === 'idle' ? 1 : 0,
      curState === 'listening' ? 1 : 0,
      curState === 'thinking' ? 1 : 0,
      curState === 'speaking' ? 1 : 0,
    ];
    const blend = Math.min(1, dt * 5.2);
    for (let i = 0; i < 4; i++) {
      stateWeights[i] += (targets[i] - stateWeights[i]) * blend;
    }

    if (!reducedMotion && fxEnabled.value) {
      const speedMult =
        1.0 + stateWeights[1] * 0.25 + stateWeights[2] * 1.15 + stateWeights[3] * 0.65;
      elapsed += dt * speedMult;
    }

    mouse[0] += (targetMouse[0] - mouse[0]) * Math.min(1, dt * 4.0);
    mouse[1] += (targetMouse[1] - mouse[1]) * Math.min(1, dt * 4.0);

    uniforms.uTime.value = elapsed;
    uniforms.uMouse.value = mouse;
    uniforms.uCenterY.value = props.centerY;
    uniforms.uRadius.value = props.radius;
    uniforms.uStateWeights.value = stateWeights;

    renderer.render({ scene: mesh });

    if (fxEnabled.value && !reducedMotion) {
      rafId = requestAnimationFrame(tick);
    }
  };

  const onVisibilityChange = () => {
    if (!document.hidden && alive && fxEnabled.value && !reducedMotion && !rafId) {
      last = performance.now();
      rafId = requestAnimationFrame(tick);
    }
  };

  const ro = new ResizeObserver(resize);
  ro.observe(host);
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);

  resize();
  if (fxEnabled.value && !reducedMotion) {
    rafId = requestAnimationFrame(tick);
  }

  cleanupFn = () => {
    alive = false;
    cancelAnimationFrame(rafId);
    ro.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    document.removeEventListener('visibilitychange', onVisibilityChange);
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
    class="ai-blob-bg pointer-events-none relative h-full w-full overflow-hidden"
    aria-hidden="true"
  />
</template>
