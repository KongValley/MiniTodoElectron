// 步骤 27:渲染进程崩溃后窗口自动重载自愈
//
// 背景:render-process-gone 以前只打日志。渲染进程一死,窗口还在、内容永远空白,
// 而且关窗口是隐藏到托盘,用户既看不到提示也没有出路 —— 表现为「应用全部变白」。
//
// 崩溃由主进程侧注入触发(见 index.ts 的 TODO_SMOKE_CRASH_PROBE):
// 渲染进程在 contextIsolation 下拿不到 process,没法自己 process.crash(),
// 而主进程用 Electron 的 forcefullyCrashRenderer() 才能造出真实故障。
// 本步骤只负责确认崩溃发生前应用是活的,恢复情况由 mainChecks 断言。
const t = window.__todoTest

truthy(document.querySelector('[data-testid="sidebar"]'), '崩溃前侧栏已渲染')
truthy(document.querySelector('[data-testid="body"]'), '崩溃前主区域已渲染')

return { probe: 'crash-injected-by-main-process' }