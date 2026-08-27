/**
 * 리눅스 CLI 심층 가이드 — /study/linux
 *
 * 치트 시트(명령 목록)와 역할을 나눕니다.
 *  - 치트 시트: 무슨 명령이 있는지
 *  - 이 문서:   출력을 어떻게 읽고, 무엇부터 확인하는지
 */

export const LINUX_GUIDE_TITLE = '리눅스 CLI 심층 가이드';

const LEVELS = [
  ['L1', '기초', '한 번에 하나', '경로를 옮기고 파일을 본다. 명령 하나가 결과 하나를 만든다.', 'pwd · cd · ls · cat · mkdir'],
  ['L2', '기본', '옵션과 방향', '옵션으로 출력을 다듬고, 리다이렉션으로 흐름의 방향을 정한다.', 'ls -lh · grep · chmod · &gt; · &gt;&gt; · |'],
  ['L3', '중급', '흐름을 설계', '명령을 조립해 데이터를 걸러내고 모양을 바꾼다. 반복 작업이 한 줄이 된다.', 'awk · sed · xargs · find -exec · sort · uniq -c'],
  ['L4', '고급', '증상에서 원인으로', '무엇이 느린지 <em>측정</em>한다. 추측 대신 숫자를 본다.', 'ss · lsof · strace · iostat · vmstat · journalctl'],
  ['L5', '심화', '커널까지', '애플리케이션 바깥, 커널이 실제로 무엇을 하는지 들여다본다.', 'perf · bpftrace · /proc · sysctl · cgroups'],
];

const ANATOMY = [
  ["awk '$9 &gt;= 500 {print $1, $7, $9}'", 'access.log 의 9번째 칸(상태 코드)이 500 이상인 줄만 골라, 1번(IP)·7번(URL)·9번(코드)을 출력합니다. <code>$0</code> 은 줄 전체입니다.'],
  ['| sort', '같은 값을 이웃으로 모읍니다. <code>uniq</code> 는 <strong>연속된</strong> 중복만 세므로 반드시 먼저 정렬해야 합니다.'],
  ['| uniq -c', '연속된 같은 줄을 하나로 합치고 앞에 개수를 붙입니다.'],
  ['| sort -nr', '개수를 <strong>숫자로</strong>(-n) <strong>내림차순</strong>(-r) 정렬합니다. -n 이 없으면 10 이 9 보다 앞에 옵니다.'],
  ['| head -10', '위에서 열 줄만 남깁니다.'],
];

