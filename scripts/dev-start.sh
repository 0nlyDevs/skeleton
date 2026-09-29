#!/usr/bin/env bash
# Start the webcup-skeleton server.
#
# This script bundles server.ts into server.cjs (via `npm run build:server`)
# and runs it with plain `node`, avoiding the tsx/Next 15 AsyncLocalStorage
# incompatibility that occurs when tsx's module transform is active.
#
# Prisma engines: on NixOS the bundled query engine must be located via env vars.
set -euo pipefail

cd /home/cocofioren/webcup-skeleton

# Locate Prisma engines — prefer the pinned nix store path, fall back to
# node_modules/.prisma/client for non-Nix installations.
ENGINE_LIB=""
SCHEMA_ENGINE=""

NIX_ENGINE_DIR="/nix/store/v11kl5cjdb2lhkb6r7cx02pfp4wqs78q-prisma-engines_6-6.19.3"
if [ -f "$NIX_ENGINE_DIR/lib/libquery_engine.node" ]; then
  ENGINE_LIB="$NIX_ENGINE_DIR/lib/libquery_engine.node"
  SCHEMA_ENGINE="$NIX_ENGINE_DIR/bin/schema-engine"
fi

if [ -z "$ENGINE_LIB" ] && [ -f "node_modules/.prisma/client/libquery_engine-linux-nixos.so.node" ]; then
  ENGINE_LIB="node_modules/.prisma/client/libquery_engine-linux-nixos.so.node"
fi

if [ -n "$ENGINE_LIB" ]; then
  export PRISMA_QUERY_ENGINE_LIBRARY="$ENGINE_LIB"
fi
if [ -n "$SCHEMA_ENGINE" ]; then
  export PRISMA_SCHEMA_ENGINE_BINARY="$SCHEMA_ENGINE"
fi

export NODE_ENV=production

exec node server.cjs
