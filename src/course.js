/**
 * 강의 내용 정리 열람 — /study/course
 *
 * 과정 내용을 스터디용으로 다시 쓴 문서입니다. 원본 슬라이드는 웹에 싣지
 * 않습니다. 내용은 KV 에만 있고, 인증한 사람에게만 보여줍니다.
 */

// 과목 목록
export async function loadCourseIndex(env) {
  if (!env.ROSTER) return null;
  return env.ROSTER.get('course:index', 'json');
}

// 한 과목의 장 구조
export async function loadCourse(env, courseId) {
  if (!env.ROSTER || !/^[a-z0-9-]+$/.test(courseId || '')) return null;
  return env.ROSTER.get(`course:${courseId}`, 'json');
}

// 그 과목의 정리본. 장별로 담겨 있습니다.
export async function loadNotes(env, courseId) {
  if (!env.ROSTER || !/^[a-z0-9-]+$/.test(courseId || '')) return null;
  return env.ROSTER.get(`course:${courseId}:notes`, 'json');
}

/* ------------------------------------------------------------ 마크다운 */

// 학습 문서에 필요한 만큼만 처리하는 작은 변환기입니다.
// 표 · 코드블록 · 제목 · 목록 · 인라인 코드 · 링크 · 강조.
export function markdown(src, escapeHtml) {
  const out = [];
  const lines = src.split('\n');
  let i = 0;

  const inline = (t) => {
    let s = escapeHtml(t);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, href) =>
      /^(https?:|\/)/.test(href) ? `<a href="${href}">${txt}</a>` : m);
    return s;
  };

  while (i < lines.length) {
    const line = lines[i];

    // 코드 블록
    if (/^```/.test(line)) {
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      out.push(`<pre class="md-code"${lang ? ` data-lang="${escapeHtml(lang)}"` : ''}>` +
        escapeHtml(buf.join('\n')) + '</pre>');
      continue;
    }

    // 표
    if (/^\|/.test(line) && /^\|[\s:|-]+\|$/.test(lines[i + 1] || '')) {
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(cells(lines[i++]));
      out.push('<div class="md-tbl"><table><thead><tr>' +
        head.map((h) => `<th>${inline(h)}</th>`).join('') +
        '</tr></thead><tbody>' +
        rows.map((r) => '<tr>' + r.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table></div>');
      continue;
    }

    // 제목
    const h = line.match(/^(#{2,4})\s+(.*)$/);
    if (h) {
      const lv = h[1].length;
      out.push(`<h${lv} class="md-h${lv}">${inline(h[2])}</h${lv}>`);
      i++;
      continue;
    }

    // 구분선
    if (/^---+$/.test(line.trim())) { out.push('<hr class="md-hr">'); i++; continue; }

    // 목록
    if (/^\s*[-*]\s+/.test(line)) {
      const buf = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      out.push('<ul class="md-ul">' + buf.map((b) => `<li>${inline(b)}</li>`).join('') + '</ul>');
      continue;
    }

    // 인용
    if (/^>\s?/.test(line)) {
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote class="md-q">${inline(buf.join(' '))}</blockquote>`);
      continue;
    }

    // 문단
    if (line.trim()) {
      const buf = [];
      while (i < lines.length && lines[i].trim() &&
             !/^(```|\||#{2,4}\s|>|\s*[-*]\s|---+$)/.test(lines[i])) {
        buf.push(lines[i++]);
      }
      out.push(`<p>${inline(buf.join(' '))}</p>`);
      continue;
    }
    i++;
  }
  return out.join('');
}

// 과목 목록 — /study/course
export function renderCourseList(index, escapeHtml) {
  const items = index.map((c) =>
    `<a class="chp" href="/study/course/${c.id}">
      <div class="chp-n">${escapeHtml(c.title)}</div>
      <div class="chp-d">${escapeHtml(c.subtitle || '')}</div>
    </a>`
  ).join('');

  return `
<p class="lead">과정에서 다루는 내용을 스터디용으로 정리했습니다.
필요한 부분만 찾아보시면 됩니다.</p>
<div class="notice"><span>이용 안내</span><p>과정 내용을 정리한 문서입니다.
<strong>인증한 수강생만</strong> 볼 수 있으니 바깥으로 옮기지 말아주세요.</p></div>
<section><h2>과목</h2><div class="chps">${items}</div></section>
<section><h2>함께 보면 좋은 것</h2>
<div class="ch"><div class="ch-name"><a href="/study/linux">리눅스 CLI 심층 가이드</a></div>
<div class="ch-desc"><p>명령을 익힌 다음 단계 — 출력을 읽는 법과 증상별 진단 순서.</p></div></div>
<div class="ch"><div class="ch-name">#💻-리눅스</div>
<div class="ch-desc"><p>막히는 부분은 채널에 물어보세요.</p></div></div>
</section>`;
}

// 한 과목의 장 목록 — /study/course/<과목>
export function renderCourseIndex(doc, escapeHtml, notes = {}) {
  const items = doc.chapters.map((c) => {
    const n = notes[c.id];
    return `<a class="chp" href="/study/course/${doc.id}/${c.id}">
      <div class="chp-n">${escapeHtml(c.name)}` +
      (n ? '' : '<span class="badge raw">준비 중</span>') +
      `</div>
      <div class="chp-d">${escapeHtml(n?.lead || c.summary)}</div>
      <div class="chp-m">${n ? '정리 완료' : '준비 중'}</div>
    </a>`;
  }).join('');

  return `
<p class="foot"><a href="/study/course">← 과목 목록</a></p>
<p class="lead">${escapeHtml(doc.subtitle || '')}</p>
<section><h2>목차</h2><div class="chps">${items}</div></section>`;
}

export function renderCourseChapter(doc, chapter, escapeHtml, note) {
  const i = doc.chapters.findIndex((c) => c.id === chapter.id);
  const prev = doc.chapters[i - 1];
  const next = doc.chapters[i + 1];

  const nav = [
    prev ? `<a href="/study/course/${doc.id}/${prev.id}">← ${escapeHtml(prev.name)}</a>` : '<span></span>',
    next ? `<a href="/study/course/${doc.id}/${next.id}">${escapeHtml(next.name)} →</a>` : '<span></span>',
  ].join('');

  // 정리한 학습 문서만 보여줍니다. 원본 슬라이드는 웹에 싣지 않습니다.
  const main = note
    ? `<p class="lead">${escapeHtml(note.lead || chapter.summary)}</p>` +
      markdown(note.markdown, escapeHtml)
    : `<p class="lead">${escapeHtml(chapter.summary)}</p>` +
      '<div class="notice"><span>준비 중</span><p>아직 정리되지 않은 장입니다. 곧 올라옵니다.</p></div>';

  return `
<p class="foot"><a href="/study/course/${doc.id}">← ${escapeHtml(doc.title)} 목차</a></p>
${main}
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
  'background:#fff;margin:0 0 10px;}' +
  'margin:6px 0;padding:8px 10px;font-size:12.5px;color:#c9d3e6;overflow-x:auto;}' +
  'font-size:12px;line-height:1.6;color:#a8b2c8;overflow-x:auto;white-space:pre;}' +
  '.pager{display:flex;justify-content:space-between;gap:10px;margin:28px 0 0;' +
  'padding-top:16px;border-top:1px solid #2a3143;font-size:13px;}' +
  '.pager a{color:#8ea1ff;text-decoration:none;}' +
  '.pager a:hover{text-decoration:underline;}' +
  '.badge{font-size:10.5px;border-radius:4px;padding:1px 6px;margin-left:6px;' +
  'background:#20372c;color:#7ee2b8;font-weight:400;vertical-align:middle;}' +
  '.badge.raw{background:#2d3446;color:#8a93a8;}' +
  '.md-h2{font-size:17px;margin:32px 0 10px;color:#e8ecf4;}' +
  '.md-h3{font-size:14.5px;margin:22px 0 7px;color:#e8ecf4;}' +
  '.md-h4{font-size:13.5px;margin:18px 0 6px;color:#c9d3e6;}' +
  '.md-hr{border:none;border-top:1px solid #2a3143;margin:26px 0;}' +
  '.md-ul{margin:8px 0;padding-left:20px;font-size:13.5px;line-height:1.75;}' +
  '.md-ul li{margin:0 0 4px;}' +
  '.md-q{margin:12px 0;border-left:2px solid #5865F2;padding:2px 0 2px 12px;' +
  'font-size:13px;line-height:1.65;color:#a8b2c8;}' +
  'pre.md-code{background:#12151c;border:1px solid #2a3143;border-radius:8px;' +
  'padding:12px 14px;margin:10px 0;font-size:12.5px;line-height:1.7;' +
  'overflow-x:auto;color:#c9d3e6;position:relative;}' +
  'pre.md-code[data-lang]::after{content:attr(data-lang);position:absolute;top:6px;right:10px;' +
  'font-size:10px;color:#4d556b;letter-spacing:.05em;}' +
  '.md-tbl{overflow-x:auto;margin:12px 0;}' +
  '.md-tbl table{border-collapse:collapse;width:100%;font-size:13px;min-width:420px;}' +
  '.md-tbl th{text-align:left;color:#8a93a8;font-weight:600;font-size:11.5px;' +
  'padding:8px 12px 8px 0;border-bottom:1px solid #2a3143;white-space:nowrap;}' +
  '.md-tbl td{padding:9px 12px 9px 0;border-bottom:1px solid #232838;' +
  'vertical-align:top;color:#b7c0d4;line-height:1.6;}';
