import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  // GitHub Pages 專案頁面的子路徑：https://mangochu.github.io/pcr-cb-timecalc/
  base: '/pcr-cb-timecalc/',
  plugins: [vue()],
  worker: {
    format: 'es',
  },
})
