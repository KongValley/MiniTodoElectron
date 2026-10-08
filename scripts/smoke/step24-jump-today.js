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
// 阶段一:all 视图下确认两列都在
let host2
t.setView('all')
await sleep(200)
host2 = document.querySelector('[data-testid="board-columns"]')
truthy(host2, 'all 视图有列容器')

// 阶段二:视图过滤 —— 切「今天」只剩今天一列
t.setView('today')
await sleep(250)
eq(t.boardColumns().length, 1, '今天视图只剩一列')
eq(t.boardColumns()[0].date, day(0), '该列就是今天')

// 阶段三:搜一个不在今天视图里的词 → 无命中 → 落空状态
t.setSearch('远')
await sleep(250)
eq(t.boardColumns().length, 0, '搜索无命中时无列')
eq(document.querySelector('[data-testid="board-today"]'), null, '无列时不显示「今天」钮')
truthy(document.querySelector('[data-testid="empty-new"]'), '落入看板空状态')

return { todayAt, scrolledTo: host.scrollLeft }
