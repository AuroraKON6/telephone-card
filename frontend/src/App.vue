<script setup lang="ts">
/* NovaSIM 主应用装配：
 * 严格遵循 Revolut DESIGN.md 的双模全宽章节节奏：
 * 暗幕顶栏 -> 暗幕 Hero -> 暗幕 4-Up 核心方案 -> 纯白全量目录 -> 暗幕 24 期账单透视仪 -> 纯白对比矩阵与保障 -> 纯白 FAQ -> 纯黑页脚
 */
import NavBar from '@/components/NavBar.vue';
import HeroBand from '@/components/HeroBand.vue';
import FeaturedPlansBand from '@/components/FeaturedPlansBand.vue';
import CatalogBand from '@/components/CatalogBand.vue';
import ShowcaseBand from '@/components/ShowcaseBand.vue';
import CompareBand from '@/components/CompareBand.vue';
import NetworkMapBand from '@/components/NetworkMapBand.vue';
import FaqBand from '@/components/FaqBand.vue';
import FooterBand from '@/components/FooterBand.vue';
import CompareDock from '@/components/CompareDock.vue';
import MobileBottomBar from '@/components/MobileBottomBar.vue';
import PlanDetailModal from '@/components/PlanDetailModal.vue';
import ApplyRedirectModal from '@/components/ApplyRedirectModal.vue';
import SoldOut404Modal from '@/components/SoldOut404Modal.vue';
import GuideModal from '@/components/GuideModal.vue';
import AiAdvisorDrawer from '@/components/AiAdvisorDrawer.vue';
import ContactDockModal from '@/components/ContactDockModal.vue';
import BackToTopButton from '@/components/BackToTopButton.vue';
import SlowNetworkOverlay from '@/components/SlowNetworkOverlay.vue';
import { onMounted } from 'vue';
import SparkOverlay from '@/components/fx/SparkOverlay.vue';
import { useStorefront } from '@/composables/useStorefront';

const { toastMessage, initStorefront } = useStorefront();

onMounted(() => {
  void initStorefront();
});
</script>

<template>
  <div class="min-h-screen bg-canvas-dark">
    <NavBar />

    <main>
      <!-- 暗幕故事与硬件舞台 -->
      <HeroBand />
      <FeaturedPlansBand />

      <!-- 纯白编目筛选区 -->
      <CatalogBand />

      <!-- 暗幕资费透视仪 -->
      <ShowcaseBand />

      <!-- 纯白对比矩阵 -->
      <CompareBand />

      <!-- 暗幕全球信号网络地图（SignalMap） -->
      <NetworkMapBand />

      <!-- 纯白常见问题 -->
      <FaqBand />
    </main>

    <!-- 纯黑全局页脚 -->
    <FooterBand />

    <!-- 全局交互浮层 -->
    <CompareDock />
    <MobileBottomBar />
    <PlanDetailModal />
    <ApplyRedirectModal />
    <SoldOut404Modal />
    <GuideModal />
    <AiAdvisorDrawer />
    <ContactDockModal />
    <BackToTopButton />
    <SlowNetworkOverlay />

    <!-- 全局点击微光粒子火花层（静止 0 耗电） -->
    <SparkOverlay />

    <!-- 极简胶囊 Toast 反馈 -->
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="-translate-y-3 opacity-0"
      enter-to-class="translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="translate-y-0 opacity-100"
      leave-to-class="-translate-y-3 opacity-0"
    >
      <div
        v-if="toastMessage"
        role="status"
        aria-live="polite"
        class="fixed left-1/2 top-16 z-[60] max-w-[90vw] -translate-x-1/2 rounded-full border border-hairline-dark bg-canvas-dark/95 px-4 py-2 text-center text-[13px] font-semibold text-white backdrop-blur-md sm:top-20 sm:px-5 sm:py-2.5 sm:text-[14px]"
      >
        {{ toastMessage }}
      </div>
    </Transition>
  </div>
</template>
