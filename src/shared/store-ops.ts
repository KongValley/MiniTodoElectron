/**
 * 全部数据变更的纯函数:入参 store,返回新 store(不可变,不原地改)。
 * normalizeStore 是唯一的数据信任边界 —— 导入旧数据 / IPC payload / 损坏文件恢复三条路径都过它。
 */
import {
  ACTIVE,
  DONE,
  DROPPED,
  LIST_COLORS,
  TRASH,
  type Prio,
  type RepeatKind,
  type RepeatRule,
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
  const anchorRaw = num(repeatRaw['anchorDay'], 0)
  const doneAtRaw = o['doneAt']

  const repeat: RepeatRule = { kind: REPEAT_KINDS.includes(kind) ? kind : 'none' }
  if (repeat.kind === 'monthly' && anchorRaw >= 1 && anchorRaw <= 31) repeat.anchorDay = anchorRaw

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
    repeat,
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
  // id 必须唯一:completeTodo / moveCard 的 find 与分桶都假定唯一。
  // 重复 id 换新的而不是丢弃 —— 丢弃等于静默删用户的任务,两条都活着反而各自能操作。
  const seenGroups = new Set<string>()
  const seenLists = new Set<string>()
  const seenTodos = new Set<string>()
  const claim = (id: string, seen: Set<string>): string => {
    if (!seen.has(id)) {
      seen.add(id)
      return id
    }
    const fresh = newId()
    seen.add(fresh)
    return fresh
  }

  const groups = Array.isArray(o['groups'])
    ? o['groups'].map((g, i) => {
        const n = normalizeGroup(g, i)
        return { ...n, id: claim(n.id, seenGroups) }
      })
    : []
  const lists = Array.isArray(o['lists'])
    ? o['lists'].map((l, i) => {
        const n = normalizeList(l, i)
        return { ...n, id: claim(n.id, seenLists) }
      })
    : []
  const listIds = new Set(lists.map((l) => l.id))
  const todosRaw = Array.isArray(o['todos']) ? o['todos'] : []
  const todos = todosRaw.map((t, i) => {
    const n = normalizeTodo(t, listIds, i + 1)
    return { ...n, id: claim(n.id, seenTodos) }
  })
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
  const colors = LIST_COLORS.slice(0, 5)
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
  const merged = normalizeTodo({ ...base, ...definedPatch(patch), id: patch.id ?? base.id }, new Set(store.lists.map((l) => l.id)), base.seq)
  // 新建一律落进 ACTIVE,避免调用方传脏 status
  return { ...store, todos: [...store.todos, { ...merged, status: ACTIVE, doneAt: null }] }
}

/** patch 里显式的 undefined 不该覆盖已有值({ date: undefined } 会把已排期改成未排期) */
function definedPatch(patch: Partial<TodoItem>): Partial<TodoItem> {
  return Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<TodoItem>
}

export function updateTodo(store: Store, id: string, patch: Partial<TodoItem>): Store {
  const listIds = new Set(store.lists.map((l) => l.id))
  const clean = definedPatch(patch)
  return {
    ...store,
    todos: store.todos.map((t) =>
      t.id === id ? normalizeTodo({ ...t, ...clean, id: t.id }, listIds, t.seq) : t
    )
  }
}

/** 标记完成;若为重复任务则生成下一条。已完成的重复任务再点不会重复生成。 */
export function completeTodo(store: Store, id: string): Store {
  // 按下标改第一条而不是 map 全改:重复 id 防御层(normalizeStore 已保证唯一)
  const at = store.todos.findIndex((t) => t.id === id)
  const target = at < 0 ? undefined : store.todos[at]
  if (!target || target.status === DONE) return store

  const done: TodoItem = { ...target, status: DONE, doneAt: Date.now() }
  const todos = store.todos.map((t, i) => (i === at ? done : t))

  const next = done.date === '' ? null : nextByRepeat(done.date, done.repeat.kind, done.repeat.anchorDay)
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
  // 旧数据没有 anchorDay:用被完成这条的原始日号补上,否则 1-31 会永远停在 28
  if (spawned.repeat.kind === 'monthly' && !spawned.repeat.anchorDay && isDate(done.date)) {
    const day = Number(done.date.slice(8, 10))
    spawned.repeat = { ...spawned.repeat, anchorDay: day }
  }
  return { ...store, todos: [...todos, spawned] }
}

