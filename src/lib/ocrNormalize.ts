// OCR 常見誤判修正：把辨識結果整理成時間軸格式

const O_CHARS = 'O0o○〇◯'
const X_CHARS = 'Xx×χ✕✖'
// 有些軸用橫線代表不放 UB（OOO–O），一律當成 X；「一」是 OCR 常把橫線認成的字
const DASH_CHARS = '\\-‐‑‒–—―−ーｰ一'
const SYMBOL = `[${O_CHARS}${X_CHARS}${DASH_CHARS}]`
// 符號串後面可以是結尾、非英數，或直接黏著 auto（"OOXXOAuto off"）
const RUN_END = '(?=$|[^A-Za-z0-9]|[Aa][Uu][Tt][Oo])'
// 一串 O/X 符號，OCR 常在中間多認出空格（"- 〇〇〇〇"），所以容許單一空格。
// 前面不能接英數或冒號，避免把 "1:30" 的 0 當成符號
const SYMBOL_RUN_RE = new RegExp(`(?<![A-Za-z0-9:])${SYMBOL}(?: ?${SYMBOL})*${RUN_END}`, 'g')
// 全是 0 或全是橫線時可能是數值或分隔線，需要額外判斷
const AMBIGUOUS_RUN_RE = new RegExp(`^(?:0+|[${DASH_CHARS}]+)$`)
// 不會出現在一般文字裡的圓圈、叉叉符號，數量不對時也照樣統一
const UNAMBIGUOUS_RE = /[○〇◯×✕✖]/g
// 行首時間，容許 l/I/O 被誤認成數字、冒號被認成分號或句點
const TIME_RE = /^(\s*)([0-9OoIl|])\s*[:;：；.．]\s*([0-9OoIl|]{2})(?![0-9])/
// 冒號沒被認出來的時間，例如 "117 愛梅"、"043 泳栞"
const COMPACT_TIME_RE = /^(\s*)([01])([0-5]\d)(?![0-9萬万億亿%.])/
// 時間區間 "0:18 -17"、"0:18～0:17"，整理成 "0:18-17"
const TIME_RANGE_RE = /^(\s*\d{1,2}:\d{2})[ \t]*[-~～][ \t]*(\d{1,2}:\d{2}|\d{2})(?!\d)/
// auto on/off 中間被認成句點或黏在一起："Auto.on"、"autoon"
const AUTO_RE = /([Aa]uto)[ \t.。．·・,，]*(on|off|ON|OFF)(?![A-Za-z])/g
// 行中間當分隔用的箭頭，前後統一一個空格；行首的接續箭頭不動
const MID_ARROW_RE = /(?<=\S)[ \t]*([→⇒➡])[ \t]*(?=\S)/g
// 也是一般文字的橫線字元，緊貼著文字時當成名字或說明的一部分（例如名字結尾是「一」）
const TEXT_DASH_CHARS = '一ーｰ'
const LETTER_RE = /\p{L}/u
// 整理後的五個 O/X，用來調整前後空格
const OX_SPACING_RE = new RegExp(`[ \\t]*(?<![A-Za-z0-9])([OX]{5})${RUN_END}[ \\t]*`, 'g')
// 行首時間（可含區間、標記重點的 ☆），後面固定一個空格
const LEADING_TIME_RE = /^(\s*\d{1,2}:\d{2}(?:-\d{1,2}(?::\d{2})?)?)[ \t]*([☆★]?)[ \t]*(?=\S)/
// 只有接續箭頭的行首，例如 "→XOOXO"
const LEADING_ARROW_RE = /^\s*[→⇒➡]$/

/** 一條時間軸固定是五位角色 */
const PARTY_SIZE = 5

function toHalfWidth(text: string): string {
  return text
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ')
    .replace(/[〉›»]/g, '>')
}

function fixDigit(c: string): string {
  if ('Oo'.includes(c)) return '0'
  if ('Il|'.includes(c)) return '1'
  return c
}

