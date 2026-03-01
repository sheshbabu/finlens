mod db;

use futures_util::StreamExt;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::Mutex;
use tauri::{Emitter, Manager};
use walkdir::WalkDir;

struct DbState(Mutex<rusqlite::Connection>);

#[derive(Serialize)]
struct OllamaRequest {
    model: String,
    messages: Vec<OllamaMessage>,
    stream: bool,
    think: bool,
}

#[derive(Serialize, Deserialize, Clone)]
struct OllamaMessage {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct OllamaChunkMessage {
    content: String,
    thinking: Option<String>,
}

#[derive(Deserialize)]
struct OllamaChunk {
    message: OllamaChunkMessage,
    done: bool,
}

#[derive(Serialize)]
struct Folder {
    folder_id: i64,
    path: String,
    created_at: String,
}

#[derive(Serialize)]
struct ExtractionResult {
    found: usize,
    extracted: usize,
    skipped: usize,
    errors: usize,
}

#[derive(Serialize, Clone)]
struct ExtractProgressEvent {
    path: String,
    status: String, // "extracting" | "done" | "skipped" | "error"
}

#[derive(Serialize)]
struct Conversation {
    conversation_id: i64,
    title: String,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct Message {
    message_id: i64,
    conversation_id: i64,
    role: String,
    content: String,
    created_at: String,
}

#[tauri::command]
fn create_conversation(state: tauri::State<DbState>, title: String) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO conversations (title) VALUES (?1)",
        params![title],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn get_conversations(state: tauri::State<DbState>) -> Result<Vec<Conversation>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT conversation_id, title, created_at, updated_at
             FROM conversations
             ORDER BY updated_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Conversation {
                conversation_id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let conversations = rows
        .filter_map(|r| r.ok())
        .collect::<Vec<_>>();

    Ok(conversations)
}

#[tauri::command]
fn get_messages(
    state: tauri::State<DbState>,
    conversation_id: i64,
) -> Result<Vec<Message>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT message_id, conversation_id, role, content, created_at
             FROM messages
             WHERE conversation_id = ?1
             ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![conversation_id], |row| {
            Ok(Message {
                message_id: row.get(0)?,
                conversation_id: row.get(1)?,
                role: row.get(2)?,
                content: row.get(3)?,
                created_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let messages = rows.filter_map(|r| r.ok()).collect::<Vec<_>>();
    Ok(messages)
}

#[tauri::command]
fn save_message(
    state: tauri::State<DbState>,
    conversation_id: i64,
    role: String,
    content: String,
) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO messages (conversation_id, role, content) VALUES (?1, ?2, ?3)",
        params![conversation_id, role, content],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE conversation_id = ?1",
        params![conversation_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn delete_conversation(state: tauri::State<DbState>, conversation_id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM conversations WHERE conversation_id = ?1",
        params![conversation_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn chat(
    window: tauri::Window,
    state: tauri::State<'_, DbState>,
    conversation_id: i64,
    think: bool,
) -> Result<(), String> {
    let history: Vec<OllamaMessage> = {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT role, content FROM messages
                 WHERE conversation_id = ?1
                 ORDER BY created_at ASC",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![conversation_id], |row| {
                Ok(OllamaMessage {
                    role: row.get(0)?,
                    content: row.get(1)?,
                })
            })
            .map_err(|e| e.to_string())?;
        rows.filter_map(|r| r.ok()).collect()
    };

    let client = reqwest::Client::new();

    let body = OllamaRequest {
        model: "qwen3.5:35b-a3b".to_string(),
        messages: history,
        stream: true,
        think,
    };

    let response = client
        .post("http://localhost:11434/api/chat")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to reach Ollama: {}", e))?;

    let mut stream = response.bytes_stream();
    let mut full_content = String::new();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);

        for line in text.lines() {
            if line.is_empty() {
                continue;
            }
            if let Ok(parsed) = serde_json::from_str::<OllamaChunk>(line) {
                if let Some(thinking) = parsed.message.thinking {
                    if !thinking.is_empty() {
                        window
                            .emit("chat-thinking", thinking)
                            .map_err(|e| format!("Emit error: {}", e))?;
                    }
                }
                if !parsed.message.content.is_empty() {
                    full_content.push_str(&parsed.message.content);
                    window
                        .emit("chat-chunk", &parsed.message.content)
                        .map_err(|e| format!("Emit error: {}", e))?;
                }
                if parsed.done {
                    window
                        .emit("chat-done", ())
                        .map_err(|e| format!("Emit error: {}", e))?;
                }
            }
        }
    }

    {
        let conn = state.0.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (?1, 'assistant', ?2)",
            params![conversation_id, full_content],
        )
        .map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE conversation_id = ?1",
            params![conversation_id],
        )
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
fn get_folders(state: tauri::State<DbState>) -> Result<Vec<Folder>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT folder_id, path, created_at FROM folders ORDER BY created_at ASC")
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Folder {
                folder_id: row.get(0)?,
                path: row.get(1)?,
                created_at: row.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let folders = rows.filter_map(|r| r.ok()).collect::<Vec<_>>();
    Ok(folders)
}

#[tauri::command]
async fn pick_folder(app: tauri::AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder = app.dialog().file().blocking_pick_folder();
    let path = folder.map(|f| f.to_string());
    Ok(path)
}

#[tauri::command]
fn add_folder(state: tauri::State<DbState>, path: String) -> Result<i64, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("INSERT INTO folders (path) VALUES (?1)", params![path])
        .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
fn remove_folder(state: tauri::State<DbState>, folder_id: i64) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "DELETE FROM folders WHERE folder_id = ?1",
        params![folder_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn extract_documents(
    window: tauri::Window,
    state: tauri::State<DbState>,
) -> Result<ExtractionResult, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT folder_id, path FROM folders")
        .map_err(|e| e.to_string())?;
    let folder_rows = stmt
        .query_map([], |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)))
        .map_err(|e| e.to_string())?;
    let folders: Vec<(i64, String)> = folder_rows.filter_map(|r| r.ok()).collect();

