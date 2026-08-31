# ktci5.kr 인수인계 문서

KT클라우드 인프라교육 5기 스터디용 디스코드 자동 인증 + 학습 자료 서비스.
다른 도구/에이전트에서 이어서 작업할 때 이 문서부터 읽으면 됩니다.

마지막 갱신: 2026-08-29

---

## 1. 한 줄 요약

Cloudflare Workers 하나(`src/index.js`)가 `ktci5.kr` 전체 트래픽을 받아
**디스코드 OAuth 인증 → 역할 부여 → 인증된 사람만 학습 자료 열람**까지 처리합니다.
슬래시 명령(일정 등록, 자료 검색 등)도 같은 Worker 의 인터랙션 엔드포인트가 받습니다.

---

## 2. 저장소 구조

| 저장소 | 공개 | 내용 | 로컬 경로 |
| --- | --- | --- | --- |
| `ktci5/web` | 공개 | 이 저장소 — Worker 코드와 운영 스크립트 | `~/Documents/GitHub/ktci5` |
| `ktci5/study` | 공개 | 스터디 자료, 자격증 정리 | — |
| `ktci5/data` | **비공개** | 수강생 명단, 강의 정리 노트 원본 | `~/Documents/GitHub/ktci5-data` |
| `ktci5/project1~3` | **비공개** | 프로젝트 결과물 | — |

### 지켜야 할 원칙

- **강의 PDF 원본은 웹에도, 공개 저장소에도 올리지 않습니다.** 로컬(`~/Downloads`)에만 둡니다.
- **실명·명단은 KV 와 비공개 저장소에만** 둡니다. 코드나 커밋에 넣지 않습니다.
- 정리 노트(`course-notes/`)는 비공개 저장소에서 작성하고 KV 로 업로드합니다.
- 웹의 `/guide`, `/study/*` 는 **인증된 사람만** 볼 수 있어야 합니다.

---

## 3. 배포 구조

```
GitHub ktci5/web  ──push──▶  Workers Builds  ──▶  Worker "web"  ──▶  ktci5.kr
                              (npm run check)                        project1~3.ktci5.kr
```

- `wrangler.toml` 의 `name = "web"` 은 **대시보드의 Worker 이름과 반드시 일치**해야 합니다.
- 빌드 명령은 `npm run check` (문법 검사만). 바꾸면 CI 가 깨집니다.
- 수동 배포: `npx wrangler deploy`
- 로그: `npx wrangler tail`

### 라우트

| 패턴 | 용도 |
| --- | --- |
| `ktci5.kr` | 본 서비스 |
| `project1~3.ktci5.kr` | 프로젝트 자리 — 지금은 "준비 중" 안내 (`src/projects.js`) |

---

## 4. 환경 변수와 시크릿

### `wrangler.toml [vars]` — 공개돼도 되는 값

`DISCORD_GUILD_ID`, `REDIRECT_URI`, `LINKED_ROLE_REDIRECT_URI`,
`BOT_REDIRECT_URI`, `DISCORD_INVITE_URL`, `AUTO_JOIN`

### 시크릿 — `wrangler secret put` 으로만 등록

```
DISCORD_CLIENT_ID          DISCORD_CLIENT_SECRET     DISCORD_BOT_TOKEN
DISCORD_ROLE_ID            DISCORD_PUBLIC_KEY        PREVIEW_KEY
GOOGLE_SA_EMAIL            GOOGLE_SA_PRIVATE_KEY_B64 GOOGLE_CALENDAR_ID
ADMIN_CHANNEL_ID           DRIVE_NOTIFY_CHANNEL_ID
```

등록 방법:

```bash
cp .dev.vars.example .dev.vars    # 값을 채운 뒤
bash scripts/setup-secrets.sh
```

> **주의** — `setup-secrets.sh` 는 TTY 가 없으면 거부합니다.
> 과거에 비대화형 셸로 실행해 **시크릿이 전부 빈 값으로 덮여** 서비스가 멈춘 적이 있습니다.
> 반드시 실제 터미널에서 실행하세요.

> **알려진 불일치** — `.dev.vars.example` 에 `PREVIEW_KEY` 와 `DRIVE_NOTIFY_CHANNEL_ID` 가
> 빠져 있습니다. 채워 넣으면 좋습니다.

### KV

바인딩 `ROSTER`, 네임스페이스 `1cd43df3876249819b8627bb22b1c7a8`

| 키 | 내용 |
| --- | --- |
| `roster` | 수강생 명단 (실명 — 저장소에 없음) |
| `course:index` | 과목 목록 |
| `course:<과목>` | 과목 메타 + 장 목록 |
| `course:<과목>:notes` | 장별 정리 노트 본문 |
| `drive:pageToken` | 드라이브 변경 감지 커서 |
| `verify:<userId>` 등 | 인증 기록 |

