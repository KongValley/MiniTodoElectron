/**
 * 全部数据变更的纯函数:入参 store,返回新 store(不可变,不原地改)。
 * normalizeStore 是唯一的数据信任边界 —— 导入旧数据 / IPC payload / 损坏文件恢复三条路径都过它。
 */
import {
  ACTIVE,
  DONE,
  DROPPED,
  TRASH,
  type Prio,
  type RepeatKind,
  type Status,
  type Store,
  type Subtask,
  type TodoGroup,
  type TodoItem,
  type TodoList
} from './types'
import { addDays, isDate, nextByRepeat, today } from './dates'

const REPEAT_KINDS: RepeatKind[] = ['none', 'daily', 'weekly', 'monthly', 'weekday']

/** 10 位十六进制 id(与旧版 Store.NewId 一致) */
export function newId(): string {
  let s = ''
  for (let i = 0; i < 10; i++) s += Math.floor(Math.random() * 16).toString(16)
  return s
}

export function emptyStore(): Store {
  return { version: 2, groups: [], lists: [], todos: [] }
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}

function normalizeSubtask(raw: unknown): Subtask {
  const o = (raw ?? {}) as Record<string, unknown>
  return { id: str(o['id']) || newId(), title: str(o['title']), done: o['done'] === true }
}

function normalizeGroup(raw: unknown, index: number): TodoGroup {
  const o = (raw ?? {}) as Record<string, unknown>
  return { id: str(o['id']) || newId(), name: str(o['name']), order: num(o['order'], index) }
}

function normalizeList(raw: unknown, index: number): TodoList {
  const o = (raw ?? {}) as Record<string, unknown>
  return {
    id: str(o['id']) || newId(),
    gid: str(o['gid']),
    name: str(o['name']),
    color: /^#[0-9a-fA-F]{6}$/.test(str(o['color'])) ? str(o['color']) : '#8A8F98',
    order: num(o['order'], index)
  }
}

function normalizeTodo(raw: unknown, listIds: Set<string>, fallbackSeq: number): TodoItem {
  const o = (raw ?? {}) as Record<string, unknown>
  const prioRaw = num(o['prio'], 2)
  const statusRaw = num(o['status'], ACTIVE)
  const lid = str(o['lid'])
  const repeatRaw = (o['repeat'] ?? {}) as Record<string, unknown>
  const kind = str(repeatRaw['kind'], 'none') as RepeatKind
  const doneAtRaw = o['doneAt']

  return {
    id: str(o['id']) || newId(),
    lid: listIds.has(lid) ? lid : '',
    title: str(o['title']),
    note: str(o['note']),
    date: isDate(o['date']) ? (o['date'] as string) : '',
    prio: (prioRaw === 1 || prioRaw === 2 || prioRaw === 3 ? prioRaw : 2) as Prio,
    status: (statusRaw === DONE || statusRaw === DROPPED || statusRaw === TRASH ? statusRaw : ACTIVE) as Status,
    seq: num(o['seq'], fallbackSeq),
    order: num(o['order'], 0),
    subtasks: Array.isArray(o['subtasks']) ? o['subtasks'].map(normalizeSubtask) : [],
    repeat: { kind: REPEAT_KINDS.includes(kind) ? kind : 'none' },
    createdAt: num(o['createdAt'], Date.now()),
    doneAt: typeof doneAtRaw === 'number' && Number.isFinite(doneAtRaw) ? doneAtRaw : null
  }
}

/**
 * 归一化任意来源的数据为合法 v2 store。旧版格式(无 version/order/subtasks/repeat/createdAt)
 * 经此函数直接得到合法 v2 —— 这就是「导入旧数据」的实现,不另写迁移器。
 */
export function normalizeStore(raw: unknown): Store {
  const o = (raw ?? {}) as Record<string, unknown>
  const groups = Array.isArray(o['groups']) ? o['groups'].map(normalizeGroup) : []
  const lists = Array.isArray(o['lists']) ? o['lists'].map(normalizeList) : []
  const listIds = new Set(lists.map((l) => l.id))
  const todosRaw = Array.isArray(o['todos']) ? o['todos'] : []
  const todos = todosRaw.map((t, i) => normalizeTodo(t, listIds, i + 1))
  return { version: 2, groups, lists, todos }
}

