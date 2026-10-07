/**
 * 响应式索引包装:buildIndex 是纯函数,这里把它接上 store 与搜索词。
 * store 整体替换或搜索词变化即失效重建(5000 条约 7 ms),组件统一读这一个 computed。
 */
import { computed } from 'vue'
import { buildIndex } from '@shared/store-index'
import { state } from './data'
import { ui } from './ui'

export const index = computed(() => buildIndex(state.store, ui.search))
