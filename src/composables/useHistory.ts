import { useStorage } from './useStorage'

export interface HistoryEntry {
  id: string
  savedAt: number
  title: string
  remaining: number
  input: string
  output: string
}

type NewEntry = Omit<HistoryEntry, 'id' | 'savedAt' | 'title'> & { title?: string }

const MAX_ENTRIES = 30

/** 沒填標題時用時間軸的第一行 */
export function defaultTitle(input: string): string {
  return (input.split(/\r?\n/).find((l) => l.trim()) ?? '').trim().slice(0, 40)
}

export function useHistory() {
  const entries = useStorage<HistoryEntry[]>('history', [])

  /** 同一份時間軸存過的標題（不管秒數），用來預填 */
  function findTitle(input: string): string | undefined {
    return entries.value.find((e) => e.input === input)?.title
  }

  /**
   * 沒給標題時沿用同一份時間軸存過的標題，避免複製時把自訂標題蓋掉。
   * 同一份時間軸＋同樣秒數已經存過就原地更新，保留使用者排好的順序；新的放最上面
   */
  function save({ title, ...entry }: NewEntry) {
    const resolvedTitle = title ?? findTitle(entry.input) ?? defaultTitle(entry.input)
    const index = entries.value.findIndex((e) => e.input === entry.input && e.remaining === entry.remaining)
    const saved = { ...entry, title: resolvedTitle, savedAt: Date.now() }
    if (index >= 0) {
      entries.value = entries.value.map((e, i) => (i === index ? { ...saved, id: e.id } : e))
    } else {
      entries.value = [{ ...saved, id: crypto.randomUUID() }, ...entries.value].slice(0, MAX_ENTRIES)
    }
  }

  function remove(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  function clear() {
    entries.value = []
  }

  return { entries, findTitle, save, remove, clear }
}
