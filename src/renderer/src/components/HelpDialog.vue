<script setup lang="ts">
import { ui } from '../store/ui'

const ROWS: [string, string][] = [
  ['N', '新建任务'],
  ['Enter / F2', '打开选中任务'],
  ['Del', '删除选中（回收站视图里是彻底删除）'],
  ['B', '切换看板 / 列表'],
  ['Ctrl+F', '搜索'],
  ['Esc', '关闭弹窗 / 清空搜索'],
  ['F5', '刷新'],
  ['1 2 3 4', '今天 / 明天 / 最近7天 / 所有'],
  ['看板内滚轮', '上下滚动鼠标所在列'],
  ['Ctrl + 滚轮', '看板内左右滚动日期列'],
  ['拖拽卡片', '改期 / 同优先级桶内排序']
]
</script>

<template>
  <Teleport to="body">
    <div class="overlay" data-testid="help-dialog" @click.self="ui.helpOpen = false">
      <div class="dialog" @keydown.esc="ui.helpOpen = false">
        <h2>快捷键</h2>
        <table>
          <tbody>
            <tr v-for="[key, desc] in ROWS" :key="key">
              <td class="k"><kbd>{{ key }}</kbd></td>
              <td class="d">{{ desc }}</td>
            </tr>
          </tbody>
        </table>
        <div class="foot">
          <span class="spacer" />
          <button class="btn" data-testid="help-close" @click="ui.helpOpen = false">关闭</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgb(0 0 0 / 35%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog {
  width: 420px;
  padding: 18px 20px 14px;
  border-radius: 10px;
  background: var(--card);
  border: 1px solid var(--line);
  box-shadow: 0 12px 40px rgb(0 0 0 / 25%);
}

h2 {
  margin: 0 0 12px;
  font-size: 15px;
}

table {
  width: 100%;
  border-collapse: collapse;
}

td {
  padding: 5px 0;
  vertical-align: top;
}

.k {
  width: 110px;
}

kbd {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 5px;
  border: 1px solid var(--field-line);
  background: var(--panel);
  font-family: inherit;
  font-size: 12px;
}

.d {
  color: var(--text-dim);
}

.foot {
  display: flex;
  margin-top: 12px;
}

.spacer {
  flex: 1 1 auto;
}

.btn {
  padding: 5px 14px;
  border-radius: 6px;
  border: 1px solid var(--field-line);
  background: var(--card);
}

.btn:hover {
  background: var(--hover);
}
</style>
