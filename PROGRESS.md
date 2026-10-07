# 进度记录

## 当前状态

- 版本：0.7.3（`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml`，以及 npm/Cargo 锁文件的根包版本保持一致）
- 本地构建验证命令：日常 `npm run build:exe`（fast，产物 `src-tauri/target/fast/md-v.exe`）；发版 `npm run build:release`（release，产物 `src-tauri/target/release/md-v.exe`）
- 改动提交后双推：`git push gitee main && git push github main`
- Node：Vite 8 需要 Node ≥ 20（见 BUILDING.md）。系统 PATH 里的 `C:\software\node-v10.24.1-win-x64` 太老不可用；2026-09 起新版装在 `C:\software\node-v24.21.0-win-x64`（v24.21.0 LTS），构建时临时 `export PATH=/c/software/node-v24.21.0-win-x64:$PATH` 使用；如需全局切换，把系统 PATH 中的 node 目录改为该路径。

## 已完成

- 2026-10-07：预览里的本地 `.html`/`.htm` 链接从"当作文本打开"改为应用内浮层渲染。`src/links.ts` 新增 `isHtmlPath`，`src/main.ts` 的预览链接分流在图片分支之后增加 html 分支（先 `get_file_mtime` 确认文件存在，再弹浮层），新模块 `src/html-preview.ts` 用 `<iframe src=convertFileSrc(path)>` 加载；浮层工具栏给文件名、`openInBrowser`（用浏览器打开）、关闭（Esc）三个元素，链接里的 `#fragment` 追加到 iframe URL 以便直接定位锚点。样式与图片浮层共用一组选择器（`.image-preview, .html-preview` 等），iframe 底色固定为白——页面自身不设背景时不能透出暗色主题的背景。
- 本次决策（安全）：asset 协议下的 iframe 是跨源文档，而 Tauri 的 IPC 注入是 main-frame-only（`tauri-2.12.1/src/webview/mod.rs:949` 的 `for_main_frame_only: true`，`manager/webview.rs` 里 `__TAURI_INTERNALS__` 同样走 `main_frame_script`），页面脚本调不到 md-v 的任何命令，因此不再叠加 `sandbox` 属性，保留 localStorage/fetch 同目录文件等完整能力，尽量贴近浏览器表现。
- 本次决策（外部浏览器）：`opener` 插件的 `open_path` 受 ACL 路径 scope 约束（`Scope::is_path_allowed` 经 `tauri::fs::Scope` 做 glob 匹配），为避免赌 `**` 在 Windows canonicalize 后的 verbatim 路径（`\\?\C:\…`）上的匹配语义，改为在 Rust 侧新增命令 `open_in_default_app`（直接调 `tauri_plugin_opener::open_path`），与 `read_file`/`write_file` 等自有文件命令保持一致。
- 2026-10-07 桌面实测（截图落盘 + Read 看图，脚本在临时目录，非 MCP）发现并修掉两处：
  1. **相对资源全断**：`convertFileSrc` 把整条路径编码成单个 URL 段，而 asset 协议是把整个 URL path 百分号解码回文件路径，于是页面里 `01-overview.png` 这类相对链接解析到了协议根目录（`http://asset.localhost/01-overview.png`，404）。新增 `pageAssetUrl()`（`src/html-preview.ts`）：按段编码、保留 `/` 分隔符——Windows 得 `http://asset.localhost/C%3A/data/.../index.html`，POSIX/UNC 靠保留前导空段得到 `asset://localhost//Users/...`、`http://asset.localhost///srv/share/...`，这样 `new URL(rel, url)` 才落到同目录。回归见 `tests/html-preview.test.mjs`（含"解码回原路径"与相对解析断言）。
  2. **焦点进了页面后 Esc 失效**：跨源 iframe 的按键不会冒泡到父文档，`<dialog>` 收不到 cancel（窗口焦点在父文档时 Esc 正常）。改法：`tauri.conf.json` 主窗口声明加 `"create": false`，`src-tauri/src/lib.rs` 的 `setup` 用 `WebviewWindowBuilder::from_config` 重建窗口（标题/尺寸/居中不变，实测确认）并 `initialization_script_for_all_frames(ESCAPE_BRIDGE)`；桥接脚本只在子 frame 里监听 Escape → `parent.postMessage("md-v:escape")`，浮层校验 `event.source === frame.contentWindow` 后 `dialog.close()`。
