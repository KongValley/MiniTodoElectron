<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { addDays, label, today } from '@shared/dates'
import { sortedByIndex, type ListSort, type ListSortKey } from '@shared/query'
import { INBOX_NAME, PRIO_COLOR, PRIO_NAME, STATUS_NAME, type TodoItem } from '@shared/types'
import { completeTodo, removeTodos } from '@shared/store-ops'
import { importFromDialog, mutate } from '../store/data'
import { index } from '../store/index'
import { askConfirm, openCardMenu, ui } from '../store/ui'
import { clearSelection, selectedIds, setRowSource, setSelection, toggleSelection } from '../lib/selection'
import { segments } from '../lib/search'
import { useVirtual } from '../lib/virtual'
import Icon from './Icon.vue'

/** 行高固定 32px(见样式 .row),虚拟滚动据此窗口化;分段头同高 */
const ROW_H = 32

/** 优先级 → 旗标图标名 */
const prioIcon = (p: number): string => (p === 1 ? 'flagHigh' : p === 2 ? 'flagMid' : 'flagLow')

/** 列表行 = 分段头(仅 week7)或任务;虚拟滚动与 Ctrl+A 都基于这个序列 */
type Row = { kind: 'head'; label: string; count: number } | { kind: 'item'; item: TodoItem }

const lastClicked = ref<string | null>(null)

const rows = computed<Row[]>(() => {
  const items = sortedByIndex(index.value, ui.view, ui.listSort)
  // week7 的索引口径是 [今天, 今天+6](不含逾期),因此只分 今天/明天/本周稍后 三段
  if (ui.view !== 'week7') return items.map((item) => ({ kind: 'item', item }) as Row)
  const t0 = today()
  const t1 = addDays(t0, 1)
  const buckets: [string, TodoItem[]][] = [
    ['今天', []],
    ['明天', []],
    ['本周稍后', []]
  ]
  for (const it of items) {
    if (it.date === t0) buckets[0]?.[1].push(it)
    else if (it.date === t1) buckets[1]?.[1].push(it)
    else buckets[2]?.[1].push(it)
  }
  const out: Row[] = []
  for (const [label, arr] of buckets) {
    if (arr.length === 0) continue
    out.push({ kind: 'head', label, count: arr.length })
    for (const item of arr) out.push({ kind: 'item', item })
  }
  return out
})

/** 只含任务的子序列:计数 / 全选 / Shift 连选都基于它,避开分段头 */
const itemRows = computed(() => rows.value.filter((r): r is { kind: 'item'; item: TodoItem } => r.kind === 'item'))

const keyOf = (r: Row): string => (r.kind === 'item' ? r.item.id : `head:${r.label}`)

const scroller = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportH = ref(400)
const virtual = useVirtual<Row>({
  items: () => rows.value,
  keyOf,
  scrollTop,
  viewportH,
  estimateOf: () => ROW_H,
  overscan: 8
})

/** 列排序点击:空 → 升 → 降 → 空(回到默认顺序) */
function cycleSort(key: ListSortKey): void {
  const cur = ui.listSort
  if (!cur || cur.key !== key) ui.listSort = { key, desc: false }
  else if (!cur.desc) ui.listSort = { key, desc: true }
  else ui.listSort = null
}

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
  // Ctrl+A 的行源随挂载注册/卸载清空,否则看板下会选到残留行
  setRowSource(() => itemRows.value.map((r) => r.item.id))
})

onBeforeUnmount(() => setRowSource(() => []))

function onScroll(): void {
  const host = scroller.value
  if (host) scrollTop.value = host.scrollTop
}

const allSelected = computed(
  () => itemRows.value.length > 0 && itemRows.value.every((r) => selectedIds.has(r.item.id))
)

function nameOf(item: TodoItem): string {
  return index.value.listOf.get(item.lid)?.name ?? INBOX_NAME
}

function colorOf(item: TodoItem): string {
  return index.value.listOf.get(item.lid)?.color ?? '#9AA0A8'
}

function toggleAll(): void {
  if (allSelected.value) clearSelection()
  else setSelection(itemRows.value.map((r) => r.item.id))
}

