/**
 * 쿠버네티스 협업 가상 랩 & 시뮬레이터 고도화 — /study/simulator
 *
 * 로그인한 수강생들이 공유 가상 클러스터를 생성·조회하고,
 * 인터페이스 뷰 모드(50:50, 70:30, 30:70, 전체화면) 조정,
 * VM 노드 프로비저닝, 파드 배포, 카오스 장애 주입 및 수정 권한(ON/OFF) 제어를 지원합니다.
 */

export const SIMULATOR_TITLE = 'K8s 협업 가상 클러스터 랩 & 인프라 콘솔';

// 기본 제공 시드 랩
export const DEFAULT_LABS = [
  {
    id: 'default',
    title: '기본 2노드 클러스터 & 웹 서비스',
    description: '마스터(10.10.10.12)와 워커(10.10.20), Nginx NodePort(30080) 서비스가 배포된 기본 실습 환경',
    creator: '운영진',
    creatorId: 'system',
    createdAt: '2026-09-22',
    updatedAt: new Date().toISOString(),
    editable: true,
    trafficRps: 150,
    nodes: [
      {
        name: 'master1',
        ip: '10.10.10.12',
        role: 'control-plane',
        status: 'Ready',
        unschedulable: false,
        cpuTotalM: 2000,
        ramTotalMi: 4096,
        taints: [], // Taint 해제 상태
        labels: { 'kubernetes.io/hostname': 'master1', 'node-role.kubernetes.io/control-plane': '' }
      },
      {
        name: 'w1',
        ip: '10.10.10.20',
        role: 'worker',
        status: 'Ready',
        unschedulable: false,
        cpuTotalM: 2000,
        ramTotalMi: 4096,
        taints: [],
        labels: { 'kubernetes.io/hostname': 'w1', 'disktype': 'hdd' }
      }
    ],
    pods: [
      {
        name: 'web-deploy-84b8d9c65-k7p2m',
        namespace: 'default',
        node: 'w1',
        status: 'Running',
        ip: '172.20.1.5',
        image: 'nginx:1.25',
        cpuReqM: 100,
        ramReqMi: 128,
        labels: { app: 'web' },
        restarts: 0,
        age: '2d'
      },
      {
        name: 'web-deploy-84b8d9c65-v9x4q',
        namespace: 'default',
        node: 'master1',
        status: 'Running',
        ip: '172.20.0.8',
        image: 'nginx:1.25',
        cpuReqM: 100,
        ramReqMi: 128,
        labels: { app: 'web' },
        restarts: 0,
        age: '2d'
      },
      {
        name: 'coredns-768b85b76f-2v48m',
        namespace: 'kube-system',
        node: 'master1',
        status: 'Running',
        ip: '172.20.0.2',
        image: 'coredns:v1.11.1',
        cpuReqM: 50,
        ramReqMi: 64,
        labels: { 'k8s-app': 'kube-dns' },
        restarts: 0,
        age: '5d'
      }
    ],
    deployments: [
      {
        name: 'web-deploy',
        replicas: 2,
        image: 'nginx:1.25',
        labels: { app: 'web' }
      }
    ],
    services: [
      {
        name: 'web-service',
        type: 'NodePort',
        clusterIp: '10.96.100.50',
        nodePort: 30080,
        port: 80,
        targetPort: 80,
        selector: { app: 'web' }
      }
    ],
    activityLogs: [
      { time: '02:00:00', user: '운영진', action: '기본 2노드 클러스터 초기화 완료' },
      { time: '02:01:15', user: '운영진', action: 'web-deploy 디플로이먼트 및 NodePort(30080) 서비스 생성' }
    ]
  },
  {
    id: 'scheduling-lab',
    title: 'Taint & nodeSelector 스케줄링 트러블슈팅 랩',
    description: '마스터의 NoSchedule Taint와 워커의 라벨 불일치로 발생한 Pending 파드를 해결하는 트러블슈팅 실습',
    creator: '운영진',
    creatorId: 'system',
    createdAt: '2026-09-22',
    updatedAt: new Date().toISOString(),
    editable: true,
    trafficRps: 0,
    nodes: [
      {
        name: 'master1',
        ip: '10.10.10.12',
        role: 'control-plane',
        status: 'Ready',
        unschedulable: false,
        cpuTotalM: 2000,
        ramTotalMi: 4096,
        taints: [{ key: 'node-role.kubernetes.io/control-plane', effect: 'NoSchedule' }],
        labels: { 'kubernetes.io/hostname': 'master1' }
      },
      {
        name: 'w1',
        ip: '10.10.10.20',
        role: 'worker',
        status: 'Ready',
        unschedulable: false,
        cpuTotalM: 2000,
        ramTotalMi: 4096,
        taints: [],
        labels: { 'kubernetes.io/hostname': 'w1' } // disktype=hdd 아직 없음
      }
    ],
    pods: [
      {
        name: 'hdd-pod',
        namespace: 'default',
        node: 'None',
        status: 'Pending',
        ip: 'None',
        image: 'nginx:alpine',
        cpuReqM: 100,
        ramReqMi: 128,
        labels: { role: 'storage' },
        nodeSelector: { disktype: 'hdd' },
        restarts: 0,
        age: '10m'
      }
    ],
    deployments: [],
    services: [],
    activityLogs: [
      { time: '02:05:00', user: '운영진', action: 'hdd-pod (nodeSelector: disktype=hdd) 생성 -> 매칭 노드 없어 Pending 상태 진입' }
    ]
  },
  {
    id: 'hpa-traffic-lab',
    title: '부하 분산 & 리소스 오토스케일링 랩',
    description: '트래픽 부하 주입기로 CPU 사용량을 급증시키고 kubectl top 메트릭을 실시간 관찰하는 실습 룸',
    creator: '운영진',
    creatorId: 'system',
    createdAt: '2026-09-22',
    updatedAt: new Date().toISOString(),
    editable: true,
    trafficRps: 850,
    nodes: [
      {
        name: 'master1',
        ip: '10.10.10.12',
        role: 'control-plane',
        status: 'Ready',
        unschedulable: false,
        cpuTotalM: 2000,
        ramTotalMi: 4096,
        taints: [],
        labels: { 'kubernetes.io/hostname': 'master1' }
      },
      {
        name: 'w1',
        ip: '10.10.10.20',
        role: 'worker',
        status: 'Ready',
        unschedulable: false,
        cpuTotalM: 2000,
        ramTotalMi: 4096,
        taints: [],
        labels: { 'kubernetes.io/hostname': 'w1' }
      }
    ],
    pods: [
      {
        name: 'api-service-67f94bc4-9jk2l',
        namespace: 'default',
        node: 'w1',
        status: 'Running',
        ip: '172.20.1.12',
        image: 'kt-api:v1',
        cpuReqM: 200,
        ramReqMi: 256,
        labels: { app: 'api' },
        restarts: 0,
        age: '1d'
      },
      {
        name: 'api-service-67f94bc4-m8x3a',
        namespace: 'default',
        node: 'master1',
        status: 'Running',
        ip: '172.20.0.15',
        image: 'kt-api:v1',
        cpuReqM: 200,
        ramReqMi: 256,
        labels: { app: 'api' },
        restarts: 0,
        age: '1d'
      }
    ],
    deployments: [
      {
        name: 'api-service',
        replicas: 2,
        image: 'kt-api:v1',
        labels: { app: 'api' }
      }
    ],
    services: [
      {
        name: 'api-service',
        type: 'NodePort',
        clusterIp: '10.96.200.33',
        nodePort: 30090,
        port: 8080,
        targetPort: 8080,
        selector: { app: 'api' }
      }
    ],
    activityLogs: [
      { time: '02:10:00', user: '운영진', action: '트래픽 부하 테스트 룸 생성 (현재 850 req/s 인입 중)' }
    ]
  }
];

// KV 헬퍼 함수
export async function getLabsIndex(env) {
  if (!env || !env.ROSTER) {
    return DEFAULT_LABS.map(summarizeLab);
  }
  try {
    const list = await env.ROSTER.get('sim:labs:index', 'json');
    if (list && Array.isArray(list) && list.length > 0) {
      return list;
    }
    const seedIndex = DEFAULT_LABS.map(summarizeLab);
    await env.ROSTER.put('sim:labs:index', JSON.stringify(seedIndex));
    for (const lab of DEFAULT_LABS) {
      await env.ROSTER.put(`sim:lab:${lab.id}`, JSON.stringify(lab));
    }
    return seedIndex;
  } catch (err) {
    console.error('getLabsIndex error:', err);
    return DEFAULT_LABS.map(summarizeLab);
  }
}

export async function getLabDetail(env, id) {
  if (!env || !env.ROSTER) {
    const found = DEFAULT_LABS.find((l) => l.id === id);
    return found ? JSON.parse(JSON.stringify(found)) : null;
  }
  try {
    let lab = await env.ROSTER.get(`sim:lab:${id}`, 'json');
    if (!lab) {
      const fallback = DEFAULT_LABS.find((l) => l.id === id);
      if (fallback) {
        lab = JSON.parse(JSON.stringify(fallback));
        await env.ROSTER.put(`sim:lab:${id}`, JSON.stringify(lab));
      }
    }
    return lab;
  } catch (err) {
    console.error('getLabDetail error:', err);
    return null;
  }
}

export async function saveLabDetail(env, lab) {
  lab.updatedAt = new Date().toISOString();
  if (env && env.ROSTER) {
    await env.ROSTER.put(`sim:lab:${lab.id}`, JSON.stringify(lab));
    try {
      let index = await env.ROSTER.get('sim:labs:index', 'json');
      if (!Array.isArray(index)) index = [];
      const idx = index.findIndex((item) => item.id === lab.id);
      const summary = summarizeLab(lab);
      if (idx >= 0) {
        index[idx] = summary;
      } else {
        index.unshift(summary);
      }
      await env.ROSTER.put('sim:labs:index', JSON.stringify(index));
    } catch (e) {
      console.error('sync index error:', e);
    }
  }
}

function summarizeLab(lab) {
  return {
    id: lab.id,
    title: lab.title,
    description: lab.description,
    creator: lab.creator || '수강생',
    creatorId: lab.creatorId || 'anonymous',
    createdAt: lab.createdAt || new Date().toISOString().slice(0, 10),
    editable: Boolean(lab.editable),
    nodeCount: lab.nodes?.length || 2,
    podCount: lab.pods?.length || 0,
    trafficRps: lab.trafficRps || 0
  };
}

// 스케줄러 알고리즘 시뮬레이션
export function schedulePod(pod, lab) {
  for (const node of lab.nodes) {
    // 0. 노드 상태가 Ready가 아니거나 스케줄링 비활성화(cordon)인 경우 제외
    if (node.status !== 'Ready' || node.unschedulable) continue;

    // 1. Taint 검사 (NoSchedule 걸려있으면 제외)
    const hasNoSchedule = node.taints && node.taints.some((t) => t.effect === 'NoSchedule');
    if (hasNoSchedule) continue;

    // 2. nodeSelector 검사
    if (pod.nodeSelector) {
      let match = true;
      for (const [k, v] of Object.entries(pod.nodeSelector)) {
        if (!node.labels || node.labels[k] !== v) {
          match = false;
          break;
        }
      }
      if (!match) continue;
    }

    // 조건 충족 노드 발견 -> 배치
    pod.node = node.name;
    pod.status = 'Running';
    const subnet = node.name === 'master1' ? '172.20.0' : `172.20.${(node.name.charCodeAt(node.name.length - 1) % 9) + 1}`;
    const rand = Math.floor(Math.random() * 200) + 10;
    pod.ip = `${subnet}.${rand}`;
    return true;
  }

  // 매칭되는 노드가 없음
  pod.node = 'None';
  pod.status = 'Pending';
  pod.ip = 'None';
  return false;
}

