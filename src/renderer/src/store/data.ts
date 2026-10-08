/**
 * 唯一数据源。state.store 只在 commit 里整体替换,组件不直接改字段(不可变)。
 *
 * store 用 markRaw 包住:整棵任务树的字段级追踪从未被依赖(改动一律整体替换),
 * 而深代理会让每次字段读取都过 Proxy —— 5000 条实测 22 次视图计数从 1.4 ms 涨到 113 ms。
 * 派生数据统一由 store/index.ts 的 index computed 提供。
 */
import { markRaw, reactive } from 'vue'
import { emptyStore, mergeStore } from '@shared/store-ops'
import type { Store } from '@shared/types'
import { CH } from '@shared/api'
import { refreshSettings, type Settings } from './settings'
import { askConfirm, toast } from './ui'

export const state = reactive({
  store: markRaw(emptyStore()) as Store,
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

/**
 * 唯一的 store 写入点。必须 markRaw:store-ops 的纯函数每次返回**新的普通对象**,
 * 直接塞进 reactive 会被重新深代理(既丢掉读取性能,也让返回值无法结构化克隆)。
 */
function setStore(next: Store): void {
  state.store = markRaw(next)
}

export async function commit(next: Store): Promise<void> {
  // 不再 normalizeStore:store-ops 的纯函数已保证结果合法,主进程侧会再校验一次。
  // 这里重建整棵树会让所有卡片 props 变化而全量重渲染,未改动卡片也保不住引用。
  setStore(next)
  // 以「已序列化的字符串」过 IPC:5000 条时传对象要 85ms(结构化克隆 7.5 万个对象),
  // 传字符串只要 7ms。JSON.stringify 本身 <1ms,净省 ~75ms。
  pending = window.todoAPI.invoke(CH.storeSave, JSON.stringify(next))
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
  setStore(res.store)
  state.path = res.path ?? ''
  state.warning = res.warning ?? ''
}

export async function init(): Promise<void> {
  await reload()
  state.settings = await refreshSettings()
  state.ready = true
}

/** 导入:选文件 → 备份 → 弹「替换 / 合并」,由用户决定后落盘 */
export async function importFromDialog(
  preset?: string
): Promise<{ ok: boolean; canceled?: boolean; pending?: boolean; error?: string }> {
  const res = (await window.todoAPI.invoke(CH.storeImport, preset)) as {
    ok: boolean
    canceled?: boolean
    store?: Store
    counts?: { groups: number; lists: number; todos: number }
    error?: string
  }
  if (!res.ok) return { ok: false, error: res.error }
  if (res.canceled || !res.store) return { ok: true, canceled: true }
  const incoming = res.store
  const c = res.counts ?? {
    groups: incoming.groups.length,
    lists: incoming.lists.length,
    todos: incoming.todos.length
  }
  askConfirm(
    '导入数据',
    `文件包含 ${c.groups} 个分组 / ${c.lists} 个清单 / ${c.todos} 条任务。\n「替换」会丢弃当前全部数据（导入前已自动备份）；「合并」保留现有任务，同 id 的条目跳过。`,
    () => {
      void commit(incoming).then(() => toast(`已替换：${c.groups} 分组 / ${c.lists} 清单 / ${c.todos} 任务`))
    },
    {
      label: '合并进当前数据',
      onOk: () => {
        const { store, skipped } = mergeStore(state.store, incoming)
        const s = skipped.groups + skipped.lists + skipped.todos
        void commit(store).then(() => toast(s > 0 ? `已合并，跳过 ${s} 条重复` : '已合并'))
      }
    }
  )
  return { ok: true, pending: true }
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
