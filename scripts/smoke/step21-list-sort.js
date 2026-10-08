// 步骤 21:列表列排序(日期 / 优先级 / 清单;点三下回到默认)
const t = window.__todoTest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const day = (n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` }

const fixed = [
  { id: 'x1', lid: 'lb', title: '任务1', date: day(2), prio: 3, seq: 1 },
  { id: 'x2', lid: 'la', title: '任务2', date: day(0), prio: 2, seq: 2 },
  { id: 'x3', lid: 'la', title: '任务3', date: '', prio: 1, seq: 3 },
  { id: 'x4', lid: 'lb', title: '任务4', date: day(1), prio: 1, seq: 4 }
]
await t.importJson(
  JSON.stringify({
    version: 2,
    groups: [{ id: 'g1', name: '默认', order: 0 }],
    lists: [
      { id: 'la', gid: 'g1', name: '甲清单', color: '#3A7AFE', order: 0 },
      { id: 'lb', gid: 'g1', name: '乙清单', color: '#3C9954', order: 1 }
    ],
    todos: fixed
  })
)
await t.flush()
t.setBoard(false)
t.setView('all')
await sleep(150)

const rendered = () => [...document.querySelectorAll('[data-row]')].map((el) => el.dataset.row)
const itemIds = t.todos().map((x) => x.id)

// 默认顺序:日期 → 优先级 → 清单名 → seq;未排期(x3)在末位
eq(rendered(), ['x2', 'x4', 'x1', 'x3'], '默认顺序 = 日期→优先级→清单→seq')

document.querySelector('[data-sort="date"]').click()
await sleep(120)
eq(rendered(), ['x2', 'x4', 'x1', 'x3'], '日期升序')

document.querySelector('[data-sort="date"]').click()
await sleep(120)
eq(rendered(), ['x1', 'x4', 'x2', 'x3'], '日期降序,未排期仍末位')

// 第三下回到默认
document.querySelector('[data-sort="date"]').click()
await sleep(120)
eq(rendered(), ['x2', 'x4', 'x1', 'x3'], '第三下恢复默认顺序')

document.querySelector('[data-sort="prio"]').click()
await sleep(120)
eq(rendered(), ['x4', 'x2', 'x1', 'x3'], '优先级升序 = 高优先在前,未排期恒末位')

// 清单名升序:甲清单(la)在前 —— 注意"未排期恒末位"先于 list 键生效,故 x3 仍在尾
document.querySelector('[data-sort="list"]').click()
await sleep(120)
eq(rendered(), ['x2', 'x1', 'x4', 'x3'], '清单名升序:甲清单(la)在前,未排期恒末位')

return { defaultOrder: rendered(), itemIds }
