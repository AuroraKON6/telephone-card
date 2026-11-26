<script setup lang="ts">
/* Full-bleed 纯黑 #000000 Hero Band（严格遵循 Revolut hero-band-dark）
 * 主标题：500 字重紧行距 Display XXL
 * 主 CTA：纯白胶囊黑字（暗幕上最亮的交互锚点）
 * 右侧：无外框硬件级产品展示舞台（可点击切换 4 款实体 SIM 卡面 + 9:19.5 手机资费实时仪）
 */
import { computed, ref, watch } from 'vue';
import { ArrowRight, CheckCircle2, ShieldCheck, Signal, Wifi } from 'lucide-vue-next';
import { calcPricePerGb, useStorefront } from '@/composables/useStorefront';
import { fxEnabled, triggerSpark } from '@/composables/useSpark';
import SimCardVisual from './SimCardVisual.vue';
import MicroSlats from './fx/MicroSlats.vue';
import BorderBeam from './fx/BorderBeam.vue';
import ThinkingOrb from './fx/ThinkingOrb.vue';
import StaggeredText from './fx/StaggeredText.vue';

const { allPlans, featuredPlans, backendMode, openAdvisor, openDetail } = useStorefront();

const heroShowcasePlans = computed(() => featuredPlans.value);
const activeIdx = ref(1); // 默认聚焦钴紫主力卡
watch(heroShowcasePlans, (list) => {
  if (activeIdx.value >= list.length) {
    activeIdx.value = Math.max(0, list.length - 1);
  }
});
const activePlan = computed(
  () => heroShowcasePlans.value[activeIdx.value] ?? allPlans.value[0],
);

const minPricePerGb = computed(() => {
  const costs = allPlans.value.map((p) => calcPricePerGb(p)).filter((v) => v > 0);
  return costs.length > 0 ? Math.min(...costs).toFixed(2) : '—';
});
</script>

