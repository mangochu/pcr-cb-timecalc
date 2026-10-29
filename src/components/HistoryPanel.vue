<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'
import { defaultTitle, type HistoryEntry } from '../composables/useHistory'
import { formatTime } from '../lib/timeline'

/** 拖曳排序後直接更新紀錄順序 */
const entries = defineModel<HistoryEntry[]>('entries', { required: true })
const emit = defineEmits<{ load: [entry: HistoryEntry]; remove: [id: string]; clear: []; export: []; import: [] }>()

// 24 小時制比「下午05:38」短，紀錄列才放得下
const dateFormat = new Intl.DateTimeFormat('zh-TW', {
  month: 'numeric',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

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

// 重新命名：標題原地變成輸入框，Enter／離開輸入框儲存，Esc 取消
const editingId = ref<string | null>(null)
const editTitle = ref('')
const renameInput = ref<HTMLInputElement[]>([])

async function startRename(entry: HistoryEntry) {
  editingId.value = entry.id
  editTitle.value = entry.title
  await nextTick()
  renameInput.value[0]?.select()
}

function commitRename() {
  const id = editingId.value
  if (!id) return
  editingId.value = null
  entries.value = entries.value.map((e) => (e.id === id ? { ...e, title: editTitle.value.trim() || defaultTitle(e.input) } : e))
  focusRenameButton(id)
}

function cancelRename() {
  const id = editingId.value
  editingId.value = null
  if (id) focusRenameButton(id)
}

async function focusRenameButton(id: string) {
  await nextTick()
  document.querySelector<HTMLElement>(`[data-rename-id="${id}"]`)?.focus()
}
</script>

<template>
  <section class="panel" aria-labelledby="history-title">
    <div class="panel-head">
      <h2 id="history-title">近期紀錄</h2>
      <!-- 收合抽屜的按鈕 -->
      <slot name="actions" />
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
        <div v-if="editingId === e.id" class="history-main editing">
          <span class="history-time">{{ formatTime(e.remaining) }}</span>
          <input
            ref="renameInput"
            v-model="editTitle"
            class="rename-input"
            :aria-label="`重新命名 ${e.title}`"
            placeholder="留空會用時間軸第一行"
            maxlength="100"
            @keydown.enter.prevent="commitRename"
            @keydown.esc.stop.prevent="cancelRename"
            @blur="commitRename"
          />
        </div>
        <button v-else type="button" class="history-main" @click="emit('load', e)">
          <span class="history-time">{{ formatTime(e.remaining) }}</span>
          <span class="history-title">{{ e.title || '（未命名）' }}</span>
          <span class="history-date">{{ dateFormat.format(e.savedAt) }}</span>
        </button>
        <button
          type="button"
          class="ghost icon"
          :data-rename-id="e.id"
          :aria-label="`重新命名 ${e.title}`"
          title="重新命名"
          @mousedown.prevent
          @click="editingId === e.id ? commitRename() : startRename(e)"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
            <path
              d="M10.5 2.5l3 3L5 14H2v-3zM9 4l3 3"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button type="button" class="ghost icon" :aria-label="`刪除 ${e.title}`" title="刪除" @click="emit('remove', e.id)">✕</button>
      </li>
    </VueDraggable>
    <div class="history-footer">
      <span class="actions">
        <button type="button" class="ghost" :disabled="!entries.length" @click="emit('export')">匯出</button>
        <button type="button" class="ghost" @click="emit('import')">匯入</button>
      </span>
      <!-- 放在最下面、跟常用按鈕分開，避免誤觸 -->
      <button v-if="entries.length" type="button" class="danger" @click="confirmClear">全部清除</button>
    </div>
  </section>
</template>
