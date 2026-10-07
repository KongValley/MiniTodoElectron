// node --test 用的解析钩子:源码走 bundler 风格的 './dates'(无扩展名),
// 而 Node 的 ESM 解析要求扩展名。这里只在常规解析失败时补一个 .ts 再试。
// 仅测试进程挂载(--import),不参与 electron-vite 构建。
import { existsSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (err) {
      if (specifier.startsWith('.') && context.parentURL) {
        const url = new URL(`${specifier}.ts`, context.parentURL)
        if (existsSync(fileURLToPath(url))) return { url: url.href, shortCircuit: true }
      }
      throw err
    }
  }
})