// 클러스터 전체 파드 재스케줄링 (노드 추가/상태변경/Taint/라벨 변경 시 호출)
export function rescheduleAll(lab) {
  let changed = false;
  if (!lab.pods) return false;

  for (const p of lab.pods) {
    const currentNode = lab.nodes.find((n) => n.name === p.node);
    const nodeUnavailable = !currentNode || currentNode.status !== 'Ready' || currentNode.unschedulable;
    
    // 현재 노드가 불가능하거나 이미 Pending인 경우
    if (p.status === 'Pending' || nodeUnavailable) {
      const prevStatus = p.status;
      const prevNode = p.node;
      schedulePod(p, lab);
      if (p.status !== prevStatus || p.node !== prevNode) {
        changed = true;
      }
    }
  }
  return changed;
}

// 쿠버네티스 명령어 인터프리터
export function evalK8sCommand(cmdLine, lab, user) {
  const line = cmdLine.trim();
  if (!line) return { output: '', labChanged: false };

  // alias k=kubectl 처리
  let tokens = line.split(/\s+/);
  if (tokens[0] === 'k') {
    tokens[0] = 'kubectl';
  }

  const isMutating = ['run', 'create', 'scale', 'delete', 'taint', 'label', 'apply', 'cordon', 'uncordon', 'drain', 'reset'].includes(tokens[1]);

  // 수정 권한 OFF 체크
  if (isMutating && !lab.editable) {
    return {
      output: `\x1b[31;1m❌ [수정 권한 거부 - Read-Only 모드]\x1b[0m\n` +
              `현재 실습 랩의 수정 권한이 \x1b[33m[ OFF ]\x1b[0m 상태입니다.\n` +
              `클러스터를 제어하거나 파드를 생성/삭제하려면 우측 상단의 \x1b[32;1m[수정 권한]\x1b[0m 스위치를 켜주세요(ON).`,
      labChanged: false
    };
  }

  const timeStr = new Date().toTimeString().slice(0, 8);
  const userName = user?.name || '수강생';

  // 1. HELP
  if (tokens[0] === 'help' || line === '?') {
    return {
      output: `\x1b[36;1m☸️ 사용 가능한 쿠버네티스 명령어 목록:\x1b[0m
  • \x1b[33mk get nodes [-o wide]\x1b[0m        : 노드 목록 및 IP 조회
  • \x1b[33mk get pods [-o wide]\x1b[0m         : 파드 상태 및 할당 노드 조회
  • \x1b[33mk get deploy\x1b[0m                  : 디플로이먼트 목록 조회
  • \x1b[33mk get svc\x1b[0m                     : 서비스(ClusterIP, NodePort) 조회
  • \x1b[33mk top nodes / k top pods\x1b[0m      : 가상 CPU/메모리 사용률 실시간 조회
  • \x1b[33mk run <이름> --image=<이미지>\x1b[0m  : 단일 파드 생성
  • \x1b[33mk create deploy <이름> --image=<이미지> --replicas=<N>\x1b[0m : 디플로이먼트 생성
  • \x1b[33mk scale deploy <이름> --replicas=<N>\x1b[0m                   : 레플리카 수 조정
  • \x1b[33mk expose deploy <이름> --port=80 --type=NodePort\x1b[0m       : NodePort 서비스 노출
  • \x1b[33mk taint nodes <노드> <키>:<효과>[-]\x1b[0m                  : 노드 Taint 설정/해제
  • \x1b[33mk label nodes <노드> <키>=<값>[-]\x1b[0m                   : 노드 라벨 부여/삭제
  • \x1b[33mk cordon <노드> / k uncordon <노드>\x1b[0m                 : 노드 스케줄링 중단/재개
  • \x1b[33mk drain <노드> --ignore-daemonsets\x1b[0m                 : 노드 파드 비우기(Drain)
  • \x1b[33mk delete pod/deploy/svc <이름>\x1b[0m                         : 리소스 삭제
  • \x1b[33mcurl <IP>:<포트>\x1b[0m                                     : NodePort HTTP 웹서버 호출 테스트
  • \x1b[33mclear\x1b[0m                                                 : 화면 지우기`,
      labChanged: false
    };
  }

  // 2. CURL 테스트
  if (tokens[0] === 'curl') {
    const target = tokens[tokens.length - 1];
    const match = target.match(/(?:http:\/\/)?([^:/]+)(?::(\d+))?/);
    if (!match) {
      return { output: `curl: try 'curl --help' or check target IP:PORT`, labChanged: false };
    }
    const ip = match[1];
    const port = parseInt(match[2] || '80', 10);

    const svc = lab.services?.find((s) => (s.nodePort === port) || (s.clusterIp === ip && s.port === port));
    const isNodeIp = lab.nodes?.some((n) => n.ip === ip || ip === 'localhost' || ip === '127.0.0.1');

    if (svc && (isNodeIp || svc.clusterIp === ip)) {
      const targetPods = lab.pods?.filter((p) => p.status === 'Running');
      if (targetPods && targetPods.length > 0) {
        return {
          output: `\x1b[32mHTTP/1.1 200 OK\x1b[0m
Server: nginx/1.25.3
Date: ${new Date().toUTCString()}
Content-Type: text/html
Content-Length: 615

<!DOCTYPE html>
<html>
<head><title>Welcome to KT Cloud 5기 K8s Service!</title></head>
<body style="font-family:sans-serif;text-align:center;padding:40px;">
<h1>👋 Welcome to KT Cloud Kubernetes Cluster!</h1>
<p>Served by Pod: <b>${targetPods[0].name}</b> (Node: <b>${targetPods[0].node}</b>)</p>
<p>ClusterIP: ${svc.clusterIp}:${svc.port} | NodePort: ${svc.nodePort || 'N/A'}</p>
</body>
</html>`,
          labChanged: false
        };
      } else {
        return { output: `curl: (52) Empty reply from server (No running pods available behind service)`, labChanged: false };
      }
    } else {
      return { output: `curl: (7) Failed to connect to ${ip} port ${port}: Connection refused`, labChanged: false };
    }
  }

  if (tokens[0] !== 'kubectl') {
    return { output: `bash: ${tokens[0]}: command not found. Type 'help' for valid commands.`, labChanged: false };
  }

  const sub = tokens[1];

  // 3. GET NODES
  if (sub === 'get' && tokens[2] && tokens[2].startsWith('node')) {
    const isWide = line.includes('-o wide');
    let out = isWide
      ? 'NAME      STATUS                     ROLES           AGE   VERSION   INTERNAL-IP   OS-IMAGE             KERNEL-VERSION\n'
      : 'NAME      STATUS                     ROLES           AGE   VERSION\n';

    for (const n of lab.nodes) {
      let statusStr = n.status;
      if (n.unschedulable) {
        statusStr = `${n.status},SchedulingDisabled`;
      }
      const roles = n.role === 'control-plane' ? 'control-plane' : '<none>';
      if (isWide) {
        out += `${n.name.padEnd(10)}${statusStr.padEnd(27)}${roles.padEnd(16)}5d    v1.28.2   ${n.ip.padEnd(14)}Ubuntu 22.04.3 LTS   5.15.0-89-generic\n`;
      } else {
        out += `${n.name.padEnd(10)}${statusStr.padEnd(27)}${roles.padEnd(16)}5d    v1.28.2\n`;
      }
    }
    return { output: out.trimEnd(), labChanged: false };
  }

  // 4. GET PODS
  if (sub === 'get' && tokens[2] && tokens[2].startsWith('pod')) {
    const isWide = line.includes('-o wide');
    let out = isWide
      ? 'NAME                            READY   STATUS    RESTARTS   AGE   IP           NODE      NOMINATED NODE\n'
      : 'NAME                            READY   STATUS    RESTARTS   AGE\n';

    if (!lab.pods || lab.pods.length === 0) {
      return { output: 'No resources found in default namespace.', labChanged: false };
    }

    for (const p of lab.pods) {
      const ready = p.status === 'Running' ? '1/1' : '0/1';
      const statusColored = p.status === 'Running' ? `\x1b[32m${p.status}\x1b[0m` : `\x1b[33m${p.status}\x1b[0m`;
      if (isWide) {
        out += `${p.name.padEnd(32)}${ready.padEnd(8)}${statusColored.padEnd(18)}${String(p.restarts).padEnd(11)}${p.age.padEnd(6)}${p.ip.padEnd(13)}${p.node.padEnd(10)}<none>\n`;
      } else {
        out += `${p.name.padEnd(32)}${ready.padEnd(8)}${statusColored.padEnd(18)}${String(p.restarts).padEnd(11)}${p.age}\n`;
      }
    }
    return { output: out.trimEnd(), labChanged: false };
  }

  // 5. GET DEPLOY
  if (sub === 'get' && tokens[2] && (tokens[2].startsWith('deploy') || tokens[2] === 'all')) {
    let out = 'NAME         READY   UP-TO-DATE   AVAILABLE   AGE\n';
    if (lab.deployments && lab.deployments.length > 0) {
      for (const d of lab.deployments) {
        const readyCount = lab.pods?.filter((p) => p.name.startsWith(d.name) && p.status === 'Running').length || 0;
        out += `${d.name.padEnd(13)}${readyCount}/${d.replicas}     ${d.replicas}            ${readyCount}           2d\n`;
      }
    } else {
      out = 'No deployments found in default namespace.\n';
    }
    if (tokens[2] !== 'all') {
      return { output: out.trimEnd(), labChanged: false };
    }
  }

  // 6. GET SVC
  if (sub === 'get' && tokens[2] && (tokens[2].startsWith('svc') || tokens[2].startsWith('service'))) {
    let out = 'NAME          TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE\n';
    out += 'kubernetes    ClusterIP   10.96.0.1       <none>        443/TCP        5d\n';
    if (lab.services && lab.services.length > 0) {
      for (const s of lab.services) {
        const portStr = s.type === 'NodePort' ? `${s.port}:${s.nodePort}/TCP` : `${s.port}/TCP`;
        out += `${s.name.padEnd(14)}${s.type.padEnd(12)}${s.clusterIp.padEnd(16)}<none>        ${portStr.padEnd(15)}2d\n`;
      }
    }
    return { output: out.trimEnd(), labChanged: false };
  }

  // 7. TOP NODES / PODS (가상 자원 메트릭)
  if (sub === 'top') {
    const target = tokens[2];
    const rps = lab.trafficRps || 0;

    if (target && target.startsWith('node')) {
      let out = 'NAME      CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%\n';
      for (const n of lab.nodes) {
        if (n.status !== 'Ready') {
          out += `${n.name.padEnd(10)}<unknown>     0%     <unknown>       0%\n`;
          continue;
        }
        const hostedPods = lab.pods?.filter((p) => p.node === n.name && p.status === 'Running') || [];
        const baseCpu = 180 + hostedPods.length * 80;
        const trafficCpu = Math.round((rps / 3000) * 800);
        const cpuM = Math.min(n.cpuTotalM, baseCpu + trafficCpu);
        const cpuPct = Math.round((cpuM / n.cpuTotalM) * 100);

        const baseRam = 1400 + hostedPods.length * 150;
        const ramMi = Math.min(n.ramTotalMi, baseRam + Math.round((rps / 3000) * 400));
        const ramPct = Math.round((ramMi / n.ramTotalMi) * 100);

        out += `${n.name.padEnd(10)}${String(cpuM + 'm').padEnd(13)}${String(cpuPct + '%').padEnd(7)}${String(ramMi + 'Mi').padEnd(16)}${ramPct}%\n`;
      }
      return { output: out.trimEnd(), labChanged: false };
    }

    if (target && target.startsWith('pod')) {
      let out = 'NAME                            CPU(cores)   MEMORY(bytes)\n';
      if (!lab.pods || lab.pods.length === 0) {
        return { output: 'No resources found in default namespace.', labChanged: false };
      }
      const runningCount = lab.pods.filter((p) => p.status === 'Running').length || 1;
      for (const p of lab.pods) {
        if (p.status !== 'Running') continue;
        const extra = Math.round((rps / runningCount) * 0.4);
        const cpuM = (p.cpuReqM || 100) + extra;
        const ramMi = (p.ramReqMi || 128) + Math.round(extra * 0.2);
        out += `${p.name.padEnd(32)}${String(cpuM + 'm').padEnd(13)}${ramMi}Mi\n`;
      }
      return { output: out.trimEnd(), labChanged: false };
    }
  }

  // 8. CORDON / UNCORDON / DRAIN
  if (sub === 'cordon' && tokens[2]) {
    const nodeName = tokens[2];
    const node = lab.nodes?.find((n) => n.name === nodeName);
    if (!node) return { output: `Error from server (NotFound): nodes "${nodeName}" not found`, labChanged: false };
    node.unschedulable = true;
    lab.activityLogs.unshift({ time: timeStr, user: userName, action: `노드 '${nodeName}' 스케줄링 비활성화 (cordoned)` });
    return { output: `node/${nodeName} cordoned`, labChanged: true };
  }

  if (sub === 'uncordon' && tokens[2]) {
    const nodeName = tokens[2];
    const node = lab.nodes?.find((n) => n.name === nodeName);
    if (!node) return { output: `Error from server (NotFound): nodes "${nodeName}" not found`, labChanged: false };
    node.unschedulable = false;
    rescheduleAll(lab);
    lab.activityLogs.unshift({ time: timeStr, user: userName, action: `노드 '${nodeName}' 스케줄링 재개 (uncordoned)` });
    return { output: `node/${nodeName} uncordoned`, labChanged: true };
  }

  if (sub === 'drain' && tokens[2]) {
    const nodeName = tokens[2];
    const node = lab.nodes?.find((n) => n.name === nodeName);
    if (!node) return { output: `Error from server (NotFound): nodes "${nodeName}" not found`, labChanged: false };
    node.unschedulable = true;

    // 해당 노드의 파드들을 다른 노드로 퇴출 및 재스케줄링
    let evicted = 0;
    for (const p of lab.pods) {
      if (p.node === nodeName) {
        p.node = 'None';
        p.status = 'Pending';
        schedulePod(p, lab);
        evicted++;
      }
    }
    lab.activityLogs.unshift({ time: timeStr, user: userName, action: `노드 '${nodeName}' 드레인 완료 (${evicted}개 파드 퇴출 및 재배치)` });
    return { output: `node/${nodeName} cordoned\nevicting pod on ${nodeName}...\nnode/${nodeName} drained`, labChanged: true };
  }

  // 9. RUN (파드 생성)
  if (sub === 'run') {
    const podName = tokens[2];
    if (!podName) return { output: 'error: NAME is required for kubectl run', labChanged: false };

    let image = 'nginx:latest';
    const imgArg = tokens.find((t) => t.startsWith('--image='));
    if (imgArg) image = imgArg.split('=')[1];

    const newPod = {
      name: podName,
      namespace: 'default',
      node: 'None',
      status: 'Pending',
      ip: 'None',
      image,
      cpuReqM: 100,
      ramReqMi: 128,
      labels: { run: podName },
      restarts: 0,
      age: '10s'
    };

    schedulePod(newPod, lab);
    if (!lab.pods) lab.pods = [];
    lab.pods.push(newPod);

    lab.activityLogs.unshift({
      time: timeStr,
      user: userName,
      action: `파드 '${podName}' 생성 (배치: ${newPod.node}, 상태: ${newPod.status})`
    });

    return { output: `pod/${podName} created`, labChanged: true };
  }

  // 10. CREATE DEPLOYMENT
  if (sub === 'create' && (tokens[2] === 'deployment' || tokens[2] === 'deploy')) {
    const depName = tokens[3];
    if (!depName) return { output: 'error: NAME is required for kubectl create deployment', labChanged: false };

    let image = 'nginx:latest';
    const imgArg = tokens.find((t) => t.startsWith('--image='));
    if (imgArg) image = imgArg.split('=')[1];

    let replicas = 1;
    const repArg = tokens.find((t) => t.startsWith('--replicas='));
    if (repArg) replicas = parseInt(repArg.split('=')[1], 10) || 1;

    const newDep = { name: depName, replicas, image, labels: { app: depName } };
    if (!lab.deployments) lab.deployments = [];
    lab.deployments.push(newDep);

    if (!lab.pods) lab.pods = [];
    for (let i = 0; i < replicas; i++) {
      const randHash = Math.random().toString(36).substring(2, 7);
      const pod = {
        name: `${depName}-${randHash}`,
        namespace: 'default',
        node: 'None',
        status: 'Pending',
        ip: 'None',
        image,
        cpuReqM: 100,
        ramReqMi: 128,
        labels: { app: depName },
        restarts: 0,
        age: '5s'
      };
      schedulePod(pod, lab);
      lab.pods.push(pod);
    }

    lab.activityLogs.unshift({
      time: timeStr,
      user: userName,
      action: `디플로이먼트 '${depName}' (레플리카: ${replicas}개) 생성`
    });

    return { output: `deployment.apps/${depName} created`, labChanged: true };
  }

  // 11. SCALE DEPLOYMENT
  if (sub === 'scale' && (tokens[2] === 'deployment' || tokens[2] === 'deploy')) {
    const depName = tokens[3];
    const repArg = tokens.find((t) => t.startsWith('--replicas='));
    if (!depName || !repArg) {
      return { output: 'error: required flag(s) --replicas not set, or deployment name missing', labChanged: false };
    }
    const count = parseInt(repArg.split('=')[1], 10);
    const dep = lab.deployments?.find((d) => d.name === depName);
    if (!dep) {
      return { output: `Error from server (NotFound): deployments.apps "${depName}" not found`, labChanged: false };
    }

    const currentPods = lab.pods.filter((p) => p.name.startsWith(depName));
    if (count > currentPods.length) {
      for (let i = currentPods.length; i < count; i++) {
        const randHash = Math.random().toString(36).substring(2, 7);
        const pod = {
          name: `${depName}-${randHash}`,
          namespace: 'default',
          node: 'None',
          status: 'Pending',
          ip: 'None',
          image: dep.image,
          cpuReqM: 100,
          ramReqMi: 128,
          labels: dep.labels || { app: depName },
          restarts: 0,
          age: '2s'
        };
        schedulePod(pod, lab);
        lab.pods.push(pod);
      }
    } else if (count < currentPods.length) {
      const removeCount = currentPods.length - count;
      let removed = 0;
      lab.pods = lab.pods.filter((p) => {
        if (p.name.startsWith(depName) && removed < removeCount) {
          removed++;
          return false;
        }
        return true;
      });
    }

    dep.replicas = count;
    lab.activityLogs.unshift({
      time: timeStr,
      user: userName,
      action: `디플로이먼트 '${depName}' 스케일 -> ${count}개`
    });

    return { output: `deployment.apps/${depName} scaled`, labChanged: true };
  }

  // 12. EXPOSE DEPLOYMENT
  if (sub === 'expose' && (tokens[2] === 'deployment' || tokens[2] === 'deploy')) {
    const depName = tokens[3];
    const typeArg = tokens.find((t) => t.startsWith('--type='));
    const isNodePort = typeArg && typeArg.includes('NodePort');

    const svcName = `${depName}-service`;
    const randPort = Math.floor(Math.random() * 500) + 30000;
    const newSvc = {
      name: svcName,
      type: isNodePort ? 'NodePort' : 'ClusterIP',
      clusterIp: `10.96.${Math.floor(Math.random()*200)+10}.${Math.floor(Math.random()*200)+10}`,
      nodePort: isNodePort ? randPort : undefined,
      port: 80,
      targetPort: 80,
      selector: { app: depName }
    };

    if (!lab.services) lab.services = [];
    lab.services.push(newSvc);

    lab.activityLogs.unshift({
      time: timeStr,
      user: userName,
      action: `서비스 '${svcName}' (${isNodePort ? `NodePort: ${randPort}` : 'ClusterIP'}) 생성`
    });

    return { output: `service/${svcName} exposed`, labChanged: true };
  }

  // 13. TAINT NODES
  if (sub === 'taint' && tokens[2] === 'nodes') {
    const nodeName = tokens[3];
    const taintExpr = tokens[4];
    if (!nodeName || !taintExpr) return { output: 'error: node name and taint expression required', labChanged: false };

    const node = lab.nodes?.find((n) => n.name === nodeName);
    if (!node) return { output: `Error from server (NotFound): nodes "${nodeName}" not found`, labChanged: false };

    if (!node.taints) node.taints = [];

    if (taintExpr.endsWith('-')) {
      const key = taintExpr.slice(0, -1).split(':')[0];
      node.taints = node.taints.filter((t) => !t.key.startsWith(key));
      rescheduleAll(lab);

      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `노드 '${nodeName}' Taint 해제 (${taintExpr})`
      });
      return { output: `node/${nodeName} untainted`, labChanged: true };
    } else {
      const [key, effect] = taintExpr.split(':');
      node.taints.push({ key, effect: effect || 'NoSchedule' });

      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `노드 '${nodeName}' Taint 설정 (${key}:${effect})`
      });
      return { output: `node/${nodeName} tainted`, labChanged: true };
    }
  }

  // 14. LABEL NODES
  if (sub === 'label' && tokens[2] === 'nodes') {
    const nodeName = tokens[3];
    const labelExpr = tokens[4];
    if (!nodeName || !labelExpr) return { output: 'error: node name and label expression required', labChanged: false };

    const node = lab.nodes?.find((n) => n.name === nodeName);
    if (!node) return { output: `Error from server (NotFound): nodes "${nodeName}" not found`, labChanged: false };

    if (!node.labels) node.labels = {};

    if (labelExpr.endsWith('-')) {
      const key = labelExpr.slice(0, -1);
      delete node.labels[key];
      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `노드 '${nodeName}' 라벨 제거 (${key})`
      });
      return { output: `node/${nodeName} unlabeled`, labChanged: true };
    } else {
      const [k, v] = labelExpr.split('=');
      node.labels[k] = v || '';
      rescheduleAll(lab);

      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `노드 '${nodeName}' 라벨 부여 (${k}=${v})`
      });
      return { output: `node/${nodeName} labeled`, labChanged: true };
    }
  }

  // 15. DELETE RESOURCE
  if (sub === 'delete') {
    const type = tokens[2];
    const name = tokens[3];
    if (!type || !name) return { output: 'error: TYPE and NAME required for delete', labChanged: false };

    if (type.startsWith('pod')) {
      const idx = lab.pods.findIndex((p) => p.name === name);
      if (idx === -1) return { output: `Error from server (NotFound): pods "${name}" not found`, labChanged: false };
      lab.pods.splice(idx, 1);
      lab.activityLogs.unshift({ time: timeStr, user: userName, action: `파드 '${name}' 삭제` });
      return { output: `pod "${name}" deleted`, labChanged: true };
    }

    if (type.startsWith('deploy')) {
      const idx = lab.deployments.findIndex((d) => d.name === name);
      if (idx === -1) return { output: `Error from server (NotFound): deployments.apps "${name}" not found`, labChanged: false };
      lab.deployments.splice(idx, 1);
      lab.pods = lab.pods.filter((p) => !p.name.startsWith(name));
      lab.activityLogs.unshift({ time: timeStr, user: userName, action: `디플로이먼트 '${name}' 삭제` });
      return { output: `deployment.apps "${name}" deleted`, labChanged: true };
    }

    if (type.startsWith('svc') || type.startsWith('service')) {
      const idx = lab.services.findIndex((s) => s.name === name);
      if (idx === -1) return { output: `Error from server (NotFound): services "${name}" not found`, labChanged: false };
      lab.services.splice(idx, 1);
      lab.activityLogs.unshift({ time: timeStr, user: userName, action: `서비스 '${name}' 삭제` });
      return { output: `service "${name}" deleted`, labChanged: true };
    }
  }

  return {
    output: `error: unknown command or syntax: "${line}". Type 'help' for examples.`,
    labChanged: false
  };
}

