<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { boardColumns } from '@shared/query'
import { moveCard } from '@shared/store-ops'
import { state, mutate } from '../store/data'
import { ui } from '../store/ui'
import BoardColumn from './BoardColumn.vue'

const columns = computed(() => boardColumns(state.store, ui.view, ui.search))
/** 每列竖向滚动位置,按日期留存(重排/切视图后不丢) */
const scrollByDate = reactive<Record<string, number>>({})
const dragId = ref('')
const dragPrio = ref(0)
const horizontal = ref<HTMLElement | null>(null)

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

/** Ctrl+滚轮 横向滚动(普通滚轮保持各列原生竖向滚动) */
function onWheel(event: WheelEvent): void {
  const host = horizontal.value
  if (!host || !event.ctrlKey) return
  event.preventDefault()
  host.scrollLeft += event.deltaY
}
</script>

<template>
  <div class="board" data-testid="board" @dragstart="onDragStart" @dragend="onDragEnd" @wheel="onWheel">
    <div v-if="columns.length === 0" class="empty">
      <p>此视图暂无排期任务</p>
      <button class="btn" data-testid="empty-new" @click="ui.dialog = { mode: 'new' }">新建任务</button>
    </div>

    <div v-else ref="horizontal" class="columns" data-testid="board-columns">
      <BoardColumn
        v-for="col in columns"
        :key="col.date"
        :column="col"
        :scroll-top="scrollByDate[col.date] ?? 0"
        :drag-prio="dragPrio"
        @scroll="onScroll"
        @drop="onDrop"
        @add="onAdd"
      />
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
