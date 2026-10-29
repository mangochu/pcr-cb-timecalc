export type ModelTier = 'tiny' | 'small' | 'medium'

export const MODEL_TIERS: { value: ModelTier; label: string }[] = [
  { value: 'tiny', label: '快速（約 6 MB，不含日文假名）' },
  { value: 'small', label: '標準（約 30 MB，推薦）' },
  { value: 'medium', label: '高精準（約 140 MB）' },
]

export interface OcrRequest {
  id: number
  tier: ModelTier
  image: ArrayBuffer
}

export type OcrResponse =
  | { type: 'loading-model'; id: number }
  | { type: 'recognizing'; id: number }
  | { type: 'result'; id: number; text: string; confidence: number }
  | { type: 'error'; id: number; message: string }
