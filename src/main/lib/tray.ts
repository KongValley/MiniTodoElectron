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
  win.show()
  win.focus()
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
