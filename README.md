# 迷你待办 MiniTodo（Electron 版）

看板式待办管理工具，一套代码同时出 32/64 位安装包与便携版，覆盖内网 Win7 老机器与现代 Win10/11。

这是 [MiniTodo](https://github.com/KongValley/MiniTodo)（C# WinForms / .NET 3.5 单文件版）的 Electron 重写：功能对齐旧版，并加了看板拖拽、深色主题、托盘常驻、到期通知、子任务、重复任务、自动备份与导入导出。

![看板视图](docs/images/board-light.png)

## 特性

| 分类 | 内容 |
| --- | --- |
| 视图 | 分组 → 清单两级侧栏；看板（按日期分列，列内按优先级分组）与列表两种视图，`B` 切换 |
| 任务 | 标题、备注、日期（可「不排期」）、清单、优先级（高/中/低）、状态（待办/已完成/已放弃/回收站） |
| 增强 | **看板拖拽**改期与同优先级桶内排序、**深色/浅色主题**、**托盘常驻 + 到期通知**、**子任务清单**、**重复任务**、**自动备份 + 导入导出** |
| 数据 | `%APPDATA%\MiniTodoElectron\todos.json`，UTF-8 明文，可直接备份/编辑；每天自动备份到 `backups/`（保留最新 10 份） |
| 迁移 | 「文件 → 导入旧版数据…」默认指向 `%APPDATA%\MiniTodo\todos.json`，一次性导入旧版数据（导入前自动备份） |

## 快捷键

| 键 | 作用 |
| --- | --- |
| `N` | 新建任务 |
| `Enter` / `F2` | 打开选中任务（列表视图） |
| `Del` | 删除选中（回收站视图里是彻底删除） |
| `B` | 切换看板 / 列表 |
| `Ctrl+F` | 搜索 |
| `Esc` | 关闭弹窗 / 清空搜索 |
| `F5` | 刷新 |
| `1` `2` `3` `4` | 今天 / 明天 / 最近7天 / 所有 |
| 看板内滚轮 | 上下滚动鼠标所在列 |
| `Ctrl` + 滚轮 | 看板内左右滚动日期列 |
| 拖拽卡片 | 改期 / 同优先级桶内排序 |

## 界面

左侧是视图与清单（分组 → 清单两层，每行右侧显示条数）；顶栏是视图名、搜索、新建、视图切换、设置、快捷键；底部状态栏显示数据文件路径、今日待办数与快捷键提示。

窗口用系统原生标题栏。**关闭窗口 = 隐藏到托盘**（托盘常驻），真正退出走「文件 → 退出」或右键托盘图标 →「退出」。

<table>
<tr>
<td><img src="docs/images/board-dark.png" alt="深色看板"></td>
<td><img src="docs/images/list-light.png" alt="列表视图"></td>
</tr>
</table>

## 使用

### 安装版 / 便携版

`release/` 下按系统与架构分目录（内容相同，仅架构与命名不同；Win7 与 Win10 两套名称的构建都是 Electron 22）：

| 目录 | 适用 |
| --- | --- |
| `Win7-32位` / `Win7-64位` | Windows 7 SP1（32 位系统选 32 位包；64 位系统两种均可） |
| `Win10-32位` / `Win10-64位` | Windows 10 / 11 |

每个目录里含 `mini-todo-setup-<版本>-<平台>.exe`（安装版，可选安装目录、自动建桌面快捷方式）与 `mini-todo-portable-<版本>-<平台>.exe`（便携版，双击直接运行，无需安装）。

**Windows 7 前置要求**：需 **Windows 7 SP1**，并补装 `前置补丁/` 里的 4 个 `.msu`（安装顺序见该目录的《安装说明.txt》，先装 KB4490628 再装 KB4474419）。Win10 及以上系统无此要求。

### 数据

- 数据文件：`%APPDATA%\MiniTodoElectron\todos.json`（UTF-8 明文，无 BOM，可直接备份/编辑）
- 首次运行会写入一套示例数据；清空该文件后重启即回到示例数据
- 备份：`%APPDATA%\MiniTodoElectron\backups\todos-<时间戳>.json`，每天最多一份，保留最新 10 份
- 设置：`%APPDATA%\MiniTodoElectron\settings.json`（主题、到期提醒开关与时间）
- 数据文件损坏时不会静默覆盖：原文件改名保留为 `todos.json.corrupt-<时间戳>`，并提示原因
- 旧版数据（`%APPDATA%\MiniTodo\todos.json`）通过「文件 → 导入旧版数据…」导入，导入前自动备份当前数据

## 构建

```bash
npm install          # 需要 Node ≥ 18；Electron 二进制走 .npmrc 里的国内镜像
npm run dev          # 开发模式
npm run build        # typecheck + 构建到 out/
npm test             # 共享层纯函数自检（node --test，19 项）
npm run smoke        # 端到端冒烟（真 Electron 真窗口，16 项）
npm run icon         # 生成 resources/icon.png
```

打包（每架构一条，产物在 `release/<中文目录>/`）：

```bash
npm run dist:win7-32     # → release/Win7-32位/
npm run dist:win7-64     # → release/Win7-64位/
npm run dist:win10-32    # → release/Win10-32位/
npm run dist:win10-64    # → release/Win10-64位/
npm run dist             # 四个架构依次全打
```

Win7 目录里的「前置补丁」来自仓库根的 `win7-patches/`（该目录体积大、已 gitignore，首次打 Win7 包前需自行放入 4 个 `.msu`；缺目录时打包只提示不失败）。

## 代码结构

```
src/shared/types.ts       数据模型与常量（状态/优先级/视图名）
src/shared/dates.ts       日期工具（今天/加减/周几/标签/下次重复日期），本地时区
src/shared/query.ts       视图过滤与排序 —— 看板/列表/侧栏计数的唯一入口
src/shared/store-ops.ts   数据变更纯函数（不可变）+ normalizeStore 唯一信任边界
src/shared/api.ts         preload 契约与 IPC 通道名
src/shared/store-ops.test.ts  纯函数自检（node --test）

src/main/index.ts         窗口（原生边框）/ 托盘常驻 / 协议 / 启动流程
src/main/ipc.ts           IPC handler（统一 ok/error 兜底）+ 菜单导入导出
src/main/lib/store.ts     原子写 / 损坏文件隔离 / 每日备份 / 导入导出
src/main/lib/settings.ts  主题与提醒设置
src/main/lib/tray.ts      托盘与今日计数
src/main/lib/notify.ts    到期提醒（每分钟检查，同日不重复发）
src/main/lib/paths.ts     数据目录与文件路径
src/main/menu.ts          应用菜单
src/main/smoke.ts         无头冒烟工具

src/preload/index.ts      contextBridge 暴露 todoAPI
src/renderer/src/store/   数据源 / 界面状态 / 设置与主题
src/renderer/src/components/  侧栏 / 顶栏 / 状态栏 / 看板 / 列表 / 各弹窗
src/renderer/src/lib/     快捷键 / 多选状态
src/renderer/src/test-api.ts  冒烟用 window.__todoTest
scripts/run-smokes.mjs    冒烟运行器（16 步，含主进程侧断言）
scripts/smoke/step*.js    各步断言
scripts/package-win.mjs   单架构打包 + 前置补丁分发
```

## 已知限制

- 单机本地存储，没有同步/多端；换机器要手动拷 `todos.json` 或「导出数据」
- 不做分组/清单的增删改 UI（与旧版一致），清单结构来自数据文件或导入
- 看板列宽固定 300 px；卡片标题最多两行
- 提醒时间用本机时区，不处理跨时区
- 应用基于 Electron 22（Chromium 108）：这是为兼容 Win7 而选，现代机器上 Chromium 偏旧

## 许可

GPL-3.0-or-later
