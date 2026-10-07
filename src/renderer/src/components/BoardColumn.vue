<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { label } from '@shared/dates'
import { bucketsOf, type BoardColumn } from '@shared/query'
import { PRIO_NAME } from '@shared/types'
import TaskCard from './TaskCard.vue'

const props = defineProps<{
  column: BoardColumn
  scrollTop: number
  /** 正在拖动的卡片优先级(0 = 无拖动);插入位只在同优先级桶内计算 */
  dragPrio: number
}>()

const emit = defineEmits<{
  (e: 'scroll', date: string, top: number): void
  (e: 'drop', date: string, index: number): void
  (e: 'add', date: string): void
}>()

const scroller = ref<HTMLElement | null>(null)
const dropIndex = ref<number | null>(null)

const buckets = (): ReturnType<typeof bucketsOf> => bucketsOf(props.column.items)

/** 同优先级卡片数(拖入空桶时 index = 0) */
function samePrioCount(): number {
  return props.column.items.filter((t) => t.prio === props.dragPrio).length
}

/** 鼠标 Y 落在同优先级卡片中的插入位 */
function indexFromEvent(event: DragEvent): number {
  const host = scroller.value
  if (!host || props.dragPrio === 0) return samePrioCount()
  const cards = [...host.querySelectorAll<HTMLElement>('[data-card]')].filter(
    (el) => Number(el.dataset['prio']) === props.dragPrio
  )
  for (let i = 0; i < cards.length; i++) {
    const rect = (cards[i] as HTMLElement).getBoundingClientRect()
    if (event.clientY < rect.top + rect.height / 2) return i
  }
  return cards.length
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
  dropIndex.value = indexFromEvent(event)
}

function onDragLeave(): void {
  dropIndex.value = null
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  const index = dropIndex.value ?? indexFromEvent(event)
  dropIndex.value = null
  emit('drop', props.column.date, index)
}

function onScroll(): void {
  const host = scroller.value
  if (host) emit('scroll', props.column.date, host.scrollTop)
}

onMounted(() => {
  const host = scroller.value
  if (host && props.scrollTop > 0) host.scrollTop = props.scrollTop
})

watch(
  () => props.scrollTop,
  (top) => {
    const host = scroller.value
    if (host && Math.abs(host.scrollTop - top) > 1) host.scrollTop = top
  }
)
</script>

<template>
  <section class="column" :data-column="column.date" :class="{ dropping: dropIndex !== null }">
    <header class="head">
      <span class="date">{{ label(column.date) }}</span>
      <span class="count">{{ column.items.length }}</span>
      <button class="add" :data-add="column.date" title="在这一天新建任务" @click="emit('add', column.date)">+</button>
    </header>

    <div
      ref="scroller"
      class="content thin-scroll"
      @scroll="onScroll"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <template v-for="bucket in buckets()" :key="bucket.prio">
        <div class="group-head" :data-prio-head="bucket.prio">
          <span>{{ PRIO_NAME[bucket.prio] }}优先级</span>
          <span class="gcount">{{ bucket.items.length }}</span>
        </div>
        <TaskCard v-for="item in bucket.items" :key="item.id" :item="item" />
      </template>

      <div v-if="column.items.length === 0" class="empty-col">拖卡片到这里</div>
    </div>
  </section>
</template>

<style scoped>
.column {
  flex: 0 0 300px;
  width: 300px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--line);
  background: var(--bg);
}

.column.dropping {
  background: var(--accent-soft);
}

.head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
  flex: 0 0 auto;
}

.date {
  font-weight: 600;
}

.count {
  color: var(--text-mute);
  font-variant-numeric: tabular-nums;
}

.add {
  margin-left: auto;
  width: 22px;
  height: 22px;
  border-radius: 6px;
  color: var(--text-dim);
  font-size: 15px;
  line-height: 1;
}

.add:hover {
  background: var(--hover);
  color: var(--accent);
}

.content {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 10px;
  min-height: 0;
}

.group-head {
  display: flex;
  justify-content: space-between;
  margin: 6px 2px 8px;
  font-size: 12px;
  color: var(--text-dim);
}

.gcount {
  color: var(--text-mute);
}

.empty-col {
  margin-top: 24px;
  text-align: center;
  color: var(--text-mute);
  font-size: 12px;
}
</style>
