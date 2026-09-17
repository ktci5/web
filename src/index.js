/**
 * ktci5.kr — 디스코드 연계 Cloudflare Worker
 * KT클라우드 인프라교육 5기 스터디 서버용
 *
 * 라우트
 *  GET  /                            안내 랜딩 페이지
 *  GET  /discord/                    스터디 공간 안내 (디스코드·깃허브·드라이브)
 *  GET  /discord/join                디스코드 서버 초대 링크로 이동
 *  GET  /discord/verify              디스코드 OAuth2 인증 시작
 *  GET  /discord/callback            OAuth2 콜백 → 5기인증 역할 자동 부여
 *  POST /discord/interactions        인터랙션 엔드포인트 (Ed25519 서명 검증)
 *                                    명령: /인증 /인증패널 /일정등록 /오늘일정 /주간일정
 *  GET  /discord/linked-role         연결된 역할 인증 시작
 *  GET  /discord/linked-role/callback  연결된 역할 메타데이터 기록
 *  GET  /discord/bot                 봇 초대(Manage Roles 포함) URL로 이동
 *  GET  /discord/status              설정 상태 헬스체크 (JSON, 값은 노출하지 않음)
 *  GET  /guide                       채널 사용 안내
 *  GET  /preview                     강사·운영진 미리보기 (PREVIEW_KEY 필요)
 *  GET  /study                       스터디 자료 목차
 *  GET  /study/linux                 리눅스 CLI 심층 가이드
 *  GET  /study/course                강의 정리 — 과목 목록 (인증자 전용)
 *  GET  /study/course/<과목>[/<장>]   과목 목차 · 장 내용
 *  GET  /study/search?q=             정리본 전체 검색 (인증자 전용)
 *  GET  /study/infra                 이 서버는 어떻게 돌아가나
 *  GET  /terms                       이용 약관
 *  GET  /privacy                     개인정보 보호 정책
 *  GET  /callback                    구 리다이렉트 URI 하위호환
 *
 * 환경변수 (wrangler.toml [vars])
 *  DISCORD_GUILD_ID          서버(길드) ID
 *  REDIRECT_URI              https://ktci5.kr/discord/callback
 *  LINKED_ROLE_REDIRECT_URI  https://ktci5.kr/discord/linked-role/callback
 *  DISCORD_INVITE_URL        서버 초대 링크 (https://discord.gg/xxxx)
 *  AUTO_JOIN                 "true" 이면 서버 미참여자도 자동 참여 + 역할 부여
 *
 * 시크릿 (wrangler secret put)
 *  DISCORD_CLIENT_ID     OAuth2 탭의 Client ID (= Application ID)
 *  DISCORD_CLIENT_SECRET OAuth2 탭의 Client Secret
 *  DISCORD_BOT_TOKEN     Bot 탭의 토큰 (역할 관리 권한 필요)
 *  DISCORD_ROLE_ID       부여할 "5기인증" 역할 ID
 *  DISCORD_PUBLIC_KEY    General Information 탭의 Public Key (인터랙션 서명 검증용)
 *  GOOGLE_SA_EMAIL          구글 서비스 계정 이메일 (일정 기능)
 *  GOOGLE_SA_PRIVATE_KEY_B64 서비스 계정 개인키 PEM 을 base64 한 값
 */

import { LINUX_GUIDE_TITLE, LINUX_GUIDE_CSS, renderLinuxGuide } from './study-linux.js';
import { INFRA_TITLE, INFRA_CSS, renderInfraGuide } from './study-infra.js';
import { renderProjectPage } from './projects.js';
import { loadCourseIndex, loadCourse, loadNotes, loadAll, linkResolver, markdown, renderCourseList, renderCourseIndex, renderCourseChapter, renderSearch, COURSE_CSS } from './course.js';
import { PORTAL_HTML } from './portal_html.js';

const DISCORD_API = 'https://discord.com/api/v10';
const USER_AGENT = 'DiscordBot (https://ktci5.kr, 1.0)';
const STATE_COOKIE = 'ktci5_oauth_state';
const LINKED_STATE_COOKIE = 'ktci5_linked_state';
const PASS_COOKIE = 'ktci5_pass';      // 인증 완료 증표 (서명됨)
const NEXT_COOKIE = 'ktci5_next';      // 인증 후 돌아갈 경로
const PASS_TTL = 60 * 60 * 24 * 30;    // 30일
const PREVIEW_TTL = 60 * 60 * 24 * 14; // 미리보기 통행증 14일
const PREVIEW_USER = 'preview';
// 봇 초대 권한: MANAGE_ROLES(필수) + 패널 게시에 쓰이는 최소 권한
// VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | MANAGE_ROLES | USE_APPLICATION_COMMANDS
const BOT_PERMISSIONS = '2415938560';

const PLATFORM_NAME = 'KT클라우드 인프라교육 5기';
// 안내 문구에 쓰는 역할 이름. 서버에서 역할명을 바꾸면 여기만 고치면 됩니다.
const ROLE_NAME = '5기인증';
const COHORT = 5;
const CONTACT = '디스코드 서버의 #문의 채널 또는 운영진 DM';

// 인터랙션 타입 / 응답 타입 / 컴포넌트 상수
const INTERACTION = { PING: 1, COMMAND: 2, COMPONENT: 3, AUTOCOMPLETE: 4, MODAL: 5 };
const REPLY = { PONG: 1, MESSAGE: 4, DEFERRED: 5, UPDATE: 7 };
const KST = '+09:00';
const EPHEMERAL = 64;
const VERIFY_BUTTON_ID = 'ktci5_verify';
const NAME_SELECT_ID = 'ktci5_name';
const NAME_PAGE_ID = 'ktci5_names';   // ktci5_names:<page>
const APPROVE_ID = 'ktci5_approve';   // ktci5_approve:<userId>
const REQUEST_ID = 'ktci5_request';
const NAMES_PER_PAGE = 25;            // 디스코드 선택 메뉴 최대 항목 수
const PERM_ADMIN = 1n << 3n;
const PERM_MANAGE_ROLES = 1n << 28n;
const WEB_VERIFY_URL = 'https://ktci5.kr/discord/verify';
const GUIDE_URL = 'https://ktci5.kr/guide';

export default {
  // 15분마다 드라이브 변경을 확인해 알림 채널에 알려줍니다.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(pollDriveChanges(env).catch((err) => console.error('drive poll:', err.message)));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    // project1~3.ktci5.kr 은 결과물이 올라갈 자리입니다. 지금은 안내만 띄웁니다.
    const project = url.hostname.match(/^project(\d+)\./);
    if (project) {
      const page = renderProjectPage(Number(project[1]), escapeHtml);
      return page
        ? html(page)
        : errorPage('아직 준비되지 않은 프로젝트입니다.', 404);
    }

    if (request.method === 'POST') {
      if (path === '/discord/interactions') {
        return handleInteractions(request, env, ctx);
      }
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET' } });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', { status: 405, headers: { allow: 'GET, POST' } });
    }

    // 강의 정리 (/study/course/<과목>[/<장>])
    if (path.startsWith('/study/course/')) {
      const [courseId, chapterId] = path.slice('/study/course/'.length).split('/');
      return guarded(request, env, (e) =>
        chapterId ? courseChapterPage(e, courseId, chapterId) : courseIndexPage(e, courseId));
    }

    switch (path) {
      case '/':
        return landingPage(env, request);
      case '/study':
      case '/study/index':
        return studyIndexPage(env);
      case '/study/cheatsheet':
      case '/study/hub':
      case '/study/cli':
      case '/hub':
      case '/portal':
      case '/cli':
      case '/cheat':
      case '/cheatsheet':
      case '/docker':
      case '/disk':
        return new Response(PORTAL_HTML, {
          headers: {
            'content-type': 'text/html; charset=UTF-8',
            'cache-control': 'public, max-age=60',
          },
        });
      case '/auth':
        return landingPage(env, request);
      case '/discord':
        return hubPage(env);
      case '/discord/join':
        return redirect(inviteUrl(env));
      case '/discord/verify':
        return startVerify(env);
      case '/discord/bot':
        return redirect(botInviteUrl(env));
      case '/discord/bot/callback':
        return handleBotCallback(url, env);
      case '/discord/status':
        return statusJson(env);
      case '/discord/callback':
      case '/callback':
        return handleCallback(request, url, env);
      case '/discord/linked-role':
        return startLinkedRole(env);
      case '/discord/linked-role/callback':
        return handleLinkedRoleCallback(request, url, env);
      case '/discord/interactions':
        // 디스코드는 POST 로만 호출합니다. 브라우저로 열어본 운영진을 위한 안내.
        return errorPage('이 주소는 디스코드 서버가 POST 로 호출하는 인터랙션 엔드포인트입니다.', 405);
      case '/guide':
        return guardedGuide(request, env);
      case '/preview':
        return handlePreview(request, url, env);
      case '/updates':
      case '/study/updates':
        return guarded(request, env, updatesPage);
      case '/study/calendar':
        return guarded(request, env, studyCalendarPage);
      case '/api/calendar/events':
        return guarded(request, env, (e) => apiCalendarEvents(request, url, e));
      case '/study/linux':
        return guarded(request, env, linuxGuidePage);
      case '/study/infra':
        return guarded(request, env, infraGuidePage);
      case '/study/course':
        return guarded(request, env, courseListPage);
      case '/study/search':
        return guarded(request, env, (e) => courseSearchPage(e, url.searchParams.get('q') || ''));
      case '/terms':
        return termsPage();
      case '/privacy':
        return privacyPage();
      case '/robots.txt':
        return new Response('User-agent: *\nDisallow: /discord/\n', {
          headers: { 'content-type': 'text/plain; charset=UTF-8' },
        });
      default:
        return errorPage('존재하지 않는 페이지입니다.', 404);
    }
  },
};

/* -------------------------------------------------------------- OAuth2 인증 */

function startVerify(env) {
  if (missingConfig(env, ['DISCORD_CLIENT_ID', 'REDIRECT_URI']).length) {
    return errorPage('서버 설정이 아직 완료되지 않았습니다. 운영진에게 문의해주세요.', 503);
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: env.REDIRECT_URI,
    response_type: 'code',
    scope: oauthScope(env),
    state,
    prompt: 'consent',
  });

  return redirect('https://discord.com/oauth2/authorize?' + params.toString(), {
    'set-cookie': stateCookie(STATE_COOKIE, state),
  });
}

async function handleCallback(request, url, env) {
  const guard = checkCallback(request, url, STATE_COOKIE);
  if (guard.error) return errorPage(guard.error);

  const token = await exchangeCode(guard.code, env, env.REDIRECT_URI);
  if (!token) return errorPage('디스코드 인증 처리 중 오류가 발생했습니다. (토큰 교환 실패)');

  const me = await fetchMe(token.access_token);
  if (!me) return errorPage('디스코드 사용자 정보를 가져오지 못했습니다.');

  // 명단에 있거나, 이미 운영진 승인으로 역할을 받은 사람만 통과합니다.
  const roster = await loadRoster(env);
  if (roster && !matchMember(roster, me) && !(await hasVerifiedRole(me.id, env))) {
    return notOnRosterPage(env);
  }

  const result = await grantRole(me, token, env);
  if (!result.ok) return errorPage(result.message, result.status || 400);

  const pass = await issuePass(env, me.id);
  const next = readCookie(request.headers.get('cookie'), NEXT_COOKIE);
  const headers = {
    'set-cookie': pass,
    'cache-control': 'no-store',
  };

  if (next === '/guide') {
    return new Response(null, {
      status: 302,
      headers: { ...headers, location: '/guide' },
    });
  }
  return successPage(me, result.joined, env, headers);
}

/* ------------------------------------------------- 인증 완료 통행증(쿠키) */

// 클라이언트가 위조할 수 없도록 클라이언트 시크릿으로 HMAC 서명합니다.
async function passSignature(env, payload) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env.DISCORD_CLIENT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return b64urlBytes(new Uint8Array(sig));
}

async function issuePass(env, userId, ttl = PASS_TTL) {
  const exp = Math.floor(Date.now() / 1000) + ttl;
  const payload = `${userId}.${exp}`;
  const value = `${payload}.${await passSignature(env, payload)}`;
  return `${PASS_COOKIE}=${value}; Path=/; Max-Age=${ttl}; HttpOnly; Secure; SameSite=Lax`;
}

async function verifyPass(request, env) {
  const raw = readCookie(request.headers.get('cookie'), PASS_COOKIE);
  if (!raw) return null;
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (!(Number(exp) > Math.floor(Date.now() / 1000))) return null;
  const expected = await passSignature(env, `${userId}.${exp}`);
  return sig === expected ? userId : null;
}

