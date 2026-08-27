#!/usr/bin/env node
/**
 * 채널마다 그 채널의 사용법 안내를 게시하고 고정합니다.
 *
 *   node scripts/post-channel-intros.mjs          초안만 출력
 *   node scripts/post-channel-intros.mjs --post   실제 게시 + 고정
 *   node scripts/post-channel-intros.mjs --post 💻-리눅스   특정 채널만
 *
 * 이미 이 스크립트가 올린 안내가 있으면 지우고 새로 올립니다(중복 방지).
 * 채널 주제는 한 줄이라 처음 온 사람이 놓치기 쉬워, 고정 메시지로 보완합니다.
 */
import { loadEnv, discord } from './_env.mjs';

const apply = process.argv.includes('--post');
const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const env = loadEnv(['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID']);
const BLUE = 0x5865f2;
const GUIDE = 'https://ktci5.kr/guide';
const MARK = '​'; // 이 스크립트가 올린 메시지를 나중에 알아보기 위한 표식

const study = (topic, extra = []) => ({
  what: `${topic} 관련 질문과 자료를 나누는 곳입니다. 막힌 곳은 편하게 물어보세요.`,
  how: [
    '질문할 때 **무엇을 하려다 어떤 오류가 났는지** 함께 적어주시면 답이 훨씬 빨라집니다.',
    '터미널 출력이나 설정 파일은 ```` ``` ```` 세 개로 감싸주세요. 뒤에 `bash` 를 적으면 색도 입혀집니다.',
    '글로 설명하기 어려우면 옆 🔊 음성 채널에 들어가 **화면 공유**로 보여주세요.',
    '오래 두고 볼 자료는 `/자료함` 으로 이 채널 폴더를 열어 올려주세요.',
    ...extra,
  ],
});

const region = (name) => ({
  what: `${name} 지역 오프라인 모임을 잡는 곳입니다.`,
  how: [
    '먼저 여기에 글을 올려 사람을 모읍니다.',
    '날짜와 장소가 정해지면 `/일정등록` 으로 캘린더에 올려주세요. 다른 사람도 볼 수 있습니다.',
    '장소가 고민되면 **#🍜-맛집** 을 참고하세요.',
  ],
  example: '9월 셋째 주 토요일에 모여서 같이 실습해보려는데 관심 있으신 분 계신가요?',
});

const cert = (name, kinds) => ({
  what: `${name} 자격증 준비 채널입니다. (${kinds})`,
  how: [
    '준비 중인 종목과 목표 시험일을 남겨두면 같이 볼 사람이 붙습니다.',
    '막히는 문제는 문제 그대로 올려주세요. 사진이나 캡처도 좋습니다.',
    '정리 노트와 기출은 `/자료함` 으로 폴더에 올려두면 다음 기수에도 남습니다.',
    '시험 일정이 정해지면 `/일정등록` 으로 캘린더에 올려주세요.',
    '합격하면 후기를 남겨주세요. 뒤따라오는 사람에게 큰 도움이 됩니다.',
  ],
});

const group = (n) => ({
  what: `그룹${n} 전용 공간입니다. 그룹원에게만 보입니다.`,
  how: [
    '진도 맞추기, 과제 나누기, 일정 조율에 쓰세요.',
    '같은 이름의 🔊 음성 채널에서 함께 실습할 수 있습니다.',
    '그룹 자료는 `/자료함` 으로 그룹 폴더에 모아두세요.',
  ],
});

