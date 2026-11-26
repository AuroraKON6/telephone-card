<script setup lang="ts">
/* Full-bleed 纯白 #ffffff 多卡参数对比区（Comparison 9 并排实景双栏 + 逐行对齐规格）
 * + 3-Up 信任保障区（AsciiRipple 字符水波涟漪背景）
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Coins,
  Database,
  FileCheck2,
  MapPin,
  PhoneCall,
  Receipt,
  RefreshCw,
  Scale,
  ShieldCheck,
  Sparkles,
  Trash2,
  Truck,
  Wifi,
  X,
} from 'lucide-vue-next';
import { CARRIER_META } from '@/data/plans';
import {
  MAX_COMPARE_COUNT,
  calc24MonthTotal,
  calcEffectiveMonthly,
  calcPricePerGb,
  isBlockedInProvince,
  useStorefront,
} from '@/composables/useStorefront';
import type { SimPlan } from '@/types/sim';
import SimCardVisual from './SimCardVisual.vue';
import VaporType from './fx/VaporType.vue';
import AsciiRipple from './fx/AsciiRipple.vue';

const compareHeadlines: string[][] = [
  ['好不好，拉齐', '口径一比便知'],
  ['两年总账单，', '哪张最省看清'],
  ['真实单 G 价，', '告别隐形套路'],
];

const {
  allPlans,
  comparePlans,
  compareIds,
  backendMode,
  compareLoading,
  selectedProvince,
  syncCompareWithBackend,
  toggleCompare,
  clearCompare,
  applyPresetCompare,
  openDetail,
  openApply,
} = useStorefront();

/** 当对比清单超过 2 张时，记录当前并排呈现的两张主对比方案（默认取前两张） */
const leftPlanId = ref<string>('');
const rightPlanId = ref<string>('');
const openPickerSlot = ref<0 | 1 | null>(null);
const hoveredRowKey = ref<string | null>(null);

watch(
  comparePlans,
  (list) => {
    if (list.length < 2) {
      leftPlanId.value = list[0]?.id ?? '';
      rightPlanId.value = '';
      return;
    }
    const ids = list.map((p) => p.id);
    if (!ids.includes(leftPlanId.value)) {
      leftPlanId.value = ids[0];
    }
    if (!ids.includes(rightPlanId.value) || rightPlanId.value === leftPlanId.value) {
      rightPlanId.value = ids.find((id) => id !== leftPlanId.value) ?? ids[1];
    }
  },
  { immediate: true },
);

const activePair = computed<[SimPlan, SimPlan] | null>(() => {
  if (comparePlans.value.length < 2) return null;
  const left =
    comparePlans.value.find((p) => p.id === leftPlanId.value) ?? comparePlans.value[0];
  const right =
    comparePlans.value.find((p) => p.id === rightPlanId.value && p.id !== left.id) ??
    comparePlans.value.find((p) => p.id !== left.id);
  if (!left || !right) return null;
  return [left, right];
});

/** 直接在左/右栏内更换任意在售号卡（同步更新对比清单，若选中对方槽位则自动互换） */
function selectPlanForSlot(slot: 0 | 1, newPlanId: string) {
  const pair = activePair.value;
  if (!pair) return;
  const currentId = pair[slot].id;
  const otherSlot = slot === 0 ? 1 : 0;
  const otherId = pair[otherSlot].id;

  if (newPlanId === currentId) {
    openPickerSlot.value = null;
    return;
  }

  if (newPlanId === otherId) {
    swapSides();
    openPickerSlot.value = null;
    return;
  }

  // 若新方案不在 compareIds 中，就地替换当前槽位对应的 ID
  const idx = compareIds.value.indexOf(currentId);
  if (!compareIds.value.includes(newPlanId)) {
    if (idx !== -1) {
      const nextIds = [...compareIds.value];
      nextIds[idx] = newPlanId;
      compareIds.value = nextIds;
    } else if (compareIds.value.length < MAX_COMPARE_COUNT) {
      compareIds.value = [...compareIds.value, newPlanId];
    }
  }

  if (slot === 0) leftPlanId.value = newPlanId;
  else rightPlanId.value = newPlanId;

  openPickerSlot.value = null;
}

function swapSides() {
  if (!activePair.value) return;
  const [a, b] = activePair.value;
  leftPlanId.value = b.id;
  rightPlanId.value = a.id;
}

/** 3~4 卡排队条点击：优先替换右侧槽位，若已是左右槽位则高亮不动 */
function assignQueuedPlan(planId: string) {
  if (!activePair.value) return;
  if (leftPlanId.value === planId || rightPlanId.value === planId) return;
  rightPlanId.value = planId;
}

