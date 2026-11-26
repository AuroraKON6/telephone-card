<script setup lang="ts">
/* Full-bleed 纯黑 #000000 5G 骨干与全球漫游信号地图章节（#network）
 * 集成原生 <SignalMap /> 点阵世界地图与城市间弧线信号脉冲
 * 插入在纯白「横向对比」与纯白「FAQ」之间，强化 Revolut 黑 ↔ 白 硬切节奏
 */
import { ref } from 'vue';
import { ArrowRight, Globe2, Radio } from 'lucide-vue-next';
import SignalMap, {
  type SignalArcDef,
  type SignalCity,
  type SignalTheme,
} from './fx/SignalMap.vue';
import StaggeredText from './fx/StaggeredText.vue';

const cities: SignalCity[] = [
  {
    id: 'beijing',
    name: '北京',
    en: 'BJS',
    region: 'cn',
    lon: 116.4,
    lat: 39.9,
    latencyMs: 11,
    band: '5G-A 3.5GHz + 700MHz 双频聚合',
    note: '北方核心骨干枢纽，四网 5G SA 满格覆盖，支持极速审核发卡。',
  },
  {
    id: 'shanghai',
    name: '上海',
    en: 'SHA',
    region: 'cn',
    lon: 121.5,
    lat: 31.2,
    latencyMs: 9,
    band: '5G 黄金速率 500Mbps · SA 独立组网',
    note: '长三角国际海缆出入口，电信/联通/移动/广电全线稳定直连。',
  },
  {
    id: 'shenzhen',
    name: '深圳',
    en: 'SZX',
    region: 'cn',
    lon: 114.1,
    lat: 22.5,
    latencyMs: 10,
    band: '5G-A 最高 1Gbps · 粤港澳专线',
    note: '华南高速接入枢纽，支持广东专属省内卡与跨境低延迟漫游。',
  },
  {
    id: 'tokyo',
    name: '东京',
    en: 'TYO',
    region: 'apac',
    lon: 139.7,
    lat: 35.7,
    latencyMs: 38,
    band: '5G 国际漫游 · NTT / SoftBank',
    note: '开通运营商官方日韩流量包即可无缝 5G 接入，免换实体卡。',
  },
  {
    id: 'singapore',
    name: '新加坡',
    en: 'SIN',
    region: 'apac',
    lon: 103.8,
    lat: 1.35,
    latencyMs: 46,
    band: '5G 国际漫游 · Singtel',
    note: '东南亚商旅低时延节点，接收国内银行/应用短信验证码零延迟。',
  },
  {
    id: 'sydney',
    name: '悉尼',
    en: 'SYD',
    region: 'apac',
    lon: 151.2,
    lat: -33.8,
    latencyMs: 98,
    band: '5G 国际漫游 · Telstra',
    note: '澳洲留学与差旅稳定保号接收验证码，支持 VoLTE 高清语音。',
  },
  {
    id: 'dubai',
    name: '迪拜',
    en: 'DXB',
    region: 'global',
    lon: 55.3,
    lat: 25.2,
    latencyMs: 106,
    band: '5G 国际漫游 · Etisalat',
    note: '中东转机与商务高频枢纽，运营商官方 App 一键按天订购漫游包。',
  },
  {
    id: 'frankfurt',
    name: '法兰克福',
    en: 'FRA',
    region: 'global',
    lon: 8.7,
    lat: 50.1,
    latencyMs: 118,
    band: '5G 国际漫游 · Telekom DE',
    note: '欧洲大陆骨干中继节点，覆盖申根多国高速漫游网络。',
  },
  {
    id: 'london',
    name: '伦敦',
    en: 'LON',
    region: 'global',
    lon: -0.1,
    lat: 51.5,
    latencyMs: 124,
    band: '5G 国际漫游 · EE / Vodafone',
    note: '英伦直连国际漫游伙伴，支持国内原号码高清通话与短信接收。',
  },
  {
    id: 'newyork',
    name: '纽约',
    en: 'NYC',
    region: 'global',
    lon: -74.0,
    lat: 40.7,
    latencyMs: 158,
    band: '5G 国际漫游 · AT&T / T-Mobile',
    note: '美东跨洋漫游节点，海外出行亦可保留国内主号实时在线。',
  },
  {
    id: 'sanfrancisco',
    name: '旧金山',
    en: 'SFO',
    region: 'global',
    lon: -122.4,
    lat: 37.8,
    latencyMs: 132,
    band: '5G 国际漫游 · T-Mobile 5G',
    note: '太平洋海缆直连西岸，商旅与科技考察无缝衔接。',
  },
];

const arcs: SignalArcDef[] = [
  { from: 'beijing', to: 'shanghai', scope: 'apac' },
  { from: 'shanghai', to: 'shenzhen', scope: 'apac' },
  { from: 'beijing', to: 'tokyo', scope: 'apac' },
  { from: 'shanghai', to: 'tokyo', scope: 'apac' },
  { from: 'shenzhen', to: 'singapore', scope: 'apac' },
  { from: 'singapore', to: 'sydney', scope: 'apac' },
  { from: 'shanghai', to: 'sanfrancisco', scope: 'global' },
  { from: 'beijing', to: 'frankfurt', scope: 'global' },
  { from: 'shenzhen', to: 'dubai', scope: 'global' },
  { from: 'dubai', to: 'london', scope: 'global' },
  { from: 'frankfurt', to: 'london', scope: 'global' },
  { from: 'london', to: 'newyork', scope: 'global' },
  { from: 'sanfrancisco', to: 'newyork', scope: 'global' },
];

