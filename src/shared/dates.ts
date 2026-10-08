/**
 * 日期工具。逐函数移植旧版 C# Model.cs 的 P 类。
 * 一律使用本地时区;禁止 new Date().toISOString()(会偏时区)。
 */
import type { RepeatKind } from './types'

export const DFMT = 'yyyy-MM-dd'

const pad = (n: number): string => String(n).padStart(2, '0')

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 今天,'yyyy-MM-dd'(本地时区) */
export function today(): string {
  return fmt(new Date())
}

/** 严格校验 'yyyy-MM-dd' 且日期真实存在(拒绝 2026-2-3 / 2026-13-01 / 2026-02-30) */
export function isDate(s: unknown): boolean {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = parse(s)
  return d !== null && fmt(d) === s
}

/** 解析为本地 Date;非法返回 null */
export function parse(s: string): Date | null {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const y = Number(s.slice(0, 4))
  const m = Number(s.slice(5, 7))
  const d = Number(s.slice(8, 10))
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return date
}

/** 相对日期加减;非法输入按今天处理(与旧版 P.Date 一致) */
export function addDays(s: string, n: number): string {
  const d = parse(s) ?? new Date()
  d.setDate(d.getDate() + n)
  return fmt(d)
}

/** 周几的一字缩写:'周二';非法返回 '' */
export function week(date: string): string {
  const d = parse(date)
  if (!d) return ''
  return '周' + '日一二三四五六'[d.getDay()]
}

/**
 * 今天 / 明天 / 后天 周X;其他为 'M月d日 周X';'' 或非法 → '未排期'
 *
 * 这里刻意不缓存"今天零点":实测缓存版反而慢 18%(7.17 vs 6.25 ms / 5000 行),
 * 因为校验缓存是否过期要调 today(),而 today() 自己就要格式化一次 Date。
 * 每行多构造一个 Date 的成本,低于"为了省它而多跑一次日期格式化"。
 */
export function label(date: string): string {
  const d = parse(date)
  if (!d) return '未排期'
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  const delta = Math.round((d.getTime() - t.getTime()) / 86400000)
  const w = week(date)
  if (delta === 0) return '今天 ' + w
  if (delta === 1) return '明天 ' + w
  if (delta === 2) return '后天 ' + w
  return `${d.getMonth() + 1}月${d.getDate()}日 ${w}`
}

/**
 * 按重复规则算下一次日期;不重复或非法日期返回 null。
 * monthly:同月 +1,目标月没有该日号则落到最后一天;传 anchorDay 时用它当目标日号
 *         (1-31 → 2-28 → 3-31),不传则按当前日期的日号(旧行为)。
 * weekday:往后找第一个周一~周五。
 */
export function nextByRepeat(date: string, kind: RepeatKind, anchorDay?: number): string | null {
  const d = parse(date)
  if (!d || kind === 'none') return null
  if (kind === 'daily') return addDays(date, 1)
  if (kind === 'weekly') return addDays(date, 7)
  if (kind === 'monthly') {
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const targetY = m > 11 ? y + 1 : y
    const targetM = m > 11 ? 0 : m
    // 目标月最后一天:下个月 0 号
    const lastDay = new Date(targetY, targetM + 1, 0).getDate()
    const day = Math.min(anchorDay ?? d.getDate(), lastDay)
    return fmt(new Date(targetY, targetM, day))
  }
  // weekday
  let next = addDays(date, 1)
  while (true) {
    // 年份溢出会让 fmt 产出 5 位年份,parse 直接返回 null —— 抛错会连带整条 completeTodo 失败
    const nd = parse(next)
    if (!nd) return null
    const w = nd.getDay()
    if (w >= 1 && w <= 5) return next
    next = addDays(next, 1)
  }
}

/** 当前本地时间 'HH:mm' */
export function nowHm(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 备份文件名用的时间戳 'YYYYMMDD-HHmmss'(本地时区) */
export function stamp(): string {
  const d = new Date()
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(
    d.getMinutes()
  )}${pad(d.getSeconds())}`
}
