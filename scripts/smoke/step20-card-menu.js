// 步骤 20:任务卡右键菜单(改期 / 优先级 / Esc 关闭)
const t = window.__todoTest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const day = (n) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` }
const d1 = day(1)

await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
const task = await t.newTask({ title: '菜单卡片', date: day(0), prio: 2 })
await t.flush()
t.setBoard(true)
await sleep(150)

const card = document.querySelector('[data-card="' + task.id + '"]')
truthy(card, '卡片已渲染')
card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 200 }))
await sleep(150)
truthy(document.querySelector('[data-testid="card-menu"]'), '右键应弹菜单')
// 坐标夹取:菜单 left/top 应为像素值
truthy(document.querySelector('[data-testid="card-menu"]').style.left.endsWith('px'), '菜单已定位')

document.querySelector('[data-menu="改期到明天"]').click()
await t.flush()
await sleep(150)
const moved = t.getState().todos.find((x) => x.id === task.id)
eq(moved.date, d1, '菜单改期到明天生效')

card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 200 }))
await sleep(120)
document.querySelector('[data-menu="高"]').click()
await t.flush()
await sleep(120)
eq(t.getState().todos.find((x) => x.id === task.id).prio, 1, '菜单改优先级生效')

// Esc 关闭(有确认框时应先关确认框,故此处无确认框)
card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 200 }))
await sleep(120)
truthy(document.querySelector('[data-testid="card-menu"]'), '菜单再次打开')
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
await sleep(120)
eq(document.querySelector('[data-testid="card-menu"]'), null, 'Esc 应关闭菜单')

// backdrop 点击关闭
card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 200 }))
await sleep(120)
document.querySelector('[data-testid="card-menu-backdrop"]').click()
await sleep(120)
eq(document.querySelector('[data-testid="card-menu"]'), null, '点击 backdrop 应关闭菜单')

// 删除走确认:不直接删
card.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 200, clientY: 200 }))
await sleep(120)
document.querySelector('[data-menu="删除"]').click()
await sleep(150)
truthy(document.querySelector('[data-testid="confirm-dialog"]'), '菜单删除应弹确认')
eq(t.getState().todos.find((x) => x.id === task.id).status, 0, '确认前未删除')
document.querySelector('[data-testid="confirm-cancel"]').click()
await sleep(120)
eq(t.getState().todos.find((x) => x.id === task.id).status, 0, '取消后仍未删除')

return { rescheduled: d1, prio: 1 }
