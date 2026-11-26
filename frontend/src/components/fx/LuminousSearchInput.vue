<script setup lang="ts">
/*
 * From Uiverse.io by Lakshay-art - https://uiverse.io/Lakshay-art/curvy-earwig-22
 * MIT License, Copyright (c) Lakshay-art (Lakshay Gupta)
 *
 * 已适配为响应式 Vue 3 独立组件，并对类名、SVG 渐变 ID 与关键帧进行命名空间隔离，
 * 完整保留原版黑曜石底面、多层锥形渐变光环、悬停/聚焦旋转动效、左侧渐变搜索镜及右侧旋光筛选图标。
 */
import { computed } from 'vue';

let uidSeq = 0;

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    ariaLabel?: string;
    /** 是否展示右侧旋光筛选按钮（默认展示，与原版完全一致） */
    showFilter?: boolean;
    /** 右侧筛选按钮提示文案 */
    filterTitle?: string;
    /** 高度（px，默认 56px 精准对齐 Revolut 56px 表单体系） */
    heightPx?: number;
  }>(),
  {
    placeholder: 'Search...',
    ariaLabel: '搜索',
    showFilter: true,
    filterTitle: '快捷筛选',
    heightPx: 56,
  },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
  (e: 'filter-click', event: MouseEvent): void;
  (e: 'focus', event: FocusEvent): void;
  (e: 'blur', event: FocusEvent): void;
}>();

const instanceId = `ns-lsearch-${++uidSeq}`;
const gradCircleId = `${instanceId}-c`;
const gradLineId = `${instanceId}-l`;

const hasText = computed(() => props.modelValue.length > 0);

function handleInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value);
}
</script>

<template>
  <div
    class="ns-poda"
    :style="{ '--ns-search-h': `${heightPx}px` }"
  >
    <!-- 多层旋转锥形渐变流光边框（严格保持原版层次与色值） -->
    <div class="ns-poda-glow" aria-hidden="true" />
    <div class="ns-poda-dark-bg" aria-hidden="true" />
    <div class="ns-poda-dark-bg" aria-hidden="true" />
    <div class="ns-poda-dark-bg" aria-hidden="true" />
    <div class="ns-poda-white" aria-hidden="true" />
    <div class="ns-poda-border" aria-hidden="true" />

    <!-- 主输入层 -->
    <div class="ns-poda-main">
      <input
        :value="modelValue"
        type="text"
        role="searchbox"
        :placeholder="placeholder"
        :aria-label="ariaLabel"
        class="ns-poda-input"
        :class="showFilter ? 'ns-poda-input--with-filter' : 'ns-poda-input--plain'"
        @input="handleInput"
        @focus="emit('focus', $event)"
        @blur="emit('blur', $event)"
      />

      <!-- 空值未聚焦时的柔黑渐隐遮罩与左侧品红微晕 -->
      <div v-if="!hasText" class="ns-poda-input-mask" aria-hidden="true" />
      <div class="ns-poda-pink-mask" aria-hidden="true" />

      <!-- 右侧旋光筛选按钮（完整保留原版旋转金属锥形细边与漏斗图标） -->
      <template v-if="showFilter">
        <div class="ns-poda-filter-border" aria-hidden="true" />
        <button
          type="button"
          class="ns-poda-filter-icon"
          :title="filterTitle"
          :aria-label="filterTitle"
          @click.stop="emit('filter-click', $event)"
        >
          <svg
            preserveAspectRatio="none"
            height="27"
            width="27"
            viewBox="4.8 4.56 14.832 15.408"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8.16 6.65002H15.83C16.47 6.65002 16.99 7.17002 16.99 7.81002V9.09002C16.99 9.56002 16.7 10.14 16.41 10.43L13.91 12.64C13.56 12.93 13.33 13.51 13.33 13.98V16.48C13.33 16.83 13.1 17.29 12.81 17.47L12 17.98C11.24 18.45 10.2 17.92 10.2 16.99V13.91C10.2 13.5 9.97 12.98 9.73 12.69L7.52 10.36C7.23 10.08 7 9.55002 7 9.20002V7.87002C7 7.17002 7.52 6.65002 8.16 6.65002Z"
              stroke="#d6d6e6"
              stroke-width="1"
              stroke-miterlimit="10"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </template>

      <!-- 左侧渐变搜索镜图标 -->
      <div class="ns-poda-search-icon" aria-hidden="true">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
          fill="none"
        >
          <circle :stroke="`url(#${gradCircleId})`" r="8" cy="11" cx="11" />
          <line :stroke="`url(#${gradLineId})`" y2="16.65" y1="22" x2="16.65" x1="22" />
          <defs>
            <linearGradient gradientTransform="rotate(50)" :id="gradCircleId">
              <stop stop-color="#f8e7f8" offset="0%" />
              <stop stop-color="#b6a9b7" offset="50%" />
            </linearGradient>
            <linearGradient :id="gradLineId">
              <stop stop-color="#b6a9b7" offset="0%" />
              <stop stop-color="#837484" offset="50%" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  </div>
