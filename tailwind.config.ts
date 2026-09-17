import type { Config } from 'tailwindcss';

const config: Config = {
    content: [
        './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
        './src/components/**/*.{js,ts,jsx,tsx,mdx}',
        './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-suisse)', 'system-ui', 'sans-serif'],
            },
            colors: {
                pirro: {
                    dark: '#000000',
                    sheet: '#F5F5F5',
                    control: '#EBEBEB',
                    inactive: '#4D4D4D',
                    border: '#E2E8F0',
                    limeStart: '#CBEE8F',
                    limeEnd: '#E0E59B',
                },
            },
            borderRadius: {
                card: '24px',
                'card-lg': '40px',
                pill: '999px',
            },
        },
    },
    plugins: [],
};
export default config;