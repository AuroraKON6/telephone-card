<script setup lang="ts">
/* Full-bleed 纯黑 #000000 硬件卡面 + 24 个月真实账单透视仪（Revolut Product Mockup Storytelling Band）
 * 深度仅靠 #000000 -> #16181a 表面明度阶梯与卡面自身视觉建立
 */
import { computed, ref, watch } from 'vue';
import { ArrowRight, Info } from 'lucide-vue-next';
import {
  calc24MonthTotal,
  calcEffectiveMonthly,
  useStorefront,
} from '@/composables/useStorefront';
import { fxEnabled, triggerSpark } from '@/composables/useSpark';
import SimCardVisual from './SimCardVisual.vue';
import AnimatedNumber from './AnimatedNumber.vue';
import BillingStatsRuler from './BillingStatsRuler.vue';
import BorderBeam from './fx/BorderBeam.vue';
import DottedWaves from './fx/DottedWaves.vue';
import GlitchText from './fx/GlitchText.vue';

const { allPlans, featuredPlans, openDetail, openApply } = useStorefront();

const showcaseList = computed(() => {
  const list = featuredPlans.value.length > 0 ? featuredPlans.value : allPlans.value.slice(0, 4);
  return list.slice(0, 4);
});

const selectedId = ref(showcaseList.value[0]?.id ?? '');
watch(
  showcaseList,
  (list) => {
    if (list.length > 0 && !list.some((p) => p.id === selectedId.value)) {
      selectedId.value = list[0].id;
    }
  },
  { immediate: true },
);
const currentPlan = computed(
  () => showcaseList.value.find((p) => p.id === selectedId.value) ?? showcaseList.value[0],
);

/** 根据当前选中的展示卡面材质自动切换背后 3D 点阵波浪配色（350ms 平滑融合） */
const wavePalette = computed(() => {
  switch (currentPlan.value?.material) {
    case 'emerald':
      return { color: '#00a87e', crest: '#a7f3d0' };
    case 'metal':
      return { color: '#d97706', crest: '#fef3c7' };
    case 'crimson':
      return { color: '#a855f7', crest: '#f3e8ff' };
    default:
      return { color: '#5860ff', crest: '#e0e7ff' };
  }
});
</script>

