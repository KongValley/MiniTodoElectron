// 步骤 11:移入回收站 → 计数 → 彻底删除
const t = window.__todoTest
await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
const created = await t.newTask({ title: '要删的', date: '', prio: 2 })
const taskId = created.id
await t.flush()

await t.remove([taskId], false)
await t.flush()
eq(t.getState().todos.find((x) => x.id === taskId).status, 3, '状态为回收站')
eq(t.getState().todos.length, 1, '仍在 store 里')

t.setView('trash')
await new Promise((r) => setTimeout(r, 60))
eq(t.listRows().length, 1, '回收站视图 1 行')
eq(t.counts().trash, 1, '侧栏回收站计数 1')

await t.remove([taskId], true)
await t.flush()
eq(t.getState().todos.find((x) => x.id === taskId), undefined, '彻底删除后不存在')
eq(t.getState().todos.length, 0, 'store 清空')
t.setView('all')
return { purged: true }
