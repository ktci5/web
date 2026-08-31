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

// 모든 과목의 장 구조 + 정리본. 검색과 상호 링크에 씁니다.
export async function loadAll(env) {
  const index = (await loadCourseIndex(env)) || [];
  const out = [];
  for (const c of index) {
    const [doc, notes] = await Promise.all([loadCourse(env, c.id), loadNotes(env, c.id)]);
    if (doc) out.push({ ...c, chapters: doc.chapters, notes: notes || {} });
  }
  return out;
}

// [[과목/장]] 또는 [[장]] 을 실제 링크로 바꾸는 함수를 만듭니다.
// 같은 과목 안에서는 과목을 생략할 수 있습니다.
export function linkResolver(all, courseId) {
  return (ref) => {
    const [a, b] = ref.split('/');
    const cid = b ? a : courseId;
    const chid = b || a;
    const course = all.find((c) => c.id === cid);
    const ch = course?.chapters.find((x) => x.id === chid);
    if (!ch) return null;
    const name = course.notes[chid]?.title || ch.name;
    return { href: `/study/course/${cid}/${chid}`, name, sameCourse: cid === courseId };
  };
}

/* ------------------------------------------------------------ 마크다운 */

// 학습 문서에 필요한 만큼만 처리하는 작은 변환기입니다.
// 표 · 코드블록 · 제목 · 목록 · 인라인 코드 · 링크 · 강조.
export function markdown(src, escapeHtml, resolve = null) {
  const out = [];
  const lines = src.split('\n');
  let i = 0;

  const inline = (t) => {
    let s = escapeHtml(t);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, txt, href) =>
      /^(https?:|\/)/.test(href) ? `<a href="${href}">${txt}</a>` : m);
    // [[과목/장]] · [[장]] — 정리본끼리의 상호 참조
    s = s.replace(/\[\[([a-z0-9\/-]+)\]\]/g, (m, ref) => {
      const t = resolve && resolve(ref);
      if (!t) return m;
      const tag = t.sameCourse ? '' : '<span class="xc">다른 과목</span>';
      return `<a class="xref" href="${t.href}">${escapeHtml(t.name)}${tag}</a>`;
    });
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
      ${c.chapters ? `<div class="chp-m">${c.chapters}개 장</div>` : ''}
    </a>`
  ).join('');

  return `
<p class="lead">과정에서 다루는 내용을 스터디용으로 정리했습니다.
필요한 부분만 찾아보시면 됩니다.</p>
<div class="notice"><span>이용 안내</span><p>과정 내용을 정리한 문서입니다.
<strong>인증한 수강생만</strong> 볼 수 있으니 바깥으로 옮기지 말아주세요.</p></div>
<form class="sf" method="get" action="/study/search">
  <input name="q" placeholder="모든 과목에서 찾기 (예: SELinux, 스왑, awk)">
  <button type="submit">찾기</button></form>
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

export function renderCourseChapter(doc, chapter, escapeHtml, note, resolve = null) {
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
      markdown(note.markdown, escapeHtml, resolve)
    : `<p class="lead">${escapeHtml(chapter.summary)}</p>` +
      '<div class="notice"><span>준비 중</span><p>아직 정리되지 않은 장입니다. 곧 올라옵니다.</p></div>';

  const see = (note?.see || []).map((ref) => {
    const t = resolve && resolve(ref);
    return t ? `<a class="chp" href="${t.href}"><div class="chp-n">${escapeHtml(t.name)}</div></a>` : '';
  }).join('');

  const stamp = note?.updated
    ? `<p class="stamp">마지막 갱신 ${escapeHtml(note.updated)} · 고칠 곳이 보이면 <a href="${DISCORD_ASK}">#❓-질문답변</a> 에 알려주세요.</p>`
    : '';

  return `
<p class="foot"><a href="/study/course/${doc.id}">← ${escapeHtml(doc.title)} 목차</a></p>
${main}
${see ? `<section><h2>함께 보기</h2><div class="chps">${see}</div></section>` : ''}
${stamp}
<div class="pager">${nav}</div>`;
}

