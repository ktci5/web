#!/usr/bin/env node
/**
 * 연결된 역할(Linked Roles) 메타데이터 스키마 등록.
 * 이걸 먼저 등록해야 서버 역할 설정에서 "링크 설정" 조건을 고를 수 있습니다.
 * 사용법: node scripts/register-role-metadata.mjs
 */
import { loadEnv, discord } from './_env.mjs';

const env = loadEnv(['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID']);

// type 3 = INTEGER_EQUAL, type 7 = BOOLEAN_EQUAL
const METADATA = [
  {
    key: 'verified',
    name: '5기 인증',
    description: '5기 인증을 완료한 회원',
    type: 7,
  },
  {
    key: 'cohort',
    name: '기수',
    description: 'KT클라우드 인프라교육 기수',
    type: 3,
  },
];

const path = `/applications/${env.DISCORD_CLIENT_ID}/role-connections/metadata`;
const result = await discord(env, path, { method: 'PUT', body: JSON.stringify(METADATA) });

console.log('✅ 연결된 역할 메타데이터 등록 완료');
for (const m of result) console.log(`   ${m.key} — ${m.name}`);
console.log('\n다음 단계: 서버 설정 → 역할 → 링크 설정 에서 이 앱의 조건을 선택하세요.');
