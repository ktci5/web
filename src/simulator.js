/**
 * 쿠버네티스 협업 가상 랩 & 상용 인프라 운영 콘솔 — /study/simulator
 *
 * 1. 화면 짤림 방지 반응형 뷰포트 레이아웃 & 5가지 분할 뷰 모드
 * 2. 네트워크 엔지니어링: L7 로드밸런서(VIP/헬스체크), 도메인/Ingress 바인딩, 하이브리드 터널(Argo/WireGuard)
 * 3. 서버 하드웨어 확장: vCPU Hot-Add, RAM 동적 증설, 가상 디스크(Block Storage/PV/PVC) 추가
 * 4. 상용 트러블슈팅 시나리오: 디스크 고갈(DiskPressure), LB 페일오버, 터널 단절, OOMKilled
 */

export const SIMULATOR_TITLE = 'K8s 상용 인프라 & 협업 가상 랩 콘솔';

// 기본 네트워크 템플릿 (OSI 7단계 레이어 및 VPN, 터널, 로드밸런싱, 라우터, 스위치, 허브 통합)
function createDefaultNetwork() {
  return {
    layers: {
      l7_application: { name: 'L7 응용 계층', status: 'ACTIVE', desc: '도메인 라우팅, SSL/TLS Ingress & HTTP 리버스 프록시' },
      l6_presentation: { name: 'L6 표현 계층', status: 'ACTIVE', desc: 'TLS 1.3 암호화/복호화 (Let\'s Encrypt Valid), gzip 압축' },
      l5_session: { name: 'L5 세션 계층', status: 'ACTIVE', desc: 'WireGuard Mesh / Cloudflare Argo Session Keep-Alive' },
      l4_transport: { name: 'L4 전송 계층', status: 'ACTIVE', desc: 'TCP 포트 포워딩 (VIP:80, VIP:443 ➔ NodePort:30080)' },
      l3_network: { name: 'L3 네트워크 계층', status: 'ACTIVE', desc: '가상 라우터 (vRouter) CIDR 10.10.0.0/16 ➔ 172.20.0.0/16 NAT' },
      l2_datalink: { name: 'L2 데이터링크 계층', status: 'ACTIVE', desc: 'L2 가상 브릿지 스위치 (vSwitch VLAN 100), MAC 테이블' },
      l1_physical: { name: 'L1 물리 계층', status: 'ACTIVE', desc: '가상 허브 포트 (10Gbps Virtual NIC Link Up)' }
    },
    vpn: {
      name: 'kt-corp-ipsec-vpn',
      type: 'IPsec / WireGuard Site-to-Site VPN',
      status: 'CONNECTED', // 'CONNECTED' | 'DISCONNECTED'
      clientSubnet: '192.168.100.0/24',
      serverEndpoint: 'vpn.ktci5.kr:51820',
      connectedClients: 8,
      throughputMbps: 120,
      latencyMs: 4.2
    },
    tunnel: {
      name: 'kt-hybrid-argo-tunnel',
      provider: 'Cloudflare Tunnel (argo) / WireGuard Mesh',
      status: 'CONNECTED', // 'CONNECTED' | 'DISCONNECTED'
      endpoint: 'tunnel.ktci5.kr ➔ 10.10.10.12 (KT Cloud DBO)',
      throughputMbps: 480,
      latencyMs: 3.5,
      encryption: 'ChaCha20-Poly1305'
    },
    loadBalancer: {
      name: 'kt-cloud-alb-01',
      vip: '211.252.85.10',
      type: 'KT Cloud L7 Application Load Balancer',
      status: 'Healthy',
      algorithm: 'RoundRobin', // 'RoundRobin' | 'LeastConnection' | 'IPHash'
      ssl: 'TLSv1.3 (Let\'s Encrypt Valid)',
      targetPool: [
        { target: '10.10.10.20:30080', status: 'Healthy', latencyMs: 2.1, weight: 50 },
        { target: '10.10.10.12:30080', status: 'Healthy', latencyMs: 1.8, weight: 50 }
      ]
    },
    ingress: {
      domain: 'ktci5.kr',
      rules: [
        { host: 'app.ktci5.kr', path: '/', port: 80, targetPort: 80, service: 'web-service:80', ssl: true, protocol: 'HTTP/1.1 & HTTP/2' },
        { host: 'api.ktci5.kr', path: '/api', port: 80, targetPort: 8080, service: 'api-service:8080', ssl: true, protocol: 'HTTP/1.1 & HTTP/2' },
        { host: 'dev.ktci5.kr', path: '/', port: 443, targetPort: 8080, service: 'dev-service:8080', ssl: true, protocol: 'HTTPS (TLS1.3)' }
      ]
    },
    router: {
      name: 'kt-vrouter-core-01',
      cidr: '10.10.0.0/16',
      gateway: '10.10.0.1',
      status: 'ONLINE',
      routes: [
        { dest: '0.0.0.0/0', nextHop: '211.252.85.1', iface: 'eth0 (Internet)' },
        { dest: '10.10.10.0/24', nextHop: 'DIRECT', iface: 'eth1 (VLAN100-Nodes)' },
        { dest: '172.20.0.0/16', nextHop: '10.10.10.12', iface: 'eth2 (Overlay-Calico)' }
      ]
    },
    switch: {
      name: 'kt-vswitch-dist-01',
      type: 'Managed L2 Open vSwitch',
      vlan: 100,
      status: 'FORWARDING',
      ports: [
        { port: 1, node: 'master1', ip: '10.10.10.12', mac: '52:54:00:12:34:56', speed: '10Gbps', state: 'UP' },
        { port: 2, node: 'w1', ip: '10.10.10.20', mac: '52:54:00:12:34:57', speed: '10Gbps', state: 'UP' }
      ]
    },
    hub: {
      name: 'kt-l1-virtual-hub',
      status: 'LINK_UP',
      broadcastDomain: 'br-nodes-broadcast',
      collisions: 0,
      signalStrengthPct: 100
    }
  };
}

// L7 로드밸런서 타겟 풀 및 vSwitch 포트 자동 동기화
export function syncLbTargetPool(lab) {
  if (!lab) return;
  if (!lab.network) lab.network = createDefaultNetwork();
  if (!lab.network.loadBalancer) lab.network.loadBalancer = createDefaultNetwork().loadBalancer;
  const lb = lab.network.loadBalancer;
  const nodes = lab.nodes || [];
  if (!lb.targetPool) lb.targetPool = [];

  const existingPool = lb.targetPool;
  const newPool = [];

  nodes.forEach((n, idx) => {
    const targetAddr = `${n.ip}:30080`;
    const prev = existingPool.find((p) => p.target === targetAddr || p.nodeName === n.name);
    let status = prev ? prev.status : 'Healthy';
    if (n.status !== 'Ready' || n.unschedulable) {
      status = 'Unhealthy (503 Error)';
    }
    newPool.push({
      target: targetAddr,
      nodeName: n.name,
      status: status,
      latencyMs: prev ? prev.latencyMs : parseFloat((1.5 + (idx * 0.3)).toFixed(1)),
      weight: Math.round(100 / (nodes.length || 1))
    });
  });

  lb.targetPool = newPool;

  // L2 가상 스위치 포트 동기화
  if (lab.network.switch) {
    lab.network.switch.ports = nodes.map((n, idx) => ({
      port: idx + 1,
      node: n.name,
      ip: n.ip,
      mac: `52:54:00:12:34:${(56 + idx).toString(16).padStart(2, '0')}`,
      speed: '10Gbps',
      state: n.status === 'Ready' ? 'UP' : 'DOWN'
    }));
  }
}