const READING = [
  {
    cmd: 'uptime · load average',
    sample: 'load average: 3.72, 2.11, 1.05',
    points: [
      '1분·5분·15분 평균입니다. <strong>앞이 뒤보다 크면 지금 악화 중</strong>, 반대면 회복 중입니다.',
      '실행을 기다리는 프로세스뿐 아니라 <strong>디스크 I/O 를 기다리는 프로세스(D 상태)도 포함</strong>합니다. 그래서 CPU 가 한가해도 값이 치솟을 수 있습니다.',
      '절대값이 아니라 <strong>코어 수로 나눠</strong> 봅니다. <code>nproc</code> 이 4 인데 4.0 이면 포화, 8 코어면 절반입니다.',
    ],
    mistake: '"load 가 3 이니 CPU 가 바쁘다" — I/O 대기일 수 있습니다. <code>vmstat</code> 의 <code>wa</code> 를 함께 봐야 압니다.',
  },
  {
    cmd: 'free -h',
    sample: 'Mem:  15Gi  12Gi  380Mi  1.2Gi  2.9Gi  2.6Gi\n              used  free  shared buff/cache available',
    points: [
      '실제 여유는 <code>free</code> 가 아니라 <strong><code>available</code></strong> 입니다.',
      '<code>buff/cache</code> 는 커널이 성능을 위해 쓰는 캐시이고, 필요하면 즉시 회수됩니다. <strong>비어 있는 메모리는 낭비된 메모리</strong>라는 게 리눅스의 설계입니다.',
      '메모리 부족의 진짜 신호는 <code>vmstat</code> 의 <code>si/so</code>(스왑 입출력)와 <code>dmesg | grep -i oom</code> 입니다.',
    ],
    mistake: '"free 가 380Mi 밖에 없으니 메모리 부족" — available 이 2.6Gi 면 여유가 있는 상태입니다.',
  },
  {
    cmd: 'vmstat -w 1 5',
    sample: ' r  b   swpd   free   si   so    cs  us sy id wa\n 5  2      0  380M    0    0  8421  62  8  12 18',
    points: [
      '<code>r</code>: 실행을 기다리는 프로세스. <strong>코어 수보다 지속적으로 크면</strong> CPU 병목입니다.',
      '<code>b</code>: I/O 를 기다리며 잠든 프로세스. <code>wa</code> 와 함께 오르면 디스크가 원인입니다.',
      '<code>si/so</code>: 스왑 in/out. <strong>0 이 아니면 메모리 압박</strong>입니다. 여기서 0 이면 메모리는 무죄입니다.',
      '<code>cs</code>: 초당 컨텍스트 스위치. 수치 자체보다 <strong>평소 대비 급증</strong>이 중요합니다.',
    ],
    mistake: '첫 줄은 <strong>부팅 이후 누적 평균</strong>이라 현재 상태가 아닙니다. 두 번째 줄부터 읽으세요.',
  },
  {
    cmd: 'iostat -xz 1 5',
    sample: 'Device  r/s   w/s  r_await  w_await  aqu-sz  %util\nnvme0n1  12   840     0.4     28.7     6.2    99.8',
    points: [
      '<code>await</code>: 요청이 <strong>큐에서 기다린 시간 + 처리된 시간</strong>. 읽기·쓰기를 나눠 보면 어느 쪽이 막혔는지 보입니다.',
      '<code>aqu-sz</code>: 평균 큐 길이. 이게 길면서 await 가 크면 <strong>장치가 감당 못 하는 중</strong>입니다.',
      '<code>%util</code> 은 NVMe·SSD 에서 <strong>믿을 수 없습니다.</strong> 병렬로 여러 요청을 처리하므로 100% 여도 여유가 있을 수 있습니다. HDD 에서만 포화 지표로 의미가 있습니다.',
    ],
    mistake: '"%util 이 99% 니 디스크가 한계" — SSD 라면 await 와 aqu-sz 를 봐야 합니다.',
  },
  {
    cmd: 'ss -tan | awk \'{print $1}\' | sort | uniq -c',
    sample: '  1842 TIME-WAIT\n   316 ESTAB\n   128 CLOSE-WAIT',
    points: [
      '<strong>TIME-WAIT 가 많은 것은 대체로 정상</strong>입니다. 연결을 정상 종료한 쪽이 잠시(보통 60초) 남겨두는 상태입니다.',
      '<strong>CLOSE-WAIT 가 쌓이면 애플리케이션 버그</strong>입니다. 상대가 끊었는데 우리 코드가 <code>close()</code> 를 안 한 상태라 파일 디스크립터가 샙니다.',
      '<strong>SYN-SENT 가 쌓이면 상대가 응답하지 않는 것</strong>입니다. 방화벽이 막았거나 대상이 죽었습니다.',
    ],
    mistake: 'TIME-WAIT 를 줄이려고 <code>tcp_tw_recycle</code> 을 켜는 것 — NAT 환경에서 연결이 깨집니다. 이미 커널에서 제거된 옵션입니다.',
  },
  {
    cmd: 'df -h  ·  df -ih',
    sample: '/dev/sda1  50G  23G  25G  49% /\n/dev/sda1  3.2M 3.2M    0 100% /   (-i)',
    points: [
      '용량은 남았는데 <em>No space left on device</em> 가 나면 <strong>inode 고갈</strong>입니다. <code>df -ih</code> 로 확인합니다.',
      'inode 는 파일 하나당 하나씩 쓰입니다. 작은 파일 수십만 개(세션·캐시·로그 조각)가 원인인 경우가 많습니다.',
      '용량도 inode 도 여유인데 가득 찼다면 <strong>삭제됐지만 프로세스가 붙잡고 있는 파일</strong>입니다. <code>lsof +L1 | grep deleted</code> 로 찾습니다.',
    ],
    mistake: '로그 파일을 <code>rm</code> 했는데 공간이 안 돌아오는 경우 — 프로세스가 fd 를 쥐고 있어서입니다. 서비스를 재시작하거나 <code>truncate -s 0 /proc/{PID}/fd/{FD}</code> 로 비웁니다.',
  },
];

