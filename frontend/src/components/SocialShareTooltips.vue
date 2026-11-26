<script setup lang="ts">
/*
 * From Uiverse.io by wilsondesouza - https://uiverse.io/wilsondesouza/brave-earwig-75
 * MIT License, Copyright (c) PriyanshuGupta28 (Priyanshu Gupta), wilsondesouza (Wilson Souza)
 *
 * 已适配为 Vue 3 作用域隔离组件并定制为「分享到微信 / 分享到 QQ / 复制网页链接」三平台真实分享入口：
 * - 完整保留原版 50×50 圆形底色上涌充盈（height 0 -> 100%）与顶部浮窗提示（top -30px -> -48px）动效
 * - 点击微信 / QQ 弹出专属分享卡片（内置本地生成的真实可扫二维码 + 一键复制好友推荐文案 + QQ 好友/空间直达分享 + 移动端系统分享），绝不跳转软件下载官网
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import QRCode from 'qrcode';
import { Check, Copy, ExternalLink, QrCode, Share2, X } from 'lucide-vue-next';
import { useStorefront } from '@/composables/useStorefront';
import { triggerSpark } from '@/composables/useSpark';

withDefaults(
  defineProps<{
    align?: 'center' | 'start';
  }>(),
  {
    align: 'start',
  },
);

type ShareChannel = 'wechat' | 'qq';

const { showToast } = useStorefront();

const shareModalOpen = ref(false);
const activeChannel = ref<ShareChannel>('wechat');
const qrDataUrl = ref('');
const copiedFlag = ref(false);
let copiedTimer: number | null = null;

const SHARE_TITLE = 'NovaSIM · 正规号卡透明资费与 24 期明账比价台';
const SHARE_SUMMARY = '四大运营商 12 款零套路长期卡直发，支持 31 省禁发预检与多卡逐行精比，站内零实名信息留存。';

const pageUrl = computed(() =>
  typeof window !== 'undefined' ? window.location.href : 'https://novasim.cn/',
);

const canNativeShare = computed(
  () => typeof navigator !== 'undefined' && typeof navigator.share === 'function',
);

const formattedShareCopy = computed(
  () => `【${SHARE_TITLE}】${SHARE_SUMMARY}\n直达链接：${pageUrl.value}`,
);

const qqFriendShareHref = computed(() => {
  const url = encodeURIComponent(pageUrl.value);
  const title = encodeURIComponent(SHARE_TITLE);
  const summary = encodeURIComponent(SHARE_SUMMARY);
  return `https://connect.qq.com/widget/shareqq/index.html?url=${url}&title=${title}&summary=${summary}&site=NovaSIM`;
});

const qzoneShareHref = computed(() => {
  const url = encodeURIComponent(pageUrl.value);
  const title = encodeURIComponent(SHARE_TITLE);
  const summary = encodeURIComponent(SHARE_SUMMARY);
  return `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${url}&title=${title}&summary=${summary}&site=NovaSIM`;
});

async function generateQrCode() {
  try {
    qrDataUrl.value = await QRCode.toDataURL(pageUrl.value, {
      width: 240,
      margin: 2,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f1116',
        light: '#ffffff',
      },
    });
  } catch {
    qrDataUrl.value = '';
  }
}

watch(shareModalOpen, (open) => {
  if (open && !qrDataUrl.value) {
    void generateQrCode();
  }
});

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function openShareModal(channel: ShareChannel, e: MouseEvent) {
  const colors = channel === 'wechat' ? ['#07c160', '#ffffff'] : ['#12b7f5', '#ffffff'];
  triggerSpark(e, colors);
  activeChannel.value = channel;
  shareModalOpen.value = true;
  copiedFlag.value = false;
  void generateQrCode();
}

function closeShareModal() {
  shareModalOpen.value = false;
}

async function copySharePackage(e?: MouseEvent) {
  if (e) {
    triggerSpark(
      e,
      activeChannel.value === 'wechat' ? ['#07c160', '#ffffff'] : ['#12b7f5', '#ffffff'],
    );
  }
  await writeClipboard(formattedShareCopy.value);
  copiedFlag.value = true;
  if (copiedTimer !== null) window.clearTimeout(copiedTimer);
  copiedTimer = window.setTimeout(() => {
    copiedFlag.value = false;
  }, 2200);
  showToast(
    activeChannel.value === 'wechat'
      ? '已复制分享文案与链接，可直接粘贴到微信发送给好友'
      : '已复制分享文案与链接，可直接粘贴到 QQ 发送给好友',
  );
}

async function triggerNativeShare() {
  if (!canNativeShare.value) return;
  try {
    await navigator.share({
      title: SHARE_TITLE,
      text: SHARE_SUMMARY,
      url: pageUrl.value,
    });
  } catch {
    // 用户主动取消系统分享面板时静默忽略
  }
}

async function handleLinkClick(e: MouseEvent) {
  triggerSpark(e, ['#494fdf', '#6d73ff', '#ffffff']);
  await writeClipboard(pageUrl.value);
  showToast('已复制当前网页链接，可直接粘贴分享');
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && shareModalOpen.value) {
    closeShareModal();
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  if (copiedTimer !== null) window.clearTimeout(copiedTimer);
});
</script>

<template>
  <div>
    <ul
      class="ns-social-list"
      :class="align === 'center' ? 'justify-center' : 'justify-start'"
      aria-label="分享到微信、QQ 或复制网页链接"
    >
      <!-- 1. 分享到微信（品牌绿 #07C160，打开扫码与好友转发面板） -->
      <li class="ns-social-item">
        <button
          type="button"
          class="ns-social-btn"
          aria-label="分享到微信"
          data-social="wechat"
          @click="openShareModal('wechat', $event)"
        >
          <div class="ns-social-filled" />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-6.656-6.088V8.89c-.135-.01-.27-.027-.407-.03zm-2.53 3.274c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.844 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.969-.982z"
            />
          </svg>
        </button>
        <div class="ns-social-tooltip">分享到微信</div>
      </li>

      <!-- 2. 分享到 QQ（品牌天蓝 #12B7F5，打开 QQ 好友/空间与扫码分享面板） -->
      <li class="ns-social-item">
        <button
          type="button"
          class="ns-social-btn"
          aria-label="分享到 QQ"
          data-social="qq"
          @click="openShareModal('qq', $event)"
        >
          <div class="ns-social-filled" />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              d="M12.003 2c-2.265 0-6.29 1.364-6.29 7.325v1.195S3.55 14.96 3.55 17.474c0 .665.17 1.025.281 1.025.114 0 .902-.484 1.748-2.072 0 0-.18 2.197 1.904 3.967 0 0-1.77.495-1.77 1.182 0 .686 4.078.43 6.29 0 2.212.43 6.29.686 6.29 0 0-.687-1.77-1.182-1.77-1.182 2.085-1.77 1.905-3.967 1.905-3.967.845 1.588 1.634 2.072 1.746 2.072.111 0 .283-.36.283-1.025 0-2.514-2.166-6.954-2.166-6.954V9.325C18.29 3.364 14.268 2 12.003 2z"
            />
          </svg>
        </button>
        <div class="ns-social-tooltip">分享到 QQ</div>
      </li>

      <!-- 3. 网页链接（一键复制链接） -->
      <li class="ns-social-item">
        <button
          type="button"
          class="ns-social-btn"
          aria-label="复制网页链接"
          data-social="weblink"
          @click="handleLinkClick"
        >
          <div class="ns-social-filled" />
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.1"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
        <div class="ns-social-tooltip">复制链接</div>
      </li>
    </ul>

    <!-- 微信 / QQ 真实分享面板（本地生成二维码 + 一键复制好友文案 + QQ 好友/空间网页直达分享） -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="shareModalOpen"
          class="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          :aria-label="activeChannel === 'wechat' ? '分享到微信' : '分享到 QQ'"
          @click.self="closeShareModal"
        >
          <div class="relative w-full max-w-md overflow-hidden rounded-[22px] border border-white/15 bg-[#0e1015] p-6 text-white shadow-2xl">
            <!-- 顶部品牌色光晕 -->
            <div
              class="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full opacity-25 blur-3xl transition-colors duration-300"
              :style="{
                background:
                  activeChannel === 'wechat'
                    ? 'radial-gradient(circle, #07c160 0%, rgba(7,193,96,0) 70%)'
                    : 'radial-gradient(circle, #12b7f5 0%, rgba(18,183,245,0) 70%)',
              }"
              aria-hidden="true"
            />

            <!-- 标题与关闭按钮 -->
            <div class="relative z-10 flex items-center justify-between gap-3">
              <div class="flex items-center gap-2.5">
                <span
                  class="flex h-9 w-9 items-center justify-center rounded-full text-white transition-colors"
                  :style="{ backgroundColor: activeChannel === 'wechat' ? '#07c160' : '#12b7f5' }"
                >
                  <QrCode class="h-4 w-4" />
                </span>
                <div>
                  <h3 class="font-display text-[19px] font-semibold leading-tight text-white">
                    {{ activeChannel === 'wechat' ? '分享到微信' : '分享到 QQ' }}
                  </h3>
                  <p class="ns-data-mono mt-0.5 text-[11px] tracking-[0.08em] text-white/55">
                    {{ activeChannel === 'wechat' ? 'WECHAT SHARE · 扫码或复制转发' : 'QQ SHARE · 好友直达或扫码转发' }}
                  </p>
                </div>
              </div>

              <button
                type="button"
                class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition-colors hover:bg-white/15 hover:text-white"
                aria-label="关闭分享窗口"
                @click="closeShareModal"
              >
                <X class="h-4 w-4" />
              </button>
            </div>

            <!-- 平台切换胶囊（微信 / QQ 无缝切换） -->
            <div class="relative z-10 mt-5 grid grid-cols-2 gap-1.5 rounded-full border border-white/10 bg-black/50 p-1">
              <button
                type="button"
                class="rounded-full py-1.5 text-[13px] font-semibold transition-colors"
                :class="
                  activeChannel === 'wechat'
                    ? 'bg-[#07c160] text-white'
                    : 'text-white/60 hover:text-white'
                "
                @click="activeChannel = 'wechat'"
              >
                分享到微信
              </button>
              <button
                type="button"
                class="rounded-full py-1.5 text-[13px] font-semibold transition-colors"
                :class="
                  activeChannel === 'qq'
                    ? 'bg-[#12b7f5] text-white'
                    : 'text-white/60 hover:text-white'
                "
                @click="activeChannel = 'qq'"
              >
                分享到 QQ
              </button>
            </div>

            <!-- 真实本地二维码卡片 -->
            <div class="relative z-10 mt-5 flex flex-col items-center rounded-2xl border border-white/10 bg-black/60 px-5 py-5 text-center">
              <div class="rounded-xl bg-white p-3 shadow-lg">
                <img
                  v-if="qrDataUrl"
                  :src="qrDataUrl"
                  alt="NovaSIM 页面分享二维码"
                  class="h-44 w-44 rounded-md object-contain"
                />
                <div
                  v-else
                  class="flex h-44 w-44 items-center justify-center text-[12px] text-mute"
                >
                  正在生成二维码…
                </div>
              </div>

              <p class="mt-4 text-[13.5px] leading-[1.55] text-white/85">
                <template v-if="activeChannel === 'wechat'">
                  打开手机微信 <strong class="text-[#39d98a]">「扫一扫」</strong> 打开本页，<br />
                  点击右上角 <strong class="text-white">「⋯」</strong> 即可转发给好友或分享朋友圈
                </template>
                <template v-else>
                  打开手机 QQ <strong class="text-[#4dd0ff]">「扫一扫」</strong> 立即分享，<br />
                  或点击下方按钮直接呼起 <strong class="text-white">QQ 好友 / QQ 空间</strong> 网页分享
                </template>
              </p>

              <!-- 分享卡片文案预览 -->
              <div class="mt-3.5 w-full rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-left">
                <div class="truncate text-[12.5px] font-semibold text-white">
                  {{ SHARE_TITLE }}
                </div>
                <div class="ns-data-mono mt-0.5 truncate text-[11px] text-white/50">
                  {{ pageUrl }}
                </div>
              </div>
            </div>

            <!-- 操作按钮组 -->
            <div class="relative z-10 mt-5 flex flex-col gap-2.5">
              <!-- QQ 专属网页直达分享按钮（非下载页） -->
              <div v-if="activeChannel === 'qq'" class="grid grid-cols-2 gap-2.5">
                <a
                  :href="qqFriendShareHref"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex h-11 items-center justify-center gap-1.5 rounded-full bg-[#12b7f5] px-4 text-[13.5px] font-semibold text-white transition-opacity hover:opacity-90"
                  @click="showToast('已打开 QQ 好友分享页')"
                >
                  <span>发给 QQ 好友</span>
                  <ExternalLink class="h-3.5 w-3.5" />
                </a>
                <a
                  :href="qzoneShareHref"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-4 text-[13.5px] font-semibold text-white transition-colors hover:bg-white/15"
                  @click="showToast('已打开 QQ 空间分享页')"
                >
                  <span>发到 QQ 空间</span>
                  <ExternalLink class="h-3.5 w-3.5" />
                </a>
              </div>

              <!-- 一键复制推荐文案与链接（PC 端微信/QQ 聊天窗最快捷粘贴分享） -->
              <button
                type="button"
                class="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold transition-all"
                :class="
                  activeChannel === 'wechat'
                    ? 'bg-[#07c160] text-white hover:opacity-95'
                    : 'border border-white/15 bg-white/10 text-white hover:bg-white/15'
                "
                @click="copySharePackage($event)"
              >
                <Check v-if="copiedFlag" class="h-4 w-4" />
                <Copy v-else class="h-4 w-4" />
                <span>
                  {{
                    copiedFlag
                      ? '已复制，去聊天窗直接粘贴即可'
                      : activeChannel === 'wechat'
                        ? '复制文案与链接 · 粘贴到微信'
                        : '复制文案与链接 · 粘贴到 QQ'
                  }}
                </span>
              </button>

              <!-- 移动端/支持系统分享的浏览器额外提供系统级分享入口 -->
              <button
                v-if="canNativeShare"
                type="button"
                class="inline-flex h-10 w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-transparent px-4 text-[13px] font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                @click="triggerNativeShare"
              >
                <Share2 class="h-3.5 w-3.5" />
                <span>调用设备系统分享菜单</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/*
 * From Uiverse.io by wilsondesouza - https://uiverse.io/wilsondesouza/brave-earwig-75
 * MIT License, Copyright (c) PriyanshuGupta28 (Priyanshu Gupta), wilsondesouza (Wilson Souza)
 */
