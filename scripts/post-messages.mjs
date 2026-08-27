#!/usr/bin/env node
/**
 * 안내 멘트를 디스코드 채널에 게시합니다.
 *
 *   node scripts/post-messages.mjs            초안만 출력 (아무것도 보내지 않음)
 *   node scripts/post-messages.mjs --post     실제 게시
 *   node scripts/post-messages.mjs --post index   특정 항목만 게시
 *
 * 내용은 아래 MESSAGES 배열만 고치면 됩니다.
 */
import { loadEnv, discord } from './_env.mjs';

const args = process.argv.slice(2);
const doPost = args.includes('--post');
const only = args.filter((a) => !a.startsWith('--'));

const env = loadEnv(['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID']);
const SITE = 'https://ktci5.kr';
const BLUE = 0x5865f2;

const DRIVE_FOLDERS = [
  ['Ⅰ. 훈련 자료', '12kJpmfEXBrBcQCd5dnkWgwa6lXUTjbn4'],
  ['Ⅱ. 챌린저 제출 폴더', '11LzrTnTuwiboK-pTJxJkLggfb3E-XOMs'],
  ['Ⅲ. 훈련수당 신청', '1Zb2aTj8o8fFbHmfrRvSEcYyAgTbfOLiO'],
  ['📁 전체 모음 (KT CI5)', '1PTw0vZFG8aANdsBp7-Nf4cA7cUVNIlwT'],
];

const MESSAGES = [
  {
    key: 'welcome',
    channel: '📢-공지사항',
    embeds: [{
      title: '👋 KT클라우드 인프라교육 5기 스터디에 오신 것을 환영합니다',
      color: BLUE,
      description:
        '함께 공부하고 서로 막힌 곳을 풀어주는 공간입니다.\n' +
        '부담 갖지 마시고 편하게 질문해주세요.',
      fields: [
        {
          name: '1. 먼저 인증해주세요',
          value: `**#🔒-대기실** 의 **인증하기** 버튼을 누르면 끝납니다.\n명단에 있으면 클릭 한 번으로 모든 채널이 열립니다.`,
        },
        {
          name: '2. 채널이 어디에 뭐가 있는지',
          value: `**#index** 에 정리해두었습니다. 웹으로 보시려면 ${SITE}/guide`,
        },
        {
          name: '3. 스터디 일정',
          value: '`/일정등록` 으로 올리면 구글 캘린더에 자동으로 들어갑니다.\n오늘 일정은 `/오늘일정` 으로 확인하세요.',
        },
      ],
      footer: { text: '문의는 운영진에게 편하게 남겨주세요' },
    }],
  },
  {
    key: 'index',
    channel: 'index',
    embeds: [{
      title: '📚 채널 안내',
      color: BLUE,
      description: `채널이 많아 보이지만 실제로 쓰는 곳은 몇 군데입니다.\n웹에서 보기 → ${SITE}/guide`,
      fields: [
        { name: '00. GATE', value: '**#🔒-대기실** 인증하는 곳\n**#📜-서버-이용규칙** 참여 전 한 번 읽어주세요' },
        { name: '01. WELCOME', value: '**#📢-공지사항** 운영 공지 (알림 켜두시면 좋습니다)\n**#👋-자기소개** 이름·관심분야·지역만 남겨주세요\n**#💬-자유게시판** 잡담과 정보 공유' },
        { name: '02. 케이스 스터디', value: '**#📋-스터디-일정추가** 일정 등록 — `/일정등록`' },
        { name: '03. 분야별 스터디', value: '**#💻-리눅스 #🌐-네트워크 #☁️-클라우드**\n**#🐳-컨테이너-쿠버네티스 #🗄️-데이터베이스**\n같은 이름의 음성 채널이 있어 화면 공유가 가능합니다' },
        { name: '04. 지역모임', value: '**#🏙️-서울-경기 #🌆-충청 #🌊-경상 #🌾-전라 #🏞️-강원-제주**\n날짜가 정해지면 `/일정등록` 으로 공유해주세요' },
        { name: '05. 공부자료', value: '**#📸-오늘의-공부인증** 사진 한 장이면 충분합니다\n**#📚-자료공유 #🔗-유용한링크 #❓-질문답변**' },
        { name: '06. 그룹스터디', value: '**#🔒-그룹1 · 그룹2 · 그룹3** 배정된 그룹원에게만 보입니다' },
        { name: '07. 휴식', value: '**#🍜-맛집 #📷-사진 #✈️-여행 #🎧-휴게실**' },
        { name: '📖 학습 문서', value: '**이 서버는 어떻게 돌아가나** — 도메인·Cloudflare·깃허브 연결을 L1 기초부터 L4 마스터까지\nhttps://ktci5.kr/study/infra\n**리눅스 CLI 심층 가이드** — https://ktci5.kr/study/linux' },
        { name: '08. 자격증', value: '**#📜-자격증**(공통)\n**#☁️-aws-자격증 #☁️-클라우드-자격증 #🌐-네트워크-자격증**\n**#🐧-리눅스-자격증 #⎈-쿠버네티스-자격증**\n**#📘-정보처리기사 #🔐-정보보안기사 #🗄️-sqld-자격증**' },
      ],
    }],
  },
  {
    key: 'gate',
    channel: '🔒-대기실',
    embeds: [{
      title: '🎫 5기 인증',
      color: BLUE,
      description:
        '아래 **인증하기** 버튼을 누르면 `5기인증` 역할이 부여되고 모든 채널이 열립니다.\n' +
        '명단에 있으면 클릭 한 번으로 끝납니다.',
      fields: [{
        name: '이름 목록에 본인이 없다면',
        value: '**목록에 없어요** 를 눌러주세요. 운영진이 확인 후 열어드립니다.',
      }],
      footer: { text: '버튼이 동작하지 않으면 웹으로도 인증할 수 있습니다' },
    }],
    components: [{
      type: 1,
      components: [
        { type: 2, style: 1, label: '인증하기', custom_id: 'ktci5_verify', emoji: { name: '✅' } },
        { type: 2, style: 5, label: '웹으로 인증', url: `${SITE}/discord/verify` },
      ],
    }],
  },
  {
    key: 'drive',
    channel: '📚-자료공유',
    embeds: [{
      title: '📂 교육과정 자료실',
      color: BLUE,
      description:
        '교육과정에서 공유한 구글 드라이브 폴더입니다.\n' +
        '과정에 등록한 구글 계정으로 로그인하면 열립니다.\n' +
        '마지막 **전체 모음**은 위 세 폴더를 한 곳에 모아둔 바로가기함입니다.',
      fields: [
        ...DRIVE_FOLDERS.map(([name, id]) => ({
          name,
          value: `https://drive.google.com/drive/folders/${id}`,
        })),
        {
          name: '📦 깃허브 스터디 자료',
          value:
            '정리 문서와 학습 허브는 깃허브에 있습니다.\n' +
            '디스코드에서 바로 보려면 `/스터디자료`\n' +
            'https://github.com/ktci5/study',
        },
      ],
      footer: { text: '드라이브가 열리지 않으면 과정에 등록한 구글 계정인지 확인해주세요' },
    }],
  },
];

