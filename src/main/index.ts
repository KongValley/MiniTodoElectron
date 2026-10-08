import { app, BrowserWindow, Menu, Notification, protocol } from 'electron'
import { existsSync } from 'node:fs'
import { join, normalize } from 'node:path'
import { CH } from '@shared/api'
import { countDue } from '@shared/query'
import type { Store } from '@shared/types'
import { registerIpc, getCurrentStore, menuExport, menuImport } from './ipc'
import { buildMenu } from './menu'
import { applyDataDirOverride, dataDir, storePath } from './lib/paths'
import { loadStore, saveStore } from './lib/store'
import { loadSettings, saveSettings } from './lib/settings'
import { createTray, destroyTray, setTodayCount, showWindow, trayExists } from './lib/tray'
import { runNotifyTick, startNotifyLoop, stopNotifyLoop } from './lib/notify'
import { isSmokeMode, runSmoke } from './smoke'

// 数据目录必须在任何 app.getPath('userData') 调用之前重定向
app.setPath('userData', join(app.getPath('appData'), 'MiniTodoElectron'))
// 冒烟模式:TODO_DATA_DIR 覆盖(每步独立目录)
applyDataDirOverride()

// Windows 任务栏归组与通知身份标识(与 package.json 的 build.appId 一致)。
// 缺了它,任务栏会按 exe 路径归组,便携版换目录或重复启动时容易分裂出多个图标。
app.setAppUserModelId('com.locale.minitodo')

/**
 * 单实例锁:重复双击(或连点快捷方式)时不再开第二个进程。
 * 锁按 userData 目录区分,因此冒烟/基准脚本用各自独立的 --user-data-dir 时互不干扰。
 * 必须在重定向 userData 之后调用,否则锁会落在默认目录上。
 */
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  // 第二个实例直接退出:窗口的显示与前置交给已在运行的实例处理
  app.quit()
} else {
  app.on('second-instance', () => {
    // 用户又启动了一次 → 把已有窗口显示出来并置顶(而不是开新窗口/新图标)
    if (mainWindow && !mainWindow.isDestroyed()) showWindow(mainWindow)
  })
}

// 内网 32 位老机器优先稳定:禁用硬件加速(避免老显卡驱动导致的黑屏/崩溃)
app.disableHardwareAcceleration()
// 32 位进程地址空间有限(2GB),堆上限收紧到 512MB;64 位放宽到 1GB
app.commandLine.appendSwitch(
  'js-flags',
  process.arch === 'ia32' ? '--max-old-space-size=512' : '--max-old-space-size=1024'
)

// 双击启动(无终端)时 stdout/stderr 可能已断开,任何 console 写入都会抛 EPIPE 并弹出
// "A JavaScript error occurred in the main process";挂 error 监听把写失败降级为忽略
for (const stream of [process.stdout, process.stderr]) {
  stream.on('error', () => {
    /* 忽略 EPIPE 等写入错误 */
  })
}

// 生产环境经 app:// 提供渲染资源(Electron 22 无 protocol.handle,使用 registerFileProtocol)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true }
  }
])

function registerAppProtocol(): void {
  const rendererRoot = normalize(join(app.getAppPath(), 'out/renderer'))
  protocol.registerFileProtocol('app', (request, callback) => {
    const url = new URL(request.url)
    const filePath = normalize(join(rendererRoot, decodeURIComponent(url.pathname)))
    // 路径穿越防护:越界时返回不存在的路径(Chromium 按 404 处理)
    const safePath = filePath.startsWith(rendererRoot) ? filePath : join(rendererRoot, '__forbidden__')
    callback({ path: safePath })
  })
}

let mainWindow: BrowserWindow | null = null
let forceQuit = false
let trayHintShown = false

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    title: '迷你待办',
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#FAFAFB',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 关闭 = 隐藏到托盘(托盘常驻);真正退出走「文件→退出」/「托盘右键→退出」,
  // 两者都经 app.quit() → before-quit 置 forceQuit,届时才真正关窗。
  mainWindow.on('close', (event) => {
    const win = mainWindow
    if (forceQuit || !win) return
    event.preventDefault()
    win.hide()
    // 冒烟模式不发提示(会干扰断言,也无意义)
    if (!isSmokeMode() && !trayHintShown && Notification.isSupported()) {
      trayHintShown = true
      try {
        new Notification({ title: '迷你待办', body: '已最小化到托盘，右键托盘图标可退出' }).show()
      } catch (err) {
        console.error('[tray] 提示发送失败:', err)
      }
    }
  })

  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[renderer] 进程崩溃:', details.reason)
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    void mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void mainWindow.loadURL('app://./index.html')
  }
}

