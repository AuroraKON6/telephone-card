<script setup lang="ts">
/*
 * From Uiverse.io by Nawsome - https://uiverse.io/Nawsome/wet-mayfly-23
 * MIT License, Copyright (c) Nawsome
 *
 * 已适配为 Vue 3 独立组件，并对类名与关键帧进行命名空间隔离，完整保留原始造型、配色与跑轮动画表现。
 */
withDefaults(
  defineProps<{
    /** 控制整体缩放尺寸的基准字号（px，原始默认 14px，对应 12em × 12em = 168px） */
    sizePx?: number;
    /** 跑轮旋转周期（默认 1s，弱网焦虑态可略微提速） */
    duration?: string;
    /** 无障碍描述文本 */
    ariaLabel?: string;
  }>(),
  {
    sizePx: 14,
    duration: '1s',
    ariaLabel: 'Orange and tan hamster running in a metal wheel',
  },
);
</script>

<template>
  <div
    :aria-label="ariaLabel"
    role="img"
    class="ns-wheel-and-hamster"
    :style="{
      fontSize: `${sizePx}px`,
      '--ns-hamster-dur': duration,
    }"
  >
    <div class="ns-wheel" />
    <div class="ns-hamster">
      <div class="ns-hamster__body">
        <div class="ns-hamster__head">
          <div class="ns-hamster__ear" />
          <div class="ns-hamster__eye" />
          <div class="ns-hamster__nose" />
        </div>
        <div class="ns-hamster__limb ns-hamster__limb--fr" />
        <div class="ns-hamster__limb ns-hamster__limb--fl" />
        <div class="ns-hamster__limb ns-hamster__limb--br" />
        <div class="ns-hamster__limb ns-hamster__limb--bl" />
        <div class="ns-hamster__tail" />
      </div>
    </div>
    <div class="ns-spoke" />
  </div>
</template>

<style scoped>
/*
 * From Uiverse.io by Nawsome - https://uiverse.io/Nawsome/wet-mayfly-23
 * MIT License, Copyright (c) Nawsome
 */
.ns-wheel-and-hamster {
  --ns-hamster-dur: 1s;
  position: relative;
  width: 12em;
  height: 12em;
  font-size: 14px;
}

.ns-wheel,
.ns-hamster,
.ns-hamster div,
.ns-spoke {
  position: absolute;
}

