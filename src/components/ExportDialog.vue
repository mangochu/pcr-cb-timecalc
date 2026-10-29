<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { HistoryEntry } from '../composables/useHistory'
import { encodeShareCode, toShareFile, type SharedEntry } from '../lib/share'
import { formatTime } from '../lib/timeline'

const props = defineProps<{ entries: HistoryEntry[] }>()
const emit = defineEmits<{ toast: [message: string] }>()

const dialog = ref<HTMLDialogElement>()
const selected = ref<Set<string>>(new Set())
const code = ref('')

const selectedItems = computed<SharedEntry[]>(() =>
  props.entries.filter((e) => selected.value.has(e.id)).map(({ title, remaining, input }) => ({ title, remaining, input })),
)
const allSelected = computed(() => selected.value.size === props.entries.length)

// 勾選變動就重新產生匯出碼；用序號避免慢的舊結果蓋掉新的
let generation = 0
watch(
  selectedItems,
  async (items) => {
    const current = ++generation
    const next = items.length ? await encodeShareCode(items) : ''
    if (current === generation) code.value = next
  },
  { immediate: true },
)

function open(onlyId?: string) {
  selected.value = new Set(onlyId ? [onlyId] : props.entries.map((e) => e.id))
  dialog.value?.showModal()
}

function toggle(id: string) {
  const next = new Set(selected.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selected.value = next
}

function toggleAll() {
  selected.value = new Set(allSelected.value ? [] : props.entries.map((e) => e.id))
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(code.value)
    emit('toast', `已複製 ${selectedItems.value.length} 筆紀錄的匯出碼`)
  } catch {
    emit('toast', '複製失敗，請手動選取匯出碼')
  }
}

function download() {
  const blob = new Blob([toShareFile(selectedItems.value)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `pcr-timeline-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

defineExpose({ open })
</script>

<template>
  <dialog ref="dialog" class="dialog wide" aria-labelledby="export-title">
    <div class="dialog-body">
      <h2 id="export-title">匯出紀錄</h2>

      <div class="pick-head">
        <span class="muted">選擇要分享的紀錄（{{ selected.size }}/{{ entries.length }}）</span>
        <button type="button" class="ghost" @click="toggleAll">{{ allSelected ? '全部取消' : '全選' }}</button>
      </div>
      <ul class="pick-list">
        <li v-for="e in entries" :key="e.id">
          <label class="checkbox">
            <input type="checkbox" :checked="selected.has(e.id)" @change="toggle(e.id)" />
            <span class="history-time">{{ formatTime(e.remaining) }}</span>
            <span class="pick-title">{{ e.title || '（未命名）' }}</span>
          </label>
        </li>
      </ul>

      <label class="field">
        <span class="field-label">匯出碼（{{ code.length.toLocaleString() }} 字）— 對方在「匯入」貼上即可</span>
        <textarea class="code-box" :value="code" readonly spellcheck="false" @focus="($event.target as HTMLTextAreaElement).select()" />
      </label>

      <div class="dialog-actions">
        <button type="button" class="ghost" @click="dialog?.close()">關閉</button>
        <button type="button" class="ghost" :disabled="!selectedItems.length" @click="download">下載檔案</button>
        <button type="button" class="primary" :disabled="!code" @click="copyCode">複製匯出碼</button>
      </div>
    </div>
  </dialog>
</template>
