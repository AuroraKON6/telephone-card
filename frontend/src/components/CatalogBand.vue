<script setup lang="ts">
/* Full-bleed 纯白 #ffffff 全量号卡目录（Revolut Catalogue Mode）
 * 严格遵循 DESIGN.md：
 * - 白底切换形成强烈视觉反差
 * - 56px 高金融级输入框与省份禁发检测器（rounded-md 12px + 1px #e2e2e7）
 * - 卡片使用 #ffffff + 1px #e2e2e7 + rounded-[20px] + p-8，零投影
 * - 白底主 CTA 使用 btn-dark（黑底白字全圆角胶囊）
 */
import { computed, onMounted, onUnmounted, ref } from 'vue';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronDown,
  MapPin,
  RefreshCw,
  RotateCcw,
  Scale,
  Server,
  Sparkles,
} from 'lucide-vue-next';
import { CARRIER_META, PROVINCES } from '@/data/plans';
import {
  calc24MonthTotal,
  calcPricePerGb,
  isBlockedInProvince,
  useStorefront,
} from '@/composables/useStorefront';
import { fxEnabled, triggerSpark } from '@/composables/useSpark';
import SmokeType from './fx/SmokeType.vue';
import LuminousSearchInput from './fx/LuminousSearchInput.vue';
import type { Carrier, QuickTag, SortMode } from '@/types/sim';

const {
  filteredPlans,
  allPlans,
  backendMode,
  backendLatencyMs,
  catalogRefreshing,
  catalogMetaText,
  hasMoreCatalog,
  searchQuery,
  selectedCarrier,
  selectedQuickTag,
  sortMode,
  selectedProvince,
  hideBlocked,
  isCompared,
  toggleCompare,
  resetFilters,
  refreshLiveCatalog,
  loadMoreCatalog,
  openDetail,
  openApply,
  openAdvisor,
} = useStorefront();

const carriers: Array<Carrier | '全部'> = ['全部', '中国电信', '中国联通', '中国移动', '中国广电'];

const quickTags: Array<{ id: QuickTag; label: string }> = [
  { id: 'all', label: '全部场景' },
  { id: 'under-30', label: '29 元及以下' },
  { id: 'long-term', label: '长期不变价' },
  { id: 'big-data', label: '150G+ 大通用' },
  { id: 'no-contract', label: '0 合约随时销' },
  { id: 'with-voice', label: '含 100+ 分钟通话' },
];

const sortOptions: Array<{ id: SortMode; label: string }> = [
  { id: 'recommend', label: '综合推荐' },
  { id: 'price-asc', label: '月租从低到高' },
  { id: 'data-desc', label: '通用流量最多' },
  { id: 'unit-cost', label: '每 GB 单价最优' },
];

const openDropdown = ref<'province' | 'sort' | null>(null);
const filterPanelRef = ref<HTMLElement | null>(null);

const currentSortLabel = computed(
  () => sortOptions.find((o) => o.id === sortMode.value)?.label ?? '综合推荐',
);

function selectProvince(prov: string) {
  selectedProvince.value = prov;
  openDropdown.value = null;
}

function selectSort(mode: SortMode) {
  sortMode.value = mode;
  openDropdown.value = null;
}

function onDocClick(e: MouseEvent) {
  if (!openDropdown.value) return;
  if (filterPanelRef.value && !filterPanelRef.value.contains(e.target as Node)) {
    openDropdown.value = null;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && openDropdown.value) {
    openDropdown.value = null;
  }
}

function handleLightSpotMove(e: PointerEvent) {
  if (!fxEnabled.value) return;
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--spot-x', `${e.clientX - rect.left}px`);
  el.style.setProperty('--spot-y', `${e.clientY - rect.top}px`);
  el.style.setProperty('--spot-opacity', '1');
}

function handleLightSpotLeave(e: PointerEvent) {
  const el = e.currentTarget as HTMLElement | null;
  if (!el) return;
  el.style.setProperty('--spot-opacity', '0');
}

function handleCatalogCompare(e: MouseEvent, id: string) {
  if (!isCompared(id)) triggerSpark(e, ['#494fdf', '#00a87e', '#191c1f']);
  toggleCompare(id);
}