const INTROS = {
  '📜-서버-이용규칙': {
    what: '함께 쓰는 공간이라 최소한의 약속만 둡니다.',
    how: [
      '서로 존중하며 이야기해주세요. 모르는 것을 묻는 데 눈치 볼 필요 없습니다.',
      '질문에 답이 없다고 서운해하지 마시고, 조금 뒤 다시 올려주셔도 됩니다.',
      '광고, 정치, 특정인 비방은 삼가주세요.',
      '다른 사람의 개인정보나 과정 자료를 서버 밖으로 옮기지 말아주세요.',
    ],
  },
  '👋-자기소개': {
    what: '누가 있는지 알면 질문하기가 훨씬 편해집니다.',
    how: ['이름(또는 닉네임), 사는 지역, 관심 분야 정도면 충분합니다. 길게 안 쓰셔도 됩니다.'],
    example: '안녕하세요 홍길동입니다. 서울에 살고 있고 쿠버네티스 쪽을 파보려 합니다. 리눅스는 이제 시작 단계예요.',
  },
  '💬-자유게시판': {
    what: '스터디와 직접 관련 없는 이야기를 나누는 곳입니다.',
    how: ['잡담, 취업 정보, 유용한 소식 등 편하게 쓰세요.'],
  },
  '📋-스터디-일정추가': {
    what: '여기서 등록한 일정은 구글 캘린더에 자동으로 들어가고 이 채널에 카드로 공지됩니다.',
    how: [
      '`/일정등록` 을 입력하고 항목을 채웁니다. `Tab` 으로 다음 항목으로 넘어갑니다.',
      '날짜는 `9/10`, `9월 10일`, `2026-09-10` 모두 인식합니다.',
      '시각은 `22시` 또는 `22:00`. 진행시간을 비우면 2시간으로 잡힙니다.',
      '오늘 뭐가 있는지는 `/오늘일정` 으로 확인하세요.',
    ],
    example: '/일정등록 제목:쿠버네티스 3회차 날짜:9/10 시작시각:22시 진행시간:2 장소:온라인',
  },
  '💻-리눅스': study('리눅스'),
  '🌐-네트워크': study('TCP/IP, 라우팅, 방화벽 등 네트워크'),
  '☁️-클라우드': study('KT클라우드와 가상화, IaC'),
  '🐳-컨테이너-쿠버네티스': study('도커와 쿠버네티스'),
  '🗄️-데이터베이스': study('DB 설치·튜닝·백업 등 데이터베이스'),
  '📜-자격증': {
    what: '자격증 공통 채널입니다. 종목별 채널은 이 카테고리 아래에 따로 있습니다.',
    how: [
      '어떤 자격증을 딸지 고민될 때 여기서 물어보세요.',
      '접수 일정이나 시험 일정이 뜨면 여기에 공유해주세요.',
      '합격 후기도 환영합니다. 뒤따라오는 사람에게 큰 도움이 됩니다.',
      '준비 중인 종목이 정해지면 해당 채널로 가시면 됩니다.',
    ],
  },
  '☁️-aws-자격증': cert('AWS', 'CLF(클라우드 프랙티셔너) · SAA(솔루션스 아키텍트) · SOA · DVA'),
  '☁️-클라우드-자격증': cert('클라우드', 'KT Cloud · NCP(네이버) · Azure · GCP'),
  '🌐-네트워크-자격증': cert('네트워크', '네트워크관리사 1·2급 · CCNA'),
  '🐧-리눅스-자격증': cert('리눅스', '리눅스마스터 1·2급 · LPIC · RHCSA'),
  '⎈-쿠버네티스-자격증': {
    what: 'CKA·CKAD·CKS 준비 채널입니다.',
    how: [
      '**모두 실기 시험**입니다. 정해진 시간 안에 클러스터를 직접 만지는 방식이라, 손에 익히는 게 전부입니다.',
      '`kubectl` 단축 설정이나 문서 검색 요령처럼 시간을 줄이는 팁을 나눠주세요.',
      '실습 환경 구성이 막히면 **#🐳-컨테이너-쿠버네티스** 가 더 빠를 수 있습니다.',
      '시험 일정이 정해지면 `/일정등록` 으로 올려주세요.',
    ],
  },
  '📘-정보처리기사': cert('정보처리기사', '필기 · 실기'),
  '🔐-정보보안기사': cert('정보보안기사', '정보보안기사 · 정보보안산업기사'),
  '🗄️-sqld-자격증': cert('SQLD', 'SQLD · SQLP'),
  '🏙️-서울-경기': region('서울·경기'),
  '🌆-충청': region('충청'),
  '🌊-경상': region('경상'),
  '🌾-전라': region('전라'),
  '🏞️-강원-제주': { ...region('강원·제주'), what: '강원·제주 지역 모임입니다. 인원이 적으면 온라인으로 모입니다.' },
  '📸-오늘의-공부인증': {
    what: '오늘 공부한 흔적을 남기는 곳입니다. 꾸준히 하는 사람이 보이면 나도 하게 됩니다.',
    how: [
      '사진 한 장이면 충분합니다. 캡처는 `Ctrl/⌘ + V` 로 바로 붙여넣을 수 있습니다.',
      '한 줄 덧붙이면 서로 더 자극이 됩니다.',
    ],
    example: '오늘 3장까지 봤습니다. LVM 개념이 아직 헷갈리네요.',
  },
  '🔗-유용한링크': {
    what: '읽을 만한 문서와 블로그를 모으는 곳입니다.',
    how: ['링크만 던지지 마시고 **왜 좋은지** 한 줄 붙여주시면 다들 도움이 됩니다.'],
    example: 'https://... — LVM 을 그림으로 설명해서 이해가 확 됐습니다.',
  },
  '❓-질문답변': {
    what: '어느 분야인지 애매한 질문은 여기에. 아무거나 물어보셔도 됩니다.',
    how: [
      '분야가 분명하면 해당 스터디 채널이 답이 더 빨리 옵니다.',
      '서버 사용법이나 인증 문제도 여기에 남겨주세요.',
    ],
  },
  '🔒-그룹1': group(1),
  '🔒-그룹2': group(2),
  '🔒-그룹3': group(3),
  '🍜-맛집': {
    what: '가본 곳, 가보고 싶은 곳을 나눕니다.',
    how: ['지역 모임 장소를 정할 때 실제로 여기를 참고하게 됩니다. 지역도 함께 적어주세요.'],
    example: '강남역 근처 OO국밥 — 늦게까지 하고 자리가 넓어서 모임하기 좋습니다.',
  },
  '📷-사진': {
    what: '오늘의 한 장. 공부 사진이 아니어도 괜찮습니다.',
    how: ['설명 없이 사진만 올리셔도 됩니다.'],
  },
  '✈️-여행': {
    what: '다녀온 곳과 계획 중인 여행을 공유합니다.',
    how: ['일정이 겹치는 사람이 있을 수도 있습니다.'],
  },
  '운영진': {
    what: '운영진 전용 채널입니다.',
    how: [
      '명단에 없는 사람이 인증을 요청하면 **승인 버튼**이 달린 메시지가 여기로 옵니다.',
      '버튼은 역할 관리 권한이 있는 사람만 누를 수 있습니다.',
      '이름으로 인증한 경우에도 기록이 남습니다.',
    ],
  },
};

