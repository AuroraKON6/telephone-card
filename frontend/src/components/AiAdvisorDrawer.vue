<script setup lang="ts">
/* AI 智能选卡顾问侧滑抽屉
 * 视觉升级：发光玻璃态 AI 光球 WebGL2 背景（AiBlob，联动待机/聆听/思考/播报四态）+ 高对比度暗黑磨砂玻璃对话界面
 * 特性：自然语言实时匹配真实号卡 + 严格本地隐私门（拦截 18 位身份证/手机号/银行卡）+ Escape 快捷关闭
 */
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  AlertTriangle,
  ArrowUpRight,
  Scale,
  Send,
  ShieldCheck,
  X,
} from 'lucide-vue-next';
import { useStorefront } from '@/composables/useStorefront';
import { fxEnabled, triggerSpark } from '@/composables/useSpark';
import ThinkingOrb from './fx/ThinkingOrb.vue';
import AiBlob, { type AiBlobState } from './fx/AiBlob.vue';
import LuminousSearchInput from './fx/LuminousSearchInput.vue';
import type { SimPlan } from '@/types/sim';

const {
  allPlans,
  backendMode,
  isAdvisorOpen,
  advisorMessages,
  closeAdvisor,
  sendAdvisorPrompt,
  openDetail,
  toggleCompare,
  isCompared,
} = useStorefront();

const draft = ref('');
const scrollBox = ref<HTMLElement | null>(null);
const isThinking = ref(false);
const isSpeaking = ref(false);
const isInputFocused = ref(false);
let speakTimer: ReturnType<typeof setTimeout> | null = null;

/** 驱动 AI Blob 玻璃光球的四态状态机 */
const blobState = computed<AiBlobState>(() => {
  if (isThinking.value) return 'thinking';
  if (isSpeaking.value) return 'speaking';
  if (isInputFocused.value || draft.value.trim().length > 0) return 'listening';
  return 'idle';
});

const statusSubtitle = computed(() => {
  if (blobState.value === 'thinking') return '正在请求服务器 cardshop 核验引擎…';
  if (blobState.value === 'speaking') return '服务器已返回核验结果，可点击查看详情';
  if (blobState.value === 'listening') return '正在聆听你的预算、省份与用卡偏好…';
  return backendMode.value === 'offline'
    ? '离线本地匹配模式（隐私门已启用）'
    : '已直连服务器 cardshop 核验引擎';
});

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isAdvisorOpen.value) {
    closeAdvisor();
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown);
  if (speakTimer) clearTimeout(speakTimer);
});

const presetPrompts = [
  '办理流程是怎样的？需要准备什么？',
  '预算 29 元以内，长期不变价，通用流量越多越好',
  '激活首充有哪些注意事项？合约期怎么看？',
  '站内会收集我的身份证号或手机号吗？',
];

function getPlansByIds(ids?: string[]): SimPlan[] {
  if (!ids || ids.length === 0) return [];
  return ids
    .map((id) => allPlans.value.find((p) => p.id === id))
    .filter((p): p is SimPlan => Boolean(p));
}

async function submitDraft(customText?: string) {
  const val = (customText ?? draft.value).trim();
  if (!val || isThinking.value) return;
  if (!customText) draft.value = '';

  // 若命中本地隐私拦截直接瞬时响应，不进入思考态
  const looksSensitive =
    /(?<!\d)[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx](?!\d)/.test(val.replace(/\s+/g, '')) ||
    /(?<!\d)1[3-9]\d{9}(?!\d)/.test(val.replace(/\s+/g, '')) ||
    /(?<!\d)\d{16,19}(?!\d)/.test(val.replace(/\s+/g, ''));

  if (looksSensitive) {
    await sendAdvisorPrompt(val);
    return;
  }

  isSpeaking.value = false;
  isThinking.value = true;
  if (speakTimer) clearTimeout(speakTimer);
  try {
    await sendAdvisorPrompt(val);
  } finally {
    isThinking.value = false;
    isSpeaking.value = true;
    speakTimer = setTimeout(() => {
      isSpeaking.value = false;
    }, 2600);
  }
}