/** 首次运行写入示例数据(照抄旧版 Store.Seed 的 2 分组 / 5 清单 / 12 条任务) */
export function seedStore(): Store {
  const gidW = newId()
  const gidL = newId()
  const groups: TodoGroup[] = [
    { id: gidW, name: '工作', order: 0 },
    { id: gidL, name: '生活', order: 1 }
  ]

  const names = ['内容生产', '待办事务', '生活杂事', '健康', '装修']
  const gids = [gidW, gidW, gidL, gidL, gidL]
  const colors = ['#3A7AFE', '#7C5CFF', '#F2A33C', '#3C9954', '#12A5B8']
  const lists: TodoList[] = names.map((name, i) => ({
    id: newId(),
    gid: gids[i] as string,
    name,
    color: colors[i] as string,
    order: i
  }))
  const lids = lists.map((l) => l.id)

  const t = today()
  const seedRows: [string, string, string, string, Prio][] = [
    [lids[0] as string, 'AI任务管理视频（本周发布）', '本周发布', t, 1],
    [lids[1] as string, '整理本周工作周报', '', t, 2],
    [lids[1] as string, '填项目总结文档（周四前交）', '', addDays(t, 1), 1],
    [lids[3] as string, '补牙进度回看：这周挂号有进展吗', '', addDays(t, 1), 2],
    [lids[2] as string, '给父母买中秋礼物（寄到家）', '', addDays(t, 1), 1],
    [lids[4] as string, '去物业报备装修（工办）', '', addDays(t, 2), 1],
    [lids[3] as string, '查县医院就诊时间安排', '', addDays(t, 2), 1],
    [lids[0] as string, '国庆后要发的文章（初稿）', '', addDays(t, 2), 2],
    [lids[4] as string, '装修方案二次确认', '带上上周的报价单', addDays(t, 3), 2],
    [lids[2] as string, '整理旧照片备份', '', addDays(t, 4), 3],
    [lids[0] as string, '研究剪辑软件方案', '', addDays(t, 5), 3],
    ['', '随手记：下周要交的材料清单', '', '', 2]
  ]

  const now = Date.now()
  const todos: TodoItem[] = seedRows.map(([lid, title, note, date, prio], i) => ({
    id: newId(),
    lid,
    title,
    note,
    date,
    prio,
    status: ACTIVE,
    seq: i + 1,
    order: 0,
    subtasks: [],
    repeat: { kind: 'none' },
    createdAt: now + i,
    doneAt: null
  }))

  return { version: 2, groups, lists, todos }
}


function nextSeq(store: Store): number {
  let max = 0
  for (const t of store.todos) if (t.seq > max) max = t.seq
  return max + 1
}

/** 新建任务;patch 里缺的字段用默认值补齐 */
export function addTodo(store: Store, patch: Partial<TodoItem>): Store {
  const base: TodoItem = {
    id: newId(),
    lid: '',
    title: '',
    note: '',
    date: '',
    prio: 2,
    status: ACTIVE,
    seq: nextSeq(store),
    order: 0,
    subtasks: [],
    repeat: { kind: 'none' },
    createdAt: Date.now(),
    doneAt: null
  }
  const merged = normalizeTodo({ ...base, ...patch, id: patch.id ?? base.id }, new Set(store.lists.map((l) => l.id)), base.seq)
  // 新建一律落进 ACTIVE,避免调用方传脏 status
  return { ...store, todos: [...store.todos, { ...merged, status: ACTIVE, doneAt: null }] }
}

export function updateTodo(store: Store, id: string, patch: Partial<TodoItem>): Store {
  return {
    ...store,
    todos: store.todos.map((t) => (t.id === id ? normalizeTodo({ ...t, ...patch, id: t.id }, new Set(store.lists.map((l) => l.id)), t.seq) : t))
  }
}

