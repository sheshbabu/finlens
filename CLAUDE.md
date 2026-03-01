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

## React Component Conventions

### Conditional Rendering
- Use if-else conditions **outside JSX** to build variables, not `&&` or ternary operators inside JSX
- Ternary operators in JSX are only acceptable for simple inline styles or class names
```jsx
// Correct
let content = null;
if (isVisible === true) {
  content = <div>...</div>;
}
return <div>{content}</div>;

// Avoid
return <div>{isVisible && <div>...</div>}</div>;
```

### Map Loops
- Extract `.map()` calls to variables **outside** JSX return
```jsx
// Correct
const items = list.map(item => <Item key={item.id} />);
return <div>{items}</div>;

// Avoid
return <div>{list.map(item => <Item key={item.id} />)}</div>;
```

### Function Declarations
- Use `function` keyword for event handlers, utility functions, and render helpers
- Use arrow functions only for inline callbacks in JSX
```jsx
// Correct
function handleSaveClick() { ... }
function formatLabel(s) { ... }

// Acceptable: inline callbacks
items.map(item => ...)
onClick={() => handleSaveClick()}
```

### Boolean Props and Checks
- Use `is` prefix for boolean props: `isActive`, `isDisabled`, `isLoading`
- Use explicit boolean comparisons instead of truthy/falsy checks
```jsx
// Correct
if (isEnabled === true) { ... }
if (isDisabled !== true) { ... }

// Avoid
if (isEnabled) { ... }
if (!isDisabled) { ... }
```

### Event Handler Naming
- Handler naming: `handle{Action}Click` (e.g., `handleSaveClick`, `handleDeleteClick`)

### Comments
- Only add comments that explain **why**, not **what**
- Remove comments that merely describe what the code is already doing
- Good: `// Trigger sidebar refresh to update updated_at ordering`
- Bad: `// Load messages`, `// Save user message to DB`, `// Create conversation on first message`
