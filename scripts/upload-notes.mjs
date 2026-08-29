#!/usr/bin/env node
/**
 * 가공한 학습 문서(마크다운)를 KV 에 올립니다.
 *
 *   node scripts/upload-notes.mjs linux              그 과목 전부
 *   node scripts/upload-notes.mjs bash sed awk       특정 장만
 *   node scripts/upload-notes.mjs linux --dry-run    확인만
 *   node scripts/upload-notes.mjs linux --dir <경로>  문서 위치 지정
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
const NOTES_ROOT = dirArg > -1 ? process.argv[dirArg + 1]
  : process.env.COURSE_NOTES_DIR
  || join(ROOT, '..', 'ktci5-data', 'course-notes');


const dryRun = process.argv.includes('--dry-run');
const positional = process.argv.slice(2)
  .filter((a, i, all) => !a.startsWith('--') && all[i - 1] !== '--dir');
const courseId = positional[0];
const only = positional.slice(1);

if (!courseId) {
  console.error('사용법: node scripts/upload-notes.mjs <과목> [장ID...] [--dry-run]');
  console.error('  예: node scripts/upload-notes.mjs bash');
  process.exit(1);
}

const KEY = `course:${courseId}:notes`;
const DIR = join(NOTES_ROOT, courseId);

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
  .filter((f) => f !== 'README.md')   // 폴더 설명은 장이 아닙니다
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

// --notify 플래그가 붙어있으면 해당되는 디스코드 주제 채널을 자동으로 찾아 알림글 게시
if (process.argv.includes('--notify')) {
  try {
    const { loadEnv, discord } = await import('./_env.mjs');
    const env = loadEnv(['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID']);
    const channels = await discord(env, `/guilds/${env.DISCORD_GUILD_ID}/channels`);

    const COURSE_CHANNEL_MAP = {
      linux: ['💻-리눅스', '🐧-리눅스-자격증'],
      bash: ['💻-리눅스', '🐧-리눅스-자격증'],
      network: ['🌐-네트워크', '🌐-네트워크-자격증'],
      cloud: ['☁️-클라우드', '☁️-aws-자격증'],
      aws: ['☁️-aws-자격증', '☁️-클라우드'],
      container: ['🐳-컨테이너-쿠버네티스', '⎈-쿠버네티스-자격증'],
      k8s: ['🐳-컨테이너-쿠버네티스', '⎈-쿠버네티스-자격증'],
      database: ['🗄️-데이터베이스', '🗄️-sqld-자격증'],
      sqld: ['🗄️-sqld-자격증', '🗄️-데이터베이스'],
    };

    const candidates = COURSE_CHANNEL_MAP[courseId.toLowerCase()] || [];
    let targetChannel = channels.find((c) => candidates.includes(c.name));
    if (!targetChannel) {
      targetChannel = channels.find((c) => c.name === '📚-자료공유' || c.name === '📢-공지사항');
    }

    if (targetChannel) {
      const updatedList = Object.values(notes).map((n) => `• **${n.title}**: ${n.lead || ''}`).join('\n');
      const embed = {
        title: `📘 [강의 정리] ${courseId.toUpperCase()} 과목 학습 자료가 업로드되었습니다`,
        color: 0x5865f2,
        description: `해당 분야 스터디 정리 문서 작성이 완료되었습니다.\n아래 링크에서 내용을 확인하실 수 있습니다.\n\n${updatedList}`,
        fields: [
          { name: '📖 웹에서 보기', value: `https://ktci5.kr/study/course/${courseId}` },
          { name: '🗓️ 스터디 캘린더', value: 'https://ktci5.kr/study/calendar' }
        ],
        footer: { text: `KT클라우드 인프라교육 5기 · #${targetChannel.name}` },
        timestamp: new Date().toISOString()
      };

      await discord(env, `/channels/${targetChannel.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ embeds: [embed] })
      });
      console.log(`📢 #${targetChannel.name} 채널에 과목 공지글을 성공적으로 게시했습니다!`);
    } else {
      console.warn('⚠️ 적절한 디스코드 공지 채널을 찾지 못했습니다.');
    }
  } catch (err) {
    console.warn('⚠️ 디스코드 알림 게시 경고:', err.message);
  }
}
