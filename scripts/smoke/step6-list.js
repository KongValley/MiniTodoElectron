// 步骤 6:列表行序 = sorted();多选删除后条数 -2
const t = window.__todoTest
await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
await t.newTask({ title: 'L1', date: todayStr, prio: 1 })
await t.newTask({ title: 'L2', date: todayStr, prio: 2 })
await t.newTask({ title: 'L3', date: todayStr, prio: 3 })
await t.flush()

t.setView('all')
t.setBoard(false)
await new Promise((r) => setTimeout(r, 100))
const rows = t.listRows()
eq(rows.length, 3, '列表行数')
eq(rows.map((r) => r.title), ['L1', 'L2', 'L3'], '按优先级排序')
eq([...document.querySelectorAll('[data-row]')].map((el) => el.dataset.row), rows.map((r) => r.id), 'DOM 行序与模型一致')

const ids = rows.slice(0, 2).map((r) => r.id)
t.select(ids)
eq(t.selection().length, 2, '选中 2 行')
await t.remove(ids, false)
await t.flush()
const active = t.getState().todos.filter((x) => x.status === 0)
eq(active.length, 1, '删除 2 条后剩 1 条')
eq(t.getState().todos.filter((x) => x.status === 3).length, 2, '两条进了回收站')
t.setView('trash')
await new Promise((r) => setTimeout(r, 60))
eq(t.listRows().length, 2, '回收站视图 2 行')
t.setView('all')
t.setBoard(true)
return { rows: rows.map((r) => r.title), activeLeft: active.length }
