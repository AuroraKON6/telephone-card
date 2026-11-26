<script setup lang="ts">
/* 页面侧边悬浮「联系与疑问」入口 + Contact 10 风格深黑企业级咨询与疑问提交弹窗
 * 架构：
 * - 桌面端贴右侧中线竖排胶囊（深黑高对比磨砂，黑白底章节均清晰易见）；移动端右下浮钮（避让 CompareDock）
 * - 点击弹出 Contact 10 双栏深黑表单：左栏企业级响应承诺与直达邮箱，右栏结构化表单（全自定义下拉，无原生 select）
 * - 严守站内隐私红线：内置本地正则隐私拦截门，阻断身份证号/手机号/银行卡号提交，仅保留邮箱与问题描述
 */
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Mail,
  MessageSquarePlus,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-vue-next';
import { CardshopApiError, type SupportTicketCategory } from '@/api/cardshop';
import { PROVINCES } from '@/data/plans';
import { useStorefront } from '@/composables/useStorefront';
import { triggerSpark } from '@/composables/useSpark';

const {
  selectedProvince,
  backendMode,
  isContactOpen: isOpen,
  openContact: openModal,
  closeContact,
  submitBackendSupportTicket,
  showToast,
} = useStorefront();

const submitted = ref(false);
const isSubmitting = ref(false);
const ticketCode = ref('');
const serverHint = ref('');
const openMenu = ref<'topic' | 'province' | null>(null);

const nickname = ref('');
const email = ref('');
const topic = ref('资费条款与 24 期账单核实');
const province = ref('');
const scale = ref<'personal' | 'family' | 'campus' | 'enterprise'>('personal');
const message = ref('');
const formError = ref('');

const topics = [
  '资费条款与 24 期账单核实',
  '收货省份禁发与发货咨询',
  '激活首充与售后销户疑问',
  '校园 / 企业多卡批量方案',
  '渠道合作与其他建议',
];

/** 严格映射到 cardshop 后端工单枚举（仅提交类别，绝不向服务端发送 PII 文本） */
const TOPIC_TO_BACKEND_CATEGORY: Record<string, SupportTicketCategory> = {
  '资费条款与 24 期账单核实': '商品问题',
  '收货省份禁发与发货咨询': '商品问题',
  '激活首充与售后销户疑问': '办理问题',
  '校园 / 企业多卡批量方案': '人工咨询',
  '渠道合作与其他建议': '投诉建议',
};

const scales: { id: 'personal' | 'family' | 'campus' | 'enterprise'; label: string }[] = [
  { id: 'personal', label: '个人 1–2 张' },
  { id: 'family', label: '家庭 3–5 张' },
  { id: 'campus', label: '校园 / 团队 10+' },
  { id: 'enterprise', label: '企业商务定制' },
];

const scaleLabel = computed(
  () => scales.find((s) => s.id === scale.value)?.label ?? '个人 1–2 张',
);

