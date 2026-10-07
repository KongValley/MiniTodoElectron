// 步骤 5:看板列 / 优先级桶顺序 / 卡片数与计数一致
const t = window.__todoTest
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const day = (n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` }
const d0 = day(0), d1 = day(1)

await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
await t.newTask({ title: 'b-d0-低', date: d0, prio: 3 })
await t.newTask({ title: 'b-d0-高', date: d0, prio: 1 })
await t.newTask({ title: 'b-d0-中', date: d0, prio: 2 })
await t.newTask({ title: 'b-d1-中', date: d1, prio: 2 })
await t.newTask({ title: 'b-nodate', date: '', prio: 1 })
await t.flush()
t.setView('all')
await new Promise((r) => setTimeout(r, 100))

const cols = t.boardColumns()
eq(cols.map((c) => c.date), [d0, d1], '列按日期升序且排除未排期')
eq(cols[0].prios, [1, 2, 3], '列内桶顺序 高→中→低')
eq(cols[1].prios, [2], '第二列只有中优先级')
const modelCards = cols.reduce((n, c) => n + c.ids.length, 0)
eq(modelCards, 4, '有日期的任务共 4 条')
eq(document.querySelectorAll('[data-card]').length, modelCards, 'DOM 卡片数与模型一致')
eq(t.counts().all, 5, '侧栏「所有」含未排期那条')
const heads = [...document.querySelectorAll('[data-prio-head]')].map((el) => Number(el.dataset.prioHead))
eq(heads, [1, 2, 3, 2], '页面上的优先级分组标题顺序')
return { cols: cols.map((c) => c.date), prios: cols[0].prios, heads }
