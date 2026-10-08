<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { CH } from '@shared/api'
import Sidebar from './components/Sidebar.vue'
import TopBar from './components/TopBar.vue'
import StatusBar from './components/StatusBar.vue'
import BoardView from './components/BoardView.vue'
import ListView from './components/ListView.vue'
import TaskDialog from './components/TaskDialog.vue'
import GroupListDialog from './components/GroupListDialog.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import HelpDialog from './components/HelpDialog.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import CardMenu from './components/CardMenu.vue'
import Toast from './components/Toast.vue'
import { init, state, commit } from './store/data'
import { startClock } from './store/index'
import { applyTheme, refreshSettings } from './store/settings'
import { askConfirm, toast, ui } from './store/ui'
import { mergeStore } from '@shared/store-ops'
import type { Store } from '@shared/types'
import { useGlobalKeymap } from './lib/keymap'

useGlobalKeymap()

let offTheme: (() => void) | undefined
let offBoard: (() => void) | undefined
let offDialog: (() => void) | undefined

onMounted(async () => {
  // 分钟心跳:让跨零点后按 today() 算出来的计数失效重建
  startClock()
  // 监听必须在 init() 之前注册:init 抛错也不会让托盘/菜单触发的 IPC 事件永久失效
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
    } else if (kind === 'import-choice') {
      const c = args[1] as { store: Store; counts: { groups: number; lists: number; todos: number } }
      askConfirm(
        '导入数据',
        `文件包含 ${c.counts.groups} 个分组 / ${c.counts.lists} 个清单 / ${c.counts.todos} 条任务。\n「替换」会丢弃当前全部数据（导入前已自动备份）；「合并」保留现有任务，同 id 的条目跳过。`,
        () => {
          void commit(c.store).then(() => toast('已替换'))
        },
        {
          label: '合并进当前数据',
          onOk: () => {
            const { store, skipped } = mergeStore(state.store, c.store)
            const s = skipped.groups + skipped.lists + skipped.todos
            void commit(store).then(() => toast(s > 0 ? `已合并，跳过 ${s} 条重复` : '已合并'))
          }
        }
      )
    } else if (kind === 'exported') toast(`已导出到 ${String(args[1] ?? '')}`)
  })

  await init()
  applyTheme(state.settings?.theme ?? 'system')
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

    <GroupListDialog v-if="ui.meta" :key="ui.meta.seq" />
    <TaskDialog v-if="ui.dialog" :key="ui.dialog.seq" />
    <SettingsDialog v-if="ui.settingsOpen" />
    <HelpDialog v-if="ui.helpOpen" />
    <ConfirmDialog v-if="ui.confirm" />
    <CardMenu v-if="ui.cardMenu" />
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