// 기본 제공 시드 랩
export const DEFAULT_LABS = [
  {
    id: 'default',
    title: '상용 2노드 클러스터 & 웹 인프라 환경',
    description: '마스터(10.10.10.12) & 워커(10.10.20), KT Cloud L7 로드밸런서(VIP 211.252.85.10), 실등록 도메인(app.ktci5.kr, dev.ktci5.kr) 및 터널이 연결된 상용 환경',
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
      },
      {
        name: 'api-deploy-77d9c8d55-p2w9k',
        namespace: 'default',
        node: 'w1',
        status: 'Running',
        ip: '172.20.1.9',
        image: 'python:3.11-alpine',
        cpuReqM: 100,
        ramReqMi: 128,
        labels: { app: 'api' },
        restarts: 0,
        age: '1d'
      },
      {
        name: 'dev-deploy-69f84b77-m8q2z',
        namespace: 'default',
        node: 'w1',
        status: 'Running',
        ip: '172.20.1.10',
        image: 'node:20-alpine',
        cpuReqM: 100,
        ramReqMi: 128,
        labels: { app: 'dev' },
        restarts: 0,
        age: '1d'
      }
    ],
    deployments: [
      {
        name: 'web-deploy',
        replicas: 2,
        image: 'nginx:1.25',
        labels: { app: 'web' }
      },
      {
        name: 'api-deploy',
        replicas: 1,
        image: 'python:3.11-alpine',
        labels: { app: 'api' }
      },
      {
        name: 'dev-deploy',
        replicas: 1,
        image: 'node:20-alpine',
        labels: { app: 'dev' }
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
      },
      {
        name: 'api-service',
        type: 'NodePort',
        clusterIp: '10.96.100.70',
        nodePort: 30082,
        port: 8080,
        targetPort: 8080,
        selector: { app: 'api' }
      },
      {
        name: 'dev-service',
        type: 'NodePort',
        clusterIp: '10.96.100.60',
        nodePort: 30081,
        port: 8080,
        targetPort: 8080,
        selector: { app: 'dev' }
      }
    ],
    activityLogs: [
      { time: '02:00:00', user: '운영진', action: 'KT Cloud L7 ALB (VIP: 211.252.85.10) 및 실등록 도메인(app, api, dev.ktci5.kr) 연동 완료' },
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
    let list = await env.ROSTER.get('sim:labs:index', 'json');
    if (!list || !Array.isArray(list) || list.length === 0) {
      const seedIndex = DEFAULT_LABS.map(summarizeLab);
      await env.ROSTER.put('sim:labs:index', JSON.stringify(seedIndex));
      for (const lab of DEFAULT_LABS) {
        await env.ROSTER.put(`sim:lab:${lab.id}`, JSON.stringify(lab));
      }
      return seedIndex;
    }
    // Always ensure the default seed labs (기본 예제 3개) exist in the list!
    const existingIds = new Set(list.map(l => l.id));
    let updated = false;
    for (const seedLab of DEFAULT_LABS) {
      if (!existingIds.has(seedLab.id)) {
        list.unshift(summarizeLab(seedLab));
        await env.ROSTER.put(`sim:lab:${seedLab.id}`, JSON.stringify(seedLab));
        updated = true;
      }
    }
    if (updated) {
      await env.ROSTER.put('sim:labs:index', JSON.stringify(list));
    }
    return list;
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
    if (lab) {
      if (!lab.network) {
        lab.network = createDefaultNetwork();
      } else {
        const def = createDefaultNetwork();
        if (!lab.network.vpn) lab.network.vpn = def.vpn;
        if (!lab.network.router) lab.network.router = def.router;
        if (!lab.network.switch) lab.network.switch = def.switch;
        if (!lab.network.hub) lab.network.hub = def.hub;
        if (!lab.network.layers) lab.network.layers = def.layers;
        if (!lab.network.ingress) lab.network.ingress = def.ingress;

        // Ingress 도메인 보정: 실등록 3개 도메인(app, api, dev) 보장, 중복 제거 및 와일드카드 제외
        if (lab.network.ingress?.rules) {
          lab.network.ingress.rules = lab.network.ingress.rules.filter(r => r.host !== '*.ktci5.kr' && !r.host?.startsWith('*.'));
          const rules = lab.network.ingress.rules;
          if (!rules.some(r => r.host === 'app.ktci5.kr')) {
            rules.unshift({
              host: 'app.ktci5.kr',
              path: '/',
              port: 80,
              targetPort: 80,
              service: 'web-service:80',
              ssl: true,
              protocol: 'HTTP/1.1 & HTTP/2'
            });
          }
          if (!rules.some(r => r.host === 'api.ktci5.kr')) {
            rules.splice(1, 0, {
              host: 'api.ktci5.kr',
              path: '/api',
              port: 80,
              targetPort: 8080,
              service: 'api-service:8080',
              ssl: true,
              protocol: 'HTTP/1.1 & HTTP/2'
            });
          }
          if (!rules.some(r => r.host === 'dev.ktci5.kr')) {
            rules.push({
              host: 'dev.ktci5.kr',
              path: '/',
              port: 443,
              targetPort: 8080,
              service: 'dev-service:8080',
              ssl: true,
              protocol: 'HTTPS (TLS1.3)'
            });
          }
          // 중복 방지 (host + port + path 기준)
          const seenRules = new Set();
          lab.network.ingress.rules = rules.filter(r => {
            const key = `${r.host}:${r.port || 80}:${r.path || '/'}`;
            if (seenRules.has(key)) return false;
            seenRules.add(key);
            return true;
          });
        }
        // 서비스 보정: api-service, dev-service 보장
        if (lab.services) {
          if (!lab.services.some(s => s.name === 'api-service')) {
            lab.services.push({
              name: 'api-service',
              type: 'NodePort',
              clusterIp: '10.96.100.70',
              nodePort: 30082,
              port: 8080,
              targetPort: 8080,
              selector: { app: 'api' }
            });
          }
          if (!lab.services.some(s => s.name === 'dev-service')) {
            lab.services.push({
              name: 'dev-service',
              type: 'NodePort',
              clusterIp: '10.96.100.60',
              nodePort: 30081,
              port: 8080,
              targetPort: 8080,
              selector: { app: 'dev' }
            });
          }
        }
        // 파드 보정: api-deploy, dev-deploy 파드가 없으면 추가
        if (lab.pods) {
          if (!lab.pods.some(p => p.labels?.app === 'api')) {
            lab.pods.push({
              name: 'api-deploy-77d9c8d55-p2w9k',
              namespace: 'default',
              node: 'w1',
              status: 'Running',
              ip: '172.20.1.9',
              image: 'python:3.11-alpine',
              cpuReqM: 100,
              ramReqMi: 128,
              labels: { app: 'api' },
              restarts: 0,
              age: '1d'
            });
          }
          if (!lab.pods.some(p => p.labels?.app === 'dev')) {
            lab.pods.push({
              name: 'dev-deploy-69f84b77-m8q2z',
              namespace: 'default',
              node: 'w1',
              status: 'Running',
              ip: '172.20.1.10',
              image: 'node:20-alpine',
              cpuReqM: 100,
              ramReqMi: 128,
              labels: { app: 'dev' },
              restarts: 0,
              age: '1d'
            });
          }
        }
      }
    }
    if (lab && lab.nodes) {
      const usedIps = new Set();
      let maxOctet = 20;
      for (const n of lab.nodes) {
        if (!n.disks) {
          n.disks = [{ name: 'vda (OS)', sizeGb: 50, usedGb: 20, type: 'SSD', mount: '/' }];
        }
        if (n.role === 'control-plane') {
          n.ip = n.ip || '10.10.10.12';
          usedIps.add(n.ip);
        } else {
          if (usedIps.has(n.ip) || !n.ip) {
            maxOctet += 10;
            n.ip = `10.10.10.${maxOctet}`;
          }
          usedIps.add(n.ip);
          const m = n.ip.match(/^10\.10\.10\.(\d+)$/);
          if (m) maxOctet = Math.max(maxOctet, parseInt(m[1], 10));
        }
      }
      syncLbTargetPool(lab);
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

  // 파이프(|) 지원 (예: kubectl describe nodes master1 | grep -i taint)
  if (line.includes('|')) {
    const pipeParts = line.split('|');
    const primaryCmd = pipeParts[0].trim();
    const filterCmd = pipeParts.slice(1).join('|').trim();

    const res = evalK8sCommand(primaryCmd, lab, user);
    if (!res.output) return res;

    const filterTokens = filterCmd.split(/\s+/);
    if (filterTokens[0] === 'grep') {
      const isCaseInsensitive = filterTokens.includes('-i');
      const isInverse = filterTokens.includes('-v');
      const pattern = filterTokens.find(t => t !== 'grep' && t !== '-i' && t !== '-v' && !t.startsWith('-'));
      if (pattern) {
        const regex = new RegExp(pattern, isCaseInsensitive ? 'i' : '');
        const filteredLines = res.output.split('\n').filter(l => isInverse ? !regex.test(l) : regex.test(l));
        return { output: filteredLines.join('\n'), labChanged: res.labChanged };
      }
    }
    return res;
  }

  let tokens = line.split(/\s+/);
  if (tokens[0] === 'k') tokens[0] = 'kubectl';

  const isMutating = ['run', 'create', 'scale', 'delete', 'taint', 'label', 'apply', 'cordon', 'uncordon', 'drain', 'reset', 'set'].includes(tokens[1]) || (tokens[1] === 'rollout' && tokens[2] === 'undo');

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
      output: `\x1b[36;1m☸️ 사용 가능한 쿠버네티스 & 7단계 네트워크 인프라 명령어 목록:\x1b[0m
  • \x1b[33mk get nodes [-o wide]\x1b[0m        : 노드 목록 및 사설 IP 조회
  • \x1b[33mk get pods [-o wide]\x1b[0m         : 파드 상태, 컨테이너 IP, 할당 노드 조회
  • \x1b[33mk get svc / k get ingress\x1b[0m    : 서비스 및 Ingress 도메인/포트 라우팅 테이블
  • \x1b[33mk top nodes / k top pods\x1b[0m      : 가상 CPU/메모리 실시간 사용량 모니터링
  • \x1b[33mdf -h\x1b[0m                         : 가상 노드 스토리지/블록 디스크 용량 점검 (노드명 & IP 표기)
  • \x1b[33mnetstat -tuln\x1b[0m                 : L4 전송 계층 오픈 포트(VIP:80, 443, 30080, 51820) 리슨 상태
  • \x1b[33mip route / route -n\x1b[0m           : L3 가상 라우터(vRouter) 라우팅 테이블 및 게이트웨이
  • \x1b[33mbrctl show / ovs-vsctl\x1b[0m       : L2 가상 브릿지 스위치(vSwitch) 포트 & MAC 포워딩
  • \x1b[33mvpn status\x1b[0m                    : IPsec / WireGuard Site-to-Site VPN 터널링 상태
  • \x1b[33mtunnel status\x1b[0m                 : Cloudflare 하이브리드 아르고 터널 상태 및 대역폭
  • \x1b[33mlayers\x1b[0m                        : OSI 7계층 (L1 허브 ~ L7 응용) 실시간 연동 진단
  • \x1b[33mk run <이름> --image=<이미지>\x1b[0m  : 단일 파드 즉시 생성 (스케줄링)
  • \x1b[33mk create deploy <이름> --image=<이미지> --replicas=<N>\x1b[0m : 디플로이먼트 생성
  • \x1b[33mk scale deploy <이름> --replicas=<N>\x1b[0m                   : 레플리카 수 스케일링
  • \x1b[33mk expose deploy <이름> --port=80 --type=NodePort\x1b[0m       : NodePort 서비스 노출
  • \x1b[33mk rollout status/undo deploy/<이름>\x1b[0m                   : 롤링 배포 상태 확인 및 즉각 롤백
  • \x1b[33mk taint nodes <노드> <키>:<효과>[-]\x1b[0m                  : 노드 Taint 설정/해제
  • \x1b[33mk label nodes <노드> <키>=<값>[-]\x1b[0m                   : 노드 라벨 부여/삭제 (nodeSelector 해결)
  • \x1b[33mk cordon <노드> / k uncordon <노드>\x1b[0m                 : 노드 스케줄링 제어
  • \x1b[33mk drain <노드> --ignore-daemonsets\x1b[0m                 : 노드 파드 비우기(Drain)
  • \x1b[33mk delete pod/deploy/svc <이름>\x1b[0m                         : 리소스 삭제
  • \x1b[33mcurl [-H "Host: ..."] <IP/도메인>[:포트]\x1b[0m            : L7 로드밸런서, 도메인, 포트 호출 테스트
  • \x1b[33mclear\x1b[0m                                                 : 터미널 화면 지우기`,
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
        out += `${namePadded}${String(d.sizeGb + 'G').padEnd(6)}${String(d.usedGb + 'G').padEnd(6)}${String(avail + 'G').padEnd(6)}${String(pct + '%').padEnd(5)}[${node.name}: ${node.ip}] ${d.mount}\n`;
      }
    }
    return { output: out.trimEnd(), labChanged: false };
  }

  // 3. NETSTAT -TULN (L4 전송 계층 포트 리슨)
  if (line.startsWith('netstat') || line.startsWith('ss -tuln')) {
    const net = lab.network || createDefaultNetwork();
    let out = 'Proto Recv-Q Send-Q Local Address           Foreign Address         State       Layer/Service\n';
    out += `tcp        0      0 0.0.0.0:80              0.0.0.0:*               LISTEN      L7 ALB (HTTP Ingress)\n`;
    out += `tcp        0      0 0.0.0.0:443             0.0.0.0:*               LISTEN      L7 ALB (HTTPS TLS1.3)\n`;
    for (const svc of (lab.services || [])) {
      if (svc.nodePort) {
        out += `tcp        0      0 0.0.0.0:${svc.nodePort}          0.0.0.0:*               LISTEN      K8s NodePort (${svc.name})\n`;
      }
    }
    out += `udp        0      0 0.0.0.0:51820           0.0.0.0:*                           VPN/WireGuard (kt-corp-vpn)\n`;
    out += `tcp        0      0 127.0.0.1:6443          0.0.0.0:*               LISTEN      kube-apiserver\n`;
    return { output: out.trimEnd(), labChanged: false };
  }

  // 4. IP ROUTE / ROUTE -N (L3 네트워크 계층)
  if (line === 'ip route' || line === 'route -n' || line === 'netstat -r') {
    const r = lab.network?.router || createDefaultNetwork().router;
    let out = `Kernel IP routing table (Router: ${r.name}, Gateway: ${r.gateway})\n`;
    out += 'Destination     Gateway         Genmask         Flags Metric Ref    Use Iface\n';
    out += '0.0.0.0         211.252.85.1    0.0.0.0         UG    100    0        0 eth0 (WAN)\n';
    out += '10.10.0.0       0.0.0.0         255.255.0.0     U     0      0        0 eth1 (vSwitch-VLAN100)\n';
    out += '172.20.0.0      10.10.10.12     255.255.0.0     UG    10     0        0 eth2 (Calico-Overlay)\n';
    out += '192.168.100.0   10.10.10.12     255.255.255.0   UG    20     0        0 wg0 (VPN-Subnet)\n';
    return { output: out.trimEnd(), labChanged: false };
  }

  // 5. BRCTL SHOW / OVS-VSCTL (L2 데이터링크 계층)
  if (line.startsWith('brctl') || line.startsWith('ovs') || line === 'bridge link') {
    const sw = lab.network?.switch || createDefaultNetwork().switch;
    let out = `bridge name     bridge id               STP enabled     interfaces\n`;
    out += `${sw.name.padEnd(16)}8000.525400123456       no              `;
    const ifaces = (sw.ports || []).map(p => `vport${p.port}-${p.node}`).join('\n' + ''.padEnd(40));
    out += ifaces + '\n\n';
    out += `L2 Forwarding MAC Database (VLAN ${sw.vlan}):\n`;
    out += `Port  MAC Address        Node       Speed    Status\n`;
    for (const p of (sw.ports || [])) {
      out += `${String(p.port).padEnd(6)}${p.mac.padEnd(19)}${p.node.padEnd(11)}${p.speed.padEnd(9)}${p.state}\n`;
    }
    return { output: out.trimEnd(), labChanged: false };
  }

  // 6. VPN STATUS
  if (line === 'vpn status' || line === 'wg show') {
    const v = lab.network?.vpn || createDefaultNetwork().vpn;
    const isOk = v.status === 'CONNECTED';
    return {
      output: `\x1b[36;1m🔒 KT Cloud Corporate Site-to-Site VPN:\x1b[0m
  • Name:        ${v.name}
  • Protocol:    ${v.type}
  • Status:      ${isOk ? '\x1b[32;1m● CONNECTED (Active)\x1b[0m' : '\x1b[31;1m● DISCONNECTED\x1b[0m'}
  • Endpoint:    ${v.serverEndpoint}
  • Subnet:      ${v.clientSubnet}
  • Peers:       ${v.connectedClients} Connected Clients
  • Throughput:  ${isOk ? v.throughputMbps + ' Mbps' : '0 Mbps'}
  • Latency:     ${isOk ? v.latencyMs + ' ms' : 'N/A'}`,
      labChanged: false
    };
  }

  // 7. TUNNEL STATUS
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

  // 8. LAYERS (OSI 7단계 계층 진단)
  if (line === 'layers' || line === 'osi' || line === 'osi 7') {
    const net = lab.network || createDefaultNetwork();
    const l = net.layers || createDefaultNetwork().layers;
    let out = '\x1b[36;1m🌐 KT Cloud OSI 7-Layer Network Architecture Status:\x1b[0m\n';
    out += `  • \x1b[35;1m[L7 응용]\x1b[0m     ALB/Ingress 실등록 도메인 라우팅 (app, api, dev.ktci5.kr) ➔ \x1b[32mACTIVE\x1b[0m\n`;
    out += `  • \x1b[35;1m[L6 표현]\x1b[0m     TLSv1.3 SSL 암호화 & GZIP 압축 ➔ \x1b[32mENCRYPTED\x1b[0m\n`;
    out += `  • \x1b[35;1m[L5 세션]\x1b[0m     Cloudflare Argo / WireGuard Mesh 세션 유지 ➔ \x1b[32mESTABLISHED\x1b[0m\n`;
    out += `  • \x1b[35;1m[L4 전송]\x1b[0m     TCP 포트 포워딩 (VIP:80, 443 ➔ NodePort:30080, 30081, 30082) ➔ \x1b[32mLISTENING\x1b[0m\n`;
    out += `  • \x1b[35;1m[L3 네트워크]\x1b[0m vRouter 10.10.0.0/16 ➔ Calico 172.20.0.0/16 NAT 라우팅 ➔ \x1b[32mROUTED\x1b[0m\n`;
    out += `  • \x1b[35;1m[L2 데이터링크]\x1b[0m Open vSwitch (VLAN 100, 10Gbps 가상 NIC MAC 테이블) ➔ \x1b[32mFORWARDING\x1b[0m\n`;
    out += `  • \x1b[35;1m[L1 물리]\x1b[0m     KT Cloud DBO 가상 백본 허브 (10Gbps Virtual Link Up) ➔ \x1b[32mLINK_UP\x1b[0m\n`;
    return { output: out.trimEnd(), labChanged: false };
  }

  // 9. CURL 테스트 (L7 로드밸런서, Ingress 도메인, NodePort, VPN 지원)
  if (tokens[0] === 'curl') {
    const net = lab.network || createDefaultNetwork();
    const isTunnelDown = net.tunnel?.status === 'DISCONNECTED';
    const isVpnDown = net.vpn?.status === 'DISCONNECTED';
    
    // 도메인 헤더 추출
    let targetHost = '';
    const matchH = line.match(/-H\s+["']?Host:\s*([^\s"']+)["']?/i);
    if (matchH) {
      targetHost = matchH[1].trim();
    }

    const targetUrl = tokens[tokens.length - 1];
    let urlWithoutScheme = targetUrl.replace(/^https?:\/\//, '');
    const firstSlashIdx = urlWithoutScheme.indexOf('/');
    const reqPath = firstSlashIdx !== -1 ? urlWithoutScheme.slice(firstSlashIdx) : '/';

    let hostOrIp = (firstSlashIdx !== -1 ? urlWithoutScheme.slice(0, firstSlashIdx) : urlWithoutScheme);
    let port = 80;
    if (hostOrIp.includes(':')) {
      const p = hostOrIp.split(':');
      hostOrIp = p[0];
      port = parseInt(p[1], 10);
    }
    if (!targetHost && hostOrIp.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(hostOrIp)) {
      targetHost = hostOrIp;
    }

    // 터널 단절 상태 체크
    if (isTunnelDown && (targetHost.includes('ktci5.kr') || hostOrIp === net.loadBalancer?.vip)) {
      return {
        output: `curl: (52) Empty reply from server\nHTTP/1.1 502 Bad Gateway (Cloudflare Tunnel: Origin Unreachable)`,
        labChanged: false
      };
    }

    // 도메인 유효성 검증:
    // 1) 등록된 Ingress 규칙과 일치하거나 (app.ktci5.kr, api.ktci5.kr, dev.ktci5.kr 및 수동 등록 도메인)
    // 2) L7 로드밸런서 VIP 직접 호출인 경우 지원
    const registeredRules = net.ingress?.rules || [];
    const isDomainMatch = Boolean(targetHost && registeredRules.some((r) => r.host === targetHost));
    const isLbVip = !targetHost && (hostOrIp === net.loadBalancer?.vip);

    if (targetHost && !isDomainMatch) {
      const allowed = registeredRules.map(r => r.host).filter(Boolean).join(', ') || 'app.ktci5.kr, api.ktci5.kr, dev.ktci5.kr';
      return {
        output: `curl: (6) Could not resolve host: ${targetHost}\nHTTP/1.1 404 Not Found (DNS Unregistered Host: 실등록된 Ingress 도메인(${allowed})만 라우팅을 지원합니다)`,
        labChanged: false
      };
    }

    if (isLbVip || isDomainMatch) {
      // Ingress 규칙 매칭 우선순위:
      // 1) 호스트 & 경로(Path) 일치
      // 2) 호스트 정확 일치
      // 3) 포트 일치 규칙
      let matchedRule = null;
      if (targetHost) {
        matchedRule = registeredRules.find(r => r.host === targetHost && (r.path === reqPath || (r.path !== '/' && reqPath.startsWith(r.path))))
                   || registeredRules.find(r => r.host === targetHost);
      }
      if (!matchedRule) {
        matchedRule = registeredRules.find(r => r.port === port) || registeredRules[0];
      }

      const subPrefix = targetHost ? targetHost.split('.')[0] : 'app';
      const isDevHost = targetHost === 'dev.ktci5.kr' || subPrefix === 'dev' || port === 443;
      const isApiHost = targetHost === 'api.ktci5.kr' || subPrefix === 'api' || reqPath.startsWith('/api') || matchedRule?.service?.includes('api');

      if (!matchedRule) {
        matchedRule = {
          host: targetHost,
          path: reqPath,
          port: port,
          targetPort: port === 443 ? 8080 : 80,
          service: `${subPrefix}-service:${port === 443 ? 8080 : 80}`
        };
      }

      const targetService = matchedRule?.service?.split(':')[0] || (isDevHost ? 'dev-service' : (isApiHost ? 'api-service' : 'web-service'));
      const targetPortNum = matchedRule?.targetPort || (matchedRule?.service?.split(':')[1] ? parseInt(matchedRule.service.split(':')[1], 10) : 80);
      
      const allRunningPods = lab.pods?.filter((p) => p.status === 'Running') || [];
      const svcObj = lab.services?.find(s => s.name === targetService);
      const svcSelectorApp = svcObj?.selector?.app;

      let candidatePods = [];
      if (svcSelectorApp) {
        candidatePods = allRunningPods.filter(p => p.labels?.app === svcSelectorApp);
      }
      if (candidatePods.length === 0) {
        const svcPrefix = targetService.split('-')[0];
        candidatePods = allRunningPods.filter(p => p.name.includes(svcPrefix) || p.labels?.app === svcPrefix);
      }
      
      if (candidatePods.length > 0) {
        // Unhealthy 타겟 노드 제외하고 정상 파드 선택 (LB 페일오버 자동 우회)
        const unhealthyNodeNames = (net.loadBalancer?.targetPool || [])
          .filter(p => !p.status.includes('Healthy'))
          .map(p => p.nodeName || lab.nodes?.find(n => p.target.startsWith(n.ip))?.name)
          .filter(Boolean);

        const healthyPods = candidatePods.filter(p => !unhealthyNodeNames.includes(p.node));
        if (healthyPods.length === 0 && unhealthyNodeNames.length > 0) {
          return {
            output: `HTTP/1.1 503 Service Unavailable (All target endpoints in pool are Unhealthy)`,
            labChanged: false
          };
        }
        const podsToSelect = healthyPods.length > 0 ? healthyPods : candidatePods;
        const chosenPod = podsToSelect[Math.floor(Math.random() * podsToSelect.length)];
        const effectiveHost = targetHost || (isDevHost ? 'dev.ktci5.kr' : (isApiHost ? 'api.ktci5.kr' : 'app.ktci5.kr'));

        let serviceTitle = '🚀 Production Web Service via KT Cloud L7 ALB';
        if (effectiveHost.startsWith('dev.') || matchedRule?.service?.includes('dev')) {
          serviceTitle = '🧪 Development & Staging Service via KT Cloud L7 ALB';
        } else if (effectiveHost.startsWith('api.') || isApiHost) {
          serviceTitle = '⚡ REST API Backend Service via KT Cloud L7 ALB';
        } else if (!effectiveHost.startsWith('app.')) {
          serviceTitle = `🌐 ${subPrefix.toUpperCase()} Application via KT Cloud L7 ALB`;
        }

        const apiBox = isApiHost ? `\n<div style="margin:20px auto;max-width:520px;background:#0f172a;color:#38bdf8;padding:15px;border-radius:8px;text-align:left;font-family:monospace;font-size:13px;line-height:1.6;">\n{\n  "status": "ACTIVE",\n  "service": "${targetService}",\n  "domain": "${effectiveHost}",\n  "path": "${reqPath}",\n  "backend": "${chosenPod.ip}:${targetPortNum}",\n  "node": "${chosenPod.node}",\n  "message": "KT Cloud 5기 REST API 백엔드 서비스 정상 가동 중"\n}\n</div>` : '';

        return {
          output: `\x1b[32mHTTP/1.1 200 OK\x1b[0m
Date: ${new Date().toUTCString()}
Server: KT-Cloud-ALB/2.4 (L7 Reverse Proxy & Ingress)
X-Forwarded-Host: ${effectiveHost}:${port}
X-Forwarded-Proto: ${port === 443 ? 'https' : 'http'}
X-Target-Service: ${targetService}:${targetPortNum}
X-Ingress-Rule: ${matchedRule?.host || effectiveHost}${matchedRule?.path || '/'} ➔ ${matchedRule?.service || targetService}
X-Backend-Server: ${chosenPod.ip}:${targetPortNum} (${chosenPod.node})
X-Network-Path: Hub(L1) ➔ vSwitch(L2:VLAN100) ➔ vRouter(L3:NAT) ➔ ALB(L4:Port${port}) ➔ TLS1.3(L6) ➔ Ingress(L7)
Content-Type: text/html; charset=UTF-8

<!DOCTYPE html>
<html>
<head><title>KT Cloud 5기 - ${effectiveHost}</title></head>
<body style="font-family:sans-serif;padding:30px;text-align:center;">
<h1>${serviceTitle}</h1>
<p style="font-size:16px;">Domain: <b style="color:#6366f1;">${effectiveHost}</b> (Port: <b>${port}</b>, Path: <b>${reqPath}</b>) ➔ Ingress VIP: <b>${net.loadBalancer?.vip}</b></p>
<p>Target Service: <b style="color:#0284c7;">${targetService}</b> (Service Port: <b>${targetPortNum}</b>)</p>
<p>Routed Pod: <span style="color:#10b981;font-weight:bold;">${chosenPod.name}</span> (Node: <b>${chosenPod.node}</b>, Pod IP: <b>${chosenPod.ip}</b>)</p>
<p>SSL Status: <b>${net.loadBalancer?.ssl || 'TLS Valid'}</b> | Tunnel: <b>${net.tunnel?.status}</b> | VPN: <b>${net.vpn?.status || 'CONNECTED'}</b></p>${apiBox}
<p style="font-size:12px;color:#64748b;">OSI 7-Layer Routing: Hub(L1) ➔ Switch(L2) ➔ Router(L3) ➔ Port ${port}(L4) ➔ Session(L5) ➔ TLS(L6) ➔ App(L7)</p>
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

  // 5. GET RESOURCES (nodes/no, pods/po, svc/service, deploy/deployment, ingress, all)
  if (sub === 'get' && tokens[2]) {
    const isWide = line.includes('-o wide');
    const targetRaw = tokens[2].toLowerCase();
    const targets = targetRaw.split(',');

    const getNodesOutput = () => {
      let out = isWide
        ? 'NAME      STATUS                     ROLES           AGE   VERSION   INTERNAL-IP   OS-IMAGE             KERNEL-VERSION\n'
        : 'NAME      STATUS                     ROLES           AGE   VERSION\n';

      for (const n of (lab.nodes || [])) {
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
      return out.trimEnd();
    };

    const getPodsOutput = () => {
      let out = isWide
        ? 'NAME                            READY   STATUS    RESTARTS   AGE   IP           NODE      NOMINATED NODE\n'
        : 'NAME                            READY   STATUS    RESTARTS   AGE\n';

      if (!lab.pods || lab.pods.length === 0) {
        return 'No resources found in default namespace.';
      }

      for (const p of lab.pods) {
        const ready = p.status === 'Running' ? '1/1' : '0/1';
        const isErr = p.status.includes('Crash') || p.status.includes('OOM') || p.status.includes('Error');
        const statusColored = p.status === 'Running' ? `\x1b[32m${p.status}\x1b[0m` : (isErr ? `\x1b[31;1m${p.status}\x1b[0m` : `\x1b[33m${p.status}\x1b[0m`);
        if (isWide) {
          out += `${p.name.padEnd(32)}${ready.padEnd(8)}${statusColored.padEnd(18)}${String(p.restarts).padEnd(11)}${p.age.padEnd(6)}${p.ip.padEnd(13)}${p.node.padEnd(10)}<none>\n`;
        } else {
          out += `${p.name.padEnd(32)}${ready.padEnd(8)}${statusColored.padEnd(18)}${String(p.restarts).padEnd(11)}${p.age}\n`;
        }
      }
      return out.trimEnd();
    };

    const getSvcOutput = () => {
      let out = isWide
        ? 'NAME          TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE   SELECTOR\n'
        : 'NAME          TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)          AGE\n';

      if (isWide) {
        out += `${'kubernetes'.padEnd(14)}${'ClusterIP'.padEnd(12)}${'10.96.0.1'.padEnd(16)}${'<none>'.padEnd(14)}${'443/TCP'.padEnd(17)}5d    <none>\n`;
      } else {
        out += `${'kubernetes'.padEnd(14)}${'ClusterIP'.padEnd(12)}${'10.96.0.1'.padEnd(16)}${'<none>'.padEnd(14)}${'443/TCP'.padEnd(17)}5d\n`;
      }

      const services = lab.services || [];
      for (const s of services) {
        const portStr = s.nodePort ? `${s.port}:${s.nodePort}/TCP` : `${s.port}/TCP`;
        const selectorStr = s.selector ? Object.entries(s.selector).map(([k, v]) => `${k}=${v}`).join(',') : '<none>';
        if (isWide) {
          out += `${s.name.padEnd(14)}${s.type.padEnd(12)}${(s.clusterIp || '10.96.142.88').padEnd(16)}${'<none>'.padEnd(14)}${portStr.padEnd(17)}3d    ${selectorStr}\n`;
        } else {
          out += `${s.name.padEnd(14)}${s.type.padEnd(12)}${(s.clusterIp || '10.96.142.88').padEnd(16)}${'<none>'.padEnd(14)}${portStr.padEnd(17)}3d\n`;
        }
      }
      return out.trimEnd();
    };

    const getDeployOutput = () => {
      let out = isWide
        ? 'NAME          READY   UP-TO-DATE   AVAILABLE   AGE   CONTAINERS   IMAGES\n'
        : 'NAME          READY   UP-TO-DATE   AVAILABLE   AGE\n';

      const deploys = lab.deployments || [];
      if (deploys.length === 0) {
        return 'No resources found in default namespace.';
      }
      for (const d of deploys) {
        const runningCount = lab.pods?.filter(p => p.name.startsWith(d.name) && p.status === 'Running').length || 0;
        const readyStr = `${runningCount}/${d.replicas}`;
        if (isWide) {
          out += `${d.name.padEnd(14)}${readyStr.padEnd(8)}${String(d.replicas).padEnd(13)}${String(runningCount).padEnd(12)}3d    nginx        ${d.image || 'nginx:latest'}\n`;
        } else {
          out += `${d.name.padEnd(14)}${readyStr.padEnd(8)}${String(d.replicas).padEnd(13)}${String(runningCount).padEnd(12)}3d\n`;
        }
      }
      return out.trimEnd();
    };

    const getIngressOutput = () => {
      const net = lab.network || createDefaultNetwork();
      let out = 'NAME              CLASS   HOSTS                               ADDRESS         PORTS     AGE\n';
      const rules = net.ingress?.rules || [];
      const hosts = rules.map(r => r.host).filter(Boolean);
      const hostStr = Array.from(new Set(hosts)).join(',');
      out += `kt-ingress-alb    nginx   ${hostStr.padEnd(35)} ${net.loadBalancer?.vip.padEnd(16)}80, 443   5d\n`;
      return out.trimEnd();
    };

    if (targets.includes('all')) {
      return {
        output: [getPodsOutput(), getSvcOutput(), getDeployOutput()].join('\n\n'),
        labChanged: false
      };
    }

    const resList = [];
    for (const t of targets) {
      if (t === 'no' || t === 'node' || t === 'nodes') {
        resList.push(getNodesOutput());
      } else if (t === 'po' || t === 'pod' || t === 'pods') {
        resList.push(getPodsOutput());
      } else if (t === 'svc' || t === 'service' || t === 'services') {
        resList.push(getSvcOutput());
      } else if (t === 'deploy' || t === 'deployment' || t === 'deployments') {
        resList.push(getDeployOutput());
      } else if (t.startsWith('ing') || t === 'ingress') {
        resList.push(getIngressOutput());
      }
    }

    if (resList.length > 0) {
      return { output: resList.join('\n\n'), labChanged: false };
    }
  }

  // 6. DESCRIBE RESOURCES (nodes/no, pods/po, svc/service, deploy/deployment)
  if (sub === 'describe') {
    const kind = (tokens[2] || '').toLowerCase();
    const name = tokens[3];

    // DESCRIBE NODE
    if (kind === 'nodes' || kind === 'node' || kind === 'no') {
      const targetNode = name ? lab.nodes?.find(n => n.name === name) : lab.nodes?.[0];
      if (!targetNode) {
        const avail = lab.nodes?.map(n => n.name).join(', ') || 'none';
        return { output: `Error from server (NotFound): nodes "${name}" not found. (가용 노드: ${avail})`, labChanged: false };
      }
      const taintsStr = (targetNode.taints && targetNode.taints.length > 0)
        ? targetNode.taints.map(t => `${t.key}:${t.effect}`).join(',')
        : '<none>';

      const labelsStr = targetNode.labels
        ? Object.entries(targetNode.labels).map(([k, v]) => `${k}=${v}`).join('\n                    ')
        : 'kubernetes.io/hostname=' + targetNode.name;

      const hostedPods = lab.pods?.filter(p => p.node === targetNode.name) || [];
      let podsTable = hostedPods.length > 0
        ? '  Namespace  Name                            CPU Requests  Memory Requests\n  ---------  ----                            ------------  ---------------\n' +
          hostedPods.map(p => `  default    ${p.name.padEnd(32)}${String(p.cpuReqM || 100) + 'm'}           ${String(p.ramReqMi || 128) + 'Mi'}`).join('\n')
        : '  <none>';

      const osDisk = targetNode.disks?.[0];
      const hasDiskPres = targetNode.diskPressure || (osDisk && (osDisk.usedGb / osDisk.sizeGb) > 0.85);

      let out = `Name:               ${targetNode.name}
Roles:              ${targetNode.role || '<none>'}
Labels:             ${labelsStr}
Annotations:        kubeadm.alpha.kubernetes.io/cri-socket: unix:///run/containerd/containerd.sock
                    node.alpha.kubernetes.io/ttl: 0
CreationTimestamp:  Tue, 16 Sep 2026 09:00:00 +0900
Taints:             ${taintsStr}
Logging:            Ready
Unschedulable:      ${targetNode.unschedulable ? 'true' : 'false'}
Conditions:
  Type             Status  Reason                       Message
  ----             ------  ------                       -------
  MemoryPressure   False   KubeletHasSufficientMemory   kubelet has sufficient memory available
  DiskPressure     ${hasDiskPres ? 'True' : 'False'}   KubeletHasNoDiskPressure     kubelet disk condition
  PIDPressure      False   KubeletHasSufficientPID      kubelet has sufficient PID available
  Ready            ${targetNode.status === 'Ready' ? 'True' : 'False'}    KubeletReady                 kubelet is posting ready status
Addresses:
  InternalIP:  ${targetNode.ip}
  Hostname:    ${targetNode.name}
Capacity:
  cpu:                ${(targetNode.cpuTotalM || 4000) / 1000}
  ephemeral-storage:  100Gi
  hugepages-2Mi:      0
  memory:             ${targetNode.ramTotalMi || 8192}Mi
  pods:               110
Allocatable:
  cpu:                ${(targetNode.cpuTotalM || 4000) / 1000}
  ephemeral-storage:  90Gi
  hugepages-2Mi:      0
  memory:             ${Math.round((targetNode.ramTotalMi || 8192) * 0.95)}Mi
  pods:               110
Non-terminated Pods:  (${hostedPods.length} in total)
${podsTable}
Allocated resources:
  Resource           Requests
  --------           --------
  cpu                ${hostedPods.reduce((a, p) => a + (p.cpuReqM || 100), 0)}m
  memory             ${hostedPods.reduce((a, p) => a + (p.ramReqMi || 128), 0)}Mi
Events:              <none>`;
      return { output: out, labChanged: false };
    }

    // DESCRIBE POD
    if (kind === 'pods' || kind === 'pod' || kind === 'po') {
      const targetPod = name ? lab.pods?.find(p => p.name === name) : lab.pods?.[0];
      if (!targetPod) {
        return { output: `Error from server (NotFound): pods "${name}" not found`, labChanged: false };
      }
      const isPending = targetPod.status === 'Pending';
      const isCrash = targetPod.status === 'CrashLoopBackOff' || targetPod.status === 'OOMKilled';

      let eventMsg = `Normal   Scheduled         default-scheduler  Successfully assigned default/${targetPod.name} to ${targetPod.node}`;
      if (isPending) {
        const reqLabel = targetPod.nodeSelector ? Object.entries(targetPod.nodeSelector).map(([k,v]) => `${k}=${v}`).join(',') : 'disktype=ssd';
        eventMsg = `Warning  FailedScheduling  default-scheduler  0/${lab.nodes?.length || 2} nodes are available: ${lab.nodes?.length || 2} node(s) didn't match Pod's node affinity/selector (${reqLabel}).`;
      } else if (isCrash) {
        eventMsg = `Warning  BackOff           default-kubelet    Back-off 10s restarting failed container=${targetPod.name.split('-')[0]} pod=${targetPod.name}\n  Warning  OOMKilled         default-kubelet    Container exceeded memory limit (128Mi), killed by Linux cgroup OOM-Killer (Exit Code 137)`;
      }

      let out = `Name:             ${targetPod.name}
Namespace:        default
Priority:         0
Service Accounts: default
Node:             ${targetPod.node}/${lab.nodes?.find(n => n.name === targetPod.node)?.ip || '<none>'}
Start Time:       Tue, 22 Sep 2026 07:00:00 +0900
Labels:           ${targetPod.labels ? Object.entries(targetPod.labels).map(([k, v]) => `${k}=${v}`).join(',') : 'run=' + targetPod.name}
Status:           ${targetPod.status}
IP:               ${targetPod.ip || 'None'}
Containers:
  ${targetPod.name.split('-')[0]}:
    Container ID:   containerd://simulated-${targetPod.name}
    Image:          ${targetPod.image || 'nginx:latest'}
    State:          ${isCrash ? 'Waiting (CrashLoopBackOff)' : (targetPod.status === 'Running' ? 'Running' : 'Waiting')}
    Last State:     ${isCrash ? 'Terminated (OOMKilled, Exit Code 137)' : '<none>'}
    Ready:          ${targetPod.status === 'Running' ? 'True' : 'False'}
    Restart Count:  ${targetPod.restarts || 0}
    Requests:
      cpu:          ${targetPod.cpuReqM || 100}m
      memory:       ${targetPod.ramReqMi || 128}Mi
Conditions:
  Type              Status
  Initialized       True
  Ready             ${targetPod.status === 'Running' ? 'True' : 'False'}
  ContainersReady   ${targetPod.status === 'Running' ? 'True' : 'False'}
  PodScheduled      ${isPending ? 'False' : 'True'}
Events:
  Type     Reason            Age   From               Message
  ----     ------            ----  ----               -------
  ${eventMsg}`;
      return { output: out, labChanged: false };
    }

    // DESCRIBE SERVICE
    if (kind === 'svc' || kind === 'service' || kind === 'services') {
      const targetSvc = name ? lab.services?.find(s => s.name === name) : lab.services?.[0];
      if (!targetSvc) {
        return { output: `Error from server (NotFound): services "${name}" not found`, labChanged: false };
      }
      let out = `Name:              ${targetSvc.name}
Namespace:         default
Labels:            <none>
Selector:          ${targetSvc.selector ? Object.entries(targetSvc.selector).map(([k, v]) => `${k}=${v}`).join(',') : '<none>'}
Type:              ${targetSvc.type}
IP:                ${targetSvc.clusterIp}
Port:              http  ${targetSvc.port}/TCP
TargetPort:        ${targetSvc.targetPort || 80}/TCP
NodePort:          http  ${targetSvc.nodePort || '<none>'}/TCP
Endpoints:         ${lab.pods?.filter(p => p.status === 'Running').map(p => `${p.ip}:${targetSvc.targetPort || 80}`).join(',') || '<none>'}
Events:            <none>`;
      return { output: out, labChanged: false };
    }
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
    if (!node) {
      const avail = lab.nodes?.map(n => n.name).join(', ') || 'none';
      return { output: `Error from server (NotFound): nodes "${nodeName}" not found. (가용 노드: ${avail})`, labChanged: false };
    }
    node.unschedulable = true;
    lab.activityLogs.unshift({ time: timeStr, user: userName, action: `노드 '${nodeName}' 스케줄링 비활성화 (cordoned)` });
    return { output: `node/${nodeName} cordoned`, labChanged: true };
  }

  if (sub === 'uncordon' && tokens[2]) {
    const nodeName = tokens[2];
    const node = lab.nodes?.find((n) => n.name === nodeName);
    if (!node) {
      const avail = lab.nodes?.map(n => n.name).join(', ') || 'none';
      return { output: `Error from server (NotFound): nodes "${nodeName}" not found. (가용 노드: ${avail})`, labChanged: false };
    }
    node.unschedulable = false;
    rescheduleAll(lab);
    lab.activityLogs.unshift({ time: timeStr, user: userName, action: `노드 '${nodeName}' 스케줄링 재개 (uncordoned)` });
    return { output: `node/${nodeName} uncordoned`, labChanged: true };
  }

  if (sub === 'drain' && tokens[2]) {
    const nodeName = tokens[2];
    const node = lab.nodes?.find((n) => n.name === nodeName);
    if (!node) {
      const avail = lab.nodes?.map(n => n.name).join(', ') || 'none';
      return { output: `Error from server (NotFound): nodes "${nodeName}" not found. (가용 노드: ${avail})`, labChanged: false };
    }
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

  // 12. EXPOSE (NodePort / ClusterIP 서비스 생성)
  if (sub === 'expose') {
    const kind = tokens[2];
    const targetName = tokens[3];
    if (!kind || !targetName) return { output: 'error: KIND and NAME required for kubectl expose', labChanged: false };

    let port = 80;
    let targetPort = 80;
    let type = 'ClusterIP';
    let svcName = targetName;

    for (let i = 4; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.startsWith('--port=')) port = parseInt(t.split('=')[1], 10) || 80;
      else if (t === '--port' && tokens[i + 1]) port = parseInt(tokens[++i], 10) || 80;
      else if (t.startsWith('--target-port=')) targetPort = parseInt(t.split('=')[1], 10) || 80;
      else if (t === '--target-port' && tokens[i + 1]) targetPort = parseInt(tokens[++i], 10) || 80;
      else if (t.startsWith('--type=')) type = t.split('=')[1];
      else if (t === '--type' && tokens[i + 1]) type = tokens[++i];
      else if (t.startsWith('--name=')) svcName = t.split('=')[1];
      else if (t === '--name' && tokens[i + 1]) svcName = tokens[++i];
    }

    if (!lab.services) lab.services = [];
    const nodePort = (type === 'NodePort' || type === 'LoadBalancer') ? (30000 + Math.floor(Math.random() * 2767)) : undefined;
    const newSvc = {
      name: svcName,
      namespace: 'default',
      type,
      clusterIp: `10.96.${Math.floor(Math.random() * 200) + 1}.${Math.floor(Math.random() * 200) + 1}`,
      port,
      targetPort,
      nodePort,
      selector: { app: targetName }
    };
    lab.services.push(newSvc);
    lab.activityLogs.unshift({
      time: timeStr,
      user: userName,
      action: `서비스 '${svcName}' (${type}, NodePort: ${nodePort || '-'}) 생성`
    });
    return { output: `service/${svcName} exposed`, labChanged: true };
  }

  // 12-1. CREATE INGRESS / DEPLOYMENT
  if (sub === 'create') {
    const kind = tokens[2];
    const targetName = tokens[3];
    if (kind === 'ingress' || kind === 'ing') {
      if (!targetName) return { output: 'error: NAME required for kubectl create ingress', labChanged: false };
      let host = `${targetName}.ktci5.kr`;
      let svc = 'web-service:80';
      let port = 80;
      for (let i = 4; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.startsWith('--rule=')) {
          const rulePart = t.slice('--rule='.length).replace(/["']/g, '');
          const eqIdx = rulePart.indexOf('=');
          const h = (eqIdx !== -1 ? rulePart.slice(0, eqIdx) : rulePart).replace(/\/\*.*$/, '').replace(/\/.*$/, '');
          const target = eqIdx !== -1 ? rulePart.slice(eqIdx + 1) : 'web-service:80';
          if (h) host = h;
          if (target) svc = target;
        } else if (t === '--rule' && tokens[i + 1]) {
          const rulePart = tokens[++i].replace(/["']/g, '');
          const eqIdx = rulePart.indexOf('=');
          const h = (eqIdx !== -1 ? rulePart.slice(0, eqIdx) : rulePart).replace(/\/\*.*$/, '').replace(/\/.*$/, '');
          const target = eqIdx !== -1 ? rulePart.slice(eqIdx + 1) : 'web-service:80';
          if (h) host = h;
          if (target) svc = target;
        }
      }
      if (!lab.network.ingress) lab.network.ingress = createDefaultNetwork().ingress;
      if (!lab.network.ingress.rules) lab.network.ingress.rules = [];
      const svcParts = svc.split(':');
      const targetPort = parseInt(svcParts[1] || '80', 10);
      lab.network.ingress.rules.push({
        host,
        path: '/',
        port,
        targetPort,
        service: svc,
        ssl: true,
        protocol: 'HTTP/1.1 & HTTP/2'
      });
      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `Ingress 규칙 '${targetName}' (${host} ➔ ${svc}) 생성 완료`
      });
      return { output: `ingress.networking.k8s.io/${targetName} created`, labChanged: true };
    }

    if (kind === 'deployment' || kind === 'deploy') {
      if (!targetName) return { output: 'error: NAME required for kubectl create deployment', labChanged: false };
      let image = 'nginx:1.25';
      for (let i = 4; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.startsWith('--image=')) image = t.split('=')[1];
        else if (t === '--image' && tokens[i + 1]) image = tokens[++i];
      }
      if (!lab.deployments) lab.deployments = [];
      lab.deployments.push({ name: targetName, replicas: 1, image, labels: { app: targetName } });
      const newPod = {
        name: `${targetName}-${Math.random().toString(36).substring(2, 7)}-${Math.random().toString(36).substring(2, 7)}`,
        namespace: 'default',
        node: 'w1',
        status: 'Running',
        ip: `172.20.1.${Math.floor(Math.random() * 200) + 10}`,
        image,
        cpuReqM: 100,
        ramReqMi: 128,
        labels: { app: targetName },
        restarts: 0,
        age: '10s'
      };
      lab.pods.push(newPod);
      lab.activityLogs.unshift({ time: timeStr, user: userName, action: `디플로이먼트 '${targetName}' (${image}) 생성 완료` });
      return { output: `deployment.apps/${targetName} created`, labChanged: true };
    }
  }

  // 12-2. APPLY (선언적 YAML 매니페스트 적용)
  if (sub === 'apply') {
    const fileArg = tokens.find(t => t.endsWith('.yaml') || t.endsWith('.yml')) || 'manifest.yaml';
    const baseName = fileArg.replace(/\.(yaml|yml)$/, '');
    lab.activityLogs.unshift({
      time: timeStr,
      user: userName,
      action: `kubectl apply -f ${fileArg} 매니페스트 적용 완료`
    });
    if (fileArg.includes('ing')) {
      return { output: `ingress.networking.k8s.io/${baseName} configured`, labChanged: true };
    }
    return { output: `customresourcedefinition.apiextensions.k8s.io/${baseName} configured`, labChanged: true };
  }

  // 13. TAINT NODES
  if (sub === 'taint' && (tokens[2] === 'nodes' || tokens[2] === 'node' || tokens[2] === 'no')) {
    const nodeName = tokens[3];
    const taintExpr = tokens[4];
    if (!nodeName || !taintExpr) return { output: 'error: node name and taint expression required', labChanged: false };

    const node = lab.nodes?.find((n) => n.name === nodeName);
    if (!node) {
      const avail = lab.nodes?.map(n => n.name).join(', ') || 'none';
      return { output: `Error from server (NotFound): nodes "${nodeName}" not found. (가용 노드: ${avail})`, labChanged: false };
    }

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

  // 14. LABEL NODES
  if (sub === 'label' && (tokens[2] === 'nodes' || tokens[2] === 'node' || tokens[2] === 'no')) {
    const nodeName = tokens[3];
    const labelExpr = tokens.slice(4).find((t) => (t.includes('=') || t.endsWith('-')) && !t.startsWith('--'));
    if (!nodeName || !labelExpr) return { output: 'error: node name and label expression required', labChanged: false };

    const node = lab.nodes?.find((n) => n.name === nodeName);
    if (!node) {
      const avail = lab.nodes?.map(n => n.name).join(', ') || 'none';
      return { output: `Error from server (NotFound): nodes "${nodeName}" not found. (가용 노드: ${avail})`, labChanged: false };
    }

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

  // 15. ROLLOUT (undo, status, history)
  if (sub === 'rollout') {
    const action = tokens[2];
    const target = tokens[3] || 'deployment/web-service';
    const depName = target.replace(/^(deployment|deploy)\//, '');
    const dep = lab.deployments?.find(d => d.name === depName) || lab.deployments?.[0];
    if (!dep) return { output: `error: deployment "${depName}" not found`, labChanged: false };

    if (action === 'undo') {
      const prevImage = 'nginx:1.24-stable';
      dep.image = prevImage;
      lab.pods?.filter(p => p.name.startsWith(dep.name)).forEach(p => {
        p.image = prevImage;
        p.status = 'Running';
      });
      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `deployment.apps/${dep.name} rolled back to revision 1 (${prevImage})`
      });
      return { output: `deployment.apps/${dep.name} rolled back`, labChanged: true };
    }
    if (action === 'status') {
      return { output: `deployment "${dep.name}" successfully rolled out`, labChanged: false };
    }
    if (action === 'history') {
      return {
        output: `deployment.apps/${dep.name} \nREVISION  CHANGE-CAUSE\n1         kubectl apply --filename=manifest.yaml --record=true\n2         kubectl set image deployment/${dep.name} nginx=${dep.image}`,
        labChanged: false
      };
    }
    return { output: `error: unknown rollout command '${action}'. Valid options: status, undo, history`, labChanged: false };
  }

  // 16. SET IMAGE
  if (sub === 'set' && tokens[2] === 'image') {
    const target = tokens[3] || '';
    const imgArg = tokens[4] || '';
    const depName = target.replace(/^(deployment|deploy)\//, '');
    const dep = lab.deployments?.find(d => d.name === depName) || lab.deployments?.[0];
    if (!dep) return { output: `error: deployment "${depName}" not found`, labChanged: false };
    const newImage = imgArg.includes('=') ? imgArg.split('=')[1] : imgArg;
    dep.image = newImage;
    lab.activityLogs.unshift({
      time: timeStr,
      user: userName,
      action: `deployment.apps/${dep.name} image updated to ${newImage}`
    });
    return { output: `deployment.apps/${dep.name} image updated`, labChanged: true };
  }

  return {
    output: `error: unknown command: "${line}". Type 'help' for examples.`,
    labChanged: false
  };
}

/// KT Cloud 5기 공인 교안 및 실습 교재 기반 지식 베이스 (Curriculum Knowledge Base)
export const CURRICULUM_KNOWLEDGE = [
  {
    id: 'k8s-taint',
    chapter: '교안 07장 [쿠버네티스] - Step 4-1',
    title: '마스터 노드(master1) Taint 해제 및 파드 스케줄링 허용',
    keywords: ['taint', '테인트', '마스터 노드', '마스터에 배포', '마스터 파드', 'control-plane-', 'noschedule', '스케줄링 제한', 'taints'],
    concept: `쿠버네티스 마스터 노드(Control-Plane)는 시스템 안정성을 위해 기본적으로 'node-role.kubernetes.io/control-plane:NoSchedule' Taint가 설정되어 일반 워크로드 파드의 배치가 엄격히 차단됩니다.\n\nKT Cloud 5기 실습 환경(1 Master: 10.10.10.12 + 1 Worker: 10.10.10.20)에서는 마스터 노드에도 파드가 배포될 수 있도록 키 뒤에 하이픈('-')을 붙여 Taint를 제거해야 합니다.\n\n• 해제 명령어: kubectl taint no master1 node-role.kubernetes.io/control-plane-\n• 상태 확인: kubectl describe nodes master1 | grep -i taint (출력: Taints: <none>이면 성공)`,
    recommendedCmd: 'kubectl taint no master1 node-role.kubernetes.io/control-plane-',
    verifyCmd: 'kubectl describe nodes master1 | grep -i taint',
    nextStepHint: 'Taint를 해제한 후 \'k run web --image nginx\'를 실행하면 마스터 노드에도 파드가 정상 스케줄링되어 가동됩니다.',
    tags: 'Taint / 스케줄링'
  },
  {
    id: 'k8s-nodeport',
    chapter: '교안 07장 [쿠버네티스] - Step 5-1 ~ 5-3',
    title: 'NodePort 서비스 노출 원리 및 포트 대역(30000~32767)',
    keywords: ['nodeport', '노드포트', '외부 접속', '포트 대역', '포트 범위', '30000', '32767', 'expose', '서비스 노출', 'node-port'],
    concept: `NodePort는 클러스터 외부 사용자가 파드에 접속할 수 있도록 모든 노드(Master/Worker)의 동일한 고정 포트(표준 범위: 30000~32767)를 일괄 개방하는 서비스 유형입니다.\n\n파드 80번 포트를 NodePort 서비스로 노출하면, 외부에서 마스터 IP(10.10.10.12:<NodePort>) 또는 워커 IP(10.10.10.20:<NodePort>) 중 어느 IP로 접속하더라도 kube-proxy(iptables 프록시 모드)를 통해 백엔드 파드의 사설 IP(172.20.x.x:80)로 자동 부하분산 라우팅됩니다.\n\n• 서비스 노출: k expose po web --port 80 --target-port 80 --type NodePort\n• 서비스 확인: k get po,svc -o wide`,
    recommendedCmd: 'k expose po web --port 80 --target-port 80 --type NodePort',
    verifyCmd: 'k get svc',
    nextStepHint: '\'k get svc\'로 할당된 30000번대 포트를 확인한 후, \'curl 10.10.10.12:<NodePort>\'와 \'curl 10.10.10.20:<NodePort>\'를 호출하여 양쪽 노드 모두에서 동일한 HTTP 응답이 오는지 검증하세요.',
    tags: 'NodePort / 서비스'
  },
  {
    id: 'k8s-nodeselector',
    chapter: '교안 07장 [쿠버네티스] - Step 8-2 ~ 8-3',
    title: 'nodeSelector 조건부 스케줄링 & Pending 장애 원인 분석 및 해결',
    keywords: ['nodeselector', '노드셀렉터', 'pending', '펜딩', '라벨', 'label', 'failedscheduling', '스케줄링 실패', 'disktype', '대기 중', '왜 안 떠'],
    concept: `파드 명세서에 'nodeSelector: disktype: ssd' 또는 'disktype: hdd' 같은 조건이 명시되어 있을 때, 클러스터 노드 중 일치하는 라벨을 가진 노드가 0대이면 kube-scheduler는 파드를 배치하지 못하고 'Warning FailedScheduling: 0/2 nodes are available: 2 node(s) didn\'t match Pod\'s node affinity/selector' 이벤트를 발생시키며 파드를 Pending 상태로 대기시킵니다.\n\n• 해결 조치: 워커 노드(w1)에 'kubectl label nodes w1 disktype=ssd' 명령으로 라벨을 부여하면 kube-scheduler가 즉각 반응하여 파드가 Running으로 전환됩니다.\n• 라벨 제거: 실습 종료 후 'kubectl label nodes w1 disktype-'로 라벨을 제거합니다.`,
    recommendedCmd: 'kubectl label nodes w1 disktype=ssd',
    verifyCmd: 'kubectl get pods -o wide',
    nextStepHint: '\'kubectl describe pod <파드명>\'으로 Events 섹션을 확인하여 FailedScheduling 에러가 사라지고 Successfully assigned로 바뀌었는지 확인하세요.',
    tags: 'nodeSelector / 라벨'
  },
  {
    id: 'k8s-multicontainer',
    chapter: '교안 07장 [쿠버네티스] - Step 6-1 ~ 6-2',
    title: '멀티 컨테이너 파드(Multi-Container Pod) 네트워크 & 파일시스템 공유',
    keywords: ['멀티 컨테이너', 'multi container', 'simple.yaml', '네임스페이스 공유', 'c2', 'busybox', '루프백', 'loopback', '127.0.0.1'],
    concept: `쿠버네티스의 파드(Pod)는 배포와 관리의 최소 단위입니다. 동일한 단일 파드 내에 함께 기동된 복수 컨테이너(예: simple.yaml의 Nginx 웹서버 + c2 Busybox 보조 컨테이너)는 동일한 네트워크 네임스페이스(동일한 Pod IP 및 Loopback 127.0.0.1)와 IPC, UTS(호스트명 'mypod')를 완전히 공유합니다.\n\n따라서 c2 컨테이너 내부에서 'curl localhost:80'을 호출하면 외부 네트워크 경유 없이 동일 파드의 Nginx로 즉시 연결됩니다.\n\n• 검증 1 (IP 공유 확인): k exec mypod -c c2 -- ip a\n• 검증 2 (호스트명 공유 확인): k exec mypod -c c2 -- hostname`,
    recommendedCmd: 'k exec mypod -c c2 -- ip a',
    verifyCmd: 'k exec mypod -c c2 -- hostname',
    nextStepHint: '\'k exec mypod -c c2 -it -- /bin/sh\'로 c2 내부 셸에 직접 진입하여 localhost 통신과 파일시스템 구조를 점검해보세요.',
    tags: '멀티 컨테이너'
  },
  {
    id: 'k8s-dryrun',
    chapter: '교안 07장 [쿠버네티스] - Step 7-1 ~ 7-2',
    title: '--dry-run=client vs --dry-run=server 차이점 및 선언적 YAML 템플릿 추출',
    keywords: ['dry-run', 'dryrun', '드라이런', 'client vs server', 'yaml 추출', '템플릿 생성', '선언적 리소스', 'deploy_template', 'svc_template'],
    concept: `쿠버네티스 CLI에서 명령형 배포를 수행하기 전, 실무 표준 선언적 YAML 매니페스트를 즉시 생성할 때 dry-run 플래그를 사용합니다.\n\n1. --dry-run=client: API 서버로 요청을 전송하지 않고 오직 kubectl 로컬 내부에서만 유효성을 모사하여 가장 깔끔하고 불필요한 메타데이터가 없는 기본 뼈대 YAML 파일을 생성합니다. (템플릿 작성 시 표준 권장)\n2. --dry-run=server: 실제 API 서버로 매니페스트를 전송하여 클러스터 버전 호환성 검증 및 API 기본값(Default values), Admission 플러그인의 자동 주입 필드까지 모두 포함된 완전한 상세 YAML을 확인합니다.\n\n• 디플로이먼트 템플릿 생성: k create deploy example --image nginx --dry-run=client -o yaml > deploy_template.yaml`,
    recommendedCmd: 'k create deploy example --image nginx --dry-run=client -o yaml > deploy_template.yaml',
    verifyCmd: 'cat deploy_template.yaml',
    nextStepHint: '\'k expose deploy example --port 80 --name blue --type NodePort --dry-run=client -o yaml > svc_template.yaml\'로 서비스 템플릿도 추출해보세요.',
    tags: 'YAML / dry-run'
  },
  {
    id: 'k8s-rollout',
    chapter: '교안 07장 [쿠버네티스] - Step 9-1 ~ 9-3',
    title: 'Deployment 무중단 롤링 업데이트(RollingUpdate) 및 즉각 롤백(Rollback)',
    keywords: ['롤링 업데이트', 'rollingupdate', '롤아웃', 'rollout', '롤백', 'rollback', 'undo', '무중단 배포', 'blue green', 'canary', '카나리'],
    concept: `Deployment는 신규 버전 배포 시 기존 ReplicaSet의 파드를 점진적으로 축소(Terminating)하고 신규 ReplicaSet의 파드를 점진적으로 증설(Running)하여 서비스 무중단을 보장하는 롤링 업데이트를 기본 수행합니다. 신규 배포 버전에서 장애나 버그 발생 시 'k rollout undo' 한 줄로 직전 안정 버전으로 즉시 무중단 롤백할 수 있습니다.\n\n배포 전략 비교:\n• 롤링 업데이트: 기본 방식, 추가 인프라 비용 없이 점진적 팟 교체\n• Blue/Green: 구버전(Blue)과 동일한 신버전(Green) 파드를 100% 띄운 후 Service selector 라벨을 일시에 전환\n• Canary: 신규 버전을 전체 트래픽의 일부(예: 10~25%)에만 소량 투입하여 오류율 모니터링 후 단계적 전면 확대\n\n• 이미지 교체: k set image deployments example nginx=rosehs00/test:nginx\n• 롤아웃 상태: k rollout status deployment/example\n• 즉각 롤백: k rollout undo deployment/example`,
    recommendedCmd: 'k set image deployments example nginx=rosehs00/test:nginx',
    verifyCmd: 'k rollout undo deployment/example',
    nextStepHint: '\'k rollout history deployment/example\'을 실행하여 배포 리비전 번호(Revision)와 변경 이력을 확인해보세요.',
    tags: '롤링 업데이트'
  },
  {
    id: 'k8s-calico',
    chapter: '교안 07장 [쿠버네티스] - Step 1-3 & Step 2',
    title: 'Calico CNI v3.32.2 Tigera Operator 및 Pod CIDR(172.20.0.0/16)',
    keywords: ['calico', '칼리코', 'cni', 'tigera', '네트워크 플러그인', '172.20', 'pod network', 'cidr', 'coredns pending', 'operator'],
    concept: `쿠버네티스는 노드 간 파드 통신을 위해 CNI(Container Network Interface) 플러그인이 필수입니다. KT Cloud 5기 실습에서는 Pod CIDR를 '172.20.0.0/16'으로 설정하여 kubeadm init을 수행하고, Calico CRD와 Tigera Operator를 통해 컨테이너 오버레이 네트워크를 구축합니다.\n\nTigera Operator가 각 노드에 calico-node 데몬셋을 띄우고 네트워크 터널이 완성되기 전까지는 kube-system의 coredns 파드들이 Pending 상태를 유지하는 것이 정상 동작입니다. calico-node 파드가 Running(1/1)으로 전환되면 coredns 파드들도 순차적으로 가동됩니다.\n\n• Calico 파드 확인: kubectl get pods -n calico-system -o wide\n• 전체 시스템 파드 확인: kubectl get pods -A -o wide`,
    recommendedCmd: 'kubectl get pods -n calico-system -o wide',
    verifyCmd: 'kubectl get pods -A -o wide',
    nextStepHint: '\'watch kubectl get po -A -o wide\'로 CNI 파드 기동 완료 및 coredns 정상 가동(Running 1/1)을 모니터링하세요.',
    tags: 'Calico CNI'
  },
  {
    id: 'k8s-cluster-bootstrap',
    chapter: '교안 07장 [쿠버네티스] - Step 1 ~ 3',
    title: '마스터(10.10.10.12) / 워커(10.10.10.20) 클러스터 구축 표준 절차',
    keywords: ['클러스터 구축', '마스터 워커', 'kubeadm init', 'kubeadm join', '10.10.10.12', '10.10.10.20', 'swapoff', 'systemdcgroup', '토큰 생성'],
    concept: `KT Cloud 5기 마스터/워커 2노드 클러스터 구축 절차:\n1. [공통 베이스]: swapoff -a 및 /etc/fstab 주석 처리, containerd 'SystemdCgroup = true', overlay/br_netfilter 커널 모듈 적재, sysctl 'net.ipv4.ip_forward=1'\n2. [서버 측 (master1: 10.10.10.12)]: 'kubeadm init --pod-network-cidr=172.20.0.0/16' 실행 후 Calico v3.32.2 Tigera Operator 배포\n3. [워커 측 (w1: 10.10.10.20)]: 마스터에서 출력된 'kubeadm join 10.10.10.12:6443 --token ...' 실행\n4. 토큰 재발급: 마스터에서 'kubeadm token create --print-join-command'\n5. 클러스터 상태 확인: 'kubectl get nodes'에서 두 노드가 모두 Ready로 전환되는지 확인`,
    recommendedCmd: 'kubectl get nodes -o wide',
    verifyCmd: 'kubeadm token create --print-join-command',
    nextStepHint: '두 노드의 STATUS가 Ready로 변경된 후 Step 4의 마스터 노드 Taint 해제를 진행하세요.',
    tags: '클러스터 구축'
  },
  {
    id: 'k8s-metrics-server',
    chapter: '교안 07장 [쿠버네티스] - Step 10-1 ~ 10-2',
    title: 'Metrics-Server 연동 및 --kubelet-insecure-tls 패치 기법',
    keywords: ['metrics-server', '메트릭스', 'top nodes', 'top pods', '자원 확인', 'cpu 사용량', '메모리 사용량', 'insecure-tls'],
    concept: `클러스터 노드와 파드의 실시간 CPU/메모리 사용량을 'kubectl top' 명령으로 조회하려면 Metrics-Server 애드온이 필수입니다. 온프레미스/테스트 클러스터에서는 Kubelet 자체 서명 인증서로 인해 TLS 통신 에러가 발생하므로, Deployment spec.template.spec.containers[0].args에 '--kubelet-insecure-tls' 인자를 추가하여 Kubelet 인증서 검증을 건너뛰도록 패치해야 메트릭이 정상 수집됩니다.\n\n• 노드 자원 점검: kubectl top nodes\n• 파드 자원 점검: kubectl top pods --all-namespaces --sort-by=cpu`,
    recommendedCmd: 'kubectl top nodes',
    verifyCmd: 'kubectl top pods --all-namespaces --sort-by=cpu',
    nextStepHint: '파드가 재시작되고 1~2분 후 top 명령어로 노드 및 파드 자원 사용량을 확인하세요.',
    tags: 'Metrics-Server'
  },
  {
    id: 'k8s-dashboard',
    chapter: '교안 07장 [쿠버네티스] - Step 11-1 ~ 11-3',
    title: 'Kubernetes Dashboard 웹 UI 배포, RBAC kdb-admin 최고 관리자 권한 및 Skip 로그인',
    keywords: ['대시보드', 'dashboard', 'rbac', 'kdb-admin', '토큰', 'token', 'skip login', '대시보드 접속', '웹 ui'],
    concept: `공식 Kubernetes Dashboard v2.6.1을 배포한 후 서비스를 NodePort로 패치하여 외부 브라우저(https://10.10.10.12:<NodePort>)로 접속합니다. 기본적으로 토큰 로그인이 필요하므로 'kubectl create clusterrolebinding kdb-admin --serviceaccount=kubernetes-dashboard:kubernetes-dashboard --clusterrole=cluster-admin'으로 최고 관리자 권한을 부여하고 'kubectl -n kubernetes-dashboard create token kubernetes-dashboard'로 JWT 토큰을 발급받습니다. 매번 토큰을 입력하는 불편을 해소하려면 Deployment args에 '--enable-skip-login'과 '--disable-settings-authorizer'를 추가하여 원클릭 Skip 로그인 모드를 활성화합니다.`,
    recommendedCmd: 'kubectl -n kubernetes-dashboard get svc kubernetes-dashboard',
    verifyCmd: 'kubectl -n kubernetes-dashboard create token kubernetes-dashboard',
    nextStepHint: '브라우저에서 https://10.10.10.12:<할당된NodePort> 로 접속하여 Skip 버튼을 클릭해 대시보드에 접근하세요.',
    tags: '대시보드 / RBAC'
  },
  {
    id: 'linux-lvm',
    chapter: '교안 04장 [서버 관리 및 스토리지]',
    title: 'LVM 3계층(PV -> VG -> LV) 스토리지 아키텍처 및 무중단 동적 확장',
    keywords: ['lvm', 'pv', 'vg', 'lv', 'pvcreate', 'vgcreate', 'lvcreate', 'lvextend', 'xfs_growfs', '논리 볼륨', '디스크 확장', '스토리지 확장'],
    concept: `LVM(Logical Volume Manager)은 물리 디스크를 가상화하여 유연하게 크기를 조정할 수 있는 3계층 스토리지 관리 방식입니다.\n1. PV(Physical Volume): 물리 디스크/파티션을 LVM 단위로 초기화 ('pvcreate /dev/sdb')\n2. VG(Volume Group): PV들을 하나의 거대한 스토리지 풀로 묶음 ('vgcreate vg_data /dev/sdb')\n3. LV(Logical Volume): 필요한 크기만큼 논리 파티션으로 분할 할당 ('lvcreate -L 20G -n lv_data vg_data')\n용량 부족 시 'lvextend -L +10G /dev/vg_data/lv_data'로 LV를 확장하고 'xfs_growfs /mount_point' (또는 resize2fs)로 파일시스템을 무중단 온라인 확장합니다.`,
    recommendedCmd: 'vgs && lvs',
    verifyCmd: 'df -h',
    nextStepHint: '화면 상단의 노드 카드에서 [+ 100GB SSD Hot-Add]를 클릭하면 LVM 볼륨 그룹에 용량이 즉시 추가됩니다.',
    tags: 'LVM / 스토리지'
  },
  {
    id: 'linux-raid',
    chapter: '교안 04장 [서버 관리 및 스토리지]',
    title: '소프트웨어 RAID(mdadm) 레벨별 특징(0, 1, 5) 및 장애 디스크 리빌딩',
    keywords: ['raid', '레이드', 'mdadm', 'raid 0', 'raid 1', 'raid 5', '디스크 장애', '스페어 디스크', '리빌딩'],
    concept: `리눅스 mdadm 툴을 사용한 소프트웨어 RAID 구축:\n• RAID 0: 스트라이핑, 속도 최우선, 장애 시 전체 데이터 유실\n• RAID 1: 미러링(1:1 복제), 가용 디스크 50%, 높은 안정성\n• RAID 5: 패리티 분산 저장, 최소 3대 디스크 필요, 1대 디스크 장애 무중단 허용\n\n• 생성: mdadm --create /dev/md0 --level=5 --raid-devices=3 /dev/sdb /dev/sdc /dev/sdd\n• 장애 복구: 디스크 고장 시 'mdadm /dev/md0 --fail /dev/sdb --remove /dev/sdb --add /dev/sde'로 신규 디스크를 투입하여 자동 리빌딩합니다.`,
    recommendedCmd: 'cat /proc/mdstat',
    verifyCmd: 'mdadm --detail /dev/md0',
    nextStepHint: '\'/etc/mdadm/mdadm.conf\'에 \'mdadm --detail --scan\' 결과를 저장해야 재부팅 후에도 유지됩니다.',
    tags: 'RAID / 장애복구'
  },
  {
    id: 'docker-basics',
    chapter: '교안 06장 [도커 컨테이너]',
    title: '도커 컨테이너 생명주기 관리 및 포트 포워딩 실무 CLI',
    keywords: ['docker run', '도커', '컨테이너 실행', 'docker ps', 'docker exec', 'docker logs', '포트포워딩', 'docker rm'],
    concept: `컨테이너는 가상머신(Hypervisor + Guest OS)과 달리 호스트 Linux 커널을 직접 공유하며 cgroups(CPU/RAM 제한)와 namespaces(PID, Network, Mount 격리)로 초경량 실행됩니다.\n\n• 백그라운드 데몬 실행 & 포트 매핑: docker run -d -p 8080:80 --name web nginx\n• 실행 중인 컨테이너 목록: docker ps (중지 포함 'docker ps -a')\n• 내부 대화형 셸 접속: docker exec -it web /bin/sh\n• 실시간 콘솔 로그: docker logs -f web\n• 컨테이너 강제 삭제: docker rm -f web`,
    recommendedCmd: 'docker ps -a',
    verifyCmd: 'docker logs web',
    nextStepHint: '컨테이너 내 메인 프로세스(PID 1)가 백그라운드로 빠져나가지 않고 포그라운드를 유지해야 컨테이너가 Exited로 죽지 않습니다.',
    tags: '도커 CLI'
  },
  {
    id: 'dockerfile-compose',
    chapter: '교안 06장 [도커 컨테이너]',
    title: 'Dockerfile 최적화 지시어 및 Docker Compose 선언적 오케스트레이션',
    keywords: ['dockerfile', '도커파일', 'docker compose', 'docker-compose', '도커 컴포즈', 'entrypoint', 'cmd 차이', '다중 컨테이너'],
    concept: `Dockerfile 주요 지시어:\n• FROM: 베이스 이미지 지정\n• RUN: 빌드 타임 명령어 실행(레이어 캐싱)\n• COPY: 호스트 파일 복사\n• CMD: 컨테이너 실행 시 기본 인자(CLI에서 오버라이딩 가능)\n• ENTRYPOINT: 컨테이너 실행 시 항상 고정 실행되는 엔트리포인트\n\n다중 컨테이너(WordPress + MySQL 등)는 'docker-compose.yml'에 서비스, 포트, 볼륨, 네트워크를 정의하고 'docker compose up -d' 한 줄로 전체 스택을 원클릭 선언 배포합니다.`,
    recommendedCmd: 'docker compose ps',
    verifyCmd: 'docker compose logs',
    nextStepHint: 'Dockerfile 작성 시 변경이 잦은 애플리케이션 코드는 Dockerfile 하단에 두어 빌드 캐시 효율을 극대화하세요.',
    tags: 'Dockerfile / Compose'
  },
  {
    id: 'network-netplan-dns',
    chapter: '교안 05장 [네트워크 기초] & 07장 Step 1-1',
    title: 'Netplan 고정 IP 설정(50-cloud-init.yaml) 및 DNS 질의 순서',
    keywords: ['netplan', '고정 ip', '넷플랜', 'dns 질의', '게이트웨이', '서브넷', 'cidr', 'osi 7계층', 'tcp ip 4계층'],
    concept: `Ubuntu/Rocky Linux에서 고정 IP는 '/etc/netplan/50-cloud-init.yaml'에 인터페이스(ens160 등), dhcp4: false, addresses: [10.10.10.12/24], routes to default via 10.10.10.2, nameservers: [8.8.8.8, 8.8.4.4]를 정의하고 'netplan apply'를 실행하여 적용합니다.\n\nDNS 질의 흐름:\n1. 1차: 로컬 호스트 파일('/etc/hosts') 검사\n2. 2차: 로컬 DNS 캐시(systemd-resolved 등) 확인\n3. 3차: '/etc/resolv.conf'에 등록된 외부 네임서버(8.8.8.8)로 순차 질의`,
    recommendedCmd: 'ip a && ip route show',
    verifyCmd: 'cat /etc/netplan/50-cloud-init.yaml',
    nextStepHint: 'IP 변경 시 원격 터미널(SSH) 연결이 끊기므로 변경된 새 IP(10.10.10.12 또는 10.10.10.20)로 재접속해야 합니다.',
    tags: '네트워크 / netplan'
  },
  {
    id: 'linux-cli-textstream',
    chapter: '교안 02장 [리눅스 기초] & 03장 [셸 스크립트]',
    title: '리눅스 텍스트 스트림 3대 도구(grep, sed, awk) 및 파이프라인 활용',
    keywords: ['grep', 'sed', 'awk', '셸 스크립트', 'bash', 'vi 편집기', 'chmod', 'chown', '리다이렉션', '파이프라인'],
    concept: `리눅스 시스템 관리 및 자동화 핵심 도구:\n1. grep: 정규표현식 문자열 검색 ('grep -i -E "error|fail" /var/log/syslog')\n2. sed: 파일 내 문자열 실시간 일괄 치환 ('sed -i "s/old/new/g" config.yaml')\n3. awk: 열(Column) 단위 필터링 및 서식 가공 ('awk "{print $1, $3}" file.txt')\n\n파이프(|)와 결합하여 'kubectl get po -A | grep -v Running'처럼 원하는 정보만 필터링하여 모니터링하는 데 필수적입니다.`,
    recommendedCmd: 'ps aux | grep kubelet',
    verifyCmd: 'cat /etc/hosts',
    nextStepHint: 'vi 편집기에서 저장 후 종료는 \':wq!\', 강제 종료는 \':q!\', 줄 번호는 \':set nu\'입니다.',
    tags: 'CLI / 셸 스크립트'
  },
  {
    id: 'k8s-ingress-alb',
    chapter: '교안 05장 [네트워크] & 07장 인프라 라우팅',
    title: 'L7 Ingress 호스트 라우팅(app, api, dev.ktci5.kr) 및 ALB VIP 로드밸런싱',
    keywords: ['ingress', '인그레스', '로드밸런서', 'alb', 'vip', '도메인', 'app.ktci5.kr', 'dev.ktci5.kr', 'api.ktci5.kr', '211.252.85.10', '라운드로빈', 'leastconn'],
    concept: `L7 Ingress는 단일 공인 VIP(211.252.85.10)에서 HTTP Host 헤더를 분석하여 요청된 실등록 도메인(app.ktci5.kr, api.ktci5.kr, dev.ktci5.kr)에 따라 클러스터 내부의 서로 다른 서비스 파드로 트래픽을 분기합니다.\n\n와일드카드 임의 허용 없이 정규 등록된 인그레스 호스트 규칙만 엄격히 라우팅하여 안정성과 보안을 보장합니다.\n\n• 상용 웹 서비스 검증: curl -H "Host: app.ktci5.kr" http://211.252.85.10\n• REST API 백엔드 검증: curl -H "Host: api.ktci5.kr" http://211.252.85.10/api\n• 개발/스테이징 검증: curl -H "Host: dev.ktci5.kr" http://211.252.85.10:443`,
    recommendedCmd: 'curl -H "Host: app.ktci5.kr" http://211.252.85.10',
    verifyCmd: 'kubectl get ingress -A',
    nextStepHint: '네트워크 토폴로지 패널에서 [+ Ingress 도메인/포트 매핑 추가] 버튼 또는 \'kubectl create ingress\'로 신규 서브도메인을 명시적으로 등록해보세요.',
    tags: 'L7 Ingress / ALB'
  },
  {
    id: 'curriculum-overview',
    chapter: 'KT Cloud 5기 공식 커리큘럼 전체 색인',
    title: 'KT Cloud 5기 정규 커리큘럼 및 11대 실전 실습 로드맵',
    keywords: ['교안', '교재', '커리큘럼', '목차', '강의노트', '실습 순서', '어떤 내용', '전체 내용', '요약', '과정 소개'],
    concept: `KT Cloud 제5기 클라우드 인프라 엔지니어링 정규 과정은 총 7개 핵심 모듈과 11대 쿠버네티스 실전 실습으로 구성되어 있습니다:\n\n[7대 핵심 교과목]\n1. 01_intro_인프라개요: KT Cloud IDC, 가상화(Hypervisor), 온프레미스 vs 클라우드\n2. 02_linux_기초: 파일시스템(FHS), 기본 CLI, vi, 권한, 프로세스\n3. 03_shell_스크립트: Bash 변수, 제어문(if, for), grep, sed, awk\n4. 04_admin_서버스토리지: LVM 3계층, RAID(mdadm), Swap, NFS, systemd\n5. 05_network_네트워크: OSI 7계층, 서브넷팅, netplan 고정 IP, DNS 흐름\n6. 06_docker_컨테이너: Docker CLI, Dockerfile 최적화, Docker Compose\n7. 07_k8s_쿠버네티스: 2노드 클러스터 구축부터 웹 대시보드까지 11대 실습\n\n[쿠버네티스 11대 실무 실습]\nStep 1: 마스터(10.10.10.12) / 워커(10.10.10.20) 구축 & Calico CNI\nStep 2: 클러스터 상태 확인 및 CNI 기동 모니터링\nStep 3: 마스터 노드 Taint 해제 및 k 별칭 최적화\nStep 4: Nginx 파드 배포 및 NodePort 서비스 노출\nStep 5: 멀티 컨테이너 파드(Nginx+Busybox) 네임스페이스 검증\nStep 6: 선언적 YAML 백업 및 --dry-run=client 템플릿 추출\nStep 7: 라벨 필터링 및 nodeSelector 조건부 스케줄링 트러블슈팅\nStep 8: 무중단 롤링 업데이트 및 즉각 롤백\nStep 9: Metrics-Server 모니터링 및 insecure-tls 패치\nStep 10: Kubernetes Dashboard v2.6.1 구축, RBAC kdb-admin 및 Skip 로그인\nStep 11: HPA 오토스케일링 및 L7 Ingress(app.ktci5.kr) 연동`,
    recommendedCmd: 'kubectl get nodes -o wide',
    verifyCmd: 'kubectl get pods -A -o wide',
    nextStepHint: '궁금하신 교안 챕터나 실습 번호(예: \'Taint 해제\', \'NodePort 서비스\', \'LVM 볼륨 확장\')를 질문하시면 정확한 해설과 명령어를 즉시 안내해 드립니다.',
    tags: '커리큘럼 전체 색인'
  }
];

/// 터미널 실행 명령어 분석 엔진 (사용자가 터미널에 입력/실행한 명령어 분석)
export function analyzeTerminalCommand(cmd = '', lab = null) {
  const c = (cmd || '').trim();
  if (!c) return null;

  const parts = c.split(/\s+/);
  const base = parts[0];

  // 1. kubectl / k taint
  if ((base === 'kubectl' || base === 'k') && parts.includes('taint')) {
    return {
      type: 'taint',
      title: '마스터 노드 Taint 제어 (교안 07장 Step 4-1)',
      meaning: '컨트롤 플레인 마스터 노드의 스케줄링 제한(NoSchedule)을 제거하거나 추가하는 명령어입니다.',
      explanation: c.includes('-')
        ? 'Taint 키 뒤에 하이픈(-)을 붙여 Control-Plane 전용 제약을 해제했습니다. 이제 마스터 노드에도 파드가 정상 스케줄링됩니다.'
        : '노드에 Taint를 설정하여 특정 Toleration이 없는 파드가 배치되지 않도록 격리했습니다.',
      screenImpact: '화면의 master1 노드가 사용자 워크로드 파드를 수용할 수 있는 상태로 전환됩니다.',
      nextCmd: 'kubectl describe nodes master1 | grep -i taint'
    };
  }

  // 2. kubectl / k label
  if ((base === 'kubectl' || base === 'k') && parts.includes('label')) {
    return {
      type: 'label',
      title: '노드 라벨 부여/제거 (교안 07장 Step 8-2 ~ 8-3)',
      meaning: '노드에 키=값 형태의 메타데이터 라벨을 부여하여 nodeSelector와 매칭시키는 명령어입니다.',
      explanation: c.includes('-')
        ? '노드에서 라벨을 성공적으로 제거했습니다.'
        : '노드에 라벨을 부여하여 해당 라벨을 요구하는 Pending 상태의 파드가 즉시 스케줄링되도록 조건을 충족했습니다.',
      screenImpact: '화면에서 nodeSelector 불일치로 Pending 상태에 머물던 파드가 Running으로 즉시 전환됩니다.',
      nextCmd: 'kubectl get pods -o wide'
    };
  }

  // 3. kubectl / k expose
  if ((base === 'kubectl' || base === 'k') && parts.includes('expose')) {
    return {
      type: 'expose',
      title: 'NodePort / ClusterIP 서비스 노출 (교안 07장 Step 5-1)',
      meaning: '파드나 디플로이먼트를 외부에서 접속할 수 있는 서비스로 노출하는 명령어입니다.',
      explanation: '지정한 포트를 NodePort(30000~32767 대역)로 노드 전체에 개방하여 외부 트래픽을 파드로 포워딩합니다.',
      screenImpact: '화면의 네트워크 서비스 목록에 신규 서비스가 등록되며, 노드 IP와 할당된 NodePort로 접속이 가능해집니다.',
      nextCmd: 'kubectl get svc'
    };
  }

  // 4. kubectl / k get
  if ((base === 'kubectl' || base === 'k') && parts.includes('get')) {
    const target = parts.find(p => ['nodes', 'node', 'no', 'pods', 'pod', 'po', 'svc', 'service', 'services', 'deploy', 'deployment', 'deployments', 'all'].includes(p)) || 'resources';
    return {
      type: 'get',
      title: `클러스터 ${target} 상태 조회 (교안 07장 Step 2)`,
      meaning: `클러스터 내 ${target} 리소스의 현재 운영 상태와 IP, 노드 배치를 점검하는 명령어입니다.`,
      explanation: '각 리소스의 STATUS(Ready, Running, Pending)와 RESTARTS 횟수를 모니터링하여 정상 가동 여부를 판별합니다.',
      screenImpact: '터미널에 출력된 파드/노드 목록이 우측 GUI 대시보드 화면에 시각적으로 매핑되어 실시간 표시됩니다.',
      nextCmd: 'kubectl get po,svc -o wide'
    };
  }

  // 5. kubectl / k describe
  if ((base === 'kubectl' || base === 'k') && parts.includes('describe')) {
    return {
      type: 'describe',
      title: '리소스 상세 명세 및 이벤트 진단 (트러블슈팅 표준)',
      meaning: '파드나 노드의 상세 상태와 Kubelet/Scheduler의 실행 이벤트(Events) 로그를 확인하는 명령어입니다.',
      explanation: '하단 Events 섹션에서 FailedScheduling, OOMKilled, ImagePullBackOff 등의 장애 원인을 정확하게 식별할 수 있습니다.',
      screenImpact: '파드가 Pending이거나 CrashLoopBackOff일 때 이벤트 메시지를 통해 즉각적인 조치 방안을 도출할 수 있습니다.',
      nextCmd: 'kubectl get pods'
    };
  }

  // 6. kubectl / k run / create deploy
  if ((base === 'kubectl' || base === 'k') && (parts.includes('run') || (parts.includes('create') && (parts.includes('deployment') || parts.includes('deploy'))))) {
    return {
      type: 'run',
      title: '워크로드 파드/디플로이먼트 배포 (교안 07장 Step 5-1)',
      meaning: '컨테이너 이미지를 기반으로 클러스터 내 신규 파드를 스케줄링하고 기동하는 명령어입니다.',
      explanation: 'kube-scheduler가 노드의 가용 자원과 라벨, Taint 조건을 평가하여 최적의 워커 노드에 파드를 배치합니다.',
      screenImpact: '화면의 파드 목록에 신규 파드가 즉시 추가되며 가용 노드에 할당되어 Running 상태로 전환됩니다.',
      nextCmd: 'kubectl get pods -o wide'
    };
  }

  // 7. kubectl / k rollout
  if ((base === 'kubectl' || base === 'k') && parts.includes('rollout')) {
    return {
      type: 'rollout',
      title: '무중단 롤링 업데이트 상태 점검 / 롤백 (교안 07장 Step 9)',
      meaning: 'Deployment의 버전 변경 진행률을 추적하거나 이전 리비전으로 즉시 원복하는 명령어입니다.',
      explanation: c.includes('undo')
        ? '이전 안정 버전의 ReplicaSet으로 즉시 롤백을 수행했습니다.'
        : '롤아웃 진행률 및 신규 파드의 Ready 상태를 실시간 추적하고 있습니다.',
      screenImpact: '화면의 디플로이먼트 파드들이 구버전에서 신버전으로(또는 롤백으로) 순차 교체됩니다.',
      nextCmd: 'kubectl rollout status deployment/example'
    };
  }

  // 8. kubectl / k top
  if ((base === 'kubectl' || base === 'k') && parts.includes('top')) {
    return {
      type: 'top',
      title: '실시간 노드 / 파드 자원 지표 조회 (교안 07장 Step 10)',
      meaning: 'Metrics-Server에서 수집한 실시간 CPU(cores) 및 메모리(bytes) 사용량을 측정하는 명령어입니다.',
      explanation: '임계치(80% 이상)에 도달한 노드나 파드를 사전에 감지하여 스케일아웃이나 Hot-Add 증설 여부를 결정합니다.',
      screenImpact: '화면 상단 노드 카드의 CPU/RAM 프로그레스 게이지와 실시간 일치합니다.',
      nextCmd: 'kubectl top pods --all-namespaces --sort-by=cpu'
    };
  }

  // 9. curl
  if (base === 'curl') {
    return {
      type: 'curl',
      title: '네트워크 연결 및 HTTP 엔드포인트 응답 검증 (교안 05장 & Step 5-3)',
      meaning: '외부 또는 내부에서 서비스 엔드포인트, 도메인, 로드밸런서 VIP로 HTTP 요청을 전송하는 네트워크 테스트 도구입니다.',
      explanation: '반환되는 HTTP 응답 코드(200 OK, 503, 502)와 본문을 통해 Ingress 라우팅 및 파드 가동 상태를 최종 검증합니다.',
      screenImpact: '화면 L7 로드밸런서의 RPS 카운터가 증가하며 트래픽 분산이 발생합니다.',
      nextCmd: 'curl -I http://211.252.85.10'
    };
  }

  // 10. clear
  if (base === 'clear') {
    return {
      type: 'clear',
      title: '가상 터미널 화면 초기화',
      meaning: '터미널 콘솔 로그 버퍼를 비워 화면을 깨끗하게 정리합니다.',
      explanation: '터미널 화면이 초기화되었으며 이전 명령어는 [위/아래 방향키]로 계속 탐색할 수 있습니다.',
      screenImpact: '좌측 콘솔 창이 깨끗하게 정리됩니다.',
      nextCmd: 'kubectl get nodes'
    };
  }

  return {
    type: 'general-command',
    title: `터미널 실행 명령어: '${c}'`,
    meaning: '가상 클러스터 인프라 조작 명령어입니다.',
    explanation: `실행하신 명령어 '${c}'의 처리 결과가 화면과 클러스터 상태에 반영되었습니다.`,
    screenImpact: '실행 결과에 따라 화면의 리소스 상태가 동기화됩니다.',
    nextCmd: 'kubectl get nodes -o wide'
  };
}

/// AI 인프라 코파일럿 핵심 엔진 (경량 오픈소스 Llama-3.2-1B & 교안 지식 베이스 기반 답변)
export async function generateAiCopilotAdvice(prompt = '', topic = 'general', lab = null, context = {}, env = null) {
  const p = (prompt || '').toLowerCase().trim();
  const lastCmd = (context.lastCommand || '').trim();
  const currentCmd = (context.currentCommand || '').trim();

  // ============================================================
  // 1. 현재 화면 기본 정보 & 실제 인프라 리소스 추출 (Screen State)
  // ============================================================
  const isLabView = !!lab;
  const labTitle = lab?.title || '실습 랩 목록 화면';
  const labId = lab?.id || 'list';

  // 실제 화면에 보이는 도메인 및 L7 로드밸런서
  const ingressRules = lab?.network?.ingress?.rules || [];
  const primaryHost = ingressRules[0]?.host || 'app.ktci5.kr';
  const allHosts = ingressRules.map(r => r.host).join(', ') || 'app.ktci5.kr, dev.ktci5.kr';
  const vip = lab?.network?.loadBalancer?.vip || '211.252.85.10';
  const lbAlgo = lab?.network?.loadBalancer?.algorithm || 'RoundRobin';
  const lbStatus = lab?.network?.loadBalancer?.status || 'Healthy';
  const isLbHealthy = lbStatus === 'Healthy';
  const tunnelStatus = lab?.network?.tunnel?.status || 'CONNECTED';
  const isTunnelHealthy = tunnelStatus === 'CONNECTED';
  const trafficRps = lab?.trafficRps || 0;

  // 실제 화면에 보이는 노드 및 파드
  const nodes = lab?.nodes || [];
  const pods = lab?.pods || [];
  const masterNode = nodes.find(n => n.role === 'control-plane') || nodes[0] || { name: 'master1', ip: '10.10.10.12' };
  const workerNodes = nodes.filter(n => n.role === 'worker');
  const firstWorker = workerNodes[0] || masterNode || { name: 'w1', ip: '10.10.10.20' };
  const targetWorkerName = firstWorker.name;
  const nodeNames = nodes.map(n => n.name).join(', ') || 'master1, w1';
  const pendingPods = pods.filter(p => p.status === 'Pending');
  const runningPods = pods.filter(p => p.status === 'Running');
  const targetPod = pendingPods[0] || runningPods[0] || { name: 'web-app-7b89f-8j2xl' };

  // 터미널 명령어 컨텍스트 분석
  const lastCmdAnalysis = lastCmd ? analyzeTerminalCommand(lastCmd, lab) : null;
  const curCmdAnalysis = currentCmd ? analyzeTerminalCommand(currentCmd, lab) : null;

  // ============================================================
  // 2. 실시간 화면 장애 및 경보 감지 (Screen State Diagnostics)
  // ============================================================
  const activeIssues = [];
  if (lab) {
    nodes.forEach(n => {
      const osDisk = n.disks?.[0];
      const diskUsedPct = osDisk ? Math.round((osDisk.usedGb / osDisk.sizeGb) * 100) : (n.diskPressure ? 92 : 36);
      const isDiskPres = n.diskPressure || (osDisk && (osDisk.usedGb / osDisk.sizeGb) > 0.85);

      if (isDiskPres) {
        activeIssues.push({
          level: 'CRITICAL',
          badge: '디스크 고갈 (DiskPressure)',
          target: n.name,
          screenResult: `화면의 노드 [${n.name}] 디스크 사용량이 ${diskUsedPct}%로 임계치(85%)를 초과하여 자동 격리되었습니다.`,
          hint: `GUI 노드 카드의 [+ 100GB SSD Hot-Add]를 클릭하여 디스크를 증설한 후 'kubectl uncordon ${n.name}'을 실행하세요.`,
          fixCmd: `kubectl uncordon ${n.name}`,
          modalId: null
        });
      } else if (n.status === 'SchedulingDisabled' || n.unschedulable) {
        activeIssues.push({
          level: 'WARN',
          badge: '노드 스케줄링 차단 (Cordoned)',
          target: n.name,
          screenResult: `화면의 노드 [${n.name}]가 현재 수동 격리(SchedulingDisabled) 상태로 신규 파드가 배치되지 않습니다.`,
          hint: `'kubectl uncordon ${n.name}' 명령을 실행하여 정상 스케줄링 상태로 복구하세요.`,
          fixCmd: `kubectl uncordon ${n.name}`,
          modalId: null
        });
      }

      const cpuPct = n.cpuTotalM > 0 ? Math.round(((n.cpuAllocated || 0) / n.cpuTotalM) * 100) : 0;
      if (cpuPct >= 80) {
        activeIssues.push({
          level: 'WARN',
          badge: 'vCPU 임계치 초과',
          target: n.name,
          screenResult: `화면의 노드 [${n.name}] vCPU 사용률이 ${cpuPct}%에 달해 처리 한계에 임박했습니다.`,
          hint: `노드 카드의 [+2C (Hot-Add)] 버튼을 클릭하여 무중단 vCPU 확장을 시도하세요.`,
          fixCmd: `kubectl top nodes`,
          modalId: null
        });
      }
    });

    if (pendingPods.length > 0) {
      const isSchedulingLab = lab.id === 'scheduling-lab';
      activeIssues.push({
        level: 'CRITICAL',
        badge: '파드 Pending 대기',
        target: pendingPods.map(p => p.name).join(', '),
        screenResult: isSchedulingLab
          ? `화면의 파드 ${pendingPods.length}개가 'disktype=ssd' 라벨을 요구하지만 워커 노드 [${targetWorkerName}]에 해당 라벨이 없어 Pending 대기 중입니다.`
          : `화면의 파드 ${pendingPods.length}개가 클러스터 내 가용 자원 부족 또는 조건 불일치로 배치 대기 중입니다.`,
        hint: isSchedulingLab
          ? `[교안 07장 Step 8-3] 'kubectl label nodes ${targetWorkerName} disktype=ssd'를 실행하여 노드에 라벨을 부여하면 즉시 파드가 가동됩니다.`
          : `'kubectl describe pod ${pendingPods[0].name}'으로 이벤트를 확인하고 노드 자원을 확인하세요.`,
        fixCmd: isSchedulingLab ? `kubectl label nodes ${targetWorkerName} disktype=ssd` : `kubectl describe pod ${pendingPods[0].name}`,
        modalId: 'add-node-modal'
      });
    }

    // L7 ALB 타겟 장애 & 페일오버 감지
    const unhealthyTargets = (lab?.network?.loadBalancer?.targetPool || []).filter(p => !p.status.includes('Healthy'));
    if (!isLbHealthy || unhealthyTargets.length > 0) {
      const tgtStr = unhealthyTargets.length > 0 ? unhealthyTargets.map(t => `${t.target} [${t.nodeName || ''}]`).join(', ') : `VIP: ${vip}`;
      activeIssues.push({
        level: 'CRITICAL',
        badge: 'L7 로드밸런서 타겟 503 페일오버',
        target: tgtStr,
        screenResult: `화면의 L7 ALB 타겟 [${tgtStr}]에서 503 헬스체크 실패가 발생하여 정상 노드로 트래픽을 자동 우회 중입니다.`,
        hint: `상용 시나리오 탭에서 [헬스체크 복구]를 클릭하거나 'curl -H "Host: ${primaryHost}" http://${vip}'로 페일오버 응답을 확인하세요.`,
        fixCmd: `curl -H "Host: ${primaryHost}" http://${vip}`,
        modalId: null
      });
    }

    // 컨테이너 OOMKilled / CrashLoopBackOff 감지
    const crashedPods = pods.filter(p => p.status === 'CrashLoopBackOff' || p.status === 'OOMKilled');
    if (crashedPods.length > 0) {
      activeIssues.push({
        level: 'CRITICAL',
        badge: '컨테이너 OOMKilled / CrashLoopBackOff',
        target: crashedPods.map(p => `${p.name} (${p.node})`).join(', '),
        screenResult: `화면의 파드 [${crashedPods[0].name}]가 메모리 한도 초과(OOMKilled Exit 137)로 CrashLoopBackOff 상태에 빠졌습니다.`,
        hint: `'kubectl describe pod ${crashedPods[0].name}'으로 메모리 초과 이벤트를 확인하고, 상용 시나리오 탭에서 [메모리 복구]를 진행하세요.`,
        fixCmd: `kubectl describe pod ${crashedPods[0].name}`,
        modalId: null
      });
    }

    // Cloudflare 터널 단절 감지
    if (!isTunnelHealthy) {
      activeIssues.push({
        level: 'WARN',
        badge: 'Cloudflare 터널 단절 (502)',
        target: 'kt-hybrid-argo-tunnel',
        screenResult: `화면의 Cloudflare Zero Trust 터널 연결이 끊겨 외부 도메인 '${primaryHost}' 인입 시 502 Bad Gateway가 발생합니다.`,
        hint: `상용 시나리오 탭 또는 네트워크 토폴로지 카드에서 [터널 재연결]을 클릭하세요.`,
        fixCmd: `tunnel status`,
        modalId: null
      });
    }

    // VPN 세션 단절 감지
    const isVpnHealthy = (lab?.network?.vpn?.status || 'CONNECTED') === 'CONNECTED';
    if (!isVpnHealthy) {
      activeIssues.push({
        level: 'WARN',
        badge: 'VPN 세션 타임아웃 단절',
        target: 'kt-corp-vpn (192.168.100.0/24)',
        screenResult: `기업 전용 Site-to-Site VPN 세션이 단절되어 사내 관리망(192.168.100.0/24) 통신이 차단되었습니다.`,
        hint: `상용 시나리오 탭에서 [VPN 세션 재수립]을 클릭하거나 터미널에서 'vpn status'를 점검하세요.`,
        fixCmd: `vpn status`,
        modalId: null
      });
    }
  }

  // ============================================================
  // 3. 사용자 질문(Prompt) 처리 (Workers AI Llama-3.2 또는 교안 경량 엔진)
  // ============================================================
  if (p) {
    let bestMatch = null;
    let highestScore = 0;

    for (const item of CURRICULUM_KNOWLEDGE) {
      let score = 0;
      for (const kw of item.keywords) {
        if (p.includes(kw)) score += 15;
        if (p === kw) score += 30;
      }
      if (item.title.toLowerCase().includes(p) || p.includes(item.title.toLowerCase())) score += 20;
      if (item.chapter.toLowerCase().includes(p)) score += 25;

      if (lastCmd && item.keywords.some(kw => lastCmd.toLowerCase().includes(kw))) {
        score += 8;
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = item;
      }
    }

    const matchedCmd = bestMatch ? bestMatch.recommendedCmd.replace(/\bw1\b/g, targetWorkerName) : (lastCmdAnalysis?.nextCmd || 'kubectl get pods -o wide');
    const matchedVerify = bestMatch ? bestMatch.verifyCmd.replace(/\bw1\b/g, targetWorkerName) : 'kubectl get nodes';
    const matchedTip = bestMatch ? bestMatch.nextStepHint.replace(/\bw1\b/g, targetWorkerName) : '실행 후 클러스터 상태가 정상 동기화되는지 확인하세요.';
    const screenNote = `현재 화면: [${labTitle}] 노드 ${nodeNames}, 파드 ${pods.length}개(Running ${runningPods.length}개, Pending ${pendingPods.length}개), 도메인: ${primaryHost}`;

    // Cloudflare Workers AI (Meta Llama-3.2-1B-Instruct 경량 오픈소스 모델) 호출 시도
    if (env && env.AI) {
      try {
        const curriculumContext = bestMatch
          ? `[교안 참고: ${bestMatch.chapter} - ${bestMatch.title}]\n개념: ${bestMatch.concept}\n권장명령어: ${matchedCmd}\n검증명령어: ${matchedVerify}`
          : 'KT Cloud 5기 상용 인프라 및 쿠버네티스 실습 교안';

        const screenContext = `[화면 인프라]: ${screenNote}, VIP: ${vip}`;
        const terminalContext = lastCmd ? `[최근 터미널 명령어]: ${lastCmd}` : '';

        const systemInstruction = `당신은 KT Cloud 5기 인프라 교육용 'AI 인프라 코파일럿'입니다.
경량 오픈소스 AI 모델(Meta Llama-3.2-1B)로 구동됩니다.
반드시 제공된 [교안 참고]와 [화면 인프라]에 근거하여 한국어로 친절하고 정확하게 답변하세요.
절대 불필요하게 장황하거나 중복된 카드를 생성하지 마세요.
답변 원칙:
1. 질문에 대한 핵심 원리와 해결책을 2~3문장 이내로 명확하게 답변하세요.
2. 실행할 단일 명령어와 검증 명령어를 제시하세요. (작업 노드: ${targetWorkerName})`;

        const aiRes = await env.AI.run('@cf/meta/llama-3.2-1b-instruct', {
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: `${screenContext}\n${terminalContext}\n${curriculumContext}\n[사용자 질문]: ${prompt}` }
          ],
          max_tokens: 260,
          temperature: 0.2
        });

        if (aiRes && aiRes.response) {
          const aiText = aiRes.response.trim();
          return {
            model: '⚡ Meta Llama-3.2-1B (Open Source)',
            topic: 'curriculum-qa',
            title: bestMatch ? `📖 [교안] ${bestMatch.title}` : `💡 [AI 답변] ${prompt.slice(0, 32)}`,
            answer: aiText,
            cmd: matchedCmd,
            verifyCmd: matchedVerify,
            screenNote: screenNote,
            tip: matchedTip,
            modalId: null,
            statusBadge: { text: bestMatch?.chapter || 'Llama-3.2-1B', type: 'ok' },
            quickPrompts: [
              { label: '📖 Taint 해제 (Step 4)', topic: 'curriculum-taint' },
              { label: '📖 NodePort 노출 (Step 5)', topic: 'curriculum-nodeport' },
              { label: '📖 nodeSelector (Step 8)', topic: 'curriculum-nodeselector' },
              { label: '🚨 실시간 문제 대처', topic: 'troubleshoot' }
            ]
          };
        }
      } catch (aiError) {
        console.warn('Workers AI Llama-3.2 call fallback:', aiError);
      }
    }

    // 경량 교안 지식 베이스 직관적 답변 (AI 바인딩 없을 때 또는 폴백)
    if (bestMatch && highestScore >= 10) {
      const firstParagraph = bestMatch.concept.split('\n\n')[0].replace(/\bw1\b/g, targetWorkerName);
      const answerText = `${firstParagraph}${lastCmd ? `\n(최근 터미널 실행 명령어 '${lastCmd}' 처리와 교안 내용이 동기화되었습니다.)` : ''}`;

      return {
        model: '🤖 KT 인프라 코파일럿 (교안 경량 엔진)',
        topic: 'curriculum-qa',
        title: `📖 [KT CI5 교안] ${bestMatch.title}`,
        answer: answerText,
        cmd: matchedCmd,
        verifyCmd: matchedVerify,
        screenNote: screenNote,
        tip: matchedTip,
        modalId: null,
        statusBadge: { text: bestMatch.chapter, type: 'ok' },
        quickPrompts: [
          { label: '📖 Taint 해제 (Step 4)', topic: 'curriculum-taint' },
          { label: '📖 NodePort 노출 (Step 5)', topic: 'curriculum-nodeport' },
          { label: '📖 nodeSelector (Step 8)', topic: 'curriculum-nodeselector' },
          { label: '🚨 실시간 문제 대처', topic: 'troubleshoot' }
        ]
      };
    }

    if (lastCmdAnalysis) {
      return {
        model: '🤖 KT 인프라 코파일럿 (터미널 분석)',
        topic: 'terminal-qa',
        title: `🖥️ [터미널 분석] '${lastCmd}'`,
        answer: `터미널에서 실행하신 '${lastCmd}' 명령어는 ${lastCmdAnalysis.meaning} 동작입니다. ${lastCmdAnalysis.explanation}`,
        cmd: lastCmdAnalysis.nextCmd,
        verifyCmd: 'kubectl get nodes -o wide',
        screenNote: screenNote,
        tip: '결과가 화면의 인프라 상태에 즉시 반영되었는지 확인하세요.',
        modalId: null,
        statusBadge: { text: '터미널 연계', type: 'ok' },
        quickPrompts: [
          { label: '📖 Taint 해제 (Step 4)', topic: 'curriculum-taint' },
          { label: '🚨 실시간 문제 대처', topic: 'troubleshoot' }
        ]
      };
    }
  }

  // ============================================================
  // 4. 프리셋 탭 선택 시 (Troubleshoot / Menu / Management / Tips)
  // ============================================================

  // Topic 1: [사용팁]
  if (topic === 'tips') {
    return {
      model: '💡 화면 기준 사용팁',
      topic: 'tips',
      title: '💡 화면 기준 조작 결과 & CLI 사용 가이드',
      answer: `현재 [${labTitle}] 화면에서 Ingress 도메인 '${primaryHost}'(VIP: ${vip})과 총 ${nodes.length}개 노드, ${pods.length}개 파드가 가동 중입니다. 터미널 프롬프트에서 축약어 'k'(kubectl)를 사용할 수 있으며, 방향키로 이전 명령어를 탐색할 수 있습니다.`,
      cmd: `curl -H "Host: ${primaryHost}" http://${vip}`,
      verifyCmd: 'k get pods -o wide',
      screenNote: `L7 로드밸런서 VIP(${vip})에 도메인 [${allHosts}]이 바인딩되어 있습니다.`,
      tip: '상단 툴바의 분할 버튼(50:50, 70:30, 30:70)으로 작업에 맞는 화면 레이아웃을 손쉽게 전환할 수 있습니다.',
      modalId: null,
      statusBadge: { text: isLabView ? `${lab.id} 랩` : '목록 가이드', type: 'ok' },
      quickPrompts: [
        { label: '⚙️ 화면 기준 관리팁', topic: 'management' },
        { label: '➕ 메뉴별 자원 추가법', topic: 'menu' },
        { label: '🚨 실시간 진단 & 장애 대처', topic: 'troubleshoot' }
      ]
    };
  }

  // Topic 2: [관리팁]
  if (topic === 'management') {
    return {
      model: '⚙️ 상용 운영 관리팁',
      topic: 'management',
      title: '⚙️ 화면 기준 상용 인프라 운영 & 클러스터 관리팁',
      answer: `현재 화면의 노드 [${nodeNames}]에 대해 무중단 하드웨어 Hot-Add(vCPU/RAM/디스크) 증설이 지원됩니다. 장시간 연결이나 웹소켓 워크로드가 증가할 경우 L7 분산 알고리즘을 'LeastConnection'으로 변경하면 부하 편차를 줄일 수 있습니다.`,
      cmd: `kubectl top nodes`,
      verifyCmd: `kubectl get nodes -o wide`,
      screenNote: `워커 노드 [${targetWorkerName}] 기본 사양: ${firstWorker.cpuTotalM ? firstWorker.cpuTotalM / 1000 : 2} Core / ${firstWorker.ramTotalMi ? firstWorker.ramTotalMi / 1024 : 4} GiB`,
      tip: `노드 점검 시 'kubectl cordon'으로 배치를 막고 'kubectl drain'으로 파드를 안전하게 대피시키세요.`,
      modalId: null,
      statusBadge: { text: '운영 노하우', type: 'ok' },
      quickPrompts: [
        { label: '💡 인터페이스 사용팁', topic: 'tips' },
        { label: '➕ 메뉴별 자원 추가법', topic: 'menu' },
        { label: '🚨 실시간 진단 & 장애 대처', topic: 'troubleshoot' }
      ]
    };
  }

  // Topic 3: [메뉴 추가법]
  if (topic === 'menu') {
    const nextNodeNum = nodes.length + 1;
    return {
      model: '➕ 메뉴 추가 가이드',
      topic: 'menu',
      title: '➕ 화면 기준 메뉴 위치 & 자원 추가 가이드',
      answer: `우측 GUI 상단의 [+ VM 노드 추가], 파드 목록의 [+ 파드 배포], 네트워크 패널의 [+ 도메인/포트 매핑 추가] 메뉴를 통해 인프라를 확장할 수 있습니다. 파드 배포 시 초/분/시간/랜덤 수명 주기를 선택하여 라이프사이클을 테스트할 수 있습니다.`,
      cmd: `kubectl add node w${nextNodeNum} --ip 10.10.10.${20 + (nextNodeNum - 1) * 10} --cpu 4000 --ram 8192 --disk ssd`,
      verifyCmd: 'kubectl get nodes',
      screenNote: `현재 클러스터: 노드 ${nodes.length}대, 파드 ${pods.length}개 등록됨`,
      tip: '아래 바로가기 버튼을 클릭하면 신규 VM 노드 프로비저닝 모달이 즉시 열립니다.',
      modalId: 'add-node-modal',
      menuGuide: '우측 상단 [+ VM 노드 추가]',
      statusBadge: { text: '메뉴 가이드', type: 'ok' },
      quickPrompts: [
        { label: '💡 인터페이스 사용팁', topic: 'tips' },
        { label: '⚙️ 인프라 관리팁', topic: 'management' },
        { label: '🚨 문제 발생시 대처법', topic: 'troubleshoot' }
      ]
    };
  }

  // Topic 4: [장애 대처법 / Default]
  const isHealthy = activeIssues.length === 0;

  if (!isHealthy) {
    const primaryIssue = activeIssues[0];
    return {
      model: '🚨 실시간 장애 감지',
      topic: 'troubleshoot',
      title: `🚨 [${primaryIssue.level}] ${primaryIssue.badge} - ${primaryIssue.target}`,
      answer: `${primaryIssue.screenResult}\n\n${primaryIssue.hint}`,
      cmd: primaryIssue.fixCmd,
      verifyCmd: 'kubectl get pods -o wide',
      screenNote: `총 ${activeIssues.length}건의 화면 이상이 감지되었습니다. 조치 후 화면 상태가 자동 갱신됩니다.`,
      tip: '명령어를 터미널에 즉시 실행하거나 해당 자원 증설 메뉴를 확인하세요.',
      modalId: primaryIssue.modalId || null,
      menuGuide: primaryIssue.modalId ? '타겟 자원 증설 메뉴 열기' : null,
      statusBadge: { text: `${activeIssues.length}건 장애 감지`, type: 'critical' },
      quickPrompts: [
        { label: '💡 인터페이스 사용팁', topic: 'tips' },
        { label: '⚙️ 인프라 관리팁', topic: 'management' },
        { label: '➕ 메뉴별 자원 추가법', topic: 'menu' }
      ]
    };
  }

  // 정상 상태
  return {
    model: '🛡️ 실전 장애 런북',
    topic: 'troubleshoot',
    title: '🛡️ 화면 상태 정상 & 교안 기반 실전 장애 대처 런북',
    answer: `현재 [${labTitle}] 화면에 감지된 장애가 없습니다. 파드 Pending 발생 시 nodeSelector 라벨(${targetWorkerName})과 Taint를 점검하고, DiskPressure 시 'df -h' 점검 후 스토리지 증설 및 uncordon을 수행하세요.`,
    cmd: `kubectl describe pod ${targetPod.name}`,
    verifyCmd: 'kubectl get pods -o wide',
    screenNote: `모든 노드와 파드가 정상 가동(Healthy) 상태입니다.`,
    tip: '상단 툴바의 [🚨 장애 주입] 메뉴에서 디스크 고갈 또는 LB 실패를 주입하여 트러블슈팅 훈련을 진행해보세요.',
    modalId: null,
    statusBadge: { text: '화면 상태 정상', type: 'ok' },
    quickPrompts: [
      { label: '💡 인터페이스 사용팁', topic: 'tips' },
      { label: '⚙️ 인프라 관리팁', topic: 'management' },
      { label: '➕ 메뉴별 자원 추가법', topic: 'menu' }
    ]
  };
}

// REST API 핸들러
export async function handleSimulatorApi(request, path, env, user) {
  const method = request.method;
  const jsonHeaders = {
    'content-type': 'application/json; charset=UTF-8',
    'cache-control': 'no-store'
  };

  // 0-1. GET /api/simulator/browse : 실시간 가상 웹 브라우저 렌더링 엔드포인트
  if (path === '/api/simulator/browse' && method === 'GET') {
    return renderVirtualDomainResponse(request, env);
  }

  // 0. GET / POST /api/simulator/ai : 전역 AI 코파일럿 조언
  if (path === '/api/simulator/ai') {
    let body = {};
    if (method === 'POST') {
      try { body = await request.json(); } catch {}
    }
    const prompt = (body.prompt || '').trim();
    const topic = body.topic || 'general';
    const effectiveLab = body.lab || null;
    const lastCommand = (body.lastCommand || '').trim();
    const currentCommand = (body.currentCommand || '').trim();
    const commandHistory = body.commandHistory || [];
    const aiResponse = await generateAiCopilotAdvice(prompt, topic, effectiveLab, { lastCommand, currentCommand, commandHistory }, env);
    return new Response(JSON.stringify({
      ok: true,
      topic,
      response: aiResponse,
      timestamp: new Date().toLocaleTimeString('ko-KR')
    }), { headers: jsonHeaders });
  }

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
      const existingNames = new Set((lab.nodes || []).map(n => n.name));
      let nextWorkerNum = 1;
      while (existingNames.has('w' + nextWorkerNum)) nextWorkerNum++;

      const existingIps = new Set((lab.nodes || []).map(n => n.ip));
      let nextIpLast = 20;
      while (existingIps.has(`10.10.10.${nextIpLast}`)) nextIpLast += 10;

      const name = (body.name || `w${nextWorkerNum}`).trim();
      const ip = (body.ip || `10.10.10.${nextIpLast}`).trim();
      const cpu = parseInt(body.cpu || '2000', 10);
      const ram = parseInt(body.ram || '4096', 10);
      const disktype = body.disktype || 'ssd';

      if (lab.nodes.some((n) => n.name.toLowerCase() === name.toLowerCase())) {
        return new Response(JSON.stringify({ ok: false, error: `노드 이름 '${name}'이(가) 이미 존재합니다. 고유한 이름을 사용해주세요.` }), { headers: jsonHeaders, status: 400 });
      }
      if (lab.nodes.some((n) => n.ip === ip)) {
        return new Response(JSON.stringify({ ok: false, error: `노드 IP '${ip}'이(가) 이미 사용 중입니다. 고유한 IP를 사용해주세요.` }), { headers: jsonHeaders, status: 400 });
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
      syncLbTargetPool(lab);
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

    // 6-1. DELETE /api/simulator/labs/:id/nodes/:nodeName : VM 노드 삭제 & 파드 재배치
    if (action && action.startsWith('nodes/') && method === 'DELETE') {
      if (!lab.editable) return new Response(JSON.stringify({ ok: false, error: '수정 권한이 OFF 상태입니다.' }), { headers: jsonHeaders, status: 403 });
      const nodeName = action.split('/')[1];
      const idx = (lab.nodes || []).findIndex(n => n.name === nodeName);
      if (idx === -1) return new Response(JSON.stringify({ ok: false, error: '노드를 찾을 수 없습니다.' }), { headers: jsonHeaders, status: 404 });
      if (lab.nodes[idx].role === 'control-plane') {
        return new Response(JSON.stringify({ ok: false, error: '마스터 노드(control-plane)는 삭제할 수 없습니다.' }), { headers: jsonHeaders, status: 400 });
      }

      const deletedNode = lab.nodes.splice(idx, 1)[0];
      syncLbTargetPool(lab);
      rescheduleAll(lab);

      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `🗑️ 워커 노드 VM '${nodeName}' (${deletedNode.ip}) 반납/삭제 완료`
      });

      await saveLabDetail(env, lab);
      return new Response(JSON.stringify({ ok: true, lab }), { headers: jsonHeaders });
    }

    // 6-2. POST /api/simulator/labs/:id/workloads : GUI 파드 / 디플로이먼트 배포 (초/분/시간 단위 수명 & 랜덤 활동 설정)
    // 6-2. POST /api/simulator/labs/:id/workloads : GUI 파드 / 디플로이먼트 배포 (초/분/시간 단위 수명 & 랜덤 활동 설정)
    if (action === 'workloads' && method === 'POST') {
      if (!lab.editable) return new Response(JSON.stringify({ ok: false, error: '수정 권한이 OFF 상태입니다.' }), { headers: jsonHeaders, status: 403 });
      let body = {};
      try { body = await request.json(); } catch {}

      if (!lab.pods) lab.pods = [];
      if (!lab.deployments) lab.deployments = [];
      if (!lab.services) lab.services = [];

      let rawName = (body.name || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
      let name = rawName;
      if (!name) {
        let appIdx = 1;
        name = `app-${appIdx}`;
        const existingDepNames = new Set(lab.deployments.map(d => d.name.toLowerCase()));
        while (existingDepNames.has(name)) {
          appIdx++;
          name = `app-${appIdx}`;
        }
      } else {
        if (lab.deployments.some(d => d.name.toLowerCase() === name)) {
          return new Response(JSON.stringify({ ok: false, error: `디플로이먼트 이름 '${name}'이(가) 이미 존재합니다. 고유한 이름을 사용해주세요.` }), { headers: jsonHeaders, status: 400 });
        }
      }

      const image = body.image || 'nginx:1.25';
      const replicas = Math.min(Math.max(1, parseInt(body.replicas || '1', 10)), 12);
      const cpuReqM = parseInt(body.cpuReqM || '100', 10);
      const disktype = body.disktype || '';
      const exposeNodePort = Boolean(body.exposeNodePort);
      const durationUnit = body.durationUnit || 'forever'; // 'sec' | 'min' | 'hour' | 'forever' | 'random'
      const durationValue = parseInt(body.durationValue || '30', 10);

      // 지속 시간 계산 (초 단위)
      let lifeSeconds = 0;
      if (durationUnit === 'sec') lifeSeconds = Math.max(5, durationValue);
      else if (durationUnit === 'min') lifeSeconds = Math.max(1, durationValue) * 60;
      else if (durationUnit === 'hour') lifeSeconds = Math.max(1, durationValue) * 3600;
      else if (durationUnit === 'random') lifeSeconds = Math.floor(Math.random() * 90) + 15; // 15초 ~ 105초 랜덤 라이프사이클

      const expiresAt = lifeSeconds > 0 ? Date.now() + (lifeSeconds * 1000) : null;
      const isRandomBurst = Boolean(body.randomBurst || durationUnit === 'random');

      lab.deployments.push({
        name,
        replicas,
        image,
        labels: { app: name },
        cpuReqM,
        expiresAt,
        lifeSeconds,
        isRandomBurst
      });

      for (let i = 0; i < replicas; i++) {
        const podSuffix = Math.random().toString(36).substring(2, 7);
        const podName = `${name}-${podSuffix}`;
        const newPod = {
          name: podName,
          namespace: 'default',
          node: 'None',
          status: 'Pending',
          ip: 'None',
          image,
          cpuReqM,
          ramReqMi: Math.round(cpuReqM * 1.28),
          labels: { app: name },
          nodeSelector: disktype ? { disktype } : undefined,
          restarts: 0,
          age: '1s',
          createdAt: Date.now(),
          expiresAt,
          lifeSeconds,
          isRandomBurst,
          rpsLoad: isRandomBurst ? Math.floor(Math.random() * 40) + 10 : 20
        };
        schedulePod(newPod, lab);
        lab.pods.push(newPod);
      }

      if (exposeNodePort) {
        const usedPorts = new Set();
        (lab.services || []).forEach(s => {
          if (s.nodePort) usedPorts.add(parseInt(s.nodePort, 10));
          if (s.port) usedPorts.add(parseInt(s.port, 10));
        });
        (lab.network?.ingress?.rules || []).forEach(r => {
          if (r.port) usedPorts.add(parseInt(r.port, 10));
        });
        let nextPort = 30080;
        while (usedPorts.has(nextPort) && nextPort <= 32767) {
          nextPort++;
        }
        if (nextPort > 32767) {
          for (let p = 30000; p <= 32767; p++) {
            if (!usedPorts.has(p)) {
              nextPort = p;
              break;
            }
          }
        }

        let svcName = `${name}-svc`;
        const existingSvcNames = new Set((lab.services || []).map(s => s.name.toLowerCase()));
        let svcIdx = 1;
        while (existingSvcNames.has(svcName.toLowerCase())) {
          svcName = `${name}-svc-${svcIdx++}`;
        }

        const existingClusterIps = new Set((lab.services || []).map(s => s.clusterIp));
        let randIp;
        let attempt = 0;
        do {
          randIp = `10.96.${Math.floor(Math.random() * 200) + 10}.${Math.floor(Math.random() * 200) + 10}`;
          attempt++;
        } while (existingClusterIps.has(randIp) && attempt < 100);

        lab.services.push({
          name: svcName,
          type: 'NodePort',
          clusterIp: randIp,
          nodePort: nextPort,
          port: 80,
          targetPort: 80,
          selector: { app: name }
        });
      }

      const lifeDesc = durationUnit === 'forever' ? '지속 동작' : durationUnit === 'random' ? `랜덤 버스트 라이프사이클 (${lifeSeconds}초)` : `${durationValue} ${durationUnit} 후 자동 정리`;
      lab.activityLogs.unshift({
        time: timeStr,
        user: userName,
        action: `📦 워크로드 '${name}' (${replicas} 파드, ${lifeDesc}${isRandomBurst ? ', 랜덤 트래픽' : ''}) 배포 완료`
      });

      await saveLabDetail(env, lab);
      return new Response(JSON.stringify({ ok: true, lab }), { headers: jsonHeaders, status: 201 });
    }

    // 7. PATCH /api/simulator/labs/:id/network : 네트워크 설정 (OSI 7단계, VPN 토글, LB 알고리즘, 터널 토글, 도메인/포트 연결)
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

      if (body.toggleVpn !== undefined) {
        if (!lab.network.vpn) lab.network.vpn = createDefaultNetwork().vpn;
        lab.network.vpn.status = lab.network.vpn.status === 'CONNECTED' ? 'DISCONNECTED' : 'CONNECTED';
        lab.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: `🔒 [KT Cloud VPN] 상태 변경 ➔ ${lab.network.vpn.status}`
        });
      }

      if (body.updateLbAlgorithm) {
        if (!lab.network.loadBalancer) lab.network.loadBalancer = createDefaultNetwork().loadBalancer;
        lab.network.loadBalancer.algorithm = body.updateLbAlgorithm;
        lab.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: `⚖️ [L7 로드밸런서] 분산 알고리즘 ➔ '${body.updateLbAlgorithm}' 변경 완료`
        });
      }

      if (body.addDomain) {
        if (!lab.network.ingress) lab.network.ingress = createDefaultNetwork().ingress;
        if (!lab.network.ingress.rules) lab.network.ingress.rules = [];
        const host = (body.addDomain.host || '').trim();
        const port = parseInt(body.addDomain.port || '80', 10);
        const path = (body.addDomain.path || '/').trim() || '/';
        const targetPort = parseInt(body.addDomain.targetPort || (port === 443 ? '8080' : '80'), 10);
        const service = body.addDomain.service || `web-service:${targetPort}`;
        const ssl = port === 443 || Boolean(body.addDomain.ssl);
        const protocol = port === 443 ? 'HTTPS (TLS1.3)' : 'HTTP/1.1';

        const existingIdx = lab.network.ingress.rules.findIndex(r => r.host === host && (r.port || 80) === port && (r.path || '/') === path);
        const newRule = { host, path, port, targetPort, service, ssl, protocol };
        if (existingIdx >= 0) {
          lab.network.ingress.rules[existingIdx] = newRule;
        } else {
          lab.network.ingress.rules.push(newRule);
        }

        lab.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: `🌐 [도메인/포트 라우팅] '${host}:${port}${path}' ➔ '${service}' Ingress 매핑 & SSL 바인딩 완료`
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
      const act = body.action || 'inject'; // 'inject' | 'resolve'

      if (!lab.network) lab.network = createDefaultNetwork();
      const targetWorker = (lab.nodes || []).find((n) => n.role === 'worker') || lab.nodes?.[0] || { name: 'master1', ip: '10.10.10.12' };
      const targetWorkerName = targetWorker.name;
      const targetWorkerIp = targetWorker.ip;

      // [도메인 1: 네트워크 & L7 로드밸런싱]
      if (type === 'lb_failover') {
        const pool = lab.network.loadBalancer?.targetPool || [];
        const targetAddr = `${targetWorkerIp}:30080`;
        let targetEntry = pool.find(p => p.target === targetAddr || p.nodeName === targetWorkerName);
        if (!targetEntry && pool.length > 0) targetEntry = pool[0];

        const isCurrentlyUnhealthy = targetEntry && targetEntry.status.includes('Unhealthy');
        const makeUnhealthy = (act === 'inject') || (act !== 'resolve' && !isCurrentlyUnhealthy);

        if (targetEntry) {
          targetEntry.status = makeUnhealthy ? 'Unhealthy (503 Error)' : 'Healthy';
          targetEntry.latencyMs = makeUnhealthy ? '999.0' : '2.1';
        }
        lab.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: makeUnhealthy
            ? `⚡ [로드밸런서 페일오버] 타겟 ${targetWorkerIp}:30080 [${targetWorkerName}] 503 장애 발생 ➔ ALB 헬스체크 감지 후 트래픽 자동 우회`
            : `✅ [로드밸런서 복구] 타겟 ${targetWorkerIp}:30080 [${targetWorkerName}] 헬스체크 정상 복원 (Healthy)`
        });
      } else if (type === 'tunnel_cut') {
        const isCurrentlyDown = lab.network.tunnel.status === 'DISCONNECTED';
        const makeDown = (act === 'inject') || (act !== 'resolve' && !isCurrentlyDown);
        lab.network.tunnel.status = makeDown ? 'DISCONNECTED' : 'CONNECTED';
        lab.network.tunnel.latencyMs = makeDown ? 0 : 2.4;
        lab.network.tunnel.throughputMbps = makeDown ? 0 : 250;
        lab.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: makeDown
            ? `🚇 [터널 장애] Cloudflare Zero Trust 아르고 터널 단절 (외부 도메인 app.ktci5.kr 502 Bad Gateway 유발)`
            : `✅ [터널 복원] Cloudflare Zero Trust 하이브리드 터널 재연결 완료 (정상 인바운드 재개)`
        });
      } else if (type === 'vpn_timeout') {
        const isCurrentlyDown = lab.network.vpn?.status === 'DISCONNECTED';
        const makeDown = (act === 'inject') || (act !== 'resolve' && !isCurrentlyDown);
        if (!lab.network.vpn) lab.network.vpn = createDefaultNetwork().vpn;
        lab.network.vpn.status = makeDown ? 'DISCONNECTED' : 'CONNECTED';
        lab.network.vpn.throughputMbps = makeDown ? 0 : 120;
        lab.network.vpn.latencyMs = makeDown ? 0 : 12.5;
        lab.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: makeDown
            ? `🔒 [VPN 세션 단절] Site-to-Site IPsec/WireGuard 세션 타임아웃 (사내 관리망 192.168.100.0/24 통신 차단)`
            : `✅ [VPN 복원] 기업 전용 Site-to-Site VPN 세션 재수립 완료 (암호화 터널 정상화)`
        });
      }

      // [도메인 2: 쿠버네티스 파드 & 스케줄링]
      else if (type === 'pod_pending') {
        if (act === 'resolve') {
          if (targetWorker) {
            if (!targetWorker.labels) targetWorker.labels = {};
            targetWorker.labels.disktype = 'ssd';
          }
          rescheduleAll(lab);
          lab.activityLogs.unshift({
            time: timeStr,
            user: userName,
            action: `✅ [스케줄링 해결] 노드 '${targetWorkerName}'에 'disktype=ssd' 라벨 부여 완료 ➔ 대기 중이던 파드가 Running으로 전환`
          });
        } else {
          for (const n of lab.nodes) {
            if (n.labels && n.labels.disktype) delete n.labels.disktype;
          }
          let pendingPod = lab.pods?.find(p => p.name === 'web-pending');
          if (!pendingPod) {
            pendingPod = {
              name: 'web-pending',
              namespace: 'default',
              node: 'None',
              status: 'Pending',
              ip: 'None',
              image: 'nginx:latest',
              cpuReqM: 100,
              ramReqMi: 128,
              labels: { app: 'web-pending' },
              nodeSelector: { disktype: 'ssd' },
              restarts: 0,
              age: '10s'
            };
            if (!lab.pods) lab.pods = [];
            lab.pods.push(pendingPod);
          } else {
            pendingPod.status = 'Pending';
            pendingPod.node = 'None';
            pendingPod.ip = 'None';
            pendingPod.nodeSelector = { disktype: 'ssd' };
          }
          rescheduleAll(lab);
          lab.activityLogs.unshift({
            time: timeStr,
            user: userName,
            action: `🚨 [파드 장애] 'web-pending' 파드가 nodeSelector(disktype=ssd) 불일치로 인해 Pending 상태로 대기합니다.`
          });
        }
      } else if (type === 'pod_crash') {
        let crashPod = lab.pods?.find(p => p.name === 'oom-crash-app');
        if (act === 'resolve') {
          if (crashPod) {
            crashPod.status = 'Running';
            crashPod.ramReqMi = 256;
          }
          lab.activityLogs.unshift({
            time: timeStr,
            user: userName,
            action: `✅ [파드 정상화] 'oom-crash-app' 메모리 한도 256Mi로 확장 후 컨테이너가 정상 기동(Running)되었습니다.`
          });
        } else {
          if (!crashPod) {
            crashPod = {
              name: 'oom-crash-app',
              namespace: 'default',
              node: targetWorkerName,
              status: 'CrashLoopBackOff',
              ip: `172.20.2.${Math.floor(Math.random() * 80) + 10}`,
              image: 'alpine-leak:v1.2',
              cpuReqM: 150,
              ramReqMi: 128,
              labels: { app: 'oom-crash-app' },
              restarts: 6,
              age: '15m'
            };
            if (!lab.pods) lab.pods = [];
            lab.pods.push(crashPod);
          } else {
            crashPod.status = 'CrashLoopBackOff';
            crashPod.restarts = (crashPod.restarts || 0) + 1;
            crashPod.node = targetWorkerName;
          }
          lab.activityLogs.unshift({
            time: timeStr,
            user: userName,
            action: `🚨 [메모리 초과 장애] 노드 '${targetWorkerName}' (${targetWorkerIp})의 'oom-crash-app' 파드가 OOMKilled(Exit 137) ➔ CrashLoopBackOff 발생`
          });
        }
      }

      // [도메인 3: 스토리지 & 시스템 하드웨어 고갈]
      else if (type === 'disk_pressure') {
        if (targetWorker && targetWorker.disks?.[0]) {
          const makeFull = (act === 'inject') || (act !== 'resolve' && targetWorker.disks[0].usedGb < 40);
          if (makeFull) {
            targetWorker.disks[0].usedGb = Math.round(targetWorker.disks[0].sizeGb * 0.96);
            targetWorker.unschedulable = true;
            rescheduleAll(lab);
            lab.activityLogs.unshift({
              time: timeStr,
              user: userName,
              action: `🚨 [상용 장애 경보] 노드 '${targetWorkerName}' (${targetWorkerIp}) 디스크 96% 고갈 ➔ DiskPressure 조건 발생, 파드 스케줄링 차단`
            });
          } else {
            targetWorker.disks[0].usedGb = 20;
            targetWorker.unschedulable = false;
            rescheduleAll(lab);
            lab.activityLogs.unshift({
              time: timeStr,
              user: userName,
              action: `✅ [디스크 정상화] 노드 '${targetWorkerName}' (${targetWorkerIp}) 로그 파일 정리 완료 (/dev/vda 사용량 20GB, DiskPressure 해제)`
            });
          }
        }
      } else if (type === 'cpu_spike') {
        const makeSpike = (act === 'inject') || (act !== 'resolve' && (lab.trafficRps || 0) < 3000);
        lab.trafficRps = makeSpike ? 4200 : 120;
        lab.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: makeSpike
            ? `🚨 [트래픽 폭증 경보] 대규모 사용자 유입으로 4200 RPS 도달 ➔ 워커 노드 vCPU 사용률 95% 초과 및 Throttling 발생`
            : `✅ [트래픽 안정화] 트래픽이 평시 수준(120 RPS)으로 복귀하여 vCPU 부하가 안정화되었습니다.`
        });
      }

      // [도메인 4: 무중단 배포 & 유지보수]
      else if (type === 'node_drain') {
        if (targetWorker) {
          const makeDrain = (act === 'inject') || (act !== 'resolve' && !targetWorker.unschedulable);
          if (makeDrain) {
            targetWorker.unschedulable = true;
            let evicted = 0;
            for (const p of (lab.pods || [])) {
              if (p.node === targetWorkerName) {
                p.node = 'None';
                p.status = 'Pending';
                p.ip = 'None';
                schedulePod(p, lab);
                evicted++;
              }
            }
            lab.activityLogs.unshift({
              time: timeStr,
              user: userName,
              action: `🚨 [긴급 유지보수] 노드 '${targetWorkerName}' (${targetWorkerIp}) 커널 패치용 Drain 수행 완료 (${evicted}개 파드 안전 대피)`
            });
          } else {
            targetWorker.unschedulable = false;
            rescheduleAll(lab);
            lab.activityLogs.unshift({
              time: timeStr,
              user: userName,
              action: `✅ [노드 복귀] 노드 '${targetWorkerName}' (${targetWorkerIp}) 보안 패치 완료 후 uncordoned 처리 (정상 스케줄링 재개)`
            });
          }
        }
      } else if (type === 'rolling_update') {
        const dep = lab.deployments?.[0] || { name: 'web-service', replicas: 3 };
        const isUndo = act === 'resolve';
        if (isUndo) {
          dep.image = 'nginx:1.24-stable';
          lab.pods?.filter(p => p.name.startsWith(dep.name)).forEach(p => {
            p.image = 'nginx:1.24-stable';
            p.status = 'Running';
          });
          lab.activityLogs.unshift({
            time: timeStr,
            user: userName,
            action: `⏪ [즉각 롤백] 'kubectl rollout undo deploy/${dep.name}' 직전 안정 버전(nginx:1.24-stable)으로 무중단 롤백 완료`
          });
        } else {
          dep.image = 'nginx:1.25.3-alpine';
          const depPods = lab.pods?.filter(p => p.name.startsWith(dep.name)) || [];
          if (depPods[0]) {
            depPods[0].image = 'nginx:1.25.3-alpine';
            depPods[0].restarts = 0;
            depPods[0].age = '3s';
          }
          lab.activityLogs.unshift({
            time: timeStr,
            user: userName,
            action: `🔄 [롤링 업데이트] '${dep.name}' 신규 버전(nginx:1.25.3-alpine) 무중단 점진 교체 롤아웃 시작`
          });
        }
      } else if (type === 'resolve_all') {
        // 모든 장애 일괄 복원
        lab.network.tunnel.status = 'CONNECTED';
        lab.network.tunnel.latencyMs = 2.4;
        lab.network.tunnel.throughputMbps = 250;
        
        if (!lab.network.vpn) lab.network.vpn = createDefaultNetwork().vpn;
        lab.network.vpn.status = 'CONNECTED';
        lab.network.vpn.latencyMs = 12.5;
        lab.network.vpn.throughputMbps = 120;

        if (lab.network.loadBalancer?.targetPool) {
          lab.network.loadBalancer.targetPool.forEach((p) => {
            p.status = 'Healthy';
            p.latencyMs = 1.8;
          });
        }
        for (const n of lab.nodes) {
          n.status = 'Ready';
          n.unschedulable = false;
          if (n.disks?.[0]) n.disks[0].usedGb = 20;
          if (!n.labels) n.labels = {};
          n.labels.disktype = 'ssd';
        }
        for (const p of (lab.pods || [])) {
          p.status = 'Running';
          if (p.name === 'oom-crash-app') p.ramReqMi = 256;
          if (p.node === 'None' || !p.node) schedulePod(p, lab);
        }
        lab.trafficRps = 120;
        rescheduleAll(lab);
        lab.activityLogs.unshift({
          time: timeStr,
          user: userName,
          action: `✅ [종합 정상 복원] 모든 네트워크(L7 ALB, Tunnel, VPN), 노드 디스크, OOM 파드 및 스케줄링이 100% 정상화되었습니다.`
        });
      }

      syncLbTargetPool(lab);
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

    // 12. POST /api/simulator/labs/:id/ai : AI 모델 기반 인프라 운영 팁 & 트러블슈팅 가이드
    if (action === 'ai' && method === 'POST') {
      let body = {};
      try { body = await request.json(); } catch {}
      const prompt = (body.prompt || '').trim();
      const topic = body.topic || 'general'; // 'tips' | 'troubleshoot' | 'menu' | 'exam' | 'general'
      const effectiveLab = body.lab || lab;
      const lastCommand = (body.lastCommand || '').trim();
      const currentCommand = (body.currentCommand || '').trim();
      const commandHistory = body.commandHistory || [];
      
      const aiResponse = await generateAiCopilotAdvice(prompt, topic, effectiveLab, { lastCommand, currentCommand, commandHistory }, env);
      return new Response(JSON.stringify({
        ok: true,
        topic,
        response: aiResponse,
        timestamp: new Date().toLocaleTimeString('ko-KR')
      }), { headers: jsonHeaders });
    }

    // 13. DELETE /api/simulator/labs/:id : 랩 삭제
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

