#!/usr/bin/env bash
# Regenerate vendor/ from SuperInstance/quilt-vm-wasm.
# Requires: rustup (wasm32-unknown-unknown target), cargo, wasm-bindgen CLI
# whose version EXACTLY matches Cargo.lock's wasm-bindgen (CLI and crate are tied).
set -euo pipefail

WBG_VERSION=$(grep -A1 '^name = "wasm-bindgen"' "$(dirname "$0")/../../../Cargo.lock" 2>/dev/null | grep version | head -1 | sed 's/.*"\(.*\)"/\1/' \
  || grep -A1 '^name = "wasm-bindgen"' Cargo.lock | grep version | head -1 | sed 's/.*"\(.*\)"/\1/')

REPO_DIR="$(mktemp -d)"
echo "cloning quilt-vm-wasm into $REPO_DIR"
git clone --depth 1 https://github.com/SuperInstance/quilt-vm-wasm "$REPO_DIR/quilt-vm-wasm"
cd "$REPO_DIR/quilt-vm-wasm"

echo "NOTE: the upstream manifest needs the optional-dep fix (PR #1) to build at all."
rustup target add wasm32-unknown-unknown
cargo build --release --target wasm32-unknown-unknown --features wasm

if ! command -v wasm-bindgen >/dev/null; then
  echo "downloading wasm-bindgen CLI $WBG_VERSION (must match crate version)"
  curl -sL "https://github.com/rustwasm/wasm-bindgen/releases/download/${WBG_VERSION}/wasm-bindgen-${WBG_VERSION}-x86_64-unknown-linux-musl.tar.gz" | tar xz
  WBG="$REPO_DIR/wasm-bindgen-${WBG_VERSION}-x86_64-unknown-linux-musl/wasm-bindgen"
else
  WBG="$(command -v wasm-bindgen)"
fi

"$WBG" target/wasm32-unknown-unknown/release/quilt_vm_wasm.wasm --out-dir pkg --target nodejs

HERE="$(cd "$(dirname "$0")/.." && pwd)"
cp pkg/quilt_vm_wasm.js "$HERE/vendor/quilt_vm_wasm.cjs"   # .cjs: package is type:module
cp pkg/quilt_vm_wasm_bg.wasm "$HERE/vendor/quilt_vm_wasm_bg.wasm"
echo "vendored into $HERE/vendor/ — run: npm test"
