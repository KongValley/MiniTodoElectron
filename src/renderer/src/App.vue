<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { CH } from '@shared/api'
import Sidebar from './components/Sidebar.vue'
import TopBar from './components/TopBar.vue'
import StatusBar from './components/StatusBar.vue'
import BoardView from './components/BoardView.vue'
import ListView from './components/ListView.vue'
import TaskDialog from './components/TaskDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import HelpDialog from './components/HelpDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import Toast from './components/Toast.vue'
import { init, state } from './store/data'
import { applyTheme, refreshSettings } from './store/settings'
import { toast, ui } from './store/ui'
import { useGlobalKeymap } from './lib/keymap'

useGlobalKeymap()

let offTheme: (() => void) | undefined
let offBoard: (() => void) | undefined
let offDialog: (() => void) | undefined

onMounted(async () => {
  await init()
  applyTheme(state.settings?.theme ?? 'system')

  offTheme = window.todoAPI.on(CH.themeSet, (...args: unknown[]) => {
    const theme = args[0] as 'system' | 'light' | 'dark'
    void refreshSettings().then(() => applyTheme(theme))
  })
  offBoard = window.todoAPI.on(CH.uiSetBoard, (...args: unknown[]) => {
    ui.board = args[0] !== false
  })
  offDialog = window.todoAPI.on(CH.uiOpenDialog, (...args: unknown[]) => {
    const kind = args[0] as string
    if (kind === 'settings') ui.settingsOpen = true
    else if (kind === 'help') ui.helpOpen = true
    else if (kind === 'warning') toast(String(args[1] ?? '数据文件异常'))
    else if (kind === 'imported') {
      const c = args[1] as { groups: number; lists: number; todos: number } | undefined
      toast(`已导入 ${c?.groups ?? 0} 个分组 / ${c?.lists ?? 0} 个清单 / ${c?.todos ?? 0} 条任务`)
      void init()
    } else if (kind === 'exported') toast(`已导出到 ${String(args[1] ?? '')}`)
  })
})

onBeforeUnmount(() => {
  offTheme?.()
  offBoard?.()
  offDialog?.()
})
</script>

<template>
  <div class="shell">
    <Sidebar />
    <div class="main">
      <TopBar />
      <div class="body" data-testid="body">
        <BoardView v-if="ui.board" />
        <ListView v-else />
      </div>
      <StatusBar />
    </div>

    <TaskDialog v-if="ui.dialog" />
    <SettingsDialog v-if="ui.settingsOpen" />
    <HelpDialog v-if="ui.helpOpen" />
    <ConfirmDialog v-if="ui.confirm" />
    <Toast v-if="ui.toast" :text="ui.toast" />
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: 240px 1fr;
  height: 100%;
}

.main {
  display: grid;
  grid-template-rows: auto 1fr auto;
  min-width: 0;
  /* 作为 .shell 的 grid item,min-height 默认 auto 会被内容撑高,
     导致内部滚动容器(看板列/列表)拿不到可视高度,虚拟滚动无从计算窗口 */
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.body {
  min-height: 0;
  overflow: hidden;
}
</style>
