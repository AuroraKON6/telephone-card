<script setup lang="ts">
/*
 * From Uiverse.io by vinodjangid07 - https://uiverse.io/vinodjangid07/afraid-falcon-17
 * MIT License, Copyright (c) vinodjangid07 (Vinod Jangid)
 *
 * 已适配为 Vue 3 独立组件，并对类名进行命名空间隔离，完整保留原始造型、紫晕外圈与悬停展开动画。
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { triggerSpark } from '@/composables/useSpark';

const props = withDefaults(
  defineProps<{
    /** 悬停展开后显示的文案 */
    label?: string;
    /** 向下滚动超过多少像素后浮现 */
    threshold?: number;
  }>(),
  {
    label: '回到首页',
    threshold: 260,
  },
);

const isVisible = ref(false);

function handleScroll() {
  isVisible.value = window.scrollY > props.threshold;
}

function scrollToTop(e: MouseEvent) {
  triggerSpark(e, ['#b5a0ff', '#494fdf', '#ffffff']);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(() => {
  handleScroll();
  window.addEventListener('scroll', handleScroll, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-3 scale-90 opacity-0"
    enter-to-class="translate-y-0 scale-100 opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="translate-y-0 scale-100 opacity-100"
    leave-to-class="translate-y-3 scale-90 opacity-0"
  >
    <div
      v-if="isVisible"
      class="fixed bottom-6 right-6 z-40 hidden md:block"
    >
      <button
        type="button"
        class="ns-back-top-btn"
        :data-label="label"
        :aria-label="label"
        :title="label"
        @click="scrollToTop"
      >
        <svg class="ns-back-top-icon" viewBox="0 0 384 512" aria-hidden="true">
          <path
            d="M214.6 41.4c-12.5-12.5-32.8-12.5-45.3 0l-160 160c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L160 141.2V448c0 17.7 14.3 32 32 32s32-14.3 32-32V141.2L329.4 246.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3l-160-160z"
          />
        </svg>
      </button>
    </div>
  </Transition>
</template>

<style scoped>
/*
 * From Uiverse.io by vinodjangid07 - https://uiverse.io/vinodjangid07/afraid-falcon-17
 * MIT License, Copyright (c) vinodjangid07 (Vinod Jangid)
 */
.ns-back-top-btn {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: rgb(20, 20, 20);
  border: none;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0px 0px 0px 4px rgba(180, 160, 255, 0.253);
  cursor: pointer;
  transition-duration: 0.3s;
  overflow: hidden;
  position: relative;
}

.ns-back-top-icon {
  width: 12px;
  transition-duration: 0.3s;
}

.ns-back-top-icon path {
  fill: white;
}

.ns-back-top-btn:hover {
  width: 140px;
  border-radius: 50px;
  transition-duration: 0.3s;
  background-color: rgb(181, 160, 255);
  align-items: center;
}

.ns-back-top-btn:hover .ns-back-top-icon {
  transition-duration: 0.3s;
  transform: translateY(-200%);
}

.ns-back-top-btn::before {
  position: absolute;
  bottom: -20px;
  content: attr(data-label);
  color: white;
  font-size: 0px;
  white-space: nowrap;
}

.ns-back-top-btn:hover::before {
  font-size: 13px;
  opacity: 1;
  bottom: unset;
  transition-duration: 0.3s;
}
</style>
