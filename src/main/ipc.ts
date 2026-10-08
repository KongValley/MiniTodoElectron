/**
 * IPC 注册。所有 handler 返回 { ok, ... } 形状,失败一律 console.error + 返回 ok:false,
 * 绝不 reject(渲染层会看到"点了没反应")。
 */
import { app, dialog, ipcMain, shell, type BrowserWindow } from 'electron'
import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { CH } from '@shared/api'
import { emptyStore } from '@shared/store-ops'
import { countDue } from '@shared/query'
import type { Store } from '@shared/types'
import { dataDir, oldStorePath } from './lib/paths'
import { backupIfDue, exportToFile, importFromFile, loadStore, saveStore } from './lib/store'
import { loadSettings, saveSettings, type Settings } from './lib/settings'
import { setTodayCount } from './lib/tray'

type OkResult = { ok: boolean; error?: string }

/** 主进程侧的数据快照(托盘计数与菜单导出共用),随每次 load/save/import 更新 */
let currentStore: Store | null = null

export function getCurrentStore(): Store | null {
  return currentStore
}

/** 统一兜底:文件系统异常不应让 IPC 静默 reject */
async function guard<T extends OkResult>(run: () => Promise<T> | T): Promise<T> {
  try {
    return await run()
  } catch (err) {
    console.error('[ipc] 处理失败:', err)
    return { ok: false, error: err instanceof Error ? err.message : String(err) } as T
  }
}

