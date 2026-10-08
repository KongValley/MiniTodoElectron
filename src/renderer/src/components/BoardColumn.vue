<script setup lang="ts">
import { computed, onMounted, onUpdated, ref, watch } from 'vue'
import { label } from '@shared/dates'
import { bucketsOf } from '@shared/query'
import type { BoardColumn as BoardColumnData } from '@shared/store-index'
import { INBOX_NAME, PRIO_NAME, type Prio, type TodoItem } from '@shared/types'
import TaskCard from './TaskCard.vue'
import Icon from './Icon.vue'
import { index } from '../store/index'
import { useVirtual } from '../lib/virtual'

const props = defineProps<{
  column: BoardColumnData
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

/** 桶只在列数据变化时重算,不再每次渲染跑一遍 */
const buckets = computed(() => bucketsOf(props.column.items))

const listName = (lid: string): string => index.value.listOf.get(lid)?.name ?? INBOX_NAME
const listColor = (lid: string): string => index.value.listOf.get(lid)?.color ?? '#9AA0A8'
/** 整列共享同一个日期,标签只算一次 */
const dateLabel = computed(() => label(props.column.date))

/* ---------- 卡片虚拟滚动 ---------- */
// 渲染序列:桶内卡片摊平(prio 高→低,桶内 order/seq),桶首项带上组标题
interface Row {
  item: TodoItem
  prio: Prio
  head: { prio: Prio; count: number } | null
}

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  for (const b of buckets.value) {
    b.items.forEach((item, i) => {
      out.push({ item, prio: b.prio, head: i === 0 ? { prio: b.prio, count: b.items.length } : null })
    })
  }
  return out
})

/** 估算:卡片本体约 78px(标题 1 行 + meta + 上下 padding),带组标题再加 30px */
const CARD_ESTIMATE = 78
const HEAD_ESTIMATE = 30
const estimateOf = (r: Row): number => CARD_ESTIMATE + (r.head ? HEAD_ESTIMATE : 0)

const localScrollTop = ref(props.scrollTop)
const viewportH = ref(400)
const virtual = useVirtual<Row>({
  items: () => rows.value,
  keyOf: (r) => r.item.id,
  scrollTop: localScrollTop,
  viewportH,
  estimateOf,
  overscan: 4
})

/** 同优先级卡片数(拖入空桶时 index = 0) */
function samePrioCount(): number {
  return props.column.items.filter((t) => t.prio === props.dragPrio).length
}

/**
 * 鼠标 Y 落在同优先级卡片中的插入位。
 * 虚拟滚动下未渲染的卡片没有 DOM,因此先定位鼠标落在哪张已渲染卡片上,
 * 再把「渲染序列下标」映射回「该优先级桶内下标」。
 */
function indexFromEvent(event: DragEvent): number {
  const host = scroller.value
  if (!host || props.dragPrio === 0) return samePrioCount()

  const rendered = [...host.querySelectorAll<HTMLElement>('[data-card]')]
  let hitRow = rows.value.length
  for (const el of rendered) {
    const rect = el.getBoundingClientRect()
    if (event.clientY < rect.top + rect.height / 2) {
      hitRow = Number(el.dataset['row'] ?? rows.value.length)
      break
    }
  }

  let bucketPos = 0
  for (let i = 0; i < hitRow && i < rows.value.length; i++) {
    if ((rows.value[i] as Row).prio === props.dragPrio) bucketPos++
  }
  return bucketPos
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
  if (!host) return
  localScrollTop.value = host.scrollTop
  emit('scroll', props.column.date, host.scrollTop)
}

/**
 * 一次性测量所有已渲染行的高度。
 * 逐个元素读 offsetHeight 会强制 72 次同步重排(实测单列 340 ms);
 * 这里在一个循环里读完再写回,浏览器只做一次布局。
 */
function measureAll(): void {
  const host = scroller.value
  if (!host) return
  const nodes = host.querySelectorAll<HTMLElement>('[data-vrow]')
  const batch: { key: string; h: number }[] = []
  for (const el of nodes) {
    const key = el.dataset['vrow']
    if (key) batch.push({ key, h: el.offsetHeight })
  }
  for (const b of batch) virtual.measure(b.key, b.h)
}

onMounted(() => {
  const host = scroller.value
  if (!host) return
  viewportH.value = host.clientHeight
  if (props.scrollTop > 0) {
    host.scrollTop = props.scrollTop
    localScrollTop.value = props.scrollTop
  }
  measureAll()
  new ResizeObserver(() => {
    viewportH.value = host.clientHeight
  }).observe(host)
})

// 每次重渲染后补测新出现的行(高度未知的行才需要,measure 内部会跳过未变化的)
onUpdated(() => measureAll())

watch(
  () => props.scrollTop,
  (top) => {
    const host = scroller.value
    if (host && Math.abs(host.scrollTop - top) > 1) {
      host.scrollTop = top
      localScrollTop.value = top
    }
  }
)
</script>

<template>
  <section class="column" :data-column="column.date" :class="{ dropping: dropIndex !== null }">
    <header class="head">
      <span class="date">{{ label(column.date) }}</span>
      <span class="count">{{ column.items.length }}</span>
      <button class="add" :data-add="column.date" title="在这一天新建任务" @click="emit('add', column.date)">
        <Icon name="plus" />
      </button>
    </header>

    <div
      ref="scroller"
      class="content thin-scroll"
      @scroll="onScroll"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
    >
      <div v-if="column.items.length === 0" class="empty-col">拖卡片到这里</div>

      <template v-else>
        <div :style="{ height: `${virtual.state.value.padTop}px` }" />
        <div
          v-for="v in virtual.state.value.visible"
          :key="v.item.item.id"
          :data-vrow="v.item.item.id"
          :data-row="v.index"
        >
          <div v-if="v.item.head" class="group-head" :data-prio-head="v.item.head.prio">
            <span>{{ PRIO_NAME[v.item.head.prio] }}优先级</span>
            <span class="gcount">{{ v.item.head.count }}</span>
          </div>
          <TaskCard
            :item="v.item.item"
            :list-name="listName(v.item.item.lid)"
            :list-color="listColor(v.item.item.lid)"
            :date-label="dateLabel"
          />
        </div>
        <div :style="{ height: `${virtual.state.value.padBottom}px` }" />
      </template>
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
  display: inline-flex;
  align-items: center;
  justify-content: center;
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
