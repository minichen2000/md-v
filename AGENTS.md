# md-v 项目说明（供 AI 助手参考）

## 仓库与远程

- Gitee: https://gitee.com/minichen2000/md-v （远程名 `gitee`）
- GitHub: https://github.com/minichen2000/md-v （远程名 `github`）
- 每次改动提交后双推：`git push gitee main && git push github main`

## 构建与发布（无 CI，全本地）

- 不使用 GitHub Actions；每次改动后本地构建验证：`npm run tauri build -- --no-bundle`，产物 `src-tauri/target/release/md-v.exe`
- 只发布 Windows 绿色单 exe（不要 NSIS 安装包，`tauri.conf.json` 的 `bundle.targets` 保持 `[]`）
- 发版流程：
  1. 更新版本号：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 三处保持一致
  2. 提交并双推 main；打 tag 并双推：`git tag vX.Y.Z && git push gitee vX.Y.Z && git push github vX.Y.Z`
  3. 本地构建后上传绿色 exe：
     `gh release create vX.Y.Z md-v-X.Y.Z-windows-x86_64.exe -R minichen2000/md-v --title "md-v vX.Y.Z" --notes "..."`

## 技术栈

- Tauri 2 + Vite + TypeScript 前端（CodeMirror 6 编辑器）
- 前端版本号由 `vite.config.ts` 的 `define.__APP_VERSION__` 从 `package.json` 注入
- 单实例：`tauri-plugin-single-instance`，二次启动把文件路径发 `open-files` 事件给前端开新标签
- 本机访问 github.com 依赖 hosts 条目 `140.82.112.3 github.com`（网络间歇性干扰，失败时重试即可）
