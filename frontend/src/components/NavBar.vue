<script setup lang="ts">
/* Navigation 9 风格悬浮胶囊导航栏 + 底部探头式公告条（Pill nav with a peeking announcement）
 * 特性：
 * - 顶部居中悬浮暗黑磨砂玻璃胶囊，兼容纯黑与纯白全出血章节
 * - 探头公告条紧贴主胶囊底缘探出：页首清晰呈现，向下滚动自动收进胶囊背后，悬停胶囊可再次轻探，支持手动收起
 * - 按要求移除「流光开 / 极简」切换按钮，全站默认恒开流光视觉
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ArrowRight, MapPin, Menu, MessageSquarePlus, Scale, Sparkles, X } from 'lucide-vue-next';
import { useStorefront } from '@/composables/useStorefront';
import ThinkingOrb from './fx/ThinkingOrb.vue';

const {
  compareIds,
  selectedProvince,
  openAdvisor,
  openContact,
  backendMode,
  allPlans,
  publicCategories,
} = useStorefront();

const peekingHeadline = computed(() => {
  if (backendMode.value === 'live') {
    const cats = publicCategories.value.join('/');
    return `已直连服务器实盘（${cats} · ${allPlans.value.length} 款在售核验）· 站内零实名留存`;
  }
  if (backendMode.value === 'connected_empty') {
    return '已连通服务器 cardshop 后端 · 渠道待配置（当前展示演示卡池，AI 与工单已直连）';
  }
  if (backendMode.value === 'connecting') {
    return '正在同步服务器 cardshop 实时号卡库存与 24 期明账…';
  }
  return '四大运营商 12 款零套路长期卡已核验 24 期明账 · 站内零实名留存';
});

const mobileMenuOpen = ref(false);
const scrollProgress = ref(0);
const scrollY = ref(0);
const isNavHovered = ref(false);
const announcementDismissed = ref(false);

const navLinks = [
  { label: '主推方案', href: '#featured' },
  { label: '全部号卡', href: '#catalog' },
  { label: '资费透视', href: '#showcase' },
  { label: '参数对比', href: '#compare' },
  { label: '信号网络', href: '#network' },
  { label: '常见问题', href: '#faq' },
];

/** 探头公告可见性：位于页首（< 180px）或鼠标悬停在胶囊上时探出，向下浏览正文时柔和收回不占视野 */
const showPeekingBar = computed(
  () => !announcementDismissed.value && !mobileMenuOpen.value && (scrollY.value < 180 || isNavHovered.value),
);

function updateScrollMetrics() {
  const doc = document.documentElement;
  scrollY.value = window.scrollY;
  const maxScroll = Math.max(1, doc.scrollHeight - window.innerHeight);
  scrollProgress.value = Math.min(1, Math.max(0, window.scrollY / maxScroll));
}

