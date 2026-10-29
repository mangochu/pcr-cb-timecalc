<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useStorage } from './composables/useStorage'
import { defaultTitle, useHistory, type HistoryEntry } from './composables/useHistory'
import { convertTimeline, formatTime, parseTime, FULL_TIME } from './lib/timeline'
import OcrPanel from './components/OcrPanel.vue'
import HistoryPanel from './components/HistoryPanel.vue'
import HighlightedTimeline from './components/HighlightedTimeline.vue'
import type { OcrPanelState } from './ocr/protocol'

type MobileView = 'input' | 'output' | 'both'
const MOBILE_VIEWS: { value: MobileView; label: string }[] = [
  { value: 'input', label: '完整時間軸' },
  { value: 'output', label: '換算結果' },
  { value: 'both', label: '比對' },
]
const SLIDER_TICKS = [1, 30, 60, 90]

const remainingText = useStorage('remaining', '1:30')
const input = useStorage('draft', '')
const keepZero = useStorage('keepZero', false)
// 手機版第一次打開從換算結果開始，之後記住上次的選擇
const mobileView = useStorage<MobileView>('mobileView', 'output')
const history = useHistory()
const toast = ref('')
const saveDialog = ref<HTMLDialogElement>()
const saveTitleInput = ref<HTMLInputElement>()
const saveTitle = ref('')
const ocrPanel = ref<InstanceType<typeof OcrPanel>>()
const ocrState = ref<OcrPanelState>('idle')

const remaining = computed(() => {
  const sec = parseTime(remainingText.value)
  return sec !== null && sec >= 1 && sec <= FULL_TIME ? sec : null
})

const result = computed(() =>
  remaining.value === null ? null : convertTimeline(input.value, { remaining: remaining.value, keepZero: keepZero.value }),
)

const canSave = computed(() => result.value !== null && input.value.trim() !== '')

// 拉軸跟輸入框共用同一個值
const sliderValue = computed({
  get: () => remaining.value ?? FULL_TIME,
  set: (sec: number) => (remainingText.value = formatTime(sec)),
})

function adjust(delta: number) {
  const base = remaining.value ?? FULL_TIME
  remainingText.value = formatTime(Math.min(FULL_TIME, Math.max(1, base + delta)))
}

function showToast(msg: string) {
  toast.value = msg
  setTimeout(() => (toast.value = ''), 2000)
}

function saveToHistory(title?: string) {
  if (!result.value || remaining.value === null || !canSave.value) return
  history.save({ title, remaining: remaining.value, input: input.value, output: result.value.text })
}

async function copyResult() {
  if (!result.value) return
  try {
    await navigator.clipboard.writeText(result.value.text)
    saveToHistory()
    showToast('已複製，並存入紀錄')
  } catch {
    showToast('複製失敗，請手動選取換算結果的文字')
  }
}

async function openSaveDialog() {
  if (!canSave.value) return
  saveTitle.value = history.findTitle(input.value) ?? defaultTitle(input.value)
  saveDialog.value?.showModal()
  await nextTick()
  saveTitleInput.value?.select()
}

function confirmSave() {
  saveToHistory(saveTitle.value.trim() || defaultTitle(input.value))
  showToast('已存入紀錄')
}

function loadEntry(entry: HistoryEntry) {
  input.value = entry.input
  remainingText.value = formatTime(entry.remaining)
  showToast('已載入紀錄')
}

function onOcrText(text: string, mode: 'replace' | 'append') {
  input.value = mode === 'append' && input.value.trim() ? `${input.value.trimEnd()}\n${text}` : text
  showToast(mode === 'append' ? '已把辨識結果附加到完整時間軸' : '已用辨識結果取代完整時間軸')
}

