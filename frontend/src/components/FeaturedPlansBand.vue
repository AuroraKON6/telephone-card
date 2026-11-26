<script setup lang="ts">
/* Full-bleed 纯黑 #000000 4-Up 主推方案阶梯（严格对标 Revolut plan-card & plan-card-featured）
 * 规则：整组 4 张卡中仅 1 张使用钴紫反转 (#494fdf)，其余 3 张使用 surface-elevated (#16181a)
 * 严禁使用卡片 drop-shadow；支持「优惠期月租」与「24 个月折合月均」一键切换
 */
import { ref } from 'vue';
import { Check, Scale } from 'lucide-vue-next';
import {
  calc24MonthTotal,
  calcEffectiveMonthly,
  calcPricePerGb,
  useStorefront,
} from '@/composables/useStorefront';
import { fxEnabled, triggerSpark } from '@/composables/useSpark';
import AnimatedNumber from './AnimatedNumber.vue';
import BlurredRays from './fx/BlurredRays.vue';
import BorderBeam from './fx/BorderBeam.vue';
import StaggeredText from './fx/StaggeredText.vue';

const { featuredPlans, isCompared, toggleCompare, openDetail } = useStorefront();

const billingView = ref<'promo' | 'effective24'>('promo');
const carouselRef = ref<HTMLElement | null>(null);
const mobileSlideIdx = ref(0);

function onCarouselScroll() {
  const el = carouselRef.value;
  if (!el || el.clientWidth <= 0) return;
  const cardWidth = el.clientWidth * 0.82 + 14;
  mobileSlideIdx.value = Math.min(
    featuredPlans.value.length - 1,
    Math.max(0, Math.round(el.scrollLeft / Math.max(1, cardWidth))),
  );
}

