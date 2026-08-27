#!/usr/bin/env node
/**
 * 구글 서비스 계정 키(JSON)를 읽어 Worker 시크릿으로 등록합니다.
 *
 * 사용법:
 *   node scripts/setup-google.mjs ~/Downloads/서비스계정키.json
 *
 * PEM 개인키는 줄바꿈이 들어 있어 시크릿에 그대로 넣기 곤란하므로
 * base64 한 줄로 바꿔 GOOGLE_SA_PRIVATE_KEY_B64 에 저장합니다.
 * 키 파일 자체는 저장소로 복사하지 않습니다.
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const keyPath = process.argv[2];

if (!keyPath) {
  console.error('사용법: node scripts/setup-google.mjs <서비스계정키.json>');
  process.exit(1);
}
const abs = resolve(keyPath.replace(/^~/, process.env.HOME || '~'));
if (!existsSync(abs)) {
  console.error(`✘ 파일을 찾을 수 없습니다: ${abs}`);
  process.exit(1);
}

let key;
try {
  key = JSON.parse(readFileSync(abs, 'utf8'));
} catch (err) {
  console.error(`✘ JSON 을 읽을 수 없습니다: ${err.message}`);
  process.exit(1);
}

if (key.type !== 'service_account') {
  console.error(`✘ 서비스 계정 키가 아닙니다 (type=${key.type}). GCP → 서비스 계정 → 키 → JSON 으로 발급받으세요.`);
  process.exit(1);
}
for (const f of ['client_email', 'private_key']) {
  if (!key[f]) {
    console.error(`✘ 키 파일에 ${f} 가 없습니다.`);
    process.exit(1);
  }
}

const email = key.client_email;
const b64 = Buffer.from(key.private_key, 'utf8').toString('base64');

console.log('▸ 서비스 계정:', email);
console.log('  개인키 길이 :', key.private_key.length, '자 → base64', b64.length, '자');

// .dev.vars 갱신 (로컬 개발·재실행용)
const devVars = join(ROOT, '.dev.vars');
let text = existsSync(devVars) ? readFileSync(devVars, 'utf8') : '';
for (const [k, v] of [['GOOGLE_SA_EMAIL', email], ['GOOGLE_SA_PRIVATE_KEY_B64', b64]]) {
  const line = `${k}="${v}"`;
  text = new RegExp(`^\\s*${k}\\s*=.*$`, 'm').test(text)
    ? text.replace(new RegExp(`^\\s*${k}\\s*=.*$`, 'm'), line)
    : text.trimEnd() + `\n${line}\n`;
}
writeFileSync(devVars, text);
console.log('  .dev.vars 갱신 완료');

// Worker 시크릿 등록
for (const [k, v] of [['GOOGLE_SA_EMAIL', email], ['GOOGLE_SA_PRIVATE_KEY_B64', b64]]) {
  console.log(`\n▸ ${k} 등록`);
  const r = spawnSync('npx', ['wrangler', 'secret', 'put', k], {
    cwd: ROOT,
    input: v,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
  if (r.status !== 0) {
    console.error(`✘ ${k} 등록 실패`);
    process.exit(1);
  }
}

console.log(`
✅ 시크릿 등록 완료

다음 두 가지가 남았습니다.

 1) 구글 캘린더에서 대상 캘린더를 이 서비스 계정과 공유하세요.
      캘린더 설정 → 특정 사용자와 공유 → 사용자 추가
        이메일 : ${email}
        권한   : 변경 및 공유 관리

 2) 같은 화면 아래 "캘린더 통합"의 캘린더 ID 를 wrangler.toml 의
    GOOGLE_CALENDAR_ID 에 넣고 배포하세요.
      npx wrangler deploy
`);