/** 冒烟模式下的主进程侧断言(托盘存在 / 原生边框 / 通知链路 / 单实例) */
function mainChecks(): Record<string, unknown> {
  const win = mainWindow
  // Electron 无 isFrameless();无边框窗口的 contentBounds 与 bounds 完全相等
  const frameless = win
    ? JSON.stringify(win.getContentBounds()) === JSON.stringify(win.getBounds())
    : null

  // TODO_SMOKE_NOTIFY=1 时把提醒时间设成已过去的时刻,让本次运行内必然触发一次
  if (process.env['TODO_SMOKE_NOTIFY'] === '1') {
    saveSettings({ notifyEnabled: true, notifyAt: '00:00' })
  }
  const notify = win ? runNotifyTick(win, () => countDue(getCurrentStore() ?? EMPTY_STORE)) : null

  // 关闭 = 隐藏到托盘(不退出):这是托盘常驻应用的核心行为,主进程侧才能观测
  let closeProbe: Record<string, unknown> | null = null
  if (win && process.env['TODO_SMOKE_CLOSE_PROBE'] === '1') {
    const before = win.isVisible()
    win.close()
    closeProbe = { before, afterVisible: win.isVisible(), destroyed: win.isDestroyed() }
  }

  // 单实例:持有锁的进程应报告 hasLock=true;再把窗口藏起来模拟"用户看不到窗口",
  // 然后触发一次 second-instance(等价于用户又点了一次图标),窗口应重新可见。
  let singleInstance: Record<string, unknown> | null = null
  if (win && process.env['TODO_SMOKE_SINGLE_INSTANCE'] === '1') {
    win.hide()
    const hiddenBefore = win.isVisible()
    app.emit('second-instance', {} as never, [] as never, {} as never)
    singleInstance = {
      hasLock: app.hasSingleInstanceLock(),
      hiddenBefore,
      visibleAfter: win.isVisible(),
      minimizedAfter: win.isMinimized()
    }
  }

  return {
    trayExists: trayExists(),
    frameless,
    title: win ? win.getTitle() : null,
    minSize: win ? win.getMinimumSize() : null,
    dataDir: dataDir(),
    closeProbe,
    singleInstance,
    notify: notify
      ? {
          requested: process.env['TODO_SMOKE_NOTIFY'] === '1',
          supported: notify.supported,
          lastNotifiedDate: notify.lastNotifiedDate,
          lastBody: notify.lastBody
        }
      : null
  }
}

const EMPTY_STORE: Store = { version: 2, groups: [], lists: [], todos: [] }

// 没拿到单实例锁的进程不做任何初始化:不建窗口、不建托盘、不起通知轮询。
// (上面已调 app.quit(),这里直接跳过整个启动流程)
if (gotSingleInstanceLock) {
  app.whenReady().then(async () => {
    registerAppProtocol()
    registerIpc(() => mainWindow)
    createWindow()

    const win = mainWindow as BrowserWindow
    const loaded = await loadStore()
    loadSettings()
    // 首次运行(无数据文件)写入示例数据,用户可直接改/清空该文件
    if (!existsSync(storePath())) await saveStore(loaded.store)
    // 托盘在冒烟模式下也创建(step16 要断言),通知轮询只在正式运行启动
    createTray(win)

    win.webContents.once('did-finish-load', () => {
      setTodayCount(win, countDue(loaded.store))
      if (loaded.warning) win.webContents.send(CH.uiOpenDialog, 'warning', loaded.warning)
    })

    if (isSmokeMode()) {
      void runSmoke(win, mainChecks)
      return
    }

    startNotifyLoop(win, () => countDue(getCurrentStore() ?? EMPTY_STORE))

    Menu.setApplicationMenu(
      buildMenu(win, {
        importStore: (w, file) => void menuImport(w, file),
        exportStore: (w) => void menuExport(w)
      })
    )

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
      else showWindow(win)
    })
  })
}

app.on('before-quit', () => {
  forceQuit = true
  stopNotifyLoop()
  destroyTray()
})

// 托盘常驻:窗口全关不退出(冒烟模式除外,否则进程挂住)
app.on('window-all-closed', () => {
  if (isSmokeMode()) app.quit()
})
