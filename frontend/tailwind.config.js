import logSharePreset from './tailwind.preset.js'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [logSharePreset],
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}']
}
