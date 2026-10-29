/// <reference lib="webworker" />
import { PaddleOcrService, V6_MEDIUM_MODEL, V6_SMALL_MODEL, V6_TINY_MODEL, type ModelUrls } from 'ppu-paddle-ocr/web'
import type { ModelTier, OcrRequest, OcrResponse } from './protocol'

// PP-OCRv6：單一模型同時涵蓋繁中、簡中、日文、英文
const MODELS: Record<ModelTier, ModelUrls> = {
  tiny: V6_TINY_MODEL,
  small: V6_SMALL_MODEL,
  medium: V6_MEDIUM_MODEL,
}
const CACHE_NAME = 'pcr-ocr-models-v1'

let service: PaddleOcrService | null = null
let currentTier: ModelTier | null = null
let queue = Promise.resolve()

function post(msg: OcrResponse) {
  self.postMessage(msg)
}

// 模型檔很大，存進 Cache Storage，之後開頁面不用重新下載
async function cachedFetch(url: string): Promise<ArrayBuffer> {
  const cache = await caches.open(CACHE_NAME).catch(() => null)
  const hit = await cache?.match(url)
  if (hit) return hit.arrayBuffer()
  const res = await fetch(url, { referrerPolicy: 'no-referrer' })
  if (!res.ok) throw new Error(`模型下載失敗：${url}`)
  await cache?.put(url, res.clone()).catch(() => undefined)
  return res.arrayBuffer()
}

async function getService(tier: ModelTier, id: number): Promise<PaddleOcrService> {
  if (service && currentTier === tier) return service
  post({ type: 'loading-model', id })
  await service?.destroy()
  service = null

  const urls = MODELS[tier]
  const [detection, recognition, charactersDictionary] = await Promise.all([
    cachedFetch(urls.detection),
    cachedFetch(urls.recognition),
    cachedFetch(urls.charactersDictionary),
  ])
  const next = new PaddleOcrService({ model: { detection, recognition, charactersDictionary } })
  await next.initialize()
  service = next
  currentTier = tier
  return next
}

async function handle({ id, tier, image }: OcrRequest) {
  try {
    const ocr = await getService(tier, id)
    post({ type: 'recognizing', id })
    const result = await ocr.recognize(image)
    post({ type: 'result', id, text: result.text, confidence: result.confidence })
  } catch (err) {
    post({ type: 'error', id, message: err instanceof Error ? err.message : String(err) })
  }
}

self.onmessage = (event: MessageEvent<OcrRequest>) => {
  queue = queue.then(() => handle(event.data))
}