const FLOWS = [
  {
    symptom: '서버가 느리다',
    steps: [
      ['uptime', '먼저 load 를 보고 코어 수(<code>nproc</code>)와 비교합니다.'],
      ['vmstat -w 1 5', '<code>r</code> 이 크면 CPU, <code>b</code>·<code>wa</code> 가 크면 I/O, <code>si/so</code> 가 0 이 아니면 메모리로 갈립니다.'],
      ['CPU → ps -eo pid,%cpu,cmd --sort=-%cpu | head', '어느 프로세스인지 좁힙니다.'],
      ['I/O → iostat -xz 1 5', 'await 와 aqu-sz 로 장치를 확인하고, <code>iotop -o</code> 로 프로세스를 찾습니다.'],
      ['메모리 → free -h · dmesg -T | grep -i oom', 'OOM Killer 가 돌았는지 확인합니다.'],
    ],
  },
  {
    symptom: '디스크가 가득 찼다',
    steps: [
      ['df -h', '어느 마운트가 찼는지 봅니다. <code>/</code> 인지 <code>/var</code> 인지에 따라 원인이 다릅니다.'],
      ['df -ih', '용량이 남았는데 쓰기가 안 되면 inode 고갈입니다.'],
      ['du -h --max-depth=1 /var | sort -hr | head', '위에서부터 큰 디렉터리를 따라 내려갑니다.'],
      ['lsof +L1 | grep deleted', '지웠는데 공간이 안 돌아올 때 확인합니다.'],
    ],
  },
  {
    symptom: '연결이 안 된다',
    steps: [
      ['ss -tlnp | grep :8080', '<strong>서버가 실제로 듣고 있는지</strong> 먼저 확인합니다. <code>127.0.0.1:8080</code> 이면 외부에서 못 붙습니다.'],
      ['nc -zvw 3 대상 8080', '도달 자체가 되는지 봅니다. 여기서 막히면 방화벽·보안그룹입니다.'],
      ['curl -v --max-time 5 http://대상:8080/', 'DNS·TCP·TLS·응답 중 어디서 멈추는지 갈립니다.'],
      ['curl -w \'DNS %{time_namelookup} · 연결 %{time_connect} · 첫바이트 %{time_starttransfer} · 총 %{time_total}\\n\'', '느린 구간을 숫자로 특정합니다.'],
      ['tcpdump -i any -nn "tcp port 8080" -c 20', '위에서 안 잡히면 패킷을 직접 봅니다.'],
    ],
  },
  {
    symptom: '서비스가 자꾸 죽는다',
    steps: [
      ['systemctl status 서비스', 'Active 줄과 최근 종료 코드를 봅니다.'],
      ['journalctl -u 서비스 -e --no-pager', '마지막 로그를 봅니다. <code>-e</code> 는 끝으로 이동입니다.'],
      ['journalctl -u 서비스 --since "1 hour ago" -p err', '심각도 error 이상만 걸러냅니다.'],
      ['dmesg -T | grep -i -E "oom|killed"', '커널이 죽였는지 확인합니다. OOM 이면 메모리 문제입니다.'],
      ['systemctl show 서비스 -p Restart,RestartSec', '재시작 정책 때문에 반복되는 것인지 봅니다.'],
    ],
  },
];

