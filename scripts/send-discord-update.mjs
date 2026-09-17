import { loadEnv, discord } from './_env.mjs';

const env = loadEnv(['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID']);
const SITE = 'https://ktci5.kr';
const BLUE = 0x3b82f6;
const CYAN = 0x06b6d4;

// 1. 공지사항 채널 (1541788665104175154)
const announceEmbed = {
  title: '📢 [업데이트] 쿠버네티스(Kubernetes) 실무 강의 정리 & 마스터·워커 구축 가이드 공개',
  color: BLUE,
  description:
    'KT Cloud 5기 클라우드 인프라 포털에 **쿠버네티스(K8s) 신규 교육 과정**과 **마스터·워커 노드 원클릭 구축 실습 가이드**가 업데이트되었습니다.\n' +
    '이론과 명령어 암기를 넘어, 컨테이너 오케스트레이션 및 클라우드 네이티브 인프라 전체를 체계적으로 학습하실 수 있습니다.',
  fields: [
    {
      name: '☸️ 서버(master1) & 워커(w1) 단계별 실습 가이드',
      value:
        '• 서버측(`master1`)과 워커측(`w1`) 작업을 명확히 분리하여 터미널 블록 단위로 한 번에 복사·실행할 수 있도록 정리되었습니다.\n' +
        '• 💡 **[필독] 실습 IP 안내**: 본 가이드의 IP(`master1: 10.10.10.12`, `w1: 10.10.20`, 게이트웨이 `10.10.10.2`)는 **기본 예시 IP**로 구성되었습니다. 수강생 각자의 VMware 서브넷 대역이나 DHCP 환경(예: `192.168.100.x` 등) 및 인터페이스명(`ens160` 등)에 맞추어 유연하게 변경하여 적용하시면 정상 동작합니다.'
    },
    {
      name: '🌐 Tigera Operator & Calico CNI (v3.32.2) 연동',
      value:
        '• `172.20.0.0/16` Pod CIDR 맞춤 커스텀 리소스 설정 및 배포\n' +
        '• 초기화 단계(`Init:1/3`, `Init:2/3`)와 CoreDNS `Pending` 대기 원리 및 실시간 모니터링 트러블슈팅 분석 수록'
    },
    {
      name: '📘 쿠버네티스 12개 전 단원 심층 정리',
      value:
        '① 아키텍처 (etcd·API·스케줄러·kubelet) ② Kubeadm 클러스터 ③ Kubectl CLI ④ Pod ⑤ YAML 명세 ⑥ Controller ⑦ Service 4대 유형 ⑧ RollingUpdate 무중단 배포 & 롤백 ⑨ RBAC 보안 ⑩ Helm v3 ⑪ PV/PVC 스토리지 ⑫ 고가용성(HA)'
    },
    {
      name: '⚡ 실무 치트시트 130개 항목 확장',
      value:
        '• `☸️ 쿠버네티스` 16개 핵심 실무 명령어 탭 신설\n' +
        '• 모든 명령어에 한국어 어원 및 줄인말 해설(`💡 용어 설명`), 툴팁, 실무 장애 해결 시나리오 통합'
    }
  ],
  footer: { text: 'KT Cloud CI5 포털 · 상시 열람 가능' },
  timestamp: new Date().toISOString(),
};

const announceButtons = {
  type: 1,
  components: [
    { type: 2, style: 5, label: '📘 쿠버네티스 강의 열람', url: `${SITE}/study/course/k8s` },
    { type: 2, style: 5, label: '🛠️ 마스터·워커 구축 가이드', url: `${SITE}/study/course/k8s/install` },
    { type: 2, style: 5, label: '⚡ 실무 치트시트 (130개)', url: `${SITE}/study/cheatsheet` }
  ]
};

// 2. 컨테이너-쿠버네티스 채널 (1542059061070274621)
const k8sChannelEmbed = {
  title: '☸️ 쿠버네티스 마스터·워커 2노드 클러스터 구축 가이드 & 실무 치트시트',
  color: CYAN,
  description:
    '수업 실습을 위해 서버(`master1`)와 워커(`w1`) 노드로 분리 구성한 **원클릭 터미널 구축 가이드**가 웹에 등록되었습니다.\n' +
    `${SITE}/study/course/k8s/install`,
  fields: [
    {
      name: '📌 실습 IP 구성 안내 (기본 예시 IP)',
      value:
        '가이드에 기재된 IP(`서버: 10.10.10.12`, `워커: 10.10.20`, GW: `10.10.10.2`)는 **실습용 기본 예시 IP**입니다.\n' +
        '각자 VMware 가상머신 서브넷이나 DHCP 대역(예: `192.168.100.x`), 인터페이스명(`ens160`, `eth0`)에 맞게 변경하여 실행하시면 됩니다.'
    },
    {
      name: '🚀 서버(master1) 3단계 핵심 작업',
      value:
        '`1` 호스트명/netplan 고정 IP 설정\n' +
        '`2` containerd 런타임 최적화(`SystemdCgroup = true`), 커널 모듈(`overlay`, `br_netfilter`), k8s v1.36 패키지 설치\n' +
        '`3` `kubeadm init --pod-network-cidr=172.20.0.0/16` & Calico v3.32.2 Tigera Operator 배포'
    },
    {
      name: '🤝 워커(w1) 조인 및 상태 확인',
      value:
        '`1` 호스트명/netplan 고정 IP 설정\n' +
        '`2` `kubeadm join 10.10.10.12:6443 --token ...` 참여\n' +
        '`3` `watch kubectl get po -A -o wide` 로 calico-node가 `Running(1/1)`이 될 때까지 1~2분 대기'
    }
  ],
  footer: { text: '질문이나 막히는 부분은 언제든 채널에 남겨주세요!' },
  timestamp: new Date().toISOString(),
};

const k8sChannelButtons = {
  type: 1,
  components: [
    { type: 2, style: 5, label: '🛠️ 마스터·워커 구축 가이드 바로가기', url: `${SITE}/study/course/k8s/install` },
    { type: 2, style: 5, label: '☸️ K8s 전체 12개 장 보기', url: `${SITE}/study/course/k8s` },
    { type: 2, style: 5, label: '⚡ K8s 치트시트 (16개 명령)', url: `${SITE}/study/cheatsheet` }
  ]
};

async function run() {
  console.log('1. 📢-공지사항 메시지 전송 중...');
  const r1 = await discord(env, '/channels/1541788665104175154/messages', {
    method: 'POST',
    body: JSON.stringify({ embeds: [announceEmbed], components: [announceButtons] }),
  });
  console.log('✅ 공지사항 전송 완료! ID:', r1?.id);

  console.log('2. 🐳-컨테이너-쿠버네티스 메시지 전송 중...');
  const r2 = await discord(env, '/channels/1542059061070274621/messages', {
    method: 'POST',
    body: JSON.stringify({ embeds: [k8sChannelEmbed], components: [k8sChannelButtons] }),
  });
  console.log('✅ 컨테이너-쿠버네티스 전송 완료! ID:', r2?.id);
}

run().catch(console.error);
