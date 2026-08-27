/**
 * 이 서버는 어떻게 만들어졌나 — /study/infra
 *
 * 인프라 과정 수강생 누구나 읽을 수 있게 씁니다.
 * 지금 쓰고 있는 인증 시스템을 그대로 교재로 삼습니다.
 */

export const INFRA_TITLE = '이 서버는 어떻게 돌아가나';

/* 전체 구조도 — 다크 배경에 맞춘 인라인 SVG */
const DIAGRAM = `
<svg viewBox="0 0 720 330" role="img" aria-label="ktci5.kr 전체 구조도" class="arch">
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
      <path d="M0 0 L10 5 L0 10 z" fill="#6b7794"/>
    </marker>
  </defs>

  <g font-family="-apple-system,BlinkMacSystemFont,sans-serif" font-size="12">

    <rect x="14" y="128" width="112" height="56" rx="10" fill="#232838" stroke="#39415a"/>
    <text x="70" y="150" fill="#e8ecf4" text-anchor="middle" font-size="13">여러분</text>
    <text x="70" y="167" fill="#8a93a8" text-anchor="middle" font-size="11">브라우저 · 디스코드</text>

    <rect x="182" y="20" width="130" height="52" rx="10" fill="#232838" stroke="#39415a"/>
    <text x="247" y="41" fill="#e8ecf4" text-anchor="middle" font-size="13">DNS</text>
    <text x="247" y="58" fill="#8a93a8" text-anchor="middle" font-size="11">ktci5.kr 은 어디?</text>

    <rect x="182" y="128" width="130" height="56" rx="10" fill="#2b3550" stroke="#5865F2"/>
    <text x="247" y="150" fill="#c9d3e6" text-anchor="middle" font-size="13">Cloudflare 엣지</text>
    <text x="247" y="167" fill="#8ea1ff" text-anchor="middle" font-size="11">가장 가까운 거점</text>

    <rect x="368" y="112" width="140" height="88" rx="10" fill="#2b3550" stroke="#5865F2"/>
    <text x="438" y="138" fill="#c9d3e6" text-anchor="middle" font-size="13">Worker</text>
    <text x="438" y="156" fill="#8ea1ff" text-anchor="middle" font-size="11">우리가 짠 코드</text>
    <text x="438" y="176" fill="#6c7488" text-anchor="middle" font-size="10.5">서버 한 대 없이</text>
    <text x="438" y="190" fill="#6c7488" text-anchor="middle" font-size="10.5">요청이 올 때만 실행</text>

    <rect x="368" y="20" width="140" height="52" rx="10" fill="#232838" stroke="#39415a"/>
    <text x="438" y="41" fill="#e8ecf4" text-anchor="middle" font-size="13">GitHub</text>
    <text x="438" y="58" fill="#8a93a8" text-anchor="middle" font-size="11">ktci5/web</text>

    <rect x="368" y="248" width="140" height="52" rx="10" fill="#232838" stroke="#39415a"/>
    <text x="438" y="269" fill="#e8ecf4" text-anchor="middle" font-size="13">KV · Secrets</text>
    <text x="438" y="286" fill="#8a93a8" text-anchor="middle" font-size="11">명단 · 자격증명</text>

    <rect x="566" y="88" width="138" height="52" rx="10" fill="#232838" stroke="#39415a"/>
    <text x="635" y="109" fill="#e8ecf4" text-anchor="middle" font-size="13">Discord API</text>
    <text x="635" y="126" fill="#8a93a8" text-anchor="middle" font-size="11">역할 부여 · 명령</text>

    <rect x="566" y="172" width="138" height="52" rx="10" fill="#232838" stroke="#39415a"/>
    <text x="635" y="193" fill="#e8ecf4" text-anchor="middle" font-size="13">Google API</text>
    <text x="635" y="210" fill="#8a93a8" text-anchor="middle" font-size="11">캘린더 · 드라이브</text>

    <g stroke="#6b7794" stroke-width="1.4" fill="none" marker-end="url(#arrow)">
      <path d="M126 148 L176 148"/>
      <path d="M247 122 L247 78"/>
      <path d="M312 156 L362 156"/>
      <path d="M438 78 L438 106"/>
      <path d="M438 206 L438 242"/>
      <path d="M508 144 L560 118"/>
      <path d="M508 168 L560 192"/>
    </g>

    <text x="151" y="141" fill="#6c7488" font-size="10" text-anchor="middle">①</text>
    <text x="258" y="100" fill="#6c7488" font-size="10">②</text>
    <text x="337" y="149" fill="#6c7488" font-size="10" text-anchor="middle">③</text>
    <text x="446" y="96" fill="#6c7488" font-size="10">배포</text>
    <text x="446" y="228" fill="#6c7488" font-size="10">읽기</text>
  </g>
</svg>`;

