#!/usr/bin/env node
/**
 * 채널 주제(채널 이름 옆에 뜨는 한 줄 설명)를 일괄 설정합니다.
 *
 *   node scripts/set-channel-topics.mjs          변경 내용만 미리보기
 *   node scripts/set-channel-topics.mjs --apply  실제 반영
 *
 * 주제는 채널 헤더에 한 줄로 잘려 보이므로 짧게 씁니다.
 * 자세한 설명은 #index 안내 메시지와 https://ktci5.kr/guide 가 맡습니다.
 */
import { loadEnv, discord } from './_env.mjs';

const apply = process.argv.includes('--apply');
const env = loadEnv(['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID']);

const TOPICS = {
  '🔒-대기실':
    '인증하는 곳입니다. 아래 안내의 [인증하기] 버튼을 누르면 5기인증 역할이 부여되고 모든 채널이 열립니다.',
  '📜-서버-이용규칙':
    '참여 전에 한 번 읽어주세요. 길지 않습니다.',
  '📢-공지사항':
    '운영 공지가 올라옵니다. 알림을 켜두시면 놓치지 않습니다.',
  'index':
    '어떤 채널이 무엇을 하는 곳인지 정리되어 있습니다. 웹으로 보기 → https://ktci5.kr/guide',
  '📋-스터디-일정추가':
    '/일정등록 으로 일정을 올리면 구글 캘린더에 반영되고 여기에 공지됩니다. 오늘 일정은 /오늘일정 으로 확인하세요.',
  '💻-리눅스':
    '리눅스 질문과 자료를 나눕니다. 막힌 곳은 편하게 물어보세요. 옆 음성 채널에서 화면 공유도 가능합니다.',
  '🏙️-서울-경기':
    '서울·경기 오프라인 모임을 잡는 곳입니다. 날짜가 정해지면 /일정등록 으로 공유해주세요.',
  '📸-오늘의-공부인증':
    '오늘 공부한 흔적을 남깁니다. 사진 한 장이면 충분합니다.',
  '🔒-그룹1':
    '그룹1 전용 공간입니다. 그룹원끼리 자유롭게 쓰세요.',

  // 01. WELCOME
  '👋-자기소개':
    '간단히 인사 남겨주세요. 이름, 관심 분야, 지역 정도면 충분합니다.',
  '💬-자유게시판':
    '스터디 외 잡담과 정보 공유. 편하게 쓰세요.',

  // 03. 분야별 스터디
  '🌐-네트워크':
    'TCP/IP, 라우팅, 방화벽 등 네트워크 주제를 다룹니다.',
  '☁️-클라우드':
    'KT클라우드와 가상화, IaC 관련 질문과 자료를 나눕니다.',
  '🐳-컨테이너-쿠버네티스':
    '도커와 쿠버네티스. 실습하다 막힌 곳을 함께 풉니다.',
  '🗄️-데이터베이스':
    'DB 설치·튜닝·백업 등 데이터베이스 주제를 다룹니다.',
  // 08. 자격증
  '📜-자격증':
    '자격증 공통 — 접수 일정, 시험 후기, 어떤 자격증을 딸지 고민될 때.',
  '☁️-aws-자격증':
    'AWS 자격증(CLF·SAA·SOA·DVA) 준비. 기출, 실습 팁, 시험 후기.',
  '☁️-클라우드-자격증':
    'KT Cloud·NCP·Azure·GCP 등 클라우드 자격증 준비.',
  '🌐-네트워크-자격증':
    '네트워크관리사, CCNA 등 네트워크 자격증 준비.',
  '🐧-리눅스-자격증':
    '리눅스마스터, LPIC, RHCSA 등 리눅스 자격증 준비.',
  '⎈-쿠버네티스-자격증':
    'CKA·CKAD·CKS 준비. 실기 환경 익히는 요령을 나눕니다.',
  '📘-정보처리기사':
    '정보처리기사 필기·실기 준비. 기출과 요약 공유.',
  '🔐-정보보안기사':
    '정보보안기사·산업기사 준비.',
  '🗄️-sqld-자격증':
    'SQLD·SQLP 준비. 문제 풀이와 개념 정리.',

  // 04. 지역모임
  '🌆-충청':
    '충청 지역 오프라인 모임. 날짜가 정해지면 /일정등록 으로 공유해주세요.',
  '🌊-경상':
    '경상 지역 오프라인 모임. 날짜가 정해지면 /일정등록 으로 공유해주세요.',
  '🌾-전라':
    '전라 지역 오프라인 모임. 날짜가 정해지면 /일정등록 으로 공유해주세요.',
  '🏞️-강원-제주':
    '강원·제주 지역 모임. 인원이 적으면 온라인으로 모입니다.',

  // 05. 공부자료
  '📚-자료공유':
    '교육과정 드라이브 폴더 링크는 고정된 메시지에 있습니다. 직접 만든 자료는 이 채널에 올려주세요.',
  '🔗-유용한링크':
    '읽을 만한 문서와 블로그 링크를 모읍니다.',
  '❓-질문답변':
    '어느 분야인지 애매한 질문은 여기에. 아무거나 물어보세요.',

  // 06. 그룹스터디
  '🔒-그룹2':
    '그룹2 전용 공간입니다. 그룹원끼리 자유롭게 쓰세요.',
  '🔒-그룹3':
    '그룹3 전용 공간입니다. 그룹원끼리 자유롭게 쓰세요.',

  // 07. 휴식
  '🍜-맛집':
    '가본 곳, 가보고 싶은 곳을 나눕니다. 지역 모임 장소 고를 때 참고가 됩니다.',
  '📷-사진':
    '오늘의 한 장. 공부 사진이 아니어도 괜찮습니다.',
  '✈️-여행':
    '다녀온 곳과 계획 중인 여행을 공유합니다.',

  // 09. 프로젝트 준비 (비공개)
  '🎯-기본프로젝트':
    '1차 프로젝트 전체 파이프라인 설계와 진행 상황. Python 앱 → Docker → K8s → AWS → Terraform.',
  '🐍-python':
    '프로젝트에 쓸 웹 애플리케이션과 자동화 스크립트. Track A 의 Python 파트.',
  '🏗️-terraform-iac':
    '인프라를 코드로. Terraform 으로 AWS 자원을 만들고 관리합니다.',
  '📐-설계노트':
    '아키텍처 초안, 고민한 선택지, 왜 그렇게 정했는지 기록.',

  // 99. 운영
  '운영진':
    '운영진 전용. 명단에 없는 인증 요청이 승인 버튼과 함께 이 채널로 들어옵니다.',
};

