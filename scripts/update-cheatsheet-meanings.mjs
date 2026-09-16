import fs from 'fs';
import path from 'path';

const portalFile = path.resolve('src/portal_html.js');

const MEANINGS = [
  // 1. Docker 원클릭 설치 & 소켓 권한 부여
  "usermod(User Modify: 사용자 정보 수정) · newgrp(New Group: 새 그룹 즉시 적용) — 관리자 권한(sudo) 없이도 일반 사용자가 도커 소켓(/var/run/docker.sock)을 통해 도커 엔진을 직접 제어할 수 있도록 docker 그룹 권한을 부여하고 즉시 갱신",

  // 2. docker run 대화형 컨테이너 실행
  "-i(Interactive: 표준입력 유지) · -t(TTY: 가상 터미널 할당) — 호스트 터미널에서 격리된 컨테이너 내부의 리눅스 셸(bash)로 직접 키보드 입력을 전달하고 화면 출력을 실시간으로 대화형 조작",

  // 3. 컨테이너 목록 조회 & 정리 (ps, rm, rmi)
  "ps(Process Status: 프로세스 상태) · rm(Remove: 컨테이너 삭제) · rmi(Remove Image: 이미지 삭제) — 실행 중이거나 중지된 컨테이너 목록을 확인하고, 생명주기가 끝난 컨테이너 인스턴스와 불필요한 기본 이미지를 완전히 제거하여 디스크 용량 회수",

  // 4. 포트 포워딩 웹 컨테이너 백그라운드 구동 (-p, -d)
  "-d(Detached: 터미널과 분리되어 백그라운드 상주 실행) · -p(Publish: 포트 개방/바인딩) — 터미널을 닫아도 웹서버가 종료되지 않도록 백그라운드로 띄우고, 외부 클라이언트가 호스트 IP:포트로 컨테이너 내부 웹 서비스에 접속할 수 있도록 포트 포워딩 연결",

  // 5. docker exec & 포그라운드 데몬 제어 (daemon off)
  "exec(Execute: 실행 중인 컨테이너에 명령 실행) · daemon off(백그라운드 비활성화) — 도커는 1번 메인 프로세스(PID 1)가 끝나면 컨테이너가 즉시 꺼지므로, Nginx가 백그라운드로 숨지 않고 화면 앞에 머물도록 강제하여 컨테이너 생존을 유지하는 원리",

  // 6. 컨테이너 내부 웹 리소스 수정 & 핫픽스
  "exec(Execute: 명령 실행) — 컨테이너 이미지를 다시 빌드하거나 서비스를 재시작하지 않고도, 가동 중인 컨테이너 내부 파일시스템(/var/www/html)으로 직접 침투하여 웹 문서나 설정 파일을 실시간 즉시 수정(핫픽스)",

  // 7. 컨테이너 가상 사설 IP 조회 & 통신 검증
  "inspect(세부 메타데이터 검사) — 도커 가상 스위치(docker0)가 컨테이너에 동적으로 발급한 사설 네트워크 IP 주소를 확인하고, 호스트 내부에서 curl을 통해 포트 바인딩 없이도 직접 통신이 되는지 네트워크 정합성 검증",

  // 8. Dockerfile 작성 및 커스텀 Nginx 이미지 빌드
  "FROM(기반 베이스 이미지 지정) · RUN(빌드 시 패키지 설치 실행) · COPY(호스트 파일을 이미지 안으로 복사) · CMD(컨테이너 기동 시 실행할 기본 명령어) — 코드형 인프라(IaC)로 소프트웨어 설치와 환경 구성을 하나의 레시피 문서로 규격화하여 동일한 이미지 빌드",

  // 9. Docker Hub 태깅 & 원격 레지스트리 푸시
  "tag(이미지에 식별 이름/버전 달기) · push(원격 저장소 업로드) — 로컬에서 빌드한 이미지를 본인의 원격 도커 허브 계정 네임스페이스와 버전 태그로 연결하고, 인터넷을 통해 중앙 이미지 저장소(Registry)로 업로드",

  // 10. 팀원(짝꿍) 이미지 풀 & 포트 분리 상호 배포 검증
  "pull(원격 이미지 내려받기) & run(컨테이너 실행) — 동료가 도커 허브에 올린 원격 이미지를 그대로 받아와서 충돌 없는 다른 포트(82번)로 띄워보고, 동일한 웹 애플리케이션이 서로 다른 환경에서도 완벽히 동작하는지 검증",

  // 11. 호스트 볼륨 바인드 마운트 (데이터 영속성)
  "-v(Volume: 저장소 연결/마운트) · :ro(Read Only: 읽기 전용) — 컨테이너는 삭제되면 내부 데이터가 모두 날아가므로, 호스트 디렉토리를 컨테이너 내부에 직접 연결(마운트)하여 컨테이너가 꺼져도 데이터가 영구 보존되도록 보장",

  // 12. 사용자 정의 브릿지 네트워크 생성 & 컨테이너 DNS 통신
  "bridge(가상 네트워크 스위치) · DNS(도메인 이름 해석) — 도커 기본 네트워크와 분리된 커스텀 가상 사설망을 만들어 컨테이너들을 묶으면, 동적으로 바뀌는 IP 주소 대신 '컨테이너 이름'만으로 서로 통신할 수 있는 내장 DNS 통신 지원",

  // 13. Docker Compose 다중 컨테이너 선언형 오케스트레이션
  "compose(구성하다/조립하다) · up(스택 기동) · -d(백그라운드) — 웹서버, API 백엔드, 데이터베이스 등 복잡하게 얽힌 여러 컨테이너들을 하나의 YAML 파일에 정의하고, 단 한 번의 명령으로 네트워크와 볼륨까지 일괄 자동 배포",

  // 14. 도커 디스크 사용량 분석 및 가비지 컬렉션 (prune)
  "df(Disk Free: 용량 점검) · prune(가지치기/미사용 자원 정리) — 도커 컨테이너, 빌드 캐시, 미사용 이미지가 차지하는 디스크 공간을 분석하고, 찌꺼기 자원들을 한 번에 안전하게 삭제하여 디스크 풀(Disk Full) 장애를 긴급 해소",

  // 15. lsblk 디스크 블록 장치 상세 일람
  "lsblk(List Block Devices: 블록 장치 목록) — 하드디스크, SSD, NVMe, 파티션 등 데이터를 블록 단위로 읽고 쓰는 모든 물리 저장 장치와 마운트 지점을 한눈에 알아보기 쉽게 계층 트리 구조로 출력",

  // 16. df -h 파일시스템 여유 용량 점검
  "df(Disk Free: 디스크 여유 공간) — 마운트된 모든 파티션의 전체 크기, 실제 사용량, 남아있는 여유 용량(Free)을 사람이 읽기 편한 단위(-h: GB, MB)와 파일시스템 종류(-T: xfs, ext4)로 확인",

  // 17. parted GPT 대용량 파티션 생성 (2TB+ 지원)
  "parted(Partition Editor: 파티션 분할 편집기) · GPT(GUID Partition Table: 2TB 한계를 넘는 최신 파티션 규격) — 구형 MBR의 2TB 용량 한계를 극복하고 대용량 NVMe/SSD 디스크를 빠르고 유연하게 구획 분할",

  // 18. mkfs.xfs / mkfs.ext4 파일시스템 포맷
  "mkfs(Make File System: 파일시스템 생성) — 원시 파티션(Raw Partition)에 운영체제가 파일과 폴더를 기록하고 검색할 수 있도록 XFS(고성능 대용량 엔터프라이즈)나 ext4 규격으로 디스크를 포맷(초기화)",

  // 19. mount & /etc/fstab 영구 마운트 등록 (UUID 기반)
  "mount(저장소를 폴더에 결합) · fstab(File Systems Table: 부팅 마운트 설정 파일) · blkid(Block Device ID: 장치 고유 식별자) — 서버가 재부팅되어 디스크 장치명이 바뀌더라도 항상 올바른 폴더에 자동 연결되도록 UUID 기반 영구 등록",

  // 20. du 대용량 디렉토리 추적
  "du(Disk Usage: 디스크 사용량) — 디렉토리와 하위 파일들이 실제로 소비하고 있는 용량을 측정하여, 디스크가 꽉 찼을 때 어떤 로그 파일이나 폴더가 용량을 잡아먹고 있는지 주범 색출",

  // 21. LVM 3계층 물리 볼륨(PV) & 볼륨 그룹(VG) 생성
  "LVM(Logical Volume Manager: 논리 볼륨 관리자) — 물리 디스크(PV)의 경계를 허물고 하나의 거대한 가상 스토리지 풀(VG)로 묶어, 나중에 용량이 부족할 때 무중단으로 공간을 늘릴 수 있는 가상화 기반 스토리지 구축",

  // 22. LVM 논리 볼륨(LV) 생성 및 마운트
  "LV(Logical Volume: 논리 볼륨) — 볼륨 그룹(스토리지 풀)에서 필요한 용량(예: 1GB)만큼 가상 파티션을 자유롭게 잘라내어 포맷 후 마운트하는 동적 스토리지 할당",

  // 23. Swap 메모리 파티션 생성 & 동적 활성화
  "swap(맞교환/가상 메모리) — 물리 RAM 메모리가 부족하여 프로그램이 강제 종료(OOM)되는 사태를 막기 위해, 디스크 파티션의 일부를 임시 보조 메모리 공간으로 전환하여 시스템 가용성 유지",

  // 24. df -i Inode 점검 (파일 개수 한도)
  "inode(Index Node: 파일 인덱스 메타데이터 노드) — 디스크 용량(GB)이 많이 남아있더라도 파일 개수 한도(inode)가 100% 꽉 차면 신규 파일 생성이 불가능(No space left on device)하므로 잔여 파일 개수 한도를 점검",

  // 25. NFS 네트워크 공유 스토리지 서버 설정 & 마운트
  "NFS(Network File System: 네트워크 분산 파일시스템) — 여러 대의 웹 서버나 도커 노드가 중앙 스토리지 서버의 특정 폴더(/share)를 마치 자신의 로컬 하드디스크처럼 네트워크를 통해 공동으로 읽고 쓰도록 공유",

  // 26. LVM 무중단 온라인 볼륨 확장 (XFS / ext4)
  "lvextend(Logical Volume Extend: 논리 볼륨 용량 확장) · xfs_growfs(XFS 파일시스템 온라인 증설) — 서비스를 중단하거나 마운트를 해제하지 않고, 운영 중인 상태 그대로 스토리지 공간을 실시간 증설",

  // 27. LVM 스냅샷 백업 생성 & 롤백 (Merge)
  "snapshot(순간 복제본) · merge(병합/원상 복구) — 대규모 시스템 업데이트나 위험한 작업 전 현재 디스크 상태를 사진 찍듯 순간 보관하고, 장애 발생 시 작업 전 상태로 즉시 롤백",

  // 28. mdadm 소프트웨어 RAID 1 (미러링) 구축
  "mdadm(Multiple Devices Administrator: 복수 장치 관리자) · RAID 1(미러링 이중화) — 두 개 이상의 디스크에 동일한 데이터를 실시간 동시 기록하여, 디스크 하나가 물리적으로 고장 나더라도 데이터 유실 없이 무중단 운영",

  // 29. RAID 디스크 고장 시뮬레이션 & 핫스왑 리빌딩
  "--fail(결함 장치로 표기) · --remove(장애 디스크 제거) · --add(신규 디스크 교체 투입) — 실제 디스크 고장 상황을 가상으로 발생시키고, 새 디스크를 투입하여 백그라운드에서 데이터를 자동 복제 복구(Rebuilding)하는 실무 훈련",

  // 30. xfsdump / xfsrestore 증분 백업 및 복원
  "xfsdump(XFS 전용 덤프 백업) · xfsrestore(백업 복원) — XFS 파일시스템의 데이터와 메타데이터 구조를 있는 그대로 백업 파일로 추출하고, 변경된 데이터만 층층이 백업(증분 백업)하여 장애 시 완벽 복원",

  // 31. systemd journald 시스템 로그 디스크 영구 보존
  "journald(저널 로깅 데몬) — 기본적으로 RAM(/run)에 임시 저장되어 재부팅 시 사라지는 시스템 로그를 하드디스크(/var/log/journal)에 영구 보존하도록 설정하여 시스템 재부팅 후에도 장애 원인 추적 가능",

  // 32. iostat 실시간 디스크 I/O 병목 및 지연 측정
  "iostat(Input/Output Statistics: 입출력 통계) — 디스크 장치가 초당 얼마나 많은 읽기/쓰기를 처리하고 있는지(r/s, w/s), 요청이 큐에서 얼마나 지연되고 있는지(await) 측정하여 스토리지 병목 원인 진단",

  // 33. 삭제되었으나 프로세스가 쥐고 있는 유령 용량 해제
  "lsof(List Open Files: 열린 파일 목록) · truncate(파일 크기 강제 절삭) — 파일을 rm 명령으로 지웠는데도 프로세스가 파일 디스크립터(fd)를 물고 있어서 디스크 용량이 반환되지 않을 때, 프로세스를 죽이지 않고 크기를 0으로 비워 용량 회수",

  // 34. cd / pwd / ls 현재 위치 및 숨김 파일 조회
  "pwd(Print Working Directory: 현재 작업 경로) · ls(List: 목록 출력) · cd(Change Directory: 디렉토리 이동) — 리눅스 파일시스템 트리를 탐색하고 숨김 파일(-a)과 권한/크기 상세 정보(-l)를 확인하는 기본 명령어",

  // 35. mkdir -p / ln -s 심볼릭 링크 원자적 교체
  "mkdir -p(Make Directory Parents: 부모 경로까지 한 번에 생성) · ln -s(Link Symbolic: 바로가기 심볼릭 링크) — 소프트웨어 배포 시 새 버전 폴더를 만들고 심볼릭 링크를 순식간에 교체(원자적 배포)하여 무중단 롤아웃",

  // 36. find -mtime + exec 오래된 파일 자동 아카이빙
  "find(파일 검색) · -mtime(Modification Time: 파일 수정 시간) · -exec(검색 결과에 명령 실행) — 30일 이상 지난 대용량 로그 파일들만 시스템에서 자동으로 찾아내어 압축 아카이브로 보관하거나 자동 정리",

  // 37. find + xargs 병렬 처리 (대량 파일 초고속 삭제)
  "xargs(Extended Arguments: 표준 입력을 인자 배열로 변환) · -P(Parallel: CPU 병렬 실행) — 수십만 개의 임시 캐시 파일을 삭제할 때 인자 길이 초과(Argument list too long) 에러를 방지하고 CPU 멀티코어로 초고속 일괄 처리",

  // 38. rsync 증분 동기화 및 SSH 원격 미러링
  "rsync(Remote Synchronization: 원격 증분 동기화) — 전체 파일을 매번 다시 복사하지 않고, 변경되거나 새로 추가된 파일 블록만 골라내어 SSH 암호화 통신으로 안전하고 신속하게 원격 백업 서버에 미러링 동기화",

  // 39. cat / head / tail 빠른 파일 검토
  "cat(Concatenate: 파일 내용 출력) · head(파일 첫 부분 출력) · tail(파일 끝부분 출력) — 무거운 편집기를 열지 않고도 설정 파일이나 로그의 앞/뒤 내용을 터미널에서 신속하게 검토",

  // 40. tail -f & grep 실시간 로그 에러 감시
  "tail -f(Follow: 파일 끝 실시간 추적) · grep(Global Regular Expression Print: 정규식 검색) — 서버가 운영되는 동안 실시간으로 추가되는 애플리케이션 로그 스트림을 추적하며, ERROR나 EXCEPTION 같은 장애 키워드만 실시간 필터링",

  // 41. sed 설정 파일 비대화식 일괄 치환
  "sed(Stream Editor: 스트림 기반 텍스트 편집기) · -i(In-place: 원본 직접 수정) — 사람이 vi로 파일을 열어 일일이 수정하지 않고, 명령줄 스크립트를 통해 설정 파일 안의 구버전 도메인이나 IP 주소를 신규 주소로 일괄 자동 치환",

  // 42. awk 컬럼 필터 & 상태코드 집계
  "awk(텍스트 패턴 검색 및 데이터 가공 언어) — 엑셀처럼 띄어쓰기 기준으로 9번째 열(HTTP 상태코드), 7번째 열(URL) 등 특정 필드만 뽑아내어 장애 상태코드(500) 빈도를 실시간으로 집계 및 정렬",

  // 43. jq 구조화 JSON 로그 파싱 & 추출
  "jq(JSON Query: 커맨드라인 JSON 프로세서) — 복잡한 중첩 JSON 형식의 최신 애플리케이션 로그나 REST API 응답 결과에서 에러 메시지와 타임스탬프 등 필요한 키(Key) 값만 깔끔하게 파싱하여 추출",

  // 44. ps / top 실시간 시스템 부하 점검
  "ps(Process Status: 프로세스 상태) · top(Table of Processes: 실시간 작업 관리자) — 현재 CPU나 메모리를 과도하게 점유하여 시스템을 느리게 만드는 이상 프로세스를 실시간으로 모니터링하고 원인 파악",

  // 45. ps -ef & kill 우아한 프로세스 종료 (SIGTERM)
  "kill(시그널 전송) · SIGTERM(Signal Terminate: 정상 종료 요청, 15번) · SIGKILL(강제 종료, 9번) — 프로세스가 처리 중이던 데이터를 안전하게 저장하고 락을 풀며 종료하도록 신사적인 종료(15번)를 먼저 시도",

  // 46: ps CPU/메모리 최상위 프로세스 정렬
  "ps -eo(출력 컬럼 지정) · --sort(정렬 기준) — 프로세스 ID(PID), 사용자, CPU 사용률, 메모리 사용률을 표 형태로 구성하고, 자원을 가장 많이 쓰는 순서대로 내림차순 정렬하여 병목 프로세스 즉시 확인",

  // 47. lsof 열린 파일 디스크립터 및 활성 소켓 추적
  "lsof(List Open Files: 열려있는 파일 및 소켓 목록) — 특정 프로세스가 현재 디스크의 어떤 파일, 설정, 네트워크 소켓 포트를 붙잡고 열어두었는지 실시간으로 추적하여 리소스 누수(Leak) 점검",

  // 48. strace 시스템 콜 지연시간 프로파일링
  "strace(System Call Trace: 커널 시스템 콜 추적) — 프로그램이 커널에 요청하는 시스템 호출(파일 읽기, 네트워크 통신 등)의 시간 지연을 밀리초 단위로 프로파일링하여 코드가 어디서 멈춰있는지 디버깅",

  // 49. ip addr / ip link 인터페이스 상태 점검
  "ip addr(IP 주소 관리) · ip link(데이터 링크 계층 인터페이스 관리) — 구식 ifconfig를 대체하는 표준 명령어로, 네트워크 카드의 MAC 주소, 링크 연결 상태, 할당된 IP 주소 대역을 확인",

  // 50. curl HTTP 구간별 응답 지연시간(TTFB) 정밀 측정
  "curl(Client URL 전송기) · TTFB(Time To First Byte: 첫 바이트 수신 시간) — 웹 요청 시 DNS 해석 시간, TCP 핸드셰이크 시간, TLS 암호화 시간, 서버가 첫 응답을 보낸 시간을 각각 분리 측정하여 웹 성능 병목 진단",

  // 51. nc (netcat) 포트 스캔 및 방화벽 개방 점검
  "nc(Netcat: 네트워크 만능 잭) · -z(Zero-I/O: 데이터 전송 없이 연결만 확인) · -v(Verbose: 상세 출력) — 목적지 서버의 데이터베이스(3306)나 웹 포트가 실제로 열려있는지, 중간 방화벽이 차단하고 있는지 즉시 테스트",

  // 52. ss 초고속 TCP 연결 상태 분포 분석
  "ss(Socket Statistics: 소켓 통계 분석기) — 구식 netstat 대비 100배 빠르게 커널에서 소켓 다이어그램을 직접 조회하여, 동시 접속자 수와 ESTABLISHED, TIME-WAIT, CLOSE-WAIT 등 TCP 연결 상태를 초고속 집계",

  // 53. tcpdump L7 HTTP 패킷 페이로드 캡처
  "tcpdump(TCP 패킷 덤프 분석기) · -A(ASCII 텍스트로 출력) — 네트워크 카드를 통과하는 실제 네트워크 패킷을 가로채서, 평문 HTTP 요청 헤더와 응답 데이터를 있는 그대로 화면에 캡처하여 프로토콜 트러블슈팅",

  // 54. chmod +x / sudo 스크립트 실행 권한 부여
  "chmod(Change Mode: 파일 권한 모드 변경) · sudo(Superuser Do: 최고 관리자 권한으로 실행) — 일반 텍스트 스크립트 파일에 실행 권한(+x)을 부여하여 프로그램처럼 직접 구동할 수 있도록 권한을 변경",

  // 55. chown 소유권 이전 및 표준 웹 디렉토리 권한
  "chown(Change Owner: 소유자 및 소유그룹 변경) — 파일이나 디렉토리의 주인 계정을 웹서버 계정(www-data, nginx)으로 넘겨주어, 웹 애플리케이션이 파일 업로드나 읽기 작업을 권한 거부(Permission Denied) 없이 수행하도록 조치",

  // 56. SSH 무차별 대입 공격 IP 색출 및 차단 목록화
  "grep(문자열 검색) · sort & uniq -c(중복 카운트 및 정렬) — 보안 인증 로그(/var/log/auth.log)에서 비밀번호 입력 실패(Failed password)를 유발한 해킹 시도 IP를 추출하고 빈도를 집계하여 방화벽 차단 목록 생성",

  // 57. setfacl 세부 접근제어 목록 (ACL) 상속
  "setfacl(Set File Access Control Lists: 세부 접근제어 목록 설정) — 전통적인 기본 권한(소유자-그룹-기타)의 한계를 넘어, 특정 사용자나 배포 계정(deployer)에게만 읽기/쓰기 권한을 별도로 부여하고 신규 생성 파일에도 권한 자동 상속",

  // 58. chattr +i 커널 불변(Immutable) 속성 락
  "chattr(Change Attribute: 파일 고유 속성 변경) · +i(Immutable: 불변 속성) — root 최고 관리자라 할지라도 파일을 수정하거나 삭제, 이름 변경할 수 없도록 커널 레벨에서 잠가, DNS 설정(/etc/resolv.conf)이나 보안 파일 위변조 방지",

  // 59. vmstat 시스템 런큐 및 컨텍스트 스위칭 진단
  "vmstat(Virtual Memory Statistics: 가상 메모리 및 CPU 프로세스 통계) — CPU 실행을 기다리는 런큐(r), I/O 대기(b), 초당 컨텍스트 스위칭 횟수(cs)를 종합 출력하여 시스템이 왜 버벅거리는지 근본 체력 진단",

  // 60. bpftrace eBPF 커널 레벨 TCP 연결 실시간 추적
  "bpftrace(eBPF 기반 프로그래머블 커널 트레이서) — 커널 소스코드를 고치거나 서버를 재부팅하지 않고도, 커널 내부 TCP 연결 함수(tcp_connect)에 미세 탐침을 꽂아 실시간으로 어떤 프로세스가 어디로 통신을 시도하는지 0.01% 미만 오버헤드로 추적",

  // 61. sysctl 대규모 트래픽 대비 TCP 커널 파라미터 튜닝
  "sysctl(System Control: 커널 런타임 매개변수 제어) — 대규모 동시 접속 트래픽 환경에서 TCP 연결 수락 대기 큐(somaxconn)와 포트 고갈을 방지하도록 리눅스 커널 네트워크 스택 설정을 재부팅 없이 즉시 튜닝",

  // 62. API 응답 지연 종합 진단 파이프라인
  "journalctl & tail & awk 파이프라인 — 애플리케이션의 최근 저널 로그를 추적하여 응답 시간이 1초(1000ms)를 초과한 느린 API 엔드포인트 URL만 필터링하여 개발팀에 성능 개선 포인트 전달",

  // 63. Docker 미사용 빌드 캐시 및 오래된 볼륨 일괄 정리
  "prune(불필요한 리소스 가지치기 정리) — 7일 이상 쓰이지 않고 버려진 도커 빌드 캐시와 이름 없는 찌꺼기 볼륨들을 일괄 정리하여 수십 GB의 호스트 디스크 용량을 신속 복구",

  // 64. OOM (Out Of Memory) 킬러 프로세스 추적
  "dmesg(커널 메시지 버퍼 출력) · OOM(Out Of Memory: 메모리 고갈 킬러) — 물리 메모리가 한계에 도달했을 때 리눅스 커널이 시스템 전체 다운을 막기 위해 어떤 프로세스(Java, Node 등)를 강제로 사살했는지 원인 규명",

  // 65. 디스크 100% 긴급 대응 LVM 온라인 무중단 증설 파이프라인
  "vgs(볼륨그룹 잔여용량 확인) & lvextend(논리볼륨 확장) & xfs_growfs(파일시스템 확장) — 데이터 디스크가 100% 가득 차서 서비스가 멈추기 직전, 무중단으로 스토리지 용량을 10GB 추가하고 파일시스템에 즉시 반영",

  // 66. 도커 컨테이너 비정상 종료(Exit Code) 역추적 파이프라인
  "docker ps -a & inspect & logs — 갑자기 꺼져버린(Exited) 컨테이너의 종료 코드(Exit Code 137은 OOM 메모리 부족, 1은 애플리케이션 에러 등)와 마지막 표준 에러 로그를 역추적하여 장애 원인 분석",

  // 67. Rocky Linux firewalld 영구 포트/서비스 개방 & 즉시 반영
  "firewall-cmd(Firewall Daemon Command: RHEL/Rocky 방화벽 제어기) — 외부에서 서버로 들어오는 접속 요청을 통제하며, 웹(8080)이나 NFS(2049) 같은 신규 서비스를 재부팅 후에도 유지되도록 영구(--permanent) 허용 등록하고 즉시 활성화",

  // 68. SELinux 웹 디렉토리 보안 컨텍스트 등록 & 복원
  "semanage(SELinux Policy Manager: 보안 정책 관리자) · restorecon(Restore Context: 보안 레이블 복원) — Rocky Linux에서 기본 경로(/var/www/html)가 아닌 임의의 폴더(/www)를 웹 루트로 사용할 때 발생하는 403 Forbidden 에러를 해결하기 위해 올바른 아파치 접근 권한 레이블을 할당",

  // 69. SELinux 비표준 서비스 포트 바인딩 허용
  "semanage port(SELinux 포트 정책 관리) — Rocky Linux에서 웹서버를 표준 80번이 아닌 82번 같은 비표준 포트로 변경했을 때, 커널 보안 모듈이 포트 바인딩을 차단(Permission Denied)하지 못하도록 허용 포트 목록에 등록",

  // 70. nmcli 네트워크 연결 수정 & 보조 IP 동적 추가
  "nmcli(NetworkManager CLI: 네트워크 관리자 명령어) — Rocky Linux 표준 네트워크 설정 도구로, 기존 네트워크 카드 연결 프로필에 보조 IP(Secondary IP)를 추가하여 하나의 랜선으로 두 개의 IP 대역을 동시 수신",

  // 71. fuser 마운트 지점 점유 프로세스 강제 종료 & 언마운트
  "fuser(File User: 파일/마운트 지점 점유 프로세스 식별기) — 디스크를 언마운트(umount)하려 할 때 'target is busy' 에러를 내며 디스크 분리를 방해하는 사용자 셸이나 백그라운드 프로세스를 찾아내어 일괄 강제 종료(-k)",

  // 72. 스왑 파일(Swapfile) 생성 & 안전 권한 활성화
  "dd(Data Duplicator: 빈 블록 파일 생성) · mkswap(스왑 영역 포맷) · swapon(스왑 메모리 활성화) — 남는 하드디스크 파티션이 없을 때, 일반 파일 하나를 만들어 권한(600)을 잠근 뒤 물리 RAM을 보조하는 가상 메모리 스왑 공간으로 즉시 투입",

  // 73. systemctl 서비스 즉시 기동 & 부팅 자동 실행 일괄 등록
  "systemctl(Systemd Control: 시스템 및 서비스 관리 제어기) · --now(Enable과 Start 동시 실행) — 서비스를 지금 당장 시작하는 것과 서버가 재부팅될 때 자동으로 켜지도록 등록하는 두 가지 작업을 한 번에 처리",

  // 74. dnf 리포지토리 패키지 설치 & rpm 역추적 쿼리
  "dnf(Dandified YUM: Rocky 리눅스 최신 패키지 관리자) · rpm(Red Hat Package Manager) — 인터넷 저장소에서 필요한 프로그램을 자동 설치하고, 내 컴퓨터에 설치된 특정 명령어 파일이 어떤 패키지로부터 만들어졌는지 역추적 조회",

  // 75. mdadm RAID 어레이 정지 & 잔여 수퍼블록 초기화
  "mdadm -S(Stop Array: RAID 어레이 비활성화) · --zero-superblock(수퍼블록 데이터 완전 소거) — 사용이 끝난 소프트웨어 RAID 어레이를 안전하게 정지시키고, 디스크 헤더에 남아있는 RAID 메타데이터를 깨끗이 지워 일반 디스크나 LVM으로 재사용 가능하게 초기화",

  // 76. grubby 부팅 기본 커널 확인 & 커널 파라미터 제어
  "grubby(GRUB 부트로더 설정 유틸리티) — Rocky Linux 8/9/10에서 복잡한 grub.cfg 파일을 직접 건드리지 않고, 부팅 시 기본으로 실행될 커널 버전과 시스템 부팅 옵션을 안전하게 조회 및 제어",

  // 77. docker save/load 오프라인 컨테이너 이미지 이전
  "docker save(도커 이미지를 tar 압축 파일로 추출) · docker load(tar 파일에서 도커 이미지 복원) — 인터넷이 완전히 차단된 폐쇄망 서버나 보안 구역으로 도커 이미지를 파일 형태로 안전하게 복사하여 이전",

  // 78. docker cp 컨테이너와 호스트 간 실시간 파일 추출 & 주입
  "docker cp(Docker Copy: 호스트와 컨테이너 파일시스템 간 양방향 복사) — 컨테이너를 중지시키지 않고도, 실행 중인 컨테이너 내부의 설정 파일이나 로그를 호스트로 꺼내오거나 호스트의 수정된 소스코드를 컨테이너 안으로 즉시 주입",

  // 79. 사설 Docker Registry REST API 이미지 & 태그 목록 질의
  "Registry v2 API(도커 원격 레지스트리 HTTP 표준 규격) — 별도의 웹 관리 화면이 없는 사설 Docker Registry 서버에서 현재 어떤 이미지 리포지토리들이 저장되어 있고 어떤 버전 태그들이 존재하는지 curl과 jq로 조회",

  // 80. 원격 Docker 데몬 TCP 연결 (-H) 및 rdocker 관리
  "-H(Host: 접속할 원격 데몬 주소 지정) · rdocker(원격 도커 제어 단축 별칭) — 원격 리눅스 서버에 SSH로 일일이 로그인하지 않고, 내 로컬 컴퓨터 터미널에서 원격 서버의 도커 엔진에 직접 명령을 내려 원격 컨테이너를 제어",

  // 81. docker history 이미지 빌드 레이어 & 명령어 역추적
  "history(이미지 레이어 생성 이력 조회) — Dockerfile 원본 소스가 없는 이미지일지라도, 이 이미지가 어떤 베이스 이미지 위에 어떤 명령어를 거쳐 만들어졌는지 레이어별 용량과 생성 과정을 역추적 분석",

  // 82. 모든 컨테이너 일괄 강제 삭제 및 정리 별칭 (drmall)
  "drmall(Docker Remove All: 모든 컨테이너 일괄 삭제 단축 별칭) — 실습이 끝난 후 실행 중인 컨테이너와 중지된 컨테이너를 가리지 않고 한 번에 강제 삭제(-f)하여 깨끗한 초기 상태로 시스템 리셋"
];