</template>

<style scoped>
/*
 * From Uiverse.io by Lakshay-art - https://uiverse.io/Lakshay-art/curvy-earwig-22
 * MIT License, Copyright (c) Lakshay-art (Lakshay Gupta)
 */
.ns-poda {
  --ns-search-h: 56px;
  position: relative;
  isolation: isolate;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: var(--ns-search-h);
}

.ns-poda-white,
.ns-poda-border,
.ns-poda-dark-bg,
.ns-poda-glow {
  position: absolute;
  overflow: hidden;
  z-index: -1;
  border-radius: 12px;
  filter: blur(3px);
  pointer-events: none;
}

.ns-poda-main {
  position: relative;
  width: 100%;
  height: 100%;
}

.ns-poda-input {
  background-color: #010201;
  border: none;
  width: 100%;
  height: 100%;
  border-radius: 10px;
  color: #ffffff;
  font-size: 15px;
  line-height: 1.4;
}

.ns-poda-input--with-filter {
  padding-left: 52px;
  padding-right: 56px;
}

.ns-poda-input--plain {
  padding-left: 50px;
  padding-right: 16px;
}

.ns-poda-input::placeholder {
  color: #c0b9c0;
}

.ns-poda-input:focus {
  outline: none;
}

.ns-poda-main:focus-within > .ns-poda-input-mask {
  display: none;
}