const DISCORD_ASK = 'https://discord.gg/em3kMhTXz7';

// 검색 결과 — /study/search?q=
export function renderSearch(all, q, escapeHtml) {
  const form = `<form class="sf" method="get" action="/study/search">
    <input name="q" value="${escapeHtml(q || '')}" placeholder="찾을 말 (예: SELinux, 스왑, awk)" autofocus>
    <button type="submit">찾기</button></form>`;

  if (!q) {
    return `<p class="foot"><a href="/study/course">← 과목 목록</a></p>
<p class="lead">정리한 모든 과목에서 한 번에 찾습니다.</p>${form}`;
  }

  const needle = q.toLowerCase();
  const hits = [];
  for (const c of all) {
    for (const ch of c.chapters) {
      const n = c.notes[ch.id];
      if (!n) continue;
      const hay = `${n.title}\n${n.lead || ''}\n${n.markdown}`;
      const lower = hay.toLowerCase();
      if (!lower.includes(needle)) continue;

      // 문맥 몇 줄만 보여줍니다.
      const lines = n.markdown.split('\n')
        .filter((l) => l.toLowerCase().includes(needle) && l.trim())
        .slice(0, 3)
        .map((l) => {
          const t = l.replace(/^[#>|\s*-]+/, '').slice(0, 160);
          const i = t.toLowerCase().indexOf(needle);
          if (i < 0) return escapeHtml(t);
          return escapeHtml(t.slice(0, i)) + '<mark>' + escapeHtml(t.slice(i, i + q.length)) +
                 '</mark>' + escapeHtml(t.slice(i + q.length));
        });
      const count = lower.split(needle).length - 1;
      hits.push({ course: c, ch, note: n, lines, count });
    }
  }
  hits.sort((a, b) => b.count - a.count);

  if (!hits.length) {
    return `<p class="foot"><a href="/study/course">← 과목 목록</a></p>${form}
<div class="notice"><span>결과 없음</span><p><strong>${escapeHtml(q)}</strong> 를 찾지 못했습니다.
아직 정리되지 않은 주제라면 <a href="${DISCORD_ASK}">#❓-질문답변</a> 에 남겨주세요.</p></div>`;
  }

  const items = hits.map((h) =>
    `<a class="chp" href="/study/course/${h.course.id}/${h.ch.id}">
      <div class="chp-n">${escapeHtml(h.note.title)}<span class="xc">${escapeHtml(h.course.title)}</span></div>
      <div class="chp-d">${h.lines.join('<br>')}</div>
      <div class="chp-m">${h.count}회 언급</div>
    </a>`).join('');

  return `<p class="foot"><a href="/study/course">← 과목 목록</a></p>${form}
<section><h2>${hits.length}개 장에서 찾았습니다</h2><div class="chps">${items}</div></section>`;
}

export const COURSE_CSS =
  '.xref{color:#8ea1ff;text-decoration:none;border-bottom:1px dotted #5865F2;}' +
  '.xref:hover{border-bottom-style:solid;}' +
  '.xc{font-size:10.5px;color:#8a93a8;background:#2d3446;border-radius:4px;' +
  'padding:1px 5px;margin-left:6px;font-weight:400;vertical-align:middle;}' +
  '.sf{display:flex;gap:8px;margin:0 0 20px;}' +
  '.sf input{flex:1;background:#232838;border:1px solid #2a3143;border-radius:8px;' +
  'padding:10px 12px;color:#e8ecf4;font-size:14px;font-family:inherit;}' +
  '.sf input:focus{outline:none;border-color:#5865F2;}' +
  '.sf button{background:#5865F2;color:#fff;border:none;border-radius:8px;' +
  'padding:10px 18px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;}' +
  '.sf button:hover{background:#4752c4;}' +
  'mark{background:#3d4a7a;color:#fff;border-radius:3px;padding:0 2px;}' +
  '.stamp{font-size:12px;color:#6c7488;margin:24px 0 0;padding-top:14px;' +
  'border-top:1px solid #2a3143;}' +
  '.stamp a{color:#8ea1ff;}' +
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
