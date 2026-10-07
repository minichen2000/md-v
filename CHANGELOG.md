# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Image and local-page preview overlays now fill the whole window (a dialog cannot be larger than its WebView) and use a slim title bar instead of a centred box with generous padding.

### Added

- Render local `.html`/`.htm` links from the preview in an in-app overlay instead of opening their source in the editor: the page loads through the asset protocol with its directory structure intact, so relative CSS/images/scripts and page-to-page links resolve to their real siblings, while its scripts stay isolated from md-v's Tauri IPC. The overlay title bar offers "Open in browser" (system default browser) and "Close (Esc)"; Escape also works while the rendered page itself holds keyboard focus.

## [0.7.3] - 2026-10-06

### Added

- Zoom image previews with the mouse wheel around the cursor, and drag oversized images with the left mouse button. Show the zoom percentage and provide fit-to-window and original-size reset buttons.

### Fixed

- Preserve editor and preview reading positions when opening linked documents, switching tabs or closing the active tab; discard stale asynchronous preview renders.
- Preview local image links in a modal viewer instead of reading them as UTF-8 text. Support fit-to-window/original-size viewing and Escape to return to the document.
- Open local document links from the preview in tabs relative to the current file instead of navigating the WebView and resetting the app. Support Chinese/encoded paths, absolute paths, file URLs and heading fragments; report missing files without leaving the document.

## [0.7.2] - 2026-10-02

### Added

- Recent files menu: each entry now shows a hover ✕ button to remove that single path from the list; clicking the entry itself still opens the file, and "Clear list" still removes everything.
- Build scripts: `npm run build:exe` (fast profile, for daily development) and `npm run build:release` (release profile, for publishing).

### Fixed

- Show the tab bar's `+` (new tab) button even when md-v starts with no file open, so a new untitled file can be created directly.
- Render soft line breaks inside blockquotes (`>`) as line breaks (`white-space: pre-line`), matching the per-`>`-line display some viewers use.

## [0.7.1] - 2026-10-01

### Changed

- Increase the default editor/preview font size from 14 to 15.
- Loosen the preview line height from 1.6 to 2.2 for more comfortable reading.
- Replace the UI font stack with `v-sans, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`.

## [0.7.0] - 2026-09-28

### Added

- YAML frontmatter (`---` delimited metadata block at the start of a Markdown file) is rendered as a key-value table above the document content in preview, HTML export and PDF export. Malformed frontmatter falls back to the previous (plain) rendering.

## [0.6.1] - 2026-09-27

### Fixed

- Center the main window on startup (`"center": true` in `tauri.conf.json`) instead of relying on the OS default cascading placement, which left the window slightly to the left and too low.
- Reduce the default window height from 800 to 752 so the window no longer crowds the taskbar when it is visible.