---

## 5. 파일 지도

### `src/`

| 파일 | 줄 수 | 역할 |
| --- | --- | --- |
| `index.js` | ~2,390 | 라우터, OAuth, 인터랙션, 슬래시 명령, 구글 연동, 모든 페이지 |
| `course.js` | 224 | 강의 정리 뷰어 — KV 로딩, 마크다운 렌더러, CSS |
| `study-linux.js` | 285 | 리눅스 CLI 심층 가이드 (인증 필요) |
| `study-infra.js` | 397 | 인프라 가이드 (인증 필요) |
| `projects.js` | 79 | project1~3 준비 중 페이지 |

`index.js` 가 큽니다. 나눌 때는 **페이지 렌더 함수부터** 떼어내는 게 안전합니다
(라우터와 인증 로직은 서로 엮여 있습니다).

### `scripts/` — 전부 일회성 운영 도구

| 스크립트 | 하는 일 |
| --- | --- |
| `_env.mjs` | 공통 — `.dev.vars` + `wrangler.toml [vars]` + 환경변수를 읽고 디스코드 API 호출 (429 재시도 포함) |
| `setup-secrets.sh` | 시크릿 일괄 등록 |
| `setup-google.mjs` | 서비스 계정 키(JSON)를 시크릿 형태로 변환 |
| `register-app-urls.mjs` | Developer Portal 의 4개 URL 등록 |
| `register-commands.mjs` | 슬래시 명령 등록 |
| `register-role-metadata.mjs` | 연결된 역할 메타데이터 등록 |
| `upload-roster.mjs` | `list.csv` → KV `roster` |
| `upload-course.mjs` | PDF → 장 구조를 KV 에 등록 |
| `upload-notes.mjs` | 정리 노트 마크다운 → KV |
| `create-channels.mjs` | 채널 생성 (`--apply` 없으면 미리보기) |
| `set-channel-topics.mjs` | 채널 주제 일괄 설정 |
| `post-channel-intros.mjs` | 채널별 사용법 안내 게시 |
| `post-messages.mjs` | 공지/환영 메시지 발송 |
| `create-drive-folders.mjs` | 채널 구조와 같은 드라이브 폴더 생성 |

---

## 6. 라우트

```
GET  /                        인증 여부에 따라 다른 랜딩
GET  /discord                 디스코드 연동 허브
GET  /discord/join            초대 링크로 리디렉션
GET  /discord/verify          OAuth 시작
GET  /discord/callback        OAuth 콜백 → 역할 부여 → 통행증 발급
GET  /discord/bot             봇 초대
GET  /discord/bot/callback    봇 초대 콜백 (code grant 대응)
GET  /discord/linked-role           연결된 역할 인증
GET  /discord/linked-role/callback
POST /discord/interactions    ★ 슬래시 명령·버튼 (Ed25519 서명 검증)
GET  /discord/status          진단용 JSON
GET  /guide                   채널 사용법          🔒
GET  /study                   학습 자료 목록        🔒
GET  /study/linux             리눅스 심층 가이드    🔒
GET  /study/infra             인프라 가이드        🔒
GET  /study/course            과목 목록            🔒
GET  /study/course/<과목>          장 목록          🔒
GET  /study/course/<과목>/<장>     본문            🔒
GET  /preview?key=…           운영진 미리보기 통행증 (14일)
GET  /terms  /privacy         약관·개인정보
GET  /robots.txt
```

🔒 = `guarded()` — 서명된 `ktci5_pass` 쿠키가 없으면 302

### 경로 규칙

**URL 경로에 한글을 쓰지 마세요.** `url.pathname` 은 퍼센트 인코딩된 상태라
`/study/linux/기초` 같은 경로는 매칭에 실패합니다. 과목·장 ID 는 전부 ASCII 입니다.

---

## 7. 인증 흐름

```
1. 사용자가 /discord/verify 클릭
2. 디스코드 OAuth (scope: identify guilds.join)
3. 콜백에서 KV roster 조회
   ├ 디스코드 ID 가 명단에 있음      → 즉시 인증
   ├ 없으면 이름 선택 UI(버튼/셀렉트) → 선택하면 인증
   └ 그래도 없으면                  → 관리자 채널에 승인 요청
4. 길드 역할 "5기인증" 부여
5. ktci5_pass 쿠키 발급 (HMAC-SHA256 서명, 30일)
```

