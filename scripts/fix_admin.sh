#!/usr/bin/env bash
# Safe placeholder: legacy production hotfix script was removed because it contained
# hardcoded credentials and ad-hoc server mutation logic.
#
# Use documented, auditable deployment flow instead:
#   1) set required ADMIN_* values in server .env
#   2) deploy via docker compose / documented scripts
#   3) verify with scripts/diagnose-admin.sh

set -euo pipefail

echo "ERROR: scripts/fix_admin.sh is intentionally disabled."
echo "Reason: the previous version contained hardcoded credentials and unsafe remote mutations."
echo "Use documented deploy flow and environment-based admin configuration instead."
exit 1
