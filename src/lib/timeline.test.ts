import { describe, expect, it } from 'vitest'
import { convertTimeline, formatTime, parseTime } from './timeline'
import { findSuspiciousLines, normalizeOcrText } from './ocrNormalize'

const SAMPLE = `CR:15/15/0/15/3
1:30 OOXOO auto off
1:18 涅妃>OOOOO
>眞穗>OOXOO
1:12 碧>OOOOO
>真穗（第二發)>OOXOO auto on
1:06 真穗>OOOOO
1:03 真穗>OOXOO
0:53 真步>OOOOO
0:51 真穗>OOXXO auto off
0:48 碧>OOOOO
>真穗>OOXOO
0:34 涅妃>OOOOO
>真穗(第二發)>XXXXX autoon
0:28 真穗>XXOXX
0:26 真穗>OXOXX
0:21 碧>OXXXO auto off
0:16 真步>OXXOO
0:08 碧>OXOOO auto on

全自動打法:OOXXX
傷害約3.5億`

describe('parseTime', () => {
  it('accepts m:ss and plain seconds', () => {
    expect(parseTime('0:59')).toBe(59)
    expect(parseTime('1：30')).toBe(90)
    expect(parseTime('59')).toBe(59)
    expect(parseTime('0:5')).toBeNull()
    expect(parseTime('0:60')).toBeNull()
    expect(parseTime('abc')).toBeNull()
  })

  it('formats seconds', () => {
    expect(formatTime(59)).toBe('0:59')
    expect(formatTime(90)).toBe('1:30')
    expect(formatTime(3)).toBe('0:03')
  })
})

describe('convertTimeline', () => {
  it('keeps the timeline unchanged for a full 1:30', () => {
    expect(convertTimeline(SAMPLE, { remaining: 90 }).text).toBe(SAMPLE)
  })

  it('shifts by 31 seconds for a 0:59 carry-over and drops expired entries', () => {
    const r = convertTimeline(SAMPLE, { remaining: 59 })
    expect(r.offset).toBe(31)
    expect(r.text).toBe(`CR:15/15/0/15/3
0:59 OOXOO auto off
0:47 涅妃>OOOOO
>眞穗>OOXOO
0:41 碧>OOOOO
>真穗（第二發)>OOXOO auto on
0:35 真穗>OOOOO
0:32 真穗>OOXOO
0:22 真步>OOOOO
0:20 真穗>OOXXO auto off
0:17 碧>OOOOO
>真穗>OOXOO
0:03 涅妃>OOOOO
>真穗(第二發)>XXXXX autoon

全自動打法:OOXXX
傷害約3.5億`)
    expect(r.kept).toBe(9)
    expect(r.dropped).toBe(5)
  })

  it('drops continuation lines together with their expired time point', () => {
    const r = convertTimeline('0:34 涅妃>OOOOO\n>真穗>XXXXX\n0:28 真穗>XXOXX', { remaining: 56 })
    expect(r.text).toBe('')
  })

  it('shifts both ends of a time range', () => {
    expect(convertTimeline('0:18-17 涅妃 → OXXOO', { remaining: 80 }).text).toBe('0:08-07 涅妃 → OXXOO')
    expect(convertTimeline('0:18~0:17 涅妃', { remaining: 80 }).text).toBe('0:08~0:07 涅妃')
    // 結尾已經來不及就只留開頭
    expect(convertTimeline('0:18-17 涅妃', { remaining: 73 }).text).toBe('0:01 涅妃')
    expect(convertTimeline('0:18-17 涅妃', { remaining: 72 }).text).toBe('')
    // 跨分鐘
    expect(convertTimeline('1:02-58 A', { remaining: 88 }).text).toBe('1:00-0:56 A')
    expect(convertTimeline('1:05-02 A', { remaining: 88 }).text).toBe('1:03-00 A')
  })

  it('handles 0:00 according to keepZero', () => {
    const input = '0:34 A>OOOOO\n>B>XXXXX'
    expect(convertTimeline(input, { remaining: 56 }).text).toBe('')
    expect(convertTimeline(input, { remaining: 56, keepZero: true }).text).toBe('0:00 A>OOOOO\n>B>XXXXX')
  })
})