function onRowCheck(event: MouseEvent, item: TodoItem): void {
  const id = item.id
  const ids = itemRows.value.map((r) => r.item.id)
  if (event.shiftKey && lastClicked.value) {
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

function onRowCtx(event: MouseEvent, item: TodoItem): void {
  event.stopPropagation()
  event.preventDefault()
  openCardMenu(
    item.id,
    Math.min(event.clientX, window.innerWidth - 184),
    Math.min(event.clientY, window.innerHeight - 312)
  )
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
  askConfirm(
    purge ? '彻底删除' : '移入回收站',
    purge ? `将彻底删除 ${ids.length} 条任务，无法恢复。` : `将 ${ids.length} 条任务移入回收站。`,
    () => {
      void mutate((s) => removeTodos(s, ids, purge)).then(() => clearSelection())
    }
  )
}

function onOpen(item: TodoItem): void {
  ui.dialog = { mode: 'edit', id: item.id }
}
</script>

<template>
  <div class="list" data-testid="list" @click.self="clearSelection">
    <div class="toolbar">
      <span class="count">共 {{ itemRows.length }} 条</span>
      <span v-if="selectedIds.size > 0" class="sel">已选 {{ selectedIds.size }} 条</span>
      <span class="spacer" />
      <button class="btn danger" data-testid="delete-selected" :disabled="selectedIds.size === 0" @click="onDeleteSelected">
        {{ ui.view === 'trash' ? '彻底删除' : '删除' }}
      </button>
    </div>

    <div class="head">
      <label class="cell check"><input type="checkbox" :checked="allSelected" @change="toggleAll" /></label>
      <span class="cell title">任务</span>
      <button class="cell hbtn date" data-sort="date" @click="cycleSort('date')">
        日期<Icon v-if="ui.listSort?.key === 'date'" :name="ui.listSort.desc ? 'collapse' : 'expand'" :size="10" />
      </button>
      <button class="cell hbtn lname" data-sort="list" @click="cycleSort('list')">
        清单<Icon v-if="ui.listSort?.key === 'list'" :name="ui.listSort.desc ? 'collapse' : 'expand'" :size="10" />
      </button>
      <button class="cell hbtn prio" data-sort="prio" @click="cycleSort('prio')">
        优先级<Icon v-if="ui.listSort?.key === 'prio'" :name="ui.listSort.desc ? 'collapse' : 'expand'" :size="10" />
      </button>
      <span class="cell note">备注</span>
    </div>

    <div ref="scroller" class="rows thin-scroll" @scroll="onScroll">
      <div v-if="itemRows.length === 0" class="empty">
        <p>{{ ui.search ? `没有匹配「${ui.search}」的任务` : '此视图暂无任务' }}</p>
        <div class="empty-actions">
          <button class="btn" data-testid="list-empty-new" @click="ui.dialog = { mode: 'new' }">新建任务</button>
          <button class="btn" data-testid="list-empty-import" @click="void importFromDialog()">导入旧版数据</button>
          <button class="btn" data-testid="list-empty-help" @click="ui.helpOpen = true">查看快捷键</button>
        </div>
      </div>

      <template v-else>
        <div :style="{ height: `${virtual.state.value.padTop}px` }" />
        <div v-for="v in virtual.state.value.visible" :key="v.item.kind === 'head' ? `head:${v.item.label}` : v.item.item.id">
          <div v-if="v.item.kind === 'head'" class="sec" :data-sec="v.item.label">{{ v.item.label }} · {{ v.item.count }}</div>
          <div
            v-else
            class="row"
            :class="{ selected: selectedIds.has(v.item.item.id) }"
            :data-row="v.item.item.id"
            @click="onRowCheck($event, v.item.item)"
            @dblclick="onOpen(v.item.item)"
            @contextmenu.prevent="onRowCtx($event, v.item.item)"
          >
            <span class="cell check" @click.stop="onRowCheck($event, v.item.item)">
              <input type="checkbox" :checked="selectedIds.has(v.item.item.id)" @click.stop="onRowCheck($event, v.item.item)" />
            </span>
            <span class="cell title">
              <button class="circle" :class="{ checked: v.item.item.status === 1 }" @click="onComplete($event, v.item.item)">
                <Icon v-if="v.item.item.status === 1" name="check" :size="10" />
              </button>
              <span class="ttext">
                <span v-for="(s, i) in segments(v.item.item.title, ui.search)" :key="i" :class="{ hl: s.hit }">{{ s.t }}</span>
              </span>
              <span v-if="v.item.item.subtasks.length > 0" class="subs">
                {{ v.item.item.subtasks.filter((s) => s.done).length }}/{{ v.item.item.subtasks.length }}
              </span>
            </span>
            <span class="cell date">{{ label(v.item.item.date) }}</span>
            <span class="cell lname"><i class="dot" :style="{ background: colorOf(v.item.item) }" />{{ nameOf(v.item.item) }}</span>
            <span class="cell prio">
              <i class="pi" :style="{ color: PRIO_COLOR[v.item.item.prio] }"><Icon :name="prioIcon(v.item.item.prio)" :size="12" /></i>{{ PRIO_NAME[v.item.item.prio] }}
            </span>
            <span class="cell note">{{ v.item.item.status !== 0 ? STATUS_NAME[v.item.item.status] : v.item.item.note }}</span>
          </div>
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

.hbtn {
  background: none;
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  padding: 0;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.hbtn:hover {
  color: var(--text);
}

.hbtn :deep(svg) {
  flex: 0 0 auto;
  color: var(--accent);
}

.empty {
  padding: 40px 0;
  text-align: center;
  color: var(--text-mute);
}

.empty-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
  margin-top: 10px;
}

.hl {
  background: var(--sel);
  border-radius: 2px;
}

.sec {
  display: flex;
  align-items: center;
  height: 32px;
  padding: 6px 14px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 600;
  line-height: 20px;
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

.prio {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pi {
  display: inline-flex;
  flex: 0 0 12px;
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
</style>
