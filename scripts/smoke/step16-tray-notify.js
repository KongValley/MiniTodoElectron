// 步骤 16:托盘/通知的完整链路
//   渲染层:提醒控件可交互、开关即时持久化
//   主进程(mainChecks):托盘已创建、通知到点触发并记录日期(通过 TODO_SMOKE_NOTIFY=1 打开开关)
const t = window.__todoTest
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const todayStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

// 造一条今天到期的未完成任务,让到期计数 > 0
await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
await t.newTask({ title: '今天的活', date: todayStr, prio: 1 })
await t.flush()
eq(t.counts().due, 1, '到期计数为 1')

// 走设置页真实交互:未开启时时间框禁用,开启后可用
document.querySelector('[data-testid="open-settings"]').click()
await new Promise((r) => setTimeout(r, 150))
truthy(document.querySelector('[data-testid="settings-dialog"]'), '设置弹窗打开')
const at = document.querySelector('[data-testid="notify-at"]')
const toggle = document.querySelector('[data-testid="notify-toggle"]')
truthy(at && toggle, '提醒控件存在')
eq(at.disabled, true, '未开启提醒时时间框禁用')

toggle.checked = true
toggle.dispatchEvent(new Event('change', { bubbles: true }))
await new Promise((r) => setTimeout(r, 150))
eq(at.disabled, false, '开启提醒后时间框可用')

document.querySelector('[data-testid="settings-close"]').click()
await new Promise((r) => setTimeout(r, 100))
assert(!document.querySelector('[data-testid="settings-dialog"]'), '设置弹窗已关闭')

// 冒烟用:把提醒时间设为已过去的时刻,让主进程的 mainChecks 能在本次运行内触发一次
if (__smokeRoot) await t.setNotify(true, '00:00')
await new Promise((r) => setTimeout(r, 120))

return { dueCount: t.counts().due, notifyConfigured: !!__smokeRoot }
