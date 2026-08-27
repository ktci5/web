#!/usr/bin/env node
/**
 * 명단 CSV 를 KV 에 올립니다.
 *
 *   node scripts/upload-roster.mjs list.csv
 *
 * CSV 컬럼: id, username, discriminator, nickname
 *   - id       : 디스코드 사용자 ID (있으면 클릭 없이 즉시 인증)
 *   - username : 디스코드 사용자명 (ID 가 없을 때 보조 매칭)
 *   - nickname : 실명 (본인이 목록에서 고를 때 표시되는 이름)
 *
 * 실명이 들어 있으므로 CSV 는 저장소에 커밋하지 않습니다(.gitignore).
 * KV 에만 올라가고, Worker 는 인증 시점에만 조회합니다.
 */
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { writeFileSync, unlinkSync } from 'node:fs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const path = process.argv[2] || join(ROOT, 'list.csv');
const abs = resolve(path.replace(/^~/, process.env.HOME || '~'));

if (!existsSync(abs)) {
  console.error(`✘ 파일을 찾을 수 없습니다: ${abs}`);
  process.exit(1);
}

/* 따옴표를 처리하는 최소 CSV 파서 */
function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

const raw = readFileSync(abs, 'utf8').replace(/^﻿/, '');
const rows = parseCsv(raw);
const header = rows[0].map((h) => h.trim().toLowerCase());
const idx = (name) => header.indexOf(name);

const iId = idx('id'), iUser = idx('username'), iNick = idx('nickname');
if (iId < 0 && iUser < 0 && iNick < 0) {
  console.error('✘ id / username / nickname 중 어떤 컬럼도 찾지 못했습니다.');
  console.error('  발견된 컬럼:', header.join(', '));
  process.exit(1);
}

const seen = new Set();
const members = [];
for (const r of rows.slice(1)) {
  const id = (iId >= 0 ? r[iId] || '' : '').trim();
  const username = (iUser >= 0 ? r[iUser] || '' : '').trim();
  const name = (iNick >= 0 ? r[iNick] || '' : '').trim();
  if (!id && !username && !name) continue;
  const key = id || username.toLowerCase() || name;
  if (seen.has(key)) continue;
  seen.add(key);
  members.push({ ...(id && { id }), ...(username && { username }), ...(name && { name }) });
}

const withId = members.filter((m) => m.id).length;
const withName = members.filter((m) => m.name).length;

console.log(`▸ ${abs}`);
console.log(`  총 ${members.length}명  (ID 보유 ${withId}명, 이름 보유 ${withName}명)`);
if (withName === 0) {
  console.log('  ⚠️ 이름이 하나도 없어 "이름으로 고르기" 경로가 동작하지 않습니다.');
}

const payload = JSON.stringify({ updatedAt: new Date().toISOString(), members });
const tmp = join(tmpdir(), `ktci5-roster-${process.pid}.json`);
writeFileSync(tmp, payload);

try {
  console.log(`\n▸ KV 업로드 (${(payload.length / 1024).toFixed(1)} KB)`);
  const r = spawnSync('npx', ['wrangler', 'kv', 'key', 'put', 'roster', '--binding', 'ROSTER', '--remote', '--path', tmp], {
    cwd: ROOT, stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error('✘ 업로드 실패');
    process.exit(1);
  }
} finally {
  try { unlinkSync(tmp); } catch {}
}

console.log(`
✅ 명단 업로드 완료

  ID 가 있는 ${withId}명은 /인증 만 누르면 클릭 없이 바로 역할이 부여됩니다.
  ID 가 없거나 계정이 바뀐 사람은 이름 목록에서 본인을 고르면 됩니다.
  명단에 없는 사람은 운영진 승인 대기로 넘어갑니다.
`);
