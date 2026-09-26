# md-v

[English](README.md) | 简体中文

<p align="center"><img src="assets-src/icon.png" width="128" alt="md-v 图标"></p>

**md-v** 是一个以「快」为第一目标的 Markdown 浏览/编辑器：启动快、渲染快、滚动快。
基于 **Tauri v2**（Rust + 系统 WebView），单文件 exe 仅约 4 MB，运行内存约 40 MB，全部资源本地打包、零网络加载。

## 特性

- **左编辑右渲染**：左侧 CodeMirror 6 源码编辑（语法高亮、行号、自动换行），右侧实时渲染，分栏比例可拖拽并记忆
- **通用文本查看/编辑**：打开 json / xml / yaml / toml / ini / sh / ps1 / py / js / ts / html / css / sql / rust / c / c++ / java / php / diff 等文本文件时，自动按后缀切换语法高亮与代码折叠（语言包按需从本地资源加载，零网络），编辑区独占全宽，可编辑可保存
- **现代 Markdown 渲染**：Rust 侧 pulldown-cmark 解析 GFM（表格/任务列表/删除线/脚注），highlight.js 代码高亮，KaTeX 数学公式，Mermaid 图表（懒加载，不含图表的文档零开销）
- **多 Tab**：同时打开多个文件，未保存显示 ●，支持拖拽打开
- **同步滚动**：编辑区与预览区比例联动，可开关
- **大纲 TOC**：h1~h4 目录侧栏，点击跳转、滚动高亮当前章节
- **导出**：一键导出独立 HTML（内联样式与字体，离线可开）/ PDF（系统打印）
- **个性化**：浅/暗主题、字体缩放（Ctrl+滚轮）、中文/English 界面，设置自动持久化
- **系统集成**：`.md` 文件关联与资源管理器右键「Open with md-v」（应用内一键注册/移除，免管理员）；右键项对**所有文件**生效（通配注册），不改变任何后缀的默认打开方式
- **文件守护**：磁盘文件被外部修改时提示重新加载，避免覆盖丢失

## 快捷键

| 快捷键 | 功能 |
|---|---|
| Ctrl + O | 打开文件 |
| Ctrl + S | 保存 |
| Ctrl + T | 新建 Tab |
| Ctrl + W | 关闭当前 Tab |
| Ctrl + 滚轮 | 缩放字体 |

## 安装与使用

从 [GitHub Releases](../../releases) 下载：

- **Windows**：下载 `md-v-vX.Y.Z-windows-x86_64.exe`，绿色单文件，放到任意目录双击即用。首次运行可能弹出蓝色「Windows 已保护你的电脑」（Microsoft Defender SmartScreen）提示——这是因为小开源项目没有购买商业代码签名证书，属正常现象，并非病毒；点「更多信息」→「仍要运行」即可，只需操作一次。
- **macOS / Linux**：下载 `.tar.gz` 解压后 `chmod +x` 再运行；macOS 如提示无法打开，先执行一次 `xattr -d com.apple.quarantine <二进制文件>`。

直接运行 `md-v.exe`，然后在应用内 ⚙ 菜单点「添加右键菜单」即可注册文件关联（写 HKCU，免管理员，可随时移除）。

## 构建

详见 **[BUILDING.zh-CN.md](BUILDING.zh-CN.md)**（含国内网络加速的踩坑记录）。简要：

```bash
npm install
npm run tauri dev      # 开发调试
npm run tauri build -- --no-bundle    # 产出绿色版 exe
```

## 技术栈

| 层 | 技术 |
|---|---|
| 应用框架 | Tauri v2（Rust + WebView2） |
| Markdown 解析 | pulldown-cmark（Rust 侧，GFM 全开） |
| 源码编辑器 | CodeMirror 6 |
| 渲染增强 | highlight.js / KaTeX / Mermaid（懒加载） |
| 前端 | Vite + vanilla TypeScript（无框架） |

## 目录结构

```
md-v/
├── src/                  # 前端（TypeScript）
│   ├── main.ts           # 入口：布局、Tab 生命周期、快捷键、菜单
│   ├── editor.ts         # CodeMirror 6 编辑器封装
│   ├── preview.ts        # 渲染管线：HTML 注入 → hljs → KaTeX → Mermaid
│   ├── toc.ts            # 大纲目录
│   ├── tabs.ts           # Tab 状态管理
│   ├── recent.ts         # 最近文件
│   ├── export.ts         # 导出 HTML/PDF
│   ├── settings.ts       # 设置持久化（localStorage）
│   ├── i18n.ts           # 中英文案
│   └── icons.ts          # 线条 SVG 图标集
├── src-tauri/            # Rust 后端
│   ├── src/lib.rs        # 命令：文件读写、渲染、注册表、mtime
│   └── icons/            # 应用图标（tauri icon 生成）
├── assets-src/           # 图标源文件（SVG → PNG）
├── scripts/              # 图标生成脚本、免安装注册表脚本
└── test-fixtures/        # 测试文档（全特性 + 2MB 大文件）
```

---

## License

[MIT](LICENSE) © 2026 minichen2000
