/**
 * project1~3.ktci5.kr — 프로젝트 자리 페이지
 *
 * 아직 결과물이 없어 "준비 중" 안내만 띄웁니다.
 * 실제 앱이 올라가면 이 도메인의 DNS 를 그쪽으로 돌리고 여기서 라우트를 뺍니다.
 */

export const PROJECTS = {
  1: {
    name: '기본 프로젝트',
    track: 'Track A · Cloud Infra',
    goal: 'Track A 에서 배운 것을 하나로 잇습니다.',
    stack: ['Python 웹앱', 'Docker', 'Kubernetes', 'AWS', 'Terraform'],
    accent: '#5865F2',
  },
  2: {
    name: '심화 프로젝트',
    track: 'Track B · DevOps',
    goal: '만든 것을 자동으로 배포하고 상태를 지켜봅니다.',
    stack: ['Git · CI/CD', 'GitOps', 'Prometheus', 'Grafana', 'Service Mesh'],
    accent: '#5b9dd9',
  },
  3: {
    name: '실무 종합 프로젝트',
    track: 'Track C · AI Cloud/SRE',
    goal: '운영까지 감당하는 형태로 완성합니다.',
    stack: ['ELK · Loki', 'OpenShift', 'AWS Bedrock', 'MLOps', 'ktcloud'],
    accent: '#e0a13a',
  },
};

export function renderProjectPage(n, escapeHtml) {
  const p = PROJECTS[n];
  if (!p) return null;

  const stack = p.stack
    .map((s) => `<span class="st">${escapeHtml(s)}</span>`)
    .join('<i>→</i>');

  return `<!doctype html><html lang="ko"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(p.name)} · 준비 중</title>
<style>
:root{color-scheme:dark}
body{font-family:-apple-system,BlinkMacSystemFont,"Malgun Gothic",sans-serif;
background:#1a1d24;color:#e8ecf4;margin:0;padding:24px;
display:flex;min-height:100vh;align-items:center;justify-content:center;}
.card{max-width:520px;width:100%;background:#232838;border-radius:16px;
padding:36px 28px;box-shadow:0 8px 24px rgba(0,0,0,.3);}
.tag{display:inline-block;font-size:11px;letter-spacing:.06em;color:${p.accent};
border:1px solid ${p.accent}55;border-radius:5px;padding:3px 8px;margin-bottom:14px;}
h1{font-size:22px;margin:0 0 6px;}
.sub{font-size:13px;color:#8a93a8;margin:0 0 20px;}
.goal{font-size:14.5px;line-height:1.7;color:#b7c0d4;margin:0 0 22px;}
.pipe{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 24px;}
.st{background:#2d3446;border-radius:6px;padding:5px 10px;font-size:12px;color:#c9d3e6;}
.pipe i{color:#5a627a;font-style:normal;font-size:11px;}
.status{display:flex;gap:9px;align-items:center;background:#1f2430;border:1px solid #2a3143;
border-radius:9px;padding:12px 14px;margin:0 0 20px;}
.dot{width:8px;height:8px;border-radius:50%;background:${p.accent};flex:0 0 8px;
box-shadow:0 0 0 3px ${p.accent}22;}
.status p{margin:0;font-size:13px;color:#a8b2c8;line-height:1.6;}
a.back{display:inline-block;color:#8ea1ff;text-decoration:none;font-size:13px;}
a.back:hover{text-decoration:underline;}
.foot{font-size:11.5px;color:#6c7488;margin:18px 0 0;line-height:1.6;}
</style></head><body><div class="card">
<div class="tag">${escapeHtml(p.track)}</div>
<h1>${escapeHtml(p.name)}</h1>
<p class="sub">project${n}.ktci5.kr</p>
<p class="goal">${escapeHtml(p.goal)}</p>
<div class="pipe">${stack}</div>
<div class="status"><span class="dot"></span>
<p><strong>준비 중입니다.</strong><br>이 주소는 프로젝트 결과물이 올라갈 자리입니다.</p></div>
<a class="back" href="https://ktci5.kr/discord">← KT클라우드 5기 스터디</a>
<p class="foot">KT클라우드 인프라교육 5기 스터디<br>
진행 상황은 디스코드에서 공유합니다.</p>
</div></body></html>`;
}