function scrollToOcr() {
  document.getElementById('ocr-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
      <div class="slider-field">
        <input
          v-model.number="sliderValue"
          type="range"
          class="time-slider"
          min="1"
          :max="FULL_TIME"
          step="1"
          aria-label="補償刀秒數拉軸"
          :aria-valuetext="formatTime(sliderValue)"
        />
        <span class="slider-scale" aria-hidden="true">
          <span v-for="sec in SLIDER_TICKS" :key="sec" :style="{ left: `${((sec - 1) / (FULL_TIME - 1)) * 100}%` }">
            {{ formatTime(sec) }}
          </span>
        </span>
      </div>
      <p id="offset-hint" class="offset-hint" :class="{ error: remaining === null }">
        <template v-if="result">
          扣除 <strong>{{ result.offset }}</strong> 秒・保留 {{ result.kept }} 個時間點・刪除 {{ result.dropped }} 個
        </template>
        <template v-else>請輸入 0:01 ～ 1:30 之間的時間（例如 0:59 或 59）</template>
      </p>
      <label class="checkbox">
        <input v-model="keepZero" type="checkbox" />
        保留剛好 0:00 的軸
      </label>
    </section>

    <div v-if="ocrState !== 'idle'" class="ocr-banner" role="status">
      <span class="ocr-banner-text">
        <template v-if="ocrState === 'pending'">截圖辨識結果<strong>尚未套用</strong>到完整時間軸</template>
        <template v-else>
          <span class="spinner" aria-hidden="true" />
          截圖辨識中…{{ ocrState === 'recognizing-auto' ? '完成後會自動套用到完整時間軸' : '完成後記得套用到完整時間軸' }}
        </template>
      </span>
      <span class="actions">
        <button type="button" class="ghost" @click="scrollToOcr">查看辨識結果</button>
        <button v-if="ocrState === 'pending'" type="button" class="primary" @click="ocrPanel?.apply('replace')">
          取代完整時間軸
        </button>
      </span>
    </div>

    <div class="view-toggle" role="group" aria-label="切換顯示">
      <button
        v-for="v in MOBILE_VIEWS"
        :key="v.value"
        type="button"
        :aria-pressed="mobileView === v.value"
        @click="mobileView = v.value"
      >
        {{ v.label }}
      </button>
    </div>

    <section class="editors" :data-view="mobileView">
      <div class="editor editor-input">
        <div class="editor-head">
          <h2>完整時間軸（1:30）</h2>
          <button type="button" class="ghost" :disabled="!input" @click="input = ''">清空</button>
        </div>
        <textarea v-model="input" spellcheck="false" placeholder="1:30 OOXOO auto off&#10;1:18 涅妃>OOOOO&#10;>眞穗>OOXOO&#10;…" />
      </div>
      <div class="editor editor-output">
        <div class="editor-head">
          <h2>換算結果<template v-if="remaining !== null">（{{ formatTime(remaining) }}）</template></h2>
          <span class="actions">
            <button type="button" class="ghost" :disabled="!canSave" @click="openSaveDialog">存紀錄</button>
            <button type="button" class="primary" :disabled="!canSave" @click="copyResult">複製</button>
          </span>
        </div>
        <HighlightedTimeline :text="result?.text ?? ''" />
      </div>
    </section>

    <OcrPanel ref="ocrPanel" v-model:state="ocrState" @text="onOcrText" />
    <HistoryPanel :entries="history.entries.value" @load="loadEntry" @remove="history.remove" @clear="history.clear" />
  </main>

  <dialog ref="saveDialog" class="dialog" aria-labelledby="save-dialog-title">
    <form method="dialog" @submit="confirmSave">
      <h2 id="save-dialog-title">存入紀錄</h2>
      <label class="field">
        <span class="field-label">標題</span>
        <input ref="saveTitleInput" v-model="saveTitle" class="text-input" placeholder="例如：五王 狂暴 涅妃真穗" />
      </label>
      <div class="dialog-actions">
        <button type="button" class="ghost" @click="saveDialog?.close()">取消</button>
        <button type="submit" class="primary">儲存</button>
      </div>
    </form>
  </dialog>

  <div class="toast" role="status" aria-live="polite" :class="{ show: toast }">{{ toast }}</div>
</template>
