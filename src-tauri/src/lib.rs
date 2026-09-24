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
            take_pending_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