const channels = await discord(env, `/guilds/${env.DISCORD_GUILD_ID}/channels`);
const text = channels.filter((c) => c.type === 0);

let changed = 0, skipped = 0;
const missing = [];
const blocked = [];

// 한 채널이 막혀도 나머지는 계속 처리합니다.
async function patchTopic(env, id, topic) {
  const res = await fetch(`https://discord.com/api/v10/channels/${id}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      'content-type': 'application/json',
      'user-agent': 'DiscordBot (https://ktci5.kr, 1.0)',
    },
    body: JSON.stringify({ topic }),
  });
  return { ok: res.ok, status: res.status };
}

for (const [name, topic] of Object.entries(TOPICS)) {
  const ch = text.find((c) => c.name === name);
  if (!ch) { missing.push(name); continue; }

  const before = ch.topic || '';
  if (before === topic) { skipped++; continue; }

  changed++;
  console.log(`\n#${name}`);
  if (before) {
    const b = before.replace(/\n/g, ' ⏎ ');
    console.log(`  이전: ${b.length > 90 ? b.slice(0, 90) + ' …' : b}  (${before.length}자)`);
  } else {
    console.log('  이전: (비어 있음)');
  }
  console.log(`  이후: ${topic}  (${topic.length}자)`);

  if (apply) {
    const res = await patchTopic(env, ch.id, topic);
    if (res.ok) {
      console.log('  ✅ 반영됨');
    } else {
      blocked.push({ name, status: res.status });
      console.log(res.status === 403
        ? '  ✘ 봇이 이 채널을 볼 수 없어 건너뜁니다 (채널 권한에 봇 역할 추가 필요)'
        : `  ✘ 실패 (${res.status})`);
    }
  }
}

// 설정 대상에 없는 채널을 알려줍니다 (새로 만든 채널을 놓치지 않도록)
const unlisted = text.filter((c) => !(c.name in TOPICS));
if (unlisted.length) {
  console.log(`\n주제를 정하지 않은 채널 ${unlisted.length}개:`);
  for (const c of unlisted) console.log(`  #${c.name}`);
}
if (missing.length) {
  console.log(`\n서버에서 찾지 못한 채널 ${missing.length}개:`);
  for (const n of missing) console.log(`  #${n}`);
}

if (blocked.length) {
  console.log(`\n권한 때문에 건너뛴 채널 ${blocked.length}개:`);
  for (const b of blocked) console.log(`  #${b.name}  (${b.status})`);
  console.log('  → 채널 편집 → 권한 → 봇 역할(KT CI5) 추가 → "채널 보기" 허용 후 다시 실행하세요.');
}

console.log(`\n바뀔 채널 ${changed}개, 이미 같은 채널 ${skipped}개`);
console.log(apply
  ? '반영이 끝났습니다.'
  : '미리보기입니다. 실제로 바꾸려면 --apply 를 붙여 실행하세요.\n  node scripts/set-channel-topics.mjs --apply');