const HOPS = [
  {
    n: '①',
    title: '주소를 물어봅니다 (DNS)',
    body: '<code>ktci5.kr</code> 은 사람이 읽는 이름일 뿐이고, 실제 통신에는 IP 주소가 필요합니다. ' +
      '브라우저는 먼저 <strong>DNS</strong> 에 "ktci5.kr 의 주소가 뭐야?" 하고 묻습니다. ' +
      '전화번호부에서 이름으로 번호를 찾는 것과 같습니다.',
    try: 'dig +short ktci5.kr',
    note: '두 개의 IP 가 나옵니다. 우리 서버의 주소가 아니라 <strong>Cloudflare 의 주소</strong>입니다. ' +
      '실제 코드가 어디 있는지는 바깥에서 알 수 없습니다.',
  },
  {
    n: '②',
    title: '가장 가까운 거점으로 갑니다 (엣지)',
    body: 'Cloudflare 는 전 세계 수백 곳에 거점을 두고 있습니다. 서울에서 접속하면 서울 거점이, ' +
      '미국에서 접속하면 그쪽 거점이 응답합니다. 이렇게 <strong>사용자와 가까운 곳</strong>을 엣지(edge)라고 부릅니다.',
    try: 'curl -sI https://ktci5.kr | grep -i "cf-ray\\|server"',
    note: '<code>cf-ray</code> 끝의 세 글자가 응답한 거점입니다. <code>ICN</code> 이면 인천, <code>NRT</code> 면 도쿄입니다. ' +
      '공항 코드를 씁니다.',
  },
  {
    n: '③',
    title: '그 자리에서 코드가 실행됩니다 (Worker)',
    body: '보통은 요청이 원본 서버까지 가야 하지만, 여기서는 <strong>엣지에서 바로 우리 코드가 돕니다.</strong> ' +
      '이걸 Cloudflare Workers 라고 합니다. 빌려 쓰는 서버가 아예 없습니다. ' +
      '요청이 없으면 아무것도 실행되지 않고, 요청이 오면 그 순간 깨어나 응답하고 사라집니다.',
    try: 'curl -s https://ktci5.kr/discord/status',
    note: '설정이 제대로 됐는지 알려주는 상태 페이지입니다. 이 응답도 엣지에서 만들어진 것입니다.',
  },
];

const OAUTH = [
  ['여러분이 <strong>인증하기</strong> 를 누릅니다', '우리 사이트는 아직 여러분이 누군지 모릅니다.'],
  ['디스코드로 보냅니다', '<strong>비밀번호를 우리에게 입력하지 않습니다.</strong> 디스코드 화면에서 디스코드에 로그인합니다.'],
  ['디스코드가 물어봅니다', '"ktci5.kr 이 당신의 아이디를 확인하려 합니다. 허용할까요?"'],
  ['승인하면 되돌아옵니다', '주소에 <code>code=...</code> 가 붙어 옵니다. 이건 아직 신분증이 아니라 <strong>교환권</strong>입니다.'],
  ['Worker 가 교환합니다', '교환권과 우리만 아는 비밀키를 함께 보내 <strong>액세스 토큰</strong>을 받습니다. 이 통신은 서버끼리만 오갑니다.'],
  ['토큰으로 신원을 확인합니다', '디스코드에 "이 토큰의 주인이 누구야?" 하고 물어 사용자 ID 를 받습니다.'],
  ['명단과 맞춰보고 역할을 줍니다', '봇 권한으로 <code>5기인증</code> 역할을 부여합니다. 여기서 처음으로 우리 쪽 판단이 들어갑니다.'],
];

