# 进度记录

## 当前状态

- 版本：0.7.2（`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` 三处保持一致）
- 本地构建验证命令：日常 `npm run build:exe`（fast，产物 `src-tauri/target/fast/md-v.exe`）；发版 `npm run build:release`（release，产物 `src-tauri/target/release/md-v.exe`）
- 改动提交后双推：`git push gitee main && git push github main`
- Node：Vite 8 需要 Node ≥ 20（见 BUILDING.md）。系统 PATH 里的 `C:\software\node-v10.24.1-win-x64` 太老不可用；2026-09 起新版装在 `C:\software\node-v24.21.0-win-x64`（v24.21.0 LTS），构建时临时 `export PATH=/c/software/node-v24.21.0-win-x64:$PATH` 使用；如需全局切换，把系统 PATH 中的 node 目录改为该路径。

## 已完成

- 2026-10-06：图片预览新增滚轮缩放与左键拖动。`src/image-view.ts` 保存倍率/位移，滚轮以指针所在图像位置为锚点（触及边界时夹紧），小图居中、大图允许拖至各边缘；显示百分比，适应窗口与原始尺寸按钮均可居中复位。支持窗口尺寸变化、pointer capture/cancel 与关闭后事件/ResizeObserver 清理；禁用图片原生拖放，滚轮不会传到文档。按用户偏好仅运行代码回归与构建，不使用 Computer Use。
- 本次验证：`node --test tests/*.test.mjs` 26/26 通过，新增 6 项覆盖指针锚点、倍率与边界、窗口变化、滚轮/指针事件、取消和销毁清理；`npm run build:exe` 通过（fast，1m 01s，产物 `src-tauri/target/fast/md-v.exe`）。12 个改动文本 UTF-8 检查和 `git diff --check` 通过；未进行桌面自动操作。
- 2026-10-06：跟进本地链接的阅读位置与图片问题。`TabStore.add()` 原先提前设置 activeId，导致激活流程取不到离开的标签；现在由 UI 显式激活，并分别保存编辑区 `scrollTop` 和 `previewScrollTop`。预览渲染加入代次检查与布局后位置恢复，屏蔽恢复引发的双向同步，图片加载/图表完成后补偿布局变化，用户主动滚动后停止补偿。关闭活动标签也经显式激活恢复相邻标签。
- 本地图片按扩展名分流到 `src/images.ts`：asset URL 交给系统 WebView 显示，免 UTF-8 解码；浮层提供适应窗口/原始尺寸、文件名/像素尺寸、Esc/关闭按钮，损坏或不支持的图片显示错误。已有文档标签直接复用，保留未保存内容；新增 4 项回归（共 20 项通过）。测试说明补入构建文档，并按现行命名迁移为 `BUILD.md` / `BUILD.zh.md`。
- 图片分流仅作用于预览链接；通过文件对话框/拖放打开 SVG 时仍可编辑源码。桌面验证：原 README 末尾点击 `_模板.md` 后，点击原标签返回和关闭目标标签返回均恢复编辑区（顶部约第 20 行）与预览区的位置；实际中文 PNG（1915 × 821）成功显示，原始尺寸切换正常，Esc 关闭后原位置保持。首次 fast 构建因旧 exe 占用失败，关闭旧窗口后构建通过。
- 最终验证：`node --test tests/*.test.mjs` 20/20 通过；`npm run build:exe` 成功（fast，45.57s，`src-tauri/target/fast/md-v.exe`），14 个改动文本 UTF-8 无 BOM/替换字符检查通过。桌面关键流程验证完成后，用户按物理 Esc 停止 Computer Use，此后未再进行桌面自动操作。
- 2026-10-06：修复预览点击本地文件链接后回到初始页。原点击处理只接管 http(s)/mailto 与页内锚点，相对路径落入 WebView 默认导航；新增 `src/links.ts` 统一阻止默认跳转，按源文档目录解析本地链接并交给标签打开流程，保留原文档，读取失败沿用错误提示。兼容中文、URL 编码、父目录、Windows/Unix 绝对路径、UNC、file URL 与跨文档锚点；未保存文档提示先保存。新增路径和点击失败回归测试；中文 README 按现行约定改名为 `README.zh.md`。
- 本次验证：截图目标文件存在（15,142 字节）；`node --test tests/links.test.mjs` 16/16 通过，包含点击/中键同步取消导航与异步读取失败；`npm run build:exe` 通过（fast，Rust 构建 1m 04s，产物 `src-tauri/target/fast/md-v.exe`）。沙箱构建访问 dist 被拒后在沙箱外重跑成功；Vite 仅有既存的动态/静态重复导入提示。9 个改动文本文件 UTF-8 无 BOM/替换字符检查通过。未进行桌面界面实点验证。
- 2026-09：渲染支持 YAML frontmatter——`src-tauri/src/lib.rs` 的 `render_markdown` 增加 `extract_yaml_frontmatter` + `render_frontmatter_table`：文档最开头（容忍 BOM、CRLF）正确闭合的 `---`/`...` 元数据块用 serde_yml 解析为键值表格渲染在正文上方（GitHub 风格，样式在 `src/styles.css` 的 `table.frontmatter`）；解析失败（非 mapping 结构、语法错误）回退为原文渲染。预览/导出 HTML/导出 PDF 自动一致。
- 2026-09：修复主窗口启动位置——`tauri.conf.json` 增加 `"center": true`（此前未设置，Windows 默认级联摆放导致偏左偏下）；默认高度 800 → 752，避免贴到任务栏。
- 2026-09：建立 `CHANGELOG.md` / `PROGRESS.md`，补齐记录文件约定。
- 2026-09：新增 `.gitattributes`（`* text=auto`，`*.toml`/`Cargo.lock` 固定 LF），消除 Tauri CLI 构建重写 `Cargo.toml` 导致的换行符噪音 diff（见已知坑）。
- 2026-09：外观微调——默认字号 14 → 15（`src/settings.ts`）；预览区行间距 1.6 → 2.2、全局字体栈改为 `v-sans, system-ui, …`（`src/styles.css`）。
- 2026-10：修复直接双击启动（无已打开文件）时 tab 栏没有 `+` 按钮、无法新建文件——`src/main.ts` 启动流程补一次 `refreshTabBar()`（此前仅在激活/切换标签时渲染 tab 栏，空标签时 `#tabbar` 为空）。
- 2026-10：块引用（`>`）内多行软换行改按换行显示——`src/styles.css` 的 `#preview-pane blockquote` 加 `white-space: pre-line`（pulldown-cmark 已把软换行输出为文本节点里的 `\n`，默认 `white-space: normal` 被浏览器折叠成空格）。预览/导出 HTML/导出 PDF 一致生效（导出经 `collectAppCss()` 收集 styles.css 规则）。
- 2026-10：最近文件菜单支持单条删除——底层 `removeRecent`（`src/recent.ts`）早已存在，本次接 UI：`src/main.ts` 的 `MenuEntry` 增加 `onRemove` 字段，`openMenu` 对带 `onRemove` 的条目渲染右侧 hover 显示 × 按钮（`icons.x`，点击 `stopPropagation` 后调 `removeRecent` 并重开菜单原地刷新，避免冒泡触发"打开"）；样式 `.menu-label`/`.menu-remove` 在 `src/styles.css`；文案 `removeFromRecent` 在 `src/i18n.ts`。点条目正文仍是打开文件，只有精确点到 × 才删除。× 按钮用 `visibility` 占位（始终占 20px 宽、`hover` 才可见），而非 `display:none↔flex` 切换，避免菜单 `width:max-content` 随 hover 不同路径长度而抖动。
- 2026-10：构建档对齐全局约定——`src-tauri/Cargo.toml` 新增 `[profile.fast]`（inherits release，关 LTO、`codegen-units=16`、不 strip）；`package.json` 新增 `build:exe`（`tauri build --no-bundle -- --profile fast`）与 `build:release`（`tauri build --no-bundle`）。日常验证编 fast，发版才 release；只产绿色版 exe、不出安装包（`bundle.targets` 保持 `[]`）。

