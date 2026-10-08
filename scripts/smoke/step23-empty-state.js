// 步骤 23:空状态引导(看板 + 列表)
const t = window.__todoTest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
await t.flush()
t.setBoard(true)
await sleep(150)

const p = document.querySelector('.empty p')
truthy(p, '看板空状态有提示文案')
eq(p.textContent, '此视图暂无排期任务', '无搜索词时显示默认空文案')
truthy(document.querySelector('[data-testid="empty-new"]'), '有新建入口')
truthy(document.querySelector('[data-testid="empty-import"]'), '有导入入口')
truthy(document.querySelector('[data-testid="empty-help"]'), '有快捷键入口')
eq(document.querySelector('[data-testid="board-today"]'), null, '空列时不显示「今天」浮动钮')

document.querySelector('[data-testid="empty-new"]').click()
await sleep(120)
eq(t.dialog() !== null, true, '点新建打开弹窗')
t.closeDialog()
await sleep(120)

document.querySelector('[data-testid="empty-help"]').click()
await sleep(120)
truthy(document.querySelector('[data-testid="help-dialog"]'), '点快捷键打开帮助')
t.closeDialog()

// 搜索无命中时空文案换成搜索相关
t.setSearch('不存在的词')
await sleep(150)
truthy(document.querySelector('.empty p').textContent.includes('不存在的词'), '搜索无命中时文案提示搜索词')
t.setSearch('')
await sleep(150)

// 列表视图同样有引导
t.setBoard(false)
await sleep(150)
truthy(document.querySelector('.empty p'), '列表空状态有提示文案')
truthy(document.querySelector('[data-testid="list-empty-new"]'), '列表有新建入口')
truthy(document.querySelector('[data-testid="list-empty-import"]'), '列表有导入入口')
truthy(document.querySelector('[data-testid="list-empty-help"]'), '列表有快捷键入口')

return { boardEmpty: true, listEmpty: true }