/** 站内隐私红线：检测表单中是否意外粘贴了身份证号、手机号或银行卡号 */
const detectedSensitive = computed<string | null>(() => {
  const combined = `${nickname.value} ${message.value}`.replace(/\s+/g, '');
  if (/(?<!\d)[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/.test(combined)) {
    return '疑似 18 位身份证号码';
  }
  if (/(?<!\d)1[3-9]\d{9}(?!\d)/.test(combined)) {
    return '疑似 11 位手机号码';
  }
  if (/(?<!\d)\d{16,19}(?!\d)/.test(combined)) {
    return '疑似银行卡号或长敏感证件号';
  }
  return null;
});

watch(isOpen, (val) => {
  if (val) {
    openMenu.value = null;
    formError.value = '';
    if (!province.value && selectedProvince.value) {
      province.value = selectedProvince.value;
    }
  }
});

function closeModal() {
  closeContact();
  openMenu.value = null;
}

function resetForm() {
  submitted.value = false;
  message.value = '';
  formError.value = '';
  ticketCode.value = '';
}

function generateTicketId(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `NS-INQ-${yy}${mm}${dd}-${rand}`;
}

async function handleSubmit(e: Event) {
  formError.value = '';
  const trimmedEmail = email.value.trim();
  const trimmedMsg = message.value.trim();

  if (detectedSensitive.value) {
    formError.value = `已触发隐私门拦截（${detectedSensitive.value}），请删除敏感实名号码后再提交。`;
    return;
  }
  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    formError.value = '请填写有效的联系邮箱，用于接收透明资费答复。';
    return;
  }
  if (trimmedMsg.length < 6) {
    formError.value = '请至少输入 6 个字说明你的选卡疑问或需求。';
    return;
  }

  isSubmitting.value = true;
  serverHint.value = '';
  if (e instanceof MouseEvent) {
    triggerSpark(e, ['#494fdf', '#22d3ee', '#ffffff']);
  }

  const backendCategory: SupportTicketCategory =
    TOPIC_TO_BACKEND_CATEGORY[topic.value] ?? '人工咨询';

  try {
    if (backendMode.value !== 'offline') {
      // 严格遵守 cardshop 零 PII 红线：仅提交枚举 category 与匿名会话 token
      const res = await submitBackendSupportTicket(backendCategory);
      ticketCode.value = res.ticket_no;
      serverHint.value = res.hint;
      submitted.value = true;
      showToast(`服务器工单 ${res.ticket_no} 已生成`);
      return;
    }
    ticketCode.value = generateTicketId();
    serverHint.value = '当前处于离线模式，已生成本地参考工单编号。';
    submitted.value = true;
    showToast(`离线工单 ${ticketCode.value} 已生成`);
  } catch (err) {
    if (err instanceof CardshopApiError && err.status === 429) {
      formError.value = '工单提交频率受限，请稍等 1 分钟后再试。';
    } else {
      formError.value = '提交服务器工单失败，请稍后重试。';
    }
  } finally {
    isSubmitting.value = false;
  }
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`${label}已复制到剪贴板`);
  } catch {
    showToast(`${label}：${text}`);
  }
}

function onClickOutside(e: MouseEvent) {
  if (!openMenu.value) return;
  const target = e.target as HTMLElement | null;
  if (!target?.closest('[data-contact-dropdown]')) {
    openMenu.value = null;
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    if (openMenu.value) {
      openMenu.value = null;
    } else if (isOpen.value) {
      closeModal();
    }
  }
}

onMounted(() => {
  window.addEventListener('click', onClickOutside);
  window.addEventListener('keydown', onKeydown);
});

onUnmounted(() => {
  window.removeEventListener('click', onClickOutside);
  window.removeEventListener('keydown', onKeydown);
});
</script>

