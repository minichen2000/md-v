# md-v 项目说明（供 AI 助手参考）

## 仓库与远程

- Gitee: https://gitee.com/minichen2000/md-v （远程名 `gitee`）
- GitHub: https://github.com/minichen2000/md-v （远程名 `github`）
- 日常推送需同时推两个远程：`git push gitee <branch>` 和 `git push github <branch>`

## 发布流程

1. 更新版本号：`package.json`、`src-tauri/tauri.conf.json`、`src-tauri/Cargo.toml` 三处保持一致
2. 提交并打 tag：`git tag vX.Y.Z`
3. 推送 tag 到两个远程：`git push gitee vX.Y.Z && git push github vX.Y.Z`
4. 推到 GitHub 的 `v*` tag 会触发 `.github/workflows/release.yml`，自动构建并发布 Release：
   - Windows: NSIS 安装包（.exe）
   - macOS: .dmg
   - Linux: .deb + .AppImage

## 技术栈

- Tauri 2 + Vite + TypeScript 前端（CodeMirror 6 编辑器）
- 前端版本号由 `vite.config.ts` 的 `define.__APP_VERSION__` 从 `package.json` 注入
- 本机访问 github.com 依赖 hosts 条目 `140.82.112.3 github.com`（网络间歇性干扰，失败时重试即可）