watch(
  () => advisorMessages.value.length,
  async () => {
    await nextTick();
    if (scrollBox.value) {
      scrollBox.value.scrollTop = scrollBox.value.scrollHeight;
    }
  },
);
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-slide">
      <div
        v-if="isAdvisorOpen"
        class="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-label="NovaSIM AI 智能选卡顾问"
        @click.self="closeAdvisor"
      >
        <div class="drawer-panel relative flex h-full w-full max-w-lg flex-col overflow-hidden border-l border-white/15 bg-canvas-dark text-on-dark">
          <!-- WebGL2 发光玻璃态 AI 光球背景（支持待机/聆听/思考/播报四态实时联动） -->
          <div
            v-if="fxEnabled"
            class="pointer-events-none absolute inset-0 z-0"
            aria-hidden="true"
          >
            <AiBlob
              :state="blobState"
              primary-color="#494fdf"
              secondary-color="#22d3ee"
              accent-color="#c084fc"
              :center-y="0.33"
              :radius="0.27"
            />
          </div>

          <!-- 顶部磨砂导航头（内置 ThinkingOrb 点阵星轨光球） -->
          <div class="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/65 px-5 py-4 backdrop-blur-md">
            <div class="flex items-center gap-3">
              <span class="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/70">
                <ThinkingOrb :size="24" :active="isThinking || isSpeaking" tone="cobalt" />
              </span>
              <div>
                <div class="font-display text-[17px] font-medium text-white">
                  AI 智能选卡顾问
                </div>
                <div class="text-[12px] text-white/70">
                  {{ statusSubtitle }}
                </div>
              </div>
            </div>
            <button
              type="button"
              class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white transition-colors hover:bg-white/15"
              aria-label="关闭 AI 顾问"
              @click="closeAdvisor"
            >
              <X class="h-4 w-4" />
            </button>
          </div>

          <!-- 隐私红线提示带 -->
          <div class="relative z-10 flex items-center gap-2 border-b border-white/10 bg-black/55 px-5 py-2.5 text-[12px] text-white/75 backdrop-blur-md">
            <ShieldCheck class="h-4 w-4 flex-shrink-0 text-accent-teal" />
            <span>隐私门已开启：请勿输入身份证号、手机号或家庭详细地址。</span>
          </div>

          <!-- 对话流（高透暗黑玻璃气泡，背后清晰可见黑洞光子环旋转） -->
          <div ref="scrollBox" class="relative z-10 flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div
              v-for="msg in advisorMessages"
              :key="msg.id"
              class="flex flex-col"
              :class="msg.role === 'user' ? 'items-end' : 'items-start'"
            >
              <div
                class="max-w-[92%] rounded-lg px-4 py-3 text-[14px] leading-[1.6] backdrop-blur-md"
                :class="
                  msg.role === 'user'
                    ? 'border border-primary-bright/50 bg-primary/90 text-white'
                    : msg.isPrivacyWarning
                      ? 'border border-accent-danger/75 bg-[#22060c]/95 text-[#ffe4e6]'
                      : 'border border-white/15 bg-black/75 text-white/95'
                "
              >
                <div v-if="msg.isPrivacyWarning" class="mb-1 flex items-center gap-1.5 font-semibold text-[#fda4af]">
                  <AlertTriangle class="h-4 w-4" />
                  <span>敏感隐私已拦截</span>
                </div>
                <div
                  v-else-if="msg.role === 'assistant' && msg.sourceLabel"
                  class="mb-1.5 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10.5px] font-semibold text-white/75"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-accent-teal" />
                  <span>{{ msg.sourceLabel }}</span>
                </div>
                <p class="whitespace-pre-line">{{ msg.text }}</p>
              </div>

              <!-- 推荐套餐卡列表（暗黑磨砂卡面 + 纯白主胶囊） -->
              <div
                v-if="msg.recommendedIds && msg.recommendedIds.length > 0"
                class="mt-3 w-full space-y-2.5"
              >
                <div
                  v-for="plan in getPlansByIds(msg.recommendedIds)"
                  :key="plan.id"
                  class="ns-frosted-card-dark p-4 transition-colors hover:border-white/35"
                >
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <div class="text-[12px] font-semibold text-white/65">
                        {{ plan.carrier }} · {{ plan.offerDuration }}
                      </div>
                      <div class="mt-0.5 font-display text-[16px] font-medium text-white">
                        {{ plan.name }}
                      </div>
                    </div>
                    <div class="text-right tabular">
                      <span class="font-display text-[22px] font-medium text-white">¥{{ plan.monthlyPrice }}</span>
                      <span class="text-[12px] text-white/65">/月</span>
                    </div>
                  </div>
                  <div class="mt-2 flex flex-wrap gap-2 text-[12px] text-white/85 tabular">
                    <span class="rounded-full bg-white/10 px-2.5 py-0.5">
                      {{ plan.generalDataGb }}G 通用
                    </span>
                    <span v-if="plan.voiceMinutes > 0" class="rounded-full bg-white/10 px-2.5 py-0.5">
                      {{ plan.voiceMinutes }} 分钟通话
                    </span>
                    <span class="rounded-full bg-white/10 px-2.5 py-0.5">
                      {{ plan.contractMonths === 0 ? '无合约' : `${plan.contractMonths}个月合约` }}
                    </span>
                  </div>
                  <div class="mt-3 flex items-center gap-2">
                    <button
                      type="button"
                      class="inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-full bg-canvas-light px-3 text-[13px] font-semibold text-canvas-dark transition-colors hover:bg-[#ececef]"
                      @click="
                        closeAdvisor();
                        openDetail(plan.id);
                      "
                    >
                      <span>看详细账单</span>
                      <ArrowUpRight class="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      class="inline-flex h-9 items-center justify-center gap-1 rounded-full border px-3 text-[13px] font-semibold transition-colors"
                      :class="
                        isCompared(plan.id)
                          ? 'border-primary bg-primary text-white'
                          : 'border-white/25 bg-black/40 text-white hover:bg-white/15'
                      "
                      @click="
                        !isCompared(plan.id) && triggerSpark($event, ['#6d73ff', '#00e5a8', '#ffffff']);
                        toggleCompare(plan.id);
                      "
                    >
                      <Scale class="h-3.5 w-3.5" />
                      <span>{{ isCompared(plan.id) ? '已选' : '对比' }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <span class="mt-1 px-1 text-[11px] text-white/45">{{ msg.timestamp }}</span>
            </div>

            <!-- Thinking Orb 思考态气泡 -->
            <div
              v-if="isThinking"
              class="flex items-center gap-3 rounded-lg border border-primary-bright/40 bg-black/70 px-4 py-3 text-[13px] font-semibold text-white backdrop-blur-md"
            >
              <ThinkingOrb :size="22" active tone="cobalt" />
              <span>正在检索 31 省禁发库与 24 个月总成本…</span>
            </div>

            <!-- 快捷提问胶囊 -->
            <div class="pt-2">
              <div class="text-[12px] font-semibold text-white/65">试试一键提问：</div>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="q in presetPrompts"
                  :key="q"
                  type="button"
                  class="rounded-full border border-white/15 bg-black/55 px-3.5 py-1.5 text-left text-[12px] font-semibold text-white/85 backdrop-blur-md transition-colors hover:border-white/35 hover:bg-white/15 hover:text-white"
                  @click="submitDraft(q)"
                >
                  {{ q }}
                </button>
              </div>
            </div>
          </div>

          <!-- 底部旋转流光检索输入栏 -->
          <form
            class="relative z-10 flex items-center gap-3 border-t border-white/15 bg-black/75 p-4 backdrop-blur-md"
            @submit.prevent="submitDraft()"
          >
            <div class="min-w-0 flex-1">
              <LuminousSearchInput
                v-model="draft"
                placeholder="例如：预算 30 以内、发浙江、长期大流量..."
                aria-label="输入你的选卡需求"
                :show-filter="false"
                :height-px="50"
                @focus="isInputFocused = true"
                @blur="isInputFocused = false"
              />
            </div>
            <button
              type="submit"
              class="inline-flex h-[50px] w-[50px] flex-shrink-0 items-center justify-center rounded-full bg-canvas-light text-canvas-dark transition-colors hover:bg-[#ececef] disabled:opacity-35"
              :disabled="!draft.trim()"
              aria-label="发送需求"
            >
              <Send class="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
