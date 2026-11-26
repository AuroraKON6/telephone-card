<script setup lang="ts">
/* Revolut 标志性实体卡片模型（1.586:1 比例，rounded-[20px]）
 * 升级物理交互：鼠标跟随 3D 透视倾斜（±8deg） + 金属表面镜面流光反射（Sheen Glare）
 * 严格遵守 DESIGN.md：多色系只存在于产品实体视觉模型中，且不使用外围 drop-shadow
 */
import { computed, ref } from 'vue';
import type { CardMaterial, Carrier } from '@/types/sim';
import { CARRIER_META } from '@/data/plans';
import { fxEnabled } from '@/composables/useSpark';

const props = withDefaults(
  defineProps<{
    material: CardMaterial;
    name: string;
    carrier: Carrier;
    monthlyPrice: number;
    generalDataGb: number;
    voiceMinutes?: number;
    skuCode?: string;
    compact?: boolean;
    interactive?: boolean;
  }>(),
  {
    voiceMinutes: 0,
    skuCode: 'NS-5G-0001',
    compact: false,
    interactive: true,
  },
);

const tiltX = ref(0);
const tiltY = ref(0);
const glareX = ref(50);
const glareY = ref(30);
const isHovering = ref(false);

function handlePointerMove(e: PointerEvent) {
  if (!props.interactive) return;
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const px = (e.clientX - rect.left) / rect.width;
  const py = (e.clientY - rect.top) / rect.height;
  // 最大 ±8 度克制倾角，呈现厚重金属实体卡握持感
  tiltY.value = Number(((px - 0.5) * 16).toFixed(2));
  tiltX.value = Number(((0.5 - py) * 14).toFixed(2));
  glareX.value = Math.round(px * 100);
  glareY.value = Math.round(py * 100);
  isHovering.value = true;
}

function handlePointerLeave() {
  tiltX.value = 0;
  tiltY.value = 0;
  isHovering.value = false;
}

const cardTransformStyle = computed(() => {
  if (!props.interactive) return {};
  return {
    transform: isHovering.value
      ? `perspective(960px) rotateX(${tiltX.value}deg) rotateY(${tiltY.value}deg) scale3d(1.018, 1.018, 1.018)`
      : 'perspective(960px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
    transition: isHovering.value
      ? 'transform 90ms linear'
      : 'transform 520ms cubic-bezier(0.22, 1, 0.36, 1)',
  };
});

const surfaceStyle = computed(() => {
  switch (props.material) {
    case 'cobalt':
      return {
        background:
          'linear-gradient(135deg, #5d64ff 0%, #494fdf 48%, #282d9c 100%)',
        border: '1px solid rgba(255,255,255,0.22)',
        label: 'PLUS · 5G SA',
      };
    case 'metal':
      return {
        background:
          'linear-gradient(135deg, #b08b7e 0%, #936d62 45%, #46332d 100%)',
        border: '1px solid rgba(255,255,255,0.20)',
        label: 'METAL · 5G-A',
      };
    case 'emerald':
      return {
        background:
          'linear-gradient(135deg, #00c495 0%, #008f6b 48%, #024334 100%)',
        border: '1px solid rgba(255,255,255,0.20)',
        label: 'ULTRA · 500M',
      };
    case 'crimson':
      return {
        background:
          'linear-gradient(135deg, #f0335c 0%, #b81539 50%, #4a0717 100%)',
        border: '1px solid rgba(255,255,255,0.20)',
        label: 'EDITION · 5G',
      };
    default:
      return {
        background:
          'linear-gradient(135deg, #272a2f 0%, #16181a 52%, #070809 100%)',
        border: '1px solid rgba(255,255,255,0.16)',
        label: 'STANDARD · 5G',
      };
  }
});

const carrierCode = computed(() => CARRIER_META[props.carrier].code);
</script>