- 实测逐项结论（Edge/WebView2，1280×752 窗口，200% 缩放）：浮层渲染出的 CSS/布局与三张 PNG 全部正常；点浮层内页间链接（index.html → 01-overview.html）正常跳转并被 iframe 承载；「用浏览器打开」把 `file:///C:/data/gitrepo/gitee/trana/docs/showcase/index.html` 交给默认浏览器 Edge；焦点点进页面后按 Esc 仍能关闭浮层并原样返回原文档；窗口改由 setup 创建后几何与标题无变化。
- 2026-10-07：图片浮层"适应窗口留白"→ 新增 `fill`（铺满窗口）并设为默认。用 WebView2 调试端口（`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9222` 启动 + CDP `Runtime.evaluate`，脚本见临时目录 `cdp.mjs`）量到真机数字：窗口视口 1280×752 CSS px、dpr 2.5，`.image-viewport` 1248×688，图片 1600×1000 → 旧算法 `min(1, 1248/1600, 688/1000)=0.688` 是按高度贴边、左右各留 74px 白。新 `fillScale = min(1, max(vw/iw, vh/ih))`（等比放大到覆盖视口，不放大比视口还小的图），`fitScale` 保留为缩小的下限，视图模式统一成 `fill`/`fit`/`actual`/`manual`（`src/image-view.ts`）；工具栏加「铺满窗口」，关闭前三个按钮分别是 铺满窗口/适应窗口/原始尺寸。回归 31/31。
- 2026-10-07：按用户要求把两个浮层（图片、本地网页）都改成**占满应用窗口**并按"扁一点"重做工具栏：`dialog` 设 `inset: 0; margin: 0; width/height: auto; max-width/height: none; border-radius: 0`（`<dialog>` 的 UA 样式有 `max-width: calc(100% - 6px - 2em)` 限制，必须显式覆盖），工具栏 `padding: 12px → 4px 10px`、按钮 `6px 12px → 2px 10px`、字号 12px。浮层不可能大于父窗口——`<dialog>` 的定位上下文就是 WebView 视口，再大就要另开系统窗口，所以"最大"即"铺满窗口"。顺带删掉 `images.ts`/`html-preview.ts` 里"点击浮层外部关闭"的处理：铺满窗口后该分支永远不触发，属死代码（关闭只剩 Esc 与工具栏按钮）。截图确认：网页浮层全窗口渲染正常、图片浮层默认适应窗口（01-overview.png 1600×1000 → 68.8%）、Esc 照常关闭。
- 工具备注（Windows 桌面自动化）：`SetForegroundWindow` 在别的进程占前台时会被系统拒绝，`AttachThreadInput` 也不保证管用，实测**用 Alt+Tab 切窗口最可靠**；`CopyFromScreen` 拍窗口区域时，别的窗口压在上面就会拍到别人（本次一次误判即源于此，Edge 全屏盖住了 md-v）。截图一律先确认前台进程再解读内容。
- 已知限制（如需接管再动 Rust）：浮层内点击 http(s) 外链会在该 iframe 里打开（对方站点带 `X-Frame-Options`/`frame-ancestors` 时会白屏），点 `.md` 链接显示原文，`target=_blank` 弹窗行为未定义——跨源 iframe 不能用 DOM 事件拦截；如要接管，可复用已有的 `ESCAPE_BRIDGE` 通道，在同一个全 frame 脚本里转发链接点击再由父层分流（外链送系统浏览器、`.md` 开标签）。
- 本次验证：`node --test tests/*.test.mjs` 27/27 通过（新增 1 项 `isHtmlPath` 分类）；`npm run build:exe` 通过（fast profile）。
- 2026-10-06：准备 v0.7.3 正式发布，包含本地文档链接、标签阅读位置恢复、图片浮层及滚轮缩放/拖动。版本与锁文件根包版本同步为 0.7.3，CHANGELOG 的 Unreleased 内容归档到版本段；本地使用 release 全量 LTO 构建，GitHub 按 v0.7.3 标签生成三平台绿色版产物。
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

- 本机 git **没有走系统代理**（系统代理为 `127.0.0.1:10808`），直连 `github.com:443` 会超时；推 GitHub 需要 `git -c http.proxy=http://127.0.0.1:10808 push github main`（gitee 不需要）。2026-10-07 遇到 GitHub 服务端对 ref 更新返回 500（`unpack ok` 后 `ng refs/heads/main`，响应带 `X-GitHub-Request-Id`，状态页却显示正常），直连/代理、新分支/快进都一样失败——**隔几分钟重试即恢复**，属对方瞬时故障，不是本地配置问题。
- pulldown-cmark 的 `ENABLE_YAML_STYLE_METADATA_BLOCKS` 选项并非只认文档开头：任何块起始处（顶格的）`---` 行，只要下一行非空且后续存在闭合 `---`/`...`，整段都会被当元数据剔除——正文中用 `---` 围起来的内容会被静默吞掉。因此 frontmatter 剔除采用手写的 `strip_yaml_frontmatter`（只认文档最开头），不启用该选项。
- Tauri 窗口不设置 `center` 时由 Windows 决定初始位置，多显示器/任务栏场景下表现不可控；窗口初始位置务必显式配置。
- `npm run tauri build` 后 `src-tauri/Cargo.toml` 会被 Tauri CLI 重写（feature injection，经 toml_edit 写出），即使内容无变化也落盘，且一律写成 LF；Windows 上 `core.autocrlf=true` 时表现为"仅换行符变化"的噪音 diff。上游 [tauri#8711](https://github.com/tauri-apps/tauri/issues/8711) 自 2024-01 起未修（cargo 对 `Cargo.lock` 有同类问题 [cargo#12897](https://github.com/rust-lang/cargo/issues/12897)）。已在仓库根加 `.gitattributes` 把 `*.toml`/`Cargo.lock` 钉死为 LF 防御；若 TortoiseGit 仍报该文件 modified 而 diff 为空，`git checkout -- <file>` 直接丢弃即可（内容从未变化）。