const channels = await discord(env, `/guilds/${env.DISCORD_GUILD_ID}/channels`);
const byName = Object.fromEntries(channels.filter((c) => c.type === 0).map((c) => [c.name, c.id]));

const targets = MESSAGES.filter((m) => !only.length || only.includes(m.key));
if (!targets.length) {
  console.error(`✘ 해당하는 항목이 없습니다. 사용 가능: ${MESSAGES.map((m) => m.key).join(', ')}`);
  process.exit(1);
}

for (const msg of targets) {
  const id = byName[msg.channel];
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`[${msg.key}] → #${msg.channel} ${id ? '' : '  ✘ 채널을 찾을 수 없습니다'}`);
  console.log('─'.repeat(60));
  for (const e of msg.embeds) {
    console.log(`  ▸ ${e.title}`);
    if (e.description) console.log('    ' + e.description.replace(/\n/g, '\n    '));
    for (const f of e.fields || []) {
      console.log(`\n    ${f.name}`);
      console.log('      ' + f.value.replace(/\n/g, '\n      '));
    }
    if (e.footer) console.log(`\n    — ${e.footer.text}`);
  }
  for (const row of msg.components || []) {
    console.log('\n    [버튼] ' + row.components.map((c) => c.label).join('  |  '));
  }

  if (!id) continue;
  if (!doPost) continue;

  await discord(env, `/channels/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ embeds: msg.embeds, ...(msg.components && { components: msg.components }) }),
  });
  console.log('\n  ✅ 게시 완료');
}

console.log(doPost
  ? '\n게시가 끝났습니다.'
  : '\n초안만 출력했습니다. 실제로 올리려면 --post 를 붙여 실행하세요.\n  node scripts/post-messages.mjs --post');
