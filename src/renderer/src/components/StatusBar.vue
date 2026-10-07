<script setup lang="ts">
import { computed } from 'vue'
import { countDue } from '@shared/query'
import { state } from '../store/data'
import { ui } from '../store/ui'

const todayCount = computed(() => countDue(state.store))
const hitCount = computed(() => {
  if (!ui.search) return null
  const rows = state.store.todos.filter((t) => (t.title + ' ' + t.note).toLowerCase().includes(ui.search.toLowerCase()))
  return rows.length
})
</script>

<template>
  <footer class="statusbar" data-testid="statusbar">
    <span class="path" :title="state.path">{{ state.path }}</span>
    <span v-if="hitCount !== null" class="hint">搜索命中 {{ hitCount }} 条</span>
    <span class="spacer" />
    <span class="today">今天待办 {{ todayCount }} 项</span>
    <span class="hint">N 新建　Enter/F2 打开　Del 删除　B 切换视图　Ctrl+F 搜索　F5 刷新</span>
  </footer>
</template>

<style scoped>
.statusbar {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 5px 14px;
  border-top: 1px solid var(--line);
  background: var(--status);
  color: var(--text-dim);
  font-size: 12px;
}

.path {
  max-width: 380px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.spacer {
  flex: 1 1 auto;
}

.today {
  color: var(--text);
}

.hint {
  color: var(--text-mute);
}
</style>
