/**
 * 全局快捷键。结构照 pdf编辑器 的 useGlobalKeymap:
 * onMounted 挂 window keydown,onBeforeUnmount 摘掉。
 */
import { onBeforeUnmount, onMounted } from 'vue'
import { addDays, today } from '@shared/dates'
import type { ViewKey } from '@shared/types'
import { reload, mutate, state } from '../store/data'
import { askConfirm, closeCardMenu, closeDialog, requestNew, toast, ui } from '../store/ui'
import { removeTodos } from '@shared/store-ops'
import { clearSelection, currentRowIds, selectAll, selectedIds } from './selection'

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable
}

/** 新建时的预设日期与清单(与旧版 PresetList 行为一致) */
export function newTaskPreset(): { date: string; list: string } {
  const view = ui.view
  const date = view === 'tmr' ? addDays(today(), 1) : today()
  let list = ''
  if (view.startsWith('list:')) list = view.slice(5)
  else if (view.startsWith('group:')) {
    const gid = view.slice(6)
    list = state.store.lists.find((l) => l.gid === gid)?.id ?? ''
  }
  return { date, list }
}

export function setView(view: ViewKey): void {
  ui.view = view
  clearSelection()
}

export function toggleBoard(): void {
  ui.board = !ui.board
}

/** 删除一律二次确认(单条也确认;回收站视图是彻底删除,文案点明不可恢复) */
function handleDelete(): void {
  if (selectedIds.size === 0) return
  const ids = [...selectedIds]
  const purge = ui.view === 'trash'
  askConfirm(
    purge ? '彻底删除' : '移入回收站',
    purge ? `将彻底删除 ${ids.length} 条任务，无法恢复。` : `将 ${ids.length} 条任务移入回收站。`,
    () => {
      void mutate((s) => removeTodos(s, ids, purge)).then(() => {
        toast(purge ? `已彻底删除 ${ids.length} 项` : `已移入回收站 ${ids.length} 项`)
        clearSelection()
      })
    }
  )
}

export function useGlobalKeymap(): void {
  function onKeyDown(event: KeyboardEvent): void {
    const ctrl = event.ctrlKey || event.metaKey
    const key = event.key.toLowerCase()

    if (ctrl && key === 'f') {
      event.preventDefault()
      ui.searchOpen = true
      return
    }

    if (event.key === 'Escape') {
      if (ui.dialog) {
        closeDialog()
        return
      }
      if (ui.settingsOpen) {
        ui.settingsOpen = false
        return
      }
      if (ui.helpOpen) {
        ui.helpOpen = false
        return
      }
      if (ui.confirm) {
        ui.confirm = null
        return
      }
      if (ui.cardMenu) {
        closeCardMenu()
        return
      }
      if (ui.searchOpen) {
        ui.searchOpen = false
        ui.search = ''
      }
      return
    }

    if (event.key === 'F5') {
      event.preventDefault()
      void reload().then(() => toast('已刷新'))
      return
    }

    // 输入框聚焦时交还原生行为(否则打字会误触);Ctrl+A 仍保留输入框内的原生全选文本
    if (isTypingTarget(event.target)) return

    // 列表视图全选当前视图;看板下无行源(currentRowIds 返回空)故不生效
    if (ctrl && key === 'a' && !ui.board) {
      event.preventDefault()
      const ids = currentRowIds()
      if (ids.length > 0) {
        selectAll(ids)
        toast(`已选 ${ids.length} 条`)
      }
      return
    }

    switch (event.key) {
      case 'n':
      case 'N': {
        const preset = newTaskPreset()
        requestNew(preset)
        return
      }
      case 'b':
      case 'B':
        toggleBoard()
        return
      case 'Delete':
        handleDelete()
        return
      case 'F2':
        if (selectedIds.size === 1) {
          ui.dialog = { mode: 'edit', id: [...selectedIds][0] as string }
        }
        return
      case 'Enter':
        if (selectedIds.size === 1) {
          ui.dialog = { mode: 'edit', id: [...selectedIds][0] as string }
        }
        return
      case '1':
        setView('today')
        return
      case '2':
        setView('tmr')
        return
      case '3':
        setView('week7')
        return
      case '4':
        setView('all')
        return
      default:
        return
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown))
}
