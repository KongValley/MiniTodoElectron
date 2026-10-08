// 步骤 25:列表视图 Ctrl+A 全选当前视图;看板与输入框内不劫持
const t = window.__todoTest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const today0 = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

await t.importJson(
  JSON.stringify({
    groups: [],
    lists: [],
    todos: [
      { id: 's1', lid: '', title: '第一条', date: today0, prio: 1 },
      { id: 's2', lid: '', title: '第二条', date: today0, prio: 2 },
      { id: 's3', lid: '', title: '第三条', date: today0, prio: 3 }
    ]
  })
)
await t.flush()
t.setBoard(false)
await sleep(150)

eq(t.selection().length, 0, '初始无选中')
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))
await sleep(150)
eq(t.selection().length, 3, 'Ctrl+A 选中列表全部 3 行')
eq([...t.selection()].sort().join(','), ['s1', 's2', 's3'].join(','), '选中的正是当前 3 行')
truthy(document.querySelector('.toolbar')?.textContent.includes('已选 3 条'), '工具栏显示已选条数')

// 再按一次不改变数量(仍是全选)
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))
await sleep(150)
eq(t.selection().length, 3, '重复 Ctrl+A 仍是全选')

// 切到看板:ListView 卸载只清行源,选择保留(看板下 Ctrl+A 无效但不改变选择)
t.setBoard(true)
await sleep(150)
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))
await sleep(150)
eq(t.selection().length, 3, '看板下 Ctrl+A 不改变选择')

// 切回列表:原有的 onMounted 清空选择(LIST 视图挂载即重置选择)
t.setBoard(false)
await sleep(150)
eq(t.selection().length, 0, '切回列表视图后选择被重置(挂載即清空)')

// 重新全选
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))
await sleep(150)
eq(t.selection().length, 3, '重新 Ctrl+A 全选')

// 输入框内 Ctrl+A 保留原生语义,不劫持(不从此处改变选择)
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', ctrlKey: true, bubbles: true }))
await sleep(200)
const search = document.querySelector('[data-testid="search-input"]')
truthy(search, 'Ctrl+F 展开搜索框')
search.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))
await sleep(150)
eq(t.selection().length, 3, '输入框内 Ctrl+A 不改变选择(仍保持之前的全选结果)')

// Esc 收起搜索
window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
await sleep(150)
eq(document.querySelector('[data-testid="search-input"]'), null, 'Esc 收起搜索框')

return { selected: t.selection().length }
