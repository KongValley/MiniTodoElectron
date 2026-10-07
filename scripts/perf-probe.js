// 性能探针(在渲染进程求值):量「一次典型交互」的墙钟与主线程阻塞。
// 只依赖 window.__todoTest 的稳定成员。主线程长任务比进程 CPU% 更能反映卡顿。
const t = window.__todoTest
if (!t) throw new Error('测试 API 未安装')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const now = () => performance.now()

// 主线程阻塞(长任务)是渲染卡顿的直接来源
let blockingMs = 0
let longTasks = 0
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) {
      blockingMs += e.duration
      longTasks++
    }
  }).observe({ entryTypes: ['longtask'] })
} catch {
  /* 不支持 longtask 时只量墙钟 */
}

/** 等两帧:确保 Vue 的渲染与浏览器绘制都完成 */
const settle = () =>
  new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())))

const steps = []
async function step(label, action) {
  const b0 = blockingMs
  const l0 = longTasks
  const t0 = now()
  await action()
  await settle()
  steps.push({
    label,
    wallMs: Math.round(now() - t0),
    blockingMs: Math.round(blockingMs - b0),
    longTasks: longTasks - l0,
    cards: document.querySelectorAll('[data-card]').length,
    rows: document.querySelectorAll('[data-row]').length,
    cols: document.querySelectorAll('[data-column]').length
  })
}

// 初始状态:看板 + week7
const total = t.getState().todos.length

const activeIds = () => t.getState().todos.filter((x) => x.status === 0).map((x) => x.id)
const firstWithDate = () => t.getState().todos.find((x) => x.status === 0 && x.date)?.id ?? activeIds()[0]

await step('切换视图 week7→all→week7', async () => {
  t.setView('all')
  await sleep(0)
  t.setView('week7')
  await sleep(0)
})

await step('切换 看板→列表→看板', async () => {
  t.setBoard(false)
  await sleep(0)
  t.setBoard(true)
  await sleep(0)
})

await step('完成一条任务', async () => {
  const id = activeIds()[0]
  if (id) await t.complete(id)
})

await step('搜索「任务标题 1」', async () => {
  t.setSearch('任务标题 1')
  await sleep(0)
})
t.setSearch('')
await sleep(0)

await step('拖拽改期一次', async () => {
  const id = firstWithDate()
  if (id) await t.moveCardToDate(id, '2030-01-01', 0)
})

await step('新建任务', async () => {
  await t.newTask({ title: 'perf-probe', date: '2030-01-02', prio: 1 })
})

await step('落盘 flush', async () => {
  await t.flush()
})

// 大列表滚动:列表视图下滚到底部(量虚拟滚动的收益)
await step('切到列表并滚到底', async () => {
  t.setBoard(false)
  t.setView('all')
  t.setSearch('')
  await sleep(0)
  const host = document.querySelector('.rows')
  if (host) {
    host.scrollTop = host.scrollHeight
    await sleep(0)
  }
})
t.setBoard(true)
await sleep(0)

const domCards = document.querySelectorAll('[data-card]').length
const domRows = document.querySelectorAll('[data-row]').length
const domCols = document.querySelectorAll('[data-column]').length

return {
  total,
  domCards,
  domRows,
  domCols,
  blockingMsTotal: Math.round(blockingMs),
  longTasks,
  steps
}
