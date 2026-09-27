# 进度记录

## 当前状态

- 版本：0.6.0（`package.json` / `src-tauri/tauri.conf.json` / `src-tauri/Cargo.toml` 三处保持一致）
- 本地构建验证命令：`npm run tauri build -- --no-bundle`，产物 `src-tauri/target/release/md-v.exe`
- 改动提交后双推：`git push gitee main && git push github main`

## 已完成

- 2026-09：修复主窗口启动位置——`tauri.conf.json` 增加 `"center": true`（此前未设置，Windows 默认级联摆放导致偏左偏下）；默认高度 800 → 752，避免贴到任务栏。
- 2026-09：建立 `CHANGELOG.md` / `PROGRESS.md`，补齐记录文件约定。

## 待办

- （暂无）

## 已知坑

- Tauri 窗口不设置 `center` 时由 Windows 决定初始位置，多显示器/任务栏场景下表现不可控；窗口初始位置务必显式配置。
