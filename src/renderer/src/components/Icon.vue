<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  name: string
  /** 像素尺寸,默认 16 */
  size?: number
}>()

/** 线性描边路径;空格分隔多个子路径,渲染时拆成多个 <path> */
const STROKE: Record<string, string> = {
  all: 'M4 6h16M4 12h16M4 18h16',
  today:
    'M8 3v3M16 3v3M3.5 9h17M5.5 5.5h13a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2ZM9 14.5l2 2 4-4',
  week: 'M3.5 5.5h17v14h-17zM3.5 10h17M8 5.5v4.5M13 5.5v4.5M18 5.5v4.5',
  inbox: 'M3.5 12.5h4l1.5 2.5h6l1.5-2.5h4M5.5 5.5h13l3.5 7v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z',
  done: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM8.5 12.5l2.5 2.5 4.5-5',
  dropped: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM9 9l6 6M15 9l-6 6',
  trash: 'M4.5 7h15M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6.5 7l1 13h9l1-13M10 11v6M14 11v6',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM16.5 16.5L21 21',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  chevron: 'M6 9l6 6 6-6',
  expand: 'M8 5l8 7-8 7',
  collapse: 'M5 8l7 8 7-8'
}

/** 实心图形(优先级旗标):不受 stroke-width 影响,小尺寸下更清晰 */
const FILL: Record<string, string> = {
  flagHigh: 'M6 3v18M6 4h11l-2.5 4L17 12H6z',
  flagMid: 'M6 3v18M6 4h11l-2.5 4L17 12H6z',
  flagLow: 'M6 3v18M6 4h11l-2.5 4L17 12H6z'
}

const isFill = computed(() => props.name in FILL)

/** 缺失 name 时兜底为 all,不抛错 */
const paths = computed<string[]>(() => {
  const raw = STROKE[props.name] ?? STROKE.all as string
  return raw.split(' ').filter((s) => s !== '')
})
</script>

<template>
  <svg
    class="ico"
    :class="`ico-${name}`"
    viewBox="0 0 24 24"
    :width="size ?? 16"
    :height="size ?? 16"
    fill="none"
    stroke="currentColor"
    stroke-width="1.8"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-if="isFill" :d="FILL[name]" fill="currentColor" stroke="none" />
    <path v-for="(d, i) in paths" v-else :key="i" :d="d" />
  </svg>
</template>
