#!/usr/bin/env node
/**
 * CHANGELOG.md 하나로 사이트와 디스코드 공지를 함께 갱신합니다.
 *
 *   node scripts/post-updates.mjs           사이트 + 디스코드
 *   node scripts/post-updates.mjs --dry     확인만
 *   node scripts/post-updates.mjs --site    사이트(KV)만
 *   node scripts/post-updates.mjs --discord 디스코드만
 *
 * 디스코드는 새 글을 쌓지 않고 **고정된 공지 한 개를 고쳐 씁니다.**
 * 그 글의 id 는 KV 에 적어 두므로, 처음 한 번만 새로 올리고 그 뒤로는 계속
 * 같은 글이 갱신됩니다. 사람이 그 글을 지웠으면 알아서 다시 올립니다.
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { loadEnv, discord } from './_env.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = join(ROOT, 'CHANGELOG.md');

const dry = process.argv.includes('--dry');
const only = process.argv.includes('--site') ? 'site'
  : process.argv.includes('--discord') ? 'discord'
  : 'both';

const KV_CONTENT = 'site:updates';
const KV_MESSAGE = 'discord:updates-message';
const ANNOUNCE_CHANNEL = '📢-공지사항';
const MAX_DAYS = 4;          // 디스코드에 싣는 최근 날짜 수
const FIELD_LIMIT = 1024;    // 디스코드 임베드 필드 한 개의 최대 길이

const source = readFileSync(FILE, 'utf8');

/* ---------------------------------------------------------------- 파싱 */
// "## YYYY-MM-DD" 로 끊고, 그 아래 "### 제목" 을 항목으로 봅니다.
function parseDays(md) {
  const days = [];
  const re = /^## (\d{4}-\d{2}-\d{2})\s*$/gm;
  const marks = [...md.matchAll(re)];

  marks.forEach((m, i) => {
    const from = m.index + m[0].length;
    const to = i + 1 < marks.length ? marks[i + 1].index : md.length;
    const chunk = md.slice(from, to).replace(/\n---\s*\n/g, '\n').trim();

    const items = [];
    const ire = /^### (.+)$/gm;
    const imarks = [...chunk.matchAll(ire)];
    if (!imarks.length) {
      if (chunk) items.push({ title: '', body: chunk });
    } else {
      imarks.forEach((im, j) => {
        const f = im.index + im[0].length;
        const t = j + 1 < imarks.length ? imarks[j + 1].index : chunk.length;
        items.push({ title: im[1].trim(), body: chunk.slice(f, t).trim() });
      });
    }
    days.push({ date: m[1], items });
  });

  return days;
}