import("../src/portal_html.js").then(m => {
  let html = m.PORTAL_HTML;
  const matchData = html.match(/const data = (\[[\s\S]*?\]);\n/);
  if (!matchData) {
    console.error("Could not find const data in PORTAL_HTML");
    process.exit(1);
  }

  const data = JSON.parse(matchData[1]);
  console.log(`Current items: ${data.length}, MEANINGS count: ${MEANINGS.length}`);
  if (data.length !== MEANINGS.length) {
    console.error("Length mismatch!");
    process.exit(1);
  }

  for (let i = 0; i < data.length; i++) {
    data[i].abbr = MEANINGS[i];
  }

  const updatedDataStr = `const data = ${JSON.stringify(data, null, 6)};\n`;
  html = html.replace(matchData[0], updatedDataStr);

  // Update card badge label from 🔤 단축어: to 💡 용어 설명:
  const oldBadge = `<span class="text-amber-400 font-semibold shrink-0">🔤 단축어:</span>`;
  const newBadge = `<span class="text-amber-400 font-semibold shrink-0">💡 용어 설명:</span>`;
  if (html.includes(oldBadge)) {
    html = html.replace(oldBadge, newBadge);
    console.log("Updated card badge label to 💡 용어 설명:");
  }

  // Update banners mentioning '단축어' to '용어 설명 & 의미 풀이'
  html = html.replace(/단축어 사전/g, "명령어 용어 및 의미 해설 사전");
  html = html.replace(/단축어\(Full Name\)/g, "명령어 영문 어원 및 용어 뜻");

  const newExport = `export const PORTAL_HTML = ${JSON.stringify(html)};\n`;
  fs.writeFileSync(portalFile, newExport, 'utf8');
  console.log("Successfully updated portal_html.js with comprehensive Korean terminology meanings!");
});