.ns-social-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 16px;
}

.ns-social-item {
  position: relative;
}

.ns-social-tooltip {
  position: absolute;
  top: -30px;
  left: 50%;
  transform: translateX(-50%);
  color: #ffffff;
  padding: 6px 11px;
  border-radius: 6px;
  opacity: 0;
  visibility: hidden;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  z-index: 20;
  transition: all 0.3s ease;
}

.ns-social-item:hover .ns-social-tooltip {
  opacity: 1;
  visibility: visible;
  top: -48px;
}

.ns-social-btn {
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 50px;
  height: 50px;
  border: none;
  padding: 0;
  cursor: pointer;
  border-radius: 50%;
  color: #4d4d4d;
  background-color: #ffffff;
  transition: all 0.3s ease-in-out;
}

.ns-social-btn:hover {
  box-shadow: 3px 2px 45px 0px rgb(0 0 0 / 28%);
  color: #ffffff;
}

.ns-social-btn svg {
  position: relative;
  z-index: 1;
  width: 26px;
  height: 26px;
}

.ns-social-filled {
  position: absolute;
  top: auto;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 0;
  background-color: #000000;
  transition: all 0.3s ease-in-out;
}

.ns-social-btn:hover .ns-social-filled {
  height: 100%;
}

/* 微信品牌绿 */
.ns-social-btn[data-social='wechat'] .ns-social-filled,
.ns-social-btn[data-social='wechat'] ~ .ns-social-tooltip {
  background-color: #07c160;
}

/* QQ 品牌天蓝 */
.ns-social-btn[data-social='qq'] .ns-social-filled,
.ns-social-btn[data-social='qq'] ~ .ns-social-tooltip {
  background-color: #12b7f5;
}

/* 网页链接：NovaSIM 钴紫渐变 */
.ns-social-btn[data-social='weblink'] .ns-social-filled,
.ns-social-btn[data-social='weblink'] ~ .ns-social-tooltip {
  background: linear-gradient(135deg, #494fdf 0%, #6d73ff 55%, #22d3ee 100%);
}
</style>