function scrollToMobileSlide(idx: number) {
  const el = carouselRef.value;
  if (!el) return;
  const child = el.children[idx] as HTMLElement | undefined;
  if (child) {
    child.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
}

/** 鼠标跟随暗色聚光灯坐标更新（借鉴 inspira-ui SpotlightCard） */
function handleCardMove(e: PointerEvent) {
  if (!fxEnabled.value) return;
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
  el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  el.style.setProperty('--spot-opacity', '1');
}

function handleCardLeave(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;
  el.style.setProperty('--spot-opacity', '0');
}

function handleCompareClick(e: MouseEvent, id: string) {
  if (!isCompared(id)) triggerSpark(e);
  toggleCompare(id);
}
</script>

<template>
  <section
    id="featured"
    class="relative w-full overflow-hidden border-t border-divider-soft bg-canvas-dark py-12 text-on-dark sm:py-section lg:py-band"
  >
    <!-- 柔焦竖向光谱光束全出血背景（Blurred Rays，联动全局流光开关） -->
    <div class="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <BlurredRays
        :ray-count="26"
        :ray-spacing="1.05"
        :ray-thickness="1.0"
        :depth="1.0"
        :speed="0.72"
        :flicker-rate="0.95"
        :bloom="0.72"
        :brightness="0.96"
        :vignette-top="0.16"
        :vignette-bottom="0.28"
        :vignette-left="0.1"
        :vignette-right="0.1"
      />
      <!-- 轻柔深色可读性暗纱，确保白色大字与四档资费数字保持高对比度 -->
      <div
        class="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/45"
      />
    </div>

    <div class="relative z-10 mx-auto max-w-container px-4 sm:px-6">
      <!-- 章节头：超大 500 字重标题 + 视角切换胶囊 -->
      <div v-reveal class="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div class="max-w-2xl">
          <p class="ns-kicker text-on-dark-mute">
            CORE PLANS · 四档核心主力方案
          </p>
          <StaggeredText
            as="h2"
            by="char"
            trigger="inview"
            :stagger-ms="34"
            text="选一套契合你节奏的方案"
            class="type-display-xl mt-3 text-on-dark"
          />
          <p class="mt-3 text-[13.5px] leading-[1.56] tracking-[0.005em] text-on-dark-mute sm:mt-4 sm:text-[18px] sm:leading-[1.6]">
            From ¥19 everyday essentials to gigabit 5G-A business travel. Toggle the 24-month true average to see every plan's real long-term cost at a glance.
          </p>
        </div>

        <!-- Revolut sub-nav-pill 滑动切换器（手机全宽双列，桌面紧凑自适应） -->
        <div class="relative grid w-full grid-cols-2 rounded-full border border-white/10 bg-[#121418]/85 p-1 backdrop-blur-md md:inline-grid md:w-auto">
          <span
            class="pointer-events-none absolute bottom-1 top-1 left-1 w-[calc(50%-4px)] rounded-full bg-canvas-light transition-transform duration-300"
            style="transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);"
            :style="{ transform: billingView === 'effective24' ? 'translateX(100%)' : 'translateX(0)' }"
            aria-hidden="true"
          />
          <button
            type="button"
            class="relative z-10 rounded-full px-4 py-2 text-[14px] font-semibold whitespace-nowrap transition-colors duration-200"
            :class="billingView === 'promo' ? 'text-canvas-dark' : 'text-on-dark-mute hover:text-white'"
            @click="billingView = 'promo'"
          >
            优惠期月租
          </button>
          <button
            type="button"
            class="relative z-10 rounded-full px-4 py-2 text-[14px] font-semibold whitespace-nowrap transition-colors duration-200"
            :class="billingView === 'effective24' ? 'text-canvas-dark' : 'text-on-dark-mute hover:text-white'"
            @click="billingView = 'effective24'"
          >
            24 个月真实月均
          </button>
        </div>
      </div>

      <!-- 手机端横向磁吸滑动卡组（告别 3350px 竖向长龙） / 桌面端 4-Up 网格 -->
      <div
        ref="carouselRef"
        class="no-scrollbar -mx-4 mt-7 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 md:mx-0 md:mt-12 md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4"
        @scroll.passive="onCarouselScroll"
      >
        <div
          v-for="(plan, idx) in featuredPlans"
          :key="plan.id"
          v-reveal="idx * 70"
          class="flex w-[82vw] max-w-[318px] flex-shrink-0 snap-center md:w-auto md:max-w-none md:flex-shrink"
        >
          <article
            class="ns-steveblox-card flex w-full flex-col justify-between p-5 md:p-8"
            :class="
              plan.isFeaturedHighlight
                ? 'ns-frosted-card-featured ns-steveblox-card--featured text-white'
                : 'ns-frosted-card-dark ns-steveblox-card--dark spotlight-dark text-on-dark'
            "
            @pointermove="!plan.isFeaturedHighlight && handleCardMove($event)"
            @pointerleave="!plan.isFeaturedHighlight && handleCardLeave($event)"
            @click="openDetail(plan.id)"
          >
            <!-- 整屏唯一钴紫主推卡搭载纯白×青绿巡航流光边框 -->
            <BorderBeam
              v-if="plan.isFeaturedHighlight"
              color-from="#ffffff"
              color-to="#6ef3d1"
              :duration="4.6"
              :border-width="2"
              radius-class="rounded-[20px]"
            />
          <div class="relative z-10">
            <!-- 顶部层级与主推徽章 -->
            <div class="flex items-center justify-between gap-2">
              <span
                class="font-display text-[20px] font-semibold tracking-[-0.02em]"
                :class="plan.isFeaturedHighlight ? 'text-white' : 'text-on-dark'"
              >
                {{ plan.featuredTier }}
              </span>
              <span
                v-if="plan.isFeaturedHighlight"
                class="rounded-full bg-canvas-light px-3 py-1 text-[12px] font-semibold text-canvas-dark"
              >
                最受欢迎
              </span>
              <span
                v-else
                class="rounded-full bg-canvas-dark px-3 py-1 text-[12px] font-semibold text-on-dark-mute"
              >
                {{ plan.carrier.replace('中国', '') }}
              </span>
            </div>

            <!-- 套餐标题与定位 -->
            <h3 class="mt-4 font-display text-[23px] font-semibold leading-[1.28] tracking-[-0.015em] text-white">
              {{ plan.name }}
            </h3>
            <p
              class="mt-2 min-h-[44px] text-[14px] leading-[1.52]"
              :class="plan.isFeaturedHighlight ? 'text-white/85' : 'text-on-dark-mute'"
            >
              {{ plan.tagline }}
            </p>

            <!-- 大号等宽月租（思源宋体 700 巨型数字原语 + 齐线折算单价） -->
            <div
              class="mt-6 border-y py-5"
              :class="plan.isFeaturedHighlight ? 'border-white/20' : 'border-hairline-dark'"
            >
              <div class="flex items-baseline gap-1">
                <span class="font-display text-lg font-medium">¥</span>
                <span class="hero-num text-[50px]">
                  <AnimatedNumber
                    :value="billingView === 'promo' ? plan.monthlyPrice : calcEffectiveMonthly(plan)"
                    :decimals="billingView === 'promo' ? 0 : 1"
                  />
                </span>
                <span
                  class="text-[14px]"
                  :class="plan.isFeaturedHighlight ? 'text-white/80' : 'text-on-dark-mute'"
                >
                  / 月
                </span>
              </div>
              <div
                class="ns-data-mono mt-2.5 flex items-center justify-between text-[12px]"
                :class="plan.isFeaturedHighlight ? 'text-white/80' : 'text-on-dark-mute'"
              >
                <span>
                  {{
                    billingView === 'promo'
                      ? `2年总计 ¥${calc24MonthTotal(plan)}`
                      : `优惠期 ¥${plan.monthlyPrice}/月`
                  }}
                </span>
                <span>≈ ¥{{ calcPricePerGb(plan) }}/GB</span>
              </div>
            </div>

            <!-- 核心参数数字摘要 -->
            <div class="mt-5 grid grid-cols-2 gap-3 text-left">
              <div
                class="rounded-md p-3"
                :class="plan.isFeaturedHighlight ? 'bg-black/20' : 'bg-canvas-dark/60'"
              >
                <div class="text-[12px]" :class="plan.isFeaturedHighlight ? 'text-white/75' : 'text-on-dark-mute'">
                  通用流量
                </div>
                <div class="hero-num mt-1 text-[21px] text-white">
                  <template v-if="plan.generalDataGb < 0">不限量</template>
                  <template v-else>{{ plan.generalDataGb }}<span class="ml-0.5 text-[14px] font-medium text-white/80">GB</span></template>
                </div>
              </div>
              <div
                class="rounded-md p-3"
                :class="plan.isFeaturedHighlight ? 'bg-black/20' : 'bg-canvas-dark/60'"
              >
                <div class="text-[12px]" :class="plan.isFeaturedHighlight ? 'text-white/75' : 'text-on-dark-mute'">
                  语音通话
                </div>
                <div class="hero-num mt-1 text-[21px] text-white">
                  {{ plan.voiceMinutes > 0 ? plan.voiceMinutes : '0.1' }}<span class="ml-0.5 text-[14px] font-medium text-white/80">{{ plan.voiceMinutes > 0 ? '分' : '元/分' }}</span>
                </div>
              </div>
            </div>

            <!-- 卖点清单 -->
            <ul class="mt-6 space-y-2.5 text-[14px] leading-[1.45]">
              <li
                v-for="item in plan.highlights"
                :key="item"
                class="flex items-start gap-2"
                :class="plan.isFeaturedHighlight ? 'text-white' : 'text-on-dark-mute'"
              >
                <Check
                  class="mt-0.5 h-4 w-4 flex-shrink-0"
                  :class="plan.isFeaturedHighlight ? 'text-white' : 'text-accent-teal'"
                />
                <span>{{ item }}</span>
              </li>
              <li
                class="flex items-start gap-2"
                :class="plan.isFeaturedHighlight ? 'text-white/90' : 'text-on-dark-mute'"
              >
                <Check
                  class="mt-0.5 h-4 w-4 flex-shrink-0"
                  :class="plan.isFeaturedHighlight ? 'text-white' : 'text-accent-teal'"
                />
                <span>
                  {{
                    plan.contractMonths < 0
                      ? '合约期以详情核验为准'
                      : plan.contractMonths === 0
                        ? '无合约期 · 随时线上销户'
                        : `合约期 ${plan.contractMonths} 个月`
                  }}
                </span>
              </li>
            </ul>
          </div>

          <!-- 底部操作区：纯白主胶囊（带高光扫掠） + 轻量对比按钮（带微光火花） -->
          <div class="relative z-10 mt-8 flex flex-col gap-2.5">
            <button
              type="button"
              class="btn-primary btn-shine w-full"
              @click.stop="openDetail(plan.id)"
            >
              查看完整资费
            </button>
            <button
              type="button"
              class="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full border text-[14px] font-semibold transition-colors active:scale-[0.97]"
              :class="
                isCompared(plan.id)
                  ? 'border-white bg-white/15 text-white'
                  : plan.isFeaturedHighlight
                    ? 'border-white/35 text-white hover:bg-white/10'
                    : 'border-hairline-dark text-on-dark-mute hover:border-white/40 hover:text-white'
              "
              @click.stop="handleCompareClick($event, plan.id)"
            >
              <Scale class="h-4 w-4" />
              <span>{{ isCompared(plan.id) ? '已加入对比' : '加入参数对比' }}</span>
            </button>
          </div>
        </article>
        </div>
      </div>

      <!-- 手机端横向轮播分页指示点与滑动提示 -->
      <div class="mt-4 flex items-center justify-between md:hidden">
        <span class="text-[11.5px] text-white/50">← 左右滑动切换 4 档主力卡 →</span>
        <div class="flex items-center gap-1.5">
          <button
            v-for="(plan, idx) in featuredPlans"
            :key="`dot-${plan.id}`"
            type="button"
            class="h-1.5 rounded-full transition-all duration-200"
            :class="idx === mobileSlideIdx ? 'w-5 bg-white' : 'w-1.5 bg-white/30'"
            :aria-label="`切换到第 ${idx + 1} 张方案`"
            @click="scrollToMobileSlide(idx)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/*
 * From Uiverse.io by SteveBloX - https://uiverse.io/SteveBloX/dangerous-warthog-85
 * MIT License, Copyright (c) SteveBloX (SteveBloX)
 *
 * 已做作用域命名空间隔离并适配四档方案暗色玻璃质感，完整保留 17px 圆角、6px 磨砂、
 * 12px 17px 51px 投影、0.5s 过渡、悬停放大 scale(1.05) + 锐利 1px 描边及按压 scale(0.95) rotateZ(1.7deg) 交互。
 */
.ns-steveblox-card {
  box-sizing: border-box;
  cursor: pointer;
  transition: all 0.5s;
  user-select: none;
  position: relative;
  z-index: 1;
}

@media (hover: hover) and (pointer: fine) {
  .ns-steveblox-card:hover {
    border: 1px solid #ffffff;
    transform: scale(1.05);
    z-index: 20;
    box-shadow:
      inset 0px 56px 40px rgba(0, 0, 0, 0.36),
      inset 0px -56px 40px rgba(223, 225, 235, 0.18),
      14px 20px 56px rgba(0, 0, 0, 0.5);
  }

  .ns-steveblox-card--dark:hover {
    background: rgba(223, 225, 235, 0.14);
  }

  .ns-steveblox-card--featured:hover {
    background: rgba(84, 91, 240, 0.86);
  }
}

.ns-steveblox-card:active {
  transform: scale(0.97);
}
</style>
