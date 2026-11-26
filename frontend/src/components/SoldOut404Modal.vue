<script setup lang="ts">
/* 404 5 风格号卡售罄应急推荐全屏页（Bold 404 with scattered colorful cards）
 * 触发时机：当用户点击跳转/申领的号卡已售罄（soldOut）或通道下架时自动呈现
 * 物理交互：
 * - 巨型粗体 404 背景舞台 + 6 张高饱和彩色「当前可用推荐号卡」从顶部受重力掉落、碰撞弹跳并自然散落
 * - 点击任意掉落卡片即直接跳转至该可用推荐卡的官方办理配置页（ApplyRedirectModal）
 * - 支持按住拖拽抛甩玩味交互、点击「再掉一次」重洗掉落、Escape 关闭
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  ArrowUpRight,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-vue-next';
import { CARRIER_META } from '@/data/plans';
import {
  calcPricePerGb,
  isBlockedInProvince,
  useStorefront,
} from '@/composables/useStorefront';
import { triggerSpark } from '@/composables/useSpark';
import type { SimPlan } from '@/types/sim';

const {
  allPlans,
  soldOutPlan,
  selectedProvince,
  closeSoldOut,
  openApply,
  openDetail,
  showToast,
} = useStorefront();

interface CardTheme {
  bg: string;
  accent: string;
  tagBg: string;
}

const CARD_THEMES: CardTheme[] = [
  {
    bg: 'linear-gradient(140deg, #585eff 0%, #4348d9 62%, #2c31a6 100%)',
    accent: '#c7d2fe',
    tagBg: 'rgba(255,255,255,0.18)',
  },
  {
    bg: 'linear-gradient(140deg, #10b981 0%, #059669 62%, #065f46 100%)',
    accent: '#a7f3d0',
    tagBg: 'rgba(255,255,255,0.18)',
  },
  {
    bg: 'linear-gradient(140deg, #f43f5e 0%, #e11d48 62%, #9f1239 100%)',
    accent: '#fecdd3',
    tagBg: 'rgba(255,255,255,0.18)',
  },
  {
    bg: 'linear-gradient(140deg, #f59e0b 0%, #ea580c 64%, #9a3412 100%)',
    accent: '#fde68a',
    tagBg: 'rgba(255,255,255,0.18)',
  },
  {
    bg: 'linear-gradient(140deg, #8b5cf6 0%, #7c3aed 62%, #4c1d95 100%)',
    accent: '#ddd6fe',
    tagBg: 'rgba(255,255,255,0.18)',
  },
  {
    bg: 'linear-gradient(140deg, #27272a 0%, #18181b 65%, #09090b 100%)',
    accent: '#d4d4d8',
    tagBg: 'rgba(255,255,255,0.16)',
  },
];

interface PhysicsCard {
  plan: SimPlan;
  theme: CardTheme;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  vAngle: number;
  width: number;
  height: number;
  delay: number;
  released: boolean;
  zIndex: number;
}

const stageRef = ref<HTMLDivElement | null>(null);
const cards = ref<PhysicsCard[]>([]);
const hoveredId = ref<string | null>(null);
const draggingIdx = ref<number | null>(null);

let rafId = 0;
let lastNow = 0;
let simClock = 0;
let topZ = 20;

// 拖拽判定（区分点击跳转 vs 拖拽抛甩）
let dragStartX = 0;
let dragStartY = 0;
let dragOffsetX = 0;
let dragOffsetY = 0;
let dragMovedDist = 0;
let prevDragX = 0;
let prevDragY = 0;
let prevDragTime = 0;

/** 精选最多 6 张当前可正常申领的替代推荐号卡（优先避开已选禁发省，并按性价比/主推排序） */
const recommendedAlternatives = computed<SimPlan[]>(() => {
  const soldId = soldOutPlan.value?.id;
  const prov = selectedProvince.value;
  const available = allPlans.value.filter((p) => !p.soldOut && p.id !== soldId);
  const scored = [...available].sort((a, b) => {
    const blockedA = prov && isBlockedInProvince(a, prov) ? 1 : 0;
    const blockedB = prov && isBlockedInProvince(b, prov) ? 1 : 0;
    if (blockedA !== blockedB) return blockedA - blockedB;
    const featA = a.featuredTier ? 0 : 1;
    const featB = b.featuredTier ? 0 : 1;
    if (featA !== featB) return featA - featB;
    return a.monthlyPrice - b.monthlyPrice;
  });
  return scored.slice(0, 6);
});

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function stopPhysics() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

