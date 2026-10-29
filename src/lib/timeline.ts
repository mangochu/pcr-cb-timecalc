/** 戰隊戰完整一刀的秒數（1:30） */
export const FULL_TIME = 90

// 行首的時間，例如 "1:18 涅妃>OOOOO"；同時接受全形冒號
const TIME_LINE_RE = /^(\s*)(\d{1,2})[:：](\d{2})(?!\d)/
// 沒有時間、接續上一個時間點的行，例如 ">眞穗>OOXOO"
const CONTINUATION_RE = /^\s*[>＞]/

/** 解析 "0:59"、"0：59" 或 "59" 為秒數，格式不對時回傳 null */
export function parseTime(text: string): number | null {
  const m = text.trim().match(/^(?:(\d{1,2})[:：])?(\d{1,3})$/)
  if (!m) return null
  if (m[1] === undefined) return Number(m[2])
  if (m[2].length !== 2 || Number(m[2]) >= 60) return null
  return Number(m[1]) * 60 + Number(m[2])
}

export function formatTime(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export interface ConvertOptions {
  /** 補償刀剩餘秒數 */
  remaining: number
  /** 換算後剛好 0:00 的軸是否保留 */
  keepZero?: boolean
}

export interface ConvertResult {
  text: string
  /** 扣除的秒數 */
  offset: number
  kept: number
  dropped: number
}

/**
 * 依補償刀秒數換算時間軸。
 * - 行首有時間的行：扣掉 (90 - 剩餘秒數)，結果 <= 0 的整個時間點刪除
 * - `>` 開頭的行：跟著上一個時間點一起保留或刪除
 * - 其他行（CR、全自動打法、傷害說明、空行）原樣保留
 */
export function convertTimeline(input: string, { remaining, keepZero = false }: ConvertOptions): ConvertResult {
  const offset = FULL_TIME - remaining
  const out: string[] = []
  let dropping = false
  let kept = 0
  let dropped = 0

  for (const line of input.split(/\r?\n/)) {
    const m = line.match(TIME_LINE_RE)
    if (m && Number(m[3]) < 60) {
      const t = Number(m[2]) * 60 + Number(m[3]) - offset
      dropping = keepZero ? t < 0 : t <= 0
      if (dropping) {
        dropped++
        continue
      }
      kept++
      out.push(m[1] + formatTime(t) + line.slice(m[0].length))
    } else if (CONTINUATION_RE.test(line)) {
      if (!dropping) out.push(line)
    } else {
      dropping = false
      out.push(line)
    }
  }

  return { text: out.join('\n'), offset, kept, dropped }
}