    let mut existing_stmt = conn
        .prepare("SELECT path FROM documents")
        .map_err(|e| e.to_string())?;
    let existing_rows = existing_stmt
        .query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    let existing_paths: HashSet<String> = existing_rows.filter_map(|r| r.ok()).collect();

    let mut found = 0usize;
    let mut extracted = 0usize;
    let mut skipped = 0usize;
    let mut errors = 0usize;

    for (folder_id, folder_path) in &folders {
        for entry in WalkDir::new(folder_path)
            .follow_links(true)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if path.is_file() {
                let ext = path
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("")
                    .to_lowercase();
                if ext != "pdf" {
                    continue;
                }
            } else {
                continue;
            }

            found += 1;
            let path_str = path.to_string_lossy().to_string();

            if existing_paths.contains(&path_str) {
                skipped += 1;
                let _ = window.emit(
                    "extract-progress",
                    ExtractProgressEvent {
                        path: path_str,
                        status: "skipped".to_string(),
                    },
                );
                continue;
            }

            let _ = window.emit(
                "extract-progress",
                ExtractProgressEvent {
                    path: path_str.clone(),
                    status: "extracting".to_string(),
                },
            );

            let extract_result: Result<String, String> = std::process::Command::new("pdftotext")
                .arg("-layout")
                .arg(&path_str)
                .arg("-")
                .output()
                .map_err(|e| e.to_string())
                .and_then(|out| {
                    if out.status.success() {
                        String::from_utf8(out.stdout).map_err(|e| e.to_string())
                    } else {
                        Err(String::from_utf8_lossy(&out.stderr).to_string())
                    }
                });

            match extract_result {
                Ok(text) => {
                    eprintln!("[extract] {} chars from {}", text.len(), path_str);
                    match conn.execute(
                        "INSERT INTO documents (folder_id, path, raw_text) VALUES (?1, ?2, ?3)",
                        params![folder_id, path_str.clone(), text],
                    ) {
                        Ok(_) => {
                            extracted += 1;
                            let _ = window.emit(
                                "extract-progress",
                                ExtractProgressEvent {
                                    path: path_str,
                                    status: "done".to_string(),
                                },
                            );
                        }
                        Err(e) => {
                            eprintln!("[extract] db insert error for {}: {}", path_str, e);
                            errors += 1;
                            let _ = window.emit(
                                "extract-progress",
                                ExtractProgressEvent {
                                    path: path_str,
                                    status: "error".to_string(),
                                },
                            );
                        }
                    }
                }
                Err(e) => {
                    eprintln!("[extract] error for {}: {}", path_str, e);
                    errors += 1;
                    let _ = window.emit(
                        "extract-progress",
                        ExtractProgressEvent {
                            path: path_str,
                            status: "error".to_string(),
                        },
                    );
                }
            }
        }
    }

    Ok(ExtractionResult {
        found,
        extracted,
        skipped,
        errors,
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let path = db::get_db_path(app.handle());
            let conn = db::open(&path).expect("failed to open db");
            db::migrate(&conn).expect("failed to run migrations");
            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            chat,
            create_conversation,
            get_conversations,
            get_messages,
            save_message,
            delete_conversation,
            get_folders,
            pick_folder,
            add_folder,
            remove_folder,
            extract_documents,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
