<script setup lang="ts">
/* 巡航流光边框组件（借鉴 vue3-border-beam / inspira-ui / magicui BorderBeam）
 * 采用 CSS @property --beam-angle + mask-composite，仅在 1.5px 边框路径上呈现流动光束，内部 100% 透明
 */
import { fxEnabled } from '@/composables/useSpark';

withDefaults(
  defineProps<{
    colorFrom?: string;
    colorTo?: string;
    duration?: number;
    borderWidth?: number;
    radiusClass?: string;
  }>(),
  {
    colorFrom: '#6d73ff',
    colorTo: '#00c495',
    duration: 5.5,
    borderWidth: 1.5,
    radiusClass: 'rounded-xl',
  },
);
</script>

<template>
  <span
    v-if="fxEnabled"
    class="border-beam-ring pointer-events-none absolute inset-0 z-10"
    :class="radiusClass"
    :style="{
      '--beam-from': colorFrom,
      '--beam-to': colorTo,
      '--beam-duration': `${duration}s`,
      '--beam-width': `${borderWidth}px`,
    }"
    aria-hidden="true"
  />
</template>
