/** @type {import('tailwindcss').Config} */
/* 严格映射自 DESIGN.md (VoltAgent/awesome-design-md · Revolut) */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 品牌主色（克制使用：仅限品牌标、主推套餐卡、高亮徽标与焦点环）
        primary: {
          DEFAULT: '#494fdf',
          bright: '#4f55f1',
          deep: '#3a40c4',
        },
        // 双模画布与表面阶梯
        canvas: {
          light: '#ffffff',
          dark: '#000000',
        },
        surface: {
          soft: '#f4f4f4',
          card: '#ffffff',
          deep: '#0a0a0a',
          elevated: '#16181a',
        },
        // 细分隔线
        hairline: {
          light: '#e2e2e7',
          dark: 'rgba(255, 255, 255, 0.12)',
          strong: '#191c1f',
        },
        'divider-soft': 'rgba(255, 255, 255, 0.06)',
        // 文字阶梯
        ink: '#191c1f',
        body: '#1f2226',
        charcoal: '#3a3d40',
        mute: '#505a63',
        ash: '#5c5e60',
        stone: '#8d969e',
        faint: '#c9c9cd',
        'on-dark': '#ffffff',
        'on-dark-mute': 'rgba(255, 255, 255, 0.72)',
        // 产品插画/图标/语义限定辅助色（禁止作为常规按钮底色）
        accent: {
          teal: '#00a87e',
          'blue-link': '#376cd5',
          'light-blue': '#007bc2',
          'light-green': '#428619',
          'green-text': '#006400',
          yellow: '#b09000',
          warning: '#ec7e00',
          pink: '#e61e49',
          danger: '#e23b4a',
          'deep-red': '#8b0000',
          brown: '#936d62',
        },
      },
      fontFamily: {
        // 全站统一思源宋体（参考 kai-wei-kfuse/claude-siyuan-font：Noto Serif SC / Source Han Serif SC）
        display: [
          '"Noto Serif SC Variable"',
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"思源宋体"',
          '"Songti SC"',
          '"STSong"',
          '"SimSun"',
          'serif',
        ],
        sans: [
          '"Noto Serif SC Variable"',
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"思源宋体"',
          '"Songti SC"',
          '"STSong"',
          '"SimSun"',
          'serif',
        ],
        serif: [
          '"Noto Serif SC Variable"',
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"思源宋体"',
          '"Songti SC"',
          '"STSong"',
          '"SimSun"',
          'serif',
        ],
        mono: [
          '"Noto Serif SC Variable"',
          '"Noto Serif SC"',
          '"Source Han Serif SC"',
          '"思源宋体"',
          '"Songti SC"',
          '"STSong"',
          '"SimSun"',
          'serif',
        ],
      },
      borderRadius: {
        none: '0px',
        sm: '8px',
        md: '12px',
        lg: '20px',
        xl: '28px',
        full: '9999px',
      },
      spacing: {
        section: '88px',
        band: '120px',
        block: '80px',
      },
      maxWidth: {
        container: '1200px',
      },
    },
  },
  plugins: [],
};
