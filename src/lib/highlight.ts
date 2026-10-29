import { CONTINUATION_RE, TIME_LINE_RE } from './timeline'

export type Token =
  | { type: 'text'; text: string }
  | { type: 'time'; text: string }
  /** changed[i] 為 true 代表第 i 位角色跟前一個操作不同 */
  | { type: 'ox'; text: string; changed: boolean[] }
  /** changed 為 true 代表 auto 狀態跟前一次不同（第一次出現也算） */
  | { type: 'auto'; text: string; changed: boolean }

// 五位角色的 Set 狀態，可以直接黏著 auto（"OOXXOAuto off"）
const OX_SOURCE = '(?<![A-Za-z0-9])[OX]{5}(?=$|[^A-Za-z0-9]|[Aa][Uu][Tt][Oo])'
// auto on/off，容許 "autoon"、"Auto.on"、全大寫
const AUTO_SOURCE = '[Aa][Uu][Tt][Oo][\\s.]*([Oo][Nn]|[Oo][Ff][Ff])(?![A-Za-z])'
const OPERATION_RE = new RegExp(`(${OX_SOURCE})|${AUTO_SOURCE}`, 'g')

/**
 * 把時間軸切成上色用的 token：行首時間、操作（O/X）、auto on/off、其他文字。
 * 只有時間行與接續行上的 O/X 與 auto 算操作，依序跟前一次比對差異；
 * 說明行（例如「全自動打法:OOXXX」）不上色也不參與比對。
 */
export function highlightTimeline(text: string): Token[][] {
  let prev: string | null = null
  let prevAuto: string | null = null

  return text.split(/\r?\n/).map((line) => {
    const tokens: Token[] = []
    let rest = line

    const m = line.match(TIME_LINE_RE)
    const isTimeLine = m !== null && Number(m[3]) < 60
    if (isTimeLine) {
      if (m[1]) tokens.push({ type: 'text', text: m[1] })
      tokens.push({ type: 'time', text: m[0].slice(m[1].length) })
      rest = line.slice(m[0].length)
    }

    if (!isTimeLine && !CONTINUATION_RE.test(line)) {
      if (rest) tokens.push({ type: 'text', text: rest })
      return tokens
    }

    let last = 0
    for (const om of rest.matchAll(OPERATION_RE)) {
      const [match, ox, auto] = om
      if (om.index > last) tokens.push({ type: 'text', text: rest.slice(last, om.index) })
      if (ox) {
        const before = prev
        tokens.push({ type: 'ox', text: ox, changed: [...ox].map((c, i) => before !== null && c !== before[i]) })
        prev = ox
      } else {
        const state = auto.toLowerCase()
        tokens.push({ type: 'auto', text: match, changed: state !== prevAuto })
        prevAuto = state
      }
      last = om.index + match.length
    }
    if (last < rest.length) tokens.push({ type: 'text', text: rest.slice(last) })
    return tokens
  })
}
