<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { viewTitle } from '@shared/query'
import { state } from '../store/data'
import { ui } from '../store/ui'
import { newTaskPreset, toggleBoard } from '../lib/keymap'
import Icon from './Icon.vue'

const searchInput = ref<HTMLInputElement | null>(null)

watch(
  () => ui.searchOpen,
  (open) => {
    if (open) void nextTick(() => searchInput.value?.focus())
  }
)

function closeSearch(): void {
  ui.searchOpen = false
  ui.search = ''
}

function onNew(): void {
  ui.dialog = { mode: 'new', ...newTaskPreset() }
}
</script>

<template>
  <header class="topbar" data-testid="topbar">
    <h1 class="title">{{ viewTitle(state.store, ui.view) }}</h1>

    <div class="search" :class="{ open: ui.searchOpen }">
      <input
        v-if="ui.searchOpen"
        ref="searchInput"
        v-model="ui.search"
        class="search-input"
        data-testid="search-input"
        placeholder="搜索任务…"
        @keydown.esc="closeSearch"
      />
      <button class="icon-btn" data-testid="search-toggle" title="搜索 (Ctrl+F)" @click="ui.searchOpen ? closeSearch() : (ui.searchOpen = true)">
        <Icon name="search" />
      </button>
    </div>

    <div class="actions">
      <button class="btn" data-testid="new-task" @click="onNew">新建</button>
      <button class="btn" data-testid="toggle-board" :title="ui.board ? '切换到列表 (B)' : '切换到看板 (B)'" @click="toggleBoard">
        {{ ui.board ? '列表' : '看板' }}
      </button>
      <button class="btn" data-testid="open-settings" @click="ui.settingsOpen = true">设置</button>
      <button class="btn" data-testid="open-help" @click="ui.helpOpen = true">快捷键</button>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--line);
  background: var(--bg);
}

.title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  flex: 0 0 auto;
}

.search {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.search-input {
  width: 220px;
}

.icon-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  color: var(--text-dim);
  font-size: 15px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: var(--hover);
  color: var(--text);
}

.actions {
  display: flex;
  gap: 6px;
}

.btn {
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid var(--field-line);
  background: var(--card);
  color: var(--text);
}

.btn:hover {
  background: var(--hover);
}
</style>
