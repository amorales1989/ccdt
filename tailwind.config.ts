import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			colors: {
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				// COLOR PRINCIPAL 1: Azul
				primary: {
					DEFAULT: '#2563eb',
					foreground: '#ffffff',
					50: '#eff6ff',
					100: '#dbeafe',
					200: '#bfdbfe',
					300: '#93c5fd',
					400: '#60a5fa',
					500: '#3b82f6',
					600: '#2563eb',
					700: '#1d4ed8',
					800: '#1e40af',
					900: '#1e3a8a',
				},
				// COLOR PRINCIPAL 2: Navy
				secondary: {
					DEFAULT: '#0f172a',
					foreground: '#f8fafc',
					50: '#f8fafc',
					100: '#f1f5f9',
					200: '#e2e8f0',
					300: '#cbd5e1',
					400: '#94a3b8',
					500: '#64748b',
					600: '#475569',
					700: '#334155',
					800: '#1e293b',
					900: '#0f172a',
				},
				// Accent basado en primary (tonos más claros del azul)
				accent: {
					DEFAULT: '#60a5fa', // primary-400
					foreground: '#ffffff',
					50: '#eff6ff',
					100: '#dbeafe',
					200: '#bfdbfe',
					300: '#93c5fd',
					400: '#60a5fa',
					500: '#3b82f6',
					600: '#2563eb',
					700: '#1d4ed8',
					800: '#1e40af',
					900: '#1e3a8a',
				},
				// Muted basado en secondary (tonos medios del navy/gris)
				muted: {
					DEFAULT: '#64748b', // secondary-500
				},
				// Neutral basado en secondary
				neutral: {
					DEFAULT: '#64748b', // secondary-500
					foreground: '#ffffff',
					50: '#f8fafc',
					100: '#f1f5f9',
					200: '#e2e8f0',
					300: '#cbd5e1',
					400: '#94a3b8',
					500: '#64748b',
					600: '#475569',
					700: '#334155',
					800: '#1e293b',
					900: '#0f172a',
				},
				// ALERTS - SE MANTIENEN IGUAL
				destructive: {
					DEFAULT: '#ef4444', // Rojo moderno
					foreground: '#ffffff'
				},
				success: {
					DEFAULT: '#059669', // Verde esmeralda moderno
					foreground: '#ffffff',
					50: '#ecfdf5',
					100: '#d1fae5',
					200: '#a7f3d0',
					300: '#6ee7b7',
					400: '#34d399',
					500: '#10b981',
					600: '#059669',
					700: '#047857',
					800: '#065f46',
					900: '#064e3b',
				},
				warning: {
					DEFAULT: '#f59e0b', // Amarillo/naranja moderno
					foreground: '#ffffff',
					50: '#fffbeb',
					100: '#fef3c7',
					200: '#fde68a',
					300: '#fcd34d',
					400: '#fbbf24',
					500: '#f59e0b',
					600: '#d97706',
					700: '#b45309',
					800: '#92400e',
					900: '#78350f',
				},
				info: {
					DEFAULT: '#06b6d4', // Cyan moderno
					foreground: '#ffffff',
					50: '#ecfeff',
					100: '#cffafe',
					200: '#a5f3fc',
					300: '#67e8f9',
					400: '#22d3ee',
					500: '#06b6d4',
					600: '#0891b2',
					700: '#0e7490',
					800: '#155e75',
					900: '#164e63',
				},
				// Resto de colores basados en los 2 principales
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: '#0f172a', // secondary-900
					foreground: '#f8fafc', // secondary-50
					primary: '#2563eb', // primary-600
					'primary-foreground': '#ffffff',
					accent: '#60a5fa', // primary-400
					'accent-foreground': '#ffffff',
					border: '#1e293b', // secondary-800
					ring: '#2563eb' // primary-600
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: { height: '0' },
					to: { height: 'var(--radix-accordion-content-height)' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)' },
					to: { height: '0' }
				},
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'slide-in': {
					'0%': { opacity: '0', transform: 'translateX(-20px)' },
					'100%': { opacity: '1', transform: 'translateX(0)' }
				},
				'pulse-slow': {
					'0%, 100%': { opacity: '1' },
					'50%': { opacity: '0.7' }
				},
				'scale-in': {
					'0%': { transform: 'scale(0.95)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'shimmer': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(100%)' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'fade-in': 'fade-in 0.5s ease-out forwards',
				'slide-in': 'slide-in 0.5s ease-out forwards',
				'pulse-slow': 'pulse-slow 3s infinite',
				'scale-in': 'scale-in 0.3s ease-out',
				'shimmer': 'shimmer 2s infinite'
			},
			backgroundImage: {
				// Gradientes basados en los 2 colores principales
				'gradient-soft': 'linear-gradient(135deg, #2563eb 0%, #0f172a 100%)',
				'gradient-purple': 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)', // primary variants
				'gradient-card': 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)', // secondary light
				'dark-gradient-card': 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', // secondary dark
				'gradient-primary': 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', // primary variants
				'gradient-accent': 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)', // primary variants
				'gradient-success': 'linear-gradient(135deg, #10b981 0%, #059669 100%)', // mantiene success
				'gradient-hero': 'linear-gradient(135deg, #2563eb 0%, #0f172a 50%, #60a5fa 100%)', // basado en los 2 principales
				'gradient-glass': 'linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(15,23,42,0.05) 100%)' // basado en primary y secondary
			},
			boxShadow: {
				'soft': '0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04)',
				'medium': '0 4px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 15px -3px rgba(0, 0, 0, 0.05)',
				'large': '0 10px 35px -5px rgba(0, 0, 0, 0.15), 0 20px 25px -5px rgba(0, 0, 0, 0.1)',
				'glow': '0 0 20px rgba(37, 99, 235, 0.15)', // basado en primary
				'glow-purple': '0 0 20px rgba(96, 165, 250, 0.15)', // basado en primary-400
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;