// 步骤 22:合并导入(importMerge):追加 / 跳过同 id / seq 重排
const t = window.__todoTest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const today0 = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const A = {
  groups: [{ id: 'g1', name: '工作', order: 0 }],
  lists: [
    { id: 'l1', gid: 'g1', name: '内容生产', color: '#3A7AFE', order: 0 },
    { id: 'l2', gid: 'g1', name: '待办事务', color: '#7C5CFF', order: 1 }
  ],
  todos: [
    { id: 'a1', lid: 'l1', title: '旧任务1', date: today0, prio: 1, seq: 1 },
    { id: 'a2', lid: 'l2', title: '旧任务2', date: today0, prio: 2, seq: 2 },
    { id: 'a3', lid: '', title: '旧任务3', date: '', prio: 2, seq: 3 }
  ]
}
const countsA = await t.importJson(JSON.stringify(A))
await t.flush()
eq(countsA.todos, 3, '替换导入 3 条')

// 合并:同 id 的 a1 跳过,新增 n1;清单 l1 同 id 跳过,l3 追加
const B = {
  groups: [{ id: 'g1', name: '工作(重名)', order: 0 }],
  lists: [
    { id: 'l1', gid: 'g1', name: '内容生产(重名)', color: '#000000', order: 9 },
    { id: 'l3', gid: 'g1', name: '新清单', color: '#3C9954', order: 2 }
  ],
  todos: [
    { id: 'a1', lid: 'l1', title: '旧任务1(重名)', date: today0, prio: 3, seq: 99 },
    { id: 'n1', lid: 'l3', title: 'merge-new', date: today0, prio: 2, seq: 4 }
  ]
}
const res = await t.importMerge(JSON.stringify(B))
await t.flush()

eq(res.skipped, { groups: 1, lists: 1, todos: 1 }, '同 id 的分组/清单/任务各跳 1 条')
eq(res.counts.todos, 4, '合并后 4 条任务')
eq(res.counts.lists, 3, '合并后 3 个清单')
eq(res.counts.groups, 1, '同 id 分组不追加')
truthy(
  t.getState().todos.some((x) => x.title === 'merge-new'),
  '新任务已追加'
)
eq(
  t.getState().todos.find((x) => x.id === 'a1').title,
  '旧任务1',
  'base 的同 id 任务内容不被覆盖'
)
eq(
  t.getState().lists.find((x) => x.id === 'l1').name,
  '内容生产',
  'base 的同 id 清单内容不被覆盖'
)
eq(
  t.getState().lists.find((x) => x.id === 'l1').color,
  '#3A7AFE',
  'base 的同 id 清单颜色不被覆盖'
)
eq(
  t.getState().todos.find((x) => x.id === 'n1').lid,
  'l3',
  '新任务挂在追加进来的清单上'
)
// seq 重排为 1..n
eq(
  JSON.stringify(t.todos().map((x) => x.seq)),
  JSON.stringify([1, 2, 3, 4]),
  '合并后 seq 重排为 1..4'
)

// 合并结果过 normalizeStore 应稳定(仍是合法 v2)
const after = t.getState()
eq(after.version, 2, 'store 版本仍为 2')

// 列表空状态里的"导入旧版数据"入口存在(不点击,避免弹系统文件对话框)
await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
await t.flush()
t.setBoard(false)
await sleep(150)
truthy(document.querySelector('[data-testid="list-empty-import"]'), '列表空状态有导入入口')

return { skipped: res.skipped, counts: res.counts }
