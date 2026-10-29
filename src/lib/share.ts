// 近期紀錄的匯出／匯入：匯出碼（壓縮後的文字，可直接貼到聊天室）與 JSON 檔

import { FULL_TIME } from './timeline'

/** 分享出去的內容；換算結果在匯入時重新計算，所以不放進去 */
export interface SharedEntry {
  title: string
  remaining: number
  input: string
}

const CODE_PREFIX = 'PCRTL1.'
const FILE_APP = 'pcr-cb-timecalc'
const MAX_ITEMS = 100
const MAX_INPUT_LENGTH = 20000
const MAX_TITLE_LENGTH = 100

interface FilePayload {
  app: typeof FILE_APP
  version: 1
  exportedAt: string
  items: SharedEntry[]
}

async function transform(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const piped = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  return new Uint8Array(await new Response(piped).arrayBuffer())
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): Uint8Array {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4))
  return Uint8Array.from(binary, (c) => c.charCodeAt(0))
}

/** 產生匯出碼：JSON → deflate 壓縮 → base64url */
export async function encodeShareCode(items: SharedEntry[]): Promise<string> {
  // 用短欄位名讓匯出碼更短
  const json = JSON.stringify(items.map((e) => [e.title, e.remaining, e.input]))
  const compressed = await transform(new TextEncoder().encode(json), new CompressionStream('deflate-raw'))
  return CODE_PREFIX + toBase64Url(compressed)
}

export function toShareFile(items: SharedEntry[]): string {
  const payload: FilePayload = { app: FILE_APP, version: 1, exportedAt: new Date().toISOString(), items }
  return JSON.stringify(payload, null, 2)
}

function validate(raw: unknown[]): SharedEntry[] {
  if (raw.length === 0) throw new Error('裡面沒有任何紀錄')
  if (raw.length > MAX_ITEMS) throw new Error(`一次最多匯入 ${MAX_ITEMS} 筆`)
  return raw.map((item, i) => {
    const [title, remaining, input] = Array.isArray(item)
      ? item
      : [(item as SharedEntry)?.title, (item as SharedEntry)?.remaining, (item as SharedEntry)?.input]
    if (typeof input !== 'string' || !input.trim() || input.length > MAX_INPUT_LENGTH) {
      throw new Error(`第 ${i + 1} 筆的時間軸格式不正確`)
    }
    if (!Number.isInteger(remaining) || remaining < 1 || remaining > FULL_TIME) {
      throw new Error(`第 ${i + 1} 筆的秒數不正確`)
    }
    return { title: typeof title === 'string' ? title.slice(0, MAX_TITLE_LENGTH) : '', remaining, input }
  })
}

/** 解析匯出碼或 JSON 檔內容，格式不對時丟出可以直接顯示給使用者的錯誤 */
export async function decodeShare(text: string): Promise<SharedEntry[]> {
  const trimmed = text.trim()
  if (trimmed.startsWith('{')) {
    let payload: Partial<FilePayload>
    try {
      payload = JSON.parse(trimmed)
    } catch {
      throw new Error('檔案內容不是正確的 JSON')
    }
    if (payload.app !== FILE_APP || !Array.isArray(payload.items)) throw new Error('這不是本工具匯出的檔案')
    return validate(payload.items)
  }

  // 聊天室可能把長字串斷行，先拿掉所有空白
  const code = trimmed.replace(/\s+/g, '')
  if (!code.startsWith(CODE_PREFIX)) throw new Error('匯出碼應該以 PCRTL1. 開頭')
  let parsed: unknown
  try {
    const bytes = await transform(fromBase64Url(code.slice(CODE_PREFIX.length)), new DecompressionStream('deflate-raw'))
    parsed = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new Error('匯出碼不完整或已損壞，請確認有完整複製')
  }
  if (!Array.isArray(parsed)) throw new Error('匯出碼不完整或已損壞，請確認有完整複製')
  return validate(parsed)
}
