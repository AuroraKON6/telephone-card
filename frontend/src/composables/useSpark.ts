import { ref } from 'vue';

export interface SparkBurstEvent {
  x: number;
  y: number;
  colors?: string[];
}

type SparkListener = (evt: SparkBurstEvent) => void;

const listeners = new Set<SparkListener>();

/** 全局动态流光与粒子特效开关（默认开启，用户可在顶栏一键切换对比） */
export const fxEnabled = ref(true);

export function toggleFxMode() {
  fxEnabled.value = !fxEnabled.value;
}

export function onSparkBurst(fn: SparkListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 在点击坐标处触发一次克制的高精度微光粒子迸发（借鉴 vue-bits ClickSpark） */
export function triggerSpark(
  eventOrCoords: MouseEvent | { x: number; y: number },
  colors?: string[],
) {
  if (!fxEnabled.value) return;
  if (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    return;
  }
  const x = 'clientX' in eventOrCoords ? eventOrCoords.clientX : eventOrCoords.x;
  const y = 'clientY' in eventOrCoords ? eventOrCoords.y : eventOrCoords.y;
  listeners.forEach((fn) => fn({ x, y, colors }));
}
