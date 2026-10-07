// 步骤 17:虚拟滚动正确性(渲染窗口化,但模型层完整)
const t = window.__todoTest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 造 300 条有日期的任务,足以超过一屏
await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const day = (k) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}
const N = 300
for (let i = 0; i < N; i++) {
  await t.newTask({ title: `虚拟滚动任务 ${pad(i)}`, date: day(i % 20), prio: (i % 3) + 1 })
}
await t.flush()

/* ---------- 列表视图:固定行高窗口化 ---------- */
t.setView('all')
t.setBoard(false)
t.setSearch('')
await sleep(200)

const modelRows = t.listRows().length
eq(modelRows, N, '模型层应有全部 300 条')

const host = document.querySelector('.rows')
truthy(host, '列表滚动容器存在')
const domRowsAtTop = document.querySelectorAll('[data-row]').length
truthy(domRowsAtTop > 0, '顶部应渲染出若干行')
assert(domRowsAtTop < N, `应只渲染可视区(实际 ${domRowsAtTop} / ${N})`)
truthy(host.scrollHeight > host.clientHeight, '滚动高度应超过可视高度')

// 滚到底部:最后一条应被渲染出来
const lastId = t.listRows()[N - 1].id
host.scrollTop = host.scrollHeight
await sleep(250)
truthy(document.querySelector(`[data-row="${lastId}"]`), '滚到底后最后一条应渲染')

// 回到顶部:第一条应被渲染
const firstId = t.listRows()[0].id
host.scrollTop = 0
await sleep(250)
truthy(document.querySelector(`[data-row="${firstId}"]`), '回到顶部后第一条应渲染')

/* ---------- 看板视图:卡片窗口化 + 列懒渲染 ---------- */
t.setBoard(true)
await sleep(250)

const cols = t.boardColumns()
truthy(cols.length > 0, '看板应有列')
const modelCards = cols.reduce((n, c) => n + c.ids.length, 0)
const domCards = document.querySelectorAll('[data-card]').length
truthy(domCards > 0, '看板应渲染出若干卡片')
assert(domCards < modelCards, `看板卡片应窗口化(实际 ${domCards} / ${modelCards})`)

const domCols = document.querySelectorAll('[data-column]').length
truthy(domCols > 0, '应渲染出若干列')

// 横向滚到最右:最后一天应被渲染
const hostH = document.querySelector('[data-testid="board-columns"]')
truthy(hostH, '看板横向容器存在')
const lastDate = cols[cols.length - 1].date
hostH.scrollLeft = hostH.scrollWidth
await sleep(300)
truthy(document.querySelector(`[data-column="${lastDate}"]`), '横向滚到最右后最后一天应渲染')

// 滚回最左:第一天应被渲染
hostH.scrollLeft = 0
await sleep(300)
truthy(document.querySelector(`[data-column="${cols[0].date}"]`), '横向回到最左后第一天应渲染')

// 每列的竖向滚动在横向来回后仍保留
const firstCol = document.querySelector(`[data-column="${cols[0].date}"] .content`)
let scrollKept = null
if (firstCol && firstCol.scrollHeight > firstCol.clientHeight) {
  firstCol.scrollTop = 40
  firstCol.dispatchEvent(new Event('scroll', { bubbles: true }))
  await sleep(120)
  hostH.scrollLeft = hostH.scrollWidth
  await sleep(200)
  hostH.scrollLeft = 0
  await sleep(250)
  const back = document.querySelector(`[data-column="${cols[0].date}"] .content`)
  scrollKept = back ? Math.abs(back.scrollTop - 40) <= 2 : null
}

return {
  modelRows,
  domRowsAtTop,
  domCards,
  modelCards,
  domCols,
  totalCols: cols.length,
  scrollKept
}
