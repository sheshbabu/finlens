# FinLens

A personal finance app built with Tauri (Rust backend) + React (frontend).

## Stack

- **Frontend**: React 19, Vite, plain CSS (no CSS framework)
- **Backend**: Rust via Tauri 2
- **Frontend → Backend**: `invoke()` from `@tauri-apps/api/core`
- **Backend → Frontend streaming**: Tauri events (`listen()`) — events used: `chat-thinking`, `chat-chunk`, `chat-done`

## Project Structure

```
src/
  features/
    chat/       # ChatPage.jsx, ChatPage.css
    home/
  commons/
    components/ # Button, Link, Route, Router, Sidebar
src-tauri/
  src/          # lib.rs, main.rs
```

## LLM

- **Model**: `qwen3.5:35b-a3b` via Ollama
- **Architecture**: MoE — 35B total params, 3B activated per token
- **Context**: 256K tokens
- **Thinking**: Supports thinking mode (toggled via `"think": true/false` in Ollama API); no token budget control through Ollama

## Conventions

- Feature-based folder structure under `src/features/`
- Shared UI components in `src/commons/components/`
- CSS variables for spacing (`--spacing-*`), typography (`--p1`, `--sm`), colors (`--neutral-*`, `--text-*`, `--bg-*`)
- No CSS framework — use plain CSS with project variables
- No TypeScript — plain JSX
