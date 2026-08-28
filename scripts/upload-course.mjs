#!/usr/bin/env node
/**
 * 강의 자료 PDF 를 장별로 나눠 KV 에 올립니다.
 *
 *   node scripts/upload-course.mjs "~/Downloads/3.ktcloud-Linux-기초.pdf"
 *   node scripts/upload-course.mjs <pdf> --dry-run   구조만 확인
 *
 * 교육 자료는 저작권이 있으므로 **공개 저장소에 두지 않습니다.**
 * KV 에만 올리고, Worker 가 인증을 확인한 뒤에만 보여줍니다.
 *
 * pdftotext(poppler) 가 필요합니다.  brew install poppler
 */
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, join, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const dryRun = process.argv.includes('--dry-run');
const input = process.argv.slice(2).find((a) => !a.startsWith('--'));

if (!input) {
  console.error('사용법: node scripts/upload-course.mjs <PDF 경로> [--dry-run]');
  process.exit(1);
}
const pdf = resolve(input.replace(/^~/, process.env.HOME || '~'));
if (!existsSync(pdf)) {
  console.error(`✘ 파일이 없습니다: ${pdf}`);
  process.exit(1);
}

// 장 구분 — 시작 쪽과 이름. 자료가 바뀌면 여기만 고칩니다.
const CHAPTERS = [
  { id: 'intro',    name: '리눅스 이해',        from: 3,   summary: '리눅스가 무엇이고 배포판이 어떻게 나뉘는지' },
  { id: 'login',    name: '로그인과 사용자',     from: 8,   summary: '접속, 사용자 전환, 내 정보 확인' },
  { id: 'os',       name: 'OS 구조 이해',       from: 16,  summary: '커널·셸·파일시스템과 하드웨어 구성' },
  { id: 'files',    name: '디렉토리와 파일',     from: 28,  summary: '탐색·생성·복사·이동·삭제, 링크와 권한' },
  { id: 'shell',    name: 'Shell 과 환경설정',   from: 59,  summary: '셸 동작 원리, 변수, 프로파일 파일' },
  { id: 'vi',       name: 'Vi 편집기',          from: 80,  summary: '모드 전환과 편집 · 검색 · 치환' },
  { id: 'script',   name: 'Shell Script',      from: 90,  summary: '스크립트 작성, 조건문, 인자 처리' },
  { id: 'find',     name: 'Find · Grep · 압축', from: 97,  summary: '파일과 내용 검색, tar·gzip' },
  { id: 'process',  name: '프로세스 관리',       from: 104, summary: '조회, 시그널, 백그라운드 작업' },
  { id: 'service',  name: '서비스와 패키지',     from: 115, summary: 'systemd 제어와 dnf 설치' },
];

/* ---------------------------------------------------------------- 추출 */

let raw;
try {
  raw = execFileSync('pdftotext', ['-layout', pdf, '-'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  });
} catch (err) {
  console.error('✘ pdftotext 를 실행하지 못했습니다. poppler 가 설치되어 있나요?');
  console.error('  brew install poppler');
  process.exit(1);
}

const pages = raw.split('\f');

function cleanPage(text) {
  const lines = text
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim());
  if (!lines.length) return null;

  // 첫 줄을 제목으로, 나머지를 본문으로. 들여쓰기는 살립니다.
  const title = lines[0].trim().replace(/^[➢▪•\s]+/, '');
  const body = lines.slice(1)
    .map((l) => l.replace(/\t/g, '  '))
    .filter((l) => l.trim().length > 1);

  return body.length ? { title, body } : { title, body: [] };
}

const chapters = CHAPTERS.map((c, i) => {
  const to = (CHAPTERS[i + 1]?.from ?? pages.length + 1) - 1;
  const slides = [];
  for (let p = c.from; p <= to && p <= pages.length; p++) {
    const parsed = cleanPage(pages[p - 1] || '');
    if (parsed) slides.push({ page: p, ...parsed });
  }
  return { ...c, to, slides };
});

const doc = {
  title: 'ktcloud Linux 기초',
  source: basename(pdf),
  pages: pages.length,
  updatedAt: new Date().toISOString(),
  chapters,
};

console.log(`▸ ${doc.source} — ${doc.pages}쪽\n`);
for (const c of doc.chapters) {
  const chars = c.slides.reduce((s, x) => s + x.body.join('').length, 0);
  console.log(`  ${c.id.padEnd(9)} ${c.name.padEnd(16)} ${String(c.from).padStart(3)}~${String(c.to).padEnd(3)} ${String(c.slides.length).padStart(3)}쪽  ${chars.toLocaleString()}자`);
}

const payload = JSON.stringify(doc);
console.log(`\n총 ${(payload.length / 1024).toFixed(0)} KB`);

if (dryRun) {
  console.log('\n구조만 확인했습니다. 올리려면 --dry-run 을 빼고 실행하세요.');
  process.exit(0);
}

const tmp = join(tmpdir(), `ktci5-course-${process.pid}.json`);
writeFileSync(tmp, payload);
try {
  const r = spawnSync('npx', [
    'wrangler', 'kv', 'key', 'put', 'course:linux-basic',
    '--binding', 'ROSTER', '--remote', '--path', tmp,
  ], { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) { console.error('✘ 업로드 실패'); process.exit(1); }
} finally {
  try { unlinkSync(tmp); } catch {}
}

console.log(`
✅ 업로드 완료

  https://ktci5.kr/study/course 에서 인증한 수강생만 볼 수 있습니다.
  원본 PDF 와 추출 내용은 공개 저장소에 두지 않습니다.
`);
