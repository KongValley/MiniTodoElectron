<script setup lang="ts">
import { computed, watch } from 'vue'
import { addDays, today } from '@shared/dates'
import { completeTodo, moveCard, removeTodos, setStatus, updateTodo } from '@shared/store-ops'
import { ACTIVE, PRIO_COLOR, PRIO_NAME, type Prio } from '@shared/types'
import { mutate, state } from '../store/data'
import { askConfirm, closeCardMenu, requestEdit, toast, ui } from '../store/ui'
import Icon from './Icon.vue'

const m = computed(() => ui.cardMenu as { id: string; x: number; y: number })
const item = computed(() => state.store.todos.find((t) => t.id === m.value.id))

const px = (v: number): string => `${v}px`

interface Action {
  label: string
  icon: string
  danger?: boolean
  run: () => void
}

/** 索引处的插入位一律给桶尾(moveCard 内部越界钳到 [0, n]) */
const TAIL = Number.MAX_SAFE_INTEGER

function reschedule(date: string, label: string): void {
  const id = m.value.id
  void mutate((s) => moveCard(s, id, date, TAIL)).then(() => toast(`已改期：${label}`))
  closeCardMenu()
}

function setPrio(prio: Prio): void {
  const id = m.value.id
  void mutate((s) => updateTodo(s, id, { prio })).then(() => toast(`优先级：${PRIO_NAME[prio]}`))
  closeCardMenu()
}

function complete(): void {
  const id = m.value.id
  const done = item.value?.status === 1
  void mutate((s) => (done ? setStatus(s, id, ACTIVE) : completeTodo(s, id)))
  closeCardMenu()
}

function remove(): void {
  const id = m.value.id
  const purge = ui.view === 'trash'
  closeCardMenu()
  askConfirm(
    purge ? '彻底删除' : '移入回收站',
    purge ? '将彻底删除 1 条任务，无法恢复。' : '将 1 条任务移入回收站。',
    () => {
      void mutate((s) => removeTodos(s, [id], purge))
    }
  )
}

function edit(): void {
  requestEdit(m.value.id)
  closeCardMenu()
}

const actions = computed<Action[]>(() => {
  if (!item.value) return []
  const done = item.value.status === 1
  return [
    { label: '编辑', icon: 'edit', run: edit },
    { label: '改期到今天', icon: 'today', run: () => reschedule(today(), '今天') },
    { label: '改期到明天', icon: 'tmr', run: () => reschedule(addDays(today(), 1), '明天') },
    { label: '改期到后天', icon: 'calendar', run: () => reschedule(addDays(today(), 2), '后天') },
    { label: '不排期', icon: 'inbox', run: () => reschedule('', '未排期') },
    { label: done ? '取消完成' : '完成', icon: 'check', run: complete },
    { label: '删除', icon: 'trash', danger: true, run: remove }
  ]
})

// 卡片被键盘删掉后 ui.cardMenu 仍非 null,App 的 v-if 会一直挂着这个空壳菜单
watch(item, (v) => {
  if (!v) closeCardMenu()
})
</script>

<template>
  <Teleport to="body">
    <div
      class="backdrop"
      data-testid="card-menu-backdrop"
      @click="closeCardMenu"
      @contextmenu.prevent="closeCardMenu"
    >
      <div class="menu" data-testid="card-menu" :style="{ left: px(m.x), top: px(m.y) }" role="menu" @click.stop>
        <button
          v-for="(a, i) in actions"
          :key="i"
          class="mi"
          :class="{ danger: a.danger }"
          :data-menu="a.label"
          role="menuitem"
          @click="a.run"
        >
          <Icon :name="a.icon" :size="14" class="mi-ico" />
          <span>{{ a.label }}</span>
        </button>
        <div class="mi-row">
          <button
            v-for="p in [1, 2, 3] as const"
            :key="p"
            class="mi mini"
            :data-menu="PRIO_NAME[p]"
            role="menuitem"
            @click="setPrio(p)"
          >
            <Icon :name="p === 1 ? 'flagHigh' : p === 2 ? 'flagMid' : 'flagLow'" :size="13" :style="{ color: PRIO_COLOR[p] }" />
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
}

.menu {
  position: fixed;
  min-width: 172px;
  padding: 4px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 12px 40px rgb(0 0 0 / 25%);
}

.mi {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--text);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.mi:hover {
  background: var(--hover);
}

.mi-ico {
  flex: 0 0 14px;
  color: var(--text-dim);
}

.mi.danger {
  color: var(--danger);
}

.mi.danger .mi-ico {
  color: var(--danger);
}

.mi-row {
  display: flex;
  gap: 4px;
  padding: 4px 6px;
  border-top: 1px solid var(--line);
  margin-top: 4px;
}

.mini {
  flex: 1;
  padding: 4px 0;
  font-size: 12px;
  color: var(--text-dim);
  justify-content: center;
}
</style>
