# Build Guide

English | [简体中文](BUILDING.zh-CN.md)

This document describes how to build md-v from source, including tested workarounds for network issues in mainland China.

## Requirements

| Dependency | Version | Notes |
|---|---|---|
| Node.js | ≥ 20, 24 LTS recommended | Frontend build (Vite). Modern toolchains won't run below 18 |
| Rust | stable (via rustup) | Backend and packaging. Install: https://rustup.rs |
| Visual Studio C++ Build Tools | 2019+ | MSVC linker, required by the Rust MSVC toolchain. Check "Desktop development with C++" during installation |
| WebView2 | Usually built into Windows 10/11 | If missing, install the [WebView2 Runtime](https://developer.microsoft.com/microsoft-edge/webview2) manually |

## Build Steps

```bash
# 1. Install frontend dependencies
npm install

# 2. Develop with hot reload
npm run tauri dev

# 3. Type check + frontend build (quick verification)
npm run build
cd src-tauri && cargo check

# 4. Release build (no bundling — portable exe only)
npm run tauri build -- --no-bundle
```

Artifacts:

| Artifact | Path | Purpose |
|---|---|---|
| Portable executable | `src-tauri/target/release/md-v.exe` | Double-click to run; the only distributed artifact |

## Network Acceleration in Mainland China (Lessons Learned)

### crates.io fetch timeouts

The project ships with the rsproxy mirror built in: `src-tauri/.cargo/config.toml`. It applies only to this project and works out of the box.

## Regenerating Icons

The icon source is `assets-src/icon.svg`. After modifying it, regenerate the full icon set:

```bash
node scripts/make-icon.mjs        # SVG → 1024px PNG (@resvg/resvg-js)
npx tauri icon assets-src/icon.png  # generates ico/icns/pngs of all sizes into src-tauri/icons/
```

## Registering the Context Menu Without Installing

Portable-version users can also skip in-app registration and use a registry script instead:

1. Edit `scripts/register-md-v.reg`, replacing the 3 occurrences of `C:\\Path\\To\\md-v.exe` with the actual exe path (note the double backslashes)
2. Double-click to import (writes to HKCU, no admin rights required)
3. To uninstall: delete the default values of `HKCU\Software\Classes\.md` and `.markdown`, and the entire `HKCU\Software\Classes\md-v.md` key

> The recommended approach is still the in-app ⚙ → "Add context menu" — if the exe is moved, clicking it once more self-heals the registration.

## Test Fixtures

- `test-fixtures/full-featured.md`: covers GFM tables / task lists / code highlighting / KaTeX / Mermaid / footnotes, for render regression testing
- `test-fixtures/large.md`: ~2 MB, 2000 sections, for verifying large-file open and scroll performance

## Version Bumping

Before a release, bump the version in all three places:

- `package.json` → `version`
- `src-tauri/tauri.conf.json` → `version`
- `src-tauri/Cargo.toml` → `version`