onMounted(() => {
  document.addEventListener('click', onDocClick);
  window.addEventListener('keydown', onKeydown);
});
onUnmounted(() => {
  document.removeEventListener('click', onDocClick);
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <section
    id="catalog"
    class="w-full bg-canvas-light py-16 text-ink sm:py-section lg:py-band"
  >
    <div class="mx-auto max-w-container px-4 sm:px-6">
      <!-- 章节标题 -->
      <div v-reveal class="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div class="max-w-2xl">
          <p class="ns-kicker text-mute">
            CATALOGUE · 全量核验号卡目录
          </p>
          <SmokeType
            as="h2"
            :lines="['每一分月租，', '摆在明面上选']"
            :stagger-ms="85"
            :condense-ms="1050"
            class="type-display-xl mt-3 text-ink"
          />
        </div>
        <p class="max-w-md text-[15.5px] leading-[1.6] text-mute sm:text-[16px]">
          Pick your delivery province first to filter restricted regions, then narrow down by carrier, long-term rates, or true cost per GB.
        </p>
      </div>

      <!-- 顶部搜索 + 禁发地检测控制台（统一半透明雕塑磨砂卡片，圆角 20px） -->
      <div ref="filterPanelRef" v-reveal="80" class="ns-frosted-card-light mt-10 p-5 sm:p-7">
        <!-- 服务器实时连接与库存同步状态条 -->
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hairline-light bg-white/75 px-4 py-2.5 text-[12.5px]">
          <div class="flex min-w-0 items-center gap-2.5">
            <span class="relative flex h-2.5 w-2.5 flex-shrink-0">
              <span
                class="relative inline-flex h-2.5 w-2.5 rounded-full"
                :class="
                  backendMode === 'live'
                    ? 'bg-accent-teal'
                    : backendMode === 'connected_empty'
                      ? 'bg-amber-500'
                      : backendMode === 'connecting'
                        ? 'bg-primary'
                        : 'bg-stone'
                "
              />
            </span>
            <Server class="h-3.5 w-3.5 flex-shrink-0 text-mute" />
            <span class="truncate font-medium text-charcoal">
              {{ catalogMetaText }}
            </span>
            <span
              v-if="backendLatencyMs !== null && backendMode !== 'offline'"
              class="ns-data-mono hidden rounded-full bg-surface-soft px-2 py-0.5 text-[11px] text-mute sm:inline-block"
            >
              {{ backendLatencyMs }}ms
            </span>
          </div>

          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-canvas-light px-3 py-1 text-[12px] font-semibold text-ink transition-colors hover:bg-surface-soft disabled:opacity-50"
            :disabled="catalogRefreshing"
            @click="refreshLiveCatalog"
          >
            <RefreshCw class="h-3.5 w-3.5" :class="catalogRefreshing ? 'animate-spin' : ''" />
            <span>{{ catalogRefreshing ? '正在同步服务器…' : '刷新服务器库存' }}</span>
          </button>
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <!-- 56px 旋转流光暗黑搜索框（Uiverse Lakshay-art 风格，右侧旋光按钮联动省份禁发筛选） -->
          <div class="relative lg:col-span-5">
            <LuminousSearchInput
              v-model="searchQuery"
              placeholder="搜套餐名、29元、长期、广东、热点..."
              aria-label="搜索号卡套餐"
              filter-title="快捷打开收货省份筛选"
              @filter-click="openDropdown = openDropdown === 'province' ? null : 'province'"
            />
          </div>

          <!-- 56px 收货省份禁发地检测器（Revolut 自定义下拉面板，杜绝原生双箭头） -->
          <div class="relative lg:col-span-4">
            <button
              type="button"
              class="revolut-input flex items-center justify-between gap-2 text-left"
              :class="openDropdown === 'province' ? 'border-primary' : ''"
              :aria-expanded="openDropdown === 'province'"
              aria-haspopup="listbox"
              aria-label="选择收货省份检测是否禁发"
              @click.stop="openDropdown = openDropdown === 'province' ? null : 'province'"
            >
              <span class="flex min-w-0 items-center gap-3">
                <MapPin
                  class="h-5 w-5 flex-shrink-0"
                  :class="selectedProvince ? 'text-primary' : 'text-stone'"
                />
                <span class="truncate" :class="selectedProvince ? 'text-ink' : 'text-stone'">
                  {{ selectedProvince || '选择收货省份（实时排查禁发地）' }}
                </span>
              </span>
              <ChevronDown
                class="h-4 w-4 flex-shrink-0 text-stone transition-transform duration-150"
                :class="openDropdown === 'province' ? 'rotate-180 text-ink' : ''"
              />
            </button>

            <Transition name="dropdown-pop">
              <div
                v-if="openDropdown === 'province'"
                role="listbox"
                aria-label="收货省份列表"
                class="absolute left-0 right-0 top-[62px] z-30 max-h-72 overflow-y-auto rounded-md border border-hairline-light bg-canvas-light p-1.5"
              >
                <button
                  type="button"
                  role="option"
                  :aria-selected="selectedProvince === ''"
                  class="flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-left text-[14px] transition-colors hover:bg-surface-soft"
                  :class="selectedProvince === '' ? 'bg-surface-soft font-semibold text-ink' : 'text-mute'"
                  @click="selectProvince('')"
                >
                  <span>不限省份（关闭禁发预检）</span>
                  <Check v-if="selectedProvince === ''" class="h-4 w-4 text-primary" />
                </button>
                <button
                  v-for="prov in PROVINCES"
                  :key="prov"
                  type="button"
                  role="option"
                  :aria-selected="selectedProvince === prov"
                  class="flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-left text-[14px] transition-colors hover:bg-surface-soft"
                  :class="selectedProvince === prov ? 'bg-surface-soft font-semibold text-ink' : 'text-ink'"
                  @click="selectProvince(prov)"
                >
                  <span>{{ prov }}</span>
                  <Check v-if="selectedProvince === prov" class="h-4 w-4 text-primary" />
                </button>
              </div>
            </Transition>
          </div>

          <!-- 56px 排序选择器（Revolut 自定义下拉面板） -->
          <div class="relative lg:col-span-3">
            <button
              type="button"
              class="revolut-input flex items-center justify-between gap-2 text-left"
              :class="openDropdown === 'sort' ? 'border-primary' : ''"
              :aria-expanded="openDropdown === 'sort'"
              aria-haspopup="listbox"
              aria-label="套餐排序方式"
              @click.stop="openDropdown = openDropdown === 'sort' ? null : 'sort'"
            >
              <span class="truncate text-ink">排序：{{ currentSortLabel }}</span>
              <ChevronDown
                class="h-4 w-4 flex-shrink-0 text-stone transition-transform duration-150"
                :class="openDropdown === 'sort' ? 'rotate-180 text-ink' : ''"
              />
            </button>

            <Transition name="dropdown-pop">
              <div
                v-if="openDropdown === 'sort'"
                role="listbox"
                aria-label="排序方式列表"
                class="absolute left-0 right-0 top-[62px] z-30 rounded-md border border-hairline-light bg-canvas-light p-1.5"
              >
                <button
                  v-for="opt in sortOptions"
                  :key="opt.id"
                  type="button"
                  role="option"
                  :aria-selected="sortMode === opt.id"
                  class="flex w-full items-center justify-between rounded-sm px-3 py-2.5 text-left text-[14px] transition-colors hover:bg-surface-soft"
                  :class="sortMode === opt.id ? 'bg-surface-soft font-semibold text-ink' : 'text-ink'"
                  @click="selectSort(opt.id)"
                >
                  <span>{{ opt.label }}</span>
                  <Check v-if="sortMode === opt.id" class="h-4 w-4 text-primary" />
                </button>
              </div>
            </Transition>
          </div>
        </div>

        <!-- 运营商与场景胶囊筛选条（独立分行，零挤压零溢出） -->
        <div class="mt-5 space-y-3 border-t border-hairline-light pt-5">
          <!-- 运营商行 -->
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span class="w-16 flex-shrink-0 text-[13px] font-semibold text-mute">运营商</span>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="carrier in carriers"
                :key="carrier"
                type="button"
                :class="
                  selectedCarrier === carrier
                    ? 'btn-pill-sm-active'
                    : 'btn-pill-sm bg-canvas-light border border-hairline-light'
                "
                @click="selectedCarrier = carrier"
              >
                <span
                  v-if="carrier !== '全部'"
                  class="h-2 w-2 rounded-full"
                  :style="{ backgroundColor: CARRIER_META[carrier].dotColor }"
                />
                <span>{{ carrier }}</span>
              </button>
            </div>
          </div>

          <!-- 场景行 -->
          <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <span class="w-16 flex-shrink-0 text-[13px] font-semibold text-mute">选卡偏好</span>
            <div class="flex flex-wrap items-center gap-2">
              <button
                v-for="tag in quickTags"
                :key="tag.id"
                type="button"
                :class="
                  selectedQuickTag === tag.id
                    ? 'btn-pill-sm-active'
                    : 'btn-pill-sm bg-canvas-light border border-hairline-light'
                "
                @click="selectedQuickTag = tag.id"
              >
                {{ tag.label }}
              </button>
            </div>
          </div>
        </div>

        <!-- 省份提示条 & 结果数汇总 -->
        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 text-[14px]">
          <div class="flex flex-wrap items-center gap-3 text-mute">
            <span>
              当前匹配 <strong class="font-semibold text-ink tabular">{{ filteredPlans.length }}</strong> /
              <span class="tabular">{{ allPlans.length }}</span> 款核验方案
            </span>
            <button
              v-if="allPlans.some((p) => p.soldOut)"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full border border-accent-danger/30 bg-[#fff1f2] px-3 py-1 text-[12px] font-semibold text-accent-deep-red transition-colors hover:bg-[#ffe4e6]"
              @click="openApply(allPlans.find((p) => p.soldOut)!.id)"
            >
              <span class="h-1.5 w-1.5 rounded-full bg-accent-danger" />
              <span>9 元特惠副卡本期已售罄 · 查看掉落替代推荐 ↗</span>
            </button>
            <label
              v-if="selectedProvince"
              class="inline-flex cursor-pointer items-center gap-2 rounded-full bg-canvas-light px-3 py-1 text-[13px] font-semibold text-ink border border-hairline-light"
            >
              <input
                v-model="hideBlocked"
                type="checkbox"
                class="h-4 w-4 accent-primary"
              />
              <span>仅展示可发往「{{ selectedProvince.replace(/(省|市|壮族自治区|维吾尔自治区|回族自治区|自治区)$/, '') }}」</span>
            </label>
          </div>

          <button
            v-if="searchQuery || selectedCarrier !== '全部' || selectedQuickTag !== 'all' || hideBlocked"
            type="button"
            class="inline-flex items-center gap-1.5 text-[14px] font-semibold text-accent-blue-link hover:underline"
            @click="resetFilters"
          >
            <RotateCcw class="h-3.5 w-3.5" />
            <span>重置全部筛选</span>
          </button>
        </div>
      </div>

      <!-- 号卡卡片网格（支持筛选/排序丝滑重排 TransitionGroup + 悬停微抬升） -->
      <TransitionGroup
        v-if="filteredPlans.length > 0"
        name="catalog-grid"
        tag="div"
        class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="plan in filteredPlans"
          :key="plan.id"
          class="ns-tiago-shell flex"
        >
          <article
            class="ns-tiago-inner spotlight-light ns-frosted-card-light flex flex-col justify-between p-7 sm:p-8"
            :class="
              selectedProvince && isBlockedInProvince(plan, selectedProvince)
                ? '!border-accent-danger/50 !bg-[#f7dfe5]/65'
                : ''
            "
            @pointermove="handleLightSpotMove"
            @pointerleave="handleLightSpotLeave"
          >
          <div class="relative z-10">
            <!-- 顶部运营商标识 + 禁发实时状态/长期标记 -->
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="inline-flex items-center gap-2 text-[13px] font-semibold text-charcoal">
                <span
                  class="h-2.5 w-2.5 rounded-full"
                  :style="{ backgroundColor: CARRIER_META[plan.carrier].dotColor }"
                />
                <span>{{ plan.carrier }}</span>
                <span class="text-stone">· {{ plan.skuCode }}</span>
              </span>

              <!-- 售罄 / 省份发货状态徽章 -->
              <span
                v-if="plan.soldOut"
                class="inline-flex items-center gap-1 rounded-full bg-accent-danger/10 px-3 py-1 text-[12px] font-semibold text-accent-deep-red"
              >
                <AlertTriangle class="h-3.5 w-3.5" />
                <span>本期已售罄</span>
              </span>
              <span
                v-else-if="selectedProvince && isBlockedInProvince(plan, selectedProvince)"
                class="inline-flex items-center gap-1 rounded-full bg-accent-danger/10 px-3 py-1 text-[12px] font-semibold text-accent-deep-red"
              >
                <AlertTriangle class="h-3.5 w-3.5" />
                <span>所选省份禁发</span>
              </span>
              <span
                v-else-if="plan.regionStatus === 'unverified'"
                class="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-3 py-1 text-[12px] font-semibold text-amber-800"
                :title="plan.blockedDetailNote"
              >
                <MapPin class="h-3.5 w-3.5" />
                <span>配送待确认</span>
              </span>
              <span
                v-else-if="selectedProvince"
                class="inline-flex items-center gap-1 rounded-full bg-accent-light-green/10 px-3 py-1 text-[12px] font-semibold text-accent-green-text"
              >
                <CheckCircle2 class="h-3.5 w-3.5" />
                <span>支持发货</span>
              </span>
              <span
                v-else-if="plan.isFeaturedHighlight"
                class="rounded-full bg-primary px-3 py-1 text-[12px] font-semibold text-white"
              >
                综合主推
              </span>
              <span
                v-else-if="plan.isLongTerm"
                class="rounded-full bg-surface-soft px-3 py-1 text-[12px] font-semibold text-ink"
              >
                长期优惠
              </span>
            </div>

            <!-- 标题与月租 -->
            <div class="mt-4 flex items-start justify-between gap-3">
              <div class="min-w-0">
                <h3 class="font-display text-[21px] font-semibold leading-[1.3] tracking-[-0.015em] text-ink">
                  {{ plan.name }}
                </h3>
                <p class="mt-1.5 text-[14px] leading-[1.48] text-mute">
                  {{ plan.tagline }}
                </p>
              </div>
              <div class="flex-shrink-0 text-right">
                <div class="flex items-baseline justify-end gap-0.5 text-ink">
                  <span class="font-display text-sm font-semibold">¥</span>
                  <span class="hero-num text-[38px]">
                    {{ plan.monthlyPrice }}
                  </span>
                </div>
                <div class="ns-data-mono mt-1 text-[11px] text-stone">
                  /月 · 原价 ¥{{ plan.originalPrice }}
                </div>
              </div>
            </div>

            <!-- 3 列核心容量面板（半透白玻璃内嵌格，衬托冷珍珠灰外卡） -->
            <div class="mt-6 grid grid-cols-3 gap-2 rounded-md border border-white/75 bg-white/60 p-3.5 text-center backdrop-blur-sm">
              <div>
                <div class="text-[12px] text-mute">通用流量</div>
                <div class="hero-num mt-1.5 text-[20px] text-ink">
                  <template v-if="plan.generalDataGb < 0">不限量</template>
                  <template v-else-if="plan.generalDataGb === 0">待核验</template>
                  <template v-else>{{ plan.generalDataGb }}<span class="text-[13px] font-medium text-mute">G</span></template>
                </div>
              </div>
              <div class="border-x border-hairline-light">
                <div class="text-[12px] text-mute">定向流量</div>
                <div class="hero-num mt-1.5 text-[19px] text-ink">
                  {{ plan.directionalDataGb < 0 ? '不限量' : plan.directionalDataGb > 0 ? `${plan.directionalDataGb}G` : '全通用' }}
                </div>
              </div>
              <div>
                <div class="text-[12px] text-mute">语音通话</div>
                <div class="hero-num mt-1.5 text-[19px] text-ink">
                  {{ plan.voiceMinutes > 0 ? `${plan.voiceMinutes}分` : '0.1/分' }}
                </div>
              </div>
            </div>

            <!-- 透明明细行（1px 分隔） -->
            <dl class="mt-5 space-y-2.5 text-[13px]">
              <div class="flex items-center justify-between gap-2 border-b border-hairline-light pb-2">
                <dt class="text-mute">优惠周期</dt>
                <dd class="font-semibold text-ink text-right">{{ plan.offerDuration }}</dd>
              </div>
              <div class="flex items-center justify-between gap-2 border-b border-hairline-light pb-2">
                <dt class="text-mute">合约 / 首充</dt>
                <dd class="ns-data-mono text-[12.5px] font-medium text-ink text-right">
                  {{ plan.contractMonths < 0 ? '合约见详情' : plan.contractMonths === 0 ? '无合约' : `${plan.contractMonths}个月` }}
                  ·
                  {{ plan.firstRechargeAmount > 0 ? `首充 ¥${plan.firstRechargeAmount}` : '首充见详情' }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-2 border-b border-hairline-light pb-2">
                <dt class="text-mute">归属地 / 年龄</dt>
                <dd class="font-semibold text-ink text-right">
                  {{ plan.attribution.replace('（全国通用）', '').replace('（全国无漫游）', '') }} · {{ plan.ageRange }}
                </dd>
              </div>
              <div class="flex items-center justify-between gap-2">
                <dt class="text-mute">2 年实付总计</dt>
                <dd class="ns-data-mono text-[12.5px] font-semibold text-ink text-right">
                  ¥{{ calc24MonthTotal(plan) }}（约 ¥{{ calcPricePerGb(plan) }}/GB）
                </dd>
              </div>
            </dl>

            <!-- 卖点标签 -->
            <div class="mt-4 flex flex-wrap gap-1.5">
              <span
                v-for="tag in plan.highlights"
                :key="tag"
                class="rounded-full bg-surface-soft px-3 py-1 text-[12px] font-normal text-charcoal"
              >
                {{ tag }}
              </span>
            </div>
          </div>

          <!-- 底部操作行（白底区黑胶囊 btn-dark 带掠影高光 + 对比微光火花） -->
          <div class="relative z-10 mt-7 flex items-center gap-2.5 pt-2">
            <button
              v-if="plan.soldOut"
              type="button"
              class="inline-flex h-[48px] flex-1 items-center justify-center gap-1.5 rounded-full border border-accent-danger/35 bg-[#fff1f2] px-4 text-[14px] font-semibold text-accent-deep-red transition-colors hover:bg-[#ffe4e6]"
              @click="openApply(plan.id)"
            >
              <span>已售罄 · 掉落替代卡</span>
              <ArrowUpRight class="h-4 w-4" />
            </button>
            <button
              v-else
              type="button"
              class="btn-dark btn-shine flex-1 px-4"
              @click="openDetail(plan.id)"
            >
              <span>详情与账单</span>
            </button>
            <button
              type="button"
              class="inline-flex h-[48px] items-center justify-center gap-1 rounded-full border px-4 text-[14px] font-semibold transition-colors active:scale-[0.97]"
              :class="
                isCompared(plan.id)
                  ? 'border-primary bg-primary text-white'
                  : 'border-hairline-strong bg-canvas-light text-ink hover:bg-surface-soft'
              "
              :aria-label="isCompared(plan.id) ? '移出对比' : '加入对比'"
              @click="handleCatalogCompare($event, plan.id)"
            >
              <Scale class="h-4 w-4" />
              <span>{{ isCompared(plan.id) ? '已选' : '对比' }}</span>
            </button>
            <button
              type="button"
              class="inline-flex h-[48px] w-[48px] flex-shrink-0 items-center justify-center rounded-full bg-surface-soft text-ink transition-colors hover:bg-[#e5e5ea] active:scale-[0.95]"
              title="前往官方授权页办理"
              aria-label="前往官方授权页办理"
              @click="openApply(plan.id)"
            >
              <ArrowUpRight class="h-5 w-5" />
            </button>
          </div>
          </article>
        </div>
      </TransitionGroup>

      <!-- 翻页加载更多（仅当服务端实时分页还有下一页时出现） -->
      <div v-if="backendMode === 'live' && hasMoreCatalog" class="mt-8 flex justify-center">
        <button
          type="button"
          class="btn-outline-light px-7"
          :disabled="catalogRefreshing"
          @click="loadMoreCatalog"
        >
          <RefreshCw v-if="catalogRefreshing" class="h-4 w-4 animate-spin" />
          <span>{{ catalogRefreshing ? '正在加载下一页…' : '加载更多在售号卡' }}</span>
        </button>
      </div>

      <!-- 空状态 -->
      <div
        v-if="filteredPlans.length === 0"
        class="mt-8 rounded-lg border border-hairline-light bg-surface-soft px-6 py-16 text-center"
      >
        <p class="font-display text-[24px] font-medium text-ink">
          暂无完全匹配的号卡方案
        </p>
        <p class="mt-2 text-[15px] text-mute">
          可能是筛选条件叠加过多，或当前所选省份存在区域限制。你可以重置筛选或让 AI 顾问为你放宽匹配。
        </p>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button type="button" class="btn-dark" @click="resetFilters">
            重置全部筛选
          </button>
          <button type="button" class="btn-outline-light" @click="openAdvisor">
            <Sparkles class="h-4 w-4" />
            <span>让 AI 推荐替代方案</span>
          </button>
        </div>
      </div>
    </div>
  </section>
</template>
