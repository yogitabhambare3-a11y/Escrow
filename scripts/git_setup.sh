#!/bin/bash
# ─── Git Setup & Commit Script ────────────────────────────────────────────────
# Run this after: git init && git remote add origin <your-repo-url>
set -e

echo "📁 Staging all files..."

# Commit 1 — project scaffold
git add Cargo.toml .gitignore netlify.toml README.md
git commit -m "chore: initialize project structure and Rust workspace"

# Commit 2 — escrow contract
git add contracts/escrow/
git commit -m "feat: add escrow contract with state machine and token transfers"

# Commit 3 — dispute resolution
git add contracts/dispute_resolution/
git commit -m "feat: add dispute_resolution contract with inter-contract calls"

# Commit 4 — factory
git add contracts/escrow_factory/
git commit -m "feat: add escrow_factory contract with deploy_v2 pattern"

# Commit 5 — tests
git add tests/
git commit -m "test: add 8 integration tests covering full escrow lifecycle"

# Commit 6 — frontend scaffold
git add frontend/package.json frontend/vite.config.ts frontend/tsconfig.json \
         frontend/tsconfig.node.json frontend/tailwind.config.js \
         frontend/postcss.config.js frontend/index.html \
         frontend/.env.example frontend/src/index.css \
         frontend/src/main.tsx frontend/src/App.tsx \
         frontend/src/vite-env.d.ts frontend/src/types/
git commit -m "feat: scaffold React + Tailwind frontend with Vite"

# Commit 7 — Stellar SDK integration
git add frontend/src/lib/ frontend/src/hooks/
git commit -m "feat: integrate Stellar SDK for contract invocation and Freighter wallet"

# Commit 8 — UI components
git add frontend/src/components/ frontend/src/pages/
git commit -m "feat: add dashboard, escrow card, create modal, and stats UI"

# Commit 9 — CI/CD
git add .github/ scripts/deploy.sh scripts/git_setup.sh
git commit -m "chore: setup CI/CD with GitHub Actions and Netlify auto-deploy"

# Commit 10 — docs
git add README.md
git commit -m "docs: add complete README with architecture, setup, and contract IDs"

echo ""
echo "✅ 10 commits created!"
echo "Run: git push -u origin main"
