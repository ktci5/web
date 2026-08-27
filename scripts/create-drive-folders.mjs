#!/usr/bin/env node
/**
 * 디스코드 채널 구조를 구글 드라이브 폴더로 옮깁니다.
 *
 *   node scripts/create-drive-folders.mjs          만들 폴더 미리보기
 *   node scripts/create-drive-folders.mjs --apply  실제 생성
 *
 * 채널 목록을 디스코드에서 직접 읽으므로, 채널을 추가한 뒤 다시 실행하면
 * 새 폴더만 만들어집니다. 이미 있는 이름은 건너뜁니다.
 *
 * 서비스 계정은 저장 용량이 0 이라 파일은 올리지 못하지만,
 * 폴더는 크기가 없어 만들 수 있습니다. 파일은 각자 드라이브에서 올립니다.
 */
import { loadEnv, discord } from './_env.mjs';
import { createSign } from 'node:crypto';

const apply = process.argv.includes('--apply');
const env = loadEnv(['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID', 'GOOGLE_SA_EMAIL', 'GOOGLE_SA_PRIVATE_KEY_B64']);

const ROOT_ID = process.env.DRIVE_ROOT_ID || '1PTw0vZFG8aANdsBp7-Nf4cA7cUVNIlwT';

// 파일이 쌓일 만한 카테고리만 옮깁니다. 공지·인증 채널은 폴더가 필요 없습니다.
const INCLUDE = [
  '📁 02. 케이스 스터디',
  '📁 03. TRACK A · Cloud Infra',
  '📁 04. 지역모임',
  '📁 05. 공부자료',
  '📁 06. 그룹스터디',
  '📁 07. 휴식',
  '📁 08. 자격증',
  '📁 09. 프로젝트 준비',
];

/* ------------------------------------------------------------ 구글 인증 */

async function driveToken() {
  const pem = Buffer.from(env.GOOGLE_SA_PRIVATE_KEY_B64, 'base64').toString('utf8');
  const now = Math.floor(Date.now() / 1000);
  const b64u = (b) => Buffer.from(b).toString('base64url');
  const unsigned = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64u(JSON.stringify({
    iss: env.GOOGLE_SA_EMAIL,
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: unsigned + '.' + signer.sign(pem, 'base64url'),
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('✘ 구글 인증 실패:', JSON.stringify(data).slice(0, 200));
    process.exit(1);
  }
  return data.access_token;
}

const token = await driveToken();
const GH = { authorization: 'Bearer ' + token, 'content-type': 'application/json' };

async function listChildren(parent) {
  const q = new URLSearchParams({
    q: `'${parent}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder'`,
    fields: 'files(id,name)', pageSize: '200',
  });
  const res = await fetch('https://www.googleapis.com/drive/v3/files?' + q, { headers: GH });
  const d = await res.json();
  if (!res.ok) {
    console.error(`✘ 드라이브 조회 실패 (${res.status}):`, d.error?.message);
    process.exit(1);
  }
  return d.files || [];
}

async function ensureFolder(parent, name, existing) {
  const found = existing.find((f) => f.name === name);
  if (found) return { id: found.id, created: false };
  if (!apply) return { id: null, created: true };

  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST', headers: GH,
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parent] }),
  });
  const d = await res.json();
  if (!res.ok) {
    console.error(`  ✘ 생성 실패 (${res.status}): ${d.error?.message}`);
    return { id: null, created: false, failed: true };
  }
  existing.push({ id: d.id, name });
  return { id: d.id, created: true };
}

/* ------------------------------------------------------------- 실행 */

const channels = await discord(env, `/guilds/${env.DISCORD_GUILD_ID}/channels`);
const cats = channels.filter((c) => c.type === 4);
const rootFolders = await listChildren(ROOT_ID);

let made = 0, kept = 0;

for (const catName of INCLUDE) {
  const cat = cats.find((c) => c.name === catName);
  if (!cat) { console.log(`\n${catName}  ✘ 서버에서 찾지 못했습니다`); continue; }

  const folderName = catName.replace(/^📁\s*/, '');
  const catFolder = await ensureFolder(ROOT_ID, folderName, rootFolders);
  console.log(`\n📁 ${folderName}${catFolder.created ? '  (새로 만듦)' : ''}`);
  catFolder.created ? made++ : kept++;

  const kids = catFolder.id ? await listChildren(catFolder.id) : [];
  const chans = channels
    .filter((c) => c.type === 0 && c.parent_id === cat.id)
    .sort((a, b) => a.position - b.position);

  for (const ch of chans) {
    const sub = await ensureFolder(catFolder.id, ch.name, kids);
    console.log(`   └ ${ch.name}${sub.created ? '  (새로 만듦)' : '  (있음)'}`);
    sub.created ? made++ : kept++;
  }
}

console.log(`\n만들 폴더 ${made}개, 이미 있는 폴더 ${kept}개`);
console.log(apply
  ? '\n생성이 끝났습니다.'
  : '\n미리보기입니다. 실제로 만들려면 --apply 를 붙여 실행하세요.\n  node scripts/create-drive-folders.mjs --apply');
