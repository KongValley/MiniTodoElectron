/**
 * 渲染进程测试 API(冒烟验证用),挂到 window.__todoTest。
 * 全部走与 UI 相同的 store-ops 纯函数与 store,不另写一套逻辑。
 */
import { isDate, label } from '@shared/dates'
import { bucketsOf, countDue, sortedByIndex } from '@shared/query'
import { index } from './store/index'
import {
  addSubtask,
  addTodo,
  completeTodo,
  moveCard,
  normalizeStore,
  removeTodos,
  setStatus,
  toggleSubtask,
  updateTodo
} from '@shared/store-ops'
import type { Store, TodoItem, ViewKey } from '@shared/types'
import { commit, flush, mutate, reload, state } from './store/data'
import { applyTheme, effectiveTheme, setTheme, updateSettings, type Theme } from './store/settings'
import { closeDialog, requestNew, ui } from './store/ui'
import { clearSelection, selectedIds } from './lib/selection'
import { setView, toggleBoard } from './lib/keymap'

export interface TodoTestAPI {
  getState: () => Store
  setView: (view: ViewKey) => void
  getView: () => string
  setSearch: (text: string) => void
  counts: () => { all: number; today: number; due: number; trash: number; done: number }
  flush: () => Promise<unknown>
  reload: () => Promise<void>

  newTask: (patch: Partial<TodoItem>) => Promise<TodoItem>
  editTask: (id: string, patch: Partial<TodoItem>) => Promise<void>
  remove: (ids: string[], purge?: boolean) => Promise<void>
  complete: (id: string) => Promise<void>
  setStatus: (id: string, status: 0 | 1 | 2 | 3) => Promise<void>

  moveCardToDate: (id: string, date: string, index: number) => Promise<void>
  addSubtask: (id: string, title: string) => Promise<void>
  toggleSubtask: (id: string, subId: string) => Promise<void>

  importJson: (text: string) => Promise<{ groups: number; lists: number; todos: number }>

  theme: () => string
  setTheme: (theme: Theme) => Promise<void>
  board: () => boolean
  setBoard: (on: boolean) => void
  setNotify: (enabled: boolean, at?: string) => Promise<void>

  boardColumns: () => { date: string; prios: number[]; ids: string[] }[]
  listRows: () => { id: string; title: string; date: string }[]
  buckets: (date: string) => { prio: number; ids: string[] }[]

  select: (ids: string[]) => void
  selection: () => string[]
  dialog: () => unknown
  openNew: () => void
  closeDialog: () => void

  isDate: (s: string) => boolean
  label: (s: string) => string
  todos: () => TodoItem[]
}

function find(id: string): TodoItem | undefined {
  return state.store.todos.find((t) => t.id === id)
}

export function installTestApi(): void {
  const api: TodoTestAPI = {
    getState: () => JSON.parse(JSON.stringify(state.store)) as Store,
    setView: (view) => setView(view),
    getView: () => ui.view,
    setSearch: (text) => {
      ui.search = text
    },
    counts: () => ({
      all: index.value.counts['all'] ?? 0,
      today: index.value.counts['today'] ?? 0,
      due: countDue(state.store),
      trash: index.value.counts['trash'] ?? 0,
      done: index.value.counts['done'] ?? 0
    }),
    flush: () => flush(),
    reload,

    newTask: async (patch) => {
      const before = new Set(state.store.todos.map((t) => t.id))
      await mutate((s) => addTodo(s, patch))
      const created = state.store.todos.find((t) => !before.has(t.id))
      if (!created) throw new Error('新建任务失败')
      return created
    },
    editTask: (id, patch) => mutate((s) => updateTodo(s, id, patch)),
    remove: (ids, purge = false) => mutate((s) => removeTodos(s, ids, purge)),
    complete: (id) => mutate((s) => completeTodo(s, id)),
    setStatus: (id, status) => mutate((s) => setStatus(s, id, status)),

    moveCardToDate: (id, date, index) => mutate((s) => moveCard(s, id, date, index)),
    addSubtask: (id, title) => mutate((s) => addSubtask(s, id, title)),
    toggleSubtask: (id, subId) => mutate((s) => toggleSubtask(s, id, subId)),

    importJson: async (text) => {
      const parsed = normalizeStore(JSON.parse(text))
      await commit(parsed)
      return { groups: parsed.groups.length, lists: parsed.lists.length, todos: parsed.todos.length }
    },

    theme: () => effectiveTheme(),
    setTheme: async (theme) => {
      await setTheme(theme)
      applyTheme(theme)
    },
    board: () => ui.board,
    setBoard: (on) => {
      if (ui.board !== on) toggleBoard()
    },
    setNotify: async (enabled, at) => {
      await updateSettings(at === undefined ? { notifyEnabled: enabled } : { notifyEnabled: enabled, notifyAt: at })
    },

    boardColumns: () =>
      index.value.columns.map((c) => ({
        date: c.date,
        prios: bucketsOf(c.items).map((b) => b.prio),
        ids: c.items.map((t) => t.id)
      })),
    listRows: () =>
      sortedByIndex(index.value, ui.view).map((t) => ({ id: t.id, title: t.title, date: t.date })),
    buckets: (date) => {
      const col = index.value.columns.find((c) => c.date === date)
      if (!col) return []
      return bucketsOf(col.items).map((b) => ({ prio: b.prio, ids: b.items.map((t) => t.id) }))
    },

    select: (ids) => {
      clearSelection()
      for (const id of ids) selectedIds.add(id)
    },
    selection: () => [...selectedIds],
    dialog: () => ui.dialog,
    openNew: () => requestNew(),
    closeDialog,

    isDate,
    label,
    todos: () => state.store.todos
  }

  window.__todoTest = api
}
