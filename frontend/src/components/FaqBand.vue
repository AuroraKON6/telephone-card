<script setup lang="ts">
/* Full-bleed 纯白 #ffffff FAQ 折叠行 + Revolut download-tile 风格快捷服务入口 */
import { ref } from 'vue';
import { ChevronDown, ChevronRight, FileText, SearchCheck, ShieldAlert } from 'lucide-vue-next';
import { FAQ_ITEMS, GUIDE_TILES } from '@/data/plans';
import { useStorefront } from '@/composables/useStorefront';
import { fxEnabled } from '@/composables/useSpark';
import StippleGradient from './fx/StippleGradient.vue';

const { openGuide } = useStorefront();
const openFaqId = ref<string>(FAQ_ITEMS[0]?.id ?? '');

function toggleFaq(id: string) {
  openFaqId.value = openFaqId.value === id ? '' : id;
}

const tileIcons = [SearchCheck, FileText, ShieldAlert];
</script>

<template>
  <section
    id="faq"
    class="relative w-full overflow-hidden border-t border-hairline-light bg-canvas-light py-12 text-ink sm:py-section lg:py-band"
  >
    <!-- 蓝噪声点彩慢折渐变背景（StippleGradient，随全局流光开关联动） -->
    <div
      v-if="fxEnabled"
      class="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <StippleGradient
        background-color="#ffffff"
        color-a="#494fdf"
        color-b="#9333ea"
        color-c="#00a87e"
        :speed="0.28"
        :dot-scale="2.2"
        :strength="0.58"
      />
    </div>

    <div class="relative z-10 mx-auto max-w-container px-4 sm:px-6">
      <div class="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <!-- 左侧导语与快捷工具块（柔和半透明卡片透出蓝噪声点彩纸感） -->
        <div v-reveal class="lg:col-span-5">
          <p class="ns-kicker text-mute">
            FAQ &amp; SERVICE · 常见问题与查单指引
          </p>
          <h2 class="type-display-lg mt-3 text-ink">
            办卡前最常确认的 6 个关键问题
          </h2>
          <p class="mt-4 text-[15.5px] leading-[1.62] text-mute sm:text-[16px]">
            Everything worth confirming before you order — first-recharge rules, regional shipping checks, contract freedom, and zero-PII privacy.
          </p>

          <div class="mt-8 space-y-3">
            <button
              v-for="(tile, idx) in GUIDE_TILES"
              :key="tile.id"
              type="button"
              class="card-lift ns-frosted-card-light flex min-h-[72px] w-full items-center justify-between gap-4 px-5 py-4 text-left"
              @click="openGuide(tile.id)"
            >
              <div class="flex items-center gap-3.5 min-w-0">
                <span class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-sm border border-hairline-light bg-surface-soft text-ink">
                  <component :is="tileIcons[idx]" class="h-5 w-5" />
                </span>
                <div class="min-w-0">
                  <div class="text-[15px] font-semibold text-ink">{{ tile.title }}</div>
                  <div class="mt-0.5 truncate text-[13px] text-mute">{{ tile.subtitle }}</div>
                </div>
              </div>
              <ChevronRight class="h-5 w-5 flex-shrink-0 text-stone" />
            </button>
          </div>
        </div>

        <!-- 右侧 1px hairline-light 丝滑高度展开手风琴列表 -->
        <div
          v-reveal="100"
          class="ns-frosted-card-light px-4 sm:px-6 lg:col-span-7"
        >
          <div class="divide-y divide-hairline-light">
            <div v-for="item in FAQ_ITEMS" :key="item.id">
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 py-4 text-left sm:gap-4 sm:py-6"
                :aria-expanded="openFaqId === item.id"
                @click="toggleFaq(item.id)"
              >
                <div>
                  <span class="text-[11.5px] font-semibold text-primary sm:text-[12px]">{{ item.category }}</span>
                  <div class="mt-0.5 font-display text-[16.5px] font-medium leading-[1.35] text-ink sm:mt-1 sm:text-[20px]">
                    {{ item.question }}
                  </div>
                </div>
                <ChevronDown
                  class="h-5 w-5 flex-shrink-0 text-charcoal transition-transform duration-300"
                  :class="openFaqId === item.id ? 'rotate-180 text-primary' : ''"
                />
              </button>
              <div class="accordion-content" :class="{ 'is-open': openFaqId === item.id }">
                <div class="accordion-inner">
                  <div class="pb-6 pr-4 text-[15px] leading-[1.65] text-body">
                    {{ item.answer }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
