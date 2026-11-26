<script setup lang="ts">
/* 60fps 金融级等宽数字平滑插值滚变组件（支持整数与小数，尊重减弱动效偏好） */
import { onUnmounted, ref, watch } from 'vue';

const props = withDefaults(
  defineProps<{
    value: number;
    decimals?: number;
    duration?: number;
  }>(),
  {
    decimals: 0,
    duration: 460,
  },
);

const displayValue = ref(props.value);
let rafId: number | null = null;

function formatNum(n: number): string {
  if (props.decimals > 0) {
    return n.toFixed(props.decimals);
  }
  return String(Math.round(n));
}

function animateTo(target: number) {
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }

  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduced || props.duration <= 0) {
    displayValue.value = target;
    return;
  }

  const startVal = displayValue.value;
  const delta = target - startVal;
  if (Math.abs(delta) < 0.0001) {
    displayValue.value = target;
    return;
  }

  const startTime = performance.now();
  const duration = props.duration;

  const step = (now: number) => {
    const elapsed = now - startTime;
    const progress = Math.min(1, elapsed / duration);
    // Out-Expo 阻尼缓动：起手快、收尾细腻贴合
    const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    displayValue.value = startVal + delta * eased;
    if (progress < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      displayValue.value = target;
      rafId = null;
    }
  };

  rafId = requestAnimationFrame(step);
}

watch(
  () => props.value,
  (nextVal) => animateTo(nextVal),
);

onUnmounted(() => {
  if (rafId !== null) cancelAnimationFrame(rafId);
});
</script>

<template>
  <span class="tabular">{{ formatNum(displayValue) }}</span>
</template>
