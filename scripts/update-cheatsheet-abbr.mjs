import fs from 'fs';
import path from 'path';

const portalFile = path.resolve('src/portal_html.js');
let content = fs.readFileSync(portalFile, 'utf8');

// The 66 abbreviations mapped by index / name
const ABBR_MAP = [
  // 1: Docker 원클릭 설치 & 소켓 권한 부여
  "usermod = User Modify (사용자 계정 정보 수정) · newgrp = New Group (새 그룹으로 전환/적용)",
  // 2: docker run 대화형 컨테이너 실행
  "-i = Interactive (대화형 표준입력 유지) · -t = TTY (가상 터미널 할당)",
  // 3: 컨테이너 목록 조회 & 정리 (ps, rm, rmi)
  "ps = Process Status (프로세스 상태) · rm = Remove (컨테이너 삭제) · rmi = Remove Image (이미지 삭제)",
  // 4: 포트 포워딩 웹 컨테이너 백그라운드 구동 (-p, -d)
  "-d = Detached Mode (백그라운드 데몬 실행) · -p = Port Publish (포트 바인딩/포워딩)",
  // 5: docker exec & 포그라운드 데몬 제어 (daemon off)
  "exec = Execute (명령 실행) · daemon off = Foreground Mode (포그라운드 모드로 PID 1 유지)",
  // 6: 컨테이너 내부 웹 리소스 수정 & 핫픽스
  "exec = Execute (컨테이너 내부 셸 명령 즉시 실행) · bash = Bourne Again Shell",
  // 7: 컨테이너 가상 사설 IP 조회 & 통신 검증
  "inspect = Inspect (컨테이너 메타데이터 검사) · IP = Internet Protocol",
  // 8: Dockerfile 작성 및 커스텀 Nginx 이미지 빌드
  "FROM = Base Image (기반 이미지) · RUN = Run Build (빌드 실행) · CMD = Command (기본 실행 명령)",
  // 9: Docker Hub 태깅 & 원격 레지스트리 푸시
  "tag = Tag / Alias (이미지 식별 태그) · push = Push to Registry (원격 레지스트리 업로드)",
  // 10: 팀원(짝꿍) 이미지 풀 & 포트 분리 상호 배포 검증
  "run = Run Container (컨테이너 구동) · curl = Client URL (HTTP 요청 검증)",
  // 11: 호스트 볼륨 바인드 마운트 (데이터 영속성)
  "-v = Volume Mount (호스트 볼륨 마운트) · :ro = Read-Only (읽기 전용 모드)",
  // 12: 사용자 정의 브릿지 네트워크 생성 & 컨테이너 DNS 통신
  "net = Network (가상 브릿지 네트워크) · DNS = Domain Name System (컨테이너 이름 해석)",
  // 13: Docker Compose 다중 컨테이너 선언형 오케스트레이션
  "compose = Compose (서비스 구성) · up = Bring Up Services (스택 전체 기동) · -d = Detached",
  // 14: 도커 디스크 사용량 분석 및 가비지 컬렉션 (prune)
  "df = Disk Free (용량 통계) · prune = Prune / Trim (불필요한 미사용 리소스 일괄 가지치기)",
  // 15: lsblk 디스크 블록 장치 상세 일람
  "lsblk = List Block Devices (블록 장치 계층 목록 출력)",
  // 16: df -h 파일시스템 여유 용량 점검
  "df = Disk Free (디스크 여유 공간) · -h = Human-readable (GB/MB 단위) · -T = Filesystem Type",
  // 17: parted GPT 대용량 파티션 생성 (2TB+ 지원)
  "parted = Partition Editor (파티션 편집기) · GPT = GUID Partition Table (전역 고유 식별 파티션)",
  // 18: mkfs.xfs / mkfs.ext4 파일시스템 포맷
  "mkfs = Make File System (파일시스템 생성) · XFS / ext4 = eXtended File System (확장 파일시스템)",
  // 19: mount & /etc/fstab 영구 마운트 등록 (UUID 기반)
  "fstab = File Systems Table (파일시스템 테이블) · blkid = Block Device ID (블록 고유 식별자)",
  // 20: du 대용량 디렉토리 추적
  "du = Disk Usage (디스크 사용 용량) · -h = Human-readable · max-depth = 검색 깊이 제한",
  // 21: LVM 3계층 물리 볼륨(PV) & 볼륨 그룹(VG) 생성
  "PV = Physical Volume (물리 볼륨) · VG = Volume Group (볼륨 그룹) · LVM = Logical Volume Manager",
  // 22: LVM 논리 볼륨(LV) 생성 및 마운트
  "LV = Logical Volume (논리 볼륨) · mkfs = Make File System (파일시스템 포맷)",
  // 23: Swap 메모리 파티션 생성 & 동적 활성화
  "mkswap = Make Swap (가상 메모리 영역 생성) · swapon = Swap On (스왑 공간 활성화)",
  // 24: df -i Inode 점검 (파일 개수 한도)
  "df -i = Disk Free Inodes (인덱스 노드 잔여량) · Inode = Index Node (파일 메타데이터 노드)",
  // 25: NFS 네트워크 공유 스토리지 서버 설정 & 마운트
  "NFS = Network File System (네트워크 분산 파일시스템) · rw = Read / Write (읽기/쓰기)",
  // 26: LVM 무중단 온라인 볼륨 확장 (XFS / ext4)
  "lvextend = Logical Volume Extend (LV 용량 확장) · xfs_growfs = XFS Grow File System (XFS 확장)",
  // 27: LVM 스냅샷 백업 생성 & 롤백 (Merge)
  "-s = Snapshot (순간 복제본) · merge = Merge Snapshot (스냅샷 상태로 원상태 병합 복구)",
  // 28: mdadm 소프트웨어 RAID 1 (미러링) 구축
  "mdadm = Multiple Devices Administrator (복수 장치 관리자) · RAID = Redundant Array of Independent Disks",
  // 29: RAID 디스크 고장 시뮬레이션 & 핫스왑 리빌딩
  "fail = Mark Failed (결함 표기) · remove = Remove Device (제거) · add = Add Spare (여분 장치 교체)",
  // 30: xfsdump / xfsrestore 증분 백업 및 복원
  "xfsdump = XFS Dump (XFS 파일시스템 덤프 백업) · xfsrestore = XFS Restore (XFS 복원)",
  // 31: systemd journald 시스템 로그 디스크 영구 보존
  "journald = Journal Daemon (저널 로깅 데몬) · sed = Stream Editor (스트림 치환 편집기)",
  // 32: iostat 실시간 디스크 I/O 병목 및 지연 측정
  "iostat = Input / Output Statistics (입출력 I/O 통계 분석기) · await = Average Wait Time",
  // 33: 삭제되었으나 프로세스가 쥐고 있는 유령 용량 해제
  "lsof = List Open Files (열린 파일 목록) · truncate = Truncate (파일 크기 즉시 0 절삭)",
  // 34: cd / pwd / ls 현재 위치 및 숨김 파일 조회
  "pwd = Print Working Directory (현재 작업 경로) · ls = List (목록 출력) · cd = Change Directory",
  // 35: mkdir -p / ln -s 심볼릭 링크 원자적 교체
  "mkdir = Make Directory (디렉토리 생성) · ln -s = Symbolic Link (심볼릭 바로가기 링크)",
  // 36: find -mtime + exec 오래된 파일 자동 아카이빙
  "find = Find (파일 검색) · mtime = Modification Time (수정 일자) · exec = Execute (명령 실행)",
  // 37: find + xargs 병렬 처리 (대량 파일 초고속 삭제)
  "xargs = Extended Arguments (확장 인자 변환 실행) · -P = Parallel (CPU 병렬 처리)",
  // 38: rsync 증분 동기화 및 SSH 원격 미러링
  "rsync = Remote Synchronization (원격 증분 동기화) · -a = Archive · -v = Verbose · -z = Compress",
  // 39: cat / head / tail 빠른 파일 검토
  "cat = Concatenate (파일 출력) · head = Head (앞부분 행) · tail = Tail (끝부분 행)",
  // 40: tail -f & grep 실시간 로그 에러 감시
  "tail -f = Follow (실시간 추적) · grep = Global Regular Expression Print (전역 정규식 검색)",
  // 41: sed 설정 파일 비대화식 일괄 치환
  "sed = Stream Editor (스트림 편집기) · -i = In-place Edit (파일 직접 치환)",
  // 42: awk 컬럼 필터 & 상태코드 집계
  "awk = Aho · Weinberger · Kernighan (개발자 3인 성명을 딴 텍스트 패턴 처리 언어)",
  // 43: jq 구조화 JSON 로그 파싱 & 추출
  "jq = JSON Query (커맨드라인 JSON 데이터 질의 파서)",
  // 44: ps / top 실시간 시스템 부하 점검
  "ps = Process Status (프로세스 상태) · top = Table of Processes (실시간 작업 관리자)",
  // 45: ps -ef & kill 우아한 프로세스 종료 (SIGTERM)
  "kill = Send Signal (시그널 전송) · SIGTERM = Signal Terminate (정상 종료 신호, 번호 15)",
  // 46: ps CPU/메모리 최상위 프로세스 정렬
  "ps -eo = Process Status Exact Output (포맷 지정 조회) · pid = Process ID",
  // 47: lsof 열린 파일 디스크립터 및 활성 소켓 추적
  "lsof = List Open Files (열려있는 파일/소켓 목록) · pgrep = Process Grep (프로세스 검색)",
  // 48: strace 시스템 콜 지연시간 프로파일링
  "strace = System Call Trace (커널 시스템 콜 및 시그널 추적기)",
  // 49: ip addr / ip link 인터페이스 상태 점검
  "ip addr = IP Address (인터넷 프로토콜 주소) · ip link = Data Link (네트워크 인터페이스 링크)",
  // 50: curl HTTP 구간별 응답 지연시간(TTFB) 정밀 측정
  "curl = Client URL (URL 데이터 전송 클라이언트) · TTFB = Time To First Byte (첫 응답 수신 시간)",
  // 51: nc (netcat) 포트 스캔 및 방화벽 개방 점검
  "nc = Netcat (네트워크 TCP/UDP 포트 연결 및 분석 도구)",
  // 52: ss 초고속 TCP 연결 상태 분포 분석
  "ss = Socket Statistics (커널 소켓 통계 분석기 - netstat 대비 100배 고속)",
  // 53: tcpdump L7 HTTP 패킷 페이로드 캡처
  "tcpdump = TCP Dump (네트워크 패킷 캡처 및 패킷 덤프 분석기)",
  // 54: chmod +x / sudo 스크립트 실행 권한 부여
  "chmod = Change Mode (파일 권한 모드 변경) · sudo = Superuser Do (최고 관리자 권한 대행)",
  // 55: chown 소유권 이전 및 표준 웹 디렉토리 권한
  "chown = Change Owner (파일/디렉토리 소유자 및 소유그룹 변경)",
  // 56: SSH 무차별 대입 공격 IP 색출 및 차단 목록화
  "grep = Global Regular Expression Print (정규표현식 일치 라인 필터링)",
  // 57: setfacl 세부 접근제어 목록 (ACL) 상속
  "setfacl = Set File Access Control Lists (파일 세부 접근제어 목록 설정) · ACL = Access Control List",
  // 58: chattr +i 커널 불변(Immutable) 속성 락
  "chattr = Change Attribute (파일 속성 변경) · +i = Immutable (불변 잠금) · lsattr = List Attribute",
  // 59: vmstat 시스템 런큐 및 컨텍스트 스위칭 진단
  "vmstat = Virtual Memory Statistics (가상 메모리 및 CPU 프로세스 통계 분석기)",
  // 60: bpftrace eBPF 커널 레벨 TCP 연결 실시간 추적
  "bpftrace = eBPF Trace (커널 레벨 프로그래머블 트레이서) · eBPF = Extended Berkeley Packet Filter",
  // 61: sysctl 대규모 트래픽 대비 TCP 커널 파라미터 튜닝
  "sysctl = System Control (리눅스 커널 런타임 매개변수 동적 제어)",
  // 62: API 응답 지연 종합 진단 파이프라인
  "journalctl = Journal Control (저널 로그 제어) · tail = 끝부분 출력 · awk = 필드 필터링",
  // 63: Docker 미사용 빌드 캐시 및 오래된 볼륨 일괄 정리
  "prune = Prune / Trim (도커 미사용 이미지/컨테이너/볼륨/빌드캐시 일괄 정리 회수)",
  // 64: OOM (Out Of Memory) 킬러 프로세스 추적
  "dmesg = Display Message (커널 링 버퍼 로그) · OOM = Out Of Memory (메모리 고갈 킬러)",
  // 65: 디스크 100% 긴급 대응 LVM 온라인 무중단 증설 파이프라인
  "vgs = VG Status · lvextend = Logical Volume Extend (LV 확장) · xfs_growfs = XFS 온라인 확장",
  // 66: 도커 컨테이너 비정상 종료(Exit Code) 역추적 파이프라인
  "ps = Process Status (상태 조회) · inspect = 상세 분석 · logs = 표준출력/에러 로그 추적"
];