// ============================================================================
// 가상 호스트 및 Ingress 도메인 실시간 렌더러 (Virtual Domain Live Renderer)
// ============================================================================

export async function renderVirtualDomainResponse(request, env, options = {}) {
  const url = new URL(request.url);
  const labId = options.labId || url.searchParams.get('labId') || 'lab-default';
  const lab = (await getLabDetail(env, labId)) || DEFAULT_LABS[0];
  const net = lab.network || createDefaultNetwork();

  // 1. Host 추출 및 정규화
  let reqHost = (options.host || url.searchParams.get('host') || url.hostname || 'app.ktci5.kr').toLowerCase();
  if (reqHost.includes(':')) reqHost = reqHost.split(':')[0];

  // 2. Port 추출 및 정규화
  let reqPort = options.port || url.searchParams.get('port');
  if (!reqPort) {
    if (url.port) reqPort = parseInt(url.port, 10);
    else if (reqHost.startsWith('dev')) reqPort = 443;
    else reqPort = 80;
  }
  reqPort = parseInt(reqPort, 10) || 80;

  // 3. Path 추출 및 정규화
  let reqPath = options.path || url.searchParams.get('path') || url.pathname || '/';
  if (reqPath.startsWith('/vhost/')) {
    const after = reqPath.slice('/vhost/'.length);
    const sIdx = after.indexOf('/');
    reqPath = sIdx === -1 ? '/' : after.slice(sIdx);
  }
  if (!reqPath.startsWith('/')) reqPath = '/' + reqPath;

  const isAjax = url.searchParams.get('ajax') === '1';
  const wantsJson = (request.headers.get('accept') || '').includes('application/json') || url.searchParams.get('format') === 'json' || reqPath.startsWith('/api/v1/');

  // [예외 1] Cloudflare Argo Hybrid Tunnel 단절 검사
  const isTunnelDown = net.tunnel?.status !== 'CONNECTED';
  if (isTunnelDown) {
    if (isAjax || wantsJson) {
      return new Response(JSON.stringify({
        ok: false,
        status: 502,
        error: 'Bad Gateway (Cloudflare Origin Tunnel Unreachable)',
        tunnelStatus: 'DISCONNECTED',
        host: reqHost,
        port: reqPort
      }), {
        status: 502,
        headers: { 'content-type': 'application/json; charset=UTF-8', 'cache-control': 'no-store' }
      });
    }
    return render502BadGatewayResponse({ host: reqHost, port: reqPort, path: reqPath, net, lab });
  }

  // 1-1. VM 노드 매칭 검사 (master1, w1, w2... 또는 master1.ktci5.kr, 10.10.10.X)
  const matchedVmNode = (lab.nodes || []).find(n => {
    const nodeLower = n.name.toLowerCase();
    const hostLower = reqHost.toLowerCase();
    return hostLower === nodeLower ||
           hostLower === `${nodeLower}.ktci5.kr` ||
           hostLower === n.ip;
  });

  if (matchedVmNode) {
    // 1-1-A. VM 노드 상의 NodePort 서비스 접근 (30000-32767 포트 또는 s.nodePort 일치)
    const matchedNodePortSvc = (lab.services || []).find(s => s.type === 'NodePort' && parseInt(s.nodePort, 10) === reqPort);
    if (matchedNodePortSvc) {
      const svcSelectorApp = matchedNodePortSvc.selector?.app;
      const allRunningPods = (lab.pods || []).filter(p => p.status === 'Running');
      let candidatePods = [];
      if (svcSelectorApp) {
        candidatePods = allRunningPods.filter(p => p.labels?.app === svcSelectorApp);
      }
      if (candidatePods.length === 0) {
        const svcPrefix = matchedNodePortSvc.name.replace(/-svc.*$/, '');
        candidatePods = allRunningPods.filter(p => p.name.includes(svcPrefix) || p.labels?.app === svcPrefix);
      }

      // 로컬 노드 파드 우선 라우팅 (K8s kube-proxy Local routing)
      const localPods = candidatePods.filter(p => p.node === matchedVmNode.name);
      const poolToUse = localPods.length > 0 ? localPods : candidatePods;

      if (poolToUse.length === 0) {
        if (isAjax || wantsJson) {
          return new Response(JSON.stringify({
            ok: false,
            status: 503,
            error: `Service Unavailable (NodePort :${reqPort} on ${matchedVmNode.name} has no running pods)`,
            node: matchedVmNode.name,
            service: matchedNodePortSvc.name,
            nodePort: reqPort
          }), { status: 503, headers: { 'content-type': 'application/json; charset=UTF-8' } });
        }
        return render503ServiceUnavailableResponse({
          host: reqHost,
          port: reqPort,
          path: reqPath,
          targetService: matchedNodePortSvc.name,
          targetPort: matchedNodePortSvc.port || 80,
          candidatePods: [],
          unhealthyNodes: [],
          targetPool: net.loadBalancer?.targetPool || [],
          net,
          lab,
          isNodePort: true,
          nodeName: matchedVmNode.name
        });
      }

      const chosenPod = poolToUse[Math.floor(Math.random() * poolToUse.length)];

      if (isAjax) {
        return new Response(JSON.stringify({
          ok: true,
          status: 200,
          type: 'nodeport-proxy',
          node: matchedVmNode.name,
          nodeIp: matchedVmNode.ip,
          nodePort: reqPort,
          service: matchedNodePortSvc.name,
          pod: chosenPod.name,
          podIp: chosenPod.ip,
          podNode: chosenPod.node,
          latencyMs: (0.8 + Math.random() * 1.2).toFixed(1),
          timestamp: new Date().toLocaleTimeString('ko-KR')
        }), { status: 200, headers: { 'content-type': 'application/json; charset=UTF-8' } });
      }

      return renderNodePortServicePage({
        node: matchedVmNode,
        service: matchedNodePortSvc,
        nodePort: reqPort,
        chosenPod,
        path: reqPath,
        lab,
        net
      });
    }

    // 1-1-B. VM 노드 웹 콘솔 직접 접속 (포트 80, 443, 6443 또는 기본 접속)
    if (isAjax || wantsJson) {
      const hostedPods = (lab.pods || []).filter(p => p.node === matchedVmNode.name);
      return new Response(JSON.stringify({
        ok: true,
        type: 'vm-node-console',
        node: matchedVmNode.name,
        ip: matchedVmNode.ip,
        role: matchedVmNode.role,
        status: matchedVmNode.status,
        cpuTotalM: matchedVmNode.cpuTotalM,
        ramTotalMi: matchedVmNode.ramTotalMi,
        disks: matchedVmNode.disks || [],
        hostedPods: hostedPods.map(p => ({ name: p.name, ip: p.ip, status: p.status, cpuReqM: p.cpuReqM })),
        nodePortServices: (lab.services || []).filter(s => s.type === 'NodePort')
      }), { status: 200, headers: { 'content-type': 'application/json; charset=UTF-8' } });
    }

    return renderVmNodeWebPage({
      node: matchedVmNode,
      port: reqPort,
      path: reqPath,
      lab,
      net
    });
  }

  // [예외 2] Ingress 도메인 및 포트 라우팅 유효성 검사
  const registeredRules = net.ingress?.rules || [];
  let matchedRule = registeredRules.find(r => r.host === reqHost && (r.port || 80) === reqPort && (r.path === reqPath || (r.path !== '/' && reqPath.startsWith(r.path))))
                 || registeredRules.find(r => r.host === reqHost && (r.port || 80) === reqPort)
                 || registeredRules.find(r => r.host === reqHost && (r.path === reqPath || (r.path !== '/' && reqPath.startsWith(r.path))))
                 || registeredRules.find(r => r.host === reqHost);

  if (!matchedRule) {
    if (isAjax || wantsJson) {
      return new Response(JSON.stringify({
        ok: false,
        status: 404,
        error: 'Not Found (DNS Unregistered Host / Route)',
        host: reqHost,
        port: reqPort,
        path: reqPath,
        registeredHosts: registeredRules.map(r => `${r.host}:${r.port || 80}${r.path || '/'}`)
      }), {
        status: 404,
        headers: { 'content-type': 'application/json; charset=UTF-8', 'cache-control': 'no-store' }
      });
    }
    return render404NotFoundResponse({ host: reqHost, port: reqPort, path: reqPath, registeredRules, net, lab });
  }

  // [예외 3] 포트 & 프로토콜 일치 검사 (443 HTTPS 전용 포트에 일반 HTTP 접근 시)
  const isHttps = reqPort === 443 || url.protocol === 'https:';
  if ((matchedRule.port === 443 || matchedRule.ssl) && reqPort === 443 && url.protocol === 'http:' && !options.host) {
    return render400HttpsRequiredResponse({ host: reqHost, port: reqPort, path: reqPath });
  }

  // [예외 4] 타겟 서비스 및 파드/타겟 풀 헬스체크 검사
  const targetServiceStr = matchedRule.service || 'web-service:80';
  const [targetServiceName, targetPortStr] = targetServiceStr.split(':');
  const targetPortNum = matchedRule.targetPort || parseInt(targetPortStr || '80', 10);

  const svcObj = (lab.services || []).find(s => s.name === targetServiceName);
  const svcSelectorApp = svcObj?.selector?.app;

  const allRunningPods = (lab.pods || []).filter(p => p.status === 'Running');
  let candidatePods = [];
  if (svcSelectorApp) {
    candidatePods = allRunningPods.filter(p => p.labels?.app === svcSelectorApp);
  }
  if (candidatePods.length === 0) {
    const svcPrefix = targetServiceName.split('-')[0];
    candidatePods = allRunningPods.filter(p => p.name.includes(svcPrefix) || p.labels?.app === svcPrefix);
  }

  const targetPool = net.loadBalancer?.targetPool || [];
  const unhealthyNodeNames = targetPool.filter(p => !p.status.includes('Healthy')).map(p => p.nodeName);
  const healthyPods = candidatePods.filter(p => !unhealthyNodeNames.includes(p.node));

  if (candidatePods.length === 0 || (healthyPods.length === 0 && unhealthyNodeNames.length > 0)) {
    if (isAjax || wantsJson) {
      return new Response(JSON.stringify({
        ok: false,
        status: 503,
        error: 'Service Unavailable (No healthy upstream pods in pool)',
        targetService: targetServiceName,
        targetPort: targetPortNum,
        candidatePodsCount: candidatePods.length,
        unhealthyNodes: unhealthyNodeNames
      }), {
        status: 503,
        headers: { 'content-type': 'application/json; charset=UTF-8', 'cache-control': 'no-store' }
      });
    }
    return render503ServiceUnavailableResponse({
      host: reqHost,
      port: reqPort,
      path: reqPath,
      targetService: targetServiceName,
      targetPort: targetPortNum,
      candidatePods,
      unhealthyNodes: unhealthyNodeNames,
      targetPool,
      net,
      lab
    });
  }

  // 5. 정상 가동 - 로드밸런싱 활성 파드 선택
  const poolToUse = healthyPods.length > 0 ? healthyPods : candidatePods;
  const chosenPod = poolToUse[Math.floor(Math.random() * poolToUse.length)];

  // 실시간 LB 테스트 및 AJAX 호출 응답
  if (isAjax) {
    return new Response(JSON.stringify({
      ok: true,
      status: 200,
      host: reqHost,
      port: reqPort,
      service: targetServiceName,
      targetPort: targetPortNum,
      pod: chosenPod.name,
      podIp: chosenPod.ip,
      node: chosenPod.node,
      latencyMs: (1.5 + Math.random() * 1.5).toFixed(1),
      timestamp: new Date().toLocaleTimeString('ko-KR')
    }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=UTF-8', 'cache-control': 'no-store' }
    });
  }

  // 6. 정상 실시간 페이지 렌더링
  if (reqHost.startsWith('api') || reqPath.startsWith('/api') || matchedRule.service.includes('api')) {
    return renderApiServicePage({ host: reqHost, port: reqPort, path: reqPath, service: targetServiceName, targetPort: targetPortNum, chosenPod, net, lab, wantsJson });
  } else if (reqHost.startsWith('dev') || matchedRule.service.includes('dev')) {
    return renderDevServicePage({ host: reqHost, port: reqPort, path: reqPath, service: targetServiceName, targetPort: targetPortNum, chosenPod, net, lab });
  } else if (reqHost.startsWith('app') || matchedRule.service.includes('web')) {
    return renderAppServicePage({ host: reqHost, port: reqPort, path: reqPath, service: targetServiceName, targetPort: targetPortNum, chosenPod, net, lab });
  } else {
    return renderGenericServicePage({ host: reqHost, port: reqPort, path: reqPath, service: targetServiceName, targetPort: targetPortNum, chosenPod, net, lab });
  }
}

