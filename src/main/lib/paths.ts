import { app } from 'electron'
import { join } from 'node:path'

/** 数据目录:%APPDATA%\MiniTodoElectron(userData 已在 index.ts 顶层重定向) */
export function dataDir(): string {
  return app.getPath('userData')
}

/** 冒烟/测试用:每个步骤用独立数据目录,避免互相污染(正式运行不设此变量) */
export function applyDataDirOverride(): void {
  const override = process.env['TODO_DATA_DIR']
  if (override) app.setPath('userData', override)
}

export function storePath(): string {
  return join(dataDir(), 'todos.json')
}

export function settingsPath(): string {
  return join(dataDir(), 'settings.json')
}

export function backupDir(): string {
  return join(dataDir(), 'backups')
}

/** 旧版 C# 应用的数据文件(一次性导入用) */
export function oldStorePath(): string {
  return join(app.getPath('appData'), 'MiniTodo', 'todos.json')
}
