<script setup lang="ts">
/* Full-bleed 纯黑 #000000 全局页脚（搭载 GlimmerWrap 飘散微光闪烁背景 + Revolut 收口 CTA） */
import { ArrowRight, Sparkles } from 'lucide-vue-next';
import { useStorefront } from '@/composables/useStorefront';
import GlimmerWrap from './fx/GlimmerWrap.vue';
import SocialShareTooltips from './SocialShareTooltips.vue';

const { openAdvisor, openGuide, triggerSlowNetworkCheck } = useStorefront();
</script>

<template>
  <GlimmerWrap
    as="footer"
    :density="1.08"
    :speed="0.95"
    glint-color="#ffffff"
    accent-color="#7b82ff"
    secondary-accent="#4ade80"
    class="w-full bg-canvas-dark text-on-dark-mute"
  >
    <!-- 收尾强力黑幕 CTA 带（Revolut 经典收束：大标题 + 白胶囊） -->
    <div class="border-b border-divider-soft py-16 sm:py-20">
      <div class="mx-auto flex max-w-container flex-col justify-between gap-8 px-4 sm:px-6 lg:flex-row lg:items-end">
        <div class="max-w-2xl">
          <h2 class="type-display-lg text-on-dark">
            还没决定选哪张？<br />30 秒帮你算清 2 年账单。
          </h2>
          <p class="mt-3 text-[15.5px] leading-[1.6] text-on-dark-mute sm:text-[16px]">
            Share your budget, province, and data habits — our AI advisor filters out restricted carriers and calculates the cleanest 24-month match.
          </p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button type="button" class="btn-primary btn-shine" @click="openAdvisor">
            <Sparkles class="h-4 w-4" />
            <span>启动 AI 选卡顾问</span>
          </button>
          <a href="#catalog" class="btn-outline-dark bg-black/40 backdrop-blur-sm">
            <span>返回全部号卡</span>
            <ArrowRight class="h-4 w-4" />
          </a>
        </div>
      </div>
    </div>

    <!-- 多列快捷导航与合规声明 -->
    <div class="mx-auto max-w-container px-4 py-16 sm:px-6 sm:py-20">
      <div class="grid grid-cols-2 gap-10 md:grid-cols-4">
        <div class="col-span-2 md:col-span-1">
          <div class="flex items-center gap-2.5 text-white">
            <span class="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-white">
              <svg class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="none">
                <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" stroke="currentColor" stroke-width="1.8" />
                <path d="M7.5 3.5V16.5M12.5 3.5V16.5M2.5 10H17.5" stroke="currentColor" stroke-width="1.4" />
              </svg>
            </span>
            <span class="font-display text-[18px] font-semibold tracking-[-0.025em]">NovaSIM</span>
          </div>
          <p class="mt-4 text-[14px] leading-[1.6] text-on-dark-mute">
            正规号卡透明展示与多卡比价工作台。基于 VoltAgent/awesome-design-md 的 Revolut 设计规范构建。
          </p>

          <!-- 微信 / QQ / 网页链接三平台悬停充色分享入口（上方预留纯净浮窗弹出空间） -->
          <div class="mt-11">
            <SocialShareTooltips align="start" />
            <div class="mt-3 text-[12px] font-semibold tracking-[0.1em] text-white/45">
              快捷分享 · 分享到微信 / QQ / 复制链接
            </div>
          </div>
        </div>

        <div>
          <h3 class="text-[14px] font-semibold text-white">选卡通道</h3>
          <ul class="mt-4 space-y-2.5 text-[14px]">
            <li><a href="#featured" class="hover:text-white">核心四档主推</a></li>
            <li><a href="#catalog" class="hover:text-white">全量号卡目录</a></li>
            <li><a href="#showcase" class="hover:text-white">24 个月资费透视</a></li>
            <li><a href="#compare" class="hover:text-white">多卡横向对比</a></li>
          </ul>
        </div>

        <div>
          <h3 class="text-[14px] font-semibold text-white">服务与帮助</h3>
          <ul class="mt-4 space-y-2.5 text-[14px]">
            <li>
              <button type="button" class="hover:text-white" @click="openGuide('guide-order')">
                官方订单与物流查询
              </button>
            </li>
            <li>
              <button type="button" class="hover:text-white" @click="openGuide('guide-activate')">
                激活与首充自查清单
              </button>
            </li>
            <li>
              <button type="button" class="hover:text-white" @click="openGuide('guide-privacy')">
                零实名隐私合规声明
              </button>
            </li>
            <li><a href="#faq" class="hover:text-white">常见问题解答</a></li>
            <li>
              <button type="button" class="hover:text-white" @click="triggerSlowNetworkCheck()">
                网络延迟检测（弱网加载动画）
              </button>
            </li>
          </ul>
        </div>

        <div>
          <h3 class="text-[14px] font-semibold text-white">运营商官方客服</h3>
          <ul class="mt-4 space-y-2.5 text-[14px] tabular">
            <li>中国电信：10000</li>
            <li>中国联通：10010</li>
            <li>中国移动：10086</li>
            <li>中国广电：10099</li>
          </ul>
        </div>
      </div>

      <div class="mt-14 border-t border-divider-soft pt-8 text-[13px] leading-[1.6] text-stone">
        <p>
          合规披露：NovaSIM 仅提供基础电信运营商公开号卡资费结构展示、禁发地预检与参数比对引导，不直接出售号码、不收取购卡费用、不在站内收集或留存用户的身份证件、实名照片、联系电话及收货地址。所有开卡申请、实名核验、发货及售后服务均由中国电信、中国联通、中国移动、中国广电及其依法授权渠道负责。
        </p>
        <p class="mt-3 text-on-dark-mute/60">
          © 2026 NovaSIM Storefront · Design System: Revolut DESIGN.md (VoltAgent/awesome-design-md)
        </p>
      </div>
    </div>
  </GlimmerWrap>
</template>
