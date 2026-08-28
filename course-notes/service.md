---
id: service
title: 서비스와 패키지
lead: 부팅할 때 자동으로 뜨는 서비스를 다루고, 필요한 프로그램을 설치합니다.
---

## systemd

요즘 리눅스는 **systemd** 가 서비스를 관리합니다. 부팅 순서를 정하고,
죽으면 다시 띄우고, 로그를 모읍니다. 명령은 `systemctl` 하나로 통합돼 있습니다.

### 서비스 상태 보기

```bash
$ systemctl status nginx
```

출력에서 봐야 할 두 가지입니다.

| 항목 | 뜻 |
| --- | --- |
| **`loaded`** | 설정 파일을 읽었나. `enabled` / `disabled` 가 함께 표시됨 |
| **`active`** | 지금 돌고 있나 |

`active` 의 세부 상태입니다.

| 상태 | 뜻 |
| --- | --- |
| `active (running)` | 정상 동작 중 |
| `active (exited)` | 실행되고 끝남 — 한 번만 하는 작업은 정상 |
| `active (waiting)` | 조건을 기다리는 중 |
| **`inactive (dead)`** | 멈춰 있음 |
| **`failed`** | **실패** — 로그를 봐야 함 |

`exited` 를 보고 "죽었다"고 오해하기 쉬운데, 일회성 작업은 그게 정상입니다.

### 목록 보기

```bash
$ systemctl list-unit-files --type=service        # 등록된 서비스 전부
$ systemctl list-unit-files --type=service --all
$ systemctl --type=service                        # 지금 올라온 것만
$ systemctl --failed                              # 실패한 것만
```

`systemctl --failed` 는 **서버에 접속하면 한 번 쳐볼 만합니다.**
뭔가 잘못됐는데 모르고 있던 것이 드러납니다.

### 자동 시작 여부

| 값 | 뜻 |
| --- | --- |
| `enabled` | 부팅할 때 자동으로 시작 |
| `disabled` | 자동으로 시작하지 않음 |
| `static` | 다른 유닛에 의해서만 시작됨 |

---

## 서비스 제어

```bash
$ systemctl start nginx        # 시작
$ systemctl stop nginx         # 정지
$ systemctl restart nginx      # 재시작
$ systemctl reload nginx       # 설정만 다시 읽기
```

**`restart` 와 `reload` 는 다릅니다.**

| | `restart` | `reload` |
| --- | --- | --- |
| 프로세스 | 완전히 껐다 켬 | 유지 |
| 접속 | **끊김** | 유지 |
| 언제 | 프로그램 자체를 바꿨을 때 | 설정만 바꿨을 때 |

**설정만 고쳤다면 `reload` 를 쓰세요.** 서비스 중단 없이 반영됩니다.
다만 모든 서비스가 `reload` 를 지원하지는 않습니다.

### 부팅 자동 시작

```bash
$ systemctl enable nginx       # 부팅할 때 시작하도록
$ systemctl disable nginx      # 해제
$ systemctl enable --now nginx # 등록하고 지금 바로 시작까지
```

**`enable` 은 지금 시작시키지 않습니다.** 부팅 시 시작하도록 등록만 합니다.
그래서 `enable` 만 하고 "왜 안 뜨지" 하는 일이 흔합니다.
`--now` 를 붙이거나 `start` 를 따로 해야 합니다.

### 그 밖에

```bash
$ systemctl list-dependencies nginx   # 무엇에 의존하는지
$ systemctl mask nginx                # 아예 시작 못 하게 잠그기
$ systemctl unmask nginx              # 잠금 해제
$ systemctl daemon-reload             # 유닛 파일을 고친 뒤
```

`mask` 는 `disable` 보다 강합니다. **다른 서비스가 요청해도 시작되지 않습니다.**
유닛 파일(`/etc/systemd/system/*.service`)을 직접 고쳤다면
`daemon-reload` 를 해야 systemd 가 새 내용을 읽습니다.

### 로그 보기

서비스가 `failed` 라면 로그를 봐야 합니다.

