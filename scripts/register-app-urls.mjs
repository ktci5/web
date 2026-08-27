#!/usr/bin/env node
/**
 * Developer Portal 의 URL 4개를 API 로 설정합니다.
 *  - 인터랙션 엔드포인트 URL
 *  - 연결된 역할 인증 URL
 *  - 이용 약관 URL
 *  - 개인정보 보호 정책 URL
 *
 * 사용법: node scripts/register-app-urls.mjs
 *
 * 인터랙션 엔드포인트를 저장하는 순간 디스코드가 서명된 PING 과 잘못 서명한
 * 요청을 함께 보내 검증합니다. 그래서 먼저 배포 상태를 확인하고 진행합니다.
 */
import { loadEnv, discord } from './_env.mjs';

const BASE = process.env.KTCI5_BASE_URL || 'https://ktci5.kr';
const env = loadEnv(['DISCORD_BOT_TOKEN']);

const URLS = {
  interactions_endpoint_url: `${BASE}/discord/interactions`,
  role_connections_verification_url: `${BASE}/discord/linked-role`,
  terms_of_service_url: `${BASE}/terms`,
  privacy_policy_url: `${BASE}/privacy`,
};

// 사전 점검 — 배포가 준비되지 않았으면 디스코드 검증이 반드시 실패합니다.
console.log(`▸ ${BASE} 배포 상태 확인`);
let status;
try {
  const res = await fetch(`${BASE}/discord/status`);
  status = await res.json();
} catch (err) {
  console.error(`✘ ${BASE}/discord/status 에 접근할 수 없습니다: ${err.message}`);
  process.exit(1);
}

if (!status.ok || !status.interactions) {
  console.error('✘ 배포가 아직 준비되지 않았습니다.');
  if (status.missing?.length) console.error(`  누락된 시크릿: ${status.missing.join(', ')}`);
  if (!status.interactions) console.error('  DISCORD_PUBLIC_KEY 가 비어 있어 서명 검증을 할 수 없습니다.');
  console.error('  bash scripts/setup-secrets.sh 로 먼저 시크릿을 채우세요.');
  process.exit(1);
}

// 서명 없는 요청이 401 이어야 디스코드 검증을 통과할 수 있습니다.
const probe = await fetch(`${BASE}/discord/interactions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ type: 1 }),
});
if (probe.status !== 401) {
  console.error(`✘ 서명 없는 요청이 401 이 아니라 ${probe.status} 를 반환합니다.`);
  console.error('  302 면 Cloudflare Access 가, 503 이면 시크릿이 문제입니다.');
  process.exit(1);
}
console.log('  ✓ 배포 정상 (서명 없는 요청 → 401)');

console.log('\n▸ 애플리케이션 URL 설정');
for (const [k, v] of Object.entries(URLS)) console.log(`   ${k} = ${v}`);

const app = await discord(env, '/applications/@me', {
  method: 'PATCH',
  body: JSON.stringify(URLS),
});

console.log(`\n✅ "${app.name}" 앱 설정 완료`);
for (const k of Object.keys(URLS)) {
  const got = app[k];
  console.log(`   ${got === URLS[k] ? '✓' : '✘'} ${k}: ${got || '(미설정)'}`);
}