// Let's inspect how the HTML is structured in src/portal_html.js
import("../src/portal_html.js").then(m => {
  let html = m.PORTAL_HTML;
  const matchData = html.match(/const data = (\[[\s\S]*?\]);\n/);
  if (!matchData) {
    console.error("Could not find const data in PORTAL_HTML");
    process.exit(1);
  }

  const data = JSON.parse(matchData[1]);
  console.log(`Found ${data.length} items`);
  if (data.length !== ABBR_MAP.length) {
    console.error(`Mismatch: data has ${data.length}, map has ${ABBR_MAP.length}`);
    process.exit(1);
  }

  for (let i = 0; i < data.length; i++) {
    data[i].abbr = ABBR_MAP[i];
  }

  // Update data array in html
  const updatedDataStr = `const data = ${JSON.stringify(data, null, 6)};\n`;
  html = html.replace(matchData[0], updatedDataStr);

  // Update matchQ search filter to include item.abbr
  const oldMatchQ = `const matchQ = !q || 
                       item.name.toLowerCase().includes(q) || 
                       item.cmd.toLowerCase().includes(q) ||`;
  const newMatchQ = `const matchQ = !q || 
                       item.name.toLowerCase().includes(q) || 
                       (item.abbr && item.abbr.toLowerCase().includes(q)) || 
                       item.cmd.toLowerCase().includes(q) ||`;
  if (!html.includes(oldMatchQ)) {
    console.error("Could not find oldMatchQ in html");
    process.exit(1);
  }
  html = html.replace(oldMatchQ, newMatchQ);

  // Update card rendering in grid.innerHTML
  const oldHeading = `<h4 class="text-base font-bold text-white group-hover:text-blue-400 transition-colors">\${item.name}</h4>
            <p class="text-xs text-slate-400 mt-1 leading-relaxed">\${item.desc}</p>`;
  
  const newHeading = `<h4 class="text-base font-bold text-white group-hover:text-blue-400 transition-colors">\${item.name}</h4>
            \${item.abbr ? \`
              <div class="mt-2 mb-2 px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start gap-1.5 text-[11px] leading-relaxed">
                <span class="text-amber-400 font-semibold shrink-0">🔤 단축어:</span>
                <span class="text-slate-300 font-mono font-medium">\${item.abbr}</span>
              </div>
            \` : ''}
            <p class="text-xs text-slate-400 mt-1 leading-relaxed">\${item.desc}</p>`;

  if (!html.includes(oldHeading)) {
    console.error("Could not find oldHeading in html");
    process.exit(1);
  }
  html = html.replace(oldHeading, newHeading);

  // Now serialize back to `export const PORTAL_HTML = ${JSON.stringify(html)};\n`
  const newExport = `export const PORTAL_HTML = ${JSON.stringify(html)};\n`;
  fs.writeFileSync(portalFile, newExport, 'utf8');
  console.log("Successfully updated src/portal_html.js with abbr!");
});