function closePickerOnClickOutside(e: MouseEvent) {
  if (openPickerSlot.value === null) return;
  const target = e.target as HTMLElement | null;
  if (!target?.closest('[data-compare-picker]')) {
    openPickerSlot.value = null;
  }
}

function closePickerOnKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    openPickerSlot.value = null;
  }
}

onMounted(() => {
  window.addEventListener('click', closePickerOnClickOutside);
  window.addEventListener('keydown', closePickerOnKeydown);
});

onUnmounted(() => {
  window.removeEventListener('click', closePickerOnClickOutside);
  window.removeEventListener('keydown', closePickerOnKeydown);
});

interface SpecCellData {
  value: string;
  sub?: string;
  badge?: string;
  badgeTone?: 'green' | 'cobalt' | 'red';
  barPercent?: number;
}

interface AlignedSpecRow {
  key: string;
  label: string;
  icon: typeof Coins;
  cells: [SpecCellData, SpecCellData];
}

const shortProvince = computed(() =>
  selectedProvince.value.replace(/(省|市|壮族自治区|维吾尔自治区|回族自治区|自治区)$/, ''),
);

/** 逐行精密对齐的规格矩阵（左/右两栏共享同一行容器，保证水平分割线 100% 像素对齐） */
const specRows = computed<AlignedSpecRow[]>(() => {
  const pair = activePair.value;
  if (!pair) return [];
  const [a, b] = pair;

  const totalA = calc24MonthTotal(a);
  const totalB = calc24MonthTotal(b);
  const totalDiff = Math.abs(totalA - totalB);
  const maxTotal = Math.max(totalA, totalB, 1);

  const unitA = calcPricePerGb(a);
  const unitB = calcPricePerGb(b);

  const maxGb = Math.max(a.generalDataGb, b.generalDataGb, 1);
  const gbDiff = Math.abs(a.generalDataGb - b.generalDataGb);

  const rows: AlignedSpecRow[] = [
    {
      key: 'monthly',
      label: '优惠期月租',
      icon: Coins,
      cells: [
        {
          value: `¥${a.monthlyPrice}/月`,
          sub: a.monthlyPrice < a.originalPrice ? `原价 ¥${a.originalPrice}/月` : '官方常驻价',
          badge: a.monthlyPrice < b.monthlyPrice ? '月租更低' : undefined,
          badgeTone: 'green',
        },
        {
          value: `¥${b.monthlyPrice}/月`,
          sub: b.monthlyPrice < b.originalPrice ? `原价 ¥${b.originalPrice}/月` : '官方常驻价',
          badge: b.monthlyPrice < a.monthlyPrice ? '月租更低' : undefined,
          badgeTone: 'green',
        },
      ],
    },
    {
      key: 'total24',
      label: '24 个月总成本',
      icon: Receipt,
      cells: [
        {
          value: `¥${totalA}`,
          sub: `折合均 ¥${calcEffectiveMonthly(a)}/月`,
          badge: totalA < totalB ? `两年省 ¥${totalDiff}` : undefined,
          badgeTone: 'green',
          barPercent: Math.round((totalA / maxTotal) * 100),
        },
        {
          value: `¥${totalB}`,
          sub: `折合均 ¥${calcEffectiveMonthly(b)}/月`,
          badge: totalB < totalA ? `两年省 ¥${totalDiff}` : undefined,
          badgeTone: 'green',
          barPercent: Math.round((totalB / maxTotal) * 100),
        },
      ],
    },
    {
      key: 'unitCost',
      label: '每 GB 折算单价',
      icon: Sparkles,
      cells: [
        {
          value: `¥${unitA} / GB`,
          badge: unitA < unitB ? '单 G 最优' : undefined,
          badgeTone: 'cobalt',
        },
        {
          value: `¥${unitB} / GB`,
          badge: unitB < unitA ? '单 G 最优' : undefined,
          badgeTone: 'cobalt',
        },
      ],
    },
    {
      key: 'generalGb',
      label: '通用高速流量',
      icon: Database,
      cells: [
        {
          value: `${a.generalDataGb} GB`,
          badge: a.generalDataGb > b.generalDataGb ? `多 ${gbDiff} GB` : undefined,
          badgeTone: 'green',
          barPercent: Math.round((a.generalDataGb / maxGb) * 100),
        },
        {
          value: `${b.generalDataGb} GB`,
          badge: b.generalDataGb > a.generalDataGb ? `多 ${gbDiff} GB` : undefined,
          badgeTone: 'green',
          barPercent: Math.round((b.generalDataGb / maxGb) * 100),
        },
      ],
    },
    {
      key: 'directionalGb',
      label: '定向流量',
      icon: Wifi,
      cells: [
        {
          value: a.directionalDataGb > 0 ? `${a.directionalDataGb} GB` : '0 GB（全额通用）',
        },
        {
          value: b.directionalDataGb > 0 ? `${b.directionalDataGb} GB` : '0 GB（全额通用）',
        },
      ],
    },
    {
      key: 'voice',
      label: '语音通话',
      icon: PhoneCall,
      cells: [
        {
          value: a.voiceMinutes > 0 ? `${a.voiceMinutes} 分钟` : '0.1 元/分钟',
          badge: a.voiceMinutes > b.voiceMinutes ? '通话更多' : undefined,
          badgeTone: 'green',
        },
        {
          value: b.voiceMinutes > 0 ? `${b.voiceMinutes} 分钟` : '0.1 元/分钟',
          badge: b.voiceMinutes > a.voiceMinutes ? '通话更多' : undefined,
          badgeTone: 'green',
        },
      ],
    },
    {
      key: 'duration',
      label: '优惠期限',
      icon: CalendarClock,
      cells: [
        { value: a.offerDuration },
        { value: b.offerDuration },
      ],
    },
    {
      key: 'contract',
      label: '合约期与首充门槛',
      icon: ShieldCheck,
      cells: [
        {
          value:
            a.contractText
              ? a.contractText
              : a.contractMonths < 0
                ? '待核验（见详情）'
                : a.contractMonths === 0
                  ? '无合约（随时销户）'
                  : `${a.contractMonths} 个月合约`,
          sub: a.firstRechargeAmount > 0 ? `激活首充 ¥${a.firstRechargeAmount}` : a.firstRechargeNote,
        },
        {
          value:
            b.contractText
              ? b.contractText
              : b.contractMonths < 0
                ? '待核验（见详情）'
                : b.contractMonths === 0
                  ? '无合约（随时销户）'
                  : `${b.contractMonths} 个月合约`,
          sub: b.firstRechargeAmount > 0 ? `激活首充 ¥${b.firstRechargeAmount}` : b.firstRechargeNote,
        },
      ],
    },
    {
      key: 'activation',
      label: '归属地与激活方式',
      icon: MapPin,
      cells: [
        {
          value: a.attribution,
          sub: a.activationMethod,
        },
        {
          value: b.attribution,
          sub: b.activationMethod,
        },
      ],
    },
  ];

  if (selectedProvince.value) {
    const unverifiedA = a.regionStatus === 'unverified';
    const unverifiedB = b.regionStatus === 'unverified';
    const blockedA = !unverifiedA && isBlockedInProvince(a, selectedProvince.value);
    const blockedB = !unverifiedB && isBlockedInProvince(b, selectedProvince.value);
    rows.push({
      key: 'province',
      label: `${shortProvince.value}发货校验`,
      icon: Truck,
      cells: [
        {
          value: unverifiedA ? '配送待确认' : blockedA ? '该省禁发' : '可正常申请',
          badge: unverifiedA ? '待核验' : blockedA ? '受限' : '通过',
          badgeTone: unverifiedA ? 'cobalt' : blockedA ? 'red' : 'green',
        },
        {
          value: unverifiedB ? '配送待确认' : blockedB ? '该省禁发' : '可正常申请',
          badge: unverifiedB ? '待核验' : blockedB ? '受限' : '通过',
          badgeTone: unverifiedB ? 'cobalt' : blockedB ? 'red' : 'green',
        },
      ],
    });
  }

  return rows;
});

