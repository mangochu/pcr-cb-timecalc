<script setup lang="ts">
import { nextTick } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import type { HistoryEntry } from '../composables/useHistory'
import { formatTime } from '../lib/timeline'

/** 拖曳排序後直接更新紀錄順序 */
const entries = defineModel<HistoryEntry[]>('entries', { required: true })
const emit = defineEmits<{ load: [entry: HistoryEntry]; remove: [id: string]; clear: [] }>()

const dateFormat = new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

function confirmClear() {
  if (confirm('確定要清除所有紀錄嗎？')) emit('clear')
}

// 鍵盤：在把手上按 ↑ ↓ 移動
async function move(index: number, delta: number) {
  const to = index + delta
  if (to < 0 || to >= entries.value.length) return
  const next = [...entries.value]
  const [item] = next.splice(index, 1)
  next.splice(to, 0, item)
  entries.value = next
  await nextTick()
  document.querySelector<HTMLElement>(`[data-handle-id="${item.id}"]`)?.focus()
}
</script>

<template>
  <section class="panel" aria-labelledby="history-title">
    <div class="panel-head">
      <h2 id="history-title">近期紀錄</h2>
      <button v-if="entries.length" type="button" class="ghost" @click="confirmClear">全部清除</button>
    </div>
    <p v-if="!entries.length" class="muted">還沒有紀錄。按「複製」或「存紀錄」後會保存在這台裝置的瀏覽器裡（最多 30 筆）。</p>
    <VueDraggable
      v-else
      v-model="entries"
      tag="ul"
      class="history"
      handle=".drag-handle"
      :animation="150"
      ghost-class="history-ghost"
      chosen-class="history-chosen"
    >
      <li v-for="(e, i) in entries" :key="e.id">
        <button
          type="button"
          class="drag-handle"
          :data-handle-id="e.id"
          :aria-label="`拖曳排序：${e.title}（也可以用上下方向鍵移動）`"
          @keydown.up.prevent="move(i, -1)"
          @keydown.down.prevent="move(i, 1)"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </button>
        <button type="button" class="history-main" @click="emit('load', e)">
          <span class="history-time">{{ formatTime(e.remaining) }}</span>
          <span class="history-title">{{ e.title || '（未命名）' }}</span>
          <span class="history-date">{{ dateFormat.format(e.savedAt) }}</span>
        </button>
        <button type="button" class="ghost icon" :aria-label="`刪除 ${e.title}`" @click="emit('remove', e.id)">✕</button>
      </li>
    </VueDraggable>
  </section>
</template>
