// 步骤 28:保存失败必须送达用户(toast + 状态栏持续标记)
//
// 背景:主进程所有 handler 都永不 reject,失败只体现在 ok:false。commit() 以前
// await 完就把结果丢了 —— 磁盘写失败时界面毫无反应,用户以为存上了,重启后才发现没了。
//
// 注入见 ipc.ts 的 TODO_SMOKE_SAVE_FAIL(registerIpc 转成 setSaveFail)。
// 注意:注入是全局的,本次运行内任何一次保存都失败,所以这里不预设「初始无标记」。
const t = window.__todoTest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 先随便做一次写操作,确认注入生效(标记出现)
await t.newTask({ title: '保存失败验证', date: '2030-01-01' })
await t.flush()
await sleep(150)

truthy(document.querySelector('[data-testid="save-failed"]'), '保存失败后状态栏应出现持久标记')
const toastText = document.querySelector('[data-testid="toast"]')?.textContent ?? ''
truthy(toastText.includes('保存失败'), `应弹出保存失败提示(实际「${toastText}」)`)

// 再存一次仍失败:标记不能自己消失
await t.newTask({ title: '第二条', date: '2030-01-02' })
await t.flush()
await sleep(150)
truthy(document.querySelector('[data-testid="save-failed"]'), '持续失败时标记应保留')

// 数据仍留在内存里(只是没落盘),界面不能因此把用户的操作吞掉
truthy(t.todos().length >= 2, '保存失败不应回滚内存中的改动')

return { saveFailed: true }