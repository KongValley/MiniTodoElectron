/**
 * 搜索词命中片段:把一段文本按 q 切成「命中 / 非命中」交替片段,供高亮渲染。
 * 判据与 store-index.ts 的过滤口径逐字一致(trim + 小写 + includes),
 * 因此高亮片段一定覆盖真正让该行出现的那个词。
 */
export interface Seg {
  t: string
  hit: boolean
}

/** q 为空或 text 为空时返回整段(模板只渲染一个 span) */
export function segments(text: string, q: string): Seg[] {
  const needle = q.trim().toLowerCase()
  if (needle === '' || text === '') return [{ t: text, hit: false }]
  const lower = text.toLowerCase()
  const out: Seg[] = []
  let i = 0
  while (i < text.length) {
    const at = lower.indexOf(needle, i)
    if (at < 0) {
      out.push({ t: text.slice(i), hit: false })
      break
    }
    if (at > i) out.push({ t: text.slice(i, at), hit: false })
    out.push({ t: text.slice(at, at + needle.length), hit: true })
    i = at + needle.length
  }
  if (out.length === 0) out.push({ t: text, hit: false })
  return out
}