// ============================================================================
// 페이지별 HTML 렌더러 (200 OK & 예외 페이지)
// ============================================================================

function commonVirtualNav(currentHost, currentPort, currentPath, lab) {
  const labId = lab?.id || 'lab-default';
  const nodes = lab?.nodes || [];
  const vmNodesLinks = nodes.map(n => {
    const isCur = currentHost === n.name || currentHost === `${n.name}.ktci5.kr` || currentHost === n.ip;
    return `<a href="/vhost/${n.name}.ktci5.kr/?labId=${encodeURIComponent(labId)}" class="v-link ${isCur ? 'active' : ''}">🖥️ ${n.name}</a>`;
  }).join('');

  return `
    <header class="v-nav">
      <div class="v-nav-brand">
        <span class="v-nav-logo">☁️</span>
        <div>
          <span class="v-nav-title">KT Cloud 5기 K8s 클라우드 인프라</span>
          <span class="v-nav-sub">L7 Ingress &amp; VM Node Web Console</span>
        </div>
      </div>
      <div class="v-nav-links">
        <a href="/vhost/app.ktci5.kr/?labId=${encodeURIComponent(labId)}" class="v-link ${currentHost === 'app.ktci5.kr' ? 'active' : ''}">🏢 app:80</a>
        <a href="/vhost/api.ktci5.kr/api?labId=${encodeURIComponent(labId)}" class="v-link ${currentHost === 'api.ktci5.kr' ? 'active' : ''}">⚡ api:80</a>
        <a href="/vhost/dev.ktci5.kr/?labId=${encodeURIComponent(labId)}" class="v-link ${currentHost === 'dev.ktci5.kr' ? 'active' : ''}">🧪 dev:443</a>
        ${vmNodesLinks}
        <a href="/study/simulator?lab=${encodeURIComponent(labId)}" target="_blank" class="v-btn-console">🖥️ 가상 랩 콘솔</a>
      </div>
    </header>
  `;
}