describe('normalizeOcrText', () => {
  it('fixes common OCR misreads', () => {
    expect(normalizeOcrText('l:3O 0OX0O auto off')).toBe('1:30 OOXOO auto off')
    expect(normalizeOcrText('1：18 涅妃＞○○○○○')).toBe('1:18 涅妃>OOOOO')
    expect(normalizeOcrText('0;28 真穗>××○××')).toBe('0:28 真穗>XXOXX')
    expect(normalizeOcrText('>真穗>00000')).toBe('>真穗>OOOOO')
  })

  it('treats dashes as X', () => {
    expect(normalizeOcrText('1:18 涅妃>OOO–O')).toBe('1:18 涅妃>OOOXO')
    expect(normalizeOcrText('1:12 碧>O-O-O')).toBe('1:12 碧>OXOXO')
    expect(normalizeOcrText('0:51 真穗>OOーーO')).toBe('0:51 真穗>OOXXO')
    expect(normalizeOcrText('0:34 涅妃>OO一OO')).toBe('0:34 涅妃>OOXOO')
    expect(normalizeOcrText('>真穗>－－－－－')).toBe('>真穗>XXXXX')
  })

  it('leaves separator lines and Chinese text alone', () => {
    expect(normalizeOcrText('-----')).toBe('-----')
    expect(normalizeOcrText('真穗(第一發)')).toBe('真穗(第一發)')
    expect(normalizeOcrText('1:30 OOXOO auto off')).toBe('1:30 OOXOO auto off')
  })

  it('handles symbols separated by spaces', () => {
    expect(normalizeOcrText('107 兔格 - 〇〇〇〇 [auto on]')).toBe('1:07 兔格 XOOOO [auto on]')
    expect(normalizeOcrText('019 泳栞 OOOO - [auto on]')).toBe('0:19 泳栞 OOOOX [auto on]')
  })

  it('adds the missing colon to compact times', () => {
    expect(normalizeOcrText('117 愛 梅 [auto off]')).toBe('1:17 愛 梅 [auto off]')
    expect(normalizeOcrText('103愛梅OOOOO')).toBe('1:03 愛梅 OOOOO')
    expect(normalizeOcrText('001公雪')).toBe('0:01 公雪')
    expect(normalizeOcrText('100萬傷害')).toBe('100萬傷害')
    expect(normalizeOcrText('159 超過 1:30')).toBe('159 超過 1:30')
  })

  it('does not guess when the symbol count is wrong, but flags the line', () => {
    const text = normalizeOcrText('038 愛梅 ——〇—\n034 伊邪 〇〇〇 - [auto off]\n043 泳栞 XXOXX')
    expect(text).toBe('0:38 愛梅 ——O—\n0:34 伊邪 OOO - [auto off]\n0:43 泳栞 XXOXX')
    expect(findSuspiciousLines(text).map((l) => l.line)).toEqual([1, 2])
  })

  it('keeps 一/ー that belong to a name or note', () => {
    expect(normalizeOcrText('0:20 一花 OOOOO')).toBe('0:20 一花 OOOOO')
    expect(normalizeOcrText('0:20 真一OOOOO')).toBe('0:20 真一 OOOOO')
    expect(normalizeOcrText('0:20 OOOOO一花')).toBe('0:20 OOOOO 一花')
    expect(normalizeOcrText('0:26 第一發 OXOXX')).toBe('0:26 第一發 OXOXX')
    // 名字結尾的「一」不拿來湊數，數量不足交給提示
    const text = normalizeOcrText('0:34 伊邪一 OOOO')
    expect(text).toBe('0:34 伊邪一 OOOO')
    expect(findSuspiciousLines(text)).toHaveLength(1)
  })

  it('still treats a standalone 一 as a dash', () => {
    expect(normalizeOcrText('1:12 碧>OO一OO')).toBe('1:12 碧>OOXOO')
    expect(normalizeOcrText('1:12 碧 一OOOO')).toBe('1:12 碧 XOOOO')
  })
})