/** 取消完成 / 恢复(供编辑弹窗改状态用) */
export function setStatus(store: Store, id: string, status: Status): Store {
  // 「改为已完成」与点勾必须是同一条路径,否则重复任务在弹窗里改完不会生成下一期
  if (status === DONE) return completeTodo(store, id)
  return {
    ...store,
    // 非 DONE 一律清 doneAt:恢复出来的任务不该留着旧的完成时间
    todos: store.todos.map((t) => (t.id === id ? { ...t, status, doneAt: null } : t))
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

  // 桶成员:同日期同优先级(不含被拖动项自身)。单次遍历收集,避免 filter+sort 各扫一遍。
  const bucket: TodoItem[] = []
  for (const t of store.todos) {
    if (t.id !== id && t.status === target.status && t.date === nextDate && t.prio === target.prio) bucket.push(t)
  }
  bucket.sort((a, b) => (a.order !== b.order ? a.order - b.order : a.seq - b.seq))

  const at = Math.max(0, Math.min(index, bucket.length))
  const ordered = bucket.map((t) => t.id)
  ordered.splice(at, 0, id)

  const orderOf: Record<string, number> = {}
  ordered.forEach((tid, i) => {
    orderOf[tid] = i + 1
  })

  return {
    ...store,
    todos: store.todos.map((t) => {
      if (t.id === id) return { ...t, date: nextDate, order: orderOf[t.id] as number }
      const o = orderOf[t.id]
      return o === undefined ? t : { ...t, order: o }
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

export interface MergeStats {
  groups: number
  lists: number
  todos: number
}

/**
 * 合并导入:按 id 去重追加(base 优先),同 id 的条目跳过并计入 skipped。
 * 引用了被跳过清单的任务改挂收集箱(normalizeStore 对未知 lid 一律归 ''),
 * 分组/清单的 gid 悬空不处理 —— 侧栏按 gid 查不到时该行不渲染,不崩。
 * todos 的 seq 重排为 1..n,避免与 base 既有 seq 冲突导致排序平手不确定。
 */
export function mergeStore(base: Store, incoming: Store): { store: Store; skipped: MergeStats } {
  const groupIds = new Set(base.groups.map((g) => g.id))
  const listIds = new Set(base.lists.map((l) => l.id))
  const todoIds = new Set(base.todos.map((t) => t.id))
  const skipped: MergeStats = { groups: 0, lists: 0, todos: 0 }

  const groups = [...base.groups]
  for (const x of incoming.groups) {
    if (groupIds.has(x.id)) {
      skipped.groups++
      continue
    }
    groupIds.add(x.id)
    groups.push(x)
  }

  const lists = [...base.lists]
  for (const x of incoming.lists) {
    if (listIds.has(x.id)) {
      skipped.lists++
      continue
    }
    listIds.add(x.id)
    lists.push(x)
  }

  const todos = [...base.todos]
  for (const x of incoming.todos) {
    if (todoIds.has(x.id)) {
      skipped.todos++
      continue
    }
    todoIds.add(x.id)
    todos.push(listIds.has(x.lid) ? x : { ...x, lid: '' })
  }

  return {
    store: { version: 2, groups, lists, todos: todos.map((t, i) => ({ ...t, seq: i + 1 })) },
    skipped
  }
}

/* ---------- 分组与清单的增删改（侧栏新建/重命名/删除用） ---------- */

/** 该组现有清单的下一个 order(空组为 1);分组同理取全库最大值 + 1 */
function nextOrderOf(items: { order: number }[]): number {
  let max = 0
  for (const it of items) if (it.order > max) max = it.order
  return max + 1
}

/** 新建分组;空白名不建 */
export function addGroup(store: Store, name: string): Store {
  const clean = name.trim()
  if (clean === '') return store
  const g: TodoGroup = { id: newId(), name: clean, order: nextOrderOf(store.groups) }
  return { ...store, groups: [...store.groups, g] }
}

/** 重命名分组;找不到或空白名都不改 */
export function renameGroup(store: Store, id: string, name: string): Store {
  const clean = name.trim()
  if (clean === '' || !store.groups.some((g) => g.id === id)) return store
  return { ...store, groups: store.groups.map((g) => (g.id === id ? { ...g, name: clean } : g)) }
}

/**
 * 删除分组:组内清单一并删除,其下任务的 lid 置 ''(移到收集箱,不丢)。
 * 悬空 gid 必须在这里闭合 —— normalizeList 不校验 gid,而侧栏/任务弹窗都从
 * groups 反查渲染,悬空清单会整行不渲染、其任务在侧栏无任何计数行。
 */
export function removeGroup(store: Store, id: string): { store: Store; removedLists: number; movedTodos: number } {
  if (!store.groups.some((g) => g.id === id)) return { store, removedLists: 0, movedTodos: 0 }
  const gone = new Set(store.lists.filter((l) => l.gid === id).map((l) => l.id))
  let movedTodos = 0
  const todos = store.todos.map((t) => {
    if (!gone.has(t.lid)) return t
    movedTodos++
    return { ...t, lid: '' }
  })
  return {
    store: { ...store, groups: store.groups.filter((g) => g.id !== id), lists: store.lists.filter((l) => l.gid !== id), todos },
    removedLists: gone.size,
    movedTodos
  }
}

/** 新建清单;gid 不存在则退回收集箱(''),非法颜色回退首个色 */
export function addList(store: Store, gid: string, name: string, color: string): Store {
  const clean = name.trim()
  if (clean === '') return store
  const g = store.groups.some((x) => x.id === gid) ? gid : ''
  const l = normalizeList(
    { id: newId(), gid: g, name: clean, color, order: nextOrderOf(store.lists.filter((x) => x.gid === g)) },
    0
  )
  return { ...store, lists: [...store.lists, l] }
}

/** 改清单字段(名字/所属分组/颜色);合法性由 normalizeList 统一兜底 */
export function updateList(store: Store, id: string, patch: Partial<TodoList>): Store {
  const target = store.lists.find((l) => l.id === id)
  if (!target) return store
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<TodoList>
  return { ...store, lists: store.lists.map((l) => (l.id === id ? normalizeList({ ...l, ...clean, id: l.id }, l.order) : l)) }
}

/**
 * 删除清单:dropTodos 为 true 连其下任务一起删,为 false 把任务移到收集箱。
 * 两种路径都不丢「任务还存在」这个事实之外的意外数据,且不留悬空 lid。
 */
export function removeList(store: Store, id: string, dropTodos: boolean): { store: Store; removedTodos: number } {
  if (!store.lists.some((l) => l.id === id)) return { store, removedTodos: 0 }
  const removedTodos = store.todos.filter((t) => t.lid === id).length
  const todos = dropTodos
    ? store.todos.filter((t) => t.lid !== id)
    : store.todos.map((t) => (t.lid === id ? { ...t, lid: '' } : t))
  return { store: { ...store, lists: store.lists.filter((l) => l.id !== id), todos }, removedTodos }
}

/** 分组重排:移除自身 → 在 index 处插入 → order 重写 1..n(同 moveCard 的三段式) */
export function moveGroup(store: Store, id: string, index: number): Store {
  if (!store.groups.some((g) => g.id === id)) return store
  const rest = store.groups.filter((g) => g.id !== id)
  const at = Math.max(0, Math.min(index, rest.length))
  const ordered = rest.map((g) => g.id)
  ordered.splice(at, 0, id)
  const orderOf: Record<string, number> = {}
  ordered.forEach((gid, i) => {
    orderOf[gid] = i + 1
  })
  return {
    ...store,
    groups: store.groups.map((g) => {
      const o = orderOf[g.id]
      return o === undefined ? g : { ...g, order: o }
    })
  }
}

/**
 * 清单重排,支持跨分组拖:目标组移除自身后插入,并把**新旧两组**的 order 都重写 1..n。
 * 只重排目标组会在原组留空洞,排序随之错乱。
 */
export function moveList(store: Store, id: string, toGid: string, index: number): Store {
  const target = store.lists.find((l) => l.id === id)
  if (!target) return store
  const fromGid = target.gid
  const to = store.groups.some((g) => g.id === toGid) || toGid === '' ? toGid : fromGid

  // 按 order 排(数组序不等于 order 序),不是用数组序推位置
  const inGroup = (gid: string, exceptId: string): TodoList[] =>
    store.lists.filter((l) => l.gid === gid && l.id !== exceptId).sort((a, b) => a.order - b.order)

  const rest = inGroup(to, id)
  const at = Math.max(0, Math.min(index, rest.length))
  const ordered = rest.map((l) => l.id)
  ordered.splice(at, 0, id)
  const orderOf: Record<string, number> = {}
  ordered.forEach((lid, i) => {
    orderOf[lid] = i + 1
  })
  // 原组也要重排,否则 order 留空洞、排序错乱
  if (fromGid !== to) inGroup(fromGid, id).forEach((l, i) => {
    orderOf[l.id] = i + 1
  })

  return {
    ...store,
    lists: store.lists.map((l) => {
      const o = orderOf[l.id]
      if (l.id === id) return { ...l, gid: to, order: o as number }
      return o === undefined ? l : { ...l, order: o }
    })
  }
}

/** 该组尚未占用的首个配色;全被占用时退回首个(新建清单的默认色) */
export function freeListColor(store: Store, gid: string): string {
  const used = new Set(store.lists.filter((l) => l.gid === gid).map((l) => l.color))
  return LIST_COLORS.find((c) => !used.has(c)) ?? (LIST_COLORS[0] as string)
}
