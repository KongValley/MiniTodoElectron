/**
 * 窗口化(虚拟滚动):只渲染可视区内的项。
 *
 * 两种模式共用一个实现:
 * - 固定高度(列表):所有项用 estimate,measure 不会被调用。
 * - 可变高度(看板卡片):先按 estimate 估算,卡片挂载后回填实测高度,偏移随之校正。
 *
 * 偏移用前缀和数组,查起点用二分;项数变化或测量更新时重算前缀和(O(n) 累加,5000 项 < 1ms)。
 */
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'

export interface VisibleItem<T> {
  item: T
  /** 在完整列表中的下标 */
  index: number
  /** 相对滚动内容顶部的偏移(px) */
  top: number
}

export interface VirtualState<T> {
  /** 全部项的总高度 */
  total: number
  visible: VisibleItem<T>[]
  /** 顶部占位高度(未渲染项) */
  padTop: number
  /** 底部占位高度(未渲染项) */
  padBottom: number
}

export interface UseVirtualOptions<T> {
  items: () => T[]
  keyOf: (item: T) => string
  scrollTop: Ref<number>
  viewportH: Ref<number>
  /** 每项的估算高度(px);可变高度项会在测量后被替换 */
  estimateOf: (item: T) => number
  /** 可视区外额外渲染的项数,避免快速滚动闪白 */
  overscan?: number
}

export interface UseVirtual<T> {
  state: ComputedRef<VirtualState<T>>
  /** 卡片/行挂载后回填实测高度 */
  measure: (key: string, height: number) => void
  /** 清空高度缓存(列表内容整体变化时调用) */
  reset: () => void
}

export function useVirtual<T>(options: UseVirtualOptions<T>): UseVirtual<T> {
  const { items, keyOf, scrollTop, viewportH, estimateOf, overscan = 4 } = options

  // 高度缓存刻意不是响应式的:同一帧里会回填几十个高度,若每次都触发重算,
  // 会连锁触发「重算 → 重渲染全部可见行 → 再回填」的雪崩(实测 72 张卡片 230 ms)。
  // 改为普通 Map + 每帧一次的版本号,把重算压到每帧一次。
  const heights = new Map<string, number>()
  const version = ref(0)
  let flushScheduled = false

  // 前缀和:offsets[i] 是第 i 项的顶部偏移,offsets[n] 是总高
  const offsets = computed(() => {
    void version.value // 依赖版本号而非 Map 本身
    const list = items()
    const acc = new Float64Array(list.length + 1)
    for (let i = 0; i < list.length; i++) {
      const item = list[i] as T
      const h = heights.get(keyOf(item))
      acc[i + 1] = (acc[i] as number) + (h !== undefined && h > 0 ? h : estimateOf(item))
    }
    return acc
  })

  /** 二分:返回第一个「底部 > y」的下标(即 y 落在哪一项上) */
  function indexAt(acc: Float64Array, y: number): number {
    let lo = 0
    let hi = acc.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if ((acc[mid + 1] as number) <= y) lo = mid + 1
      else hi = mid
    }
    return lo
  }

  const state = computed<VirtualState<T>>(() => {
    const list = items()
    const acc = offsets.value
    const total = acc.length > 0 ? (acc[acc.length - 1] as number) : 0
    if (list.length === 0) return { total: 0, visible: [], padTop: 0, padBottom: 0 }

    const top = Math.max(0, scrollTop.value)
    const start = Math.max(0, indexAt(acc, top) - overscan)
    const bottomY = top + Math.max(0, viewportH.value)
    const end = Math.min(list.length, indexAt(acc, bottomY) + 1 + overscan)

    const visible: VisibleItem<T>[] = []
    for (let i = start; i < end; i++) {
      visible.push({ item: list[i] as T, index: i, top: acc[i] as number })
    }
    return { total, visible, padTop: acc[start] as number, padBottom: total - (acc[end] as number) }
  })

  function measure(key: string, height: number): void {
    if (!(height > 0)) return
    const prev = heights.get(key)
    // 亚像素抖动不更新,避免测量→重渲染→再测量的循环
    if (prev !== undefined && Math.abs(prev - height) < 1) return
    heights.set(key, height)
    if (flushScheduled) return
    flushScheduled = true
    requestAnimationFrame(() => {
      flushScheduled = false
      version.value++
    })
  }

  function reset(): void {
    heights.clear()
    version.value++
  }

  // 列表整体换内容(视图/搜索变化)时丢弃高度缓存,避免旧 key 残留
  watch(
    () => items().length,
    () => reset()
  )

  return { state, measure, reset }
}
