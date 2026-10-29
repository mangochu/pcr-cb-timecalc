import { describe, expect, it } from 'vitest'
import { convertTimeline, formatTime, parseTime } from './timeline'
import { normalizeOcrText } from './ocrNormalize'

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

  it('leaves numbers in prose alone', () => {
    expect(normalizeOcrText('傷害約30000萬')).toBe('傷害約30000萬')
    expect(normalizeOcrText('CR:15/15/0/15/3')).toBe('CR:15/15/0/15/3')
  })
})
