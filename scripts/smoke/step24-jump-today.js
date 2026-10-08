// 步骤 24:看板「跳到今天」
const t = window.__todoTest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const day = (n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` }
const COL_W = 300

await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
// 造一列靠后的任务,使今天列不在起始可视区
await t.newTask({ title: '远', date: day(30), prio: 2 })
await t.newTask({ title: '今', date: day(0), prio: 2 })
await t.flush()
t.setBoard(true)
await sleep(200)

const host = document.querySelector('[data-testid="board-columns"]')
truthy(host, '列容器存在')
eq(host.scrollLeft, 0, '初始 scrollLeft 为 0')

const btn = document.querySelector('[data-testid="board-today"]')
truthy(btn, '有列时显示「今天」钮')
btn.click()
await sleep(200)

const cols = t.boardColumns()
const todayAt = cols.findIndex((c) => c.date === day(0))
truthy(todayAt >= 0, '今天有列')
eq(host.scrollLeft, todayAt * COL_W, '跳到今天列下标 × 列宽')

// 跳到不存在今天列的情形:应退到"今天之后最近一列"
t.setSearch('远')
await sleep(200)
truthy(document.querySelector('[data-testid="board-today"]'), '过滤后仍有列时按钮还在')
btn.click()
await sleep(200)
eq(host.scrollLeft, 0, '唯一列在未来,其下标为 0')

t.setSearch('')
await sleep(150)
return { todayAt, scrolledTo: host.scrollLeft }
