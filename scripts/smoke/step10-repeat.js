// 步骤 10:重复任务完成 → 生成下一条并重置子任务;再完成同一 id 不重复生成
const t = window.__todoTest
await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
const created = await t.newTask({ title: '站会', date: '2026-01-31', prio: 1 })
const taskId = created.id
await t.flush()
await t.editTask(taskId, { repeat: { kind: 'monthly' } })
await t.addSubtask(taskId, '准备材料')
await t.flush()
const subId = t.getState().todos.find((x) => x.id === taskId).subtasks[0].id
await t.toggleSubtask(taskId, subId)
await t.flush()
eq(t.getState().todos.find((x) => x.id === taskId).subtasks[0].done, true, '子任务已勾')

await t.complete(taskId)
await t.flush()
const afterOnce = t.getState().todos
eq(afterOnce.length, 2, '完成后多出 1 条')
const original = afterOnce.find((x) => x.id === taskId)
const spawned = afterOnce.find((x) => x.id !== taskId)
eq(original.status, 1, '原任务已完成')
truthy(original.doneAt, '记录完成时间')
eq(spawned.status, 0, '新任务待办')
eq(spawned.date, '2026-02-28', '月末溢出落到 2 月最后一天')
eq(spawned.subtasks[0].done, false, '子任务重置')
eq(spawned.repeat.kind, 'monthly', '重复规则继承')

await t.complete(taskId)
await t.flush()
eq(t.getState().todos.length, 2, '同一 id 再完成不重复生成')

// 无日期的重复任务不生成
const noDate = await t.newTask({ title: '无日期重复', date: '', prio: 2 })
await t.flush()
await t.editTask(noDate.id, { repeat: { kind: 'daily' } })
await t.complete(noDate.id)
await t.flush()
eq(t.getState().todos.filter((x) => x.title === '无日期重复').length, 1, '无日期不生成下一条')
return { spawnedDate: spawned.date, total: t.getState().todos.length }
