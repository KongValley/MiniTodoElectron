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
return { movedDate: cAfter.date, d0HighBucket: t.buckets(d0).find((x) => x.prio === 1).ids }
