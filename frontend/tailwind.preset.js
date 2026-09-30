import typography from '@tailwindcss/typography'

/**
 * LogShare 前端设计范式 - Tailwind 核心预设
 * 包含：低饱和度冷灰语义色彩、7 档圆角阶梯、物理回弹动效、字体映射与自研微阴影
 */
export default {
  darkMode: 'class',
  theme: {
    extend: {
      transitionTimingFunction: {
        'bounce-soft': 'cubic-bezier(0.34, 1.7, 0.64, 1)'
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)']
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        none: '0',
        sm: 'var(--radius-sm)', // 0.25rem (4px)
        DEFAULT: 'var(--radius-md)', // 0.375rem (6px)
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)', // 0.5rem (8px)
        xl: 'var(--radius-xl)', // 0.75rem (12px)
        '2xl': 'var(--radius-2xl)', // 1rem (16px)
        '3xl': 'var(--radius-3xl)', // 1.5rem (24px)
        full: '9999px'
      },
      boxShadow: {
        soft: '0 2px 10px -2px rgba(0, 0, 0, 0.05), 0 1px 3px -1px rgba(0, 0, 0, 0.03)',
        card: '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
        lg: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -4px rgba(0, 0, 0, 0.04)',
        xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)'
      }
    }
  },
  plugins: [typography]
}
