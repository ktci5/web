#!/usr/bin/env node
/**
 * 강의 자료 PDF 에서 장 구조를 뽑아 KV 에 올립니다.
 *
 *   node scripts/upload-course.mjs linux <pdf>            장 구조 업로드
 *   node scripts/upload-course.mjs bash <pdf> --dry-run   확인만
 *
 * 여기서 올리는 것은 **장 구분과 원본 쪽 범위**뿐입니다.
 * 화면에 보이는 본문은 scripts/upload-notes.mjs 로 올리는 정리본입니다.
 * 원본 슬라이드는 웹에 싣지 않습니다.
 *
 * pdftotext(poppler) 필요.  brew install poppler
 */
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { resolve, join, dirname, basename } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------ 과목 정의 */
// 새 자료를 추가하려면 여기에 한 항목을 더합니다.
// from 은 그 장이 시작하는 쪽. 끝 쪽은 다음 장 직전까지로 자동 계산됩니다.

const COURSES = {
  linux: {
    title: 'Linux 기초',
    subtitle: '리눅스를 처음 다루는 데 필요한 것들',
    order: 1,
    chapters: [
      { id: 'intro',   name: '리눅스 이해',        from: 3,   summary: '리눅스가 무엇이고 배포판이 어떻게 나뉘는지' },
      { id: 'login',   name: '로그인과 사용자',     from: 8,   summary: '접속, 사용자 전환, 내 정보 확인' },
      { id: 'os',      name: 'OS 구조 이해',       from: 16,  summary: '커널·셸·파일시스템과 하드웨어 구성' },
      { id: 'files',   name: '디렉토리와 파일',     from: 28,  summary: '탐색·생성·복사·이동·삭제, 링크와 권한' },
      { id: 'shell',   name: 'Shell 과 환경설정',   from: 59,  summary: '셸 동작 원리, 변수, 프로파일 파일' },
      { id: 'vi',      name: 'Vi 편집기',          from: 80,  summary: '모드 전환과 편집 · 검색 · 치환' },
      { id: 'script',  name: 'Shell Script',      from: 90,  summary: '스크립트 작성, 조건문, 인자 처리' },
      { id: 'find',    name: 'Find · Grep · 압축', from: 97,  summary: '파일과 내용 검색, tar·gzip' },
      { id: 'process', name: '프로세스 관리',       from: 104, summary: '조회, 시그널, 백그라운드 작업' },
      { id: 'service', name: '서비스와 패키지',     from: 115, summary: 'systemd 제어와 dnf 설치' },
    ],
  },
  bash: {
    title: 'Shell Programming',
    subtitle: 'bash 로 반복 작업을 자동화하기',
    order: 2,
    chapters: [
      { id: 'basics', name: '셸과 스크립트 실행',   from: 3,  summary: '셸의 종류, 스크립트를 실행하는 여러 방법' },
      { id: 'vars',   name: '변수와 연산',          from: 12, summary: '변수 다루기, 산술 연산, 문자열 가공' },
      { id: 'args',   name: '인자와 위치 변수',      from: 23, summary: '스크립트에 값을 넘기고 받아 처리하기' },
      { id: 'cond',   name: '조건문과 종료 상태',    from: 29, summary: 'if · case · test, 그리고 $?' },
      { id: 'sed',    name: 'grep 확장과 sed',      from: 48, summary: '정규표현식과 스트림 편집기' },
      { id: 'awk',    name: 'awk',                 from: 61, summary: '열 단위로 데이터를 뽑고 계산하기' },
      { id: 'loop',   name: '반복문',               from: 75, summary: 'for · while · until · select' },
      { id: 'flow',   name: '흐름 제어와 함수',      from: 90, summary: 'break · continue · here document · 함수' },
    ],
  },
  admin: {
    title: 'Linux 관리자',
    subtitle: '서버를 맡아 운영하는 데 필요한 것들',
    order: 3,
    chapters: [
      { id: 'install',  name: '실습 환경과 설치',      from: 3,   summary: 'Rocky Linux 설치와 실습 환경 구성' },
      { id: 'users',    name: '사용자와 권한 관리',     from: 7,   summary: '계정, 그룹, 암호 정책, sudo, 접속 기록' },
      { id: 'pkg',      name: '패키지 관리',           from: 29,  summary: 'dnf 와 rpm, 저장소 다루기' },
      { id: 'service',  name: '서비스와 데몬 제어',     from: 44,  summary: 'systemd 로 서비스를 켜고 끄고 진단하기' },
      { id: 'cron',     name: '작업 스케줄링과 시간',   from: 54,  summary: 'cron, at, 그리고 시간 동기화(NTP)' },
      { id: 'disk',     name: '디스크와 파티션',       from: 67,  summary: 'fdisk, parted 로 디스크 나누기' },
      { id: 'fs',       name: '파일 시스템 관리',       from: 79,  summary: '포맷, 마운트, fstab, 용량 관리' },
      { id: 'lvm',      name: '논리 볼륨 관리',        from: 98,  summary: 'LVM 으로 유연하게 용량 늘리기' },
      { id: 'raid',     name: 'RAID',                from: 107, summary: '디스크를 묶어 안정성과 성능 얻기' },
      { id: 'swap',     name: '메모리와 스왑',         from: 119, summary: '메모리 상태 읽기와 스왑 구성' },
      { id: 'boot',     name: '시스템 시작과 종료',     from: 129, summary: '부팅 과정, GRUB2, 커널, 복구 모드' },
      { id: 'backup',   name: '백업과 복구',           from: 152, summary: 'tar, rsync, dump 로 지키고 되돌리기' },
      { id: 'log',      name: '로그 관리',             from: 167, summary: 'journald, rsyslog, 로그 순환' },
      { id: 'firewall', name: '방화벽 관리',           from: 185, summary: 'firewalld 존과 서비스 규칙' },
      { id: 'selinux',  name: 'SELinux 관리',         from: 199, summary: '모드, 컨텍스트, 불리언 다루기' },
      { id: 'network',  name: '네트워크 관리',         from: 214, summary: 'nmcli 로 주소와 경로 설정하기' },
      { id: 'ssh',      name: 'SSH 원격 접속',         from: 239, summary: '키 인증과 안전한 접속 설정' },
      { id: 'nfs',      name: 'Teaming 과 NFS',       from: 247, summary: '네트워크 이중화와 파일 공유' },
      { id: 'trouble',  name: '문제 해결',             from: 259, summary: '증상별로 원인을 좁혀 가는 순서' },
    ],
  },
};

