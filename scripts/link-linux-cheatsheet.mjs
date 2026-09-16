import fs from 'fs';
import path from 'path';

const portalFile = path.resolve('src/portal_html.js');

import("../src/portal_html.js").then(m => {
  let html = m.PORTAL_HTML;

  // 1. In Hero links
  const oldHeroLinks = `<a href="/study/course" class="px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-all font-medium">📘 전체 강의 목차 ➔</a>`;
  const newHeroLinks = `<a href="/study/linux" class="px-2.5 py-1 rounded-md bg-indigo-950 text-indigo-300 border border-indigo-700 hover:bg-indigo-900 transition-all font-medium">🐧 리눅스 심층 가이드 (출력 해석 & 장애 진단) ➔</a>\n            <a href="/study/course" class="px-2.5 py-1 rounded-md bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 transition-all font-medium">📘 전체 강의 목차 ➔</a>`;
  if (!html.includes(oldHeroLinks)) {
    console.error("Could not find oldHeroLinks");
    process.exit(1);
  }
  html = html.replace(oldHeroLinks, newHeroLinks);

  // 2. Insert Linux Guide Bridge Banner right before Filter Controls
  const targetFilterControls = `    <!-- Filter Controls -->`;
  const bridgeBanner = `    <!-- Linux Guide Bridge Banner -->
    <div class="mb-6 p-4 rounded-xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950/70 border border-indigo-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg">
      <div class="flex items-start sm:items-center gap-3.5">
        <div class="w-10 h-10 rounded-xl bg-indigo-950 border border-indigo-700/50 flex items-center justify-center text-xl shrink-0">
          🐧
        </div>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h3 class="text-sm font-bold text-white">명령어 암기를 넘어 시스템 출력을 해석하고 장애를 추적하세요</h3>
            <span class="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">필수 연계 가이드</span>
          </div>
          <p class="text-xs text-slate-300 mt-1 leading-relaxed">
            <code>uptime</code>, <code>free</code>, <code>iostat</code>, <code>ss</code> 오독 방지 포인트와 서버 장애 증상별(CPU·디스크 100%·네트워크 단절) 단계적 진단 순서 및 파이프라인 설계 원리를 제공합니다.
          </p>
        </div>
      </div>
      <a href="/study/linux" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shrink-0 transition-all shadow-md shadow-indigo-500/20 whitespace-nowrap">
        🐧 리눅스 CLI 심층 가이드 보기 ➔
      </a>
    </div>\n\n    <!-- Filter Controls -->`;

  if (!html.includes(targetFilterControls)) {
    console.error("Could not find targetFilterControls");
    process.exit(1);
  }
  html = html.replace(targetFilterControls, bridgeBanner);

  // 3. In Modern vs Legacy section
  const oldLegacyDesc = `<p class="text-xs text-slate-400">구식 리눅스 도구와 레거시 가상화 기술을 최신 고성능 도커 및 클라우드 엔지니어링 표준으로 전환하세요.</p>`;
  const newLegacyDesc = `<p class="text-xs text-slate-400">구식 리눅스 도구와 레거시 가상화 기술을 최신 고성능 도커 및 클라우드 엔지니어링 표준으로 전환하세요. 상세 비교 이유와 배경은 <a href="/study/linux#modern" class="text-blue-400 hover:underline font-semibold">🐧 리눅스 CLI 심층 가이드</a>에서 확인하실 수 있습니다.</p>`;
  if (html.includes(oldLegacyDesc)) {
    html = html.replace(oldLegacyDesc, newLegacyDesc);
  }

  // 4. In Pipeline Anatomy section
  const oldPipelineDesc = `<p class="text-xs text-slate-400 mb-4">리눅스 표준 스트림을 결합하여 500 에러 최다 발생 URL을 추출하는 실무 데이터 파이프라인입니다.</p>`;
  const newPipelineDesc = `<p class="text-xs text-slate-400 mb-4">리눅스 표준 스트림을 결합하여 500 에러 최다 발생 URL을 추출하는 실무 데이터 파이프라인입니다. 토큰별 상세 동작 분석은 <a href="/study/linux#pipeline" class="text-yellow-400 hover:underline font-semibold">🐧 리눅스 가이드 파이프라인 해부</a>에 연동되어 있습니다.</p>`;
  if (html.includes(oldPipelineDesc)) {
    html = html.replace(oldPipelineDesc, newPipelineDesc);
  }

  const newExport = `export const PORTAL_HTML = ${JSON.stringify(html)};\n`;
  fs.writeFileSync(portalFile, newExport, 'utf8');
  console.log("Successfully connected portal_html.js with linux guide!");
});
