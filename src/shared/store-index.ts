/**
 * 视图索引:一次遍历 store.todos 产出侧栏计数 / 看板列 / 搜索命中。
 *
 * 为什么存在:侧栏 22 行若各调一次 count() 就是 22 次全量扫描(5000 条实测 105 ms);
 * 一次遍历建索引后降到 7 ms。所有循环不变量(日期边界、search 小写化、清单查表)
 * 必须在循环外算一次 —— 写在循环内收益即归零。
 */
import { ACTIVE, DONE, DROPPED, INBOX_NAME, TRASH, type Store, type TodoItem, type TodoList } from './types'
import { addDays, today } from './dates'

export interface BoardColumn {
  date: string
  items: TodoItem[]
}

export interface StoreIndex {
  /** 视图键 → 计数。8 个内置视图 + 每个清单的 `list:<id>` + 每个分组的 `group:<gid>` */
  counts: Record<string, number>
  /** 看板列(只含有日期的命中任务,按日期升序) */
  columns: BoardColumn[]
  /** 清单 id → 清单(O(1) 取名/取色) */
  listOf: Map<string, TodoList>
  /** 命中搜索的全部任务(不限视图,供列表排序与搜索命中计数用) */
  hits: TodoItem[]
  /** 本次索引对应的搜索词(便于调用方判断是否需要重建) */
  search: string
}

export function buildIndex(store: Store, search: string): StoreIndex {
  // 循环不变量:全部提到循环外
  const s = search.trim().toLowerCase()
  const t0 = today()
  const t1 = addDays(t0, 1)
  const t6 = addDays(t0, 6)

  const listOf = new Map<string, TodoList>()
  for (const l of store.lists) listOf.set(l.id, l)

  const counts: Record<string, number> = Object.create(null)
  for (const v of ['all', 'today', 'tmr', 'week7', 'inbox', 'done', 'dropped', 'trash']) counts[v] = 0
  // 今天到期或逾期的未完成任务数(与 query.ts 的 countDue 判据逐字一致);
  // 顺手在这里算掉,StatusBar 就不必每次渲染再扫一遍全表
  counts['due'] = 0
  for (const l of store.lists) {
    counts[`list:${l.id}`] = 0
    counts[`group:${l.gid}`] = 0
  }

  const hits: TodoItem[] = []
  const byDate = new Map<string, TodoItem[]>()

  for (const t of store.todos) {
    if (s !== '' && !(t.title + ' ' + t.note).toLowerCase().includes(s)) continue
    hits.push(t)

    if (t.status === ACTIVE) {
      counts['all'] = (counts['all'] as number) + 1
      const l = listOf.get(t.lid)
      if (l) {
        counts[`list:${l.id}`] = (counts[`list:${l.id}`] as number) + 1
        // 不校验分组是否存在:query.ts 的 hitsFor 只按 lid 归集,两端口径必须一致,
        // 否则角标数与点进去看到的条数对不上
        counts[`group:${l.gid}`] = (counts[`group:${l.gid}`] as number) + 1
      }
      if (t.date === '') {
        counts['inbox'] = (counts['inbox'] as number) + 1
      } else {
        // 有日期的未完成任务:今天或已逾期才计入 due
        if (t.date <= t0) counts['due'] = (counts['due'] as number) + 1
        if (t.date === t0) counts['today'] = (counts['today'] as number) + 1
        if (t.date === t1) counts['tmr'] = (counts['tmr'] as number) + 1
        if (t.date.length === 10 && t.date >= t0 && t.date <= t6) counts['week7'] = (counts['week7'] as number) + 1
        const arr = byDate.get(t.date)
        if (arr) arr.push(t)
        else byDate.set(t.date, [t])
      }
    } else if (t.status === DONE) counts['done'] = (counts['done'] as number) + 1
    else if (t.status === DROPPED) counts['dropped'] = (counts['dropped'] as number) + 1
    else if (t.status === TRASH) counts['trash'] = (counts['trash'] as number) + 1
  }

  const columns: BoardColumn[] = [...byDate.keys()]
    .sort()
    .map((date) => ({ date, items: byDate.get(date) as TodoItem[] }))

  return { counts, columns, listOf, hits, search }
}


/** 清单名,缺失回退收集箱 */
export function indexListName(index: StoreIndex, lid: string): string {
  return index.listOf.get(lid)?.name ?? INBOX_NAME
}

/** 清单色,缺失回退收集箱灰 */
export function indexListColor(index: StoreIndex, lid: string): string {
  return index.listOf.get(lid)?.color ?? '#9AA0A8'
}
