/* =========================================================
   AI 자료 HUB — 링크 게시판 모듈
   AI로 만든 제안서·운영 웹앱·이벤트/소개 페이지를 그룹 > 폴더 경로별로
   모아 게시형식으로 보여준다.
   · 시드: 지금까지 GitHub Pages(jamie4321-sudo.github.io)에 올린 자료
   · 데이터: 라이브(구글시트, type=aihub) + 로컬 캐시 미러 · 데모는 로컬/시드
   · 스타일은 드라이브 HUB(.dhub-*) 클래스를 재사용하되, 이벤트/DOM id 는
     ah / aihub 네임스페이스로 분리해 두 허브가 절대 충돌하지 않게 한다.
   ========================================================= */
(function () {
  "use strict";

  var STORE_KEY = "sg-aihub-v1";
  var GROUPS = ["제안서", "운영 웹앱", "이벤트 · 소개"];
  var GROUP_HINT = {
    "제안서": "AI로 제작한 제안서·검토 보고서 — 웹형식은 바로 열람, 문서형은 파일 위치를 남겨요.",
    "운영 웹앱": "GitHub Pages에 배포한 운영 도구·대시보드 모음",
    "이벤트 · 소개": "크루 참여 이벤트·팀 활동 소개 페이지",
  };

  var FOLDER_ICON = '<svg class="dhub-fold__ic" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
  var LINK_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>';
  var ARROW = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>';

  /* ---------- 상태 ---------- */
  var host = null, wired = false, db = null;
  var state = {
    group: GROUPS[0],
    query: "",
    modal: null,   // null | { id|null, group, path, name, url }
  };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }
  function uid() { return "ah_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  // 그룹은 기본 3종 + 사용자가 추가한(=엔트리에 존재하는) 카테고리까지 허용한다.
  function normGroup(g) { g = String(g == null ? "" : g).trim(); return g || GROUPS[0]; }
  // 현재 유효한 그룹 목록 : 기본 그룹 + db 엔트리에서 발견된 커스텀 그룹(등장 순서 유지)
  function effectiveGroups() {
    var out = GROUPS.slice();
    if (db) db.forEach(function (e) { if (e.group && out.indexOf(e.group) === -1) out.push(e.group); });
    return out;
  }
  // 카테고리(그룹) 표시 이름 — 설정에서 바꾼 이름이 있으면 그걸 쓴다(키는 그대로).
  function gLabel(g) {
    return (window.SG_HUB_LABELS && window.SG_HUB_LABELS.cat) ? window.SG_HUB_LABELS.cat("aihub", g, g) : g;
  }
  // 폴더 경로 정규화 : " > " 기준 단계 분리 후 빈 단계 제거
  function pathSegs(p) { return String(p || "").split(">").map(function (s) { return s.trim(); }).filter(Boolean); }
  function normPath(p) { return pathSegs(p).join(" > "); }
  function normUrl(u) {
    u = String(u || "").trim();
    if (!u) return "";
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u) && !/^mailto:/i.test(u)) u = "https://" + u;
    return u;
  }
  function domainOf(u) {
    try { return new URL(normUrl(u)).hostname.replace(/^www\./, ""); }
    catch (e) { return ""; }
  }

  /* ---------- 구글시트 연동 ---------- */
  function endpoint() { return (window.CONFIG && window.CONFIG.endpoint || "").trim(); }
  function isLive() { return !!endpoint(); }

  function normFromSheet(r) {
    return {
      id: r.id || uid(), group: normGroup(r.group), path: normPath(r.path),
      name: r.name || "", url: r.url || "",
      createdAt: r.createdAt || "", updatedAt: r.updatedAt || "",
    };
  }
  function serialize(e) {
    return {
      id: e.id, group: e.group, path: e.path, name: e.name, url: e.url,
      createdAt: e.createdAt || "", updatedAt: e.updatedAt || "",
    };
  }
  function pushToSheet(action, e) {
    if (!isLive()) return;
    var body = (action === "delete")
      ? { type: "aihub", action: "delete", id: e.id }
      : Object.assign({ type: "aihub", action: action }, serialize(e));
    try {
      fetch(endpoint(), { method: "POST", body: JSON.stringify(Object.assign({ pw: window.SG_API_PW || "" }, body)) })
        .catch(function (err) { console.warn("[AI자료HUB 시트 저장 실패]", err); });
    } catch (err) { console.warn("[AI자료HUB 시트 저장 예외]", err); }
  }

  /* ---------- 저장/로드 ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) { var arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; }
    } catch (e) {}
    return seed();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) {} }
  function persist(action, e) { save(); pushToSheet(action, e); }
  function ensureDb() {
    if (db) return;
    if (isLive() && Array.isArray(window.AIHUB_DATA)) db = window.AIHUB_DATA.map(normFromSheet);
    else db = load();
  }
  function byId(id) { for (var i = 0; i < db.length; i++) if (db[i].id === id) return db[i]; return null; }

  /* ---------- 시드(그동안 올린 자료) ---------- */
  function seed() {
    var now = todayIso();
    function e(group, path, name, url) { return { id: uid(), group: group, path: normPath(path), name: name, url: url, createdAt: now, updatedAt: now }; }
    return [
      // 제안서
      e("제안서", "웹형식", "스낵 큐레이션 제안서 (Linkagelab × kakaopay)", "https://jamie4321-sudo.github.io/snack-garden-voice/proposal.html"),
      e("제안서", "모빌리티 조경", "모빌리티 조경 관리구역 변경 검토 보고서", ""),
      e("제안서", "모빌리티 조경", "모빌리티 조경관리 근무시간조정 확정안", ""),
      e("제안서", "카카오페이", "카카오페이 스낵바 수주검토 대표보고 (v3)", ""),
      e("제안서", "운영 보고서", "라면존 운영 리포트 (2026 상반기)", "https://jamie4321-sudo.github.io/snack-garden-ops/reports/ramen-zone-2026.html"),
      // 운영 웹앱
      e("운영 웹앱", "대시보드", "SNACK & GARDEN 운영 대시보드", "https://jamie4321-sudo.github.io/snack-garden-ops/"),
      e("운영 웹앱", "대시보드", "가든 운영 대시보드 (garden-dash)", "https://jamie4321-sudo.github.io/garden-dash/"),
      e("운영 웹앱", "교육 서명", "교육 참석 서명 · 관리자", "https://jamie4321-sudo.github.io/edu-sign/"),
      e("운영 웹앱", "교육 서명", "교육 참석 서명 · 크루 서명 페이지", "https://jamie4321-sudo.github.io/edu-sign/sign.html"),
      e("운영 웹앱", "크루 보이스", "크루 보이스 · K-마켓 접수", "https://jamie4321-sudo.github.io/snack-garden-voice/"),
      e("운영 웹앱", "크루 보이스", "크루 보이스 · 관리자", "https://jamie4321-sudo.github.io/snack-garden-voice/admin.html"),
      // 이벤트 · 소개
      e("이벤트 · 소개", "", "오아시스 채우기 대작전 · 크루 이벤트", "https://jamie4321-sudo.github.io/JAMIE-AI-PROJECT/"),
      e("이벤트 · 소개", "", "스낵앤가든 2026 상반기 활동 소개", "https://jamie4321-sudo.github.io/2026/"),
    ];
  }

  /* =========================================================
     라우팅 진입점
     ========================================================= */
  function render(viewEl) {
    host = viewEl;
    ensureDb();
    if (!wired) { wire(); wired = true; }
    state.query = "";
    state.modal = null;
    if (effectiveGroups().indexOf(state.group) === -1) state.group = GROUPS[0];
    paint();
  }

  function paint() {
    if (!host) return;
    host.innerHTML = '<div id="aihub" class="dhub">' + viewBoard() + '</div>'
      + (state.modal ? viewModal() : '');
    window.scrollTo(0, 0);
    var s = document.getElementById("ahSearch");
    if (s && state.query) s.value = state.query;
    if (state.modal) {
      var f = document.getElementById("ahName");
      if (f) setTimeout(function () { f.focus(); }, 40);
    }
  }

  /* ---------- 카운트 ---------- */
  function groupCount(g) { return db.filter(function (e) { return e.group === g; }).length; }

  /* =========================================================
     보드(게시판)
     ========================================================= */
  function viewBoard() {
    var h = ""
      + '<div class="dhub__head">'
      + '<div><p class="eyebrow">AI · Resource Hub</p>'
      + '<h2 class="dhub__title">AI 자료 HUB</h2>'
      + '<p class="dhub__sub">AI로 만든 제안서·운영 웹앱·이벤트 페이지를 한 곳에 모아 바로 엽니다.</p></div>'
      + '<div class="dhub__headact"><button type="button" class="btn btn--primary" data-ah-act="new">+ 자료 추가</button></div>'
      + '</div>';

    // 검색
    h += '<div class="dhub-search">'
      + '<svg class="dhub-search__ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
      + '<input type="search" id="ahSearch" class="dhub-search__in" placeholder="이름 · 폴더 · 링크로 검색" autocomplete="off" value="' + esc(state.query) + '">'
      + '</div>';

    // 그룹 탭
    h += '<div class="dhub-tabs" role="tablist">';
    effectiveGroups().forEach(function (g) {
      var on = g === state.group && !state.query;
      h += '<button type="button" class="dhub-tab' + (on ? ' is-on' : '') + '" data-ah-group="' + esc(g) + '" role="tab" aria-selected="' + (on ? 'true' : 'false') + '">'
        + '<span class="dhub-tab__n">' + esc(gLabel(g)) + '</span>'
        + '<span class="dhub-tab__c">' + groupCount(g) + '</span>'
        + '</button>';
    });
    h += '</div>';

    h += '<div id="ahBody" class="dhub-body">' + (state.query.trim() ? searchBody(state.query.trim()) : groupBody(state.group)) + '</div>';
    return h;
  }

  /* 한 그룹의 폴더별 게시판 */
  function groupBody(group) {
    var rows = db.filter(function (e) { return e.group === group; });
    var h = '<p class="dhub-hint">' + esc(GROUP_HINT[group] || "") + '</p>';
    if (!rows.length) {
      return h + '<div class="dhub-empty">'
        + '<p class="dhub-empty__t">아직 등록된 자료가 없어요.</p>'
        + '<p class="dhub-empty__s">‘+ 자료 추가’로 첫 자료를 올려보세요.</p>'
        + '<button type="button" class="btn btn--primary btn--sm" data-ah-act="new" data-ah-group="' + esc(group) + '">+ 자료 추가</button>'
        + '</div>';
    }
    // 폴더(path)별 그룹핑
    var map = {}, order = [];
    rows.forEach(function (e) {
      var key = e.path || "";
      if (!map[key]) { map[key] = []; order.push(key); }
      map[key].push(e);
    });
    order.sort(function (a, b) {
      if (a === "") return -1; if (b === "") return 1;   // 미분류 먼저
      return a.localeCompare(b, "ko");
    });
    var rowIdx = 0;
    order.forEach(function (key) {
      var list = map[key].slice().sort(function (a, b) { return (a.name || "").localeCompare(b.name || "", "ko"); });
      h += '<section class="dhub-fold">'
        + '<header class="dhub-fold__h">' + folderCrumb(key) + '<span class="dhub-fold__c">' + list.length + '</span></header>'
        + '<ul class="dhub-list">';
      list.forEach(function (e) { h += rowHTML(e, rowIdx++); });
      h += '</ul></section>';
    });
    return h;
  }

  /* 검색 결과 : 그룹 구분 없이 폴더 맥락 포함해 나열 */
  function searchBody(q) {
    var ql = q.toLowerCase();
    var rows = db.filter(function (e) {
      return [e.name, e.path, e.url, e.group].join(" ").toLowerCase().indexOf(ql) !== -1;
    }).sort(function (a, b) { return (a.group + a.path + a.name).localeCompare(b.group + b.path + b.name, "ko"); });
    var h = '<p class="dhub-hint"><b class="dhub-count">' + rows.length + '</b> 개 결과 · “' + esc(q) + '”</p>';
    if (!rows.length) return h + '<div class="dhub-empty"><p class="dhub-empty__t">일치하는 자료가 없어요.</p></div>';
    h += '<ul class="dhub-list dhub-list--flat">';
    rows.forEach(function (e, i) { h += rowHTML(e, i, true); });
    h += '</ul>';
    return h;
  }

  function folderCrumb(path) {
    var segs = pathSegs(path);
    if (!segs.length) return '<span class="dhub-fold__crumb dhub-fold__crumb--none">' + FOLDER_ICON + '<span>미분류</span></span>';
    var inner = segs.map(function (s, i) {
      var last = i === segs.length - 1;
      return '<span class="dhub-fold__seg' + (last ? ' is-last' : '') + '">' + esc(s) + '</span>';
    }).join('<span class="dhub-fold__sep">›</span>');
    return '<span class="dhub-fold__crumb">' + FOLDER_ICON + inner + '</span>';
  }

  function rowHTML(e, idx, withContext) {
    var dom = domainOf(e.url);
    var hasUrl = !!e.url;
    var meta = withContext
      ? '<span class="dhub-row__ctx">' + esc(gLabel(e.group)) + (e.path ? ' <span class="dhub-fold__sep">›</span> ' + esc(e.path) : '') + '</span>'
      : (dom ? '<span class="dhub-row__dom">' + esc(dom) + '</span>' : '<span class="dhub-row__dom dhub-row__dom--empty">링크 없음</span>');
    var open = hasUrl
      ? '<a class="dhub-row__open" href="' + esc(normUrl(e.url)) + '" target="_blank" rel="noopener" title="새 탭에서 열기" onclick="event.stopPropagation()">' + ARROW + '</a>'
      : '<span class="dhub-row__open is-disabled" title="등록된 링크가 없습니다">' + ARROW + '</span>';
    return '<li class="dhub-row" style="--i:' + Math.min(idx, 24) + '" data-ah-id="' + esc(e.id) + '"' + (hasUrl ? ' data-ah-url="' + esc(normUrl(e.url)) + '"' : '') + '>'
      + '<span class="dhub-row__no">' + ("0" + (idx + 1)).slice(-2) + '</span>'
      + '<span class="dhub-row__ic">' + LINK_ICON + '</span>'
      + '<span class="dhub-row__main"><span class="dhub-row__name">' + esc(e.name || "(제목 없음)") + '</span>' + meta + '</span>'
      + '<span class="dhub-row__act">'
        + '<button type="button" class="dhub-iconbtn" data-ah-act="edit" data-ah-id="' + esc(e.id) + '" title="수정">'
          + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>'
        + '</button>'
        + '<button type="button" class="dhub-iconbtn dhub-iconbtn--del" data-ah-act="del" data-ah-id="' + esc(e.id) + '" title="삭제">'
          + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>'
        + '</button>'
      + '</span>'
      + open
      + '</li>';
  }

  /* =========================================================
     추가 / 수정 모달
     ========================================================= */
  function existingPaths() {
    var set = {}, out = [];
    db.forEach(function (e) { if (e.path && !set[e.path]) { set[e.path] = 1; out.push(e.path); } });
    return out.sort(function (a, b) { return a.localeCompare(b, "ko"); });
  }
  function viewModal() {
    var m = state.modal;
    var isNew = !m.id;
    var newCat = !!m.newCat;
    var opts = effectiveGroups().map(function (g) {
      return '<option value="' + esc(g) + '"' + (!newCat && g === m.group ? ' selected' : '') + '>' + esc(gLabel(g)) + '</option>';
    }).join("");
    opts += '<option value="__new__"' + (newCat ? ' selected' : '') + '>+ 새 카테고리 추가…</option>';
    var dlist = existingPaths().map(function (p) { return '<option value="' + esc(p) + '">'; }).join("");
    return '<div class="dhub-modal" id="ahModal">'
      + '<div class="dhub-modal__bd" data-ah-act="modal-cancel"></div>'
      + '<div class="dhub-modal__card" role="dialog" aria-modal="true" aria-label="' + (isNew ? '자료 추가' : '자료 수정') + '">'
        + '<div class="dhub-modal__head">'
          + '<h3>' + (isNew ? '자료 추가' : '자료 수정') + '</h3>'
          + '<button type="button" class="dhub-modal__x" data-ah-act="modal-cancel" aria-label="닫기">×</button>'
        + '</div>'
        + '<div class="dhub-modal__body">'
          + '<label class="dhub-fld"><span>그룹</span><select id="ahGroup" class="dhub-in">' + opts + '</select></label>'
          + '<label class="dhub-fld" id="ahNewGroupFld"' + (newCat ? '' : ' style="display:none"') + '><span>새 카테고리 이름 <em class="req">*</em></span>'
            + '<input type="text" id="ahNewGroup" class="dhub-in" maxlength="30" placeholder="예) 사내 공유용" value="' + esc(newCat ? (m.newGroup || "") : "") + '"></label>'
          + '<label class="dhub-fld"><span>폴더 경로 <em>( “ > ” 로 단계 구분 · 선택 )</em></span>'
            + '<input type="text" id="ahPath" class="dhub-in" list="ahPathList" placeholder="예) 모빌리티 조경" value="' + esc(m.path) + '">'
            + '<datalist id="ahPathList">' + dlist + '</datalist></label>'
          + '<label class="dhub-fld"><span>이름 <em class="req">*</em></span><input type="text" id="ahName" class="dhub-in" maxlength="80" placeholder="예) 스낵 큐레이션 제안서" value="' + esc(m.name) + '"></label>'
          + '<label class="dhub-fld"><span>링크 <em>( 선택 )</em></span><input type="url" id="ahUrl" class="dhub-in" placeholder="https://jamie4321-sudo.github.io/..." value="' + esc(m.url) + '"></label>'
        + '</div>'
        + '<div class="dhub-modal__foot">'
          + (isNew ? '' : '<button type="button" class="btn btn--danger btn--sm" data-ah-act="del" data-ah-id="' + esc(m.id) + '">삭제</button>')
          + '<div class="dhub-modal__spacer"></div>'
          + '<button type="button" class="btn btn--sm" data-ah-act="modal-cancel">취소</button>'
          + '<button type="button" class="btn btn--primary btn--sm" data-ah-act="modal-save">저장</button>'
        + '</div>'
      + '</div>'
    + '</div>';
  }

  function syncModal() {
    if (!state.modal) return;
    var g = document.getElementById("ahGroup"), p = document.getElementById("ahPath"),
        n = document.getElementById("ahName"), u = document.getElementById("ahUrl"),
        ng = document.getElementById("ahNewGroup");
    if (g) {
      if (g.value === "__new__") { state.modal.newCat = true; state.modal.newGroup = ng ? ng.value : ""; }
      else { state.modal.newCat = false; state.modal.group = g.value; }
    }
    if (p) state.modal.path = p.value;
    if (n) state.modal.name = n.value;
    if (u) state.modal.url = u.value;
  }
  function saveModal() {
    syncModal();
    var m = state.modal;
    // '+ 새 카테고리 추가…' 선택 시 : 입력한 새 그룹명을 사용(빈칸이면 경고)
    var groupVal = m.group;
    if (m.newCat) {
      var ngName = (m.newGroup || "").trim();
      if (!ngName) {
        var ng = document.getElementById("ahNewGroup");
        if (ng) { ng.focus(); ng.classList.add("dhub-in--err"); }
        return;
      }
      groupVal = ngName;
    }
    var name = (m.name || "").trim();
    if (!name) {
      var n = document.getElementById("ahName");
      if (n) { n.focus(); n.classList.add("dhub-in--err"); }
      return;
    }
    var now = todayIso();
    var clean = { group: normGroup(groupVal), path: normPath(m.path), name: name, url: normUrl(m.url) };
    if (m.id) {
      var e = byId(m.id);
      if (e) { e.group = clean.group; e.path = clean.path; e.name = clean.name; e.url = clean.url; e.updatedAt = now; persist("update", e); }
    } else {
      var rec = { id: uid(), group: clean.group, path: clean.path, name: clean.name, url: clean.url, createdAt: now, updatedAt: now };
      db.push(rec);
      persist("add", rec);
      state.group = rec.group;   // 저장한 그룹으로 이동
    }
    state.modal = null;
    state.query = "";
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
    if (!document.getElementById("aihub")) return;
    var s = ev.target;
    if (s && s.id === "ahSearch") {
      state.query = s.value;
      var body = document.getElementById("ahBody");
      if (body) body.innerHTML = state.query.trim() ? searchBody(state.query.trim()) : groupBody(state.group);
      syncTabs();
    }
    // 그룹 선택에서 '+ 새 카테고리 추가…' 고르면 새 이름 입력칸을 보여준다
    if (s && s.id === "ahGroup") {
      var fld = document.getElementById("ahNewGroupFld");
      var isNew = s.value === "__new__";
      if (fld) {
        fld.style.display = isNew ? "" : "none";
        if (isNew) { var ng = document.getElementById("ahNewGroup"); if (ng) ng.focus(); }
      }
    }
  }
  function onKey(ev) {
    if (!document.getElementById("aihub")) return;
    if (ev.key === "Escape" && state.modal) { state.modal = null; paint(); return; }
    if (ev.key === "Enter" && state.modal && ev.target && /^ah(Name|Path|Url|NewGroup)$/.test(ev.target.id || "")) {
      ev.preventDefault(); saveModal();
    }
  }
  function syncTabs() {
    var tabs = host.querySelectorAll(".dhub-tab");
    Array.prototype.forEach.call(tabs, function (t) {
      var on = t.getAttribute("data-ah-group") === state.group && !state.query.trim();
      t.classList.toggle("is-on", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function onClick(ev) {
    if (!document.getElementById("aihub")) return;
    var actEl = ev.target.closest("[data-ah-act]");
    var groupEl = ev.target.closest("[data-ah-group]");
    var rowEl = ev.target.closest(".dhub-row[data-ah-url]");

    if (actEl) {
      var act = actEl.getAttribute("data-ah-act");
      var id = actEl.getAttribute("data-ah-id");
      if (handleAct(act, id, actEl)) { ev.preventDefault(); return; }
    }
    // 그룹 탭 전환 (탭 버튼은 data-ah-act 없음)
    if (groupEl && !actEl) {
      state.group = normGroup(groupEl.getAttribute("data-ah-group"));
      state.query = "";
      paint(); return;
    }
    // 행 전체 클릭 → 링크 열기 (버튼 영역 제외)
    if (rowEl && !actEl && !ev.target.closest(".dhub-row__act")) {
      var url = rowEl.getAttribute("data-ah-url");
      if (url) window.open(url, "_blank", "noopener");
    }
  }

  function handleAct(act, id, el) {
    switch (act) {
      case "new": {
        var g = (el && el.getAttribute("data-ah-group")) || state.group;
        state.modal = { id: null, group: normGroup(g), path: "", name: "", url: "" };
        paint(); return true;
      }
      case "edit": {
        var e = byId(id);
        if (e) { state.modal = { id: e.id, group: e.group, path: e.path, name: e.name, url: e.url }; paint(); }
        return true;
      }
      case "del": {
        var t = byId(id);
        if (t && confirm('“' + (t.name || "이 자료") + '” 을(를) 삭제할까요?')) {
          db = db.filter(function (x) { return x.id !== id; });
          persist("delete", { id: id });
          state.modal = null;
          paint();
        }
        return true;
      }
      case "modal-save": saveModal(); return true;
      case "modal-cancel": state.modal = null; paint(); return true;
    }
    return false;
  }

  /* ---------- export ---------- */
  // categories: 설정(HUB 메뉴·카테고리 이름)에서 카테고리 트리를 그릴 때 사용
  // (기본 그룹 + 사용자가 추가한 커스텀 그룹까지 동적으로 반영)
  window.AiHub = {
    render: render,
    get categories() { return effectiveGroups().map(function (g) { return { key: g, def: g }; }); },
  };
})();