function stampName(): string {
  const d = new Date()
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`
}

/** 主进程侧的导入流程(菜单与 IPC 共用):选文件 → 归一化 → 让渲染层确认后落盘 */
async function pickAndReadStore(win: BrowserWindow, preset?: string) {
  const options = {
    title: '导入数据',
    defaultPath: preset && existsSync(preset) ? preset : undefined,
    filters: [
      { name: 'JSON 数据', extensions: ['json'] },
      { name: '全部文件', extensions: ['*'] }
    ],
    properties: ['openFile' as const]
  }
  const picked = preset
    ? { canceled: false, filePaths: [preset] }
    : await dialog.showOpenDialog(win, options)
  if (picked.canceled || picked.filePaths.length === 0) return { canceled: true as const }
  const file = picked.filePaths[0] as string
  const result = await importFromFile(file)
  return { canceled: false as const, ...result }
}

/** 落盘前的轻量形状校验:确认顶层结构可用,不做逐条归一化 */
function assertStoreShape(v: unknown): asserts v is Store {
  const o = v as Record<string, unknown> | null
  if (!o || typeof o !== 'object') throw new Error('数据格式非法:不是对象')
  for (const k of ['groups', 'lists', 'todos'] as const) {
    if (!Array.isArray(o[k])) throw new Error(`数据格式非法:${k} 不是数组`)
  }
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(CH.storeLoad, () =>
    guard(async () => {
      const { store, warning } = await loadStore()
      currentStore = store
      const win = getWindow()
      if (win) setTodayCount(win, countDue(store))
      return { ok: true, store, path: join(dataDir(), 'todos.json'), warning }
    })
  )

  ipcMain.handle(CH.storeSave, (_e, payload: unknown) =>
    guard(async () => {
      // 渲染层以序列化字符串发送(传对象时结构化克隆 7.5 万个对象要 85ms,字符串只要 7ms)
      const raw: unknown = typeof payload === 'string' ? JSON.parse(payload) : payload
      // 轻量校验而非逐条 normalizeStore:渲染层由 store-ops 纯函数写入,结构本就合法;
      // 5000 条时逐条归一化要 ~115ms。真正不可信的数据(导入文件)走 store:import,那里仍全量归一化。
      assertStoreShape(raw)
      const store: Store = raw
      await saveStore(store)
      currentStore = store
      const win = getWindow()
      if (win) setTodayCount(win, countDue(store))
      // 刻意不回传 store:渲染层已有同一份数据,回传会让每次保存多克隆 ~1MB
      return { ok: true }
    })
  )

  ipcMain.handle(CH.storeImport, (_e, preset?: unknown) =>
    guard(async () => {
      const win = getWindow()
      if (!win) return { ok: false, error: '窗口不可用' }
      const picked = await pickAndReadStore(win, typeof preset === 'string' ? preset : undefined)
      if (picked.canceled) return { ok: true, canceled: true }
      // 只读:先备份当前数据(替换与合并都会覆盖 todos.json,留档语义不变),
      // 再由渲染层弹「替换 / 合并」选择,最终走 store:save 落盘。
      await backupIfDue(currentStore ?? emptyStore())
      return { ok: true, canceled: false, store: picked.store, source: picked.source, counts: picked.counts }
    })
  )

  ipcMain.handle(CH.storeExport, (_e, payload: unknown) =>
    guard(async () => {
      const win = getWindow()
      if (!win) return { ok: false, error: '窗口不可用' }
      const { canceled, filePath } = await dialog.showSaveDialog(win, {
        title: '导出数据',
        defaultPath: `todos-${stampName()}.json`,
        filters: [{ name: 'JSON 数据', extensions: ['json'] }]
      })
      if (canceled || !filePath) return { ok: true, canceled: true }
      // 渲染层传的是当前 store 对象;导出与保存同源,只做形状校验,不逐条归一化
      assertStoreShape(payload)
      await exportToFile(filePath, payload)
      return { ok: true, canceled: false, path: filePath }
    })
  )

  ipcMain.handle(CH.storeOpenDir, () =>
    guard(async () => {
      const dir = dataDir()
      // 目录不存在先建;仍失败直接返回,绝不 shell.openPath 传不存在的路径
      // (Electron 22 会弹阻塞式系统对话框冻住 IPC)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
      if (!existsSync(dir)) return { ok: false, error: `数据目录不可用：${dir}` }
      const err = await shell.openPath(dir)
      return err === '' ? { ok: true } : { ok: false, error: err }
    })
  )

  ipcMain.handle(CH.settingsLoad, () => guard(() => ({ ok: true, settings: loadSettings() })))

  ipcMain.handle(CH.settingsSave, (_e, patch: unknown) =>
    guard(() => {
      const settings = saveSettings((patch ?? {}) as Partial<Settings>)
      const win = getWindow()
      if (win) win.webContents.send(CH.themeSet, settings.theme)
      return { ok: true, settings }
    })
  )

  ipcMain.handle(CH.appVersion, () => guard(() => ({ ok: true, version: app.getVersion() })))

  ipcMain.handle(CH.appQuit, () =>
    guard(() => {
      app.quit()
      return { ok: true }
    })
  )
}

/** 菜单触发的主进程侧导入(与 IPC 同一条路径,同样先备份再落盘) */
export async function menuImport(win: BrowserWindow, preset?: string): Promise<void> {
  try {
    const picked = await pickAndReadStore(win, preset)
    if (picked.canceled) return
    // 只读 + 备份,选择权交给渲染层:备份的语义与旧版一致(导入前留档),
    // 落盘由渲染层的替换/合并分支走 store:save 完成。
    await backupIfDue(currentStore ?? emptyStore())
    win.webContents.send(CH.uiOpenDialog, 'import-choice', { store: picked.store, counts: picked.counts })
  } catch (err) {
    console.error('[menu] 导入失败:', err)
    void dialog.showMessageBox(win, {
      type: 'error',
      title: '导入失败',
      message: '文件无法解析为待办数据',
      detail: err instanceof Error ? err.message : String(err),
      buttons: ['关闭']
    })
  }
}

/** 菜单触发的导出 */
export async function menuExport(win: BrowserWindow, store?: Store | null): Promise<void> {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: '导出数据',
      defaultPath: `todos-${stampName()}.json`,
      filters: [{ name: 'JSON 数据', extensions: ['json'] }]
    })
    if (canceled || !filePath) return
    await exportToFile(filePath, store ?? currentStore ?? emptyStore())
    win.webContents.send(CH.uiOpenDialog, 'exported', filePath)
  } catch (err) {
    console.error('[menu] 导出失败:', err)
    void dialog.showMessageBox(win, {
      type: 'error',
      title: '导出失败',
      message: '无法写入目标文件',
      detail: err instanceof Error ? err.message : String(err),
      buttons: ['关闭']
    })
  }
}

export { oldStorePath }
