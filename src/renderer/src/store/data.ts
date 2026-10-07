/**
 * 唯一数据源。state.store 只在 commit 里整体替换,组件不直接改字段(不可变)。
 */
import { reactive } from 'vue'
import { emptyStore, normalizeStore } from '@shared/store-ops'
import type { Store } from '@shared/types'
import { CH } from '@shared/api'
import { refreshSettings, type Settings } from './settings'

export const state = reactive({
  store: emptyStore() as Store,
  path: '',
  warning: '',
  settings: null as Settings | null,
  ready: false
})

/** 最近一次保存的 Promise,供冒烟的 flush() 等待落盘 */
let pending: Promise<unknown> = Promise.resolve()

export function flush(): Promise<unknown> {
  return pending
}

export async function commit(next: Store): Promise<void> {
  const safe = normalizeStore(next)
  state.store = safe
  pending = window.todoAPI.invoke(CH.storeSave, safe)
  await pending
}

/** 纯函数式改数据:mutate(s => addTodo(s, {...})) */
export async function mutate(fn: (s: Store) => Store): Promise<void> {
  await commit(fn(state.store))
}

export async function reload(): Promise<void> {
  const res = (await window.todoAPI.invoke(CH.storeLoad)) as {
    ok: boolean
    store?: Store
    path?: string
    warning?: string
    error?: string
  }
  if (!res.ok || !res.store) throw new Error(res.error ?? '数据加载失败')
  state.store = res.store
  state.path = res.path ?? ''
  state.warning = res.warning ?? ''
}

export async function init(): Promise<void> {
  await reload()
  state.settings = await refreshSettings()
  state.ready = true
}

/** 导入:由渲染层弹提示并确认后落盘(主进程侧菜单导入走 IPC 直接落盘) */
export async function importFromDialog(preset?: string): Promise<{ ok: boolean; canceled?: boolean; error?: string }> {
  const res = (await window.todoAPI.invoke(CH.storeImport, preset)) as {
    ok: boolean
    canceled?: boolean
    store?: Store
    counts?: { groups: number; lists: number; todos: number }
    error?: string
  }
  if (!res.ok) return { ok: false, error: res.error }
  if (res.canceled || !res.store) return { ok: true, canceled: true }
  state.store = res.store
  state.warning = `已导入 ${res.counts?.groups ?? 0} 个分组 / ${res.counts?.lists ?? 0} 个清单 / ${res.counts?.todos ?? 0} 条任务`
  return { ok: true }
}

export async function exportToDialog(): Promise<{ ok: boolean; canceled?: boolean; path?: string; error?: string }> {
  const res = (await window.todoAPI.invoke(CH.storeExport, state.store)) as {
    ok: boolean
    canceled?: boolean
    path?: string
    error?: string
  }
  return res
}
