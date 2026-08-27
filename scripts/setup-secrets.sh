#!/usr/bin/env bash
# ktci5 — Cloudflare Workers 시크릿 일괄 등록
#
# 두 가지 방식을 지원합니다.
#  1) 대화형 터미널에서 실행하면 값을 하나씩 물어봅니다.
#  2) .dev.vars 에 값을 채워두면 그 값을 읽어 비대화형으로 등록합니다.
#     (Claude Code 의 ! 입력처럼 TTY 가 없는 환경에서는 이 방식만 동작합니다)
#
# 값은 등록에만 쓰이고 저장소에는 남지 않습니다 (.dev.vars 는 .gitignore 대상).

set -euo pipefail
cd "$(dirname "$0")/.."

SECRETS=(
  "DISCORD_CLIENT_ID:디스코드 OAuth2 탭의 Client ID"
  "DISCORD_CLIENT_SECRET:디스코드 OAuth2 탭의 Client Secret (Reset Secret 후 복사)"
  "DISCORD_BOT_TOKEN:디스코드 Bot 탭의 토큰 (Manage Roles 권한 필요)"
  "DISCORD_ROLE_ID:부여할 @5기인증 역할 ID"
  "DISCORD_PUBLIC_KEY:General Information 탭의 Public Key (인터랙션 서명 검증용)"
  "GOOGLE_CALENDAR_ID:구글 캘린더 ID (일정 기능용, 설정 및 공유 → 캘린더 통합)"
)

# .dev.vars 에서 KEY 의 값을 읽습니다. 없거나 비어 있으면 실패를 반환합니다.
read_devvars() {
  local key="$1" line val
  [ -f .dev.vars ] || return 1
  line=$(grep -E "^[[:space:]]*${key}[[:space:]]*=" .dev.vars | head -1) || return 1
  [ -n "$line" ] || return 1
  val="${line#*=}"
  val="$(printf '%s' "$val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
                                  -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'\$//")"
  [ -n "$val" ] || return 1
  printf '%s' "$val"
}

interactive=false
[ -t 0 ] && interactive=true

if ! $interactive && [ ! -f .dev.vars ]; then
  cat >&2 <<'MSG'
✘ 대화형 터미널이 아닌데 .dev.vars 도 없습니다.
  이 상태로 진행하면 wrangler 가 빈 값을 등록해버립니다.

  해결 방법 두 가지 중 하나를 쓰세요.
   1) 터미널 앱(Terminal/iTerm)에서 직접 실행
        cd "$(pwd)" && bash scripts/setup-secrets.sh
   2) .dev.vars 에 값을 채운 뒤 다시 실행
        cp .dev.vars.example .dev.vars   # 그리고 값 입력
MSG
  exit 1
fi

echo "▸ Cloudflare 계정 확인"
npx wrangler whoami

failed=()
for entry in "${SECRETS[@]}"; do
  key="${entry%%:*}"
  desc="${entry#*:}"
  echo
  echo "▸ ${key} — ${desc}"

  if value=$(read_devvars "$key"); then
    echo "  .dev.vars 에서 값을 읽었습니다 (${#value}자)"
    printf '%s' "$value" | npx wrangler secret put "$key"
  elif $interactive; then
    npx wrangler secret put "$key"
  else
    echo "  ✘ .dev.vars 에 ${key} 값이 비어 있어 건너뜁니다."
    failed+=("$key")
  fi
done

echo
if [ ${#failed[@]} -gt 0 ]; then
  echo "✘ 값을 얻지 못한 시크릿: ${failed[*]}"
  echo "  .dev.vars 를 채우고 다시 실행하세요."
  exit 1
fi

echo "✅ 시크릿 등록 완료."
echo "   초대 링크 등 변수도 바꿨다면 'npx wrangler deploy' 를 이어서 실행하세요."
echo "   확인: curl -s https://ktci5.kr/discord/status"
