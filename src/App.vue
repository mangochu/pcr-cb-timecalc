<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStorage } from './composables/useStorage'
import { useHistory, type HistoryEntry } from './composables/useHistory'
import { convertTimeline, formatTime, parseTime, FULL_TIME } from './lib/timeline'
import OcrPanel from './components/OcrPanel.vue'
import HistoryPanel from './components/HistoryPanel.vue'

const remainingText = useStorage('remaining', '1:30')
const input = useStorage('draft', '')
const title = useStorage('title', '')
const keepZero = useStorage('keepZero', false)
const history = useHistory()
const toast = ref('')

const remaining = computed(() => {
  const sec = parseTime(remainingText.value)
  return sec !== null && sec >= 1 && sec <= FULL_TIME ? sec : null
})

const result = computed(() =>
  remaining.value === null ? null : convertTimeline(input.value, { remaining: remaining.value, keepZero: keepZero.value }),
)

function adjust(delta: number) {
  const base = remaining.value ?? FULL_TIME
  remainingText.value = formatTime(Math.min(FULL_TIME, Math.max(1, base + delta)))
}

function showToast(msg: string) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 2000)
}

function saveToHistory() {
  if (!result.value || remaining.value === null || !input.value.trim()) return false
  const firstLine = input.value.split(/\r?\n/).find((l) => l.trim()) ?? ''
  history.save({
    title: title.value.trim() || firstLine.slice(0, 40),
    remaining: remaining.value,
    input: input.value,
    output: result.value.text,
  })
  return true
}

async function copyResult() {
  if (!result.value) return
  try {
    await navigator.clipboard.writeText(result.value.text)
    saveToHistory()
    showToast('已複製，並存入紀錄')
  } catch {
    showToast('複製失敗，請手動選取右側文字')
  }
}

function onSave() {
  if (saveToHistory()) showToast('已存入紀錄')
}

function loadEntry(entry: HistoryEntry) {
  input.value = entry.input
  remainingText.value = formatTime(entry.remaining)
  title.value = entry.title
  showToast('已載入紀錄')
}

function onOcrText(text: string, mode: 'replace' | 'append') {
  input.value = mode === 'append' && input.value.trim() ? `${input.value.trimEnd()}\n${text}` : text
}
</script>

<template>
  <header class="site-header">
    <h1>補償刀時間軸換算</h1>
    <p class="subtitle">貼上完整 1:30 的時間軸，填入補償刀秒數，自動扣秒並刪掉來不及操作的軸。</p>
  </header>

  <main>
    <section class="controls" aria-label="換算設定">
      <label class="field">
        <span class="field-label">補償刀秒數</span>
        <span class="stepper">
          <button type="button" @click="adjust(-1)" aria-label="減 1 秒">−</button>
          <input
            v-model="remainingText"
            class="time-input"
            :class="{ invalid: remaining === null }"
            inputmode="numeric"
            placeholder="0:59"
            aria-describedby="offset-hint"
          />
          <button type="button" @click="adjust(1)" aria-label="加 1 秒">＋</button>
        </span>
      </label>
      <p id="offset-hint" class="offset-hint" :class="{ error: remaining === null }">
        <template v-if="result">
          扣除 <strong>{{ result.offset }}</strong> 秒・保留 {{ result.kept }} 個時間點・刪除 {{ result.dropped }} 個
        </template>
        <template v-else>請輸入 0:01 ～ 1:30 之間的時間（例如 0:59 或 59）</template>
      </p>
      <label class="field grow">
        <span class="field-label">標題（選填，存紀錄用）</span>
        <input v-model="title" class="text-input" placeholder="例如：五王 狂暴 涅妃真穗" />
      </label>
      <label class="checkbox">
        <input v-model="keepZero" type="checkbox" />
        保留剛好 0:00 的軸
      </label>
    </section>

    <section class="editors">
      <div class="editor">
        <div class="editor-head">
          <h2>完整時間軸（1:30）</h2>
          <button type="button" class="ghost" :disabled="!input" @click="input = ''">清空</button>
        </div>
        <textarea v-model="input" spellcheck="false" placeholder="1:30 OOXOO auto off&#10;1:18 涅妃>OOOOO&#10;>眞穗>OOXOO&#10;…" />
      </div>
      <div class="editor">
        <div class="editor-head">
          <h2>換算結果<template v-if="remaining !== null">（{{ formatTime(remaining) }}）</template></h2>
          <span class="actions">
            <button type="button" class="ghost" :disabled="!result || !input.trim()" @click="onSave">存紀錄</button>
            <button type="button" class="primary" :disabled="!result || !input.trim()" @click="copyResult">複製</button>
          </span>
        </div>
        <textarea :value="result?.text ?? ''" readonly spellcheck="false" />
      </div>
    </section>

    <OcrPanel @text="onOcrText" />
    <HistoryPanel :entries="history.entries.value" @load="loadEntry" @remove="history.remove" @clear="history.clear" />
  </main>

  <div class="toast" role="status" aria-live="polite" :class="{ show: toast }">{{ toast }}</div>
</template>