const MODERN = [
  ['ifconfig', 'ip addr · ip link', 'net-tools 는 개발이 멈췄습니다. 가상 인터페이스와 터널을 제대로 보여주지 못합니다.'],
  ['netstat -tlpn', 'ss -tlpn', '커널 소켓 정보를 직접 읽어 연결이 많은 서버에서 훨씬 빠릅니다.'],
  ['tail -f /var/log/syslog', 'journalctl -u 유닛 -f', '유닛별·심각도별·부팅별로 걸러낼 수 있습니다.'],
  ['service 이름 start', 'systemctl start 이름', 'cgroup 으로 자원을 격리하고 의존성을 자동으로 풉니다.'],
  ['grep -r 문자열 .', 'rg 문자열', 'ripgrep 은 .gitignore 를 존중하고 훨씬 빠릅니다. 설치가 필요합니다.'],
];

const SAFETY = [
  ['<code>rm -rf</code> 의 빈 변수', '<code>rm -rf "$DIR/"*</code> 에서 <code>$DIR</code> 이 비면 <code>rm -rf /*</code> 가 됩니다.', '<code>rm -rf "${DIR:?DIR 이 비었습니다}/"*</code> — 비어 있으면 실행을 멈춥니다.'],
  ['<code>chmod 777</code>', '누구나 쓰고 실행할 수 있게 되어 권한 문제를 "해결"한 것처럼 보이지만 구멍을 냅니다.', '디렉터리 <code>755</code>, 파일 <code>644</code> 를 기본으로 두고, 필요한 곳만 <code>setfacl</code> 로 엽니다.'],
  ['<code>kill -9</code> 남용', '프로세스가 정리 작업을 못 하고 죽어 데이터가 유실되거나 락 파일이 남습니다.', '먼저 <code>kill -15</code>(SIGTERM). 몇 초 기다린 뒤에도 살아 있으면 그때 <code>-9</code>.'],
  ['<code>&gt;</code> 로 로그 비우기', '<code>&gt; app.log</code> 는 프로세스가 쥔 fd 의 오프셋을 되돌리지 않아 공간이 안 돌아올 수 있습니다.', '<code>truncate -s 0 app.log</code> 를 쓰거나 <code>logrotate</code> 에 맡깁니다.'],
  ['운영 서버에서 바로 편집', '되돌릴 수 없고 무엇을 바꿨는지 남지 않습니다.', '<code>sed -i.bak</code> 처럼 백업을 남기고, 가능하면 설정을 저장소로 관리합니다.'],
];

/* ------------------------------------------------------------------ 렌더 */

