<script setup lang="ts">
import { computed, ref } from 'vue'

import { completeTodo, toggleSubtask } from '@shared/store-ops'
import { PRIO_COLOR, PRIO_NAME, type TodoItem } from '@shared/types'
import { mutate } from '../store/data'
import { openCardMenu, requestEdit, ui } from '../store/ui'
import { segments } from '../lib/search'
import Icon from './Icon.vue'

const props = defineProps<{
  item: TodoItem
  /** 清单名与色由父组件从索引取好传入,避免每条卡片各自扫 store */
  listName: string
  listColor: string
  /** 日期标签:同列卡片日期相同,由父组件算一次传入(label() 含日期解析,逐卡重算很贵) */
  dateLabel: string
}>()

const prioName = computed(() => PRIO_NAME[props.item.prio])
const prioColor = computed(() => PRIO_COLOR[props.item.prio])
const subDone = computed(() => props.item.subtasks.filter((s) => s.done).length)
const isDone = computed(() => props.item.status === 1)
const hl = computed(() => segments(props.item.title, ui.search))
const subPct = computed(() => (props.item.subtasks.length ? (subDone.value / props.item.subtasks.length) * 100 : 100))
const flagName = computed(() => (props.item.prio === 1 ? 'flagHigh' : props.item.prio === 2 ? 'flagMid' : 'flagLow'))

/** ponytail: 展开态只存在组件内;虚拟滚动会卸载屏幕外卡片,滚走即收起,可接受 */
const expanded = ref(false)

function onComplete(event: MouseEvent): void {
  event.stopPropagation()
  if (isDone.value) return
  void mutate((s) => completeTodo(s, props.item.id))
}

function onOpen(): void {
  requestEdit(props.item.id)
}

function onCtx(event: MouseEvent): void {
  event.stopPropagation()
  // 钳制坐标,避免菜单在右/下边缘被裁掉(菜单约 176px 宽、最长约 300px 高)
  openCardMenu(
    props.item.id,
    Math.min(event.clientX, window.innerWidth - 184),
    Math.min(event.clientY, window.innerHeight - 312)
  )
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
    @contextmenu.prevent="onCtx"
  >
    <button class="circle" :class="{ checked: isDone }" :data-complete="item.id" @click="onComplete">
      <Icon v-if="isDone" name="check" :size="12" />
    </button>

    <button
      v-if="item.note || item.subtasks.length > 0"
      class="expand"
      :data-expand="item.id"
      :title="expanded ? '收起详情' : '展开详情'"
      @click.stop="expanded = !expanded"
    >
      <Icon :name="expanded ? 'collapse' : 'expand'" :size="11" />
    </button>

    <div class="body">
      <div class="title">
        <span v-for="(s, i) in hl" :key="i" :class="{ hl: s.hit }">{{ s.t }}</span>
      </div>
      <div class="meta">
        <span class="date">{{ dateLabel }}</span>
        <span class="sep">·</span>
        <span class="list"><i class="dot" :style="{ background: listColor }" />{{ listName }}</span>
        <span v-if="item.subtasks.length > 0" class="subs" data-subs>{{ subDone }}/{{ item.subtasks.length }}</span>
        <span class="prio" :style="{ color: prioColor }">
          <Icon :name="flagName" :size="12" />{{ prioName }}
        </span>
      </div>
      <div v-if="item.note && !expanded" class="note">{{ item.note }}</div>

      <template v-if="expanded">
        <div v-if="item.note" class="note full" data-note-full>{{ item.note }}</div>
        <div v-if="item.subtasks.length > 0" class="bar" :data-bar="item.id"><i :style="{ width: subPct + '%' }" /></div>
        <button
          v-for="s in item.subtasks"
          :key="s.id"
          class="sub"
          :data-sub="s.id"
          @click.stop="void mutate((x) => toggleSubtask(x, item.id, s.id))"
        >
          <span class="box" :class="{ on: s.done }"><Icon v-if="s.done" name="check" :size="10" /></span>
          <span class="st" :class="{ done: s.done }">{{ s.title }}</span>
        </button>
      </template>
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
  /* 展开钮绝对定位的参照 */
  position: relative;
}

.card:hover {
  border-color: var(--accent);
}

.card.done .title {
  text-decoration: line-through;
  color: var(--text-dim);
}

.expand {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--text-mute);
  font-size: 11px;
  line-height: 22px;
  cursor: pointer;
}

.expand:hover {
  background: var(--hover);
  color: var(--text);
}

.hl {
  background: var(--sel);
  border-radius: 2px;
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

.prio {
  display: inline-flex;
  align-items: center;
  gap: 3px;
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

.note.full {
  white-space: pre-wrap;
}

.bar {
  height: 4px;
  margin: 8px 0 6px;
  border-radius: 2px;
  background: var(--track);
  overflow: hidden;
}

.bar > i {
  display: block;
  height: 100%;
  background: var(--accent);
}

.sub {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  width: 100%;
  padding: 3px 0;
  border: 0;
  background: none;
  color: var(--text-dim);
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}

.box {
  flex: 0 0 14px;
  width: 14px;
  height: 14px;
  margin-top: 1px;
  border: 1px solid var(--thumb-hot);
  border-radius: 3px;
  font-size: 10px;
  line-height: 12px;
  text-align: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.box.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.st {
  min-width: 0;
  word-break: break-word;
}

.st.done {
  text-decoration: line-through;
  color: var(--text-mute);
}
</style>
