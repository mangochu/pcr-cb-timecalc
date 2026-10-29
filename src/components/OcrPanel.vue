<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watchEffect } from 'vue'
import { useOcr } from '../ocr/useOcr'
import { MODEL_TIERS, type ModelTier, type OcrPanelState } from '../ocr/protocol'
import { findSuspiciousLines, normalizeOcrText } from '../lib/ocrNormalize'
import { useStorage } from '../composables/useStorage'

const emit = defineEmits<{ text: [text: string, mode: 'replace' | 'append'] }>()
/** 讓上層顯示「尚未套用」的提醒 */
const state = defineModel<OcrPanelState>('state', { default: 'idle' })

const { status, recognize } = useOcr()
const tier = useStorage<ModelTier>('ocrTier', 'small')
const normalize = useStorage('ocrNormalize', true)
const autoApply = useStorage('ocrAutoApply', false)
const rawText = ref('')
const editedText = ref<string | null>(null)
/** 最後一次套用到完整時間軸的內容，跟目前結果不同就代表還沒套用 */
const appliedText = ref<string | null>(null)
const previews = ref<string[]>([])
const error = ref('')
const progress = ref({ done: 0, total: 0 })
const dragging = ref(false)
const fileInput = ref<HTMLInputElement>()

const busy = computed(() => progress.value.total > 0 && progress.value.done < progress.value.total)
const text = computed({
  get: () => editedText.value ?? (normalize.value ? normalizeOcrText(rawText.value) : rawText.value),
  set: (v: string) => (editedText.value = v),
})
const suspicious = computed(() => findSuspiciousLines(text.value))
const pending = computed(() => text.value.trim() !== '' && text.value !== appliedText.value)

watchEffect(() => {
  if (busy.value) state.value = autoApply.value ? 'recognizing-auto' : 'recognizing'
  else state.value = pending.value ? 'pending' : 'idle'
})

function apply(mode: 'replace' | 'append') {
  if (!text.value.trim()) return
  emit('text', text.value, mode)
  appliedText.value = text.value
}

defineExpose({ apply })
const statusText = computed(() => {
  if (!busy.value) return ''
  const n = `（${progress.value.done + 1}/${progress.value.total}）`
  if (status.value === 'loading-model') return `載入辨識模型中，第一次會比較久${n}`
  return `辨識中${n}`
})

async function run(files: File[]) {
  const images = files.filter((f) => f.type.startsWith('image/'))
  if (!images.length || busy.value) return
  previews.value.forEach(URL.revokeObjectURL)
  previews.value = images.map((f) => URL.createObjectURL(f))
  rawText.value = ''
  editedText.value = null
  appliedText.value = null
  error.value = ''
  progress.value = { done: 0, total: images.length }

  const parts: string[] = []
  for (const img of images) {
    try {
      parts.push(await recognize(img, tier.value))
      rawText.value = parts.join('\n')
    } catch (err) {
      error.value = `辨識失敗：${err instanceof Error ? err.message : String(err)}`
    }
    progress.value.done++
  }
  if (autoApply.value) apply('replace')
}

function onFiles(event: Event) {
  const el = event.target as HTMLInputElement
  run([...(el.files ?? [])])
  el.value = ''
}

function onDrop(event: DragEvent) {
  dragging.value = false
  run([...(event.dataTransfer?.files ?? [])])
}

// 在頁面任何地方 Ctrl+V 貼上截圖
function onPaste(event: ClipboardEvent) {
  const files = [...(event.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
  if (!files.length) return
  event.preventDefault()
  run(files)
}

onMounted(() => window.addEventListener('paste', onPaste))
onBeforeUnmount(() => {
  window.removeEventListener('paste', onPaste)
  previews.value.forEach(URL.revokeObjectURL)
})
</script>

<template>
  <section id="ocr-panel" class="panel" aria-labelledby="ocr-title">
    <div class="panel-head">
      <h2 id="ocr-title">截圖轉文字（OCR）</h2>
      <span class="panel-options">
        <label>
          模型
          <select v-model="tier" :disabled="busy">
            <option v-for="m in MODEL_TIERS" :key="m.value" :value="m.value">{{ m.label }}</option>
          </select>
        </label>
        <label class="checkbox">
          <input v-model="normalize" type="checkbox" @change="editedText = null" />
          自動修正 O/X、時間格式
        </label>
        <label class="checkbox">
          <input v-model="autoApply" type="checkbox" />
          辨識完自動套用到完整時間軸
        </label>
      </span>
    </div>

    <div
      class="dropzone"
      :class="{ dragging }"
      role="button"
      tabindex="0"
      @click="fileInput?.click()"
      @keydown.enter.space.prevent="fileInput?.click()"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onFiles" />
      <p><strong>拖曳圖片到這裡</strong>、點擊選擇檔案，或直接 <kbd>Ctrl</kbd>+<kbd>V</kbd> 貼上截圖</p>
      <p class="muted">辨識完全在你的瀏覽器裡進行，圖片不會上傳。支援繁中、簡中、日文、英文；可一次放多張，會依序接起來。</p>
    </div>

    <p v-if="statusText" class="status"><span class="spinner" aria-hidden="true" />{{ statusText }}</p>
    <p v-if="error" class="status error">{{ error }}</p>

    <div v-if="previews.length || rawText" class="ocr-result">
      <div class="thumbs">
        <img v-for="src in previews" :key="src" :src="src" alt="上傳的截圖" />
      </div>
      <div class="ocr-text">
        <textarea v-model="text" spellcheck="false" placeholder="辨識結果會出現在這裡，可以先手動修正再套用到完整時間軸" />
        <div v-if="suspicious.length" class="warning" role="note">
          <p>以下幾行的 O/X 不是 5 個，可能有字沒認到，請對照截圖修正：</p>
          <ul>
            <li v-for="s in suspicious" :key="s.line">
              <span class="warning-line">第 {{ s.line }} 行</span><code>{{ s.text }}</code>
            </li>
          </ul>
        </div>
        <span class="actions">
          <span v-if="pending && !busy" class="pending-hint">尚未套用</span>
          <button type="button" class="ghost" :disabled="!text.trim()" @click="apply('append')">附加到完整時間軸</button>
          <button type="button" class="primary" :disabled="!text.trim()" @click="apply('replace')">取代完整時間軸</button>
        </span>
      </div>
    </div>
  </section>
</template>