/** 标记完成;若为重复任务则生成下一条。已完成的重复任务再点不会重复生成。 */
export function completeTodo(store: Store, id: string): Store {
  const target = store.todos.find((t) => t.id === id)
  if (!target || target.status === DONE) return store

  const done: TodoItem = { ...target, status: DONE, doneAt: Date.now() }
  const todos = store.todos.map((t) => (t.id === id ? done : t))

  const next = done.date === '' ? null : nextByRepeat(done.date, done.repeat.kind)
  if (next === null) return { ...store, todos }

  const spawned: TodoItem = {
    ...done,
    id: newId(),
    status: ACTIVE,
    date: next,
    seq: nextSeq(store),
    order: 0,
    subtasks: done.subtasks.map((s) => ({ id: newId(), title: s.title, done: false })),
    createdAt: Date.now(),
    doneAt: null
  }
  return { ...store, todos: [...todos, spawned] }
}

/** 取消完成 / 恢复(供编辑弹窗改状态用) */
export function setStatus(store: Store, id: string, status: Status): Store {
  return {
    ...store,
    todos: store.todos.map((t) =>
      t.id === id ? { ...t, status, doneAt: status === DONE ? (t.doneAt ?? Date.now()) : null } : t
    )
  }
}

/** 删除:purge 为 true 时真删(回收站视图),否则置 TRASH */
export function removeTodos(store: Store, ids: string[], purge: boolean): Store {
  const idSet = new Set(ids)
  if (purge) return { ...store, todos: store.todos.filter((t) => !idSet.has(t.id)) }
  return {
    ...store,
    todos: store.todos.map((t) => (idSet.has(t.id) ? { ...t, status: TRASH } : t))
  }
}

/**
 * 看板拖拽改期/重排的唯一入口。设 date 后,对该 (date, prio) 桶
 * 按「移除原项 → 在 index 处插入 → 重排 order = 1..n」写回。index 越界钳到 [0, n]。
 */
export function moveCard(store: Store, id: string, date: string, index: number): Store {
  const target = store.todos.find((t) => t.id === id)
  if (!target) return store
  const nextDate = isDate(date) ? date : ''

  // 桶成员:同日期同优先级(不含被拖动项自身)
  const bucketIds = store.todos
    .filter((t) => t.id !== id && t.status === target.status && t.date === nextDate && t.prio === target.prio)
    .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.seq - b.seq))
    .map((t) => t.id)

  const at = Math.max(0, Math.min(index, bucketIds.length))
  bucketIds.splice(at, 0, id)

  const orderById = new Set(bucketIds)
  const orderOf: Record<string, number> = {}
  bucketIds.forEach((tid, i) => {
    orderOf[tid] = i + 1
  })

  return {
    ...store,
    todos: store.todos.map((t) => {
      if (t.id === id) return { ...t, date: nextDate, order: orderOf[t.id] as number }
      if (orderById.has(t.id)) return { ...t, order: orderOf[t.id] as number }
      return t
    })
  }
}

export function addSubtask(store: Store, id: string, title: string): Store {
  const clean = title.trim()
  if (clean === '') return store
  return {
    ...store,
    todos: store.todos.map((t) =>
      t.id === id ? { ...t, subtasks: [...t.subtasks, { id: newId(), title: clean, done: false }] } : t
    )
  }
}

export function toggleSubtask(store: Store, id: string, subId: string): Store {
  return {
    ...store,
    todos: store.todos.map((t) =>
      t.id === id
        ? { ...t, subtasks: t.subtasks.map((s) => (s.id === subId ? { ...s, done: !s.done } : s)) }
        : t
    )
  }
}

export function removeSubtask(store: Store, id: string, subId: string): Store {
  return {
    ...store,
    todos: store.todos.map((t) => (t.id === id ? { ...t, subtasks: t.subtasks.filter((s) => s.id !== subId) } : t))
  }
}

export function setSubtasks(store: Store, id: string, subtasks: Subtask[]): Store {
  return { ...store, todos: store.todos.map((t) => (t.id === id ? { ...t, subtasks } : t)) }
}