/* ------------------------------------------------------------------ 실행 */

function render(name, intro) {
  const fields = [];
  if (intro.how?.length) {
    fields.push({ name: '이렇게 써주세요', value: intro.how.map((h) => `• ${h}`).join('\n').slice(0, 1024) });
  }
  if (intro.example) {
    fields.push({ name: '예시', value: '```\n' + intro.example.slice(0, 900) + '\n```' });
  }
  return {
    embeds: [{
      title: `#${name}`,
      color: BLUE,
      description: intro.what + MARK,
      fields,
      footer: { text: '전체 사용 안내 → ktci5.kr/guide' },
    }],
  };
}

const channels = await discord(env, `/guilds/${env.DISCORD_GUILD_ID}/channels`);
const byName = Object.fromEntries(channels.filter((c) => c.type === 0).map((c) => [c.name, c]));
const bot = await discord(env, '/users/@me');

const targets = Object.entries(INTROS).filter(([n]) => !only.length || only.includes(n));
let posted = 0, missing = [], failed = [];

for (const [name, intro] of targets) {
  const ch = byName[name];
  console.log(`\n${'─'.repeat(58)}\n#${name}${ch ? '' : '   ✘ 채널 없음'}`);
  if (!ch) { missing.push(name); continue; }

  console.log(`  ${intro.what}`);
  for (const h of intro.how || []) console.log(`   • ${h.replace(/\*\*/g, '')}`);
  if (intro.example) console.log(`  예시: ${intro.example.split('\n')[0]}`);
  if (!apply) continue;

  // 이전에 올린 안내가 있으면 정리
  try {
    const msgs = await discord(env, `/channels/${ch.id}/messages?limit=30`);
    for (const m of msgs.filter((m) => m.author.id === bot.id && (m.embeds || []).some((e) => (e.description || '').includes(MARK)))) {
      await discord(env, `/channels/${ch.id}/messages/${m.id}`, { method: 'DELETE' });
    }
  } catch { /* 읽기 권한이 없으면 건너뜁니다 */ }

  const res = await fetch(`https://discord.com/api/v10/channels/${ch.id}/messages`, {
    method: 'POST',
    headers: {
      authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'DiscordBot (https://ktci5.kr, 1.0)',
    },
    body: JSON.stringify(render(name, intro)),
  });

  if (!res.ok) {
    console.log(`  ✘ 게시 실패 (${res.status})${res.status === 403 ? ' — 봇이 이 채널을 볼 수 없습니다' : ''}`);
    failed.push({ name, status: res.status });
    continue;
  }
  const msg = await res.json();
  const pin = await fetch(`https://discord.com/api/v10/channels/${ch.id}/pins/${msg.id}`, {
    method: 'PUT',
    headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'user-agent': 'DiscordBot (https://ktci5.kr, 1.0)' },
  });
  console.log(`  ✅ 게시${pin.ok ? ' · 고정' : ` (고정 실패 ${pin.status})`}`);
  posted++;
}

console.log(`\n${'═'.repeat(58)}`);
if (missing.length) console.log(`채널을 찾지 못함: ${missing.join(', ')}`);
if (failed.length) {
  console.log(`권한 등으로 실패: ${failed.map((f) => `#${f.name}(${f.status})`).join(', ')}`);
  console.log('  → 채널 편집 → 권한 → 봇 역할 추가 → "채널 보기" 허용 후 다시 실행하세요.');
}
console.log(apply
  ? `게시 완료 ${posted}개 / 대상 ${targets.length}개`
  : `초안 ${targets.length}개. 실제로 올리려면 --post 를 붙여 실행하세요.\n  node scripts/post-channel-intros.mjs --post`);
