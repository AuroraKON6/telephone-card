<script setup lang="ts">
/* 点阵星轨 AI 思考光球（借鉴 Jakubantalik/thinking-orbs · 4,108 ⭐）
 * 纯 SVG + GPU 旋转动画，支持小号图标态与加速思考加载态
 */
withDefaults(
  defineProps<{
    size?: number;
    active?: boolean;
    tone?: 'light' | 'cobalt';
  }>(),
  {
    size: 20,
    active: false,
    tone: 'cobalt',
  },
);
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 32 32"
    fill="none"
    class="flex-shrink-0"
    aria-hidden="true"
  >
    <!-- 外环点阵星轨 -->
    <g
      class="orb-ring-outer"
      :class="active ? 'orb-fast' : ''"
      :fill="tone === 'light' ? '#ffffff' : '#858aff'"
    >
      <circle cx="16" cy="3.5" r="2.1" opacity="1" />
      <circle cx="24.8" cy="7.2" r="1.8" opacity="0.82" />
      <circle cx="28.5" cy="16" r="1.5" opacity="0.65" />
      <circle cx="24.8" cy="24.8" r="1.3" opacity="0.45" />
      <circle cx="16" cy="28.5" r="1.2" opacity="0.32" />
      <circle cx="7.2" cy="24.8" r="1.4" opacity="0.48" />
      <circle cx="3.5" cy="16" r="1.7" opacity="0.7" />
      <circle cx="7.2" cy="7.2" r="1.9" opacity="0.9" />
    </g>

    <!-- 内环反向星轨 -->
    <g
      class="orb-ring-inner"
      :class="active ? 'orb-fast' : ''"
      :fill="tone === 'light' ? '#b7bbff' : '#00c495'"
    >
      <circle cx="16" cy="9.2" r="1.5" opacity="0.95" />
      <circle cx="22.8" cy="16" r="1.35" opacity="0.72" />
      <circle cx="16" cy="22.8" r="1.2" opacity="0.48" />
      <circle cx="9.2" cy="16" r="1.45" opacity="0.82" />
    </g>

    <!-- 核心微脉冲亮点 -->
    <circle
      cx="16"
      cy="16"
      r="2.4"
      :fill="tone === 'light' ? '#ffffff' : '#ffffff'"
      class="signal-dot"
    />
  </svg>
</template>
