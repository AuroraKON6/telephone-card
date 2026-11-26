<script setup lang="ts">
/* 原生 Vue 3 高性能点阵世界地图 + 城市间脉冲信号飞弧（SignalMap）
 * 特点：
 * - 基于校准后的全球七大洲轮廓多边形光栅化为清晰可辨的点阵地图
 * - 二次贝塞尔曲线实时发射带渐变发光拖尾的城市间信号脉冲，落地激起雷达涟漪
 * - 支持悬停/选中任意枢纽城市高亮关联链路并浮现节点指标铭牌
 * - IntersectionObserver 视口外自动休眠，兼容 prefers-reduced-motion 与全局 fxEnabled
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { fxEnabled } from '@/composables/useSpark';

export interface SignalCity {
  id: string;
  name: string;
  en: string;
  region: 'cn' | 'apac' | 'global';
  /** 经度 [-180, 180] */
  lon: number;
  /** 纬度 [-60, 82] */
  lat: number;
  latencyMs: number;
  band: string;
  note: string;
}

export interface SignalArcDef {
  from: string;
  to: string;
  scope: 'apac' | 'global';
}

export type SignalTheme = 'cobalt' | 'emerald' | 'violet';

const props = withDefaults(
  defineProps<{
    cities: SignalCity[];
    arcs: SignalArcDef[];
    scope?: 'all' | 'apac';
    theme?: SignalTheme;
    selectedCityId?: string | null;
  }>(),
  {
    scope: 'all',
    theme: 'cobalt',
    selectedCityId: null,
  },
);

const emit = defineEmits<{
  (e: 'select-city', cityId: string | null): void;
}>();

const THEME_PALETTES: Record<
  SignalTheme,
  {
    dotLand: string;
    dotHighlight: string;
    arcBase: string;
    pulseStart: string;
    pulseEnd: string;
    nodeCore: string;
    nodeRing: string;
  }
> = {
  cobalt: {
    dotLand: 'rgba(148, 163, 212, 0.28)',
    dotHighlight: 'rgba(130, 140, 255, 0.56)',
    arcBase: 'rgba(99, 102, 241, 0.22)',
    pulseStart: '#494fdf',
    pulseEnd: '#6ef3d1',
    nodeCore: '#ffffff',
    nodeRing: '#6d73ff',
  },
  emerald: {
    dotLand: 'rgba(110, 196, 174, 0.26)',
    dotHighlight: 'rgba(52, 211, 153, 0.55)',
    arcBase: 'rgba(0, 168, 126, 0.22)',
    pulseStart: '#00a87e',
    pulseEnd: '#a7f3d0',
    nodeCore: '#ffffff',
    nodeRing: '#34d399',
  },
  violet: {
    dotLand: 'rgba(182, 148, 224, 0.26)',
    dotHighlight: 'rgba(192, 132, 252, 0.56)',
    arcBase: 'rgba(168, 85, 247, 0.24)',
    pulseStart: '#a855f7',
    pulseEnd: '#f5d0fe',
    nodeCore: '#ffffff',
    nodeRing: '#c084fc',
  },
};

