// 步骤 9:改期 + 同桶重排(与拖拽共用 moveCard 入口)
const t = window.__todoTest
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const day = (n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` }
const d0 = day(0), d1 = day(1)

await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
const a = await t.newTask({ title: 'A', date: d0, prio: 1 })
const b = await t.newTask({ title: 'B', date: d0, prio: 1 })
const c = await t.newTask({ title: 'C', date: d0, prio: 1 })
const lo = await t.newTask({ title: 'LOW', date: d0, prio: 3 })
await t.flush()
const idA = a.id, idB = b.id, idC = c.id, idLo = lo.id

// 改期:C → 明天第 0 位
await t.moveCardToDate(idC, d1, 0)
await t.flush()
const cAfter = t.getState().todos.find((x) => x.id === idC)
eq(cAfter.date, d1, '改期生效')
eq(cAfter.order, 1, '新桶内排第 1')

// 同桶重排:B → 第 0 位
await t.moveCardToDate(idB, d0, 0)
await t.flush()
eq(t.buckets(d0).find((x) => x.prio === 1).ids, [idB, idA], 'B 排到 A 前')

// 越界钳位
await t.moveCardToDate(idA, d0, 99)
await t.flush()
eq(t.buckets(d0).find((x) => x.prio === 1).ids, [idB, idA], '越界 index 钳到末位')

// 低优先级桶不受高优先级桶重排影响
eq(t.getState().todos.find((x) => x.id === idLo).order, 0, '不同 prio 桶不参与重排')

// 非法日期 → 未排期
await t.moveCardToDate(idLo, '2026-2-3', 0)
await t.flush()
eq(t.getState().todos.find((x) => x.id === idLo).date, '', '非法日期落为未排期')

/* ---------- 同列同优先级真实拖拽:落点必须紧跟被越过的卡 ---------- */
// 背景:indexFromEvent 统计同优先级行数时若把被拖动那张也算进去,向下拖会差一格。
// 这里走完整事件链(dragstart → dragover → drop),不经 test-api 的直调捷径。
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
t.setView('all')
t.setBoard(true)
t.setSearch('')
await sleep(200)

const p = await t.newTask({ title: 'P1', date: d1, prio: 2 })
const q = await t.newTask({ title: 'P2', date: d1, prio: 2 })
const r = await t.newTask({ title: 'P3', date: d1, prio: 2 })
await t.flush()
await sleep(200)

const col = document.querySelector(`[data-column="${d1}"] .content`)
truthy(col, '目标列存在')
const cardP = document.querySelector(`[data-card="${p.id}"]`)
const cardQ = document.querySelector(`[data-card="${q.id}"]`)
truthy(cardP && cardQ, '同列同优先级的卡已渲染')

// 鼠标落在 Q 的下半部 = 视觉上「拖到 Q 之下」
const yUnderQ = cardQ.getBoundingClientRect().bottom - 2
const mk = (type, y) => {
  const ev = new DragEvent(type, { bubbles: true, cancelable: true, clientY: y, clientX: 10 })
  Object.defineProperty(ev, 'dataTransfer', {
    value: { setData() {}, getData() { return '' }, effectAllowed: 'move', dropEffect: 'move' }
  })
  return ev
}
cardP.dispatchEvent(mk('dragstart', 0))
// 等一帧:dragId/dragPrio 经 BoardView 的 ref 传到列组件的 props 要经过重渲染,
// 连着同步发 dragover 时列还拿着旧 props(真实拖拽天然有帧间隔)
await sleep(80)
col.dispatchEvent(mk('dragover', yUnderQ))
col.dispatchEvent(mk('drop', yUnderQ))
await t.flush()
await sleep(200)

eq(t.buckets(d1).find((x) => x.prio === 2).ids, [q.id, p.id, r.id], '向下拖应紧跟被越过的卡,不隔一位')

return {
  movedDate: cAfter.date,
  d0HighBucket: t.buckets(d0).find((x) => x.prio === 1).ids,
  dragReorder: t.buckets(d1).find((x) => x.prio === 2).ids.length
}
