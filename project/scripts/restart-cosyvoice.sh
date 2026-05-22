#!/bin/bash
# Quick restart script — run on RunPod pod after a Start (not Deploy fresh).
# Spins up the CosyVoice server + Cloudflare tunnel, prints the new public URL.
#
# Usage on pod web terminal:
#   curl -sL https://raw.githubusercontent.com/onyx-studio-ai/onyx-mvp/main/project/scripts/restart-cosyvoice.sh | bash

set -e

echo "═══════════════════════════════════════════════════════════"
echo "  Onyx CosyVoice 2 — Restart"
echo "  $(date)"
echo "═══════════════════════════════════════════════════════════"

# Sanity check — make sure prior install is still on this volume
if [ ! -f /workspace/CosyVoice/server.py ]; then
  echo "❌ /workspace/CosyVoice/server.py not found."
  echo "   Volume probably isn't the one with the previous install."
  echo "   Run the full installer instead:"
  echo "   curl -sL https://raw.githubusercontent.com/onyx-studio-ai/onyx-mvp/main/project/scripts/install-cosyvoice2.sh | bash"
  exit 1
fi

if [ ! -d /workspace/miniconda3/envs/cosyvoice ]; then
  echo "❌ conda env 'cosyvoice' missing — re-run full installer."
  exit 1
fi

if [ ! -f /workspace/cloudflared ]; then
  echo "▶ Downloading cloudflared..."
  wget -q https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -O /workspace/cloudflared
  chmod +x /workspace/cloudflared
fi

# Kill any existing sessions cleanly
tmux kill-session -t cosyvoice 2>/dev/null || true
tmux kill-session -t tunnel 2>/dev/null || true

# Start CosyVoice server in tmux
echo "▶ Starting CosyVoice server (tmux: cosyvoice)..."
tmux new-session -d -s cosyvoice \
  "cd /workspace/CosyVoice && source /workspace/miniconda3/etc/profile.d/conda.sh && conda activate cosyvoice && python server.py 2>&1 | tee /workspace/cosyvoice-server.log"

# Start Cloudflare tunnel in tmux
echo "▶ Starting Cloudflare tunnel (tmux: tunnel)..."
tmux new-session -d -s tunnel \
  "/workspace/cloudflared tunnel --url http://localhost:8080 2>&1 | tee /workspace/tunnel.log"

# Wait for tunnel to come up (tunnel is faster than server load)
echo "▶ Waiting for tunnel URL..."
URL=""
for i in $(seq 1 30); do
  URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" /workspace/tunnel.log 2>/dev/null | head -1)
  if [ -n "$URL" ]; then
    break
  fi
  sleep 2
done

if [ -z "$URL" ]; then
  echo "❌ Tunnel didn't come up. Check: tail /workspace/tunnel.log"
  exit 1
fi

echo ""
echo "▶ Waiting for server to load model (~2-3 min)..."
for i in $(seq 1 90); do
  if curl -s -m 3 http://localhost:8080/health > /dev/null 2>&1; then
    echo "  ✅ Server ready after ${i}*2 = $((i*2))s"
    break
  fi
  if [ $i -eq 90 ]; then
    echo "  ⚠️  Server slow to come up. Check: tail /workspace/cosyvoice-server.log"
  fi
  sleep 2
done

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ✅ READY"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Public URL (paste into Vercel COSYVOICE_API_URL):"
echo "    $URL"
echo ""
echo "  Verify from your laptop:"
echo "    curl $URL/health"
echo ""
echo "  Useful sessions:"
echo "    tmux attach -t cosyvoice   # server"
echo "    tmux attach -t tunnel      # cloudflared"
echo ""
echo "═══════════════════════════════════════════════════════════"
