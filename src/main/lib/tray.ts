/**
 * 托盘:关闭窗口 = 隐藏到托盘,退出只有「文件→退出」与「托盘右键→退出」两条路径。
 * 今日待办数由渲染层在数据变更后推送(store:save 时带上 todayCount),无需轮询往返。
 */
import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

let tray: Tray | null = null
let todayCount = 0

/** dev 走 app.getAppPath()/resources,打包后走 process.resourcesPath(extraResources 落点) */
function iconPath(): string {
  const packaged = join(process.resourcesPath ?? '', 'resources', 'icon.png')
  const dev = join(app.getAppPath(), 'resources', 'icon.png')
  return existsSync(packaged) ? packaged : dev
}

function refreshMenu(win: BrowserWindow): void {
  if (!tray) return
  tray.setToolTip(`迷你待办 · 今天 ${todayCount} 项`)
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示窗口', click: () => showWindow(win) },
      { label: `今天 ${todayCount} 项待办`, enabled: false },
      { type: 'separator' },
      { label: '退出', click: () => app.quit() }
    ])
  )
}

export function showWindow(win: BrowserWindow): void {
  if (win.isMinimized()) win.restore()
  // Windows 的 SetForegroundWindow 带前台锁定:从别的程序(资源管理器、任务栏)
  // 双击进来时,持锁实例没有前台权限,直接 focus() 会被系统拒绝 ——
  // 结果是窗口确实 show 了却停在后台,用户看着像「点了没反应」。
  // 借一次临时置顶打断这条锁定,再立刻交还正常层级(不交还就会永久置顶)。
  win.setAlwaysOnTop(true)
  win.show()
  win.focus()
  win.setAlwaysOnTop(false)
}

export function setTodayCount(win: BrowserWindow, n: number): void {
  todayCount = n
  refreshMenu(win)
}

export function trayTodayCount(): number {
  return todayCount
}

export function createTray(win: BrowserWindow): Tray {
  const image = nativeImage.createFromPath(iconPath())
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 }))
  refreshMenu(win)

  tray.on('click', () => {
    if (win.isVisible() && !win.isMinimized()) win.hide()
    else showWindow(win)
  })

  return tray
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}

export function trayExists(): boolean {
  return tray !== null
}
