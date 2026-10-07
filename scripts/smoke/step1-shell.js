// 步骤 1:应用外壳渲染
const t = window.__todoTest
truthy(t, '测试 API 未安装')
eq(document.title, '迷你待办', '窗口标题')
const q = (sel) => !!document.querySelector(sel)
truthy(q('[data-testid="sidebar"]'), '侧栏存在')
truthy(q('[data-testid="topbar"]'), '顶栏存在')
truthy(q('[data-testid="board"]'), '看板存在')
truthy(q('[data-testid="statusbar"]'), '状态栏存在')
eq(t.getView(), 'week7', '初始视图')
const cols = t.boardColumns()
truthy(cols.length > 0, '示例数据应有排期任务成列')
return { title: document.title, view: t.getView(), columns: cols.length, cards: document.querySelectorAll('[data-card]').length }
