// OCR 常見誤判修正：把辨識結果整理成時間軸格式

const O_CHARS = 'O0o○〇◯'
const X_CHARS = 'Xx×χ✕✖'
// 五個一組的 O/X（五位角色的 UB 開關）
const OX_RUN_RE = new RegExp(`(?<![A-Za-z0-9])([${O_CHARS}${X_CHARS}]{5})(?![A-Za-z0-9])`, 'g')
// 行首時間，容許 l/I/O 被誤認成數字、冒號被認成分號或句點
const TIME_RE = /^(\s*)([0-9OoIl|])\s*[:;：；.．]\s*([0-9OoIl|]{2})(?![0-9])/

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

function normalizeLine(line: string): string {
  let s = toHalfWidth(line).trimEnd()

  s = s.replace(TIME_RE, (_, pre: string, m: string, ss: string) => `${pre}${fixDigit(m)}:${[...ss].map(fixDigit).join('')}`)

  s = s.replace(OX_RUN_RE, (run: string, _g: string, offset: number, whole: string) => {
    // 全是數字 0 的時候，只有緊接在 > 或空白後面才當成 OOOOO，避免誤改數值
    if (/^0+$/.test(run) && !/[>\s]/.test(whole[offset - 1] ?? '')) return run
    return [...run].map((c) => (O_CHARS.includes(c) ? 'O' : 'X')).join('')
  })

  return s
}

export function normalizeOcrText(text: string): string {
  return text
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter((line) => line.trim() !== '')
    .join('\n')
}
