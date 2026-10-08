/**
 * 主进程 / 预加载 / 渲染进程共享的类型与常量定义。
 * 与旧版 C# 应用(MiniTodo)的数据模型一一对应,并叠加 v2 增强字段。
 */

/** 任务状态(与旧版 P.Active/Done/Dropped/Trash 一致) */
export const ACTIVE = 0
export const DONE = 1
export const DROPPED = 2
export const TRASH = 3

export type Status = 0 | 1 | 2 | 3

/** 优先级:1 高 2 中 3 低(与旧版 TodoItem.prio 一致) */
export type Prio = 1 | 2 | 3

export type RepeatKind = 'none' | 'daily' | 'weekly' | 'monthly' | 'weekday'

export interface Subtask {
  id: string
  title: string
  done: boolean
}

export interface RepeatRule {
  kind: RepeatKind
  /**
   * monthly 专用:用户当初选的日号(1-31)。没有它 1-31 → 2-28 → 3-28 会永远停在 28,
   * 记住它才能回到 3-31。其他 kind 不需要。
   */
  anchorDay?: number
}

export interface TodoGroup {
  id: string
  name: string
  order: number
}

export interface TodoList {
  id: string
  gid: string
  name: string
  /** #rrggbb */
  color: string
  order: number
}

export interface TodoItem {
  id: string
  /** 所属清单 id;'' = 收集箱 */
  lid: string
  title: string
  note: string
  /** 'yyyy-MM-dd';'' = 未排期 */
  date: string
  prio: Prio
  status: Status
  /** 创建顺序,稳定排序用(与旧版 seq 一致) */
  seq: number
  /** 同 (date, prio) 桶内的手动排序位;默认 0 = 未手动排过,靠 seq 决定 */
  order: number
  subtasks: Subtask[]
  repeat: RepeatRule
  createdAt: number
  doneAt: number | null
}

export interface Store {
  version: 2
  groups: TodoGroup[]
  lists: TodoList[]
  todos: TodoItem[]
}

/** 8 个内置视图 */
export const VIEWS = ['all', 'today', 'tmr', 'week7', 'inbox', 'done', 'dropped', 'trash'] as const
export type BuiltinView = (typeof VIEWS)[number]
export type ViewKey = BuiltinView | `list:${string}` | `group:${string}`

export const PRIO_NAME = ['', '高', '中', '低'] as const
export const PRIO_COLOR = ['', '#D34A3E', '#DD9E28', '#3C9954'] as const
export const STATUS_NAME: Record<Status, string> = {
  0: '待办',
  1: '已完成',
  2: '已放弃',
  3: '回收站'
}

export const VIEW_NAME: Record<string, string> = {
  all: '所有',
  today: '今天',
  tmr: '明天',
  week7: '最近7天',
  // 该视图筛的是 date === ''(未排期),不是「没有清单的任务」—— 那是 INBOX_NAME 的口径
  inbox: '未排期',
  done: '已完成',
  dropped: '已放弃',
  trash: '回收站'
}

export const REPEAT_NAME: Record<RepeatKind, string> = {
  none: '不重复',
  daily: '每天',
  weekly: '每周',
  monthly: '每月',
  weekday: '工作日'
}

export const INBOX_NAME = '收集箱'
export const INBOX_COLOR = '#9AA0A8'

/** 可选清单配色;新建清单时取同组尚未占用的第一个 */
export const LIST_COLORS = ['#3A7AFE', '#7C5CFF', '#F2A33C', '#3C9954', '#12A5B8', '#E8705F', '#8A8F98'] as const
