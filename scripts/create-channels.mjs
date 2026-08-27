#!/usr/bin/env node
/**
 * 기존 카테고리 구조에 맞춰 빠진 채널을 만듭니다.
 *
 *   node scripts/create-channels.mjs           만들 채널 미리보기
 *   node scripts/create-channels.mjs --apply   실제 생성
 *
 * 이미 있는 이름은 건너뜁니다. 여러 번 실행해도 중복이 생기지 않습니다.
 * 새 채널은 카테고리 권한을 그대로 물려받습니다.
 *
 * 계획은 아래 PLAN 만 고치면 됩니다.
 *   voice: true  → 같은 이름의 음성 채널을 함께 만듭니다 (#💻-리눅스 형태)
 */

import { loadEnv, discord } from './_env.mjs';

const apply = process.argv.includes('--apply');
const env = loadEnv(['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID']);

const PLAN = [
  {
    category: '📁 01. WELCOME',
    channels: [
      { name: '👋-자기소개', topic: '간단히 인사 남겨주세요. 이름, 관심 분야, 지역 정도면 충분합니다.' },
      { name: '💬-자유게시판', topic: '스터디 외 잡담과 정보 공유. 편하게 쓰세요.' },
    ],
  },
  {
    category: '📁 03. 분야별 스터디',
    channels: [
      { name: '🌐-네트워크', topic: 'TCP/IP, 라우팅, 방화벽 등 네트워크 주제를 다룹니다.', voice: true },
      { name: '☁️-클라우드', topic: 'KT클라우드와 가상화, IaC 관련 질문과 자료를 나눕니다.', voice: true },
      { name: '🐳-컨테이너-쿠버네티스', topic: '도커와 쿠버네티스. 실습하다 막힌 곳을 함께 풉니다.', voice: true },
      { name: '🗄️-데이터베이스', topic: 'DB 설치·튜닝·백업 등 데이터베이스 주제를 다룹니다.', voice: true },
    ],
  },
  {
    category: '📁 04. 지역모임',
    channels: [
      { name: '🌆-충청', topic: '충청 지역 오프라인 모임. 날짜가 정해지면 /일정등록 으로 공유해주세요.', voice: true },
      { name: '🌊-경상', topic: '경상 지역 오프라인 모임. 날짜가 정해지면 /일정등록 으로 공유해주세요.', voice: true },
      { name: '🌾-전라', topic: '전라 지역 오프라인 모임. 날짜가 정해지면 /일정등록 으로 공유해주세요.', voice: true },
      { name: '🏞️-강원-제주', topic: '강원·제주 지역 모임. 인원이 적으면 온라인으로 모입니다.', voice: true },
    ],
  },
  {
    category: '📁 05. 공부자료',
    channels: [
      { name: '📚-자료공유', topic: '강의 자료, 정리 노트, 실습 스크립트를 올립니다.' },
      { name: '🔗-유용한링크', topic: '읽을 만한 문서와 블로그 링크를 모읍니다.' },
      { name: '❓-질문답변', topic: '어느 분야인지 애매한 질문은 여기에. 아무거나 물어보세요.' },
    ],
  },
  {
    category: '📁 06. 그룹스터디',
    channels: [
      { name: '🔒-그룹2', topic: '그룹2 전용 공간입니다. 그룹원끼리 자유롭게 쓰세요.', voice: true, voicePrefix: '🔊' },
      { name: '🔒-그룹3', topic: '그룹3 전용 공간입니다. 그룹원끼리 자유롭게 쓰세요.', voice: true, voicePrefix: '🔊' },
    ],
  },
  {
    category: '📁 08. 자격증',
    channels: [
      { name: '☁️-aws-자격증', topic: 'AWS 자격증(CLF·SAA·SOA·DVA) 준비. 기출, 실습 팁, 시험 후기.' },
      { name: '☁️-클라우드-자격증', topic: 'KT Cloud·NCP·Azure·GCP 등 클라우드 자격증 준비.' },
      { name: '🌐-네트워크-자격증', topic: '네트워크관리사, CCNA 등 네트워크 자격증 준비.' },
      { name: '🐧-리눅스-자격증', topic: '리눅스마스터, LPIC, RHCSA 등 리눅스 자격증 준비.' },
      { name: '⎈-쿠버네티스-자격증', topic: 'CKA·CKAD·CKS 준비. 실기 환경 익히는 요령을 나눕니다.' },
      { name: '📘-정보처리기사', topic: '정보처리기사 필기·실기 준비. 기출과 요약 공유.' },
      { name: '🔐-정보보안기사', topic: '정보보안기사·산업기사 준비.' },
      { name: '🗄️-sqld-자격증', topic: 'SQLD·SQLP 준비. 문제 풀이와 개념 정리.' },
    ],
  },
  {
    category: '📁 07. 휴식',
    channels: [
      { name: '🍜-맛집', topic: '가본 곳, 가보고 싶은 곳을 나눕니다. 지역 모임 장소 고를 때 참고가 됩니다.' },
      { name: '📷-사진', topic: '오늘의 한 장. 공부 사진이 아니어도 괜찮습니다.' },
      { name: '✈️-여행', topic: '다녀온 곳과 계획 중인 여행을 공유합니다.' },
      { name: '🎧-휴게실', voice: true, voiceOnly: true },
    ],
  },
];

