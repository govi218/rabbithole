# AGENT.md — Architecture & Coding Conventions

This document describes the architectural patterns, conventions, and preferences
for this codebase. All contributors (human or AI) should follow these guidelines
without needing to be told explicitly.

---

## Architecture Overview

This is a Chrome extension built with Svelte + TypeScript. The main layers are:

- **`src/storage/db.ts`** — IndexedDB persistence layer (pure data operations)
- **`src/background/index.ts`** — Service worker / message handler (orchestration layer)
- **`src/lib/*.svelte`** — UI components (presentation + UX-level error handling)
- **`src/utils/`** — Shared utilities, types, constants
- **`src/atproto/`** — ATProto integration

---

## Layer Responsibilities

### `db.ts` — Pure Persistence Layer

- DB functions do **exactly what their name says** and nothing more.
- **No side effects.** A function named `deleteTrail` deletes a trail record.
  It does not reset active state, clear other records, or trigger any other
  state transitions.
- **No active-state management** inside DB primitives, unless the function name
  explicitly implies it (e.g. `createNewActiveRabbithole`, `createNewActiveBurrow`,
  `createNewActiveTrail` — these are named convenience wrappers that compose a
  create + activate, which is their stated purpose).
- `changeActiveBurrow(id)` sets the active burrow. That is all it does.
- `changeActiveTrail(id)` sets the active trail. That is all it does.
- **Errors should be thrown** (via `reject(new Error(...))`) and bubble up.
  Do not swallow errors silently in this layer.
- DB functions are composable primitives. The background layer owns composition.

### `background/index.ts` — Orchestration Layer

- Owns all **multi-step logic** and **side effect sequencing**.
- When a user action has consequences (e.g. deleting the active rabbithole should
  also clear active state), those consequences are handled here — not in `db.ts`.
- Active state resets are **conditional**: only reset if the deleted/changed item
  is currently active. Never unconditionally null out active state.
- **Errors are caught** by the `handle()` wrapper and logged via `Logger.error`.
  Individual handlers throw to signal failure; they do not call `sendResponse`
  directly.
- The `handle()` wrapper ensures:
  - `return true` is in exactly one place (no risk of forgetting it)
  - Every handler has consistent error handling
  - Handlers are clean `async` functions — throw to error, return to respond
- Handlers return `void` when there is no meaningful return value. Do not return
  `{ success: true }` for operations that are fire-and-forget.
- Argument validation is done at the top of each handler with a `throw`.

### `src/lib/*.svelte` — Component Layer

- Handles **UX-level error states**: showing error messages, fallback UI, etc.
- Sends messages to the background via `chrome.runtime.sendMessage`.
- Does not contain business logic or DB access.

---

## Error Handling Flow

```
db.ts          → throws errors (reject with new Error(...))
background     → catches via handle(), logs with Logger.error, sends { error } response
component      → receives error response, shows appropriate UX feedback
```

---

## Naming Conventions

- `createNewActiveX` — creates a record AND sets it as active. This dual
  responsibility is acceptable because it is explicit in the name.
- `createX` — pure creation, no active state change.
- `deleteX` — deletes the record only.
- `deleteXFromY` — removes X's reference from Y (e.g. removes trail ID from
  rabbithole's trails array). Does not delete X itself.
- `changeActiveX` — sets the active X. Nothing else.
- `getActiveX` — retrieves the currently active X record.

---

## TypeScript Preferences

- **Explicit types** on function signatures (parameters and return types).
- Prefer `interface` for object shapes, `type` for unions and aliases.
- No implicit `any`. If something is truly unknown, type it as `unknown` and
  narrow it.
- Use `Partial<T>` for update payloads rather than listing optional fields manually.
- Avoid type assertions (`as X`) unless interfacing with IDB or browser APIs
  where it is unavoidable.
- Prefer `const` over `let` wherever the binding is not reassigned.
- No one-liner `if` statements without curly braces `{}`. Always use blocks.

---

## Suggested Review Checklist (when adding/changing handlers or db primitives)

When making changes, it's often useful to run through this checklist:

### `src/storage/db.ts` (DB purity + correctness)

- DB methods are **pure** and do only what their name says.
- No cross-entity side effects (e.g. deleting X should not reset active state).
- Convenience wrappers like `createNewActiveX` are the **only** place where
  create + activate is combined.
- Promise callbacks that use `await` are marked `async`.
- No swallowed errors (reject/throw; do not silently ignore).
- No sync/async mixing that can cause transaction completion races.

### `src/background/index.ts` (handler patterns)

- Each handler validates args at the top and `throw`s on invalid input.
- Handlers `return void` for fire-and-forget operations (do not return `{ success: true }`).
- Orchestration lives in background (conditional active state resets, cascades).
- Errors are allowed to bubble and are caught by the `handle()` wrapper.

### Tests (`test/db.test.ts`, `test/Trail.test.ts`)

- DB tests verify **db primitives only**, not orchestration side effects.
- Background/orchestration expectations are tested at the background layer, not db.
- Tests reflect naming conventions (`createNewActiveX` implies activation).

---

## Code Change Philosophy

- **Changes must be precise and intentional.** Do not refactor, rename, or
  restructure things that are not part of the current task.
- **Do not add abstraction for its own sake.** Only introduce a new pattern or
  helper if it solves a real, demonstrable problem (e.g. the `handle()` wrapper
  was justified because it eliminated a class of silent bugs around `return true`
  and inconsistent error handling).
- **Minimal diffs.** Show only what changes. Do not restate unchanged code
  unless necessary for context.
- **Fix the right layer.** If a test is wrong because the implementation
  changed intentionally, fix the test. If the implementation has a bug, fix
  the implementation. Do not paper over bugs in tests.
- **One responsibility per function.** If a function is doing two things,
  it should either be split or its name should make the dual responsibility
  explicit (see naming conventions above).
