# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