// 0-A. VM 노드 대시보드 웹 콘솔 (VM Node Web Console)
function renderVmNodeWebPage({ node, port, path, lab, net }) {
  const labId = lab?.id || 'lab-default';
  const isMaster = node.role === 'control-plane';
  const hostedPods = (lab.pods || []).filter(p => p.node === node.name);
  const nodePortSvcs = (lab.services || []).filter(s => s.type === 'NodePort');
  const osDisk = node.disks?.[0];
  const isDiskPressure = osDisk && (osDisk.usedGb / osDisk.sizeGb) > 0.90;

  const disksHtml = (node.disks || []).map(d => {
    const pct = Math.round((d.usedGb / d.sizeGb) * 100);
    const color = pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : '#10b981';
    return `
      <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:8px; padding:12px;">
        <div style="display:flex; justify-content:space-between; margin-bottom:6px; font-size:12px;">
          <span style="font-weight:700; color:#f8fafc;">💽 ${d.name} (${d.type || 'SSD'})</span>
          <span style="color:#94a3b8;">마운트: <b style="color:#38bdf8;">${d.mount}</b></span>
        </div>
        <div style="display:flex; justify-content:space-between; font-size:11px; color:#64748b; margin-bottom:4px;">
          <span>사용량: ${d.usedGb} GB / ${d.sizeGb} GB</span>
          <span>${pct}%</span>
        </div>
        <div style="height:6px; background:#1e293b; border-radius:999px; overflow:hidden;">
          <div style="width:${pct}%; height:100%; background:${color};"></div>
        </div>
      </div>
    `;
  }).join('');

  const podsHtml = hostedPods.length === 0
    ? `<tr><td colspan="6" style="text-align:center; padding:24px; color:#64748b;">현재 이 VM 노드에 스케줄된 파드가 없습니다. 워크로드 탭에서 파드를 배포해보세요.</td></tr>`
    : hostedPods.map(p => {
        const isRun = p.status === 'Running';
        return `
          <tr>
            <td style="font-family:monospace; color:#38bdf8; font-weight:700;">${p.name}</td>
            <td><span class="badge blue">${p.namespace || 'default'}</span></td>
            <td><span class="badge ${isRun ? 'green' : 'amber'}">● ${p.status}</span></td>
            <td style="font-family:monospace; color:#a855f7;">${p.ip || 'None'}</td>
            <td style="font-size:11px; color:#cbd5e1;">${p.cpuReqM}m / ${p.ramReqMi || Math.round(p.cpuReqM * 1.28)}Mi</td>
            <td style="font-size:11px; color:#94a3b8;">${p.lifeSeconds ? (p.lifeSeconds + 's') : '영구 지속'}</td>
          </tr>
        `;
      }).join('');

  const nodePortHtml = nodePortSvcs.length === 0
    ? `<div style="padding:16px; text-align:center; color:#64748b; font-size:12px;">현재 등록된 NodePort 서비스가 없습니다.</div>`
    : nodePortSvcs.map(s => {
        const portNum = s.nodePort;
        const targetUrl = `/vhost/${node.name}.ktci5.kr:${portNum}/?labId=${encodeURIComponent(labId)}`;
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; background:#0b0f19; border:1px solid #1f293d; border-radius:8px; padding:12px; margin-bottom:8px; flex-wrap:wrap; gap:10px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:700; color:#f8fafc; font-size:13px;">${s.name}</span>
                <span class="badge purple">NodePort :${portNum}</span>
                <span class="badge blue">ClusterIP: ${s.clusterIp}:${s.port}</span>
              </div>
              <div style="font-size:11px; color:#64748b; margin-top:3px;">
                외부 엔드포인트: <span style="font-family:monospace; color:#38bdf8;">http://${node.name}.ktci5.kr:${portNum}/</span>
              </div>
            </div>
            <div style="display:flex; gap:6px;">
              <button class="btn-action" onclick="testNodePort(${portNum})" id="np-btn-${portNum}" style="padding:4px 10px; font-size:11px;">⚡ 인라인 호출</button>
              <a href="${targetUrl}" target="_blank" class="btn-action" style="padding:4px 10px; font-size:11px; background:#0284c7; border-color:#0ea5e9; text-decoration:none;">🌐 새 창 열기</a>
            </div>
          </div>
        `;
      }).join('');

  const otherNodes = (lab.nodes || []).map(n => {
    const isCur = n.name === node.name;
    return `<a href="/vhost/${n.name}.ktci5.kr/?labId=${encodeURIComponent(labId)}" class="chip-btn ${isCur ? 'primary' : ''}" style="text-decoration:none; padding:4px 10px; font-size:11.5px;">🖥️ ${n.name} (${n.ip})</a>`;
  }).join(' ');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KT Cloud 5기 - VM 노드 콘솔 [${node.name}.ktci5.kr]</title>
  <style>
    ${commonVirtualStyles()}
    .hero-box {
      background: linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%);
      border: 1px solid #334155; border-radius: 12px; padding: 24px; margin-bottom: 20px;
    }
    .node-header {
      display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 14px;
    }
  </style>
</head>
<body>
  ${commonVirtualNav(`${node.name}.ktci5.kr`, port, path, lab)}

  <div class="v-container">
    <div class="hero-box">
      <div class="node-header">
        <div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
            <span class="badge ${node.status === 'Ready' && !isDiskPressure ? 'green' : 'red'}">
              ● ${isDiskPressure ? 'DiskPressure' : node.status} (kubelet v1.30.2)
            </span>
            <span class="badge blue">${isMaster ? 'CONTROL-PLANE' : 'WORKER NODE'}</span>
            <span class="badge purple">IP: ${node.ip}</span>
            <span class="badge amber">클러스터 랩: ${lab.name || lab.id}</span>
          </div>
          <h1 style="font-size:24px; font-weight:800; color:#ffffff; font-family:monospace; display:flex; align-items:center; gap:8px;">
            🖥️ ${node.name}.ktci5.kr
          </h1>
          <p style="font-size:13px; color:#94a3b8; margin-top:4px;">
            KT Cloud 인프라 내 가상 머신(VM) 인스턴스이며, 쿠버네티스 컨테이너 런타임 및 노드포트 서비스 데몬이 동작 중입니다.
          </p>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn-action" onclick="location.reload()" style="padding:6px 12px; font-size:12px;">🔄 새로고침</button>
          <a href="/study/simulator?lab=${encodeURIComponent(labId)}" target="_blank" class="btn-action" style="padding:6px 12px; font-size:12px; background:#4338ca; border-color:#6366f1; text-decoration:none;">🖥️ 가상 랩 콘솔</a>
        </div>
      </div>

      <!-- 타 노드로 빠른 전환 -->
      <div style="margin-top:16px; padding-top:14px; border-top:1px solid #1e293b; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <span style="font-size:11.5px; color:#64748b; font-weight:600;">클러스터 노드 바로가기:</span>
        ${otherNodes}
      </div>
    </div>

    <!-- 하드웨어 스펙 및 동적 확장 상태 -->
    <div class="v-card">
      <div class="v-card-header">
        <div class="v-card-title">⚙️ 하드웨어 스펙 &amp; 동적 확장 자원 (Hot-Add Live Status)</div>
        <span style="font-size:11px; color:#64748b;">가상 랩 콘솔에서 스펙 변경 시 실시간 반영</span>
      </div>
      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">가상 CPU (vCPU)</div>
          <div class="info-val" style="color:#38bdf8;">${node.cpuTotalM / 1000} Core (${node.cpuTotalM}m)</div>
        </div>
        <div class="info-box">
          <div class="info-label">메모리 (RAM)</div>
          <div class="info-val" style="color:#10b981;">${(node.ramTotalMi / 1024).toFixed(1)} GiB (${node.ramTotalMi} MiB)</div>
        </div>
        <div class="info-box">
          <div class="info-label">OS 및 커널</div>
          <div class="info-val" style="color:#a855f7; font-size:12px;">Ubuntu 22.04 LTS (Kernel 5.15)</div>
        </div>
        <div class="info-box">
          <div class="info-label">컨테이너 런타임</div>
          <div class="info-val" style="color:#fbbf24; font-size:12px;">containerd://1.7.11</div>
        </div>
      </div>

      <!-- 디스크 목록 -->
      <div style="margin-top:14px;">
        <div style="font-size:12px; font-weight:700; color:#cbd5e1; margin-bottom:8px;">마운트된 가상 디스크 볼륨 (${(node.disks || []).length}개)</div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:10px;">
          ${disksHtml}
        </div>
      </div>
    </div>

    <!-- 호스팅 파드 목록 -->
    <div class="v-card">
      <div class="v-card-header">
        <div class="v-card-title">📦 현재 노드에 배치된 파드 (${hostedPods.length}개)</div>
        <span class="badge blue">Kubelet Pod Manager</span>
      </div>
      <table class="v-table" style="width:100%; border-collapse:collapse; font-size:12px;">
        <thead>
          <tr style="background:#0b0f19; border-bottom:1px solid #1f293d;">
            <th style="padding:8px 12px; text-align:left; color:#94a3b8; font-size:11px;">파드 이름 (Pod Name)</th>
            <th style="padding:8px 12px; text-align:left; color:#94a3b8; font-size:11px;">네임스페이스</th>
            <th style="padding:8px 12px; text-align:left; color:#94a3b8; font-size:11px;">상태 (Status)</th>
            <th style="padding:8px 12px; text-align:left; color:#94a3b8; font-size:11px;">파드 내부 IP</th>
            <th style="padding:8px 12px; text-align:left; color:#94a3b8; font-size:11px;">요구 자원 (CPU/RAM)</th>
            <th style="padding:8px 12px; text-align:left; color:#94a3b8; font-size:11px;">동작 수명</th>
          </tr>
        </thead>
        <tbody>
          ${podsHtml}
        </tbody>
      </table>
    </div>

    <!-- NodePort 리스너 및 서비스 -->
    <div class="v-card">
      <div class="v-card-header">
        <div class="v-card-title">🔌 활성화된 NodePort 리스너 &amp; 서비스 엔드포인트</div>
        <span style="font-size:11px; color:#64748b;">포트 범위: 30000-32767</span>
      </div>
      <div>
        ${nodePortHtml}
      </div>
      <div id="test-result-box" style="display:none; margin-top:12px; padding:12px; background:#0b0f19; border:1px solid #1f293d; border-radius:6px; font-size:12px; font-family:monospace; color:#38bdf8; line-height:1.6;"></div>
    </div>

    <!-- 시스템 진단 터미널 -->
    <div class="v-card">
      <div class="v-card-header">
        <div class="v-card-title">💻 노드 진단 터미널 로그 (System Diagnostics)</div>
        <span style="font-size:11px; color:#10b981;">● Active Systemd Services</span>
      </div>
      <pre style="background:#0b0f19; border:1px solid #1f293d; border-radius:6px; padding:14px; font-size:11.5px; line-height:1.6; color:#94a3b8; overflow-x:auto; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
<span style="color:#38bdf8;">root@${node.name}:~#</span> ip addr show eth0
2: eth0: &lt;BROADCAST,MULTICAST,UP,LOWER_UP&gt; mtu 1500 qdisc mq state UP group default qlen 1000
    inet <span style="color:#10b981;">${node.ip}/24</span> brd 10.10.10.255 scope global eth0
<span style="color:#38bdf8;">root@${node.name}:~#</span> systemctl status kubelet --no-pager
● kubelet.service - kubelet: The Kubernetes Node Agent
     Loaded: loaded (/lib/systemd/system/kubelet.service; enabled; vendor preset: enabled)
     Active: <span style="color:#10b981;">active (running)</span> since Mon 2026-09-22 09:00:00 KST
     Tasks: 19 (limit: 4915)
     Memory: 38.4M
     CGroup: /system.slice/kubelet.service
<span style="color:#38bdf8;">root@${node.name}:~#</span> ss -tulpn | grep -E 'LISTEN'
tcp   LISTEN 0      4096       127.0.0.1:10248      0.0.0.0:*    users:(("kubelet",pid=842,fd=12))
tcp   LISTEN 0      4096         0.0.0.0:10250      0.0.0.0:*    users:(("kubelet",pid=842,fd=14))
${(nodePortSvcs || []).map(s => `tcp   LISTEN 0      4096         0.0.0.0:${s.nodePort}      0.0.0.0:*    users:(("kube-proxy",pid=910,fd=7))`).join('\n')}
      </pre>
    </div>
  </div>

  <footer class="v-footer">
    KT Cloud 제5기 클라우드 인프라 &amp; K8s 아키텍처 실습 | VM Hostname: ${node.name}.ktci5.kr (${node.ip})
  </footer>

  <script>
    async function testNodePort(port) {
      const btn = document.getElementById('np-btn-' + port);
      const resBox = document.getElementById('test-result-box');
      if (btn) btn.innerText = '호출 중...';
      try {
        const start = performance.now();
        const res = await fetch('/vhost/${node.name}.ktci5.kr:' + port + '/?labId=${encodeURIComponent(labId)}&ajax=1');
        const data = await res.json();
        const duration = (performance.now() - start).toFixed(1);
        if (resBox) {
          resBox.style.display = 'block';
          resBox.innerHTML = '➔ [200 OK] NodePort :' + port + ' 응답 성공 (' + duration + 'ms)<br>' +
            '타겟 파드: <b style="color:#10b981;">' + (data.pod || 'unknown') + '</b> (IP: ' + (data.podIp || '10.244.x.x') + ' / 노드: ' + (data.podNode || '${node.name}') + ')<br>' +
            '타겟 서비스: ' + (data.service || 'NodePort Service');
        }
      } catch (err) {
        if (resBox) {
          resBox.style.display = 'block';
          resBox.innerHTML = '<span style="color:#ef4444;">➔ 호출 실패: ' + err.message + '</span>';
        }
      } finally {
        if (btn) btn.innerText = '⚡ 인라인 호출';
      }
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=UTF-8', 'cache-control': 'no-store' }
  });
}

// 0-B. NodePort 프록시 경유 서비스 웹 페이지 (NodePort Proxy Service Page)
function renderNodePortServicePage({ node, service, nodePort, chosenPod, path, lab, net }) {
  const labId = lab?.id || 'lab-default';
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KT Cloud 5기 - NodePort :${nodePort} [${service.name}]</title>
  <style>
    ${commonVirtualStyles()}
    .np-banner {
      background: linear-gradient(135deg, rgba(67, 56, 202, 0.3) 0%, rgba(14, 165, 233, 0.2) 100%);
      border: 1px solid #6366f1; border-radius: 10px; padding: 18px; margin-bottom: 20px;
    }
  </style>
</head>
<body>
  ${commonVirtualNav(`${node.name}.ktci5.kr`, nodePort, path, lab)}

  <div class="v-container">
    <div class="np-banner">
      <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
            <span class="badge purple">● 200 OK Kubernetes NodePort</span>
            <span class="badge blue">노드: ${node.name} (${node.ip})</span>
            <span class="badge green">타겟 파드: ${chosenPod.name}</span>
          </div>
          <h1 style="font-size:20px; font-weight:800; color:#ffffff;">
            🌐 NodePort :${nodePort} ➔ 서비스: ${service.name}
          </h1>
          <p style="font-size:12.5px; color:#cbd5e1; margin-top:4px;">
            클러스터 외부에서 VM 노드 <b style="color:#38bdf8;">${node.name}.ktci5.kr:${nodePort}</b>로 요청이 유입되어 kube-proxy를 거쳐 파드로 포워딩되었습니다.
          </p>
        </div>
        <div>
          <a href="/vhost/${node.name}.ktci5.kr/?labId=${encodeURIComponent(labId)}" class="btn-action" style="padding:6px 12px; font-size:12px; text-decoration:none;">🖥️ VM 노드 콘솔 보기</a>
        </div>
      </div>
    </div>

    <!-- 파드 응답 및 로드밸런싱 검증 카드 -->
    <div class="v-card">
      <div class="v-card-header">
        <div class="v-card-title">⚡ 파드 트래픽 처리 정보</div>
        <span class="badge green">Active Running Pod</span>
      </div>
      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">서비스 명칭</div>
          <div class="info-val" style="color:#38bdf8;">${service.name} (ClusterIP: ${service.clusterIp}:${service.port})</div>
        </div>
        <div class="info-box">
          <div class="info-label">응답 파드</div>
          <div class="info-val" id="pod-name" style="color:#10b981;">${chosenPod.name}</div>
        </div>
        <div class="info-box">
          <div class="info-label">파드 IP 및 위치</div>
          <div class="info-val" id="pod-node" style="color:#a855f7;">${chosenPod.ip} (노드: ${chosenPod.node})</div>
        </div>
        <div class="info-box">
          <div class="info-label">노드포트 포트</div>
          <div class="info-val" style="color:#fbbf24;">:${nodePort}</div>
        </div>
      </div>
    </div>

    <!-- HTTP 응답 바디 -->
    <div class="v-card">
      <div class="v-card-header">
        <div class="v-card-title">📄 서비스 응답 (Application Payload)</div>
      </div>
      <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:6px; padding:16px;">
        <h2 style="font-size:16px; color:#f8fafc; margin-bottom:8px;">Welcome to ${service.name}!</h2>
        <p style="font-size:13px; color:#94a3b8; line-height:1.6;">
          이 페이지는 KT Cloud 5기 K8s 가상 머신 <b>${node.name}</b>의 <b>NodePort :${nodePort}</b>를 통해 서빙되고 있는 애플리케이션 서비스입니다.<br/>
          도커/컨테이너 이미지 <code>${chosenPod.image || 'nginx:1.25'}</code> 가 성공적으로 구동되어 실시간 클러스터 네트워크 트래픽을 처리하고 있습니다.
        </p>
      </div>
    </div>
  </div>

  <footer class="v-footer">
    KT Cloud 제5기 클라우드 인프라 &amp; K8s 아키텍처 실습 | NodePort :${nodePort} on ${node.name}.ktci5.kr
  </footer>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=UTF-8', 'cache-control': 'no-store' }
  });
}

function commonVirtualStyles() {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      background: #090d16;
      color: #f1f5f9;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      line-height: 1.5;
    }
    .v-nav {
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
    }
    .v-nav-brand { display: flex; align-items: center; gap: 10px; }
    .v-nav-logo { font-size: 22px; }
    .v-nav-title { font-size: 15px; font-weight: 700; color: #f8fafc; display: block; }
    .v-nav-sub { font-size: 11px; color: #94a3b8; display: block; }
    .v-nav-links { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .v-link {
      font-size: 12px; font-weight: 600; color: #94a3b8; text-decoration: none; padding: 5px 10px; border-radius: 6px;
      border: 1px solid transparent; transition: all 0.15s;
    }
    .v-link:hover { color: #f8fafc; background: #1e293b; }
    .v-link.active { color: #38bdf8; background: rgba(56, 189, 248, 0.1); border-color: rgba(56, 189, 248, 0.3); }
    .v-btn-console {
      font-size: 12px; font-weight: 700; color: #ffffff; background: #4f46e5; text-decoration: none; padding: 6px 12px; border-radius: 6px;
      border: 1px solid #6366f1; transition: background 0.15s; margin-left: 6px;
    }
    .v-btn-console:hover { background: #4338ca; }
    
    .v-container { max-width: 1080px; width: 100%; margin: 0 auto; padding: 28px 20px; flex: 1; }
    .v-card {
      background: #111827; border: 1px solid #1f293d; border-radius: 12px; padding: 24px; margin-bottom: 20px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
    }
    .v-card-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
    .v-card-title { font-size: 17px; font-weight: 700; color: #f8fafc; }
    
    .badge { font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 999px; display: inline-flex; align-items: center; gap: 4px; }
    .badge.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid #059669; }
    .badge.blue { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid #0284c7; }
    .badge.amber { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid #d97706; }
    .badge.red { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid #dc2626; }
    .badge.purple { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid #9333ea; }
    .chip-btn {
      font-size: 11.5px; font-weight: 600; color: #cbd5e1; background: #1e293b; border: 1px solid #334155;
      border-radius: 6px; padding: 4px 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
    }
    .chip-btn:hover { background: #334155; color: #ffffff; }
    .chip-btn.primary { background: #4338ca; color: #ffffff; border-color: #6366f1; }
    
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 16px; }
    .info-box { background: #0b0f19; border: 1px solid #1f293d; border-radius: 8px; padding: 12px 14px; }
    .info-label { font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
    .info-val { font-size: 14px; font-weight: 700; color: #f8fafc; font-family: monospace; }
    
    .btn-action {
      display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; font-size: 13px; font-weight: 700;
      color: #ffffff; background: #0284c7; border: 1px solid #38bdf8; border-radius: 6px; cursor: pointer; transition: all 0.15s;
    }
    .btn-action:hover { background: #0369a1; }
    
    .code-view {
      background: #050811; border: 1px solid #1e293b; border-radius: 8px; padding: 14px; font-family: monospace;
      font-size: 12px; color: #38bdf8; overflow-x: auto; line-height: 1.6;
    }
    
    .v-footer {
      background: #0f172a; border-top: 1px solid #1e293b; padding: 14px 24px; font-size: 11px; color: #64748b;
      text-align: center; margin-top: auto;
    }
  `;
}

// 1. app.ktci5.kr (Production Web Service)
function renderAppServicePage({ host, port, path, service, targetPort, chosenPod, net, lab }) {
  const lbVip = net.loadBalancer?.vip || '211.252.85.10';
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KT Cloud 5기 - ${host} 프로덕션 포털</title>
  <style>
    ${commonVirtualStyles()}
    .hero-box {
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.2) 0%, rgba(14, 165, 233, 0.15) 100%);
      border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 12px; padding: 24px; margin-bottom: 20px;
    }
  </style>
</head>
<body>
  ${commonVirtualNav(host, port, path, lab)}

  <div class="v-container">
    <div class="hero-box">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
        <div>
          <span class="badge green">● 200 OK Production Active</span>
          <span class="badge blue">포트 :${port}</span>
          <span class="badge amber">L7 ALB VIP: ${lbVip}</span>
          <h1 style="font-size:22px; font-weight:800; margin-top:8px; color:#ffffff;">🚀 KT Cloud 제5기 프로덕션 웹 포털</h1>
          <p style="font-size:13px; color:#cbd5e1; margin-top:4px;">
            쿠버네티스 Ingress와 KT Cloud L7 로드밸런서를 통해 서비스 파드로 무중단 트래픽이 실시간 분산 라우팅되고 있습니다.
          </p>
        </div>
      </div>
    </div>

    <!-- 실시간 로드밸런싱 & 파드 응답 카드 -->
    <div class="v-card">
      <div class="v-card-header">
        <div class="v-card-title">⚖️ 실시간 파드 트래픽 분산 & 로드밸런싱 검증</div>
        <button class="btn-action" onclick="testTraffic()" id="btn-traffic">🚀 트래픽 전송 (LB 테스트)</button>
      </div>
      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">타겟 서비스</div>
          <div class="info-val" style="color:#38bdf8;">${service}:${targetPort}</div>
        </div>
        <div class="info-box">
          <div class="info-label">응답 파드 (Active Pod)</div>
          <div class="info-val" id="pod-name" style="color:#10b981;">${chosenPod.name}</div>
        </div>
        <div class="info-box">
          <div class="info-label">파드 IP 및 호스트 노드</div>
          <div class="info-val" id="pod-node" style="color:#a855f7;">${chosenPod.ip} (${chosenPod.node})</div>
        </div>
        <div class="info-box">
          <div class="info-label">응답 지연시간 (Latency)</div>
          <div class="info-val" id="pod-latency" style="color:#fbbf24;">2.1 ms</div>
        </div>
      </div>
      <div style="font-size:12px; color:#94a3b8; background:#0b0f19; border:1px solid #1f293d; border-radius:6px; padding:10px 14px;">
        누적 요청 수: <b id="hit-count" style="color:#ffffff;">1</b>회 | 분산 처리 파드 이력: <span id="pod-history" style="font-family:monospace; color:#38bdf8;">${chosenPod.name}</span>
      </div>
    </div>

    <!-- 수신 HTTP 헤더 및 7계층 라우팅 -->
    <div class="v-card">
      <div class="v-card-title" style="margin-bottom:12px;">🔍 수신 HTTP 요청 & Ingress 7계층 헤더 정보</div>
      <div class="code-view">
Host: ${host}:${port}
X-Forwarded-Host: ${host}
X-Forwarded-For: ${lbVip}
X-Forwarded-Proto: ${port === 443 ? 'https' : 'http'}
X-Target-Service: ${service}:${targetPort}
X-Routed-Pod: ${chosenPod.name} (${chosenPod.ip})
X-Origin-Node: ${chosenPod.node}
X-Tunnel-Status: ${net.tunnel?.status || 'CONNECTED'}
X-LoadBalancer-VIP: ${lbVip}
X-Ingress-Controller: KT-Cloud-ALB/2.4 (L7 Reverse Proxy & Ingress)
      </div>
    </div>

    <!-- 7계층 토폴로지 패킷 흐름 -->
    <div class="v-card">
      <div class="v-card-title" style="margin-bottom:8px;">🌐 네트워크 7-Layer 패킷 라우팅 경로</div>
      <div style="font-size:12px; color:#94a3b8; line-height:1.7;">
        • <b>L1 물리/허브:</b> kt-l1-virtual-hub (100% Signal)<br>
        • <b>L2 데이터링크:</b> kt-vswitch-dist-01 (VLAN 100, 10Gbps Open vSwitch)<br>
        • <b>L3 네트워크:</b> kt-vrouter-core-01 (Gateway: 10.10.0.1, CIDR: 10.10.0.0/16)<br>
        • <b>L4 전송:</b> L7 ALB VIP (${lbVip}:${port}) ➔ ClusterIP (10.96.100.50:80)<br>
        • <b>L5 세션:</b> Cloudflare Argo Hybrid Tunnel (ChaCha20-Poly1305)<br>
        • <b>L6 표현:</b> TLS 1.3 암호화 종단 (SSL Termination)<br>
        • <b>L7 응용/인그레스:</b> Host '${host}' ➔ Service '${service}' ➔ Pod '${chosenPod.name}'
      </div>
    </div>
  </div>

  <footer class="v-footer">
    KT Cloud 5기 클라우드 인프라 엔지니어링 실습 포털 · L7 Ingress ALB VIP: ${lbVip} · 도메인: ${host}:${port}${path}
  </footer>

  <script>
    let hits = 1;
    async function testTraffic() {
      const btn = document.getElementById('btn-traffic');
      btn.innerText = '⏳ 처리 중...';
      btn.style.opacity = '0.7';
      try {
        const res = await fetch('/api/simulator/browse?host=${host}&port=${port}&path=${encodeURIComponent(path)}&labId=${encodeURIComponent(lab?.id || 'lab-default')}&ajax=1&_t=' + Date.now());
        const data = await res.json();
        if (data.ok) {
          hits++;
          document.getElementById('pod-name').innerText = data.pod;
          document.getElementById('pod-node').innerText = data.podIp + ' (' + data.node + ')';
          document.getElementById('pod-latency').innerText = data.latencyMs + ' ms';
          document.getElementById('hit-count').innerText = hits;
          const hist = document.getElementById('pod-history');
          hist.innerText = data.pod + ' ➔ ' + hist.innerText;
        }
      } catch (err) {
        console.error('Traffic test error:', err);
      } finally {
        btn.innerText = '🚀 트래픽 전송 (LB 테스트)';
        btn.style.opacity = '1';
      }
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'X-Virtual-Host': `${host}:${port}${path}`,
      'X-Target-Service': `${service}:${targetPort}`,
      'X-Routed-Pod': chosenPod.name
    }
  });
}

// 2. api.ktci5.kr (REST API Backend & Interactive Console)
function renderApiServicePage({ host, port, path, service, targetPort, chosenPod, net, lab, wantsJson }) {
  const lbVip = net.loadBalancer?.vip || '211.252.85.10';

  // 순수 JSON 응답 요청 시
  if (wantsJson || path.startsWith('/api/v1/')) {
    let payload = {};
    if (path.includes('/nodes')) {
      payload = {
        endpoint: '/api/v1/nodes',
        service,
        clusterNodes: (lab.nodes || []).map(n => ({ name: n.name, role: n.role, ip: n.ip, status: n.status, cpuM: n.cpuTotalM, ramMi: n.ramTotalMi }))
      };
    } else if (path.includes('/pods')) {
      payload = {
        endpoint: '/api/v1/pods',
        service,
        clusterPods: (lab.pods || []).map(p => ({ name: p.name, node: p.node, ip: p.ip, status: p.status, image: p.image }))
      };
    } else if (path.includes('/ingress')) {
      payload = {
        endpoint: '/api/v1/ingress',
        service,
        rules: net.ingress?.rules || []
      };
    } else if (path.includes('/network')) {
      payload = {
        endpoint: '/api/v1/network',
        loadBalancer: net.loadBalancer,
        tunnel: net.tunnel,
        vpn: net.vpn
      };
    } else {
      payload = {
        apiVersion: 'v1',
        status: 'ACTIVE',
        service: `${service}:${targetPort}`,
        domain: `${host}:${port}`,
        path,
        backendPod: {
          name: chosenPod.name,
          ip: chosenPod.ip,
          node: chosenPod.node,
          image: chosenPod.image || 'python:3.11-alpine'
        },
        databasePool: {
          status: 'CONNECTED',
          activeConnections: 8,
          target: 'db-0: 172.20.2.8:5432'
        },
        clusterState: {
          nodeCount: (lab.nodes || []).length,
          runningPods: (lab.pods || []).filter(p => p.status === 'Running').length,
          tunnelStatus: net.tunnel?.status || 'CONNECTED'
        },
        message: 'KT Cloud 5기 REST API 백엔드 서비스가 정상 운용 중입니다.'
      };
    }

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=UTF-8',
        'cache-control': 'no-store',
        'X-Virtual-Host': `${host}:${port}${path}`
      }
    });
  }

  // 브라우저 렌더링 (인터랙티브 API 콘솔)
  const defaultJson = JSON.stringify({
    apiVersion: 'v1',
    status: 'ACTIVE',
    service: `${service}:${targetPort}`,
    domain: `${host}:${port}`,
    path,
    routedPod: {
      name: chosenPod.name,
      ip: chosenPod.ip,
      node: chosenPod.node,
      image: chosenPod.image || 'python:3.11-alpine'
    },
    databasePool: {
      status: 'CONNECTED',
      activeConnections: 8,
      target: 'db-0: 172.20.2.8:5432'
    },
    message: 'KT Cloud 5기 REST API 백엔드 서비스 정상 가동 중'
  }, null, 2);

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KT Cloud 5기 - ${host} REST API 콘솔</title>
  <style>
    ${commonVirtualStyles()}
    .api-nav-btn {
      background: #1e293b; border: 1px solid #334155; color: #cbd5e1; font-size: 11px; font-weight: 600;
      padding: 6px 12px; border-radius: 6px; cursor: pointer; transition: all 0.15s; font-family: monospace;
    }
    .api-nav-btn:hover { background: #334155; color: #38bdf8; border-color: #38bdf8; }
    .api-nav-btn.active { background: rgba(56, 189, 248, 0.15); color: #38bdf8; border-color: #0284c7; }
  </style>
</head>
<body>
  ${commonVirtualNav(host, port, path, lab)}

  <div class="v-container">
    <div class="v-card" style="border-color: rgba(56, 189, 248, 0.3);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
        <div>
          <span class="badge green">● 200 OK (REST API)</span>
          <span class="badge blue">호스트: ${host}:${port}</span>
          <span class="badge amber">경로: ${path}</span>
          <h1 style="font-size:22px; font-weight:800; margin-top:8px; color:#ffffff;">⚡ KT Cloud 제5기 REST API 백엔드 콘솔</h1>
          <p style="font-size:13px; color:#94a3b8; margin-top:4px;">
            파이썬/FastAPI 기반 백엔드 서비스가 Ingress 라우팅 규칙에 따라 안전하게 격리 노출되고 있습니다.
          </p>
        </div>
        <a href="/api/simulator/browse?host=${host}&port=${port}&path=${encodeURIComponent(path)}&labId=${encodeURIComponent(lab?.id || 'lab-default')}&format=json" target="_blank" class="btn-action" style="background:#0f172a; border-color:#38bdf8; font-size:11px;">
          📄 Raw JSON 열기
        </a>
      </div>
    </div>

    <!-- API 인터랙티브 테스트 툴바 -->
    <div class="v-card">
      <div class="v-card-header">
        <div class="v-card-title">📡 엔드포인트 직접 호출 및 응답 테스트</div>
        <span id="api-call-status" style="font-size:11px; color:#10b981; font-weight:bold;">준비 완료</span>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px;">
        <button class="api-nav-btn active" onclick="callEndpoint('/api/v1/health', this)">GET /api/v1/health</button>
        <button class="api-nav-btn" onclick="callEndpoint('/api/v1/nodes', this)">GET /api/v1/nodes</button>
        <button class="api-nav-btn" onclick="callEndpoint('/api/v1/pods', this)">GET /api/v1/pods</button>
        <button class="api-nav-btn" onclick="callEndpoint('/api/v1/ingress', this)">GET /api/v1/ingress</button>
        <button class="api-nav-btn" onclick="callEndpoint('/api/v1/network', this)">GET /api/v1/network</button>
      </div>

      <!-- JSON 뷰어 -->
      <div class="code-view" id="json-viewer" style="max-height:400px; overflow-y:auto; color:#38bdf8;">${defaultJson}</div>
    </div>

    <!-- 백엔드 메타데이터 -->
    <div class="v-card">
      <div class="v-card-title" style="margin-bottom:12px;">📊 백엔드 컨테이너 & 데이터베이스 풀 상태</div>
      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">백엔드 서비스</div>
          <div class="info-val" style="color:#38bdf8;">${service}:${targetPort}</div>
        </div>
        <div class="info-box">
          <div class="info-label">실행 파드 (Container)</div>
          <div class="info-val" style="color:#10b981;">${chosenPod.name}</div>
        </div>
        <div class="info-box">
          <div class="info-label">내부 IP 및 노드</div>
          <div class="info-val" style="color:#a855f7;">${chosenPod.ip} (${chosenPod.node})</div>
        </div>
        <div class="info-box">
          <div class="info-label">DB 커넥션 풀</div>
          <div class="info-val" style="color:#10b981;">CONNECTED (db-0)</div>
        </div>
      </div>
    </div>
  </div>

  <footer class="v-footer">
    KT Cloud 5기 클라우드 인프라 엔지니어링 실습 포털 · REST API Backend Console · ${host}:${port}${path}
  </footer>

  <script>
    async function callEndpoint(ep, btn) {
      document.querySelectorAll('.api-nav-btn').forEach(b => b.classList.remove('active'));
      if (btn) btn.classList.add('active');
      const st = document.getElementById('api-call-status');
      st.innerText = '호출 중... (' + ep + ')';
      st.style.color = '#38bdf8';
      try {
        const res = await fetch('/api/simulator/browse?host=${host}&port=${port}&path=' + encodeURIComponent(ep) + '&labId=${encodeURIComponent(lab?.id || 'lab-default')}&format=json&_t=' + Date.now());
        const data = await res.json();
        document.getElementById('json-viewer').innerText = JSON.stringify(data, null, 2);
        st.innerText = '● 200 OK (' + ep + ')';
        st.style.color = '#10b981';
      } catch (err) {
        st.innerText = '✕ 호출 실패';
        st.style.color = '#ef4444';
      }
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'X-Virtual-Host': `${host}:${port}${path}`
    }
  });
}

