// 步骤 13:搜索命中数在看板 / 列表 / 侧栏三处一致
const t = window.__todoTest
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
await t.newTask({ title: '周报A', date: todayStr, prio: 1 })
await t.newTask({ title: '周报B', date: todayStr, prio: 2 })
await t.newTask({ title: '无关任务', date: todayStr, prio: 1 })
await t.flush()

t.setView('all')
t.setSearch('周报')
await new Promise((r) => setTimeout(r, 120))
eq(document.querySelectorAll('[data-card]').length, 2, '看板卡片数 = 命中数')
eq(t.boardColumns().reduce((n, c) => n + c.ids.length, 0), 2, '模型列内命中数')

t.setBoard(false)
await new Promise((r) => setTimeout(r, 120))
eq(t.listRows().length, 2, '列表行数 = 命中数')
eq(document.querySelectorAll('[data-row]').length, 2, 'DOM 行数')
eq(t.counts().all, 2, '侧栏「所有」计数')

t.setSearch('不存在的词')
await new Promise((r) => setTimeout(r, 80))
eq(t.listRows().length, 0, '无命中时 0 行')

t.setSearch('')
t.setBoard(true)
return { hits: 2 }
