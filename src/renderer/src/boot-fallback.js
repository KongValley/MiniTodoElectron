/**
 * 界面加载失败兜底（必须在 main.ts 之前执行）。
 *
 * 资源读不到（asar 损坏 / 协议拦截 / 脚本语法错）时 #app 会一直是空的，
 * 用户只看到一块白窗，既不知道出了什么事也没法反馈。这里把首条错误显示出来。
 *
 * 独立于主 bundle：主包本身就起不来时，本文件仍能被加载。
 * 用独立文件而不是内联脚本：CSP 是 script-src 'self'，内联会被拦掉。
 */
var booted = false
var bootError = ''

function paint() {
  var app = document.getElementById('app')
  if (!app || booted || app.children.length > 0) return
  app.textContent = ''
  var box = document.createElement('div')
  box.style.cssText =
    'margin:80px auto;max-width:520px;padding:24px;border:1px solid #e3e6ea;border-radius:8px;' +
    'font:14px/1.7 "Microsoft YaHei",sans-serif;color:#2b2f36;background:#fff'
  var head = document.createElement('b')
  head.style.cssText = 'font-size:15px'
  head.textContent = '界面加载失败'
  var desc = document.createElement('div')
  desc.style.cssText = 'color:#5b6270;margin-top:8px'
  desc.textContent =
    '数据没有丢失，但界面没能渲染出来。关闭应用后重新打开通常即可恢复；反复出现请把下面的信息反馈给维护者。'
  box.appendChild(head)
  box.appendChild(desc)
  if (bootError) {
    var detail = document.createElement('pre')
    detail.style.cssText =
      'margin-top:12px;padding:8px;background:#f5f6f8;border-radius:6px;font-size:12px;white-space:pre-wrap'
    detail.textContent = bootError
    box.appendChild(detail)
  }
  var hint = document.createElement('div')
  hint.style.cssText = 'color:#8b919c;margin-top:12px;font-size:12px'
  hint.textContent = '若应用刚从压缩包或更新目录运行，请先完整解压/更新完成再启动。'
  box.appendChild(hint)
  app.appendChild(box)
}

window.addEventListener('error', function (e) {
  if (!bootError) {
    bootError = e.message || '未知错误'
    if (e.filename) bootError += '（' + String(e.filename).split('/').pop() + '）'
  }
  paint()
})

// main.ts 挂载成功后置位，撤掉兜底
Object.defineProperty(window, '__booted', {
  get: function () {
    return booted
  },
  set: function (v) {
    booted = v
  }
})

setTimeout(paint, 6000)