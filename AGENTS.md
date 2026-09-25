# md-v 项目说明（供 AI 助手参考）

## 仓库与远程

- Gitee: https://gitee.com/minichen2000/md-v （远程名 `gitee`）
- GitHub: https://github.com/minichen2000/md-v （远程名 `github`）
- 每次改动提交后双推：`git push gitee main && git push github main`

## 构建与发布

- 每次改动后本地构建验证：`npm run tauri build -- --no-bundle`，产物 `src-tauri/target/release/md-v.exe`
- 只发布绿色单 exe/裸二进制（不要 NSIS 安装包，`tauri.conf.json` 的 `bundle.targets` 保持 `[]`）
- Release 由 GitHub Actions 构建：`.github/workflows/release.yml` 在推送 `v*` tag 时触发，构建 Windows/macOS/Linux 三平台产物并自动创建 GitHub Release；平时推 main 不触发 CI
- 发版流程：
  1. 更新版本号：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 三处保持一致
  2. 提交并双推 main；打 tag 并双推：`git tag vX.Y.Z && git push gitee vX.Y.Z && git push github vX.Y.Z`
  3. tag 推到 github 后 CI 自动出三平台 Release，用 `gh run list -R minichen2000/md-v` 确认通过

## 技术栈

- Tauri 2 + Vite + TypeScript 前端（CodeMirror 6 编辑器）
- 前端版本号由 `vite.config.ts` 的 `define.__APP_VERSION__` 从 `package.json` 注入
- 单实例：`tauri-plugin-single-instance`，二次启动把文件路径发 `open-files` 事件给前端开新标签
- 本机访问 github.com 依赖 hosts 条目 `140.82.112.3 github.com`（网络间歇性干扰，失败时重试即可）
