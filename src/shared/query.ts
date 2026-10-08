/**
 * 视图过滤与排序 —— 移植旧版 C# Model.cs 的 Q 类与 Store.Sorted()。
 * 计数与看板列走 store-index 的单次扫描索引;这里只保留排序、分桶与查表。
 */
import {
  ACTIVE,
  DONE,
  DROPPED,
  INBOX_NAME,
  TRASH,
  VIEW_NAME,
  type Store,
  type TodoGroup,
  type TodoItem,
  type TodoList,
  type ViewKey
} from './types'
import { addDays, today } from './dates'
import type { StoreIndex } from './store-index'

/** 未排期排在最后(与旧版 DateKey 的 '9999-12-31' 一致) */
const dateKey = (d: string): string => (d === '' ? '9999-12-31' : d)

export function listById(store: Store, lid: string): TodoList | undefined {
  return store.lists.find((x) => x.id === lid)
}

export function groupById(store: Store, gid: string): TodoGroup | undefined {
  return store.groups.find((x) => x.id === gid)
}

/** 视图标题:内置视图名 / 分组名 / 清单名 */
export function viewTitle(store: Store, view: ViewKey): string {
  if (view.startsWith('list:')) return listById(store, view.slice(5))?.name ?? INBOX_NAME
  if (view.startsWith('group:')) return groupById(store, view.slice(6))?.name ?? '分组'
  return VIEW_NAME[view] ?? view
}

/** 今天到期或已逾期的未完成任务数(托盘角标 / 到期提醒共用) */
export function countDue(store: Store): number {
  const t0 = today()
  let n = 0
  for (const t of store.todos) if (t.status === ACTIVE && t.date !== '' && t.date <= t0) n++
  return n
}

/** 该视图命中的任务集合(取自索引,不再重新扫描 store) */
function hitsFor(index: StoreIndex, view: ViewKey): TodoItem[] {
  if (view.startsWith('list:')) {
    const lid = view.slice(5)
    return index.hits.filter((t) => t.status === ACTIVE && t.lid === lid)
  }
  if (view.startsWith('group:')) {
    const gid = view.slice(6)
    const lids = new Set<string>()
    for (const l of index.listOf.values()) if (l.gid === gid) lids.add(l.id)
    return index.hits.filter((t) => t.status === ACTIVE && lids.has(t.lid))
  }

  const t0 = today()
  switch (view) {
    case 'all':
      return index.hits.filter((t) => t.status === ACTIVE)
    case 'today':
      return index.hits.filter((t) => t.status === ACTIVE && t.date === t0)
    case 'tmr': {
      const t1 = addDays(t0, 1)
      return index.hits.filter((t) => t.status === ACTIVE && t.date === t1)
    }
    case 'week7': {
      const t6 = addDays(t0, 6)
      return index.hits.filter((t) => t.status === ACTIVE && t.date.length === 10 && t.date >= t0 && t.date <= t6)
    }
    case 'inbox':
      return index.hits.filter((t) => t.status === ACTIVE && t.date === '')
    case 'done':
      return index.hits.filter((t) => t.status === DONE)
    case 'dropped':
      return index.hits.filter((t) => t.status === DROPPED)
    case 'trash':
      return index.hits.filter((t) => t.status === TRASH)
    default:
      return index.hits
  }
}

export type ListSortKey = 'date' | 'prio' | 'list'
export interface ListSort {
  key: ListSortKey
  desc: boolean
}

/** 视图内全部任务,排序由 sort 决定;null = 默认顺序(日期→优先级→清单名→seq) */
export function sortedByIndex(index: StoreIndex, view: ViewKey, sort: ListSort | null = null): TodoItem[] {
  const nameOf = (lid: string): string => index.listOf.get(lid)?.name ?? INBOX_NAME
  if (sort === null) {
    return hitsFor(index, view).sort((x, y) => {
      const kx = dateKey(x.date)
      const ky = dateKey(y.date)
      if (kx !== ky) return kx < ky ? -1 : 1
      if (x.prio !== y.prio) return x.prio - y.prio
      const ln = nameOf(x.lid).localeCompare(nameOf(y.lid), 'zh')
      if (ln !== 0) return ln
      return x.seq - y.seq
    })
  }

  const flip = (r: number): number => (sort.desc ? -r : r)
  return hitsFor(index, view).sort((x, y) => {
    // 未排期恒在末位,不参与升降翻转(排序键为空即视为最后)
    if (x.date === '' || y.date === '') {
      if (x.date === y.date) return x.seq - y.seq
      return x.date === '' ? 1 : -1
    }
    let r = 0
    if (sort.key === 'date') r = dateKey(x.date) < dateKey(y.date) ? -1 : dateKey(x.date) > dateKey(y.date) ? 1 : 0
    else if (sort.key === 'prio') r = x.prio - y.prio
    else r = nameOf(x.lid).localeCompare(nameOf(y.lid), 'zh')
    if (r !== 0) return flip(r)
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
