// 步骤 8:子任务增 / 勾 → 卡片显示 x/y → 落盘往返
const t = window.__todoTest
await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const task = await t.newTask({ title: '带子任务', date: todayStr, prio: 1 })
await t.flush()
const id = task.id
await t.addSubtask(id, '子一')
await t.addSubtask(id, '子二')
await t.addSubtask(id, '子三')
await t.flush()

let item = t.getState().todos.find((x) => x.id === id)
eq(item.subtasks.length, 3, '三个子任务')
await t.toggleSubtask(id, item.subtasks[0].id)
await t.flush()

t.setView('all')
await new Promise((r) => setTimeout(r, 100))
item = t.getState().todos.find((x) => x.id === id)
eq(item.subtasks.filter((s) => s.done).length, 1, '勾了 1 个')
const card = document.querySelector(`[data-card="${id}"]`)
truthy(card, '卡片存在')
eq(card.querySelector('[data-subs]').textContent.trim(), '1/3', '卡片显示 1/3')

await t.reload()
const after = t.getState().todos.find((x) => x.id === id)
eq(after.subtasks.length, 3, '重载后子任务数')
eq(after.subtasks.filter((s) => s.done).length, 1, '重载后完成数')
return { subs: 3, done: 1 }
