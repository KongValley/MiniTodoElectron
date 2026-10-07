<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { label } from '@shared/dates'
import { sortedByIndex } from '@shared/query'
import { INBOX_NAME, PRIO_NAME, STATUS_NAME, type TodoItem } from '@shared/types'
import { completeTodo, removeTodos } from '@shared/store-ops'
import { mutate, state } from '../store/data'
import { index } from '../store/index'
import { ui } from '../store/ui'
import { clearSelection, selectedIds, setSelection, toggleSelection } from '../lib/selection'
import { useVirtual } from '../lib/virtual'

/** 行高固定 32px(见样式 .row),虚拟滚动据此窗口化 */
const ROW_H = 32

const rows = computed(() => sortedByIndex(index.value, ui.view))
const lastClicked = ref<string | null>(null)

const scroller = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportH = ref(400)
const virtual = useVirtual<TodoItem>({
  items: () => rows.value,
  keyOf: (t) => t.id,
  scrollTop,
  viewportH,
  estimateOf: () => ROW_H,
  overscan: 8
})

watch(
  () => [ui.view, ui.search],
  () => {
    clearSelection()
    lastClicked.value = null
    scrollTop.value = 0
    const host = scroller.value
    if (host) host.scrollTop = 0
  }
)

onMounted(() => {
  const host = scroller.value
  if (host) viewportH.value = host.clientHeight
  clearSelection()
  new ResizeObserver(() => {
    if (scroller.value) viewportH.value = scroller.value.clientHeight
  }).observe(scroller.value as Element)
})

function onScroll(): void {
  const host = scroller.value
  if (host) scrollTop.value = host.scrollTop
}

const allSelected = computed(() => rows.value.length > 0 && rows.value.every((r) => selectedIds.has(r.id)))

function nameOf(item: TodoItem): string {
  return index.value.listOf.get(item.lid)?.name ?? INBOX_NAME
}

function colorOf(item: TodoItem): string {
  return index.value.listOf.get(item.lid)?.color ?? '#9AA0A8'
}

function toggleAll(): void {
  if (allSelected.value) clearSelection()
  else setSelection(rows.value.map((r) => r.id))
}

function onRowCheck(event: MouseEvent, item: TodoItem): void {
  const id = item.id
  if (event.shiftKey && lastClicked.value) {
    const ids = rows.value.map((r) => r.id)
    const from = ids.indexOf(lastClicked.value)
    const to = ids.indexOf(id)
    if (from >= 0 && to >= 0) {
      const [lo, hi] = from < to ? [from, to] : [to, from]
      setSelection(ids.slice(lo, hi + 1))
      return
    }
  }
  if (event.ctrlKey || event.metaKey) toggleSelection(id)
  else setSelection([id])
  lastClicked.value = id
}

function onComplete(event: MouseEvent, item: TodoItem): void {
  event.stopPropagation()
  if (item.status === 1) return
  void mutate((s) => completeTodo(s, item.id))
}

function onDeleteSelected(): void {
  if (selectedIds.size === 0) return
  const ids = [...selectedIds]
  const purge = ui.view === 'trash'
  void mutate((s) => removeTodos(s, ids, purge)).then(() => clearSelection())
}

function onOpen(item: TodoItem): void {
  ui.dialog = { mode: 'edit', id: item.id }
}
</script>

