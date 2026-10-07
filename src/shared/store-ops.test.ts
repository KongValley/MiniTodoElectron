/**
 * 共享层纯函数自检(零依赖,node --test 运行):
 *   node --test src/shared/store-ops.test.ts
 * 覆盖 normalizeStore / nextByRepeat / week7 边界 / completeTodo 幂等 / moveCard 重排。
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { addDays, isDate, label, nextByRepeat, today, week } from './dates'
import { bucketsOf, countDue, sortedByIndex } from './query'
import { buildIndex } from './store-index'
import {
  ACTIVE,
  DONE,
  TRASH,
  type Store,
  type TodoItem
} from './types'
import {
  addTodo,
  completeTodo,
  emptyStore,
  moveCard,
  newId,
  normalizeStore,
  seedStore,
  removeTodos,
  setStatus,
  toggleSubtask,
  updateTodo
} from './store-ops'

/** 旧版 C# 应用写出的真实数据(无 version/order/subtasks/repeat/createdAt) */
const LEGACY_JSON = JSON.stringify({
  groups: [
    { id: '6d8ae94af3', name: '工作' },
    { id: '34d79f911b', name: '生活' }
  ],
  lists: [
    { id: '7eaee681d4', gid: '6d8ae94af3', name: '内容生产', color: '#3A7AFE' },
    { id: '9ba7de473b', gid: '6d8ae94af3', name: '待办事务', color: '#7C5CFF' },
    { id: 'dc3277c2a7', gid: '34d79f911b', name: '生活杂事', color: '#F2A33C' },
    { id: 'cf9f7e6985', gid: '34d79f911b', name: '健康', color: '#3C9954' },
    { id: 'ac02528592', gid: '34d79f911b', name: '装修', color: '#12A5B8' }
  ],
  todos: [
    { id: '8c1ed70edb', lid: '7eaee681d4', title: 'AI任务管理视频（本周发布）', note: '本周发布', date: '2026-10-07', prio: 1, status: 0, seq: 1 },
    { id: '3ece1da865', lid: '9ba7de473b', title: '整理本周工作周报', note: '', date: '2026-10-07', prio: 2, status: 0, seq: 2 },
    { id: 'a1b2c3d4e5', lid: '', title: '随手记：下周要交的材料清单', note: '含"引号"与\\反斜杠', date: '', prio: 2, status: 0, seq: 3 }
  ]
})

function todo(over: Partial<TodoItem>): TodoItem {
  return {
    id: newId(),
    lid: '',
    title: 't',
    note: '',
    date: '',
    prio: 2,
    status: ACTIVE,
    seq: 1,
    order: 0,
    subtasks: [],
    repeat: { kind: 'none' },
    createdAt: 0,
    doneAt: null,
    ...over
  }
}

test('isDate 严格校验', () => {
  assert.equal(isDate('2026-10-07'), true)
  assert.equal(isDate('2026-2-3'), false, '缺前导零应拒绝')
  assert.equal(isDate('2026-13-01'), false, '月份越界应拒绝')
  assert.equal(isDate('2026-02-30'), false, '不存在的日期应拒绝')
  assert.equal(isDate(''), false)
  assert.equal(isDate(20261007), false)
  assert.equal(isDate(undefined), false)
})

test('label 与 week', () => {
  const t = today()
  assert.equal(label(t).startsWith('今天 '), true)
  assert.equal(label(addDays(t, 1)).startsWith('明天 '), true)
  assert.equal(label(addDays(t, 2)).startsWith('后天 '), true)
  assert.equal(label(''), '未排期')
  assert.equal(label('2026-13-01'), '未排期')
  assert.equal(week(''), '')
  assert.equal(week('2026-10-07').length, 2)
})

test('nextByRepeat 五种规则', () => {
  assert.equal(nextByRepeat('2026-01-31', 'none'), null)
  assert.equal(nextByRepeat('2026-01-31', 'daily'), '2026-02-01')
  assert.equal(nextByRepeat('2026-01-31', 'weekly'), '2026-02-07')
  assert.equal(nextByRepeat('2026-01-31', 'monthly'), '2026-02-28', '月末溢出落到目标月最后一天')
  assert.equal(nextByRepeat('2026-12-15', 'monthly'), '2027-01-15', '跨年')
  assert.equal(nextByRepeat('2026-10-09', 'weekday'), '2026-10-12', '周五 → 下周一')
  assert.equal(nextByRepeat('2026-10-10', 'weekday'), '2026-10-12', '周六 → 下周一')
  assert.equal(nextByRepeat('', 'daily'), null)
})

