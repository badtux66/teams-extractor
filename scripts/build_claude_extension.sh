#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_ROOT="$ROOT_DIR/dist/claude-extension"
EXTENSION_NAME="teams-extractor-mcp"
EXTENSION_DIR="$BUILD_ROOT/$EXTENSION_NAME"

echo "==> Preparing build directories"
rm -rf "$BUILD_ROOT"
mkdir -p "$EXTENSION_DIR"

echo "==> Copying Claude extension manifest and docs"
cp "$ROOT_DIR/claude-extension/manifest.json" "$EXTENSION_DIR/manifest.json"
cp "$ROOT_DIR/claude-extension/README.md" "$EXTENSION_DIR/README.md"

echo "==> Copying MCP server sources"
rsync -a --exclude node_modules "$ROOT_DIR/mcp-server/" "$EXTENSION_DIR/mcp-server/"

echo "==> Installing production dependencies"
(cd "$EXTENSION_DIR/mcp-server" && npm ci --omit=dev)

echo "==> Packaging Claude extension"
(cd "$BUILD_ROOT" && zip -r "$EXTENSION_NAME.zip" "$EXTENSION_NAME" >/dev/null)

echo ""
echo "✅ Claude extension packaged:"
echo "   $BUILD_ROOT/$EXTENSION_NAME.zip"
echo ""
echo "Install it from Claude Desktop → Developer → Extensions → Install Extension."
