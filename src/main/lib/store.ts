/**
 * 数据文件读写与备份。原子写 + 损坏文件改名 + 每次变更即落盘(文件 <100 KB,不做防抖)。
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { normalizeStore, seedStore } from '@shared/store-ops'
import { stamp } from '@shared/dates'
import type { Store } from '@shared/types'
import { backupDir, dataDir, storePath } from './paths'

/** 备份保留份数(超出按修改时间删最旧) */
const BACKUP_KEEP = 10

/** 损坏文件隔离副本保留份数(超出按修改时间删最旧) */
const CORRUPT_KEEP = 5

/** 冒烟注入:强制下一次保存失败(验证渲染层「保存失败」提示与状态栏标记真的送达) */
let forceSaveFail = false

/** 主进程自己那次 loadStore 消费掉的损坏告警,渲染层的 store:load 再取一次 */
let lastWarning = ''

export interface LoadResult {
  store: Store
  /** 非空时渲染层应弹提示(数据文件损坏被隔离等) */
  warning: string
}

export interface ImportResult {
  store: Store
  source: string
  counts: { groups: number; lists: number; todos: number }
}

function countsOf(store: Store): ImportResult['counts'] {
  return { groups: store.groups.length, lists: store.lists.length, todos: store.todos.length }
}

export async function loadStore(): Promise<LoadResult> {
  const file = storePath()
  if (!existsSync(file)) return { store: seedStore(), warning: '' }
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    return { store: normalizeStore(parsed), warning: '' }
  } catch (err) {
    // 绝不静默覆盖:损坏文件改名留档,用户可自行找回
    const quarantined = `${file}.corrupt-${stamp()}`
    let warning = `数据文件无法解析(${err instanceof Error ? err.message : String(err)})，已改用示例数据`
    try {
      renameSync(file, quarantined)
      warning += `；原文件已保留为 ${basename(quarantined)}`
    } catch {
      warning += '；且无法重命名原文件，请手动备份后再继续'
    }
    console.error('[store] 数据文件损坏:', err)
    // 主进程启动时自己会先 loadStore 一次,那次已经把损坏文件改名消费掉了;
    // 渲染层随后发起的 store:load 读不到任何异常。这里留一份给渲染层取走。
    lastWarning = warning
    pruneCorrupt()
    return { store: seedStore(), warning }
  }
}

/** 取走并清空上一次 loadStore 的损坏告警(渲染层 store:load 用) */
export function consumeLoadWarning(): string {
  const w = lastWarning
  lastWarning = ''
  return w
}

/** 隔离副本限量:按 mtime 倒序保留最新 CORRUPT_KEEP 份,删更旧的 */
function pruneCorrupt(): void {
  try {
    const stale = readdirSync(dataDir())
      .filter((f) => /^todos\.json\.corrupt-\d{8}-\d{6}$/.test(f))
      .map((f) => join(dataDir(), f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
      .slice(CORRUPT_KEEP)
    for (const f of stale) rmSync(f, { force: true })
  } catch (err) {
    console.error('[store] 清理损坏文件副本失败:', err)
  }
}

/** 冒烟注入开关:强制 saveStore 抛错 */
export function setSaveFail(v: boolean): void {
  forceSaveFail = v
}

/**
 * 原子落盘。调用方保证 store 合法(IPC 侧 assertStoreShape / 导入侧 normalizeStore),
 * 这里不再重复逐条归一化 —— 5000 条时那一次归一化要 ~115ms,而它每次保存都会跑。
 */
export async function saveStore(store: Store): Promise<void> {
  if (forceSaveFail) throw new Error('磁盘写入失败（冒烟注入）')
  const file = storePath()
  mkdirSync(dataDir(), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(store), 'utf8')
  renameSync(tmp, file)
}

/** 列出备份文件,按修改时间从新到旧 */
function listBackups(): string[] {
  const dir = backupDir()
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((f) => /^todos-\d{8}-\d{6}\.json$/.test(f))
    .map((f) => join(dir, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
}

/** 每天最多备份一份;超出 BACKUP_KEEP 份时删最旧 */
export async function backupIfDue(store: Store): Promise<string | null> {
  const dir = backupDir()
  const existing = listBackups()
  const todayTag = stamp().slice(0, 8)
  const alreadyToday = existing.some((f) => basename(f).slice(6, 14) === todayTag)

  mkdirSync(dir, { recursive: true })
  let created: string | null = null
  if (!alreadyToday) {
    created = join(dir, `todos-${stamp()}.json`)
    writeFileSync(created, JSON.stringify(store, null, 2), 'utf8')
  }

  const all = listBackups()
  for (const stale of all.slice(BACKUP_KEEP)) rmSync(stale, { force: true })
  return created
}

/** 读入并归一化外部 JSON;调用方确认后才落盘(此函数只读) */
export async function importFromFile(file: string): Promise<ImportResult> {
  const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
  const store = normalizeStore(parsed)
  return { store, source: file, counts: countsOf(store) }
}

export async function exportToFile(file: string, store: Store): Promise<void> {
  writeFileSync(file, JSON.stringify(store, null, 2), 'utf8')
}

/** 复制一份数据文件到目标路径(备份当前数据用) */
export function copyStoreTo(file: string): void {
  const src = storePath()
  if (existsSync(src)) copyFileSync(src, file)
}
