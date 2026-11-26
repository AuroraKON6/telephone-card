<script setup lang="ts">
/* 手机端专属原生 App 底部 Tab 导航栏（仅 < 768px 显示）
 * 彻底取代手机屏上互相争抢空间的 CompareDock / 提问浮钮 / 回顶圆钮，
 * 释放中间 82%+ 纯净阅读视口，单手拇指 1 秒直达「精选 / 选卡 / 账单 / 对比 / AI 选卡」。
 */
import { onMounted, onUnmounted, ref } from 'vue';
import { BarChart3, LayoutGrid, Scale, Sparkles } from 'lucide-vue-next';
import { useStorefront } from '@/composables/useStorefront';
import { triggerSpark } from '@/composables/useSpark';
import ThinkingOrb from './fx/ThinkingOrb.vue';

const { compareIds, isAdvisorOpen, openAdvisor } = useStorefront();

type TabId = 'top' | 'catalog' | 'showcase' | 'compare';
const activeTab = ref<TabId>('top');

function updateActiveTab() {
  const scrollPos = window.scrollY + window.innerHeight * 0.34;
  const sections: Array<{ id: TabId; selector: string }> = [
    { id: 'compare', selector: '#compare' },
    { id: 'showcase', selector: '#showcase' },
    { id: 'catalog', selector: '#catalog' },
    { id: 'top', selector: '#top' },
  ];
  for (const sec of sections) {
    const el = document.querySelector<HTMLElement>(sec.selector);
    if (el && scrollPos >= el.offsetTop) {
      activeTab.value = sec.id;
      return;
    }
  }
  activeTab.value = 'top';
}

function jumpTo(id: TabId) {
  activeTab.value = id;
  if (id === 'top') {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const el = document.querySelector<HTMLElement>(`#${id}`);
  if (el) {
    const top = Math.max(0, el.offsetTop - 56);
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

function handleOpenAi(e: MouseEvent) {
  triggerSpark(e, ['#6d73ff', '#00e5a8', '#ffffff']);
  openAdvisor();
}

onMounted(() => {
  updateActiveTab();
  window.addEventListener('scroll', updateActiveTab, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', updateActiveTab);
});
</script>

<template>
  <nav
    aria-label="移动端底部主导航"
    class="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/15 bg-[#090b10]/95 text-white backdrop-blur-xl md:hidden"
  >
    <div class="mx-auto grid h-[58px] max-w-md grid-cols-5 items-center px-1.5">
      <!-- 1. 精选 / 回顶 -->
      <button
        type="button"
        class="flex h-full flex-col items-center justify-center gap-0.5 rounded-xl transition-colors active:scale-95"
        :class="activeTab === 'top' && !isAdvisorOpen ? 'text-white' : 'text-white/55'"
        @click="jumpTo('top')"
      >
        <span
          class="flex h-7 w-11 items-center justify-center rounded-full transition-colors"
          :class="activeTab === 'top' && !isAdvisorOpen ? 'bg-white/15' : ''"
        >
          <Sparkles class="h-[18px] w-[18px]" />
        </span>
        <span class="text-[10.5px] font-semibold leading-none tracking-[0.02em]">精选</span>
      </button>

      <!-- 2. 选卡目录 -->
      <button
        type="button"
        class="flex h-full flex-col items-center justify-center gap-0.5 rounded-xl transition-colors active:scale-95"
        :class="activeTab === 'catalog' && !isAdvisorOpen ? 'text-white' : 'text-white/55'"
        @click="jumpTo('catalog')"
      >
        <span
          class="flex h-7 w-11 items-center justify-center rounded-full transition-colors"
          :class="activeTab === 'catalog' && !isAdvisorOpen ? 'bg-white/15' : ''"
        >
          <LayoutGrid class="h-[18px] w-[18px]" />
        </span>
        <span class="text-[10.5px] font-semibold leading-none tracking-[0.02em]">选卡</span>
      </button>

      <!-- 3. 24 期账单透视 -->
      <button
        type="button"
        class="flex h-full flex-col items-center justify-center gap-0.5 rounded-xl transition-colors active:scale-95"
        :class="activeTab === 'showcase' && !isAdvisorOpen ? 'text-white' : 'text-white/55'"
        @click="jumpTo('showcase')"
      >
        <span
          class="flex h-7 w-11 items-center justify-center rounded-full transition-colors"
          :class="activeTab === 'showcase' && !isAdvisorOpen ? 'bg-white/15' : ''"
        >
          <BarChart3 class="h-[18px] w-[18px]" />
        </span>
        <span class="text-[10.5px] font-semibold leading-none tracking-[0.02em]">账单</span>
      </button>

      <!-- 4. 双卡对比（集成已选角标，取代底部 CompareDock 遮挡） -->
      <button
        type="button"
        class="relative flex h-full flex-col items-center justify-center gap-0.5 rounded-xl transition-colors active:scale-95"
        :class="activeTab === 'compare' && !isAdvisorOpen ? 'text-white' : 'text-white/55'"
        @click="jumpTo('compare')"
      >
        <span
          class="relative flex h-7 w-11 items-center justify-center rounded-full transition-colors"
          :class="activeTab === 'compare' && !isAdvisorOpen ? 'bg-white/15' : ''"
        >
          <Scale class="h-[18px] w-[18px]" />
          <span
            v-if="compareIds.length > 0"
            class="absolute -right-0.5 -top-0.5 inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-white tabular"
          >
            {{ compareIds.length }}
          </span>
        </span>
        <span class="text-[10.5px] font-semibold leading-none tracking-[0.02em]">对比</span>
      </button>

      <!-- 5. AI 选卡顾问（发光星轨强调入口） -->
      <button
        type="button"
        class="flex h-full flex-col items-center justify-center gap-0.5 rounded-xl transition-colors active:scale-95"
        :class="isAdvisorOpen ? 'text-primary-bright' : 'text-white/85'"
        @click="handleOpenAi"
      >
        <span
          class="flex h-7 w-11 items-center justify-center rounded-full border border-primary/45 bg-primary/20"
        >
          <ThinkingOrb :size="17" :active="isAdvisorOpen" tone="cobalt" />
        </span>
        <span class="text-[10.5px] font-semibold leading-none tracking-[0.02em] text-white">AI 选卡</span>
      </button>
    </div>
  </nav>
</template>
