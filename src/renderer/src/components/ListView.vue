<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { label } from '@shared/dates'
import { listById, listColor, sorted } from '@shared/query'
import { INBOX_NAME, PRIO_NAME, STATUS_NAME, type TodoItem } from '@shared/types'
import { completeTodo } from '@shared/store-ops'
import { mutate, state } from '../store/data'
import { ui } from '../store/ui'
import { clearSelection, selectedIds, setSelection, toggleSelection } from '../lib/selection'
import { removeTodos } from '@shared/store-ops'

const rows = computed(() => sorted(state.store, ui.view, ui.search))
const lastClicked = ref<string | null>(null)

watch(
  () => ui.view,
  () => {
    clearSelection()
    lastClicked.value = null
  }
)

const allSelected = computed(() => rows.value.length > 0 && rows.value.every((r) => selectedIds.has(r.id)))

function nameOf(item: TodoItem): string {
  return listById(state.store, item.lid)?.name ?? INBOX_NAME
}

function colorOf(item: TodoItem): string {
  return listColor(state.store, item.lid)
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

onMounted(() => clearSelection())
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
      <span class="cell list">清单</span>
      <span class="cell prio">优先级</span>
      <span class="cell note">备注</span>
    </div>

    <div class="rows thin-scroll">
      <div
        v-for="item in rows"
        :key="item.id"
        class="row"
        :class="{ selected: selectedIds.has(item.id) }"
        :data-row="item.id"
        @click="onRowCheck($event, item)"
        @dblclick="onOpen(item)"
      >
        <span class="cell check" @click.stop="onRowCheck($event, item)">
          <input type="checkbox" :checked="selectedIds.has(item.id)" @click.stop="onRowCheck($event, item)" />
        </span>
        <span class="cell title">
          <button class="circle" :class="{ checked: item.status === 1 }" @click="onComplete($event, item)">
            <span v-if="item.status === 1">✓</span>
          </button>
          <span class="ttext">{{ item.title }}</span>
          <span v-if="item.subtasks.length > 0" class="subs">
            {{ item.subtasks.filter((s) => s.done).length }}/{{ item.subtasks.length }}
          </span>
        </span>
        <span class="cell date">{{ label(item.date) }}</span>
        <span class="cell list"><i class="dot" :style="{ background: colorOf(item) }" />{{ nameOf(item) }}</span>
        <span class="cell prio">{{ PRIO_NAME[item.prio] }}</span>
        <span class="cell note">{{ item.status !== 0 ? STATUS_NAME[item.status] : item.note }}</span>
      </div>

      <div v-if="rows.length === 0" class="empty">此视图暂无任务</div>
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