<template>
  <div class="list" data-testid="list" @click.self="clearSelection">
    <div class="toolbar">
      <span class="count">共 {{ rows.length }} 条</span>
      <span v-if="selectedIds.size > 0" class="sel">已选 {{ selectedIds.size }} 条</span>
      <span class="spacer" />
      <button
        class="btn danger"
        data-testid="delete-selected"
        :disabled="selectedIds.size === 0"
        @click="onDeleteSelected"
      >
        {{ ui.view === 'trash' ? '彻底删除' : '删除' }}
      </button>
    </div>

    <div class="head">
      <label class="cell check"><input type="checkbox" :checked="allSelected" @change="toggleAll" /></label>
      <span class="cell title">任务</span>
      <span class="cell date">日期</span>
      <span class="cell lname">清单</span>
      <span class="cell prio">优先级</span>
      <span class="cell note">备注</span>
    </div>

    <div ref="scroller" class="rows thin-scroll" @scroll="onScroll">
      <div v-if="rows.length === 0" class="empty">此视图暂无任务</div>

      <template v-else>
        <div :style="{ height: `${virtual.state.value.padTop}px` }" />
        <div
          v-for="v in virtual.state.value.visible"
          :key="v.item.id"
          class="row"
          :class="{ selected: selectedIds.has(v.item.id) }"
          :data-row="v.item.id"
          @click="onRowCheck($event, v.item)"
          @dblclick="onOpen(v.item)"
        >
          <span class="cell check" @click.stop="onRowCheck($event, v.item)">
            <input type="checkbox" :checked="selectedIds.has(v.item.id)" @click.stop="onRowCheck($event, v.item)" />
          </span>
          <span class="cell title">
            <button class="circle" :class="{ checked: v.item.status === 1 }" @click="onComplete($event, v.item)">
              <span v-if="v.item.status === 1">✓</span>
            </button>
            <span class="ttext">{{ v.item.title }}</span>
            <span v-if="v.item.subtasks.length > 0" class="subs">
              {{ v.item.subtasks.filter((s) => s.done).length }}/{{ v.item.subtasks.length }}
            </span>
          </span>
          <span class="cell date">{{ label(v.item.date) }}</span>
          <span class="cell lname"><i class="dot" :style="{ background: colorOf(v.item) }" />{{ nameOf(v.item) }}</span>
          <span class="cell prio">{{ PRIO_NAME[v.item.prio] }}</span>
          <span class="cell note">{{ v.item.status !== 0 ? STATUS_NAME[v.item.status] : v.item.note }}</span>
        </div>
        <div :style="{ height: `${virtual.state.value.padBottom}px` }" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.list {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--line);
  color: var(--text-dim);
  font-size: 12px;
}

.spacer {
  flex: 1 1 auto;
}

.sel {
  color: var(--accent);
}

.btn {
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid var(--field-line);
  background: var(--card);
}

.btn:hover:not(:disabled) {
  background: var(--hover);
}

.btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.btn.danger:hover:not(:disabled) {
  border-color: var(--danger);
  color: var(--danger);
}

.head,
.row {
  display: grid;
  grid-template-columns: 34px minmax(220px, 2fr) 120px 120px 70px minmax(120px, 1fr);
  align-items: center;
  gap: 8px;
  padding: 0 14px;
}

.head {
  height: 30px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
  color: var(--text-dim);
  font-size: 12px;
}

.rows {
  flex: 1 1 auto;
  overflow-y: auto;
  min-height: 0;
}

.row {
  height: 32px;
  border-bottom: 1px solid var(--line);
  cursor: default;
}

.row:hover {
  background: var(--hover);
}

.row.selected {
  background: var(--sel);
}

.cell {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 清单单元格:圆点 + 名称横向排列(类名不能叫 .list —— 与根容器 .list 冲突,
   会把 flex-direction 变成 column、高度撑满整行) */
.lname {
  display: flex;
  align-items: center;
}

.ttext {
  overflow: hidden;
  text-overflow: ellipsis;
}

.circle {
  flex: 0 0 16px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1.5px solid var(--thumb-hot);
  color: #fff;
  font-size: 11px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.circle.checked {
  background: var(--accent);
  border-color: var(--accent);
}

.subs {
  padding: 0 5px;
  border-radius: 8px;
  background: var(--sel);
  color: var(--text-dim);
  font-size: 11px;
}

.dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 5px;
}

.empty {
  padding: 40px;
  text-align: center;
  color: var(--text-mute);
}
</style>