<template>
  <section
    id="top"
    class="relative w-full overflow-hidden bg-canvas-dark pb-12 pt-[72px] text-on-dark sm:pb-24 sm:pt-36 lg:pb-band lg:pt-40"
  >
    <!-- React Bits <MicroSlats /> WebGL2 流体微栅海浪底衬（随全局流光开关联动） -->
    <div
      v-if="fxEnabled"
      class="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <MicroSlats
        preset="swell"
        :auto-cycle="true"
        :cycle-interval="7.5"
        color="#A855F7"
        glint-color="#ffffff"
        background-color="#000000"
        :slat-width="10"
        :slat-height="25"
        :gap="3"
        :roundness="0.75"
        :interactive="true"
        :cursor-strength="1"
        :cursor-size="40"
        :swirl="0"
        :trail="1.4"
        :lean="0"
        :intro="true"
      />
      <!-- 左侧文字可读性柔暗护眼遮罩（保留右侧与四周通透涌浪） -->
      <div
        class="absolute inset-0"
        style="background: linear-gradient(95deg, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.42) 48%, rgba(0,0,0,0.12) 100%);"
      />
      <!-- 底边柔和衔接至纯黑 #000000 -->
      <div
        class="absolute inset-x-0 bottom-0 h-32"
        style="background: linear-gradient(to bottom, rgba(0,0,0,0), #000000);"
      />
    </div>

    <div class="relative z-10 mx-auto max-w-container px-4 sm:px-6">
      <div class="grid grid-cols-1 items-center gap-7 lg:grid-cols-12 lg:gap-10">
        <!-- 左侧叙事区（错峰电影感入场，手机端紧凑排布让首屏同步呈现 3D SIM 卡） -->
        <div class="lg:col-span-7">
          <div
            class="hero-stagger inline-flex items-center gap-2 rounded-full border border-hairline-dark bg-surface-elevated/90 px-3 py-1 text-[11.5px] font-semibold text-on-dark-mute sm:px-4 sm:py-1.5 sm:text-[13px]"
            style="--stagger-delay: 0ms"
          >
            <span class="signal-dot h-1.5 w-1.5 rounded-full bg-accent-teal sm:h-2 sm:w-2" aria-hidden="true" />
            <span>四大运营商正规直发 · 24 个月账单透明核验</span>
          </div>

          <StaggeredText
            as="h1"
            by="char"
            trigger="mount"
            :base-delay-ms="80"
            :stagger-ms="48"
            :duration-ms="720"
            :lines="[
              { text: '流量自由，' },
              { text: '资费零套路。', shimmer: true },
            ]"
            class="type-display-xxl mt-4 text-on-dark sm:mt-6"
          />

          <p
            class="hero-stagger mt-3.5 max-w-xl text-[13.5px] font-normal leading-[1.56] tracking-[0.005em] text-on-dark-mute sm:mt-6 sm:text-[18px] sm:leading-[1.62]"
            style="--stagger-delay: 160ms"
          >
            Skip the "¥1 first-month" fine print. Every plan lays out transparent 24-month billing from activation to renewal, verifies regional shipping availability in real time, and stores zero personal ID data.
          </p>

          <!-- 手机端双列并排胶囊按钮，桌面端经典主次组合 -->
          <div
            class="hero-stagger mt-5 grid grid-cols-2 gap-2.5 sm:mt-9 sm:flex sm:flex-wrap sm:items-center sm:gap-4"
            style="--stagger-delay: 240ms"
          >
            <a
              href="#catalog"
              class="btn-primary btn-shine group min-h-[44px] px-4 py-2.5 text-[14px] sm:min-h-[48px] sm:px-7 sm:py-3.5 sm:text-[16px]"
              @click="triggerSpark($event)"
            >
              <span>探索号卡</span>
              <ArrowRight class="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </a>
            <button
              type="button"
              class="btn-outline-dark btn-shine min-h-[44px] px-4 py-2.5 text-[14px] sm:min-h-[48px] sm:px-[27px] sm:py-[13px] sm:text-[16px]"
              @click="triggerSpark($event); openAdvisor()"
            >
              <ThinkingOrb :size="16" tone="cobalt" />
              <span class="sm:hidden">AI 选卡</span>
              <span class="hidden sm:inline">30 秒 AI 匹配套餐</span>
            </button>
          </div>

          <!-- 精简等宽核心指标带（纯 1px hairline-dark 分隔） -->
          <div
            class="hero-stagger mt-6 grid grid-cols-3 gap-3 border-t border-hairline-dark pt-4 sm:mt-12 sm:max-w-lg sm:gap-8 sm:pt-7"
            style="--stagger-delay: 320ms"
          >
            <div>
              <div class="hero-num text-[22px] text-white sm:text-[34px]">
                {{ allPlans.length }}<span class="text-on-dark-mute">{{ backendMode === 'live' ? '' : '+' }}</span>
              </div>
              <div class="mt-1 text-[11.5px] text-on-dark-mute sm:mt-1.5 sm:text-[13px]">
                {{ backendMode === 'live' ? '服务器在售' : '核验在售方案' }}
              </div>
            </div>
            <div>
              <div class="hero-num text-[22px] text-white sm:text-[34px]">
                ¥{{ minPricePerGb }}
              </div>
              <div class="mt-1 text-[11.5px] text-on-dark-mute sm:mt-1.5 sm:text-[13px]">最低单 G 折算</div>
            </div>
            <div>
              <div class="hero-num text-[22px] text-white sm:text-[34px]">
                0 <span class="text-[15px] font-medium sm:text-[20px]">条</span>
              </div>
              <div class="mt-1 text-[11.5px] text-on-dark-mute sm:mt-1.5 sm:text-[13px]">站内实名留存</div>
            </div>
          </div>
        </div>

        <!-- 右侧硬件级 Product Mockup 舞台（手机端紧凑展示，4 档单行切换） -->
        <div class="hero-stagger lg:col-span-5" style="--stagger-delay: 180ms">
          <div class="ns-frosted-card-dark relative p-3.5 sm:p-6">
            <BorderBeam color-from="#6d73ff" color-to="#00c495" :duration="6" radius-class="rounded-[20px]" />
            <!-- 实体 1.586:1 金属 SIM 卡模型（切换四档平滑翻换） -->
            <button
              type="button"
              class="block w-full text-left focus-visible:rounded-lg"
              @click="openDetail(activePlan.id)"
            >
              <Transition name="card-swap" mode="out-in">
                <SimCardVisual
                  :key="activePlan.id"
                  :material="activePlan.material"
                  :name="activePlan.name"
                  :carrier="activePlan.carrier"
                  :monthly-price="activePlan.monthlyPrice"
                  :general-data-gb="activePlan.generalDataGb"
                  :voice-minutes="activePlan.voiceMinutes"
                  :sku-code="activePlan.skuCode"
                />
              </Transition>
            </button>

            <!-- 配套 5G 实时信号与资费状态舱（surface-elevated 唯一暗阶梯） -->
            <div class="mt-4 rounded-lg bg-surface-elevated p-5">
              <div class="flex items-center justify-between text-xs text-on-dark-mute">
                <span class="inline-flex items-center gap-1.5 font-semibold text-white">
                  <Signal class="h-3.5 w-3.5 text-accent-teal" />
                  <span>{{ activePlan.networkSpeed }}</span>
                </span>
                <span class="inline-flex items-center gap-1 text-accent-teal tabular">
                  <Wifi class="h-3.5 w-3.5" />
                  <span>已核验</span>
                </span>
              </div>

              <!-- 流量配比条 -->
              <div class="mt-4">
                <div class="flex items-baseline justify-between text-xs">
                  <span class="text-on-dark-mute">通用 / 总流量结构</span>
                  <span class="font-semibold text-white tabular">
                    {{ activePlan.generalDataGb }}G 通用
                    <template v-if="activePlan.directionalDataGb > 0">
                      + {{ activePlan.directionalDataGb }}G 定向
                    </template>
                  </span>
                </div>
                <div class="mt-2 flex h-2 w-full overflow-hidden rounded-full bg-canvas-dark">
                  <div
                    class="h-full rounded-full bg-primary transition-all duration-300"
                    :style="{
                      width: `${Math.round(
                        (activePlan.generalDataGb /
                          Math.max(1, activePlan.generalDataGb + activePlan.directionalDataGb)) *
                          100,
                      )}%`,
                    }"
                  />
                  <div
                    v-if="activePlan.directionalDataGb > 0"
                    class="h-full bg-accent-teal transition-all duration-300"
                    :style="{
                      width: `${Math.round(
                        (activePlan.directionalDataGb /
                          Math.max(1, activePlan.generalDataGb + activePlan.directionalDataGb)) *
                          100,
                      )}%`,
                    }"
                  />
                </div>
              </div>

              <!-- 关键透明承诺 -->
              <div class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-hairline-dark pt-3.5 text-xs">
                <span class="inline-flex items-center gap-1.5 text-on-dark-mute">
                  <CheckCircle2 class="h-3.5 w-3.5 text-accent-light-green" />
                  <span>{{ activePlan.offerDuration }}</span>
                </span>
                <button
                  type="button"
                  class="font-bold text-white underline-offset-4 hover:underline"
                  @click="openDetail(activePlan.id)"
                >
                  查看账单时间轴 →
                </button>
              </div>
            </div>

            <!-- 底部 4 档实体卡面切换胶囊（手机单行 4 列精炼价格胶囊，桌面 4 列完整档位名） -->
            <div class="mt-3 grid grid-cols-4 gap-1.5 sm:mt-4 sm:gap-2">
              <button
                v-for="(plan, idx) in heroShowcasePlans"
                :key="plan.id"
                type="button"
                class="inline-flex min-h-[36px] items-center justify-center gap-1 rounded-full px-1.5 py-1.5 text-[12px] font-semibold transition-colors whitespace-nowrap sm:min-h-[38px] sm:px-2.5 sm:text-[13px]"
                :class="
                  idx === activeIdx
                    ? 'bg-canvas-light text-canvas-dark'
                    : 'bg-surface-elevated text-on-dark-mute hover:bg-[#222529] hover:text-on-dark'
                "
                @click="activeIdx = idx"
              >
                <span class="hidden sm:inline">{{ plan.featuredTier }}</span>
                <span class="tabular">¥{{ plan.monthlyPrice }}</span>
              </button>
            </div>
          </div>

          <!-- 底部信任小注（加轻薄黑底毛玻璃胶囊，确保在微栅波浪前依然清晰锐利） -->
          <div class="mt-4 flex justify-center lg:justify-start">
            <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/65 px-3.5 py-1.5 text-xs text-white/85 backdrop-blur-md">
              <ShieldCheck class="h-4 w-4 flex-shrink-0 text-accent-teal" />
              <span>所有办卡均跳转运营商官方授权页，本站不留存身份证及地址</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
