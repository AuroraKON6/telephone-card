<script setup lang="ts">
/* 底部悬浮纯黑对比胶囊条：不遮挡阅读、随时唤起对比或清空 */
import { ArrowRight, Scale, X } from 'lucide-vue-next';
import { useStorefront } from '@/composables/useStorefront';

const { comparePlans, toggleCompare, clearCompare } = useStorefront();

function scrollToCompare() {
  const el = document.querySelector('#compare');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-200 ease-out"
    enter-from-class="translate-y-6 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-150 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-6 opacity-0"
  >
    <div
      v-if="comparePlans.length > 0"
      class="fixed bottom-4 left-1/2 z-30 w-[calc(100%-24px)] max-w-3xl -translate-x-1/2 rounded-full border border-hairline-dark bg-canvas-dark px-3 py-2.5 text-on-dark sm:bottom-6 sm:px-5"
      role="region"
      aria-label="已选对比号卡"
    >
      <div class="flex items-center justify-between gap-3">
        <!-- 移动端窄屏精简摘要（零截断） -->
        <div class="flex min-w-0 items-center gap-2 pl-2 sm:hidden">
          <Scale class="h-4 w-4 flex-shrink-0 text-primary-bright" />
          <span class="truncate text-[13px] font-semibold text-white tabular">
            已选 {{ comparePlans.length }}/3 张号卡对比
          </span>
        </div>

        <!-- 平板及桌面端完整芯片列表 -->
        <div class="hidden min-w-0 items-center gap-2 overflow-x-auto no-scrollbar sm:flex">
          <span class="inline-flex items-center gap-1.5 whitespace-nowrap pl-1 text-[13px] font-semibold text-on-dark-mute">
            <Scale class="h-4 w-4 text-primary-bright" />
            <span class="tabular">已选 {{ comparePlans.length }}/3</span>
          </span>

          <span
            v-for="plan in comparePlans"
            :key="plan.id"
            class="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full bg-surface-elevated py-1 pl-3 pr-2 text-[12px] font-semibold text-white"
          >
            <span class="max-w-[120px] truncate">{{ plan.name.split(' · ')[0] }}</span>
            <span class="text-on-dark-mute tabular">¥{{ plan.monthlyPrice }}</span>
            <button
              type="button"
              class="inline-flex h-4 w-4 items-center justify-center rounded-full text-on-dark-mute hover:bg-white/15 hover:text-white"
              :aria-label="`移出 ${plan.name}`"
              @click="toggleCompare(plan.id)"
            >
              <X class="h-3 w-3" />
            </button>
          </span>
        </div>

        <div class="flex flex-shrink-0 items-center gap-2">
          <button
            type="button"
            class="px-2 text-[13px] font-semibold text-on-dark-mute hover:text-white"
            @click="clearCompare"
          >
            清空
          </button>
          <button
            type="button"
            class="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full bg-canvas-light px-4 text-[13px] font-semibold text-canvas-dark transition-colors hover:bg-[#ececef]"
            @click="scrollToCompare"
          >
            <span>立即对比</span>
            <ArrowRight class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