// 3. dev.ktci5.kr (Staging & Dev Service)
function renderDevServicePage({ host, port, path, service, targetPort, chosenPod, net, lab }) {
  const lbVip = net.loadBalancer?.vip || '211.252.85.10';
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>KT Cloud 5기 - ${host} 스테이징 콘솔</title>
  <style>
    ${commonVirtualStyles()}
    .staging-banner {
      background: rgba(245, 158, 11, 0.15); border: 1px solid #d97706; border-radius: 8px; padding: 10px 16px;
      margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 10px;
    }
  </style>
</head>
<body>
  ${commonVirtualNav(host, port, path, lab)}

  <div class="v-container">
    <div class="staging-banner">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="font-size:18px;">⚠️</span>
        <span style="font-size:12.5px; font-weight:700; color:#fbbf24;">STAGING / DEV ENVIRONMENT - 내부 테스트 및 스테이징 전용 환경</span>
      </div>
      <span class="badge amber">SSL: TLS 1.3 Strict</span>
    </div>

    <div class="v-card" style="border-color:#334155;">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
        <div>
          <span class="badge green">● 200 OK Staging Active</span>
          <span class="badge blue">HTTPS :${port}</span>
          <span class="badge amber">VIP: ${lbVip}</span>
          <h1 style="font-size:22px; font-weight:800; margin-top:8px; color:#ffffff;">🧪 KT Cloud 제5기 개발 & 스테이징 환경</h1>
          <p style="font-size:13px; color:#94a3b8; margin-top:4px;">
            안전한 HTTPS(TLS 1.3) 전송 프로토콜을 통해 스테이징 브랜치 최신 빌드가 구동 중입니다.
          </p>
        </div>
      </div>
    </div>

    <!-- CI/CD 배포 및 파드 정보 -->
    <div class="v-card">
      <div class="v-card-header">
        <div class="v-card-title">📦 CI/CD 파이프라인 빌드 & 스테이징 파드</div>
        <button class="btn-action" onclick="runStagingCheck()" id="btn-stage" style="background:#d97706; border-color:#f59e0b;">🧪 스테이징 헬스체크</button>
      </div>
      <div class="info-grid">
        <div class="info-box">
          <div class="info-label">타겟 서비스</div>
          <div class="info-val" style="color:#38bdf8;">${service}:${targetPort}</div>
        </div>
        <div class="info-box">
          <div class="info-label">스테이징 파드 (Pod)</div>
          <div class="info-val" id="stage-pod" style="color:#10b981;">${chosenPod.name}</div>
        </div>
        <div class="info-box">
          <div class="info-label">빌드 브랜치 / 커밋</div>
          <div class="info-val" style="color:#a855f7;">develop (#42)</div>
        </div>
        <div class="info-box">
          <div class="info-label">TLS 암호화 모드</div>
          <div class="info-val" style="color:#10b981;">TLS 1.3 Strict</div>
        </div>
      </div>
    </div>

    <!-- 기능 플래그 및 디버그 설정 -->
    <div class="v-card">
      <div class="v-card-title" style="margin-bottom:12px;">⚙️ 스테이징 기능 플래그 (Feature Flags)</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(200px, 1fr)); gap:10px; font-size:12px;">
        <div style="background:#0b0f19; padding:10px; border-radius:6px; border:1px solid #1f293d;">
          <div style="color:#94a3b8;">DEBUG_LOGGING</div>
          <div style="color:#10b981; font-weight:bold;">ENABLED (Verbose)</div>
        </div>
        <div style="background:#0b0f19; padding:10px; border-radius:6px; border:1px solid #1f293d;">
          <div style="color:#94a3b8;">MOCK_PAYMENT_GW</div>
          <div style="color:#38bdf8; font-weight:bold;">ACTIVE (Sandbox)</div>
        </div>
        <div style="background:#0b0f19; padding:10px; border-radius:6px; border:1px solid #1f293d;">
          <div style="color:#94a3b8;">DATABASE_TARGET</div>
          <div style="color:#fbbf24; font-weight:bold;">db-staging-replica</div>
        </div>
        <div style="background:#0b0f19; padding:10px; border-radius:6px; border:1px solid #1f293d;">
          <div style="color:#94a3b8;">CANARY_WEIGHT</div>
          <div style="color:#ffffff; font-weight:bold;">0% (Staging-Only)</div>
        </div>
      </div>
    </div>
  </div>

  <footer class="v-footer">
    KT Cloud 5기 클라우드 인프라 엔지니어링 실습 포털 · Staging CI/CD Environment · ${host}:${port}${path}
  </footer>

  <script>
    async function runStagingCheck() {
      const btn = document.getElementById('btn-stage');
      btn.innerText = '진단 중...';
      try {
        const res = await fetch('/api/simulator/browse?host=${host}&port=${port}&path=${encodeURIComponent(path)}&labId=${encodeURIComponent(lab?.id || 'lab-default')}&ajax=1&_t=' + Date.now());
        const data = await res.json();
        if (data.ok) {
          alert('✅ [스테이징 진단 완료] 파드 ' + data.pod + ' (' + data.podIp + ') 가 정상 응답했습니다. (지연시간: ' + data.latencyMs + 'ms)');
        }
      } catch (e) {
        alert('진단 실패: ' + e.message);
      } finally {
        btn.innerText = '🧪 스테이징 헬스체크';
      }
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'X-Virtual-Host': `${host}:${port}${path}`
    }
  });
}

// 4. Custom / Generic Ingress Domain Page
function renderGenericServicePage({ host, port, path, service, targetPort, chosenPod, net, lab }) {
  const lbVip = net.loadBalancer?.vip || '211.252.85.10';
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>KT Cloud 5기 - ${host}</title>
  <style>${commonVirtualStyles()}</style>
</head>
<body>
  ${commonVirtualNav(host, port, path, lab)}
  <div class="v-container">
    <div class="v-card">
      <span class="badge green">● 200 OK Active</span>
      <span class="badge blue">호스트: ${host}:${port}</span>
      <h1 style="font-size:22px; font-weight:800; margin-top:8px; color:#ffffff;">🌐 ${host} 가상 웹 서비스</h1>
      <p style="font-size:13px; color:#94a3b8; margin-top:4px;">사용자 정의 Ingress 라우팅 규칙에 따라 파드로 트래픽이 전달되었습니다.</p>
    </div>
    <div class="v-card">
      <div class="info-grid">
        <div class="info-box"><div class="info-label">타겟 서비스</div><div class="info-val" style="color:#38bdf8;">${service}:${targetPort}</div></div>
        <div class="info-box"><div class="info-label">응답 파드</div><div class="info-val" style="color:#10b981;">${chosenPod.name}</div></div>
        <div class="info-box"><div class="info-label">파드 IP</div><div class="info-val" style="color:#a855f7;">${chosenPod.ip}</div></div>
        <div class="info-box"><div class="info-label">L7 Ingress VIP</div><div class="info-val" style="color:#fbbf24;">${lbVip}</div></div>
      </div>
    </div>
  </div>
  <footer class="v-footer">KT Cloud 5기 클라우드 인프라 실습 · ${host}:${port}${path}</footer>
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=UTF-8', 'cache-control': 'no-store' }
  });
}

// 5. [예외] 502 Bad Gateway (Cloudflare Argo Tunnel Disconnected)
function render502BadGatewayResponse({ host, port, path, net, lab }) {
  const lbVip = net.loadBalancer?.vip || '211.252.85.10';
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>502 Bad Gateway - Cloudflare Argo Tunnel</title>
  <style>
    ${commonVirtualStyles()}
    .err-box {
      background: #1e1b4b; border: 1px solid #dc2626; border-radius: 12px; padding: 24px; margin-bottom: 20px;
    }
  </style>
</head>
<body>
  ${commonVirtualNav(host, port, path, lab)}

  <div class="v-container">
    <div class="err-box">
      <span class="badge red">● 502 Bad Gateway</span>
      <h1 style="font-size:24px; font-weight:800; color:#f87171; margin-top:8px;">🚇 Cloudflare Argo Tunnel: Origin Unreachable</h1>
      <p style="font-size:13.5px; color:#cbd5e1; margin-top:6px;">
        Cloudflare 엣지 네트워크와 KT Cloud 가상 클러스터 인프라를 연결하는 터널 데몬(<code>cloudflared</code>) 세션이 단절되어 오리진(VIP: ${lbVip})으로 통신할 수 없습니다.
      </p>
    </div>

    <!-- 패킷 단절 다이어그램 -->
    <div class="v-card">
      <div class="v-card-title" style="margin-bottom:12px;">🔍 네트워크 세션 연결 상태 진단</div>
      <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:8px; padding:16px; font-family:monospace; font-size:13px; line-height:1.8;">
        <div>[브라우저 클라이언트] ➔ 🟢 OK (연결 정상)</div>
        <div>[Cloudflare Anycast 엣지] ➔ 🟢 OK (엣지 캐시 활성)</div>
        <div>[Argo Hybrid Tunnel] ➔ <span style="color:#ef4444; font-weight:bold;">🔴 DISCONNECTED (터널 세션 단절 / 타임아웃)</span></div>
        <div>[KT Cloud L7 Ingress ALB] ➔ <span style="color:#64748b;">⚪ UNREACHABLE (${lbVip}:${port})</span></div>
      </div>
    </div>

    <!-- 문제 해결 가이드 -->
    <div class="v-card">
      <div class="v-card-title" style="margin-bottom:12px;">🛠️ 실전 트러블슈팅 조치 방법</div>
      <div style="font-size:13px; color:#cbd5e1; line-height:1.7;">
        1. 시뮬레이터 콘솔 우측 [🌐 네트워크 & 7계층] 탭의 <b>[🚇 Cloudflare 하이브리드 터널]</b> 패널에서 <b>[터널 재연결]</b> 버튼을 클릭하세요.<br>
        2. 가상 터미널 콘솔에서 터널 데몬 복구 명령을 실행하세요:
        <div class="code-view" style="margin:8px 0;">systemctl restart cloudflared && tunnel status</div>
        3. 터널 상태가 <code>● CONNECTED</code>로 복구된 후 브라우저를 새로고침하세요.
      </div>
    </div>
  </div>

  <footer class="v-footer">
    Cloudflare Argo Tunnel Error 502 · Host: ${host}:${port}${path} · Origin VIP: ${lbVip}
  </footer>
</body>
</html>`;

  return new Response(html, {
    status: 502,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'X-Tunnel-Status': 'DISCONNECTED',
      'X-Error-Code': '502 Bad Gateway'
    }
  });
}

// 6. [예외] 503 Service Unavailable (No Healthy Upstream Pods / Target Pool Unhealthy)
function render503ServiceUnavailableResponse({ host, port, path, targetService, targetPort, candidatePods, unhealthyNodes, targetPool, net, lab }) {
  const lbVip = net.loadBalancer?.vip || '211.252.85.10';
  const poolListHtml = targetPool.map(p => `
    <div style="display:flex; justify-content:space-between; font-family:monospace; font-size:12px; padding:4px 0; border-bottom:1px solid #151d2f;">
      <span>• ${p.target} [${p.nodeName}]</span>
      <span style="color:${p.status.includes('Healthy') ? '#10b981' : '#f87171'}; font-weight:bold;">${p.status}</span>
    </div>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>503 Service Unavailable - Ingress ALB</title>
  <style>${commonVirtualStyles()}</style>
</head>
<body>
  ${commonVirtualNav(host, port, path, lab)}

  <div class="v-container">
    <div class="v-card" style="border-color:#ef4444; background:#1c1017;">
      <span class="badge red">● 503 Service Unavailable</span>
      <h1 style="font-size:24px; font-weight:800; color:#f87171; margin-top:8px;">타겟 서비스 가용 파드 부재 (No Healthy Upstream Pods)</h1>
      <p style="font-size:13.5px; color:#cbd5e1; margin-top:6px;">
        Ingress 라우팅 대상 서비스(<code>${targetService}:${targetPort}</code>)에 매핑된 파드가 없거나, L7 로드밸런서 타겟 풀의 모든 백엔드 노드가 헬스체크 실패(Unhealthy) 상태입니다.
      </p>
    </div>

    <!-- 타겟 풀 상태 테이블 -->
    <div class="v-card">
      <div class="v-card-title" style="margin-bottom:10px;">🎯 L7 로드밸런서 타겟 풀 상태 (VIP: ${lbVip})</div>
      <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:8px; padding:12px;">
        ${poolListHtml || '<div style="color:#94a3b8;">등록된 타겟 엔드포인트가 없습니다.</div>'}
      </div>
      <div style="font-size:12px; color:#94a3b8; margin-top:8px;">
        가용 실행 파드 수: <b style="color:#ffffff;">${(candidatePods || []).length}개</b> | 장애 노드: <b style="color:#f87171;">${(unhealthyNodes || []).join(', ') || '없음'}</b>
      </div>
    </div>

    <!-- 트러블슈팅 가이드 -->
    <div class="v-card">
      <div class="v-card-title" style="margin-bottom:12px;">🛠️ 실전 트러블슈팅 가이드</div>
      <div style="font-size:13px; color:#cbd5e1; line-height:1.7;">
        1. 파드 상태 및 엔드포인트 목록을 점검하세요:
        <div class="code-view" style="margin:6px 0;">kubectl get pods -o wide && kubectl get endpoints ${targetService}</div>
        2. 파드가 스케일 인(0)되어 있다면 즉시 스케일 아웃을 수행하세요:
        <div class="code-view" style="margin:6px 0;">kubectl scale deploy ${targetService.replace('-service', '-deploy')} --replicas=2</div>
        3. 노드가 NotReady 상태이거나 Cordon되어 있다면 노드 상태를 복구하세요:
        <div class="code-view" style="margin:6px 0;">kubectl uncordon &lt;node-name&gt;</div>
      </div>
    </div>
  </div>

  <footer class="v-footer">
    Ingress Controller 503 Service Unavailable · Service: ${targetService} · Host: ${host}:${port}${path}
  </footer>
</body>
</html>`;

  return new Response(html, {
    status: 503,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'X-Error-Code': '503 Service Unavailable'
    }
  });
}

// 7. [예외] 404 Not Found (Ingress Route Unregistered)
function render404NotFoundResponse({ host, port, path, registeredRules, net, lab }) {
  const lbVip = net.loadBalancer?.vip || '211.252.85.10';
  const labId = lab?.id || 'lab-default';
  const validRulesHtml = registeredRules.map(r => `
    <tr>
      <td style="color:#818cf8; font-weight:700;">${r.host}</td>
      <td><b>:${r.port || 80}</b></td>
      <td>${r.path || '/'}</td>
      <td style="color:#38bdf8;">${r.service}</td>
      <td><span class="badge ${r.ssl ? 'green' : 'blue'}">${r.ssl ? 'TLS Valid' : 'HTTP'}</span></td>
      <td><a href="/vhost/${r.host}:${r.port || 80}${r.path || '/'}?labId=${encodeURIComponent(labId)}" class="btn-action" style="padding:3px 8px; font-size:11px; text-decoration:none;">이동</a></td>
    </tr>
  `).join('');

  const vmNodesHtml = (lab?.nodes || []).map(n => `
    <a href="/vhost/${n.name}.ktci5.kr/?labId=${encodeURIComponent(labId)}" class="chip-btn" style="text-decoration:none; padding:5px 12px; font-size:12px; color:#38bdf8; border-color:#0369a1;">🖥️ ${n.name}.ktci5.kr (${n.ip})</a>
  `).join(' ');

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 Not Found - Kubernetes Ingress Controller</title>
  <style>
    ${commonVirtualStyles()}
    .sim-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .sim-table th, .sim-table td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #1f293d; }
    .sim-table th { background: #0b0f19; color: #94a3b8; font-size: 11px; }
  </style>
</head>
<body>
  ${commonVirtualNav(host, port, path, lab)}

  <div class="v-container">
    <div class="v-card" style="border-color:#f59e0b; background:#1c170d;">
      <span class="badge amber">● 404 Not Found</span>
      <h1 style="font-size:24px; font-weight:800; color:#fbbf24; margin-top:8px;">Ingress 라우팅 규칙 미등록 호스트 (default backend - 404)</h1>
      <p style="font-size:13.5px; color:#cbd5e1; margin-top:6px;">
        요청하신 호스트 <code>${host}:${port}${path}</code>에 일치하는 Ingress 라우팅 규칙이 정의되어 있지 않습니다.
      </p>
    </div>

    <!-- 가상 머신(VM) 노드 웹 콘솔 바로가기 -->
    <div class="v-card">
      <div class="v-card-title" style="margin-bottom:10px;">🖥️ 클러스터 가상 머신(VM) 노드 웹 콘솔 바로가기</div>
      <p style="font-size:12px; color:#94a3b8; margin-bottom:12px;">가상 머신 노드 호스트명으로 웹 페이지에 접속할 수 있습니다.</p>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        ${vmNodesHtml || '<span style="color:#64748b; font-size:12px;">사용 가능한 노드가 없습니다.</span>'}
      </div>
    </div>

    <!-- 현재 실등록된 유효 Ingress 도메인 목록 -->
    <div class="v-card">
      <div class="v-card-title" style="margin-bottom:12px;">📋 현재 클러스터에 실등록된 유효 Ingress 규칙 목록</div>
      <div style="overflow-x:auto;">
        <table class="sim-table">
          <thead>
            <tr><th>도메인 (HOST)</th><th>포트</th><th>경로</th><th>타겟 서비스</th><th>SSL</th><th>바로가기</th></tr>
          </thead>
          <tbody>
            ${validRulesHtml || '<tr><td colspan="6" style="text-align:center; color:#94a3b8;">등록된 규칙이 없습니다.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div style="font-size:12px; color:#94a3b8; margin-top:12px;">
        💡 신규 도메인을 연결하려면 시뮬레이터 콘솔에서 <b>[+ 도메인/포트 매핑 추가]</b> 버튼을 클릭하여 호스트를 등록하세요.
      </div>
    </div>
  </div>

  <footer class="v-footer">
    Kubernetes Ingress default backend · Host: ${host}:${port}${path} · VIP: ${lbVip}
  </footer>
</body>
</html>`;

  return new Response(html, {
    status: 404,
    headers: {
      'content-type': 'text/html; charset=UTF-8',
      'cache-control': 'no-store, no-cache, must-revalidate',
      'X-Error-Code': '404 Not Found'
    }
  });
}