<template>
  <div
    class="relative w-full overflow-hidden rounded-lg text-on-dark select-none"
    :class="compact ? 'p-5' : 'p-6 sm:p-7'"
    :style="{
      aspectRatio: '1.586 / 1',
      background: surfaceStyle.background,
      border: surfaceStyle.border,
      ...cardTransformStyle,
    }"
    @pointermove="handlePointerMove"
    @pointerleave="handlePointerLeave"
  >
    <!-- 拉丝金属微纹理层（实体钛金/金属卡真实肌理） -->
    <div
      v-if="fxEnabled"
      class="brushed-metal-overlay pointer-events-none absolute inset-0 opacity-80"
    />

    <!-- 静态斜切环境光晕 -->
    <div
      class="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full opacity-20"
      style="background: radial-gradient(circle, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0) 70%);"
    />

    <!-- 全息虹彩棱镜折射层（借鉴 holo-card，仅在指针移动时柔亮呈现金属彩虹光泽） -->
    <div
      v-if="interactive && fxEnabled"
      class="pointer-events-none absolute inset-0 transition-opacity duration-300"
      :style="{
        opacity: isHovering ? 0.28 : 0.08,
        mixBlendMode: 'color-dodge',
        background: `conic-gradient(from ${Math.round(glareX * 2.2)}deg at ${glareX}% ${glareY}%, rgba(124,131,255,0.55), rgba(0,224,176,0.45), rgba(255,255,255,0.65), rgba(230,30,73,0.3), rgba(124,131,255,0.55))`,
      }"
    />

    <!-- 动态金属镜面高光（跟随指针坐标流动，模拟实体金属卡反光） -->
    <div
      v-if="interactive && fxEnabled"
      class="pointer-events-none absolute inset-0 transition-opacity duration-300"
      :style="{
        opacity: isHovering ? 0.44 : 0,
        background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.82) 0%, rgba(255,255,255,0.16) 35%, rgba(255,255,255,0) 66%)`,
      }"
    />

    <div class="relative flex h-full flex-col justify-between">
      <!-- 顶部品牌字标与 5G 制式标识 -->
      <div class="flex items-start justify-between gap-2">
        <div>
          <div class="flex items-center gap-2">
            <span class="font-display text-sm font-semibold tracking-[-0.02em] text-white sm:text-base">
              NovaSIM
            </span>
            <span
              class="ns-data-mono rounded-full bg-black/30 px-2.5 py-0.5 text-[10.5px] font-medium tracking-[0.12em] text-white/90"
            >
              {{ surfaceStyle.label }}
            </span>
          </div>
          <p class="ns-data-mono mt-1 text-[11px] text-white/75">
            {{ carrier }} · {{ carrierCode }}
          </p>
        </div>

        <!-- 信号波纹图标 -->
        <svg
          class="h-6 w-6 text-white/80"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4.93 19.07A10 10 0 0 1 19.07 4.93"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            opacity="0.45"
          />
          <path
            d="M8.46 15.54A5 5 0 0 1 15.54 8.46"
            stroke="currentColor"
            stroke-width="1.75"
            stroke-linecap="round"
            opacity="0.75"
          />
          <circle cx="12" cy="12" r="1.75" fill="currentColor" />
        </svg>
      </div>

      <!-- 中部金属蚀刻 SIM 触点 + 核心容量印刻 -->
      <div class="flex items-center justify-between gap-4">
        <svg
          :class="compact ? 'h-9 w-12' : 'h-11 w-14'"
          viewBox="0 0 56 42"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="1"
            y="1"
            width="54"
            height="40"
            rx="7"
            fill="url(#simGoldGrad)"
            stroke="rgba(255,255,255,0.45)"
            stroke-width="1.2"
          />
          <path
            d="M19 1V41M37 1V41M1 14H19M37 14H55M1 28H19M37 28H55M19 21H37"
            stroke="rgba(20,20,24,0.45)"
            stroke-width="1.35"
          />
          <defs>
            <linearGradient
              id="simGoldGrad"
              x1="0"
              y1="0"
              x2="56"
              y2="42"
              gradientUnits="userSpaceOnUse"
            >
              <stop stop-color="#f7e7c4" />
              <stop offset="0.5" stop-color="#d4b47c" />
              <stop offset="1" stop-color="#a8864e" />
            </linearGradient>
          </defs>
        </svg>

        <div class="text-right">
          <div
            class="hero-num text-white"
            :class="compact ? 'text-2xl' : 'text-3xl sm:text-4xl'"
          >
            <template v-if="generalDataGb < 0">不限量</template>
            <template v-else-if="generalDataGb === 0">待核验</template>
            <template v-else>{{ generalDataGb }}<span class="ml-0.5 text-base font-medium text-white/80">GB</span></template>
          </div>
          <div class="mt-1 text-[11px] uppercase tracking-wider text-white/75">
            通用高速流量{{ voiceMinutes > 0 ? ` · ${voiceMinutes} 分钟` : '' }}
          </div>
        </div>
      </div>

      <!-- 底部套餐名、月租与卡面序列码 -->
      <div class="flex items-end justify-between gap-2 border-t border-white/15 pt-3">
        <div class="min-w-0">
          <div class="truncate font-display text-sm font-semibold text-white">
            {{ name }}
          </div>
          <div class="ns-data-mono mt-0.5 text-[11px] tracking-[0.14em] text-white/65">
            {{ skuCode }}
          </div>
        </div>
        <div class="flex-shrink-0 text-right">
          <span class="font-display text-xs text-white/75">¥</span>
          <span
            class="hero-num text-white"
            :class="compact ? 'text-xl' : 'text-2xl'"
          >
            {{ monthlyPrice }}
          </span>
          <span class="text-xs text-white/75">/月</span>
        </div>
      </div>
    </div>
  </div>
</template>
