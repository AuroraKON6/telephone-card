<script setup lang="ts">
/* 弱网与慢加载全局仓鼠跑轮加载层（SlowNetworkOverlay）
 * 自动触发条件：
 * 1. 页面首屏加载耗时超过 450ms（window load / 字体未就绪时自动接管）
 * 2. 浏览器检测到断网（offline）或 Network Information API 降级至 slow-2g / 2g / 高 RTT（> 900ms）
 * 3. 外部通过 useStorefront().triggerSlowNetworkCheck() 手动触发网络延迟检测或慢加载演练
 * 绝不卡死用户：任何场景均提供「继续离线/跳过等待」快捷关闭与 Escape 关闭
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { WifiOff, X } from 'lucide-vue-next';
import { useStorefront } from '@/composables/useStorefront';
import HamsterLoader from './fx/HamsterLoader.vue';

interface NetworkInformationLike {
  effectiveType?: string;
  rtt?: number;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

const { slowNetworkState, dismissSlowNetwork, showToast } = useStorefront();

const autoSlowActive = ref(false);
const autoReason = ref('');
const userDismissedOffline = ref(false);
const elapsedSec = ref(0);

let initialDelayTimer: ReturnType<typeof setTimeout> | null = null;
let elapsedRaf = 0;
let startTimestamp = 0;

const isVisible = computed(
  () => slowNetworkState.value.active || (autoSlowActive.value && !userDismissedOffline.value),
);

const displayTitle = computed(() =>
  slowNetworkState.value.active
    ? slowNetworkState.value.title
    : autoReason.value || '网络加载较慢，正在加速拉取资费数据…',
);

const displaySubtitle = computed(() =>
  slowNetworkState.value.active
    ? slowNetworkState.value.subtitle
    : '仓鼠正在全力踩轮子恢复连接；你也可以随时点击下方按钮先浏览本地已缓存方案。',
);

const hamsterSpeed = computed(() => (elapsedSec.value > 1.8 ? '0.78s' : '1s'));

function stopElapsedClock() {
  if (elapsedRaf) {
    cancelAnimationFrame(elapsedRaf);
    elapsedRaf = 0;
  }
}

function startElapsedClock() {
  stopElapsedClock();
  startTimestamp = performance.now();
  elapsedSec.value = 0;
  const tick = (now: number) => {
    elapsedRaf = 0;
    if (!isVisible.value) return;
    elapsedSec.value = Number(((now - startTimestamp) / 1000).toFixed(1));
    elapsedRaf = requestAnimationFrame(tick);
  };
  elapsedRaf = requestAnimationFrame(tick);
}

watch(isVisible, (vis) => {
  if (vis) startElapsedClock();
  else stopElapsedClock();
});

function getConnection(): NetworkInformationLike | undefined {
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

function evaluateNetworkHealth() {
  if (!navigator.onLine) {
    autoSlowActive.value = true;
    autoReason.value = '当前网络已断开，等待自动重连…';
    return;
  }

  const conn = getConnection();
  const eff = conn?.effectiveType;
  const rtt = conn?.rtt ?? 0;

  if (eff === 'slow-2g' || eff === '2g' || rtt > 900) {
    autoSlowActive.value = true;
    autoReason.value = `检测到弱网环境（${eff ? eff.toUpperCase() : `RTT ${rtt}ms`}），正在努力加载…`;
    return;
  }

  if (autoSlowActive.value) {
    autoSlowActive.value = false;
    userDismissedOffline.value = false;
    showToast('网络已恢复畅通');
  }
}

function handleDismiss() {
  if (slowNetworkState.value.active) {
    dismissSlowNetwork();
  }
  if (autoSlowActive.value) {
    userDismissedOffline.value = true;
  }
}

function onOnline() {
  userDismissedOffline.value = false;
  evaluateNetworkHealth();
}

function onOffline() {
  userDismissedOffline.value = false;
  evaluateNetworkHealth();
}

function onWindowLoad() {
  if (initialDelayTimer) {
    clearTimeout(initialDelayTimer);
    initialDelayTimer = null;
  }
  if (autoReason.value.includes('页面资源加载较慢')) {
    autoSlowActive.value = false;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isVisible.value) {
    handleDismiss();
  }
}

onMounted(() => {
  // 若首屏资源超过 450ms 仍未 load 完成，自动展示仓鼠跑轮加载层
  if (document.readyState !== 'complete') {
    initialDelayTimer = setTimeout(() => {
      if (document.readyState !== 'complete') {
        autoSlowActive.value = true;
        autoReason.value = '页面资源加载较慢，正在加速渲染…';
      }
    }, 450);
    window.addEventListener('load', onWindowLoad, { once: true });
  }

  // 初始检查是否处于离线或极慢 2G 网络
  if (!navigator.onLine) {
    evaluateNetworkHealth();
  } else {
    const conn = getConnection();
    if (conn?.effectiveType === 'slow-2g' || conn?.effectiveType === '2g') {
      evaluateNetworkHealth();
    }
    conn?.addEventListener?.('change', evaluateNetworkHealth);
  }

  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  stopElapsedClock();
  if (initialDelayTimer) clearTimeout(initialDelayTimer);
  const conn = getConnection();
  conn?.removeEventListener?.('change', evaluateNetworkHealth);
  window.removeEventListener('online', onOnline);
  window.removeEventListener('offline', onOffline);
  window.removeEventListener('load', onWindowLoad);
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isVisible"
        class="slow-network-overlay fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
        role="status"
        aria-live="polite"
        aria-label="网络加载较慢提示"
      >
        <div class="modal-panel relative flex w-full max-w-md flex-col items-center rounded-2xl border border-white/15 bg-[#0c0e15] px-7 py-9 text-center text-white">
          <button
            type="button"
            class="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            aria-label="关闭弱网加载提示"
            @click="handleDismiss"
          >
            <X class="h-4 w-4" />
          </button>

          <div class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/80">
            <WifiOff class="h-3.5 w-3.5 text-[#f59e0b]" />
            <span>SLOW NETWORK · 弱网加速中</span>
            <span class="font-mono text-white/60 tabular">{{ elapsedSec.toFixed(1) }}s</span>
          </div>

          <!-- Uiverse.io by Nawsome 仓鼠跑轮加载动画 -->
          <div class="my-6 flex items-center justify-center">
            <HamsterLoader :size-px="14" :duration="hamsterSpeed" />
          </div>

          <h3 class="font-display text-[20px] font-medium tracking-tight text-white">
            {{ displayTitle }}
          </h3>
          <p class="mt-2 text-[13px] leading-[1.6] text-white/65">
            {{ displaySubtitle }}
          </p>

          <div class="mt-6 flex items-center gap-3">
            <button
              type="button"
              class="btn-outline-dark h-10 px-5 text-[13px]"
              @click="handleDismiss"
            >
              继续浏览本地页面
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
