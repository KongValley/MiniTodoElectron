/**
 * 应用菜单(autoHideMenuBar 下按 Alt 可见)。
 * 需要渲染层配合的项发消息;主进程能独立完成的(导入/导出/打开目录/退出)直接做。
 */
import { app, dialog, Menu, shell, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { mkdirSync } from 'node:fs'
import { CH } from '@shared/api'
import { dataDir, oldStorePath } from './lib/paths'
import { loadSettings, saveSettings, type Theme } from './lib/settings'

export interface MenuHooks {
  importStore: (win: BrowserWindow, file?: string) => void
  exportStore: (win: BrowserWindow) => void
}

function openDataDir(): void {
  const dir = dataDir()
  mkdirSync(dir, { recursive: true })
  void shell.openPath(dir)
}

function themeItems(win: BrowserWindow): MenuItemConstructorOptions[] {
  const current = loadSettings().theme
  const make = (label: string, value: Theme): MenuItemConstructorOptions => ({
    label,
    type: 'radio',
    checked: current === value,
    click: () => {
      saveSettings({ theme: value })
      win.webContents.send(CH.themeSet, value)
    }
  })
  return [make('跟随系统', 'system'), make('浅色', 'light'), make('深色', 'dark')]
}

export function buildMenu(win: BrowserWindow, hooks: MenuHooks): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '导入旧版数据…',
          click: () => hooks.importStore(win, oldStorePath())
        },
        { label: '导入 JSON…', click: () => hooks.importStore(win) },
        { label: '导出数据…', click: () => hooks.exportStore(win) },
        { type: 'separator' },
        { label: '打开数据目录', click: openDataDir },
        { type: 'separator' },
        { label: '退出', click: () => app.quit() }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '看板', accelerator: 'Ctrl+1', click: () => win.webContents.send(CH.uiSetBoard, true) },
        { label: '列表', accelerator: 'Ctrl+2', click: () => win.webContents.send(CH.uiSetBoard, false) },
        { type: 'separator' },
        ...themeItems(win),
        { type: 'separator' },
        { label: '设置…', click: () => win.webContents.send(CH.uiOpenDialog, 'settings') }
      ]
    },
    {
      label: '帮助',
      submenu: [
        { label: '快捷键', click: () => win.webContents.send(CH.uiOpenDialog, 'help') },
        {
          label: '关于',
          click: () => {
            void dialog.showMessageBox(win, {
              type: 'info',
              title: '关于 迷你待办',
              message: `迷你待办 ${app.getVersion()}`,
              detail: `基于 Electron 的看板式待办工具\n数据目录：${dataDir()}`,
              buttons: ['关闭']
            })
          }
        }
      ]
    }
  ]
  return Menu.buildFromTemplate(template)
}