test('normalizeStore 吃旧版数据不丢条数,新字段补默认值', () => {
  const s = normalizeStore(JSON.parse(LEGACY_JSON))
  assert.equal(s.version, 2)
  assert.equal(s.groups.length, 2)
  assert.equal(s.lists.length, 5)
  assert.equal(s.todos.length, 3, '三条都要在')
  const first = s.todos[0] as TodoItem
  assert.equal(first.title, 'AI任务管理视频（本周发布）')
  assert.equal(first.prio, 1)
  assert.equal(first.order, 0)
  assert.deepEqual(first.subtasks, [])
  assert.deepEqual(first.repeat, { kind: 'none' })
  assert.equal(first.doneAt, null)
  // 转义往返
  assert.equal(s.todos[2]?.note, '含"引号"与\\反斜杠')
})

test('normalizeStore 对脏数据回退而非抛错', () => {
  const s = normalizeStore({
    groups: 'nope',
    lists: [{ id: 'L1', name: '清单', color: 'red', gid: 5 }],
    todos: [
      { id: '', lid: '不存在', date: '2026-2-3', prio: 9, status: 7, title: 42, subtasks: 'x', repeat: { kind: 'hourly' }, seq: NaN },
      null
    ]
  })
  assert.equal(s.groups.length, 0)
  assert.equal(s.lists[0]?.color, '#8A8F98', '非法颜色回退')
  assert.equal(s.todos.length, 2)
  const t = s.todos[0] as TodoItem
  assert.ok(t.id.length === 10, '空 id 补新 id')
  assert.equal(t.lid, '', '悬空 lid 归收集箱')
  assert.equal(t.date, '', '非法日期清空')
  assert.equal(t.prio, 2)
  assert.equal(t.status, ACTIVE)
  assert.equal(t.title, '')
  assert.deepEqual(t.subtasks, [])
  assert.equal(t.repeat.kind, 'none')
  assert.equal(t.seq, 1, 'NaN seq 回退为数组下标序(旧数据无 seq 时保持原顺序)')
  assert.equal((s.todos[1] as TodoItem).title, '')
})

test('week7 是 [今天, 今天+6] 闭区间', () => {
  const t = today()
  const store: Store = {
    ...emptyStore(),
    todos: [
      todo({ date: addDays(t, -1) }),
      todo({ date: t }),
      todo({ date: addDays(t, 6) }),
      todo({ date: addDays(t, 7) })
    ]
  }
  const idx = buildIndex(store, '')
  assert.equal(idx.counts['week7'], 2, '含第 6 天,不含第 7 天与前一天')
  assert.equal(idx.counts['today'], 1)
  assert.equal(idx.counts['inbox'], 0)
})

test('索引的 list:/group: 计数与搜索', () => {
  const store = normalizeStore(JSON.parse(LEGACY_JSON))
  const idx = buildIndex(store, '')
  assert.equal(idx.counts['list:7eaee681d4'], 1)
  assert.equal(idx.counts['group:6d8ae94af3'], 2, '工作组下两条')
  assert.equal(idx.counts['inbox'], 1, '未排期且无清单')
  assert.equal(buildIndex(store, '周报').hits.length, 1)
  assert.equal(buildIndex(store, '周报X').hits.length, 0)
})

test('sortedByIndex 全序:日期 → 优先级 → 清单名 → seq', () => {
  const store = normalizeStore(JSON.parse(LEGACY_JSON))
  const rows = sortedByIndex(buildIndex(store, ''), 'all')
  assert.equal(rows.length, 3)
  assert.equal(rows[2]?.date, '', '未排期排最后')
  assert.equal(rows[0]?.prio, 1, '同日高优先级在前')
})

test('boardColumns 只收有日期的,列内按 prio 分桶', () => {
  const t = today()
  const store: Store = {
    ...emptyStore(),
    todos: [
      todo({ date: t, prio: 3, seq: 1 }),
      todo({ date: t, prio: 1, seq: 2 }),
      todo({ date: '', prio: 1, seq: 3 }),
      todo({ date: addDays(t, 1), prio: 2, seq: 4 })
    ]
  }
  const cols = buildIndex(store, '').columns
  assert.equal(cols.length, 2, '未排期不成列')
  assert.deepEqual(cols.map((c) => c.date), [t, addDays(t, 1)])
  assert.deepEqual(bucketsOf(cols[0]?.items ?? []).map((b) => b.prio), [1, 3], '高→低,空桶不出现')
})

