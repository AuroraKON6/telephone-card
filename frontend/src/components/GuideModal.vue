<script setup lang="ts">
/* 查单 / 激活 / 合规白皮书快捷指引弹窗 */
import { computed } from 'vue';
import { ShieldCheck, X } from 'lucide-vue-next';
import { GUIDE_TILES } from '@/data/plans';
import { useStorefront } from '@/composables/useStorefront';

const { activeGuideId, closeGuide } = useStorefront();

const currentGuide = computed(
  () => GUIDE_TILES.find((g) => g.id === activeGuideId.value) ?? null,
);
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-fade">
      <div
        v-if="currentGuide"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
        role="dialog"
        aria-modal="true"
        :aria-label="currentGuide.title"
        @click.self="closeGuide"
      >
        <div class="modal-panel w-full max-w-lg overflow-hidden rounded-xl bg-canvas-light text-ink">
        <div class="flex items-start justify-between gap-4 border-b border-hairline-light px-6 py-5">
          <div>
            <span class="rounded-full bg-surface-soft px-3 py-1 text-[12px] font-semibold text-ink">
              {{ currentGuide.tag }}
            </span>
            <h3 class="mt-2 font-display text-[22px] font-medium text-ink">
              {{ currentGuide.title }}
            </h3>
          </div>
          <button
            type="button"
            class="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-soft text-ink hover:bg-[#e6e6eb]"
            aria-label="关闭指引"
            @click="closeGuide"
          >
            <X class="h-4 w-4" />
          </button>
        </div>

        <div class="px-6 py-6">
          <ol class="space-y-4">
            <li
              v-for="(step, idx) in currentGuide.steps"
              :key="step"
              class="flex items-start gap-3.5"
            >
              <span class="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-canvas-dark text-[13px] font-semibold text-white tabular">
                {{ idx + 1 }}
              </span>
              <p class="pt-0.5 text-[15px] leading-[1.6] text-body">{{ step }}</p>
            </li>
          </ol>

          <div class="mt-6 flex items-start gap-2.5 rounded-md bg-surface-soft p-4 text-[13px] leading-[1.55] text-mute">
            <ShieldCheck class="mt-0.5 h-4 w-4 flex-shrink-0 text-ink" />
            <p>{{ currentGuide.notice }}</p>
          </div>
        </div>

        <div class="flex justify-end border-t border-hairline-light px-6 py-4">
          <button type="button" class="btn-dark px-6 text-[14px]" @click="closeGuide">
            我明白了
          </button>
        </div>
      </div>
      </div>
    </Transition>
  </Teleport>
</template>
