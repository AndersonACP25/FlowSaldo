#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

case "${1:-listar}" in
  listar)
    printf '%s\n' 'Expo: expo-native-ui, expo-data-fetching' 'PostgreSQL: supabase-postgres-best-practices'
    exit 0
    ;;
  instalar) ;;
  *)
    printf 'Uso: bash skills.sh [listar|instalar]\n' >&2
    exit 2
    ;;
esac

pnpm dlx skills@1.9.0 add expo/skills@dfdebcc6c4c1bf7a9471cefd6b6f39c7ba6c884d \
  --skill expo-native-ui --skill expo-data-fetching
pnpm dlx skills@1.9.0 add supabase/agent-skills@c9be0e931b7930f7d02126d04774d904c381e7d7 \
  --skill supabase-postgres-best-practices
