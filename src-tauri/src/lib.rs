use std::sync::Mutex;

use pulldown_cmark::{html, Options, Parser};

const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

#[derive(Default)]
struct PendingFile(Mutex<Option<String>>);

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > MAX_FILE_SIZE {
        return Err(format!("file too large (>{} bytes)", MAX_FILE_SIZE));
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_file_mtime(path: String) -> Result<u64, String> {
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    let mtime = meta.modified().map_err(|e| e.to_string())?;
    Ok(mtime
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0))
}

#[tauri::command]
fn render_markdown(src: String) -> String {
    let options = Options::ENABLE_TABLES
        | Options::ENABLE_FOOTNOTES
        | Options::ENABLE_STRIKETHROUGH
        | Options::ENABLE_TASKLISTS
        | Options::ENABLE_HEADING_ATTRIBUTES;
    let parser = Parser::new_ext(&src, options);
    let mut out = String::new();
    html::push_html(&mut out, parser);
    out
}

#[tauri::command]
fn take_pending_file(state: tauri::State<'_, PendingFile>) -> Option<String> {
    state.0.lock().ok()?.take()
}

fn find_browser() -> Option<std::path::PathBuf> {
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();
    #[cfg(windows)]
    {
        for key in ["ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"] {
            if let Ok(dir) = std::env::var(key) {
                let dir = std::path::Path::new(&dir);
                candidates.push(dir.join(r"Microsoft\Edge\Application\msedge.exe"));
                candidates.push(dir.join(r"Google\Chrome\Application\chrome.exe"));
            }
        }
    }
    #[cfg(target_os = "macos")]
    {
        candidates.push("/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge".into());
        candidates.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome".into());
        candidates.push("/Applications/Chromium.app/Contents/MacOS/Chromium".into());
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        for name in ["microsoft-edge", "google-chrome", "chromium", "chromium-browser"] {
            candidates.push(std::path::PathBuf::from(format!("/usr/bin/{}", name)));
        }
    }
    candidates.into_iter().find(|p| p.is_file())
}

// Renders a self-contained HTML file to PDF via headless Edge/Chrome.
// Internal anchor links stay clickable in the output PDF, and
// --generate-pdf-document-outline adds sidebar bookmarks from headings.
#[tauri::command]
fn export_pdf(html: String, output_path: String) -> Result<(), String> {
    let browser = find_browser().ok_or_else(|| "no chromium browser (Edge/Chrome) found".to_string())?;
    let stamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let tmp = std::env::temp_dir().join(format!("md-v-pdf-{}-{}.html", std::process::id(), stamp));
    std::fs::write(&tmp, html).map_err(|e| e.to_string())?;
    // dedicated profile dir: without it, a second Edge/Chrome launch is forwarded
    // to the already-running instance (Chromium singleton), our process exits
    // immediately, and the temp file is gone by the time printing happens
    let profile = std::env::temp_dir().join(format!("md-v-pdf-profile-{}-{}", std::process::id(), stamp));
    let url = format!("file:///{}", tmp.to_string_lossy().replace('\\', "/"));
    let result = std::process::Command::new(&browser)
        .args([
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "--no-pdf-header-footer",
            "--generate-pdf-document-outline",
        ])
        .arg(format!("--user-data-dir={}", profile.to_string_lossy()))
        .arg(format!("--print-to-pdf={}", output_path))
        .arg(&url)
        .status();
    let _ = std::fs::remove_file(&tmp);
    let _ = std::fs::remove_dir_all(&profile);
    match result {
        Ok(s) if s.success() => Ok(()),
        Ok(s) => Err(format!("browser exited with code {:?}", s.code())),
        Err(e) => Err(e.to_string()),
    }
}

const PROG_ID: &str = "md-v.md";

// Older versions registered per-extension verbs under SystemFileAssociations;
// kept only so unregister() can clean them up. Registration now uses a single
// wildcard verb under `*` which covers every file, present and future.
const LEGACY_EXTRA_EXTS: &[&str] = &[
    "txt", "log", "text", "csv",
    "mdown", "mkd",
    "json", "jsonc", "xml", "xsl", "svg", "xhtml",
    "yaml", "yml", "toml",
    "ini", "conf", "cfg", "properties",
    "sh", "bash", "zsh", "ksh", "ps1", "psm1",
    "py", "pyw",
    "js", "mjs", "cjs", "jsx", "ts", "tsx", "mts", "cts",
    "html", "htm", "css", "scss", "less",
    "sql", "rs", "c", "h", "cc", "cpp", "cxx", "hpp",
    "java", "php", "diff", "patch",
    "lua", "rb", "pl", "nginx",
];

#[tauri::command]
fn context_menu_registered() -> bool {
    context_menu_registered_impl()
}

#[tauri::command]
fn register_context_menu() -> Result<(), String> {
    register_context_menu_impl()
}

#[tauri::command]
fn unregister_context_menu() -> Result<(), String> {
    unregister_context_menu_impl()
}

#[cfg(windows)]
mod context_menu {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    use super::PROG_ID;

    fn classes() -> Result<RegKey, String> {
        RegKey::predef(HKEY_CURRENT_USER)
            .create_subkey(r"Software\Classes")
            .map(|(k, _)| k)
            .map_err(|e| e.to_string())
    }