describe('real OCR sample with arrows and Auto', () => {
  const ocr = `時間 軸詳细(1.5押)
1:30 OOXOO Auto off
1:18 涅妃 → 真穗on&off
1:12 作碧 →OOOOO → 真穗(1st) →OOXOO
1:10 ☆ 真穗(跳秒瞬間) → Auto on 卡 押跳秒後2员
0:53 真步→OOOOO
0:51 真穗 → OOXXOAuto off
0:48 作碧 →OOOOO → 真穗 →OOXOO
0:34 涅妃 →OOOOO → 真穗(2nd) → XXXXXAuto on
0:28 真穗→XXOXX
0:26 真穗 →OXOXX
0:21 作碧 → OXXXOAuto off
0:18 -17☆(蜘蛛唱名時Auto on)
0:18 -17 涅妃 → OXx0OAuto off
0:08 作碧 → Oxo0OAuto.on`

  it('matches the original image', () => {
    expect(normalizeOcrText(ocr)).toBe(`時間 軸詳细(1.5押)
1:30 OOXOO Auto off
1:18 涅妃 → 真穗on&off
1:12 作碧 → OOOOO → 真穗(1st) → OOXOO
1:10☆ 真穗(跳秒瞬間) → Auto on 卡 押跳秒後2员
0:53 真步 → OOOOO
0:51 真穗 → OOXXO Auto off
0:48 作碧 → OOOOO → 真穗 → OOXOO
0:34 涅妃 → OOOOO → 真穗(2nd) → XXXXX Auto on
0:28 真穗 → XXOXX
0:26 真穗 → OXOXX
0:21 作碧 → OXXXO Auto off
0:18-17☆ (蜘蛛唱名時Auto on)
0:18-17 涅妃 → OXXOO Auto off
0:08 作碧 → OXOOO Auto on`)
  })
})

describe('spacing', () => {
  it('keeps exactly one space between time, name, O/X and auto notes', () => {
    expect(normalizeOcrText('1:30OOXOO auto off')).toBe('1:30 OOXOO auto off')
    expect(normalizeOcrText('1:18  涅妃   OOOOO   [auto off]')).toBe('1:18 涅妃 OOOOO [auto off]')
    expect(normalizeOcrText('開場 XOOXO[auto on]')).toBe('開場 XOOXO [auto on]')
  })

  it('does not add a space after > or →', () => {
    expect(normalizeOcrText('1:18 涅妃>OOOOO')).toBe('1:18 涅妃>OOOOO')
    expect(normalizeOcrText('→公雪XOOXO')).toBe('→公雪 XOOXO')
    expect(normalizeOcrText('→XOOXO')).toBe('→XOOXO')
  })
})

describe('real OCR sample', () => {
  const ocr = `D3 兔格軸 0目壓
TL:きたいくよ
開場 XOOXO[auto on]
117 愛 梅 [auto off]
107 兔格 - 〇〇〇〇 [auto on]
→公雪XOOXO
103愛梅OOOOO
043 泳栞 XXOXX
038 愛梅 ——〇—
034 伊邪 〇〇〇 - [auto off]
→兔格OOXOX
019 泳栞 OOOO - [auto on]
015 伊邪XOOOO
001公雪`

  it('normalizes the whole timeline', () => {
    expect(normalizeOcrText(ocr)).toBe(`D3 兔格軸 0目壓
TL:きたいくよ
開場 XOOXO [auto on]
1:17 愛 梅 [auto off]
1:07 兔格 XOOOO [auto on]
→公雪 XOOXO
1:03 愛梅 OOOOO
0:43 泳栞 XXOXX
0:38 愛梅 ——O—
0:34 伊邪 OOO - [auto off]
→兔格 OOXOX
0:19 泳栞 OOOOX [auto on]
0:15 伊邪 XOOOO
0:01 公雪`)
  })

  it('drops → continuation lines together with their time point', () => {
    // 扣 34 秒：1:07 → 0:33 保留（含 →公雪），0:34 → 0:00 刪除（含 →兔格）
    const r = convertTimeline(normalizeOcrText(ocr), { remaining: 56 })
    expect(r.text).toContain('0:33 兔格 XOOOO [auto on]\n→公雪 XOOXO')
    expect(r.text).not.toContain('伊邪 OOO')
    expect(r.text).not.toContain('→兔格')
  })

  it('leaves numbers in prose alone', () => {
    expect(normalizeOcrText('傷害約30000萬')).toBe('傷害約30000萬')
    expect(normalizeOcrText('CR:15/15/0/15/3')).toBe('CR:15/15/0/15/3')
  })
})
