<script setup lang="ts">
import { computed } from 'vue'
import { VIEWS, VIEW_NAME, type ViewKey } from '@shared/types'
import { state } from '../store/data'
import { index } from '../store/index'
import { setView } from '../lib/keymap'
import { ui } from '../store/ui'

const VIEW_ICON: Record<string, string> = {
  all: '☰',
  today: '☑',
  tmr: '☀',
  week7: '▤',
  inbox: '✉',
  done: '✓',
  dropped: '✕',
  trash: '🗑'
}

const primaryViews = VIEWS.slice(0, 5)
const statusViews = VIEWS.slice(5)

/** 计数全部来自单次扫描的索引,不再逐行全量扫描 */
function countOf(view: ViewKey): number {
  return index.value.counts[view] ?? 0
}

function groupCount(gid: string): number {
  return index.value.counts[`group:${gid}`] ?? 0
}

function isActive(view: ViewKey): boolean {
  return ui.view === view
}

function toggleGroup(gid: string): void {
  ui.collapsed[gid] = !ui.collapsed[gid]
}

const listsByGroup = computed(() =>
  state.store.groups
    .map((g) => ({
      group: g,
      lists: state.store.lists.filter((l) => l.gid === g.id).sort((a, b) => a.order - b.order)
    }))
)
</script>

<template>
  <aside class="sidebar" data-testid="sidebar">
    <div class="rail">
      <button
        v-for="v in primaryViews"
        :key="v"
        class="row view-row"
        :class="{ active: isActive(v) }"
        :data-view="v"
        @click="setView(v)"
      >
        <span class="icon">{{ VIEW_ICON[v] }}</span>
        <span class="name">{{ VIEW_NAME[v] }}</span>
        <span class="num">{{ countOf(v) }}</span>
      </button>

      <div class="spacer" />
      <div class="section-title">清单</div>

      <template v-for="entry in listsByGroup" :key="entry.group.id">
        <button
          class="row group-row"
          :class="{ active: isActive(`group:${entry.group.id}` as ViewKey) }"
          :data-group="entry.group.id"
          @click="setView(`group:${entry.group.id}` as ViewKey)"
        >
          <span
            class="arrow"
            :class="{ collapsed: ui.collapsed[entry.group.id] }"
            :data-arrow="entry.group.id"
            @click.stop="toggleGroup(entry.group.id)"
            >▾</span
          >
          <span class="name">{{ entry.group.name }}</span>
          <span class="num">{{ groupCount(entry.group.id) }}</span>
        </button>

        <button
          v-for="l in entry.lists"
          v-show="!ui.collapsed[entry.group.id]"
          :key="l.id"
          class="row list-row"
          :class="{ active: isActive(`list:${l.id}` as ViewKey) }"
          :data-list="l.id"
          @click="setView(`list:${l.id}` as ViewKey)"
        >
          <span class="dot" :style="{ background: l.color }" />
          <span class="name">{{ l.name }}</span>
          <span class="num">{{ countOf(`list:${l.id}` as ViewKey) }}</span>
        </button>
      </template>
    </div>

    <div class="rail status-rail">
      <button
        v-for="v in statusViews"
        :key="v"
        class="row view-row"
        :class="{ active: isActive(v) }"
        :data-view="v"
        @click="setView(v)"
      >
        <span class="icon">{{ VIEW_ICON[v] }}</span>
        <span class="name">{{ VIEW_NAME[v] }}</span>
        <span class="num">{{ countOf(v) }}</span>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border-right: 1px solid var(--line);
  overflow: hidden;
}

.rail {
  padding: 8px 6px;
  overflow-y: auto;
  min-height: 0;
}

.status-rail {
  margin-top: auto;
  border-top: 1px solid var(--line);
  padding-top: 8px;
}

.spacer {
  height: 10px;
}

.section-title {
  padding: 4px 10px 6px;
  color: var(--text-mute);
  font-size: 12px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border-radius: 6px;
  color: var(--text);
  text-align: left;
}

.row:hover {
  background: var(--hover);
}

.row.active {
  background: var(--sel);
  font-weight: 600;
}

.icon {
  width: 16px;
  text-align: center;
  color: var(--text-dim);
  flex: 0 0 16px;
}

.name {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.num {
  color: var(--text-mute);
  font-variant-numeric: tabular-nums;
}

.list-row {
  padding-left: 24px;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: 0 0 8px;
}

.arrow {
  width: 12px;
  color: var(--text-dim);
  flex: 0 0 12px;
  cursor: pointer;
  transition: transform 0.12s;
}

.arrow.collapsed {
  transform: rotate(-90deg);
}

.group-row {
  font-weight: 600;
}
</style>
