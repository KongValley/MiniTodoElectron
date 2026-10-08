// 步骤 19:删除 / 彻底删除必须先确认,取消不删、确认才删
const t = window.__todoTest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
await t.flush()
const a = await t.newTask({ title: '待删A', date: '2030-01-01' })
const b = await t.newTask({ title: '待删B', date: '2030-01-02' })
await t.flush()

t.setBoard(false)
await sleep(150)

// 未选中时按钮禁用,点了也不该弹框
eq(document.querySelector('[data-testid="delete-selected"]').disabled, true, '未选中时删除按钮禁用')

t.select([a.id, b.id])
await sleep(150)
eq(document.querySelector('[data-testid="delete-selected"]').disabled, false, '选中后删除按钮可用')

document.querySelector('[data-testid="delete-selected"]').click()
await sleep(150)
truthy(document.querySelector('[data-testid="confirm-dialog"]'), '点删除应弹确认框')
eq(t.getState().todos.filter((x) => x.status === 0).length, 2, '确认框弹出时任务未被删')
// 次要按钮(合并用)不出现
eq(document.querySelector('[data-testid="confirm-secondary"]'), null, '删除确认不应出现次要按钮')

// 取消不清空选择(Cancel 只是关闭弹窗)
document.querySelector('[data-testid="confirm-cancel"]').click()
await sleep(150)
eq(document.querySelector('[data-testid="confirm-dialog"]'), null, '取消后确认框关闭')
eq(t.getState().todos.filter((x) => x.status === 0).length, 2, '取消后任务仍在')
eq(t.selection().length, 2, '取消后选择保留')

// 再次删除 → 确认后进回收站
document.querySelector('[data-testid="delete-selected"]').click()
await sleep(150)
document.querySelector('[data-testid="confirm-ok"]').click()
await t.flush()
await sleep(150)
eq(t.getState().todos.find((x) => x.id === a.id).status, 3, '确认后 A 进回收站')
eq(t.getState().todos.find((x) => x.id === b.id).status, 3, '确认后 B 进回收站')

// 回收站视图下文案应提示不可恢复
t.setView('trash')
await sleep(150)
t.select([a.id, b.id])
await sleep(150)
document.querySelector('[data-testid="delete-selected"]').click()
await sleep(150)
const detail = document.querySelector('[data-testid="confirm-dialog"] p').textContent
truthy(detail.includes('无法恢复'), '回收站删除应提示不可恢复')
document.querySelector('[data-testid="confirm-ok"]').click()
await t.flush()
await sleep(150)
eq(t.todos().length, 0, '确认彻底删除后任务清空')

return { moved: 2, purged: true }
