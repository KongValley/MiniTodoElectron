/**
 * 视图过滤与排序 —— 移植旧版 C# Model.cs 的 Q 类与 Store.Sorted()。
 * 看板 / 列表 / 侧栏计数共用这一个入口,禁止在组件里另写过滤。
 */
import {
  ACTIVE,
  DONE,
  DROPPED,
  INBOX_NAME,
  TRASH,
  VIEW_NAME,
  type BuiltinView,
  type Store,
  type TodoItem,
  type ViewKey
} from './types'
import { addDays, today } from './dates'

/** 未排期排在最后(与旧版 DateKey 的 '9999-12-31' 一致) */
const dateKey = (d: string): string => (d === '' ? '9999-12-31' : d)

function listName(store: Store, lid: string): string {
  const l = store.lists.find((x) => x.id === lid)
  return l ? l.name : INBOX_NAME
}

export function listById(store: Store, lid: string) {
  return store.lists.find((x) => x.id === lid)
}

export function groupById(store: Store, gid: string) {
  return store.groups.find((x) => x.id === gid)
}

/** 清单颜色,缺失回退收集箱灰 */
export function listColor(store: Store, lid: string): string {
  return listById(store, lid)?.color ?? '#9AA0A8'
}

/** 视图标题:内置视图名 / 分组名 / 清单名 */
export function viewTitle(store: Store, view: ViewKey): string {
  if (view.startsWith('list:')) return listName(store, view.slice(5))
  if (view.startsWith('group:')) return groupById(store, view.slice(6))?.name ?? '分组'
  return VIEW_NAME[view] ?? view
}

/** 单条任务是否属于该视图(含搜索词) */
export function match(t: TodoItem, view: ViewKey, search: string, store: Store): boolean {
  if (search !== '' && !(t.title + ' ' + t.note).toLowerCase().includes(search.toLowerCase())) return false

  if (view.startsWith('list:')) return t.status === ACTIVE && t.lid === view.slice(5)
  if (view.startsWith('group:')) {
    if (t.status !== ACTIVE) return false
    const l = listById(store, t.lid)
    return l !== undefined && l.gid === view.slice(6)
  }

  const t0 = today()
  switch (view as BuiltinView) {
    case 'all':
      return t.status === ACTIVE
    case 'today':
      return t.status === ACTIVE && t.date === t0
    case 'tmr':
      return t.status === ACTIVE && t.date === addDays(t0, 1)
    case 'week7':
      return t.status === ACTIVE && t.date.length === 10 && t.date >= t0 && t.date <= addDays(t0, 6)
    case 'inbox':
      return t.status === ACTIVE && t.date === ''
    case 'done':
      return t.status === DONE
    case 'dropped':
      return t.status === DROPPED
    case 'trash':
      return t.status === TRASH
    default:
      return true
  }
}

export function count(store: Store, view: ViewKey, search: string): number {
  let n = 0
  for (const t of store.todos) if (match(t, view, search, store)) n++
  return n
}

/** 今天到期或已逾期的未完成任务数(托盘角标 / 到期提醒共用) */
export function countDue(store: Store): number {
  const t0 = today()
  let n = 0
  for (const t of store.todos) if (t.status === ACTIVE && t.date !== '' && t.date <= t0) n++
  return n
}

/** 视图内全部任务,按 日期 → 优先级 → 清单名 → 创建顺序 排序 */
export function sorted(store: Store, view: ViewKey, search: string): TodoItem[] {
  const hit = store.todos.filter((t) => match(t, view, search, store))
  return hit.sort((x, y) => {
    const c = dateKey(x.date) < dateKey(y.date) ? -1 : dateKey(x.date) > dateKey(y.date) ? 1 : 0
    if (c !== 0) return c
    if (x.prio !== y.prio) return x.prio - y.prio
    const ln = listName(store, x.lid).localeCompare(listName(store, y.lid), 'zh')
    if (ln !== 0) return ln
    return x.seq - y.seq
  })
}

export interface Bucket {
  prio: 1 | 2 | 3
  items: TodoItem[]
}

/**
 * 按优先级(高→中→低)分桶。看板渲染与拖拽重排共用,避免两处各写一遍。
 * 桶内按 order 升序,平手用 seq(与旧版 Relayout 一致)。
 */
export function bucketsOf(items: TodoItem[]): Bucket[] {
  const out: Bucket[] = []
  for (const prio of [1, 2, 3] as const) {
    const bucket = items
      .filter((t) => t.prio === prio)
      .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.seq - b.seq))
    if (bucket.length > 0) out.push({ prio, items: bucket })
  }
  return out
}

export interface BoardColumn {
  date: string
  items: TodoItem[]
}

/** 看板列:只收有日期的任务,按日期升序成列(与旧版 Board.Relayout 一致) */
export function boardColumns(store: Store, view: ViewKey, search: string): BoardColumn[] {
  const byDate: Record<string, TodoItem[]> = {}
  for (const t of store.todos) {
    if (!match(t, view, search, store) || t.date === '') continue
    ;(byDate[t.date] ??= []).push(t)
  }
  return Object.keys(byDate)
    .sort()
    .map((date) => ({ date, items: byDate[date] }))
}
