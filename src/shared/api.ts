/** preload 暴露给渲染进程的 API 契约 */
export interface TodoAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (channel: string, callback: (...args: unknown[]) => void) => () => void
}

/** 主进程 / 预加载 / 渲染共享的 IPC 通道名 */
export const CH = {
  storeLoad: 'store:load',
  storeSave: 'store:save',
  storeImport: 'store:import',
  storeExport: 'store:export',
  storeOpenDir: 'store:openDir',
  settingsLoad: 'settings:load',
  settingsSave: 'settings:save',
  appVersion: 'app:version',
  appQuit: 'app:quit',
  uiSetBoard: 'ui:set-board',
  uiOpenDialog: 'ui:open-dialog',
  themeSet: 'theme:set'
} as const
