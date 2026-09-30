# 进度记录

## 当前状态

- 版本：0.7.1（`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` 三处保持一致）
- 本地构建验证命令：`npm run tauri build -- --no-bundle`，产物 `src-tauri/target/release/md-v.exe`
- 改动提交后双推：`git push gitee main && git push github main`
- Node：Vite 8 需要 Node ≥ 20（见 BUILDING.md）。系统 PATH 里的 `C:\software\node-v10.24.1-win-x64` 太老不可用；2026-09 起新版装在 `C:\software\node-v24.21.0-win-x64`（v24.21.0 LTS），构建时临时 `export PATH=/c/software/node-v24.21.0-win-x64:$PATH` 使用；如需全局切换，把系统 PATH 中的 node 目录改为该路径。

## 已完成

- 2026-09：渲染支持 YAML frontmatter——`src-tauri/src/lib.rs` 的 `render_markdown` 增加 `extract_yaml_frontmatter` + `render_frontmatter_table`：文档最开头（容忍 BOM、CRLF）正确闭合的 `---`/`...` 元数据块用 serde_yml 解析为键值表格渲染在正文上方（GitHub 风格，样式在 `src/styles.css` 的 `table.frontmatter`）；解析失败（非 mapping 结构、语法错误）回退为原文渲染。预览/导出 HTML/导出 PDF 自动一致。
- 2026-09：修复主窗口启动位置——`tauri.conf.json` 增加 `"center": true`（此前未设置，Windows 默认级联摆放导致偏左偏下）；默认高度 800 → 752，避免贴到任务栏。
- 2026-09：建立 `CHANGELOG.md` / `PROGRESS.md`，补齐记录文件约定。
- 2026-09：新增 `.gitattributes`（`* text=auto`，`*.toml`/`Cargo.lock` 固定 LF），消除 Tauri CLI 构建重写 `Cargo.toml` 导致的换行符噪音 diff（见已知坑）。
- 2026-09：外观微调——默认字号 14 → 15（`src/settings.ts`）；预览区行间距 1.6 → 2.2、全局字体栈改为 `v-sans, system-ui, …`（`src/styles.css`）。

## 待办

- （暂无）

## 已知坑

- pulldown-cmark 的 `ENABLE_YAML_STYLE_METADATA_BLOCKS` 选项并非只认文档开头：任何块起始处（顶格的）`---` 行，只要下一行非空且后续存在闭合 `---`/`...`，整段都会被当元数据剔除——正文中用 `---` 围起来的内容会被静默吞掉。因此 frontmatter 剔除采用手写的 `strip_yaml_frontmatter`（只认文档最开头），不启用该选项。
- Tauri 窗口不设置 `center` 时由 Windows 决定初始位置，多显示器/任务栏场景下表现不可控；窗口初始位置务必显式配置。
- `npm run tauri build` 后 `src-tauri/Cargo.toml` 会被 Tauri CLI 重写（feature injection，经 toml_edit 写出），即使内容无变化也落盘，且一律写成 LF；Windows 上 `core.autocrlf=true` 时表现为"仅换行符变化"的噪音 diff。上游 [tauri#8711](https://github.com/tauri-apps/tauri/issues/8711) 自 2024-01 起未修（cargo 对 `Cargo.lock` 有同类问题 [cargo#12897](https://github.com/rust-lang/cargo/issues/12897)）。已在仓库根加 `.gitattributes` 把 `*.toml`/`Cargo.lock` 钉死为 LF 防御；若 TortoiseGit 仍报该文件 modified 而 diff 为空，`git checkout -- <file>` 直接丢弃即可（内容从未变化）。