const DATA = [
  ['코드', 'GitHub — <code>ktci5/web</code>', '공개', '누구나 읽어도 되는 것. 오히려 공개해야 검증받습니다.'],
  ['자격증명', 'Cloudflare Secrets', '암호화', '봇 토큰, 클라이언트 시크릿, 서비스 계정 키. <strong>한 번 넣으면 아무도 다시 못 읽습니다.</strong> 코드에서만 값을 쓸 수 있습니다.'],
  ['명단', 'Cloudflare KV', '비공개', '인증할 때만 조회합니다. 코드에 박아두지 않아 명단이 바뀌어도 배포가 필요 없습니다.'],
  ['개인정보 원본', 'GitHub — <code>ktci5/data</code>', '비공개', '실명이 들어 있어 공개 저장소와 분리했습니다.'],
  ['스터디 자료', 'GitHub — <code>ktci5/study</code> · 구글 드라이브', '공개 / 제한', '문서는 공개, 과정 자료는 드라이브 권한에 따릅니다.'],
];

const WHY = [
  ['왜 서버를 안 쓰나',
   '서버 한 대를 두면 24시간 켜두고, 보안 패치를 하고, 죽으면 살려야 합니다. 45명이 하루에 몇 번 누르는 인증에 그 비용을 들일 이유가 없습니다. ' +
   'Workers 는 <strong>요청이 올 때만 실행되고</strong> 그만큼만 계산합니다.'],
  ['왜 엣지에서 도나',
   '요청이 한국에서 미국 서버까지 갔다 오면 왕복만 200ms 가 넘습니다. 엣지에서 처리하면 그 왕복이 사라집니다. ' +
   '디스코드는 인터랙션 응답을 <strong>3초 안에</strong> 요구하는데, 이 여유가 꽤 도움이 됩니다.'],
  ['왜 깃허브를 거치나',
   '코드를 손으로 올리면 무엇이 언제 바뀌었는지 남지 않습니다. 깃허브에 밀어 넣으면 <strong>이력이 남고, 되돌릴 수 있고, 자동으로 배포</strong>됩니다. ' +
   '이걸 CI/CD 라고 부릅니다.'],
  ['이 방식의 약점도 있습니다',
   '요청 하나가 쓸 수 있는 시간과 메모리에 제한이 있어 무거운 계산은 못 합니다. 또 실행이 끝나면 기억이 사라지므로 ' +
   '<strong>상태는 반드시 KV 같은 바깥에 둬야</strong> 합니다. 무엇이든 되는 방식이 아니라, 이런 일에 맞는 방식입니다.'],
];

const TERMS = [
  ['DNS', '이름을 IP 주소로 바꿔주는 전화번호부. <code>ktci5.kr</code> → <code>104.21.x.x</code>'],
  ['엣지 (Edge)', '사용자와 가까운 곳에 둔 거점. 멀리 가지 않아 빠릅니다.'],
  ['서버리스 (Serverless)', '서버가 없는 게 아니라 <strong>내가 관리할 서버가 없다</strong>는 뜻입니다.'],
  ['CI/CD', '코드를 올리면 자동으로 검사하고 배포하는 것. 사람이 손으로 옮기지 않습니다.'],
  ['OAuth', '비밀번호를 넘기지 않고 "이 사람이 맞다"만 확인받는 방식.'],
  ['시크릿 (Secret)', '토큰이나 키처럼 새면 안 되는 값. 암호화해 저장하고 코드에서만 씁니다.'],
  ['KV', 'Key-Value. 이름표를 붙여 값을 넣어두고 꺼내 쓰는 단순한 저장소.'],
  ['크론 (Cron)', '정해진 주기로 자동 실행. 여기서는 15분마다 드라이브 변경을 확인합니다.'],
];