// 디스코드는 표와 제목을 못 그립니다. 목록과 강조만 남깁니다.
function toDiscord(text) {
  return text
    .replace(/^\s*\|.*\|\s*$/gm, '')          // 표 줄
    .replace(/^\s*[-*]\s+/gm, '• ')           // 목록 기호
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function clip(text, limit) {
  if (text.length <= limit) return text;
  const cut = text.slice(0, limit - 2);
  return cut.slice(0, cut.lastIndexOf('\n') > 0 ? cut.lastIndexOf('\n') : cut.length) + '\n…';
}

const days = parseDays(source);
if (!days.length) {
  console.error('✘ CHANGELOG.md 에서 "## YYYY-MM-DD" 를 찾지 못했습니다.');
  process.exit(1);
}

console.log(`▸ ${FILE}`);
console.log(`  날짜 ${days.length}개 · 항목 ${days.reduce((n, d) => n + d.items.length, 0)}개`);
console.log(`  최근: ${days.slice(0, MAX_DAYS).map((d) => d.date).join(', ')}`);

/* ------------------------------------------------------------ 임베드 */
function buildEmbed() {
  const fields = [];
  for (const day of days.slice(0, MAX_DAYS)) {
    const [y, m, d] = day.date.split('-');
    for (const item of day.items) {
      fields.push({
        name: `${Number(m)}월 ${Number(d)}일 — ${item.title || '업데이트'}`,
        value: clip(toDiscord(item.body), FIELD_LIMIT) || '내용 없음',
      });
    }
  }

  fields.push({
    name: '전체 내역',
    value: '지난 것까지 모두 보려면 → https://ktci5.kr/updates',
  });
  fields.push({
    name: '한 가지',
    value: '**인증하신 분만** 열립니다. 안 열리면 **#🔒-대기실** 에서 인증 먼저 해주세요.\n'
      + '틀린 곳이 있으면 **#❓-질문답변** 에 알려주세요.',
  });

  return {
    title: '📌 ktci5.kr 업데이트 안내',
    color: 0x5865f2,
    description: '사이트에 무엇이 새로 올라왔는지 **날짜순으로** 적어 둡니다.\n'
      + '새 소식이 생기면 이 글을 고쳐 쓰니 여기만 보시면 됩니다.',
    fields: fields.slice(0, 25),
    footer: { text: 'KT클라우드 인프라교육 5기 · 마지막 갱신' },
    timestamp: new Date().toISOString(),
  };
}

/* ---------------------------------------------------------------- KV */
function kv(args) {
  return spawnSync('npx', ['wrangler', 'kv', 'key', ...args, '--binding', 'ROSTER', '--remote'],
    { cwd: ROOT, encoding: 'utf8' });
}

function kvGet(key) {
  const r = kv(['get', key]);
  return r.status === 0 ? r.stdout.trim() : '';
}

function kvPut(key, value) {
  const tmp = join(tmpdir(), `ktci5-updates-${process.pid}`);
  writeFileSync(tmp, value);
  try {
    const r = spawnSync('npx', ['wrangler', 'kv', 'key', 'put', key,
      '--binding', 'ROSTER', '--remote', '--path', tmp], { cwd: ROOT, stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`KV 쓰기 실패: ${key}`);
  } finally {
    try { unlinkSync(tmp); } catch {}
  }
}

/* ---------------------------------------------------------------- 실행 */
const embed = buildEmbed();
console.log(`  디스코드 필드 ${embed.fields.length}개 · ${JSON.stringify(embed).length}자`);

if (dry) {
  console.log('\n--dry 이므로 아무것도 바꾸지 않았습니다.\n');
  embed.fields.forEach((f) => console.log(`  • ${f.name}`));
  process.exit(0);
}

if (only !== 'discord') {
  kvPut(KV_CONTENT, source);
  console.log('\n✅ 사이트 갱신 — https://ktci5.kr/updates');
}

if (only !== 'site') {
  const env = loadEnv(['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID']);
  const channels = await discord(env, `/guilds/${env.DISCORD_GUILD_ID}/channels`);
  const channel = channels.find((c) => c.name === ANNOUNCE_CHANNEL);
  if (!channel) {
    console.error(`✘ #${ANNOUNCE_CHANNEL} 채널을 찾지 못했습니다.`);
    process.exit(1);
  }

  const saved = kvGet(KV_MESSAGE);
  let messageId = '';

  if (saved) {
    try {
      const r = await discord(env, `/channels/${channel.id}/messages/${saved}`, {
        method: 'PATCH', body: JSON.stringify({ embeds: [embed] }),
      });
      messageId = r.id;
      console.log(`✅ 고정 공지 갱신 — #${channel.name} (${messageId})`);
    } catch (err) {
      console.warn(`  기존 공지를 고치지 못했습니다 (${err.message}). 새로 올립니다.`);
    }
  }

  if (!messageId) {
    const r = await discord(env, `/channels/${channel.id}/messages`, {
      method: 'POST', body: JSON.stringify({ embeds: [embed] }),
    });
    messageId = r.id;
    kvPut(KV_MESSAGE, messageId);
    try {
      await discord(env, `/channels/${channel.id}/pins/${messageId}`, { method: 'PUT' });
      console.log(`✅ 새 공지 게시 후 고정 — #${channel.name} (${messageId})`);
    } catch {
      console.log(`✅ 새 공지 게시 — #${channel.name} (${messageId}) · 고정은 수동으로`);
    }
  }
}