test('completeTodo 幂等,且重复任务生成下一条并重置子任务', () => {
  const id = 'fixed1'
  const store: Store = {
    ...emptyStore(),
    todos: [
      todo({
        id,
        title: '站会',
        date: '2026-01-31',
        repeat: { kind: 'monthly' },
        subtasks: [{ id: 's1', title: '准备材料', done: true }]
      })
    ]
  }
  const once = completeTodo(store, id)
  assert.equal(once.todos.length, 2)
  assert.equal(once.todos[0]?.status, DONE)
  assert.ok(once.todos[0]?.doneAt !== null)
  const spawned = once.todos[1] as TodoItem
  assert.equal(spawned.status, ACTIVE)
  assert.equal(spawned.date, '2026-02-28')
  assert.equal(spawned.subtasks[0]?.done, false, '子任务重置')
  assert.ok(spawned.id !== id)

  const twice = completeTodo(once, id)
  assert.equal(twice.todos.length, 2, '同一 id 再完成不重复生成')
  assert.equal(twice, once, '未变更时返回原引用')
})

test('不重复的任务完成后不生成新条目', () => {
  const id = 'plain1'
  const store: Store = { ...emptyStore(), todos: [todo({ id, date: today() })] }
  const after = completeTodo(store, id)
  assert.equal(after.todos.length, 1)
  assert.equal(after.todos[0]?.status, DONE)
})

test('moveCard 改期并在目标桶内重排 order', () => {
  const t = today()
  const a = todo({ id: 'a', date: t, prio: 2, seq: 1 })
  const b = todo({ id: 'b', date: t, prio: 2, seq: 2 })
  const c = todo({ id: 'c', date: '', prio: 2, seq: 3 })
  let store: Store = { ...emptyStore(), todos: [a, b, c] }

  // 把 c 拖到 t 列的第 0 位
  store = moveCard(store, 'c', t, 0)
  const orderOf = (s: Store, id: string): number => s.todos.find((x) => x.id === id)?.order ?? -1
  assert.equal(store.todos.find((x) => x.id === 'c')?.date, t)
  assert.deepEqual([orderOf(store, 'c'), orderOf(store, 'a'), orderOf(store, 'b')], [1, 2, 3])

  // 再把 b 拖到第 0 位
  store = moveCard(store, 'b', t, 0)
  assert.deepEqual([orderOf(store, 'b'), orderOf(store, 'c'), orderOf(store, 'a')], [1, 2, 3])

  // index 越界钳位
  store = moveCard(store, 'a', t, 99)
  assert.equal(orderOf(store, 'a'), 3)
  // 非法日期 → 未排期
  store = moveCard(store, 'a', '2026-2-3', 0)
  assert.equal(store.todos.find((x) => x.id === 'a')?.date, '')
})

test('moveCard 不跨优先级桶(桶按 prio 隔离)', () => {
  const t = today()
  let store: Store = {
    ...emptyStore(),
    todos: [todo({ id: 'hi', date: t, prio: 1 }), todo({ id: 'lo', date: t, prio: 3 })]
  }
  store = moveCard(store, 'lo', t, 0)
  assert.equal(store.todos.find((x) => x.id === 'hi')?.order, 0, '不同 prio 不参与重排')
  assert.equal(store.todos.find((x) => x.id === 'lo')?.order, 1)
})

test('removeTodos 移入回收站 vs 真删', () => {
  const store: Store = { ...emptyStore(), todos: [todo({ id: 'x' }), todo({ id: 'y' })] }
  const trashed = removeTodos(store, ['x'], false)
  assert.equal(trashed.todos.length, 2)
  assert.equal(trashed.todos[0]?.status, TRASH)
  const purged = removeTodos(store, ['x'], true)
  assert.equal(purged.todos.length, 1)
  assert.equal(purged.todos[0]?.id, 'y')
})

test('不可变:纯函数不改原对象', () => {
  const store: Store = { ...emptyStore(), todos: [todo({ id: 'k', title: '原名' })] }
  const snapshot = JSON.stringify(store)
  addTodo(store, { title: '新' })
  updateTodo(store, 'k', { title: '改名' })
  completeTodo(store, 'k')
  removeTodos(store, ['k'], true)
  moveCard(store, 'k', today(), 0)
  toggleSubtask(store, 'k', 'nope')
  assert.equal(JSON.stringify(store), snapshot, '原 store 一个字节都不许变')
})

test('addTodo 忽略调用方传入的脏 status,一律落 ACTIVE', () => {
  const store = emptyStore()
  const after = addTodo(store, { title: 'x', status: DONE, doneAt: 123 })
  assert.equal(after.todos[0]?.status, ACTIVE)
  assert.equal(after.todos[0]?.doneAt, null)
})

test('setStatus 恢复完成态会清 doneAt', () => {
  const store: Store = { ...emptyStore(), todos: [todo({ id: 's', status: DONE, doneAt: 1 })] }
  assert.equal(setStatus(store, 's', ACTIVE).todos[0]?.doneAt, null)
})

