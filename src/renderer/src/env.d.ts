/// <reference types="vite/client" />

import type { TodoAPI } from '@shared/api'
import type { TodoTestAPI } from './test-api'

declare global {
  interface Window {
    todoAPI: TodoAPI
    __todoTest: TodoTestAPI
  }
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