const MASTER = [
  {
    title: '설정 파일 한 장이 인프라를 정의합니다',
    body: '서버를 손으로 세팅하지 않고 <code>wrangler.toml</code> 한 장에 적습니다. ' +
      '이 파일이 저장소에 있으니 <strong>인프라가 코드로 관리</strong>됩니다(Infrastructure as Code). ' +
      '누가 무엇을 바꿨는지 이력에 남고, 새 환경에 그대로 재현할 수 있습니다.',
    code: 'name = "web"                    # 워커 이름\nmain = "src/index.js"           # 진입점\ncompatibility_date = "2025-09-01"\n\n[[routes]]\npattern = "ktci5.kr"            # 이 도메인의 모든 요청을\ncustom_domain = true            # 이 워커가 받는다\n\n[vars]                          # 공개돼도 되는 설정\nDISCORD_GUILD_ID = "1541..."\n\n[[kv_namespaces]]               # 명단·상태 저장소\nbinding = "ROSTER"\nid = "1cd43df..."\n\n[triggers]\ncrons = ["*/15 * * * *"]        # 15분마다 자동 실행',
    noteLabel: '경계에 주의',
    note: '<code>[vars]</code> 에는 <strong>공개돼도 되는 값만</strong> 넣습니다. 이 파일은 저장소에 올라갑니다. ' +
      '토큰·키는 <code>wrangler secret put</code> 으로 따로 넣습니다.',
  },
  {
    title: '시크릿과 배포는 다른 축입니다',
    body: '코드는 깃허브에, 시크릿은 Cloudflare 에 있습니다. 두 축이 만나는 지점이 배포인데, ' +
      '<strong>여기가 실제로 깨졌습니다.</strong> 자동 배포를 붙이자 새 버전이 시크릿 없이 올라가 서비스가 멈췄습니다.',
    code: '# 증상: 배포는 성공했는데 기능이 전부 죽음\ncurl -s https://ktci5.kr/discord/status\n# {"ok":false,"missing":["DISCORD_CLIENT_ID", ...]}\n\n# 확인: 워커에 시크릿이 있는가\nnpx wrangler secret list\n# []  ← 비어 있음\n\n# 복구\nbash scripts/setup-secrets.sh',
    noteLabel: '배운 것',
    note: '"코드와 비밀을 분리하라"는 원칙에는 <strong>대가가 따릅니다.</strong> ' +
      '분리했으니 각각 따로 관리해야 하고, 한쪽만 갱신하면 깨집니다. ' +
      '그래서 <code>/discord/status</code> 같은 <strong>스스로 상태를 알려주는 엔드포인트</strong>를 둡니다. ' +
      '기능을 하나씩 눌러보지 않아도 무엇이 빠졌는지 한 번에 보입니다.',
  },
  {
    title: '요청은 서명으로 검증합니다',
    body: '인터랙션 엔드포인트는 인터넷에 열려 있습니다. 누구나 POST 를 보낼 수 있으니, ' +
      '<strong>디스코드가 보낸 것이 맞는지</strong> 확인해야 합니다. 디스코드는 요청마다 Ed25519 서명을 붙여 보내고 ' +
      '우리는 공개키로 검증합니다.',
    code: "const key = await crypto.subtle.importKey(\n  'raw', hexToBytes(env.DISCORD_PUBLIC_KEY),\n  { name: 'Ed25519' }, false, ['verify']\n);\nconst ok = await crypto.subtle.verify(\n  { name: 'Ed25519' }, key,\n  hexToBytes(signature),\n  new TextEncoder().encode(timestamp + body)\n);\nif (!ok) return new Response('invalid', { status: 401 });",
    noteLabel: '검증이 곧 등록 조건',
    note: '디스코드는 엔드포인트를 등록할 때 <strong>일부러 잘못된 서명</strong>을 보내봅니다. ' +
      '그때 401 을 돌려주지 않으면 등록 자체가 거부됩니다. 보안 장치가 곧 동작 조건인 셈입니다.',
  },
  {
    title: '3초 제한과 지연 응답',
    body: '디스코드는 인터랙션에 <strong>3초 안에</strong> 답하라고 요구합니다. ' +
      '구글 캘린더나 드라이브를 부르면 그보다 오래 걸릴 수 있습니다. ' +
      '그래서 먼저 "생각 중" 을 보내고, 결과가 나오면 그 메시지를 고쳐 씁니다.',
    code: "// 즉시 응답 — 사용자에게는 로딩 표시\nctx.waitUntil(\n  work().then((data) => editOriginal(interaction, data))\n);\nreturn Response.json({ type: 5 });  // DEFERRED",
    noteLabel: '엣지의 제약',
    note: '<code>ctx.waitUntil</code> 은 응답을 보낸 뒤에도 작업을 계속하게 해줍니다. ' +
      '서버리스는 응답과 함께 실행이 끝나는 게 기본이라, 이런 장치가 없으면 뒷일이 잘립니다.',
  },
  {
    title: '상태는 바깥에 둡니다',
    body: '워커는 요청이 끝나면 기억을 잃습니다. 명단, 이름 점유 기록, 드라이브 변경 위치 같은 것은 ' +
      '<strong>KV 에 둡니다.</strong> 키 이름에 규칙을 두면 나중에 찾기 쉽습니다.',
    code: "roster            명단 전체 (JSON)\nclaims            이름 → 계정 묶음\ndrive:pageToken   드라이브 변경 추적 위치\ngh:<경로>         깃허브 조회 캐시 (10분 만료)",
    noteLabel: '캐시에는 만료를',
    note: '깃허브 API 는 인증 없이 쓰면 호출 한도가 있습니다. 결과를 KV 에 10분만 두어 한도를 아끼고, ' +
      '자료가 바뀌면 늦어도 10분 안에 반영되게 했습니다. <strong>정확성과 비용의 절충</strong>입니다.',
  },
  {
    title: '되돌릴 수 있게 만들어 둡니다',
    body: '무엇이든 깨질 수 있다고 보고, 깨졌을 때 <strong>빠르게 되돌리는 길</strong>을 미리 만들어 둡니다.',
    code: '# 지금 무엇이 잘못됐는지\ncurl -s https://ktci5.kr/discord/status\n\n# 실시간 로그\nnpx wrangler tail\n\n# 배포 이력 보기\nnpx wrangler deployments list\n\n# 이전 버전으로 되돌리기\nnpx wrangler rollback',
    noteLabel: '운영의 기본',
    note: '고치는 속도보다 <strong>되돌리는 속도</strong>가 중요할 때가 많습니다. ' +
      '원인을 찾는 동안 서비스는 멈춰 있으니, 일단 되돌려 살려두고 원인은 그다음에 찾습니다.',
  },
];