명단 확인은 **내부적으로만** 합니다. 화면에 디스코드 ID 를 노출하지 않습니다.
사용자는 클릭/선택만 하면 되도록 설계돼 있습니다.

### 통행증 형식

```
ktci5_pass = <userId>.<만료시각>.<HMAC-SHA256(userId.만료시각) base64url>
```

---

## 8. 강의 정리 파이프라인

PDF 를 웹 학습 자료로 만드는 절차입니다. **원본 슬라이드는 웹에 올리지 않습니다.**
사람이 읽을 수 있게 다시 쓴 정리본만 올라갑니다.

```
① PDF 목차 파악
   pdftotext -layout -f <시작> -l <끝> "파일.pdf" -

   ─ 텍스트가 거의 안 나오면 슬라이드가 스크린샷입니다.
     그때는 Read 도구로 쪽을 이미지로 읽습니다 (한 번에 최대 20쪽).
     쪽별 글자 수로 미리 확인할 수 있습니다:
       for p in $(seq 1 N); do
         pdftotext -f $p -l $p "파일.pdf" - | tr -d '[:space:]' | wc -c
       done

   ─ 파일이 나뉘어 있으면 먼저 합칩니다:  pdfunite a.pdf b.pdf out.pdf

② scripts/upload-course.mjs 의 COURSES 에 과목·장 등록
   { id, name, from: <시작 페이지>, summary }

③ 장 구조 업로드
   node scripts/upload-course.mjs <과목> <PDF경로>
   (--dry-run 으로 먼저 확인)

④ ktci5-data/course-notes/<과목>/<장ID>.md 작성
   ─ 슬라이드를 그대로 옮기지 말 것
   ─ "왜 그렇게 되는지"를 붙여 다시 쓸 것
   ─ 실무 예제를 각 장 끝에 넣을 것

⑤ 노트 업로드
   node scripts/upload-notes.mjs <과목> [장ID...]
   (장 ID 를 주면 그것만, 생략하면 전부)

⑥ 확인
   https://ktci5.kr/study/course/<과목>/<장>
```

### 노트 마크다운 형식

```markdown
---
id: cond
title: 조건문과 종료 상태
lead: if · case · test 로 갈래를 나눕니다.
---

## 소제목

본문. 표, 코드블록, 인용을 쓸 수 있습니다.
```

렌더러는 `src/course.js` 의 `markdown()` — **직접 만든 것**이라
지원하는 문법이 제한적입니다. `##`~`####`, 표, ` ``` ` 코드블록, `-` 목록,
`>` 인용, `---`, `**굵게**`, `` `코드` `` 정도입니다.
새 문법이 필요하면 렌더러를 먼저 손봐야 합니다.

### 현재 등록된 과목

| 과목 ID | 제목 | 장 | 상태 |
| --- | --- | --- | --- |
| `linux` | Linux 기초 | 10 | ✅ 완료 |
| `bash` | Shell Programming | 8 | ✅ 완료 |
| `admin` | Linux 관리자 | 19 | ✅ 완료 |

---

## 9. 디스코드 슬래시 명령

| 명령 | 하는 일 |
| --- | --- |
| `/인증` | 본인 인증 시작 |
| `/인증패널` | 채널에 인증 버튼 패널 설치 (운영진) |
| `/일정등록` | 구글 캘린더에 스터디 일정 등록 (제목·날짜·시각·시간·장소·지역·주제·온라인) |
| `/오늘일정` | 오늘 일정 조회 |
| `/자료함` | 드라이브 폴더 열기 |
| `/자료보기` | 폴더 내용 보기 |
| `/자료검색` | 드라이브 검색 |
| `/스터디자료` | 깃허브 스터디 자료 탐색 |

명령을 고쳤으면 **반드시 재등록**해야 반영됩니다.

```bash
npm run register:commands
```

---

## 10. 반드시 알아야 할 함정

과거에 실제로 겪은 것들입니다. 같은 실수를 반복하지 않도록 적어 둡니다.

| 함정 | 증상 | 대응 |
| --- | --- | --- |
| **비ASCII HTTP 헤더** | `TypeError: Cannot convert argument to a ByteString` | `x-audit-log-reason` 등에 한글을 넣을 때 `encodeURIComponent()` 필수 |
| **URL 경로 한글** | 404 | 경로는 ASCII 만 |
| **역할 계층** | 역할 부여 403 | 봇 역할이 `5기인증` 보다 **위**에 있어야 함 |
| **`DISCORD_ROLE_ID` 혼동** | 인증은 되는데 역할이 안 붙음 | 길드 ID 는 `@everyone` 역할입니다. 실제 역할 ID 를 넣으세요 |
| **Cloudflare Access** | 익명 접근만 302 (본인 브라우저는 정상) | 브라우저로 확인하지 말고 `curl` 로 확인 |
| **비대화형 시크릿 등록** | 시크릿이 빈 값이 됨 | 실제 터미널에서만 `setup-secrets.sh` |
| **채널 권한 PATCH** | 봇이 채널을 못 봄 | `permission_overwrites` 를 통째로 바꿀 때 **봇을 반드시 포함** |
| **배포 직후 확인** | 옛 내용이 보임 | 전파를 기다린 뒤 재확인 |
| **`README.md`** | 장으로 잘못 인식 | `upload-notes.mjs` 가 걸러냅니다 |

### 확인 방법

```bash
# 서비스 상태
curl -s https://ktci5.kr/discord/status | jq
# → ok, interactions, calendar, roster, adminChannel 이 모두 true 여야 정상

