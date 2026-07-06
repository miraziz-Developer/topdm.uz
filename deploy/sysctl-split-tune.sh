#!/usr/bin/env bash
# 4GB split server — kernel tuning (root)
set -euo pipefail

sysctl -w vm.swappiness=10
sysctl -w vm.vfs_cache_pressure=50
sysctl -w net.core.somaxconn=4096
sysctl -w net.ipv4.tcp_fastopen=3 2>/dev/null || true

CONF=/etc/sysctl.d/99-bozorliii-split.conf
cat >"$CONF" <<'EOF'
vm.swappiness=10
vm.vfs_cache_pressure=50
net.core.somaxconn=4096
net.ipv4.tcp_fastopen=3
EOF

sysctl --system >/dev/null 2>&1 || true
echo "OK — sysctl split tuning applied"
