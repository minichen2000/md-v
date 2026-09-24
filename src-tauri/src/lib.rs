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

const PROG_ID: &str = "md-v.md";

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
        Ok(())
    }

    pub fn unregister() -> Result<(), String> {
        let classes = classes()?;
        // only clear the default value when it points at our ProgID
        for ext in [".md", ".markdown"] {
            if let Ok(k) = classes.open_subkey_with_flags(ext, winreg::enums::KEY_SET_VALUE) {
                let ours = k
                    .get_value::<String, _>("")
                    .map(|v| v == PROG_ID)
                    .unwrap_or(false);
                if ours {
                    k.delete_value("").map_err(|e| e.to_string())?;
                }
            }
        }
        classes.delete_subkey_all(PROG_ID).map_err(|e| e.to_string())?;
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
        .manage(PendingFile(Mutex::new(first_file_arg())))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            render_markdown,
            take_pending_file,
            context_menu_registered,
            register_context_menu,
            unregister_context_menu
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
