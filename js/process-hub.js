/* =========================================================
   업무 프로세스 HUB — 개인용 업무 프로세스 관리 모듈
   업무 검색 → 프로세스 확인 → 판단 기준 확인 → 관련 자료·과거 사례
   데이터: localStorage (구조화 저장 · 추후 AI검색/시트 연동 대비)
   ========================================================= */
(function () {
  "use strict";

  var STORE_KEY = "sg-process-hub-v1";

  var CATEGORIES = [
    { id: "teamlead", name: "팀리더 운영" },
    { id: "snack",   name: "스낵 운영" },
    { id: "garden",  name: "가든 운영" },
    { id: "admin",   name: "총무지원" },
    { id: "hr",      name: "인력관리" },
    { id: "safety",  name: "안전보건" },
    { id: "finance", name: "정산·기안" },
    { id: "comm",    name: "대외 커뮤니케이션" },
    { id: "routine", name: "정기 업무" },
    { id: "issue",   name: "이슈 대응" },
  ];

  var PRIORITIES = [
    { id: "immediate", label: "즉시 대응" },
    { id: "today",     label: "당일 처리" },
    { id: "schedule",  label: "일정 조율" },
    { id: "routine",   label: "정기 업무" },
  ];

  // 즐겨찾기 별 아이콘 (이모지 대신 SVG)
  var STAR = '<svg class="phub-star" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.26 6.1.53-4.62 4.01 1.39 6.2L12 15.9 6.23 19l1.39-6.2L3 8.79l6.1-.53z"/></svg>';
  var STAR_O = '<svg class="phub-star" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3.5l2.6 5.62 5.9.51-4.47 3.88 1.34 5.99L12 16.4l-5.37 3.1 1.34-5.99L3.5 9.63l5.9-.51z"/></svg>';

  /* ---------- 상태 ---------- */
  var host = null;
  var wired = false;
  var db = null;
  var state = {
    route: "dashboard",       // dashboard | list | detail | edit
    catFilter: null,          // 카테고리 id
    tagFilter: null,          // 태그명
    query: "",                // 검색어
    detailId: null,
    editId: null,             // null이면 신규
    draft: null,
    listContext: null,        // "category" | "tag" | "search" | "favorite"
  };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }
  function uid() { return "ph_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    var p = String(iso).split("-");
    if (p.length < 3) return esc(iso);
    return p[0] + "." + p[1] + "." + p[2];
  }
  function catOf(id) { for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].id === id) return CATEGORIES[i]; return { id: id, name: id || "미분류" }; }
  function prioOf(id) { for (var i = 0; i < PRIORITIES.length; i++) if (PRIORITIES[i].id === id) return PRIORITIES[i]; return PRIORITIES[3]; }
  function byId(id) { for (var i = 0; i < db.length; i++) if (db[i].id === id) return db[i]; return null; }

  /* ---------- 저장/로드 ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) { var arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; }
    } catch (e) {}
    return seed();
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) {}
  }
  function ensureDb() { if (!db) db = load(); }

  /* ---------- 시드(예시) 데이터 ---------- */
  function seed() {
    var arr = [
      {
        id: uid(), title: "오아시스 설비 고장 대응",
        category: "snack", subCategory: "오아시스 > 설비관리",
        purpose: "설비 이상 발생 시 운영 중단을 최소화하고 비용 및 책임 주체까지 확인하여 처리",
        trigger: "커피머신, 제빙기, 정수기 등 설비 이상 발생 시",
        priority: "today",
        tags: ["스낵", "설비", "업체협업", "비용발생", "승인필요"],
        processSteps: [
          { title: "현장 상태 확인", desc: "" },
          { title: "증상 및 사진 확보", desc: "" },
          { title: "운영 가능 여부 판단", desc: "" },
          { title: "업체 접수", desc: "" },
          { title: "담당자 공유", desc: "" },
          { title: "견적 및 비용 주체 확인", desc: "" },
          { title: "처리 진행", desc: "" },
          { title: "완료 확인", desc: "" },
          { title: "처리 결과 기록", desc: "" },
        ],
        decisionPoints: [
          { situation: "단순 오류", criteria: "업체 점검 요청" },
          { situation: "운영 불가", criteria: "즉시 담당자 공유" },
          { situation: "소모품 문제", criteria: "내부 비용 부담 여부 확인" },
          { situation: "주요 부품 고장", criteria: "업체 책임 범위 확인" },
          { situation: "견적 발생", criteria: "진행 전 승인 확인" },
          { situation: "책임 주체 불명확", criteria: "계약 및 과거 사례 확인" },
        ],
        reportRules: {
          immediate: "운영 중단 · 고객 컴플레인 · 큰 비용 발생 가능성",
          regular: "",
          targets: "직속 리더 · 고객사 담당자",
          approval: true, external: true,
        },
        stakeholders: {
          main: "팀장(본인)", internal: "파트리더", report: "직속 리더",
          vendor: "오아시스 설비 업체", vendorContact: "", note: "설비별 담당 업체 상이 — 계약서 확인",
        },
        relatedResources: [
          { name: "설비 유지보수 계약서", url: "" },
          { name: "업체 견적서 양식", url: "" },
        ],
        pastCases: [
          { date: "2026-04", situation: "커피머신 브루어 고장", action: "업체 점검 후 부품 교체", result: "업체 비용 부담으로 처리", note: "" },
          { date: "2026-06", situation: "제빙기 필터 교체", action: "소모품 교체", result: "내부 비용 처리", note: "" },
          { date: "2026-08", situation: "기존 포충기 모델 단종", action: "대체 모델 조사", result: "신규 모델 변경 검토", note: "승인 대기" },
        ],
        favorite: true,
        createdAt: "2026-08-26", updatedAt: "2026-08-26",
      },
      {
        id: uid(), title: "식물 폐기물 처리",
        category: "garden", subCategory: "가든 > 식물관리",
        purpose: "고사·병해 식물을 안전하고 규정에 맞게 폐기하고 기록으로 남긴다",
        trigger: "식물 고사, 병해충 발생, 교체 주기 도래 시",
        priority: "schedule",
        tags: ["가든", "정기업무", "식물관리"],
        processSteps: [
          { title: "대상 식물 확인", desc: "" },
          { title: "폐기 사유 기록", desc: "" },
          { title: "사진 촬영", desc: "" },
          { title: "폐기 방식 결정", desc: "" },
          { title: "폐기 처리", desc: "" },
          { title: "처리 결과 기록", desc: "" },
        ],
        decisionPoints: [
          { situation: "병해충 감염", criteria: "격리 후 별도 폐기" },
          { situation: "대량 폐기", criteria: "사전 담당자 공유" },
          { situation: "재사용 가능 자재", criteria: "화분·자재 분리 보관" },
        ],
        reportRules: { immediate: "", regular: "월간 폐기 현황 보고", targets: "직속 리더", approval: false, external: false },
        stakeholders: { main: "팀장(본인)", internal: "가든 파트", report: "직속 리더", vendor: "", vendorContact: "", note: "" },
        relatedResources: [{ name: "폐기물 처리 매뉴얼", url: "" }],
        pastCases: [
          { date: "2026-07", situation: "장마철 뿌리 과습 고사", action: "격리 후 폐기", result: "재발 방지 위해 배수 점검", note: "" },
        ],
        favorite: true,
        createdAt: "2026-08-28", updatedAt: "2026-08-28",
      },
    ];
    return arr;
  }

  /* =========================================================
     라우팅 진입점
     ========================================================= */
  // app.js의 go()가 사이드바 진입마다 호출 → 항상 대시보드부터
  function render(viewEl) {
    host = viewEl;
    ensureDb();
    if (!wired) { wire(); wired = true; }
    state.route = "dashboard"; state.query = "";
    state.catFilter = null; state.tagFilter = null;
    state.editId = null; state.draft = null;
    paint();
  }

  function paint() {
    if (!host) return;
    var html;
    if (state.route === "detail") html = viewDetail();
    else if (state.route === "edit") html = viewEditor();
    else if (state.route === "list") html = viewList();
    else html = viewDashboard();
    host.innerHTML = '<div id="phub" class="phub">' + html + '</div>';
    window.scrollTo(0, 0);
    if (state.route === "dashboard") {
      var s = document.getElementById("phSearch");
      if (s && state.query) { s.value = state.query; }
    }
  }

  /* =========================================================
     대시보드
     ========================================================= */
  function viewDashboard() {
    var h = ""
      + '<div class="phub__head">'
      + '<div><p class="eyebrow">Work Process Hub</p>'
      + '<h2 class="phub__title">업무 프로세스 HUB</h2>'
      + '<p class="phub__sub">업무를 검색하고, 처리 흐름과 판단 기준까지 한 번에 확인하세요.</p></div>'
      + '<div class="phub__headact"><button type="button" class="btn btn--primary" data-ph-act="new">+ 새 프로세스</button></div>'
      + '</div>';

    // 검색창 (persistent — #phBody 밖)
    h += '<div class="phub-search">'
      + '<svg class="phub-search__icn" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
      + '<input type="search" id="phSearch" class="phub-search__in" placeholder="어떤 업무를 찾고 있나요?" autocomplete="off" value="' + esc(state.query) + '">'
      + '</div>';

    h += '<div id="phBody">' + dashboardBody() + '</div>';
    return h;
  }

  function dashboardBody() {
    if (state.query && state.query.trim()) return searchResultsBody(state.query.trim());

    var h = "";
    // 카테고리 (pill 필터 바)
    h += '<section class="phub-sec"><h3 class="phub-sec__t">카테고리</h3><div class="phub-catbar">';
    CATEGORIES.forEach(function (c) {
      var n = db.filter(function (p) { return p.category === c.id; }).length;
      h += '<button type="button" class="phub-catpill' + (n ? '' : ' is-empty') + '" data-ph-cat="' + c.id + '">'
        + '<span class="phub-catpill__n">' + esc(c.name) + '</span>'
        + '<span class="phub-catpill__c">' + n + '</span>'
        + '</button>';
    });
    h += '</div></section>';

    // 자주 사용하는 프로세스 (즐겨찾기)
    var favs = db.filter(function (p) { return p.favorite; });
    h += '<section class="phub-sec"><h3 class="phub-sec__t">자주 사용하는 프로세스</h3>';
    if (favs.length) {
      h += '<div class="phub-favs">';
      favs.forEach(function (p) {
        h += '<button type="button" class="phub-fav" data-ph-id="' + p.id + '">'
          + '<span class="phub-fav__ic">' + STAR + '</span>'
          + '<span class="phub-fav__t">' + esc(p.title) + '</span></button>';
      });
      h += '</div>';
    } else {
      h += '<p class="phub-empty">상세 화면에서 즐겨찾기를 등록하면 여기에 표시됩니다.</p>';
    }
    h += '</section>';

    // 최근 업데이트
    var recent = db.slice().sort(function (a, b) { return (b.updatedAt || "") < (a.updatedAt || "") ? -1 : 1; }).slice(0, 8);
    h += '<section class="phub-sec"><h3 class="phub-sec__t">최근 업데이트</h3>';
    if (recent.length) {
      h += '<div class="phub-recent">';
      recent.forEach(function (p) {
        var c = catOf(p.category);
        h += '<button type="button" class="phub-recent__row" data-ph-id="' + p.id + '">'
          + '<span class="phub-recent__cat">' + esc(c.name) + '</span>'
          + '<span class="phub-recent__t">' + esc(p.title) + '</span>'
          + '<span class="phub-recent__date">' + fmtDate(p.updatedAt) + ' 업데이트</span>'
          + '</button>';
      });
      h += '</div>';
    } else {
      h += '<p class="phub-empty">아직 등록된 프로세스가 없습니다.</p>';
    }
    h += '</section>';
    return h;
  }

  /* ---------- 검색 ---------- */
  function searchMatch(p, q) {
    q = q.toLowerCase();
    var hay = [p.title, p.subCategory, p.purpose, p.trigger, catOf(p.category).name]
      .concat(p.tags || [])
      .concat((p.processSteps || []).map(function (s) { return s.title + " " + (s.desc || ""); }))
      .concat((p.decisionPoints || []).map(function (d) { return d.situation + " " + d.criteria; }))
      .join(" ").toLowerCase();
    return hay.indexOf(q) !== -1;
  }
  function searchResultsBody(q) {
    var rows = db.filter(function (p) { return searchMatch(p, q); });
    var h = '<section class="phub-sec"><h3 class="phub-sec__t">검색 결과 <span class="phub-count">' + rows.length + '</span> <span class="phub-q">“' + esc(q) + '”</span></h3>';
    h += rows.length ? cardGrid(rows) : '<p class="phub-empty">일치하는 프로세스가 없습니다.</p>';
    h += '</section>';
    return h;
  }

  /* =========================================================
     리스트 (카테고리 / 태그)
     ========================================================= */
  function viewList() {
    var rows, titleHtml;
    if (state.listContext === "tag") {
      rows = db.filter(function (p) { return (p.tags || []).indexOf(state.tagFilter) !== -1; });
      titleHtml = '<span class="phub-tag">#' + esc(state.tagFilter) + '</span> 태그';
    } else {
      var c = catOf(state.catFilter);
      rows = db.filter(function (p) { return p.category === state.catFilter; });
      titleHtml = esc(c.name);
    }
    var h = ""
      + '<div class="phub__head">'
      + '<div><p class="eyebrow">Process List</p>'
      + '<h2 class="phub__title">' + titleHtml + '</h2>'
      + '<p class="phub__sub">' + rows.length + '개의 프로세스</p></div>'
      + '<div class="phub__headact">'
      + '<button type="button" class="btn btn--ghost" data-ph-act="home">← 대시보드</button>'
      + '<button type="button" class="btn btn--primary" data-ph-act="new">+ 새 프로세스</button>'
      + '</div></div>';
    h += rows.length ? cardGrid(rows) : '<p class="phub-empty">등록된 프로세스가 없습니다.</p>';
    return h;
  }

  function cardGrid(rows) {
    var h = '<div class="phub-grid">';
    rows.slice().sort(function (a, b) { return (b.updatedAt || "") < (a.updatedAt || "") ? -1 : 1; }).forEach(function (p) {
      var c = catOf(p.category), pr = prioOf(p.priority);
      h += '<button type="button" class="phub-card" data-ph-id="' + p.id + '">'
        + '<div class="phub-card__top">'
          + '<span class="phub-prio ph-prio--' + p.priority + '">' + pr.label + '</span>'
          + (p.favorite ? '<span class="phub-card__fav">' + STAR + '</span>' : '')
        + '</div>'
        + '<h3 class="phub-card__t">' + esc(p.title) + '</h3>'
        + '<p class="phub-card__cat">' + esc(c.name) + (p.subCategory ? ' · ' + esc(p.subCategory) : '') + '</p>'
        + (p.purpose ? '<p class="phub-card__purpose">' + esc(p.purpose) + '</p>' : '')
        + '<div class="phub-card__tags">' + (p.tags || []).slice(0, 5).map(function (t) { return '<span class="phub-chip">#' + esc(t) + '</span>'; }).join("") + '</div>'
        + '<p class="phub-card__date">' + fmtDate(p.updatedAt) + ' 업데이트</p>'
        + '</button>';
    });
    h += '</div>';
    return h;
  }

  /* =========================================================
     상세 페이지 (우선순위 순서)
     업무명 → 목적/발생조건 → FLOW → DECISION → 보고 → 담당 → 자료 → 사례 → 태그/수정일
     ========================================================= */
  function viewDetail() {
    var p = byId(state.detailId);
    if (!p) { state.route = "dashboard"; return viewDashboard(); }
    var c = catOf(p.category), pr = prioOf(p.priority);

    var h = ""
      + '<div class="phub__head phub__head--detail">'
      + '<button type="button" class="btn btn--ghost btn--sm" data-ph-act="back">← 뒤로</button>'
      + '<div class="phub__headact">'
        + '<button type="button" class="btn btn--sm phub-favbtn' + (p.favorite ? ' is-on' : '') + '" data-ph-act="fav" data-ph-id="' + p.id + '">' + (p.favorite ? STAR + ' 즐겨찾기 해제' : STAR_O + ' 즐겨찾기') + '</button>'
        + '<button type="button" class="btn btn--sm" data-ph-act="edit" data-ph-id="' + p.id + '">수정</button>'
        + '<button type="button" class="btn btn--sm btn--danger" data-ph-act="del" data-ph-id="' + p.id + '">삭제</button>'
      + '</div></div>';

    // ① 기본 정보
    h += '<section class="phub-detail__hero">'
      + '<span class="phub-prio ph-prio--' + p.priority + ' phub-prio--lg">' + pr.label + '</span>'
      + '<h1 class="phub-detail__title">' + esc(p.title) + '</h1>'
      + '<p class="phub-detail__crumb">' + esc(c.name) + (p.subCategory ? ' <span class="phub-detail__sep">›</span> ' + esc(p.subCategory) : '') + '</p>'
      + '<div class="phub-detail__meta">'
        + (p.purpose ? '<div class="phub-meta"><span class="phub-meta__k">업무 목적</span><p class="phub-meta__v">' + esc(p.purpose) + '</p></div>' : '')
        + (p.trigger ? '<div class="phub-meta"><span class="phub-meta__k">발생 조건</span><p class="phub-meta__v">' + esc(p.trigger) + '</p></div>' : '')
      + '</div>'
      + '</section>';

    // PROCESS FLOW (강조)
    h += '<section class="phub-block phub-block--flow">'
      + '<div class="phub-block__h"><span class="phub-block__badge">PROCESS FLOW</span><span class="phub-block__cap">업무 처리 순서</span></div>';
    if ((p.processSteps || []).length) {
      h += '<div class="phub-flow">';
      p.processSteps.forEach(function (s, i) {
        h += '<div class="phub-flow__step">'
          + '<span class="phub-flow__no">' + (i + 1) + '</span>'
          + '<div class="phub-flow__body"><span class="phub-flow__title">' + esc(s.title) + '</span>'
          + (s.desc ? '<span class="phub-flow__desc">' + esc(s.desc) + '</span>' : '') + '</div>'
          + '</div>';
        if (i < p.processSteps.length - 1) h += '<div class="phub-flow__arrow">↓</div>';
      });
      h += '</div>';
    } else { h += '<p class="phub-empty">등록된 처리 순서가 없습니다.</p>'; }
    h += '</section>';

    // DECISION POINT (강조)
    h += '<section class="phub-block phub-block--dp">'
      + '<div class="phub-block__h"><span class="phub-block__badge phub-block__badge--dp">DECISION POINT</span><span class="phub-block__cap">상황별 판단 기준</span></div>';
    if ((p.decisionPoints || []).length) {
      h += '<div class="phub-dp"><table class="phub-dp__table"><thead><tr><th>상황</th><th>판단 / 처리 기준</th></tr></thead><tbody>';
      p.decisionPoints.forEach(function (d) {
        h += '<tr><td class="phub-dp__sit">' + esc(d.situation) + '</td><td class="phub-dp__crit">' + esc(d.criteria) + '</td></tr>';
      });
      h += '</tbody></table></div>';
    } else { h += '<p class="phub-empty">등록된 판단 기준이 없습니다.</p>'; }
    h += '</section>';

    // 보고 기준
    var r = p.reportRules || {};
    if (r.immediate || r.regular || r.targets || r.approval || r.external) {
      h += '<section class="phub-block"><div class="phub-block__h"><span class="phub-block__badge phub-block__badge--soft">보고 기준</span></div>'
        + '<div class="phub-report">'
        + reportField("즉시 보고", r.immediate)
        + reportField("정기 보고", r.regular)
        + reportField("보고 대상", r.targets)
        + '<div class="phub-report__flags">'
          + '<span class="phub-flag ' + (r.approval ? 'is-on' : '') + '">승인 필요 · ' + (r.approval ? '필요' : '불필요') + '</span>'
          + '<span class="phub-flag ' + (r.external ? 'is-on' : '') + '">외부 공유 · ' + (r.external ? '있음' : '없음') + '</span>'
        + '</div>'
        + '</div></section>';
    }

    // 담당 / 협업
    var st = p.stakeholders || {};
    if (st.main || st.internal || st.report || st.vendor || st.vendorContact || st.note) {
      h += '<section class="phub-block"><div class="phub-block__h"><span class="phub-block__badge phub-block__badge--soft">담당 · 협업</span></div>'
        + '<div class="phub-stake">'
        + stakeField("메인 담당자", st.main)
        + stakeField("내부 협업자", st.internal)
        + stakeField("보고 대상", st.report)
        + stakeField("외부 업체", st.vendor)
        + stakeField("외부 담당자", st.vendorContact)
        + stakeField("연락처 · 참고", st.note)
        + '</div></section>';
    }

    // 관련 자료
    if ((p.relatedResources || []).length) {
      h += '<section class="phub-block"><div class="phub-block__h"><span class="phub-block__badge phub-block__badge--soft">관련 자료</span></div>'
        + '<div class="phub-res">';
      p.relatedResources.forEach(function (rs) {
        if (!rs.name && !rs.url) return;
        if (rs.url) h += '<a class="phub-res__item" href="' + esc(rs.url) + '" target="_blank" rel="noopener">' + esc(rs.name || rs.url) + '</a>';
        else h += '<span class="phub-res__item phub-res__item--nolink">' + esc(rs.name) + '</span>';
      });
      h += '</div></section>';
    }

    // 과거 처리 사례
    if ((p.pastCases || []).length) {
      h += '<section class="phub-block"><div class="phub-block__h"><span class="phub-block__badge phub-block__badge--soft">과거 처리 사례</span></div>'
        + '<div class="phub-cases">';
      p.pastCases.slice().sort(function (a, b) { return (b.date || "") < (a.date || "") ? -1 : 1; }).forEach(function (cs) {
        h += '<div class="phub-case">'
          + '<span class="phub-case__date">' + fmtDate(cs.date) + '</span>'
          + '<div class="phub-case__body">'
            + '<p class="phub-case__sit">' + esc(cs.situation) + '</p>'
            + (cs.action ? '<p class="phub-case__line"><b>처리</b> ' + esc(cs.action) + '</p>' : '')
            + (cs.result ? '<p class="phub-case__line phub-case__result">→ ' + esc(cs.result) + '</p>' : '')
            + (cs.note ? '<p class="phub-case__note">' + esc(cs.note) + '</p>' : '')
          + '</div></div>';
      });
      h += '</div></section>';
    }

    // 태그 / 수정일
    h += '<section class="phub-block phub-block--foot">';
    if ((p.tags || []).length) {
      h += '<div class="phub-detail__tags">' + p.tags.map(function (t) {
        return '<button type="button" class="phub-chip phub-chip--btn" data-ph-tag="' + esc(t) + '">#' + esc(t) + '</button>';
      }).join("") + '</div>';
    }
    h += '<p class="phub-detail__updated">최근 수정 ' + fmtDate(p.updatedAt) + '</p>';
    h += '</section>';

    return h;
  }
  function reportField(k, v) { return '<div class="phub-report__f"><span class="phub-report__k">' + k + '</span><p class="phub-report__v">' + (v ? esc(v) : '—') + '</p></div>'; }
  function stakeField(k, v) { if (!v) return ''; return '<div class="phub-stake__f"><span class="phub-stake__k">' + k + '</span><span class="phub-stake__v">' + esc(v) + '</span></div>'; }

  /* =========================================================
     등록 / 수정 폼
     ========================================================= */
  function blankDraft() {
    return {
      title: "", category: CATEGORIES[0].id, subCategory: "", purpose: "", trigger: "",
      priority: "today", tags: [],
      processSteps: [{ title: "", desc: "" }],
      decisionPoints: [{ situation: "", criteria: "" }],
      reportRules: { immediate: "", regular: "", targets: "", approval: false, external: false },
      stakeholders: { main: "", internal: "", report: "", vendor: "", vendorContact: "", note: "" },
      relatedResources: [{ name: "", url: "" }],
      pastCases: [],
    };
  }
  function cloneForEdit(p) {
    return JSON.parse(JSON.stringify({
      title: p.title, category: p.category, subCategory: p.subCategory, purpose: p.purpose, trigger: p.trigger,
      priority: p.priority, tags: (p.tags || []).slice(),
      processSteps: (p.processSteps || []).length ? p.processSteps : [{ title: "", desc: "" }],
      decisionPoints: (p.decisionPoints || []).length ? p.decisionPoints : [{ situation: "", criteria: "" }],
      reportRules: p.reportRules || { immediate: "", regular: "", targets: "", approval: false, external: false },
      stakeholders: p.stakeholders || { main: "", internal: "", report: "", vendor: "", vendorContact: "", note: "" },
      relatedResources: (p.relatedResources || []).length ? p.relatedResources : [{ name: "", url: "" }],
      pastCases: p.pastCases || [],
    }));
  }

  function viewEditor() {
    var d = state.draft;
    var isNew = !state.editId;
    var h = ""
      + '<div class="phub__head">'
      + '<div><p class="eyebrow">' + (isNew ? 'New Process' : 'Edit Process') + '</p>'
      + '<h2 class="phub__title">' + (isNew ? '새 프로세스 등록' : '프로세스 수정') + '</h2></div>'
      + '<div class="phub__headact">'
      + '<button type="button" class="btn btn--ghost" data-ph-act="edit-cancel">취소</button>'
      + '<button type="button" class="btn btn--primary" data-ph-act="save">저장</button>'
      + '</div></div>';

    h += '<form class="phub-form" id="phForm" onsubmit="return false;">';

    // 1~7 기본
    h += formSec("기본 정보");
    h += '<div class="phub-fgrid">'
      + fld("프로세스명", '<input type="text" id="phTitle" class="phub-in" maxlength="80" placeholder="예) 오아시스 설비 고장 대응" value="' + esc(d.title) + '">', true)
      + fld("중요도", selectPriority(d.priority))
      + fld("카테고리", selectCategory(d.category))
      + fld("하위 카테고리", '<input type="text" id="phSub" class="phub-in" placeholder="예) 오아시스 > 설비관리" value="' + esc(d.subCategory) + '">')
      + '</div>';
    h += '<div class="phub-fgrid">'
      + fld("업무 목적", '<textarea id="phPurpose" class="phub-in" rows="2" placeholder="이 업무의 목적">' + esc(d.purpose) + '</textarea>', false, true)
      + fld("발생 조건 / 시작 조건", '<textarea id="phTrigger" class="phub-in" rows="2" placeholder="어떤 상황에서 시작되는가">' + esc(d.trigger) + '</textarea>', false, true)
      + '</div>';
    h += fld("태그 <em>(쉼표 또는 공백으로 구분 · # 생략 가능)</em>", '<input type="text" id="phTags" class="phub-in" placeholder="스낵, 설비, 업체협업" value="' + esc((d.tags || []).join(", ")) + '">', false, true);

    // 8 Process Flow
    h += formSec("PROCESS FLOW <span class=\"phub-fsec__cap\">처리 순서</span>");
    h += '<div class="phub-editrows" id="phSteps">';
    d.processSteps.forEach(function (s, i) { h += stepRow(s, i, d.processSteps.length); });
    h += '</div>';
    h += '<button type="button" class="phub-addrow" data-ph-act="add-step">+ 단계 추가</button>';

    // 9 Decision Point
    h += formSec("DECISION POINT <span class=\"phub-fsec__cap\">상황별 판단 기준</span>");
    h += '<div class="phub-editrows" id="phDps">';
    d.decisionPoints.forEach(function (dp, i) { h += dpRow(dp, i); });
    h += '</div>';
    h += '<button type="button" class="phub-addrow" data-ph-act="add-dp">+ 판단 기준 추가</button>';

    // 10 보고 기준
    h += formSec("보고 기준");
    h += '<div class="phub-fgrid">'
      + fld("즉시 보고 기준", '<textarea id="phRepImmediate" class="phub-in" rows="2" placeholder="예) 안전사고 · 운영 중단 · 큰 비용">' + esc(d.reportRules.immediate) + '</textarea>', false, true)
      + fld("정기 보고 기준", '<textarea id="phRepRegular" class="phub-in" rows="2" placeholder="예) 월간 현황 보고">' + esc(d.reportRules.regular) + '</textarea>', false, true)
      + '</div>';
    h += fld("보고 대상", '<input type="text" id="phRepTargets" class="phub-in" placeholder="예) 직속 리더 · 고객사 담당자" value="' + esc(d.reportRules.targets) + '">', false, true);
    h += '<div class="phub-checks">'
      + '<label class="phub-check"><input type="checkbox" id="phRepApproval"' + (d.reportRules.approval ? ' checked' : '') + '> 승인 필요</label>'
      + '<label class="phub-check"><input type="checkbox" id="phRepExternal"' + (d.reportRules.external ? ' checked' : '') + '> 외부 공유</label>'
      + '</div>';

    // 11 담당 / 협업
    h += formSec("담당 · 협업");
    h += '<div class="phub-fgrid">'
      + fld("메인 담당자", '<input type="text" id="phStMain" class="phub-in" value="' + esc(d.stakeholders.main) + '">')
      + fld("내부 협업자", '<input type="text" id="phStInternal" class="phub-in" value="' + esc(d.stakeholders.internal) + '">')
      + fld("보고 대상", '<input type="text" id="phStReport" class="phub-in" value="' + esc(d.stakeholders.report) + '">')
      + fld("외부 업체", '<input type="text" id="phStVendor" class="phub-in" value="' + esc(d.stakeholders.vendor) + '">')
      + fld("외부 담당자", '<input type="text" id="phStVendorContact" class="phub-in" value="' + esc(d.stakeholders.vendorContact) + '">')
      + fld("연락처 · 참고", '<input type="text" id="phStNote" class="phub-in" value="' + esc(d.stakeholders.note) + '">')
      + '</div>';

    // 12 관련 자료
    h += formSec("관련 자료 <span class=\"phub-fsec__cap\">자료명 + URL</span>");
    h += '<div class="phub-editrows" id="phRes">';
    d.relatedResources.forEach(function (rs, i) { h += resRow(rs, i); });
    h += '</div>';
    h += '<button type="button" class="phub-addrow" data-ph-act="add-res">+ 자료 추가</button>';

    // 13 과거 사례
    h += formSec("과거 처리 사례");
    h += '<div class="phub-editrows" id="phCases">';
    (d.pastCases || []).forEach(function (cs, i) { h += caseRow(cs, i); });
    h += '</div>';
    h += '<button type="button" class="phub-addrow" data-ph-act="add-case">+ 사례 추가</button>';

    h += '<div class="phub-form__foot">'
      + '<button type="button" class="btn btn--ghost" data-ph-act="edit-cancel">취소</button>'
      + '<button type="button" class="btn btn--primary" data-ph-act="save">저장</button>'
      + '</div>';

    h += '</form>';
    return h;
  }

  function formSec(t) { return '<h3 class="phub-fsec">' + t + '</h3>'; }
  function fld(label, inner, req, wide) {
    return '<label class="phub-fld' + (wide ? ' phub-fld--wide' : '') + '"><span>' + label + (req ? ' <em class="req">*</em>' : '') + '</span>' + inner + '</label>';
  }
  function selectPriority(cur) {
    return '<select id="phPriority" class="phub-in">' + PRIORITIES.map(function (p) {
      return '<option value="' + p.id + '"' + (p.id === cur ? ' selected' : '') + '>' + p.label + '</option>';
    }).join("") + '</select>';
  }
  function selectCategory(cur) {
    return '<select id="phCategory" class="phub-in">' + CATEGORIES.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === cur ? ' selected' : '') + '>' + c.name + '</option>';
    }).join("") + '</select>';
  }
  function stepRow(s, i, total) {
    return '<div class="phub-editrow phub-editrow--step" data-idx="' + i + '">'
      + '<span class="phub-editrow__no">' + (i + 1) + '</span>'
      + '<input type="text" class="phub-in ph-step-title" placeholder="단계명 (예) 현장 상태 확인" value="' + esc(s.title) + '">'
      + '<input type="text" class="phub-in ph-step-desc" placeholder="설명 (선택)" value="' + esc(s.desc || "") + '">'
      + '<div class="phub-editrow__act">'
        + '<button type="button" class="phub-iconbtn" data-ph-act="up-step" data-idx="' + i + '"' + (i === 0 ? ' disabled' : '') + '>▲</button>'
        + '<button type="button" class="phub-iconbtn" data-ph-act="down-step" data-idx="' + i + '"' + (i === total - 1 ? ' disabled' : '') + '>▼</button>'
        + '<button type="button" class="phub-iconbtn phub-iconbtn--del" data-ph-act="del-step" data-idx="' + i + '">✕</button>'
      + '</div></div>';
  }
  function dpRow(d, i) {
    return '<div class="phub-editrow phub-editrow--dp" data-idx="' + i + '">'
      + '<input type="text" class="phub-in ph-dp-sit" placeholder="상황 (예) 운영 불가" value="' + esc(d.situation) + '">'
      + '<input type="text" class="phub-in ph-dp-crit" placeholder="판단 / 처리 기준" value="' + esc(d.criteria) + '">'
      + '<button type="button" class="phub-iconbtn phub-iconbtn--del" data-ph-act="del-dp" data-idx="' + i + '">✕</button>'
      + '</div>';
  }
  function resRow(r, i) {
    return '<div class="phub-editrow phub-editrow--res" data-idx="' + i + '">'
      + '<input type="text" class="phub-in ph-res-name" placeholder="자료명 (예) 유지보수 계약서" value="' + esc(r.name) + '">'
      + '<input type="url" class="phub-in ph-res-url" placeholder="URL (선택)" value="' + esc(r.url || "") + '">'
      + '<button type="button" class="phub-iconbtn phub-iconbtn--del" data-ph-act="del-res" data-idx="' + i + '">✕</button>'
      + '</div>';
  }
  function caseRow(c, i) {
    return '<div class="phub-editrow phub-editrow--case" data-idx="' + i + '">'
      + '<div class="phub-editrow__caserow">'
        + '<input type="text" class="phub-in ph-case-date" placeholder="날짜 (예) 2026-08" value="' + esc(c.date) + '">'
        + '<input type="text" class="phub-in ph-case-sit" placeholder="상황" value="' + esc(c.situation) + '">'
        + '<button type="button" class="phub-iconbtn phub-iconbtn--del" data-ph-act="del-case" data-idx="' + i + '">✕</button>'
      + '</div>'
      + '<div class="phub-editrow__caserow">'
        + '<input type="text" class="phub-in ph-case-action" placeholder="처리 내용" value="' + esc(c.action || "") + '">'
        + '<input type="text" class="phub-in ph-case-result" placeholder="결과" value="' + esc(c.result || "") + '">'
      + '</div>'
      + '<input type="text" class="phub-in ph-case-note" placeholder="참고사항 (선택)" value="' + esc(c.note || "") + '">'
      + '</div>';
  }

  /* ---------- 폼 → draft 동기화 ---------- */
  function val(id) { var el = document.getElementById(id); return el ? el.value : ""; }
  function chk(id) { var el = document.getElementById(id); return el ? !!el.checked : false; }
  function parseTags(s) {
    return (s || "").split(/[,\s]+/).map(function (t) { return t.replace(/^#/, "").trim(); }).filter(Boolean);
  }
  function syncDraft() {
    var d = state.draft; if (!d) return;
    d.title = val("phTitle").trim();
    d.category = val("phCategory");
    d.subCategory = val("phSub").trim();
    d.purpose = val("phPurpose").trim();
    d.trigger = val("phTrigger").trim();
    d.priority = val("phPriority");
    d.tags = parseTags(val("phTags"));
    d.reportRules = {
      immediate: val("phRepImmediate").trim(), regular: val("phRepRegular").trim(),
      targets: val("phRepTargets").trim(), approval: chk("phRepApproval"), external: chk("phRepExternal"),
    };
    d.stakeholders = {
      main: val("phStMain").trim(), internal: val("phStInternal").trim(), report: val("phStReport").trim(),
      vendor: val("phStVendor").trim(), vendorContact: val("phStVendorContact").trim(), note: val("phStNote").trim(),
    };
    d.processSteps = readRows("#phSteps .phub-editrow", function (row) {
      return { title: getv(row, ".ph-step-title"), desc: getv(row, ".ph-step-desc") };
    });
    d.decisionPoints = readRows("#phDps .phub-editrow", function (row) {
      return { situation: getv(row, ".ph-dp-sit"), criteria: getv(row, ".ph-dp-crit") };
    });
    d.relatedResources = readRows("#phRes .phub-editrow", function (row) {
      return { name: getv(row, ".ph-res-name"), url: getv(row, ".ph-res-url") };
    });
    d.pastCases = readRows("#phCases .phub-editrow", function (row) {
      return {
        date: getv(row, ".ph-case-date"), situation: getv(row, ".ph-case-sit"),
        action: getv(row, ".ph-case-action"), result: getv(row, ".ph-case-result"), note: getv(row, ".ph-case-note"),
      };
    });
    if (!d.processSteps.length) d.processSteps = [{ title: "", desc: "" }];
    if (!d.decisionPoints.length) d.decisionPoints = [{ situation: "", criteria: "" }];
    if (!d.relatedResources.length) d.relatedResources = [{ name: "", url: "" }];
  }
  function getv(row, sel) { var el = row.querySelector(sel); return el ? el.value.trim() : ""; }
  function readRows(sel, mapFn) {
    var out = [];
    var nodes = document.querySelectorAll(sel);
    Array.prototype.forEach.call(nodes, function (row) { out.push(mapFn(row)); });
    return out;
  }

  function saveDraft() {
    syncDraft();
    var d = state.draft;
    if (!d.title) {
      var t = document.getElementById("phTitle");
      if (t) { t.focus(); t.classList.add("phub-in--err"); }
      alert("프로세스명을 입력해 주세요.");
      return;
    }
    // 빈 행 정리
    var clean = {
      title: d.title, category: d.category, subCategory: d.subCategory, purpose: d.purpose, trigger: d.trigger,
      priority: d.priority, tags: d.tags,
      processSteps: d.processSteps.filter(function (s) { return s.title || s.desc; }),
      decisionPoints: d.decisionPoints.filter(function (x) { return x.situation || x.criteria; }),
      reportRules: d.reportRules, stakeholders: d.stakeholders,
      relatedResources: d.relatedResources.filter(function (r) { return r.name || r.url; }),
      pastCases: (d.pastCases || []).filter(function (c) { return c.date || c.situation || c.action || c.result || c.note; }),
    };
    var now = todayIso();
    if (state.editId) {
      var p = byId(state.editId);
      if (p) {
        for (var k in clean) if (clean.hasOwnProperty(k)) p[k] = clean[k];
        p.updatedAt = now;
        state.detailId = p.id;
      }
    } else {
      clean.id = uid();
      clean.favorite = false;
      clean.createdAt = now;
      clean.updatedAt = now;
      db.push(clean);
      state.detailId = clean.id;
    }
    save();
    state.route = "detail";
    state.editId = null; state.draft = null;
    paint();
  }

  /* =========================================================
     이벤트 위임
     ========================================================= */
  function wire() {
    host.addEventListener("click", onClick);
    host.addEventListener("input", onInput);
    host.addEventListener("keydown", onKey);
  }

  function onInput(ev) {
    if (!document.getElementById("phub")) return;
    var s = ev.target;
    if (s && s.id === "phSearch") {
      state.query = s.value;
      var body = document.getElementById("phBody");
      if (body) body.innerHTML = dashboardBody();
    }
  }
  function onKey(ev) {
    if (!document.getElementById("phub")) return;
    if (ev.key === "Enter" && ev.target && ev.target.id === "phSearch") ev.preventDefault();
  }

  function onClick(ev) {
    if (!document.getElementById("phub")) return;

    // 프로세스 카드/행 클릭 → 상세
    var idEl = ev.target.closest("[data-ph-id]");
    var actEl = ev.target.closest("[data-ph-act]");
    var catEl = ev.target.closest("[data-ph-cat]");
    var tagEl = ev.target.closest("[data-ph-tag]");

    if (actEl) {
      var act = actEl.getAttribute("data-ph-act");
      var pid = actEl.getAttribute("data-ph-id");
      if (handleAct(act, pid)) { ev.preventDefault(); return; }
    }
    if (tagEl) {
      state.tagFilter = tagEl.getAttribute("data-ph-tag");
      state.listContext = "tag"; state.route = "list";
      paint(); return;
    }
    if (catEl) {
      state.catFilter = catEl.getAttribute("data-ph-cat");
      state.listContext = "category"; state.route = "list";
      paint(); return;
    }
    if (idEl && !actEl) {
      state.detailId = idEl.getAttribute("data-ph-id");
      state.route = "detail";
      paint(); return;
    }
  }

  function handleAct(act, pid) {
    switch (act) {
      case "new":
        state.editId = null; state.draft = blankDraft(); state.route = "edit"; paint(); return true;
      case "edit": {
        var p = byId(pid || state.detailId);
        if (p) { state.editId = p.id; state.draft = cloneForEdit(p); state.route = "edit"; paint(); }
        return true;
      }
      case "edit-cancel":
        state.draft = null;
        if (state.editId) { state.route = "detail"; state.detailId = state.editId; state.editId = null; }
        else { state.route = "dashboard"; }
        paint(); return true;
      case "save": saveDraft(); return true;
      case "del": {
        var t = byId(pid);
        if (t && confirm('“' + t.title + '” 프로세스를 삭제할까요?')) {
          db = db.filter(function (x) { return x.id !== pid; });
          save(); state.route = "dashboard"; paint();
        }
        return true;
      }
      case "fav": {
        var f = byId(pid);
        if (f) { f.favorite = !f.favorite; f.updatedAt = todayIso(); save(); paint(); }
        return true;
      }
      case "home": state.route = "dashboard"; state.query = ""; paint(); return true;
      case "back":
        // 상세에서 뒤로 → 이전 리스트 맥락 있으면 리스트, 없으면 대시보드
        if (state.listContext && (state.catFilter || state.tagFilter)) state.route = "list";
        else state.route = "dashboard";
        paint(); return true;
      // ---- 편집 동적 행 ----
      case "add-step": syncDraft(); state.draft.processSteps.push({ title: "", desc: "" }); paint(); return true;
      case "del-step": rowDel("processSteps", arguments); return true;
      case "up-step": rowMove("processSteps", -1); return true;
      case "down-step": rowMove("processSteps", 1); return true;
      case "add-dp": syncDraft(); state.draft.decisionPoints.push({ situation: "", criteria: "" }); paint(); return true;
      case "del-dp": rowDel("decisionPoints", arguments); return true;
      case "add-res": syncDraft(); state.draft.relatedResources.push({ name: "", url: "" }); paint(); return true;
      case "del-res": rowDel("relatedResources", arguments); return true;
      case "add-case": syncDraft(); state.draft.pastCases.push({ date: "", situation: "", action: "", result: "", note: "" }); paint(); return true;
      case "del-case": rowDel("pastCases", arguments); return true;
    }
    return false;
  }

  // 삭제/이동은 클릭된 버튼의 data-idx가 필요 → 별도 처리
  function currentIdx() {
    var el = document.activeElement;
    return el && el.getAttribute ? parseInt(el.getAttribute("data-idx"), 10) : NaN;
  }
  function rowDel(key) {
    syncDraft();
    var idx = lastClickIdx;
    var arr = state.draft[key];
    if (!isNaN(idx) && idx >= 0 && idx < arr.length) arr.splice(idx, 1);
    paint();
  }
  function rowMove(key, dir) {
    syncDraft();
    var idx = lastClickIdx;
    var arr = state.draft[key];
    var j = idx + dir;
    if (idx < 0 || j < 0 || j >= arr.length) { paint(); return; }
    var tmp = arr[idx]; arr[idx] = arr[j]; arr[j] = tmp;
    paint();
  }

  // 클릭된 버튼의 data-idx를 캡처 (핸들러 진입 전에 세팅)
  var lastClickIdx = NaN;
  document.addEventListener("click", function (ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest("[data-ph-act][data-idx]") : null;
    lastClickIdx = b ? parseInt(b.getAttribute("data-idx"), 10) : NaN;
  }, true);

  /* ---------- export ---------- */
  window.ProcessHub = { render: render };
})();
