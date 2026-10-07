// 性能基准运行器:node scripts/perf-compare.mjs <标签> [次数=3]
// 对 500/2000/5000 三档各跑 N 次取中位数,打印对照表并写 tmp/perf-<标签>.json。
// 用 node_modules/electron(不依赖打包产物);每档独立数据目录。
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const label = process.argv[2] ?? 'current'
const runs = Number(process.argv[3] ?? 3)
const electron = join(root, 'node_modules', 'electron', 'dist', 'electron.exe')
const tmpDir = join(root, 'tmp')
const SIZES = [500, 2000, 5000]

if (!existsSync(electron)) {
  console.error('缺少 electron 二进制,请先 npm install')
  process.exit(1)
}

// 缺数据时现场生成
const pristine = (n) => join(tmpDir, 'perf-pristine', `${n}.json`)
if (SIZES.some((n) => !existsSync(pristine(n)))) {
  const gen = spawnSync(process.execPath, [join(root, 'scripts', 'gen-perf-data.mjs')], {
    cwd: root,
    stdio: 'inherit'
  })
  if (gen.status !== 0) process.exit(1)
}

const med = (arr) => {
  const s = [...arr].sort((a, b) => a - b)
  return s.length === 0 ? 0 : s[Math.floor(s.length / 2)]
}

/**
 * 私有提交上限(泄漏探测,不是内存预算)。
 * 探针在跑完一轮改动后采样,此时 V8 堆尚未回收,5000 条实测约 200 MB;
 * 稳态(空闲)约 136-149 MB。取 320 MB 作上限:只有真正的泄漏才会越过,
 * GC 时机的正常波动不会误报。任务管理器「内存」列另需外部 PowerShell 读(约 83 MB)。
 */
const PRIVATE_COMMIT_CEILING_MB = 320

const summary = { label, runs, sizes: {} }
let leakSuspected = false

for (const n of SIZES) {
  const dataDir = join(tmpDir, `perf-run-${n}`)
  const perStep = {}
  const meta = {
    domCards: [],
    domRows: [],
    domCols: [],
    blockingMsTotal: [],
    longTasks: [],
    // 内存:私有提交(privateBytes,≈PrivateMemorySize64)与工作集合计(含共享 DLL)。
    // 任务管理器「内存」列(私有工作集)比私有提交小,且 getAppMetrics() 不提供,需外部读。
    privateMB: [],
    rssMB: [],
    procCount: []
  }

  for (let run = 1; run <= runs; run++) {
    // 每次运行都从 pristine 重置数据:探针会改写数据并落盘,
    // 复用同一目录会让第二次起跑在不同的负载上。
    rmSync(dataDir, { recursive: true, force: true })
    mkdirSync(dataDir, { recursive: true })
    copyFileSync(pristine(n), join(dataDir, 'todos.json'))

    const out = join(tmpDir, `perf-${label}-${n}-${run}.json`)
    rmSync(out, { force: true })
    spawnSync(electron, ['.', `--user-data-dir=${join(tmpDir, `udd-perf-${label}-${n}-${run}`)}`], {
      cwd: root,
      env: {
        ...process.env,
        TODO_SMOKE: '1',
        TODO_SMOKE_SCRIPT: join('scripts', 'perf-probe.js'),
        TODO_SMOKE_OUT: out,
        TODO_SMOKE_ROOT: root,
        TODO_DATA_DIR: dataDir,
        TODO_SMOKE_TIMEOUT: '180000',
        TODO_SMOKE_SETTLE: '300'
      },
      stdio: 'ignore',
      timeout: 240000
    })

    if (!existsSync(out)) {
      console.error(`  [${label} ${n} run ${run}] 未生成结果文件`)
      continue
    }
    let report
    try {
      report = JSON.parse(readFileSync(out, 'utf8'))
    } catch (err) {
      console.error(`  [${label} ${n} run ${run}] 结果解析失败:${String(err)}`)
      continue
    }
    if (!report.ok) {
      console.error(`  [${label} ${n} run ${run}] 探针失败:${report.error}`)
      continue
    }
    const r = report.result
    meta.domCards.push(r.domCards)
    meta.domRows.push(r.domRows)
    meta.domCols.push(r.domCols)
    meta.blockingMsTotal.push(r.blockingMsTotal)
    meta.longTasks.push(r.longTasks)
    const metrics = report.metrics ?? {}
    if (typeof metrics.totalPrivateMB === 'number') meta.privateMB.push(metrics.totalPrivateMB)
    if (typeof metrics.totalRssMB === 'number') meta.rssMB.push(metrics.totalRssMB)
    if (Array.isArray(metrics.processes)) meta.procCount.push(metrics.processes.length)
    for (const s of r.steps) {
      perStep[s.label] ??= { wall: [], blocking: [] }
      perStep[s.label].wall.push(s.wallMs)
      perStep[s.label].blocking.push(s.blockingMs)
    }
  }

  summary.sizes[n] = {
    total: n,
    domCards: med(meta.domCards),
    domRows: med(meta.domRows),
    domCols: med(meta.domCols),
    blockingMsTotal: med(meta.blockingMsTotal),
    longTasks: med(meta.longTasks),
    // 私有提交与工作集合计;两者都含各进程,口径不同别混用(见 README 内存小节)
    privateMB: med(meta.privateMB),
    rssMB: med(meta.rssMB),
    procCount: med(meta.procCount),
    steps: Object.fromEntries(
      Object.entries(perStep).map(([k, v]) => [k, { wallMs: med(v.wall), blockingMs: med(v.blocking) }])
    )
  }
}

const outFile = join(tmpDir, `perf-${label}.json`)
writeFileSync(outFile, JSON.stringify(summary, null, 2), 'utf8')

// 对照表
console.log(`\n=== 性能基准:${label}(${runs} 次中位数)===`)
for (const n of SIZES) {
  const s = summary.sizes[n]
  console.log(`\n--- ${n} 条 ---`)
  console.log(`DOM 卡片 ${s.domCards} | DOM 列表行 ${s.domRows} | DOM 列 ${s.domCols} | 总阻塞 ${s.blockingMsTotal} ms | 长任务 ${s.longTasks}`)
  console.log(
    `内存 私有提交 ${s.privateMB} MB | 工作集合计 ${s.rssMB} MB | ${s.procCount} 进程`
  )
  if (s.privateMB > PRIVATE_COMMIT_CEILING_MB) {
    console.log(`  ⚠ 私有提交超过 ${PRIVATE_COMMIT_CEILING_MB} MB 上限,疑似内存泄漏`)
    leakSuspected = true
  }
  for (const [name, v] of Object.entries(s.steps)) {
    console.log(`  ${name.padEnd(26)} 墙钟 ${String(v.wallMs).padStart(5)} ms  阻塞 ${String(v.blockingMs).padStart(5)} ms`)
  }
}
console.log(`\n结果已写入 tmp/perf-${label}.json`)
if (leakSuspected) {
  console.error('内存探测未通过:私有提交越过上限,请检查是否有泄漏')
  process.exit(1)
}