test('seedStore 结构与旧版一致', () => {
  const s = seedStore()
  assert.equal(s.groups.length, 2)
  assert.equal(s.lists.length, 5)
  assert.equal(s.todos.length, 12)
  assert.equal(s.todos.filter((t) => t.date === '').length, 1, '一条未排期')
  assert.equal(buildIndex(s, '').counts['inbox'], 1)
  assert.ok(s.lists.every((l) => s.groups.some((g) => g.id === l.gid)), '每个清单都挂在存在的分组上')
})

test('索引对未知视图不产生多余键', () => {
  const store: Store = { ...emptyStore(), todos: [todo({ status: DONE })] }
  const idx = buildIndex(store, '')
  assert.equal(idx.counts['done'], 1)
  assert.equal(idx.counts['bogus'], undefined)
})

test('buildIndex 计数与逐条统计一致,且覆盖全部 list:/group: 键', () => {
  const store = normalizeStore(JSON.parse(LEGACY_JSON))
  const idx = buildIndex(store, '')

  // 逐条统计作为对照(独立实现,不复用 buildIndex)
  const expectAll = store.todos.filter((t) => t.status === 0).length
  assert.equal(idx.counts['all'], expectAll, 'all 计数')
  for (const l of store.lists) {
    const want = store.todos.filter((t) => t.status === 0 && t.lid === l.id).length
    assert.equal(idx.counts[`list:${l.id}`], want, `list:${l.id} 计数`)
  }
  for (const g of store.groups) {
    const lids = new Set(store.lists.filter((l) => l.gid === g.id).map((l) => l.id))
    const want = store.todos.filter((t) => t.status === 0 && lids.has(t.lid)).length
    assert.equal(idx.counts[`group:${g.id}`], want, `group:${g.id} 计数`)
  }
  // 每个清单/分组都有键(侧栏读不到 undefined)
  for (const l of store.lists) {
    assert.ok(`list:${l.id}` in idx.counts, `缺 list:${l.id}`)
    assert.ok(`group:${l.gid}` in idx.counts, `缺 group:${l.gid}`)
  }
})

test('buildIndex 的 hits 与搜索语义一致(全库,不限视图)', () => {
  const store = normalizeStore(JSON.parse(LEGACY_JSON))
  const idx = buildIndex(store, '周报')
  const want = store.todos.filter((t) => (t.title + ' ' + t.note).toLowerCase().includes('周报')).length
  assert.equal(idx.hits.length, want, 'hits 数 = 全库匹配数')
  assert.equal(buildIndex(store, '').hits.length, store.todos.length, '空搜索命中全部')
  // 大小写与首尾空格不敏感
  assert.equal(buildIndex(store, '  周报  ').hits.length, want)
})

test('buildIndex 的 columns 只含有日期的命中项,按日期升序', () => {
  const t = today()
  const store: Store = {
    ...emptyStore(),
    todos: [
      todo({ date: addDays(t, 2), prio: 1 }),
      todo({ date: '', prio: 1 }),
      todo({ date: t, prio: 1 }),
      todo({ date: t, prio: 1, status: DONE })
    ]
  }
  const cols = buildIndex(store, '').columns
  assert.deepEqual(cols.map((c) => c.date), [t, addDays(t, 2)], '升序且不含未排期')
  assert.equal(cols[0]?.items.length, 1, '已完成的不进看板')
})

test('sortedByIndex 与旧排序语义逐项一致(固定 fixture 断言 id 序列)', () => {
  const store = normalizeStore(JSON.parse(LEGACY_JSON))
  const idx = buildIndex(store, '')
  const ids = sortedByIndex(idx, 'all').map((t) => t.id)
  // LEGACY_JSON:seq1 高优(2026-10-07)、seq2 中优(2026-10-07)、seq3 中优(未排期)
  assert.deepEqual(ids, ['8c1ed70edb', '3ece1da865', 'a1b2c3d4e5'], '日期 → 优先级 → seq')

  // 同日期同优先级时按清单名(中文 locale)排,再按 seq
  const t0 = today()
  const same: Store = {
    ...emptyStore(),
    lists: [
      { id: 'B', gid: '', name: '乙清单', color: '#000000', order: 0 },
      { id: 'A', gid: '', name: '甲清单', color: '#000000', order: 1 }
    ],
    todos: [
      todo({ id: 'x2', lid: 'B', date: t0, prio: 2, seq: 2 }),
      todo({ id: 'x1', lid: 'A', date: t0, prio: 2, seq: 1 })
    ]
  }
  const sameIds = sortedByIndex(buildIndex(same, ''), 'all').map((x) => x.id)
  assert.deepEqual(sameIds, ['x1', 'x2'], '清单名排序优先于 seq')
})