## 待办

- （暂无）

## 已知坑

- pulldown-cmark 的 `ENABLE_YAML_STYLE_METADATA_BLOCKS` 选项并非只认文档开头：任何块起始处（顶格的）`---` 行，只要下一行非空且后续存在闭合 `---`/`...`，整段都会被当元数据剔除——正文中用 `---` 围起来的内容会被静默吞掉。因此 frontmatter 剔除采用手写的 `strip_yaml_frontmatter`（只认文档最开头），不启用该选项。
- Tauri 窗口不设置 `center` 时由 Windows 决定初始位置，多显示器/任务栏场景下表现不可控；窗口初始位置务必显式配置。
- `npm run tauri build` 后 `src-tauri/Cargo.toml` 会被 Tauri CLI 重写（feature injection，经 toml_edit 写出），即使内容无变化也落盘，且一律写成 LF；Windows 上 `core.autocrlf=true` 时表现为"仅换行符变化"的噪音 diff。上游 [tauri#8711](https://github.com/tauri-apps/tauri/issues/8711) 自 2024-01 起未修（cargo 对 `Cargo.lock` 有同类问题 [cargo#12897](https://github.com/rust-lang/cargo/issues/12897)）。已在仓库根加 `.gitattributes` 把 `*.toml`/`Cargo.lock` 钉死为 LF 防御；若 TortoiseGit 仍报该文件 modified 而 diff 为空，`git checkout -- <file>` 直接丢弃即可（内容从未变化）。
