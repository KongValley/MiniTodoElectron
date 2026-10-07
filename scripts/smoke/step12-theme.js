// 步骤 12:主题切换 → data-theme 变化 → 持久化重载后保留
const t = window.__todoTest
const before = t.theme()
truthy(['light', 'dark'].includes(before), '初始主题为 light|dark')

await t.setTheme('dark')
await new Promise((r) => setTimeout(r, 100))
eq(document.documentElement.dataset.theme, 'dark', 'data-theme 变 dark')
const darkBg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
assert(darkBg !== '#fafafb' && darkBg !== '', `深色 --bg 应变化,实际 ${darkBg}`)

await t.setTheme('light')
await new Promise((r) => setTimeout(r, 100))
eq(document.documentElement.dataset.theme, 'light', '切回 light')

await t.setTheme('dark')
await new Promise((r) => setTimeout(r, 100))
await t.reload()
await new Promise((r) => setTimeout(r, 150))
eq(t.theme(), 'dark', '重载后仍是 dark')
return { before, darkBg }
