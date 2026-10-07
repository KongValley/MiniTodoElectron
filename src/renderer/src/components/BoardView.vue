<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { moveCard } from '@shared/store-ops'
import { state, mutate } from '../store/data'
import { index } from '../store/index'
import { ui } from '../store/ui'
import BoardColumn from './BoardColumn.vue'

const COL_W = 300

const columns = computed(() => index.value.columns)
/** 每列竖向滚动位置,按日期留存(重排/切视图后不丢) */
const scrollByDate = reactive<Record<string, number>>({})
const dragId = ref('')
const dragPrio = ref(0)
const horizontal = ref<HTMLElement | null>(null)
const hScrollLeft = ref(0)
const hViewportW = ref(1200)

/** 只渲染与可视区相交的列(±1 列缓冲),列数很多时收益明显 */
const visibleColumns = computed(() => {
  const all = columns.value
  if (all.length === 0) return { start: 0, items: [] as typeof all }
  const start = Math.max(0, Math.floor(hScrollLeft.value / COL_W) - 1)
  const end = Math.min(all.length, Math.ceil((hScrollLeft.value + hViewportW.value) / COL_W) + 1)
  return { start, items: all.slice(start, end) }
})

const padLeft = computed(() => visibleColumns.value.start * COL_W)
const padRight = computed(() => {
  const { start, items } = visibleColumns.value
  return Math.max(0, (columns.value.length - start - items.length) * COL_W)
})

onMounted(() => {
  const host = horizontal.value
  if (!host) return
  hViewportW.value = host.clientWidth
  new ResizeObserver(() => {
    hViewportW.value = host.clientWidth
  }).observe(host)
})

function onScroll(date: string, top: number): void {
  scrollByDate[date] = top
}

/**
 * 落点插入位由列组件按鼠标 Y 在「同优先级卡片」中算出,与 moveCard 的
 * (date, prio) 桶语义一致 —— 这里只需把 id 交给纯函数。
 */
function onDrop(date: string, index: number): void {
  const id = dragId.value
  dragId.value = ''
  dragPrio.value = 0
  if (!id) return
  void mutate((s) => moveCard(s, id, date, index))
}

function onAdd(date: string): void {
  ui.dialog = { mode: 'new', presetDate: date }
}

/** 记录被拖动的卡片 id 与优先级(dragstart 冒泡到看板根节点) */
function onDragStart(event: DragEvent): void {
  const card = (event.target as HTMLElement).closest('[data-card]') as HTMLElement | null
  if (!card) return
  dragId.value = card.dataset['card'] ?? ''
  dragPrio.value = Number(card.dataset['prio'] ?? 0)
  event.dataTransfer?.setData('text/plain', dragId.value)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragEnd(): void {
  dragId.value = ''
  dragPrio.value = 0
}

/** 横向滚动:同步 scrollLeft 供列懒渲染;Ctrl+滚轮 时把竖向滚轮转成横向 */
function onScrollH(): void {
  const host = horizontal.value
  if (host) hScrollLeft.value = host.scrollLeft
}

function onWheel(event: WheelEvent): void {
  const host = horizontal.value
  if (!host || !event.ctrlKey) return
  event.preventDefault()
  host.scrollLeft += event.deltaY
  hScrollLeft.value = host.scrollLeft
}
</script>

<template>
  <div class="board" data-testid="board" @dragstart="onDragStart" @dragend="onDragEnd" @wheel="onWheel">
    <div v-if="columns.length === 0" class="empty">
      <p>此视图暂无排期任务</p>
      <button class="btn" data-testid="empty-new" @click="ui.dialog = { mode: 'new' }">新建任务</button>
    </div>

    <div v-else ref="horizontal" class="columns" data-testid="board-columns" @scroll="onScrollH">
      <div :style="{ flex: `0 0 ${padLeft}px` }" />
      <BoardColumn
        v-for="col in visibleColumns.items"
        :key="col.date"
        :column="col"
        :scroll-top="scrollByDate[col.date] ?? 0"
        :drag-prio="dragPrio"
        @scroll="onScroll"
        @drop="onDrop"
        @add="onAdd"
      />
      <div :style="{ flex: `0 0 ${padRight}px` }" />
    </div>
  </div>
</template>

<style scoped>
.board {
  height: 100%;
  overflow: hidden;
}

.columns {
  display: flex;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
}

.empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-mute);
}

.btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: 1px solid var(--field-line);
  background: var(--card);
  color: var(--text);
}

.btn:hover {
  background: var(--hover);
}
</style>
