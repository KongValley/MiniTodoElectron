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
    return { store: seedStore(), warning }
  }
}

export async function saveStore(store: Store): Promise<void> {
  const file = storePath()
  const safe = normalizeStore(store)
  mkdirSync(dataDir(), { recursive: true })
  const tmp = `${file}.tmp`
  writeFileSync(tmp, JSON.stringify(safe), 'utf8')
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
    writeFileSync(created, JSON.stringify(normalizeStore(store), null, 2), 'utf8')
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
  writeFileSync(file, JSON.stringify(normalizeStore(store), null, 2), 'utf8')
}

/** 复制一份数据文件到目标路径(备份当前数据用) */
export function copyStoreTo(file: string): void {
  const src = storePath()
  if (existsSync(src)) copyFileSync(src, file)
}
