<script setup lang="ts">
/* 原生 Vue 3 逐字/逐词/逐行错峰进场文字组件（StaggeredText）
 * 效果：字符从底部裁切遮罩中以 3D 微俯仰 + 柔焦消散 + Out-Expo 缓动依次破壳升起
 * 特性：支持多行数组、单行高亮扫光、mount 立即触发或 inview 视口触发、完整无障碍 aria-label
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { fxEnabled } from '@/composables/useSpark';

export interface StaggeredLine {
  text: string;
  /** 可选附加类，如金属流光扫字 */
  className?: string;
  /** 是否对该行启用连贯金属扫光字效 */
  shimmer?: boolean;
}

const props = withDefaults(
  defineProps<{
    /** 单行文本（与 lines 二选一） */
    text?: string;
    /** 多行文本配置（支持不同行应用不同颜色/流光样式） */
    lines?: StaggeredLine[];
    /** 渲染语义标签 */
    as?: 'h1' | 'h2' | 'h3' | 'p' | 'div' | 'span';
    /** 拆分粒度：逐字 / 逐词 / 逐行 */
    by?: 'char' | 'word' | 'line';
    /** 触发时机：首屏挂载即播 / 滚入视口播放 */
    trigger?: 'mount' | 'inview';
    /** 每个片段错峰间隔（毫秒） */
    staggerMs?: number;
    /** 整体起播延迟（毫秒） */
    baseDelayMs?: number;
    /** 单片段动画时长（毫秒） */
    durationMs?: number;
  }>(),
  {
    text: '',
    lines: undefined,
    as: 'h2',
    by: 'char',
    trigger: 'inview',
    staggerMs: 44,
    baseDelayMs: 0,
    durationMs: 680,
  },
);

const rootRef = ref<HTMLElement | null>(null);
const isVisible = ref(false);
let observer: IntersectionObserver | null = null;
let mountRaf = 0;

const normalizedLines = computed<StaggeredLine[]>(() => {
  if (props.lines && props.lines.length > 0) return props.lines;
  return props.text
    .split('\n')
    .filter((l) => l.length > 0)
    .map((l) => ({ text: l }));
});

const fullAccessibleText = computed(() =>
  normalizedLines.value.map((l) => l.text).join(''),
);

interface TokenItem {
  value: string;
  globalIndex: number;
  lineIndex: number;
  indexInLine: number;
  lineTotal: number;
}

const tokenizedLines = computed(() => {
  let cursor = 0;
  return normalizedLines.value.map((line, lineIdx) => {
    let rawParts: string[];
    if (props.by === 'line') {
      rawParts = [line.text];
    } else if (props.by === 'word') {
      rawParts = line.text.split(/(\s+)/).filter((p) => p.length > 0);
    } else {
      rawParts = Array.from(line.text);
    }

    const tokens: TokenItem[] = rawParts.map((part, idxInLine) => ({
      value: part === ' ' ? '\u00A0' : part,
      globalIndex: cursor++,
      lineIndex: lineIdx,
      indexInLine: idxInLine,
      lineTotal: rawParts.length,
    }));

    return {
      ...line,
      tokens,
    };
  });
});

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

onMounted(() => {
  if (!fxEnabled.value || prefersReducedMotion()) {
    isVisible.value = true;
    return;
  }

  if (props.trigger === 'mount') {
    mountRaf = requestAnimationFrame(() => {
      mountRaf = requestAnimationFrame(() => {
        isVisible.value = true;
      });
    });
    return;
  }

  if (!rootRef.value || typeof IntersectionObserver === 'undefined') {
    isVisible.value = true;
    return;
  }

  observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          isVisible.value = true;
          observer?.disconnect();
          observer = null;
          break;
        }
      }
    },
    {
      threshold: 0.12,
      rootMargin: '0px 0px -24px 0px',
    },
  );
  observer.observe(rootRef.value);
});

onUnmounted(() => {
  cancelAnimationFrame(mountRaf);
  observer?.disconnect();
  observer = null;
});
</script>

<template>
  <component
    :is="as"
    ref="rootRef"
    :aria-label="fullAccessibleText"
    class="staggered-text"
    :class="{ 'is-shown': isVisible || !fxEnabled }"
  >
    <span
      v-for="(line, lIdx) in tokenizedLines"
      :key="lIdx"
      aria-hidden="true"
      class="block"
      :class="line.className"
    >
      <span
        v-for="tok in line.tokens"
        :key="tok.globalIndex"
        class="stagger-mask"
      >
        <span
          class="stagger-unit"
          :class="line.shimmer && fxEnabled ? 'stagger-shimmer' : ''"
          :style="{
            '--stagger-delay': `${baseDelayMs + tok.globalIndex * staggerMs}ms`,
            '--stagger-dur': `${durationMs}ms`,
            '--shimmer-offset': `${Math.round((tok.indexInLine / Math.max(1, tok.lineTotal)) * 100)}%`,
          }"
        >{{ tok.value }}</span>
      </span>
    </span>
  </component>
</template>

<style scoped>
.stagger-mask {
  display: inline-block;
  overflow: hidden;
  vertical-align: bottom;
  /* 预留上下微距防止大字中文撇捺与标点被裁切 */
  padding-top: 0.06em;
  padding-bottom: 0.1em;
  margin-top: -0.06em;
  margin-bottom: -0.1em;
  perspective: 640px;
}

.stagger-unit {
  display: inline-block;
  opacity: 0;
  filter: blur(8px);
  transform: translate3d(0, 108%, 0) rotateX(-26deg);
  transform-origin: 50% 100%;
  transition:
    transform var(--stagger-dur, 680ms) cubic-bezier(0.16, 1, 0.3, 1) var(--stagger-delay, 0ms),
    opacity calc(var(--stagger-dur, 680ms) * 0.72) ease-out var(--stagger-delay, 0ms),
    filter calc(var(--stagger-dur, 680ms) * 0.85) cubic-bezier(0.16, 1, 0.3, 1) var(--stagger-delay, 0ms);
  will-change: transform, opacity, filter;
}

.staggered-text.is-shown .stagger-unit {
  opacity: 1;
  filter: blur(0px);
  transform: translate3d(0, 0, 0) rotateX(0deg);
}

/* 逐字共享协调流光色相，保留金属流光质感 */
@keyframes charShimmer {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 220% 50%;
  }
}

.stagger-shimmer {
  background-image: linear-gradient(
    112deg,
    #ffffff 0%,
    #ffffff 34%,
    #c084fc 47%,
    #6ef3d1 55%,
    #ffffff 68%,
    #ffffff 100%
  );
  background-size: 240% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: charShimmer 6.2s linear infinite;
  animation-delay: calc(var(--stagger-delay, 0ms) * -0.35);
}

@media (prefers-reduced-motion: reduce) {
  .stagger-unit {
    opacity: 1 !important;
    filter: none !important;
    transform: none !important;
    transition: none !important;
  }
}
</style>
