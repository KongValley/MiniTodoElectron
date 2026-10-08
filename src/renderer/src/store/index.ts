/**
 * 响应式索引包装:buildIndex 是纯函数,这里把它接上 store 与搜索词。
 * store 整体替换或搜索词变化即失效重建(5000 条约 7 ms),组件统一读这一个 computed。
 */
import { computed, ref } from 'vue'
import { buildIndex } from '@shared/store-index'
import { state } from './data'
import { ui } from './ui'

/**
 * 分钟级心跳。buildIndex 内部按今天算计数,而它除了 store/搜索词没别的依赖 ——
 * 应用开着跨过零点时缓存不会失效,侧栏与状态栏会永远停在昨天。
 */
export const clockTick = ref(0)

export function startClock(): void {
  setInterval(() => clockTick.value++, 60_000)
}

// clockTick 读在表达式里只为建立依赖,值本身不参与计算
export const index = computed(() => (clockTick.value, buildIndex(state.store, ui.search)))
