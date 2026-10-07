// 步骤 3:落盘 → 重载往返;转义
const t = window.__todoTest
const tricky = '含"引号"与\\反斜杠 and 中文'
const created = await t.newTask({ title: tricky, note: tricky, date: '', prio: 1 })
await t.flush()
await t.reload()
const after = t.getState().todos.find((x) => x.id === created.id)
truthy(after, '重载后任务丢失')
eq(after.title, tricky, '标题转义往返')
eq(after.note, tricky, '备注转义往返')
eq(after.prio, 1, '优先级往返')
eq(after.date, '', '空日期往返')
return { id: after.id, count: t.getState().todos.length }
