/**
 * 应用设置(主题 / 到期提醒),落在 %APPDATA%\MiniTodoElectron\settings.json。
 * 任何字段缺失或非法都回退默认值,读失败不抛。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dataDir, settingsPath } from './paths'

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  theme: Theme
  notifyEnabled: boolean
  /** 'HH:mm' */
  notifyAt: string
  /** 已发过提醒的日期 'yyyy-MM-dd',同日不重复发 */
  lastNotifiedDate: string
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  notifyEnabled: false,
  notifyAt: '09:00',
  lastNotifiedDate: ''
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const THEMES: Theme[] = ['system', 'light', 'dark']

let cache: Settings | null = null

function normalize(raw: unknown): Settings {
  const o = (raw ?? {}) as Record<string, unknown>
  const theme = o['theme'] as Theme
  const at = o['notifyAt']
  return {
    theme: THEMES.includes(theme) ? theme : DEFAULT_SETTINGS.theme,
    notifyEnabled: o['notifyEnabled'] === true,
    notifyAt: typeof at === 'string' && HHMM.test(at) ? at : DEFAULT_SETTINGS.notifyAt,
    lastNotifiedDate: typeof o['lastNotifiedDate'] === 'string' ? o['lastNotifiedDate'] : ''
  }
}

export function loadSettings(): Settings {
  if (cache) return cache
  try {
    const file = settingsPath()
    cache = existsSync(file) ? normalize(JSON.parse(readFileSync(file, 'utf8'))) : { ...DEFAULT_SETTINGS }
  } catch (err) {
    console.warn('[settings] 读取失败,使用默认设置:', err)
    cache = { ...DEFAULT_SETTINGS }
  }
  return cache
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = normalize({ ...loadSettings(), ...patch })
  try {
    mkdirSync(dataDir(), { recursive: true })
    writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf8')
  } catch (err) {
    console.error('[settings] 写入失败:', err)
  }
  cache = next
  return next
}

export function resetSettingsCache(): void {
  cache = null
}
