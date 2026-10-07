<script setup lang="ts">
import { computed } from 'vue'
import { label } from '@shared/dates'
import { listById, listColor } from '@shared/query'
import { INBOX_NAME, PRIO_COLOR, PRIO_NAME, type TodoItem } from '@shared/types'
import { completeTodo } from '@shared/store-ops'
import { mutate, state } from '../store/data'
import { ui } from '../store/ui'

const props = defineProps<{ item: TodoItem }>()

const prioName = computed(() => PRIO_NAME[props.item.prio])
const prioColor = computed(() => PRIO_COLOR[props.item.prio])
const dateLabel = computed(() => label(props.item.date))
const listName = computed(() => listById(state.store, props.item.lid)?.name ?? INBOX_NAME)
const listDot = computed(() => listColor(state.store, props.item.lid))
const subDone = computed(() => props.item.subtasks.filter((s) => s.done).length)
const isDone = computed(() => props.item.status === 1)

function onComplete(event: MouseEvent): void {
  event.stopPropagation()
  if (isDone.value) return
  void mutate((s) => completeTodo(s, props.item.id))
}

function onOpen(): void {
  ui.dialog = { mode: 'edit', id: props.item.id }
}
</script>

<template>
  <article
    class="card"
    :class="{ done: isDone }"
    :data-card="item.id"
    :data-prio="item.prio"
    draggable="true"
    @click="onOpen"
  >
    <button class="circle" :class="{ checked: isDone }" :data-complete="item.id" @click="onComplete">
      <span v-if="isDone">✓</span>
    </button>

    <div class="body">
      <div class="title">{{ item.title }}</div>
      <div class="meta">
        <span class="date">{{ dateLabel }}</span>
        <span class="sep">·</span>
        <span class="list"><i class="dot" :style="{ background: listDot }" />{{ listName }}</span>
        <span v-if="item.subtasks.length > 0" class="subs" data-subs>{{ subDone }}/{{ item.subtasks.length }}</span>
        <span class="prio" :style="{ color: prioColor }">{{ prioName }}</span>
      </div>
      <div v-if="item.note" class="note">{{ item.note }}</div>
    </div>
  </article>
</template>

<style scoped>
.card {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  margin-bottom: 8px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 1px 2px var(--shadow);
  cursor: pointer;
}

.card:hover {
  border-color: var(--accent);
}

.card.done .title {
  text-decoration: line-through;
  color: var(--text-dim);
}

.circle {
  flex: 0 0 18px;
  width: 18px;
  height: 18px;
  margin-top: 1px;
  border-radius: 50%;
  border: 1.5px solid var(--thumb-hot);
  color: #fff;
  font-size: 12px;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.circle:hover {
  border-color: var(--accent);
}

.circle.checked {
  background: var(--accent);
  border-color: var(--accent);
}

.body {
  min-width: 0;
  flex: 1 1 auto;
}

.title {
  font-size: 13px;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-dim);
  flex-wrap: wrap;
}

.dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  margin-right: 4px;
}

.sep {
  color: var(--text-mute);
}

.subs {
  padding: 0 5px;
  border-radius: 8px;
  background: var(--sel);
  color: var(--text-dim);
  font-variant-numeric: tabular-nums;
}

.note {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-mute);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