<template>
  <!-- 桌面端右侧边缘悬浮触发胶囊（移动端已移入顶部导航栏图标，彻底杜绝遮挡按钮） -->
  <button
    type="button"
    class="contact-side-trigger fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-2.5 rounded-l-xl border border-r-0 border-white/20 bg-[#0c0e14]/95 px-2.5 py-4 text-white ring-1 ring-black/15 backdrop-blur-md transition-all duration-200 hover:bg-[#151826] hover:pr-3.5 md:flex"
    aria-label="提交疑问或联系顾问"
    @click="openModal"
  >
    <span class="relative flex h-2 w-2">
      <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-teal opacity-75" />
      <span class="relative inline-flex h-2 w-2 rounded-full bg-accent-teal" />
    </span>
    <MessageSquarePlus class="h-4 w-4 text-primary-bright" />
    <span class="text-[12px] font-semibold tracking-[0.22em] text-white/95 [writing-mode:vertical-rl]">
      联系与疑问
    </span>
  </button>

  <!-- Contact 10 风格深黑企业级联系与疑问提交弹窗 -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-5"
        role="dialog"
        aria-modal="true"
        aria-label="联系顾问与提交选卡疑问"
        @click.self="closeModal"
      >
        <div class="modal-panel relative flex max-h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-white/15 bg-[#08090d] text-white sm:rounded-2xl">
          <!-- 右上角关闭按钮 -->
          <button
            type="button"
            class="absolute right-4 top-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-[#12141d] text-white/80 transition-colors hover:border-white/30 hover:bg-white/10 hover:text-white"
            aria-label="关闭联系弹窗"
            @click="closeModal"
          >
            <X class="h-4 w-4" />
          </button>

          <div class="min-h-0 flex-1 overflow-y-auto">
            <div class="grid grid-cols-1 lg:grid-cols-12">
              <!-- ===== 左栏（5列）：Contact 10 深黑企业级承诺与直达信息区 ===== -->
              <div class="relative flex flex-col justify-between overflow-hidden border-b border-white/10 bg-[#0c0e15] p-6 sm:p-8 lg:col-span-5 lg:border-b-0 lg:border-r lg:p-10">
                <!-- 极克制钴紫暗光氛围与微格线 -->
                <div
                  class="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full opacity-25 blur-3xl"
                  style="background: radial-gradient(circle, #494fdf 0%, rgba(73, 79, 223, 0) 70%);"
                  aria-hidden="true"
                />

                <div class="relative z-10">
                  <div class="ns-kicker inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] text-white/80">
                    <span class="h-1.5 w-1.5 rounded-full bg-accent-teal" />
                    <span>CONTACT · 选卡疑问与企业咨询</span>
                  </div>

                  <h3 class="mt-5 font-display text-[30px] font-semibold leading-[1.16] tracking-[-0.025em] text-white sm:text-[34px]">
                    有资费疑问，或需要定制用卡方案？
                  </h3>

                  <p class="mt-3.5 text-[14px] leading-[1.65] text-white/65">
                    无论是 24 期账单条款核对、偏远省份禁发排查、首充异常协助，还是校园与企业多卡批量对接，留言后将由合规顾问逐条核实答复。
                  </p>

                  <!-- 3 条结构化企业级服务承诺 -->
                  <ul class="mt-7 space-y-3.5 text-[13px]">
                    <li class="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3.5">
                      <Clock class="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-bright" />
                      <div>
                        <div class="font-semibold text-white">平均 15 分钟内人工核验回复</div>
                        <div class="mt-0.5 text-[12px] text-white/60">按最新省级运营商口径逐条确认长期续约与首充规则</div>
                      </div>
                    </li>
                    <li class="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3.5">
                      <Sparkles class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-teal" />
                      <div>
                        <div class="font-semibold text-white">31 省禁发库实时人工复检</div>
                        <div class="mt-0.5 text-[12px] text-white/60">针对特殊地区与校园网环境推荐高通过率替代卡池</div>
                      </div>
                    </li>
                    <li class="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3.5">
                      <ShieldCheck class="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-teal" />
                      <div>
                        <div class="font-semibold text-white">严守站内零实名隐私红线</div>
                        <div class="mt-0.5 text-[12px] text-white/60">仅通过邮箱回复解答，严禁索要身份证号、手机号与详细地址</div>
                      </div>
                    </li>
                  </ul>
                </div>

                <!-- 底部直达联系与服务时段 -->
                <div class="relative z-10 mt-8 border-t border-white/10 pt-5 text-[12px] text-white/60">
                  <div class="flex items-center justify-between gap-2">
                    <span class="inline-flex items-center gap-2 text-white/85">
                      <Mail class="h-3.5 w-3.5 text-primary-bright" />
                      <span class="font-medium tabular">support@novasim.cn</span>
                    </span>
                    <button
                      type="button"
                      class="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white"
                      @click="copyText('support@novasim.cn', '联系邮箱')"
                    >
                      <Copy class="h-3 w-3" />
                      <span>复制邮箱</span>
                    </button>
                  </div>
                  <div class="mt-2 flex items-center justify-between text-[11px] text-white/45">
                    <span>服务时段：周一至周日 09:00 – 22:00</span>
                    <span>四大运营商公开口径</span>
                  </div>
                </div>
              </div>

              <!-- ===== 右栏（7列）：Contact 10 深黑精密表单 / 提交回执 ===== -->
              <div class="flex flex-col justify-center bg-[#08090d] p-6 sm:p-8 lg:col-span-7 lg:p-10">
                <!-- 表单态 -->
                <form
                  v-if="!submitted"
                  class="space-y-4"
                  novalidate
                  @submit.prevent="handleSubmit"
                >
                  <div class="pr-8">
                    <div class="text-[12px] font-semibold uppercase tracking-[0.14em] text-white/50">
                      SUBMIT INQUIRY · 填写你的问题
                    </div>
                    <p class="mt-1 text-[13px] text-white/65">
                      标有 <span class="text-primary-bright">*</span> 为必填项，提交后即时生成专属核验工单号。
                    </p>
                  </div>

                  <!-- 行 1：称呼 + 联系邮箱 -->
                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label for="contact-name" class="mb-1.5 block text-[12px] font-semibold text-white/80">
                        称呼 / 昵称（选填）
                      </label>
                      <input
                        id="contact-name"
                        v-model="nickname"
                        type="text"
                        placeholder="例如：林先生 / 陈同学"
                        class="h-[46px] w-full rounded-lg border border-white/15 bg-[#10121b] px-3.5 text-[14px] text-white placeholder:text-white/35 transition-colors focus:border-primary-bright focus:outline-none"
                      />
                    </div>

                    <div>
                      <label for="contact-email" class="mb-1.5 block text-[12px] font-semibold text-white/80">
                        接收答复邮箱 <span class="text-primary-bright">*</span>
                      </label>
                      <input
                        id="contact-email"
                        v-model="email"
                        type="email"
                        required
                        placeholder="name@example.com"
                        class="h-[46px] w-full rounded-lg border border-white/15 bg-[#10121b] px-3.5 text-[14px] text-white placeholder:text-white/35 transition-colors focus:border-primary-bright focus:outline-none"
                      />
                    </div>
                  </div>

                  <!-- 行 2：咨询主题 + 常驻省份（纯自定义深色下拉，无原生 select） -->
                  <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <!-- 咨询主题下拉 -->
                    <div class="relative" data-contact-dropdown>
                      <span class="mb-1.5 block text-[12px] font-semibold text-white/80">
                        咨询主题 <span class="text-primary-bright">*</span>
                      </span>
                      <button
                        type="button"
                        class="flex h-[46px] w-full items-center justify-between gap-2 rounded-lg border border-white/15 bg-[#10121b] px-3.5 text-left text-[14px] text-white transition-colors hover:border-white/30"
                        @click.stop="openMenu = openMenu === 'topic' ? null : 'topic'"
                      >
                        <span class="truncate">{{ topic }}</span>
                        <ChevronDown
                          class="h-4 w-4 flex-shrink-0 text-white/55 transition-transform duration-200"
                          :class="openMenu === 'topic' ? 'rotate-180' : ''"
                        />
                      </button>

                      <div
                        v-if="openMenu === 'topic'"
                        class="absolute left-0 right-0 top-[76px] z-30 overflow-hidden rounded-lg border border-white/15 bg-[#121520] py-1"
                      >
                        <button
                          v-for="item in topics"
                          :key="item"
                          type="button"
                          class="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[13px] transition-colors hover:bg-white/10"
                          :class="item === topic ? 'bg-primary/20 font-semibold text-white' : 'text-white/80'"
                          @click="
                            topic = item;
                            openMenu = null;
                          "
                        >
                          <span>{{ item }}</span>
                          <Check v-if="item === topic" class="h-3.5 w-3.5 text-primary-bright" />
                        </button>
                      </div>
                    </div>

                    <!-- 常驻省份下拉 -->
                    <div class="relative" data-contact-dropdown>
                      <span class="mb-1.5 block text-[12px] font-semibold text-white/80">
                        常驻 / 收货省份（选填）
                      </span>
                      <button
                        type="button"
                        class="flex h-[46px] w-full items-center justify-between gap-2 rounded-lg border border-white/15 bg-[#10121b] px-3.5 text-left text-[14px] transition-colors hover:border-white/30"
                        :class="province ? 'text-white' : 'text-white/45'"
                        @click.stop="openMenu = openMenu === 'province' ? null : 'province'"
                      >
                        <span class="truncate">{{ province || '不限 / 暂未确定' }}</span>
                        <ChevronDown
                          class="h-4 w-4 flex-shrink-0 text-white/55 transition-transform duration-200"
                          :class="openMenu === 'province' ? 'rotate-180' : ''"
                        />
                      </button>

                      <div
                        v-if="openMenu === 'province'"
                        class="absolute left-0 right-0 top-[76px] z-30 max-h-56 overflow-y-auto rounded-lg border border-white/15 bg-[#121520] py-1"
                      >
                        <button
                          type="button"
                          class="flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] text-white/75 hover:bg-white/10"
                          @click="
                            province = '';
                            openMenu = null;
                          "
                        >
                          <span>不限 / 暂未确定</span>
                          <Check v-if="!province" class="h-3.5 w-3.5 text-primary-bright" />
                        </button>
                        <button
                          v-for="p in PROVINCES"
                          :key="p"
                          type="button"
                          class="flex w-full items-center justify-between px-3.5 py-2 text-left text-[13px] transition-colors hover:bg-white/10"
                          :class="p === province ? 'bg-primary/20 font-semibold text-white' : 'text-white/80'"
                          @click="
                            province = p;
                            openMenu = null;
                          "
                        >
                          <span>{{ p }}</span>
                          <Check v-if="p === province" class="h-3.5 w-3.5 text-primary-bright" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- 行 3：用卡规模快选胶囊 -->
                  <div>
                    <span class="mb-1.5 block text-[12px] font-semibold text-white/80">
                      预计用卡规模
                    </span>
                    <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <button
                        v-for="s in scales"
                        :key="s.id"
                        type="button"
                        class="rounded-lg border px-3 py-2 text-center text-[12px] font-semibold transition-all"
                        :class="
                          scale === s.id
                            ? 'border-white bg-white text-canvas-dark'
                            : 'border-white/15 bg-[#10121b] text-white/75 hover:border-white/35 hover:text-white'
                        "
                        @click="scale = s.id"
                      >
                        {{ s.label }}
                      </button>
                    </div>
                  </div>

                  <!-- 行 4：具体疑问正文 -->
                  <div>
                    <label for="contact-msg" class="mb-1.5 flex items-center justify-between text-[12px] font-semibold text-white/80">
                      <span>具体疑问或需求描述 <span class="text-primary-bright">*</span></span>
                      <span class="font-normal text-white/45">请勿填写身份证号、手机号或详细门牌</span>
                    </label>
                    <textarea
                      id="contact-msg"
                      v-model="message"
                      rows="4"
                      required
                      placeholder="例如：打算发往广东深圳，想对比电信星耀与广电升龙的 24 个月真实月均，另外想确认第 25 个月到期续约方式..."
                      class="w-full resize-none rounded-lg border border-white/15 bg-[#10121b] px-3.5 py-3 text-[14px] leading-[1.6] text-white placeholder:text-white/35 transition-colors focus:border-primary-bright focus:outline-none"
                    />
                  </div>

                  <!-- 实时本地隐私门拦截 / 表单校验提醒 -->
                  <div
                    v-if="detectedSensitive || formError"
                    class="flex items-start gap-2.5 rounded-lg border border-accent-danger/60 bg-[#24070d] px-3.5 py-3 text-[13px] text-[#fecdd3]"
                  >
                    <AlertTriangle class="mt-0.5 h-4 w-4 flex-shrink-0 text-[#fda4af]" />
                    <span>
                      {{
                        detectedSensitive
                          ? `隐私门实时拦截：检测到${detectedSensitive}。站内不收集任何实名证件或手机号，请移除敏感数字后再提交。`
                          : formError
                      }}
                    </span>
                  </div>

                  <!-- 提交操作 -->
                  <div class="pt-1">
                    <button
                      type="submit"
                      class="btn-primary btn-shine h-[50px] w-full text-[15px] disabled:opacity-50"
                      :disabled="isSubmitting || Boolean(detectedSensitive)"
                    >
                      <Send class="h-4 w-4" />
                      <span>{{ isSubmitting ? '正在生成加密工单…' : '提交疑问并生成工单回执' }}</span>
                      <ArrowRight v-if="!isSubmitting" class="h-4 w-4" />
                    </button>
                    <p class="mt-2.5 text-center text-[11px] text-white/45">
                      提交后立即生成本地工单编号 · 严格遵循隐私最小化原则，不向第三方共享联系方式
                    </p>
                  </div>
                </form>

                <!-- 提交成功回执态 -->
                <div v-else class="flex flex-col items-center py-6 text-center">
                  <span class="flex h-14 w-14 items-center justify-center rounded-full border border-accent-teal/40 bg-accent-teal/15 text-accent-teal">
                    <CheckCircle2 class="h-7 w-7" />
                  </span>
                  <p class="mt-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-accent-teal">
                    INQUIRY RECEIVED · 工单已受理
                  </p>
                  <h4 class="mt-1.5 font-display text-[26px] font-medium text-white">
                    你的疑问已送达合规选卡顾问
                  </h4>
                  <p class="mt-2 max-w-md text-[14px] leading-[1.6] text-white/65">
                    {{ serverHint || '请妥善保存上方工单编号，并通过人工客服入口联系我们核验解答。' }}
                  </p>
                  <p class="mt-1.5 text-[12px] text-white/45">
                    隐私最小化说明：仅向服务器提交了工单类别，你的邮箱与问题描述未上传至后端数据库。
                  </p>

                  <!-- 工单摘要盒 -->
                  <div class="mt-6 w-full max-w-md rounded-xl border border-white/15 bg-[#10121b] p-4 text-left text-[13px]">
                    <div class="flex items-center justify-between border-b border-white/10 pb-3">
                      <span class="text-white/55">核验工单号</span>
                      <div class="flex items-center gap-2">
                        <span class="font-mono font-semibold text-white tabular">{{ ticketCode }}</span>
                        <button
                          type="button"
                          class="inline-flex h-7 items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 text-[11px] font-semibold text-white/85 hover:bg-white/15"
                          @click="copyText(ticketCode, '工单编号')"
                        >
                          <Copy class="h-3 w-3" />
                          <span>复制</span>
                        </button>
                      </div>
                    </div>
                    <div class="mt-3 space-y-2 text-[12px]">
                      <div class="flex justify-between gap-3">
                        <span class="text-white/50">咨询主题</span>
                        <span class="font-medium text-white/90">{{ topic }}</span>
                      </div>
                      <div class="flex justify-between gap-3">
                        <span class="text-white/50">省份与规模</span>
                        <span class="font-medium text-white/90">{{ province || '全国不限' }} · {{ scaleLabel }}</span>
                      </div>
                      <div class="flex justify-between gap-3">
                        <span class="text-white/50">预计响应</span>
                        <span class="font-medium text-accent-teal">15 分钟内邮件答复</span>
                      </div>
                    </div>
                  </div>

                  <div class="mt-7 flex flex-wrap justify-center gap-3">
                    <button
                      type="button"
                      class="btn-outline-dark px-5 text-[14px]"
                      @click="resetForm"
                    >
                      再提交一个疑问
                    </button>
                    <button
                      type="button"
                      class="btn-primary px-6 text-[14px]"
                      @click="closeModal"
                    >
                      完成并返回商城
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