/* --------------------------------------------------------------- 레벨 구성 */

const LEVEL_INTRO = [
  ['L1', '기초', '무슨 일이 일어나는지 그림으로', '주소창에 치면 화면이 뜨기까지, 인증 버튼을 누르면 역할이 붙기까지. 용어를 몰라도 흐름이 그려지면 성공입니다.'],
  ['L2', '중급', '직접 확인해보기', '설명을 믿지 말고 명령을 쳐서 눈으로 봅니다. DNS 응답, 어느 거점이 답했는지, 배포가 어떻게 흐르는지.'],
  ['L3', '심화', '왜 이렇게 설계했나', '되는 방법은 여럿입니다. 왜 이 방법을 골랐고 무엇을 포기했는지. 트레이드오프를 읽는 단계입니다.'],
  ['L4', '마스터', '직접 만들고 운영하기', '설정 파일의 각 줄이 무엇을 하는지, 어디서 깨지는지, 깨졌을 때 어떻게 되돌리는지.'],
];

/* ------------------------------------------------------------------ 렌더 */

export function renderInfraGuide(escapeHtml) {
  const nav = LEVEL_INTRO.map(([lv, name, what]) =>
    `<a class="lvnav" href="#${lv}"><span class="lvnav-tag">${lv}</span>` +
    `<span class="lvnav-b"><strong>${escapeHtml(name)}</strong>${escapeHtml(what)}</span></a>`
  ).join('');

  const head = (lv, name, what) => {
    const desc = (LEVEL_INTRO.find((l) => l[0] === lv) || [])[3] || '';
    return `<div class="lvhead" id="${lv}"><div class="lvhead-tag">${lv}</div><div>` +
      `<h2>${escapeHtml(name)} — ${escapeHtml(what)}</h2>` +
      `<p class="lead">${escapeHtml(desc)}</p></div></div>`;
  };

  const hops = HOPS.map((h) =>
    `<article class="hop">
      <h3><span class="hop-n">${h.n}</span> ${escapeHtml(h.title)}</h3>
      <p>${h.body}</p>
      <div class="try"><span>직접 해보기 · L2</span><pre>${escapeHtml(h.try)}</pre>
      <p>${h.note}</p></div>
    </article>`
  ).join('');

  const oauth = OAUTH.map(([step, desc]) =>
    `<li><strong>${step}</strong><p>${desc}</p></li>`).join('');

  const data = DATA.map(([what, where, level, why]) =>
    `<tr><td>${escapeHtml(what)}</td><td>${where}</td>` +
    `<td><span class="lvl ${level === '공개' ? 'pub' : 'pri'}">${escapeHtml(level)}</span></td>` +
    `<td>${why}</td></tr>`).join('');

  const why = WHY.map(([t, d]) =>
    `<div class="ch"><div class="ch-name">${escapeHtml(t)}</div><div class="ch-desc"><p>${d}</p></div></div>`).join('');

  const terms = TERMS.map(([t, d]) =>
    `<div class="tm"><code>${escapeHtml(t)}</code><p>${d}</p></div>`).join('');

  const master = MASTER.map((m) =>
    `<article class="hop">
      <h3>${escapeHtml(m.title)}</h3>
      <p>${m.body}</p>
      ${m.code ? `<pre class="code">${escapeHtml(m.code)}</pre>` : ''}
      ${m.note ? `<div class="try"><span>${escapeHtml(m.noteLabel || '짚어둘 점')}</span><p>${m.note}</p></div>` : ''}
    </article>`).join('');

  return `
<p class="lead">지금 여러분이 쓰고 있는 이 인증 시스템은 <strong>서버 한 대 없이</strong> 돌아갑니다.
도메인·DNS·CDN·서버리스·자동 배포·OAuth — 과정에서 배우는 개념이 여기에 다 들어 있습니다.
교재 속 그림이 아니라 <strong>지금 동작하는 실물</strong>입니다.</p>

<p class="lead">네 단계로 나눠 두었습니다. <strong>L1 만 읽어도 충분합니다.</strong>
더 알고 싶어질 때 다음 단계로 내려오시면 됩니다.</p>

<div class="lvnavwrap">${nav}</div>

${head('L1', '기초', '무슨 일이 일어나는지 그림으로')}
<section>
${DIAGRAM}
<p class="lead">왼쪽에서 오른쪽으로 요청이 흐릅니다. 위쪽은 코드가 배포되는 길, 아래쪽은 데이터를 읽는 길입니다.</p>

<h3 class="sub">주소창에 ktci5.kr 을 치면</h3>
<p class="lead">엔터를 누르고 화면이 뜨기까지 0.2초 남짓 사이에 세 가지 일이 일어납니다.</p>
<ol class="simple">
  <li><strong>주소를 물어봅니다</strong><p>전화번호부에서 이름으로 번호를 찾듯, <code>ktci5.kr</code> 의 실제 주소를 알아냅니다.</p></li>
  <li><strong>가장 가까운 곳으로 갑니다</strong><p>서울에서 접속하면 서울 근처 거점이 받습니다. 멀리 가지 않아 빠릅니다.</p></li>
  <li><strong>그 자리에서 코드가 돕니다</strong><p>빌려 쓰는 서버가 없습니다. 요청이 올 때만 깨어나 응답하고 사라집니다.</p></li>
</ol>

<h3 class="sub">인증 버튼을 누르면</h3>
<p class="lead">가장 중요한 것부터 — <strong>우리 서버는 여러분의 디스코드 비밀번호를 한 번도 보지 않습니다.</strong>
비밀번호는 디스코드 화면에서 디스코드에만 입력됩니다.</p>
<p class="lead">우리는 디스코드에게 "이 사람이 맞나요?" 하고 물어 <strong>맞다는 확인만</strong> 받습니다.
그 확인을 받으면 명단과 맞춰보고 역할을 붙여줍니다. "구글로 로그인", "카카오로 로그인" 이 전부 같은 방식입니다.</p>

<div class="tip"><span>L1 은 여기까지</span><p>이 흐름이 그려지면 충분합니다.
아래는 "정말 그런지 직접 확인해보고 싶다"는 분을 위한 내용입니다.</p></div>
</section>

${head('L2', '중급', '직접 확인해보기')}
<section>
<p class="lead">아래 명령은 <strong>지금 그대로 쳐보실 수 있습니다.</strong> 리눅스·macOS 터미널이나 WSL 에서 됩니다.</p>
${hops}

<h3 class="sub">인증이 실제로 오가는 순서</h3>
<ol class="oauth">${oauth}</ol>
<div class="tip"><span>왜 이렇게 복잡한가</span><p>비밀번호를 남에게 주지 않고도 신원을 증명하기 위해서입니다.
교환권과 토큰을 나누는 이유는, 주소창에 노출되는 값(교환권)만으로는 아무것도 할 수 없게 하기 위함입니다.</p></div>

<h3 class="sub">코드를 고치면 어떻게 반영되나</h3>
<div class="pipe">
  <div><code>git push</code><span>코드를 올린다</span></div>
  <div><code>GitHub</code><span>이력이 남는다</span></div>
  <div><code>Workers Builds</code><span>자동으로 감지</span></div>
  <div><code>배포</code><span>전 세계 엣지에 반영</span></div>
</div>
<p class="lead">사람이 파일을 서버에 복사하던 일을 기계가 대신합니다. 무엇이 언제 왜 바뀌었는지 남고,
문제가 생기면 이전 버전으로 되돌릴 수 있습니다.</p>
</section>

${head('L3', '심화', '왜 이렇게 설계했나')}
<section>
${why}

<h3 class="sub">데이터는 어디에, 왜 나누나</h3>
<p class="lead">전부 한곳에 두지 않고 <strong>성격에 따라 나눕니다.</strong> 이게 보안의 기본입니다.</p>
<div class="tbl"><table><thead><tr><th>무엇</th><th>어디에</th><th>공개</th><th>왜</th></tr></thead>
<tbody>${data}</tbody></table></div>
<div class="tip"><span>기억해두면 좋은 것</span><p>코드가 공개돼도 안전해야 합니다.
<strong>비밀은 코드가 아니라 설정에 둔다</strong> — 이 원칙을 지키면 저장소를 공개해도 문제가 없습니다.
반대로 토큰을 코드에 적어두면 공개하는 순간 끝입니다.</p></div>
</section>

${head('L4', '마스터', '직접 만들고 운영하기')}
<section>
<p class="lead">여기서부터는 <strong>직접 만들어보려는 분</strong>을 위한 내용입니다.
설정의 각 줄이 무엇을 하고, 어디서 깨지고, 깨졌을 때 어떻게 되돌리는지.</p>
${master}
</section>

<section><h2>용어 정리</h2>
<p class="lead">처음 보는 말이 나오면 여기로 돌아오세요.</p>
${terms}</section>

<section><h2>더 보기</h2>
<div class="ch"><div class="ch-name"><a href="/study/linux">리눅스 CLI 심층 가이드</a></div>
<div class="ch-desc"><p>출력을 읽는 법과 증상별 진단 순서. 같은 5단계 모델로 정리했습니다.</p></div></div>
<div class="ch"><div class="ch-name"><a href="https://github.com/ktci5/web" target="_blank" rel="noopener">ktci5/web 저장소</a></div>
<div class="ch-desc"><p>여기서 설명한 코드 전부. 읽어보셔도 되고 고쳐서 제안하셔도 됩니다.</p></div></div>
<div class="ch"><div class="ch-name">#❓-질문답변</div>
<div class="ch-desc"><p>이해 안 되는 부분은 편하게 물어보세요. 이 문서를 고치는 데 반영합니다.</p></div></div>
</section>`;
}

