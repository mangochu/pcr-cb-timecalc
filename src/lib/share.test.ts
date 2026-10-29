import { describe, expect, it } from 'vitest'
import { decodeShare, encodeShareCode, toShareFile, type SharedEntry } from './share'

const items: SharedEntry[] = [
  {
    title: '五王 狂暴 涅妃真穗',
    remaining: 59,
    input: `CR:15/15/0/15/3
1:30 OOXOO auto off
1:18 涅妃>OOOOO
>眞穗>OOXOO
0:08 碧>OXOOO auto on

全自動打法:OOXXX
傷害約3.5億`,
  },
  { title: '', remaining: 90, input: '1:30 auto on\n【 OXOXO 】' },
]

describe('share code', () => {
  it('round-trips through the share code', async () => {
    const code = await encodeShareCode(items)
    expect(code).toMatch(/^PCRTL1\.[A-Za-z0-9_-]+$/)
    expect(await decodeShare(code)).toEqual(items)
  })

  it('is shorter than the raw text for a real timeline', async () => {
    const long = { ...items[0], input: items[0].input.repeat(3) }
    const code = await encodeShareCode([long])
    expect(code.length).toBeLessThan(JSON.stringify(long).length)
  })

  it('tolerates line breaks inserted by chat apps', async () => {
    const code = await encodeShareCode(items)
    const wrapped = code.replace(/(.{20})/g, '$1\n  ')
    expect(await decodeShare(wrapped)).toEqual(items)
  })

  it('round-trips through the JSON file', async () => {
    expect(await decodeShare(toShareFile(items))).toEqual(items)
  })

  it('rejects broken or foreign input with a readable message', async () => {
    const code = await encodeShareCode(items)
    await expect(decodeShare(code.slice(0, -10))).rejects.toThrow('匯出碼不完整')
    await expect(decodeShare('hello')).rejects.toThrow('PCRTL1.')
    await expect(decodeShare('{"foo":1}')).rejects.toThrow('不是本工具匯出的檔案')
    await expect(decodeShare('{oops')).rejects.toThrow('不是正確的 JSON')
  })

  it('validates each entry', async () => {
    const file = (entry: unknown) => JSON.stringify({ app: 'pcr-cb-timecalc', version: 1, items: [entry] })
    await expect(decodeShare(file({ title: 'a', remaining: 0, input: '1:30' }))).rejects.toThrow('秒數不正確')
    await expect(decodeShare(file({ title: 'a', remaining: 59, input: '' }))).rejects.toThrow('時間軸格式不正確')
    await expect(decodeShare(JSON.stringify({ app: 'pcr-cb-timecalc', version: 1, items: [] }))).rejects.toThrow('沒有任何紀錄')
  })
})