/** 底部一句话核心差异总结 */
const verdictSummary = computed(() => {
  const pair = activePair.value;
  if (!pair) return '';
  const [a, b] = pair;
  const totalA = calc24MonthTotal(a);
  const totalB = calc24MonthTotal(b);
  const parts: string[] = [];

  if (totalA !== totalB) {
    const cheaper = totalA < totalB ? a : b;
    parts.push(`${cheaper.name} 24 个月总支出少 ¥${Math.abs(totalA - totalB)}`);
  } else {
    parts.push('两张卡 24 个月总支出完全一致');
  }

  if (a.generalDataGb !== b.generalDataGb) {
    const bigger = a.generalDataGb > b.generalDataGb ? a : b;
    parts.push(`${bigger.name} 每月多享 ${Math.abs(a.generalDataGb - b.generalDataGb)} GB 通用流量`);
  }

  const unitA = calcPricePerGb(a);
  const unitB = calcPricePerGb(b);
  if (unitA !== unitB) {
    const bestUnit = unitA < unitB ? a : b;
    parts.push(`${bestUnit.name} 每 GB 低至 ¥${Math.min(unitA, unitB)}`);
  }

  return parts.join('；') + '。';
});

const pillars = [
  {
    icon: Truck,
    title: '四大运营商官方直发',
    desc: '所有号卡均由中国电信、联通、移动、广电省级授权渠道审核制卡，顺丰或京东免费包邮，支持对应官方 App 核验真实套餐与物流。',
    tag: '正规实体卡',
  },
  {
    icon: ShieldCheck,
    title: '站内零实名信息收集',
    desc: 'NovaSIM 严守隐私红线：不设身份证上传表单、不保存收货地址、不收取购卡费。办理时直接跳转运营商授权页面完成法定实名认证。',
    tag: '隐私最小化',
  },
  {
    icon: FileCheck2,
    title: '24 个月账单全透明',
    desc: '拒绝只标“首月免费”或把定向流量混入通用流量宣传。统一提供 2 年总成本、折合每 GB 单价、合约期与禁发省份预检。',
    tag: '金融级明账',
  },
];
</script>

