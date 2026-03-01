use rusqlite::{Connection, Result};
use std::path::PathBuf;

pub fn get_db_path(app_handle: &tauri::AppHandle) -> PathBuf {
    use tauri::Manager;
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .expect("failed to get app data dir");
    std::fs::create_dir_all(&data_dir).expect("failed to create app data dir");
    data_dir.join("finlens.db")
}

pub fn open(path: &PathBuf) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch(
        "PRAGMA journal_mode=WAL;
         PRAGMA synchronous=normal;
         PRAGMA foreign_keys=on;",
    )?;
    Ok(conn)
}

pub fn migrate(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS conversations (
            conversation_id INTEGER PRIMARY KEY AUTOINCREMENT,
            title           TEXT NOT NULL,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS messages (
            message_id      INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id INTEGER NOT NULL,
            role            TEXT NOT NULL,
            content         TEXT NOT NULL,
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES conversations (conversation_id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS folders (
            folder_id   INTEGER PRIMARY KEY AUTOINCREMENT,
            path        TEXT NOT NULL UNIQUE,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS documents (
            document_id  INTEGER PRIMARY KEY AUTOINCREMENT,
            folder_id    INTEGER NOT NULL,
            path         TEXT NOT NULL UNIQUE,
            raw_text     TEXT NOT NULL,
            extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (folder_id) REFERENCES folders (folder_id) ON DELETE CASCADE
        );",
    )?;
    Ok(())
}