.ns-poda-input-mask {
  pointer-events: none;
  width: 72px;
  height: 22px;
  position: absolute;
  background: linear-gradient(90deg, transparent, #010201);
  top: 50%;
  right: 56px;
  transform: translateY(-50%);
}

.ns-poda-pink-mask {
  pointer-events: none;
  width: 30px;
  height: 20px;
  position: absolute;
  background: #cf30aa;
  top: 10px;
  left: 8px;
  filter: blur(20px);
  opacity: 0.8;
  transition: all 2s;
}

.ns-poda-main:hover > .ns-poda-pink-mask {
  opacity: 0;
}

.ns-poda-white {
  inset: -3.5px;
  border-radius: 11px;
  filter: blur(2px);
}

.ns-poda-white::before {
  content: '';
  z-index: -2;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(83deg);
  position: absolute;
  width: 900px;
  height: 900px;
  background-repeat: no-repeat;
  background-position: 0 0;
  filter: brightness(1.4);
  background-image: conic-gradient(
    rgba(0, 0, 0, 0) 0%,
    #a099d8,
    rgba(0, 0, 0, 0) 8%,
    rgba(0, 0, 0, 0) 50%,
    #dfa2da,
    rgba(0, 0, 0, 0) 58%
  );
  transition: all 2s;
}

.ns-poda-border {
  inset: -1.5px;
  border-radius: 11px;
  filter: blur(0.5px);
}

.ns-poda-border::before {
  content: '';
  z-index: -2;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(70deg);
  position: absolute;
  width: 900px;
  height: 900px;
  filter: brightness(1.3);
  background-repeat: no-repeat;
  background-position: 0 0;
  background-image: conic-gradient(
    #1c191c,
    #402fb5 5%,
    #1c191c 14%,
    #1c191c 50%,
    #cf30aa 60%,
    #1c191c 64%
  );
  transition: all 2s;
}

.ns-poda-dark-bg {
  inset: -4.5px;
  border-radius: 13px;
}

.ns-poda-dark-bg::before {
  content: '';
  z-index: -2;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(82deg);
  position: absolute;
  width: 900px;
  height: 900px;
  background-repeat: no-repeat;
  background-position: 0 0;
  background-image: conic-gradient(
    rgba(0, 0, 0, 0),
    #18116a,
    rgba(0, 0, 0, 0) 10%,
    rgba(0, 0, 0, 0) 50%,
    #6e1b60,
    rgba(0, 0, 0, 0) 60%
  );
  transition: all 2s;
}

.ns-poda-glow {
  inset: -16px;
  border-radius: 20px;
  filter: blur(26px);
  opacity: 0.42;
}

.ns-poda-glow::before {
  content: '';
  z-index: -2;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(60deg);
  position: absolute;
  width: 1100px;
  height: 1100px;
  background-repeat: no-repeat;
  background-position: 0 0;
  background-image: conic-gradient(
    #000,
    #402fb5 5%,
    #000 38%,
    #000 50%,
    #cf30aa 60%,
    #000 87%
  );
  transition: all 2s;
}

/* 悬停平滑旋转 180° */
.ns-poda:hover > .ns-poda-dark-bg::before {
  transform: translate(-50%, -50%) rotate(-98deg);
}
.ns-poda:hover > .ns-poda-glow::before {
  transform: translate(-50%, -50%) rotate(-120deg);
}
.ns-poda:hover > .ns-poda-white::before {
  transform: translate(-50%, -50%) rotate(-97deg);
}
.ns-poda:hover > .ns-poda-border::before {
  transform: translate(-50%, -50%) rotate(-110deg);
}

/* 聚焦顺时针 4 秒优雅环绕旋转 */
.ns-poda:focus-within > .ns-poda-dark-bg::before {
  transform: translate(-50%, -50%) rotate(442deg);
  transition: all 4s;
}
.ns-poda:focus-within > .ns-poda-glow::before {
  transform: translate(-50%, -50%) rotate(420deg);
  transition: all 4s;
}
.ns-poda:focus-within > .ns-poda-white::before {
  transform: translate(-50%, -50%) rotate(443deg);
  transition: all 4s;
}
.ns-poda:focus-within > .ns-poda-border::before {
  transform: translate(-50%, -50%) rotate(430deg);
  transition: all 4s;
}

.ns-poda-filter-icon {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
  height: 40px;
  width: 38px;
  isolation: isolate;
  overflow: hidden;
  border-radius: 10px;
  background: linear-gradient(180deg, #161329, #000000, #1d1b4b);
  border: 1px solid transparent;
  cursor: pointer;
  transition: filter 0.2s ease;
}

.ns-poda-filter-icon:hover {
  filter: brightness(1.22);
}

.ns-poda-filter-border {
  height: 42px;
  width: 40px;
  position: absolute;
  overflow: hidden;
  top: 50%;
  right: 7px;
  transform: translateY(-50%);
  border-radius: 10px;
  pointer-events: none;
}

.ns-poda-filter-border::before {
  content: '';
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(90deg);
  position: absolute;
  width: 600px;
  height: 600px;
  background-repeat: no-repeat;
  background-position: 0 0;
  filter: brightness(1.35);
  background-image: conic-gradient(
    rgba(0, 0, 0, 0),
    #3d3a4f,
    rgba(0, 0, 0, 0) 50%,
    rgba(0, 0, 0, 0) 50%,
    #3d3a4f,
    rgba(0, 0, 0, 0) 100%
  );
  animation: ns-poda-rotate 4s linear infinite;
}

.ns-poda-search-icon {
  position: absolute;
  left: 17px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

@keyframes ns-poda-rotate {
  100% {
    transform: translate(-50%, -50%) rotate(450deg);
  }
}
</style>
