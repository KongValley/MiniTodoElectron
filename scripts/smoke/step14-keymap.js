// 步骤 14:快捷键 N / Esc / B / 1-4 / Ctrl+F
const t = window.__todoTest
const key = (k, opts = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...opts }))

t.closeDialog()
await new Promise((r) => setTimeout(r, 60))
document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }))
await new Promise((r) => setTimeout(r, 100))
truthy(t.dialog(), 'N 未打开弹窗')
truthy(document.querySelector('[data-testid="task-dialog"]'), '弹窗 DOM 存在')

key('Escape')
await new Promise((r) => setTimeout(r, 100))
eq(t.dialog(), null, 'Esc 未关闭弹窗')

const boardBefore = t.board()
key('b')
await new Promise((r) => setTimeout(r, 80))
eq(t.board(), !boardBefore, 'B 切换看板/列表')
key('b')
await new Promise((r) => setTimeout(r, 80))
eq(t.board(), boardBefore, 'B 切回')

for (const [k, expected] of [['1', 'today'], ['2', 'tmr'], ['3', 'week7'], ['4', 'all']]) {
  key(k)
  await new Promise((r) => setTimeout(r, 60))
  eq(t.getView(), expected, `按键 ${k} 切到 ${expected}`)
}

key('f', { ctrlKey: true })
await new Promise((r) => setTimeout(r, 150))
truthy(document.querySelector('[data-testid="search-input"]'), 'Ctrl+F 展开搜索框')
eq(document.activeElement.dataset.testid, 'search-input', '搜索框获得焦点')

// 输入框聚焦时 N 不应打开弹窗(事件派发到聚焦元素,与真实按键一致)
document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }))
await new Promise((r) => setTimeout(r, 80))
eq(t.dialog(), null, '输入框聚焦时 N 不误触')

t.setView('all')
return { views: ['today', 'tmr', 'week7', 'all'] }
