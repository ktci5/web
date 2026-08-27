// .dev.vars 또는 환경변수에서 설정을 읽어옵니다. 값은 출력하지 않습니다.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function fromDevVars() {
  const path = join(ROOT, '.dev.vars');
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

// wrangler.toml 의 [vars] 블록을 읽습니다. 시크릿이 아닌 공개 설정의 단일 출처입니다.
function fromWranglerToml() {
  const path = join(ROOT, 'wrangler.toml');
  if (!existsSync(path)) return {};
  const out = {};
  let inVars = false;
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.trim();
    if (line.startsWith('#')) continue;
    if (line.startsWith('[')) { inVars = line === '[vars]'; continue; }
    if (!inVars) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const val = m[2].trim().replace(/^["']|["']$/g, '');
    if (val) out[m[1]] = val;
  }
  return out;
}

export function loadEnv(required) {
  const merged = { ...fromWranglerToml(), ...fromDevVars(), ...process.env };
  const missing = required.filter((k) => !merged[k]);
  if (missing.length) {
    console.error(`✘ 설정 누락: ${missing.join(', ')}`);
    console.error('  .dev.vars 에 채워 넣거나 환경변수로 전달해주세요. (.dev.vars.example 참고)');
    process.exit(1);
  }
  return merged;
}

// 디스코드는 채널 수정 같은 일부 엔드포인트에 강한 속도 제한을 겁니다
// (채널당 10분에 2회). 429 를 만나면 알려주는 시간만큼 기다렸다 다시 보냅니다.
export async function discord(env, path, init = {}, { retries = 3 } = {}) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://discord.com/api/v10${path}`, {
      ...init,
      headers: {
        authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
        'content-type': 'application/json',
        'user-agent': 'DiscordBot (https://ktci5.kr, 1.0)',
        ...init.headers,
      },
    });
    const text = await res.text();

    if (res.status === 429 && attempt < retries) {
      let wait = Number(res.headers.get('retry-after') || 5);
      try { wait = JSON.parse(text).retry_after ?? wait; } catch {}
      const sec = Math.ceil(wait);
      console.log(`   ⏳ 속도 제한 — ${sec}초 후 재시도 (${attempt + 1}/${retries})`);
      await new Promise((r) => setTimeout(r, sec * 1000 + 500));
      continue;
    }

    if (!res.ok) {
      console.error(`✘ ${init.method || 'GET'} ${path} → ${res.status}\n${text}`);
      process.exit(1);
    }
    return text ? JSON.parse(text) : null;
  }
}
