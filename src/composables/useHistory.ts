import { useStorage } from './useStorage'

export interface HistoryEntry {
  id: string
  savedAt: number
  title: string
  remaining: number
  input: string
  output: string
}

const MAX_ENTRIES = 30

export function useHistory() {
  const entries = useStorage<HistoryEntry[]>('history', [])

  function save(entry: Omit<HistoryEntry, 'id' | 'savedAt'>) {
    // 同一份時間軸＋同樣秒數只留最新的一筆
    const rest = entries.value.filter((e) => !(e.input === entry.input && e.remaining === entry.remaining))
    entries.value = [{ ...entry, id: crypto.randomUUID(), savedAt: Date.now() }, ...rest].slice(0, MAX_ENTRIES)
  }

  function remove(id: string) {
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  function clear() {
    entries.value = []
  }

  return { entries, save, remove, clear }
}