function spawnFallingCards() {
  stopPhysics();
  const stage = stageRef.value;
  const stageW = stage ? stage.clientWidth : window.innerWidth;
  const stageH = stage ? stage.clientHeight : window.innerHeight;
  const isCompact = stageW < 640;
  const cardW = isCompact ? 168 : stageW < 1024 ? 196 : 212;
  const cardH = isCompact ? 128 : 148;
  const list = recommendedAlternatives.value;
  const reduced = prefersReducedMotion();

  const sidePad = isCompact ? 16 : 36;
  const usableW = Math.max(cardW, stageW - sidePad * 2);
  const stepX = list.length > 1 ? (usableW - cardW) / (list.length - 1) : 0;

  topZ = 20;
  simClock = 0;

  cards.value = list.map((plan, idx) => {
    const slotX = sidePad + idx * stepX + (Math.random() - 0.5) * Math.min(20, stepX * 0.15);
    const clampedX = Math.max(sidePad, Math.min(stageW - cardW - sidePad, slotX));
    const restY = stageH - cardH - 64 - (idx % 2 === 0 ? 6 : 26);
    const initAngle = (idx % 2 === 0 ? -1 : 1) * (3 + Math.random() * 7);

    return {
      plan,
      theme: CARD_THEMES[idx % CARD_THEMES.length],
      x: clampedX,
      y: reduced ? Math.max(120, restY) : -(cardH + 40 + idx * 36),
      vx: (Math.random() - 0.5) * 90,
      vy: reduced ? 0 : 120 + Math.random() * 130,
      angle: reduced ? initAngle : initAngle * 1.25,
      vAngle: (Math.random() - 0.5) * 55,
      width: cardW,
      height: cardH,
      delay: reduced ? 0 : idx * 0.085,
      released: reduced,
      zIndex: 10 + idx,
    };
  });

  if (!reduced) {
    lastNow = performance.now();
    rafId = requestAnimationFrame(stepPhysics);
  }
}

