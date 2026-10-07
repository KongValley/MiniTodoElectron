// 步骤 7:UI 新建(空标题被拒) → 落盘 → 重载存在;编辑日期;删除进回收站
const t = window.__todoTest
await t.importJson(JSON.stringify({ groups: [], lists: [], todos: [] }))
await t.flush()

t.openNew()
await new Promise((r) => setTimeout(r, 100))
const saveBtn = document.querySelector('[data-testid="dlg-save"]')
truthy(saveBtn, '保存按钮存在')
eq(saveBtn.disabled, true, '空标题时保存禁用')
const titleInput = document.querySelector('[data-testid="dlg-title"]')
titleInput.value = '写周报'
titleInput.dispatchEvent(new Event('input', { bubbles: true }))
await new Promise((r) => setTimeout(r, 80))
eq(saveBtn.disabled, false, '填了标题后保存可用')
saveBtn.click()
await new Promise((r) => setTimeout(r, 150))
await t.flush()

eq(t.dialog(), null, '保存后弹窗关闭')
const created = t.getState().todos.find((x) => x.title === '写周报')
truthy(created, 'UI 新建未落库')
await t.reload()
truthy(t.getState().todos.find((x) => x.id === created.id), '重载后任务仍在')

await t.editTask(created.id, { date: '2030-01-02' })
await t.flush()
eq(t.getState().todos.find((x) => x.id === created.id).date, '2030-01-02', '编辑日期生效')

await t.remove([created.id], false)
await t.flush()
eq(t.getState().todos.find((x) => x.id === created.id).status, 3, '删除后状态为回收站')
return { emptyDisabled: true, edited: '2030-01-02' }
