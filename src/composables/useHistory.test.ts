import { describe, expect, it } from 'vitest'
import { defaultTitle, useHistory } from './useHistory'

const entry = (remaining: number) => ({ remaining, input: 'CR:15/15/0/15/3\n1:30 OOXOO', output: '' })

describe('useHistory', () => {
  it('uses the first line as the default title', () => {
    expect(defaultTitle('\n  CR:15/15/0/15/3  \n1:30 OOXOO')).toBe('CR:15/15/0/15/3')
  })

  it('keeps a custom title when saving again without one (e.g. on copy)', () => {
    const history = useHistory()
    history.clear()
    history.save({ ...entry(59), title: '五王 狂暴' })
    history.save(entry(59))
    expect(history.entries.value).toHaveLength(1)
    expect(history.entries.value[0].title).toBe('五王 狂暴')

    // 同一份軸換了秒數也沿用標題
    history.save(entry(45))
    expect(history.entries.value.map((e) => e.title)).toEqual(['五王 狂暴', '五王 狂暴'])
    expect(history.findTitle(entry(0).input)).toBe('五王 狂暴')
  })

  it('falls back to the first line for a new timeline', () => {
    const history = useHistory()
    history.clear()
    history.save(entry(59))
    expect(history.entries.value[0].title).toBe('CR:15/15/0/15/3')
  })
})
