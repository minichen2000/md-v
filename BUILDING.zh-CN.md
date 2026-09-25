# 构建说明

[English](BUILDING.md) | 简体中文

本文档描述如何从源码构建 md-v，包含国内网络环境下的实测踩坑记录。

## 环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| Node.js | ≥ 20，推荐 24 LTS | 前端构建（Vite）。低于 18 无法运行现代工具链 |
| Rust | stable（rustup 安装） | 后端与打包。安装：https://rustup.rs |
| Visual Studio C++ Build Tools | 2019+ | MSVC 链接器，Rust MSVC toolchain 必需。安装时勾选「使用 C++ 的桌面开发」 |
| WebView2 | Windows 10/11 一般已内置 | 缺失时运行 NSIS 安装包会自动引导安装；或手动装 [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2) |

## 构建步骤

```bash
# 1. 安装前端依赖
npm install

# 2. 开发调试（热更新）
npm run tauri dev

# 3. 类型检查 + 前端构建（快速验证）
npm run build
cd src-tauri && cargo check

# 4. 发布构建
npm run tauri build
```

产物：

| 产物 | 路径 | 用途 |
|---|---|---|
| 绿色版主程序 | `src-tauri/target/release/md-v.exe` | 双击即用，日常分发 |
| NSIS 安装包 | `src-tauri/target/release/bundle/nsis/md-v_x.x.x_x64-setup.exe` | 安装/卸载、自动注册文件关联 |

## 国内网络加速（踩坑记录）

### crates.io 拉取超时

项目已内置 rsproxy 镜像：`src-tauri/.cargo/config.toml`，仅对本项目生效，开箱即用。

### NSIS 工具链下载卡死（重点）

`tauri build` 编译完成后，还需从 GitHub Releases 下载 NSIS 打包工具（`nsis-3.11.zip`、`nsis_tauri_utils.dll`）。国内直连 GitHub 经常**无任何输出地卡死**（现象：编译已完成、没有 rustc 进程、构建看似挂起）。

解决：设置 bundler 镜像环境变量后再构建：

```bash
# Git Bash
TAURI_BUNDLER_TOOLS_GITHUB_MIRROR=https://ghfast.top/ npm run tauri build
```

```powershell
# PowerShell
$env:TAURI_BUNDLER_TOOLS_GITHUB_MIRROR="https://ghfast.top/"; npm run tauri build
```

镜像只需成功下载一次，之后有本地缓存，构建约 3 分钟即可完成。

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
