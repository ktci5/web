import { loadEnv, discord } from './_env.mjs';

const env = loadEnv(['DISCORD_BOT_TOKEN', 'DISCORD_GUILD_ID']);
const SITE = 'https://ktci5.kr';
const BLUE = 0x3b82f6;
const CYAN = 0x06b6d4;

// 1. 공지사항 채널 (1541788665104175154)
const announceEmbed = {
  title: '📢 [업데이트] 쿠버네티스(Kubernetes) 2노드 클러스터 구축 완료 및 실무 실습 확장 안내',
  color: BLUE,
  description:
    'KT Cloud 5기 클라우드 인프라 포털에 **마스터(`10.10.10.12`) & 워커(`10.10.10.20`) 2노드 쿠버네티스 클러스터 구축 완료** 및 최신 강의 실습 11개 영역이 전면 업데이트되었습니다.\n' +
    '터미널 블록 복사로 손쉽게 클러스터를 구축하고, 애플리케이션 배포부터 대시보드 관리까지 원스톱으로 실습하실 수 있습니다.',
  fields: [
    {
      name: '☸️ 마스터(10.10.10.12) & 워커(10.10.20) 구축 가이드',
      value:
        '• 서버(`master1`)와 워커(`w1`) 작업을 분리하여 터미널 블록 단위로 한 번에 복사·실행할 수 있도록 정리 완료\n' +
        '• Calico CNI v3.32.2 연동 (`172.20.0.0/16`), 초기화 단계(`Init:1/3`, `Init:2/3`) 및 CoreDNS 대기 원리 분석 수록\n' +
        '• 💡 **실습 IP 안내**: 기본 예시 IP(`10.10.10.12`, `10.10.10.20`) 외 각자의 가상머신 서브넷 환경에 맞게 유연하게 적용 가능'
    },
    {
      name: '🚀 핵심 실무 실습 8대 파이프라인 신규 반영',
      value:
        '① **마스터 Taint 해제 & CLI 최적화**: `control-plane-` Taint 해제 및 `alias k=kubectl`·bash 자동완성 등록\n' +
        '② **앱 배포 & NodePort 노출**: `k run web/hhs` 배포, 30000번대 NodePort 서비스 매핑 및 외부 curl 통신 검증\n' +
        '③ **멀티 컨테이너 파드**: Nginx + Busybox(`c2`), 동일 Pod 내 네트워크(Loopback `127.0.0.1`, Pod IP) 및 볼륨 공유 검증\n' +
        '④ **YAML 템플릿 추출**: `--dry-run=client` vs `--dry-run=server` 기반 Deployment/Service 템플릿 자동 생성\n' +
        '⑤ **라벨 & nodeSelector**: 라벨 필터링, `disktype=hdd` 스케줄링 실패 `Pending` 분석 및 즉시 해소 트러블슈팅\n' +
        '⑥ **무중단 롤링 배포**: `k set image` 무중단 교체, `k rollout status/undo` 즉시 롤백, Blue/Green & Canary 전략\n' +
        '⑦ **성능 모니터링**: Metrics-Server 배포, 자체 서명 TLS용 `--kubelet-insecure-tls` 패치 및 `kubectl top` 계측\n' +
        '⑧ **웹 대시보드(Dashboard v2.6.1)**: NodePort 노출, 최고 관리자 RBAC 바인딩(`kdb-admin`), JWT 토큰 로그인 및 Skip Login 지원'
    },
    {
      name: '⚡ 실무 치트시트 130개 항목 & K8s 전용 탭 활성화',
      value:
        '• 웹 허브 포털(https://ktci5.kr/study/cheatsheet)에 `☸️ 쿠버네티스` 16개 핵심 실무 명령어 탭 동기화 완료\n' +
        '• 모든 명령어에 한국어 어원 및 줄인말 해설(`💡 용어 설명`), 툴팁, 실무 장애 해결 시나리오 통합'
    }
  ],
  footer: { text: 'KT Cloud CI5 포털 · 상시 열람 가능' },
  timestamp: new Date().toISOString(),
};

const announceButtons = {
  type: 1,
  components: [
    { type: 2, style: 5, label: '🛠️ 마스터·워커 구축 & 실습 가이드', url: `${SITE}/study/course/k8s/install` },
    { type: 2, style: 5, label: '📘 쿠버네티스 12개 장 강의 열람', url: `${SITE}/study/course/k8s` },
    { type: 2, style: 5, label: '⚡ K8s 실무 치트시트 (16개 명령)', url: `${SITE}/study/cheatsheet` }
  ]
};

// 2. 컨테이너-쿠버네티스 채널 (1542059061070274621)
const k8sChannelEmbed = {
  title: '☸️ 쿠버네티스 2노드(master1: 10.10.10.12, w1: 10.10.10.20) 구축 & 실무 실습 종합 가이드',
  color: CYAN,
  description:
    '클러스터 구성 완료에 맞춰 **원클릭 구축 가이드**와 **실무 실습(앱 배포, 멀티컨테이너, 템플릿, 롤링배포, 모니터링, 대시보드)**이 웹에 모두 등록되었습니다.\n' +
    `${SITE}/study/course/k8s/install`,
  fields: [
    {
      name: '📌 클러스터 기본 정보',
      value:
        '• **마스터 노드**: `10.10.10.12` (master1, API Server 6443)\n' +
        '• **워커 노드**: `10.10.10.20` (w1, Workload Node)\n' +
        '• **Pod CIDR (Calico)**: `172.20.0.0/16` / GW: `10.10.10.2`'
    },
    {
      name: '🛠️ 주요 실습 명령어 요약',
      value:
        '`1` **Taint 해제**: `kubectl taint no master1 node-role.kubernetes.io/control-plane-`\n' +
        '`2` **앱 배포 & NodePort**: `k run web --image nginx && k expose po web --port 80 --type NodePort`\n' +
        '`3` **템플릿 추출**: `k create deploy example --image nginx --dry-run=client -o yaml > deploy.yaml`\n' +
        '`4` **노드 라벨링**: `k label no master1 disktype=hdd --overwrite` (nodeSelector 스케줄링)\n' +
        '`5` **Metrics-Server**: `kubectl top nodes && kubectl top pods -A`\n' +
        '`6` **대시보드 RBAC**: `k create clusterrolebinding kdb-admin --serviceaccount=kubernetes-dashboard:kubernetes-dashboard --clusterrole=cluster-admin`'
    },
    {
      name: '📖 단계별 상세 실습 가이드 열람',
      value: '포털 웹사이트의 [마스터·워커 구축 가이드](https://ktci5.kr/study/course/k8s/install)에서 전체 스크립트를 터미널에 복사하여 바로 실행하실 수 있습니다.'
    }
  ],
  footer: { text: '실습 중 문의나 오류 사항은 언제든 본 채널에 남겨주세요!' },
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
