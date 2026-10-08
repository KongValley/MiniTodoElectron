<script setup lang="ts">
import { computed } from 'vue'
import { state } from '../store/data'
import { index } from '../store/index'
import { ui } from '../store/ui'

// 两个计数都取自单次扫描的索引,不再各自扫全表
const todayCount = computed(() => index.value.counts['due'] ?? 0)
// 搜索命中数 = 命中搜索词的全部任务(不限视图),与索引的 hits 同义
const hitCount = computed(() => (ui.search ? index.value.hits.length : null))
</script>

<template>
  <footer class="statusbar" data-testid="statusbar">
    <span class="path" :title="state.path">{{ state.path }}</span>
    <span v-if="hitCount !== null" class="hint">搜索命中 {{ hitCount }} 条</span>
    <span class="spacer" />
    <span v-if="state.saveFailed" class="save-err" data-testid="save-failed">保存失败，数据未写入磁盘</span>
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

.save-err {
  color: var(--danger);
  font-weight: 600;
}

.hint {
  color: var(--text-mute);
}
</style>
