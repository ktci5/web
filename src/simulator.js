/**
 * 쿠버네티스 협업 가상 랩 & 상용 인프라 운영 콘솔 — /study/simulator
 *
 * 1. 화면 짤림 방지 반응형 뷰포트 레이아웃 & 5가지 분할 뷰 모드
 * 2. 네트워크 엔지니어링: L7 로드밸런서(VIP/헬스체크), 도메인/Ingress 바인딩, 하이브리드 터널(Argo/WireGuard)
 * 3. 서버 하드웨어 확장: vCPU Hot-Add, RAM 동적 증설, 가상 디스크(Block Storage/PV/PVC) 추가
 * 4. 상용 트러블슈팅 시나리오: 디스크 고갈(DiskPressure), LB 페일오버, 터널 단절, OOMKilled
 */

export const SIMULATOR_TITLE = 'K8s 상용 인프라 & 협업 가상 랩 콘솔';

// 기본 네트워크 템플릿
function createDefaultNetwork() {
  return {
    loadBalancer: {
      name: 'kt-cloud-alb-01',
      vip: '211.252.85.10',
      type: 'KT Cloud L7 Application Load Balancer',
      status: 'Healthy',
      algorithm: 'RoundRobin',
      ssl: 'TLSv1.3 (Let\'s Encrypt Valid)',
      targetPool: [
        { target: '10.10.10.20:30080', status: 'Healthy', latencyMs: 2.1 },
        { target: '10.10.10.12:30080', status: 'Healthy', latencyMs: 1.8 }
      ]
    },
    ingress: {
      domain: 'ktci5.kr',
      rules: [
        { host: 'app.ktci5.kr', path: '/', service: 'web-service:80', ssl: true },
        { host: 'api.ktci5.kr', path: '/api', service: 'api-service:8080', ssl: true }
      ]
    },
    tunnel: {
      name: 'kt-hybrid-argo-tunnel',
      provider: 'Cloudflare Tunnel (argo) / WireGuard Mesh',
      status: 'CONNECTED', // 'CONNECTED' | 'DISCONNECTED' | 'DEGRADED'
      endpoint: 'tunnel.ktci5.kr ➔ 10.10.10.12 (KT Cloud DBO)',
      throughputMbps: 480,
      latencyMs: 3.5,
      encryption: 'ChaCha20-Poly1305'
    }
  };
}

