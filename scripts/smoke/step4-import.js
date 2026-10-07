// 步骤 4:导入旧版 JSON 并归一化为合法 v2
const t = window.__todoTest
const legacy = JSON.stringify({
  groups: [{ id: '6d8ae94af3', name: '工作' }, { id: '34d79f911b', name: '生活' }],
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
    { id: 'a1b2c3d4e5', lid: '', title: '随手记', note: '', date: '', prio: 2, status: 0, seq: 3 }
  ]
})
const counts = await t.importJson(legacy)
await t.flush()
await t.reload()
const s = t.getState()
eq(counts, { groups: 2, lists: 5, todos: 3 }, '导入计数')
eq(s.version, 2, '版本升为 2')
eq(s.groups.length, 2, '分组数')
eq(s.lists.length, 5, '清单数')
eq(s.todos.length, 3, '任务数')
const first = s.todos.find((x) => x.id === '8c1ed70edb')
truthy(first, '旧任务 id 保留')
eq(first.order, 0, 'order 补默认 0')
eq(first.subtasks, [], 'subtasks 补空数组')
eq(first.repeat, { kind: 'none' }, 'repeat 补 none')
eq(first.doneAt, null, 'doneAt 补 null')
return counts
