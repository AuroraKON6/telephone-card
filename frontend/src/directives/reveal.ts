import type { Directive } from 'vue';

/**
 * v-reveal 滚动入场指令（基于原生 IntersectionObserver，零轮询）
 * 用法：v-reveal 或 v-reveal="120"（毫秒级错峰延迟）
 */
const observerMap = new WeakMap<HTMLElement, IntersectionObserver>();

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export const vReveal: Directive<HTMLElement, number | undefined> = {
  mounted(el, binding) {
    const delay = typeof binding.value === 'number' ? binding.value : 0;
    el.classList.add('reveal-item');
    if (delay > 0) {
      el.style.setProperty('--reveal-delay', `${delay}ms`);
    }

    if (prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      el.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('is-visible');
            observer.unobserve(el);
            observer.disconnect();
            observerMap.delete(el);
          }
        }
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -36px 0px',
      },
    );

    observer.observe(el);
    observerMap.set(el, observer);
  },
  unmounted(el) {
    const observer = observerMap.get(el);
    if (observer) {
      observer.disconnect();
      observerMap.delete(el);
    }
  },
};
