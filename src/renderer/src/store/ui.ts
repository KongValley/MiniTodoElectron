/** 界面状态(视图 / 搜索 / 弹窗 / 提示) */
import { reactive } from 'vue'
import { LIST_COLORS, type ViewKey } from '@shared/types'
import type { ListSort } from '@shared/query'

export interface TaskDialogState {
  mode: 'new' | 'edit'
  id?: string
  presetDate?: string
  presetList?: string
  /** 每次打开自增:TaskDialog 在 setup 里取一次性快照,改值不重挂载就按 N 没反应。
   *  组件用 :key="ui.dialog.seq" 强制重挂。 */
  seq: number
}

export interface ConfirmState {
  title: string
  detail: string
  onOk: () => void
  secondary?: { label: string; onOk: () => void }
}

/** 分组/清单的新建与重命名弹窗(TaskDialog 的同款快照语义,靠 seq 强制重挂) */
export interface MetaState {
  mode: 'new-group' | 'edit-group' | 'new-list' | 'edit-list'
  /** 编辑模式的目标 id */
  id?: string
  /** 新建清单时的默认所属分组 */
  gid?: string
  name: string
  color: string
  seq: number
}

export const ui = reactive({
  view: 'week7' as ViewKey,
  search: '',
  searchOpen: false,
  board: true,
  dialog: null as TaskDialogState | null,
  /** 分组/清单新建与重命名弹窗;null = 关闭 */
  meta: null as MetaState | null,
  settingsOpen: false,
  helpOpen: false,
  confirm: null as ConfirmState | null,
  toast: '',
  /** 侧栏分组展开状态(手动收起的分组不被切视图自动展开) */
  collapsed: {} as Record<string, boolean>,
  /** 任务卡右键菜单位置;null = 关闭 */
  cardMenu: null as { id: string; x: number; y: number } | null,
  /** 列表列排序;null = 默认顺序(日期→优先级→清单→seq) */
  listSort: null as ListSort | null
})

let toastTimer: number | undefined
let dialogSeq = 0
let metaSeq = 0

export function toast(message: string): void {
  ui.toast = message
  clearTimeout(toastTimer)
  toastTimer = window.setTimeout(() => {
    ui.toast = ''
  }, 4000)
}

export function requestNew(preset?: { date?: string; list?: string }): void {
  ui.dialog = { mode: 'new', presetDate: preset?.date, presetList: preset?.list, seq: ++dialogSeq }
}

export function requestEdit(id: string): void {
  ui.dialog = { mode: 'edit', id, seq: ++dialogSeq }
}

export function closeDialog(): void {
  ui.dialog = null
}

export function askConfirm(
  title: string,
  detail: string,
  onOk: () => void,
  secondary?: ConfirmState['secondary']
): void {
  ui.confirm = { title, detail, onOk, secondary }
}

export function openCardMenu(id: string, x: number, y: number): void {
  ui.cardMenu = { id, x, y }
}

export function closeCardMenu(): void {
  ui.cardMenu = null
}

/** 分组新建/重命名弹窗 */
export function requestNewGroup(): void {
  ui.meta = { mode: 'new-group', name: '', color: LIST_COLORS[0] as string, seq: ++metaSeq }
}

/** 分组重命名;名字由调用方从 store 取好传入(ui.ts 不读 store,避免与 data.ts 循环依赖) */
export function requestEditGroup(id: string, name: string): void {
  ui.meta = { mode: 'edit-group', id, name, color: LIST_COLORS[0] as string, seq: ++metaSeq }
}

/** 清单新建;gid 与 color 由调用方按当前视图与空闲色算好 */
export function requestNewList(gid: string, color: string): void {
  ui.meta = { mode: 'new-list', gid, name: '', color, seq: ++metaSeq }
}

export function requestEditList(id: string, name: string, gid: string, color: string): void {
  ui.meta = { mode: 'edit-list', id, gid, name, color, seq: ++metaSeq }
}

export function closeMeta(): void {
  ui.meta = null
}