// 8. [예외] 400 Bad Request (HTTPS 전용 포트에 평문 HTTP 접근)
function render400HttpsRequiredResponse({ host, port, path }) {
  const httpsUrl = `https://${host}${port === 443 ? '' : (':' + port)}${path}`;
  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <title>400 Bad Request - HTTPS Required</title>
  <style>${commonVirtualStyles()}</style>
</head>
<body>
  <div class="v-container" style="max-width:640px; margin-top:60px;">
    <div class="v-card" style="border-color:#f59e0b;">
      <span class="badge amber">● 400 Bad Request</span>
      <h1 style="font-size:20px; font-weight:700; color:#fbbf24; margin-top:8px;">The plain HTTP request was sent to HTTPS port</h1>
      <p style="font-size:13px; color:#cbd5e1; margin-top:6px;">
        포트 <b>${port}</b>는 TLS 1.3 암호화가 강제되는 HTTPS 전용 포트입니다. 평문(HTTP) 프로토콜로 직접 접근할 수 없습니다.
      </p>
      <div style="margin-top:16px;">
        <a href="${httpsUrl}" class="btn-action">🔒 HTTPS로 안전하게 이동</a>
      </div>
    </div>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 400,
    headers: { 'content-type': 'text/html; charset=UTF-8', 'cache-control': 'no-store' }
  });
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

    /* 우측 하단 AI 인프라 코파일럿 플로팅 위젯 */
    .ai-copilot-trigger {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 999;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 16px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #ffffff;
      border: 1px solid rgba(196, 181, 253, 0.4);
      border-radius: 999px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 10px 25px rgba(79, 70, 229, 0.45);
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      user-select: none;
    }
    .ai-copilot-trigger:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 14px 30px rgba(124, 58, 237, 0.55);
      border-color: #a78bfa;
    }
    .ai-copilot-trigger:active {
      transform: translateY(0) scale(0.98);
    }
    .ai-sparkle {
      font-size: 15px;
      animation: ai-pulse 2s infinite ease-in-out;
    }
    @keyframes ai-pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.2); opacity: 0.8; }
    }
    .ai-trigger-badge {
      font-size: 10.5px;
      padding: 2px 7px;
      border-radius: 999px;
      font-weight: 700;
      background: rgba(16, 185, 129, 0.25);
      color: #6ee7b7;
      border: 1px solid rgba(16, 185, 129, 0.5);
    }
    .ai-trigger-badge.warn {
      background: rgba(239, 68, 68, 0.25);
      color: #fca5a5;
      border-color: rgba(239, 68, 68, 0.5);
      animation: ai-blink 1.5s infinite;
    }
    @keyframes ai-blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    /* AI 코파일럿 대화창 패널 */
    .ai-copilot-panel {
      position: fixed;
      bottom: 72px;
      right: 20px;
      width: 450px;
      max-width: calc(100vw - 40px);
      height: 600px;
      max-height: calc(100vh - 90px);
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 14px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
      display: none;
      flex-direction: column;
      z-index: 1000;
      overflow: hidden;
      backdrop-filter: blur(12px);
      animation: ai-slide-up 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ai-copilot-panel.active {
      display: flex;
    }
    @keyframes ai-slide-up {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .ai-copilot-header {
      padding: 12px 14px;
      background: linear-gradient(90deg, #1e1b4b 0%, #1e293b 100%);
      border-bottom: 1px solid #334155;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-shrink: 0;
    }
    .ai-header-left {
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .ai-avatar {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.4);
    }
    .ai-header-title {
      font-size: 13.5px;
      font-weight: 700;
      color: #f8fafc;
      line-height: 1.2;
    }
    .ai-header-subtitle {
      font-size: 10.5px;
      color: #a5b4fc;
    }
    .ai-close-btn {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 16px;
      padding: 4px;
      border-radius: 4px;
      line-height: 1;
      transition: color 0.15s;
    }
    .ai-close-btn:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.1);
    }

    /* 프리셋 칩 바 */
    .ai-presets-bar {
      padding: 8px 12px;
      background: #131d33;
      border-bottom: 1px solid #1f293d;
      display: flex;
      gap: 6px;
      overflow-x: auto;
      flex-shrink: 0;
    }
    .ai-preset-chip {
      white-space: nowrap;
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 9px;
      border-radius: 999px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .ai-preset-chip:hover {
      background: #312e81;
      color: #e0e7ff;
      border-color: #6366f1;
    }
    .ai-preset-chip.active {
      background: #4f46e5;
      color: #ffffff;
      border-color: #818cf8;
    }

    /* 교안 핵심 퀵 질문 바 */
    .ai-curriculum-bar {
      padding: 6px 10px;
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
      display: flex;
      gap: 5px;
      overflow-x: auto;
      flex-shrink: 0;
    }
    .ai-curr-chip {
      white-space: nowrap;
      background: rgba(30, 41, 59, 0.9);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: #38bdf8;
      font-size: 10.5px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }
    .ai-curr-chip:hover {
      background: rgba(14, 165, 233, 0.2);
      border-color: #38bdf8;
      color: #ffffff;
    }

    /* 대화창 본체 */
    .ai-chat-body {
      flex: 1;
      overflow-y: auto;
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: #090d16;
    }

    /* AI 메시지 카드 */
    .ai-msg {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .ai-msg.user {
      align-self: flex-end;
      max-width: 85%;
    }
    .ai-msg.user .ai-msg-bubble {
      background: #4f46e5;
      color: #ffffff;
      padding: 8px 12px;
      border-radius: 12px 12px 2px 12px;
      font-size: 12px;
      line-height: 1.4;
    }
    .ai-msg.bot {
      align-self: stretch;
    }
    .ai-card {
      background: #141c2e;
      border: 1px solid #23304a;
      border-radius: 10px;
      padding: 12px;
      font-size: 12px;
      color: #e2e8f0;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    }
    .ai-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 6px;
      padding-bottom: 6px;
      border-bottom: 1px solid #1f293d;
    }
    .ai-card-title {
      font-size: 13px;
      font-weight: 700;
      color: #f8fafc;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ai-card-summary {
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.45;
      margin-bottom: 10px;
    }
    .ai-card-answer {
      font-size: 12.5px;
      line-height: 1.55;
      color: #f8fafc;
      background: rgba(15, 23, 42, 0.7);
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 8px;
      padding: 10px 12px;
      margin: 8px 0;
      white-space: pre-line;
    }
    .ai-cmd-section {
      margin-top: 8px;
    }
    .ai-cmd-label {
      font-size: 11px;
      font-weight: 700;
      color: #38bdf8;
      margin-bottom: 4px;
    }
    .ai-screen-note {
      font-size: 11.5px;
      color: #93c5fd;
      background: rgba(59, 130, 246, 0.08);
      border: 1px solid rgba(59, 130, 246, 0.2);
      border-radius: 6px;
      padding: 6px 10px;
      margin-top: 8px;
      line-height: 1.45;
    }
    .ai-tip-note {
      font-size: 11.5px;
      color: #6ee7b7;
      background: rgba(16, 185, 129, 0.08);
      border: 1px solid rgba(16, 185, 129, 0.2);
      border-radius: 6px;
      padding: 6px 10px;
      margin-top: 6px;
      line-height: 1.45;
    }
    .ai-card-section {
      background: #0e1524;
      border: 1px solid #1a253c;
      border-radius: 8px;
      padding: 8px 10px;
      margin-bottom: 8px;
    }
    .ai-section-title {
      font-size: 11.5px;
      font-weight: 700;
      color: #818cf8;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .ai-item {
      padding: 6px 0;
      border-top: 1px solid #151d2f;
    }
    .ai-item:first-child {
      border-top: none;
      padding-top: 2px;
    }
    .ai-item-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-bottom: 4px;
    }
    .ai-item-name {
      font-weight: 700;
      color: #f1f5f9;
      font-size: 11.5px;
    }
    .ai-tag {
      font-size: 9.5px;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 4px;
      background: #1e293b;
      color: #a5b4fc;
      border: 1px solid #312e81;
    }
    .ai-tag.critical {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border-color: rgba(239, 68, 68, 0.4);
    }
    .ai-item-desc {
      font-size: 11.5px;
      color: #94a3b8;
      line-height: 1.45;
      white-space: pre-line;
      margin-bottom: 6px;
    }
    .ai-cmd-box {
      background: #050811;
      border: 1px solid #1e293b;
      border-radius: 6px;
      padding: 6px 8px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      margin-top: 4px;
    }
    .ai-cmd-text {
      font-family: monospace;
      font-size: 11px;
      color: #38bdf8;
      overflow-x: auto;
      white-space: nowrap;
    }
    .ai-cmd-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .ai-mini-btn {
      background: #1e293b;
      border: 1px solid #334155;
      color: #cbd5e1;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.1s;
    }
    .ai-mini-btn:hover {
      background: #334155;
      color: #ffffff;
      border-color: #6366f1;
    }
    .ai-mini-btn.primary {
      background: #4338ca;
      border-color: #6366f1;
      color: #ffffff;
    }
    .ai-mini-btn.primary:hover {
      background: #3730a3;
    }

    /* 하단 입력 영역 */
    .ai-input-wrap {
      padding: 10px 12px;
      background: #111827;
      border-top: 1px solid #1f293d;
      flex-shrink: 0;
    }
    .ai-input-form {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ai-text-input {
      flex: 1;
      background: #0b0f19;
      border: 1px solid #232d42;
      border-radius: 6px;
      padding: 7px 10px;
      color: #f8fafc;
      font-size: 12px;
    }
    .ai-text-input:focus {
      outline: none;
      border-color: #6366f1;
    }
    .ai-send-btn {
      background: #4f46e5;
      border: 1px solid #6366f1;
      color: #ffffff;
      border-radius: 6px;
      padding: 7px 12px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.15s;
    }
    .ai-send-btn:hover {
      background: #4338ca;
    }

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
          <button class="btn sm" onclick="openDeployModal()">📦 파드 배포</button>
          <button class="btn sm" onclick="openVirtualBrowser('app.ktci5.kr', 80, '/')" style="background:#0284c7; border-color:#0ea5e9; color:#fff; font-weight:700;">🌐 가상 웹 브라우저</button>
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
            <button class="chip-btn" onclick="runChip('curl -H &quot;Host: dev.ktci5.kr&quot; http://211.252.85.10:443')">curl dev.ktci5.kr</button>
            <button class="chip-btn" onclick="runChip('curl -H &quot;Host: api.ktci5.kr&quot; http://211.252.85.10/api')">curl api.ktci5.kr</button>
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
            <button class="tab-btn active" id="tab-btn-topo" onclick="switchRightTab('topo')">📊 클러스터 & 실시간 처리량</button>
            <button class="tab-btn" id="tab-btn-network" onclick="switchRightTab('network')">🌐 네트워크 & 7계층 (OSI) / VPN</button>
            <button class="tab-btn" id="tab-btn-hardware" onclick="switchRightTab('hardware')">⚙️ 하드웨어 증설 (CPU/RAM/디스크)</button>
            <button class="tab-btn" id="tab-btn-scenario" onclick="switchRightTab('scenario')">🚨 상용 시나리오 & 트러블슈팅</button>
          </div>

          <!-- 서브탭 1: 토폴로지 & 파드 & 실시간 처리량 집계 -->
          <div class="topo-tab-content" id="tab-content-topo">
            <div class="panel-card">
              <div class="panel-header">
                <span class="panel-title">🎛️ 실시간 가상 트래픽 발생기 (Traffic Generator)</span>
                <span style="font-size:11px; font-family:monospace; color:#818cf8; font-weight:700;" id="traffic-val">180 req/s</span>
              </div>
              <input type="range" class="form-control" style="padding:0; height:18px; accent-color:#6366f1; cursor:pointer;" id="traffic-slider" min="0" max="3000" step="50" value="180" onchange="updateTraffic(this.value)" />
            </div>

            <!-- 실시간 처리량 집계 패널 (Master vs Worker Telemetry) -->
            <div class="panel-card" style="border-left: 3px solid #6366f1;">
              <div class="panel-header">
                <span class="panel-title">📈 실시간 노드 처리량 집계 (Throughput & Node Telemetry)</span>
                <span style="font-size:10px; color:#10b981; font-family:monospace;" id="telemetry-refresh-indicator">● LIVE 1s</span>
              </div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px; font-family:monospace; font-size:11px;" id="telemetry-stats-grid">
                <div style="background:#0b0f19; padding:8px; border-radius:6px; border:1px solid #1f293d;">
                  <div style="color:#94a3b8; font-size:10px;">총 인입 트래픽</div>
                  <div style="color:#818cf8; font-size:13px; font-weight:bold;" id="stat-total-rps">180 RPS</div>
                  <div style="color:#64748b; font-size:9.5px;" id="stat-total-bandwidth">~2.88 Mbps</div>
                </div>
                <div style="background:#0b0f19; padding:8px; border-radius:6px; border:1px solid #1f293d;">
                  <div style="color:#94a3b8; font-size:10px;">Control-Plane 부하</div>
                  <div style="color:#38bdf8; font-size:13px; font-weight:bold;" id="stat-master-rps">27 RPS</div>
                  <div style="color:#64748b; font-size:9.5px;">API Server Tx/Rx</div>
                </div>
                <div style="background:#0b0f19; padding:8px; border-radius:6px; border:1px solid #1f293d;">
                  <div style="color:#94a3b8; font-size:10px;">Worker 파드 처리량</div>
                  <div style="color:#10b981; font-size:13px; font-weight:bold;" id="stat-worker-rps">153 RPS</div>
                  <div style="color:#64748b; font-size:9.5px;" id="stat-worker-rps-per-pod">파드당 ~76.5 RPS</div>
                </div>
                <div style="background:#0b0f19; padding:8px; border-radius:6px; border:1px solid #1f293d;">
                  <div style="color:#94a3b8; font-size:10px;">네트워크 패킷율</div>
                  <div style="color:#f59e0b; font-size:13px; font-weight:bold;" id="stat-total-pps">3,240 PPS</div>
                  <div style="color:#64748b; font-size:9.5px;">L2 vSwitch Forwarding</div>
                </div>
              </div>
            </div>

            <div class="panel-card">
              <div class="panel-header">
                <span class="panel-title">🖥️ 인프라 VM 노드 상태 및 실시간 처리율</span>
                <button class="btn sm primary" onclick="openAddNodeModal()">+ 노드 추가</button>
              </div>
              <div class="node-grid" id="node-grid-container"></div>
            </div>

            <div class="panel-card">
              <div class="panel-header">
                <span class="panel-title">📦 워크로드 파드 (Pods & Lifecycle)</span>
                <button class="btn sm primary" onclick="openDeployModal()">+ 파드 배포 (초/분/랜덤 동작)</button>
              </div>
              <div style="overflow-x:auto;">
                <table class="sim-table">
                  <thead>
                    <tr><th>NAME</th><th>NODE</th><th>STATUS</th><th>IP</th><th>IMAGE</th><th>LIFECYCLE/수명</th><th>ACTION</th></tr>
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

          <!-- 서브탭 2: 네트워크 & 7계층 (OSI) / VPN / 라우터 / 스위치 / 허브 -->
          <div class="topo-tab-content" id="tab-content-network" style="display:none;">
            
            <!-- OSI 7계층 전체 진단 배너 -->
            <div class="panel-card" style="border-left: 3px solid #10b981;">
              <div class="panel-header">
                <span class="panel-title">🌐 OSI 7단계 네트워크 레이어 아키텍처 스택 (L1 ~ L7)</span>
                <button class="chip-btn" onclick="executeCommand('layers')">터미널 layers 진단</button>
              </div>
              <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:6px; font-size:10.5px;">
                <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:5px; padding:6px;">
                  <b style="color:#ec4899;">L7 응용</b><br><span style="color:#94a3b8;">ALB Ingress &amp; HTTP</span><br><span style="color:#10b981;">● ACTIVE</span>
                </div>
                <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:5px; padding:6px;">
                  <b style="color:#a855f7;">L6 표현</b><br><span style="color:#94a3b8;">TLS 1.3 암호화</span><br><span style="color:#10b981;">● ENCRYPTED</span>
                </div>
                <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:5px; padding:6px;">
                  <b style="color:#6366f1;">L5 세션</b><br><span style="color:#94a3b8;">Argo / WireGuard</span><br><span style="color:#10b981;">● ESTABLISHED</span>
                </div>
                <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:5px; padding:6px;">
                  <b style="color:#3b82f6;">L4 전송</b><br><span style="color:#94a3b8;">TCP 80, 443, NodePort</span><br><span style="color:#10b981;">● LISTENING</span>
                </div>
                <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:5px; padding:6px;">
                  <b style="color:#14b8a6;">L3 네트워크</b><br><span style="color:#94a3b8;">vRouter 10.10.0.1</span><br><span style="color:#10b981;">● ROUTED</span>
                </div>
                <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:5px; padding:6px;">
                  <b style="color:#f59e0b;">L2 데이터링크</b><br><span style="color:#94a3b8;">vSwitch VLAN 100</span><br><span style="color:#10b981;">● FORWARDING</span>
                </div>
                <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:5px; padding:6px;">
                  <b style="color:#10b981;">L1 물리</b><br><span style="color:#94a3b8;">10Gbps Virtual Link</span><br><span style="color:#10b981;">● LINK_UP</span>
                </div>
              </div>
            </div>

            <!-- L7 ALB & 분산 알고리즘 제어 카드 -->
            <div class="panel-card">
              <div class="panel-header">
                <span class="panel-title">⚖️ L7 로드밸런서 (Application Load Balancer)</span>
                <div style="display:flex; align-items:center; gap:6px;">
                  <select class="form-control" style="width:auto; padding:2px 6px; font-size:10.5px;" id="lb-algo-select" onchange="changeLbAlgorithm(this.value)">
                    <option value="RoundRobin">Round Robin (순환 분산)</option>
                    <option value="LeastConnection">Least Connection (최소 접속)</option>
                    <option value="IPHash">IP Hash (클라이언트 고정)</option>
                  </select>
                  <span class="status-pill status-running" id="lb-status-pill">● 헬스체크 정상</span>
                </div>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:11.5px; margin-bottom:8px;">
                <div>공인 VIP: <b style="color:#818cf8;" id="lb-vip">211.252.85.10</b></div>
                <div>분산 알고리즘: <b id="lb-algo-text">Round Robin</b></div>
                <div>SSL 종료: <b style="color:#10b981;">TLSv1.3 (Let's Encrypt)</b></div>
                <div>헬스체크: <code>HTTP /healthz 200 OK</code></div>
              </div>
              <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:6px; padding:8px;">
                <div style="font-size:11px; color:#94a3b8; margin-bottom:4px;">🎯 타겟 풀 헬스체크 및 실시간 가중치</div>
                <div id="lb-target-pool-list" style="display:flex; flex-direction:column; gap:4px;"></div>
              </div>
            </div>

            <!-- Ingress & 도메인 및 포트 기반 라우팅 카드 -->
            <div class="panel-card">
              <div class="panel-header">
                <span class="panel-title">🏷️ 도메인 및 포트 기반 라우팅 (Host & Port Routing)</span>
                <div style="display:flex; gap:6px;">
                  <button class="btn sm" onclick="openVirtualBrowser('app.ktci5.kr', 80, '/')" style="background:#0284c7; border-color:#0ea5e9; color:#fff; font-weight:700;">🌐 가상 브라우저 열기</button>
                  <button class="btn sm" onclick="openModal('domain-modal')">+ 도메인/포트 매핑 추가</button>
                </div>
              </div>
              <div style="overflow-x:auto;">
                <table class="sim-table">
                  <thead><tr><th>도메인 (HOST)</th><th>포트</th><th>경로</th><th>타겟 서비스</th><th>SSL</th><th>테스트</th></tr></thead>
                  <tbody id="domain-table-body"></tbody>
                </table>
              </div>
            </div>

            <!-- VPN & 하이브리드 터널링 카드 (L5 세션 / 보안 터널) -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <!-- Site-to-Site VPN -->
              <div class="panel-card">
                <div class="panel-header">
                  <span class="panel-title">🔒 KT Cloud 기업 VPN (IPsec/WireGuard)</span>
                  <button class="btn sm" onclick="toggleVpnStatus()" id="vpn-toggle-btn">VPN 토글</button>
                </div>
                <div style="font-size:11px; line-height:1.6;">
                  <div>상태: <b id="vpn-status-text" style="color:#10b981;">● CONNECTED</b></div>
                  <div>엔드포인트: <code id="vpn-endpoint">vpn.ktci5.kr:51820</code></div>
                  <div>클라이언트 서브넷: <code id="vpn-subnet">192.168.100.0/24</code></div>
                  <div>접속 피어 수: <b id="vpn-peers">8 Connected Peers</b></div>
                  <div>대역폭: <b id="vpn-throughput">120 Mbps</b></div>
                </div>
              </div>

              <!-- 하이브리드 터널 -->
              <div class="panel-card">
                <div class="panel-header">
                  <span class="panel-title">🚇 Cloudflare 하이브리드 터널 (Argo Mesh)</span>
                  <button class="btn sm" onclick="toggleTunnelStatus()" id="tunnel-toggle-btn">터널 토글</button>
                </div>
                <div style="font-size:11px; line-height:1.6;">
                  <div>터널 상태: <b id="tunnel-status-text" style="color:#10b981;">● CONNECTED</b></div>
                  <div>왕복 지연시간: <b id="tunnel-latency">3.5 ms</b></div>
                  <div>대역폭: <b id="tunnel-throughput">480 Mbps</b></div>
                  <div>암호화: <b>ChaCha20-Poly1305</b></div>
                  <div>라우팅: <code>tunnel.ktci5.kr ➔ DBO</code></div>
                </div>
              </div>
            </div>

            <!-- L3 vRouter & L2 vSwitch & L1 Hub 하위 계층 카드 -->
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
              <!-- L3 가상 라우터 -->
              <div class="panel-card">
                <div class="panel-header">
                  <span class="panel-title">🔀 L3 가상 라우터 (vRouter)</span>
                  <button class="chip-btn" onclick="executeCommand('ip route')">ip route</button>
                </div>
                <div style="font-size:11px; margin-bottom:6px;">
                  <div>게이트웨이: <code id="router-gw">10.10.0.1</code> | CIDR: <code>10.10.0.0/16</code></div>
                </div>
                <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:4px; padding:6px; font-family:monospace; font-size:10.5px;" id="router-routes-list">
                  <div>0.0.0.0/0 ➔ 211.252.85.1 (WAN-eth0)</div>
                  <div>10.10.10.0/24 ➔ DIRECT (VLAN100-eth1)</div>
                  <div>172.20.0.0/16 ➔ 10.10.10.12 (Calico-eth2)</div>
                </div>
              </div>

              <!-- L2 가상 스위치 & L1 허브 -->
              <div class="panel-card">
                <div class="panel-header">
                  <span class="panel-title">🔌 L2 Open vSwitch &amp; L1 허브</span>
                  <button class="chip-btn" onclick="executeCommand('brctl show')">brctl show</button>
                </div>
                <div style="font-size:11px; margin-bottom:6px;">
                  <div>스위치: <b>kt-vswitch-dist-01</b> (VLAN 100)</div>
                  <div>L1 물리 링크: <span style="color:#10b981;">● LINK_UP (10Gbps, 충돌 0회)</span></div>
                </div>
                <div style="background:#0b0f19; border:1px solid #1f293d; border-radius:4px; padding:6px; font-family:monospace; font-size:10.5px;" id="switch-ports-list">
                  <div>Port 1: 52:54:00:12:34:56 [master1] 10Gbps UP</div>
                  <div>Port 2: 52:54:00:12:34:57 [w1] 10Gbps UP</div>
                </div>
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
                <div>
                  <span class="panel-title">🚨 상용 운영 장애 & 트러블슈팅 시뮬레이터</span>
                  <div style="font-size:11.5px; color:#94a3b8; margin-top:3px;">
                    실제 상용 서비스에서 발생하는 4대 핵심 도메인별 장애를 실시간 주입하고 실제 IP 기반 진단 및 원클릭 복구를 실습합니다.
                  </div>
                </div>
                <button class="btn sm primary" onclick="triggerScenario('resolve_all')">✅ 모든 장애 복구 (Resolve All)</button>
              </div>

              <!-- 카테고리 필터 버튼 -->
              <div style="display:flex; gap:6px; margin:12px 0 14px 0; border-bottom:1px solid #1f293d; padding-bottom:8px; flex-wrap:wrap;">
                <button class="chip-btn primary scenario-cat-btn" onclick="filterScenarioCat('all', this)">전체 보기 (All)</button>
                <button class="chip-btn scenario-cat-btn" onclick="filterScenarioCat('cat-net', this)">🌐 1. 네트워크 & LB</button>
                <button class="chip-btn scenario-cat-btn" onclick="filterScenarioCat('cat-k8s', this)">☸️ 2. 파드 & 스케줄링</button>
                <button class="chip-btn scenario-cat-btn" onclick="filterScenarioCat('cat-hw', this)">💽 3. 스토리지 & 자원</button>
                <button class="chip-btn scenario-cat-btn" onclick="filterScenarioCat('cat-devops', this)">🔄 4. 배포 & 유지보수</button>
              </div>

              <!-- 동적 시나리오 카드 컨테이너 -->
              <div id="scenario-cards-container"></div>
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

  <!-- 모달 3: 파드 배포 (초/분/시간 단위 수명 & 랜덤 동작) -->
  <div class="modal-overlay" id="deploy-modal">
    <div class="modal">
      <h2>📦 새 파드 / 디플로이먼트 배포</h2>
      <p class="desc">GUI 폼으로 초/분/시간 단위 수명 및 랜덤 활동 워크로드를 배포합니다.</p>
      <form onsubmit="handleDeployWorkload(event)">
        <div class="form-group"><label>워크로드 명칭</label><input type="text" class="form-control" id="deploy-form-name" placeholder="예: web-app, payment-api" required /></div>
        <div class="form-row">
          <div class="form-group"><label>컨테이너 이미지</label><input type="text" class="form-control" id="deploy-form-image" value="nginx:1.25" required /></div>
          <div class="form-group"><label>레플리카(파드 수)</label><input type="number" class="form-control" id="deploy-form-replicas" min="1" max="10" value="2" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>CPU Request</label><select class="form-control" id="deploy-form-cpu"><option value="100">100m</option><option value="200">200m</option><option value="500">500m</option></select></div>
          <div class="form-group"><label>노드 타겟 (nodeSelector)</label><select class="form-control" id="deploy-form-disk"><option value="">조건 없음</option><option value="ssd">disktype=ssd</option><option value="hdd">disktype=hdd</option></select></div>
        </div>
        
        <!-- 동작 수명 및 랜덤 동작 설정 -->
        <div class="form-row" style="background:#0b0f19; padding:8px; border-radius:6px; border:1px solid #1f293d; margin-bottom:10px;">
          <div class="form-group" style="margin-bottom:0;">
            <label>동작 주기 / 수명 (Lifecycle)</label>
            <select class="form-control" id="deploy-form-unit" onchange="toggleDurationValInput(this.value)">
              <option value="forever">영구 지속 (Daemon/Service)</option>
              <option value="sec">초 단위 동작 (테스트 잡)</option>
              <option value="min" selected>분 단위 동작 (배치 작업)</option>
              <option value="hour">시간 단위 동작</option>
              <option value="random">🎲 랜덤 라이프사이클 &amp; 버스트 트래픽</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;" id="deploy-val-group">
            <label>지속 수치 (시간값)</label>
            <input type="number" class="form-control" id="deploy-form-duration" value="5" min="1" max="3600" />
          </div>
        </div>

        <div class="form-group"><label class="checkbox-label"><input type="checkbox" id="deploy-form-nodeport" checked /> NodePort 서비스 동시 생성</label></div>
        <div class="modal-actions">
          <button type="button" class="btn sm" onclick="closeModal('deploy-modal')">취소</button>
          <button type="submit" class="btn sm primary">배포하기</button>
        </div>
      </form>
    </div>
  </div>

  <!-- 모달 4: 도메인 및 포트 매핑 추가 -->
  <div class="modal-overlay" id="domain-modal">
    <div class="modal">
      <h2>🌐 Ingress 도메인 및 포트 매핑</h2>
      <p class="desc">L7 로드밸런서에 호스트 도메인과 인입 포트, 타겟 서비스를 바인딩합니다.</p>
      <form onsubmit="handleAddDomain(event)">
        <div class="form-row">
          <div class="form-group"><label>도메인 (FQDN)</label><input type="text" class="form-control" id="domain-form-host" placeholder="예: order.ktci5.kr, admin.ktci5.kr" required /></div>
          <div class="form-group"><label>인입 포트 (Port)</label><input type="number" class="form-control" id="domain-form-port" value="80" required /></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>경로 (Path)</label><input type="text" class="form-control" id="domain-form-path" value="/" required /></div>
          <div class="form-group"><label>타겟 서비스 (Service:Port)</label><input type="text" class="form-control" id="domain-form-svc" value="web-service:80" required /></div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn sm" onclick="closeModal('domain-modal')">취소</button>
          <button type="submit" class="btn sm primary">도메인/포트 매핑</button>
        </div>
      </form>
    </div>
  </div>

  <!-- 모달 5: 실시간 가상 웹 브라우저 뷰어 (Live Virtual Web Browser) -->
  <div class="modal-overlay" id="virtual-browser-modal">
    <div class="modal" style="max-width: 980px; width: 94vw; height: 86vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; background: #0b0f19; border: 1px solid #1e293b; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.85);">
      
      <!-- 윈도우 상단 타이틀바 / 탭 바 -->
      <div style="background: #111827; border-bottom: 1px solid #1f293d; padding: 10px 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-shrink: 0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #ef4444; cursor: pointer;" onclick="closeModal('virtual-browser-modal')" title="닫기"></span>
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #f59e0b;"></span>
          <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: #10b981;"></span>
          <span style="font-size: 12px; font-weight: 700; color: #cbd5e1; margin-left: 8px; display: flex; align-items: center; gap: 6px;">
            🌐 KT Cloud L7 Ingress 가상 웹 브라우저
          </span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span id="vbrowser-status-badge" style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 999px; background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid #059669;">
            ● 200 OK
          </span>
          <button class="btn sm" onclick="closeModal('virtual-browser-modal')" style="padding: 2px 8px; background: transparent; border: none; color: #94a3b8; font-size: 14px; cursor: pointer;">✕</button>
        </div>
      </div>

      <!-- 브라우저 주소창 & 툴바 -->
      <div style="background: #0f172a; border-bottom: 1px solid #1e293b; padding: 8px 12px; display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        <button class="btn sm" onclick="reloadVirtualBrowser()" title="새로고침" style="padding: 5px 9px;">🔄</button>
        
        <div style="flex: 1; display: flex; align-items: center; background: #1e293b; border: 1px solid #334155; border-radius: 6px; padding: 4px 10px; gap: 6px;">
          <span id="vbrowser-ssl-icon" style="font-size: 12px;">🔒</span>
          <input type="text" id="vbrowser-url-input" style="flex: 1; background: transparent; border: none; outline: none; color: #f8fafc; font-size: 12px; font-family: monospace;" placeholder="http://app.ktci5.kr:80/" onkeydown="if(event.key==='Enter') navigateVirtualBrowser()" />
          <button class="btn sm primary" onclick="navigateVirtualBrowser()" style="padding: 2px 8px; font-size: 11px;">이동</button>
        </div>

        <button class="btn sm" onclick="copyVirtualBrowserUrl()" title="URL 복사" style="white-space: nowrap;">📋 복사</button>
        <button class="btn sm" onclick="openVirtualBrowserNewTab()" title="새 탭에서 열기" style="white-space: nowrap;">↗ 새 탭</button>
        <button class="btn sm" onclick="openVirtualBrowserPopup()" title="실제 새 창 팝업으로 열기" style="background:#4338ca; border-color:#6366f1; color:#fff; white-space: nowrap;">↗ 실제 팝업</button>
      </div>

      <!-- 빠른 바로가기 북마크 바 -->
      <div style="background: #0b0f19; border-bottom: 1px solid #1e293b; padding: 6px 12px; display: flex; align-items: center; gap: 6px; overflow-x: auto; flex-shrink: 0;" id="vbrowser-presets-bar">
        <span style="font-size: 11px; color: #64748b; margin-right: 4px; white-space: nowrap;">실등록 규칙:</span>
        <button class="chip-btn" id="vbm-app" onclick="openVirtualBrowser('app.ktci5.kr', 80, '/')">🏢 app.ktci5.kr:80 (/)</button>
        <button class="chip-btn" id="vbm-api" onclick="openVirtualBrowser('api.ktci5.kr', 80, '/api')">⚡ api.ktci5.kr:80 (/api)</button>
        <button class="chip-btn" id="vbm-dev" onclick="openVirtualBrowser('dev.ktci5.kr', 443, '/')">🧪 dev.ktci5.kr:443 (/)</button>
      </div>

      <!-- 브라우저 콘텐츠 영역 (Iframe) -->
      <div style="flex: 1; position: relative; background: #090d16; overflow: hidden;">
        <iframe id="vbrowser-iframe" style="width: 100%; height: 100%; border: none; background: #090d16;" onload="onVBrowserLoaded()"></iframe>
        <div id="vbrowser-loading" style="display: none; position: absolute; inset: 0; background: rgba(11,15,25,0.85); backdrop-filter: blur(2px); align-items: center; justify-content: center; color: #38bdf8; font-size: 13px; font-weight: 600;">
          <div style="text-align: center;">
            <div style="font-size: 26px; margin-bottom: 8px;">⏳</div>
            <div>L7 Ingress ALB ➔ 타겟 서비스 파드 라우팅 중...</div>
          </div>
        </div>
      </div>

      <!-- 하단 네트워크 & 라우팅 진단 상태바 -->
      <div style="background: #111827; border-top: 1px solid #1f293d; padding: 6px 14px; display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #94a3b8; flex-shrink: 0; flex-wrap: wrap; gap: 6px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span>L7 Ingress VIP: <b id="vbrowser-vip" style="color: #cbd5e1;">211.252.85.10</b></span>
          <span>•</span>
          <span id="vbrowser-hop-info">홉: Hub(L1) ➔ Switch(L2) ➔ Router(L3) ➔ ALB(L4) ➔ Ingress(L7)</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span id="vbrowser-tunnel-indicator">터널: <b style="color:#10b981;">CONNECTED</b></span>
          <span>•</span>
          <span id="vbrowser-latency-indicator">지연시간: <b style="color:#fbbf24;">2.1ms</b></span>
        </div>
      </div>

    </div>
  </div>

  <!-- 우측 하단 AI 인프라 코파일럿 플로팅 버튼 & 패널 -->
  <div id="ai-copilot-trigger" class="ai-copilot-trigger" onclick="toggleAiCopilot()" title="AI 인프라 코파일럿 열기">
    <span class="ai-sparkle">✨</span>
    <span>AI 코파일럿</span>
    <span id="ai-alert-badge" class="ai-trigger-badge">정상</span>
  </div>

  <div id="ai-copilot-panel" class="ai-copilot-panel">
    <div class="ai-copilot-header">
      <div class="ai-header-left">
        <div class="ai-avatar">🤖</div>
        <div>
          <div class="ai-header-title">AI 인프라 코파일럿</div>
          <div class="ai-header-subtitle">운영팁 · 관리팁 · 메뉴가이드 · 장애대처</div>
        </div>
      </div>
      <button class="ai-close-btn" onclick="toggleAiCopilot()" title="닫기">✕</button>
    </div>

    <!-- 4대 핵심 주제 탭 -->
    <div class="ai-presets-bar">
      <button class="ai-preset-chip active" id="chip-troubleshoot" onclick="askAiPreset('troubleshoot')">🚨 실시간 문제 대처</button>
      <button class="ai-preset-chip" id="chip-menu" onclick="askAiPreset('menu')">➕ 메뉴/자원 추가법</button>
      <button class="ai-preset-chip" id="chip-management" onclick="askAiPreset('management')">⚙️ 인프라 관리팁</button>
      <button class="ai-preset-chip" id="chip-tips" onclick="askAiPreset('tips')">💡 사용팁</button>
    </div>

    <!-- KT Cloud 5기 교안 퀵 질문 칩 바 -->
    <div class="ai-curriculum-bar">
      <button type="button" class="ai-curr-chip" onclick="askAiPrompt('마스터 노드 Taint 해제 명령어와 원리 알려줘')">📖 Taint 해제 (Step 4)</button>
      <button type="button" class="ai-curr-chip" onclick="askAiPrompt('NodePort 서비스 노출 방법과 포트 대역 알려줘')">📖 NodePort 노출 (Step 5)</button>
      <button type="button" class="ai-curr-chip" onclick="askAiPrompt('파드가 Pending인 이유와 nodeSelector 라벨 해결법 알려줘')">📖 nodeSelector/Pending (Step 8)</button>
      <button type="button" class="ai-curr-chip" onclick="askAiPrompt('멀티 컨테이너 파드 네트워크 공유 검증 방법 알려줘')">📖 멀티 컨테이너 (Step 6)</button>
      <button type="button" class="ai-curr-chip" onclick="askAiPrompt('dry-run client와 server 차이점과 YAML 추출법 알려줘')">📖 dry-run 템플릿 (Step 7)</button>
      <button type="button" class="ai-curr-chip" onclick="askAiPrompt('무중단 롤링 업데이트와 롤백 명령어 알려줘')">📖 롤링 업데이트 (Step 9)</button>
      <button type="button" class="ai-curr-chip" onclick="askAiPrompt('Metrics-Server 설치와 top 명령어 점검법 알려줘')">📖 Metrics-Server (Step 10)</button>
      <button type="button" class="ai-curr-chip" onclick="askAiPrompt('대시보드 RBAC kdb-admin과 Skip 로그인 설정 알려줘')">📖 K8s 대시보드 (Step 11)</button>
      <button type="button" class="ai-curr-chip" onclick="askAiPrompt('LVM 3계층 볼륨 확장 명령어와 원리 알려줘')">📖 LVM 동적 확장 (교안 4장)</button>
      <button type="button" class="ai-curr-chip" onclick="askAiPrompt('도커 컨테이너 실행과 포트 포워딩 명령어 알려줘')">📖 도커 핵심 CLI (교안 6장)</button>
    </div>

    <!-- 대화 본체 -->
    <div class="ai-chat-body" id="ai-chat-body"></div>

    <!-- 질문 입력 바 -->
    <div class="ai-input-wrap">
      <form class="ai-input-form" onsubmit="handleAiInputSubmit(event)">
        <input type="text" id="ai-user-input" class="ai-text-input" placeholder="교안 질문 또는 터미널 명령어 질문 (예: Taint 해제, NodePort 대역, Pending 해결...)" autocomplete="off" />
        <button type="submit" class="ai-send-btn">전송</button>
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
      const existingNames = new Set((currentLab.nodes || []).map(n => n.name));
      let nextWorkerNum = 1;
      while (existingNames.has('w' + nextWorkerNum)) nextWorkerNum++;

      const existingIps = new Set((currentLab.nodes || []).map(n => n.ip));
      let nextIpLast = 20;
      while (existingIps.has('10.10.10.' + nextIpLast)) nextIpLast += 10;

      document.getElementById('node-form-name').value = 'w' + nextWorkerNum;
      document.getElementById('node-form-ip').value = '10.10.10.' + nextIpLast;
      openModal('add-node-modal');
    }

    function openDeployModal() {
      if (!currentLab) return;
      const existingNames = new Set((currentLab.deployments || []).map(d => d.name.toLowerCase()));
      let appNum = 1;
      while (existingNames.has('app-' + appNum)) appNum++;
      const nameInput = document.getElementById('deploy-form-name');
      if (nameInput) nameInput.value = 'app-' + appNum;
      openModal('deploy-modal');
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
        \`L7 로드밸런서 VIP: <b>\${lab.network?.loadBalancer?.vip || '211.252.85.10'}</b> | 실등록 도메인: <b>app.ktci5.kr, api.ktci5.kr, dev.ktci5.kr</b>\\n\` +
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

      // 1) 실시간 처리량 집계 (Throughput & Telemetry Aggregation)
      const rps = lab.trafficRps || 0;
      const activeWorkers = (lab.nodes || []).filter(n => n.role === 'worker' && n.status === 'Ready' && !n.unschedulable).length || 1;
      const runningPods = (lab.pods || []).filter(p => p.status === 'Running').length || 1;
      
      const masterRps = Math.round(rps * 0.15); // K8s API 서버 트래픽
      const workerTotalRps = rps - masterRps;
      const workerRpsPerPod = (workerTotalRps / runningPods).toFixed(1);
      const totalBandwidthMbps = ((rps * 16) / 1000).toFixed(2); // 평균 16KB 페이로드 가정
      const totalPps = (rps * 18).toLocaleString(); // 패킷/초

      document.getElementById('stat-total-rps').innerText = rps + ' RPS';
      document.getElementById('stat-total-bandwidth').innerText = '~' + totalBandwidthMbps + ' Mbps';
      document.getElementById('stat-master-rps').innerText = masterRps + ' RPS';
      document.getElementById('stat-worker-rps').innerText = workerTotalRps + ' RPS';
      document.getElementById('stat-worker-rps-per-pod').innerText = '파드당 ~' + workerRpsPerPod + ' RPS';
      document.getElementById('stat-total-pps').innerText = totalPps + ' PPS';

      // 2) 노드 카드 & 실시간 노드별 처리량
      document.getElementById('node-grid-container').innerHTML = (lab.nodes || []).map(node => {
        const hosted = (lab.pods || []).filter(p => p.node === node.name && p.status === 'Running');
        const isMaster = node.role === 'control-plane';

        // 노드별 분산 트래픽 계산
        const nodeRps = isMaster ? masterRps : Math.round(workerTotalRps / activeWorkers);
        const nodeMbps = ((nodeRps * 16) / 1000).toFixed(2);

        const baseCpu = isMaster ? (220 + hosted.length * 50) : (160 + hosted.length * 70);
        const trafficCpu = Math.round((nodeRps / 1500) * 800);
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
        const hasTaint = node.taints && node.taints.length > 0;

        return \`
          <div class="node-card \${(node.status !== 'Ready' || isDiskPressure) ? 'not-ready' : ''}">
            <div class="node-top">
              <span class="node-name">🖥️ \${node.name} (\${node.role})</span>
              <span class="status-pill \${(node.status === 'Ready' && !isDiskPressure) ? 'status-running' : 'status-pending'}">
                \${isDiskPressure ? 'DiskPressure' : node.status}\${node.unschedulable ? ',NoSched' : ''}
              </span>
            </div>
            <div style="font-size:10.5px; color:#64748b; font-family:monospace; margin-bottom:5px; display:flex; justify-content:space-between;">
              <span>IP: \${node.ip}</span>
              <span style="color:#818cf8; font-weight:bold;">⚡ \${nodeRps} RPS (\${nodeMbps} Mbps)</span>
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
              \${disksHtml}
            </div>

            <div style="display:flex; gap:4px; margin-top:8px; border-top:1px solid #1f293d; padding-top:6px; flex-wrap:wrap;">
              <button class="chip-btn" style="color:#38bdf8; border-color:#0369a1;" onclick="openVmPopup('\${node.name}')">🌐 VM 팝업</button>
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

      // 3) 파드 테이블 & 수명 카운트다운
      const now = Date.now();
      document.getElementById('pod-table-body').innerHTML = (lab.pods || []).map(pod => {
        let lifeStr = '<span style="color:#94a3b8;">영구 지속</span>';
        if (pod.expiresAt) {
          const remainSec = Math.max(0, Math.round((pod.expiresAt - now) / 1000));
          if (remainSec > 0) {
            lifeStr = \`<span style="color:#f59e0b; font-weight:bold;">⏱️ \${remainSec}s 남음</span>\`;
          } else {
            lifeStr = '<span style="color:#ef4444; font-weight:bold;">종료 완료</span>';
          }
        } else if (pod.isRandomBurst) {
          lifeStr = '<span style="color:#a855f7;">🎲 랜덤 버스트</span>';
        }

        return \`
          <tr>
            <td style="color:#f8fafc; font-weight:600;">\${escapeHtml(pod.name)}</td>
            <td>\${pod.node}</td>
            <td><span class="status-pill \${pod.status === 'Running' ? 'status-running' : 'status-pending'}">\${pod.status}</span></td>
            <td>\${pod.ip}</td>
            <td>\${pod.image}</td>
            <td>\${lifeStr}</td>
            <td><button class="chip-btn" onclick="executeCommand('k delete pod \${pod.name}')" style="color:#f87171;">삭제</button></td>
          </tr>
        \`;
      }).join('');

      // 4) 감사 피드
      document.getElementById('activity-log-container').innerHTML = (lab.activityLogs || []).slice(0, 15).map(l => \`
        <div><span style="color:#64748b;">\${l.time}</span> <span style="color:#818cf8; font-weight:600;">[\${escapeHtml(l.user)}]</span> \${escapeHtml(l.action)}</div>
      \`).join('');

      // 5) 네트워크 탭 (OSI 7계층, ALB, Ingress, VPN, 터널, 라우터, 스위치)
      const net = lab.network || createDefaultNetwork();
      document.getElementById('lb-vip').innerText = net.loadBalancer?.vip || '211.252.85.10';
      document.getElementById('lb-algo-text').innerText = net.loadBalancer?.algorithm || 'Round Robin';
      if (document.getElementById('lb-algo-select')) {
        document.getElementById('lb-algo-select').value = net.loadBalancer?.algorithm || 'RoundRobin';
      }

      const rawPool = net.loadBalancer?.targetPool || [];
      const nodes = lab.nodes || [];
      const poolList = document.getElementById('lb-target-pool-list');
      
      const displayPool = nodes.map((n, idx) => {
        const targetAddr = \`\${n.ip}:30080\`;
        const matched = rawPool.find(p => p.target === targetAddr || p.nodeName === n.name);
        let status = matched ? matched.status : 'Healthy';
        if (n.status !== 'Ready' || n.unschedulable) status = 'Unhealthy (503 Error)';
        return {
          target: targetAddr,
          nodeName: n.name,
          status: status,
          latencyMs: matched ? matched.latencyMs : (1.5 + idx * 0.3).toFixed(1),
          weight: Math.round(100 / (nodes.length || 1))
        };
      });

      poolList.innerHTML = displayPool.map(p => {
        const isH = p.status.includes('Healthy');
        return \`<div style="display:flex; justify-content:space-between; font-size:11px;">
          <span>• \${p.target} [\${p.nodeName}] (가중치: \${p.weight}%)</span>
          <span style="color:\${isH ? '#10b981' : '#f87171'}; font-weight:bold;">\${p.status} (\${p.latencyMs}ms)</span>
        </div>\`;
      }).join('');

      document.getElementById('domain-table-body').innerHTML = (net.ingress?.rules || []).map(r => {
        const testPort = r.port || 80;
        const portPart = testPort === 80 ? '' : (':' + testPort);
        const pathPart = (r.path && r.path !== '/') ? r.path : '';
        const vip = net.loadBalancer?.vip || '211.252.85.10';
        const curlCmd = 'curl -H &quot;Host: ' + r.host + '&quot; http://' + vip + portPart + pathPart;
        const titleText = r.host + ' 호출';
        return \`
        <tr>
          <td style="color:#818cf8; font-weight:700;">\${r.host}</td>
          <td><b>:\${testPort}</b></td>
          <td>\${r.path || '/'}</td>
          <td><span style="color:#38bdf8;">\${r.service}</span></td>
          <td><span style="color:#10b981;">\${r.ssl ? 'TLS Valid' : 'HTTP'}</span></td>
          <td>
            <div style="display:flex; gap:6px; align-items:center;">
              <button class="chip-btn" onclick="runChip('\${curlCmd}')" title="\${titleText}">호출</button>
              <button class="chip-btn" style="background:#0284c7; color:#ffffff; font-weight:700; border-color:#0ea5e9;" onclick="openVirtualBrowser('\${r.host}', \${testPort}, '\${r.path || \'/\'}')" title="가상 브라우저 열기">🌐 열기</button>
              <button class="chip-btn" style="background:#4338ca; color:#ffffff; font-weight:700; border-color:#6366f1;" onclick="openVmPopup('\${r.host}', \${testPort}, '\${r.path || \'/\'}')" title="실제 새 창 팝업 열기">↗ 팝업</button>
            </div>
          </td>
        </tr>
      \`;
      }).join('');

      // VPN 상태
      const isVpnOk = net.vpn?.status === 'CONNECTED';
      const vText = document.getElementById('vpn-status-text');
      vText.innerText = isVpnOk ? '● CONNECTED' : '● DISCONNECTED';
      vText.style.color = isVpnOk ? '#10b981' : '#ef4444';
      document.getElementById('vpn-endpoint').innerText = net.vpn?.serverEndpoint || 'vpn.ktci5.kr:51820';
      document.getElementById('vpn-subnet').innerText = net.vpn?.clientSubnet || '192.168.100.0/24';
      document.getElementById('vpn-peers').innerText = (net.vpn?.connectedClients || 8) + ' Connected Peers';
      document.getElementById('vpn-throughput').innerText = isVpnOk ? ((net.vpn?.throughputMbps || 120) + ' Mbps') : '0 Mbps';
      document.getElementById('vpn-toggle-btn').innerText = isVpnOk ? 'VPN 단절 토글' : 'VPN 재연결';

      // 터널 상태
      const isTunnelOk = net.tunnel?.status === 'CONNECTED';
      const tText = document.getElementById('tunnel-status-text');
      tText.innerText = isTunnelOk ? '● CONNECTED' : '● DISCONNECTED';
      tText.style.color = isTunnelOk ? '#10b981' : '#ef4444';
      document.getElementById('tunnel-latency').innerText = isTunnelOk ? (net.tunnel?.latencyMs + ' ms') : 'Timeout';
      document.getElementById('tunnel-throughput').innerText = isTunnelOk ? (net.tunnel?.throughputMbps + ' Mbps') : '0 Mbps';
      document.getElementById('tunnel-toggle-btn').innerText = isTunnelOk ? '터널 단절 시뮬레이션' : '터널 재연결';

      // 라우터 및 스위치 상태
      if (net.router) {
        document.getElementById('router-gw').innerText = net.router.gateway || '10.10.0.1';
        document.getElementById('router-routes-list').innerHTML = (net.router.routes || []).map(r => \`
          <div>\${r.dest} ➔ \${r.nextHop} (\${r.iface})</div>
        \`).join('');
      }

      const switchList = document.getElementById('switch-ports-list');
      if (switchList) {
        switchList.innerHTML = nodes.map((n, idx) => \`
          <div>Port \${idx + 1}: 52:54:00:12:34:\${(56 + idx).toString(16).padStart(2, '0')} [\${n.name}] 10Gbps \${n.status === 'Ready' ? 'UP' : 'DOWN'}</div>
        \`).join('');
      }

      // 6) 하드웨어 탭 렌더링
      document.getElementById('hardware-nodes-list').innerHTML = (lab.nodes || []).map(node => \`
        <div style="background:#0f1523; border:1px solid #1f293d; border-radius:6px; padding:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
            <span style="font-weight:700; color:#f8fafc; font-family:monospace;">🖥️ \${node.name} (\${node.ip})</span>
            <div style="display:flex; gap:6px; align-items:center;">
              <span style="font-size:11px; color:#94a3b8;">현재: \${node.cpuTotalM / 1000} Core / \${node.ramTotalMi / 1024} GiB</span>
              <button class="chip-btn" style="color:#38bdf8; border-color:#0369a1; padding:2px 8px; font-size:11px;" onclick="openVmPopup('\${node.name}')">🌐 VM 팝업</button>
            </div>
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

      // AI 코파일럿 실시간 장애 배지 갱신
      updateAiCopilotBadge(lab);

      // 상용 시나리오 카드 동적 렌더링
      renderScenarioCards(lab);
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

    // 7. 네트워크 및 터널 / VPN / 로드밸런서 API
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

    async function toggleVpnStatus() {
      if (!currentLab) return;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/network\`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ toggleVpn: true })
        });
        const data = await res.json();
        if (data.ok) {
          currentLab = data.lab;
          renderAll(currentLab);
        }
      } catch (err) { alert('VPN 변경 실패: ' + err.message); }
    }

    async function changeLbAlgorithm(algorithm) {
      if (!currentLab) return;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/network\`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ updateLbAlgorithm: algorithm })
        });
        const data = await res.json();
        if (data.ok) {
          currentLab = data.lab;
          renderAll(currentLab);
        }
      } catch (err) { alert('알고리즘 변경 실패: ' + err.message); }
    }

    async function handleAddDomain(e) {
      e.preventDefault();
      if (!currentLab) return;
      const host = document.getElementById('domain-form-host').value.trim();
      const port = parseInt(document.getElementById('domain-form-port').value || '80', 10);
      const path = document.getElementById('domain-form-path').value.trim() || '/';
      const svc = document.getElementById('domain-form-svc').value.trim();
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/network\`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ addDomain: { host, port, path, service: svc } })
        });
        const data = await res.json();
        if (data.ok) {
          closeModal('domain-modal');
          currentLab = data.lab;
          renderAll(currentLab);
          appendTermLog(\`\\n<span style="color:#10b981;font-weight:700;">🌐 [Ingress Binding] 도메인/포트 '\${host}:\${port}'이(가) 서비스 '\${svc}'에 매핑되었습니다.</span>\\n\`);
        }
      } catch (err) { alert('도메인 추가 실패: ' + err.message); }
    }

    // 7-1. 실시간 가상 웹 브라우저 뷰어 제어
    window.currentVBrowser = {
      host: 'app.ktci5.kr',
      port: 80,
      path: '/'
    };

    window.openVirtualBrowser = function(host, port, path) {
      host = host || 'app.ktci5.kr';
      port = port ? parseInt(port, 10) : (host.startsWith('dev') ? 443 : 80);
      path = path || '/';

      window.currentVBrowser = { host, port, path };
      openModal('virtual-browser-modal');

      const proto = port === 443 ? 'https' : 'http';
      const portStr = (port === 80 && proto === 'http') || (port === 443 && proto === 'https') ? '' : (':' + port);
      const fullUrl = proto + '://' + host + portStr + path;

      const input = document.getElementById('vbrowser-url-input');
      if (input) input.value = fullUrl;

      const sslIcon = document.getElementById('vbrowser-ssl-icon');
      if (sslIcon) sslIcon.innerText = proto === 'https' ? '🔒' : '🌐';

      document.querySelectorAll('#vbrowser-presets-bar .chip-btn').forEach(b => b.classList.remove('active'));
      if (host.startsWith('app')) document.getElementById('vbm-app')?.classList.add('active');
      else if (host.startsWith('api')) document.getElementById('vbm-api')?.classList.add('active');
      else if (host.startsWith('dev')) document.getElementById('vbm-dev')?.classList.add('active');

      loadVirtualBrowserPage(host, port, path);
    };

    function loadVirtualBrowserPage(host, port, path) {
      const loader = document.getElementById('vbrowser-loading');
      if (loader) loader.style.display = 'flex';

      const iframe = document.getElementById('vbrowser-iframe');
      const labId = currentLab?.id || 'lab-default';
      const browseUrl = '/api/simulator/browse?host=' + encodeURIComponent(host) + '&port=' + port + '&path=' + encodeURIComponent(path) + '&labId=' + encodeURIComponent(labId) + '&_t=' + Date.now();
      
      iframe.src = browseUrl;

      if (currentLab?.network) {
        const net = currentLab.network;
        const vipEl = document.getElementById('vbrowser-vip');
        if (vipEl) vipEl.innerText = net.loadBalancer?.vip || '211.252.85.10';

        const tOk = net.tunnel?.status === 'CONNECTED';
        const tInd = document.getElementById('vbrowser-tunnel-indicator');
        if (tInd) tInd.innerHTML = '터널: <b style="color:' + (tOk ? '#10b981' : '#ef4444') + ';">' + (net.tunnel?.status || 'CONNECTED') + '</b>';
      }
    }

    window.reloadVirtualBrowser = function() {
      if (window.currentVBrowser) {
        loadVirtualBrowserPage(window.currentVBrowser.host, window.currentVBrowser.port, window.currentVBrowser.path);
      }
    };

    window.navigateVirtualBrowser = function() {
      const input = document.getElementById('vbrowser-url-input');
      if (!input) return;
      let raw = input.value.trim();
      if (!raw) return;
      if (!raw.startsWith('http://') && !raw.startsWith('https://')) {
        raw = 'http://' + raw;
      }
      try {
        const u = new URL(raw);
        const host = u.hostname;
        let port = u.port ? parseInt(u.port, 10) : (u.protocol === 'https:' ? 443 : 80);
        const path = u.pathname + (u.search || '');
        window.currentVBrowser = { host, port, path };
        loadVirtualBrowserPage(host, port, path);
      } catch (e) {
        alert('올바른 URL을 입력해주세요 (예: http://app.ktci5.kr:80/)');
      }
    };

    window.copyVirtualBrowserUrl = function() {
      const input = document.getElementById('vbrowser-url-input');
      if (input && input.value) {
        navigator.clipboard.writeText(input.value).then(() => {
          showToast('URL이 클립보드에 복사되었습니다.');
        }).catch(() => {
          showToast('URL: ' + input.value);
        });
      }
    };

    window.openVirtualBrowserNewTab = function() {
      if (window.currentVBrowser) {
        const { host, port, path } = window.currentVBrowser;
        const labId = currentLab?.id || 'lab-default';
        const portPart = (port && port !== 80 && port !== 443) ? (':' + port) : '';
        window.open('/vhost/' + host + portPart + path + '?labId=' + encodeURIComponent(labId), '_blank');
      }
    };

    window.openVirtualBrowserPopup = function() {
      if (window.currentVBrowser) {
        const { host, port, path } = window.currentVBrowser;
        window.openVmPopup(host, port, path);
      }
    };

    window.openVmPopup = function(hostOrNode, port, path) {
      hostOrNode = hostOrNode || 'master1';
      let host = hostOrNode;
      if (!host.includes('.')) {
        host = host + '.ktci5.kr';
      }
      port = port ? parseInt(port, 10) : (host.startsWith('dev') ? 443 : 80);
      path = path || '/';
      const labId = currentLab?.id || 'lab-default';
      const portPart = (port && port !== 80 && port !== 443) ? (':' + port) : '';
      const vhostUrl = '/vhost/' + host + portPart + path + '?labId=' + encodeURIComponent(labId);
      const popupWindowName = 'vm_popup_' + host.replace(/[^a-zA-Z0-9]/g, '_') + '_' + port;
      const popupFeatures = 'width=1080,height=800,top=100,left=120,resizable=yes,scrollbars=yes,status=yes';

      const popWin = window.open(vhostUrl, popupWindowName, popupFeatures);
      if (!popWin || popWin.closed || typeof popWin.closed === 'undefined') {
        showToast('⚠️ 브라우저 팝업이 차단되어 가상 브라우저 모달로 열립니다.');
        openVirtualBrowser(host, port, path);
      } else {
        popWin.focus();
        showToast('🌐 [' + host + (portPart || '') + '] 실제 팝업 창이 열렸습니다.');
      }
    };

    window.onVBrowserLoaded = function() {
      const loader = document.getElementById('vbrowser-loading');
      if (loader) loader.style.display = 'none';

      const badge = document.getElementById('vbrowser-status-badge');
      const isTunnelDown = currentLab?.network?.tunnel?.status !== 'CONNECTED';
      if (isTunnelDown) {
        if (badge) {
          badge.innerText = '● 502 Bad Gateway';
          badge.style.color = '#ef4444';
          badge.style.background = 'rgba(239, 68, 68, 0.15)';
          badge.style.borderColor = '#b91c1c';
        }
        return;
      }

      const curHost = window.currentVBrowser?.host || '';
      const rules = currentLab?.network?.ingress?.rules || [];
      const nodes = currentLab?.nodes || [];
      const isRegistered = rules.some(r => r.host === curHost) ||
                           nodes.some(n => n.name === curHost || (n.name + '.ktci5.kr') === curHost || n.ip === curHost);
      if (!isRegistered) {
        if (badge) {
          badge.innerText = '● 404 Not Found';
          badge.style.color = '#f59e0b';
          badge.style.background = 'rgba(245, 158, 11, 0.15)';
          badge.style.borderColor = '#d97706';
        }
        return;
      }

      const targetPool = currentLab?.network?.loadBalancer?.targetPool || [];
      const hasHealthy = targetPool.some(p => p.status.includes('Healthy'));
      if (!hasHealthy && targetPool.length > 0) {
        if (badge) {
          badge.innerText = '● 503 Unavailable';
          badge.style.color = '#ef4444';
          badge.style.background = 'rgba(239, 68, 68, 0.15)';
          badge.style.borderColor = '#b91c1c';
        }
        return;
      }

      if (badge) {
        badge.innerText = '● 200 OK';
        badge.style.color = '#10b981';
        badge.style.background = 'rgba(16, 185, 129, 0.15)';
        badge.style.borderColor = '#059669';
      }
    };

    function toggleDurationValInput(unit) {
      const g = document.getElementById('deploy-val-group');
      if (unit === 'forever' || unit === 'random') {
        g.style.opacity = '0.4';
        g.querySelector('input').disabled = true;
      } else {
        g.style.opacity = '1';
        g.querySelector('input').disabled = false;
      }
    }

    // 8. 상용 시나리오 주입 및 복구 API
    let currentScenarioFilter = 'all';

    function filterScenarioCat(cat, btn) {
      currentScenarioFilter = cat;
      document.querySelectorAll('.scenario-cat-btn').forEach(b => b.classList.remove('primary'));
      if (btn) btn.classList.add('primary');
      const sections = document.querySelectorAll('.scenario-category-section');
      sections.forEach(sec => {
        if (cat === 'all' || sec.dataset.cat === cat) {
          sec.style.display = 'block';
        } else {
          sec.style.display = 'none';
        }
      });
    }

    async function triggerScenario(type, action = 'inject') {
      if (!currentLab) return;
      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/scenario\`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type, action })
        });
        const data = await res.json();
        if (data.ok) {
          currentLab = data.lab;
          renderAll(currentLab);
          const actKor = action === 'resolve' ? '정상 복구' : (action === 'rollback' ? '롤백' : '장애 주입');
          appendTermLog(\`\\n<span style="color:#f59e0b;font-weight:700;">⚡ [상용 트러블슈팅 이벤트: \${type} ➔ \${actKor}]</span>\\n\`);
        } else {
          alert('시나리오 실행 실패: ' + (data.error || '권한 부족'));
        }
      } catch (err) { alert('시나리오 실행 실패: ' + err.message); }
    }

    function renderScenarioCards(lab) {
      const container = document.getElementById('scenario-cards-container');
      if (!container || !lab) return;

      const targetWorker = (lab.nodes || []).find(n => n.role === 'worker') || lab.nodes?.[0] || { name: 'w1', ip: '10.10.10.20' };
      const targetWorkerName = targetWorker.name;
      const targetWorkerIp = targetWorker.ip;
      const lbVip = lab.network?.loadBalancer?.vip || '211.252.85.10';

      // 1. 네트워크 상태
      const targetAddr = \`\${targetWorkerIp}:30080\`;
      const lbTarget = (lab.network?.loadBalancer?.targetPool || []).find(p => p.target === targetAddr || p.nodeName === targetWorkerName);
      const isLbUnhealthy = lbTarget && lbTarget.status.includes('Unhealthy');
      const isTunnelDown = lab.network?.tunnel?.status === 'DISCONNECTED';
      const isVpnDown = lab.network?.vpn?.status === 'DISCONNECTED';

      // 2. 파드 상태
      const pendingPod = (lab.pods || []).find(p => p.name === 'web-pending' && p.status === 'Pending');
      const crashPod = (lab.pods || []).find(p => p.name === 'oom-crash-app' || p.status === 'CrashLoopBackOff' || p.status === 'OOMKilled');

      // 3. 하드웨어 상태
      const osDisk = targetWorker.disks?.[0];
      const isDiskPressure = targetWorker.unschedulable && osDisk && (osDisk.usedGb / osDisk.sizeGb) > 0.85;
      const isCpuSpike = (lab.trafficRps || 0) >= 3000;

      // 4. 배포 상태
      const isDrained = targetWorker.unschedulable && !isDiskPressure;
      const dep = (lab.deployments || [])[0] || { name: 'web-service', image: 'nginx:1.24-stable', replicas: 3 };
      const isRollingActive = dep.image && dep.image.includes('1.25');

      const badgeCrit = \`<span style="background:#450a0a; color:#f87171; border:1px solid #7f1d1d; border-radius:4px; padding:2px 6px; font-size:10px; font-weight:700;">CRITICAL</span>\`;
      const badgeWarn = \`<span style="background:#451a03; color:#fbbf24; border:1px solid #78350f; border-radius:4px; padding:2px 6px; font-size:10px; font-weight:700;">WARNING</span>\`;
      const badgeMaint = \`<span style="background:#172554; color:#60a5fa; border:1px solid #1e40af; border-radius:4px; padding:2px 6px; font-size:10px; font-weight:700;">MAINTENANCE</span>\`;

      const pillRunning = \`<span class="status-pill status-running" style="font-size:10.5px;">● 정상 가동</span>\`;
      const pillError = (msg) => \`<span class="status-pill status-pending" style="font-size:10.5px; background:#ef444422; color:#ef4444; border-color:#ef4444;">🚨 \${msg}</span>\`;

      container.innerHTML = \`
        <!-- 카테고리 1: 네트워크 & L7 로드밸런싱 -->
        <div class="scenario-category-section" data-cat="cat-net" style="margin-bottom:16px; display:\${currentScenarioFilter === 'all' || currentScenarioFilter === 'cat-net' ? 'block' : 'none'};">
          <div style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:700; color:#38bdf8; margin-bottom:8px; border-left:3px solid #38bdf8; padding-left:8px;">
            🌐 1. 네트워크 & L7 로드밸런싱 장애 (Network & ALB)
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <!-- 시나리오 1-1 -->
            <div style="background:#0f1523; border:1px solid \${isLbUnhealthy ? '#ef4444' : '#1f293d'}; border-radius:6px; padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    \${badgeCrit}
                    <span style="font-size:12.5px; font-weight:700; color:#f8fafc;">L7 ALB 타겟 장애 & 503 페일오버</span>
                  </div>
                  \${isLbUnhealthy ? pillError('503 페일오버 중') : pillRunning}
                </div>
                <p style="font-size:11.5px; color:#94a3b8; line-height:1.4; margin-bottom:8px;">
                  특정 워커 노드의 서비스 프로세스 다운 시 ALB가 헬스체크 실패를 감지하고 트래픽을 정상 워커로 자동 우회(Failover)합니다.
                </p>
                <div style="font-size:11px; color:#cbd5e1; background:#1e293b55; padding:6px 8px; border-radius:4px; margin-bottom:10px; font-family:monospace;">
                  <div>• 대상 타겟: <span style="color:#38bdf8; font-weight:bold;">\${targetWorkerIp}:30080 [\${targetWorkerName}]</span></div>
                  <div>• L7 VIP: <span style="color:#a855f7;">\${lbVip}</span> (Host: app.ktci5.kr)</div>
                </div>
              </div>
              <div>
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                  <button class="btn sm danger" style="flex:1;" onclick="triggerScenario('lb_failover', 'inject')">🚨 503 장애 유발</button>
                  <button class="btn sm primary" style="flex:1;" onclick="triggerScenario('lb_failover', 'resolve')">✅ 헬스체크 복구</button>
                </div>
                <div style="font-size:10.5px; color:#64748b; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  <span>검증:</span>
                  <span class="chip-btn" onclick="runChip('curl -H &quot;Host: app.ktci5.kr&quot; http://\${lbVip}')">curl app.ktci5.kr</span>
                  <span class="chip-btn" onclick="runChip('netstat -tuln')">netstat</span>
                </div>
              </div>
            </div>

            <!-- 시나리오 1-2 -->
            <div style="background:#0f1523; border:1px solid \${isTunnelDown ? '#ef4444' : '#1f293d'}; border-radius:6px; padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    \${badgeCrit}
                    <span style="font-size:12.5px; font-weight:700; color:#f8fafc;">Cloudflare 하이브리드 터널 단절</span>
                  </div>
                  \${isTunnelDown ? pillError('502 단절') : pillRunning}
                </div>
                <p style="font-size:11.5px; color:#94a3b8; line-height:1.4; margin-bottom:8px;">
                  KT Cloud 클러스터와 외부 Cloudflare 엣지 간 아르고 터널이 끊겨 외부 도메인 인입 시 502 Bad Gateway 에러가 발생합니다.
                </p>
                <div style="font-size:11px; color:#cbd5e1; background:#1e293b55; padding:6px 8px; border-radius:4px; margin-bottom:10px; font-family:monospace;">
                  <div>• 터널 경로: <span style="color:#38bdf8;">origin.ktci5.internal ➔ Edge</span></div>
                  <div>• 연결 상태: <span style="color:\${isTunnelDown ? '#ef4444' : '#10b981'}; font-weight:bold;">\${lab.network?.tunnel?.status || 'CONNECTED'}</span></div>
                </div>
              </div>
              <div>
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                  <button class="btn sm danger" style="flex:1;" onclick="triggerScenario('tunnel_cut', 'inject')">🚨 터널 단절</button>
                  <button class="btn sm primary" style="flex:1;" onclick="triggerScenario('tunnel_cut', 'resolve')">✅ 터널 재연결</button>
                </div>
                <div style="font-size:10.5px; color:#64748b; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  <span>검증:</span>
                  <span class="chip-btn" onclick="runChip('tunnel status')">tunnel status</span>
                  <span class="chip-btn" onclick="runChip('curl -H &quot;Host: app.ktci5.kr&quot; http://\${lbVip}')">curl 테스트</span>
                </div>
              </div>
            </div>

            <!-- 시나리오 1-3 -->
            <div style="background:#0f1523; border:1px solid \${isVpnDown ? '#f59e0b' : '#1f293d'}; border-radius:6px; padding:12px; display:flex; flex-direction:column; justify-content:space-between; grid-column:span 2;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    \${badgeWarn}
                    <span style="font-size:12.5px; font-weight:700; color:#f8fafc;">기업 Site-to-Site VPN 세션 타임아웃</span>
                  </div>
                  \${isVpnDown ? pillError('VPN 단절') : pillRunning}
                </div>
                <p style="font-size:11.5px; color:#94a3b8; line-height:1.4; margin-bottom:8px;">
                  본사 인트라넷-클라우드 간 IPsec/WireGuard VPN 터널링 세션이 타임아웃되어 사내 관리 대역(192.168.100.0/24) 패킷 통신이 두절됩니다.
                </p>
                <div style="font-size:11px; color:#cbd5e1; background:#1e293b55; padding:6px 8px; border-radius:4px; margin-bottom:10px; font-family:monospace;">
                  <div>• VPN 엔드포인트: <span style="color:#38bdf8;">vpn.ktci5.kr:51820</span> | 서브넷: <span style="color:#a855f7;">192.168.100.0/24</span></div>
                </div>
              </div>
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; gap:6px;">
                  <button class="btn sm warning" onclick="triggerScenario('vpn_timeout', 'inject')">🚨 VPN 세션 단절 유발</button>
                  <button class="btn sm primary" onclick="triggerScenario('vpn_timeout', 'resolve')">✅ VPN 세션 재수립</button>
                </div>
                <div style="font-size:10.5px; color:#64748b; display:flex; align-items:center; gap:4px;">
                  <span>검증:</span>
                  <span class="chip-btn" onclick="runChip('vpn status')">vpn status</span>
                  <span class="chip-btn" onclick="runChip('ip route')">ip route</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 카테고리 2: 쿠버네티스 파드 & 스케줄링 장애 -->
        <div class="scenario-category-section" data-cat="cat-k8s" style="margin-bottom:16px; display:\${currentScenarioFilter === 'all' || currentScenarioFilter === 'cat-k8s' ? 'block' : 'none'};">
          <div style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:700; color:#a855f7; margin-bottom:8px; border-left:3px solid #a855f7; padding-left:8px;">
            ☸️ 2. 쿠버네티스 파드 & 스케줄링 장애 (K8s Pods & Lifecycle)
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <!-- 시나리오 2-1 -->
            <div style="background:#0f1523; border:1px solid \${pendingPod ? '#ef4444' : '#1f293d'}; border-radius:6px; padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    \${badgeCrit}
                    <span style="font-size:12.5px; font-weight:700; color:#f8fafc;">nodeSelector 불일치로 인한 파드 Pending</span>
                  </div>
                  \${pendingPod ? pillError('Pending 대기') : pillRunning}
                </div>
                <p style="font-size:11.5px; color:#94a3b8; line-height:1.4; margin-bottom:8px;">
                  파드가 특정 라벨(disktype=ssd)을 요구하지만 조건에 일치하는 노드가 0대여서 스케줄러가 배치를 중단하고 대기합니다.
                </p>
                <div style="font-size:11px; color:#cbd5e1; background:#1e293b55; padding:6px 8px; border-radius:4px; margin-bottom:10px; font-family:monospace;">
                  <div>• 대상 파드: <span style="color:#f59e0b; font-weight:bold;">web-pending</span> (요구: disktype=ssd)</div>
                  <div>• 배치 대상 노드: <span style="color:#38bdf8;">\${targetWorkerName} (\${targetWorkerIp})</span></div>
                </div>
              </div>
              <div>
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                  <button class="btn sm danger" style="flex:1;" onclick="triggerScenario('pod_pending', 'inject')">🚨 Pending 파드 생성</button>
                  <button class="btn sm primary" style="flex:1;" onclick="triggerScenario('pod_pending', 'resolve')">✅ 노드 라벨 부여 해결</button>
                </div>
                <div style="font-size:10.5px; color:#64748b; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  <span>검증/해결:</span>
                  <span class="chip-btn" onclick="runChip('k get pods -o wide')">k get pods</span>
                  <span class="chip-btn" onclick="runChip('k describe pod web-pending')">describe pod</span>
                  <span class="chip-btn" onclick="runChip('k label nodes \${targetWorkerName} disktype=ssd')">k label nodes</span>
                </div>
              </div>
            </div>

            <!-- 시나리오 2-2 -->
            <div style="background:#0f1523; border:1px solid \${crashPod ? '#ef4444' : '#1f293d'}; border-radius:6px; padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    \${badgeCrit}
                    <span style="font-size:12.5px; font-weight:700; color:#f8fafc;">컨테이너 OOMKilled & CrashLoopBackOff</span>
                  </div>
                  \${crashPod ? pillError('CrashLoopBackOff') : pillRunning}
                </div>
                <p style="font-size:11.5px; color:#94a3b8; line-height:1.4; margin-bottom:8px;">
                  메모리 누수로 limit(128Mi)을 초과하여 Linux OOM-Killer에 의해 강제 종료(Exit 137)되고 파드가 무한 재기동에 빠집니다.
                </p>
                <div style="font-size:11px; color:#cbd5e1; background:#1e293b55; padding:6px 8px; border-radius:4px; margin-bottom:10px; font-family:monospace;">
                  <div>• 대상 파드: <span style="color:#ef4444; font-weight:bold;">oom-crash-app</span> (Exit 137)</div>
                  <div>• 호스트 노드: <span style="color:#38bdf8;">\${targetWorkerName} (\${targetWorkerIp})</span></div>
                </div>
              </div>
              <div>
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                  <button class="btn sm danger" style="flex:1;" onclick="triggerScenario('pod_crash', 'inject')">🚨 OOM Crash 유발</button>
                  <button class="btn sm primary" style="flex:1;" onclick="triggerScenario('pod_crash', 'resolve')">✅ 메모리 한도 상향 복구</button>
                </div>
                <div style="font-size:10.5px; color:#64748b; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  <span>검증:</span>
                  <span class="chip-btn" onclick="runChip('k get pods -o wide')">k get pods</span>
                  <span class="chip-btn" onclick="runChip('k describe pod oom-crash-app')">describe pod</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 카테고리 3: 스토리지 & 시스템 자원 고갈 -->
        <div class="scenario-category-section" data-cat="cat-hw" style="margin-bottom:16px; display:\${currentScenarioFilter === 'all' || currentScenarioFilter === 'cat-hw' ? 'block' : 'none'};">
          <div style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:700; color:#f59e0b; margin-bottom:8px; border-left:3px solid #f59e0b; padding-left:8px;">
            💽 3. 스토리지 & 시스템 자원 고갈 (Storage & Compute)
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <!-- 시나리오 3-1 -->
            <div style="background:#0f1523; border:1px solid \${isDiskPressure ? '#ef4444' : '#1f293d'}; border-radius:6px; padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    \${badgeCrit}
                    <span style="font-size:12.5px; font-weight:700; color:#f8fafc;">노드 루트 디스크 96% 고갈 (DiskPressure)</span>
                  </div>
                  \${isDiskPressure ? pillError('DiskPressure') : pillRunning}
                </div>
                <p style="font-size:11.5px; color:#94a3b8; line-height:1.4; margin-bottom:8px;">
                  로그 폭증으로 워커 노드(/dev/vda)가 96% 고갈되어 Kubelet이 DiskPressure를 발동하고 신규 파드 배치를 즉시 차단(Cordon)합니다.
                </p>
                <div style="font-size:11px; color:#cbd5e1; background:#1e293b55; padding:6px 8px; border-radius:4px; margin-bottom:10px; font-family:monospace;">
                  <div>• 대상 노드: <span style="color:#38bdf8; font-weight:bold;">\${targetWorkerName} (\${targetWorkerIp})</span></div>
                  <div>• 마운트: <span style="color:#f59e0b;">/dev/vda (/): \${osDisk?.usedGb || 20}/\${osDisk?.sizeGb || 50}GB</span></div>
                </div>
              </div>
              <div>
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                  <button class="btn sm danger" style="flex:1;" onclick="triggerScenario('disk_pressure', 'inject')">🚨 디스크 96% 고갈 유발</button>
                  <button class="btn sm primary" style="flex:1;" onclick="triggerScenario('disk_pressure', 'resolve')">✅ 로그 정리 (정상화)</button>
                </div>
                <div style="font-size:10.5px; color:#64748b; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  <span>검증:</span>
                  <span class="chip-btn" onclick="runChip('df -h')">df -h</span>
                  <span class="chip-btn" onclick="runChip('k describe node \${targetWorkerName}')">describe node</span>
                </div>
              </div>
            </div>

            <!-- 시나리오 3-2 -->
            <div style="background:#0f1523; border:1px solid \${isCpuSpike ? '#f59e0b' : '#1f293d'}; border-radius:6px; padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    \${badgeWarn}
                    <span style="font-size:12.5px; font-weight:700; color:#f8fafc;">트래픽 폭증 & vCPU 95% 스파이크</span>
                  </div>
                  \${isCpuSpike ? pillError('vCPU 스파이크') : pillRunning}
                </div>
                <p style="font-size:11.5px; color:#94a3b8; line-height:1.4; margin-bottom:8px;">
                  대규모 접속자가 몰려 4,200 RPS의 트래픽이 인입되면서 vCPU 한계에 도달하고 Throttling 및 응답 지연이 급증합니다.
                </p>
                <div style="font-size:11px; color:#cbd5e1; background:#1e293b55; padding:6px 8px; border-radius:4px; margin-bottom:10px; font-family:monospace;">
                  <div>• 인바운드 트래픽: <span style="color:#f59e0b; font-weight:bold;">\${lab.trafficRps || 0} RPS</span></div>
                  <div>• 대상 노드: <span style="color:#38bdf8;">\${targetWorkerName} (\${targetWorkerIp})</span></div>
                </div>
              </div>
              <div>
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                  <button class="btn sm warning" style="flex:1;" onclick="triggerScenario('cpu_spike', 'inject')">🚨 4200 RPS 스파이크</button>
                  <button class="btn sm primary" style="flex:1;" onclick="triggerScenario('cpu_spike', 'resolve')">✅ 트래픽 안정화 (120 RPS)</button>
                </div>
                <div style="font-size:10.5px; color:#64748b; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  <span>검증:</span>
                  <span class="chip-btn" onclick="runChip('k top nodes')">k top nodes</span>
                  <span class="chip-btn" onclick="runChip('k top pods')">k top pods</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 카테고리 4: 무중단 배포 & 유지보수 실습 -->
        <div class="scenario-category-section" data-cat="cat-devops" style="display:\${currentScenarioFilter === 'all' || currentScenarioFilter === 'cat-devops' ? 'block' : 'none'};">
          <div style="display:flex; align-items:center; gap:6px; font-size:13px; font-weight:700; color:#10b981; margin-bottom:8px; border-left:3px solid #10b981; padding-left:8px;">
            🔄 4. 무중단 배포 & 유지보수 실습 (DevOps & Maintenance)
          </div>
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
            <!-- 시나리오 4-1 -->
            <div style="background:#0f1523; border:1px solid \${isDrained ? '#3b82f6' : '#1f293d'}; border-radius:6px; padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    \${badgeMaint}
                    <span style="font-size:12.5px; font-weight:700; color:#f8fafc;">노드 커널 패치용 무중단 대피 (Drain)</span>
                  </div>
                  \${isDrained ? \`<span class="status-pill status-pending" style="color:#60a5fa; border-color:#60a5fa;">🔧 Drain 격리 중</span>\` : pillRunning}
                </div>
                <p style="font-size:11.5px; color:#94a3b8; line-height:1.4; margin-bottom:8px;">
                  OS 보안 패치를 위해 워커 노드를 격리(Cordon)하고 구동 중인 파드를 타 노드로 안전하게 무중단 축출(Evict)합니다.
                </p>
                <div style="font-size:11px; color:#cbd5e1; background:#1e293b55; padding:6px 8px; border-radius:4px; margin-bottom:10px; font-family:monospace;">
                  <div>• 작업 대상 노드: <span style="color:#38bdf8; font-weight:bold;">\${targetWorkerName} (\${targetWorkerIp})</span></div>
                  <div>• 스케줄링 상태: <span style="color:\${isDrained ? '#ef4444' : '#10b981'}; font-weight:bold;">\${targetWorker.unschedulable ? 'SchedulingDisabled' : 'Schedulable'}</span></div>
                </div>
              </div>
              <div>
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                  <button class="btn sm warning" style="flex:1;" onclick="triggerScenario('node_drain', 'inject')">🚨 노드 Drain 파드 퇴출</button>
                  <button class="btn sm primary" style="flex:1;" onclick="triggerScenario('node_drain', 'resolve')">✅ 노드 복귀 (Uncordon)</button>
                </div>
                <div style="font-size:10.5px; color:#64748b; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  <span>명령어:</span>
                  <span class="chip-btn" onclick="runChip('k drain \${targetWorkerName} --ignore-daemonsets')">k drain</span>
                  <span class="chip-btn" onclick="runChip('k uncordon \${targetWorkerName}')">k uncordon</span>
                  <span class="chip-btn" onclick="runChip('k get nodes -o wide')">k get nodes</span>
                </div>
              </div>
            </div>

            <!-- 시나리오 4-2 -->
            <div style="background:#0f1523; border:1px solid #1f293d; border-radius:6px; padding:12px; display:flex; flex-direction:column; justify-content:space-between;">
              <div>
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:6px;">
                  <div style="display:flex; align-items:center; gap:6px;">
                    \${badgeMaint}
                    <span style="font-size:12.5px; font-weight:700; color:#f8fafc;">무중단 롤링 업데이트 & 즉각 롤백</span>
                  </div>
                  <span class="status-pill status-running" style="color:#10b981; border-color:#10b981;">● \${dep.image || 'nginx:1.24-stable'}</span>
                </div>
                <p style="font-size:11.5px; color:#94a3b8; line-height:1.4; margin-bottom:8px;">
                  신규 컨테이너 이미지를 단계적으로 교체하고, 배포 이상 감지 시 1초 만에 'rollout undo'로 무중단 원상 복구합니다.
                </p>
                <div style="font-size:11px; color:#cbd5e1; background:#1e293b55; padding:6px 8px; border-radius:4px; margin-bottom:10px; font-family:monospace;">
                  <div>• 대상 디플로이먼트: <span style="color:#38bdf8; font-weight:bold;">\${dep.name} (\${dep.replicas || 3} Pods)</span></div>
                  <div>• 현재 이미지: <span style="color:#10b981;">\${dep.image || 'nginx:1.24-stable'}</span></div>
                </div>
              </div>
              <div>
                <div style="display:flex; gap:6px; margin-bottom:8px;">
                  <button class="btn sm primary" style="flex:1;" onclick="triggerScenario('rolling_update', 'inject')">🔄 신규 버전 배포 (v1.25)</button>
                  <button class="btn sm warning" style="flex:1;" onclick="triggerScenario('rolling_update', 'resolve')">⏪ 즉각 롤백 (Rollout Undo)</button>
                </div>
                <div style="font-size:10.5px; color:#64748b; display:flex; align-items:center; gap:4px; flex-wrap:wrap;">
                  <span>명령어:</span>
                  <span class="chip-btn" onclick="runChip('k rollout status deploy/\${dep.name}')">rollout status</span>
                  <span class="chip-btn" onclick="runChip('k rollout undo deploy/\${dep.name}')">rollout undo</span>
                  <span class="chip-btn" onclick="runChip('k get deploy -o wide')">k get deploy</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      \`;
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
      const durationUnit = document.getElementById('deploy-form-unit').value;
      const durationValue = document.getElementById('deploy-form-duration').value;

      try {
        const res = await fetch(\`/api/simulator/labs/\${currentLab.id}/workloads\`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name, image, replicas, cpuReqM: cpu, disktype, exposeNodePort, durationUnit, durationValue })
        });
        const data = await res.json();
        if (data.ok) {
          closeModal('deploy-modal');
          currentLab = data.lab;
          renderAll(currentLab);
          appendTermLog(\`\\n<span style="color:#10b981;font-weight:700;">📦 워크로드 '\${name}' 배포 완료 (\${durationUnit} 설정)</span>\\n\`);
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

    let localTicker = null;
    function startPolling(labId) {
      stopPolling();
      // 1초 단위 로컬 카운트다운 및 처리량 지터(jitter) 렌더러
      localTicker = setInterval(() => {
        if (!currentLab || currentLab.id !== labId) return;
        renderAll(currentLab);
      }, 1000);

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
      if (localTicker) { clearInterval(localTicker); localTicker = null; }
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

    // ==========================================
    // 10. AI 인프라 코파일럿 컨트롤러
    // ==========================================
    let aiPanelOpen = false;

    function toggleAiCopilot() {
      aiPanelOpen = !aiPanelOpen;
      const panel = document.getElementById('ai-copilot-panel');
      if (!panel) return;
      if (aiPanelOpen) {
        panel.classList.add('active');
        const chatBody = document.getElementById('ai-chat-body');
        if (!chatBody.children.length) {
          askAiPreset('troubleshoot');
        }
      } else {
        panel.classList.remove('active');
      }
    }

    function updateAiCopilotBadge(lab) {
      const badge = document.getElementById('ai-alert-badge');
      if (!badge) return;
      if (!lab) {
        badge.className = 'ai-trigger-badge';
        badge.innerText = '가이드';
        return;
      }
      let issues = 0;
      if (lab.nodes) {
        lab.nodes.forEach(n => {
          if (n.diskPressure || n.status === 'SchedulingDisabled') issues++;
          const cpuPct = n.cpuTotalM > 0 ? Math.round(((n.cpuAllocated || 0) / n.cpuTotalM) * 100) : 0;
          if (cpuPct >= 85) issues++;
        });
      }
      if (lab.pods) {
        lab.pods.forEach(p => {
          if (p.status === 'Pending') issues++;
        });
      }
      if (lab.network && lab.network.loadBalancer && !lab.network.loadBalancer.healthy) issues++;
      if (lab.network && lab.network.tunnel && lab.network.tunnel.status !== 'connected') issues++;

      if (issues > 0) {
        badge.className = 'ai-trigger-badge warn';
        badge.innerText = issues + '개 장애 감지';
      } else {
        badge.className = 'ai-trigger-badge';
        badge.innerText = '정상';
      }
    }

    function askAiPrompt(text) {
      const input = document.getElementById('ai-user-input');
      if (input) {
        input.value = text;
        const form = document.querySelector('.ai-input-form');
        if (form) form.requestSubmit();
      }
    }

    async function askAiPreset(topic) {
      document.querySelectorAll('.ai-preset-chip').forEach(c => c.classList.remove('active'));
      const activeChip = document.getElementById('chip-' + topic);
      if (activeChip) activeChip.classList.add('active');

      const chatBody = document.getElementById('ai-chat-body');
      const loadId = 'ai-loading-' + Date.now();
      chatBody.innerHTML += '<div class="ai-msg bot" id="' + loadId + '">' +
        '<div class="ai-card" style="text-align:center; color:#94a3b8; padding:16px;">' +
          '<div style="font-size:20px; margin-bottom:6px;">🤖</div>' +
          'AI 코파일럿이 교안 데이터와 인프라 상태를 분석하고 있습니다...' +
        '</div>' +
      '</div>';
      chatBody.scrollTop = chatBody.scrollHeight;

      const lastCmd = commandHistory.length > 0 ? commandHistory[commandHistory.length - 1] : '';
      const recentCmds = commandHistory.slice(-5);
      const curCmd = document.getElementById('term-input') ? document.getElementById('term-input').value.trim() : '';

      try {
        const apiUrl = currentLab ? ('/api/simulator/labs/' + currentLab.id + '/ai') : '/api/simulator/ai';
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            topic: topic,
            lab: currentLab,
            lastCommand: lastCmd,
            currentCommand: curCmd,
            commandHistory: recentCmds
          })
        });
        const data = await res.json();
        const loadElem = document.getElementById(loadId);
        if (loadElem) loadElem.remove();

        if (data.ok && data.response) {
          renderAiResponse(data.response);
        } else {
          chatBody.innerHTML += '<div class="ai-msg bot"><div class="ai-card" style="color:#ef4444;">조언을 불러오지 못했습니다.</div></div>';
        }
      } catch (err) {
        const loadElem = document.getElementById(loadId);
        if (loadElem) loadElem.remove();
        chatBody.innerHTML += '<div class="ai-msg bot"><div class="ai-card" style="color:#ef4444;">통신 오류: ' + escapeHtml(err.message) + '</div></div>';
      }
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    async function handleAiInputSubmit(e) {
      e.preventDefault();
      const input = document.getElementById('ai-user-input');
      const prompt = (input.value || '').trim();
      if (!prompt) return;
      input.value = '';

      const chatBody = document.getElementById('ai-chat-body');
      chatBody.innerHTML += '<div class="ai-msg user">' +
        '<div class="ai-msg-bubble">' + escapeHtml(prompt) + '</div>' +
      '</div>';
      chatBody.scrollTop = chatBody.scrollHeight;

      const loadId = 'ai-loading-' + Date.now();
      chatBody.innerHTML += '<div class="ai-msg bot" id="' + loadId + '">' +
        '<div class="ai-card" style="text-align:center; color:#94a3b8; padding:16px;">' +
          '<div style="font-size:20px; margin-bottom:6px;">🤖</div>' +
          '교안 데이터 및 터미널 명령어 분석 중...' +
        '</div>' +
      '</div>';
      chatBody.scrollTop = chatBody.scrollHeight;

      const lastCmd = commandHistory.length > 0 ? commandHistory[commandHistory.length - 1] : '';
      const recentCmds = commandHistory.slice(-5);
      const curCmd = document.getElementById('term-input') ? document.getElementById('term-input').value.trim() : '';

      try {
        const apiUrl = currentLab ? ('/api/simulator/labs/' + currentLab.id + '/ai') : '/api/simulator/ai';
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt,
            topic: 'general',
            lab: currentLab,
            lastCommand: lastCmd,
            currentCommand: curCmd,
            commandHistory: recentCmds
          })
        });
        const data = await res.json();
        const loadElem = document.getElementById(loadId);
        if (loadElem) loadElem.remove();

        if (data.ok && data.response) {
          renderAiResponse(data.response);
        } else {
          chatBody.innerHTML += '<div class="ai-msg bot"><div class="ai-card" style="color:#ef4444;">답변을 생성하지 못했습니다.</div></div>';
        }
      } catch (err) {
        const loadElem = document.getElementById(loadId);
        if (loadElem) loadElem.remove();
        chatBody.innerHTML += '<div class="ai-msg bot"><div class="ai-card" style="color:#ef4444;">통신 오류: ' + escapeHtml(err.message) + '</div></div>';
      }
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    function renderAiResponse(resp) {
      const chatBody = document.getElementById('ai-chat-body');
      const isWarn = resp.statusBadge?.type === 'critical';
      const badgeText = resp.model || resp.statusBadge?.text || 'AI 코파일럿';

      let bodyHtml = '';

      if (resp.answer) {
        let cmdHtml = '';
        if (resp.cmd) {
          const escapedCmd = escapeHtml(resp.cmd);
          const encodedCmd = encodeURIComponent(resp.cmd);
          cmdHtml = '<div class="ai-cmd-section">' +
            '<div class="ai-cmd-label">⚡ 권장 실행 명령어</div>' +
            '<div class="ai-cmd-box">' +
              '<span class="ai-cmd-text">' + escapedCmd + '</span>' +
              '<div class="ai-cmd-actions">' +
                '<button type="button" class="ai-mini-btn btn-ai-copy" data-cmd="' + encodedCmd + '">📋 복사</button>' +
                '<button type="button" class="ai-mini-btn btn-ai-paste" data-cmd="' + encodedCmd + '">⌨️ 입력</button>' +
                '<button type="button" class="ai-mini-btn primary btn-ai-exec" data-cmd="' + encodedCmd + '">⚡ 즉시 실행</button>' +
              '</div>' +
            '</div>' +
          '</div>';
        }

        let verifyHtml = '';
        if (resp.verifyCmd) {
          const escapedVerify = escapeHtml(resp.verifyCmd);
          const encodedVerify = encodeURIComponent(resp.verifyCmd);
          verifyHtml = '<div class="ai-cmd-section" style="margin-top:6px;">' +
            '<div class="ai-cmd-label" style="font-size:11px;color:#94a3b8;">🔍 결과 검증 명령어</div>' +
            '<div class="ai-cmd-box" style="background:#090d16;">' +
              '<span class="ai-cmd-text" style="font-size:11px;color:#cbd5e1;">' + escapedVerify + '</span>' +
              '<div class="ai-cmd-actions">' +
                '<button type="button" class="ai-mini-btn btn-ai-copy" data-cmd="' + encodedVerify + '">📋</button>' +
                '<button type="button" class="ai-mini-btn primary btn-ai-exec" data-cmd="' + encodedVerify + '">⚡ 실행</button>' +
              '</div>' +
            '</div>' +
          '</div>';
        }

        let screenHtml = '';
        if (resp.screenNote) {
          screenHtml = '<div class="ai-screen-note">📊 <b>화면 연계:</b> ' + escapeHtml(resp.screenNote) + '</div>';
        }

        let tipHtml = '';
        if (resp.tip) {
          tipHtml = '<div class="ai-tip-note">💡 <b>핵심 팁:</b> ' + escapeHtml(resp.tip) + '</div>';
        }

        let modalHtml = '';
        if (resp.modalId) {
          modalHtml = '<div style="margin-top:8px;">' +
            '<button type="button" class="btn sm primary btn-ai-modal" style="font-size:11px;padding:4px 10px;" data-modal="' + escapeHtml(resp.modalId) + '">👉 ' + escapeHtml(resp.menuGuide || '해당 메뉴 열기') + '</button>' +
          '</div>';
        }

        bodyHtml = '<div class="ai-card-answer">' + escapeHtml(resp.answer) + '</div>' +
          cmdHtml +
          verifyHtml +
          screenHtml +
          tipHtml +
          modalHtml;
      } else {
        let sectionsHtml = '';
        (resp.sections || []).forEach(sec => {
          let itemsHtml = '';
          (sec.items || []).forEach(item => {
            let cmdHtml = '';
            if (item.cmd) {
              const escapedCmd = escapeHtml(item.cmd);
              const encodedCmd = encodeURIComponent(item.cmd);
              cmdHtml = '<div class="ai-cmd-box">' +
                '<span class="ai-cmd-text">' + escapedCmd + '</span>' +
                '<div class="ai-cmd-actions">' +
                  '<button type="button" class="ai-mini-btn btn-ai-copy" data-cmd="' + encodedCmd + '">📋 복사</button>' +
                  '<button type="button" class="ai-mini-btn btn-ai-paste" data-cmd="' + encodedCmd + '">⌨️ 입력</button>' +
                  '<button type="button" class="ai-mini-btn primary btn-ai-exec" data-cmd="' + encodedCmd + '">⚡ 즉시 실행</button>' +
                '</div>' +
              '</div>';
            }
            let menuActionHtml = '';
            if (item.modalId) {
              menuActionHtml = '<div style="margin-top:6px;">' +
                '<button type="button" class="btn sm primary btn-ai-modal" style="font-size:10.5px; padding:3px 8px;" data-modal="' + escapeHtml(item.modalId) + '">👉 ' + escapeHtml(item.menuGuide || '해당 메뉴 열기') + '</button>' +
              '</div>';
            }

            itemsHtml += '<div class="ai-item">' +
              '<div class="ai-item-head">' +
                '<span class="ai-item-name">' + escapeHtml(item.title) + '</span>' +
                '<span class="ai-tag ' + (item.tag === '긴급 조치' ? 'critical' : '') + '">' + escapeHtml(item.tag || '안내') + '</span>' +
              '</div>' +
              '<div class="ai-item-desc">' + escapeHtml(item.desc) + '</div>' +
              cmdHtml +
              menuActionHtml +
            '</div>';
          });

          sectionsHtml += '<div class="ai-card-section">' +
            '<div class="ai-section-title">' + escapeHtml(sec.icon || '📌') + ' ' + escapeHtml(sec.title) + '</div>' +
            itemsHtml +
          '</div>';
        });
        bodyHtml = '<div class="ai-card-summary">' + escapeHtml(resp.summary || '') + '</div>' + sectionsHtml;
      }

      const cardHtml = '<div class="ai-msg bot">' +
        '<div class="ai-card">' +
          '<div class="ai-card-head">' +
            '<div class="ai-card-title">' + escapeHtml(resp.title) + '</div>' +
            '<span class="ai-trigger-badge ' + (isWarn ? 'warn' : '') + '">' + escapeHtml(badgeText) + '</span>' +
          '</div>' +
          bodyHtml +
        '</div>' +
      '</div>';

      chatBody.innerHTML += cardHtml;
      chatBody.scrollTop = chatBody.scrollHeight;
    }

    // AI 카드 버튼 클릭 이벤트 위임
    const aiChatBodyEl = document.getElementById('ai-chat-body');
    if (aiChatBodyEl) {
      aiChatBodyEl.addEventListener('click', function(e) {
        const btn = e.target.closest('button');
        if (!btn) return;
        if (btn.classList.contains('btn-ai-copy')) {
          copyAiCmd(decodeURIComponent(btn.dataset.cmd || ''));
        } else if (btn.classList.contains('btn-ai-paste')) {
          pasteAiCmd(decodeURIComponent(btn.dataset.cmd || ''));
        } else if (btn.classList.contains('btn-ai-exec')) {
          execAiCmd(decodeURIComponent(btn.dataset.cmd || ''));
        } else if (btn.classList.contains('btn-ai-modal')) {
          const modalId = btn.dataset.modal;
          if (modalId) openModal(modalId);
        }
      });
    }

    function copyAiCmd(text) {
      navigator.clipboard.writeText(text).then(() => {
        alert('명령어가 클립보드에 복사되었습니다: ' + text);
      }).catch(() => {
        prompt('명령어를 복사하세요:', text);
      });
    }

    function pasteAiCmd(cmd) {
      const canvas = document.getElementById('split-canvas');
      if (canvas && canvas.classList.contains('mode-0-100')) {
        setViewMode('mode-50-50');
      }
      const termInput = document.getElementById('term-input');
      if (termInput) {
        termInput.value = cmd;
        termInput.focus();
      }
    }

    async function execAiCmd(cmd) {
      const canvas = document.getElementById('split-canvas');
      if (canvas && canvas.classList.contains('mode-0-100')) {
        setViewMode('mode-50-50');
      }
      const promptEl = document.getElementById('term-prompt');
      const promptText = promptEl ? promptEl.innerText : 'admin@ktci5-control:~$';
      appendTermLog('\\n<span style="color:#10b981;font-weight:700;">' + escapeHtml(promptText) + '</span> ' + escapeHtml(cmd) + '\\n');
      await executeCommand(cmd);
    }

    loadLabs();
    updateAiCopilotBadge(null);
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
