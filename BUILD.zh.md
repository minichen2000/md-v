# 构建说明

[English](BUILD.md) | 简体中文

本文档描述如何从源码构建 md-v，包含国内网络环境下的实测踩坑记录。

## 环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | ≥ 20，推荐 24 LTS | 前端构建（Vite）。低于 18 无法运行现代工具链 |
| Rust | stable（rustup 安装） | 后端与打包。安装：https://rustup.rs |
| Visual Studio C++ Build Tools | 2019+ | MSVC 链接器，Rust MSVC toolchain 必需。安装时勾选「使用 C++ 的桌面开发」 |
| WebView2 | Windows 10/11 一般已内置 | 缺失时手动安装 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2) |

## 构建步骤

`tests/image-view.test.mjs` 覆盖图片指针中心缩放、倍率上下限、拖动边界、窗口变化、指针取消与事件清理。桌面/浏览器界面自动操作必须先获得用户明确同意；代码测试和构建可直接执行。

用 Node 24 执行 `node --test tests/*.test.mjs`，验证链接路由、标签生命周期/滚动状态及图片识别。界面回归：将 Markdown 滚动到中段，点本地文档链接后切回原标签（另测关闭目标标签），确认两侧位置均恢复；点击图片链接，切换原始尺寸/适应窗口，再按 Esc，原文档位置应保持。

```bash
# 1. 安装前端依赖
npm install

# 2. 开发调试（热更新）
npm run tauri dev

# 3. 类型检查 + 前端构建（快速验证）
npm run build
cd src-tauri && cargo check

# 4. 日常构建（fast 配置，快速，用于开发验证）
npm run build:exe        # → src-tauri/target/fast/md-v.exe

# 5. 发布构建（release 全量 LTO，正式发版时再用）
npm run build:release    # → src-tauri/target/release/md-v.exe
```

产物：

| 产物 | 路径 | 用途 |
|---|---|---|
| 绿色版主程序 | `src-tauri/target/release/md-v.exe` | 双击即用，唯一分发的产物 |

## 国内网络加速（踩坑记录）

### crates.io 拉取超时

项目已内置 rsproxy 镜像：`src-tauri/.cargo/config.toml`，仅对本项目生效，开箱即用。

## 图标再生成

图标源文件为 `assets-src/icon.svg`，修改后重新生成全套图标：

```bash
node scripts/make-icon.mjs        # SVG → 1024px PNG（@resvg/resvg-js）
npx tauri icon assets-src/icon.png  # 生成 ico/icns/各尺寸 png 到 src-tauri/icons/
```

## 免安装注册右键菜单

绿色版用户也可不用应用内注册，改用注册表脚本：

1. 编辑 `scripts/register-md-v.reg`，把 3 处 `C:\\Path\\To\\md-v.exe` 替换为 exe 实际路径（注意双反斜杠）
2. 双击导入（写 HKCU，免管理员）
3. 卸载：删除 `HKCU\Software\Classes\.md`、`.markdown` 的默认值与 `HKCU\Software\Classes\md-v.md` 整键

> 推荐方式仍是应用内 ⚙ →「添加右键菜单」，exe 移动后重新点一次即可自愈。

## 测试夹具

- `test-fixtures/full-featured.md`：覆盖 GFM 表格/任务列表/代码高亮/KaTeX/Mermaid/脚注，用于渲染回归验证
- `test-fixtures/large.md`：约 2 MB、2000 章节，用于大文件打开与滚动性能验证

## 版本号规范

发布前需三处同步 bump：

- `package.json` → `version`
- `src-tauri/tauri.conf.json` → `version`
- `src-tauri/Cargo.toml` → `version`
