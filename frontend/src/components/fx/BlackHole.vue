<script setup lang="ts">
/* 原生 Vue 3 + OGL WebGL2 3D 引力透镜黑洞与光子环背景（BlackHole）
 * 算法：三维史瓦西（Schwarzschild）零测地线光线步进（Null Geodesic Raymarching）
 * 效果：
 * - 光线在黑洞引力场中真实三维弯曲，自然形成上/下引力透镜光拱、穿过阴影前方的倾斜烟雾吸积盘与锐利白炽光子环
 * - 中心事件视界 100% 漆黑吞噬光线，采用笛卡尔旋转采样杜绝极坐标奇点与接缝
 * - 内置相对论多普勒非对称增亮、微尘环绕粒子与背景引力透镜星点
 * - 完整支持 AI 思考激发态（excited）、鼠标视角微偏转、页面隐藏休眠与显存自动释放
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { Mesh, Program, Renderer, Triangle } from 'ogl';
import { fxEnabled } from '@/composables/useSpark';

const props = withDefaults(
  defineProps<{
    /** 吸积盘主烟雾流光色（默认冷钴蓝） */
    primaryColor?: string;
    /** 外围深空烟雾余晕色（默认深靛紫） */
    secondaryColor?: string;
    /** 光子环与内缘炽热核色（默认冷白炽） */
    ringColor?: string;
    /** 是否处于高能激发态（例如 AI 思考时提速增亮） */
    excited?: boolean;
    /** 黑洞屏幕中心 Y 位置（归一化 0~1，默认偏中下避开上方聊天气泡） */
    centerY?: number;
    /** 镜头缩放系数 */
    zoom?: number;
    /** 旋转与烟雾流动速度 */
    speed?: number;
    /** 辉光曝光系数 */
    glow?: number;
  }>(),
  {
    primaryColor: '#5b6cff',
    secondaryColor: '#3c2a8a',
    ringColor: '#f6f8ff',
    excited: false,
    centerY: 0.38,
    zoom: 1.0,
    speed: 1.0,
    glow: 1.0,
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

/* 3D 史瓦西引力透镜测地线光线步进 + 体积烟雾吸积盘 + 锐利光子环（GLSL 300 es） */
const fragmentShader = `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform float uTime;
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uExcite;
uniform float uCenterY;
uniform float uZoom;
uniform float uGlow;
uniform vec3 uPrimary;
uniform vec3 uSecondary;
uniform vec3 uRingColor;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
    mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

// 3 阶紧凑 FBM（供光线步进吸积盘体积采样使用，兼顾丝滑烟雾质感与 60fps）
float fbmSmoke(vec2 p) {
  float v = 0.0;
  float a = 0.52;
  mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
  for (int i = 0; i < 4; i++) {
    v += a * noise2(p);
    p = rot * p * 2.04 + vec2(3.7, 1.9);
    a *= 0.49;
  }
  return v;
}

mat2 rot2(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

// 评估赤道面烟雾吸积盘体积密度与色温（零 atan 接缝，采用开普勒差速旋转笛卡尔坐标）
void sampleAccretionDisk(
  vec3 pos,
  vec3 rayDir,
  float r,
  float t,
  out vec3 emission,
  out float density
) {
  emission = vec3(0.0);
  density = 0.0;

  // 吸积盘有效径向范围 [1.52, 8.8]
  if (r < 1.48 || r > 9.0) return;

  // 内缘纤细炽热、外围蓬松如烟雾扩散
  float diskH = 0.058 + 0.052 * smoothstep(1.5, 6.2, r);
  float ay = abs(pos.y);
  if (ay > diskH * 3.6) return;

  float vertProfile = exp(-(ay * ay) / (2.0 * diskH * diskH));

  // 径向分布：紧贴内稳轨处明亮炽热，向外渐变拉丝消散为轻烟
  float innerCut = smoothstep(1.52, 2.02, r);
  float outerFade = exp(-(r - 1.8) * 0.42) * smoothstep(8.8, 5.4, r);
  float radialEnv = innerCut * outerFade;
  if (radialEnv < 0.002) return;

  // 开普勒差速螺旋剪切：内圈转速快、外圈慢，用二维旋转矩阵完全规避 ±π 接缝
  float omega = 1.42 / pow(r, 1.12);
  float spiralTwist = 3.25 / pow(r, 0.58);
  vec2 swirled = rot2(t * omega + spiralTwist) * pos.xz;
  vec2 swirledSlow = rot2(t * omega * 0.52 + spiralTwist * 0.65) * pos.xz;

  // 细腻的高频域名扭曲烟雾丝缕（拉远镜头后依然呈现丝绸般流动烟雾）
  float warp = fbmSmoke(swirledSlow * 1.15 + vec2(0.0, t * 0.09));
  float wisps = fbmSmoke(swirled * 2.05 + vec2(warp * 1.85, -warp * 1.45));
  float fine = noise2(swirled * 5.2 + vec2(t * 0.3, warp * 2.6));

  // 细密发光气流纤维，强化被强引力拉伸的烟气层次
  float filaments = 0.50 + 0.50 * sin(r * 5.8 + warp * 6.4 - t * 0.75);
  float smoke = smoothstep(0.14, 0.86, wisps * 0.72 + fine * 0.28) * filaments;

  // 内圈高热环带补充，让靠近光子球处明亮而柔和
  float innerHot = exp(-pow((r - 2.0) * 1.85, 2.0)) * (0.58 + 0.62 * wisps);

  // 相对论多普勒非对称增亮：左侧迎面气流偏冷白高亮，右侧远去气流偏深靛蓝紫
  vec3 orbitVel = normalize(vec3(-pos.z, 0.0, pos.x));
  float dopplerDot = dot(orbitVel, -rayDir);
  float dopplerBoost = 0.56 + 0.78 * smoothstep(-0.68, 0.88, dopplerDot);

  // 细腻环绕星尘微粒（沿开普勒轨道环绕黑洞漂移）
  vec2 dustGrid = floor(swirled * 6.8);
  float dustRnd = hash12(dustGrid);
  float dustDot = step(0.985, dustRnd) *
    exp(-dot(fract(swirled * 6.8) - 0.5, fract(swirled * 6.8) - 0.5) * 56.0);
  float dustGlow = dustDot * (0.45 + 0.55 * sin(t * 2.8 + dustRnd * 40.0)) * radialEnv;

  // 色温分层：外围深靛紫烟雾 -> 中段冷钴电光烟 -> 内缘白炽流光
  float heat = clamp((1.0 - smoothstep(1.75, 5.6, r)) * 0.74 + innerHot * 0.45 + max(dopplerDot, 0.0) * 0.22, 0.0, 1.0);
  vec3 col = mix(uSecondary, uPrimary, smoothstep(0.10, 0.58, heat));
  col = mix(col, uRingColor, smoothstep(0.54, 0.94, heat));

  density = (smoke * radialEnv * 1.28 + innerHot * 0.52) * vertProfile;
  emission = col * density * dopplerBoost * 1.65 + uRingColor * dustGlow * 1.05;
}

void main() {
  float minDim = min(uResolution.x, uResolution.y);
  vec2 center = vec2(0.5, uCenterY);
  // 按短边归一化，拉远视距让黑洞阴影、光子环与左右烟雾吸积盘翼展完整收入抽屉画幅
  vec2 uv = (gl_FragCoord.xy - center * uResolution) / max(minDim, 1.0);
  uv /= max(uZoom, 0.35);

  // 电影感轻微斜倾滚转角（-10°），让烟雾吸积盘优雅斜掠画幅
  uv = rot2(-0.18) * uv;

  // 鼠标轻微带动轨道观察角度
  float yaw = (uMouse.x - 0.5) * 0.24;
  float pitch = 0.135 + (uMouse.y - 0.5) * 0.12; // 约 7.7° 经典俯角，均衡呈现上下引力透镜光拱与前景腰带

  float camDist = 17.8;
  vec3 ro = vec3(
    sin(yaw) * cos(pitch) * camDist,
    sin(pitch) * camDist,
    -cos(yaw) * cos(pitch) * camDist
  );

  // 构造相机正交基
  vec3 fwd = normalize(-ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, right);

  float fov = 1.08;
  vec3 rd = normalize(fwd * fov + right * uv.x + up * uv.y);

  // 史瓦西零测地线光线步进（守恒角动量平方 h2）
  vec3 pos = ro;
  vec3 dir = rd;
  vec3 hVec = cross(pos, dir);
  float h2 = dot(hVec, hVec);

  float t = uTime;
  vec3 accumLight = vec3(0.0);
  float transmittance = 1.0;
  bool captured = false;
  float minR = 100.0;

  // 微弱像素抖动消除步进分层纹
  float jitter = hash12(gl_FragCoord.xy + fract(t) * 37.0);

  for (int i = 0; i < 96; i++) {
    float r2 = dot(pos, pos);
    float r = sqrt(r2);
    minR = min(minR, r);

    // 1. 跌入事件视界：彻底吞噬光线，保证中心黑洞阴影纯粹深黑无任何奇点伪影
    if (r < 1.04) {
      captured = true;
      break;
    }

    // 2. 逃逸出引力区
    if (r > 28.0 && dot(pos, dir) > 0.0) {
      break;
    }

    // 自适应步长：靠近光子球（r ≈ 1.5）精细步进，远景加速
    float stepSize = clamp(0.068 * r, 0.045, 0.68);
    if (i == 0) stepSize *= (0.65 + 0.35 * jitter);

    // 史瓦西引力加速度 a = -1.5 * h^2 * pos / r^5
    vec3 accel = -1.5 * h2 * pos / max(r2 * r2 * r, 0.0001);
    vec3 nextDir = normalize(dir + accel * stepSize);
    vec3 midPos = pos + (dir + nextDir) * (0.25 * stepSize);
    vec3 nextPos = pos + (dir + nextDir) * (0.5 * stepSize);

    // 3. 若射线接近赤道面或穿越赤道面，累加体积烟雾吸积盘发光与轻度遮蔽
    float rMid = length(midPos);
    if (abs(midPos.y) < 0.56 || pos.y * nextPos.y <= 0.0) {
      vec3 diskEmit;
      float diskDens;
      sampleAccretionDisk(midPos, dir, rMid, t, diskEmit, diskDens);
      if (diskDens > 0.0005) {
        float segWeight = stepSize * 0.92;
        accumLight += transmittance * diskEmit * segWeight;
        // 半透明烟雾自遮蔽，让前景吸积盘自然遮挡黑洞阴影并带出层次
        transmittance *= exp(-diskDens * segWeight * 0.55);
        if (transmittance < 0.02) break;
      }
    }

    pos = nextPos;
    dir = nextDir;
  }

  // 4. 锐利光子环（Photon Ring）：仅贴附在紧擦光子球逃逸的光线上，柔和勾勒黑洞阴影边缘
  if (!captured) {
    float ringDist = abs(minR - 1.50);
    float sharpPhotonRing = exp(-ringDist * 42.0) * smoothstep(1.06, 1.38, minR);
    float softPhotonHalo = exp(-abs(minR - 1.58) * 7.2) * smoothstep(1.12, 1.48, minR);

    float ringAngle = atan(uv.y, uv.x);
    float ringShimmer = 0.78 + 0.22 * sin(ringAngle * 2.0 - t * 0.9) + 0.14 * sin(ringAngle * 5.0 + t * 1.4);
    float ringDoppler = 0.68 + 0.48 * smoothstep(-0.45, 0.45, -uv.x * 2.2);

    vec3 ringCol = mix(uPrimary, uRingColor, 0.82) * sharpPhotonRing * 1.15;
    ringCol += mix(uSecondary, uPrimary, 0.68) * softPhotonHalo * 0.34;
    accumLight += transmittance * ringCol * ringShimmer * ringDoppler;

    // 5. 被黑洞引力真实弯曲的极微弱深空背景星点（使用最终偏转后的 dir 方向采样）
    vec3 starDir = floor(dir * 165.0);
    float starRnd = hash13(starDir);
    if (starRnd > 0.9960) {
      vec3 starLocal = fract(dir * 165.0) - 0.5;
      float starCore = exp(-dot(starLocal, starLocal) * 34.0);
      float twinkle = 0.55 + 0.45 * sin(t * 2.1 + starRnd * 80.0);
      accumLight += transmittance * vec3(0.76, 0.84, 1.0) * starCore * twinkle * 0.46;
    }
  }

  // 激发态（AI 思考中）轻度提亮，并控制整体曝光让聊天卡片清晰易读
  float exposure = uGlow * (0.96 + uExcite * 0.34);
  vec3 col = accumLight * exposure;

  // ACES 电影级色调映射：保留事件视界深黑与光子环高亮细节，不发糊、不溢白
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);

  // 柔和边缘暗角融入抽屉纯黑底座
  vec2 vigUv = (vUv - vec2(0.5, uCenterY)) * vec2(0.92, 1.05);
  float vig = smoothstep(1.22, 0.28, length(vigUv));
  col *= (0.32 + 0.68 * vig);

  // 极微抖动防 8-bit 深黑渐变色带
  float dither = (hash12(gl_FragCoord.xy + fract(t) * 19.0) - 0.5) * (1.5 / 255.0);
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
  let exciteVal = 0;

  const uniforms = {
    uTime: { value: 4.5 },
    uResolution: { value: [1, 1] },
    uMouse: { value: mouse },
    uExcite: { value: 0 },
    uCenterY: { value: props.centerY },
    uZoom: { value: props.zoom },
    uGlow: { value: props.glow },
    uPrimary: { value: hexToRgb(props.primaryColor, [0.36, 0.42, 1.0]) },
    uSecondary: { value: hexToRgb(props.secondaryColor, [0.24, 0.16, 0.54]) },
    uRingColor: { value: hexToRgb(props.ringColor, [0.96, 0.97, 1.0]) },
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
  let elapsed = 4.5;

  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    // 光线步进限制在 1.5x DPR，兼顾光子环锐利度与满帧流畅度
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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

    const targetExcite = props.excited ? 1 : 0;
    exciteVal += (targetExcite - exciteVal) * Math.min(1, dt * 5);

    if (!reducedMotion && fxEnabled.value) {
      elapsed += dt * props.speed * (0.85 + exciteVal * 1.15);
    }

    mouse[0] += (targetMouse[0] - mouse[0]) * Math.min(1, dt * 3.5);
    mouse[1] += (targetMouse[1] - mouse[1]) * Math.min(1, dt * 3.5);

    uniforms.uTime.value = elapsed;
    uniforms.uMouse.value = mouse;
    uniforms.uExcite.value = exciteVal;
    uniforms.uCenterY.value = props.centerY;
    uniforms.uZoom.value = props.zoom;
    uniforms.uGlow.value = props.glow;

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
    class="black-hole-bg pointer-events-none relative h-full w-full overflow-hidden"
    aria-hidden="true"
  />
</template>
