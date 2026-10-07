// 步骤 15:窗口布局与渲染层可观测项(mainChecks 断言原生边框 / minSize)
const t = window.__todoTest
eq(document.title, '迷你待办', '文档标题')
truthy(window.innerWidth >= 900, `内宽应 >= 900,实际 ${window.innerWidth}`)
truthy(window.innerHeight >= 600, `内高应 >= 600,实际 ${window.innerHeight}`)
const sidebar = document.querySelector('[data-testid="sidebar"]')
truthy(sidebar, '侧栏存在')
eq(sidebar.offsetWidth, 240, '侧栏宽度 240(含边框)')
truthy(window.outerWidth > window.innerWidth, '外宽 > 内宽(说明有原生边框)')
return { inner: [window.innerWidth, window.innerHeight], outer: [window.outerWidth, window.outerHeight] }