<template>
  <section
    id="showcase"
    class="relative w-full overflow-hidden bg-canvas-dark py-12 text-on-dark sm:py-section lg:py-band"
  >
    <!-- 3D 翻涌点阵波浪背景（DottedWaves，随选卡平滑换色，视口外自动休眠） -->
    <div
      v-if="fxEnabled"
      class="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <DottedWaves
        :color="wavePalette.color"
        :crest-color="wavePalette.crest"
        :speed="0.88"
        :amplitude="0.68"
        :dot-size="5.4"
        :intensity="0.92"
      />
      <!-- 顶部与底部柔和衔接至纯黑 #000000，确保与相邻纯白/纯黑章节干脆收边 -->
      <div
        class="absolute inset-x-0 top-0 h-28"
        style="background: linear-gradient(to bottom, #000000 0%, rgba(0,0,0,0) 100%);"
      />
      <div
        class="absolute inset-x-0 bottom-0 h-28"
        style="background: linear-gradient(to top, #000000 0%, rgba(0,0,0,0) 100%);"
      />
    </div>

    <div class="relative z-10 mx-auto max-w-container px-4 sm:px-6">
      <div v-reveal class="max-w-3xl">
        <p class="ns-kicker text-on-dark-mute">
          BILLING X-RAY · 24 个月资费透视仪
        </p>
        <GlitchText
          as="h2"
          :lines="['把晦涩条款，', '翻译成 24 期明账']"
          accent-a="#00f0b5"
          accent-b="#f43f5e"
          :radius="145"
          class="type-display-xl mt-3 text-on-dark"
        />
        <p class="mt-3 text-[13.5px] leading-[1.56] tracking-[0.005em] text-on-dark-mute sm:mt-4 sm:text-[18px] sm:leading-[1.6]">
          Select any tier below and scrub the 24-month ruler to inspect monthly bills, first-recharge rebates, and post-promo renewal pricing.
        </p>
      </div>

      <!-- 切换胶囊行（手机端紧凑单行滑动，支持轻触直切） -->
      <div v-reveal="80" class="no-scrollbar -mx-4 mt-6 flex items-center gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:mt-8 sm:gap-2.5 sm:px-0">
        <button
          v-for="plan in showcaseList"
          :key="plan.id"
          type="button"
          class="!min-h-[38px] !px-3.5 !py-1.5 !text-[12.5px] sm:!text-[14px]"
          :class="plan.id === currentPlan.id ? 'sub-nav-pill-active' : 'sub-nav-pill'"
          @click="selectedId = plan.id"
        >
          <span>{{ plan.name.split('·')[0].trim() }}</span>
          <span class="tabular">¥{{ plan.monthlyPrice }}</span>
        </button>
      </div>

      <!-- 双栏硬件与账单透视舞台（手机端紧凑内边距，卡面与标尺上下利落衔接） -->
      <div class="mt-5 grid grid-cols-1 items-stretch gap-4 sm:mt-8 sm:gap-6 lg:grid-cols-12">
        <!-- 左侧实体 SIM 金属卡大舞台 -->
        <div
          v-reveal="120"
          class="ns-frosted-card-dark relative flex flex-col justify-between p-4 sm:p-8 lg:col-span-5"
        >
          <BorderBeam color-from="#6d73ff" color-to="#00c495" :duration="7" radius-class="rounded-[20px]" />
          <div class="relative z-10">
            <Transition name="card-swap" mode="out-in">
              <SimCardVisual
                :key="currentPlan.id"
                :material="currentPlan.material"
                :name="currentPlan.name"
                :carrier="currentPlan.carrier"
                :monthly-price="currentPlan.monthlyPrice"
                :general-data-gb="currentPlan.generalDataGb"
                :voice-minutes="currentPlan.voiceMinutes"
                :sku-code="currentPlan.skuCode"
              />
            </Transition>

            <div class="mt-6 grid grid-cols-2 gap-3">
              <div class="rounded-md bg-canvas-dark p-4">
                <div class="text-[12px] text-on-dark-mute">24 个月累计实付</div>
                <div class="hero-num mt-1.5 text-[30px] text-white">
                  ¥<AnimatedNumber :value="calc24MonthTotal(currentPlan)" />
                </div>
              </div>
              <div class="rounded-md bg-canvas-dark p-4">
                <div class="text-[12px] text-on-dark-mute">折合每月均价</div>
                <div class="hero-num mt-1.5 text-[30px] text-white">
                  ¥<AnimatedNumber :value="calcEffectiveMonthly(currentPlan)" :decimals="1" />
                </div>
              </div>
            </div>

            <div class="mt-5 flex items-start gap-2.5 rounded-md border border-hairline-dark bg-surface-deep p-4 text-[13px] leading-[1.5] text-on-dark-mute">
              <Info class="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-bright" />
              <div>
                <span v-if="currentPlan.firstRechargeAmount > 0" class="font-semibold text-white">
                  首充门槛：¥{{ currentPlan.firstRechargeAmount }}。
                </span>
                <span v-else class="font-semibold text-white">首充说明：</span>
                {{ currentPlan.firstRechargeNote }}
              </div>
            </div>
          </div>

          <div class="relative z-10 mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              class="btn-primary btn-shine flex-1"
              @click="triggerSpark($event); openApply(currentPlan.id)"
            >
              <span>前往官方办理</span>
              <ArrowRight class="h-4 w-4" />
            </button>
            <button type="button" class="btn-outline-dark" @click="openDetail(currentPlan.id)">
              完整参数
            </button>
          </div>
        </div>

        <!-- 右侧 Stats 21 风格：3 组大号增长数字 + 24 期月度柱状图 + 可拖拽精密时间标尺 -->
        <div
          v-reveal="180"
          class="ns-frosted-card-dark flex flex-col justify-between p-4 sm:p-8 lg:col-span-7"
        >
          <BillingStatsRuler :plan="currentPlan" />
        </div>
      </div>
    </div>
  </section>
</template>