// REST API 핸들러
export async function handleSimulatorApi(request, path, env, user) {
  const method = request.method;
  const jsonHeaders = {
    'content-type': 'application/json; charset=UTF-8',
    'cache-control': 'no-store'
  };

  // 1. GET /api/simulator/labs : 랩 목록 조회
  if (path === '/api/simulator/labs' && method === 'GET') {
    const list = await getLabsIndex(env);
    return new Response(JSON.stringify({ ok: true, labs: list }), { headers: jsonHeaders });
  }

  // 2. POST /api/simulator/labs : 신규 랩 생성 & 저장
  if (path === '/api/simulator/labs' && method === 'POST') {
    let body = {};
    try { body = await request.json(); } catch {}
    const title = (body.title || '').trim() || '새 쿠버네티스 실습 랩';
    const desc = (body.description || '').trim() || '수강생 생성 가상 클러스터 실습 환경';
    const workerCount = Math.min(Math.max(1, parseInt(body.workerCount || '1', 10)), 5);
    const cpuPerNode = parseInt(body.cpuPerNode || '2000', 10);
    const ramPerNode = parseInt(body.ramPerNode || '4096', 10);
    const editable = body.editable !== false;

    const id = 'lab-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const creatorName = user?.name || '수강생';

    const nodes = [
      {
        name: 'master1',
        ip: '10.10.10.12',
        role: 'control-plane',
        status: 'Ready',
        unschedulable: false,
        cpuTotalM: cpuPerNode,
        ramTotalMi: ramPerNode,
        taints: [],
        labels: { 'kubernetes.io/hostname': 'master1' }
      }
    ];

    for (let i = 1; i <= workerCount; i++) {
      nodes.push({
        name: `w${i}`,
        ip: `10.10.10.${20 + (i - 1) * 10}`,
        role: 'worker',
        status: 'Ready',
        unschedulable: false,
        cpuTotalM: cpuPerNode,
        ramTotalMi: ramPerNode,
        taints: [],
        labels: { 'kubernetes.io/hostname': `w${i}`, 'disktype': i === 1 ? 'hdd' : 'ssd' }
      });
    }

    const newLab = {
      id,
      title,
      description: desc,
      creator: creatorName,
      creatorId: user?.id || 'anon',
      createdAt: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
      editable,
      trafficRps: 100,
      nodes,
      pods: [
        {
          name: 'web-pod-default',
          namespace: 'default',
          node: nodes[1].name,
          status: 'Running',
          ip: '172.20.1.2',
          image: 'nginx:alpine',
          cpuReqM: 100,
          ramReqMi: 128,
          labels: { app: 'web' },
          restarts: 0,
          age: '1m'
        }
      ],
      deployments: [],
      services: [
        {
          name: 'web-svc',
          type: 'NodePort',
          clusterIp: '10.96.150.80',
          nodePort: 30080,
          port: 80,
          targetPort: 80,
          selector: { app: 'web' }
        }
      ],
      activityLogs: [
        {
          time: new Date().toTimeString().slice(0, 8),
          user: creatorName,
          action: `새 실습 랩 '${title}' 생성 완료 (수정 권한: ${editable ? 'ON' : 'OFF'})`
        }
      ]
    };

    await saveLabDetail(env, newLab);
    return new Response(JSON.stringify({ ok: true, lab: newLab }), { headers: jsonHeaders, status: 201 });
  }

  // /api/simulator/labs/:id 관련
  const match = path.match(/^\/api\/simulator\/labs\/([a-zA-Z0-9_-]+)(?:\/(.*))?$/);
  if (match) {
    const labId = match[1];
    const action = match[2];

    const lab = await getLabDetail(env, labId);
    if (!lab) {
      return new Response(JSON.stringify({ ok: false, error: 'Lab not found' }), { headers: jsonHeaders, status: 404 });
    }

    const userName = user?.name || '수강생';
    const timeStr = new Date().toTimeString().slice(0, 8);

    // 3. GET /api/simulator/labs/:id : 랩 상세 조회
    if (!action && method === 'GET') {
      return new Response(JSON.stringify({ ok: true, lab }), { headers: jsonHeaders });
    }

    // 4. PATCH /api/simulator/labs/:id/permission : 수정 권한 ON/OFF 토글
    if (action === 'permission' && (method === 'PATCH' || method === 'POST')) {
      let body = {};
      try { body = await request.json(); } catch {}
      const editable = Boolean(body.editable);
      lab.editable = editable;

      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: editable
          ? `🔓 수정 권한을 [ ON ]으로 변경했습니다. (모든 수강생 제어 가능)`
          : `🔒 수정 권한을 [ OFF ](조회 전용)로 변경했습니다.`
      });

      await saveLabDetail(env, lab);
      return new Response(JSON.stringify({ ok: true, editable: lab.editable, lab }), { headers: jsonHeaders });
    }

    // 5. POST /api/simulator/labs/:id/nodes : VM 노드 신규 프로비저닝 (인프라 구축)
    if (action === 'nodes' && method === 'POST') {
      if (!lab.editable) {
        return new Response(JSON.stringify({ ok: false, error: '수정 권한이 OFF 상태입니다.' }), { headers: jsonHeaders, status: 403 });
      }
      let body = {};
      try { body = await request.json(); } catch {}
      const name = (body.name || `w${(lab.nodes?.length || 1)}`).trim();
      const ip = (body.ip || `10.10.10.${20 + (lab.nodes?.length || 1) * 10}`).trim();
      const cpu = parseInt(body.cpu || '2000', 10);
      const ram = parseInt(body.ram || '4096', 10);
      const disktype = body.disktype || 'ssd';

      if (lab.nodes.some((n) => n.name === name)) {
        return new Response(JSON.stringify({ ok: false, error: `노드 '${name}'이(가) 이미 존재합니다.` }), { headers: jsonHeaders, status: 400 });
      }

      const newNode = {
        name,
        ip,
        role: 'worker',
        status: 'Ready',
        unschedulable: false,
        cpuTotalM: cpu,
        ramTotalMi: ram,
        taints: body.taint ? [{ key: 'dedicated', effect: body.taint }] : [],
        labels: { 'kubernetes.io/hostname': name, 'disktype': disktype }
      };

      lab.nodes.push(newNode);
      rescheduleAll(lab);

      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `🖥️ 새 워커 노드 VM '${name}' (${ip}, ${cpu}m CPU, ${ram}Mi RAM) 추가 프로비저닝 완료`
      });

      await saveLabDetail(env, lab);
      return new Response(JSON.stringify({ ok: true, node: newNode, lab }), { headers: jsonHeaders, status: 201 });
    }

    // 6. DELETE /api/simulator/labs/:id/nodes/:nodeName : VM 노드 삭제/반납
    if (action && action.startsWith('nodes/') && method === 'DELETE') {
      if (!lab.editable) {
        return new Response(JSON.stringify({ ok: false, error: '수정 권한이 OFF 상태입니다.' }), { headers: jsonHeaders, status: 403 });
      }
      const nodeName = action.split('/')[1];
      if (nodeName === 'master1') {
        return new Response(JSON.stringify({ ok: false, error: '마스터 노드(master1)는 제거할 수 없습니다.' }), { headers: jsonHeaders, status: 400 });
      }
      const idx = lab.nodes.findIndex((n) => n.name === nodeName);
      if (idx === -1) {
        return new Response(JSON.stringify({ ok: false, error: `노드 '${nodeName}'을 찾을 수 없습니다.` }), { headers: jsonHeaders, status: 404 });
      }

      lab.nodes.splice(idx, 1);
      // 해당 노드에 있던 파드 퇴출 및 재스케줄링
      for (const p of lab.pods) {
        if (p.node === nodeName) {
          p.node = 'None';
          p.status = 'Pending';
        }
      }
      rescheduleAll(lab);

      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `🗑️ 워커 노드 VM '${nodeName}' 제거 및 반납 완료 (파드 재배치)`
      });

      await saveLabDetail(env, lab);
      return new Response(JSON.stringify({ ok: true, lab }), { headers: jsonHeaders });
    }

    // 7. POST /api/simulator/labs/:id/workloads : 파드/디플로이먼트 GUI 빠른 배포
    if (action === 'workloads' && method === 'POST') {
      if (!lab.editable) {
        return new Response(JSON.stringify({ ok: false, error: '수정 권한이 OFF 상태입니다.' }), { headers: jsonHeaders, status: 403 });
      }
      let body = {};
      try { body = await request.json(); } catch {}
      const name = (body.name || 'custom-app').trim();
      const image = (body.image || 'nginx:alpine').trim();
      const replicas = Math.min(Math.max(1, parseInt(body.replicas || '1', 10)), 10);
      const cpuReqM = parseInt(body.cpuReqM || '100', 10);
      const ramReqMi = parseInt(body.ramReqMi || '128', 10);
      const nodeSelector = body.disktype ? { disktype: body.disktype } : undefined;

      const newDep = { name, replicas, image, labels: { app: name }, nodeSelector };
      if (!lab.deployments) lab.deployments = [];
      lab.deployments.push(newDep);

      if (!lab.pods) lab.pods = [];
      for (let i = 0; i < replicas; i++) {
        const randHash = Math.random().toString(36).substring(2, 7);
        const pod = {
          name: `${name}-${randHash}`,
          namespace: 'default',
          node: 'None',
          status: 'Pending',
          ip: 'None',
          image,
          cpuReqM,
          ramReqMi,
          labels: { app: name },
          nodeSelector,
          restarts: 0,
          age: '1s'
        };
        schedulePod(pod, lab);
        lab.pods.push(pod);
      }

      if (body.exposeNodePort) {
        const randPort = Math.floor(Math.random() * 500) + 30000;
        if (!lab.services) lab.services = [];
        lab.services.push({
          name: `${name}-svc`,
          type: 'NodePort',
          clusterIp: `10.96.${Math.floor(Math.random()*200)+10}.${Math.floor(Math.random()*200)+10}`,
          nodePort: randPort,
          port: 80,
          targetPort: 80,
          selector: { app: name }
        });
      }

      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `📦 워크로드 '${name}' (${replicas}개 파드, 이미지: ${image}) 배포 완료`
      });

      await saveLabDetail(env, lab);
      return new Response(JSON.stringify({ ok: true, lab }), { headers: jsonHeaders, status: 201 });
    }

    // 8. POST /api/simulator/labs/:id/chaos : 관리자 장애/카오스 주입
    if (action === 'chaos' && method === 'POST') {
      if (!lab.editable) {
        return new Response(JSON.stringify({ ok: false, error: '수정 권한이 OFF 상태입니다.' }), { headers: jsonHeaders, status: 403 });
      }
      let body = {};
      try { body = await request.json(); } catch {}
      const type = body.type;

      if (type === 'node_failure') {
        const worker = lab.nodes.find((n) => n.role === 'worker');
        if (worker) {
          worker.status = worker.status === 'Ready' ? 'NotReady' : 'Ready';
          rescheduleAll(lab);
          lab.activityLogs.unshift({
            time: timeStr,
            user: userName,
            action: `⚡ [카오스 시뮬레이션] 노드 '${worker.name}' 상태 변경 -> ${worker.status}`
          });
        }
      } else if (type === 'traffic_spike') {
        lab.trafficRps = 2800;
        lab.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: `🔥 [부하 테스트] 순간 트래픽 폭주 주입 (2,800 req/s)`
        });
      } else if (type === 'rolling_update') {
        const dep = lab.deployments?.[0];
        if (dep) {
          dep.image = dep.image.includes('1.25') ? 'nginx:1.26-alpine' : 'nginx:1.25';
          for (const p of lab.pods) {
            if (p.name.startsWith(dep.name)) {
              p.image = dep.image;
              p.restarts++;
              p.age = '5s';
            }
          }
          lab.activityLogs.unshift({
            time: timeStr,
            user: userName,
            action: `🔄 [롤링 업데이트] '${dep.name}' 이미지 변경 -> ${dep.image}`
          });
        }
      }

      await saveLabDetail(env, lab);
      return new Response(JSON.stringify({ ok: true, lab }), { headers: jsonHeaders });
    }

    // 9. POST /api/simulator/labs/:id/exec : 명령어 실행
    if (action === 'exec' && method === 'POST') {
      let body = {};
      try { body = await request.json(); } catch {}
      const cmd = body.command || '';
      const result = evalK8sCommand(cmd, lab, user);
      if (result.labChanged) {
        await saveLabDetail(env, lab);
      }
      return new Response(JSON.stringify({
        ok: true,
        output: result.output,
        labChanged: result.labChanged,
        lab
      }), { headers: jsonHeaders });
    }

    // 10. POST /api/simulator/labs/:id/traffic : 트래픽 RPS 설정
    if (action === 'traffic' && method === 'POST') {
      let body = {};
      try { body = await request.json(); } catch {}
      const rps = Math.min(Math.max(0, parseInt(body.rps || '0', 10)), 5000);
      lab.trafficRps = rps;
      await saveLabDetail(env, lab);
      return new Response(JSON.stringify({ ok: true, trafficRps: lab.trafficRps }), { headers: jsonHeaders });
    }

    // 11. POST /api/simulator/labs/:id/reset : 랩 초기화
    if (action === 'reset' && method === 'POST') {
      const seed = DEFAULT_LABS.find((s) => s.id === labId);
      if (seed) {
        const fresh = JSON.parse(JSON.stringify(seed));
        fresh.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: '클러스터를 기본 상태로 초기화했습니다.'
        });
        await saveLabDetail(env, fresh);
        return new Response(JSON.stringify({ ok: true, lab: fresh }), { headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ ok: false, error: 'Custom lab reset not supported' }), { headers: jsonHeaders });
    }

    // 12. DELETE /api/simulator/labs/:id : 랩 삭제
    if (!action && method === 'DELETE') {
      if (['default', 'scheduling-lab', 'hpa-traffic-lab'].includes(labId)) {
        return new Response(JSON.stringify({ ok: false, error: '기본 시드 랩은 삭제할 수 없습니다.' }), { headers: jsonHeaders, status: 400 });
      }
      if (env && env.ROSTER) {
        await env.ROSTER.delete(`sim:lab:${labId}`);
        let index = await env.ROSTER.get('sim:labs:index', 'json');
        if (Array.isArray(index)) {
          index = index.filter((i) => i.id !== labId);
          await env.ROSTER.put('sim:labs:index', JSON.stringify(index));
        }
      }
      return new Response(JSON.stringify({ ok: true }), { headers: jsonHeaders });
    }
  }

  return new Response(JSON.stringify({ ok: false, error: 'Not Found' }), { headers: jsonHeaders, status: 404 });
}

