/**
 * 到期提醒:每分钟检查一次,到达 notifyAt 且当天未发过时统计「今天 + 逾期」的未完成任务数,
 * 大于 0 才发 Windows 通知并记下日期(同日不重复发)。
 */
import { Notification, type BrowserWindow } from 'electron'
import { today } from '@shared/dates'
import { loadSettings, saveSettings } from './settings'
import { showWindow } from './tray'

let timer: NodeJS.Timeout | undefined

export interface NotifyState {
  supported: boolean
  lastNotifiedDate: string
  lastBody: string
}

const state: NotifyState = { supported: false, lastNotifiedDate: '', lastBody: '' }

/** 通知支持探测(Win7 上可能不支持;不支持时整个轮询不启动,绝不能崩) */
function detectSupport(): boolean {
  try {
    return Notification.isSupported()
  } catch {
    return false
  }
}

export function notifyState(): NotifyState {
  return state
}

/** 统计今天到期或已逾期的未完成任务数(由调用方注入,避免主进程重复实现过滤逻辑) */
export type CountToday = () => number

function tick(win: BrowserWindow, countToday: CountToday): void {
  const s = loadSettings()
  state.supported = detectSupport()
  if (!s.notifyEnabled || !state.supported) return
  if (s.lastNotifiedDate === today()) return

  const now = new Date()
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  if (hm < s.notifyAt) return

  const n = countToday()
  if (n <= 0) return

  const body = `今天有 ${n} 项待办`
  try {
    const note = new Notification({ title: '迷你待办', body })
    note.on('click', () => showWindow(win))
    note.show()
  } catch (err) {
    console.error('[notify] 发送失败:', err)
    return
  }
  saveSettings({ lastNotifiedDate: today() })
  state.lastNotifiedDate = today()
  state.lastBody = body
}

export function startNotifyLoop(win: BrowserWindow, countToday: CountToday): void {
  state.supported = detectSupport()
  if (!state.supported) return
  tick(win, countToday)
  timer = setInterval(() => tick(win, countToday), 60_000)
}

export function stopNotifyLoop(): void {
  clearInterval(timer)
  timer = undefined
}

/** 冒烟用:立即跑一次检查并返回状态 */
export function runNotifyTick(win: BrowserWindow, countToday: CountToday): NotifyState {
  tick(win, countToday)
  return state
}