.ns-wheel,
.ns-spoke {
  border-radius: 50%;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.ns-wheel {
  background: radial-gradient(
    100% 100% at center,
    hsla(0, 0%, 60%, 0) 47.8%,
    hsl(0, 0%, 60%) 48%
  );
  z-index: 2;
}

.ns-hamster {
  animation: ns-hamster var(--ns-hamster-dur) ease-in-out infinite;
  top: 50%;
  left: calc(50% - 3.5em);
  width: 7em;
  height: 3.75em;
  transform: rotate(4deg) translate(-0.8em, 1.85em);
  transform-origin: 50% 0;
  z-index: 1;
}

.ns-hamster__head {
  animation: ns-hamster-head var(--ns-hamster-dur) ease-in-out infinite;
  background: hsl(30, 90%, 55%);
  border-radius: 70% 30% 0 100% / 40% 25% 25% 60%;
  box-shadow:
    0 -0.25em 0 hsl(30, 90%, 80%) inset,
    0.75em -1.55em 0 hsl(30, 90%, 90%) inset;
  top: 0;
  left: -2em;
  width: 2.75em;
  height: 2.5em;
  transform-origin: 100% 50%;
}

.ns-hamster__ear {
  animation: ns-hamster-ear var(--ns-hamster-dur) ease-in-out infinite;
  background: hsl(0, 90%, 85%);
  border-radius: 50%;
  box-shadow: -0.25em 0 hsl(30, 90%, 55%) inset;
  top: -0.25em;
  right: -0.25em;
  width: 0.75em;
  height: 0.75em;
  transform-origin: 50% 75%;
}

.ns-hamster__eye {
  animation: ns-hamster-eye var(--ns-hamster-dur) linear infinite;
  background-color: hsl(0, 0%, 0%);
  border-radius: 50%;
  top: 0.375em;
  left: 1.25em;
  width: 0.5em;
  height: 0.5em;
}

.ns-hamster__nose {
  background: hsl(0, 90%, 75%);
  border-radius: 35% 65% 85% 15% / 70% 50% 50% 30%;
  top: 0.75em;
  left: 0;
  width: 0.2em;
  height: 0.25em;
}

.ns-hamster__body {
  animation: ns-hamster-body var(--ns-hamster-dur) ease-in-out infinite;
  background: hsl(30, 90%, 90%);
  border-radius: 50% 30% 50% 30% / 15% 60% 40% 40%;
  box-shadow:
    0.1em 0.75em 0 hsl(30, 90%, 55%) inset,
    0.15em -0.5em 0 hsl(30, 90%, 80%) inset;
  top: 0.25em;
  left: 2em;
  width: 4.5em;
  height: 3em;
  transform-origin: 17% 50%;
  transform-style: preserve-3d;
}

.ns-hamster__limb--fr,
.ns-hamster__limb--fl {
  clip-path: polygon(0 0, 100% 0, 70% 80%, 60% 100%, 0% 100%, 40% 80%);
  top: 2em;
  left: 0.5em;
  width: 1em;
  height: 1.5em;
  transform-origin: 50% 0;
}

.ns-hamster__limb--fr {
  animation: ns-hamster-fr-limb var(--ns-hamster-dur) linear infinite;
  background: linear-gradient(hsl(30, 90%, 80%) 80%, hsl(0, 90%, 75%) 80%);
  transform: rotate(15deg) translateZ(-1px);
}

.ns-hamster__limb--fl {
  animation: ns-hamster-fl-limb var(--ns-hamster-dur) linear infinite;
  background: linear-gradient(hsl(30, 90%, 90%) 80%, hsl(0, 90%, 85%) 80%);
  transform: rotate(15deg);
}

.ns-hamster__limb--br,
.ns-hamster__limb--bl {
  border-radius: 0.75em 0.75em 0 0;
  clip-path: polygon(
    0 0,
    100% 0,
    100% 30%,
    70% 90%,
    70% 100%,
    30% 100%,
    40% 90%,
    0% 30%
  );
  top: 1em;
  left: 2.8em;
  width: 1.5em;
  height: 2.5em;
  transform-origin: 50% 30%;
}

.ns-hamster__limb--br {
  animation: ns-hamster-br-limb var(--ns-hamster-dur) linear infinite;
  background: linear-gradient(hsl(30, 90%, 80%) 90%, hsl(0, 90%, 75%) 90%);
  transform: rotate(-25deg) translateZ(-1px);
}

.ns-hamster__limb--bl {
  animation: ns-hamster-bl-limb var(--ns-hamster-dur) linear infinite;
  background: linear-gradient(hsl(30, 90%, 90%) 90%, hsl(0, 90%, 85%) 90%);
  transform: rotate(-25deg);
}

.ns-hamster__tail {
  animation: ns-hamster-tail var(--ns-hamster-dur) linear infinite;
  background: hsl(0, 90%, 85%);
  border-radius: 0.25em 50% 50% 0.25em;
  box-shadow: 0 -0.2em 0 hsl(0, 90%, 75%) inset;
  top: 1.5em;
  right: -0.5em;
  width: 1em;
  height: 0.5em;
  transform: rotate(30deg) translateZ(-1px);
  transform-origin: 0.25em 0.25em;
}

.ns-spoke {
  animation: ns-spoke var(--ns-hamster-dur) linear infinite;
  background:
    radial-gradient(100% 100% at center, hsl(0, 0%, 60%) 4.8%, hsla(0, 0%, 60%, 0) 5%),
    linear-gradient(
        hsla(0, 0%, 55%, 0) 46.9%,
        hsl(0, 0%, 65%) 47% 52.9%,
        hsla(0, 0%, 65%, 0) 53%
      )
      50% 50% / 99% 99% no-repeat;
}

@keyframes ns-hamster {
  from,
  to {
    transform: rotate(4deg) translate(-0.8em, 1.85em);
  }

  50% {
    transform: rotate(0) translate(-0.8em, 1.85em);
  }
}

@keyframes ns-hamster-head {
  from,
  25%,
  50%,
  75%,
  to {
    transform: rotate(0);
  }

  12.5%,
  37.5%,
  62.5%,
  87.5% {
    transform: rotate(8deg);
  }
}

@keyframes ns-hamster-eye {
  from,
  90%,
  to {
    transform: scaleY(1);
  }

  95% {
    transform: scaleY(0);
  }
}

@keyframes ns-hamster-ear {
  from,
  25%,
  50%,
  75%,
  to {
    transform: rotate(0);
  }

  12.5%,
  37.5%,
  62.5%,
  87.5% {
    transform: rotate(12deg);
  }
}

@keyframes ns-hamster-body {
  from,
  25%,
  50%,
  75%,
  to {
    transform: rotate(0);
  }

  12.5%,
  37.5%,
  62.5%,
  87.5% {
    transform: rotate(-2deg);
  }
}

@keyframes ns-hamster-fr-limb {
  from,
  25%,
  50%,
  75%,
  to {
    transform: rotate(50deg) translateZ(-1px);
  }

  12.5%,
  37.5%,
  62.5%,
  87.5% {
    transform: rotate(-30deg) translateZ(-1px);
  }
}

@keyframes ns-hamster-fl-limb {
  from,
  25%,
  50%,
  75%,
  to {
    transform: rotate(-30deg);
  }

  12.5%,
  37.5%,
  62.5%,
  87.5% {
    transform: rotate(50deg);
  }
}

@keyframes ns-hamster-br-limb {
  from,
  25%,
  50%,
  75%,
  to {
    transform: rotate(-60deg) translateZ(-1px);
  }

  12.5%,
  37.5%,
  62.5%,
  87.5% {
    transform: rotate(20deg) translateZ(-1px);
  }
}

@keyframes ns-hamster-bl-limb {
  from,
  25%,
  50%,
  75%,
  to {
    transform: rotate(20deg);
  }

  12.5%,
  37.5%,
  62.5%,
  87.5% {
    transform: rotate(-60deg);
  }
}

@keyframes ns-hamster-tail {
  from,
  25%,
  50%,
  75%,
  to {
    transform: rotate(30deg) translateZ(-1px);
  }

  12.5%,
  37.5%,
  62.5%,
  87.5% {
    transform: rotate(10deg) translateZ(-1px);
  }
}

@keyframes ns-spoke {
  from {
    transform: rotate(0);
  }

  to {
    transform: rotate(-1turn);
  }
}
</style>