/* ------------------------------------------------------------------ 실행 */

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const rest = args.filter((a) => !a.startsWith('--'));
const [courseId, pdfPath] = rest;

if (!courseId || !COURSES[courseId]) {
  console.error('사용법: node scripts/upload-course.mjs <과목> <PDF> [--dry-run]');
  console.error(`  과목: ${Object.keys(COURSES).join(', ')}`);
  process.exit(1);
}
if (!pdfPath) {
  console.error('✘ PDF 경로가 필요합니다.');
  process.exit(1);
}

const pdf = resolve(pdfPath.replace(/^~/, process.env.HOME || '~'));
if (!existsSync(pdf)) {
  console.error(`✘ 파일이 없습니다: ${pdf}`);
  process.exit(1);
}

const course = COURSES[courseId];

let pages;
try {
  pages = execFileSync('pdftotext', ['-layout', pdf, '-'], {
    encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }).split('\f');
} catch {
  console.error('✘ pdftotext 실패. poppler 가 설치되어 있나요?  brew install poppler');
  process.exit(1);
}

const chapters = course.chapters.map((c, i) => {
  const to = (course.chapters[i + 1]?.from ?? pages.length + 1) - 1;
  return { ...c, to };
});

const doc = {
  id: courseId,
  title: course.title,
  subtitle: course.subtitle,
  order: course.order,
  source: basename(pdf),
  pages: pages.length,
  updatedAt: new Date().toISOString(),
  chapters,
};

console.log(`▸ ${course.title} — ${doc.source} (${doc.pages}쪽)\n`);
for (const c of chapters) {
  console.log(`  ${c.id.padEnd(9)} ${c.name.padEnd(20)} p.${String(c.from).padStart(3)}~${String(c.to).padEnd(3)}  ${c.summary}`);
}

if (dryRun) {
  console.log('\n구조만 확인했습니다. 올리려면 --dry-run 을 빼고 실행하세요.');
  process.exit(0);
}

function kvPut(key, value) {
  const tmp = join(tmpdir(), `ktci5-${key.replace(/[:/]/g, '-')}-${process.pid}.json`);
  writeFileSync(tmp, value);
  try {
    const r = spawnSync('npx', ['wrangler', 'kv', 'key', 'put', key,
      '--binding', 'ROSTER', '--remote', '--path', tmp], { cwd: ROOT, stdio: 'pipe' });
    if (r.status !== 0) {
      console.error(`✘ ${key} 업로드 실패\n${r.stderr?.toString().slice(0, 300)}`);
      process.exit(1);
    }
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

kvPut(`course:${courseId}`, JSON.stringify(doc));
console.log(`\n  course:${courseId} 올림`);

// 과목 목록 갱신
const index = Object.entries(COURSES)
  .map(([id, c]) => ({ id, title: c.title, subtitle: c.subtitle, order: c.order }))
  .sort((a, b) => a.order - b.order);
kvPut('course:index', JSON.stringify(index));
console.log(`  course:index 갱신 (${index.length}과목)`);

console.log(`
✅ 완료

  다음: 정리본을 작성하고 올립니다.
    ktci5-data/course-notes/${courseId}/<장ID>.md
    node scripts/upload-notes.mjs ${courseId}
`);
