/**
 * 강의 자료 열람 — /study/linux/기초
 *
 * 교육 자료는 저작권이 있어 공개 저장소에 두지 않습니다.
 * 내용은 KV(course:linux-basic)에만 있고, 인증한 사람에게만 보여줍니다.
 */

export const COURSE_KEY = 'course:linux-basic';

export async function loadCourse(env) {
  if (!env.ROSTER) return null;
  return env.ROSTER.get(COURSE_KEY, 'json');
}

// 슬라이드 원본 이미지. 그림 위주 슬라이드는 텍스트만으로는 내용이 비어
// 있으므로 화면을 그대로 보여줍니다.
export async function loadSlideImage(env, page) {
  if (!env.ROSTER || !Number.isInteger(page) || page < 1) return null;
  return env.ROSTER.get(`${COURSE_KEY}:img:${page}`, 'arrayBuffer');
}

// 명령어처럼 보이는 줄을 눈에 띄게 합니다.
const CMD_HINT = /^\s*(?:[$#]\s|\$?\s*(?:ls|cd|pwd|cat|man|mkdir|rmdir|cp|mv|rm|ln|touch|file|head|tail|less|more|chmod|chown|chgrp|umask|find|grep|egrep|sed|awk|sort|uniq|wc|tar|gzip|gunzip|zip|unzip|ps|top|kill|jobs|fg|bg|nohup|systemctl|dnf|yum|rpm|vi|vim|echo|export|alias|env|set|source|su|sudo|who|whoami|id|date|df|du|mount|ssh|scp)\b)/;

function isCommand(line) {
  return CMD_HINT.test(line);
}

function renderSlide(s, escapeHtml) {
  const body = s.body.map((line) => {
    const t = escapeHtml(line);
    if (isCommand(line)) return `<pre class="cmd">${t.trim()}</pre>`;
    // 표처럼 공백이 여러 칸인 줄은 모양을 살립니다
    if (/\s{3,}\S/.test(line)) return `<pre class="tbl2">${t}</pre>`;
    return `<p>${t.trim()}</p>`;
  }).join('');

  return `<article class="sl">
    <div class="sl-h"><h3>${escapeHtml(s.title)}</h3><span>p.${s.page}</span></div>
    <img class="sl-img" src="/study/course/slide/${s.page}" alt="${escapeHtml(s.title)} 슬라이드"
         loading="lazy" decoding="async">
    ${body ? `<details class="sl-t"><summary>텍스트로 보기 · 복사하기</summary>${body}</details>` : ''}
  </article>`;
}

export function renderCourseIndex(doc, escapeHtml) {
  const items = doc.chapters.map((c) =>
    `<a class="chp" href="/study/course/${c.id}">
      <div class="chp-n">${escapeHtml(c.name)}</div>
      <div class="chp-d">${escapeHtml(c.summary)}</div>
      <div class="chp-m">${c.slides.length}쪽 · p.${c.from}~${c.to}</div>
    </a>`
  ).join('');

  return `
<p class="lead">과정에서 쓰는 <strong>${escapeHtml(doc.title)}</strong> 자료를 장별로 나눠 정리했습니다.
슬라이드를 넘기지 않고 필요한 부분만 찾아볼 수 있습니다.</p>
<div class="notice"><span>이용 안내</span><p>과정 교육 자료라 <strong>인증한 수강생만</strong> 볼 수 있습니다.
바깥으로 옮기거나 다시 배포하지 말아주세요.</p></div>
<section><h2>목차</h2><div class="chps">${items}</div></section>
<section><h2>함께 보면 좋은 것</h2>
<div class="ch"><div class="ch-name"><a href="/study/linux">리눅스 CLI 심층 가이드</a></div>
<div class="ch-desc"><p>명령을 아는 다음 단계 — 출력을 읽는 법과 증상별 진단 순서.</p></div></div>
<div class="ch"><div class="ch-name">#💻-리눅스</div>
<div class="ch-desc"><p>막히는 부분은 채널에 물어보세요.</p></div></div>
</section>`;
}

export function renderCourseChapter(doc, chapter, escapeHtml) {
  const i = doc.chapters.findIndex((c) => c.id === chapter.id);
  const prev = doc.chapters[i - 1];
  const next = doc.chapters[i + 1];

  const nav = [
    prev ? `<a href="/study/course/${prev.id}">← ${escapeHtml(prev.name)}</a>` : '<span></span>',
    next ? `<a href="/study/course/${next.id}">${escapeHtml(next.name)} →</a>` : '<span></span>',
  ].join('');

  return `
<p class="lead">${escapeHtml(chapter.summary)} · 원본 p.${chapter.from}~${chapter.to}</p>
<p class="foot"><a href="/study/course">← 목차로</a></p>
${chapter.slides.map((s) => renderSlide(s, escapeHtml)).join('')}
<div class="pager">${nav}</div>`;
}

export const COURSE_CSS =
  '.chps{display:grid;gap:8px;}' +
  '.chp{display:block;text-decoration:none;background:#232838;border:1px solid #2a3143;' +
  'border-radius:9px;padding:12px 14px;}' +
  '.chp:hover{border-color:#5865F2;}' +
  '.chp-n{font-weight:600;color:#e8ecf4;font-size:14px;margin-bottom:2px;}' +
  '.chp-d{font-size:12.5px;color:#a8b2c8;line-height:1.5;}' +
  '.chp-m{font-size:11px;color:#6c7488;margin-top:5px;}' +
  '.notice{border-left:2px solid #e67e22;padding:6px 0 6px 12px;margin:14px 0 22px;}' +
  '.notice span{display:block;font-size:11px;letter-spacing:.04em;color:#e67e22;margin-bottom:3px;}' +
  '.notice p{margin:0;font-size:13px;line-height:1.6;}' +
  '.sl{padding:16px 0;border-top:1px solid #2a3143;}' +
  '.sl-h{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:8px;}' +
  '.sl-h h3{margin:0;font-size:14.5px;color:#e8ecf4;}' +
  '.sl-h span{font-size:11px;color:#6c7488;flex:0 0 auto;}' +
  '.sl p{margin:0 0 6px;font-size:13.5px;line-height:1.65;}' +
  '.sl-img{display:block;width:100%;height:auto;border-radius:8px;border:1px solid #2a3143;' +
  'background:#fff;margin:0 0 10px;}' +
  '.sl-t{margin:0;}' +
  '.sl-t summary{cursor:pointer;font-size:12px;color:#8ea1ff;list-style:none;padding:4px 0;}' +
  '.sl-t summary::-webkit-details-marker{display:none}' +
  '.sl-t summary::before{content:"▸ ";}' +
  '.sl-t[open] summary::before{content:"▾ ";}' +
  '.sl-t > :not(summary){margin-top:6px;}' +
  'pre.cmd{background:#12151c;border-left:2px solid #5865F2;border-radius:0 6px 6px 0;' +
  'margin:6px 0;padding:8px 10px;font-size:12.5px;color:#c9d3e6;overflow-x:auto;}' +
  'pre.tbl2{background:#1f2430;border-radius:6px;margin:6px 0;padding:8px 10px;' +
  'font-size:12px;line-height:1.6;color:#a8b2c8;overflow-x:auto;white-space:pre;}' +
  '.pager{display:flex;justify-content:space-between;gap:10px;margin:28px 0 0;' +
  'padding-top:16px;border-top:1px solid #2a3143;font-size:13px;}' +
  '.pager a{color:#8ea1ff;text-decoration:none;}' +
  '.pager a:hover{text-decoration:underline;}';