```bash
$ journalctl -u nginx                    # 이 서비스의 로그
$ journalctl -u nginx -e                 # 마지막 부분으로
$ journalctl -u nginx -f                 # 실시간으로
$ journalctl -u nginx --since "1 hour ago"
$ journalctl -u nginx -p err             # 오류 이상만
```

---

## 패키지 설치

Rocky Linux 는 **RedHat 계열**이라 `rpm` 과 `dnf` 를 씁니다.
Ubuntu 문서의 `apt` 는 동작하지 않습니다.

### dnf — 보통 이것을 씁니다

```bash
$ dnf install nginx            # 설치 (의존성까지 알아서)
$ dnf install -y nginx         # 확인 없이
$ dnf remove nginx             # 삭제
$ dnf update                   # 전부 최신으로
$ dnf update nginx             # 하나만
```

찾아보기.

```bash
$ dnf search nginx             # 키워드로 검색
$ dnf search all nginx         # 설명까지 뒤져서
$ dnf list installed           # 설치된 것 목록
$ dnf list available           # 설치 가능한 것
$ dnf info nginx               # 상세 정보
$ dnf repolist                 # 저장소 목록
$ dnf groupinstall "개발 도구"   # 묶음으로 설치
```

**`dnf` 는 의존성을 알아서 처리합니다.** 그래서 보통 `rpm` 대신 `dnf` 를 씁니다.

### rpm — 파일을 직접 다룰 때

```bash
$ rpm -qa                      # 설치된 패키지 전부
$ rpm -qa | grep nginx         # 그중에서 찾기
$ rpm -i package.rpm           # 설치
$ rpm -Uvh package.rpm         # 설치 또는 업그레이드 (진행률 표시)
$ rpm -e nginx                 # 삭제
$ rpm -V nginx                 # 설치 후 변경된 파일 확인
```

조회 옵션은 `-q` 뒤에 붙입니다.

| 옵션 | 무엇을 보나 |
| --- | --- |
| `-qi` | 패키지 정보 |
| `-ql` | **이 패키지가 설치한 파일 목록** |
| `-qc` | 그중 설정 파일만 |
| `-qd` | 그중 문서만 |
| `-qip` | 설치 **전에** `.rpm` 파일 정보 보기 |

```bash
$ rpm -ql nginx | head          # nginx 가 어디에 뭘 깔았나
$ rpm -qc nginx                 # 설정 파일이 어디 있나
```

**`rpm -qc` 가 특히 유용합니다.** 설정 파일 위치가 기억나지 않을 때
찾아 헤매지 않아도 됩니다.

`-Uvh` 의 뜻입니다 — `U` 업그레이드, `v` 자세히, `h` 해시(`#`)로 진행 표시.

### rpm 과 dnf 를 언제 쓰나

| | `rpm` | `dnf` |
| --- | --- | --- |
| 의존성 | **직접 해결해야 함** | 자동 |
| 저장소 | 안 씀 | 저장소에서 받아옴 |
| 언제 | `.rpm` 파일을 직접 받았을 때, 조회할 때 | **평소 설치·삭제** |

### 저장소 추가

기본 저장소에 없는 프로그램은 저장소를 추가해야 합니다.

```bash
$ dnf config-manager --add-repo=https://저장소주소/repo
$ dnf repolist
```

> 출처를 알 수 없는 저장소는 추가하지 마세요. 저장소를 추가한다는 것은
> **그곳에서 받은 패키지를 신뢰하겠다**는 뜻이고, 패키지는 설치 과정에서
> root 권한으로 스크립트를 실행할 수 있습니다.

---

## 정리

```bash
systemctl status 서비스        상태 보기
systemctl --failed            실패한 것 확인
systemctl reload 서비스        설정만 반영 (무중단)
systemctl enable --now 서비스  등록하고 바로 시작
journalctl -u 서비스 -e        문제가 있을 때 로그
dnf install / remove          설치와 삭제
rpm -qc 패키지                 설정 파일 위치 찾기
```