const scope = ref<'all' | 'apac'>('all');
const theme = ref<SignalTheme>('cobalt');
const selectedCityId = ref<string | null>('shanghai');

const themes: Array<{ id: SignalTheme; label: string; dot: string }> = [
  { id: 'cobalt', label: '钴蓝脉冲', dot: '#6d73ff' },
  { id: 'emerald', label: '翡翠信号', dot: '#00c495' },
  { id: 'violet', label: '紫焰星轨', dot: '#a855f7' },
];

const networkStats = [
  { value: '5G SA', label: '四网独立组网直连' },
  { value: '700MHz', label: '广电黄金低频强穿透' },
  { value: '200+', label: '官方国际漫游可达地' },
  { value: '11ms', label: '国内骨干平均接入时延' },
];
</script>

<template>
  <section
    id="network"
    class="w-full bg-canvas-dark py-16 text-on-dark sm:py-section lg:py-band"
  >
    <div class="mx-auto max-w-container px-4 sm:px-6">
      <!-- 章节头与链路/配色控制台 -->
      <div v-reveal class="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
        <div class="max-w-2xl">
          <p class="ns-kicker inline-flex items-center gap-2 text-on-dark-mute">
            <Globe2 class="h-4 w-4 text-primary-bright" />
            <span>GLOBAL SIGNAL MAP · 全国骨干与国际漫游网络</span>
          </p>
          <StaggeredText
            as="h2"
            by="char"
            trigger="inview"
            :stagger-ms="36"
            :lines="[{ text: '一张正规卡，' }, { text: '信号连向世界' }]"
            class="type-display-xl mt-3 text-on-dark"
          />
          <p class="mt-4 text-[17px] leading-[1.6] tracking-[0.005em] text-on-dark-mute sm:text-[18px]">
            Direct 5G SA access across all four national carriers, with daily on-demand roaming in 200+ destinations and free incoming SMS verification abroad.
          </p>
        </div>

        <!-- 链路视图与信号色调切换 -->
        <div class="flex flex-wrap items-center gap-2.5">
          <div class="inline-flex rounded-full bg-surface-elevated p-1">
            <button
              type="button"
              class="rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
              :class="scope === 'all' ? 'bg-canvas-light text-canvas-dark' : 'text-on-dark-mute hover:text-white'"
              @click="scope = 'all'"
            >
              全球漫游链路
            </button>
            <button
              type="button"
              class="rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
              :class="scope === 'apac' ? 'bg-canvas-light text-canvas-dark' : 'text-on-dark-mute hover:text-white'"
              @click="scope = 'apac'"
            >
              亚太高速直连
            </button>
          </div>

          <div class="inline-flex items-center gap-1 rounded-full border border-hairline-dark bg-surface-deep p-1">
            <button
              v-for="item in themes"
              :key="item.id"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors"
              :class="theme === item.id ? 'bg-surface-elevated text-white' : 'text-on-dark-mute hover:text-white'"
              @click="theme = item.id"
            >
              <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: item.dot }" />
              <span>{{ item.label }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 点阵世界地图大舞台（统一半透明磨砂暗色卡片边框） -->
      <div
        v-reveal="90"
        class="ns-frosted-card-dark mt-10 overflow-hidden"
      >
        <div class="h-[340px] w-full sm:h-[440px] lg:h-[520px]">
          <SignalMap
            :cities="cities"
            :arcs="arcs"
            :scope="scope"
            :theme="theme"
            :selected-city-id="selectedCityId"
            @select-city="selectedCityId = $event"
          />
        </div>

        <!-- 底部城市快捷切换轨道（点击即锁定高亮该节点与全部关联信号飞弧） -->
        <div class="flex flex-col justify-between gap-3 border-t border-hairline-dark bg-surface-elevated/70 px-4 py-3.5 sm:flex-row sm:items-center sm:px-6">
          <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span class="inline-flex flex-shrink-0 items-center gap-1.5 text-[12px] font-semibold text-on-dark-mute">
              <Radio class="h-3.5 w-3.5 text-accent-teal" />
              <span>枢纽节点：</span>
            </span>
            <button
              v-for="city in cities"
              :key="city.id"
              type="button"
              class="flex-shrink-0 rounded-full px-3 py-1 text-[12px] font-semibold transition-colors"
              :class="
                selectedCityId === city.id
                  ? 'bg-canvas-light text-canvas-dark'
                  : 'bg-canvas-dark/70 text-on-dark-mute hover:text-white'
              "
              @click="selectedCityId = selectedCityId === city.id ? null : city.id"
            >
              {{ city.name }}
            </button>
          </div>

          <a
            href="#catalog"
            class="inline-flex flex-shrink-0 items-center gap-1 text-[13px] font-semibold text-white hover:underline underline-offset-4"
          >
            <span>按我的省份查发货</span>
            <ArrowRight class="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <!-- 4 列硬核网络指标带（Tiagoadag 霓虹外框内缩 + 半透明暗色磨砂玻璃） -->
      <div class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div
          v-for="(stat, idx) in networkStats"
          :key="stat.label"
          v-reveal="idx * 60"
          class="flex"
        >
          <div class="ns-tiago-shell w-full">
            <div class="ns-tiago-inner ns-frosted-card-dark p-6">
              <div class="hero-num text-[30px] text-white sm:text-[34px]">
                {{ stat.value }}
              </div>
              <div class="mt-2.5 text-[14px] text-on-dark-mute">
                {{ stat.label }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
