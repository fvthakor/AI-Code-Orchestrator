# Development & Verification Guide

This guide describes how to build, test, and contribute to AI Code Orchestrator on Windows.

---

## Workspace Setup

The project is structured as a pnpm monorepo with Cargo for the native Tauri backend:

```powershell
# 1. Install root & frontend dependencies
pnpm install

# 2. Build shared TypeScript types
pnpm --filter @ai-orchestrator/shared-types build

# 3. Check frontend types
pnpm --filter desktop typecheck

# 4. Verify Rust backend compilation
cargo check --manifest-path apps/desktop/src-tauri/Cargo.toml
```

---

## Running Integration Tests

Integration test suites are located in `apps/desktop/src-tauri/tests/`:

```powershell
# Run all backend tests
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml

# Run individual test suites
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test security_test
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test scanner_test
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test database_test
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test agent_test
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test git_test
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml --test process_test
```

---

## Running the Application in Development Mode

```powershell
pnpm --filter desktop tauri dev
```

This starts the Vite development server on `http://localhost:1420` with Hot Module Reloading (HMR) and launches the native Windows Tauri desktop window.

---

## Production Packaging

To build the standalone Windows `.exe` and `.msi` installers:

```powershell
pnpm --filter desktop tauri build
```

The resulting release packages are generated in `apps/desktop/src-tauri/target/release/bundle/`.
