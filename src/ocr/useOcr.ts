import { ref } from 'vue'
import type { ModelTier, OcrRequest, OcrResponse } from './protocol'

export type OcrStatus = 'idle' | 'loading-model' | 'recognizing'

interface Pending {
  resolve: (text: string) => void
  reject: (err: Error) => void
}

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, Pending>()
const status = ref<OcrStatus>('idle')

// 第一次辨識時才建立 worker，避免一進頁面就下載模型
function getWorker(): Worker {
  if (worker) return worker
  worker = new Worker(new URL('./ocr.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (event: MessageEvent<OcrResponse>) => {
    const msg = event.data
    if (msg.type === 'loading-model' || msg.type === 'recognizing') {
      status.value = msg.type
      return
    }
    const p = pending.get(msg.id)
    pending.delete(msg.id)
    if (pending.size === 0) status.value = 'idle'
    if (msg.type === 'result') p?.resolve(msg.text)
    else p?.reject(new Error(msg.message))
  }
  return worker
}

export function useOcr() {
  async function recognize(file: Blob, tier: ModelTier): Promise<string> {
    const image = await file.arrayBuffer()
    const id = nextId++
    const request: OcrRequest = { id, tier, image }
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject })
      getWorker().postMessage(request, [image])
    })
  }

  return { status, recognize }
}
