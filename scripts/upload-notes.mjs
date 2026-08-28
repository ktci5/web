#!/usr/bin/env node
/**
 * 가공한 학습 문서(마크다운)를 KV 에 올립니다.
 *
 *   node scripts/upload-notes.mjs                 전부
 *   node scripts/upload-notes.mjs find shell      특정 장만
 *   node scripts/upload-notes.mjs --dry-run       확인만
 *   node scripts/upload-notes.mjs --dir <경로>     문서 위치 지정
 *
 * 문서는 공개 저장소에 두지 않습니다. 기본 위치는 ktci5/data 를 받아둔
 * 폴더이고, COURSE_NOTES_DIR 환경변수나 --dir 로 바꿀 수 있습니다.
 *
 * 슬라이드 원문을 그대로 두지 않고 읽히는 글로 다시 쓴 것입니다.
 * 원문은 접어서 참고용으로만 남습니다.
 *
 * 파일 앞머리에 다음을 둡니다.
 *   ---
 *   id: find
 *   title: Find · Grep · 압축
 *   lead: 한 줄 소개
 *   ---
 */
import { readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dirArg = process.argv.indexOf('--dir');
const DIR = dirArg > -1 ? process.argv[dirArg + 1]
  : process.env.COURSE_NOTES_DIR
  || join(ROOT, '..', 'ktci5-data', 'course-notes');
const KEY = 'course:linux-basic:notes';

const dryRun = process.argv.includes('--dry-run');
const only = process.argv.slice(2)
  .filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--dir');

if (!existsSync(DIR)) {
  console.error(`✘ 문서 폴더가 없습니다: ${DIR}`);
  console.error('  ktci5/data 를 받아두거나 --dir 로 위치를 지정해주세요.');
  console.error('  예: git clone https://github.com/ktci5/data.git ../ktci5-data');
  process.exit(1);
}
console.log(`▸ ${DIR}`);

function parseFrontMatter(text, fallbackId) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  const meta = { id: fallbackId, title: fallbackId, lead: '' };
  if (!m) return { meta, body: text };
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: text.slice(m[0].length) };
}

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.md'))
  .filter((f) => !only.length || only.includes(basename(f, '.md')));

if (!files.length) {
  console.error(only.length ? `✘ 해당하는 문서가 없습니다: ${only.join(', ')}` : '✘ course-notes/ 에 .md 가 없습니다.');
  process.exit(1);
}

const notes = {};
for (const f of files) {
  const raw = readFileSync(join(DIR, f), 'utf8');
  const { meta, body } = parseFrontMatter(raw, basename(f, '.md'));
  notes[meta.id] = { title: meta.title, lead: meta.lead, markdown: body.trim() };
  console.log(`  ${meta.id.padEnd(9)} ${meta.title.padEnd(22)} ${body.trim().length.toLocaleString()}자`);
}

// 일부만 올릴 때 기존 것을 지우지 않도록 병합합니다.
let merged = notes;
if (only.length && !dryRun) {
  const r = spawnSync('npx', ['wrangler', 'kv', 'key', 'get', KEY, '--binding', 'ROSTER', '--remote'],
    { cwd: ROOT, encoding: 'utf8' });
  if (r.status === 0 && r.stdout.trim().startsWith('{')) {
    try { merged = { ...JSON.parse(r.stdout), ...notes }; } catch {}
  }
}

const payload = JSON.stringify(merged);
console.log(`\n총 ${Object.keys(merged).length}개 장, ${(payload.length / 1024).toFixed(0)} KB`);

if (dryRun) {
  console.log('\n확인만 했습니다. 올리려면 --dry-run 을 빼고 실행하세요.');
  process.exit(0);
}

const tmp = join(tmpdir(), `ktci5-notes-${process.pid}.json`);
writeFileSync(tmp, payload);
try {
  const r = spawnSync('npx', ['wrangler', 'kv', 'key', 'put', KEY,
    '--binding', 'ROSTER', '--remote', '--path', tmp], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) { console.error('✘ 업로드 실패'); process.exit(1); }
} finally {
  try { unlinkSync(tmp); } catch {}
}

console.log('\n✅ 업로드 완료 — https://ktci5.kr/study/course');
