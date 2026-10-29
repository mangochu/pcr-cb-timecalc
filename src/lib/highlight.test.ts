import { describe, expect, it } from 'vitest'
import { highlightTimeline, type Token } from './highlight'

/** 把 token 轉成好讀的字串：[時間]、改變的符號與 auto 用 *X* 標出 */
function show(lines: Token[][]): string[] {
  return lines.map((tokens) =>
    tokens
      .map((t) => {
        if (t.type === 'time') return `[${t.text}]`
        if (t.type === 'ox') return [...t.text].map((c, i) => (t.changed[i] ? `*${c}*` : c)).join('')
        if (t.type === 'auto') return t.changed ? `*${t.text}*` : t.text
        return t.text
      })
      .join(''),
  )
}

describe('highlightTimeline', () => {
  it('marks times and symbols that differ from the previous operation', () => {
    const text = `CR:15/15/0/15/3
1:30 OOXOO auto off
1:18 涅妃>OOOOO
>眞穗>OOXOO
0:51 真穗>OOXXO auto off

全自動打法:OOXXX`
    expect(show(highlightTimeline(text))).toEqual([
      'CR:15/15/0/15/3',
      '[1:30] OOXOO auto *off*',
      '[1:18] 涅妃>OO*O*OO',
      '>眞穗>OO*X*OO',
      '[0:51] 真穗>OOX*X*O auto off',
      '',
      '全自動打法:OOXXX',
    ])
  })

  it('compares multiple operations on one line in order', () => {
    const text = `1:12 作碧 → OOOOO → 真穗(1st) → OOXOO
0:34 涅妃 → OOOOO → 真穗(2nd) → XXXXX Auto on`
    expect(show(highlightTimeline(text))).toEqual([
      '[1:12] 作碧 → OOOOO → 真穗(1st) → OO*X*OO',
      '[0:34] 涅妃 → OO*O*OO → 真穗(2nd) → *X**X**X**X**X* Auto *on*',
    ])
  })

  it('marks auto only when the state changes', () => {
    const text = `1:30 OOXOO [auto off]
1:12 碧>OOOOO auto on
1:06 真穗>OOOOO
1:03 真穗>OOXOO autoon
0:51 真穗>OOXXO Auto.off
全自動打法 auto on`
    expect(show(highlightTimeline(text))).toEqual([
      '[1:30] OOXOO [auto *off*]',
      '[1:12] 碧>OO*O*OO auto *on*',
      '[1:06] 真穗>OOOOO',
      '[1:03] 真穗>OO*X*OO autoon',
      '[0:51] 真穗>OOX*X*O Auto.*off*',
      '全自動打法 auto on',
    ])
  })

  it('treats wrapped lines as operations of the previous time point', () => {
    const text = `CR:0/15/15/15/3
1:30 auto on
XXXOO
1:10 可蘿>XOXOX
0:30 可蘿>OOOOO >
涅妃>OOXXO auto off
0:18 真步>auto on
涅妃>auto off>真步
>OOXXO >碧>OOOOO
全自動打法: OOXOX
傷害約3.4億`
    expect(show(highlightTimeline(text))).toEqual([
      'CR:0/15/15/15/3',
      '[1:30] auto *on*',
      'XXXOO',
      '[1:10] 可蘿>X*O*XO*X*',
      '[0:30] 可蘿>*O*O*O*O*O* >',
      '涅妃>OO*X**X*O auto *off*',
      '[0:18] 真步>auto *on*',
      '涅妃>auto *off*>真步',
      '>OOXXO >碧>OO*O**O*O',
      '全自動打法: OOXOX',
      '傷害約3.4億',
    ])
  })

  it('treats every line inside the timeline section as an operation line', () => {
    const text = `CR:15/0/15/15/0
1:30 auto on
【 OXOXO 】
1:00 黑貓【 OXXOO 】
0:45 帆希 【 XOOOO 】
>厄里斯【 XXOOO 】
0:14 帆希【 OOXOX 】
全自動打法: OXOXO
P.S.這組跟另一組闇法傷害差不多`
    expect(show(highlightTimeline(text))).toEqual([
      'CR:15/0/15/15/0',
      '[1:30] auto *on*',
      '【 OXOXO 】',
      '[1:00] 黑貓【 OX*X**O*O 】',
      '[0:45] 帆希 【 *X**O**O*OO 】',
      '>厄里斯【 X*X*OOO 】',
      '[0:14] 帆希【 *O**O**X*O*X* 】',
      '全自動打法: OXOXO',
      'P.S.這組跟另一組闇法傷害差不多',
    ])
  })

  it('handles ranges, → continuation and O/X glued to Auto', () => {
    const text = `0:18-17 涅妃 → OXXOOAuto off
→公雪 OXXOX`
    expect(show(highlightTimeline(text))).toEqual(['[0:18-17] 涅妃 → OXXOOAuto *off*', '→公雪 OXXO*X*'])
  })
})