/** 精校全球七大洲及主要岛屿轮廓（[经度, 纬度]），保证点阵世界地图一眼可辨 */
const LAND_POLYGONS: Array<Array<[number, number]>> = [
  // 北美洲主体
  [
    [-168, 66], [-162, 70], [-140, 70], [-126, 70], [-110, 68], [-94, 69],
    [-82, 64], [-78, 54], [-64, 60], [-56, 52], [-66, 44], [-71, 41],
    [-75, 36], [-81, 30], [-81, 25], [-84, 30], [-90, 29], [-97, 26],
    [-97, 19], [-88, 21], [-83, 10], [-78, 8], [-84, 9], [-93, 15],
    [-105, 19], [-110, 24], [-117, 32], [-124, 40], [-125, 49], [-134, 57],
    [-148, 60], [-161, 59],
  ],
  // 格陵兰
  [
    [-54, 60], [-42, 60], [-32, 68], [-18, 76], [-24, 82], [-44, 83],
    [-62, 78], [-58, 70],
  ],
  // 南美洲
  [
    [-78, 10], [-70, 12], [-61, 10], [-50, 2], [-35, -6], [-38, -14],
    [-41, -22], [-48, -28], [-54, -35], [-62, -41], [-66, -50], [-69, -55],
    [-74, -52], [-73, -42], [-71, -30], [-71, -18], [-81, -5], [-79, 2],
  ],
  // 欧洲（含伊比利亚、西欧、中欧、巴尔干）
  [
    [-9, 37], [-9, 43], [-2, 44], [-4, 48], [2, 51], [8, 54],
    [14, 54], [21, 55], [28, 60], [42, 66], [60, 68], [60, 50],
    [46, 46], [38, 45], [29, 41], [24, 37], [19, 40], [15, 45],
    [13, 41], [16, 38], [8, 44], [3, 42], [-5, 36],
  ],
  // 斯堪的纳维亚半岛
  [
    [5, 59], [10, 58], [16, 56], [20, 60], [25, 65], [31, 70],
    [22, 71], [14, 68], [6, 62],
  ],
  // 英国与爱尔兰
  [
    [-6, 50], [1, 51], [1, 54], [-3, 58], [-6, 57], [-5, 53],
  ],
  // 非洲
  [
    [-17, 15], [-13, 28], [-6, 36], [10, 37], [12, 33], [24, 32],
    [33, 31], [38, 22], [43, 12], [51, 11], [45, 2], [40, -10],
    [35, -24], [28, -33], [18, -35], [14, -22], [11, -6], [9, 4],
    [2, 6], [-8, 5], [-16, 11],
  ],
  // 马达加斯加
  [
    [44, -25], [47, -25], [50, -14], [48, -12], [44, -18],
  ],
  // 亚洲主体（含中东、印度、中国、西伯利亚、中南半岛）
  [
    [27, 41], [40, 42], [48, 46], [60, 50], [60, 68], [85, 73],
    [115, 74], [145, 71], [172, 66], [166, 60], [156, 52], [141, 54],
    [135, 44], [129, 40], [126, 35], [122, 39], [118, 38], [122, 31],
    [120, 23], [114, 22], [108, 21], [109, 12], [104, 1], [100, 7],
    [98, 16], [90, 22], [82, 16], [77, 8], [72, 20], [67, 25],
    [57, 26], [59, 22], [52, 16], [44, 13], [35, 29], [36, 36],
  ],
  // 日本列岛
  [
    [130, 31], [136, 34], [141, 36], [145, 44], [141, 45], [137, 38],
    [131, 34],
  ],
  // 菲律宾 & 印尼核心岛群
  [
    [120, 18], [124, 13], [126, 7], [122, 7], [119, 14],
  ],
  [
    [96, 5], [105, -6], [118, -8], [118, -4], [108, -2], [100, 1],
  ],
  [
    [109, 1], [118, 5], [118, -3], [112, -3],
  ],
  // 巴布亚新几内亚
  [
    [132, -2], [141, -3], [150, -10], [142, -9], [134, -5],
  ],
  // 澳大利亚
  [
    [114, -22], [122, -17], [131, -12], [136, -12], [142, -11], [146, -18],
    [153, -27], [150, -37], [141, -38], [135, -34], [129, -32], [115, -34],
    [113, -27],
  ],
  // 新西兰
  [
    [167, -46], [172, -43], [178, -37], [174, -35], [170, -41],
  ],
];

function pointInPolygon(lon: number, lat: number, poly: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-9) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function isLand(lon: number, lat: number): boolean {
  for (const poly of LAND_POLYGONS) {
    if (pointInPolygon(lon, lat, poly)) return true;
  }
  return false;
}

interface GridDot {
  u: number;
  v: number;
  phase: number;
}

interface ActivePulse {
  fromId: string;
  toId: string;
  progress: number;
  speed: number;
  delay: number;
}

interface Ripple {
  x: number;
  y: number;
  age: number;
  maxAge: number;
}

const wrapRef = ref<HTMLDivElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const hoveredCityId = ref<string | null>(null);
const tooltipPos = ref<{ x: number; y: number } | null>(null);

const activeCityId = computed(() => hoveredCityId.value ?? props.selectedCityId);
const activeCity = computed(
  () => props.cities.find((c) => c.id === activeCityId.value) ?? null,
);

const visibleArcs = computed(() => {
  if (props.scope === 'apac') {
    return props.arcs.filter((a) => a.scope === 'apac');
  }
  return props.arcs;
});

