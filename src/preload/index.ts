import { contextBridge, ipcRenderer } from 'electron'
import type { TodoAPI } from '@shared/api'

const api: TodoAPI = {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, callback) => {
    const listener = (_event: unknown, ...args: unknown[]): void => callback(...args)
    ipcRenderer.on(channel, listener)
    return () => {
      ipcRenderer.removeListener(channel, listener)
    }
  }
}

contextBridge.exposeInMainWorld('todoAPI', api)