<template>
  <section
    id="compare"
    class="w-full bg-canvas-light py-12 text-ink sm:py-section lg:py-band"
  >
    <div class="mx-auto max-w-container px-4 sm:px-6">
      <!-- 顶部标题与操作（保留 VaporType 水汽微粒动态大标题） -->
      <div v-reveal class="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div class="max-w-2xl">
          <p class="ns-kicker text-mute">
            SIDE-BY-SIDE COMPARE · 双卡实景并排逐行精比
          </p>
          <VaporType
            as="h2"
            :phrases="compareHeadlines"
            color="#191c1f"
            vapor-accent="#494fdf"
            class="type-display-xl mt-3 text-ink"
          />
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <button
            v-if="activePair && backendMode === 'live'"
            type="button"
            class="btn-soft"
            :disabled="compareLoading"
            @click="syncCompareWithBackend"
          >
            <RefreshCw class="h-4 w-4" :class="compareLoading ? 'animate-spin' : ''" />
            <span>{{ compareLoading ? '正在核验…' : '服务器核验对比' }}</span>
          </button>
          <button
            v-if="activePair"
            type="button"
            class="btn-soft"
            @click="swapSides"
          >
            <ArrowLeftRight class="h-4 w-4" />
            <span>左右互换</span>
          </button>
          <button
            v-if="comparePlans.length < 2"
            type="button"
            class="btn-dark"
            @click="applyPresetCompare"
          >
            <Scale class="h-4 w-4" />
            <span>一键载入经典对比</span>
          </button>
          <button
            v-if="comparePlans.length > 0"
            type="button"
            class="btn-soft"
            @click="clearCompare"
          >
            <Trash2 class="h-4 w-4" />
            <span>清空清单</span>
          </button>
        </div>
      </div>

      <!-- 若清单中加入了 3~4 张卡，提供快捷切换条以便在 Comparison 9 双栏中任意两两对决 -->
      <div
        v-if="activePair && comparePlans.length > 2"
        class="mt-8 flex flex-wrap items-center gap-2 rounded-lg border border-hairline-light bg-surface-soft px-4 py-3"
      >
        <span class="mr-1 text-[12px] font-semibold uppercase tracking-wider text-mute">
          已选 {{ comparePlans.length }} 卡 · 点击换入右侧精比
        </span>
        <button
          v-for="item in comparePlans"
          :key="item.id"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors"
          :class="
            item.id === activePair[0].id || item.id === activePair[1].id
              ? 'border-ink bg-ink text-white'
              : 'border-hairline-light bg-canvas-light text-charcoal hover:border-ink/40'
          "
          @click="assignQueuedPlan(item.id)"
        >
          <span
            v-if="item.id === activePair[0].id"
            class="rounded-full bg-white/20 px-1.5 text-[10px]"
          >
            01
          </span>
          <span
            v-else-if="item.id === activePair[1].id"
            class="rounded-full bg-primary px-1.5 text-[10px] text-white"
          >
            02
          </span>
          <span>{{ item.name.split('·')[0].trim() }} ¥{{ item.monthlyPrice }}</span>
        </button>
      </div>

      <!-- ===== Comparison 9 主体：双卡大型实景卡面并排 + 逐行 100% 水平对齐规格 ===== -->
      <div v-if="activePair" class="mt-10">
        <!-- 1. 顶部双卡展示舞台（桌面端并排，移动端仅展示桌面端对应的并排结构并在移动端下方拆分为独立卡片） -->
        <div class="hidden md:block">
          <!-- 顶部两间「展台」：实体 3D 卡面 + 方案换卡器 + 核心价格头 -->
          <div class="grid grid-cols-2 gap-x-8 lg:gap-x-12">
            <div
              v-for="(plan, slotIdx) in activePair"
              :key="`stage-${slotIdx}-${plan.id}`"
              class="flex flex-col"
            >
              <!-- 雕塑半透明磨砂玻璃展台 -->
              <div class="ns-frosted-card-light relative p-6 lg:p-8">
                <!-- 展台顶栏：编号 + 运营商 + 自定义换卡器 + 移出 -->
                <div class="mb-6 flex items-center justify-between gap-2">
                  <div class="flex items-center gap-2.5">
                    <span class="ns-data-mono text-[12px] font-semibold tracking-[0.16em] text-mute">
                      OPTION 0{{ slotIdx + 1 }}
                    </span>
                    <span class="h-3 w-px bg-hairline-light" aria-hidden="true" />
                    <span class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-charcoal">
                      <span
                        class="h-2 w-2 rounded-full"
                        :style="{ backgroundColor: CARRIER_META[plan.carrier].dotColor }"
                      />
                      <span>{{ plan.carrier }}</span>
                    </span>
                  </div>

                  <div class="flex items-center gap-1.5">
                    <!-- 自定义 Revolut 风格换卡下拉（杜绝原生 select 双箭头） -->
                    <div class="relative" data-compare-picker>
                      <button
                        type="button"
                        class="inline-flex h-8 items-center gap-1 rounded-full border border-hairline-light bg-canvas-light px-3 text-[12px] font-semibold text-charcoal transition-colors hover:border-ink/40 hover:text-ink"
                        @click.stop="openPickerSlot = openPickerSlot === slotIdx ? null : (slotIdx as 0 | 1)"
                      >
                        <span>更换方案</span>
                        <ChevronDown
                          class="h-3.5 w-3.5 transition-transform duration-200"
                          :class="openPickerSlot === slotIdx ? 'rotate-180' : ''"
                        />
                      </button>

                      <div
                        v-if="openPickerSlot === slotIdx"
                        class="absolute right-0 top-10 z-30 w-72 overflow-hidden rounded-lg border border-hairline-light bg-canvas-light py-1.5"
                      >
                        <div class="border-b border-hairline-light px-3.5 py-2 text-[11px] font-semibold uppercase tracking-wider text-mute">
                          选择对比号卡（共 {{ allPlans.length }} 款）
                        </div>
                        <div class="max-h-72 overflow-y-auto py-1">
                          <button
                            v-for="cand in allPlans"
                            :key="cand.id"
                            type="button"
                            class="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-[13px] transition-colors hover:bg-surface-soft"
                            :class="cand.id === plan.id ? 'bg-primary/5 font-semibold text-primary' : 'text-ink'"
                            @click="selectPlanForSlot(slotIdx as 0 | 1, cand.id)"
                          >
                            <span class="flex min-w-0 items-center gap-2">
                              <span
                                class="h-2 w-2 flex-shrink-0 rounded-full"
                                :style="{ backgroundColor: CARRIER_META[cand.carrier].dotColor }"
                              />
                              <span class="truncate">{{ cand.name }}</span>
                            </span>
                            <span class="flex flex-shrink-0 items-center gap-1.5 text-[12px] text-mute tabular">
                              <span>¥{{ cand.monthlyPrice }} · {{ cand.generalDataGb }}G</span>
                              <Check v-if="cand.id === plan.id" class="h-3.5 w-3.5 text-primary" />
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-hairline-light bg-canvas-light text-stone transition-colors hover:border-ink/40 hover:text-ink"
                      aria-label="从对比中移出"
                      @click="toggleCompare(plan.id)"
                    >
                      <X class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <!-- 实体金属 SIM 卡 3D 展示模型 -->
                <div class="mx-auto max-w-[360px]">
                  <SimCardVisual
                    :material="plan.material"
                    :name="plan.name"
                    :carrier="plan.carrier"
                    :monthly-price="plan.monthlyPrice"
                    :general-data-gb="plan.generalDataGb"
                    :voice-minutes="plan.voiceMinutes"
                    :sku-code="plan.skuCode"
                    compact
                  />
                </div>
              </div>

              <!-- 展台下方标题与价格摘要 -->
              <div class="pt-6 pb-5">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <button
                      type="button"
                      class="block text-left font-display text-[23px] font-semibold leading-[1.22] tracking-[-0.015em] text-ink transition-colors hover:text-primary"
                      @click="openDetail(plan.id)"
                    >
                      {{ plan.name }}
                    </button>
                    <p class="mt-1.5 line-clamp-1 text-[14px] text-mute">
                      {{ plan.tagline }}
                    </p>
                  </div>
                  <div class="flex-shrink-0 text-right tabular">
                    <div class="hero-num text-[32px] text-ink">
                      ¥{{ plan.monthlyPrice }}<span class="ml-0.5 text-[14px] font-sans font-normal text-mute">/月</span>
                    </div>
                    <div class="ns-data-mono mt-1.5 text-[11.5px] text-mute">
                      24 期均 ¥{{ calcEffectiveMonthly(plan) }}/月
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 2. 逐行水平精密对齐的规格对照区（每行共享同一 CSS Grid 行高，左右分割线像素级对齐） -->
          <div>
            <div
              v-for="row in specRows"
              :key="row.key"
              class="grid grid-cols-2 gap-x-8 lg:gap-x-12"
              @pointerenter="hoveredRowKey = row.key"
              @pointerleave="hoveredRowKey = null"
            >
              <div
                v-for="(cell, cellIdx) in row.cells"
                :key="`${row.key}-${cellIdx}`"
                class="border-t border-hairline-light py-4 transition-colors duration-150"
                :class="hoveredRowKey === row.key ? 'bg-surface-soft/80 -mx-3 px-3 rounded-sm' : ''"
              >
                <div class="flex items-start justify-between gap-4">
                  <div class="flex items-center gap-2 pt-0.5 text-[13px] font-medium text-mute">
                    <component :is="row.icon" class="h-4 w-4 flex-shrink-0 text-stone" />
                    <span>{{ row.label }}</span>
                  </div>

                  <div class="text-right tabular">
                    <div class="flex flex-wrap items-center justify-end gap-2">
                      <span
                        class="text-[15px] font-semibold"
                        :class="
                          cell.badgeTone === 'red'
                            ? 'text-accent-deep-red'
                            : 'text-ink'
                        "
                      >
                        {{ cell.value }}
                      </span>
                      <span
                        v-if="cell.badge"
                        class="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                        :class="
                          cell.badgeTone === 'cobalt'
                            ? 'bg-primary/10 text-primary'
                            : cell.badgeTone === 'red'
                              ? 'bg-accent-danger/10 text-accent-deep-red'
                              : 'bg-accent-light-green/15 text-accent-green-text'
                        "
                      >
                        <AlertTriangle v-if="cell.badgeTone === 'red'" class="h-3 w-3" />
                        <CheckCircle2 v-else-if="row.key === 'province'" class="h-3 w-3" />
                        <span>{{ cell.badge }}</span>
                      </span>
                    </div>
                    <div v-if="cell.sub" class="mt-0.5 text-[12px] text-mute">
                      {{ cell.sub }}
                    </div>
                  </div>
                </div>

                <!-- 关键量化维度的极简比例对比细条 -->
                <div
                  v-if="cell.barPercent !== undefined"
                  class="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-surface-soft"
                >
                  <div
                    class="h-full rounded-full transition-all duration-500"
                    :class="
                      cell.badge
                        ? 'bg-primary'
                        : 'bg-ink/20'
                    "
                    :style="{ width: `${cell.barPercent}%` }"
                  />
                </div>
              </div>
            </div>

            <!-- 3. 底部对齐的操作按钮行 -->
            <div class="grid grid-cols-2 gap-x-8 border-t border-hairline-light pt-6 lg:gap-x-12">
              <div
                v-for="(plan, slotIdx) in activePair"
                :key="`cta-${slotIdx}-${plan.id}`"
                class="flex items-center gap-3"
              >
                <button
                  type="button"
                  class="btn-dark flex-1 px-5 text-[14px]"
                  @click="openApply(plan.id)"
                >
                  <span>前往官方办理</span>
                  <ArrowUpRight class="h-4 w-4" />
                </button>
                <button
                  type="button"
                  class="btn-outline-light px-5 text-[14px]"
                  @click="openDetail(plan.id)"
                >
                  完整账单
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 移动端专属真正「双列并排同屏精比」视图（< 768px 告别上下翻滚盲比，一屏横看胜负） -->
        <div class="md:hidden">
          <!-- 顶部双列卡头 + 一键换卡器 -->
          <div class="grid grid-cols-2 gap-2.5">
            <div
              v-for="(plan, slotIdx) in activePair"
              :key="`m-head-${slotIdx}-${plan.id}`"
              class="ns-frosted-card-light relative flex flex-col justify-between p-3.5"
            >
              <div>
                <div class="flex items-center justify-between gap-1">
                  <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-charcoal">
                    <span
                      class="h-2 w-2 rounded-full"
                      :style="{ backgroundColor: CARRIER_META[plan.carrier].dotColor }"
                    />
                    <span>{{ CARRIER_META[plan.carrier].short }}</span>
                  </span>
                  <div class="relative" data-compare-picker>
                    <button
                      type="button"
                      class="inline-flex h-6 items-center gap-0.5 rounded-full border border-hairline-light bg-canvas-light px-2 text-[10.5px] font-semibold text-charcoal"
                      @click.stop="openPickerSlot = openPickerSlot === slotIdx ? null : (slotIdx as 0 | 1)"
                    >
                      <span>换卡</span>
                      <ChevronDown class="h-3 w-3" />
                    </button>

                    <div
                      v-if="openPickerSlot === slotIdx"
                      class="absolute top-8 z-30 w-56 overflow-hidden rounded-lg border border-hairline-light bg-canvas-light py-1 shadow-lg"
                      :class="slotIdx === 0 ? 'left-0' : 'right-0'"
                    >
                      <div class="max-h-60 overflow-y-auto py-1">
                        <button
                          v-for="cand in allPlans"
                          :key="`mp-${slotIdx}-${cand.id}`"
                          type="button"
                          class="flex w-full items-center justify-between gap-1.5 px-3 py-2 text-left text-[12px] hover:bg-surface-soft"
                          :class="cand.id === plan.id ? 'bg-primary/5 font-semibold text-primary' : 'text-ink'"
                          @click="selectPlanForSlot(slotIdx as 0 | 1, cand.id)"
                        >
                          <span class="truncate">{{ cand.name.split('·')[0].trim() }}</span>
                          <span class="flex-shrink-0 text-[11px] text-mute tabular">¥{{ cand.monthlyPrice }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  class="mt-2 block text-left font-display text-[14.5px] font-semibold leading-snug text-ink"
                  @click="openDetail(plan.id)"
                >
                  {{ plan.name.split('·')[0].trim() }}
                </button>
              </div>

              <div class="mt-2.5 flex items-baseline justify-between border-t border-hairline-light pt-2 tabular">
                <span class="hero-num text-[22px] text-ink">
                  ¥{{ plan.monthlyPrice }}<span class="text-[11px] font-normal text-mute">/月</span>
                </span>
                <span class="text-[10.5px] text-mute">{{ plan.generalDataGb < 0 ? '不限量' : `${plan.generalDataGb}G` }}</span>
              </div>
            </div>
          </div>

          <!-- 逐项左右并排对照矩阵（中间指标徽标 + 左右两格直比） -->
          <div class="ns-frosted-card-light mt-3 overflow-hidden divide-y divide-hairline-light">
            <div
              v-for="row in specRows"
              :key="`m-row-${row.key}`"
              class="px-3 py-2.5"
            >
              <div class="mb-1.5 flex items-center justify-center gap-1 text-[11px] font-semibold text-mute">
                <component :is="row.icon" class="h-3 w-3 text-stone" />
                <span>{{ row.label }}</span>
              </div>
              <div class="grid grid-cols-2 divide-x divide-hairline-light text-center tabular">
                <div
                  v-for="(cell, cIdx) in row.cells"
                  :key="`m-cell-${row.key}-${cIdx}`"
                  class="px-2"
                >
                  <div
                    class="text-[13.5px] font-semibold leading-snug"
                    :class="cell.badgeTone === 'red' ? 'text-accent-deep-red' : 'text-ink'"
                  >
                    {{ cell.value }}
                  </div>
                  <div v-if="cell.sub" class="mt-0.5 truncate text-[10.5px] text-mute">
                    {{ cell.sub }}
                  </div>
                  <span
                    v-if="cell.badge"
                    class="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    :class="
                      cell.badgeTone === 'cobalt'
                        ? 'bg-primary/10 text-primary'
                        : cell.badgeTone === 'red'
                          ? 'bg-accent-danger/10 text-accent-deep-red'
                          : 'bg-accent-light-green/15 text-accent-green-text'
                    "
                  >
                    {{ cell.badge }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- 底部左右并排直达办理按钮 -->
          <div class="mt-3 grid grid-cols-2 gap-2.5">
            <div
              v-for="(plan, slotIdx) in activePair"
              :key="`m-cta-${slotIdx}-${plan.id}`"
              class="flex flex-col gap-1.5"
            >
              <button
                type="button"
                class="btn-dark min-h-[42px] w-full px-3 py-2 text-[13px]"
                @click="openApply(plan.id)"
              >
                <span>去办理</span>
                <ArrowUpRight class="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                class="btn-outline-light min-h-[38px] w-full px-3 py-1.5 text-[12px]"
                @click="openDetail(plan.id)"
              >
                看完整账单
              </button>
            </div>
          </div>
        </div>

        <!-- 核心差异一句话结论条 -->
        <div class="mt-8 flex flex-wrap items-center gap-2.5 rounded-lg border border-hairline-light bg-surface-soft/75 px-5 py-3.5 text-[14px] text-charcoal">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-0.5 text-[12px] font-semibold text-primary">
            <Scale class="h-3.5 w-3.5" />
            <span>对比结论</span>
          </span>
          <span class="tabular">{{ verdictSummary }}</span>
        </div>
      </div>

      <!-- 不足 2 张时的引导态 -->
      <div
        v-else
        class="mt-10 rounded-lg border border-hairline-light bg-surface-soft px-6 py-12 text-center"
      >
        <p class="font-display text-[22px] font-medium text-ink">
          {{
            comparePlans.length === 1
              ? `已选 1 张（${comparePlans[0].name}），再选至少 1 张即可开启并排对比`
              : '尚未加入对比号卡'
          }}
        </p>
        <p class="mt-2 text-[15px] text-mute">
          在上方全量目录中点击任意套餐的「对比」按钮，或直接载入我们预设的三网代表方案体验。
        </p>
        <div class="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" class="btn-dark" @click="applyPresetCompare">
            载入三网经典对比
          </button>
          <a href="#catalog" class="btn-outline-light">
            返回目录挑选
          </a>
        </div>
      </div>

      <!-- Revolut 规范 3-Up 白底信任保障卡组（手机端横向滑卡节省 700px 竖向空间，桌面 3 列平铺） -->
      <div
        v-reveal
        class="relative mt-12 overflow-hidden rounded-xl border border-hairline-light bg-surface-soft p-5 sm:mt-20 sm:p-10"
      >
        <!-- 交互式 ASCII 字符水波涟漪底层（鼠标滑过/点击即泛起水波，联动全局流光开关） -->
        <div class="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
          <AsciiRipple
            :cell-width="14"
            :cell-height="18"
            base-color="#b4bcc9"
            crest-color="#494fdf"
            trough-color="#0f766e"
            :damping="0.962"
            ambient-drops
          />
          <!-- 极轻柔边缘渐白罩，让水波在圆角边界自然淡入卡片底面 -->
          <div
            class="absolute inset-0 bg-gradient-to-br from-surface-soft/50 via-transparent to-surface-soft/35"
          />
        </div>

        <div class="relative z-10 max-w-2xl">
          <p class="ns-kicker text-mute">
            TRUST ARCHITECTURE · 透明选卡三重准则
          </p>
          <h3 class="type-display-lg mt-2 text-ink">
            像对待金融账单一样，严谨对待每一张手机卡
          </h3>
        </div>

        <div class="no-scrollbar relative z-10 -mx-5 mt-6 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-5 pb-1 md:mx-0 md:mt-8 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0">
          <div
            v-for="(item, idx) in pillars"
            :key="item.title"
            v-reveal="idx * 80"
            class="flex w-[78vw] max-w-[290px] flex-shrink-0 snap-center md:w-auto md:max-w-none md:flex-shrink"
          >
            <div class="ns-tiago-shell w-full">
              <article class="ns-tiago-inner ns-frosted-card-light flex flex-col justify-between p-5 md:p-8">
                <div>
                  <div class="flex items-center justify-between">
                    <span class="flex h-11 w-11 items-center justify-center rounded-md bg-surface-soft text-ink">
                      <component :is="item.icon" class="h-5 w-5" />
                    </span>
                    <span class="rounded-full bg-surface-soft px-3 py-1 text-[12px] font-semibold text-ink">
                      {{ item.tag }}
                    </span>
                  </div>
                  <h4 class="mt-6 font-display text-[22px] font-medium leading-[1.3] text-ink">
                    {{ item.title }}
                  </h4>
                  <p class="mt-3 text-[15px] leading-[1.6] text-mute">
                    {{ item.desc }}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