// 인증하지 않은 사람은 인증 흐름으로 보냈다가 끝나면 돌아오게 합니다.
async function guarded(request, env, render) {
  if (await verifyPass(request, env)) return render(env);
  const next = new URL(request.url).pathname;
  return new Response(null, {
    status: 302,
    headers: {
      location: '/discord/verify',
      'set-cookie': `${NEXT_COOKIE}=${next}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
      'cache-control': 'no-store',
    },
  });
}

// 강사·운영진이 디스코드 가입 없이 둘러볼 수 있는 통로입니다.
// 링크에 담긴 열쇠를 아는 사람만 통과하고, 일반 사용자에게는 열리지 않습니다.
async function handlePreview(request, url, env) {
  const key = url.searchParams.get('key') || '';
  if (!env.PREVIEW_KEY || key.length !== env.PREVIEW_KEY.length || key !== env.PREVIEW_KEY) {
    return errorPage('유효하지 않은 미리보기 링크입니다. 링크를 다시 확인해주세요.', 403);
  }

  const body =
    '<p>KT클라우드 인프라교육 5기 스터디 운영을 위해 만든 사이트입니다.<br>' +
    '아래 문서는 원래 인증을 마친 수강생만 볼 수 있지만, 이 링크로는 그대로 열립니다.</p>' +
    '<a class="btn" href="/guide">채널 사용 안내</a>' +
    '<a class="btn btn-ghost" href="/study/infra">이 서버는 어떻게 돌아가나</a>' +
    '<a class="btn btn-ghost" href="/study/linux">리눅스 CLI 심층 가이드</a>' +
    '<p class="hint">14일간 유효합니다. 만료되면 같은 링크로 다시 들어오시면 됩니다.<br>' +
    '디스코드 가입이나 로그인은 필요 없습니다.</p>';

  return html(renderPage({
    title: '미리보기',
    heading: '👋 둘러보기',
    body,
  }), 200, {
    'set-cookie': await issuePass(env, PREVIEW_USER, PREVIEW_TTL),
  });
}

function guardedGuide(request, env) {
  return guarded(request, env, guidePage);
}

/* -------------------------------------------------------------- 스터디 자료 (스터디 Hub) */

const STUDY_CSS = COURSE_CSS + `
  .study-hero { margin: 0 0 24px; padding: 18px 22px; background: linear-gradient(135deg, rgba(35,40,56,0.9) 0%, rgba(26,29,36,0.95) 100%); border: 1px solid #2a3143; border-radius: 12px; }
  .study-hero h2 { margin: 0 0 6px; font-size: 17px; color: #f8fafc; font-weight: 700; }
  .study-hero p { margin: 0; font-size: 13.5px; line-height: 1.6; color: #94a3b8; }
  
  .study-sec { margin: 28px 0 34px; }
  .sec-hd { display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; border-bottom: 1px solid #2a3143; padding-bottom: 8px; }
  .sec-hd h2 { margin: 0; font-size: 16px; color: #f1f5f9; font-weight: 700; }
  .more-link { font-size: 13px; color: #818cf8; text-decoration: none; font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
  .more-link:hover { text-decoration: underline; color: #a5b4fc; }

  .update-cards { display: grid; gap: 10px; }
  .u-card { background: #232838; border: 1px solid #2a3143; border-radius: 10px; padding: 14px 16px; transition: border-color 0.15s ease; }
  .u-card:hover { border-color: #5865f2; }
  .u-card.featured { border-color: rgba(99, 102, 241, 0.4); background: linear-gradient(180deg, rgba(99,102,241,0.08) 0%, rgba(35,40,56,1) 100%); }
  .u-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .u-badge { font-size: 11px; padding: 2px 7px; border-radius: 4px; background: #2d3446; color: #94a3b8; font-weight: 600; }
  .u-badge.new { background: #1e3a8a; color: #93c5fd; border: 1px solid #3b82f6; }
  .u-date { font-size: 12px; color: #64748b; }
  .u-title { font-size: 15px; font-weight: 700; margin-bottom: 5px; }
  .u-title a { color: #f8fafc; text-decoration: none; }
  .u-title a:hover { color: #818cf8; text-decoration: underline; }
  .u-desc { font-size: 13px; color: #94a3b8; line-height: 1.55; margin: 0; }
  .u-desc code { font-size: 12px; color: #cbd5e1; }

  .course-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; margin-top: 14px; }
  .c-card { display: flex; flex-direction: column; background: #232838; border: 1px solid #2a3143; border-radius: 10px; padding: 16px; text-decoration: none; transition: all 0.15s ease; }
  .c-card:hover { border-color: #6366f1; transform: translateY(-2px); background: #272d3f; }
  .c-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .c-icon { font-size: 24px; }
  .c-badge { font-size: 11px; padding: 2px 6px; border-radius: 4px; background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
  .c-badge.new { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border-color: #3b82f6; }
  .c-title { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 6px; }
  .c-desc { font-size: 12.5px; color: #94a3b8; line-height: 1.5; flex-grow: 1; margin: 0; }

  .tool-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 12px; }
  .t-card { display: flex; gap: 14px; background: #232838; border: 1px solid #2a3143; border-radius: 10px; padding: 14px 16px; text-decoration: none; transition: all 0.15s ease; align-items: flex-start; }
  .t-card:hover { border-color: #6366f1; transform: translateY(-2px); background: #272d3f; }
  .t-icon { font-size: 24px; flex-shrink: 0; padding-top: 2px; }
  .t-body { flex-grow: 1; }
  .t-title { font-size: 14.5px; font-weight: 700; color: #f8fafc; margin-bottom: 4px; display: flex; align-items: center; gap: 6px; }
  .t-desc { font-size: 12.5px; color: #94a3b8; line-height: 1.5; margin: 0; }

  .how-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
  .how-card { background: #232838; border: 1px solid #2a3143; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; }
  .how-num { width: 26px; height: 26px; border-radius: 50%; background: #4f46e5; color: #fff; font-size: 13px; font-weight: 700; display: flex; align-items: center; justify-content: center; margin-bottom: 10px; flex-shrink: 0; }
  .how-card h3 { font-size: 14px; font-weight: 700; color: #f1f5f9; margin: 0 0 6px; }
  .how-card p { font-size: 12.5px; color: #94a3b8; line-height: 1.6; margin: 0; }
  .how-card code { font-size: 11.5px; color: #e2e8f0; }
`;

const COURSES_INFO = [
  {
    id: 'k8s',
    icon: '☸️',
    title: '쿠버네티스 (Kubernetes)',
    badge: 'NEW',
    isNew: true,
    desc: 'K8s 마스터/워커 아키텍처, kubeadm 클러스터 구축, Pod/Deployment/Service, 무중단 롤링 배포, RBAC, Helm, PV/PVC, HA',
  },
  {
    id: 'docker',
    icon: '🐳',
    title: '도커 컨테이너',
    badge: '컨테이너',
    isNew: false,
    desc: '가상화 vs 컨테이너, 데몬 C/S 소켓 권한, Dockerfile 포그라운드(daemon off), 볼륨 영속성, 이미지 배포, Compose',
  },
  {
    id: 'network',
    icon: '🌐',
    title: '네트워크 기초',
    badge: '기초',
    desc: '브라우저 접속 6단계 패킷 여정, IP·DNS·포트·게이트웨이·라우팅, ARP/NAT, ss/ping 진단 및 refused vs timed out 분석',
  },
  {
    id: 'admin',
    icon: '🛡️',
    title: 'Linux 시스템 관리자',
    badge: '실무',
    desc: '디스크 파티션(parted GPT), LVM 3계층 풀, RAID 장애 복구, 파일 권한(chmod/ACL), 프로세스/서비스 제어',
  },
  {
    id: 'bash',
    icon: '📜',
    title: 'Shell Script & Bash 프로그래밍',
    badge: '자동화',
    desc: '쉘 변수, 조건문·반복문, 함수, 입출력 리다이렉션, 정규표현식(sed/awk), 시스템 자동화 스크립트 작성법',
  },
  {
    id: 'linux',
    icon: '🐧',
    title: 'Linux 기본 명령어',
    badge: '입문',
    desc: '리눅스 디렉터리 구조, 필수 CLI 명령어, vi 에디터, 파일 및 디렉터리 제어, 사용자 및 그룹 권한 관리',
  },
];

async function studyIndexPage(env) {
  const courseCards = COURSES_INFO.map((c) => `
    <a class="c-card" href="/study/course/${c.id}">
      <div class="c-top">
        <span class="c-icon">${c.icon}</span>
        <span class="c-badge${c.isNew ? ' new' : ''}">${c.badge}</span>
      </div>
      <div class="c-title">${escapeHtml(c.title)}</div>
      <p class="c-desc">${escapeHtml(c.desc)}</p>
    </a>
  `).join('');

  const body = `
    <div class="study-hero">
      <h2>👋 KT Cloud 5기 수강생을 위한 스터디 포털</h2>
      <p>수업에서 다룬 핵심 이론과 명령어 실습, 스터디 일정, 디스코드/드라이브 연동 도구를 일목요연하게 모아둔 공간입니다.<br>
      오랜만에 오셨다면 <strong>최근 업데이트 소식</strong>을, 복습이 필요하시면 <strong>과목별 강의 정리</strong>를 확인하세요.</p>
    </div>

    <!-- 1. 최근 업데이트 소식 -->
    <section class="study-sec">
      <div class="sec-hd">
        <h2>📢 최근 업데이트 소식</h2>
        <a href="/updates" class="more-link">전체 내역 보기 →</a>
      </div>
      <div class="update-cards">
        <div class="u-card featured">
          <div class="u-head">
            <span class="u-badge new">신규 과목</span>
            <span class="u-date">2026-09-17</span>
          </div>
          <div class="u-title"><a href="/study/course/k8s">쿠버네티스(Kubernetes) 오케스트레이션 실무 강의 정리 추가</a></div>
          <p class="u-desc">K8s 아키텍처(마스터/워커 컴포넌트), kubeadm 1 Master + 1 Worker 구축, Pod 라이프사이클 & Probe, 선언적 YAML 매니페스트, Deployment 롤링 배포 & 롤백, Service 4대 유형, RBAC 보안, Helm v3, PV/PVC 스토리지, 고가용성(HA) 수록.</p>
        </div>
        <div class="u-card">
          <div class="u-head">
            <span class="u-badge">내용 추가</span>
            <span class="u-date">2026-09-16</span>
          </div>
          <div class="u-title"><a href="/study/course/docker">도커 컨테이너 실무 강의 및 실습 정리 추가</a></div>
          <p class="u-desc">가상화 아키텍처 비교부터 데몬 소켓 권한, Dockerfile 포그라운드(daemon off) 원리, 볼륨 영속성 마운트, Docker Hub & 사설 Registry 배포, Docker Compose 제어까지 실무 강의 및 실습 내용 수록.</p>
        </div>
        <div class="u-card">
          <div class="u-head">
            <span class="u-badge">과목 추가</span>
            <span class="u-date">2026-09-10</span>
          </div>
          <div class="u-title"><a href="/study/course/network">네트워크 기초 — IP · DNS · 포트 · 게이트웨이 · 라우팅</a></div>
          <p class="u-desc">브라우저에 www.google.com 입력 시 일어나는 6단계 패킷 여정, ARP와 MAC, 공유기 NAT, 최장 접두어 일치 라우팅, ss/ping 진단 및 refused vs timed out 에러 분석 표 수록.</p>
        </div>
        <div class="u-card">
          <div class="u-head">
            <span class="u-badge">일정 & 실습</span>
            <span class="u-date">2026-09-08</span>
          </div>
          <div class="u-title"><a href="/study/calendar">훈련 132일 전 일정 등록 & Linux 관리자(디스크/LVM/RAID) 실습 보강</a></div>
          <p class="u-desc">개강부터 수료식까지 132일 훈련 일정 및 단위기간 1~5구간 구글 캘린더 실시간 연동, parted GPT, LVM 스냅샷, RAID 장애 복구 실습 보강.</p>
        </div>
      </div>
    </section>

    <!-- 2. 과목별 강의 정리 -->
    <section class="study-sec">
      <div class="sec-hd">
        <h2>📘 과목별 강의 정리</h2>
        <a href="/study/course" class="more-link">과목 전체 목차 보기 →</a>
      </div>
      <form class="sf" method="get" action="/study/search">
        <input name="q" placeholder="모든 과목에서 찾기 (예: docker, LVM, 포트, DNS, swap, awk)">
        <button type="submit">검색</button>
      </form>
      <div class="course-grid">
        ${courseCards}
      </div>
    </section>

    <!-- 3. 스터디 도구 & 심층 가이드 -->
    <section class="study-sec">
      <div class="sec-hd">
        <h2>🛠️ 스터디 도구 & 심층 가이드</h2>
      </div>
      <div class="tool-grid">
        <a class="t-card" href="/study/calendar">
          <div class="t-icon">🗓️</div>
          <div class="t-body">
            <div class="t-title">스터디 & 미팅 캘린더 <span class="tag">일정</span></div>
            <p class="t-desc">132일 훈련 시간표, 단위기간별 회차, 프로젝트·평가일, 구글 캘린더 실시간 연동 현황을 시각적으로 확인합니다.</p>
          </div>
        </a>
        <a class="t-card" href="/study/cheatsheet">
          <div class="t-icon">⚡</div>
          <div class="t-body">
            <div class="t-title">실무 CLI & 명령어 포털 <span class="tag">치트시트</span></div>
            <p class="t-desc">66개 핵심 실무 명령어 검색, Docker · 디스크(LVM/RAID) · 네트워크 진단 대화형 치트 시트와 시나리오.</p>
          </div>
        </a>
        <a class="t-card" href="/study/linux">
          <div class="t-icon">🐧</div>
          <div class="t-body">
            <div class="t-title">리눅스 CLI 심층 가이드 <span class="tag">심화</span></div>
            <p class="t-desc">명령을 익힌 다음 단계 — 단순 암기가 아닌 명령어 출력을 읽는 법과 현업 엔지니어의 증상별 진단 순서.</p>
          </div>
        </a>
        <a class="t-card" href="/study/infra">
          <div class="t-icon">🏗️</div>
          <div class="t-body">
            <div class="t-title">이 서버는 어떻게 돌아가나 <span class="tag">인프라</span></div>
            <p class="t-desc">도메인·Cloudflare Worker·KV·디스코드 봇 연결 구조. 지금 사용하는 스터디 서비스 자체가 그대로 교재입니다.</p>
          </div>
        </a>
      </div>
    </section>

    <!-- 4. 어떻게 사용하는지 (활용법) -->
    <section class="study-sec">
      <div class="sec-hd">
        <h2>💡 어떻게 사용하는지 (스터디 자료 활용법)</h2>
      </div>
      <div class="how-grid">
        <div class="how-card">
          <div class="how-num">1</div>
          <h3>강의 정리 복습 & 키워드 검색</h3>
          <p>정규 수업 후 복습할 때 <strong>과목별 강의 정리</strong>를 순서대로 학습하세요. 기억이 나지 않는 실습 명령어나 에러는 상단 검색창(<code>/study/search</code>)에 입력하면 전체 강의 정리에서 해당 구문과 원리를 찾아줍니다.</p>
        </div>
        <div class="how-card">
          <div class="how-num">2</div>
          <h3>구글 드라이브 자료함 연동 (<code>/자료함</code>)</h3>
          <p>디스코드의 각 주제별 채널마다 전용 구글 드라이브 폴더가 연결되어 있습니다. 채널 채팅창에서 <code>/자료함</code> 명령어를 입력하면 해당 과목의 공유 드라이브 링크가 바로 표시됩니다.</p>
        </div>
        <div class="how-card">
          <div class="how-num">3</div>
          <h3>디스코드 일정 & 자료 검색 명령어</h3>
          <p>
            • <code>/오늘일정</code>, <code>/주간일정</code>: 오늘의 수업 진도 및 스터디 일정을 디스코드에서 바로 확인<br>
            • <code>/일정등록</code>: 팀 스터디나 회의 일정을 구글 캘린더에 바로 등록<br>
            • <code>/자료검색</code>: 드라이브에 등록된 학습 교재나 공유 문서를 키워드로 검색
          </p>
        </div>
        <div class="how-card">
          <div class="how-num">4</div>
          <h3>질문 & 자료 공유 채널 안내</h3>
          <p>실습 중 막히거나 에러가 발생하면 <strong>#❓-질문답변</strong> 또는 각 과목 채널(<code>#💻-리눅스</code>, <code>#🌐-네트워크</code>, <code>#🐳-컨테이너-쿠버네티스</code>)에 질문해주세요. 정리한 문서나 팁은 <strong>#📚-자료공유</strong>에 올려주시면 사이트에 반영됩니다.</p>
        </div>
      </div>
    </section>
  `;

  return html(renderDoc({
    title: '스터디 Hub · 자료 및 강의 정리',
    heading: '📖 KT-CI5 스터디 Hub',
    html: body,
    extraCss: STUDY_CSS,
  }));
}

/* -------------------------------------------------------------- 스터디 & 미팅 캘린더 (디스코드 인증 필요) */

async function apiCalendarEvents(request, url, env) {
  if (!calendarReady(env)) {
    return new Response(JSON.stringify({ ok: false, error: '구글 캘린더 연동 설정이 완료되지 않았습니다.', events: [] }), {
      status: 503,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }

  const timeMin = url.searchParams.get('timeMin') || new Date(new Date().setDate(new Date().getDate() - 30)).toISOString();
  const timeMax = url.searchParams.get('timeMax') || new Date(new Date().setDate(new Date().getDate() + 60)).toISOString();

  try {
    const params = new URLSearchParams({
      timeMin,
      timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      // 훈련 시간표만 132일치라 250 으로는 한 기수를 한 번에 못 담습니다.
      maxResults: '2500',
    });
    const data = await calendarFetch(env, '/events?' + params.toString());

    const events = (data.items || []).map((e) => {
      const title = e.summary || '(제목 없음)';
      const desc = e.description || '';
      const fullText = (title + ' ' + desc).toLowerCase();
      
      let cat = e.colorId || '1';
      if (fullText.includes('스터디') || fullText.includes('강의') || fullText.includes('수업') || fullText.includes('[스터디]') || fullText.includes('[강의]')) {
        cat = '2';
      } else if (fullText.includes('공지') || fullText.includes('행사') || fullText.includes('모임') || fullText.includes('[공지]') || fullText.includes('[행사]')) {
        cat = '3';
      } else if (fullText.includes('미팅') || fullText.includes('회의') || fullText.includes('[미팅]') || fullText.includes('[회의]')) {
        cat = '1';
      }

      return {
        id: e.id,
        title,
        description: desc,
        location: e.location || '',
        start: e.start?.dateTime || e.start?.date,
        end: e.end?.dateTime || e.end?.date,
        allDay: !e.start?.dateTime,
        colorId: cat,
        link: e.htmlLink || '',
      };
    });

    return new Response(JSON.stringify({ ok: true, events }), {
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'cache-control': 'private, no-cache, no-store'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message, events: [] }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=UTF-8' }
    });
  }
}

function studyCalendarPage(env) {
  const isReady = calendarReady(env);
  const statusHtml = isReady
    ? '<span class="cal-badge active">🟢 구글 캘린더 실시간 연동됨 (디스코드 인증 완료)</span>'
    : '<span class="cal-badge warning">🟡 캘린더 연동 설정 대기 중</span>';

  const calendarCss = `
    .doc { max-width: 1400px !important; padding: 24px 20px 64px !important; }
    .cal-badge { display: inline-block; font-size: 12px; padding: 4px 10px; border-radius: 20px; font-weight: 600; margin-bottom: 12px; }
    .cal-badge.active { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); }
    .cal-badge.warning { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
    .cal-controls { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin: 16px 0; background: #1a2234; padding: 12px 16px; border-radius: 10px; border: 1px solid #2a3143; }
    .cal-group { display: flex; align-items: center; gap: 8px; }
    .btn-cal, .btn-mode, .pill-cat { background: #242d42; border: 1px solid #39415a; color: #cbd5e1; font-size: 13px; padding: 6px 14px; border-radius: 6px; cursor: pointer; transition: all 0.15s ease; }
    .btn-cal:hover, .btn-mode:hover, .pill-cat:hover { background: #334155; color: #fff; }
    .btn-mode.active, .pill-cat.active { background: #6366f1; border-color: #818cf8; color: #fff; font-weight: 600; }
    .cal-title-text { font-size: 16px; font-weight: 700; color: #f8fafc; margin-left: 6px; }

    /* 단위기간 = 출석률과 훈련수당을 따지는 구간. 지금 보는 날짜가 어디에 드는지 보여줍니다. */
    .unit-bar { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; background: linear-gradient(90deg, rgba(99,102,241,0.14), rgba(99,102,241,0.03)); border: 1px solid #39415a; border-left: 4px solid #6366f1; border-radius: 10px; padding: 12px 16px; margin-top: 14px; }
    .unit-bar.is-off { background: #1a2234; border-left-color: #475569; }
    .unit-no { font-size: 15px; font-weight: 700; color: #a5b4fc; white-space: nowrap; }
    .unit-bar.is-off .unit-no { color: #94a3b8; }
    .unit-range { font-size: 13px; color: #cbd5e1; }
    .unit-stat { font-size: 12px; color: #94a3b8; }
    .unit-stat b { color: #f8fafc; font-weight: 700; }
    .unit-count { font-size: 12px; font-weight: 700; color: #a5b4fc; }
    .unit-progress { flex-basis: 100%; height: 5px; border-radius: 3px; background: #0f172a; overflow: hidden; margin-top: 2px; }
    .unit-progress i { display: block; height: 100%; background: linear-gradient(90deg, #6366f1, #818cf8); }
    .unit-note { flex-basis: 100%; font-size: 11px; color: #64748b; line-height: 1.6; margin-top: 2px; }

    .unit-legend { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px; }
    .unit-chip { font-size: 11px; padding: 5px 10px; border-radius: 6px; background: #1a2234; border: 1px solid #2a3143; color: #94a3b8; cursor: pointer; transition: all 0.15s ease; }
    .unit-chip:hover { border-color: #4f46e5; color: #cbd5e1; }
    .unit-chip.current { background: #312e81; border-color: #6366f1; color: #e0e7ff; font-weight: 700; }
    .unit-chip.done { opacity: 0.5; }
    .unit-chip span { color: #64748b; }
    .unit-chip.current span { color: #a5b4fc; }

    .day-unit { font-size: 10px; font-weight: 700; color: #818cf8; background: rgba(99,102,241,0.12); border-radius: 4px; padding: 1px 5px; display: inline-block; margin-top: 3px; }

    /* 월간 뷰. 단위기간이 홀/짝으로 번갈아 칠해져 경계가 눈에 들어옵니다. */
    .month-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-top: 12px; }
    .month-dow { text-align: center; font-size: 12px; font-weight: 700; color: #94a3b8; padding: 4px 0; }
    .month-dow.sun { color: #f87171; }
    .month-dow.sat { color: #60a5fa; }
    .mcell { min-height: 112px; background: #161e2e; border: 1px solid #263044; border-left: 3px solid #263044; border-radius: 8px; padding: 6px 7px; display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
    .mcell.u-odd { border-left-color: #4f46e5; background: rgba(79,70,229,0.05); }
    .mcell.u-even { border-left-color: #0ea5e9; background: rgba(14,165,233,0.05); }
    .mcell.u-start { border-left-width: 6px; }
    .mcell.other { opacity: 0.3; }
    .mcell.is-today { border-color: #6366f1; box-shadow: inset 0 0 0 1px #6366f1; }
    .mcell.is-off { background: #131a27; }
    .mday { display: flex; align-items: baseline; justify-content: space-between; gap: 4px; font-size: 12px; font-weight: 700; color: #cbd5e1; }
    .mday .sun { color: #f87171; }
    .mday .sat { color: #60a5fa; }
    .mday .utag { font-size: 9px; font-weight: 700; color: #818cf8; font-variant-numeric: tabular-nums; }
    .mday .utag.dim { color: #64748b; font-weight: 400; }
    .mev { font-size: 10px; line-height: 1.35; color: #e2e8f0; border-left: 2px solid #3b82f6; padding-left: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .mev.cat-2 { border-left-color: #a855f7; }
    .mev.cat-3 { border-left-color: #10b981; }
    .mev.off { color: #94a3b8; border-left-color: #64748b; }
    .mmore { font-size: 10px; color: #64748b; }
    .month-legend { display: flex; gap: 14px; flex-wrap: wrap; font-size: 11px; color: #64748b; margin-top: 10px; }
    .month-legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }

    @media (max-width: 768px) {
      .mcell { min-height: 78px; padding: 4px; }
      .mev, .mmore { font-size: 9px; }
    }

    .week-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 8px; margin-top: 12px; }
    .day-column { background: #161e2e; border: 1px solid #263044; border-radius: 8px; padding: 10px; min-height: 320px; display: flex; flex-direction: column; gap: 8px; }
    .day-column.is-today { border-color: #6366f1; background: rgba(99,102,241,0.06); }
    .day-header { text-align: center; font-size: 13px; font-weight: 700; color: #cbd5e1; padding-bottom: 6px; border-bottom: 1px solid #263044; }
    .day-header span { font-size: 11px; color: #64748b; font-weight: 400; display: block; margin-top: 2px; }
    .day-column.is-today .day-header { color: #818cf8; }
    
    .event-card { background: #202b3d; border-left: 3px solid #3b82f6; border-radius: 4px; padding: 8px; font-size: 12px; color: #f1f5f9; display: flex; flex-direction: column; gap: 4px; }
    .event-card.cat-2 { border-left-color: #a855f7; }
    .event-card.cat-3 { border-left-color: #10b981; }
    .ev-time { font-size: 11px; font-weight: 600; color: #38bdf8; }
    .ev-title { font-weight: 600; line-height: 1.35; color: #f8fafc; }
    .ev-loc { font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 4px; }
    .ev-desc { font-size: 11px; color: #a1a1aa; line-height: 1.4; margin-top: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

    .day-timeline { display: flex; flex-direction: column; gap: 10px; margin-top: 12px; }
    .agenda-item { background: #161e2e; border: 1px solid #263044; border-radius: 8px; padding: 14px 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; transition: border-color 0.2s; }
    .agenda-item:hover { border-color: #4f46e5; }
    .agenda-time { min-width: 140px; font-size: 13px; font-weight: 700; color: #38bdf8; }
    .agenda-body { flex: 1; }
    .agenda-title { font-size: 15px; font-weight: 700; color: #f8fafc; margin-bottom: 4px; }
    .agenda-meta { font-size: 12px; color: #94a3b8; display: flex; gap: 12px; flex-wrap: wrap; }
    .agenda-desc { font-size: 13px; color: #cbd5e1; margin-top: 6px; line-height: 1.5; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 6px; }

    @media (max-width: 768px) {
      .week-grid { grid-template-columns: 1fr; }
      .day-column { min-height: auto; }
      .agenda-item { flex-direction: column; }
    }
  `;

  const htmlContent = `
    <p class="lead">KT클라우드 인프라교육 5기 주간/일간 스터디 미팅 및 공지 일정입니다.<br>
    디스코드 인증된 수강생에게만 실시간으로 안전하게 공개됩니다.</p>
    
    ${statusHtml}

    <div class="cal-controls">
      <div class="cal-group">
        <button id="btnToday" class="btn-cal">오늘</button>
        <button id="btnPrev" class="btn-cal">&lt;</button>
        <button id="btnNext" class="btn-cal">&gt;</button>
        <span id="calTitle" class="cal-title-text">2026년 8월</span>
      </div>

      <div class="cal-group">
        <button class="btn-mode" data-mode="month">월간 뷰 (Monthly)</button>
        <button class="btn-mode active" data-mode="week">주간 뷰 (Weekly)</button>
        <button class="btn-mode" data-mode="day">일간 뷰 (Daily)</button>
      </div>

      <div class="cal-group">
        <button class="pill-cat active" data-cat="all">전체</button>
        <button class="pill-cat" data-cat="1">🔵 미팅/회의</button>
        <button class="pill-cat" data-cat="2">🟣 스터디/강의</button>
        <button class="pill-cat" data-cat="3">🟢 공지/행사</button>
      </div>
    </div>

    <div id="unitBar" class="unit-bar is-off"><span class="unit-no">단위기간 확인 중…</span></div>
    <div id="unitLegend" class="unit-legend"></div>

    <div id="calContainer">
      <div style="padding:40px; text-align:center; color:#94a3b8;">일정을 동기화하는 중입니다...</div>
    </div>

    <script>
      (function() {
        let currentDate = new Date();
        let viewMode = 'week';
        let activeCat = 'all';
        let eventsList = [];

        // 출석률·훈련수당을 따지는 단위기간. 훈련 시간표의 [단위기간 확인] 표 그대로입니다.
        const UNITS = [
          { no: 1, start: '2026-08-19', end: '2026-09-18', days: 18 },
          { no: 2, start: '2026-09-19', end: '2026-10-18', days: 16 },
          { no: 3, start: '2026-10-19', end: '2026-11-18', days: 22 },
          { no: 4, start: '2026-11-19', end: '2026-12-18', days: 21 },
          { no: 5, start: '2026-12-19', end: '2027-01-18', days: 17 },
          { no: 6, start: '2027-01-19', end: '2027-02-18', days: 20 },
          { no: 7, start: '2027-02-19', end: '2027-03-17', days: 18 },
        ];
        const COURSE_START = UNITS[0].start;
        const COURSE_END = UNITS[UNITS.length - 1].end;
        const UNIT_NOTE = '단위기간의 일수는 KT 수업이 있는 날만 셉니다 (월~금 기준, 휴강·공휴일·주말 제외). '
          + '출석률이 80% 미만인 단위기간은 훈련수당이 지급되지 않습니다. '
          + '휴가 사유 출석인정은 단위기간마다 1회 생기고, 모아서 쓸 수는 있어도 쪼개 쓸 수는 없습니다 (훈련 후반부 사용 권장).';

        const unitBar = document.getElementById('unitBar');
        const unitLegend = document.getElementById('unitLegend');
        const calContainer = document.getElementById('calContainer');
        const calTitle = document.getElementById('calTitle');
        const btnToday = document.getElementById('btnToday');
        const btnPrev = document.getElementById('btnPrev');
        const btnNext = document.getElementById('btnNext');

        document.querySelectorAll('.btn-mode').forEach(btn => {
          btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-mode').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            viewMode = e.target.dataset.mode;
            render();
          });
        });

        document.querySelectorAll('.pill-cat').forEach(btn => {
          btn.addEventListener('click', (e) => {
            document.querySelectorAll('.pill-cat').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeCat = e.target.dataset.cat;
            render();
          });
        });

        btnToday.addEventListener('click', () => {
          currentDate = new Date();
          loadEvents();
        });

        // 월 이동은 날짜를 1일로 내린 뒤 옮깁니다. 31일에서 그냥 한 달을 더하면
        // 짧은 달을 건너뛰어 3월 3일 같은 곳에 떨어집니다.
        function shift(step) {
          if (viewMode === 'month') {
            currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + step, 1);
          } else if (viewMode === 'week') {
            currentDate.setDate(currentDate.getDate() + step * 7);
          } else {
            currentDate.setDate(currentDate.getDate() + step);
          }
          render();
        }

        btnPrev.addEventListener('click', () => shift(-1));
        btnNext.addEventListener('click', () => shift(1));

        async function loadEvents() {
          calContainer.innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8;">구글 캘린더 일정 동기화 중...</div>';
          try {
            // 기본 창(-30일~+60일)은 훈련기간 전체를 덮지 못해 뒷달이 비어 보입니다.
            const params = new URLSearchParams({
              timeMin: COURSE_START + 'T00:00:00+09:00',
              timeMax: COURSE_END + 'T23:59:59+09:00',
            });
            const res = await fetch('/api/calendar/events?' + params.toString());
            const data = await res.json();
            if (data.ok) {
              eventsList = data.events || [];
            }
          } catch (err) {
            console.error(err);
          }
          render();
        }

        function render() {
          buildSessions();
          renderUnitBar();
          if (viewMode === 'month') renderMonthView();
          else if (viewMode === 'week') renderWeekView();
          else renderDayView();
        }

        // 날짜 문자열(YYYY-MM-DD)이 속한 단위기간을 찾습니다. 훈련기간 밖이면 null.
        function unitOf(dateStr) {
          return UNITS.find(u => dateStr >= u.start && dateStr <= u.end) || null;
        }

        // 훈련일만 셉니다. 휴강·공휴일은 종일 일정이라 여기서 자연히 빠지고,
        // 주말도 시간 일정이 없으니 빠집니다. 즉 실제 수업이 있는 월~금만 남습니다.
        function trainingDaysIn(unit) {
          const seen = new Set();
          eventsList.forEach(ev => {
            if (ev.allDay || !ev.start) return;
            const d = getEventDateStr(ev.start);
            if (d >= unit.start && d <= unit.end) seen.add(d);
          });
          return [...seen].sort();
        }

        // 수업이 있었던 날만 하루씩 차감합니다. 오늘은 아직 안 지난 것으로 봅니다.
        function unitProgress(unit, todayStr) {
          const days = trainingDaysIn(unit);
          const total = days.length || unit.days;
          const used = days.filter(d => d < todayStr).length;
          return { total, used, left: Math.max(total - used, 0), days };
        }

        // 단위기간의 수업일과 KT 수업 시간은 1:1 입니다. 그래서 수업일마다
        // 그 단위기간 안에서 몇 번째인지 회차를 매겨 03/18 처럼 보여줍니다.
        let sessionMap = {};
        function buildSessions() {
          sessionMap = {};
          UNITS.forEach(u => {
            const days = trainingDaysIn(u);
            const total = days.length || u.days;
            days.forEach((d, i) => {
              sessionMap[d] = { unit: u.no, seq: i + 1, total };
            });
          });
        }

        function pad2(n) { return String(n).padStart(2, '0'); }

        function sessionLabel(dateStr) {
          const s = sessionMap[dateStr];
          return s ? pad2(s.seq) + '/' + pad2(s.total) : '';
        }

        function renderUnitBar() {
          // 주간 뷰는 그 주의 월요일, 일간 뷰는 그 날짜, 월간 뷰는 그 달에 오늘이
          // 들어 있으면 오늘 / 아니면 1일을 기준으로 잡습니다.
          const now = new Date();
          const basis = viewMode === 'week'
            ? (() => { const d = getStartOfWeek(currentDate); d.setDate(d.getDate() + 1); return d; })()
            : viewMode === 'month'
              ? (now.getFullYear() === currentDate.getFullYear() && now.getMonth() === currentDate.getMonth()
                  ? now
                  : new Date(currentDate.getFullYear(), currentDate.getMonth(), 1))
              : currentDate;
          const dateStr = formatLocalDateStr(basis);
          const unit = unitOf(dateStr);
          const todayStr = formatLocalDateStr(new Date());

          if (!unit) {
            unitBar.className = 'unit-bar is-off';
            const before = dateStr < COURSE_START;
            unitBar.innerHTML = '<span class="unit-no">훈련기간 밖</span>'
              + '<span class="unit-range">전체 훈련기간 ' + COURSE_START + ' ~ ' + COURSE_END + ' (총 132일)</span>'
              + '<span class="unit-stat">' + (before ? '아직 개강 전입니다.' : '수료 이후입니다.') + '</span>';
          } else {
            const p = unitProgress(unit, todayStr);
            const pct = p.total ? Math.round((p.used / p.total) * 100) : 0;
            const state = todayStr < unit.start ? '아직 시작 전'
              : todayStr > unit.end ? '종료된 구간'
              : '진행 중';
            const nextDay = p.days.find(d => d >= todayStr);

            unitBar.className = 'unit-bar';
            unitBar.innerHTML = '<span class="unit-no">' + unit.no + '단위기간</span>'
              + '<span class="unit-range">' + unit.start + ' ~ ' + unit.end + '</span>'
              + '<span class="unit-stat">KT 수업일 <b>' + p.total + '일</b> 중 '
              + '<b>' + p.used + '일</b> 지남 · 남은 <b>' + p.left + '일</b></span>'
              + '<span class="unit-count">' + state
              + (sessionMap[todayStr] && sessionMap[todayStr].unit === unit.no
                  ? ' · 오늘 ' + sessionLabel(todayStr) + '회차'
                  : nextDay && todayStr <= unit.end
                    ? ' · 다음 수업 ' + nextDay.slice(5) + ' (' + sessionLabel(nextDay) + '회차)'
                    : '') + '</span>'
              + '<span class="unit-progress"><i style="width:' + pct + '%"></i></span>'
              + '<span class="unit-note">※ ' + UNIT_NOTE + '</span>';
          }

          unitLegend.innerHTML = UNITS.map(u => {
            const cls = unit && u.no === unit.no ? 'current' : (todayStr > u.end ? 'done' : '');
            const p = unitProgress(u, todayStr);
            const tail = todayStr > u.end ? '완료' : '남은 ' + p.left + '일';
            return '<button class="unit-chip ' + cls + '" data-start="' + u.start + '">'
              + u.no + '단위 <span>' + u.start.slice(5) + '~' + u.end.slice(5)
              + ' · ' + p.total + '일 · ' + tail + '</span></button>';
          }).join('');
          unitLegend.querySelectorAll('.unit-chip').forEach(chip => {
            chip.addEventListener('click', () => {
              const parts = chip.dataset.start.split('-');
              currentDate = new Date(parts[0], parts[1] - 1, parts[2]);
              render();
            });
          });
        }

        function renderMonthView() {
          const year = currentDate.getFullYear();
          const month = currentDate.getMonth();
          calTitle.textContent = year + '년 ' + (month + 1) + '월';

          const first = new Date(year, month, 1);
          const gridStart = getStartOfWeek(first);
          const todayStr = formatLocalDateStr(new Date());
          const dows = ['일', '월', '화', '수', '목', '금', '토'];

          let html = '<div class="month-grid">';
          dows.forEach((d, i) => {
            const cls = i === 0 ? ' sun' : i === 6 ? ' sat' : '';
            html += '<div class="month-dow' + cls + '">' + d + '</div>';
          });

          // 6주면 어떤 달이든 덮습니다. 이미 다음 달로 넘어간 줄은 그리지 않습니다.
          const lastOfMonth = new Date(year, month + 1, 0);
          for (let week = 0; week < 6; week++) {
            const weekStart = new Date(gridStart);
            weekStart.setDate(weekStart.getDate() + week * 7);
            if (week > 0 && weekStart > lastOfMonth) break;

            for (let i = 0; i < 7; i++) {
              const cell = new Date(weekStart);
              cell.setDate(cell.getDate() + i);
              const dateStr = formatLocalDateStr(cell);
              const inMonth = cell.getMonth() === month;
              const unit = unitOf(dateStr);

              const evs = eventsList.filter(ev => {
                if (isUnitEvent(ev)) return false;
                if (activeCat !== 'all' && (ev.colorId || '1') !== activeCat) return false;
                return isEventOnDate(ev, dateStr);
              });
              const hasClass = evs.some(ev => !ev.allDay);

              const cls = ['mcell'];
              if (!inMonth) cls.push('other');
              if (dateStr === todayStr) cls.push('is-today');
              if (unit) cls.push(unit.no % 2 ? 'u-odd' : 'u-even');
              if (unit && dateStr === unit.start) cls.push('u-start');
              if (unit && !hasClass) cls.push('is-off');

              html += '<div class="' + cls.join(' ') + '">';
              const dcls = i === 0 ? ' class="sun"' : i === 6 ? ' class="sat"' : '';
              html += '<div class="mday"><span' + dcls + '>' + cell.getDate() + '</span>';
              if (unit && inMonth) {
                const label = sessionLabel(dateStr);
                html += label
                  ? '<span class="utag">' + label + '</span>'
                  : '<span class="utag dim">' + (dateStr === unit.start ? unit.no + '단위 시작' : unit.no + '단위') + '</span>';
              }
              html += '</div>';

              evs.slice(0, 3).forEach(ev => {
                const c = 'mev cat-' + (ev.colorId || '1') + (ev.allDay ? ' off' : '');
                html += '<div class="' + c + '" title="' + escapeHtml(ev.title) + '">'
                  + escapeHtml(ev.title.replace(/^\[KT[^\]]*\]\s*/, '')) + '</div>';
              });
              if (evs.length > 3) html += '<div class="mmore">+' + (evs.length - 3) + '건</div>';

              html += '</div>';
            }
          }
          html += '</div>';

          html += '<div class="month-legend">'
            + '<span><i style="background:#4f46e5"></i>홀수 단위기간</span>'
            + '<span><i style="background:#0ea5e9"></i>짝수 단위기간</span>'
            + '<span><i style="background:#131a27;border:1px solid #263044"></i>수업 없는 날 (휴강·공휴일)</span>'
            + '<span>테두리가 두꺼운 칸이 단위기간 시작일입니다.</span>'
            + '</div>';

          calContainer.innerHTML = html;
        }

        function renderWeekView() {
          const startOfWeek = getStartOfWeek(currentDate);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(endOfWeek.getDate() + 6);

          calTitle.textContent = startOfWeek.getFullYear() + '년 ' + (startOfWeek.getMonth() + 1) + '월 ' + startOfWeek.getDate() + '일 ~ ' + endOfWeek.getDate() + '일';

          const days = ['일', '월', '화', '수', '목', '금', '토'];
          const today = new Date();
          let html = '<div class="week-grid">';

          for (let i = 0; i < 7; i++) {
            const dayDate = new Date(startOfWeek);
            dayDate.setDate(dayDate.getDate() + i);
            const dateStr = formatLocalDateStr(dayDate);

            const isToday = today.toDateString() === dayDate.toDateString();
            const filteredEvents = eventsList.filter(ev => {
              if (isUnitEvent(ev)) return false;
              if (activeCat !== 'all' && (ev.colorId || '1') !== activeCat) return false;
              return isEventOnDate(ev, dateStr);
            });

            const dayUnit = unitOf(dateStr);

            html += '<div class="day-column ' + (isToday ? 'is-today' : '') + '">';
            html += '<div class="day-header">' + days[i] + '요일 <span>' + (dayDate.getMonth() + 1) + '.' + dayDate.getDate() + '</span>';
            if (dayUnit) {
              const label = sessionLabel(dateStr);
              html += '<span class="day-unit">' + dayUnit.no + '단위'
                + (label ? ' · ' + label + '회차' : '') + '</span>';
            }
            html += '</div>';

            if (filteredEvents.length === 0) {
              html += '<div style="font-size:11px; color:#475569; text-align:center; margin-top:20px;">일정 없음</div>';
            } else {
              filteredEvents.forEach(ev => {
                const timeStr = formatTimeStr(ev);
                const catClass = 'cat-' + (ev.colorId || '1');
                html += '<div class="event-card ' + catClass + '">';
                html += '<div class="ev-time">' + timeStr + '</div>';
                html += '<div class="ev-title">' + escapeHtml(ev.title) + '</div>';
                if (ev.location) html += '<div class="ev-loc">📍 ' + escapeHtml(ev.location) + '</div>';
                if (ev.description) html += '<div class="ev-desc">' + escapeHtml(ev.description) + '</div>';
                html += '</div>';
              });
            }

            html += '</div>';
          }

          html += '</div>';
          calContainer.innerHTML = html;
        }

        function renderDayView() {
          const dateStr = formatLocalDateStr(currentDate);
          const days = ['일', '월', '화', '수', '목', '금', '토'];
          const sess = sessionMap[dateStr];
          calTitle.textContent = currentDate.getFullYear() + '년 ' + (currentDate.getMonth() + 1) + '월 ' + currentDate.getDate() + '일 (' + days[currentDate.getDay()] + '요일)'
            + (sess ? ' · ' + sess.unit + '단위기간 ' + sessionLabel(dateStr) + '회차' : '');

          const dayEvents = eventsList.filter(ev => {
            if (isUnitEvent(ev)) return false;
            if (activeCat !== 'all' && (ev.colorId || '1') !== activeCat) return false;
            return isEventOnDate(ev, dateStr);
          });

          if (dayEvents.length === 0) {
            calContainer.innerHTML = '<div style="padding:40px; text-align:center; color:#94a3b8; background:#161e2e; border-radius:8px;">이 날짜에 예정된 미팅 또는 스터디 일정이 없습니다.</div>';
            return;
          }

          let html = '<div class="day-timeline">';
          dayEvents.forEach(ev => {
            const timeStr = formatTimeStr(ev);
            html += '<div class="agenda-item">';
            html += '<div class="agenda-time">' + timeStr + '</div>';
            html += '<div class="agenda-body">';
            html += '<div class="agenda-title">' + escapeHtml(ev.title) + '</div>';
            html += '<div class="agenda-meta">';
            if (ev.location) html += '<span>📍 장소: ' + escapeHtml(ev.location) + '</span>';
            html += '</div>';
            if (ev.description) html += '<div class="agenda-desc">' + escapeHtml(ev.description) + '</div>';
            html += '</div></div>';
          });
          html += '</div>';

          calContainer.innerHTML = html;
        }

        // 단위기간 일정은 한 달 내내 걸쳐 있어 날짜 칸에 넣으면 가리기만 합니다.
        // 위쪽 단위기간 표시줄이 대신 보여주므로 목록에서는 뺍니다.
        function isUnitEvent(ev) {
          return typeof ev.title === 'string' && ev.title.indexOf('단위기간') !== -1;
        }

        function formatLocalDateStr(d) {
          const pad = n => String(n).padStart(2, '0');
          return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
        }

        function getEventDateStr(dateInput) {
          if (!dateInput) return '';
          if (typeof dateInput === 'string' && dateInput.length === 10) return dateInput;
          const d = new Date(dateInput);
          if (isNaN(d.getTime())) return '';
          return formatLocalDateStr(d);
        }

        function isEventOnDate(ev, targetDateStr) {
          if (!ev.start) return false;
          const startStr = getEventDateStr(ev.start);
          
          let endStr = startStr;
          if (ev.end) {
            endStr = getEventDateStr(ev.end);
            if (ev.allDay && endStr > startStr) {
              const parts = endStr.split('-');
              const d = new Date(parts[0], parts[1] - 1, parts[2]);
              d.setDate(d.getDate() - 1);
              endStr = formatLocalDateStr(d);
            }
          }

          return targetDateStr >= startStr && targetDateStr <= endStr;
        }

        function getStartOfWeek(d) {
          const day = d.getDay();
          const diff = d.getDate() - day;
          return new Date(d.getFullYear(), d.getMonth(), diff);
        }

        function formatTimeStr(ev) {
          const { start, end, allDay } = ev;
          if (!start) return '';
          
          const startStr = getEventDateStr(start);
          let endStr = startStr;
          if (end) {
            endStr = getEventDateStr(end);
            if (allDay && endStr > startStr) {
              const parts = endStr.split('-');
              const d = new Date(parts[0], parts[1] - 1, parts[2]);
              d.setDate(d.getDate() - 1);
              endStr = formatLocalDateStr(d);
            }
          }

          const isMultiDay = startStr !== endStr;

          if (allDay) {
            if (isMultiDay) {
              return startStr.slice(5).replace('-', '/') + ' ~ ' + endStr.slice(5).replace('-', '/') + ' (연속)';
            }
            return '종일';
          }

          const s = new Date(start);
          const e = end ? new Date(end) : null;
          const pad = n => String(n).padStart(2, '0');
          const sTime = pad(s.getHours()) + ':' + pad(s.getMinutes());
          
          if (!e) return sTime;
          
          const eTime = pad(e.getHours()) + ':' + pad(e.getMinutes());

          if (isMultiDay) {
            return (s.getMonth() + 1) + '/' + s.getDate() + ' ' + sTime + ' ~ ' + (e.getMonth() + 1) + '/' + e.getDate() + ' ' + eTime + ' (연속)';
          }

          return sTime + ' ~ ' + eTime;
        }

        function escapeHtml(str) {
          if (!str) return '';
          return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        }

        loadEvents();
      })();
    </script>
  `;

  return html(renderDoc({
    title: '스터디 & 미팅 캘린더',
    heading: '🗓️ 스터디 & 미팅 캘린더',
    html: htmlContent,
    extraCss: calendarCss,
  }));
}

function infraGuidePage(env) {
  return html(renderDoc({
    title: INFRA_TITLE,
    heading: '🛠 이 서버는 어떻게 돌아가나',
    html: renderInfraGuide(escapeHtml),
    extraCss: INFRA_CSS,
  }));
}

async function courseSearchPage(env, q) {
  const all = await loadAll(env);
  return html(renderDoc({
    title: '강의 정리 검색',
    heading: '🔎 강의 정리 검색',
    html: renderSearch(all, q.slice(0, 60), escapeHtml),
    extraCss: COURSE_CSS,
  }));
}

/* ------------------------------------------------------------ 업데이트 내역 */

// 원본은 저장소의 CHANGELOG.md 입니다. scripts/post-updates.mjs 가 KV 에 올리고,
// 같은 내용으로 디스코드 고정 공지도 갱신합니다.
async function updatesPage(env) {
  const md = await env.ROSTER.get('site:updates');
  if (!md) {
    return errorPage('업데이트 내역이 아직 올라오지 않았습니다. `npm run updates` 를 실행해주세요.', 404);
  }
  // 파일 맨 앞의 제목과 운영진용 실행 안내는 페이지에서 뺍니다.
  const body = md
    .replace(/^#\s+.*\n/, '')
    .replace(/```bash[\s\S]*?```\n/, '')
    .replace(/^사이트에 무엇이[\s\S]*?만들어집니다\.\n/m, '')
    .replace(/^적는 방법은[\s\S]*?봐주세요\.\n/m, '')
    .replace(/\n---\n\n## 쓰는 규칙[\s\S]*$/, '\n');

  return html(renderDoc({
    title: '업데이트 내역',
    heading: '📌 업데이트 내역',
    html: '<p class="lead">사이트에 무엇이 언제 올라왔는지 날짜순으로 정리한 것입니다.</p>'
      + markdown(body, escapeHtml),
    extraCss: COURSE_CSS,
  }));
}

async function courseListPage(env) {
  const all = await loadAll(env);
  const index = all.map((c) => ({ ...c, chapters: c.chapters.length }));
  if (!index?.length) {
    return errorPage('강의 정리가 아직 올라오지 않았습니다. 운영진에게 문의해주세요.', 404);
  }
  return html(renderDoc({
    title: '강의 정리',
    heading: '📘 강의 정리',
    html: renderCourseList(index, escapeHtml),
    extraCss: COURSE_CSS,
  }));
}

async function courseIndexPage(env, courseId) {
  const doc = await loadCourse(env, courseId);
  if (!doc) return errorPage('그런 과목이 없습니다.', 404);

  const notes = (await loadNotes(env, courseId)) || {};
  return html(renderDoc({
    title: doc.title,
    heading: `📘 ${doc.title}`,
    html: renderCourseIndex(doc, escapeHtml, notes),
    extraCss: COURSE_CSS,
  }));
}

async function courseChapterPage(env, courseId, chapterId) {
  const doc = await loadCourse(env, courseId);
  if (!doc) return errorPage('그런 과목이 없습니다.', 404);

  const chapter = doc.chapters.find((c) => c.id === chapterId);
  if (!chapter) return errorPage('그런 장이 없습니다.', 404);

  const all = await loadAll(env);
  const notes = all.find((c) => c.id === courseId)?.notes || {};
  return html(renderDoc({
    title: `${chapter.name} · ${doc.title}`,
    heading: `📘 ${notes[chapterId]?.title || chapter.name}`,
    html: renderCourseChapter(doc, chapter, escapeHtml, notes[chapterId],
                              linkResolver(all, courseId)),
    extraCss: COURSE_CSS,
  }));
}

function linuxGuidePage(env) {
  return html(renderDoc({
    title: LINUX_GUIDE_TITLE,
    heading: '🐧 리눅스 CLI 심층 가이드',
    html: renderLinuxGuide(escapeHtml),
    extraCss: LINUX_GUIDE_CSS,
  }));
}

// 명단에 없는 계정 — 서버 안의 선택 인증이나 운영진 승인으로 안내합니다.
function notOnRosterPage(env) {
  return html(renderPage({
    title: '추가 확인 필요',
    heading: '🕓 조금만 더 확인이 필요해요',
    body:
      '<p>명단에서 이 디스코드 계정을 찾지 못했습니다.<br>' +
      '서버의 <strong>#🔒-대기실</strong> 에서 <strong>인증하기</strong> 버튼을 누르면 ' +
      '본인 이름을 골라 인증할 수 있습니다.</p>' +
      '<p class="hint">이름 목록에도 본인이 없다면 <strong>목록에 없어요</strong> 를 눌러주세요. ' +
      '운영진이 확인 후 열어드립니다.</p>' +
      (env.DISCORD_INVITE_URL
        ? `<a class="btn" href="${escapeHtml(env.DISCORD_INVITE_URL)}">디스코드 서버로 이동</a>`
        : ''),
  }), 200);
}

/* ------------------------------------------------------- 연결된 역할(Linked Roles) */

function linkedRoleRedirectUri(env) {
  return env.LINKED_ROLE_REDIRECT_URI || 'https://ktci5.kr/discord/linked-role/callback';
}

function startLinkedRole(env) {
  if (missingConfig(env, ['DISCORD_CLIENT_ID']).length) {
    return errorPage('서버 설정이 아직 완료되지 않았습니다. 운영진에게 문의해주세요.', 503);
  }

  const state = crypto.randomUUID();
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: linkedRoleRedirectUri(env),
    response_type: 'code',
    scope: 'identify role_connections.write',
    state,
    prompt: 'consent',
  });

  return redirect('https://discord.com/oauth2/authorize?' + params.toString(), {
    'set-cookie': stateCookie(LINKED_STATE_COOKIE, state),
  });
}

async function handleLinkedRoleCallback(request, url, env) {
  const guard = checkCallback(request, url, LINKED_STATE_COOKIE);
  if (guard.error) return errorPage(guard.error);

  const token = await exchangeCode(guard.code, env, linkedRoleRedirectUri(env));
  if (!token) return errorPage('디스코드 인증 처리 중 오류가 발생했습니다. (토큰 교환 실패)');

  const me = await fetchMe(token.access_token);
  if (!me) return errorPage('디스코드 사용자 정보를 가져오지 못했습니다.');

  // 서버에서 실제로 5기인증 역할을 갖고 있는지 확인한 값을 메타데이터로 기록합니다.
  const verified = await hasVerifiedRole(me.id, env);

  const res = await fetch(`${DISCORD_API}/users/@me/applications/${env.DISCORD_CLIENT_ID}/role-connection`, {
    method: 'PUT',
    headers: {
      authorization: 'Bearer ' + token.access_token,
      'content-type': 'application/json',
      'user-agent': USER_AGENT,
    },
    body: JSON.stringify({
      platform_name: PLATFORM_NAME,
      platform_username: me.global_name || me.username,
      metadata: {
        verified: verified ? 1 : 0,
        cohort: COHORT,
      },
    }),
  });

  if (!res.ok) {
    return errorPage(`연결된 역할 정보를 기록하지 못했습니다 (코드 ${res.status}). 운영진에게 문의해주세요.`, 502);
  }

  const name = escapeHtml(me.global_name || me.username);
  return html(renderPage({
    title: '연결 완료',
    heading: '🔗 계정 연결이 완료되었습니다',
    body:
      `<p><strong>${name}</strong>님의 5기 인증 정보가 디스코드에 연결되었습니다.<br>` +
      (verified
        ? '인증 상태: <strong>완료</strong> — 연결된 역할 조건을 충족합니다.'
        : '인증 상태: <strong>미완료</strong> — 먼저 아래에서 5기 인증을 마쳐주세요.') +
      '</p>' +
      (verified ? '' : '<a class="btn" href="/discord/verify">5기 인증하러 가기</a>'),
  }));
}

async function hasVerifiedRole(userId, env) {
  if (missingConfig(env, ['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID', 'DISCORD_ROLE_ID']).length) {
    return false;
  }
  const res = await fetch(`${DISCORD_API}/guilds/${env.DISCORD_GUILD_ID}/members/${userId}`, {
    headers: { authorization: 'Bot ' + env.DISCORD_BOT_TOKEN, 'user-agent': USER_AGENT },
  });
  if (!res.ok) return false;
  const member = await res.json();
  return Array.isArray(member.roles) && member.roles.includes(env.DISCORD_ROLE_ID);
}

/* ------------------------------------------------------------- 인터랙션 엔드포인트 */

async function handleInteractions(request, env, ctx) {
  if (!env.DISCORD_PUBLIC_KEY) {
    return new Response('interactions endpoint not configured', { status: 503 });
  }

  const raw = await request.text();
  if (!(await verifySignature(request, raw, env))) {
    // 디스코드는 등록 검증 시 일부러 잘못된 서명을 보내며, 반드시 401 이어야 합니다.
    return new Response('invalid request signature', { status: 401 });
  }

  let interaction;
  try {
    interaction = JSON.parse(raw);
  } catch {
    return new Response('bad request', { status: 400 });
  }

  switch (interaction.type) {
    case INTERACTION.PING:
      return Response.json({ type: REPLY.PONG });
    case INTERACTION.COMMAND:
      return handleCommand(interaction, env, ctx);
    case INTERACTION.COMPONENT:
      return handleComponent(interaction, env);
    default:
      return ephemeral('지원하지 않는 인터랙션입니다.');
  }
}

async function verifySignature(request, body, env) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  if (!signature || !timestamp) return false;

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      hexToBytes(env.DISCORD_PUBLIC_KEY),
      { name: 'Ed25519' },
      false,
      ['verify']
    );
    return await crypto.subtle.verify(
      { name: 'Ed25519' },
      key,
      hexToBytes(signature),
      new TextEncoder().encode(timestamp + body)
    );
  } catch {
    return false;
  }
}

function hexToBytes(hex) {
  const clean = String(hex).trim();
  if (clean.length % 2 !== 0 || /[^0-9a-fA-F]/.test(clean)) {
    throw new Error('invalid hex');
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

async function handleCommand(interaction, env, ctx) {
  const name = interaction.data?.name;

  if (name === '인증') {
    return runVerifyInteraction(interaction, env);
  }

  if (name === '인증패널') {
    return Response.json({
      type: REPLY.MESSAGE,
      data: {
        embeds: [{
          title: '🎫 KT클라우드 인프라교육 5기 인증',
          description:
            '아래 **인증하기** 버튼을 누르면 `${ROLE_NAME}` 역할이 바로 부여됩니다.\n' +
            '버튼이 동작하지 않으면 웹 인증을 이용해주세요.',
          color: 0x5865f2,
        }],
        components: [{
          type: 1,
          components: [
            { type: 2, style: 1, label: '인증하기', custom_id: VERIFY_BUTTON_ID, emoji: { name: '✅' } },
            { type: 2, style: 5, label: '웹으로 인증', url: 'https://ktci5.kr/discord/verify' },
          ],
        }],
      },
    });
  }

  if (name === '일정등록') {
    return scheduleCreate(interaction, env, ctx);
  }

  if (name === '오늘일정') {
    return scheduleToday(interaction, env, ctx);
  }

  if (name === '주간일정') {
    return scheduleWeek(interaction, env, ctx);
  }

  if (name === '자료함') {
    return showDriveFolder(interaction, env, ctx);
  }

  if (name === '자료보기') {
    return showDriveFiles(interaction, env, ctx);
  }

  if (name === '자료검색') {
    return searchDriveFiles(interaction, env, ctx);
  }

  if (name === '스터디자료') {
    return showStudyRepo(interaction, env, ctx);
  }

  return ephemeral('알 수 없는 명령입니다. 사용 가능한 명령은 `/인증`, `/일정등록`, `/오늘일정`, `/주간일정`, `/자료함`, `/자료보기`, `/자료검색`, `/스터디자료` 입니다.');
}

async function handleComponent(interaction, env) {
  const id = interaction.data?.custom_id || '';

  if (id === VERIFY_BUTTON_ID) return runVerifyInteraction(interaction, env);
  if (id === NAME_SELECT_ID) return handleNamePick(interaction, env);
  if (id === REQUEST_ID) return requestApproval(interaction, env);
  if (id.startsWith(NAME_PAGE_ID + ':')) {
    return showNamePicker(interaction, env, Number(id.slice(NAME_PAGE_ID.length + 1)) || 0, true);
  }
  if (id.startsWith(APPROVE_ID + ':')) {
    return handleApprove(interaction, env, id.slice(APPROVE_ID.length + 1));
  }
  return ephemeral('오래된 메시지의 버튼일 수 있습니다. 최신 안내 메시지에서 다시 눌러주세요.');
}

async function runVerifyInteraction(interaction, env) {
  const user = interaction.member?.user || interaction.user;
  if (!interaction.guild_id || !user) {
    return ephemeral('스터디 서버 안에서 실행해주세요.\n' + WEB_VERIFY_URL + ' 로도 인증할 수 있습니다.');
  }
  if (interaction.guild_id !== env.DISCORD_GUILD_ID) {
    return ephemeral('이 명령은 KT클라우드 5기 스터디 서버에서만 사용할 수 있습니다.');
  }
  if ((interaction.member?.roles || []).includes(env.DISCORD_ROLE_ID)) {
    return ephemeral('이미 인증되어 있습니다. 모든 채널을 이용하실 수 있어요.\n채널 안내: ' + GUIDE_URL);
  }

  // 1) 명단에 디스코드 계정이 있으면 클릭 없이 바로 부여
  const roster = await loadRoster(env);
  if (roster && matchMember(roster, user)) {
    return grantAndReply(interaction, env, user);
  }

  // 2) 계정이 안 맞으면 본인 이름을 고르게 합니다
  if (roster && availableNames(roster, await loadClaims(env)).length) {
    return showNamePicker(interaction, env, 0, false);
  }

  // 3) 이름 목록조차 없으면 바로 운영진 승인 요청
  return requestApproval(interaction, env);
}

/* ------------------------------------------------------------- 명단(KV) */

function normalizeName(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '');
}

async function loadRoster(env) {
  if (!env.ROSTER) return null;
  const data = await env.ROSTER.get('roster', 'json');
  return data?.members?.length ? data : null;
}

async function loadClaims(env) {
  if (!env.ROSTER) return {};
  return (await env.ROSTER.get('claims', 'json')) || {};
}

// 디스코드 계정이 명단에 있는지 — ID 로 찾고, ID 를 모르는 항목만 사용자명으로.
//
// 사용자명 대조를 ID 가 있는 항목까지 넓히면 안 됩니다. 명단에 있는 사람이
// 핸들을 바꾸면 옛 핸들이 풀리고, 그것을 선점한 다른 계정이 통과합니다.
// ID 가 적힌 항목은 ID 로만 확인합니다.
function matchMember(roster, user) {
  const uname = String(user.username || '').toLowerCase();
  return roster.members.find((m) => m.id && m.id === user.id)
    || roster.members.find((m) => !m.id && m.username && m.username.toLowerCase() === uname)
    || null;
}

// 아직 아무도 가져가지 않은 이름들
function availableNames(roster, claims) {
  return roster.members
    .filter((m) => m.name && !claims[normalizeName(m.name)])
    .map((m) => m.name)
    .sort((a, b) => a.localeCompare(b, 'ko'));
}

/* ------------------------------------------------------- 이름으로 인증하기 */

function showNamePicker(interaction, env, page, isUpdate) {
  return (async () => {
    const roster = await loadRoster(env);
    if (!roster) return ephemeral('명단이 아직 등록되지 않았습니다. 운영진에게 문의해주세요.');

    const names = availableNames(roster, await loadClaims(env));
    const pages = Math.max(1, Math.ceil(names.length / NAMES_PER_PAGE));
    const current = Math.min(Math.max(0, page), pages - 1);
    const slice = names.slice(current * NAMES_PER_PAGE, (current + 1) * NAMES_PER_PAGE);

    if (!slice.length) return requestApproval(interaction, env);

    const rows = [{
      type: 1,
      components: [{
        type: 3,
        custom_id: NAME_SELECT_ID,
        placeholder: '본인 이름을 선택하세요',
        options: slice.map((n) => ({ label: n, value: n })),
      }],
    }];

    const nav = [];
    if (current > 0) {
      nav.push({ type: 2, style: 2, label: '이전', custom_id: `${NAME_PAGE_ID}:${current - 1}` });
    }
    if (current < pages - 1) {
      nav.push({ type: 2, style: 2, label: '다음', custom_id: `${NAME_PAGE_ID}:${current + 1}` });
    }
    nav.push({ type: 2, style: 2, label: '목록에 없어요', custom_id: REQUEST_ID });
    rows.push({ type: 1, components: nav });

    const body = {
      content: pages > 1
        ? `본인 이름을 선택해주세요. (${current + 1}/${pages} 페이지)`
        : '본인 이름을 선택해주세요.',
      flags: EPHEMERAL,
      components: rows,
    };
    return Response.json({ type: isUpdate ? REPLY.UPDATE : REPLY.MESSAGE, data: body });
  })();
}

async function handleNamePick(interaction, env) {
  const user = interaction.member?.user || interaction.user;
  const picked = interaction.data?.values?.[0];
  if (!picked || !user) return ephemeral('선택을 처리하지 못했습니다. 대기실의 인증하기 버튼을 다시 눌러주세요.');

  const roster = await loadRoster(env);
  const entry = roster?.members.find((m) => normalizeName(m.name) === normalizeName(picked));
  if (!entry) return ephemeral('명단에서 찾을 수 없는 이름입니다. 목록이 갱신되었을 수 있으니 다시 눌러주세요.');

  const key = normalizeName(picked);
  const claims = await loadClaims(env);
  if (claims[key] && claims[key] !== user.id) {
    return updateMessage('이 이름은 이미 다른 계정이 사용했습니다.\n본인이 맞다면 **목록에 없어요** 를 눌러 운영진 확인을 요청해주세요.');
  }

  claims[key] = user.id;
  await env.ROSTER.put('claims', JSON.stringify(claims));

  const res = await grantRoleResult(interaction, env, user);
  if (!res.ok) {
    // 부여에 실패하면 점유를 되돌립니다. 안 그러면 본인이 재시도할 때 자기 이름이 막힙니다.
    delete claims[key];
    await env.ROSTER.put('claims', JSON.stringify(claims));
    return updateMessage(res.message);
  }

  // 이름으로 인증한 경우는 나중에 확인할 수 있도록 운영진 채널에 기록을 남깁니다.
  await notifyAdmins(env, {
    content: `🧾 **${escapeMd(picked)}** 이름으로 인증되었습니다 — <@${user.id}>`,
  });

  return updateMessage(
    `✅ **${escapeMd(picked)}** 님, 인증이 완료되었습니다. 모든 채널이 열렸어요.\n` +
    `어떤 채널이 무엇을 하는 곳인지는 여기서 확인하세요 → ${GUIDE_URL}`
  );
}

/* --------------------------------------------------------- 운영진 승인 경로 */

async function requestApproval(interaction, env) {
  const user = interaction.member?.user || interaction.user;
  if (!user) return ephemeral('요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.');

  const posted = await notifyAdmins(env, {
    content: `🔔 명단에 없는 인증 요청 — <@${user.id}> (\`${escapeMd(user.username || '')}\`)`,
    components: [{
      type: 1,
      components: [{
        type: 2, style: 3, label: '인증 승인', custom_id: `${APPROVE_ID}:${user.id}`,
      }],
    }],
  });

  const msg = posted
    ? '운영진에게 확인을 요청했습니다. 승인되면 자동으로 역할이 부여됩니다.'
    : '명단에서 확인되지 않았습니다. 운영진에게 직접 문의해주세요.';

  return Response.json({
    type: interaction.type === INTERACTION.COMPONENT ? REPLY.UPDATE : REPLY.MESSAGE,
    data: { content: `🕓 ${msg}`, flags: EPHEMERAL, components: [] },
  });
}

async function handleApprove(interaction, env, targetId) {
  const perms = BigInt(interaction.member?.permissions || '0');
  if (!(perms & (PERM_ADMIN | PERM_MANAGE_ROLES))) {
    return ephemeral('이 버튼은 운영진만 누를 수 있습니다.');
  }

  const result = await assignRole(targetId, env);
  if (!result.ok) {
    const detail = result.reason === 'not_member'
      ? '해당 사용자가 서버에 없습니다.'
      : result.reason === 'forbidden'
        ? `봇 역할이 ${ROLE_NAME}보다 아래에 있어 권한이 부족합니다.`
        : `디스코드가 오류를 반환했습니다 (코드 ${result.status}).`;
    return ephemeral(`승인하지 못했습니다. ${detail}`);
  }

  const approver = interaction.member?.user;
  return Response.json({
    type: REPLY.UPDATE,
    data: {
      content: `✅ <@${targetId}> 인증 승인 완료 — 승인: <@${approver?.id}>`,
      components: [],
    },
  });
}

async function notifyAdmins(env, body) {
  if (!env.ADMIN_CHANNEL_ID) return false;
  const res = await fetch(`${DISCORD_API}/channels/${env.ADMIN_CHANNEL_ID}/messages`, {
    method: 'POST',
    headers: { ...botHeaders(env), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.ok;
}

/* ------------------------------------------------------------- 공통 응답 */

function updateMessage(content) {
  return Response.json({
    type: REPLY.UPDATE,
    data: { content, flags: EPHEMERAL, components: [] },
  });
}

async function grantRoleResult(interaction, env, user) {
  const result = await assignRole(user.id, env);
  if (result.ok) return { ok: true };
  if (result.reason === 'not_member') return { ok: false, message: '서버 멤버 정보를 찾지 못했습니다. 잠시 후 다시 시도해주세요.' };
  if (result.reason === 'forbidden') return { ok: false, message: '⚠️ 봇 권한이 부족합니다. 운영진에게 문의해주세요.' };
  return { ok: false, message: `⚠️ 역할 부여에 실패했습니다 (코드 ${result.status}).` };
}

async function grantAndReply(interaction, env, user) {
  const res = await grantRoleResult(interaction, env, user);
  if (!res.ok) return ephemeral(res.message);
  return ephemeral(
    '✅ 인증이 완료되었습니다. 모든 채널이 열렸어요.\n' +
    `어떤 채널이 무엇을 하는 곳인지는 여기서 확인하세요 → ${GUIDE_URL}`
  );
}

function escapeMd(s) {
  return String(s).replace(/([*_`~|\\])/g, '\\$1');
}

function ephemeral(content) {
  return Response.json({ type: REPLY.MESSAGE, data: { content, flags: EPHEMERAL } });
}

/* -------------------------------------------------------- 스터디 일정(구글 캘린더) */

// 인터랙션은 3초 안에 응답해야 합니다. 캘린더 호출은 그보다 오래 걸릴 수 있으므로
// 먼저 "생각 중" 상태를 반환하고, 결과가 나오면 원본 메시지를 수정합니다.
function deferReply(ctx, interaction, work, { hidden = false } = {}) {
  ctx.waitUntil(
    work()
      .then((data) => editOriginal(interaction, data))
      .catch((err) => editOriginal(interaction, { content: `⚠️ ${String(err.message || err).slice(0, 300)}` }))
  );
  return Response.json({
    type: REPLY.DEFERRED,
    data: hidden ? { flags: EPHEMERAL } : {},
  });
}

async function editOriginal(interaction, data) {
  await fetch(
    `${DISCORD_API}/webhooks/${interaction.application_id}/${interaction.token}/messages/@original`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
}

const CAL_API = 'https://www.googleapis.com/calendar/v3';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/drive.readonly',
].join(' ');
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_ROOT_ID = '1PTw0vZFG8aANdsBp7-Nf4cA7cUVNIlwT';

// 아이솔레이트 수명 동안만 유지되는 캐시. 매 요청마다 JWT 를 새로 서명하지 않기 위함입니다.
let googleKeyCache = null;
let googleTokenCache = null;

function calendarReady(env) {
  return Boolean(env.GOOGLE_SA_EMAIL && env.GOOGLE_SA_PRIVATE_KEY_B64 && env.GOOGLE_CALENDAR_ID);
}

function b64urlBytes(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64url(str) {
  return b64urlBytes(new TextEncoder().encode(str));
}

// 서비스 계정 키는 PEM 이라 줄바꿈이 들어갑니다. 시크릿에는 base64 한 줄로 넣고 여기서 풉니다.
async function googleSigningKey(env) {
  if (googleKeyCache) return googleKeyCache;
  const pem = atob(env.GOOGLE_SA_PRIVATE_KEY_B64);
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  googleKeyCache = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return googleKeyCache;
}

// 서비스 계정 JWT 로 액세스 토큰을 받아옵니다 (RFC 7523).
async function googleAccessToken(env) {
  const now = Math.floor(Date.now() / 1000);
  if (googleTokenCache && googleTokenCache.exp > now + 60) return googleTokenCache.token;

  const claim = {
    iss: env.GOOGLE_SA_EMAIL,
    scope: GOOGLE_SCOPES,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claim))}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    await googleSigningKey(env),
    new TextEncoder().encode(unsigned)
  );
  const assertion = `${unsigned}.${b64urlBytes(new Uint8Array(signature))}`;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`구글 인증에 실패했습니다 (${res.status}). 서비스 계정 키를 확인해주세요.`);
  }
  const data = await res.json();
  googleTokenCache = { token: data.access_token, exp: now + (data.expires_in || 3600) };
  return googleTokenCache.token;
}

async function calendarFetch(env, path, init = {}) {
  const token = await googleAccessToken(env);
  const res = await fetch(
    `${CAL_API}/calendars/${encodeURIComponent(env.GOOGLE_CALENDAR_ID)}${path}`,
    { ...init, headers: { authorization: 'Bearer ' + token, ...init.headers } }
  );
  if (res.status === 404) {
    throw new Error('캘린더를 찾을 수 없습니다. 서비스 계정에 캘린더가 공유되어 있는지 확인해주세요.');
  }
  if (res.status === 403) {
    throw new Error('캘린더 접근 권한이 없습니다. 공유 설정을 "변경 및 공유 관리"로 올려주세요.');
  }
  if (!res.ok) {
    throw new Error(`캘린더 요청 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

async function calendarCreate(env, { title, start, end, location, description }) {
  return calendarFetch(env, '/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      summary: title,
      location,
      description,
      start: { dateTime: start, timeZone: 'Asia/Seoul' },
      end: { dateTime: end, timeZone: 'Asia/Seoul' },
    }),
  });
}

const pad2 = (n) => String(n).padStart(2, '0');

function kstDateStr(offsetDays = 0) {
  const { y, m, d } = todayKst();
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().slice(0, 10);
}

// 훈련 시간표의 단위기간. 출석률과 훈련수당을 따지는 구간입니다.
// 캘린더 페이지(studyCalendarPage) 의 UNITS 와 같은 표입니다.
const TRAINING_UNITS = [
  { no: 1, start: '2026-08-19', end: '2026-09-18', days: 18 },
  { no: 2, start: '2026-09-19', end: '2026-10-18', days: 16 },
  { no: 3, start: '2026-10-19', end: '2026-11-18', days: 22 },
  { no: 4, start: '2026-11-19', end: '2026-12-18', days: 21 },
  { no: 5, start: '2026-12-19', end: '2027-01-18', days: 17 },
  { no: 6, start: '2027-01-19', end: '2027-02-18', days: 20 },
  { no: 7, start: '2027-02-19', end: '2027-03-17', days: 18 },
];

function unitOfDate(dateStr) {
  return TRAINING_UNITS.find((u) => dateStr >= u.start && dateStr <= u.end) || null;
}

function mapEvents(items) {
  return (items || []).map((e) => ({
    title: e.summary || '(제목 없음)',
    start: e.start?.dateTime || e.start?.date,
    end: e.end?.dateTime || e.end?.date,
    allDay: !e.start?.dateTime,
    location: e.location || '',
    link: e.htmlLink || '',
  }));
}

async function calendarRange(env, fromDate, toDate) {
  const params = new URLSearchParams({
    timeMin: `${fromDate}T00:00:00+09:00`,
    timeMax: `${toDate}T23:59:59+09:00`,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const data = await calendarFetch(env, '/events?' + params.toString());
  return mapEvents(data.items);
}

// 그날이 단위기간 안에서 몇 번째 수업인지. 수업이 있는 날만 세므로
// 휴강·공휴일·주말은 빠집니다. 종일 일정이 그 셋을 나타냅니다.
async function sessionOfDate(env, dateStr) {
  const unit = unitOfDate(dateStr);
  if (!unit) return null;
  try {
    const events = await calendarRange(env, unit.start, dateStr);
    const days = [...new Set(events.filter((e) => !e.allDay)
      .map((e) => e.start.slice(0, 10)))].sort();
    const idx = days.indexOf(dateStr);
    return { unit, seq: idx >= 0 ? idx + 1 : 0, total: unit.days, passed: days.length };
  } catch {
    return { unit, seq: 0, total: unit.days, passed: 0 };
  }
}

function unitLine(info) {
  if (!info) return '';
  const { unit, seq, total } = info;
  return seq
    ? `🎓 ${unit.no}단위기간 · ${pad2(seq)}/${pad2(total)}회차`
    : `🎓 ${unit.no}단위기간 (${unit.start} ~ ${unit.end})`;
}

async function calendarToday(env) {
  const date = kstDateStr();
  return { date, events: await calendarRange(env, date, date) };
}

function optionValue(interaction, name) {
  return interaction.data?.options?.find((o) => o.name === name)?.value;
}

/* 날짜·시각 파싱 — "2026-09-10", "9/10", "9월 10일", "22:00", "22시" 를 받습니다. */

function todayKst() {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()).split('-').map(Number);
  return { y, m, d };
}

function parseDateInput(input, fallbackYear) {
  const s = String(input).trim();
  let m;
  if ((m = s.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/))) {
    return { y: +m[1], m: +m[2], d: +m[3] };
  }
  if ((m = s.match(/^(\d{1,2})\s*[-./월]\s*(\d{1,2})/))) {
    return { y: fallbackYear, m: +m[1], d: +m[2] };
  }
  return null;
}

function parseTimeInput(input) {
  const s = String(input).trim();
  let m;
  if ((m = s.match(/^(\d{1,2})\s*[:시]\s*(\d{1,2})?/))) {
    return { h: +m[1], min: +(m[2] || 0) };
  }
  if ((m = s.match(/^(\d{1,2})$/))) return { h: +m[1], min: 0 };
  return null;
}

// JS Date 는 2월 30일 같은 값을 3월 2일로 조용히 보정하므로 직접 검증합니다.
function validDate(date) {
  if (date.m < 1 || date.m > 12 || date.d < 1 || date.d > 31) return false;
  const dt = new Date(Date.UTC(date.y, date.m - 1, date.d));
  return dt.getUTCFullYear() === date.y
    && dt.getUTCMonth() === date.m - 1
    && dt.getUTCDate() === date.d;
}

function validTime(time) {
  return time.h >= 0 && time.h <= 23 && time.min >= 0 && time.min <= 59;
}

function toKstIso(date, time) {
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  return `${pad(date.y, 4)}-${pad(date.m)}-${pad(date.d)}T${pad(time.h)}:${pad(time.min)}:00${KST}`;
}

function plusHours(iso, hours) {
  return new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();
}

function fmtKst(iso, withDate = true) {
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    ...(withDate ? { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' } : {}),
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

async function scheduleCreate(interaction, env, ctx) {
  if (!calendarReady(env)) {
    return ephemeral('구글 캘린더 연동이 아직 설정되지 않았습니다. 운영진에게 문의해주세요.');
  }

  const title = optionValue(interaction, '제목');
  const hours = Number(optionValue(interaction, '진행시간') ?? 2);
  const place = optionValue(interaction, '장소') || '';
  const region = optionValue(interaction, '지역') || '';
  const topic = optionValue(interaction, '주제') || '';
  const online = Boolean(optionValue(interaction, '온라인'));

  const date = parseDateInput(optionValue(interaction, '날짜'), todayKst().y);
  if (!date) return ephemeral('날짜를 이해하지 못했습니다. `2026-09-10`, `9/10`, `9월 10일` 형식으로 입력해주세요.');
  if (!validDate(date)) return ephemeral(`${date.m}월 ${date.d}일은 존재하지 않는 날짜입니다. 다시 확인해주세요.`);

  const time = parseTimeInput(optionValue(interaction, '시작시각'));
  if (!time) return ephemeral('시각을 이해하지 못했습니다. `22:00` 또는 `22시` 형식으로 입력해주세요.');
  if (!validTime(time)) return ephemeral('시각은 0시~23시, 0분~59분 범위여야 합니다.');

  if (!(hours > 0 && hours <= 24)) return ephemeral('진행 시간은 0보다 크고 24 이하여야 합니다.');

  const start = toKstIso(date, time);
  const end = plusHours(start, hours);

  const tags = [region && `#${region}`, topic && `#${topic}`, online ? '#온라인' : '#오프라인'].filter(Boolean);
  const user = interaction.member?.user || interaction.user;
  const who = user?.global_name || user?.username || '알 수 없음';
  const where = online ? (place ? `온라인 (${place})` : '온라인') : (place || '미정');

  return deferReply(ctx, interaction, async () => {
    const result = await calendarCreate(env, {
      title,
      start,
      end,
      location: where,
      description: [`등록자: ${who}`, tags.join(' ')].filter(Boolean).join('\n'),
    });

    return {
      embeds: [{
        title: '📅 스터디 일정이 등록되었습니다',
        color: 0x5865f2,
        fields: [
          { name: '제목', value: title },
          { name: '일시', value: `${fmtKst(start)} 시작 · ${hours}시간`, inline: true },
          { name: '장소', value: where, inline: true },
          ...(tags.length ? [{ name: '태그', value: tags.join(' ') }] : []),
        ],
        footer: { text: `등록: ${who}` },
      }],
      ...(result.htmlLink ? { components: [{ type: 1, components: [
        { type: 2, style: 5, label: '구글 캘린더에서 보기', url: result.htmlLink },
      ] }] } : {}),
    };
  });
}

async function scheduleToday(interaction, env, ctx) {
  if (!calendarReady(env)) {
    return ephemeral('구글 캘린더 연동이 아직 설정되지 않았습니다. 운영진에게 문의해주세요.');
  }

  return deferReply(ctx, interaction, async () => {
    const result = await calendarToday(env);
    const info = await sessionOfDate(env, result.date);
    const head = unitLine(info);

    if (!result.events?.length) {
      return {
        content: `📭 오늘(${result.date}) 등록된 일정이 없습니다.`
          + (head ? `\n${head}` : ''),
      };
    }

    return {
      embeds: [{
        title: `📅 오늘의 일정 — ${result.date} (${weekdayKo(result.date)})`,
        color: 0x5865f2,
        description: [head, `전체 보기 → ${SITE_CALENDAR}`].filter(Boolean).join('\n'),
        fields: result.events.slice(0, 25).map((e) => ({
          name: cleanTitle(e.title),
          value: [
            e.allDay ? '종일' : `${fmtKst(e.start, false)} – ${fmtKst(e.end, false)}`,
            e.location ? `📍 ${e.location}` : '',
          ].filter(Boolean).join('\n'),
        })),
        footer: result.events.length > 25 ? { text: `외 ${result.events.length - 25}건` } : undefined,
      }],
    };
  }, { hidden: true });
}

const SITE_CALENDAR = 'https://ktci5.kr/study/calendar';

// 훈련 일정은 제목이 전부 "[KT] " 로 시작합니다. 목록에서는 군더더기라 뗍니다.
function cleanTitle(title) {
  return (title || '(제목 없음)').replace(/^\[KT[^\]]*\]\s*/, '') || '(제목 없음)';
}

function weekdayKo(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return ['일', '월', '화', '수', '목', '금', '토'][new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

// 이번 주 월요일. 일요일이면 그 주의 시작은 엿새 전입니다.
function weekStartKst(offsetWeeks = 0) {
  const today = kstDateStr();
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return kstDateStr(-((dow + 6) % 7) + offsetWeeks * 7);
}

async function scheduleWeek(interaction, env, ctx) {
  if (!calendarReady(env)) {
    return ephemeral('구글 캘린더 연동이 아직 설정되지 않았습니다. 운영진에게 문의해주세요.');
  }

  const opts = interaction.data?.options || [];
  const shift = Number(opts.find((o) => o.name === '주')?.value || 0);

  return deferReply(ctx, interaction, async () => {
    const from = weekStartKst(shift);
    const [fy, fm, fd] = from.split('-').map(Number);
    const to = new Date(Date.UTC(fy, fm - 1, fd + 6)).toISOString().slice(0, 10);

    const events = await calendarRange(env, from, to);
    const today = kstDateStr();

    // 여러 날에 걸친 종일 일정은 걸치는 날마다 보이게 폅니다.
    const byDay = new Map();
    for (let i = 0; i < 7; i++) {
      byDay.set(new Date(Date.UTC(fy, fm - 1, fd + i)).toISOString().slice(0, 10), []);
    }
    for (const e of events) {
      const s = e.start.slice(0, 10);
      let last = s;
      if (e.allDay && e.end) {
        const [ey, em, ed] = e.end.slice(0, 10).split('-').map(Number);
        last = new Date(Date.UTC(ey, em - 1, ed - 1)).toISOString().slice(0, 10);
      }
      for (const [day, list] of byDay) {
        if (day >= s && day <= last) list.push(e);
      }
    }

    const info = await sessionOfDate(env, today);
    const fields = [];
    for (const [day, list] of byDay) {
      const mark = day === today ? ' ◀ 오늘' : '';
      const label = `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))} (${weekdayKo(day)})${mark}`;
      const body = list.length
        ? list.slice(0, 6).map((e) => {
            const when = e.allDay ? '종일' : fmtKst(e.start, false);
            return `\`${when}\` ${cleanTitle(e.title)}`;
          }).join('\n') + (list.length > 6 ? `\n…외 ${list.length - 6}건` : '')
        : '—';
      fields.push({ name: label, value: body.slice(0, 1024), inline: false });
    }

    const when = shift === 0 ? '이번 주' : shift < 0 ? `${-shift}주 전` : `${shift}주 뒤`;
    return {
      embeds: [{
        title: `🗓️ ${when} 일정 — ${from} ~ ${to}`,
        color: 0x5865f2,
        description: [
          shift === 0 && info ? unitLine(info) : '',
          `전체 보기 → ${SITE_CALENDAR}`,
        ].filter(Boolean).join('\n'),
        fields,
        footer: { text: '휴강·공휴일은 종일로 표시됩니다 · /주간일정 주:1 로 다음 주를 봅니다' },
      }],
    };
  }, { hidden: true });
}

/* ------------------------------------------------------- 채널별 드라이브 폴더 */

// 폴더 이름은 자주 바뀌지 않으므로 아이솔레이트 수명 동안 캐시합니다.
const driveFolderCache = new Map();

async function driveFolderForChannel(env, channelName) {
  if (!channelName) return null;
  if (driveFolderCache.has(channelName)) return driveFolderCache.get(channelName);

  const token = await googleAccessToken(env);
  const params = new URLSearchParams({
    q: `name = '${channelName.replace(/'/g, "\\'")}' `
      + `and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: 'files(id,name)',
    pageSize: '5',
  });
  const res = await fetch(`${DRIVE_API}/files?${params}`, {
    headers: { authorization: 'Bearer ' + token },
  });
  if (!res.ok) return null;

  const data = await res.json();
  const id = data.files?.[0]?.id || null;
  driveFolderCache.set(channelName, id);
  return id;
}

function driveLink(id) {
  return `https://drive.google.com/drive/folders/${id}`;
}

async function showDriveFolder(interaction, env, ctx) {
  if (!calendarReady(env)) {
    return ephemeral('드라이브 연동이 아직 설정되지 않았습니다. 운영진에게 문의해주세요.');
  }

  const channelName = interaction.channel?.name;

  return deferReply(ctx, interaction, async () => {
    const id = await driveFolderForChannel(env, channelName);

    if (!id) {
      return {
        content:
          `이 채널에 연결된 폴더가 없습니다.\n전체 자료실 → ${driveLink(DRIVE_ROOT_ID)}`,
      };
    }

    return {
      embeds: [{
        title: `📂 #${channelName} 자료함`,
        color: 0x5865f2,
        description: '이 채널에서 나눈 자료를 모아두는 폴더입니다.\n파일은 드라이브에서 직접 올려주세요.',
        fields: [{ name: '전체 자료실', value: driveLink(DRIVE_ROOT_ID) }],
      }],
      components: [{
        type: 1,
        components: [{ type: 2, style: 5, label: '이 채널 폴더 열기', url: driveLink(id) }],
      }],
    };
  }, { hidden: true });
}

/* ------------------------------------------------------------ 깃허브 자료실 */

const STUDY_REPO = 'ktci5/study';
const STUDY_REPO_URL = `https://github.com/${STUDY_REPO}`;
const GH_API = 'https://api.github.com';
const GH_CACHE_TTL = 600; // 초. 인증 없는 깃허브 API 는 시간당 호출 수가 제한됩니다.

// 경로의 각 구간만 인코딩합니다. 한글 폴더명이 있어 필요합니다.
function encodeRepoPath(path) {
  return String(path || '')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

async function githubContents(env, path = '') {
  const key = `gh:${path}`;
  if (env.ROSTER) {
    const cached = await env.ROSTER.get(key, 'json');
    if (cached) return cached;
  }

  const res = await fetch(`${GH_API}/repos/${STUDY_REPO}/contents/${encodeRepoPath(path)}`, {
    headers: { 'user-agent': 'ktci5.kr', accept: 'application/vnd.github+json' },
  });

  if (res.status === 404) throw new Error('그런 폴더가 없습니다. 경로를 다시 확인해주세요.');
  if (res.status === 403) throw new Error('깃허브 호출 한도에 걸렸습니다. 잠시 후 다시 시도해주세요.');
  if (!res.ok) throw new Error(`깃허브 요청 실패 (${res.status})`);

  const data = await res.json();
  if (!Array.isArray(data)) throw new Error('폴더가 아니라 파일입니다. 상위 경로를 지정해주세요.');

  const items = data
    .filter((f) => !f.name.startsWith('.'))
    .map((f) => ({
      name: f.name,
      type: f.type,
      size: f.size,
      path: f.path,
      url: f.html_url,
      raw: f.download_url,
    }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, 'ko') : a.type === 'dir' ? -1 : 1));

  if (env.ROSTER) {
    await env.ROSTER.put(key, JSON.stringify(items), { expirationTtl: GH_CACHE_TTL });
  }
  return items;
}

function repoIcon(f) {
  if (f.type === 'dir') return '📁';
  const n = f.name.toLowerCase();
  if (n.endsWith('.md')) return '📝';
  if (n.endsWith('.html')) return '🌐';
  if (n.endsWith('.docx') || n.endsWith('.doc')) return '📘';
  if (n.endsWith('.pdf')) return '📕';
  if (/\.(png|jpe?g|gif|webp|svg)$/.test(n)) return '🖼️';
  return '📄';
}

function repoSize(f) {
  if (f.type === 'dir' || !f.size) return '';
  const kb = f.size / 1024;
  return kb >= 1024 ? ` · ${(kb / 1024).toFixed(1)}MB` : ` · ${Math.max(1, Math.round(kb))}KB`;
}

async function showStudyRepo(interaction, env, ctx) {
  const path = (optionValue(interaction, '폴더') || '').replace(/^\/+|\/+$/g, '');

  return deferReply(ctx, interaction, async () => {
    const items = await githubContents(env, path);
    const here = path || '저장소 루트';

    if (!items.length) {
      return { content: `📭 **${escapeMd(here)}** 는 비어 있습니다.` };
    }

    const lines = items.slice(0, 25).map((f) => {
      const label = `${repoIcon(f)} [${escapeMd(f.name)}](${f.url})${repoSize(f)}`;
      return f.type === 'dir' ? `${label}　\`/스터디자료 폴더:${f.path}\`` : label;
    }).join('\n');

    const browseUrl = path
      ? `${STUDY_REPO_URL}/tree/main/${encodeRepoPath(path)}`
      : STUDY_REPO_URL;

    return {
      embeds: [{
        title: `📦 ${STUDY_REPO} — ${here}`,
        color: 0x5865f2,
        description: lines.slice(0, 4000),
        footer: {
          text: items.length > 25
            ? `외 ${items.length - 25}개 · 폴더는 옆의 명령으로 열어보세요`
            : '폴더는 옆에 적힌 명령으로 열어보세요',
        },
      }],
      components: [{
        type: 1,
        components: [{ type: 2, style: 5, label: '깃허브에서 보기', url: browseUrl }],
      }],
    };
  }, { hidden: true });
}

/* ----------------------------------------------------------- 드라이브 조회 */

// 드라이브 q 파라미터는 작은따옴표로 값을 감싸므로 이스케이프가 필요합니다.
function escapeDriveQuery(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function driveFetch(env, path) {
  const token = await googleAccessToken(env);
  const res = await fetch(`${DRIVE_API}${path}`, { headers: { authorization: 'Bearer ' + token } });
  if (!res.ok) {
    throw new Error(`드라이브 요청 실패 (${res.status}). 잠시 후 다시 시도해주세요.`);
  }
  return res.json();
}

const FILE_FIELDS = 'id,name,mimeType,size,modifiedTime,webViewLink,description,owners(displayName)';

async function driveListFiles(env, folderId, limit = 15) {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: `files(${FILE_FIELDS})`,
    orderBy: 'folder,modifiedTime desc',
    pageSize: String(limit),
  });
  const data = await driveFetch(env, `/files?${params}`);
  return data.files || [];
}

async function driveSearchFiles(env, term, folderId, limit = 15) {
  const clauses = [`fullText contains '${escapeDriveQuery(term)}'`, 'trashed = false'];
  if (folderId) clauses.push(`'${folderId}' in parents`);
  const params = new URLSearchParams({
    q: clauses.join(' and '),
    fields: `files(${FILE_FIELDS})`,
    orderBy: 'modifiedTime desc',
    pageSize: String(limit),
  });
  const data = await driveFetch(env, `/files?${params}`);
  return data.files || [];
}

function fileIcon(f) {
  if (f.mimeType === 'application/vnd.google-apps.folder') return '📁';
  if (f.mimeType?.startsWith('image/')) return '🖼️';
  if (f.mimeType?.includes('pdf')) return '📕';
  if (f.mimeType?.includes('spreadsheet')) return '📊';
  if (f.mimeType?.includes('presentation')) return '📽️';
  if (f.mimeType?.includes('document')) return '📝';
  return '📄';
}

function fileSize(f) {
  if (!f.size) return '';
  const mb = Number(f.size) / 1024 / 1024;
  return mb >= 1 ? ` · ${mb.toFixed(1)}MB` : ` · ${Math.max(1, Math.round(Number(f.size) / 1024))}KB`;
}

// 파일 이름이나 설명에 적힌 #태그를 뽑아냅니다.
function fileTags(f) {
  const found = `${f.name || ''} ${f.description || ''}`.match(/#[^\s#]+/g) || [];
  return [...new Set(found)].slice(0, 5);
}

function fileLines(files) {
  return files.map((f) => {
    const tags = fileTags(f);
    const when = new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul', month: '2-digit', day: '2-digit',
    }).format(new Date(f.modifiedTime));
    const name = f.webViewLink ? `[${escapeMd(f.name)}](${f.webViewLink})` : escapeMd(f.name);
    return `${fileIcon(f)} ${name}\n　${when}${fileSize(f)}` +
      (f.owners?.[0]?.displayName ? ` · ${escapeMd(f.owners[0].displayName)}` : '') +
      (tags.length ? `\n　${tags.map((t) => `\`${t}\``).join(' ')}` : '');
  }).join('\n');
}

async function showDriveFiles(interaction, env, ctx) {
  if (!calendarReady(env)) return ephemeral('드라이브 연동이 아직 설정되지 않았습니다.');
  const channelName = interaction.channel?.name;

  return deferReply(ctx, interaction, async () => {
    const id = await driveFolderForChannel(env, channelName);
    if (!id) {
      return { content: `이 채널에 연결된 폴더가 없습니다.\n전체 자료실 → ${driveLink(DRIVE_ROOT_ID)}` };
    }
    const files = await driveListFiles(env, id);
    if (!files.length) {
      return {
        content: `📭 **#${channelName}** 폴더가 아직 비어 있습니다.\n${driveLink(id)} 에서 파일을 올려주세요.`,
      };
    }
    return {
      embeds: [{
        title: `📂 #${channelName} 자료 ${files.length}건`,
        color: 0x5865f2,
        description: fileLines(files).slice(0, 4000),
        footer: { text: '최근 수정순 · 파일 이름이나 설명에 #태그를 넣으면 검색이 쉬워집니다' },
      }],
      components: [{ type: 1, components: [{ type: 2, style: 5, label: '폴더 열기', url: driveLink(id) }] }],
    };
  }, { hidden: true });
}

async function searchDriveFiles(interaction, env, ctx) {
  if (!calendarReady(env)) return ephemeral('드라이브 연동이 아직 설정되지 않았습니다.');

  const term = optionValue(interaction, '검색어');
  const thisChannelOnly = Boolean(optionValue(interaction, '이채널만'));
  const channelName = interaction.channel?.name;

  if (!term || String(term).trim().length < 2) {
    return ephemeral('검색어는 두 글자 이상 입력해주세요.');
  }

  return deferReply(ctx, interaction, async () => {
    const folderId = thisChannelOnly ? await driveFolderForChannel(env, channelName) : null;
    if (thisChannelOnly && !folderId) {
      return { content: '이 채널에 연결된 폴더가 없어 범위를 좁힐 수 없습니다.' };
    }

    const files = await driveSearchFiles(env, term, folderId);
    const scope = thisChannelOnly ? `#${channelName}` : '전체 자료실';

    if (!files.length) {
      return {
        content: `🔍 **${escapeMd(term)}** — ${scope}에서 찾지 못했습니다.\n` +
          '파일 이름, 설명, 문서 내용까지 함께 찾습니다. 다른 단어로 시도해보세요.',
      };
    }

    return {
      embeds: [{
        title: `🔍 "${term}" — ${files.length}건`,
        color: 0x5865f2,
        description: fileLines(files).slice(0, 4000),
        footer: { text: `${scope} · 이름·설명·문서 내용에서 찾았습니다` },
      }],
    };
  }, { hidden: true });
}

/* --------------------------------------------------- 드라이브 변경 알림 (크론) */

async function driveStartToken(env) {
  const data = await driveFetch(env, '/changes/startPageToken');
  return data.startPageToken;
}

async function pollDriveChanges(env) {
  if (!calendarReady(env) || !env.ROSTER || !env.DRIVE_NOTIFY_CHANNEL_ID) return;

  let token = await env.ROSTER.get('drive:pageToken');
  if (!token) {
    // 처음 실행이면 지금 시점부터 감시합니다. 과거 변경은 알리지 않습니다.
    await env.ROSTER.put('drive:pageToken', await driveStartToken(env));
    return;
  }

  const added = [];
  const removed = [];

  for (let page = 0; page < 5 && token; page++) {
    const params = new URLSearchParams({
      pageToken: token,
      fields: 'nextPageToken,newStartPageToken,changes(removed,fileId,file(id,name,mimeType,trashed,webViewLink,owners(displayName)))',
      includeRemoved: 'true',
      pageSize: '100',
    });
    const data = await driveFetch(env, `/changes?${params}`);

    for (const c of data.changes || []) {
      const f = c.file;
      if (!f || f.mimeType === 'application/vnd.google-apps.folder') continue;
      (c.removed || f.trashed ? removed : added).push(f);
    }

    if (data.nextPageToken) {
      token = data.nextPageToken;
    } else {
      await env.ROSTER.put('drive:pageToken', data.newStartPageToken || token);
      token = null;
    }
  }

  if (!added.length && !removed.length) return;

  const fields = [];
  if (added.length) {
    fields.push({
      name: `📥 올라오거나 수정됨 (${added.length})`,
      value: added.slice(0, 10).map((f) =>
        `${fileIcon(f)} ${f.webViewLink ? `[${escapeMd(f.name)}](${f.webViewLink})` : escapeMd(f.name)}`
      ).join('\n').slice(0, 1000),
    });
  }
  if (removed.length) {
    fields.push({
      name: `🗑 휴지통으로 이동 (${removed.length})`,
      value: removed.slice(0, 10).map((f) => `${fileIcon(f)} ${escapeMd(f.name)}`).join('\n').slice(0, 1000),
    });
  }

  await fetch(`${DISCORD_API}/channels/${env.DRIVE_NOTIFY_CHANNEL_ID}/messages`, {
    method: 'POST',
    headers: { ...botHeaders(env), 'content-type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: '📂 자료실 변경 알림',
        color: removed.length ? 0xe67e22 : 0x5865f2,
        fields,
        footer: { text: removed.length ? '휴지통 항목은 30일 안에 복구할 수 있습니다' : '자료실이 갱신되었습니다' },
      }],
    }),
  });
}

/* ------------------------------------------------------------------ 역할 부여 */

function botHeaders(env) {
  return {
    authorization: 'Bot ' + env.DISCORD_BOT_TOKEN,
    'user-agent': USER_AGENT,
    // 헤더 값은 ByteString 이라 비ASCII 는 반드시 인코딩해야 합니다 (한글 그대로 넣으면 TypeError)
    'x-audit-log-reason': encodeURIComponent('ktci5.kr 자동 인증'),
  };
}

async function assignRole(userId, env) {
  const res = await fetch(
    `${DISCORD_API}/guilds/${env.DISCORD_GUILD_ID}/members/${userId}/roles/${env.DISCORD_ROLE_ID}`,
    { method: 'PUT', headers: botHeaders(env) }
  );

  if (res.status === 204) return { ok: true };
  if (res.status === 404) return { ok: false, reason: 'not_member', status: 404 };
  if (res.status === 403) return { ok: false, reason: 'forbidden', status: 403 };
  return { ok: false, reason: 'error', status: res.status };
}

async function grantRole(me, token, env) {
  const first = await assignRole(me.id, env);
  if (first.ok) return { ok: true, joined: false };

  // 서버 미참여자: AUTO_JOIN 이 켜져 있으면 guilds.join 으로 참여시키면서 역할까지 부여
  if (first.reason === 'not_member') {
    if (!autoJoinEnabled(env)) {
      return { ok: false, message: '먼저 스터디 서버에 참여한 뒤 다시 시도해주세요. (서버 미참여)' };
    }
    const joinRes = await fetch(`${DISCORD_API}/guilds/${env.DISCORD_GUILD_ID}/members/${me.id}`, {
      method: 'PUT',
      headers: { ...botHeaders(env), 'content-type': 'application/json' },
      body: JSON.stringify({ access_token: token.access_token, roles: [env.DISCORD_ROLE_ID] }),
    });
    if (joinRes.status === 201) return { ok: true, joined: true };
    if (joinRes.status === 204) {
      // 이미 멤버였던 경우 — 역할만 다시 부여
      const retry = await assignRole(me.id, env);
      if (retry.ok) return { ok: true, joined: false };
    }
    return { ok: false, message: `서버 참여 처리에 실패했습니다 (코드 ${joinRes.status}). 운영진에게 문의해주세요.` };
  }

  if (first.reason === 'forbidden') {
    return {
      ok: false,
      message: `봇 권한이 부족합니다. 봇 역할이 ${ROLE_NAME}보다 위에 있는지 운영진에게 확인 요청해주세요.`,
      status: 500,
    };
  }

  return { ok: false, message: `역할 부여에 실패했습니다 (코드 ${first.status}). 운영진에게 문의해주세요.` };
}

/* -------------------------------------------------------------- OAuth2 공통 */

function checkCallback(request, url, cookieName) {
  if (url.searchParams.get('error')) {
    return { error: '디스코드 인증이 취소되었습니다. 다시 시도해주세요.' };
  }
  const code = url.searchParams.get('code');
  if (!code) {
    return { error: '잘못된 접근입니다 (인증 코드 없음).' };
  }
  const state = url.searchParams.get('state');
  const cookieState = readCookie(request.headers.get('cookie'), cookieName);
  if (!state || !cookieState || state !== cookieState) {
    return { error: '인증 요청이 만료되었거나 유효하지 않습니다. 처음부터 다시 시도해주세요.' };
  }
  return { code };
}

async function exchangeCode(code, env, redirectUri) {
  const res = await fetch(DISCORD_API + '/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  });
  return res.ok ? res.json() : null;
}

async function fetchMe(accessToken) {
  const res = await fetch(DISCORD_API + '/users/@me', {
    headers: { authorization: 'Bearer ' + accessToken },
  });
  return res.ok ? res.json() : null;
}

function stateCookie(name, value) {
  return `${name}=${value}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`;
}

function readCookie(header, name) {
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

/* ------------------------------------------------------------------ 설정 */

function oauthScope(env) {
  return autoJoinEnabled(env) ? 'identify guilds.join' : 'identify';
}

function autoJoinEnabled(env) {
  return String(env.AUTO_JOIN || '').toLowerCase() === 'true';
}

function missingConfig(env, keys) {
  return keys.filter((k) => !env[k]);
}

function inviteUrl(env) {
  return env.DISCORD_INVITE_URL || '/';
}

function botRedirectUri(env) {
  return env.BOT_REDIRECT_URI || 'https://ktci5.kr/discord/bot/callback';
}

// 코드 승인 방식으로 초대합니다. 앱의 "Requires OAuth2 Code Grant" 설정이
// 켜져 있든 꺼져 있든 동작하므로, 이쪽으로 통일해 둡니다.
function botInviteUrl(env) {
  if (!env.DISCORD_CLIENT_ID) return '/';
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    scope: 'bot applications.commands',
    permissions: BOT_PERMISSIONS,
    integration_type: '0', // 0 = 서버 설치(Guild Install)
    response_type: 'code',
    redirect_uri: botRedirectUri(env),
  });
  return 'https://discord.com/oauth2/authorize?' + params.toString();
}

// 봇 초대(코드 승인)의 콜백. 코드를 교환해야 봇이 실제로 서버에 추가됩니다.
async function handleBotCallback(url, env) {
  if (url.searchParams.get('error')) {
    return errorPage('봇 초대가 취소되었습니다.');
  }
  const code = url.searchParams.get('code');
  if (!code) {
    return errorPage('잘못된 접근입니다 (인증 코드 없음).');
  }

  const res = await fetch(DISCORD_API + '/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: botRedirectUri(env),
    }),
  });
  if (!res.ok) {
    return errorPage(`봇 초대 처리에 실패했습니다 (코드 ${res.status}). 운영진에게 문의해주세요.`, 502);
  }

  const data = await res.json();
  const guildName = data.guild?.name ? escapeHtml(data.guild.name) : '서버';

  return html(renderPage({
    title: '봇 초대 완료',
    heading: '🤖 봇이 서버에 추가되었습니다',
    body:
      `<p><strong>${guildName}</strong>에 봇을 추가했습니다.</p>` +
      '<p class="hint">마지막으로 <strong>서버 설정 → 역할</strong>에서 봇 역할을 ' +
      `<strong>${ROLE_NAME}</strong> 역할보다 위로 옮겨주세요. 디스코드는 봇이 자기보다 ` +
      '아래 있는 역할만 부여할 수 있습니다.</p>',
  }));
}

function statusJson(env) {
  const required = [
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_BOT_TOKEN',
    'DISCORD_GUILD_ID',
    'DISCORD_ROLE_ID',
    'REDIRECT_URI',
  ];
  const missing = missingConfig(env, required);

  return Response.json({
    service: 'ktci5-discord',
    ok: missing.length === 0,
    configured: required.filter((k) => !missing.includes(k)),
    missing,
    autoJoin: autoJoinEnabled(env),
    scope: oauthScope(env),
    interactions: Boolean(env.DISCORD_PUBLIC_KEY),
    calendar: calendarReady(env),
    roster: Boolean(env.ROSTER),
    adminChannel: Boolean(env.ADMIN_CHANNEL_ID),
    endpoints: {
      interactions: 'https://ktci5.kr/discord/interactions',
      linkedRole: 'https://ktci5.kr/discord/linked-role',
      terms: 'https://ktci5.kr/terms',
      privacy: 'https://ktci5.kr/privacy',
    },
  }, {
    status: missing.length === 0 ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  });
}

/* ------------------------------------------------------------------ 화면 */

function redirect(location, extraHeaders = {}) {
  return new Response(null, {
    status: 302,
    headers: { location, 'cache-control': 'no-store', ...extraHeaders },
  });
}

function html(markup, status = 200, extraHeaders = {}) {
  return new Response(markup, {
    status,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'no-store',
      ...extraHeaders,
    },
  });
}

// 스터디를 어디서 어떻게 하는지 보여주는 입구입니다.
// 대화는 디스코드, 정리는 깃허브, 파일은 드라이브 — 셋이 이어져 돌아갑니다.
function hubPage(env) {
  const body =
    '<p>세 곳을 나눠 씁니다. 각자 잘하는 일이 다르고, 서로 이어져 있습니다.</p>' +

    '<div class="pillar">' +
      '<div class="p-ico">💬</div>' +
      '<div class="p-b"><div class="p-t">디스코드 — 묻고 답합니다</div>' +
      '<p>막힌 곳을 그때그때 물어보는 곳입니다. 분야별·지역별로 채널이 나뉘어 있고, ' +
      '음성 채널에서 화면을 공유하며 같이 볼 수도 있습니다.</p></div></div>' +

    '<div class="pillar">' +
      '<div class="p-ico">📦</div>' +
      '<div class="p-b"><div class="p-t">깃허브 — 정리해서 남깁니다</div>' +
      '<p>대화는 흘러가지만 문서는 남습니다. 정리한 내용을 올려두면 다음 기수도 봅니다. ' +
      '디스코드에서 <code>/스터디자료</code> 로 바로 열어볼 수 있습니다.</p></div></div>' +

    '<div class="pillar">' +
      '<div class="p-ico">📂</div>' +
      '<div class="p-b"><div class="p-t">구글 드라이브 — 파일을 주고받습니다</div>' +
      '<p>강의 자료, 실습 파일, 정리 노트를 둡니다. <strong>채널마다 같은 이름의 폴더</strong>가 하나씩 있어, ' +
      '채널에서 <code>/자료함</code> 을 치면 그 폴더가 열립니다.</p></div></div>' +

    '<div class="loop">' +
      '<span>디스코드에서 묻고</span><i>→</i><span>드라이브에 파일 두고</span><i>→</i><span>깃허브에 정리해 남기고</span>' +
    '</div>' +

    '<p class="hint">인증을 마치면 세 곳이 모두 열립니다.</p>' +
    '<a class="btn" href="/discord/join">스터디 서버 참여하기</a>' +
    '<a class="btn btn-ghost" href="/discord/verify">이미 들어와 있어요 · 인증하기</a>' +
    '<p class="foot2"><a href="https://github.com/ktci5" target="_blank" rel="noopener">github.com/ktci5</a> · ' +
    '자료실 링크는 서버의 <strong>#📚-자료공유</strong> 채널에 있습니다</p>';

  return html(renderPage({
    title: 'KT클라우드 5기 스터디',
    heading: '🧭 스터디 공간 안내',
    body,
  }));
}

// 인증을 마친 사람에게 보여줄 곳들. 랜딩과 완료 화면이 함께 씁니다.
const MEMBER_LINKS = [
  ['/study', '📖 스터디 Hub 바로가기', '과목별 강의 정리, 최근 업데이트 소식, 활용법'],
  ['/study/calendar', '🗓️ 스터디 캘린더', '132일 훈련 일정 및 구글 캘린더 연동'],
  ['/guide', '📚 채널 사용 안내', '디스코드 채널 가이드 및 드라이브 연동'],
];

function memberLinks(env, primary = 0) {
  const zepBtn = '<a class="btn" href="https://zep.us/@ktcloudinfra05" target="_blank" rel="noopener" style="background:linear-gradient(135deg,#059669 0%,#10b981 100%);color:#fff;font-weight:700;">🏫 ZEP 강의실 입장 바로가기</a>';
  const qrBtn = '<a class="btn" href="https://discord.com/channels/1536983492301160448/1537623379476222012" target="_blank" rel="noopener" style="background:linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%);color:#fff;font-weight:700;">📱 QR 출석하기</a>';
  return zepBtn + qrBtn +
    MEMBER_LINKS.map(([href, label], i) =>
      `<a class="btn${i === primary ? '' : ' btn-ghost'}" href="${href}">${label}</a>`
    ).join('') +
    (env.DISCORD_INVITE_URL
      ? `<a class="btn btn-ghost" href="${escapeHtml(env.DISCORD_INVITE_URL)}">💬 디스코드로 이동</a>`
      : '');
}

// 인증한 사람에게는 인증 버튼 대신 갈 곳을 보여줍니다.
async function landingPage(env, request) {
  if (request && (await verifyPass(request, env))) {
    return html(renderPage({
      title: 'KT클라우드 5기 스터디',
      heading: '🎫 KT클라우드 인프라교육 5기',
      body:
        '<p>인증이 되어 있습니다. 바로 이용하실 수 있어요.</p>' +
        memberLinks(env) +
        '<p class="hint">스터디 자료는 과정 내용을 정리한 것으로, ' +
        '인증한 수강생만 볼 수 있습니다.</p>',
    }));
  }
  return unverifiedLanding(env);
}

function unverifiedLanding(env) {
  return html(renderPage({
    title: 'KT클라우드 5기 스터디',
    heading: '🎫 KT클라우드 인프라교육 5기',
    body:
      '<p>KT Cloud 5기 스터디 종합 포털입니다.<br>' +
      '강의 정리와 최근 소식, 스터디 활용법은 스터디 Hub에서 바로 확인하실 수 있습니다.</p>' +
      '<a class="btn" href="/study">📖 스터디 Hub 바로가기</a>' +
      '<a class="btn btn-ghost" href="/discord/verify">디스코드로 5기 인증하기</a>' +
      '<a class="btn btn-ghost" href="/discord/join">스터디 서버 참여하기</a>' +
      `<p class="hint">디스코드 인증을 마치면 <strong>${ROLE_NAME}</strong> 역할이 부여되어<br>` +
      '전용 채널과 실시간 캘린더를 모두 이용하실 수 있습니다.</p>',
  }));
}

function successPage(me, joined, env, extraHeaders = {}) {
  const name = escapeHtml(me.global_name || me.username);
  const extra = joined
    ? '스터디 서버 참여와 인증이 한 번에 처리되었어요.'
    : '이제 디스코드로 돌아가면 모든 채널이 열려있을 거예요.';

  return html(renderPage({
    title: '인증 완료',
    heading: '✅ 인증이 완료되었습니다!',
    body:
      `<p><strong>${name}</strong>님, 환영합니다.<br>${ROLE_NAME} 역할이 부여되었어요.<br>${extra}</p>` +
      memberLinks(env) +
      '<p class="hint">이 주소는 다음에 다시 오셔도 바로 열립니다.</p>',
  }), 200, extraHeaders);
}

function errorPage(message, status = 400) {
  return html(renderPage({
    title: '인증 실패',
    heading: '⚠️ 인증에 실패했습니다',
    body: `<p>${escapeHtml(message)}</p><a class="btn" href="/">다시 시도하기</a>`,
  }), status);
}

/* ------------------------------------------------------ 채널 안내 페이지 내용 */

// 디스코드를 처음 쓰는 사람을 기준으로 씁니다. 서버 구조가 바뀌면 여기만 고칩니다.

const DISCORD_BASICS = [
  ['채널 찾기',
   '왼쪽 목록이 채널입니다. <strong>📁 03. 분야별 스터디</strong> 같은 회색 글씨는 카테고리(폴더)이고, ' +
   '클릭하면 접히고 펼쳐집니다. 채널 이름을 누르면 그 방으로 들어갑니다.'],
  ['메시지 보내기',
   '화면 아래 입력창에 쓰고 <strong>Enter</strong>. 줄을 바꾸려면 <strong>Shift + Enter</strong> 입니다. ' +
   '그냥 Enter 를 누르면 쓰던 도중에 보내지므로 긴 글은 Shift + Enter 로 줄을 나눠주세요.'],
  ['답글과 스레드',
   '특정 메시지에 답하려면 그 메시지에 마우스를 올리고 <strong>↩ 답장</strong>. ' +
   '이야기가 길어질 것 같으면 <strong>#️⃣ 스레드</strong> 를 만들면 본 채널이 지저분해지지 않습니다.'],
  ['파일 올리기',
   '입력창 왼쪽 <strong>+</strong> 를 누르거나, 파일을 채팅창으로 <strong>끌어다 놓으면</strong> 됩니다. ' +
   '스크린샷은 캡처 후 <strong>Ctrl/⌘ + V</strong> 로 바로 붙여넣을 수 있습니다.'],
  ['코드 붙여넣기',
   '터미널 출력이나 설정 파일은 그냥 붙이면 읽기 어렵습니다. 앞뒤를 <code>```</code> 세 개로 감싸주세요.<br>' +
   '<code>```</code> 다음에 <code>bash</code> 나 <code>yaml</code> 을 적으면 색까지 입혀집니다.'],
  ['알림 설정',
   '채널 이름 우클릭 → <strong>알림 설정</strong>. 공지사항은 <strong>모든 메시지</strong>, ' +
   '관심 없는 채널은 <strong>없음</strong> 으로 두면 알림에 파묻히지 않습니다.'],
  ['음성 채널',
   '🔊 표시가 있는 채널은 <strong>이름을 누르는 즉시 입장</strong>합니다. 통화 버튼이 따로 없습니다. ' +
   '나가려면 아래쪽 <strong>전화 끊기</strong> 아이콘을 누르세요.<br>' +
   '들어간 뒤 <strong>화면 공유</strong> 를 누르면 내 터미널을 보여주며 물어볼 수 있습니다.'],
  ['검색',
   '오른쪽 위 <strong>검색</strong> 창에 단어를 넣으면 지난 대화에서 찾아줍니다. ' +
   '<code>from:이름</code> 이나 <code>has:file</code> 같은 조건도 됩니다.'],
];

const COMMAND_HOWTO =
  '입력창에 <code>/</code> 를 치면 쓸 수 있는 명령 목록이 뜹니다. 목록에서 고르거나 이름을 이어 치고 ' +
  '<strong>Enter</strong>. 채워야 할 항목이 있으면 <strong>Tab</strong> 으로 옮겨가며 입력합니다.<br>' +
  '명령 응답 중 <em>"나만 볼 수 있어요"</em> 라고 표시된 것은 다른 사람에게 보이지 않습니다.';

const CHANNEL_GUIDE = [
  {
    group: '00. GATE',
    desc: '인증하기 전에는 이 두 곳만 보입니다.',
    items: [
      {
        name: '🔒 대기실',
        what: '처음 들어오면 여기만 보입니다. 인증을 마치면 나머지 채널이 한꺼번에 열립니다.',
        how: [
          '고정된 안내 메시지의 <strong>인증하기</strong> 버튼을 누릅니다.',
          '명단에 있으면 그 즉시 끝납니다. 아무것도 더 하지 않아도 됩니다.',
          '이름 목록이 뜨면 본인 이름을 고릅니다.',
          '목록에 이름이 없으면 <strong>목록에 없어요</strong> 를 눌러주세요. 운영진이 확인 후 열어드립니다.',
        ],
      },
      {
        name: '📜 서버 이용규칙',
        what: '참여 전에 한 번 읽어주세요. 길지 않습니다.',
        how: ['읽기 전용입니다. 글을 쓸 수 없습니다.'],
      },
    ],
  },
  {
    group: '01. WELCOME',
    desc: '들어오시면 여기부터 들러주세요.',
    items: [
      {
        name: '📢 공지사항',
        what: '운영 공지가 올라옵니다. 읽기 전용입니다.',
        how: ['채널 우클릭 → 알림 설정 → <strong>모든 메시지</strong> 로 켜두시길 권합니다.'],
      },
      {
        name: '👋 자기소개',
        what: '누가 있는지 알면 질문하기가 훨씬 편해집니다.',
        how: ['이름(또는 닉네임), 사는 지역, 관심 분야 정도면 충분합니다.'],
        example: '안녕하세요 홍길동입니다. 서울에 살고 있고 쿠버네티스 쪽을 파보려 합니다. 리눅스는 이제 시작 단계예요.',
      },
      {
        name: '💬 자유게시판',
        what: '스터디와 직접 관련 없는 이야기를 나누는 곳입니다.',
        how: ['잡담, 취업 정보, 유용한 소식 등 편하게 쓰세요.'],
      },
    ],
  },
  {
    group: '02. 케이스 스터디',
    desc: '스터디 일정을 잡고 기록하는 곳입니다.',
    items: [
      {
        name: '📋 스터디 일정추가',
        what: '여기서 등록한 일정은 구글 캘린더에 자동으로 들어가고 채널에 카드로 공지됩니다.',
        how: [
          '<code>/일정등록</code> 을 입력하고 항목을 채웁니다.',
          '날짜는 <code>9/10</code>, <code>9월 10일</code>, <code>2026-09-10</code> 모두 됩니다.',
          '시각은 <code>22시</code> 또는 <code>22:00</code>. 진행시간을 비우면 2시간으로 잡힙니다.',
          '오늘 뭐가 있는지 궁금하면 <code>/오늘일정</code>, 이번 주 전체는 <code>/주간일정</code>.',
        ],
        example: '/일정등록 제목:쿠버네티스 3회차 날짜:9/10 시작시각:22시 진행시간:2 장소:온라인 온라인:켬',
      },
    ],
  },
  {
    group: '03. 분야별 스터디',
    desc: '주제별로 묻고 답하는 공간입니다. 대부분 같은 이름의 🔊 음성 채널이 함께 있습니다.',
    items: [
      {
        name: '💻 리눅스 · 🌐 네트워크 · ☁️ 클라우드<br>🐳 컨테이너·쿠버네티스 · 🗄️ 데이터베이스',
        what: '해당 주제의 질문, 삽질 기록, 참고 자료를 나눕니다.',
        how: [
          '질문할 때는 <strong>무엇을 하려다</strong> <strong>어떤 오류가 났는지</strong> 함께 적어주세요. 그것만으로 답이 빨라집니다.',
          '터미널 출력은 <code>```</code> 로 감싸주세요.',
          '글로 설명하기 어려우면 옆 <strong>🔊 음성 채널</strong> 에 들어가 화면을 공유하면 됩니다.',
          '자료 파일은 <code>/자료함</code> 으로 그 채널 폴더를 열어 올려두면 나중에 찾기 쉽습니다.',
        ],
        example: 'nginx 설정 후 재시작하면 이 오류가 납니다. 뭘 놓쳤을까요?\n```bash\n$ sudo systemctl restart nginx\nJob for nginx.service failed...\n```',
      },
    ],
  },
  {
    group: '04. 지역모임',
    desc: '가까운 사람끼리 오프라인으로 모이는 곳입니다.',
    items: [
      {
        name: '🏙️ 서울·경기 · 🌆 충청 · 🌊 경상<br>🌾 전라 · 🏞️ 강원·제주',
        what: '본인 지역 채널에서 모임을 잡습니다.',
        how: [
          '먼저 채널에 글을 올려 사람을 모읍니다.',
          '날짜와 장소가 정해지면 <code>/일정등록</code> 으로 캘린더에 올려주세요. 다른 사람도 볼 수 있습니다.',
          '장소를 고민 중이면 <strong>#🍜-맛집</strong> 을 참고하세요.',
          '모임 사진은 <strong>#📷-사진</strong> 이나 지역 채널에 남겨주세요.',
        ],
        example: '9월 셋째 주 토요일 강남에서 모여서 실습해보려는데 관심 있으신 분 계신가요?',
      },
    ],
  },
  {
    group: '05. 공부자료',
    desc: '각자 공부한 것을 남기고 서로 자극받는 곳입니다.',
    items: [
      {
        name: '📸 오늘의 공부인증',
        what: '오늘 공부한 흔적을 남깁니다. 꾸준히 하는 사람이 보이면 나도 하게 됩니다.',
        how: ['사진 한 장이면 충분합니다. 한 줄 덧붙이면 더 좋고요.'],
        example: '오늘 3장까지 봤습니다. LVM 개념이 아직 헷갈리네요.',
      },
      {
        name: '📚 자료공유',
        what: '강의 자료, 정리 노트, 실습 스크립트를 모읍니다.',
        how: [
          '고정된 메시지에 <strong>교육과정 드라이브 폴더</strong> 링크가 있습니다.',
          '직접 만든 자료는 <code>/자료함</code> 으로 폴더를 열어 올려주세요.',
          '<code>/자료보기</code> 로 어떤 파일이 있는지 볼 수 있습니다.',
          '<code>/자료검색</code> 은 파일 이름뿐 아니라 <strong>문서 내용까지</strong> 찾습니다.',
        ],
      },
      {
        name: '🔗 유용한링크',
        what: '읽을 만한 문서와 블로그를 모읍니다.',
        how: ['링크만 던지지 말고 <strong>왜 좋은지</strong> 한 줄 붙여주시면 다들 도움이 됩니다.'],
        example: 'https://... — LVM 을 그림으로 설명해서 이해가 확 됐습니다.',
      },
      {
        name: '❓ 질문답변',
        what: '어느 분야인지 애매한 질문은 여기에.',
        how: ['분야가 분명하면 해당 스터디 채널이 답이 더 빨리 옵니다.'],
      },
    ],
  },
  {
    group: '06. 그룹스터디',
    desc: '배정된 그룹끼리만 쓰는 공간입니다. 그룹원에게만 보입니다.',
    items: [
      {
        name: '🔒 그룹1 · 그룹2 · 그룹3',
        what: '그룹 안에서 진도를 맞추고 과제를 나눕니다.',
        how: [
          '각 그룹에 텍스트 채널과 🔊 음성 채널이 하나씩 있습니다.',
          '그룹 자료는 <code>/자료함</code> 으로 그룹 폴더에 모아두세요.',
        ],
      },
    ],
  },
  {
    group: '08. 자격증',
    desc: '종목별로 채널이 나뉘어 있습니다. 준비하는 자격증 채널로 가시면 됩니다.',
    items: [
      {
        name: '📜 자격증 (공통)',
        what: '어떤 자격증을 딸지 고민될 때, 접수·시험 일정, 합격 후기를 나누는 곳입니다.',
        how: ['종목이 정해지면 아래 해당 채널로 가시면 됩니다.'],
      },
      {
        name: '☁️ AWS 자격증',
        what: 'CLF(클라우드 프랙티셔너) · SAA(솔루션스 아키텍트) · SOA · DVA',
        how: ['클라우드 자격증 중 가장 널리 쓰입니다. 처음이면 CLF → SAA 순서가 무난합니다.'],
      },
      {
        name: '☁️ 클라우드 자격증',
        what: 'KT Cloud · NCP(네이버) · Azure · GCP',
        how: ['국내 취업을 본다면 KT Cloud 와 NCP 를 함께 보는 경우가 많습니다.'],
      },
      {
        name: '🌐 네트워크 자격증',
        what: '네트워크관리사 1·2급 · CCNA',
        how: ['인프라 쪽은 네트워크 기반이 크게 작용합니다. <strong>#🌐-네트워크</strong> 채널과 함께 보세요.'],
      },
      {
        name: '🐧 리눅스 자격증',
        what: '리눅스마스터 1·2급 · LPIC · RHCSA',
        how: ['실습이 곧 시험 준비입니다. <strong>#💻-리눅스</strong> 에서 다룬 내용이 그대로 도움이 됩니다.'],
      },
      {
        name: '⎈ 쿠버네티스 자격증',
        what: 'CKA · CKAD · CKS',
        how: [
          '모두 실기 시험입니다. 정해진 시간 안에 클러스터를 직접 만지는 방식이라 손에 익히는 게 전부입니다.',
          '실습 환경이 막히면 <strong>#🐳-컨테이너-쿠버네티스</strong> 가 더 빠릅니다.',
        ],
      },
      { name: '📘 정보처리기사', what: '필기 · 실기' },
      { name: '🔐 정보보안기사', what: '정보보안기사 · 정보보안산업기사' },
      { name: '🗄️ SQLD', what: 'SQLD · SQLP' },
    ],
  },
  {
    group: '07. 휴식',
    desc: '공부 이야기만 하면 지칩니다.',
    items: [
      { name: '🍜 맛집', what: '가본 곳, 가보고 싶은 곳. 지역 모임 장소 정할 때 실제로 유용합니다.' },
      { name: '📷 사진', what: '오늘의 한 장. 공부 사진이 아니어도 괜찮습니다.' },
      { name: '✈️ 여행', what: '다녀온 곳과 계획 중인 여행을 공유합니다.' },
      { name: '🎧 휴게실 (음성)', what: '그냥 켜두고 각자 공부하는 방입니다. 말 안 해도 됩니다.' },
    ],
  },
];

const BOT_COMMANDS = [
  ['/인증', '5기 인증을 마치고 모든 채널을 엽니다. 명단에 있으면 누르는 즉시 끝납니다.'],
  ['/일정등록', '스터디 일정을 구글 캘린더에 올리고 채널에 공지합니다.'],
  ['/오늘일정', '오늘 잡힌 일정과 오늘이 몇 회차인지 확인합니다. 나만 볼 수 있습니다.'],
  ['/주간일정', '이번 주 일정을 요일별로 봅니다. `주:1` 로 다음 주. 나만 볼 수 있습니다.'],
  ['/자료함', '지금 있는 채널의 드라이브 폴더를 열어줍니다.'],
  ['/자료보기', '그 폴더에 어떤 파일이 있는지 목록으로 보여줍니다.'],
  ['/자료검색', '파일 이름·설명·문서 내용에서 찾습니다. #태그로도 검색됩니다.'],
  ['/스터디자료', '깃허브 ktci5/study 저장소의 자료를 디스코드에서 바로 봅니다.'],
];

function guideItem(it) {
  const how = it.how?.length
    ? `<ul class="how">${it.how.map((h) => `<li>${h}</li>`).join('')}</ul>`
    : '';
  const eg = it.example
    ? `<div class="eg"><span>이렇게</span><pre>${escapeHtml(it.example)}</pre></div>`
    : '';
  return `<div class="ch"><div class="ch-name">${it.name}</div>` +
    `<div class="ch-desc"><p>${it.what}</p>${how}${eg}</div></div>`;
}

function guidePage(env) {
  const basics = DISCORD_BASICS
    .map(([t, d]) => `<div class="ch"><div class="ch-name">${escapeHtml(t)}</div><div class="ch-desc"><p>${d}</p></div></div>`)
    .join('');

  const groups = CHANNEL_GUIDE.map((g) =>
    `<section><h2>${escapeHtml(g.group)}</h2>` +
    (g.desc ? `<p class="lead">${g.desc}</p>` : '') +
    g.items.map(guideItem).join('') +
    '</section>'
  ).join('');

  const cmds = BOT_COMMANDS
    .map(([c, d]) => `<div class="ch"><div class="ch-name"><code>${escapeHtml(c)}</code></div><div class="ch-desc"><p>${escapeHtml(d)}</p></div></div>`)
    .join('');

  const body =
    '<p class="lead">인증이 끝났습니다. 아래 채널이 모두 열려 있습니다.<br>' +
    '디스코드가 처음이셔도 괜찮습니다. 기본 사용법부터 정리해두었습니다.</p>' +

    `<section class="start"><h2>먼저 해두면 좋은 것</h2>
      <ol>
        <li><strong>#📢-공지사항</strong> 알림을 켜두세요. 채널 우클릭 → 알림 설정 → 모든 메시지.</li>
        <li><strong>#👋-자기소개</strong> 에 한 줄 남겨주세요. 서로 알아야 질문하기 편합니다.</li>
        <li>관심 있는 <strong>분야별 스터디</strong> 와 본인 <strong>지역 채널</strong> 을 둘러보세요.</li>
      </ol>
    </section>` +

    `<section><h2>디스코드 처음이신가요</h2>
      <p class="lead">이것만 알면 충분합니다.</p>${basics}</section>` +

    `<section><h2>명령어 쓰는 법</h2>
      <p class="lead">${COMMAND_HOWTO}</p>${cmds}</section>` +

    groups +

    `<section><h2>자료실</h2>
      <p class="lead">교육과정 드라이브 폴더 링크는 <strong>#📚-자료공유</strong> 채널의 고정 메시지에 있습니다.
      과정에 등록한 구글 계정으로 로그인하면 열립니다.</p>
      <h2>스터디 자료 올리기</h2>
      <p class="lead">채널마다 같은 이름의 드라이브 폴더가 하나씩 있습니다.</p>
      <ul class="how">
        <li>자료를 올릴 채널에서 <code>/자료함</code> → <strong>폴더 열기</strong> 버튼</li>
        <li>드라이브 창에 파일을 <strong>끌어다 놓으면</strong> 업로드됩니다.</li>
        <li>파일 이름에 <code>#태그</code> 를 넣어두면 나중에 <code>/자료검색</code> 으로 바로 찾힙니다.
            예: <code>LVM정리 #리눅스 #스토리지.pdf</code></li>
        <li>깃허브에 올린 정리 문서는 <code>/스터디자료</code> 로 디스코드에서 바로 볼 수 있습니다.</li>
        <li>실수로 지워도 <strong>30일 안에는 휴지통에서 복구</strong>할 수 있고, 사라진 파일은 자동으로 알림이 갑니다.</li>
      </ul>
    </section>` +

    `<section><h2>스터디 자료</h2>
      <p class="lead">과정 자료와 정리 문서는 <a href="/study">스터디 자료</a> 에 모아두었습니다.
      리눅스 CLI 심층 가이드는 명령어 목록 다음 단계 — 출력을 읽는 법과 진단 순서를 다룹니다.</p>
    </section>` +
    `<section><h2>막히면</h2>
      <ul class="how">
        <li>인증이 안 될 때 → 대기실에서 <strong>목록에 없어요</strong> 를 누르면 운영진에게 요청이 갑니다.</li>
        <li>채널이 안 보일 때 → 아직 인증 전이거나 그룹 전용 채널입니다.</li>
        <li>드라이브가 안 열릴 때 → <strong>#📚-자료공유</strong> 의 고정 메시지에서 링크를 확인하고, 과정에 등록한 구글 계정으로 로그인했는지 봐주세요.</li>
        <li>그 밖의 문제 → <strong>#❓-질문답변</strong> 에 남겨주세요.</li>
      </ul>
    </section>`;

  return html(renderDoc({ title: '채널 안내', heading: '📚 채널 사용 안내', html: body }));
}

function termsPage() {
  return html(renderDoc({
    title: '이용 약관',
    heading: '이용 약관',
    sections: [
      ['1. 서비스 개요',
        `본 서비스(ktci5.kr, 이하 "서비스")는 ${PLATFORM_NAME} 스터디 디스코드 서버의 참가자 인증을 자동화하기 위해 운영되는 비영리 도구입니다. 서비스는 디스코드 계정 인증을 통해 스터디 참가자에게 <strong>${ROLE_NAME}</strong> 역할을 부여합니다.`],
      ['2. 이용 자격',
        `서비스는 ${PLATFORM_NAME} 과정 참가자를 대상으로 합니다. 참가자가 아닌 사람의 인증 시도는 운영진 판단에 따라 취소될 수 있습니다.`],
      ['3. 이용자의 의무',
        '이용자는 타인의 디스코드 계정을 도용하거나, 자동화된 수단으로 서비스에 반복 요청을 보내거나, 서비스의 정상 운영을 방해하는 행위를 해서는 안 됩니다.'],
      ['4. 서비스 변경 및 중단',
        '서비스는 스터디 운영 기간 동안 제공되며, 과정 종료 또는 운영상의 필요에 따라 사전 고지 없이 변경되거나 중단될 수 있습니다.'],
      ['5. 책임의 한계',
        '서비스는 무상으로 제공되며 "있는 그대로" 제공됩니다. 디스코드 플랫폼 장애, 네트워크 오류 등 서비스 운영자의 통제를 벗어난 사유로 발생한 손해에 대해서는 책임을 지지 않습니다.'],
      ['6. 문의',
        `서비스에 관한 문의는 ${CONTACT}으로 연락해주세요.`],
    ],
  }));
}

function privacyPage() {
  return html(renderDoc({
    title: '개인정보 보호 정책',
    heading: '개인정보 보호 정책',
    sections: [
      ['1. 수집하는 정보',
        '디스코드 OAuth2 인증 과정에서 <code>identify</code> 스코프를 통해 <strong>디스코드 사용자 ID, 사용자명, 표시 이름</strong>을 전달받습니다. 이메일, 비밀번호, 결제 정보 등은 요청하지도 수집하지도 않습니다.'],
      ['2. 이용 목적',
        `전달받은 정보는 오직 해당 디스코드 계정에 <strong>${ROLE_NAME}</strong> 역할을 부여하고, 연결된 역할(Linked Roles) 인증 상태를 기록하는 목적으로만 사용됩니다.`],
      ['3. 보관 및 파기',
        '서비스는 데이터베이스를 두지 않습니다. 인증 과정에서 받은 정보와 액세스 토큰은 <strong>요청을 처리하는 동안 메모리에서만 사용되며 요청이 끝나면 즉시 사라집니다.</strong> 별도로 저장되거나 로그로 남지 않습니다.'],
      ['4. 제3자 제공',
        '수집한 정보를 제3자에게 판매·양도·공유하지 않습니다. 역할 부여를 위해 디스코드 API를 호출하는 것 외의 외부 전송은 없습니다.'],
      ['5. 쿠키',
        'CSRF 공격을 막기 위한 일회성 상태값 쿠키를 사용합니다. 이 쿠키는 10분 후 만료되며 개인을 식별하는 정보를 담고 있지 않습니다. 광고·분석용 추적 쿠키는 사용하지 않습니다.'],
      ['6. 이용자의 권리',
        `부여된 역할이나 연결된 역할 정보의 해제를 원하시면 ${CONTACT}으로 요청해주세요. 디스코드 사용자 설정의 <em>승인된 앱</em>에서 직접 서비스 접근 권한을 철회할 수도 있습니다.`],
      ['7. 문의',
        `개인정보 처리에 관한 문의는 ${CONTACT}으로 연락해주세요.`],
    ],
  }));
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const BASE_CSS =
  'body{font-family:-apple-system,BlinkMacSystemFont,"Malgun Gothic",sans-serif;background:#1a1d24;color:#e8ecf4;' +
  'margin:0;padding:24px;}' +
  'h1{font-size:20px;margin:0 0 16px;}' +
  'p{font-size:15px;line-height:1.6;color:#b7c0d4;margin:0 0 20px;}' +
  'a{color:#8ea1ff;}' +
  'code{background:#2d3446;padding:2px 6px;border-radius:4px;font-size:13px;}' +
  '.hint{font-size:13px;color:#8a93a8;margin:20px 0 0;}' +
  '.btn{display:block;background:#5865F2;color:#fff;text-decoration:none;padding:12px 24px;' +
  'border-radius:8px;font-weight:600;font-size:14px;margin:8px 0;}' +
  '.btn:hover{background:#4752c4;}' +
  '.btn-ghost{background:#2d3446;}' +
  '.btn-ghost:hover{background:#39415a;}' +
  '.foot{font-size:12px;color:#6c7488;margin:24px 0 0;}' +
  '.foot a{color:#6c7488;}';

const FOOTER =
  '<p class="foot"><a href="/terms">이용 약관</a> · <a href="/privacy">개인정보 보호 정책</a></p>';

function renderPage({ title, heading, body }) {
  return '<!doctype html><html lang="ko"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + escapeHtml(title) + '</title>' +
    '<style>' + BASE_CSS +
    'body{display:flex;min-height:100vh;align-items:center;justify-content:center;}' +
    '.card{max-width:420px;text-align:center;background:#232838;border-radius:16px;padding:36px 28px;box-shadow:0 8px 24px rgba(0,0,0,.3);}' +
    '</style></head><body><div class="card"><h1>' + heading + '</h1>' + body + FOOTER +
    '</div></body></html>';
}

function renderDoc({ title, heading, sections, html: raw, extraCss = '' }) {
  const body = raw || sections
    .map(([h, p]) => `<h2>${escapeHtml(h)}</h2><p>${p}</p>`)
    .join('');

  const stickyHeader = `
    <header class="top-sticky-bar">
      <div class="top-bar-inner">
        <a href="/study" class="top-logo">📖 KT-CI5 스터디 Hub</a>
        <nav class="top-nav">
          <a href="/study/course" class="nav-item">📘 강의 정리</a>
          <a href="/study/calendar" class="nav-item">🗓️ 캘린더</a>
          <a href="/study/cheatsheet" class="nav-item">⚡ 치트시트</a>
          <a href="/study/linux" class="nav-item">🐧 리눅스 가이드</a>
          <a href="/study/infra" class="nav-item">🛠️ 인프라 가이드</a>
          <a href="/guide" class="nav-item">💬 채널 가이드</a>
        </nav>
      </div>
    </header>
  `;

  const bottomNav = `
    <div class="bottom-nav-bar">
      <a href="/study" class="bnav-btn">← 스터디 Hub</a>
      <a href="/study/course" class="bnav-btn">📘 강의 정리</a>
      <a href="/study/cheatsheet" class="bnav-btn">⚡ 치트시트</a>
      <a href="/study/linux" class="bnav-btn">🐧 리눅스 가이드</a>
      <a href="/study/calendar" class="bnav-btn highlight">🗓️ 스터디 캘린더</a>
      <a href="/guide" class="bnav-btn">💬 채널 가이드 →</a>
    </div>
  `;

  const docCss = `
    .top-sticky-bar { position: sticky; top: 0; z-index: 999; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); background: rgba(15, 23, 42, 0.92); border-bottom: 1px solid #2a3143; width: 100%; margin-bottom: 16px; }
    .top-bar-inner { max-width: 1320px; margin: 0 auto; padding: 10px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .top-logo { font-size: 15px; font-weight: 700; color: #f8fafc; text-decoration: none; display: flex; align-items: center; gap: 8px; }
    .top-logo:hover { color: #818cf8; }
    .top-nav { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .nav-item { font-size: 13px; font-weight: 500; color: #cbd5e1; text-decoration: none; padding: 5px 11px; border-radius: 6px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07); transition: all 0.15s ease; }
    .nav-item:hover { background: rgba(99, 102, 241, 0.2); border-color: #6366f1; color: #fff; }
    
    .bottom-nav-bar { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 48px; padding-top: 20px; border-top: 1px solid #2a3143; flex-wrap: wrap; }
    .bnav-btn { font-size: 13.5px; font-weight: 600; color: #94a3b8; text-decoration: none; padding: 8px 16px; border-radius: 8px; background: #1a2234; border: 1px solid #2a3143; transition: all 0.15s ease; display: inline-flex; align-items: center; gap: 6px; }
    .bnav-btn:hover { background: #242d42; color: #fff; border-color: #6366f1; transform: translateY(-1px); }
    .bnav-btn.highlight { background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #fff; border-color: #818cf8; }

    @media (max-width: 640px) {
      .top-bar-inner { flex-direction: column; align-items: flex-start; }
      .bottom-nav-bar { flex-direction: column; align-items: stretch; }
      .bnav-btn { justify-content: center; }
    }
  `;

  return '<!doctype html><html lang="ko"><head><meta charset="UTF-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>' + escapeHtml(title) + ' · ktci5.kr</title>' +
    '<style>' + BASE_CSS +
    '.doc{max-width:1320px;margin:0 auto;padding:24px 20px 64px;width:94%;}' +
    'h2{font-size:16px;margin:28px 0 8px;color:#e8ecf4;}' +
    '.lead{font-size:14px;color:#9aa4bb;}' +
    'section{margin:0 0 4px;}' +
    '.ch{display:flex;gap:12px;padding:10px 0;border-top:1px solid #2a3143;align-items:baseline;}' +
    '.ch-name{flex:0 0 34%;font-weight:600;color:#e8ecf4;font-size:14px;}' +
    '.ch-desc{flex:1;font-size:14px;line-height:1.55;color:#b7c0d4;}' +
    '.start ol{font-size:14px;line-height:1.9;color:#b7c0d4;padding-left:20px;}' +
    '.ch-desc p{margin:0 0 6px;}' +
    'ul.how{margin:6px 0 0;padding-left:18px;font-size:13.5px;line-height:1.7;color:#a8b2c8;}' +
    'ul.how li{margin:0 0 3px;}' +
    '.eg{margin:10px 0 2px;border-left:2px solid #39415a;padding:2px 0 2px 10px;}' +
    '.eg span{font-size:11px;color:#6c7488;letter-spacing:.04em;}' +
    '.eg pre{margin:3px 0 0;font-size:12.5px;line-height:1.55;color:#9aa4bb;white-space:pre-wrap;' +
    'word-break:break-word;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;}' +
    '.ch-name{line-height:1.45;}' +
    '@media(max-width:520px){.ch{display:block}.ch-name{margin-bottom:4px}}' +
    '.tag{font-size:11px;color:#6c7488;border:1px solid #39415a;border-radius:4px;padding:1px 5px;margin-left:6px;font-weight:400;}' +
    docCss +
    extraCss +
    '</style></head><body>' +
    stickyHeader +
    '<div class="doc"><h1>' + escapeHtml(heading) + '</h1>' +
    `<p class="hint">${PLATFORM_NAME} 스터디 디스코드 인증 서비스 (ktci5.kr)</p>` +
    body +
    bottomNav +
    '<p class="foot" style="margin-top:20px;"><a href="/">← 처음으로</a></p>' +
    '</div></body></html>';
}
