/** 戰隊戰完整一刀的秒數（1:30） */
export const FULL_TIME = 90

// 行首的時間，例如 "1:18 涅妃>OOOOO"；同時接受全形冒號。
// 也接受區間 "0:18-17"、"0:18~0:17"（第 4～6 組是區間的分隔符號、分、秒）
export const TIME_LINE_RE = /^(\s*)(\d{1,2})[:：](\d{2})(?:([ \t]*[-~～][ \t]*)(?:(\d{1,2})[:：])?(\d{2}))?(?!\d)/
// 沒有時間、接續上一個時間點的行，例如 ">眞穗>OOXOO"、"→公雪XOOXO"
const CONTINUATION_RE = /^\s*(?:[>＞→⇒➡]|->)/
// 換行後的操作：行首就是 O/X（"XXXOO"），或 > → 後面直接接 O/X、auto（"涅妃>OOXXO"、"涅妃>auto off"）
const OPERATION_LINE_RE = /(?:^|[>＞→⇒➡])\s*(?:[OX]{5}(?=$|[^A-Za-z0-9]|[Aa]uto)|[Aa]uto)/
// 上一行以 > 或 → 結尾，代表這行是被換行切開的後半段（"0:30 可蘿>OOOOO >"）
const WRAPPED_RE = /[>＞→⇒➡]\s*$/

/** 沒有時間、但屬於上一個時間點的行 */
export function isContinuationLine(line: string, prevLine = ''): boolean {
  return CONTINUATION_RE.test(line) || WRAPPED_RE.test(prevLine) || OPERATION_LINE_RE.test(line)
}

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

  const lines = input.split(/\r?\n/)
  for (const [i, line] of lines.entries()) {
    const m = line.match(TIME_LINE_RE)
    if (m && Number(m[3]) < 60) {
      const t = Number(m[2]) * 60 + Number(m[3]) - offset
      const expired = (sec: number) => (keepZero ? sec < 0 : sec <= 0)
      dropping = expired(t)
      if (dropping) {
        dropped++
        continue
      }
      kept++
      let range = ''
      if (m[6] !== undefined) {
        // 區間結尾只寫秒數時跟開頭同一分；秒數比開頭大代表跨到前一分（"1:02-58" = 1:02～0:58）
        const endMin = m[5] !== undefined ? Number(m[5]) : Number(m[6]) > Number(m[3]) ? Number(m[2]) - 1 : Number(m[2])
        const end = endMin * 60 + Number(m[6]) - offset
        // 結尾已經來不及就只留開頭
        if (!expired(end)) {
          const sameMinute = m[5] === undefined && Math.floor(end / 60) === Math.floor(t / 60)
          range = m[4] + (sameMinute ? String(end % 60).padStart(2, '0') : formatTime(end))
        }
      }
      out.push(m[1] + formatTime(t) + range + line.slice(m[0].length))
    } else if (isContinuationLine(line, lines[i - 1])) {
      if (!dropping) out.push(line)
    } else {
      dropping = false
      out.push(line)
    }
  }

  return { text: out.join('\n'), offset, kept, dropped }
}
