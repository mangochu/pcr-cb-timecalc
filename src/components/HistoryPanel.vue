<script setup lang="ts">
import type { HistoryEntry } from '../composables/useHistory'
import { formatTime } from '../lib/timeline'

defineProps<{ entries: HistoryEntry[] }>()
const emit = defineEmits<{ load: [entry: HistoryEntry]; remove: [id: string]; clear: [] }>()

const dateFormat = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function confirmClear() {
  if (confirm('確定要清除所有紀錄嗎？')) emit('clear')
}
</script>

<template>
  <section class="panel" aria-labelledby="history-title">
    <div class="panel-head">
      <h2 id="history-title">近期紀錄</h2>
      <button v-if="entries.length" type="button" class="ghost" @click="confirmClear">全部清除</button>
    </div>
    <p v-if="!entries.length" class="muted">還沒有紀錄。按「複製」或「存紀錄」後會保存在這台裝置的瀏覽器裡（最多 30 筆）。</p>
    <ul v-else class="history">
      <li v-for="e in entries" :key="e.id">
        <button type="button" class="history-main" @click="emit('load', e)">
          <span class="history-time">{{ formatTime(e.remaining) }}</span>
          <span class="history-title">{{ e.title || '（未命名）' }}</span>
          <span class="history-date">{{ dateFormat.format(e.savedAt) }}</span>
        </button>
        <button type="button" class="ghost icon" :aria-label="`刪除 ${e.title}`" @click="emit('remove', e.id)">✕</button>
      </li>
    </ul>
  </section>
</template>
