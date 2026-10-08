/** 列表视图的多选状态(快捷键与组件共用) */
import { reactive } from 'vue'

export const selectedIds = reactive(new Set<string>())

export function clearSelection(): void {
  selectedIds.clear()
}

export function toggleSelection(id: string): void {
  if (selectedIds.has(id)) selectedIds.delete(id)
  else selectedIds.add(id)
}

export function setSelection(ids: string[]): void {
  selectedIds.clear()
  for (const id of ids) selectedIds.add(id)
}

export function selectAll(ids: string[]): void {
  setSelection(ids)
}

/**
 * 当前视图的可见行 id 源。由 ListView 注册/清空(它的行含分段头与排序,只有它知道)。
 * keymap 不 import 组件,故经此间接取;未注册时返回空数组(Ctrl+A 无效)。
 */
let rowSource: () => string[] = () => []

export function setRowSource(fn: () => string[]): void {
  rowSource = fn
}

export function currentRowIds(): string[] {
  return rowSource()
}
