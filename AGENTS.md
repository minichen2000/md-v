# md-v 项目说明（供 AI 助手参考）

## 仓库与远程

- Gitee: https://gitee.com/minichen2000/md-v （远程名 `gitee`）
- GitHub: https://github.com/minichen2000/md-v （远程名 `github`）
- 每次改动提交后双推：`git push gitee main && git push github main`

## 构建与发布

- 每次改动后本地构建验证：日常用 `npm run build:exe`（fast profile，增量快，产物 `src-tauri/target/fast/md-v.exe`）；正式发版才用 `npm run build:release`（release 全量 LTO，产物 `src-tauri/target/release/md-v.exe`）
- 只发布绿色单 exe/裸二进制（不要 NSIS 安装包，`tauri.conf.json` 的 `bundle.targets` 保持 `[]`）
- Release 由 GitHub Actions 构建：`.github/workflows/release.yml` 在推送 `v*` tag 时触发，构建 Windows/macOS/Linux 三平台产物并自动创建 GitHub Release；平时推 main 不触发 CI
- 发版流程：
  1. 更新版本号：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 三处保持一致
  2. 提交并双推 main；打 tag 并双推：`git tag vX.Y.Z && git push gitee vX.Y.Z && git push github vX.Y.Z`
  3. tag 推到 github 后 CI 自动出三平台 Release，用 `gh run list -R minichen2000/md-v` 确认通过

## 技术栈

- Tauri 2 + Vite + TypeScript 前端（CodeMirror 6 编辑器）
- 通用文本支持：`src/langs.ts` 按后缀识别语言，所有非 md 的 CodeMirror 语言包动态 import 懒加载（exe 内嵌资源，零网络）；非 md 文件为 plain 模式（无渲染区/TOC/导出，编辑区独占）
- 右键注册：.md/.markdown 走 ProgID 完整关联；其它文件用 `HKCU\Software\Classes\*\shell\Open with md-v` 通配 verb（全文件生效，不动默认关联）；`LEGACY_EXTRA_EXTS` 仅用于卸载时清理旧版逐后缀注册
- 前端版本号由 `vite.config.ts` 的 `define.__APP_VERSION__` 从 `package.json` 注入
- 单实例：`tauri-plugin-single-instance`，二次启动把文件路径发 `open-files` 事件给前端开新标签
- 预览链接统一经 `src/links.ts` 拦截默认导航：本地路径以当前文档为基准，图片由 `src/images.ts`、本地 `.html`/`.htm` 由 `src/html-preview.ts` 用 asset URL 浮层显示，两者都不得送入 UTF-8 文本读取；其它本地文档复用标签打开流程，禁止回退到 WebView 页面跳转。回归用 `node --test tests/*.test.mjs`（Node 24）。
- 网页浮层（`src/html-preview.ts`）刻意不加 iframe `sandbox`：Tauri 的 IPC 只注入主 frame，跨源 iframe 里的页面脚本触达不到 md-v 命令；浮层的「用浏览器打开」走自有命令 `open_in_default_app`（内部 `tauri_plugin_opener::open_path`），不经 opener 插件的 ACL 路径 scope——加权限或改回 `openPath` 前先看 PROGRESS.md 的说明。
- `TabStore.add()` 不激活标签；`remove()` 返回候选标签 ID，交给 UI 显式激活。切换前分别保存编辑区/预览区滚动位置；异步预览须校验渲染代次，恢复位置期间禁止滚动同步反向覆盖。
- 图片缩放/平移由 `src/image-view.ts` 统一维护几何状态与指针捕获；滚轮以指针为中心缩放，平移限制在图像边界，关闭浮层须释放事件和 ResizeObserver。
- frontmatter：文档开头正确闭合的 YAML frontmatter 由 Rust 侧 serde_yml 解析为键值表格渲染在正文上方；解析失败回退原文渲染（详见 PROGRESS.md 已知坑：不用 pulldown-cmark 的 ENABLE_YAML_STYLE_METADATA_BLOCKS 选项）
- 行尾：`.gitattributes` 已把 `*.toml`/`Cargo.lock` 钉死为 LF——Tauri CLI 构建时会用 LF 重写 `Cargo.toml`（上游 tauri#8711 未修），Windows 上 `core.autocrlf=true` 会产生换行符噪音 diff，勿删该文件
