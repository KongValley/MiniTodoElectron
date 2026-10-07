// 生成性能基准数据:tmp/perf-data-<n>/todos.json(n ∈ 500/2000/5000)。
// 结构同 seedStore() 的 v2 格式,字段与 normalizeStore 兼容;已存在则跳过。
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SIZES = [500, 2000, 5000]

const pad = (n) => String(n).padStart(2, '0')

/** 相对今天的 'yyyy-MM-dd'(本地时区) */
function day(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function buildStore(n) {
  const groups = [
    { id: 'g-work', name: '工作', order: 0 },
    { id: 'g-life', name: '生活', order: 1 }
  ]
  const listNames = ['内容生产', '待办事务', '项目跟进', '会议', '文档', '复盘', '生活杂事', '健康', '装修', '购物', '阅读', '旅行']
  const colors = ['#3A7AFE', '#7C5CFF', '#F2A33C', '#3C9954', '#12A5B8', '#D34A3E', '#8A8F98', '#5B93FF', '#E8B457', '#5CB377', '#9AA0A8', '#7C5CFF']
  const lists = listNames.map((name, i) => ({
    id: 'L' + i,
    gid: i < 6 ? 'g-work' : 'g-life',
    name,
    color: colors[i],
    order: i
  }))

  const now = Date.now()
  const todos = Array.from({ length: n }, (_, i) => {
    // 每 11 条一条已完成、每 29 条一条已放弃、每 7 条一条未排期,贴近真实分布
    const status = i % 29 === 0 ? 2 : i % 11 === 0 ? 1 : 0
    return {
      id: 'p' + i,
      lid: 'L' + (i % lists.length),
      title: `任务标题 ${i}（压力测试）`,
      note: i % 5 === 0 ? `备注 ${i}` : '',
      date: i % 7 === 0 ? '' : day(i % 30),
      prio: (i % 3) + 1,
      status,
      seq: i + 1,
      order: 0,
      subtasks: i % 13 === 0 ? [{ id: `p${i}s0`, title: '子任务', done: i % 26 === 0 }] : [],
      repeat: { kind: 'none' },
      createdAt: now + i,
      doneAt: status === 1 ? now + i : null
    }
  })

  return { version: 2, groups, lists, todos }
}

let made = 0
for (const n of SIZES) {
  // 写到 pristine 目录:探针会原地改写数据(完成/新建任务并落盘),
  // 每次测量都必须从这一份干净数据复制,否则第二次起就不是同一负载。
  const file = join(root, 'tmp', 'perf-pristine', `${n}.json`)
  if (existsSync(file) && !process.argv.includes('--force')) {
    console.log(`跳过 ${n}(已存在;--force 可重建)`)
    continue
  }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(buildStore(n)), 'utf8')
  console.log(`生成 tmp/perf-pristine/${n}.json(${n} 条)`)
  made++
}
console.log(made === 0 ? '三档数据均已就绪' : `完成:${made} 档`)
