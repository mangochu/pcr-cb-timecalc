<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MAX_ENTRIES } from '../composables/useHistory'
import { decodeShare, type SharedEntry } from '../lib/share'
import { formatTime } from '../lib/timeline'

const props = defineProps<{
  /** 目前已有的紀錄數 */
  count: number
  /** 判斷是否已經存在 */
  has: (item: SharedEntry) => boolean
}>()
const emit = defineEmits<{ import: [items: SharedEntry[]] }>()

const dialog = ref<HTMLDialogElement>()
const fileInput = ref<HTMLInputElement>()
const text = ref('')
const items = ref<SharedEntry[]>([])
const error = ref('')

const fresh = computed(() => items.value.filter((item) => !props.has(item)))
// 匯入後超過上限時，最下面的會被擠掉
const overflow = computed(() => Math.max(0, props.count + fresh.value.length - MAX_ENTRIES))

let generation = 0
watch(text, async (value) => {
  const current = ++generation
  if (!value.trim()) {
    items.value = []
    error.value = ''
    return
  }
  try {
    const decoded = await decodeShare(value)
    if (current !== generation) return
    items.value = decoded
    error.value = ''
  } catch (err) {
    if (current !== generation) return
    items.value = []
    error.value = err instanceof Error ? err.message : String(err)
  }
})

function open() {
  text.value = ''
  dialog.value?.showModal()
}

async function onFile(event: Event) {
  const el = event.target as HTMLInputElement
  const file = el.files?.[0]
  if (file) text.value = await file.text()
  el.value = ''
}

function confirm() {
  emit('import', items.value)
  dialog.value?.close()
}

defineExpose({ open })
</script>

<template>
  <dialog ref="dialog" class="dialog wide" aria-labelledby="import-title">
    <div class="dialog-body">
      <h2 id="import-title">匯入紀錄</h2>

      <label class="field">
        <span class="field-label">貼上匯出碼，或選擇匯出的 .json 檔</span>
        <textarea v-model="text" class="code-box" spellcheck="false" placeholder="PCRTL1.…" />
      </label>
      <div>
        <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onFile" />
        <button type="button" class="ghost" @click="fileInput?.click()">選擇檔案…</button>
      </div>

      <p v-if="error" class="status error">{{ error }}</p>

      <template v-if="items.length">
        <p class="muted">
          共 {{ items.length }} 筆，會新增 {{ fresh.length }} 筆
          <template v-if="items.length > fresh.length">（{{ items.length - fresh.length }} 筆已經存在，會略過）</template>
        </p>
        <ul class="pick-list">
          <li v-for="(e, i) in items" :key="i" :class="{ exists: has(e) }">
            <span class="history-time">{{ formatTime(e.remaining) }}</span>
            <span class="pick-title">{{ e.title || '（未命名）' }}</span>
            <span v-if="has(e)" class="muted">已存在</span>
          </li>
        </ul>
        <p v-if="overflow" class="warning">
          紀錄最多保留 {{ MAX_ENTRIES }} 筆，匯入後你目前最下面的 {{ overflow }} 筆會被移除。
        </p>
      </template>

      <div class="dialog-actions">
        <button type="button" class="ghost" @click="dialog?.close()">取消</button>
        <button type="button" class="primary" :disabled="!fresh.length" @click="confirm">
          匯入{{ fresh.length ? ` ${fresh.length} 筆` : '' }}
        </button>
      </div>
    </div>
  </dialog>
</template>
