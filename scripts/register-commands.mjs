#!/usr/bin/env node
/**
 * 슬래시 명령 등록 — 인터랙션 엔드포인트에서 처리하는 명령을 서버에 등록합니다.
 * 사용법: node scripts/register-commands.mjs
 */
import { loadEnv, discord } from './_env.mjs';

const env = loadEnv(['DISCORD_BOT_TOKEN', 'DISCORD_CLIENT_ID', 'DISCORD_GUILD_ID']);

const COMMANDS = [
  {
    name: '인증',
    description: '5기 인증을 마치고 모든 채널을 엽니다.',
    dm_permission: false,
  },
  {
    name: '인증패널',
    description: '인증 버튼이 있는 안내 패널을 이 채널에 게시합니다. (운영진 전용)',
    dm_permission: false,
    default_member_permissions: '0', // 관리자만 노출
  },
  {
    name: '일정등록',
    description: '스터디 일정을 등록하고 채널에 공지합니다.',
    dm_permission: false,
    // 필수 옵션이 선택 옵션보다 앞에 와야 합니다 (디스코드 제약)
    options: [
      { type: 3, name: '제목', description: '스터디 제목 (예: 쿠버네티스 스터디 3회차)', required: true },
      { type: 3, name: '날짜', description: '2026-09-10 / 9-10 / 9월 10일', required: true },
      { type: 3, name: '시작시각', description: '22:00 또는 22시', required: true },
      { type: 10, name: '진행시간', description: '시간 단위 (기본 2)', required: false, min_value: 0.5, max_value: 24 },
      { type: 3, name: '장소', description: '강남 스터디카페 / Zoom 링크 등', required: false },
      { type: 3, name: '지역', description: '지역 태그 (예: 서울)', required: false },
      { type: 3, name: '주제', description: '공부 태그 (예: 쿠버네티스)', required: false },
      { type: 5, name: '온라인', description: '온라인 진행이면 켜기', required: false },
    ],
  },
  {
    name: '오늘일정',
    description: '오늘 잡힌 스터디 일정을 확인합니다.',
    dm_permission: false,
  },
  {
    name: '자료함',
    description: '이 채널의 구글 드라이브 폴더를 엽니다.',
    dm_permission: false,
  },
  {
    name: '자료보기',
    description: '이 채널 폴더에 어떤 파일이 있는지 봅니다.',
    dm_permission: false,
  },
  {
    name: '스터디자료',
    description: '깃허브 저장소의 스터디 자료를 봅니다.',
    dm_permission: false,
    options: [
      { type: 3, name: '폴더', description: '예: 스터디자료/리눅스 (비우면 저장소 루트)', required: false },
    ],
  },
  {
    name: '자료검색',
    description: '자료실에서 파일을 찾습니다. #태그로도 검색됩니다.',
    dm_permission: false,
    options: [
      { type: 3, name: '검색어', description: '파일 이름, 설명, 문서 내용에서 찾습니다', required: true },
      { type: 5, name: '이채널만', description: '이 채널 폴더 안에서만 찾기', required: false },
    ],
  },
];

const path = `/applications/${env.DISCORD_CLIENT_ID}/guilds/${env.DISCORD_GUILD_ID}/commands`;
const result = await discord(env, path, { method: 'PUT', body: JSON.stringify(COMMANDS) });

console.log('✅ 슬래시 명령 등록 완료');
for (const c of result) console.log(`   /${c.name} — ${c.description}`);
