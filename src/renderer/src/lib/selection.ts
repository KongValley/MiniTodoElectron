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
