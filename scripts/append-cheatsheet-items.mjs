import fs from 'fs';
import path from 'path';

const portalFile = path.resolve('src/portal_html.js');

const NEW_ITEMS = [
  // 1. Rocky Linux firewalld
  {
    cat: "sec",
    lvl: "L2",
    lvlName: "기본 L2",
    name: "firewall-cmd 영구 포트/서비스 개방 & 즉시 반영",
    cmd: "sudo firewall-cmd --permanent --add-service=nfs --add-port=8080/tcp && sudo firewall-cmd --reload && sudo firewall-cmd --list-all",
    desc: "Rocky Linux firewalld 동적 방화벽에 지정 서비스 및 포트를 영구(--permanent) 등록하고 즉시 재적용하여 활성 규칙을 일람합니다.",
    abbr: "firewall-cmd = Firewall Daemon Command (Rocky/RHEL 방화벽 제어기) · --permanent = 영구 저장",
    scenario: "웹 서버(80/8080), NFS 스토리지(2049) 등 신규 서비스 설치 후 외부 클라이언트 접속 차단 해제",
    tags: ["Rocky", "firewalld", "방화벽", "포트개방", "보안"]
  },
  // 2. SELinux fcontext / restorecon
  {
    cat: "sec",
    lvl: "L3",
    lvlName: "중급 L3",
    name: "SELinux 웹 디렉토리 보안 컨텍스트 등록 & 복원",
    cmd: "sudo semanage fcontext -a -t httpd_sys_content_t '/www(/.*)?' && sudo restorecon -RFv /www && ls -lZ /www",
    desc: "기본 경로(/var/www/html)가 아닌 커스텀 경로(/www) 생성 시 SELinux가 파일 접근을 차단(403 Forbidden)하는 문제를 해결하기 위해 아파치 시스템 컨텍스트를 할당하고 복원합니다.",
    abbr: "semanage = SELinux Policy Manager (보안 정책 관리자) · restorecon = Restore Context (컨텍스트 복원)",
    scenario: "Rocky Linux에서 Nginx/Apache DocumentRoot 변경 후 403 Forbidden 권한 에러 긴급 조치",
    tags: ["Rocky", "SELinux", "semanage", "restorecon", "보안컨텍스트"]
  },
  // 3. SELinux port
  {
    cat: "sec",
    lvl: "L3",
    lvlName: "중급 L3",
    name: "SELinux 비표준 서비스 포트 바인딩 허용",
    cmd: "sudo semanage port -a -t http_port_t -p tcp 82 && sudo semanage port -l -C | grep http_port_t",
    desc: "Rocky Linux에서 Nginx나 Apache를 80/443이 아닌 비표준 포트(82번 등)로 바인딩할 때 SELinux Permission Denied 에러를 해결하도록 포트 정책을 추가합니다.",
    abbr: "semanage port = SELinux Port Policy Management (SELinux 네트워크 포트 레이블 관리)",
    scenario: "웹 서버 포트를 82, 8080 등으로 변경 시 systemd 기동 실패(Permission Denied) 해소",
    tags: ["Rocky", "SELinux", "포트허용", "네트워크보안", "semanage"]
  },
  // 4. nmcli
  {
    cat: "net",
    lvl: "L2",
    lvlName: "기본 L2",
    name: "nmcli 네트워크 연결 수정 & 보조 IP 동적 추가",
    cmd: "nmcli con mod mynet +ipv4.addresses 10.0.0.10/24 && nmcli con up mynet && ip -br addr",
    desc: "Rocky Linux 표준 NetworkManager CLI로 기존 네트워크 인터페이스 연결 프로필에 서브넷 보조 IP를 추가하고 즉시 활성화합니다.",
    abbr: "nmcli = NetworkManager Command-Line Interface (네트워크 관리자 CLI) · con = Connection",
    scenario: "단일 NIC 이더넷 장치에 공인 IP와 사설 스토리지/내부 통신용 보조 IP를 멀티 바인딩",
    tags: ["Rocky", "nmcli", "NetworkManager", "IP할당", "네트워크"]
  },
  // 5. fuser target is busy
  {
    cat: "disk",
    lvl: "L3",
    lvlName: "중급 L3",
    name: "fuser 마운트 지점 점유 프로세스 강제 종료 & 언마운트",
    cmd: "fuser -km /m1 && sleep 1 && umount /m1",
    desc: "디스크 마운트 해제 시 'target is busy' 에러를 유발하는, 해당 마운트 지점에 위치하거나 파일을 열고 있는 모든 프로세스를 일괄 강제 종료(-k)하고 안전하게 언마운트합니다.",
    abbr: "fuser = File User (파일/마운트포인트 점유 프로세스 식별기) · -k = Kill · -m = Mountpoint",
    scenario: "스토리지 디스크 분리, 파일시스템 포맷 변경 전 unmount 거부(Device or resource busy) 즉시 해결",
    tags: ["Rocky", "fuser", "umount", "busy해제", "디스크관리"]
  },
  // 6. swapfile dd
  {
    cat: "disk",
    lvl: "L2",
    lvlName: "기본 L2",
    name: "스왑 파일(Swapfile) 생성 & 안전 권한 활성화",
    cmd: "dd if=/dev/zero of=/var/tmp/swapfile bs=1M count=1024 && chmod 600 /var/tmp/swapfile && mkswap /var/tmp/swapfile && swapon /var/tmp/swapfile && swapon --show",
    desc: "별도의 물리 디스크 파티션 분할 없이 dd로 지정 용량(1GB)의 빈 파일을 생성하고 보안 권한(600)을 부여한 뒤 가상 메모리 스왑 공간으로 즉시 활성화합니다.",
    abbr: "dd = Data Duplicator (데이터 복제/변환 블록 생성) · mkswap = Make Swap · swapon = Swap On",
    scenario: "물리 파티션을 나눌 여유 공간이 없는 클라우드 인스턴스에서 메모리 고갈(OOM) 방지 긴급 스왑 확장",
    tags: ["Rocky", "swapfile", "mkswap", "swapon", "가상메모리"]
  },
  // 7. systemctl enable --now
  {
    cat: "process",
    lvl: "L2",
    lvlName: "기본 L2",
    name: "systemctl 서비스 즉시 기동 & 부팅 자동 실행 일괄 등록",
    cmd: "sudo systemctl daemon-reload && sudo systemctl enable --now docker httpd && sudo systemctl is-active docker",
    desc: "systemd 유닛 설정 파일 변경 사항을 커널 데몬에 재적용(daemon-reload)하고, 서비스를 즉시 시작함과 동시에 서버 부팅 시 자동 기동(--now)되도록 한 번에 등록합니다.",
    abbr: "systemctl = Systemd Control (시스템 및 서비스 관리자 제어기) · --now = Enable + Start 동시 실행",
    scenario: "Rocky Linux에서 서비스 설치 후 수동 start 및 enable 2단계를 단일 명령으로 신속 표준화",
    tags: ["Rocky", "systemctl", "systemd", "서비스관리", "daemon-reload"]
  },
  // 8. dnf / rpm
  {
    cat: "file",
    lvl: "L2",
    lvlName: "기본 L2",
    name: "dnf 리포지토리 패키지 설치 & rpm 역추적 쿼리",
    cmd: "sudo dnf install -y epel-release htop && rpm -qa | grep -i docker && rpm -ql htop | head -n 15",
    desc: "Rocky Linux 패키지 관리자 dnf로 EPEL 확장 저장소 및 도구를 자동 설치하고, rpm 데이터베이스에서 설치된 패키지 목록(-qa) 및 구성 파일 경로(-ql)를 역추적합니다.",
    abbr: "dnf = Dandified YUM (차세대 패키지 관리자) · rpm = Red Hat Package Manager (-qa: Query All, -ql: Query List)",
    scenario: "특정 명령어 바이너리나 설정 파일이 시스템 어느 경로에 설치되었는지 원본 패키지 파일 매핑 확인",
    tags: ["Rocky", "dnf", "rpm", "패키지관리", "EPEL"]
  },
  // 9. mdadm -S & zero-superblock
  {
    cat: "disk",
    lvl: "L3",
    lvlName: "중급 L3",
    name: "mdadm RAID 어레이 정지 & 잔여 수퍼블록 초기화",
    cmd: "sudo mdadm -S /dev/md1 && sudo mdadm --zero-superblock /dev/nvme0n3 /dev/nvme0n4",
    desc: "기존 소프트웨어 RAID 어레이를 안전하게 정지(-S)하고, 디스크에 기록된 메타데이터(Superblock)를 0으로 덮어써 다른 용도나 LVM 물리 볼륨으로 재사용할 수 있도록 초기화합니다.",
    abbr: "mdadm -S = Stop Array (RAID 어레이 비활성화) · zero-superblock = 잔여 RAID 메타데이터 완전 소거",
    scenario: "테스트 완료된 RAID 디스크를 분해하여 신규 LVM 스토리지 풀이나 단일 파티션으로 전용",
    tags: ["Rocky", "mdadm", "RAID해제", "superblock", "스토리지초기화"]
  },
  // 10. grubby
  {
    cat: "process",
    lvl: "L3",
    lvlName: "중급 L3",
    name: "grubby 부팅 기본 커널 확인 & 커널 파라미터 제어",
    cmd: "grubby --default-kernel && grubby --info=ALL | grep -E \"(index|kernel|title)\"",
    desc: "Rocky Linux 8/9/10에서 복잡한 grub.cfg 파일을 직접 건드리지 않고 공식 grubby CLI를 통해 부팅 시 기본 기동될 커널 버전과 등록된 전체 커널 목록을 안전하게 조회 및 제어합니다.",
    abbr: "grubby = GRUB Boot Loader Configuration Utility (부트로더 커널 이미지 제어 도구)",
    scenario: "커널 업데이트 후 이전 안정 커널 롤백 지정 또는 부팅 매개변수(console, audit 등) 검증",
    tags: ["Rocky", "grubby", "커널", "부팅관리", "GRUB"]
  },
  // 11. docker save/load
  {
    cat: "docker",
    lvl: "L3",
    lvlName: "중급 L3",
    name: "docker save/load 오프라인 컨테이너 이미지 이전",
    cmd: "docker save -o /tmp/web-image.tar test:nginx && scp /tmp/web-image.tar remote-host:/tmp/ && ssh remote-host \"docker load -i /tmp/web-image.tar\"",
    desc: "인터넷 접속이 제한된 폐쇄망이나 원격 레지스트리가 없는 환경에서 도커 이미지를 단일 tar 아카이브로 추출(save)하고 원격 서버에서 즉시 복원(load)합니다.",
    abbr: "docker save = Save Images to Tar (이미지 아카이브 저장) · docker load = Load Images (아카이브 복원)",
    scenario: "외부 인터넷 연결이 차단된 엔터프라이즈 사설 인프라 및 보안 존으로 도커 컨테이너 이미지 무결성 전송",
    tags: ["Docker", "docker_save", "docker_load", "폐쇄망", "이미지백업"]
  },
  // 12. docker cp
  {
    cat: "docker",
    lvl: "L2",
    lvlName: "기본 L2",
    name: "docker cp 컨테이너와 호스트 간 실시간 파일 추출 & 주입",
    cmd: "docker cp web-server:/etc/nginx/nginx.conf ./nginx.conf && docker cp ./index.html web-server:/var/www/html/",
    desc: "컨테이너를 중지하지 않고 실행 중인 컨테이너 내부 파일(/etc/nginx/nginx.conf)을 호스트로 가져오거나, 호스트의 소스코드를 컨테이너 내부로 직접 밀어 넣습니다.",
    abbr: "docker cp = Docker Copy (호스트와 컨테이너 파일시스템 간 양방향 복사)",
    scenario: "볼륨 마운트가 누락된 컨테이너에서 설정 파일 긴급 백업/분석 또는 긴급 패치 파일 즉시 반영",
    tags: ["Docker", "docker_cp", "파일복사", "핫픽스", "디버깅"]
  },
  // 13. registry REST API
  {
    cat: "docker",
    lvl: "L4",
    lvlName: "고급 L4",
    name: "사설 Docker Registry REST API 이미지 & 태그 목록 질의",
    cmd: "curl -s http://localhost:5000/v2/_catalog | jq . && curl -s http://localhost:5000/v2/test/tags/list | jq .",
    desc: "자체 구축한 사설 Docker Registry v2 API 규격에 맞춰 저장소에 푸시된 전체 리포지토리 목록(_catalog)과 특정 이미지의 태그 리스트(tags/list)를 JSON으로 조회합니다.",
    abbr: "Registry v2 API = Docker Registry HTTP API V2 (도커 원격 레지스트리 REST 명세)",
    scenario: "GUI 대시보드가 없는 자체 사설 레지스트리에서 현재 보관 중인 이미지 버전 및 태그 실시간 감사",
    tags: ["Docker", "Registry", "REST_API", "_catalog", "사설저장소"]
  },
  // 14. docker -H & rdocker
  {
    cat: "docker",
    lvl: "L3",
    lvlName: "중급 L3",
    name: "원격 Docker 데몬 TCP 연결 (-H) 및 rdocker 관리",
    cmd: "docker -H tcp://192.168.120.128:2375 ps -a && echo \"alias rdocker='docker -H tcp://192.168.120.128:2375'\" >> ~/.bashrc",
    desc: "로컬 소켓(/var/run/docker.sock) 대신 네트워크 TCP 포트(2375)로 개방된 원격 호스트의 도커 엔진에 직접 접속하여 컨테이너 상태를 조회하고 명령을 내립니다.",
    abbr: "-H = Host Socket / Remote Daemon Binding (도커 데몬 호스트 엔드포인트 지정)",
    scenario: "Bastion 또는 관리자 로컬 PC에서 여러 원격 클라우드 서버의 도커 런타임을 원격 중앙 집중 제어",
    tags: ["Docker", "원격데몬", "-H", "rdocker", "TCP바인딩"]
  },
  // 15. docker history
  {
    cat: "docker",
    lvl: "L2",
    lvlName: "기본 L2",
    name: "docker history 이미지 빌드 레이어 & 명령어 역추적",
    cmd: "docker history --no-trunc test:nginx | head -n 10",
    desc: "특정 이미지가 어떤 베이스 이미지와 어떤 Dockerfile 명령어(RUN, COPY, EXPOSE 등)를 거쳐 빌드되었는지 레이어별 용량과 생성 명령을 역추적합니다.",
    abbr: "history = Image Layer History (도커 이미지 생성 레이어 이력 추적)",
    scenario: "타인이 빌드한 도커 이미지의 Dockerfile 원본이 유실되었을 때 빌드 과정 분석 및 이미지 용량 최적화 포인트 색출",
    tags: ["Docker", "history", "레이어분석", "용량최적화", "이미지분석"]
  },
  // 16. drmall alias
  {
    cat: "docker",
    lvl: "L2",
    lvlName: "기본 L2",
    name: "모든 컨테이너 일괄 강제 삭제 및 정리 별칭 (drmall)",
    cmd: "echo \"alias drmall='docker rm -f \\$(docker ps -aq)'\" >> ~/.bashrc && docker rm -f $(docker ps -aq 2>/dev/null)",
    desc: "실행 중이거나 중지된 모든 컨테이너 ID(-aq)를 한 번에 조회하여 강제 삭제(-f)하는 실습용 필수 별칭 drmall을 구성하고 환경을 정리합니다.",
    abbr: "drmall = Docker Remove All Containers (모든 컨테이너 일괄 강제 삭제 커스텀 단축어)",
    scenario: "실습 종료 후 또는 새로운 프로젝트 배포 전 기존에 누적된 테스트 컨테이너들을 한 번에 클리어",
    tags: ["Docker", "drmall", "일괄삭제", "단축어", "환경정리"]
  }
];

import("../src/portal_html.js").then(m => {
  let html = m.PORTAL_HTML;
  const matchData = html.match(/const data = (\[[\s\S]*?\]);\n/);
  if (!matchData) {
    console.error("Could not find const data");
    process.exit(1);
  }

  const existingData = JSON.parse(matchData[1]);
  console.log(`Existing items: ${existingData.length}`);

  // Check for duplicates
  const existingNames = new Set(existingData.map(d => d.name));
  const itemsToAdd = NEW_ITEMS.filter(item => !existingNames.has(item.name));
  console.log(`Items to add: ${itemsToAdd.length}`);

  const combined = [...existingData, ...itemsToAdd];
  console.log(`Total combined items: ${combined.length}`);

  const updatedDataStr = `const data = ${JSON.stringify(combined, null, 6)};\n`;
  html = html.replace(matchData[0], updatedDataStr);

  const newExport = `export const PORTAL_HTML = ${JSON.stringify(html)};\n`;
  fs.writeFileSync(portalFile, newExport, 'utf8');
  console.log("Successfully updated src/portal_html.js with new items!");
});
