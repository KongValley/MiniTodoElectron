// 步骤 29:侧栏分组/清单的新建、编辑、删除与拖拽排序
//
// 覆盖三条最容易出错的链路:
//   1. 删除语义 —— 清单删除时「任务移到收集箱」与「连任务一起删」两条分支结果不同
//   2. 悬空引用 —— 删除分组后不得残留 gid 指向它的清单(否则整行不渲染、任务无计数)
//   3. 拖拽落点 —— 真实 DragEvent 链,dragId 经 ref 传 props 要过一帧,连发会被忽略
const t = window.__todoTest
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const day = (k) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + k)
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`
}
const t0 = day(0)

// 从空库开始:种子数据的分组/清单会干扰计数断言
await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
await t.flush()
t.setBoard(false)
await sleep(150)

/* ---------- 新建 ---------- */
await t.addGroup('工作')
await t.addGroup('生活')
await t.flush()
await sleep(150)
eq(t.groups().map((g) => g.name), ['工作', '生活'], '两个分组按 order 建好')
eq(t.groups().map((g) => g.order), [1, 2], 'order 连续')
const gWork = t.groups()[0].id
const gLife = t.groups()[1].id
truthy(document.querySelector(`[data-group="${gWork}"]`), '侧栏出现工作分组行')

await t.addList(gWork, '内容生产', '#3A7AFE')
await t.addList(gWork, '待办事务', '#7C5CFF')
await t.addList(gLife, '生活杂事', '#F2A33C')
await t.flush()
await sleep(150)
eq(t.lists().filter((l) => l.gid === gWork).map((l) => l.order), [1, 2], '工作组内 order 连续')

// 弹窗入口:点 + 分组 → 填名 → 保存
document.querySelector('[data-testid="sidebar-add-group"]').click()
await sleep(150)
truthy(document.querySelector('[data-testid="meta-dialog"]'), '点「+ 分组」应打开弹窗')
const nameInput = document.querySelector('[data-testid="meta-name"]')
const setVal = (el, v) => {
  el.value = v
  el.dispatchEvent(new Event('input', { bubbles: true }))
}
setVal(nameInput, '学习')
// 必须等一拍:保存按钮的 :disabled 由 canSave 派生,Vue 重渲染后按钮才可点
await sleep(80)
document.querySelector('[data-testid="meta-save"]').click()
await t.flush()
await sleep(150)
eq(t.groups().length, 3, '弹窗保存后新增一个分组')
truthy(t.groups().some((g) => g.name === '学习'), '新分组名为「学习」')
eq(document.querySelector('[data-testid="meta-dialog"]'), null, '保存后弹窗关闭')

// 空白名不该建条目
document.querySelector('[data-testid="sidebar-add-group"]').click()
await sleep(120)
document.querySelector('[data-testid="meta-save"]').click()
await sleep(150)
eq(t.groups().length, 3, '空白名不新建分组')

/* ---------- 编辑清单 ---------- */
const lContent = t.lists().find((l) => l.name === '内容生产').id
document.querySelector(`[data-list-edit="${lContent}"]`).click()
await sleep(150)
truthy(document.querySelector('[data-testid="meta-dialog"]'), '点编辑应打开弹窗')
truthy(document.querySelector('[data-testid="meta-group"]'), '清单编辑弹窗应有所属分组下拉')
setVal(document.querySelector('[data-testid="meta-name"]'), '内容运营')
await sleep(80)
document.querySelector('[data-testid="meta-save"]').click()
await t.flush()
await sleep(150)
eq(t.lists().find((l) => l.id === lContent).name, '内容运营', '重命名生效')
truthy(!t.lists().some((l) => l.name === '内容生产'), '旧名已不存在')

/* ---------- 删除清单:任务移到收集箱 ---------- */
const moved = await t.newTask({ title: '要保留', date: t0, lid: lContent })
await t.flush()
await sleep(150)
document.querySelector(`[data-list-del="${lContent}"]`).click()
await sleep(150)
truthy(document.querySelector('[data-testid="confirm-dialog"]'), '有任务的清单删除应先确认')
const detail = document.querySelector('[data-testid="confirm-dialog"] p').textContent
truthy(detail.includes('1'), `确认框应说明任务条数(实际「${detail}」)`)
document.querySelector('[data-testid="confirm-secondary"]').click()
await t.flush()
await sleep(200)
truthy(!t.lists().some((l) => l.id === lContent), '清单已删除')
const kept = t.getState().todos.find((x) => x.id === moved.id)
truthy(!!kept, '任务仍在(不能丢)')
eq(kept.lid, '', '任务已改挂收集箱')

/* ---------- 删除清单:连任务一起删 ---------- */
const lBiz = t.lists().find((l) => l.name === '待办事务').id
const doomed = await t.newTask({ title: '要删掉', date: t0, lid: lBiz })
const keep2 = await t.newTask({ title: '别的清单', date: t0, lid: t.lists().find((l) => l.name === '生活杂事').id })
await t.flush()
await sleep(150)
document.querySelector(`[data-list-del="${lBiz}"]`).click()
await sleep(150)
document.querySelector('[data-testid="confirm-ok"]').click()
await t.flush()
await sleep(200)
truthy(!t.lists().some((l) => l.id === lBiz), '清单已删除')
truthy(!t.todos().some((x) => x.id === doomed.id), '该清单下的任务被一并删除')
truthy(!!t.todos().find((x) => x.id === keep2.id), '别的清单的任务不受影响')

/* ---------- 删除分组:连带清单,任务移到收集箱,不留悬空 gid ---------- */
const gTest = t.groups().find((g) => g.name === '学习').id
await t.addList(gTest, '读书', '#3C9954')
const inGroup = await t.newTask({ title: '组内任务', date: t0, lid: t.lists().find((l) => l.name === '读书').id })
await t.flush()
await sleep(150)
document.querySelector(`[data-group-del="${gTest}"]`).click()
await sleep(150)
truthy(document.querySelector('[data-testid="confirm-dialog"]'), '删分组应先确认')
const gDetail = document.querySelector('[data-testid="confirm-dialog"] p').textContent
truthy(gDetail.includes('收集箱'), `确认框应说明任务去向(实际「${gDetail}」)`)
document.querySelector('[data-testid="confirm-ok"]').click()
await t.flush()
await sleep(200)
truthy(!t.groups().some((g) => g.id === gTest), '分组已删除')
truthy(!t.lists().some((l) => l.gid === gTest), '组内清单一并删除')
// 悬空 gid 会让清单整行不渲染、其任务无计数行 —— 必须没有
const dangling = t.lists().filter((l) => !t.groups().some((g) => g.id === l.gid))
eq(dangling.map((l) => l.id), [], '不得残留指向已删分组的清单')
const movedTodo = t.getState().todos.find((x) => x.id === inGroup.id)
truthy(!!movedTodo, '组内任务仍在')
eq(movedTodo.lid, '', '组内任务已改挂收集箱')

/* ---------- 拖拽排序:分组 ---------- */
const before = t.groups().map((g) => g.id)
const first = before[0]
const dragged = before[before.length - 1]
const draggedRow = document.querySelector(`[data-group="${dragged}"]`)
const firstRow = document.querySelector(`[data-group="${first}"]`)
truthy(firstRow && draggedRow, '分组行都已渲染')
// 落在第一行的上半部 = 排到最前
const yTop = firstRow.getBoundingClientRect().top + 2

const mk = (type, y) => {
  const ev = new DragEvent(type, { bubbles: true, cancelable: true, clientY: y, clientX: 10 })
  Object.defineProperty(ev, 'dataTransfer', {
    value: { setData() {}, getData() { return '' }, effectAllowed: 'move', dropEffect: 'move' }
  })
  return ev
}
draggedRow.dispatchEvent(mk('dragstart', 0))
await sleep(80)
firstRow.dispatchEvent(mk('dragover', yTop))
await sleep(80)
truthy(document.querySelector(`[data-group="${first}"].drop-above`), '落点应显示指示线')
firstRow.dispatchEvent(mk('drop', yTop))
await t.flush()
await sleep(200)
const after = t.groups().map((g) => g.id)
truthy(after.length === before.length, '分组数量不变')
// 把最后一个拖到最前:结果应与原来不同,且 order 仍连续
const reordered = [...t.groups()].sort((a, b) => a.order - b.order).map((g) => g.id)
eq(reordered, [before[before.length - 1], ...before.slice(0, -1)], '最后一个分组被拖到最前')
eq(t.groups().map((g) => g.order).sort((a, b) => a - b), before.map((_, i) => i + 1), 'order 仍连续')

/* ---------- 拖拽排序:清单跨组 ---------- */
const lA = t.lists()[0]
const targetGroup = t.groups().find((g) => g.id !== lA.gid)
truthy(!!targetGroup, '存在第二个分组可作为落点')
const rowA = document.querySelector(`[data-list="${lA.id}"]`)
const rowG = document.querySelector(`[data-group="${targetGroup.id}"]`)
truthy(rowA && rowG, '清单行与目标分组行已渲染')

rowA.dispatchEvent(mk('dragstart', 0))
await sleep(80)
// 落在分组行 = 移到该组末尾
rowG.dispatchEvent(mk('dragover', rowG.getBoundingClientRect().bottom - 2))
rowG.dispatchEvent(mk('drop', rowG.getBoundingClientRect().bottom - 2))
await t.flush()
await sleep(250)
eq(t.lists().find((l) => l.id === lA.id).gid, targetGroup.id, '清单已换组')
const inNewGroup = t.lists().filter((l) => l.gid === targetGroup.id)
eq(
  inNewGroup.map((l) => l.order).sort((a, b) => a - b),
  inNewGroup.map((_, i) => i + 1),
  '目标组 order 连续无空洞'
)
const oldGroupIds = t.lists().filter((l) => l.gid === lA.gid).map((l) => l.id)
assert(!oldGroupIds.includes(lA.id), '原组不再有该清单')

return {
  groups: t.groups().map((g) => g.name),
  lists: t.lists().map((l) => l.name),
  todosLeft: t.todos().length,
  dragReordered: reordered.length
}