onMounted(() => {
  updateScrollMetrics();
  window.addEventListener('scroll', updateScrollMetrics, { passive: true });
  window.addEventListener('resize', updateScrollMetrics, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener('scroll', updateScrollMetrics);
  window.removeEventListener('resize', updateScrollMetrics);
});

function handleMobileNav(href: string) {
  mobileMenuOpen.value = false;
  const el = document.querySelector(href);
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
</script>

<template>
  <header
    class="pointer-events-none fixed inset-x-0 top-0 z-40 px-2.5 pt-2 sm:px-6 sm:pt-4"
    @pointerenter="isNavHovered = true"
    @pointerleave="isNavHovered = false"
  >
    <div class="mx-auto flex max-w-container flex-col items-center">
      <!-- ===== 主悬浮胶囊导航栏（移动端 48px 超精简 App 顶栏，桌面端 60px 完整胶囊） ===== -->
      <div
        class="pointer-events-auto relative z-20 flex h-12 w-full max-w-[1140px] items-center justify-between gap-2 overflow-hidden rounded-full border border-white/15 bg-[#0b0d12]/95 px-2.5 text-on-dark ring-1 ring-black/20 backdrop-blur-xl transition-colors duration-200 md:h-[60px] md:gap-3 md:px-4"
      >
        <!-- 左侧品牌字标 + 实时服务器状态微点 -->
        <a
          href="#top"
          class="flex flex-shrink-0 items-center gap-2 whitespace-nowrap pl-0.5 focus-visible:outline-offset-4 md:gap-2.5 md:pl-1"
        >
          <span
            class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white md:h-8 md:w-8"
            aria-hidden="true"
          >
            <svg class="h-3.5 w-3.5 md:h-4 md:w-4" viewBox="0 0 20 20" fill="none">
              <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" stroke="currentColor" stroke-width="1.8" />
              <path d="M7.5 3.5V16.5M12.5 3.5V16.5M2.5 10H17.5" stroke="currentColor" stroke-width="1.4" />
            </svg>
          </span>
          <span class="font-display text-[16px] font-semibold tracking-[-0.025em] text-white md:text-[18px]">
            NovaSIM
          </span>
          <span
            class="h-1.5 w-1.5 rounded-full md:hidden"
            :class="
              backendMode === 'live'
                ? 'bg-accent-teal'
                : backendMode === 'connected_empty'
                  ? 'bg-amber-400'
                  : 'bg-white/40'
            "
            :title="peekingHeadline"
          />
        </a>

        <!-- 中部桌面导航链接（单行胶囊微高亮） -->
        <nav aria-label="主导航" class="hidden items-center gap-1 lg:flex xl:gap-1.5">
          <a
            v-for="item in navLinks"
            :key="item.href"
            :href="item.href"
            class="whitespace-nowrap rounded-full px-3 py-1.5 text-[13.5px] font-semibold tracking-[0.12px] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {{ item.label }}
          </a>
        </nav>

        <!-- 右侧操作区 -->
        <div class="flex flex-shrink-0 items-center gap-1.5 md:gap-2">
          <!-- 移动端快捷收货省份胶囊（点击直达省份筛选） -->
          <a
            href="#catalog"
            class="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-full border border-white/15 bg-white/10 px-2.5 text-[11.5px] font-semibold text-white/90 active:scale-95 md:hidden"
          >
            <MapPin class="h-3 w-3 flex-shrink-0 text-primary-bright" />
            <span>
              {{
                selectedProvince
                  ? selectedProvince.replace(/(省|市|壮族自治区|维吾尔自治区|回族自治区|自治区)$/, '')
                  : '选省份'
              }}
            </span>
          </a>

          <!-- 移动端快捷提问按钮（取代右下角遮挡内容的悬浮提问胶囊） -->
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white active:scale-95 md:hidden"
            aria-label="提交疑问或联系顾问"
            @click="openContact"
          >
            <MessageSquarePlus class="h-3.5 w-3.5 text-primary-bright" />
          </button>

          <!-- 桌面端已选收货省份速览 -->
          <a
            v-if="selectedProvince"
            href="#catalog"
            class="hidden h-9 items-center gap-1 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 text-[12px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white xl:inline-flex"
          >
            <MapPin class="h-3.5 w-3.5 flex-shrink-0 text-primary-bright" />
            <span>{{ selectedProvince.replace(/(省|市|壮族自治区|维吾尔自治区|回族自治区|自治区)$/, '') }}</span>
          </a>

          <!-- 桌面端对比计数跳转 -->
          <a
            href="#compare"
            class="hidden h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/10 bg-white/5 px-3 text-[13px] font-semibold text-white transition-colors hover:bg-white/15 md:inline-flex"
          >
            <Scale class="h-3.5 w-3.5 flex-shrink-0 text-white/70" />
            <span>对比</span>
            <span
              v-if="compareIds.length > 0"
              class="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-white tabular"
            >
              {{ compareIds.length }}
            </span>
          </a>

          <!-- 桌面端 AI 智能选卡入口 -->
          <button
            type="button"
            class="hidden h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-white/15 bg-black/60 px-3 text-[13px] font-semibold text-white transition-colors hover:border-white/30 hover:bg-white/10 md:inline-flex"
            @click="openAdvisor"
          >
            <ThinkingOrb :size="15" tone="cobalt" />
            <span>AI 选卡</span>
          </button>

          <!-- 桌面端 Revolut 纯白主胶囊（移动端底部 Tab 已直达选卡，不再挤占顶栏） -->
          <a
            href="#catalog"
            class="btn-shine hidden h-9 items-center justify-center whitespace-nowrap rounded-full bg-canvas-light px-4 text-[13px] font-semibold text-canvas-dark transition-colors hover:bg-[#ececef] md:inline-flex"
          >
            立即选卡
          </a>

          <!-- 移动/平板端汉堡菜单按钮 (< 1024px) -->
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white md:h-9 md:w-9 lg:hidden"
            :aria-expanded="mobileMenuOpen"
            aria-label="打开导航菜单"
            @click="mobileMenuOpen = !mobileMenuOpen"
          >
            <X v-if="mobileMenuOpen" class="h-4 w-4" />
            <Menu v-else class="h-4 w-4" />
          </button>
        </div>

        <!-- 胶囊内底缘极细 2px 钴紫阅读进度线 -->
        <div
          class="pointer-events-none absolute bottom-0 left-0 h-[2px] w-full origin-left bg-gradient-to-r from-primary via-primary-bright to-accent-teal"
          :style="{ transform: `scaleX(${scrollProgress})` }"
          aria-hidden="true"
        />
      </div>

      <!-- ===== 桌面端探头式公告条（移动端隐藏，避免顶部 100px 挤压与截断省略号） ===== -->
      <div
        class="pointer-events-auto relative z-10 -mt-3 hidden max-w-[92vw] transition-all duration-300 ease-out md:block"
        :class="
          showPeekingBar
            ? 'translate-y-0 opacity-100'
            : 'pointer-events-none -translate-y-9 opacity-0'
        "
      >
        <div
          class="flex items-center gap-2.5 rounded-b-2xl border border-t-0 border-white/15 bg-[#12141e]/95 px-4 pb-2 pt-4 text-[12px] text-white/85 ring-1 ring-black/20 backdrop-blur-xl sm:px-5"
        >
          <span class="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-primary/25 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-primary-bright">
            <span class="h-1.5 w-1.5 rounded-full bg-accent-teal" />
            <span>2026 核验</span>
          </span>

          <a
            href="#showcase"
            class="group inline-flex min-w-0 items-center gap-1.5 text-white/85 transition-colors hover:text-white"
          >
            <span class="truncate">
              {{ peekingHeadline }}
            </span>
            <ArrowRight class="h-3.5 w-3.5 flex-shrink-0 text-primary-bright transition-transform duration-200 group-hover:translate-x-0.5" />
          </a>

          <button
            type="button"
            class="ml-1 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="收起顶部公告"
            @click="announcementDismissed = true"
          >
            <X class="h-3 w-3" />
          </button>
        </div>
      </div>

      <!-- 移动端悬浮玻璃展开菜单 -->
      <Transition name="dropdown-pop">
        <div
          v-if="mobileMenuOpen"
          class="pointer-events-auto mt-2 w-full max-w-[1140px] rounded-2xl border border-white/15 bg-[#0b0d12]/95 p-4 text-on-dark backdrop-blur-xl lg:hidden"
        >
          <nav class="flex flex-col gap-1">
            <button
              v-for="item in navLinks"
              :key="item.href"
              type="button"
              class="flex h-11 items-center justify-between rounded-lg px-3 text-left text-[15px] font-semibold text-white/90 transition-colors hover:bg-white/10 hover:text-white"
              @click="handleMobileNav(item.href)"
            >
              <span>{{ item.label }}</span>
              <ArrowRight class="h-4 w-4 text-white/40" />
            </button>
          </nav>
          <div class="mt-4 flex flex-col gap-2.5 border-t border-white/10 pt-4 sm:flex-row">
            <button
              type="button"
              class="btn-outline-dark w-full whitespace-nowrap px-5 sm:flex-1"
              @click="mobileMenuOpen = false; openAdvisor()"
            >
              <Sparkles class="h-4 w-4" />
              <span>AI 智能选卡</span>
            </button>
            <button
              type="button"
              class="btn-primary w-full whitespace-nowrap px-5 sm:flex-1"
              @click="handleMobileNav('#compare')"
            >
              <span>查看对比清单（{{ compareIds.length }}）</span>
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </header>
</template>
