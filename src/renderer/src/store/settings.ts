/**
 * 主题:给 documentElement 设 data-theme='light'|'dark'。
 * 'system' 时按 prefers-color-scheme 解析,并跟随系统变化。
 */
import { reactive } from 'vue'
import { CH } from '@shared/api'

export type Theme = 'system' | 'light' | 'dark'

export interface Settings {
  theme: Theme
  notifyEnabled: boolean
  notifyAt: string
  lastNotifiedDate: string
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  notifyEnabled: false,
  notifyAt: '09:00',
  lastNotifiedDate: ''
}

export const settingsState = reactive<{ value: Settings }>({ value: { ...DEFAULT_SETTINGS } })

const media = window.matchMedia('(prefers-color-scheme: dark)')

function resolved(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') return media.matches ? 'dark' : 'light'
  return theme
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset['theme'] = resolved(theme)
}

/** 当前生效的主题('light'|'dark') */
export function effectiveTheme(): 'light' | 'dark' {
  return document.documentElement.dataset['theme'] === 'dark' ? 'dark' : 'light'
}

media.addEventListener('change', () => {
  if (settingsState.value.theme === 'system') applyTheme('system')
})

export async function refreshSettings(): Promise<Settings> {
  const res = (await window.todoAPI.invoke(CH.settingsLoad)) as { ok: boolean; settings?: Settings }
  const value = res.ok && res.settings ? res.settings : { ...DEFAULT_SETTINGS }
  settingsState.value = value
  applyTheme(value.theme)
  return value
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const res = (await window.todoAPI.invoke(CH.settingsSave, patch)) as { ok: boolean; settings?: Settings }
  if (res.ok && res.settings) {
    settingsState.value = res.settings
    applyTheme(res.settings.theme)
    return res.settings
  }
  return settingsState.value
}

export async function setTheme(theme: Theme): Promise<void> {
  await updateSettings({ theme })
}