function stepPhysics(now: number) {
  rafId = 0;
  const stage = stageRef.value;
  if (!stage || !soldOutPlan.value) return;

  const dt = Math.min(0.035, Math.max(0.001, (now - lastNow) / 1000));
  lastNow = now;
  simClock += dt;

  const stageW = stage.clientWidth;
  const stageH = stage.clientHeight;
  const gravity = 2050;
  const floorPad = stageW < 640 ? 48 : 60;
  const wallPad = stageW < 640 ? 14 : 28;

  const arr = cards.value;
  let anyActive = draggingIdx.value !== null;

  for (let i = 0; i < arr.length; i++) {
    const c = arr[i];
    if (!c.released) {
      if (simClock >= c.delay) {
        c.released = true;
      } else {
        anyActive = true;
        continue;
      }
    }

    if (draggingIdx.value === i) continue;

    c.vy += gravity * dt;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    c.angle += c.vAngle * dt;

    // 左右墙壁弹性碰撞
    if (c.x < wallPad) {
      c.x = wallPad;
      c.vx = Math.abs(c.vx) * 0.52;
      c.vAngle *= 0.8;
    } else if (c.x + c.width > stageW - wallPad) {
      c.x = stageW - wallPad - c.width;
      c.vx = -Math.abs(c.vx) * 0.52;
      c.vAngle *= 0.8;
    }

    // 底部地面弹性落地（按奇偶轻微错落，留足底部安全区避免旋转边角裁切）
    const floorY = stageH - c.height - floorPad - (i % 2 === 1 ? 16 : 0);
    if (c.y > floorY) {
      c.y = floorY;
      if (Math.abs(c.vy) > 95) {
        c.vy = -c.vy * 0.34;
        c.vx *= 0.76;
        c.vAngle = c.vAngle * 0.5 + (Math.random() - 0.5) * 14;
      } else {
        c.vy = 0;
        c.vx *= Math.pow(0.06, dt);
        c.vAngle *= Math.pow(0.04, dt);
        // 落地后收敛在 ±10° 精致散落倾角内，边角清晰不遮字
        if (Math.abs(c.angle) > 10) {
          c.angle += (Math.sign(c.angle) * 8 - c.angle) * Math.min(1, dt * 6);
        }
      }
    }

    if (
      Math.abs(c.vx) > 2 ||
      Math.abs(c.vy) > 2 ||
      Math.abs(c.vAngle) > 1.5 ||
      c.y < floorY - 1
    ) {
      anyActive = true;
    }
  }

  // 卡片间水平推离，保证 6 张彩色卡清晰铺开无遮字
  for (let i = 0; i < arr.length; i++) {
    const a = arr[i];
    if (!a.released || draggingIdx.value === i) continue;
    for (let j = i + 1; j < arr.length; j++) {
      const b = arr[j];
      if (!b.released || draggingIdx.value === j) continue;
      const dx = a.x + a.width * 0.5 - (b.x + b.width * 0.5);
      const dy = a.y + a.height * 0.5 - (b.y + b.height * 0.5);
      const minDx = (a.width + b.width) * 0.5;
      const minDy = (a.height + b.height) * 0.42;
      if (Math.abs(dx) < minDx && Math.abs(dy) < minDy) {
        const pushDir = dx === 0 ? (i % 2 === 0 ? -1 : 1) : Math.sign(dx);
        const overlap = (minDx - Math.abs(dx)) * 0.16;
        a.x = Math.max(wallPad, Math.min(stageW - a.width - wallPad, a.x + pushDir * overlap));
        b.x = Math.max(wallPad, Math.min(stageW - b.width - wallPad, b.x - pushDir * overlap));
      }
    }
  }

  if (anyActive) {
    rafId = requestAnimationFrame(stepPhysics);
  }
}

function handleCardPointerDown(idx: number, e: PointerEvent) {
  if (e.button !== 0) return;
  const c = cards.value[idx];
  if (!c) return;
  draggingIdx.value = idx;
  topZ += 1;
  c.zIndex = topZ;
  c.released = true;

  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragOffsetX = e.clientX - c.x;
  dragOffsetY = e.clientY - c.y;
  prevDragX = e.clientX;
  prevDragY = e.clientY;
  prevDragTime = performance.now();
  dragMovedDist = 0;

  (e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId);
  if (!rafId) {
    lastNow = performance.now();
    rafId = requestAnimationFrame(stepPhysics);
  }
}

function handleCardPointerMove(idx: number, e: PointerEvent) {
  if (draggingIdx.value !== idx) return;
  const c = cards.value[idx];
  const stage = stageRef.value;
  if (!c || !stage) return;

  const now = performance.now();
  const dt = Math.max(0.008, (now - prevDragTime) / 1000);
  c.vx = Math.max(-1200, Math.min(1200, (e.clientX - prevDragX) / dt));
  c.vy = Math.max(-1200, Math.min(1200, (e.clientY - prevDragY) / dt));
  c.vAngle = Math.max(-180, Math.min(180, c.vx * 0.08));

  c.x = Math.max(8, Math.min(stage.clientWidth - c.width - 8, e.clientX - dragOffsetX));
  c.y = Math.max(8, Math.min(stage.clientHeight - c.height - 8, e.clientY - dragOffsetY));

  dragMovedDist = Math.max(dragMovedDist, Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY));
  prevDragX = e.clientX;
  prevDragY = e.clientY;
  prevDragTime = now;
}

function handleCardPointerUp(idx: number, e: PointerEvent) {
  if (draggingIdx.value !== idx) return;
  const c = cards.value[idx];
  draggingIdx.value = null;

  // 若位移很小则判定为点击，直接跳转至该可用推荐号卡的办理配置页
  if (c && dragMovedDist < 9) {
    selectRecommendedCard(c.plan, e);
  }
}