export function renderLinuxGuide(escapeHtml) {
  const levels = LEVELS.map(([lv, name, key, desc, cmds]) =>
    `<div class="lv"><div class="lv-tag">${lv}</div><div class="lv-body">` +
    `<div class="lv-name">${name} <span>${key}</span></div>` +
    `<p>${desc}</p><code class="lv-cmds">${cmds}</code></div></div>`
  ).join('');

  const anatomy = ANATOMY.map(([part, desc]) =>
    `<div class="an"><code>${part}</code><p>${desc}</p></div>`
  ).join('');

  const reading = READING.map((r) =>
    `<article class="rd">
      <h3><code>${r.cmd}</code></h3>
      <pre class="out">${escapeHtml(r.sample)}</pre>
      <ul>${r.points.map((p) => `<li>${p}</li>`).join('')}</ul>
      <div class="warn"><span>흔한 오해</span><p>${r.mistake}</p></div>
    </article>`
  ).join('');

  const flows = FLOWS.map((f) =>
    `<article class="flow">
      <h3>${escapeHtml(f.symptom)}</h3>
      <ol>${f.steps.map(([cmd, why]) =>
        `<li><code>${escapeHtml(cmd)}</code><p>${why}</p></li>`).join('')}</ol>
    </article>`
  ).join('');

  const modern = MODERN.map(([old, now, why]) =>
    `<tr><td><code class="old">${escapeHtml(old)}</code></td>` +
    `<td><code class="new">${escapeHtml(now)}</code></td><td>${why}</td></tr>`
  ).join('');

  const safety = SAFETY.map(([title, risk, fix]) =>
    `<div class="sf"><div class="sf-t">${title}</div>` +
    `<p class="sf-r">${risk}</p><p class="sf-f">${fix}</p></div>`
  ).join('');

  return `
<p class="lead">명령어 목록은 <a href="/study">치트 시트</a>에 있습니다. 이 문서는 그 다음을 다룹니다 —
<strong>출력을 어떻게 읽고, 증상이 있을 때 무엇부터 확인하는지</strong>.
외울 내용이 아니라 막혔을 때 돌아와 찾아보는 문서로 만들었습니다.</p>

<section><h2>왜 명령어를 외우면 안 되는가</h2>
<p class="lead">유닉스 도구는 하나씩 보면 초라합니다. <code>sort</code> 는 줄을 정렬할 뿐이고
<code>uniq</code> 는 이웃한 중복을 셀 뿐입니다. 힘은 <strong>연결</strong>에서 나옵니다.</p>
<p class="lead">그래서 배워야 할 것은 명령 목록이 아니라 <strong>흐름을 설계하는 감각</strong>입니다.
"이 데이터를 어떤 모양으로 바꿔서 다음 도구에 넘길까"를 생각할 수 있으면,
처음 보는 명령도 <code>--help</code> 만으로 조립할 수 있습니다.</p></section>

<section><h2>다섯 단계, 무엇이 달라지는가</h2>
<p class="lead">레벨은 아는 명령의 개수가 아니라 <strong>문제를 보는 방식</strong>으로 나뉩니다.</p>
${levels}</section>

<section><h2>파이프라인 해부</h2>
<p class="lead">L4 예제를 토큰 단위로 뜯어봅니다. 이 한 줄이 읽히면 대부분의 파이프라인이 읽힙니다.</p>
<pre class="hero">awk '$9 &gt;= 500 {print $1, $7, $9}' access.log | sort | uniq -c | sort -nr | head -10</pre>
<p class="lead">서버 에러(5xx)를 가장 많이 낸 URL 열 개를 뽑는 명령입니다.</p>
${anatomy}
<div class="tip"><span>순서가 중요합니다</span><p><code>uniq</code> 앞의 <code>sort</code> 를 빼면
결과가 조용히 틀립니다. 에러가 나지 않고 <strong>숫자만 잘못 나오므로</strong> 알아채기 어렵습니다.</p></div>
</section>

<section><h2>출력 읽는 법</h2>
<p class="lead">명령을 아는 것과 결과를 읽는 것은 다른 일입니다.
여기 있는 여섯 가지가 실무에서 가장 자주 오독되는 출력입니다.</p>
${reading}</section>

<section><h2>증상별 진단 순서</h2>
<p class="lead">막혔을 때 아무 명령이나 치지 않으려면 순서가 필요합니다.
<strong>넓게 시작해서 좁혀 들어가는</strong> 흐름입니다.</p>
${flows}</section>

<section><h2>레거시에서 현대 도구로</h2>
<p class="lead">오래된 문서를 보고 배우면 이미 대체된 도구를 익히게 됩니다.</p>
<div class="tbl"><table><thead><tr><th>예전</th><th>지금</th><th>왜</th></tr></thead>
<tbody>${modern}</tbody></table></div></section>

<section><h2>돌이킬 수 없는 실수 막기</h2>
<p class="lead">아래 다섯 가지는 실제로 서비스를 멈추게 한 적이 있는 패턴입니다.</p>
${safety}</section>

<section><h2>더 보기</h2>
<div class="ch"><div class="ch-name"><a href="/study">명령어 치트 시트</a></div>
<div class="ch-desc"><p>분야별·난이도별 명령 목록. 검색과 복사가 됩니다.</p></div></div>
<div class="ch"><div class="ch-name"><a href="https://github.com/ktci5/study" target="_blank" rel="noopener">ktci5/study 저장소</a></div>
<div class="ch-desc"><p>원본 문서(마크다운·docx)와 마인드맵.</p></div></div>
<div class="ch"><div class="ch-name">#💻-리눅스</div>
<div class="ch-desc"><p>막히는 부분은 채널에 물어보세요. 터미널 출력을 함께 올려주시면 답이 빠릅니다.</p></div></div>
</section>`;
}

