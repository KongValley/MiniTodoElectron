// 步骤 18:单实例锁 —— 重复点击应用图标不应开出第二个实例(否则任务栏出现重复图标)
// 主进程侧断言见 mainChecks.singleInstance(TODO_SMOKE_SINGLE_INSTANCE=1 时采样)。
const t = window.__todoTest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// 渲染层可观测的间接证据:窗口存在且应用正常响应(不因锁逻辑被误伤)
truthy(document.querySelector('.shell'), '应用外壳已渲染')
truthy(t, '测试 API 可用')
eq(document.title, '迷你待办', '标题')

// 打开/关闭一个弹窗,确认锁逻辑没有影响正常交互
t.openNew()
await sleep(120)
truthy(document.querySelector('[data-testid="task-dialog"]'), '弹窗能正常打开')
t.closeDialog()
await sleep(100)
eq(t.dialog(), null, '弹窗能正常关闭')

// 视图切换仍正常(托盘常驻 + 单实例不应影响主流程)
t.setView('today')
await sleep(80)
eq(t.getView(), 'today', '视图切换正常')
t.setView('week7')

return { view: t.getView(), counts: t.counts() }