export const INFRA_CSS =
  'svg.arch{width:100%;height:auto;display:block;margin:4px 0 12px;}' +
  '.hop{padding:16px 0;border-top:1px solid #2a3143;}' +
  '.hop h3{font-size:14.5px;margin:0 0 6px;color:#e8ecf4;}' +
  '.hop-n{color:#8ea1ff;margin-right:4px;}' +
  '.hop > p{margin:0;font-size:13.5px;line-height:1.7;}' +
  '.try{margin:12px 0 0;border-left:2px solid #39415a;padding:6px 0 6px 12px;}' +
  '.try span{display:block;font-size:11px;letter-spacing:.04em;color:#6c7488;margin-bottom:4px;}' +
  '.try pre{margin:0 0 6px;background:#12151c;border-radius:6px;padding:8px 10px;font-size:12.5px;' +
  'overflow-x:auto;color:#c9d3e6;}' +
  '.try p{margin:0;font-size:12.5px;line-height:1.6;color:#a8b2c8;}' +
  'ol.oauth{margin:0;padding-left:20px;font-size:13.5px;line-height:1.6;}' +
  'ol.oauth li{margin:0 0 11px;color:#e8ecf4;}' +
  'ol.oauth li p{margin:2px 0 0;color:#a8b2c8;font-weight:400;}' +
  '.pipe{display:flex;flex-wrap:wrap;gap:8px;margin:4px 0 12px;}' +
  '.pipe div{flex:1 1 130px;background:#232838;border:1px solid #2a3143;border-radius:8px;padding:10px;}' +
  '.pipe code{display:block;background:none;padding:0;color:#8ea1ff;font-size:12.5px;margin-bottom:3px;}' +
  '.pipe span{font-size:11.5px;color:#8a93a8;}' +
  '.lvl{font-size:11px;border-radius:4px;padding:1px 6px;white-space:nowrap;}' +
  '.lvl.pub{background:#20372c;color:#7ee2b8;}' +
  '.lvl.pri{background:#3a2a2a;color:#e6a58a;}' +
  '.tm{display:flex;gap:12px;padding:9px 0;border-top:1px solid #232838;align-items:baseline;}' +
  '.tm code{flex:0 0 30%;background:none;padding:0;color:#8ea1ff;font-size:13px;}' +
  '.tm p{margin:0;flex:1;font-size:13px;line-height:1.6;}' +
  '@media(max-width:520px){.tm{display:block}.tm code{margin-bottom:3px;display:block}}' +
  '.lvnavwrap{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0 26px;}' +
  '.lvnav{flex:1 1 150px;display:flex;gap:9px;align-items:center;text-decoration:none;' +
  'background:#232838;border:1px solid #2a3143;border-radius:9px;padding:10px;}' +
  '.lvnav:hover{border-color:#5865F2;}' +
  '.lvnav-tag{flex:0 0 28px;height:28px;border-radius:7px;background:#2d3446;color:#8ea1ff;' +
  'font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;}' +
  '.lvnav-b{display:block;font-size:11.5px;color:#8a93a8;line-height:1.4;}' +
  '.lvnav-b strong{display:block;color:#e8ecf4;font-size:13px;margin-bottom:1px;}' +
  '.lvhead{display:flex;gap:12px;align-items:flex-start;margin:38px 0 10px;' +
  'padding-top:22px;border-top:2px solid #2d3446;}' +
  '.lvhead-tag{flex:0 0 40px;height:40px;border-radius:9px;background:#5865F2;color:#fff;' +
  'font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;}' +
  '.lvhead h2{margin:2px 0 4px;font-size:17px;}' +
  '.lvhead .lead{margin:0;font-size:13px;}' +
  'h3.sub{font-size:14.5px;margin:26px 0 6px;color:#e8ecf4;}' +
  'ol.simple{margin:0;padding-left:20px;font-size:14px;line-height:1.6;}' +
  'ol.simple li{margin:0 0 12px;color:#e8ecf4;}' +
  'ol.simple li p{margin:2px 0 0;color:#a8b2c8;font-weight:400;font-size:13.5px;}' +
  'pre.code{background:#12151c;border:1px solid #2a3143;border-radius:8px;padding:12px;' +
  'font-size:12px;line-height:1.65;overflow-x:auto;color:#c9d3e6;margin:10px 0 0;}';
