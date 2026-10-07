/** 界面状态(视图 / 搜索 / 弹窗 / 提示) */
import { reactive } from 'vue'
import type { ViewKey } from '@shared/types'

export interface TaskDialogState {
  mode: 'new' | 'edit'
  id?: string
  presetDate?: string
  presetList?: string
}

export interface ConfirmState {
  title: string
  detail: string
  onOk: () => void
}

export const ui = reactive({
  view: 'week7' as ViewKey,
  search: '',
  searchOpen: false,
  board: true,
  dialog: null as TaskDialogState | null,
  settingsOpen: false,
  helpOpen: false,
  confirm: null as ConfirmState | null,
  toast: '',
  /** 侧栏分组展开状态(手动收起的分组不被切视图自动展开) */
  collapsed: {} as Record<string, boolean>
})

let toastTimer: number | undefined

export function toast(message: string): void {
  ui.toast = message
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    ui.toast = ''
  }, 4000)
}

export function requestNew(preset?: { date?: string; list?: string }): void {
  ui.dialog = { mode: 'new', presetDate: preset?.date, presetList: preset?.list }
}

export function requestEdit(id: string): void {
  ui.dialog = { mode: 'edit', id }
}

export function closeDialog(): void {
  ui.dialog = null
}

export function askConfirm(title: string, detail: string, onOk: () => void): void {
  ui.confirm = { title, detail, onOk }
}
