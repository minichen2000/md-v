# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.7.0] - 2026-09-28

### Added

- YAML frontmatter (`---` delimited metadata block at the start of a Markdown file) is rendered as a key-value table above the document content in preview, HTML export and PDF export. Malformed frontmatter falls back to the previous (plain) rendering.

## [0.6.1] - 2026-09-27

### Fixed

- Center the main window on startup (`"center": true` in `tauri.conf.json`) instead of relying on the OS default cascading placement, which left the window slightly to the left and too low.
- Reduce the default window height from 800 to 752 so the window no longer crowds the taskbar when it is visible.
