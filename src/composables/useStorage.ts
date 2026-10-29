import { ref, watch, type Ref } from 'vue'

const PREFIX = 'pcr-cb-timecalc:'

/** 跟 localStorage 同步的 ref；讀寫失敗（無痕模式等）時退回記憶體 */
export function useStorage<T>(key: string, initial: T): Ref<T> {
  const fullKey = PREFIX + key
  let value = initial
  try {
    const raw = localStorage.getItem(fullKey)
    if (raw !== null) value = JSON.parse(raw) as T
  } catch {
    // 忽略，使用預設值
  }

  const state = ref(value) as Ref<T>
  watch(
    state,
    (v) => {
      try {
        localStorage.setItem(fullKey, JSON.stringify(v))
      } catch {
        // 忽略
      }
    },
    { deep: true },
  )
  return state
}
