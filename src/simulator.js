/**
 * 쿠버네티스 협업 가상 랩 & 시뮬레이터 — /study/simulator
 *
 * 로그인한 수강생들이 공유 가상 클러스터를 생성·조회하고,
 * 수정 권한(ON/OFF)에 따라 안전하게 또는 협업하여 파드/노드/자원을 제어합니다.
 */

export const SIMULATOR_TITLE = 'K8s 협업 가상 클러스터 랩';

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
    // 인덱스가 없으면 기본 시드 랩 저장
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
    // 인덱스 동기화
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
function schedulePod(pod, lab) {
  for (const node of lab.nodes) {
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

    // 조건 충족 노드 발견
    pod.node = node.name;
    pod.status = 'Running';
    const subnet = node.name === 'master1' ? '172.20.0' : '172.20.1';
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

// 쿠버네티스 명령어 인터프리터
export function evalK8sCommand(cmdLine, lab, user) {
  const line = cmdLine.trim();
  if (!line) return { output: '', labChanged: false };

  // alias k=kubectl 처리
  let tokens = line.split(/\s+/);
  if (tokens[0] === 'k') {
    tokens[0] = 'kubectl';
  }

  const isMutating = ['run', 'create', 'scale', 'delete', 'taint', 'label', 'apply', 'cordon', 'uncordon', 'reset'].includes(tokens[1]);

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

    // NodePort 또는 ClusterIP 검사
    const svc = lab.services?.find((s) => (s.nodePort === port) || (s.clusterIp === ip && s.port === port));
    const isNodeIp = lab.nodes?.some((n) => n.ip === ip || ip === 'localhost' || ip === '127.0.0.1');

    if (svc && (isNodeIp || svc.clusterIp === ip)) {
      // 연결된 파드가 Running인지 확인
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

  // kubectl 명령어 시작
  if (tokens[0] !== 'kubectl') {
    return { output: `bash: ${tokens[0]}: command not found. Type 'help' for valid commands.`, labChanged: false };
  }

  const sub = tokens[1];

  // 3. GET NODES
  if (sub === 'get' && tokens[2] && tokens[2].startsWith('node')) {
    const isWide = line.includes('-o wide');
    let out = isWide
      ? 'NAME      STATUS   ROLES           AGE   VERSION   INTERNAL-IP   OS-IMAGE             KERNEL-VERSION\n'
      : 'NAME      STATUS   ROLES           AGE   VERSION\n';

    for (const n of lab.nodes) {
      const roles = n.role === 'control-plane' ? 'control-plane' : '<none>';
      if (isWide) {
        out += `${n.name.padEnd(10)}${n.status.padEnd(9)}${roles.padEnd(16)}5d    v1.28.2   ${n.ip.padEnd(14)}Ubuntu 22.04.3 LTS   5.15.0-89-generic\n`;
      } else {
        out += `${n.name.padEnd(10)}${n.status.padEnd(9)}${roles.padEnd(16)}5d    v1.28.2\n`;
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

  // 8. RUN (파드 생성)
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
      action: `파드 '${podName}' 생성 (배치 노드: ${newPod.node}, 상태: ${newPod.status})`
    });

    return { output: `pod/${podName} created`, labChanged: true };
  }

  // 9. CREATE DEPLOYMENT
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

    // 파드 생성
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

  // 10. SCALE DEPLOYMENT
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
      // 증설
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
      // 축소
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
      action: `디플로이먼트 '${depName}' 레플리카 수 조정 -> ${count}개`
    });

    return { output: `deployment.apps/${depName} scaled`, labChanged: true };
  }

  // 11. EXPOSE DEPLOYMENT (NodePort 생성)
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
      action: `서비스 '${svcName}' (${isNodePort ? `NodePort: ${randPort}` : 'ClusterIP'}) 노출`
    });

    return { output: `service/${svcName} exposed`, labChanged: true };
  }

  // 12. TAINT NODES
  if (sub === 'taint' && tokens[2] === 'nodes') {
    const nodeName = tokens[3];
    const taintExpr = tokens[4];
    if (!nodeName || !taintExpr) return { output: 'error: node name and taint expression required', labChanged: false };

    const node = lab.nodes?.find((n) => n.name === nodeName);
    if (!node) return { output: `Error from server (NotFound): nodes "${nodeName}" not found`, labChanged: false };

    if (!node.taints) node.taints = [];

    if (taintExpr.endsWith('-')) {
      // Taint 해제
      const key = taintExpr.slice(0, -1).split(':')[0];
      node.taints = node.taints.filter((t) => !t.key.startsWith(key));

      // Pending 상태인 파드들 재스케줄링 시도
      for (const p of lab.pods) {
        if (p.status === 'Pending') {
          schedulePod(p, lab);
        }
      }

      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `노드 '${nodeName}' Taint 해제 (${taintExpr})`
      });
      return { output: `node/${nodeName} untainted`, labChanged: true };
    } else {
      // Taint 설정
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

  // 13. LABEL NODES
  if (sub === 'label' && tokens[2] === 'nodes') {
    const nodeName = tokens[3];
    const labelExpr = tokens[4];
    if (!nodeName || !labelExpr) return { output: 'error: node name and label expression required', labChanged: false };

    const node = lab.nodes?.find((n) => n.name === nodeName);
    if (!node) return { output: `Error from server (NotFound): nodes "${nodeName}" not found`, labChanged: false };

    if (!node.labels) node.labels = {};

    if (labelExpr.endsWith('-')) {
      // 라벨 삭제
      const key = labelExpr.slice(0, -1);
      delete node.labels[key];
      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `노드 '${nodeName}' 라벨 제거 (${key})`
      });
      return { output: `node/${nodeName} unlabeled`, labChanged: true };
    } else {
      // 라벨 추가
      const [k, v] = labelExpr.split('=');
      node.labels[k] = v || '';

      // Pending 상태 파드 재스케줄링
      for (const p of lab.pods) {
        if (p.status === 'Pending') {
          schedulePod(p, lab);
        }
      }

      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `노드 '${nodeName}' 라벨 부여 (${k}=${v}) -> Pending 파드 스케줄링 재시도`
      });
      return { output: `node/${nodeName} labeled`, labChanged: true };
    }
  }

  // 14. DELETE RESOURCE
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
      // 관련 파드 제거
      lab.pods = lab.pods.filter((p) => !p.name.startsWith(name));
      lab.activityLogs.unshift({ time: timeStr, user: userName, action: `디플로이먼트 '${name}' 및 관련 파드 삭제` });
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
    const workerCount = Math.min(Math.max(1, parseInt(body.workerCount || '1', 10)), 3);
    const cpuPerNode = parseInt(body.cpuPerNode || '2000', 10);
    const ramPerNode = parseInt(body.ramPerNode || '4096', 10);
    const editable = body.editable !== false; // 기본값 true

    const id = 'lab-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const creatorName = user?.name || '수강생';

    const nodes = [
      {
        name: 'master1',
        ip: '10.10.10.12',
        role: 'control-plane',
        status: 'Ready',
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

      const userName = user?.name || '수강생';
      lab.activityLogs.unshift({
        time: new Date().toTimeString().slice(0, 8),
        user: userName,
        action: editable
          ? `🔓 수정 권한을 [ ON ]으로 변경했습니다. (모든 수강생 수정 가능)`
          : `🔒 수정 권한을 [ OFF ](조회 전용)로 변경했습니다.`
      });

      await saveLabDetail(env, lab);
      return new Response(JSON.stringify({ ok: true, editable: lab.editable, lab }), { headers: jsonHeaders });
    }

    // 5. POST /api/simulator/labs/:id/exec : 명령어 실행
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

    // 6. POST /api/simulator/labs/:id/traffic : 트래픽 RPS 설정
    if (action === 'traffic' && method === 'POST') {
      let body = {};
      try { body = await request.json(); } catch {}
      const rps = Math.min(Math.max(0, parseInt(body.rps || '0', 10)), 5000);
      lab.trafficRps = rps;
      await saveLabDetail(env, lab);
      return new Response(JSON.stringify({ ok: true, trafficRps: lab.trafficRps }), { headers: jsonHeaders });
    }

    // 7. POST /api/simulator/labs/:id/reset : 랩 초기화
    if (action === 'reset' && method === 'POST') {
      const seed = DEFAULT_LABS.find((s) => s.id === labId);
      if (seed) {
        const fresh = JSON.parse(JSON.stringify(seed));
        fresh.activityLogs.unshift({
          time: new Date().toTimeString().slice(0, 8),
          user: user?.name || '수강생',
          action: '클러스터를 기본 상태로 초기화했습니다.'
        });
        await saveLabDetail(env, fresh);
        return new Response(JSON.stringify({ ok: true, lab: fresh }), { headers: jsonHeaders });
      }
      return new Response(JSON.stringify({ ok: false, error: 'Custom lab reset not supported' }), { headers: jsonHeaders });
    }

    // 8. DELETE /api/simulator/labs/:id : 랩 삭제
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
    body {
      background: #0f172a;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .top-bar {
      position: sticky; top: 0; z-index: 100;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid #2a3143;
      padding: 12px 20px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    }
    .top-brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: #f8fafc; font-weight: 700; font-size: 16px; }
    .top-brand:hover { color: #818cf8; }
    .nav-links { display: flex; align-items: center; gap: 8px; }
    .nav-btn {
      padding: 6px 12px; font-size: 13px; font-weight: 600; color: #94a3b8;
      background: #1e293b; border: 1px solid #334155; border-radius: 6px; text-decoration: none; cursor: pointer; transition: all 0.15s;
    }
    .nav-btn:hover { background: #334155; color: #fff; border-color: #6366f1; }
    .nav-btn.primary { background: #4f46e5; border-color: #6366f1; color: #fff; }
    .nav-btn.primary:hover { background: #4338ca; }

    .main-wrap { flex: 1; max-width: 1440px; width: 100%; margin: 0 auto; padding: 18px 20px 40px; }

    /* 모달 */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000;
      display: none; align-items: center; justify-content: center; padding: 20px;
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: #1e2433; border: 1px solid #334155; border-radius: 12px;
      max-width: 540px; width: 100%; padding: 24px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .modal h2 { font-size: 18px; margin-bottom: 6px; color: #f8fafc; }
    .modal p.desc { font-size: 13px; color: #94a3b8; margin-bottom: 18px; }
    .form-group { margin-bottom: 14px; }
    .form-group label { display: block; font-size: 12.5px; font-weight: 600; color: #cbd5e1; margin-bottom: 6px; }
    .form-control {
      width: 100%; background: #0f172a; border: 1px solid #334155; border-radius: 6px;
      padding: 9px 12px; color: #f8fafc; font-size: 13.5px; font-family: inherit;
    }
    .form-control:focus { outline: none; border-color: #6366f1; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .checkbox-label { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #cbd5e1; cursor: pointer; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }

    /* 1. 목록 뷰 */
    #view-list { display: block; }
    .hero-banner {
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.15) 0%, rgba(30, 41, 59, 0.8) 100%);
      border: 1px solid #334155; border-radius: 12px; padding: 22px 26px; margin-bottom: 24px;
      display: flex; align-items: center; justify-content: space-between; gap: 20px; flex-wrap: wrap;
    }
    .hero-banner h1 { font-size: 20px; font-weight: 700; color: #f8fafc; margin-bottom: 6px; }
    .hero-banner p { font-size: 13.5px; color: #94a3b8; line-height: 1.5; }
    .lab-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
    .lab-card {
      background: #1e2433; border: 1px solid #2a3143; border-radius: 10px; padding: 18px 20px;
      display: flex; flex-direction: column; justify-content: space-between; transition: all 0.15s;
    }
    .lab-card:hover { border-color: #6366f1; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.3); }
    .lab-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
    .lab-title { font-size: 16px; font-weight: 700; color: #f8fafc; }
    .perm-badge {
      font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; white-space: nowrap;
    }
    .perm-badge.on { background: rgba(16, 185, 129, 0.2); color: #34d399; border: 1px solid #059669; }
    .perm-badge.off { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid #d97706; }
    .lab-desc { font-size: 13px; color: #94a3b8; line-height: 1.5; margin-bottom: 14px; flex-grow: 1; }
    .lab-meta { display: flex; align-items: center; gap: 12px; font-size: 12px; color: #64748b; margin-bottom: 16px; }
    .lab-meta span { display: inline-flex; align-items: center; gap: 4px; }
    .lab-card-btn {
      width: 100%; padding: 9px; font-size: 13.5px; font-weight: 600; text-align: center;
      background: #312e81; color: #c7d2fe; border: 1px solid #4338ca; border-radius: 6px; cursor: pointer; text-decoration: none;
      transition: all 0.15s;
    }
    .lab-card-btn:hover { background: #4f46e5; color: #fff; }

    /* 2. 상세 시뮬레이터 뷰 */
    #view-detail { display: none; }
    .detail-head {
      background: #1e2433; border: 1px solid #2a3143; border-radius: 10px; padding: 14px 18px; margin-bottom: 16px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
    }
    .detail-title-box { display: flex; align-items: center; gap: 12px; }
    .detail-title { font-size: 17px; font-weight: 700; color: #f8fafc; }
    .perm-toggle-wrap { display: flex; align-items: center; gap: 10px; background: #0f172a; padding: 4px 10px; border-radius: 8px; border: 1px solid #334155; }
    .perm-label { font-size: 12.5px; font-weight: 700; }
    .switch-btn {
      cursor: pointer; border: none; border-radius: 6px; padding: 5px 12px; font-size: 12px; font-weight: 700; transition: all 0.2s;
    }
    .switch-btn.active-on { background: #10b981; color: #fff; }
    .switch-btn.active-off { background: #ef4444; color: #fff; }

    /* 듀얼 뷰 레이아웃 */
    .dual-grid { display: grid; grid-template-columns: 52% 48%; gap: 16px; }
    @media (max-width: 1024px) {
      .dual-grid { grid-template-columns: 1fr; }
    }

    /* 좌측 터미널 */
    .term-box {
      background: #090d16; border: 1px solid #2a3143; border-radius: 10px; display: flex; flex-direction: column;
      height: 640px; overflow: hidden; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5);
    }
    .term-hd {
      background: #141b2d; border-bottom: 1px solid #2a3143; padding: 8px 14px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .term-dots { display: flex; gap: 6px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; }
    .dot.r { background: #ef4444; } .dot.y { background: #f59e0b; } .dot.g { background: #10b981; }
    .term-hd-title { font-size: 12px; font-family: monospace; color: #94a3b8; }
    .term-body {
      flex: 1; padding: 12px 14px; overflow-y: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px; line-height: 1.55; color: #cbd5e1; white-space: pre-wrap; word-break: break-all;
    }
    .term-input-row {
      background: #0d1322; border-top: 1px solid #1e293b; padding: 10px 14px; display: flex; align-items: center; gap: 8px;
    }
    .term-prompt { color: #10b981; font-weight: 700; font-family: monospace; font-size: 13px; white-space: nowrap; }
    .term-input {
      flex: 1; background: transparent; border: none; outline: none; color: #fff; font-family: monospace; font-size: 13.5px;
    }
    .term-chips { display: flex; gap: 6px; padding: 8px 12px; background: #101726; border-top: 1px solid #1e293b; overflow-x: auto; }
    .chip-btn {
      background: #1e293b; border: 1px solid #334155; border-radius: 4px; padding: 3px 8px;
      font-size: 11px; font-family: monospace; color: #94a3b8; cursor: pointer; white-space: nowrap;
    }
    .chip-btn:hover { background: #334155; color: #fff; border-color: #6366f1; }

    /* 우측 토폴로지 & 메트릭 */
    .topo-box { display: flex; flex-direction: column; gap: 14px; max-height: 640px; overflow-y: auto; }
    .panel-card { background: #1e2433; border: 1px solid #2a3143; border-radius: 10px; padding: 14px 16px; }
    .panel-title { font-size: 14px; font-weight: 700; color: #f8fafc; margin-bottom: 10px; display: flex; align-items: center; justify-content: space-between; }
    
    /* 트래픽 슬라이더 */
    .slider-wrap { display: flex; align-items: center; gap: 12px; }
    .slider { flex: 1; accent-color: #6366f1; cursor: pointer; }
    .slider-val { font-size: 13px; font-family: monospace; font-weight: 700; color: #818cf8; width: 85px; text-align: right; }

    /* 노드 카드 */
    .node-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    @media (max-width: 640px) { .node-grid { grid-template-columns: 1fr; } }
    .node-card { background: #141b2d; border: 1px solid #2a3143; border-radius: 8px; padding: 12px; }
    .node-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .node-name { font-size: 13.5px; font-weight: 700; color: #f8fafc; font-family: monospace; }
    .node-ip { font-size: 11px; color: #64748b; font-family: monospace; }
    .meter-row { margin-bottom: 6px; }
    .meter-label { display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; margin-bottom: 3px; }
    .meter-bar-bg { height: 6px; background: #0f172a; border-radius: 3px; overflow: hidden; }
    .meter-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
    .fill-green { background: #10b981; } .fill-yellow { background: #f59e0b; } .fill-red { background: #ef4444; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 8px; }
    .node-tag { font-size: 10.5px; font-family: monospace; padding: 2px 6px; border-radius: 4px; background: #232d42; color: #cbd5e1; }
    .node-tag.taint { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }

    /* 파드 리스트 */
    .pod-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .pod-table th { text-align: left; color: #64748b; font-weight: 600; padding: 6px 8px; border-bottom: 1px solid #2a3143; }
    .pod-table td { padding: 6px 8px; border-bottom: 1px solid #1a2234; font-family: monospace; color: #cbd5e1; }
    .status-pill { padding: 2px 6px; border-radius: 4px; font-size: 10.5px; font-weight: 700; display: inline-block; }
    .status-running { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .status-pending { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }

    /* 감사 피드 */
    .log-list { display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow-y: auto; font-size: 11.5px; color: #94a3b8; }
    .log-item { display: flex; gap: 8px; border-bottom: 1px solid #1a2234; padding-bottom: 4px; }
    .log-time { color: #64748b; font-family: monospace; flex-shrink: 0; }
    .log-user { color: #818cf8; font-weight: 600; flex-shrink: 0; }
    .log-action { color: #cbd5e1; }
  </style>
</head>
<body>

  <!-- 상단 네비게이션 -->
  <header class="top-bar">
    <a href="/study" class="top-brand">
      <span>📖</span> KT-CI5 스터디 Hub
    </a>
    <div class="nav-links">
      <button class="nav-btn primary" id="btn-open-create" onclick="openCreateModal()">+ 신규 실습 랩 생성</button>
      <a href="/study" class="nav-btn">스터디 메인</a>
      <a href="/study/course/k8s" class="nav-btn">☸️ K8s 강의정리</a>
      <a href="/study/cheatsheet" class="nav-btn">⚡ 치트시트</a>
    </div>
  </header>

  <div class="main-wrap">

    <!-- 1. 실습 랩 목록 뷰 -->
    <div id="view-list">
      <div class="hero-banner">
        <div>
          <h1>☸️ 쿠버네티스 협업 가상 랩 (Collaborative K8s Lab)</h1>
          <p>수강생들과 함께 공유 클러스터에 접속하여 파드를 생성하고, 수정 권한(ON/OFF)을 제어하며 트러블슈팅을 실습하는 공간입니다.</p>
        </div>
        <button class="nav-btn primary" onclick="openCreateModal()" style="padding:10px 18px; font-size:14px;">+ 새 클러스터 만들기</button>
      </div>

      <div class="lab-grid" id="lab-list-container">
        <!-- JS로 채워짐 -->
      </div>
    </div>

    <!-- 2. 상세 시뮬레이터 뷰 -->
    <div id="view-detail">
      <div class="detail-head">
        <div class="detail-title-box">
          <button class="nav-btn" onclick="showListView()">← 랩 목록</button>
          <div>
            <div class="detail-title" id="active-lab-title">기본 2노드 클러스터</div>
            <div style="font-size:12px; color:#64748b;" id="active-lab-meta">생성자: 운영진 | 노드: 2개</div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
          <!-- 수정 권한 토글 스위치 -->
          <div class="perm-toggle-wrap">
            <span class="perm-label" id="perm-label-text">수정 권한: ON</span>
            <button class="switch-btn active-on" id="perm-toggle-btn" onclick="togglePermission()">🔓 수정 허용 (ON)</button>
          </div>
          <button class="nav-btn" onclick="resetActiveLab()" style="color:#f59e0b;">🔄 클러스터 리셋</button>
        </div>
      </div>

      <!-- 듀얼 뷰 -->
      <div class="dual-grid">
        <!-- 좌측: 가상 터미널 -->
        <div class="term-box">
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
            <input type="text" class="term-input" id="term-input" placeholder="명령어를 입력하세요 (예: k get pods, help)" autocomplete="off" spellcheck="false" />
          </div>
        </div>

        <!-- 우측: 토폴로지 & 메트릭 -->
        <div class="topo-box">
          <!-- 부하 조절기 -->
          <div class="panel-card">
            <div class="panel-title">
              <span>🎛️ 가상 트래픽 발생기 (RPS Simulator)</span>
              <span style="font-size:11px; color:#94a3b8;">부하에 따라 CPU 사용량 동적 상승</span>
            </div>
            <div class="slider-wrap">
              <span style="font-size:12px; color:#64748b;">0</span>
              <input type="range" class="slider" id="traffic-slider" min="0" max="3000" step="50" value="100" onchange="updateTraffic(this.value)" />
              <span class="slider-val" id="traffic-val">100 req/s</span>
            </div>
          </div>

          <!-- 노드 카드 목록 -->
          <div class="panel-card">
            <div class="panel-title">
              <span>🖥️ 클러스터 노드 자원 상태</span>
              <span style="font-size:11px; color:#10b981;" id="node-online-badge">● 2 Nodes Ready</span>
            </div>
            <div class="node-grid" id="node-grid-container">
              <!-- JS로 채워짐 -->
            </div>
          </div>

          <!-- 파드 목록 -->
          <div class="panel-card">
            <div class="panel-title">
              <span>📦 실행 중인 파드 (Pods)</span>
              <span style="font-size:11px; color:#94a3b8;" id="pod-count-badge">Total 3</span>
            </div>
            <div style="overflow-x:auto;">
              <table class="pod-table">
                <thead>
                  <tr>
                    <th>NAME</th>
                    <th>NODE</th>
                    <th>STATUS</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody id="pod-table-body">
                  <!-- JS로 채워짐 -->
                </tbody>
              </table>
            </div>
          </div>

          <!-- 서비스 & 네트워크 -->
          <div class="panel-card">
            <div class="panel-title">
              <span>🌐 서비스 & 네트워크 (Services)</span>
            </div>
            <div id="service-list-container" style="display:flex; flex-direction:column; gap:6px;">
              <!-- JS로 채워짐 -->
            </div>
          </div>

          <!-- 실시간 활동 로그 -->
          <div class="panel-card">
            <div class="panel-title">
              <span>📝 실시간 협업 피드 (Live Activity Feed)</span>
              <span style="font-size:11px; color:#64748b;">2초 주기 자동 동기화</span>
            </div>
            <div class="log-list" id="activity-log-container">
              <!-- JS로 채워짐 -->
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>

  <!-- 신규 생성 모달 -->
  <div class="modal-overlay" id="create-modal">
    <div class="modal">
      <h2>➕ 신규 실습 랩 클러스터 생성</h2>
      <p class="desc">가상 노드 수와 자원 할당량을 지정하여 새로운 실습 환경을 생성하고 저장합니다.</p>
      
      <form id="create-lab-form" onsubmit="handleCreateLab(event)">
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
          <button type="button" class="nav-btn" onclick="closeCreateModal()">취소</button>
          <button type="submit" class="nav-btn primary">저장하고 입장하기</button>
        </div>
      </form>
    </div>
  </div>

  <script>
    // 프론트엔드 상태
    let currentLab = null;
    let labList = [];
    let commandHistory = [];
    let historyIdx = -1;
    let pollInterval = null;
    const currentUser = "${escapeHtml(userName)}";

    // 1. 목록 로드
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
              <span class="perm-badge \${lab.editable ? 'on' : 'off'}">\${lab.editable ? '🔓 수정 가능 (ON)' : '🔒 조회 전용 (OFF)'}</span>
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
            <button class="lab-card-btn" onclick="openLab('\${lab.id}')">실습 랩 입장하기 ➔</button>
          </div>
        </div>
      \`).join('');
    }

    // 2. 랩 입장 & 상세 조회
    async function openLab(labId) {
      try {
        const res = await fetch(\`/api/simulator/labs/\${labId}\`);
        const data = await res.json();
        if (data.ok && data.lab) {
          currentLab = data.lab;
          document.getElementById('view-list').style.display = 'none';
          document.getElementById('view-detail').style.display = 'block';

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
      document.getElementById('active-lab-meta').innerText = \`생성자: \${lab.creator} | 생성일: \${lab.createdAt}\`;
      
      updatePermissionUI(lab.editable);
      renderTopology(lab);

      // 터미널 환영 메시지
      const termBody = document.getElementById('term-body');
      termBody.innerHTML = \`<span style="color:#6366f1;">========================================================================</span>\\n\` +
        \`<span style="color:#10b981;font-weight:700;">☸️ KT Cloud 5기 쿠버네티스 협업 랩에 오신 것을 환영합니다!</span>\\n\` +
        \`현재 실습 랩: <b>\${escapeHtml(lab.title)}</b> (접속자: <b>\${currentUser}</b>)\\n\` +
        \`명령어는 <b>alias k=kubectl</b> 로 단축 입력할 수 있습니다. (예: <b>k get nodes</b>, <b>help</b>)\\n\` +
        \`<span style="color:#6366f1;">========================================================================</span>\\n\\n\`;
    }

    // 3. 수정 권한 ON/OFF 토글
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
        btn.innerText = '🔓 수정 가능 (ON)';
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

    // 4. 터미널 인터랙션 & 명령어 실행
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

    function clearTerm() {
      document.getElementById('term-body').innerHTML = '';
    }

    function appendTermLog(html) {
      const b = document.getElementById('term-body');
      b.innerHTML += html;
      b.scrollTop = b.scrollHeight;
    }

    // 5. 토폴로지 렌더링 (우측 패널)
    function renderTopology(lab) {
      if (!lab) return;

      // 트래픽 슬라이더
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

        return \`
          <div class="node-card">
            <div class="node-head">
              <span class="node-name">🖥️ \${node.name}</span>
              <span class="node-ip">\${node.ip}</span>
            </div>
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
          </div>
        \`;
      }).join('');

      // 파드 테이블
      const podTbody = document.getElementById('pod-table-body');
      document.getElementById('pod-count-badge').innerText = 'Total ' + (lab.pods?.length || 0);
      podTbody.innerHTML = (lab.pods || []).map(pod => \`
        <tr>
          <td style="color:#f8fafc; font-weight:600;">\${escapeHtml(pod.name)}</td>
          <td>\${pod.node}</td>
          <td><span class="status-pill \${pod.status === 'Running' ? 'status-running' : 'status-pending'}">\${pod.status}</span></td>
          <td>\${pod.ip}</td>
        </tr>
      \`).join('');

      // 서비스 목록
      const svcC = document.getElementById('service-list-container');
      svcC.innerHTML = (lab.services || []).map(svc => \`
        <div style="background:#141b2d; border:1px solid #2a3143; border-radius:6px; padding:8px 12px; display:flex; align-items:center; justify-content:space-between;">
          <div>
            <div style="font-weight:700; font-size:12.5px; color:#f8fafc; font-family:monospace;">\${svc.name} (\${svc.type})</div>
            <div style="font-size:11px; color:#94a3b8; font-family:monospace;">ClusterIP: \${svc.clusterIp}:\${svc.port} \${svc.nodePort ? '| NodePort: ' + svc.nodePort : ''}</div>
          </div>
          \${svc.nodePort ? \`<button class="chip-btn" onclick="runChip('curl 10.10.10.20:\${svc.nodePort}')" style="background:#312e81; color:#c7d2fe;">🌐 curl 테스트</button>\` : ''}
        </div>
      \`).join('');

      // 활동 로그
      const logC = document.getElementById('activity-log-container');
      logC.innerHTML = (lab.activityLogs || []).slice(0, 15).map(l => \`
        <div class="log-item">
          <span class="log-time">\${l.time}</span>
          <span class="log-user">[\${escapeHtml(l.user)}]</span>
          <span class="log-action">\${escapeHtml(l.action)}</span>
        </div>
      \`).join('');
    }

    // 6. 트래픽 슬라이더 업데이트
    async function updateTraffic(val) {
      if (!currentLab) return;
      document.getElementById('traffic-val').innerText = val + ' req/s';
      try {
        await fetch(\`/api/simulator/labs/\${currentLab.id}/traffic\`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ rps: parseInt(val, 10) })
        });
      } catch (e) {
        console.error('updateTraffic error:', e);
      }
    }

    // 7. 리셋
    async function resetActiveLab() {
      if (!currentLab || !confirm('이 클러스터를 초기 기본 상태로 되돌리시겠습니까?')) return;
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

    // 8. 신규 생성 모달 제어
    function openCreateModal() {
      document.getElementById('create-modal').classList.add('active');
    }
    function closeCreateModal() {
      document.getElementById('create-modal').classList.remove('active');
    }
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
          body: JSON.stringify({
            title,
            description: desc,
            workerCount,
            cpuPerNode: cpu,
            editable
          })
        });
        const data = await res.json();
        if (data.ok && data.lab) {
          closeCreateModal();
          openLab(data.lab.id);
        } else {
          alert('생성 실패: ' + (data.error || '알 수 없는 오류'));
        }
      } catch (err) {
        alert('생성 요청 오류: ' + err.message);
      }
    }

    // 9. 주기적 폴링 (실시간 협업 동기화)
    function startPolling(labId) {
      stopPolling();
      pollInterval = setInterval(async () => {
        if (!currentLab || currentLab.id !== labId) return;
        try {
          const res = await fetch(\`/api/simulator/labs/\${labId}\`);
          const data = await res.json();
          if (data.ok && data.lab) {
            // 변경사항이 있을 때만 조용히 갱신
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

    // ANSI 컬러 포맷터
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

    // 시작
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