// 프론트엔드 HTML / CSS / JS 렌더러
export function renderSimulatorPage(user) {
  const userName = user?.name || '수강생';

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${SIMULATOR_TITLE} · KT-CI5</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      height: 100%;
      background: #090d16;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      overflow: hidden; /* 페이지 전체 스크롤 방지 -> 내부 스크롤로 화면 짤림 방지 */
    }
    
    /* 최상단 네비게이션 */
    .top-bar {
      height: 54px;
      background: #111827;
      border-bottom: 1px solid #1f293d;
      padding: 0 16px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
      flex-shrink: 0;
    }
    .top-brand { display: flex; align-items: center; gap: 8px; text-decoration: none; color: #f8fafc; font-weight: 700; font-size: 15px; }
    .top-brand:hover { color: #818cf8; }
    .nav-actions { display: flex; align-items: center; gap: 8px; }
    .btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 12px; font-size: 12.5px; font-weight: 600; color: #cbd5e1;
      background: #1e293b; border: 1px solid #334155; border-radius: 6px; text-decoration: none; cursor: pointer; transition: all 0.15s;
    }
    .btn:hover { background: #334155; color: #fff; border-color: #6366f1; }
    .btn.primary { background: #4f46e5; border-color: #6366f1; color: #fff; }
    .btn.primary:hover { background: #4338ca; }
    .btn.warning { background: #d97706; border-color: #f59e0b; color: #fff; }
    .btn.danger { background: #dc2626; border-color: #ef4444; color: #fff; }
    .btn.sm { padding: 4px 8px; font-size: 11.5px; }

    /* 메인 뷰포트 영역 */
    .viewport-container {
      height: calc(100vh - 54px);
      display: flex; flex-direction: column;
      overflow: hidden;
    }

    /* 1. 목록 뷰 */
    #view-list {
      flex: 1; padding: 20px; overflow-y: auto; max-width: 1400px; width: 100%; margin: 0 auto;
    }
    .hero-banner {
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, rgba(30, 41, 59, 0.8) 100%);
      border: 1px solid #334155; border-radius: 12px; padding: 20px 24px; margin-bottom: 20px;
      display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;
    }
    .hero-banner h1 { font-size: 19px; font-weight: 700; color: #f8fafc; margin-bottom: 6px; }
    .hero-banner p { font-size: 13px; color: #94a3b8; line-height: 1.5; }
    .lab-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
    .lab-card {
      background: #141b2d; border: 1px solid #232d42; border-radius: 10px; padding: 16px 18px;
      display: flex; flex-direction: column; justify-content: space-between; transition: all 0.15s;
    }
    .lab-card:hover { border-color: #6366f1; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.4); }
    .lab-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .lab-title { font-size: 15px; font-weight: 700; color: #f8fafc; }
    .perm-badge { font-size: 11px; font-weight: 700; padding: 2px 7px; border-radius: 999px; }
    .perm-badge.on { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #059669; }
    .perm-badge.off { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #d97706; }
    .lab-desc { font-size: 12.5px; color: #94a3b8; line-height: 1.5; margin-bottom: 14px; flex-grow: 1; }
    .lab-meta { display: flex; align-items: center; gap: 10px; font-size: 11.5px; color: #64748b; margin-bottom: 14px; flex-wrap: wrap; }
    .lab-meta span { display: inline-flex; align-items: center; gap: 4px; }

    /* 2. 상세 시뮬레이터 뷰 */
    #view-detail {
      flex: 1; display: none; flex-direction: column; height: 100%; overflow: hidden;
    }
    
    /* 서브 제어 툴바 (운영자 헤더) */
    .op-toolbar {
      height: 48px; background: #111827; border-bottom: 1px solid #1f293d;
      padding: 0 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px;
      flex-shrink: 0;
    }
    .op-left { display: flex; align-items: center; gap: 10px; }
    .op-title { font-size: 14px; font-weight: 700; color: #f8fafc; white-space: nowrap; }
    
    /* 뷰 모드 스위처 (인터페이스 조정 기능) */
    .view-switcher {
      display: flex; align-items: center; background: #0b0f19; border: 1px solid #1f293d; border-radius: 6px; padding: 2px;
    }
    .view-btn {
      background: transparent; border: none; color: #94a3b8; font-size: 11.5px; font-weight: 600;
      padding: 4px 8px; border-radius: 4px; cursor: pointer; transition: all 0.15s; display: flex; align-items: center; gap: 4px;
    }
    .view-btn.active { background: #312e81; color: #e0e7ff; }

    /* 수정 권한 토글 */
    .perm-toggle-wrap { display: flex; align-items: center; gap: 6px; background: #0b0f19; padding: 3px 8px; border-radius: 6px; border: 1px solid #1f293d; }
    .perm-label { font-size: 11.5px; font-weight: 700; }
    .switch-btn {
      cursor: pointer; border: none; border-radius: 4px; padding: 3px 8px; font-size: 11px; font-weight: 700;
    }
    .switch-btn.active-on { background: #10b981; color: #fff; }
    .switch-btn.active-off { background: #ef4444; color: #fff; }

    /* 작업 캔버스 (스플릿 뷰) */
    .split-canvas {
      flex: 1; display: grid; overflow: hidden; height: calc(100% - 48px);
      grid-template-columns: 50% 50%; /* 기본값 50:50 */
    }
    .split-canvas.mode-70-30 { grid-template-columns: 70% 30%; }
    .split-canvas.mode-30-70 { grid-template-columns: 30% 70%; }
    .split-canvas.mode-100-0 { grid-template-columns: 100% 0%; }
    .split-canvas.mode-0-100 { grid-template-columns: 0% 100%; }

    /* 좌측 터미널 패널 */
    .pane-terminal {
      background: #090d16; border-right: 1px solid #1f293d; display: flex; flex-direction: column;
      overflow: hidden; height: 100%;
    }
    .term-hd {
      height: 36px; background: #0f1523; border-bottom: 1px solid #1f293d; padding: 0 12px;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .term-dots { display: flex; gap: 5px; }
    .dot { width: 9px; height: 9px; border-radius: 50%; }
    .dot.r { background: #ef4444; } .dot.y { background: #f59e0b; } .dot.g { background: #10b981; }
    .term-hd-title { font-size: 11.5px; font-family: monospace; color: #94a3b8; }
    .term-body {
      flex: 1; padding: 12px; overflow-y: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12.5px; line-height: 1.5; color: #cbd5e1; white-space: pre-wrap; word-break: break-all;
    }
    .term-chips {
      display: flex; gap: 5px; padding: 6px 10px; background: #0f1523; border-top: 1px solid #1f293d; overflow-x: auto; flex-shrink: 0;
    }
    .chip-btn {
      background: #1e293b; border: 1px solid #334155; border-radius: 4px; padding: 2px 7px;
      font-size: 11px; font-family: monospace; color: #94a3b8; cursor: pointer; white-space: nowrap;
    }
    .chip-btn:hover { background: #334155; color: #fff; border-color: #6366f1; }
    .term-input-row {
      height: 42px; background: #0b0f19; border-top: 1px solid #1f293d; padding: 0 12px; display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }
    .term-prompt { color: #10b981; font-weight: 700; font-family: monospace; font-size: 12.5px; white-space: nowrap; }
    .term-input {
      flex: 1; background: transparent; border: none; outline: none; color: #fff; font-family: monospace; font-size: 13px;
    }

    /* 우측 토폴로지 & 인프라 관리 패널 */
    .pane-topology {
      background: #0d121f; display: flex; flex-direction: column; overflow-y: auto; height: 100%; padding: 14px; gap: 12px;
    }
    .panel-card {
      background: #141b2d; border: 1px solid #1f293d; border-radius: 8px; padding: 12px 14px;
    }
    .panel-header {
      display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;
    }
    .panel-title { font-size: 13px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 6px; }
    .op-action-group { display: flex; gap: 6px; }

    /* 노드 그리드 */
    .node-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 10px; }
    .node-card { background: #0f1523; border: 1px solid #1f293d; border-radius: 8px; padding: 10px 12px; }
    .node-card.not-ready { border-color: #ef4444; background: rgba(239, 68, 68, 0.05); }
    .node-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
    .node-name { font-size: 13px; font-weight: 700; color: #f8fafc; font-family: monospace; }
    .node-ip { font-size: 11px; color: #64748b; font-family: monospace; }
    .node-status-pill { font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 4px; }
    .node-status-pill.ready { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .node-status-pill.notready { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .meter-row { margin-bottom: 5px; }
    .meter-label { display: flex; justify-content: space-between; font-size: 10.5px; color: #94a3b8; margin-bottom: 2px; }
    .meter-bar-bg { height: 5px; background: #0b0f19; border-radius: 3px; overflow: hidden; }
    .meter-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
    .fill-green { background: #10b981; } .fill-yellow { background: #f59e0b; } .fill-red { background: #ef4444; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .node-tag { font-size: 10px; font-family: monospace; padding: 1px 5px; border-radius: 4px; background: #1a2234; color: #cbd5e1; }
    .node-tag.taint { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
    .node-actions { display: flex; gap: 4px; margin-top: 8px; border-top: 1px solid #1f293d; padding-top: 6px; }

    /* 파드 테이블 */
    .pod-table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    .pod-table th { text-align: left; color: #64748b; font-weight: 600; padding: 5px 6px; border-bottom: 1px solid #1f293d; }
    .pod-table td { padding: 5px 6px; border-bottom: 1px solid #141b2d; font-family: monospace; color: #cbd5e1; }
    .status-pill { padding: 1px 5px; border-radius: 4px; font-size: 10px; font-weight: 700; display: inline-block; }
    .status-running { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .status-pending { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }

    /* 모달 */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 1000;
      display: none; align-items: center; justify-content: center; padding: 16px;
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: #141b2d; border: 1px solid #2a3143; border-radius: 10px;
      max-width: 520px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .modal h2 { font-size: 16px; margin-bottom: 4px; color: #f8fafc; }
    .modal p.desc { font-size: 12px; color: #94a3b8; margin-bottom: 14px; }
    .form-group { margin-bottom: 12px; }
    .form-group label { display: block; font-size: 12px; font-weight: 600; color: #cbd5e1; margin-bottom: 4px; }
    .form-control {
      width: 100%; background: #0b0f19; border: 1px solid #232d42; border-radius: 6px;
      padding: 7px 10px; color: #f8fafc; font-size: 13px; font-family: inherit;
    }
    .form-control:focus { outline: none; border-color: #6366f1; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .checkbox-label { display: flex; align-items: center; gap: 6px; font-size: 12px; color: #cbd5e1; cursor: pointer; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }

    /* 스크롤바 커스텀 */
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #232d42; border-radius: 3px; }
    ::-webkit-scrollbar-thumb:hover { background: #334155; }
  </style>
</head>
<body>

  <!-- 최상단 헤더 -->
  <header class="top-bar">
    <a href="/study" class="top-brand">
      <span>📖</span> KT-CI5 스터디 Hub
    </a>
    <div class="nav-actions">
      <button class="btn primary sm" onclick="openCreateModal()">+ 신규 실습 랩</button>
      <a href="/study" class="btn sm">메인 포털</a>
      <a href="/study/course/k8s" class="btn sm">☸️ K8s 정리</a>
      <a href="/study/cheatsheet" class="btn sm">⚡ 치트시트</a>
    </div>
  </header>

  <div class="viewport-container">

    <!-- 1. 랩 목록 뷰 -->
    <div id="view-list">
      <div class="hero-banner">
        <div>
          <h1>☸️ 쿠버네티스 협업 가상 랩 & 인프라 콘솔</h1>
          <p>수강생들과 함께 클러스터 노드(VM)를 증설하고 파드를 배포하며, 수정 권한(ON/OFF)과 화면 분할 뷰를 제어하는 실습 플랫폼입니다.</p>
        </div>
        <button class="btn primary" onclick="openCreateModal()">+ 새 클러스터 랩 생성</button>
      </div>
      <div class="lab-grid" id="lab-list-container"></div>
    </div>

    <!-- 2. 상세 시뮬레이터 뷰 -->
    <div id="view-detail">
      <!-- 운영자 헤더 툴바 -->
      <div class="op-toolbar">
        <div class="op-left">
          <button class="btn sm" onclick="showListView()">← 목록</button>
          <span class="op-title" id="active-lab-title">기본 클러스터</span>
          
          <!-- 인프라 구축 버튼 -->
          <button class="btn sm primary" onclick="openAddNodeModal()">➕ VM 노드 추가</button>
          <button class="btn sm" onclick="openDeployModal()">📦 파드 배포</button>
          
          <!-- 카오스/운영 장애 주입 드롭다운 -->
          <select class="form-control" style="width:130px; height:28px; padding:2px 6px; font-size:11.5px;" onchange="triggerChaos(this.value); this.value='';">
            <option value="">⚡ 운영 장애 주입</option>
            <option value="node_failure">노드 장애 (NotReady 토글)</option>
            <option value="traffic_spike">순간 트래픽 폭주 (2800 req/s)</option>
            <option value="rolling_update">롤링 업데이트 (이미지 변경)</option>
          </select>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <!-- 뷰 모드 스위처 (인터페이스 조정 기능) -->
          <div class="view-switcher">
            <button class="view-btn active" id="btn-view-50" onclick="setViewMode('mode-50-50')" title="50:50 균등 분할">⬛ 50:50</button>
            <button class="view-btn" id="btn-view-70" onclick="setViewMode('mode-70-30')" title="터미널 70% 집중">💻 터미널 70%</button>
            <button class="view-btn" id="btn-view-30" onclick="setViewMode('mode-30-70')" title="토폴로지 70% 집중">📊 맵 70%</button>
            <button class="view-btn" id="btn-view-100t" onclick="setViewMode('mode-100-0')" title="터미널 전체화면">🖥️ 터미널 전체</button>
            <button class="view-btn" id="btn-view-100m" onclick="setViewMode('mode-0-100')" title="토폴로지 전체화면">📈 맵 전체</button>
          </div>

          <!-- 수정 권한 토글 -->
          <div class="perm-toggle-wrap">
            <span class="perm-label" id="perm-label-text">수정 권한: ON</span>
            <button class="switch-btn active-on" id="perm-toggle-btn" onclick="togglePermission()">🔓 수정 허용</button>
          </div>

          <button class="btn sm warning" onclick="resetActiveLab()">🔄 리셋</button>
        </div>
      </div>

      <!-- 작업 스플릿 캔버스 -->
      <div class="split-canvas" id="split-canvas">
        
        <!-- 좌측: 터미널 -->
        <div class="pane-terminal" id="pane-terminal">
          <div class="term-hd">
            <div class="term-dots">
              <span class="dot r"></span>
              <span class="dot y"></span>
              <span class="dot g"></span>
            </div>
            <span class="term-hd-title" id="term-status-title">master1 (10.10.10.12) - bash</span>
            <button class="chip-btn" onclick="clearTerm()">Clear</button>
          </div>
          <div class="term-body" id="term-body"></div>
          <div class="term-chips">
            <button class="chip-btn" onclick="runChip('k get nodes -o wide')">k get nodes</button>
            <button class="chip-btn" onclick="runChip('k get pods -o wide')">k get pods</button>
            <button class="chip-btn" onclick="runChip('k get svc')">k get svc</button>
            <button class="chip-btn" onclick="runChip('k top nodes')">k top nodes</button>
            <button class="chip-btn" onclick="runChip('k top pods')">k top pods</button>
            <button class="chip-btn" onclick="runChip('curl 10.10.10.20:30080')">curl 10.10.10.20:30080</button>
            <button class="chip-btn" onclick="runChip('help')">help</button>
          </div>
          <div class="term-input-row">
            <span class="term-prompt" id="term-prompt">root@master1:~#</span>
            <input type="text" class="term-input" id="term-input" placeholder="명령어를 입력하세요 (예: k get pods, k top nodes, help)" autocomplete="off" spellcheck="false" />
          </div>
        </div>

        <!-- 우측: 토폴로지 & 자원 관리 -->
        <div class="pane-topology" id="pane-topology">
          
          <!-- 트래픽 부하 주입기 -->
          <div class="panel-card">
            <div class="panel-header">
              <span class="panel-title">🎛️ 가상 트래픽 발생기 (RPS Simulator)</span>
              <span style="font-size:11.5px; font-family:monospace; color:#818cf8; font-weight:700;" id="traffic-val">100 req/s</span>
            </div>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="font-size:11px; color:#64748b;">0</span>
              <input type="range" class="form-control" style="padding:0; height:20px; accent-color:#6366f1; cursor:pointer;" id="traffic-slider" min="0" max="3000" step="50" value="100" onchange="updateTraffic(this.value)" />
              <span style="font-size:11px; color:#64748b;">3000</span>
            </div>
          </div>

          <!-- 노드 VM 목록 -->
          <div class="panel-card">
            <div class="panel-header">
              <span class="panel-title">🖥️ 인프라 VM 노드 목록</span>
              <button class="btn sm primary" onclick="openAddNodeModal()">+ 노드 추가</button>
            </div>
            <div class="node-grid" id="node-grid-container"></div>
          </div>

          <!-- 파드 워크로드 -->
          <div class="panel-card">
            <div class="panel-header">
              <span class="panel-title">📦 워크로드 파드 (Pods)</span>
              <button class="btn sm" onclick="openDeployModal()">+ 파드 배포</button>
            </div>
            <div style="overflow-x:auto;">
              <table class="pod-table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>NODE</th>
                    <th>STATUS</th>
                    <th>IP</th>
                    <th>IMAGE</th>
                    <th>ACTION</th>
                  </tr>
                </thead>
                <tbody id="pod-table-body"></tbody>
              </table>
            </div>
          </div>

          <!-- 서비스 & 네트워크 -->
          <div class="panel-card">
            <div class="panel-header">
              <span class="panel-title">🌐 서비스 & 네트워크 노출</span>
            </div>
            <div id="service-list-container" style="display:flex; flex-direction:column; gap:6px;"></div>
          </div>

          <!-- 실시간 협업 피드 -->
          <div class="panel-card">
            <div class="panel-header">
              <span class="panel-title">📝 실시간 협업 & 감사 로그</span>
              <span style="font-size:10.5px; color:#64748b;">2.5초 주기 동기화</span>
            </div>
            <div id="activity-log-container" style="display:flex; flex-direction:column; gap:4px; max-height:120px; overflow-y:auto; font-size:11px; color:#94a3b8;"></div>
          </div>

        </div>

      </div>
    </div>

  </div>

  <!-- 1. 신규 실습 랩 생성 모달 -->
  <div class="modal-overlay" id="create-modal">
    <div class="modal">
      <h2>➕ 신규 실습 랩 클러스터 생성</h2>
      <p class="desc">가상 노드 수와 자원 할당량을 지정하여 새로운 실습 환경을 생성하고 저장합니다.</p>
      <form onsubmit="handleCreateLab(event)">
        <div class="form-group">
          <label>실습 랩 제목</label>
          <input type="text" class="form-control" id="form-title" placeholder="예: 3조 롤링배포 및 HPA 실습 환경" required />
        </div>
        <div class="form-group">
          <label>실습 설명</label>
          <input type="text" class="form-control" id="form-desc" placeholder="실습 목적이나 주의사항을 입력하세요" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>워커 노드 수 (Worker)</label>
            <select class="form-control" id="form-workers">
              <option value="1">1 Worker (Master1 + W1)</option>
              <option value="2">2 Workers (Master1 + W1 + W2)</option>
              <option value="3">3 Workers (Master1 + W1 + W2 + W3)</option>
            </select>
          </div>
          <div class="form-group">
            <label>노드당 CPU 할당량</label>
            <select class="form-control" id="form-cpu">
              <option value="2000">2 Core (2000m)</option>
              <option value="4000">4 Core (4000m)</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="form-editable" checked />
            <span>다른 수강생과 수정 권한 공유 허용 (ON으로 생성)</span>
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn sm" onclick="closeModal('create-modal')">취소</button>
          <button type="submit" class="btn sm primary">저장하고 바로 입장</button>
        </div>
      </form>
    </div>
  </div>

  <!-- 2. VM 노드 추가 모달 (인프라 구축) -->
  <div class="modal-overlay" id="add-node-modal">
    <div class="modal">
      <h2>🖥️ 새 워커 노드(VM) 프로비저닝</h2>
      <p class="desc">클러스터에 새 가상머신 워커 노드를 즉시 추가하고 자원을 확장합니다.</p>
      <form onsubmit="handleAddNode(event)">
        <div class="form-row">
          <div class="form-group">
            <label>노드 호스트명</label>
            <input type="text" class="form-control" id="node-form-name" placeholder="예: w2, w3, gpu-node1" required />
          </div>
          <div class="form-group">
            <label>사설 IP 주소</label>
            <input type="text" class="form-control" id="node-form-ip" placeholder="예: 10.10.10.30" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>CPU 용량</label>
            <select class="form-control" id="node-form-cpu">
              <option value="2000">2 Core (2000m)</option>
              <option value="4000">4 Core (4000m)</option>
              <option value="8000">8 Core (8000m)</option>
            </select>
          </div>
          <div class="form-group">
            <label>RAM 용량</label>
            <select class="form-control" id="node-form-ram">
              <option value="4096">4 GiB (4096Mi)</option>
              <option value="8192">8 GiB (8192Mi)</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>스토리지 라벨 (disktype)</label>
          <select class="form-control" id="node-form-disk">
            <option value="ssd">disktype=ssd (고속 NVMe)</option>
            <option value="hdd">disktype=hdd (일반 HDD)</option>
          </select>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn sm" onclick="closeModal('add-node-modal')">취소</button>
          <button type="submit" class="btn sm primary">노드 프로비저닝 시작</button>
        </div>
      </form>
    </div>
  </div>

  <!-- 3. 파드/디플로이먼트 배포 모달 (워크로드 추가) -->
  <div class="modal-overlay" id="deploy-modal">
    <div class="modal">
      <h2>📦 새 파드 / 디플로이먼트 배포</h2>
      <p class="desc">GUI 폼으로 간편하게 파드를 정의하고 클러스터에 스케줄링 배포합니다.</p>
      <form onsubmit="handleDeployWorkload(event)">
        <div class="form-group">
          <label>워크로드 명칭</label>
          <input type="text" class="form-control" id="deploy-form-name" placeholder="예: api-server, payment-worker" required />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>컨테이너 이미지</label>
            <input type="text" class="form-control" id="deploy-form-image" value="nginx:1.25" required />
          </div>
          <div class="form-group">
            <label>레플리카(Pod 수)</label>
            <input type="number" class="form-control" id="deploy-form-replicas" min="1" max="10" value="2" required />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>CPU Request</label>
            <select class="form-control" id="deploy-form-cpu">
              <option value="100">100m (0.1 Core)</option>
              <option value="200">200m (0.2 Core)</option>
              <option value="500">500m (0.5 Core)</option>
            </select>
          </div>
          <div class="form-group">
            <label>노드 타겟 조건 (nodeSelector)</label>
            <select class="form-control" id="deploy-form-disk">
              <option value="">조건 없음 (모든 노드 허용)</option>
              <option value="hdd">disktype=hdd 노드만</option>
              <option value="ssd">disktype=ssd 노드만</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" id="deploy-form-nodeport" checked />
            <span>외부 노출을 위한 NodePort 서비스 동시 생성 (포트 자동할당)</span>
          </label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn sm" onclick="closeModal('deploy-modal')">취소</button>
          <button type="submit" class="btn sm primary">배포하기 (Deploy)</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    let currentLab = null;
    let labList = [];
    let commandHistory = [];
    let historyIdx = -1;
    let pollInterval = null;
    const currentUser = "${escapeHtml(userName)}";

    // 1. 뷰 모드 스위처 (인터페이스 조정 기능)
    function setViewMode(modeClass) {
      const canvas = document.getElementById('split-canvas');
      canvas.className = 'split-canvas ' + modeClass;

      document.querySelectorAll('.view-btn').forEach(btn => btn.classList.remove('active'));
      if (modeClass === 'mode-50-50') document.getElementById('btn-view-50').classList.add('active');
      if (modeClass === 'mode-70-30') document.getElementById('btn-view-70').classList.add('active');
      if (modeClass === 'mode-30-70') document.getElementById('btn-view-30').classList.add('active');
      if (modeClass === 'mode-100-0') document.getElementById('btn-view-100t').classList.add('active');
      if (modeClass === 'mode-0-100') document.getElementById('btn-view-100m').classList.add('active');

      localStorage.setItem('k8s_view_mode', modeClass);
    }

    // 저장된 뷰 모드 복원
    const savedMode = localStorage.getItem('k8s_view_mode');
    if (savedMode) setViewMode(savedMode);

    // 2. 모달 열기/닫기
    function openModal(id) { document.getElementById(id).classList.add('active'); }
    function closeModal(id) { document.getElementById(id).classList.remove('active'); }
    function openCreateModal() { openModal('create-modal'); }
    function openAddNodeModal() {
      if (!currentLab) return;
      const nextNum = (currentLab.nodes?.length || 1);
      document.getElementById('node-form-name').value = 'w' + nextNum;
      document.getElementById('node-form-ip').value = '10.10.10.' + (20 + (nextNum - 1) * 10);
      openModal('add-node-modal');
    }
    function openDeployModal() { openModal('deploy-modal'); }

    // 3. 랩 목록 로드
    async function loadLabs() {
      try {
        const res = await fetch('/api/simulator/labs');
        const data = await res.json();
        if (data.ok && data.labs) {
          labList = data.labs;
          renderLabList(labList);
        }
      } catch (err) {
        console.error('loadLabs error:', err);
      }
    }

    function renderLabList(labs) {
      const container = document.getElementById('lab-list-container');
      if (!labs || labs.length === 0) {
        container.innerHTML = '<p style="color:#64748b;">등록된 실습 랩이 없습니다. 상단에서 새로 생성해보세요!</p>';
        return;
      }
      container.innerHTML = labs.map(lab => \`
        <div class="lab-card">
          <div>
            <div class="lab-head">
              <div class="lab-title">\${escapeHtml(lab.title)}</div>
              <span class="perm-badge \${lab.editable ? 'on' : 'off'}">\${lab.editable ? '🔓 수정 가능' : '🔒 조회 전용'}</span>
            </div>
            <p class="lab-desc">\${escapeHtml(lab.description || '')}</p>
          </div>
          <div>
            <div class="lab-meta">
              <span>👤 \${escapeHtml(lab.creator)}</span>
              <span>💻 노드 \${lab.nodeCount}개</span>
              <span>📦 파드 \${lab.podCount}개</span>
              <span>⚡ \${lab.trafficRps || 0} req/s</span>
            </div>
            <button class="btn primary sm" style="width:100%; justify-content:center;" onclick="openLab('\${lab.id}')">실습 랩 입장하기 ➔</button>
          </div>
        </div>
      \`).join('');
    }

    // 4. 랩 입장 & 상세 대시보드
    async function openLab(labId) {
      try {
        const res = await fetch(\`/api/simulator/labs/\${labId}\`);
        const data = await res.json();
        if (data.ok && data.lab) {
          currentLab = data.lab;
          document.getElementById('view-list').style.display = 'none';
          document.getElementById('view-detail').style.display = 'flex';

          initDetailView(currentLab);
          startPolling(labId);
        }
      } catch (err) {
        alert('실습 랩을 불러오는데 실패했습니다: ' + err.message);
      }
    }

    function showListView() {
      stopPolling();
      currentLab = null;
      document.getElementById('view-detail').style.display = 'none';
      document.getElementById('view-list').style.display = 'block';
      loadLabs();
    }

    function initDetailView(lab) {
      document.getElementById('active-lab-title').innerText = lab.title;
      updatePermissionUI(lab.editable);
      renderTopology(lab);

      const termBody = document.getElementById('term-body');
      termBody.innerHTML = \`<span style="color:#6366f1;">========================================================================</span>\\n\` +
        \`<span style="color:#10b981;font-weight:700;">☸️ KT Cloud 5기 쿠버네티스 협업 랩에 오신 것을 환영합니다!</span>\\n\` +
        \`현재 실습 랩: <b>\${escapeHtml(lab.title)}</b> (접속자: <b>\${currentUser}</b>)\\n\` +
        \`명령어: <b>alias k=kubectl</b> 지원 (예: <b>k get nodes</b>, <b>help</b>)\\n\` +
        \`상단 툴바에서 <b>VM 노드 추가</b>, <b>파드 배포</b>, <b>화면 분할(50:50, 70%, 100%)</b> 조정이 가능합니다.\\n\` +
        \`<span style="color:#6366f1;">========================================================================</span>\\n\\n\`;
    }

    // 5. 권한 토글
    async function togglePermission() {
      if (!currentLab) return;
      const nextState = !currentLab.editable;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/permission\`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ editable: nextState })
        });
        const data = await res.json();
        if (data.ok) {
          currentLab.editable = data.editable;
          updatePermissionUI(currentLab.editable);
          appendTermLog(\`\\n\${data.editable ? '\\x1b[32;1m🔓 [수정 권한 활성화]\\x1b[0m 이제 클러스터 조작 및 파드 생성이 가능합니다.' : '\\x1b[33;1m🔒 [수정 권한 비활성화]\\x1b[0m 조회 전용(Read-Only) 모드로 전환되었습니다.'}\\n\`);
        }
      } catch (err) {
        alert('권한 변경 실패: ' + err.message);
      }
    }

    function updatePermissionUI(editable) {
      const btn = document.getElementById('perm-toggle-btn');
      const label = document.getElementById('perm-label-text');
      const prompt = document.getElementById('term-prompt');

      if (editable) {
        btn.className = 'switch-btn active-on';
        btn.innerText = '🔓 수정 허용 (ON)';
        label.innerText = '수정 권한: ON';
        label.style.color = '#34d399';
        prompt.innerText = 'root@master1:~#';
        prompt.style.color = '#10b981';
      } else {
        btn.className = 'switch-btn active-off';
        btn.innerText = '🔒 조회 전용 (OFF)';
        label.innerText = '수정 권한: OFF';
        label.style.color = '#f87171';
        prompt.innerText = 'root@master1:~# (read-only)';
        prompt.style.color = '#f59e0b';
      }
    }

    // 6. 터미널 명령 실행
    const termInput = document.getElementById('term-input');
    termInput.addEventListener('keydown', async function(e) {
      if (e.key === 'Enter') {
        const cmd = termInput.value.trim();
        if (!cmd) return;
        commandHistory.push(cmd);
        historyIdx = commandHistory.length;
        termInput.value = '';

        if (cmd === 'clear') {
          clearTerm();
          return;
        }

        appendTermLog(\`\\n<span style="color:#10b981;font-weight:700;">\${document.getElementById('term-prompt').innerText}</span> \${escapeHtml(cmd)}\\n\`);
        await executeCommand(cmd);
      } else if (e.key === 'ArrowUp') {
        if (historyIdx > 0) {
          historyIdx--;
          termInput.value = commandHistory[historyIdx] || '';
        }
      } else if (e.key === 'ArrowDown') {
        if (historyIdx < commandHistory.length - 1) {
          historyIdx++;
          termInput.value = commandHistory[historyIdx] || '';
        } else {
          historyIdx = commandHistory.length;
          termInput.value = '';
        }
      }
    });

    async function executeCommand(command) {
      if (!currentLab) return;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/exec\`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ command })
        });
        const data = await res.json();
        if (data.ok) {
          if (data.output) {
            appendTermLog(formatAnsi(data.output) + '\\n');
          }
          if (data.labChanged && data.lab) {
            currentLab = data.lab;
            renderTopology(currentLab);
          }
        }
      } catch (err) {
        appendTermLog(\`<span style="color:#ef4444;">Command failed: \${err.message}</span>\\n\`);
      }
    }

    function runChip(cmd) {
      termInput.value = cmd;
      termInput.focus();
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      termInput.dispatchEvent(event);
    }
    function clearTerm() { document.getElementById('term-body').innerHTML = ''; }
    function appendTermLog(html) {
      const b = document.getElementById('term-body');
      b.innerHTML += html;
      b.scrollTop = b.scrollHeight;
    }

    // 7. 토폴로지 & 인프라 렌더링
    function renderTopology(lab) {
      if (!lab) return;

      document.getElementById('traffic-slider').value = lab.trafficRps || 0;
      document.getElementById('traffic-val').innerText = (lab.trafficRps || 0) + ' req/s';

      // 노드 카드
      const nodeGrid = document.getElementById('node-grid-container');
      nodeGrid.innerHTML = (lab.nodes || []).map(node => {
        const hosted = (lab.pods || []).filter(p => p.node === node.name && p.status === 'Running');
        const baseCpu = 180 + hosted.length * 80;
        const trafficCpu = Math.round(((lab.trafficRps || 0) / 3000) * 800);
        const cpuM = Math.min(node.cpuTotalM, baseCpu + trafficCpu);
        const cpuPct = Math.round((cpuM / node.cpuTotalM) * 100);

        const ramMi = 1400 + hosted.length * 150;
        const ramPct = Math.round((ramMi / node.ramTotalMi) * 100);

        const cpuColor = cpuPct > 80 ? 'fill-red' : cpuPct > 60 ? 'fill-yellow' : 'fill-green';
        const ramColor = ramPct > 80 ? 'fill-red' : ramPct > 60 ? 'fill-yellow' : 'fill-green';

        const taintsHtml = (node.taints || []).map(t => \`<span class="node-tag taint">\${t.key.split('/').pop()}:\${t.effect}</span>\`).join('');
        const labelsHtml = Object.entries(node.labels || {}).filter(([k]) => !k.includes('kubernetes.io')).map(([k, v]) => \`<span class="node-tag">\${k}=\${v}</span>\`).join('');

        const isMaster = node.role === 'control-plane';
        const hasTaint = node.taints && node.taints.length > 0;

        return \`
          <div class="node-card \${node.status !== 'Ready' ? 'not-ready' : ''}">
            <div class="node-top">
              <span class="node-name">🖥️ \${node.name}</span>
              <span class="node-status-pill \${node.status === 'Ready' ? 'ready' : 'notready'}">\${node.status}\${node.unschedulable ? ',NoSchedule' : ''}</span>
            </div>
            <div style="font-size:11px; color:#64748b; font-family:monospace; margin-bottom:6px;">IP: \${node.ip}</div>
            
            <div class="meter-row">
              <div class="meter-label"><span>CPU</span><span>\${cpuM}m / \${node.cpuTotalM}m (\${cpuPct}%)</span></div>
              <div class="meter-bar-bg"><div class="meter-bar-fill \${cpuColor}" style="width:\${cpuPct}%;"></div></div>
            </div>
            <div class="meter-row">
              <div class="meter-label"><span>RAM</span><span>\${ramMi}Mi / \${node.ramTotalMi}Mi (\${ramPct}%)</span></div>
              <div class="meter-bar-bg"><div class="meter-bar-fill \${ramColor}" style="width:\${ramPct}%;"></div></div>
            </div>

            <div class="tag-list">
              \${taintsHtml}
              \${labelsHtml}
            </div>

            <!-- 노드 운영 액션 버튼 -->
            <div class="node-actions">
              \${isMaster ? \`
                <button class="chip-btn" onclick="executeCommand('k taint nodes master1 node-role.kubernetes.io/control-plane:NoSchedule\${hasTaint ? '-' : ''}')">\${hasTaint ? 'Taint 해제' : 'Taint 설정'}</button>
              \` : \`
                <button class="chip-btn" onclick="executeCommand('k \${node.unschedulable ? 'uncordon' : 'cordon'} \${node.name}')">\${node.unschedulable ? 'Uncordon' : 'Cordon'}</button>
                <button class="chip-btn" onclick="executeCommand('k drain \${node.name} --ignore-daemonsets')">Drain</button>
                <button class="chip-btn" onclick="deleteNode('\${node.name}')" style="color:#f87171;">VM 반납</button>
              \`}
            </div>
          </div>
        \`;
      }).join('');

      // 파드 테이블
      const podTbody = document.getElementById('pod-table-body');
      podTbody.innerHTML = (lab.pods || []).map(pod => \`
        <tr>
          <td style="color:#f8fafc; font-weight:600;">\${escapeHtml(pod.name)}</td>
          <td>\${pod.node}</td>
          <td><span class="status-pill \${pod.status === 'Running' ? 'status-running' : 'status-pending'}">\${pod.status}</span></td>
          <td>\${pod.ip}</td>
          <td>\${pod.image}</td>
          <td><button class="chip-btn" onclick="executeCommand('k delete pod \${pod.name}')" style="color:#f87171;">삭제</button></td>
        </tr>
      \`).join('');

      // 서비스
      const svcC = document.getElementById('service-list-container');
      svcC.innerHTML = (lab.services || []).map(svc => \`
        <div style="background:#0f1523; border:1px solid #1f293d; border-radius:6px; padding:6px 10px; display:flex; align-items:center; justify-content:space-between;">
          <div>
            <span style="font-weight:700; font-size:12px; color:#f8fafc; font-family:monospace;">\${svc.name} (\${svc.type})</span>
            <span style="font-size:11px; color:#94a3b8; font-family:monospace; margin-left:8px;">\${svc.clusterIp}:\${svc.port} \${svc.nodePort ? '| NodePort: ' + svc.nodePort : ''}</span>
          </div>
          \${svc.nodePort ? \`<button class="chip-btn" onclick="runChip('curl 10.10.10.20:\${svc.nodePort}')" style="background:#312e81; color:#c7d2fe;">🌐 curl 테스트</button>\` : ''}
        </div>
      \`).join('');

      // 감사 피드
      const logC = document.getElementById('activity-log-container');
      logC.innerHTML = (lab.activityLogs || []).slice(0, 15).map(l => \`
        <div>
          <span style="color:#64748b; font-family:monospace;">\${l.time}</span>
          <span style="color:#818cf8; font-weight:600;">[\${escapeHtml(l.user)}]</span>
          <span style="color:#cbd5e1;">\${escapeHtml(l.action)}</span>
        </div>
      \`).join('');
    }

    // 8. 노드 추가 및 삭제 액션
    async function handleAddNode(e) {
      e.preventDefault();
      if (!currentLab) return;
      const name = document.getElementById('node-form-name').value.trim();
      const ip = document.getElementById('node-form-ip').value.trim();
      const cpu = document.getElementById('node-form-cpu').value;
      const ram = document.getElementById('node-form-ram').value;
      const disktype = document.getElementById('node-form-disk').value;

      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/nodes\`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, ip, cpu, ram, disktype })
        });
        const data = await res.json();
        if (data.ok) {
          closeModal('add-node-modal');
          currentLab = data.lab;
          renderTopology(currentLab);
          appendTermLog(\`\\n<span style="color:#10b981;font-weight:700;">🖥️ 새 워커 노드 VM '\${name}'이 클러스터에 성공적으로 프로비저닝되었습니다!</span>\\n\`);
        } else {
          alert('노드 추가 실패: ' + (data.error || '오류'));
        }
      } catch (err) {
        alert('노드 추가 오류: ' + err.message);
      }
    }

    async function deleteNode(nodeName) {
      if (!currentLab || !confirm(\`워커 노드 VM '\${nodeName}'을(를) 삭제 및 반납하시겠습니까?\\n(해당 노드의 파드는 다른 노드로 자동 퇴출됩니다.)\`)) return;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/nodes/\${nodeName}\`, { method: 'DELETE' });
        const data = await res.json();
        if (data.ok) {
          currentLab = data.lab;
          renderTopology(currentLab);
          appendTermLog(\`\\n<span style="color:#f87171;font-weight:700;">🗑️ 노드 '\${nodeName}'이(가) 클러스터에서 제거되었습니다.</span>\\n\`);
        } else {
          alert(data.error || '노드 삭제 실패');
        }
      } catch (err) {
        alert('삭제 요청 오류: ' + err.message);
      }
    }

    // 9. 파드/디플로이먼트 배포 액션
    async function handleDeployWorkload(e) {
      e.preventDefault();
      if (!currentLab) return;
      const name = document.getElementById('deploy-form-name').value.trim();
      const image = document.getElementById('deploy-form-image').value.trim();
      const replicas = document.getElementById('deploy-form-replicas').value;
      const cpu = document.getElementById('deploy-form-cpu').value;
      const disktype = document.getElementById('deploy-form-disk').value;
      const exposeNodePort = document.getElementById('deploy-form-nodeport').checked;

      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/workloads\`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, image, replicas, cpuReqM: cpu, disktype, exposeNodePort })
        });
        const data = await res.json();
        if (data.ok) {
          closeModal('deploy-modal');
          currentLab = data.lab;
          renderTopology(currentLab);
          appendTermLog(\`\\n<span style="color:#10b981;font-weight:700;">📦 워크로드 '\${name}'이(가) 배포되었습니다. (\${replicas}개 파드)</span>\\n\`);
        } else {
          alert('배포 실패: ' + (data.error || '오류'));
        }
      } catch (err) {
        alert('배포 요청 오류: ' + err.message);
      }
    }

    // 10. 카오스 장애 주입
    async function triggerChaos(type) {
      if (!currentLab || !type) return;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/chaos\`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type })
        });
        const data = await res.json();
        if (data.ok) {
          currentLab = data.lab;
          renderTopology(currentLab);
          appendTermLog(\`\\n<span style="color:#f59e0b;font-weight:700;">⚡ [카오스 시뮬레이션 적용 완료: \${type}]</span>\\n\`);
        } else {
          alert(data.error || '장애 주입 실패');
        }
      } catch (err) {
        alert('장애 주입 오류: ' + err.message);
      }
    }

    // 11. 트래픽 슬라이더
    async function updateTraffic(val) {
      if (!currentLab) return;
      document.getElementById('traffic-val').innerText = val + ' req/s';
      try {
        await fetch(\`/api/simulator/labs/\${currentLab.id}/traffic\`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rps: parseInt(val, 10) })
        });
      } catch (e) {}
    }

    // 12. 리셋
    async function resetActiveLab() {
      if (!currentLab || !confirm('클러스터를 초기 상태로 리셋하시겠습니까?')) return;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/reset\`, { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          currentLab = data.lab;
          renderTopology(currentLab);
          appendTermLog('\\n<span style="color:#f59e0b;font-weight:700;">🔄 클러스터가 성공적으로 초기화되었습니다.</span>\\n');
        } else {
          alert(data.error || '리셋 실패');
        }
      } catch (err) {
        alert('리셋 오류: ' + err.message);
      }
    }

    // 13. 새 랩 생성
    async function handleCreateLab(e) {
      e.preventDefault();
      const title = document.getElementById('form-title').value.trim();
      const desc = document.getElementById('form-desc').value.trim();
      const workerCount = document.getElementById('form-workers').value;
      const cpu = document.getElementById('form-cpu').value;
      const editable = document.getElementById('form-editable').checked;

      try {
        const res = await fetch('/api/simulator/labs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title, description: desc, workerCount, cpuPerNode: cpu, editable })
        });
        const data = await res.json();
        if (data.ok && data.lab) {
          closeModal('create-modal');
          openLab(data.lab.id);
        } else {
          alert('생성 실패: ' + (data.error || '알 수 없는 오류'));
        }
      } catch (err) {
        alert('생성 요청 오류: ' + err.message);
      }
    }

    // 14. 실시간 폴링 동기화
    function startPolling(labId) {
      stopPolling();
      pollInterval = setInterval(async () => {
        if (!currentLab || currentLab.id !== labId) return;
        try {
          const res = await fetch(\`/api/simulator/labs/\${labId}\`);
          const data = await res.json();
          if (data.ok && data.lab) {
            if (data.lab.updatedAt !== currentLab.updatedAt) {
              currentLab = data.lab;
              updatePermissionUI(currentLab.editable);
              renderTopology(currentLab);
            }
          }
        } catch (e) {}
      }, 2500);
    }

    function stopPolling() {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    }

    function formatAnsi(text) {
      if (!text) return '';
      return escapeHtml(text)
        .replace(/\\x1b\\[32m/g, '<span style="color:#10b981;">')
        .replace(/\\x1b\\[32;1m/g, '<span style="color:#10b981;font-weight:bold;">')
        .replace(/\\x1b\\[31;1m/g, '<span style="color:#ef4444;font-weight:bold;">')
        .replace(/\\x1b\\[33m/g, '<span style="color:#f59e0b;">')
        .replace(/\\x1b\\[33;1m/g, '<span style="color:#f59e0b;font-weight:bold;">')
        .replace(/\\x1b\\[36;1m/g, '<span style="color:#38bdf8;font-weight:bold;">')
        .replace(/\\x1b\\[0m/g, '</span>');
    }

    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    loadLabs();
  </script>
</body>
</html>
  `;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