function selectRecommendedCard(plan: SimPlan, e?: MouseEvent | PointerEvent) {
  if (e) {
    triggerSpark(e, ['#494fdf', '#10b981', '#ffffff']);
  }
  closeSoldOut();
  openApply(plan.id);
  showToast(`已为你跳转可用推荐卡：${plan.name}`);
}

function inspectRecommendedDetail(plan: SimPlan, e: MouseEvent) {
  e.stopPropagation();
  closeSoldOut();
  openDetail(plan.id);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && soldOutPlan.value) {
    closeSoldOut();
  }
}

function onResize() {
  if (soldOutPlan.value) {
    spawnFallingCards();
  }
}

watch(soldOutPlan, async (plan) => {
  if (plan) {
    await nextTick();
    spawnFallingCards();
  } else {
    stopPhysics();
  }
});

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', onResize, { passive: true });
});

onUnmounted(() => {
  stopPhysics();
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('resize', onResize);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="soldOutPlan"
        ref="stageRef"
        class="soldout-404-stage fixed inset-0 z-[55] flex flex-col justify-between overflow-hidden bg-[#fafaf9] text-ink"
        role="dialog"
        aria-modal="true"
        aria-label="号卡已售罄 · 掉落可用替代推荐"
      >
        <!-- 极细腻美术馆微点背景网格 -->
        <div
          class="pointer-events-none absolute inset-0 opacity-60"
          style="background-image: radial-gradient(#d4d4d8 1px, transparent 1px); background-size: 24px 24px;"
          aria-hidden="true"
        />

        <!-- 顶部导航条 -->
        <div class="relative z-30 flex items-center justify-between px-5 py-4 sm:px-8 sm:py-6">
          <div class="ns-data-mono inline-flex items-center gap-2 rounded-full border border-accent-danger/25 bg-[#fff1f2] px-3.5 py-1.5 text-[11.5px] font-medium tracking-[0.06em] text-accent-deep-red">
            <span class="h-2 w-2 rounded-full bg-accent-danger" />
            <span>404 · SOLD OUT · 「{{ soldOutPlan.name }}」本期已售罄</span>
          </div>

          <button
            type="button"
            class="inline-flex h-10 items-center gap-1.5 rounded-full border border-hairline-light bg-canvas-light px-4 text-[13px] font-semibold text-ink transition-colors hover:border-ink/40 hover:bg-surface-soft"
            aria-label="关闭售罄提示页"
            @click="closeSoldOut"
          >
            <span>返回商城</span>
            <X class="h-4 w-4" />
          </button>
        </div>

        <!-- 中央巨型醒目 404 主视觉与说明文案 -->
        <div class="pointer-events-none relative z-10 mx-auto -mt-16 flex max-w-3xl flex-col items-center px-5 text-center sm:-mt-24">
          <div
            class="hero-num select-none font-bold leading-[0.82] tracking-[-0.065em] text-ink"
            style="font-size: clamp(7.5rem, 23vw, 19rem);"
          >
            404
          </div>

          <h2 class="mt-4 font-display text-[24px] font-semibold tracking-[-0.02em] text-ink sm:text-[32px]">
            手慢一步，这张神卡本期库存已抢空
          </h2>
          <p class="mt-2.5 max-w-xl text-[14px] leading-[1.6] text-mute sm:text-[15px]">
            {{ soldOutPlan.soldOutReason || '当前通道配额已发完。' }}
            别空手走——下方掉落的彩色卡片均为<strong class="font-semibold text-ink">当前可发且已核验 24 期明账</strong>的热门替代卡，<strong class="font-semibold text-primary">点击任意卡片即可直达办理</strong>（也可拖拽抛玩）。
          </p>

          <!-- 操作按钮组（可点击） -->
          <div class="pointer-events-auto mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              class="btn-dark btn-shine px-5 text-[14px]"
              @click="spawnFallingCards"
            >
              <RotateCcw class="h-4 w-4" />
              <span>再掉一次推荐卡</span>
            </button>
            <button
              type="button"
              class="btn-outline-light bg-canvas-light px-5 text-[14px]"
              @click="closeSoldOut"
            >
              <span>返回全量目录挑选</span>
            </button>
          </div>
        </div>

        <!-- 底部安全提示 -->
        <div class="pointer-events-none relative z-10 flex items-center justify-center pb-3 text-[12px] text-stone">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-canvas-light/85 px-3 py-1 backdrop-blur-sm">
            <ShieldCheck class="h-3.5 w-3.5 text-primary" />
            <span>所有掉落推荐卡均支持官方 App 核验 · 站内零实名信息收集</span>
          </span>
        </div>

        <!-- ===== 物理重力掉落散落的彩色可用推荐号卡（点击直达跳转 / 支持拖拽抛甩） ===== -->
        <div
          v-for="(card, idx) in cards"
          :key="card.plan.id"
          role="button"
          tabindex="0"
          :aria-label="`跳转办理推荐卡 ${card.plan.name} ¥${card.plan.monthlyPrice}/月`"
          class="soldout-falling-card absolute left-0 top-0 flex cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-white/25 p-4 text-left text-white select-none touch-none will-change-transform sm:p-5"
          :style="{
            width: `${card.width}px`,
            height: `${card.height}px`,
            zIndex: hoveredId === card.plan.id ? topZ + 10 : card.zIndex,
            background: card.theme.bg,
            transform: `translate3d(${card.x.toFixed(1)}px, ${card.y.toFixed(1)}px, 0) rotate(${hoveredId === card.plan.id && draggingIdx !== idx ? 0 : card.angle.toFixed(2)}deg) scale(${hoveredId === card.plan.id && draggingIdx !== idx ? 1.06 : 1})`,
            transition: draggingIdx === idx ? 'none' : hoveredId === card.plan.id ? 'transform 220ms cubic-bezier(0.22, 1, 0.36, 1)' : 'none',
          }"
          @pointerenter="hoveredId = card.plan.id"
          @pointerleave="hoveredId = null"
          @pointerdown="handleCardPointerDown(idx, $event)"
          @pointermove="handleCardPointerMove(idx, $event)"
          @pointerup="handleCardPointerUp(idx, $event)"
          @keydown.enter="selectRecommendedCard(card.plan)"
        >
          <!-- 卡片表面斜切柔光 -->
          <div
            class="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-25"
            style="background: radial-gradient(circle, #ffffff 0%, rgba(255,255,255,0) 70%);"
            aria-hidden="true"
          />

          <div class="relative z-10 flex items-center justify-between gap-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
              :style="{ backgroundColor: card.theme.tagBg }"
            >
              <Sparkles class="h-3 w-3" />
              <span>{{ CARRIER_META[card.plan.carrier].short }} · 可发</span>
            </span>
            <span class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/20 text-white">
              <ArrowUpRight class="h-4 w-4" />
            </span>
          </div>

          <div class="relative z-10 mt-1">
            <div class="truncate font-display text-[15px] font-semibold leading-snug text-white sm:text-[17px]">
              {{ card.plan.name }}
            </div>
            <div class="mt-1 flex items-baseline justify-between gap-2 tabular">
              <div>
                <span class="hero-num text-[24px] sm:text-[28px]">¥{{ card.plan.monthlyPrice }}</span>
                <span class="text-[11px] text-white/80">/月</span>
              </div>
              <span class="ns-data-mono text-[12px] font-semibold" :style="{ color: card.theme.accent }">
                {{ card.plan.generalDataGb < 0 ? '不限量通用' : `${card.plan.generalDataGb}GB 通用` }}
              </span>
            </div>
          </div>

          <div class="relative z-10 flex items-center justify-between gap-2 border-t border-white/15 pt-2 text-[11px] text-white/85">
            <span class="ns-data-mono truncate">约 ¥{{ calcPricePerGb(card.plan) }}/GB</span>
            <button
              type="button"
              class="flex-shrink-0 rounded-full bg-black/25 px-2 py-0.5 font-semibold text-white hover:bg-black/45"
              @pointerdown.stop
              @click="inspectRecommendedDetail(card.plan, $event)"
            >
              看明账
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