    pub fn registered() -> bool {
        RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(r"Software\Classes\.md")
            .and_then(|k| k.get_value::<String, _>(""))
            .map(|v| v == PROG_ID)
            .unwrap_or(false)
    }

    pub fn register() -> Result<(), String> {
        let exe = std::env::current_exe()
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .to_string();
        let classes = classes()?;
        for ext in [".md", ".markdown"] {
            let (k, _) = classes.create_subkey(ext).map_err(|e| e.to_string())?;
            k.set_value("", &PROG_ID).map_err(|e| e.to_string())?;
        }
        let (prog, _) = classes.create_subkey(PROG_ID).map_err(|e| e.to_string())?;
        prog.set_value("", &"Markdown Document")
            .map_err(|e| e.to_string())?;
        let (icon, _) = prog.create_subkey("DefaultIcon").map_err(|e| e.to_string())?;
        icon.set_value("", &format!("{},0", exe))
            .map_err(|e| e.to_string())?;
        let (verb, _) = prog
            .create_subkey(r"shell\Open with md-v")
            .map_err(|e| e.to_string())?;
        verb.set_value("", &"Open with md-v")
            .map_err(|e| e.to_string())?;
        verb.set_value("Icon", &exe).map_err(|e| e.to_string())?;
        let (cmd, _) = verb.create_subkey("command").map_err(|e| e.to_string())?;
        cmd.set_value("", &format!("\"{}\" \"%1\"", exe))
            .map_err(|e| e.to_string())?;
        // wildcard verb: "Open with md-v" on every file, default apps untouched
        let (verb, _) = classes
            .create_subkey(r"*\shell\Open with md-v")
            .map_err(|e| e.to_string())?;
        verb.set_value("", &"Open with md-v")
            .map_err(|e| e.to_string())?;
        verb.set_value("Icon", &exe).map_err(|e| e.to_string())?;
        let (cmd, _) = verb.create_subkey("command").map_err(|e| e.to_string())?;
        cmd.set_value("", &format!("\"{}\" \"%1\"", exe))
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    fn reg_delete(args: &[&str]) -> Result<(), String> {
        // exit code 0 (deleted) and 1 (key/value not found) are both fine
        let out = std::process::Command::new("reg")
            .args(args)
            .output()
            .map_err(|e| e.to_string())?;
        match out.status.code() {
            Some(0) | Some(1) => Ok(()),
            other => Err(format!("reg {:?} exited with {:?}", args, other)),
        }
    }

    pub fn unregister() -> Result<(), String> {
        // only clear the ext default value when it points at our ProgID
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        for ext in [".md", ".markdown"] {
            if let Ok(k) = hkcu.open_subkey(format!(r"Software\Classes\{}", ext)) {
                let ours = k
                    .get_value::<String, _>("")
                    .map(|v| v == PROG_ID)
                    .unwrap_or(false);
                if ours {
                    // winreg's delete_value("") cannot remove the default value; use reg.exe
                    reg_delete(&["delete", &format!(r"HKCU\Software\Classes\{}", ext), "/ve", "/f"])?;
                }
            }
        }
        reg_delete(&["delete", &format!(r"HKCU\Software\Classes\{}", PROG_ID), "/f"])?;
        reg_delete(&["delete", r"HKCU\Software\Classes\*\shell\Open with md-v", "/f"])?;
        // clean up per-extension verbs written by older versions
        for ext in super::LEGACY_EXTRA_EXTS {
            reg_delete(&[
                "delete",
                &format!(
                    r"HKCU\Software\Classes\SystemFileAssociations\.{}\shell\Open with md-v",
                    ext
                ),
                "/f",
            ])?;
        }
        Ok(())
    }
}

#[cfg(windows)]
fn context_menu_registered_impl() -> bool {
    context_menu::registered()
}

#[cfg(windows)]
fn register_context_menu_impl() -> Result<(), String> {
    context_menu::register()
}

#[cfg(windows)]
fn unregister_context_menu_impl() -> Result<(), String> {
    context_menu::unregister()
}

#[cfg(not(windows))]
fn context_menu_registered_impl() -> bool {
    false
}

#[cfg(not(windows))]
fn register_context_menu_impl() -> Result<(), String> {
    Err("not supported on this platform".into())
}

#[cfg(not(windows))]
fn unregister_context_menu_impl() -> Result<(), String> {
    Err("not supported on this platform".into())
}

fn first_file_arg() -> Option<String> {
    std::env::args()
        .skip(1)
        .find(|a| std::path::Path::new(a).is_file())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            use tauri::{Emitter, Manager};
            let files: Vec<String> = argv
                .into_iter()
                .skip(1)
                .filter(|a| std::path::Path::new(a).is_file())
                .collect();
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.unminimize();
                let _ = w.set_focus();
            }
            let _ = app.emit("open-files", files);
        }))
        .manage(PendingFile(Mutex::new(first_file_arg())))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            get_file_mtime,
            render_markdown,
            take_pending_file,
            export_pdf,
            context_menu_registered,
            register_context_menu,
            unregister_context_menu
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
