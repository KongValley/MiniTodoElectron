import { app, type BrowserWindow } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * 无头冒烟测试工具(仅当 TODO_SMOKE=1 时启用)。
 * 环境变量:
 *   TODO_SMOKE=1            启用
 *   TODO_SMOKE_SCRIPT=path  在渲染进程求值的 JS 文件(顶层允许 await,返回值即结果)
 *   TODO_SMOKE_OUT=path     结果 JSON 输出路径
 *   TODO_SMOKE_SHOT=path    窗口截图 PNG 输出路径(可选)
 *   TODO_SMOKE_ROOT=path    仓库根目录(注入给脚本拼路径)
 *   TODO_SMOKE_TIMEOUT=ms   脚本超时(默认 60000)
 *   TODO_SMOKE_SETTLE=ms    截图前等待渲染稳定(默认 800)
 */
export function isSmokeMode(): boolean {
  return process.env['TODO_SMOKE'] === '1'
}

/** 主进程侧断言:由 index.ts 注入(托盘存在、窗口边框、通知状态等) */
export type MainChecks = () => Record<string, unknown>

// 人工视觉核对:截图到 tmp/shots/(仅当 TODO_SMOKE_SHOT_DIR 指定时执行)
async function captureVisuals(win: BrowserWindow, dir: string): Promise<void> {
  const { mkdirSync } = await import('node:fs')
  mkdirSync(dir, { recursive: true })
  const shot = async (name: string): Promise<void> => {
    writeFileSync(join(dir, name), (await win.webContents.capturePage()).toPNG())
  }
  const run = (code: string): Promise<unknown> => win.webContents.executeJavaScript(code, true)
  // 首帧未绘制时 capturePage 会得到空图
  await new Promise((r) => setTimeout(r, 800))
  await shot('01-board-light.png')
  await run('window.__todoTest.setBoard(false)')
  await new Promise((r) => setTimeout(r, 500))
  await shot('02-list-light.png')
  await run("window.__todoTest.setTheme('dark')")
  await new Promise((r) => setTimeout(r, 600))
  await shot('03-list-dark.png')
  await run('window.__todoTest.setBoard(true)')
  await new Promise((r) => setTimeout(r, 600))
  await shot('04-board-dark.png')
  await run("window.__todoTest.setTheme('light'); window.__todoTest.openNew()")
  await new Promise((r) => setTimeout(r, 600))
  await shot('05-dialog.png')
  await run('window.__todoTest.closeDialog()')
}

export async function runSmoke(win: BrowserWindow, mainChecks?: MainChecks): Promise<void> {
  const shotDir = process.env['TODO_SMOKE_SHOT_DIR'] ?? ''
  const scriptPath = process.env['TODO_SMOKE_SCRIPT'] ?? ''
  const outPath = process.env['TODO_SMOKE_OUT'] ?? ''
  const shotPath = process.env['TODO_SMOKE_SHOT'] ?? ''
  const timeoutMs = Number(process.env['TODO_SMOKE_TIMEOUT'] ?? 60000)
  const settleMs = Number(process.env['TODO_SMOKE_SETTLE'] ?? 800)

  const captureShot = async (): Promise<void> => {
    if (!shotPath) return
    try {
      const image = await win.webContents.capturePage()
      writeFileSync(shotPath, image.toPNG())
    } catch (err) {
      console.error('[smoke] 截图失败:', err)
    }
  }

  const report = (payload: Record<string, unknown>): void => {
    const text = JSON.stringify(payload, null, 2)
    if (outPath) writeFileSync(outPath, text)
    console.log('[smoke] ' + text)
  }

  /** 进程级度量:工作集 + 私有工作集(任务管理器「内存」列口径) + CPU 峰值 */
  const cpuPeak: Record<string, number> = {}
  const sampler = setInterval(() => {
    for (const m of app.getAppMetrics()) {
      const pct = m.cpu?.percentCPUUsage ?? 0
      if (pct > (cpuPeak[m.type] ?? 0)) cpuPeak[m.type] = pct
    }
  }, 100)

  const round1 = (v: number): number => Math.round(v * 10) / 10

  const collectMetrics = (): Record<string, unknown> => {
    const procs = app.getAppMetrics().map((m) => ({
      type: m.type,
      pid: m.pid,
      rssMB: round1((m.memory?.workingSetSize ?? 0) / 1024),
      // privateBytes = 私有提交(≈ Windows PrivateMemorySize64),不含共享 DLL 页。
      // 注意:任务管理器「内存」列是"私有工作集",比这个小(实测 5000 条约 83 vs 136 MB),
      // 且 getAppMetrics() 不提供该字段,要读它得用外部 Get-Counter。
      privateMB: round1((m.memory?.privateBytes ?? 0) / 1024),
      peakRssMB: round1((m.memory?.peakWorkingSetSize ?? 0) / 1024),
      cpuPeakPercent: round1(cpuPeak[m.type] ?? 0)
    }))
    return {
      processes: procs,
      // 两种口径的合计:与「控制在 N MB 以内」这类目标对比时先说清口径
      totalRssMB: round1(procs.reduce((s, p) => s + p.rssMB, 0)),
      totalPrivateMB: round1(procs.reduce((s, p) => s + p.privateMB, 0)),
      mainCpu: process.getCPUUsage()
    }
  }

  try {
    if (scriptPath) {
      const code = readFileSync(scriptPath, 'utf8')

      // Electron 22 的 Node 16 无 Promise.withResolvers,使用执行器形式
      let timer: NodeJS.Timeout | undefined
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`冒烟脚本超时(${timeoutMs}ms)`)), timeoutMs)
      })
      const rootEnv = `const __smokeRoot = ${JSON.stringify(process.env['TODO_SMOKE_ROOT'] ?? '')};
const __smokeEnv = ${JSON.stringify(
        Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('TODO_SMOKE_')))
      )};
function assert(cond, msg) { if (!cond) throw new Error('断言失败: ' + msg) }
function eq(actual, expected, msg) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a !== e) throw new Error('断言失败: ' + msg + ' —— 期望 ' + e + ' 实际 ' + a)
}
function truthy(actual, msg) { assert(!!actual, msg + ' —— 实际 ' + JSON.stringify(actual)) }
`
      const run = win.webContents.executeJavaScript(`(async () => {\n${rootEnv}\n${code}\n})()`, true)
      const result = await Promise.race([run, timeout])
      clearTimeout(timer)
      await new Promise((resolve) => setTimeout(resolve, settleMs))
      await captureShot()
      report({ ok: true, result, mainChecks: mainChecks?.() ?? {}, metrics: collectMetrics() })
    } else if (shotDir) {
      await captureVisuals(win, shotDir)
      report({ ok: true, result: { visuals: shotDir }, mainChecks: mainChecks?.() ?? {}, metrics: collectMetrics() })
    } else {
      throw new Error('缺少 TODO_SMOKE_SCRIPT 或 TODO_SMOKE_SHOT_DIR')
    }
  } catch (err) {
    await captureShot()
    report({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      mainChecks: mainChecks?.() ?? {},
      metrics: collectMetrics()
    })
  } finally {
    clearInterval(sampler)
    app.quit()
  }
}