/** 经纬度 -> 画布归一化坐标 (u, v) */
function projectGeo(lon: number, lat: number): [number, number] {
  const u = (lon + 178) / 356; // 略去边缘留白让大陆满幅舒展
  const v = (82 - lat) / 140;  // 纬度范围 82N ~ 58S
  return [u, v];
}

// 预计算点阵地图所有陆地圆点（仅运行一次，毫秒级）
const LAND_DOTS: GridDot[] = (() => {
  const cols = 122;
  const rows = 56;
  const dots: GridDot[] = [];
  for (let r = 0; r < rows; r++) {
    const v = (r + 0.5) / rows;
    const lat = 82 - v * 140;
    for (let c = 0; c < cols; c++) {
      const u = (c + 0.5) / cols;
      const lon = u * 356 - 178;
      if (isLand(lon, lat)) {
        dots.push({
          u,
          v,
          phase: ((c * 0.27 + r * 0.41) % (Math.PI * 2)),
        });
      }
    }
  }
  return dots;
})();

let rafId = 0;
let alive = true;
let visible = true;
let width = 1;
let height = 1;
let pulses: ActivePulse[] = [];
const ripples: Ripple[] = [];

function buildPulses() {
  pulses = visibleArcs.value.map((arc, idx) => ({
    fromId: arc.from,
    toId: arc.to,
    progress: (idx * 0.21) % 1,
    speed: 0.24 + (idx % 4) * 0.055,
    delay: 0,
  }));
}

function getCityScreenPos(city: SignalCity): { x: number; y: number } {
  const [u, v] = projectGeo(city.lon, city.lat);
  const padX = width * 0.04;
  const padY = height * 0.07;
  return {
    x: padX + u * (width - padX * 2),
    y: padY + v * (height - padY * 2),
  };
}

function getDotScreenPos(dot: GridDot): { x: number; y: number } {
  const padX = width * 0.04;
  const padY = height * 0.07;
  return {
    x: padX + dot.u * (width - padX * 2),
    y: padY + dot.v * (height - padY * 2),
  };
}

function evalQuadBezier(
  p0: { x: number; y: number },
  cp: { x: number; y: number },
  p1: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * cp.x + t * t * p1.x,
    y: mt * mt * p0.y + 2 * mt * t * cp.y + t * t * p1.y,
  };
}

function getArcControlPoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
): { x: number; y: number } {
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  const lift = Math.min(height * 0.36, Math.max(36, dist * 0.28));
  return {
    x: (a.x + b.x) * 0.5,
    y: Math.min(a.y, b.y) - lift,
  };
}

let lastTime = performance.now();