export const LINUX_GUIDE_CSS =
  '.lv{display:flex;gap:14px;padding:14px 0;border-top:1px solid #2a3143;}' +
  '.lv-tag{flex:0 0 34px;height:34px;border-radius:8px;background:#2d3446;color:#8ea1ff;' +
  'font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;}' +
  '.lv-name{font-weight:600;color:#e8ecf4;font-size:14px;margin-bottom:4px;}' +
  '.lv-name span{font-weight:400;color:#6c7488;font-size:12px;margin-left:6px;}' +
  '.lv-body p{margin:0 0 6px;font-size:13.5px;line-height:1.6;}' +
  '.lv-cmds{font-size:12px;color:#7f8aa3;background:none;padding:0;}' +
  '.an{padding:10px 0;border-top:1px solid #2a3143;}' +
  '.an code{display:inline-block;margin-bottom:4px;background:#2d3446;padding:3px 8px;border-radius:5px;font-size:12.5px;}' +
  '.an p{margin:0;font-size:13.5px;line-height:1.6;}' +
  'pre.hero{background:#12151c;border:1px solid #2a3143;border-radius:10px;padding:14px;' +
  'font-size:12.5px;line-height:1.6;overflow-x:auto;color:#c9d3e6;margin:0 0 14px;}' +
  'pre.out{background:#12151c;border-left:2px solid #39415a;padding:10px 12px;margin:8px 0 10px;' +
  'font-size:12px;line-height:1.6;overflow-x:auto;color:#8fa0bd;white-space:pre;}' +
  '.rd{padding:18px 0;border-top:1px solid #2a3143;}' +
  '.rd h3{font-size:14px;margin:0 0 4px;color:#e8ecf4;}' +
  '.rd h3 code{background:none;padding:0;color:#8ea1ff;font-size:13.5px;}' +
  '.rd ul{margin:0;padding-left:18px;font-size:13.5px;line-height:1.75;color:#b7c0d4;}' +
  '.rd ul li{margin:0 0 5px;}' +
  '.warn,.tip{margin:12px 0 0;border-left:2px solid #e67e22;padding:6px 0 6px 12px;}' +
  '.tip{border-color:#5865F2;margin-top:14px;}' +
  '.warn span,.tip span{display:block;font-size:11px;letter-spacing:.04em;color:#e67e22;margin-bottom:3px;}' +
  '.tip span{color:#8ea1ff;}' +
  '.warn p,.tip p{margin:0;font-size:13px;line-height:1.6;}' +
  '.flow{padding:16px 0;border-top:1px solid #2a3143;}' +
  '.flow h3{font-size:14px;margin:0 0 8px;color:#e8ecf4;}' +
  '.flow ol{margin:0;padding-left:20px;font-size:13.5px;line-height:1.6;}' +
  '.flow ol li{margin:0 0 10px;}' +
  '.flow ol li code{display:inline-block;background:#2d3446;padding:3px 8px;border-radius:5px;' +
  'font-size:12.5px;margin-bottom:3px;color:#c9d3e6;}' +
  '.flow ol li p{margin:0;color:#a8b2c8;}' +
  '.tbl{overflow-x:auto;}' +
  '.tbl table{border-collapse:collapse;width:100%;font-size:13px;min-width:520px;}' +
  '.tbl th{text-align:left;color:#8a93a8;font-weight:600;font-size:12px;padding:8px 10px 8px 0;' +
  'border-bottom:1px solid #2a3143;}' +
  '.tbl td{padding:9px 10px 9px 0;border-bottom:1px solid #232838;vertical-align:top;color:#b7c0d4;line-height:1.55;}' +
  'code.old{color:#8a93a8;text-decoration:line-through;}' +
  'code.new{color:#7ee2b8;}' +
  '.sf{padding:12px 0;border-top:1px solid #2a3143;}' +
  '.sf-t{font-weight:600;color:#e8ecf4;font-size:13.5px;margin-bottom:4px;}' +
  '.sf-r{margin:0 0 4px;font-size:13px;line-height:1.6;color:#c8a08a;}' +
  '.sf-f{margin:0;font-size:13px;line-height:1.6;color:#9fd8bb;}';