function voiceName(ch) {
  return ch.voicePrefix ? ch.name.replace(/^[^-]+/, ch.voicePrefix) : ch.name;
}

const existing = await discord(env, `/guilds/${env.DISCORD_GUILD_ID}/channels`);
const cats = existing.filter((c) => c.type === 4);  // 새로 만들면 여기에 추가됩니다
const names = new Set(existing.map((c) => `${c.type}:${c.name}`));

let willCreate = 0, already = 0;
const missingCats = [];

for (const group of PLAN) {
  let cat = cats.find((c) => c.name === group.category);
  if (!cat) {
    console.log(`\n${group.category}  (카테고리 없음 — 새로 만듭니다)`);
    if (!apply) {
      willCreate++;
      for (const ch of group.channels) {
        if (!ch.voiceOnly) {
          willCreate++;
          console.log(`  + 💬 텍스트  #${ch.name}`);
          if (ch.topic) console.log(`      ${ch.topic}`);
        }
        if (ch.voice) {
          willCreate++;
          console.log(`  + 🔊 음성  #${voiceName(ch)}`);
        }
      }
      continue;
    }
    cat = await discord(env, `/guilds/${env.DISCORD_GUILD_ID}/channels`, {
      method: 'POST',
      body: JSON.stringify({ name: group.category, type: 4 }),
    });
    cats.push(cat);
    willCreate++;
    console.log('  ✅ 카테고리 생성됨');
  }

  const todo = [];
  for (const ch of group.channels) {
    if (!ch.voiceOnly) {
      if (!names.has(`0:${ch.name}`)) todo.push({ ...ch, kind: 'text' });
      else already++;
    }

    if (ch.voice) {
      const vname = voiceName(ch);
      if (!names.has(`2:${vname}`)) todo.push({ name: vname, kind: 'voice' });
      else already++;
    }
  }

  if (!todo.length) continue;
  console.log(`\n${group.category}`);
  for (const t of todo) {
    willCreate++;
    console.log(`  + ${t.kind === 'voice' ? '🔊 음성' : '💬 텍스트'}  #${t.name}`);
    if (t.topic) console.log(`      ${t.topic}`);

    if (apply) {
      await discord(env, `/guilds/${env.DISCORD_GUILD_ID}/channels`, {
        method: 'POST',
        body: JSON.stringify({
          name: t.name,
          type: t.kind === 'voice' ? 2 : 0,
          parent_id: cat.id,
          ...(t.topic && { topic: t.topic }),
        }),
      });
      console.log('      ✅ 생성됨');
    }
  }
}

if (missingCats.length) {
  console.log(`\n서버에서 찾지 못한 카테고리 ${missingCats.length}개:`);
  for (const c of missingCats) console.log(`  ${c}`);
}

console.log(`\n만들 채널 ${willCreate}개, 이미 있는 채널 ${already}개`);
console.log(apply
  ? '생성이 끝났습니다. 새 채널은 카테고리 권한을 물려받습니다.'
  : '미리보기입니다. 실제로 만들려면 --apply 를 붙여 실행하세요.\n  node scripts/create-channels.mjs --apply');