// 기본 제공 시드 랩
export const DEFAULT_LABS = [
  {
    id: 'default',
    title: '상용 2노드 클러스터 & 웹 인프라 환경',
    description: '마스터(10.10.10.12) & 워커(10.10.20), KT Cloud L7 로드밸런서(VIP 211.252.85.10), 도메인(app.ktci5.kr) 및 터널이 연결된 상용 환경',
    creator: '운영진',
    creatorId: 'system',
    createdAt: '2026-09-22',
    updatedAt: new Date().toISOString(),
    editable: true,
    trafficRps: 180,
    network: createDefaultNetwork(),
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
        labels: { 'kubernetes.io/hostname': 'master1', 'node-role.kubernetes.io/control-plane': '' },
        disks: [
          { name: 'vda (OS)', sizeGb: 50, usedGb: 19, type: 'SSD', mount: '/' }
        ]
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
        labels: { 'kubernetes.io/hostname': 'w1', 'disktype': 'hdd' },
        disks: [
          { name: 'vda (OS)', sizeGb: 50, usedGb: 22, type: 'SSD', mount: '/' },
          { name: 'vdb (Storage)', sizeGb: 100, usedGb: 15, type: 'HDD', mount: '/mnt/data' }
        ]
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
      { time: '02:00:00', user: '운영진', action: 'KT Cloud L7 ALB (VIP: 211.252.85.10) 및 도메인(app.ktci5.kr) 연동 완료' },
      { time: '02:01:15', user: '운영진', action: 'Cloudflare 하이브리드 터널(암호화 전송) 활성화' }
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
    network: createDefaultNetwork(),
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
        labels: { 'kubernetes.io/hostname': 'master1' },
        disks: [{ name: 'vda (OS)', sizeGb: 50, usedGb: 18, type: 'SSD', mount: '/' }]
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
        labels: { 'kubernetes.io/hostname': 'w1' },
        disks: [{ name: 'vda (OS)', sizeGb: 50, usedGb: 15, type: 'SSD', mount: '/' }]
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
      { time: '02:05:00', user: '운영진', action: 'hdd-pod 생성 -> nodeSelector(disktype=hdd) 일치 노드 없어 Pending 진입' }
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
    network: createDefaultNetwork(),
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
        labels: { 'kubernetes.io/hostname': 'master1' },
        disks: [{ name: 'vda (OS)', sizeGb: 50, usedGb: 20, type: 'SSD', mount: '/' }]
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
        labels: { 'kubernetes.io/hostname': 'w1' },
        disks: [{ name: 'vda (OS)', sizeGb: 50, usedGb: 21, type: 'SSD', mount: '/' }]
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
    // 네트워크 객체 및 디스크 보완 (기존 랩 호환성)
    if (lab && !lab.network) {
      lab.network = createDefaultNetwork();
    }
    if (lab && lab.nodes) {
      for (const n of lab.nodes) {
        if (!n.disks) {
          n.disks = [{ name: 'vda (OS)', sizeGb: 50, usedGb: 20, type: 'SSD', mount: '/' }];
        }
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

// 스케줄러 알고리즘
export function schedulePod(pod, lab) {
  for (const node of lab.nodes) {
    if (node.status !== 'Ready' || node.unschedulable) continue;

    // 디스크 고갈 노드 배제 (DiskPressure)
    const osDisk = node.disks?.[0];
    if (osDisk && (osDisk.usedGb / osDisk.sizeGb) > 0.90) continue;

    // Taint 검사
    const hasNoSchedule = node.taints && node.taints.some((t) => t.effect === 'NoSchedule');
    if (hasNoSchedule) continue;

    // nodeSelector 검사
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

    pod.node = node.name;
    pod.status = 'Running';
    const subnet = node.name === 'master1' ? '172.20.0' : `172.20.${(node.name.charCodeAt(node.name.length - 1) % 9) + 1}`;
    const rand = Math.floor(Math.random() * 200) + 10;
    pod.ip = `${subnet}.${rand}`;
    return true;
  }

  pod.node = 'None';
  pod.status = 'Pending';
  pod.ip = 'None';
  return false;
}

export function rescheduleAll(lab) {
  let changed = false;
  if (!lab.pods) return false;

  for (const p of lab.pods) {
    const currentNode = lab.nodes.find((n) => n.name === p.node);
    const osDisk = currentNode?.disks?.[0];
    const isDiskPressure = osDisk && (osDisk.usedGb / osDisk.sizeGb) > 0.90;
    const nodeUnavailable = !currentNode || currentNode.status !== 'Ready' || currentNode.unschedulable || isDiskPressure;
    
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

  let tokens = line.split(/\s+/);
  if (tokens[0] === 'k') tokens[0] = 'kubectl';

  const isMutating = ['run', 'create', 'scale', 'delete', 'taint', 'label', 'apply', 'cordon', 'uncordon', 'drain', 'reset'].includes(tokens[1]);

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
      output: `\x1b[36;1m☸️ 사용 가능한 쿠버네티스 & 인프라 명령어 목록:\x1b[0m
  • \x1b[33mk get nodes [-o wide]\x1b[0m        : 노드 목록 및 IP 조회
  • \x1b[33mk get pods [-o wide]\x1b[0m         : 파드 상태 및 할당 노드 조회
  • \x1b[33mk get svc / k get ingress\x1b[0m    : 서비스 및 Ingress 도메인 라우팅 조회
  • \x1b[33mk top nodes / k top pods\x1b[0m      : 가상 CPU/메모리 실시간 사용률 조회
  • \x1b[33mdf -h\x1b[0m                         : 가상 노드 스토리지/디스크 용량 점검
  • \x1b[33mtunnel status\x1b[0m                 : 하이브리드 클라우드 터널 상태 및 지연시간 조회
  • \x1b[33mk run <이름> --image=<이미지>\x1b[0m  : 단일 파드 생성
  • \x1b[33mk create deploy <이름> --image=<이미지> --replicas=<N>\x1b[0m : 디플로이먼트 생성
  • \x1b[33mk scale deploy <이름> --replicas=<N>\x1b[0m                   : 레플리카 수 조정
  • \x1b[33mk expose deploy <이름> --port=80 --type=NodePort\x1b[0m       : NodePort 서비스 노출
  • \x1b[33mk taint nodes <노드> <키>:<효과>[-]\x1b[0m                  : 노드 Taint 설정/해제
  • \x1b[33mk label nodes <노드> <키>=<값>[-]\x1b[0m                   : 노드 라벨 부여/삭제
  • \x1b[33mk cordon <노드> / k uncordon <노드>\x1b[0m                 : 노드 스케줄링 제어
  • \x1b[33mk drain <노드> --ignore-daemonsets\x1b[0m                 : 노드 파드 비우기(Drain)
  • \x1b[33mk delete pod/deploy/svc <이름>\x1b[0m                         : 리소스 삭제
  • \x1b[33mcurl [-H "Host: ..."] <IP/도메인>\x1b[0m                    : L7 로드밸런서 및 도메인 호출 테스트
  • \x1b[33mclear\x1b[0m                                                 : 화면 지우기`,
      labChanged: false
    };
  }

  // 2. DF -H (가상 디스크 용량 점검)
  if (line === 'df -h' || line === 'df') {
    let out = 'Filesystem      Size  Used Avail Use% Mounted on\n';
    out += 'udev            1.9G     0  1.9G   0% /dev\n';
    out += 'tmpfs           392M  1.1M  391M   1% /run\n';
    for (const node of lab.nodes) {
      for (const d of (node.disks || [])) {
        const avail = Math.max(0, d.sizeGb - d.usedGb);
        const pct = Math.round((d.usedGb / d.sizeGb) * 100);
        const namePadded = `/dev/${d.name.split(' ')[0]}`.padEnd(16);
        out += `${namePadded}${String(d.sizeGb + 'G').padEnd(6)}${String(d.usedGb + 'G').padEnd(6)}${String(avail + 'G').padEnd(6)}${String(pct + '%').padEnd(5)}[${node.name}] ${d.mount}\n`;
      }
    }
    return { output: out.trimEnd(), labChanged: false };
  }

  // 3. TUNNEL STATUS
  if (line === 'tunnel status' || line === 'cloudflared tunnel info') {
    const t = lab.network?.tunnel || createDefaultNetwork().tunnel;
    const isOk = t.status === 'CONNECTED';
    return {
      output: `\x1b[36;1m🚇 KT Cloud Hybrid Tunnel Status:\x1b[0m
  • Name:        ${t.name}
  • Provider:    ${t.provider}
  • Status:      ${isOk ? '\x1b[32;1m● CONNECTED\x1b[0m' : '\x1b[31;1m● DISCONNECTED\x1b[0m'}
  • Route:       ${t.endpoint}
  • Latency:     ${isOk ? t.latencyMs + ' ms' : 'N/A (Timeout)'}
  • Bandwidth:   ${isOk ? t.throughputMbps + ' Mbps' : '0 Mbps'}
  • Encryption:  ${t.encryption}`,
      labChanged: false
    };
  }

  // 4. CURL 테스트 (L7 로드밸런서, Ingress 도메인, NodePort 지원)
  if (tokens[0] === 'curl') {
    const net = lab.network || createDefaultNetwork();
    const isTunnelDown = net.tunnel?.status === 'DISCONNECTED';
    
    // 도메인 헤더 추출
    let targetHost = '';
    const hostIdx = tokens.indexOf('-H');
    if (hostIdx !== -1 && tokens[hostIdx + 1]) {
      const matchH = tokens[hostIdx + 1].match(/Host:\s*([^\s"']+)/i);
      if (matchH) targetHost = matchH[1];
    }

    const targetUrl = tokens[tokens.length - 1];
    let hostOrIp = targetUrl.replace(/^https?:\/\//, '').split('/')[0];
    let port = 80;
    if (hostOrIp.includes(':')) {
      const p = hostOrIp.split(':');
      hostOrIp = p[0];
      port = parseInt(p[1], 10);
    }
    if (!targetHost && hostOrIp.includes('.')) {
      targetHost = hostOrIp;
    }

    // 터널 단절 상태 체크
    if (isTunnelDown && (targetHost.includes('ktci5.kr') || hostOrIp === net.loadBalancer?.vip)) {
      return {
        output: `curl: (52) Empty reply from server\nHTTP/1.1 502 Bad Gateway (Cloudflare Tunnel: Origin Unreachable)`,
        labChanged: false
      };
    }

    // L7 로드밸런서 VIP 또는 도메인 매칭
    const isLbVip = hostOrIp === net.loadBalancer?.vip;
    const isDomainMatch = targetHost && net.ingress?.rules?.some((r) => r.host === targetHost);

    if (isLbVip || isDomainMatch) {
      const matchedRule = net.ingress?.rules?.find((r) => r.host === targetHost) || net.ingress?.rules?.[0];
      const targetService = matchedRule?.service?.split(':')[0] || 'web-service';
      
      const targetPods = lab.pods?.filter((p) => p.status === 'Running' && (p.name.includes('web') || p.name.includes('api')));
      
      if (targetPods && targetPods.length > 0) {
        // Round Robin 라운드로빈 파드 선택
        const chosenPod = targetPods[Math.floor(Math.random() * targetPods.length)];
        return {
          output: `\x1b[32mHTTP/1.1 200 OK\x1b[0m
Date: ${new Date().toUTCString()}
Server: KT-Cloud-ALB/2.4 (L7 Reverse Proxy)
X-Forwarded-Host: ${targetHost || 'app.ktci5.kr'}
X-Forwarded-Proto: https
X-Backend-Server: ${chosenPod.ip}:80 (${chosenPod.node})
Content-Type: text/html; charset=UTF-8

<!DOCTYPE html>
<html>
<head><title>KT Cloud 5기 상용 인프라 서비스</title></head>
<body style="font-family:sans-serif;padding:30px;text-align:center;">
<h1>🚀 Production Service via KT Cloud L7 ALB</h1>
<p>Domain: <b>${targetHost || 'app.ktci5.kr'}</b> ➔ Ingress VIP: <b>${net.loadBalancer?.vip}</b></p>
<p>Routed Pod: <span style="color:#10b981;font-weight:bold;">${chosenPod.name}</span> (Node: <b>${chosenPod.node}</b>)</p>
<p>SSL Status: <b>${net.loadBalancer?.ssl}</b> | Tunnel: <b>${net.tunnel?.status}</b></p>
</body>
</html>`,
          labChanged: false
        };
      } else {
        return {
          output: `HTTP/1.1 503 Service Unavailable (No healthy upstream pods in target pool)`,
          labChanged: false
        };
      }
    }

    // NodePort 직접 호출 검사
    const svc = lab.services?.find((s) => (s.nodePort === port) || (s.clusterIp === hostOrIp && s.port === port));
    const isNodeIp = lab.nodes?.some((n) => n.ip === hostOrIp || hostOrIp === 'localhost' || hostOrIp === '127.0.0.1');

    if (svc && (isNodeIp || svc.clusterIp === hostOrIp)) {
      const targetPods = lab.pods?.filter((p) => p.status === 'Running');
      if (targetPods && targetPods.length > 0) {
        return {
          output: `\x1b[32mHTTP/1.1 200 OK\x1b[0m
Server: nginx/1.25.3
Content-Type: text/html
Content-Length: 512

<!DOCTYPE html>
<html><body><h1>Welcome to NodePort ${port}!</h1><p>Served by ${targetPods[0].name} on ${targetPods[0].node}</p></body></html>`,
          labChanged: false
        };
      }
    }

    return { output: `curl: (7) Failed to connect to ${hostOrIp} port ${port}: Connection refused`, labChanged: false };
  }

  if (tokens[0] !== 'kubectl') {
    return { output: `bash: ${tokens[0]}: command not found. Type 'help' for valid commands.`, labChanged: false };
  }

  const sub = tokens[1];

  // 5. GET INGRESS
  if (sub === 'get' && tokens[2] && (tokens[2].startsWith('ing') || tokens[2] === 'ingress')) {
    const net = lab.network || createDefaultNetwork();
    let out = 'NAME              CLASS   HOSTS                      ADDRESS         PORTS     AGE\n';
    out += `kt-ingress-alb    nginx   app.ktci5.kr,api.ktci5.kr  ${net.loadBalancer?.vip.padEnd(16)}80, 443   5d\n`;
    return { output: out.trimEnd(), labChanged: false };
  }

  // 6. GET NODES
  if (sub === 'get' && tokens[2] && tokens[2].startsWith('node')) {
    const isWide = line.includes('-o wide');
    let out = isWide
      ? 'NAME      STATUS                     ROLES           AGE   VERSION   INTERNAL-IP   OS-IMAGE             KERNEL-VERSION\n'
      : 'NAME      STATUS                     ROLES           AGE   VERSION\n';

    for (const n of lab.nodes) {
      let statusStr = n.status;
      const osDisk = n.disks?.[0];
      if (osDisk && (osDisk.usedGb / osDisk.sizeGb) > 0.90) {
        statusStr = 'Ready,DiskPressure';
      }
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

  // 7. GET PODS
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

  // 8. TOP NODES / PODS
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

  // 9. CORDON / UNCORDON / DRAIN
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

    let evicted = 0;
    for (const p of lab.pods) {
      if (p.node === nodeName) {
        p.node = 'None';
        p.status = 'Pending';
        schedulePod(p, lab);
        evicted++;
      }
    }
    lab.activityLogs.unshift({ time: timeStr, user: userName, action: `노드 '${nodeName}' 드레인 완료 (${evicted}개 파드 퇴출)` });
    return { output: `node/${nodeName} cordoned\nevicting pod on ${nodeName}...\nnode/${nodeName} drained`, labChanged: true };
  }

  // 10. RUN (파드 생성)
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

  // 11. SCALE DEPLOYMENT
  if (sub === 'scale' && (tokens[2] === 'deployment' || tokens[2] === 'deploy')) {
    const depName = tokens[3];
    const repArg = tokens.find((t) => t.startsWith('--replicas='));
    if (!depName || !repArg) return { output: 'error: required flag --replicas missing', labChanged: false };
    const count = parseInt(repArg.split('=')[1], 10);
    const dep = lab.deployments?.find((d) => d.name === depName);
    if (!dep) return { output: `deployments.apps "${depName}" not found`, labChanged: false };

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
    lab.activityLogs.unshift({ time: timeStr, user: userName, action: `디플로이먼트 '${depName}' 스케일 -> ${count}개` });
    return { output: `deployment.apps/${depName} scaled`, labChanged: true };
  }

  // 12. TAINT NODES
  if (sub === 'taint' && tokens[2] === 'nodes') {
    const nodeName = tokens[3];
    const taintExpr = tokens[4];
    if (!nodeName || !taintExpr) return { output: 'error: node name and taint expression required', labChanged: false };

    const node = lab.nodes?.find((n) => n.name === nodeName);
    if (!node) return { output: `nodes "${nodeName}" not found`, labChanged: false };

    if (!node.taints) node.taints = [];

    if (taintExpr.endsWith('-')) {
      const key = taintExpr.slice(0, -1).split(':')[0];
      node.taints = node.taints.filter((t) => !t.key.startsWith(key));
      rescheduleAll(lab);
      lab.activityLogs.unshift({ time: timeStr, user: userName, action: `노드 '${nodeName}' Taint 해제 (${taintExpr})` });
      return { output: `node/${nodeName} untainted`, labChanged: true };
    } else {
      const [key, effect] = taintExpr.split(':');
      node.taints.push({ key, effect: effect || 'NoSchedule' });
      lab.activityLogs.unshift({ time: timeStr, user: userName, action: `노드 '${nodeName}' Taint 설정 (${key}:${effect})` });
      return { output: `node/${nodeName} tainted`, labChanged: true };
    }
  }

  // 13. LABEL NODES
  if (sub === 'label' && tokens[2] === 'nodes') {
    const nodeName = tokens[3];
    const labelExpr = tokens[4];
    if (!nodeName || !labelExpr) return { output: 'error: node name and label expression required', labChanged: false };

    const node = lab.nodes?.find((n) => n.name === nodeName);
    if (!node) return { output: `nodes "${nodeName}" not found`, labChanged: false };

    if (!node.labels) node.labels = {};

    if (labelExpr.endsWith('-')) {
      const key = labelExpr.slice(0, -1);
      delete node.labels[key];
      lab.activityLogs.unshift({ time: timeStr, user: userName, action: `노드 '${nodeName}' 라벨 제거 (${key})` });
      return { output: `node/${nodeName} unlabeled`, labChanged: true };
    } else {
      const [k, v] = labelExpr.split('=');
      node.labels[k] = v || '';
      rescheduleAll(lab);
      lab.activityLogs.unshift({ time: timeStr, user: userName, action: `노드 '${nodeName}' 라벨 부여 (${k}=${v})` });
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
      if (idx === -1) return { output: `pods "${name}" not found`, labChanged: false };
      lab.pods.splice(idx, 1);
      lab.activityLogs.unshift({ time: timeStr, user: userName, action: `파드 '${name}' 삭제` });
      return { output: `pod "${name}" deleted`, labChanged: true };
    }

    if (type.startsWith('deploy')) {
      const idx = lab.deployments.findIndex((d) => d.name === name);
      if (idx === -1) return { output: `deployments.apps "${name}" not found`, labChanged: false };
      lab.deployments.splice(idx, 1);
      lab.pods = lab.pods.filter((p) => !p.name.startsWith(name));
      lab.activityLogs.unshift({ time: timeStr, user: userName, action: `디플로이먼트 '${name}' 삭제` });
      return { output: `deployment.apps "${name}" deleted`, labChanged: true };
    }
  }

  return {
    output: `error: unknown command: "${line}". Type 'help' for examples.`,
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
        labels: { 'kubernetes.io/hostname': 'master1' },
        disks: [{ name: 'vda (OS)', sizeGb: 50, usedGb: 19, type: 'SSD', mount: '/' }]
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
        labels: { 'kubernetes.io/hostname': `w${i}`, 'disktype': i === 1 ? 'hdd' : 'ssd' },
        disks: [{ name: 'vda (OS)', sizeGb: 50, usedGb: 18, type: 'SSD', mount: '/' }]
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
      trafficRps: 120,
      network: createDefaultNetwork(),
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

    // 5. POST /api/simulator/labs/:id/nodes : VM 노드 신규 프로비저닝
    if (action === 'nodes' && method === 'POST') {
      if (!lab.editable) return new Response(JSON.stringify({ ok: false, error: '수정 권한이 OFF 상태입니다.' }), { headers: jsonHeaders, status: 403 });
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
        labels: { 'kubernetes.io/hostname': name, 'disktype': disktype },
        disks: [
          { name: 'vda (OS)', sizeGb: 50, usedGb: 18, type: disktype.toUpperCase(), mount: '/' },
          { name: 'vdb (Storage)', sizeGb: 100, usedGb: 5, type: disktype.toUpperCase(), mount: '/mnt/storage' }
        ]
      };

      lab.nodes.push(newNode);
      rescheduleAll(lab);

      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `🖥️ 새 워커 노드 VM '${name}' (${ip}, ${cpu}m CPU, ${ram}Mi RAM) 프로비저닝 완료`
      });

      await saveLabDetail(env, lab);
      return new Response(JSON.stringify({ ok: true, node: newNode, lab }), { headers: jsonHeaders, status: 201 });
    }

    // 6. PATCH /api/simulator/labs/:id/nodes/:nodeName/hardware : 하드웨어 스펙 동적 확장 (CPU, RAM, Disk)
    if (action && action.startsWith('nodes/') && action.endsWith('/hardware') && method === 'PATCH') {
      if (!lab.editable) return new Response(JSON.stringify({ ok: false, error: '수정 권한이 OFF 상태입니다.' }), { headers: jsonHeaders, status: 403 });
      const parts = action.split('/');
      const nodeName = parts[1];
      const node = lab.nodes?.find((n) => n.name === nodeName);
      if (!node) return new Response(JSON.stringify({ ok: false, error: 'Node not found' }), { headers: jsonHeaders, status: 404 });

      let body = {};
      try { body = await request.json(); } catch {}

      let logMsg = `⚙️ [하드웨어 확장] 노드 '${nodeName}': `;

      if (body.cpu) {
        node.cpuTotalM = parseInt(body.cpu, 10);
        logMsg += `vCPU ➔ ${node.cpuTotalM}m (${node.cpuTotalM / 1000} Core) `;
      }
      if (body.ram) {
        node.ramTotalMi = parseInt(body.ram, 10);
        logMsg += `RAM ➔ ${node.ramTotalMi}Mi (${node.ramTotalMi / 1024} GiB) `;
      }
      if (body.addDisk) {
        if (!node.disks) node.disks = [];
        const nextDiskName = `vd${String.fromCharCode(97 + node.disks.length)}`;
        node.disks.push({
          name: `${nextDiskName} (${body.addDisk.type || 'SSD'})`,
          sizeGb: parseInt(body.addDisk.sizeGb || '100', 10),
          usedGb: 2,
          type: body.addDisk.type || 'SSD',
          mount: body.addDisk.mount || `/mnt/vol${node.disks.length}`
        });
        logMsg += `가상 디스크 ${nextDiskName} (${body.addDisk.sizeGb}GB) Hot-Add 완료 `;
        
        // 디스크 압박 해제
        if (node.disks[0] && (node.disks[0].usedGb / node.disks[0].sizeGb) > 0.90) {
          node.disks[0].usedGb = 25; // 디스크 정리/마이그레이션 효과
          logMsg += `(DiskPressure 해제)`;
        }
      }

      rescheduleAll(lab);
      lab.activityLogs.unshift({ time: timeStr, user: userName, action: logMsg });
      await saveLabDetail(env, lab);
      return new Response(JSON.stringify({ ok: true, node, lab }), { headers: jsonHeaders });
    }

    // 7. PATCH /api/simulator/labs/:id/network : 네트워크 설정 (LB 알고리즘, 터널 토글, 도메인 연결)
    if (action === 'network' && (method === 'PATCH' || method === 'POST')) {
      if (!lab.editable) return new Response(JSON.stringify({ ok: false, error: '수정 권한이 OFF 상태입니다.' }), { headers: jsonHeaders, status: 403 });
      let body = {};
      try { body = await request.json(); } catch {}

      if (!lab.network) lab.network = createDefaultNetwork();

      if (body.toggleTunnel !== undefined) {
        lab.network.tunnel.status = lab.network.tunnel.status === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED';
        lab.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: `🚇 [하이브리드 터널] 상태 변경 ➔ ${lab.network.tunnel.status}`
        });
      }

      if (body.addDomain) {
        lab.network.ingress.rules.push({
          host: body.addDomain.host,
          path: body.addDomain.path || '/',
          service: body.addDomain.service || 'web-service:80',
          ssl: true
        });
        lab.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: `🌐 [도메인 바인딩] '${body.addDomain.host}' ➔ '${body.addDomain.service}' Ingress 매핑 & SSL 발급 완료`
        });
      }

      await saveLabDetail(env, lab);
      return new Response(JSON.stringify({ ok: true, network: lab.network, lab }), { headers: jsonHeaders });
    }

    // 8. POST /api/simulator/labs/:id/scenario : 상용 운영 장애 & 해결 시나리오 주입
    if (action === 'scenario' && method === 'POST') {
      if (!lab.editable) return new Response(JSON.stringify({ ok: false, error: '수정 권한이 OFF 상태입니다.' }), { headers: jsonHeaders, status: 403 });
      let body = {};
      try { body = await request.json(); } catch {}
      const type = body.type;

      if (!lab.network) lab.network = createDefaultNetwork();

      if (type === 'disk_pressure') {
        const target = lab.nodes.find((n) => n.role === 'worker') || lab.nodes[0];
        if (target && target.disks?.[0]) {
          target.disks[0].usedGb = Math.round(target.disks[0].sizeGb * 0.96); // 96% 고갈
          rescheduleAll(lab);
          lab.activityLogs.unshift({
            time: timeStr,
            user: userName,
            action: `🚨 [상용 장애 경보] 노드 '${target.name}' 디스크 96% 고갈 ➔ DiskPressure 조건 발생, 파드 스케줄링 중단`
          });
        }
      } else if (type === 'lb_failover') {
        const pool = lab.network.loadBalancer.targetPool;
        if (pool && pool[0]) {
          pool[0].status = pool[0].status === 'Healthy' ? 'Unhealthy (503 Error)' : 'Healthy';
          lab.activityLogs.unshift({
            time: timeStr,
            user: userName,
            action: `⚡ [로드밸런서 페일오버] 타겟 ${pool[0].target} 상태 ➔ ${pool[0].status}, 트래픽 자동 우회`
          });
        }
      } else if (type === 'tunnel_cut') {
        lab.network.tunnel.status = 'DISCONNECTED';
        lab.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: `🚇 [터널 장애] Cloudflare 하이브리드 터널 단절 발생 (외부 트래픽 502 유발)`
        });
      } else if (type === 'resolve_all') {
        // 모든 장애 복구
        lab.network.tunnel.status = 'CONNECTED';
        if (lab.network.loadBalancer.targetPool) {
          lab.network.loadBalancer.targetPool.forEach((p) => p.status = 'Healthy');
        }
        for (const n of lab.nodes) {
          n.status = 'Ready';
          n.unschedulable = false;
          if (n.disks?.[0]) n.disks[0].usedGb = 20; // 디스크 정상화
        }
        rescheduleAll(lab);
        lab.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: `✅ [정상 복구] 모든 네트워크 터널, L7 로드밸런서 헬스체크 및 노드 디스크 정상 복원 완료`
        });
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
          action: '클러스터 및 인프라를 기본 상태로 초기화했습니다.'
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
      overflow: hidden;
    }
    
    /* 최상단 헤더 */
    .top-bar {
      height: 52px; background: #111827; border-bottom: 1px solid #1f293d; padding: 0 16px;
      display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0;
    }
    .top-brand { display: flex; align-items: center; gap: 8px; text-decoration: none; color: #f8fafc; font-weight: 700; font-size: 15px; }
    .top-brand:hover { color: #818cf8; }
    .nav-actions { display: flex; align-items: center; gap: 8px; }
    
    .btn {
      display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 12px; font-weight: 600;
      color: #cbd5e1; background: #1e293b; border: 1px solid #334155; border-radius: 6px; text-decoration: none; cursor: pointer; transition: all 0.15s;
    }
    .btn:hover { background: #334155; color: #fff; border-color: #6366f1; }
    .btn.primary { background: #4f46e5; border-color: #6366f1; color: #fff; }
    .btn.primary:hover { background: #4338ca; }
    .btn.warning { background: #d97706; border-color: #f59e0b; color: #fff; }
    .btn.danger { background: #dc2626; border-color: #ef4444; color: #fff; }
    .btn.sm { padding: 4px 8px; font-size: 11px; }

    /* 메인 뷰포트 */
    .viewport-container {
      height: calc(100vh - 52px); display: flex; flex-direction: column; overflow: hidden;
    }

    /* 1. 목록 뷰 */
    #view-list { flex: 1; padding: 20px; overflow-y: auto; max-width: 1400px; width: 100%; margin: 0 auto; }
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

    /* 2. 상세 시뮬레이터 뷰 */
    #view-detail { flex: 1; display: none; flex-direction: column; height: 100%; overflow: hidden; }
    
    /* 운영자 툴바 */
    .op-toolbar {
      height: 46px; background: #111827; border-bottom: 1px solid #1f293d; padding: 0 14px;
      display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-shrink: 0;
    }
    .op-left { display: flex; align-items: center; gap: 8px; }
    .op-title { font-size: 13.5px; font-weight: 700; color: #f8fafc; white-space: nowrap; }
    
    /* 뷰 모드 스위처 */
    .view-switcher { display: flex; align-items: center; background: #0b0f19; border: 1px solid #1f293d; border-radius: 6px; padding: 2px; }
    .view-btn {
      background: transparent; border: none; color: #94a3b8; font-size: 11px; font-weight: 600;
      padding: 3px 7px; border-radius: 4px; cursor: pointer; transition: all 0.15s;
    }
    .view-btn.active { background: #312e81; color: #e0e7ff; }

    /* 권한 토글 */
    .perm-toggle-wrap { display: flex; align-items: center; gap: 6px; background: #0b0f19; padding: 3px 8px; border-radius: 6px; border: 1px solid #1f293d; }
    .perm-label { font-size: 11px; font-weight: 700; }
    .switch-btn { cursor: pointer; border: none; border-radius: 4px; padding: 2px 7px; font-size: 10.5px; font-weight: 700; }
    .switch-btn.active-on { background: #10b981; color: #fff; }
    .switch-btn.active-off { background: #ef4444; color: #fff; }

    /* 스플릿 캔버스 */
    .split-canvas {
      flex: 1; display: grid; overflow: hidden; height: calc(100% - 46px);
      grid-template-columns: 50% 50%;
    }
    .split-canvas.mode-70-30 { grid-template-columns: 70% 30%; }
    .split-canvas.mode-30-70 { grid-template-columns: 30% 70%; }
    .split-canvas.mode-100-0 { grid-template-columns: 100% 0%; }
    .split-canvas.mode-0-100 { grid-template-columns: 0% 100%; }

    /* 좌측 터미널 */
    .pane-terminal {
      background: #090d16; border-right: 1px solid #1f293d; display: flex; flex-direction: column; overflow: hidden; height: 100%;
    }
    .term-hd {
      height: 34px; background: #0f1523; border-bottom: 1px solid #1f293d; padding: 0 10px;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .term-dots { display: flex; gap: 5px; }
    .dot { width: 8px; height: 8px; border-radius: 50%; }
    .dot.r { background: #ef4444; } .dot.y { background: #f59e0b; } .dot.g { background: #10b981; }
    .term-hd-title { font-size: 11px; font-family: monospace; color: #94a3b8; }
    .term-body {
      flex: 1; padding: 10px 12px; overflow-y: auto; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12.5px; line-height: 1.5; color: #cbd5e1; white-space: pre-wrap; word-break: break-all;
    }
    .term-chips { display: flex; gap: 5px; padding: 6px 10px; background: #0f1523; border-top: 1px solid #1f293d; overflow-x: auto; flex-shrink: 0; }
    .chip-btn {
      background: #1e293b; border: 1px solid #334155; border-radius: 4px; padding: 2px 6px;
      font-size: 10.5px; font-family: monospace; color: #94a3b8; cursor: pointer; white-space: nowrap;
    }
    .chip-btn:hover { background: #334155; color: #fff; border-color: #6366f1; }
    .term-input-row {
      height: 40px; background: #0b0f19; border-top: 1px solid #1f293d; padding: 0 10px; display: flex; align-items: center; gap: 8px; flex-shrink: 0;
    }
    .term-prompt { color: #10b981; font-weight: 700; font-family: monospace; font-size: 12px; white-space: nowrap; }
    .term-input { flex: 1; background: transparent; border: none; outline: none; color: #fff; font-family: monospace; font-size: 12.5px; }

    /* 우측 토폴로지 & 콘솔 패널 */
    .pane-topology {
      background: #0d121f; display: flex; flex-direction: column; overflow: hidden; height: 100%;
    }
    
    /* 우측 서브탭 바 */
    .topo-tabs-bar {
      height: 38px; background: #0f1523; border-bottom: 1px solid #1f293d; padding: 0 10px;
      display: flex; align-items: center; gap: 6px; flex-shrink: 0;
    }
    .tab-btn {
      background: transparent; border: none; color: #94a3b8; font-size: 11.5px; font-weight: 600;
      padding: 6px 10px; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.15s;
    }
    .tab-btn.active { color: #818cf8; border-bottom-color: #6366f1; }
    
    .topo-tab-content { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 12px; }

    .panel-card { background: #141b2d; border: 1px solid #1f293d; border-radius: 8px; padding: 12px; }
    .panel-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .panel-title { font-size: 12.5px; font-weight: 700; color: #f8fafc; display: flex; align-items: center; gap: 6px; }

    /* 노드 그리드 */
    .node-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 10px; }
    .node-card { background: #0f1523; border: 1px solid #1f293d; border-radius: 8px; padding: 10px; }
    .node-card.not-ready { border-color: #ef4444; background: rgba(239, 68, 68, 0.05); }
    .node-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
    .node-name { font-size: 12.5px; font-weight: 700; color: #f8fafc; font-family: monospace; }
    .node-ip { font-size: 10.5px; color: #64748b; font-family: monospace; }
    .meter-row { margin-bottom: 4px; }
    .meter-label { display: flex; justify-content: space-between; font-size: 10px; color: #94a3b8; margin-bottom: 2px; }
    .meter-bar-bg { height: 5px; background: #0b0f19; border-radius: 3px; overflow: hidden; }
    .meter-bar-fill { height: 100%; border-radius: 3px; transition: width 0.3s ease; }
    .fill-green { background: #10b981; } .fill-yellow { background: #f59e0b; } .fill-red { background: #ef4444; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 6px; }
    .node-tag { font-size: 9.5px; font-family: monospace; padding: 1px 4px; border-radius: 3px; background: #1a2234; color: #cbd5e1; }
    .node-tag.taint { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); }
    .node-tag.disk { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }

    /* 테이블 */
    .sim-table { width: 100%; border-collapse: collapse; font-size: 11px; }
    .sim-table th { text-align: left; color: #64748b; font-weight: 600; padding: 4px 6px; border-bottom: 1px solid #1f293d; }
    .sim-table td { padding: 4px 6px; border-bottom: 1px solid #141b2d; font-family: monospace; color: #cbd5e1; }

    /* 모달 */
    .modal-overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 1000;
      display: none; align-items: center; justify-content: center; padding: 16px;
    }
    .modal-overlay.active { display: flex; }
    .modal {
      background: #141b2d; border: 1px solid #2a3143; border-radius: 10px;
      max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.6);
    }
    .modal h2 { font-size: 15px; margin-bottom: 4px; color: #f8fafc; }
    .modal p.desc { font-size: 12px; color: #94a3b8; margin-bottom: 14px; }
    .form-group { margin-bottom: 10px; }
    .form-group label { display: block; font-size: 11.5px; font-weight: 600; color: #cbd5e1; margin-bottom: 3px; }
    .form-control {
      width: 100%; background: #0b0f19; border: 1px solid #232d42; border-radius: 6px;
      padding: 6px 9px; color: #f8fafc; font-size: 12px; font-family: inherit;
    }
    .form-control:focus { outline: none; border-color: #6366f1; }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .modal-actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }

    ::-webkit-scrollbar { width: 5px; height: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: #232d42; border-radius: 3px; }
  </style>
</head>
<body>

  <header class="top-bar">
    <a href="/study" class="top-brand">
      <span>📖</span> KT-CI5 스터디 Hub
    </a>
    <div class="nav-actions">
      <button class="btn primary sm" onclick="openModal('create-modal')">+ 신규 랩</button>
      <a href="/study" class="btn sm">메인</a>
      <a href="/study/course/k8s" class="btn sm">☸️ K8s</a>
      <a href="/study/cheatsheet" class="btn sm">⚡ 치트시트</a>
    </div>
  </header>

  <div class="viewport-container">

    <!-- 1. 목록 뷰 -->
    <div id="view-list">
      <div class="hero-banner">
        <div>
          <h1>☸️ 쿠버네티스 상용 인프라 협업 가상 랩 콘솔</h1>
          <p>L7 로드밸런서, 도메인 연결, 하이브리드 터널, VM vCPU/RAM/디스크 Hot-Add 및 실제 상용 장애 시나리오를 시뮬레이션하고 제어합니다.</p>
        </div>
        <button class="btn primary" onclick="openModal('create-modal')">+ 새 클러스터 랩 생성</button>
      </div>
      <div class="lab-grid" id="lab-list-container"></div>
    </div>

    <!-- 2. 상세 시뮬레이터 뷰 -->
    <div id="view-detail">
      <div class="op-toolbar">
        <div class="op-left">
          <button class="btn sm" onclick="showListView()">← 목록</button>
          <span class="op-title" id="active-lab-title">기본 클러스터</span>
          <button class="btn sm primary" onclick="openAddNodeModal()">➕ VM 노드 추가</button>
          <button class="btn sm" onclick="openModal('deploy-modal')">📦 파드 배포</button>
        </div>

        <div style="display:flex; align-items:center; gap:8px;">
          <div class="view-switcher">
            <button class="view-btn active" id="btn-view-50" onclick="setViewMode('mode-50-50')">⬛ 50:50</button>
            <button class="view-btn" id="btn-view-70" onclick="setViewMode('mode-70-30')">💻 터미널 70%</button>
            <button class="view-btn" id="btn-view-30" onclick="setViewMode('mode-30-70')">📊 맵 70%</button>
            <button class="view-btn" id="btn-view-100t" onclick="setViewMode('mode-100-0')">🖥️ 터미널 전체</button>
            <button class="view-btn" id="btn-view-100m" onclick="setViewMode('mode-0-100')">📈 맵 전체</button>
          </div>

          <div class="perm-toggle-wrap">
            <span class="perm-label" id="perm-label-text">수정: ON</span>
            <button class="switch-btn active-on" id="perm-toggle-btn" onclick="togglePermission()">🔓 ON</button>
          </div>

          <button class="btn sm warning" onclick="resetActiveLab()">🔄 리셋</button>
        </div>
      </div>

      <div class="split-canvas" id="split-canvas">
        
        <!-- 좌측: 터미널 -->
        <div class="pane-terminal" id="pane-terminal">
          <div class="term-hd">
            <div class="term-dots">
              <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
            </div>
            <span class="term-hd-title" id="term-status-title">master1 (10.10.10.12) - bash</span>
            <button class="chip-btn" onclick="clearTerm()">Clear</button>
          </div>
          <div class="term-body" id="term-body"></div>
          <div class="term-chips">
            <button class="chip-btn" onclick="runChip('k get nodes -o wide')">k get nodes</button>
            <button class="chip-btn" onclick="runChip('k get pods -o wide')">k get pods</button>
            <button class="chip-btn" onclick="runChip('k get ing')">k get ing</button>
            <button class="chip-btn" onclick="runChip('df -h')">df -h (스토리지)</button>
            <button class="chip-btn" onclick="runChip('tunnel status')">tunnel status</button>
            <button class="chip-btn" onclick="runChip('curl -H &quot;Host: app.ktci5.kr&quot; http://211.252.85.10')">curl app.ktci5.kr</button>
            <button class="chip-btn" onclick="runChip('help')">help</button>
          </div>
          <div class="term-input-row">
            <span class="term-prompt" id="term-prompt">root@master1:~#</span>
            <input type="text" class="term-input" id="term-input" placeholder="명령어 입력 (예: k get nodes, df -h, tunnel status)" autocomplete="off" spellcheck="false" />
          </div>
        </div>

        <!-- 우측: 토폴로지 & 인프라 탭 콘솔 -->
        <div class="pane-topology" id="pane-topology">
          
          <div class="topo-tabs-bar">
            <button class="tab-btn active" id="tab-btn-topo" onclick="switchRightTab('topo')">📊 클러스터 & 파드</button>
            <button class="tab-btn" id="tab-btn-network" onclick="switchRightTab('network')">🌐 네트워크 & LB / 터널</button>
            <button class="tab-btn" id="tab-btn-hardware" onclick="switchRightTab('hardware')">⚙️ 하드웨어 증설 (CPU/RAM/디스크)</button>
            <button class="tab-btn" id="tab-btn-scenario" onclick="switchRightTab('scenario')">🚨 상용 시나리오 & 트러블슈팅</button>
          </div>

          <!-- 서브탭 1: 토폴로지 & 파드 -->
          <div class="topo-tab-content" id="tab-content-topo">
            <div class="panel-card">
              <div class="panel-header">
                <span class="panel-title">🎛️ 가상 트래픽 발생기 (RPS)</span>
                <span style="font-size:11px; font-family:monospace; color:#818cf8; font-weight:700;" id="traffic-val">180 req/s</span>
              </div>
              <input type="range" class="form-control" style="padding:0; height:18px; accent-color:#6366f1; cursor:pointer;" id="traffic-slider" min="0" max="3000" step="50" value="180" onchange="updateTraffic(this.value)" />
            </div>

            <div class="panel-card">
              <div class="panel-header">
                <span class="panel-title">🖥️ 인프라 VM 노드 상태</span>
                <button class="btn sm primary" onclick="openAddNodeModal()">+ 노드 추가</button>
              </div>
              <div class="node-grid" id="node-grid-container"></div>
            </div>

            <div class="panel-card">
              <div class="panel-header">
                <span class="panel-title">📦 워크로드 파드 (Pods)</span>
                <button class="btn sm" onclick="openModal('deploy-modal')">+ 파드 배포</button>
              </div>
              <div style="overflow-x:auto;">
                <table class="sim-table">
                  <thead>
                    <tr><th>NAME</th><th>NODE</th><th>STATUS</th><th>IP</th><th>IMAGE</th><th>ACTION</th></tr>
                  </thead>
                  <tbody id="pod-table-body"></tbody>
                </table>
              </div>
            </div>

            <div class="panel-card">
              <div class="panel-header"><span class="panel-title">📝 실시간 협업 감사 로그</span></div>
              <div id="activity-log-container" style="display:flex; flex-direction:column; gap:4px; max-height:100px; overflow-y:auto; font-size:10.5px; color:#94a3b8;"></div>
            </div>
          </div>

          <!-- 서브탭 2: 네트워크 & 로드밸런서 & 터널 -->
          <div class="topo-tab-content" id="tab-content-network" style="display:none;">
            <!-- L7 ALB 카드 -->
            <div class="panel-card">
              <div class="panel-header">
                <span class="panel-title">🌐 KT Cloud L7 로드밸런서 (Application Load Balancer)</span>
                <span class="status-pill status-running" id="lb-status-pill">● 헬스체크 정상</span>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:11.5px; margin-bottom:8px;">
                <div>공인 VIP: <b style="color:#818cf8;" id="lb-vip">211.252.85.10</b></div>
                <div>분산 알고리즘: <b>Round Robin</b></div>
                <div>SSL 종료: <b style="color:#10b981;">TLSv1.3 (유효함)</b></div>
                <div>헬스체크: <code>HTTP /healthz 200 OK</code></div>
              </div>
              <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:6px; padding:8px;">
                <div style="font-size:11px; color:#94a3b8; margin-bottom:4px;">🎯 타겟 풀 헬스체크 (Target Pool)</div>
                <div id="lb-target-pool-list" style="display:flex; flex-direction:column; gap:4px;"></div>
              </div>
            </div>

            <!-- Ingress & 도메인 바인딩 카드 -->
            <div class="panel-card">
              <div class="panel-header">
                <span class="panel-title">🏷️ Ingress 도메인 라우팅 (Host-based Routing)</span>
                <button class="btn sm" onclick="openModal('domain-modal')">+ 도메인 추가</button>
              </div>
              <div style="overflow-x:auto;">
                <table class="sim-table">
                  <thead><tr><th>도메인 (HOST)</th><th>경로 (PATH)</th><th>타겟 서비스</th><th>SSL</th><th>테스트</th></tr></thead>
                  <tbody id="domain-table-body"></tbody>
                </table>
              </div>
            </div>

            <!-- 하이브리드 터널링 카드 -->
            <div class="panel-card">
              <div class="panel-header">
                <span class="panel-title">🚇 Cloudflare 하이브리드 터널 (WireGuard/Argo Mesh)</span>
                <button class="btn sm" onclick="toggleTunnelStatus()" id="tunnel-toggle-btn">터널 토글</button>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:11.5px;">
                <div>터널 상태: <b id="tunnel-status-text" style="color:#10b981;">● CONNECTED</b></div>
                <div>왕복 지연시간: <b id="tunnel-latency">3.5 ms</b></div>
                <div>대역폭: <b id="tunnel-throughput">480 Mbps</b></div>
                <div>암호화: <b>ChaCha20-Poly1305</b></div>
              </div>
            </div>
          </div>

          <!-- 서브탭 3: 하드웨어 증설 (CPU/RAM/디스크) -->
          <div class="topo-tab-content" id="tab-content-hardware" style="display:none;">
            <div class="panel-card">
              <div class="panel-header">
                <span class="panel-title">⚙️ 가상머신(VM) 사양 동적 증설 (Hot-Add vCPU / RAM / Disk)</span>
              </div>
              <p style="font-size:11.5px; color:#94a3b8; margin-bottom:12px;">재부팅 없이 실시간으로 노드의 vCPU 코어, RAM 용량을 확장하거나 가상 블록 스토리지 디스크(PV)를 Hot-Add 마운트합니다.</p>
              <div id="hardware-nodes-list" style="display:flex; flex-direction:column; gap:10px;"></div>
            </div>
          </div>

          <!-- 서브탭 4: 상용 시나리오 & 트러블슈팅 -->
          <div class="topo-tab-content" id="tab-content-scenario" style="display:none;">
            <div class="panel-card">
              <div class="panel-header">
                <span class="panel-title">🚨 실제 상용 환경 장애 & 트러블슈팅 시뮬레이터</span>
                <button class="btn sm primary" onclick="triggerScenario('resolve_all')">✅ 모든 장애 복구</button>
              </div>
              <p style="font-size:11.5px; color:#94a3b8; margin-bottom:12px;">상용 서비스 현업에서 빈번하게 발생하는 장애 상황을 원클릭으로 주입하고 클러스터의 반응과 해결 절차를 체득합니다.</p>

              <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                <!-- 시나리오 1 -->
                <div style="background:#0f1523; border:1px solid #1f293d; border-radius:6px; padding:10px;">
                  <div style="font-size:12px; font-weight:700; color:#f87171; margin-bottom:4px;">🔥 1. 노드 디스크 고갈 (DiskPressure)</div>
                  <p style="font-size:11px; color:#94a3b8; margin-bottom:8px;">워커 노드 디스크가 96% 고갈되어 K8s가 파드 축출 및 스케줄링 중단 상태에 빠집니다.</p>
                  <button class="btn sm danger" onclick="triggerScenario('disk_pressure')">디스크 고갈 장애 유발</button>
                </div>

                <!-- 시나리오 2 -->
                <div style="background:#0f1523; border:1px solid #1f293d; border-radius:6px; padding:10px;">
                  <div style="font-size:12px; font-weight:700; color:#fbbf24; margin-bottom:4px;">⚡ 2. L7 로드밸런서 페일오버</div>
                  <p style="font-size:11px; color:#94a3b8; margin-bottom:8px;">타겟 파드 하나가 503 에러를 뿜을 때 LB가 헬스체크로 감지하고 정상 파드로 즉시 트래픽을 우회합니다.</p>
                  <button class="btn sm warning" onclick="triggerScenario('lb_failover')">LB 페일오버 테스트</button>
                </div>

                <!-- 시나리오 3 -->
                <div style="background:#0f1523; border:1px solid #1f293d; border-radius:6px; padding:10px;">
                  <div style="font-size:12px; font-weight:700; color:#f87171; margin-bottom:4px;">🚇 3. 하이브리드 터널 단절</div>
                  <p style="font-size:11px; color:#94a3b8; margin-bottom:8px;">온프레미스와 KT Cloud 간 연결 터널이 끊겨 외부 도메인 접속이 502 타임아웃에 빠집니다.</p>
                  <button class="btn sm danger" onclick="triggerScenario('tunnel_cut')">터널 단절 유발</button>
                </div>

                <!-- 시나리오 4 -->
                <div style="background:#0f1523; border:1px solid #1f293d; border-radius:6px; padding:10px;">
                  <div style="font-size:12px; font-weight:700; color:#10b981; margin-bottom:4px;">🔄 4. 무중단 롤링 업데이트</div>
                  <p style="font-size:11px; color:#94a3b8; margin-bottom:8px;">서비스 무중단으로 신규 컨테이너 이미지를 단계적으로 교체하며 파드 롤아웃을 관찰합니다.</p>
                  <button class="btn sm primary" onclick="triggerScenario('rolling_update')">롤링 업데이트 시작</button>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>

  </div>

  <!-- 모달 1: 신규 랩 생성 -->
  <div class="modal-overlay" id="create-modal">
    <div class="modal">
      <h2>➕ 신규 실습 랩 클러스터 생성</h2>
      <p class="desc">가상 노드 수와 자원 할당량을 지정하여 새로운 실습 환경을 생성합니다.</p>
      <form onsubmit="handleCreateLab(event)">
        <div class="form-group">
          <label>실습 랩 제목</label>
          <input type="text" class="form-control" id="form-title" placeholder="예: 3조 상용 인프라 및 LB 페일오버 실습" required />
        </div>
        <div class="form-group">
          <label>실습 설명</label>
          <input type="text" class="form-control" id="form-desc" placeholder="실습 목적 및 아키텍처 메모" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>워커 노드 수</label>
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
          <label class="checkbox-label"><input type="checkbox" id="form-editable" checked /> 다른 수강생과 수정 권한 공유 허용 (ON)</label>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn sm" onclick="closeModal('create-modal')">취소</button>
          <button type="submit" class="btn sm primary">저장하고 입장</button>
        </div>
      </form>
    </div>
  </div>

  <!-- 모달 2: VM 노드 추가 -->
  <div class="modal-overlay" id="add-node-modal">
    <div class="modal">
      <h2>🖥️ 새 워커 노드(VM) 프로비저닝</h2>
      <p class="desc">클러스터에 새 가상머신 워커 노드를 즉시 추가하고 자원을 확장합니다.</p>
      <form onsubmit="handleAddNode(event)">
        <div class="form-row">
          <div class="form-group"><label>호스트명</label><input type="text" class="form-control" id="node-form-name" required /></div>
          <div class="form-group"><label>사설 IP</label><input type="text" class="form-control" id="node-form-ip" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>vCPU 용량</label><select class="form-control" id="node-form-cpu"><option value="2000">2 Core</option><option value="4000">4 Core</option><option value="8000">8 Core</option></select></div>
          <div class="form-group"><label>RAM 용량</label><select class="form-control" id="node-form-ram"><option value="4096">4 GiB</option><option value="8192">8 GiB</option></select></div>
        </div>
        <div class="form-group"><label>스토리지 타입</label><select class="form-control" id="node-form-disk"><option value="ssd">NVMe SSD (초고속)</option><option value="hdd">Standard HDD</option></select></div>
        <div class="modal-actions">
          <button type="button" class="btn sm" onclick="closeModal('add-node-modal')">취소</button>
          <button type="submit" class="btn sm primary">노드 프로비저닝</button>
        </div>
      </form>
    </div>
  </div>

  <!-- 모달 3: 파드 배포 -->
  <div class="modal-overlay" id="deploy-modal">
    <div class="modal">
      <h2>📦 새 파드 / 디플로이먼트 배포</h2>
      <p class="desc">GUI 폼으로 워크로드를 정의하고 스케줄링 배포합니다.</p>
      <form onsubmit="handleDeployWorkload(event)">
        <div class="form-group"><label>워크로드 명칭</label><input type="text" class="form-control" id="deploy-form-name" placeholder="예: order-service" required /></div>
        <div class="form-row">
          <div class="form-group"><label>이미지</label><input type="text" class="form-control" id="deploy-form-image" value="nginx:1.25" required /></div>
          <div class="form-group"><label>레플리카(Pod 수)</label><input type="number" class="form-control" id="deploy-form-replicas" min="1" max="10" value="2" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>CPU Request</label><select class="form-control" id="deploy-form-cpu"><option value="100">100m</option><option value="200">200m</option><option value="500">500m</option></select></div>
          <div class="form-group"><label>노드 타겟 (nodeSelector)</label><select class="form-control" id="deploy-form-disk"><option value="">조건 없음</option><option value="ssd">disktype=ssd</option><option value="hdd">disktype=hdd</option></select></div>
        </div>
        <div class="form-group"><label class="checkbox-label"><input type="checkbox" id="deploy-form-nodeport" checked /> NodePort 서비스 동시 생성</label></div>
        <div class="modal-actions">
          <button type="button" class="btn sm" onclick="closeModal('deploy-modal')">취소</button>
          <button type="submit" class="btn sm primary">배포하기</button>
        </div>
      </form>
    </div>
  </div>

  <!-- 모달 4: 도메인 추가 -->
  <div class="modal-overlay" id="domain-modal">
    <div class="modal">
      <h2>🌐 Ingress 도메인 연결 바인딩</h2>
      <p class="desc">L7 로드밸런서에 새 서브도메인을 연결하고 타겟 서비스로 라우팅합니다.</p>
      <form onsubmit="handleAddDomain(event)">
        <div class="form-group"><label>도메인 (FQDN)</label><input type="text" class="form-control" id="domain-form-host" placeholder="예: shop.ktci5.kr, admin.ktci5.kr" required /></div>
        <div class="form-group"><label>타겟 서비스</label><input type="text" class="form-control" id="domain-form-svc" value="web-service:80" required /></div>
        <div class="modal-actions">
          <button type="button" class="btn sm" onclick="closeModal('domain-modal')">취소</button>
          <button type="submit" class="btn sm primary">도메인 매핑</button>
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

    // 1. 뷰 모드
    function setViewMode(modeClass) {
      document.getElementById('split-canvas').className = 'split-canvas ' + modeClass;
      document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
      if (modeClass === 'mode-50-50') document.getElementById('btn-view-50').classList.add('active');
      if (modeClass === 'mode-70-30') document.getElementById('btn-view-70').classList.add('active');
      if (modeClass === 'mode-30-70') document.getElementById('btn-view-30').classList.add('active');
      if (modeClass === 'mode-100-0') document.getElementById('btn-view-100t').classList.add('active');
      if (modeClass === 'mode-0-100') document.getElementById('btn-view-100m').classList.add('active');
      localStorage.setItem('k8s_view_mode', modeClass);
    }
    const savedMode = localStorage.getItem('k8s_view_mode');
    if (savedMode) setViewMode(savedMode);

    // 2. 우측 서브탭 전환
    function switchRightTab(tabId) {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.topo-tab-content').forEach(c => c.style.display = 'none');
      document.getElementById('tab-btn-' + tabId).classList.add('active');
      document.getElementById('tab-content-' + tabId).style.display = 'flex';
    }

    function openModal(id) { document.getElementById(id).classList.add('active'); }
    function closeModal(id) { document.getElementById(id).classList.remove('active'); }
    function openAddNodeModal() {
      if (!currentLab) return;
      const nextNum = (currentLab.nodes?.length || 1);
      document.getElementById('node-form-name').value = 'w' + nextNum;
      document.getElementById('node-form-ip').value = '10.10.10.' + (20 + (nextNum - 1) * 10);
      openModal('add-node-modal');
    }

    // 3. 랩 목록
    async function loadLabs() {
      try {
        const res = await fetch('/api/simulator/labs');
        const data = await res.json();
        if (data.ok && data.labs) {
          labList = data.labs;
          renderLabList(labList);
        }
      } catch (err) { console.error('loadLabs error:', err); }
    }

    function renderLabList(labs) {
      const container = document.getElementById('lab-list-container');
      if (!labs || labs.length === 0) {
        container.innerHTML = '<p style="color:#64748b;">등록된 실습 랩이 없습니다.</p>';
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

    // 4. 랩 입장 & 렌더링
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
      } catch (err) { alert('실습 랩 로드 실패: ' + err.message); }
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
      renderAll(lab);

      const termBody = document.getElementById('term-body');
      termBody.innerHTML = \`<span style="color:#6366f1;">========================================================================</span>\\n\` +
        \`<span style="color:#10b981;font-weight:700;">☸️ KT Cloud 상용 인프라 & 가상 쿠버네티스 콘솔</span>\\n\` +
        \`클러스터: <b>\${escapeHtml(lab.title)}</b> (접속자: <b>\${currentUser}</b>)\\n\` +
        \`L7 로드밸런서 VIP: <b>\${lab.network?.loadBalancer?.vip || '211.252.85.10'}</b> | 도메인: <b>app.ktci5.kr</b>\\n\` +
        \`우측 상단 탭에서 <b>네트워크 & LB</b>, <b>vCPU/RAM/디스크 증설</b>, <b>상용 장애 시나리오</b> 제어가 가능합니다.\\n\` +
        \`<span style="color:#6366f1;">========================================================================</span>\\n\\n\`;
    }

    function updatePermissionUI(editable) {
      const btn = document.getElementById('perm-toggle-btn');
      const label = document.getElementById('perm-label-text');
      const prompt = document.getElementById('term-prompt');
      if (editable) {
        btn.className = 'switch-btn active-on';
        btn.innerText = '🔓 ON';
        label.innerText = '수정: ON';
        label.style.color = '#34d399';
        prompt.innerText = 'root@master1:~#';
        prompt.style.color = '#10b981';
      } else {
        btn.className = 'switch-btn active-off';
        btn.innerText = '🔒 OFF';
        label.innerText = '수정: OFF';
        label.style.color = '#f87171';
        prompt.innerText = 'root@master1:~# (read-only)';
        prompt.style.color = '#f59e0b';
      }
    }

    async function togglePermission() {
      if (!currentLab) return;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/permission\`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ editable: !currentLab.editable })
        });
        const data = await res.json();
        if (data.ok) {
          currentLab.editable = data.editable;
          updatePermissionUI(currentLab.editable);
        }
      } catch (err) { alert('권한 토글 실패: ' + err.message); }
    }

    // 5. 전체 렌더링
    function renderAll(lab) {
      if (!lab) return;
      document.getElementById('traffic-slider').value = lab.trafficRps || 0;
      document.getElementById('traffic-val').innerText = (lab.trafficRps || 0) + ' req/s';

      // 1) 노드 카드
      document.getElementById('node-grid-container').innerHTML = (lab.nodes || []).map(node => {
        const hosted = (lab.pods || []).filter(p => p.node === node.name && p.status === 'Running');
        const baseCpu = 180 + hosted.length * 80;
        const trafficCpu = Math.round(((lab.trafficRps || 0) / 3000) * 800);
        const cpuM = Math.min(node.cpuTotalM, baseCpu + trafficCpu);
        const cpuPct = Math.round((cpuM / node.cpuTotalM) * 100);

        const ramMi = 1400 + hosted.length * 150;
        const ramPct = Math.round((ramMi / node.ramTotalMi) * 100);

        const cpuColor = cpuPct > 80 ? 'fill-red' : cpuPct > 60 ? 'fill-yellow' : 'fill-green';
        const ramColor = ramPct > 80 ? 'fill-red' : ramPct > 60 ? 'fill-yellow' : 'fill-green';

        const osDisk = node.disks?.[0];
        const isDiskPressure = osDisk && (osDisk.usedGb / osDisk.sizeGb) > 0.90;

        const taintsHtml = (node.taints || []).map(t => \`<span class="node-tag taint">\${t.key.split('/').pop()}:\${t.effect}</span>\`).join('');
        const labelsHtml = Object.entries(node.labels || {}).filter(([k]) => !k.includes('kubernetes.io')).map(([k, v]) => \`<span class="node-tag">\${k}=\${v}</span>\`).join('');
        const disksHtml = (node.disks || []).map(d => \`<span class="node-tag disk">💽 \${d.name}: \${d.usedGb}/\${d.sizeGb}G</span>\`).join('');

        const isMaster = node.role === 'control-plane';
        const hasTaint = node.taints && node.taints.length > 0;

        return \`
          <div class="node-card \${(node.status !== 'Ready' || isDiskPressure) ? 'not-ready' : ''}">
            <div class="node-top">
              <span class="node-name">🖥️ \${node.name}</span>
              <span class="status-pill \${(node.status === 'Ready' && !isDiskPressure) ? 'status-running' : 'status-pending'}">
                \${isDiskPressure ? 'DiskPressure' : node.status}\${node.unschedulable ? ',NoSched' : ''}
              </span>
            </div>
            <div style="font-size:10.5px; color:#64748b; font-family:monospace; margin-bottom:5px;">IP: \${node.ip}</div>
            
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
              \${disksHtml}
            </div>

            <div style="display:flex; gap:4px; margin-top:8px; border-top:1px solid #1f293d; padding-top:6px;">
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

      // 2) 파드 테이블
      document.getElementById('pod-table-body').innerHTML = (lab.pods || []).map(pod => \`
        <tr>
          <td style="color:#f8fafc; font-weight:600;">\${escapeHtml(pod.name)}</td>
          <td>\${pod.node}</td>
          <td><span class="status-pill \${pod.status === 'Running' ? 'status-running' : 'status-pending'}">\${pod.status}</span></td>
          <td>\${pod.ip}</td>
          <td>\${pod.image}</td>
          <td><button class="chip-btn" onclick="executeCommand('k delete pod \${pod.name}')" style="color:#f87171;">삭제</button></td>
        </tr>
      \`).join('');

      // 3) 감사 피드
      document.getElementById('activity-log-container').innerHTML = (lab.activityLogs || []).slice(0, 15).map(l => \`
        <div><span style="color:#64748b;">\${l.time}</span> <span style="color:#818cf8; font-weight:600;">[\${escapeHtml(l.user)}]</span> \${escapeHtml(l.action)}</div>
      \`).join('');

      // 4) 네트워크 탭 렌더링
      const net = lab.network || createDefaultNetwork();
      document.getElementById('lb-vip').innerText = net.loadBalancer?.vip || '211.252.85.10';
      const poolList = document.getElementById('lb-target-pool-list');
      poolList.innerHTML = (net.loadBalancer?.targetPool || []).map(p => {
        const isH = p.status.includes('Healthy');
        return \`<div style="display:flex; justify-content:space-between; font-size:11px;">
          <span>• \${p.target}</span>
          <span style="color:\${isH ? '#10b981' : '#f87171'}; font-weight:bold;">\${p.status} (\${p.latencyMs}ms)</span>
        </div>\`;
      }).join('');

      document.getElementById('domain-table-body').innerHTML = (net.ingress?.rules || []).map(r => \`
        <tr>
          <td style="color:#818cf8; font-weight:700;">\${r.host}</td>
          <td>\${r.path}</td>
          <td>\${r.service}</td>
          <td><span style="color:#10b981;">TLS Valid</span></td>
          <td><button class="chip-btn" onclick="runChip('curl -H &quot;Host: \${r.host}&quot; http://\${net.loadBalancer?.vip}')">호출 테스트</button></td>
        </tr>
      \`).join('');

      const isTunnelOk = net.tunnel?.status === 'CONNECTED';
      const tText = document.getElementById('tunnel-status-text');
      tText.innerText = isTunnelOk ? '● CONNECTED' : '● DISCONNECTED';
      tText.style.color = isTunnelOk ? '#10b981' : '#ef4444';
      document.getElementById('tunnel-latency').innerText = isTunnelOk ? (net.tunnel?.latencyMs + ' ms') : 'Timeout';
      document.getElementById('tunnel-throughput').innerText = isTunnelOk ? (net.tunnel?.throughputMbps + ' Mbps') : '0 Mbps';
      document.getElementById('tunnel-toggle-btn').innerText = isTunnelOk ? '터널 단절 시뮬레이션' : '터널 재연결';

      // 5) 하드웨어 탭 렌더링
      document.getElementById('hardware-nodes-list').innerHTML = (lab.nodes || []).map(node => \`
        <div style="background:#0f1523; border:1px solid #1f293d; border-radius:6px; padding:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-weight:700; color:#f8fafc; font-family:monospace;">🖥️ \${node.name} (\${node.ip})</span>
            <span style="font-size:11px; color:#94a3b8;">현재: \${node.cpuTotalM / 1000} Core / \${node.ramTotalMi / 1024} GiB</span>
          </div>

          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
            <!-- vCPU Hot-Add -->
            <div style="display:flex; align-items:center; gap:4px; font-size:11.5px;">
              <span>vCPU:</span>
              <button class="chip-btn \${node.cpuTotalM === 2000 ? 'primary' : ''}" onclick="scaleHardware('\${node.name}', 2000, null)">2C</button>
              <button class="chip-btn \${node.cpuTotalM === 4000 ? 'primary' : ''}" onclick="scaleHardware('\${node.name}', 4000, null)">4C</button>
              <button class="chip-btn \${node.cpuTotalM === 8000 ? 'primary' : ''}" onclick="scaleHardware('\${node.name}', 8000, null)">8C</button>
            </div>

            <!-- RAM Hot-Add -->
            <div style="display:flex; align-items:center; gap:4px; font-size:11.5px;">
              <span>RAM:</span>
              <button class="chip-btn \${node.ramTotalMi === 4096 ? 'primary' : ''}" onclick="scaleHardware('\${node.name}', null, 4096)">4G</button>
              <button class="chip-btn \${node.ramTotalMi === 8192 ? 'primary' : ''}" onclick="scaleHardware('\${node.name}', null, 8192)">8G</button>
              <button class="chip-btn \${node.ramTotalMi === 16384 ? 'primary' : ''}" onclick="scaleHardware('\${node.name}', null, 16384)">16G</button>
            </div>

            <!-- 디스크 추가 -->
            <button class="chip-btn" style="background:#312e81; color:#c7d2fe;" onclick="addDiskToNode('\${node.name}')">💽 + 100GB SSD 디스크 Hot-Add</button>
          </div>

          <!-- 디스크 목록 -->
          <div style="font-size:10.5px; color:#64748b; font-family:monospace;">
            마운트 디스크: \${(node.disks || []).map(d => \`\${d.name}: \${d.sizeGb}GB (\${d.mount})\`).join(', ')}
          </div>
        </div>
      \`).join('');
    }

    // 6. 하드웨어 스펙 조정 API
    async function scaleHardware(nodeName, cpu, ram) {
      if (!currentLab) return;
      try {
        const body = {};
        if (cpu) body.cpu = cpu;
        if (ram) body.ram = ram;
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/nodes/\${nodeName}/hardware\`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.ok) {
          currentLab = data.lab;
          renderAll(currentLab);
        }
      } catch (err) { alert('하드웨어 조정 실패: ' + err.message); }
    }

    async function addDiskToNode(nodeName) {
      if (!currentLab) return;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/nodes/\${nodeName}/hardware\`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ addDisk: { sizeGb: 100, type: 'NVMe SSD', mount: '/mnt/storage' } })
        });
        const data = await res.json();
        if (data.ok) {
          currentLab = data.lab;
          renderAll(currentLab);
          appendTermLog(\`\\n<span style="color:#10b981;font-weight:700;">💽 [Storage Hot-Add] 노드 '\${nodeName}'에 100GB NVMe SSD 디스크가 마운트되었습니다.</span>\\n\`);
        }
      } catch (err) { alert('디스크 추가 실패: ' + err.message); }
    }

    // 7. 네트워크 및 터널 API
    async function toggleTunnelStatus() {
      if (!currentLab) return;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/network\`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ toggleTunnel: true })
        });
        const data = await res.json();
        if (data.ok) {
          currentLab = data.lab;
          renderAll(currentLab);
        }
      } catch (err) { alert('터널 변경 실패: ' + err.message); }
    }

    async function handleAddDomain(e) {
      e.preventDefault();
      if (!currentLab) return;
      const host = document.getElementById('domain-form-host').value.trim();
      const svc = document.getElementById('domain-form-svc').value.trim();
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/network\`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ addDomain: { host, service: svc } })
        });
        const data = await res.json();
        if (data.ok) {
          closeModal('domain-modal');
          currentLab = data.lab;
          renderAll(currentLab);
          appendTermLog(\`\\n<span style="color:#10b981;font-weight:700;">🌐 [Ingress Binding] 도메인 '\${host}'이(가) 서비스 '\${svc}'에 매핑되었습니다.</span>\\n\`);
        }
      } catch (err) { alert('도메인 추가 실패: ' + err.message); }
    }

    // 8. 상용 시나리오 주입
    async function triggerScenario(type) {
      if (!currentLab) return;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/scenario\`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type })
        });
        const data = await res.json();
        if (data.ok) {
          currentLab = data.lab;
          renderAll(currentLab);
          appendTermLog(\`\\n<span style="color:#f59e0b;font-weight:700;">⚡ [상용 시나리오 이벤트 적용: \${type}]</span>\\n\`);
        }
      } catch (err) { alert('시나리오 실행 실패: ' + err.message); }
    }

    // 9. 터미널 명령 실행
    const termInput = document.getElementById('term-input');
    termInput.addEventListener('keydown', async function(e) {
      if (e.key === 'Enter') {
        const cmd = termInput.value.trim();
        if (!cmd) return;
        commandHistory.push(cmd);
        historyIdx = commandHistory.length;
        termInput.value = '';

        if (cmd === 'clear') { clearTerm(); return; }

        appendTermLog(\`\\n<span style="color:#10b981;font-weight:700;">\${document.getElementById('term-prompt').innerText}</span> \${escapeHtml(cmd)}\\n\`);
        await executeCommand(cmd);
      } else if (e.key === 'ArrowUp') {
        if (historyIdx > 0) { historyIdx--; termInput.value = commandHistory[historyIdx] || ''; }
      } else if (e.key === 'ArrowDown') {
        if (historyIdx < commandHistory.length - 1) { historyIdx++; termInput.value = commandHistory[historyIdx] || ''; }
        else { historyIdx = commandHistory.length; termInput.value = ''; }
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
          if (data.output) appendTermLog(formatAnsi(data.output) + '\\n');
          if (data.labChanged && data.lab) {
            currentLab = data.lab;
            renderAll(currentLab);
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

    // 10. 노드 추가 및 삭제
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
          renderAll(currentLab);
          appendTermLog(\`\\n<span style="color:#10b981;font-weight:700;">🖥️ 새 워커 노드 VM '\${name}'이 클러스터에 프로비저닝되었습니다.</span>\\n\`);
        } else { alert('추가 실패: ' + data.error); }
      } catch (err) { alert('노드 추가 오류: ' + err.message); }
    }

    async function deleteNode(nodeName) {
      if (!currentLab || !confirm(\`노드 '\${nodeName}'을(를) 삭제 및 반납하시겠습니까?\`)) return;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/nodes/\${nodeName}\`, { method: 'DELETE' });
        const data = await res.json();
        if (data.ok) {
          currentLab = data.lab;
          renderAll(currentLab);
        } else { alert(data.error); }
      } catch (err) { alert('삭제 오류: ' + err.message); }
    }

    // 11. 파드 배포
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
          renderAll(currentLab);
          appendTermLog(\`\\n<span style="color:#10b981;font-weight:700;">📦 워크로드 '\${name}' 배포 완료</span>\\n\`);
        } else { alert(data.error); }
      } catch (err) { alert('배포 오류: ' + err.message); }
    }

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

    async function resetActiveLab() {
      if (!currentLab || !confirm('클러스터를 초기 상태로 리셋하시겠습니까?')) return;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/reset\`, { method: 'POST' });
        const data = await res.json();
        if (data.ok) {
          currentLab = data.lab;
          renderAll(currentLab);
          appendTermLog('\\n<span style="color:#f59e0b;font-weight:700;">🔄 클러스터가 성공적으로 초기화되었습니다.</span>\\n');
        }
      } catch (err) { alert('리셋 오류: ' + err.message); }
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
          body: JSON.stringify({ title, description: desc, workerCount, cpuPerNode: cpu, editable })
        });
        const data = await res.json();
        if (data.ok && data.lab) {
          closeModal('create-modal');
          openLab(data.lab.id);
        }
      } catch (err) { alert('생성 오류: ' + err.message); }
    }

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
              renderAll(currentLab);
            }
          }
        } catch (e) {}
      }, 2500);
    }

    function stopPolling() {
      if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
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