# 게이팅 동작 확인 (302 가 나와야 정상)
curl -s -o /dev/null -w "%{http_code}\n" https://ktci5.kr/study/course/bash/flow

# 인증된 상태로 확인
curl -s -c /tmp/ck "https://ktci5.kr/preview?key=$PREVIEW_KEY" -o /dev/null
curl -s -b /tmp/ck https://ktci5.kr/study/course/bash/flow | head
```

---

## 11. 디스코드 서버 구조

3대 역량 트랙 커리큘럼에 맞춘 구조입니다.

```
01. WELCOME
03. TRACK A · Cloud Infra      인프라 개요 / 네트워크 / 클라우드 / 컨테이너 / DB
04. 지역모임                    충청 / 경상 / 전라 / 강원·제주
05. 공부자료
06. 그룹스터디
07. 휴식
08. 자격증                      AWS / 클라우드 / 네트워크 / 리눅스 / K8s / 정처기 / 정보보안 / SQLD
TRACK B · DevOps 🔒            진도가 나가면 공개
TRACK C · AI Cloud/SRE 🔒      진도가 나가면 공개
09. 프로젝트 준비 🔒            운영자 전용
```

🔒 카테고리는 `create-channels.mjs` 의 `private: [사용자ID]` 로 만듭니다.
`@everyone` 의 `VIEW_CHANNEL` 을 막고, 지정한 사람과 **봇**에게만 허용합니다.

진도가 나가서 공개할 때는 `@everyone` 의 deny 만 풀면 됩니다.

---

## 12. 남은 일

### 손봐야 할 것

- [ ] **봇 채널 권한 복구** — `#07. 휴식`, `#08. 자격증` 에서 봇이 채널을 못 봅니다.
      권한 덮어쓰기 실수로 빠졌습니다. 서버 설정에서 봇 역할을 다시 추가해야 합니다.
- [ ] **고아 KV 키 정리** — `course:linux-basic:img:*` 122개.
      슬라이드 이미지 방식을 걷어내며 남은 것으로 지금은 아무도 참조하지 않습니다.
      `course:linux-basic`, `course:linux-basic:notes` 도 같이 정리 대상입니다.
- [ ] **`.dev.vars.example` 보완** — `PREVIEW_KEY`, `DRIVE_NOTIFY_CHANNEL_ID` 누락

### 결정이 필요한 것

- [ ] **채널 중복** — `#자유로운대화` 와 `#💬-자유게시판` 이 겹칩니다.
- [ ] **그룹 채널 문구** — `#🔒-그룹1~3` 이 아직 "배정된 그룹" 이라고 안내합니다.
      "조를 나누지 말고 다 같이 가자" 는 방향과 맞지 않습니다.
- [ ] **`ktci5/study` GitHub Pages** — 아직 꺼져 있어 치트시트 링크가 저장소로 갑니다.

### 참고 — 공개 저장소 히스토리

`ktci5/web` 히스토리(커밋 `5814f8e` 이전)에 리눅스 정리 노트 10개가 남아 있습니다.
명단 CSV 나 PDF 원본은 **들어간 적 없습니다.** 노트는 직접 쓴 정리본이라
심각한 문제는 아니지만, 완전히 지우려면 `git filter-repo` 후 강제 푸시가 필요합니다.
아직 결정하지 않았습니다.

### 다음 과목

같은 방식으로 이어가면 됩니다. 8절의 파이프라인을 그대로 따르세요.

---

## 13. 빠른 시작

```bash
cd ~/Documents/GitHub/ktci5
npm install
cp .dev.vars.example .dev.vars     # 값 채우기
npm run check                      # 문법 검사
npx wrangler dev                   # 로컬 실행

# 비공개 노트 저장소도 함께 필요합니다
git clone https://github.com/ktci5/data.git ~/Documents/GitHub/ktci5-data
```
