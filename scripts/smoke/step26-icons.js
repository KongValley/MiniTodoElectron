// 步骤 26:全图标 SVG 化 + 商务调色板 token 生效
const t = window.__todoTest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const today0 = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
await t.newTask({ title: '图标检查', date: today0 })
await t.flush()
t.setBoard(true)
await sleep(250)

// 视图图标:8 个侧栏行各渲染一个 svg,且 stroke=currentColor
const viewIcons = [...document.querySelectorAll('[data-view] .icon svg')]
eq(viewIcons.length, 8, '8 个视图行各渲染一个 SVG 图标')
truthy(
  viewIcons.every((s) => s.getAttribute('stroke') === 'currentColor'),
  '图标统一用 currentColor 描边'
)
// 每个视图图标的容器都带语义色内联 style
const colored = viewIcons.filter((s) => (s.closest('.icon')?.getAttribute('style') ?? '').includes('color'))
eq(colored.length, 8, '8 个视图图标都带语义色')

// 功能图标也是 svg,不再是文本字形
truthy(document.querySelector('[data-testid="search-toggle"] svg'), '搜索钮是 SVG')
truthy(document.querySelector('[data-add] svg'), '列头加号是 SVG')
truthy(document.querySelector('[data-card] .prio svg'), '优先级是 SVG 旗标')

// 完成后圆圈内出现 SVG 勾。注意:看板 week7 只显示未完成任务,
// 完成后卡片会离开当前视图(产品行为),故切到「已完成」视图再验。
const cardId = t.todos().find((x) => x.status === 0 && x.date !== '')?.id
truthy(cardId, '有可完成的未完成任务')
await t.complete(cardId)
await t.flush()
await sleep(250)
eq(t.getState().todos.find((x) => x.id === cardId).status, 1, '任务已完成')

t.setBoard(false)
t.setView('done')
await sleep(250)
const row = document.querySelector(`[data-row="${cardId}"]`)
truthy(row, '已完成视图里有该行')
truthy(row.querySelector('.circle svg'), '列表已完成行圆圈内是 SVG 勾')

// 页面上不应再有旧字形图标
eq(document.body.textContent.includes('⌕'), false, '不再有 ⌕ 字形')

// 商务 token 真在读
const root = document.documentElement
const cssVar = (k) => getComputedStyle(root).getPropertyValue(k).trim().toLowerCase()
eq(cssVar('--accent'), '#2563eb', '浅色 accent 已是 Fluent 品蓝')
eq(cssVar('--bg'), '#fbfcfd', '浅色背景已是近白')
eq(cssVar('--line'), '#d5dae1', '浅色分隔线已加深')
truthy(cssVar('--v-today').length > 0 && cssVar('--v-week').length > 0, '视图语义色 token 已定义')

// 深色下 token 同步切换
await t.setTheme('dark')
await sleep(250)
eq(cssVar('--accent'), '#4b83f0', '深色 accent 已提亮')
eq(cssVar('--bg'), '#101418', '深色背景已是藏青黑')
eq(cssVar('--v-today'), '#f0b45a', '深色视图色已提亮')
eq(root.dataset.theme, 'dark', 'data-theme 已切到 dark')

await t.setTheme('light')
await sleep(200)
eq(cssVar('--accent'), '#2563eb', '切回浅色后 accent 复原')
eq(root.dataset.theme, 'light', 'data-theme 已切回 light')

// 列表视图:排序箭头 + 优先级旗标同样是 svg
await sleep(200)
document.querySelector('[data-sort="date"]').click()
await sleep(150)
truthy(document.querySelector('[data-sort="date"] svg'), '排序激活后箭头是 SVG')
truthy(document.querySelector('[data-row] .prio svg'), '列表优先级是 SVG 旗标')
t.setView('all')
await sleep(150)

return { svgIcons: viewIcons.length }