function fixTime(s: string): string {
  const fixed = TIME_RE.test(s)
    ? s.replace(TIME_RE, (_, pre: string, m: string, ss: string) => `${pre}${fixDigit(m)}:${[...ss].map(fixDigit).join('')}`)
    : s.replace(COMPACT_TIME_RE, (whole: string, pre: string, m: string, ss: string) =>
        Number(m) * 60 + Number(ss) <= 90 ? `${pre}${m}:${ss}` : whole,
      )
  return fixed.replace(TIME_RANGE_RE, '$1-$2')
}

/** 把緊貼著文字的「一」「ー」從符號串頭尾切出去，剩下的 body 才是 O/X */
function splitRun(run: string, offset: number, whole: string) {
  let head = ''
  let tail = ''
  let body = run
  if (TEXT_DASH_CHARS.includes(body[0]) && LETTER_RE.test(whole[offset - 1] ?? '')) {
    head = body.match(/^. ?/)![0]
    body = body.slice(head.length)
  }
  if (body && TEXT_DASH_CHARS.includes(body[body.length - 1]) && LETTER_RE.test(whole[offset + run.length] ?? '')) {
    tail = body.match(/ ?.$/)![0]
    body = body.slice(0, -tail.length)
  }
  return { head, body, tail, prev: head ? head[head.length - 1] : (whole[offset - 1] ?? '') }
}

function convertSymbols(body: string, prev: string): string {
  const symbols = body.replace(/ /g, '')
  if (symbols.length !== PARTY_SIZE) {
    // 數量不對代表 OCR 漏字或多字，不猜位置，只統一明確的符號，留給使用者對照截圖
    return body.replace(UNAMBIGUOUS_RE, (c) => ('○〇◯'.includes(c) ? 'O' : 'X'))
  }
  // 全是 0 或全是橫線時，只有緊接在 > 或空白後面才轉換，避免誤改數值或分隔線
  if (AMBIGUOUS_RUN_RE.test(symbols) && !/[>\s]/.test(prev)) return body
  return [...symbols].map((c) => (O_CHARS.includes(c) ? 'O' : 'X')).join('')
}

/** 時間、人名、箭頭、O/X、auto 說明之間固定一個空格 */
function tidySpacing(s: string): string {
  return s
    .replace(LEADING_TIME_RE, '$1$2 ')
    .replace(AUTO_RE, '$1 $2')
    .replace(MID_ARROW_RE, ' $1 ')
    .replace(OX_SPACING_RE, (match: string, run: string, offset: number, whole: string) => {
      const prev = whole[offset - 1]
      const next = whole[offset + match.length]
      // 行首、"涅妃>OOOOO" 的 >、行首接續箭頭 "→XOOXO" 後面不補空格
      const noSpace = prev === undefined || prev === '>' || LEADING_ARROW_RE.test(whole.slice(0, offset))
      return (noSpace ? '' : ' ') + run + (next === undefined ? '' : ' ')
    })
}

function normalizeLine(line: string): string {
  const s = fixTime(toHalfWidth(line).trimEnd()).replace(SYMBOL_RUN_RE, (run: string, offset: number, whole: string) => {
    const { head, body, tail, prev } = splitRun(run, offset, whole)
    return head + convertSymbols(body, prev) + tail
  })
  return tidySpacing(s)
}

export function normalizeOcrText(text: string): string {
  return text
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((line) => line.trim() !== '')
    .join('\n')
}

export interface SuspiciousLine {
  /** 從 1 開始的行號 */
  line: number
  text: string
}

/** 找出 O/X 數量不是 5 個的行，通常是 OCR 漏認或多認 */
export function findSuspiciousLines(text: string): SuspiciousLine[] {
  return text.split(/\r?\n/).flatMap((line, i) => {
    const bad = [...line.matchAll(SYMBOL_RUN_RE)].some(({ 0: run, index }) => {
      const symbols = splitRun(run, index, line).body.replace(/ /g, '')
      return symbols.length >= 3 && symbols.length !== PARTY_SIZE && !AMBIGUOUS_RUN_RE.test(symbols)
    })
    return bad ? [{ line: i + 1, text: line }] : []
  })
}