function renderFrame(now: number) {
  rafId = 0;
  if (!alive || !visible) return;

  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dt = Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000));
  lastTime = now;

  const palette = THEME_PALETTES[props.theme] ?? THEME_PALETTES.cobalt;
  const animate =
    fxEnabled.value &&
    !(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  ctx.clearRect(0, 0, width, height);

  // 1. 绘制全球点阵大陆
  const dotRadius = width < 640 ? 1.15 : 1.55;
  const highlightId = activeCityId.value;
  const highlightCity = highlightId
    ? props.cities.find((c) => c.id === highlightId) ?? null
    : null;
  const highlightPt = highlightCity ? getCityScreenPos(highlightCity) : null;

  for (const dot of LAND_DOTS) {
    const pt = getDotScreenPos(dot);
    let color = palette.dotLand;
    let r = dotRadius;

    if (highlightPt) {
      const dist = Math.hypot(pt.x - highlightPt.x, pt.y - highlightPt.y);
      if (dist < 78) {
        color = palette.dotHighlight;
        r = dotRadius * (1 + (1 - dist / 78) * 0.45);
      }
    } else if (animate) {
      const shimmer = Math.sin(now * 0.0014 + dot.phase);
      if (shimmer > 0.84) {
        color = palette.dotHighlight;
      }
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const cityMap = new Map<string, { city: SignalCity; pt: { x: number; y: number } }>();
  for (const city of props.cities) {
    cityMap.set(city.id, { city, pt: getCityScreenPos(city) });
  }

  // 2. 绘制静态底层纤细飞弧轨道
  for (const arc of visibleArcs.value) {
    const a = cityMap.get(arc.from);
    const b = cityMap.get(arc.to);
    if (!a || !b) continue;

    const cp = getArcControlPoint(a.pt, b.pt);
    const isLinked =
      highlightId !== null && (arc.from === highlightId || arc.to === highlightId);

    ctx.save();
    ctx.strokeStyle = isLinked ? palette.nodeRing : palette.arcBase;
    ctx.lineWidth = isLinked ? 1.5 : 1;
    ctx.globalAlpha = isLinked ? 0.72 : 0.78;
    ctx.beginPath();
    ctx.moveTo(a.pt.x, a.pt.y);
    ctx.quadraticCurveTo(cp.x, cp.y, b.pt.x, b.pt.y);
    ctx.stroke();
    ctx.restore();
  }

  // 3. 推进并绘制发光脉冲飞弧（流光拖尾）
  if (animate) {
    for (const pulse of pulses) {
      pulse.progress += dt * pulse.speed;
      if (pulse.progress >= 1) {
        pulse.progress = 0;
        const dest = cityMap.get(pulse.toId);
        if (dest && ripples.length < 24) {
          ripples.push({ x: dest.pt.x, y: dest.pt.y, age: 0, maxAge: 1.05 });
        }
      }

      const a = cityMap.get(pulse.fromId);
      const b = cityMap.get(pulse.toId);
      if (!a || !b) continue;

      const cp = getArcControlPoint(a.pt, b.pt);
      const headT = pulse.progress;
      const tailT = Math.max(0, headT - 0.24);
      const steps = 16;

      const headPt = evalQuadBezier(a.pt, cp, b.pt, headT);
      const tailPt = evalQuadBezier(a.pt, cp, b.pt, tailT);

      const grad = ctx.createLinearGradient(tailPt.x, tailPt.y, headPt.x, headPt.y);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.55, palette.pulseStart);
      grad.addColorStop(0.9, palette.pulseEnd);
      grad.addColorStop(1, '#ffffff');

      ctx.save();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const t = tailT + ((headT - tailT) * i) / steps;
        const p = evalQuadBezier(a.pt, cp, b.pt, t);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();

      // 信号光头亮核
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(headPt.x, headPt.y, 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. 绘制信号抵达涟漪波纹
    for (let i = ripples.length - 1; i >= 0; i--) {
      const rp = ripples[i];
      rp.age += dt;
      if (rp.age >= rp.maxAge) {
        ripples.splice(i, 1);
        continue;
      }
      const ratio = rp.age / rp.maxAge;
      ctx.save();
      ctx.strokeStyle = palette.pulseEnd;
      ctx.globalAlpha = (1 - ratio) * 0.65;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, 4 + ratio * 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 5. 绘制枢纽城市节点与常驻呼吸光圈
  for (const { city, pt } of cityMap.values()) {
    const isActive = city.id === highlightId;
    const isCnCore = city.region === 'cn';

    if (animate) {
      const pulsePhase = ((now * 0.00075 + (city.lon + 180) * 0.01) % 1);
      ctx.save();
      ctx.strokeStyle = isCnCore ? palette.pulseEnd : palette.nodeRing;
      ctx.globalAlpha = (1 - pulsePhase) * (isActive ? 0.72 : 0.35);
      ctx.lineWidth = isActive ? 1.5 : 1;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4 + pulsePhase * (isActive ? 18 : 11), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 外晕圈
    ctx.save();
    ctx.fillStyle = isCnCore ? palette.pulseEnd : palette.nodeRing;
    ctx.globalAlpha = isActive ? 0.42 : 0.24;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, isActive ? 8.5 : 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 亮白节点核心
    ctx.fillStyle = palette.nodeCore;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, isActive ? 3.8 : isCnCore ? 3.0 : 2.4, 0, Math.PI * 2);
    ctx.fill();

    // 桌面端简洁城市标签
    if (width >= 640 && (isCnCore || isActive)) {
      ctx.save();
      ctx.font = `${isActive ? '600 12px' : '500 11px'} "Noto Serif SC Variable", "Noto Serif SC", "Source Han Serif SC", "Songti SC", serif`;
      ctx.fillStyle = isActive ? '#ffffff' : 'rgba(255,255,255,0.72)';
      ctx.textBaseline = 'middle';
      ctx.fillText(city.name, pt.x + 8, pt.y - 1);
      ctx.restore();
    }
  }

  if (animate) {
    rafId = requestAnimationFrame(renderFrame);
  }
}

function startLoop() {
  if (rafId || !visible || !alive) return;
  lastTime = performance.now();
  rafId = requestAnimationFrame(renderFrame);
}

function resizeCanvas() {
  const wrap = wrapRef.value;
  const canvas = canvasRef.value;
  if (!wrap || !canvas) return;
  const rect = wrap.getBoundingClientRect();
  width = Math.max(1, rect.width);
  height = Math.max(1, rect.height);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  renderFrame(performance.now());
  startLoop();
}

function findNearestCity(clientX: number, clientY: number): { city: SignalCity; pt: { x: number; y: number } } | null {
  const wrap = wrapRef.value;
  if (!wrap) return null;
  const rect = wrap.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let best: { city: SignalCity; pt: { x: number; y: number }; dist: number } | null = null;
  for (const city of props.cities) {
    const pt = getCityScreenPos(city);
    const dist = Math.hypot(x - pt.x, y - pt.y);
    if (dist < 26 && (!best || dist < best.dist)) {
      best = { city, pt, dist };
    }
  }
  return best ? { city: best.city, pt: best.pt } : null;
}

function handlePointerMove(e: PointerEvent) {
  const hit = findNearestCity(e.clientX, e.clientY);
  if (hit) {
    hoveredCityId.value = hit.city.id;
    tooltipPos.value = hit.pt;
  } else {
    hoveredCityId.value = null;
    tooltipPos.value = null;
  }
}

function handlePointerLeave() {
  hoveredCityId.value = null;
  tooltipPos.value = null;
}

function handleClick(e: MouseEvent) {
  const hit = findNearestCity(e.clientX, e.clientY);
  if (hit) {
    emit('select-city', hit.city.id === props.selectedCityId ? null : hit.city.id);
    if (!fxEnabled.value) renderFrame(performance.now());
  }
}

watch([() => props.scope, () => props.theme, fxEnabled, activeCityId], () => {
  buildPulses();
  renderFrame(performance.now());
  startLoop();
});

let ro: ResizeObserver | null = null;
let io: IntersectionObserver | null = null;

onMounted(() => {
  alive = true;
  buildPulses();
  resizeCanvas();

  if (wrapRef.value) {
    ro = new ResizeObserver(resizeCanvas);
    ro.observe(wrapRef.value);

    io = new IntersectionObserver(([entry]) => {
      visible = entry ? entry.isIntersecting : true;
      if (visible) startLoop();
    });
    io.observe(wrapRef.value);
  }
});

onUnmounted(() => {
  alive = false;
  visible = false;
  cancelAnimationFrame(rafId);
  ro?.disconnect();
  io?.disconnect();
});
</script>

<template>
  <div
    ref="wrapRef"
    class="signal-map relative h-full w-full select-none overflow-hidden"
    :class="hoveredCityId ? 'cursor-pointer' : 'cursor-default'"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
    @click="handleClick"
  >
    <canvas ref="canvasRef" class="block h-full w-full" />

    <!-- 城市节点悬浮铭牌（仅平板/桌面浮于地图内；手机端已移至地图下方独立信息条，彻底避免挡住地图） -->
    <Transition name="dropdown-pop">
      <div
        v-if="activeCity"
        class="pointer-events-none absolute z-20 hidden w-60 rounded-md border border-hairline-dark bg-black/85 p-3.5 text-left backdrop-blur-md sm:block"
        :style="
          tooltipPos
            ? {
                left: `${Math.min(Math.max(12, tooltipPos.x + 14), Math.max(12, width - 252))}px`,
                top: `${Math.min(Math.max(12, tooltipPos.y - 78), Math.max(12, height - 110))}px`,
              }
            : { right: '16px', top: '16px' }
        "
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5">
            <span class="signal-dot h-2 w-2 rounded-full bg-accent-teal" />
            <span class="font-display text-[15px] font-medium text-white">
              {{ activeCity.name }}
            </span>
            <span class="text-[11px] text-on-dark-mute">{{ activeCity.en }}</span>
          </div>
          <span class="rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] font-semibold text-accent-teal tabular">
            {{ activeCity.latencyMs }}ms
          </span>
        </div>
        <div class="mt-1.5 text-[12px] font-semibold text-white/90">
          {{ activeCity.band }}
        </div>
        <p class="mt-0.5 text-[12px] leading-[1.45] text-on-dark-mute">
          {{ activeCity.note }}
        </p>
      </div>
    </Transition>
  </div>
</template>
