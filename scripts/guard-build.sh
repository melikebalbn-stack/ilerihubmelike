#!/usr/bin/env bash
# ─── Prod slot worktree'lerinde ELLE build engeli ───────────────────────────
# 2026-09-10 arizasi: aktif blue slotunda elle `next build` kosuldu; build
# .next'i sifirlayip yeniden yazarken `next start` yarim dizinden servis etti
# (BUILD_ID/manifest henuz yok) → canli 503 + ChunkLoadError, ~5 dk kesinti.
#
# package.json "build" scripti buradan gecer. cwd bir prod slot worktree'siyse
# (blue = ~/projects/ilerihub, green = ~/projects/ilerihub-green) ve cagiran
# deploy.sh degilse (ILERIHUB_DEPLOY=1) build BASLAMADAN durur; .next'e
# dokunulmaz. deploy.sh yalniz PASIF slotu derler ve bayragi kendisi export eder.
#
# Ciplak `npx next build` package.json'i atlar — o yol icin ayni kontrol
# next.config.js icinde (PHASE_PRODUCTION_BUILD) tekrarlanir.
set -euo pipefail

CWD="$(pwd -P)"
case "$CWD" in
  /home/rokunet/projects/ilerihub|/home/rokunet/projects/ilerihub/*|\
  /home/rokunet/projects/ilerihub-green|/home/rokunet/projects/ilerihub-green/*)
    if [ "${ILERIHUB_DEPLOY:-}" != "1" ]; then
      echo "❌ Prod slot worktree'sinde elle build YASAK. ilerihub-build'de çalış, deploy.sh ile çık." >&2
      echo "   cwd: $CWD" >&2
      exit 1
    fi
    ;;
esac

# Eski "build" scriptinin birebir karsiligi (NODE_OPTIONS kosulsuz, eskisi gibi).
export NODE_OPTIONS=--max-old-space-size=8192
exec next build "$@"
