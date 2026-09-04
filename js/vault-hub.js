/* =========================================================
   비밀번호 HUB — 자격증명 게시판 모듈
   게시형식(서비스별 카드/행)으로 아이디·비밀번호·링크·메모를 모아둔다.
   ▶ 진입 시 관리자 비밀번호를 "한 번 더" 입력하는 게이트를 통과해야 열린다.
     (세션 동안만 열림 · 다른 화면 갔다 오면 유지, 새 세션/잠금 시 재입력)
   ▶ 보안 주의: 정적 사이트라서 데이터는 "이 브라우저(localStorage)"에만
     평문으로 저장되며, 구글시트/서버로는 절대 전송하지 않습니다.
   ========================================================= */
(function () {
  "use strict";

  var STORE_KEY = "sg-vault-v1";
  var SESSION_KEY = "sg-vault-ok";      // 세션 동안 게이트 통과 여부
  var GROUPS = ["운영 계정", "거래처 · 외부", "개인 · 기타"];
  var GROUP_HINT = {
    "운영 계정": "스낵앤가든 운영에 쓰는 공용 계정 — 구글·시트·SNS·배송 등",
    "거래처 · 외부": "협력사·벤더·플랫폼 로그인 정보",
    "개인 · 기타": "그 외 자주 쓰는 로그인 모음",
  };

  var LINK_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>';
  var KEY_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="M10.85 12.15 19 4"/><path d="M18 5l2 2"/><path d="M15 8l2 2"/></svg>';
  var EYE_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  var EYEOFF_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 19C5.5 19 2 12 2 12a18 18 0 0 1 5.1-5.9"/><path d="M9.9 4.2A10.5 10.5 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-2.2 3.2"/><path d="m1 1 22 22"/></svg>';
  var COPY_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';
  var LOCK_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
  var ARROW = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M7 17L17 7"/><path d="M8 7h9v9"/></svg>';

  /* ---------- 상태 ---------- */
  var host = null, wired = false, db = null;
  var state = {
    group: GROUPS[0],
    query: "",
    modal: null,       // null | { id|null, group, name, username, password, url, memo }
    reveal: {},        // id -> true(비밀번호 표시 중)
    gateError: false,  // 게이트 오답 표시
  };

  /* ---------- helpers ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }
  function uid() { return "vh_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function todayIso() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }
  function normGroup(g) { return GROUPS.indexOf(g) !== -1 ? g : GROUPS[0]; }
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
  function sha256Hex(str) {
    var enc = new TextEncoder();
    return crypto.subtle.digest("SHA-256", enc.encode(str)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) {
        return b.toString(16).padStart(2, "0");
      }).join("");
    });
  }

  /* ---------- 게이트(관리자 비밀번호 한 번 더) ---------- */
  // 우선순위: CONFIG.vault.pwHash → 없으면 로그인 비밀번호(CONFIG.auth.pwHash)
  function gateHash() {
    var c = window.CONFIG || {};
    return (c.vault && c.vault.pwHash) || (c.auth && c.auth.pwHash) || "";
  }
  function isUnlocked() {
    try { return sessionStorage.getItem(SESSION_KEY) === "ok"; } catch (e) { return false; }
  }
  function setUnlocked(v) {
    try { v ? sessionStorage.setItem(SESSION_KEY, "ok") : sessionStorage.removeItem(SESSION_KEY); } catch (e) {}
  }

  /* ---------- 저장/로드 (로컬 전용 · 외부 전송 없음) ---------- */
  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) { var arr = JSON.parse(raw); if (Array.isArray(arr)) return arr; }
    } catch (e) {}
    return seed();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); } catch (e) {} }
  function ensureDb() { if (!db) db = load(); }
  function byId(id) { for (var i = 0; i < db.length; i++) if (db[i].id === id) return db[i]; return null; }

  function seed() {
    var now = todayIso();
    function e(group, name, username, url) {
      return { id: uid(), group: group, name: name, username: username, password: "", url: url || "", memo: "", createdAt: now, updatedAt: now };
    }
    return [
      e("운영 계정", "구글 워크스페이스", "ops@snackgarden", ""),
      e("운영 계정", "운영 구글시트", "", "https://docs.google.com"),
      e("거래처 · 외부", "위펀 발주 포털", "", ""),
      e("개인 · 기타", "링키지랩 홈페이지", "", "https://linkagelab.co.kr"),
    ];
  }

  /* =========================================================
     라우팅 진입점
     ========================================================= */
  function render(viewEl) {
    host = viewEl;
    if (!wired) { wire(); wired = true; }
    state.query = "";
    state.modal = null;
    state.reveal = {};
    state.gateError = false;
    if (isUnlocked()) { ensureDb(); if (GROUPS.indexOf(state.group) === -1) state.group = GROUPS[0]; }
    paint();
  }

  function paint() {
    if (!host) return;
    if (!isUnlocked()) {
      host.innerHTML = '<div id="vault" class="vault">' + viewGate() + '</div>';
      window.scrollTo(0, 0);
      var g = document.getElementById("vhGatePw");
      if (g) setTimeout(function () { g.focus(); }, 60);
      return;
    }
    host.innerHTML = '<div id="vault" class="vault">' + viewBoard() + '</div>' + (state.modal ? viewModal() : '');
    window.scrollTo(0, 0);
    var s = document.getElementById("vhSearch");
    if (s && state.query) s.value = state.query;
    if (state.modal) {
      var f = document.getElementById("vhName");
      if (f) setTimeout(function () { f.focus(); }, 40);
    }
  }

  /* =========================================================
     게이트 화면
     ========================================================= */
  function viewGate() {
    return ''
      + '<div class="vault-gate">'
      + '<div class="vault-gate__card">'
      + '<span class="vault-gate__badge">' + LOCK_ICON + '</span>'
      + '<p class="eyebrow">Secured · Password Hub</p>'
      + '<h2 class="vault-gate__title">비밀번호 HUB</h2>'
      + '<p class="vault-gate__sub">보안 영역입니다. 관리자 비밀번호를 한 번 더 입력하세요.</p>'
      + '<form class="vault-gate__form" id="vhGateForm" autocomplete="off" novalidate>'
      + '<label class="vault-gate__field">'
      + '<span class="vault-gate__ficon">' + LOCK_ICON + '</span>'
      + '<input type="password" id="vhGatePw" class="vault-gate__in" placeholder="관리자 비밀번호" autocomplete="off" aria-label="관리자 비밀번호">'
      + '</label>'
      + '<p class="vault-gate__err"' + (state.gateError ? '' : ' hidden') + ' id="vhGateErr">비밀번호가 올바르지 않습니다</p>'
      + '<button type="submit" class="btn btn--primary vault-gate__btn" id="vhGateBtn">잠금 해제</button>'
      + '</form>'
      + '<p class="vault-gate__note">이 브라우저에만 저장되며 외부로 전송되지 않습니다.</p>'
      + '</div>'
      + '</div>';
  }

  function submitGate() {
    var inp = document.getElementById("vhGatePw");
    var btn = document.getElementById("vhGateBtn");
    var errEl = document.getElementById("vhGateErr");
    var card = document.querySelector(".vault-gate__card");
    if (!inp) return;
    var pw = inp.value || "";
    var target = gateHash();
    if (!pw || !target) { showGateErr(errEl, card); return; }
    if (btn) btn.disabled = true;
    sha256Hex(pw).then(function (h) {
      if (btn) btn.disabled = false;
      if (h === target) {
        setUnlocked(true);
        state.gateError = false;
        ensureDb();
        if (GROUPS.indexOf(state.group) === -1) state.group = GROUPS[0];
        paint();
      } else {
        showGateErr(errEl, card);
        inp.value = ""; inp.focus();
      }
    }).catch(function () { if (btn) btn.disabled = false; showGateErr(errEl, card); });
  }
  function showGateErr(errEl, card) {
    state.gateError = true;
    if (errEl) errEl.hidden = false;
    if (card) { card.classList.add("is-shake"); setTimeout(function () { card.classList.remove("is-shake"); }, 420); }
  }

  /* =========================================================
     보드(게시판)
     ========================================================= */
  function groupCount(g) { return db.filter(function (e) { return e.group === g; }).length; }

  function viewBoard() {
    var h = ""
      + '<div class="vault__head">'
      + '<div><p class="eyebrow">Secured · Password Hub</p>'
      + '<h2 class="vault__title">비밀번호 HUB</h2>'
      + '<p class="vault__sub">서비스별 로그인 정보를 한 곳에 모아 안전하게 보관합니다.</p></div>'
      + '<div class="vault__headact">'
      + '<button type="button" class="btn btn--sm vault-lockbtn" data-vh-act="lock" title="다시 잠그기">' + LOCK_ICON + '<span>잠그기</span></button>'
      + '<button type="button" class="btn btn--primary" data-vh-act="new">+ 항목 추가</button>'
      + '</div>'
      + '</div>';

    h += '<div class="vault-search">'
      + '<svg class="vault-search__ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>'
      + '<input type="search" id="vhSearch" class="vault-search__in" placeholder="서비스 · 아이디 · 메모로 검색" autocomplete="off" value="' + esc(state.query) + '">'
      + '</div>';

    h += '<div class="vault-tabs" role="tablist">';
    GROUPS.forEach(function (g) {
      var on = g === state.group && !state.query;
      h += '<button type="button" class="vault-tab' + (on ? ' is-on' : '') + '" data-vh-group="' + esc(g) + '" role="tab" aria-selected="' + (on ? 'true' : 'false') + '">'
        + '<span class="vault-tab__n">' + esc(g) + '</span>'
        + '<span class="vault-tab__c">' + groupCount(g) + '</span>'
        + '</button>';
    });
    h += '</div>';

    h += '<div id="vhBody" class="vault-body">' + (state.query.trim() ? searchBody(state.query.trim()) : groupBody(state.group)) + '</div>';
    return h;
  }

  function groupBody(group) {
    var rows = db.filter(function (e) { return e.group === group; })
      .sort(function (a, b) { return (a.name || "").localeCompare(b.name || "", "ko"); });
    var h = '<p class="vault-hint">' + esc(GROUP_HINT[group] || "") + '</p>';
    if (!rows.length) {
      return h + '<div class="vault-empty">'
        + '<p class="vault-empty__t">아직 등록된 항목이 없어요.</p>'
        + '<p class="vault-empty__s">‘+ 항목 추가’로 첫 로그인 정보를 저장해보세요.</p>'
        + '<button type="button" class="btn btn--primary btn--sm" data-vh-act="new" data-vh-group="' + esc(group) + '">+ 항목 추가</button>'
        + '</div>';
    }
    h += '<ul class="vault-list">';
    rows.forEach(function (e, i) { h += cardHTML(e, i); });
    h += '</ul>';
    return h;
  }

  function searchBody(q) {
    var ql = q.toLowerCase();
    var rows = db.filter(function (e) {
      return [e.name, e.username, e.url, e.memo, e.group].join(" ").toLowerCase().indexOf(ql) !== -1;
    }).sort(function (a, b) { return (a.group + a.name).localeCompare(b.group + b.name, "ko"); });
    var h = '<p class="vault-hint"><b class="vault-count">' + rows.length + '</b> 개 결과 · “' + esc(q) + '”</p>';
    if (!rows.length) return h + '<div class="vault-empty"><p class="vault-empty__t">일치하는 항목이 없어요.</p></div>';
    h += '<ul class="vault-list">';
    rows.forEach(function (e, i) { h += cardHTML(e, i, true); });
    h += '</ul>';
    return h;
  }

  function cardHTML(e, idx, withContext) {
    var dom = domainOf(e.url);
    var revealed = !!state.reveal[e.id];
    var hasPw = !!e.password;
    var pwText = hasPw ? (revealed ? esc(e.password) : "••••••••••") : "—";
    var open = e.url
      ? '<a class="vault-card__open" href="' + esc(normUrl(e.url)) + '" target="_blank" rel="noopener" title="사이트 열기" onclick="event.stopPropagation()">' + ARROW + '</a>'
      : '';

    var meta = withContext ? '<span class="vault-card__ctx">' + esc(e.group) + '</span>'
      : (dom ? '<span class="vault-card__dom">' + esc(dom) + '</span>' : '');

    var userRow = '<div class="vault-field">'
      + '<span class="vault-field__lb">아이디</span>'
      + '<span class="vault-field__val' + (e.username ? '' : ' is-empty') + '">' + (e.username ? esc(e.username) : '미입력') + '</span>'
      + (e.username ? '<button type="button" class="vault-mini" data-vh-act="copy" data-vh-copy="user" data-vh-id="' + esc(e.id) + '" title="아이디 복사">' + COPY_ICON + '</button>' : '')
      + '</div>';

    var pwRow = '<div class="vault-field">'
      + '<span class="vault-field__lb">비밀번호</span>'
      + '<span class="vault-field__val vault-field__pw' + (hasPw ? '' : ' is-empty') + '">' + pwText + '</span>'
      + (hasPw
          ? '<button type="button" class="vault-mini" data-vh-act="reveal" data-vh-id="' + esc(e.id) + '" title="' + (revealed ? '숨기기' : '표시') + '">' + (revealed ? EYEOFF_ICON : EYE_ICON) + '</button>'
            + '<button type="button" class="vault-mini" data-vh-act="copy" data-vh-copy="pw" data-vh-id="' + esc(e.id) + '" title="비밀번호 복사">' + COPY_ICON + '</button>'
          : '')
      + '</div>';

    return '<li class="vault-card" style="--i:' + Math.min(idx, 24) + '" data-vh-id="' + esc(e.id) + '">'
      + '<div class="vault-card__top">'
        + '<span class="vault-card__ic">' + KEY_ICON + '</span>'
        + '<div class="vault-card__ident">'
          + '<span class="vault-card__name">' + esc(e.name || "(제목 없음)") + '</span>'
          + meta
        + '</div>'
        + '<div class="vault-card__act">'
          + '<button type="button" class="vault-iconbtn" data-vh-act="edit" data-vh-id="' + esc(e.id) + '" title="수정">'
            + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>'
          + '</button>'
          + '<button type="button" class="vault-iconbtn vault-iconbtn--del" data-vh-act="del" data-vh-id="' + esc(e.id) + '" title="삭제">'
            + '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/></svg>'
          + '</button>'
        + '</div>'
        + open
      + '</div>'
      + '<div class="vault-card__body">' + userRow + pwRow + '</div>'
      + (e.memo ? '<div class="vault-card__memo">' + esc(e.memo) + '</div>' : '')
      + '</li>';
  }

  /* =========================================================
     추가 / 수정 모달
     ========================================================= */
  function viewModal() {
    var m = state.modal;
    var isNew = !m.id;
    var opts = GROUPS.map(function (g) {
      return '<option value="' + esc(g) + '"' + (g === m.group ? ' selected' : '') + '>' + esc(g) + '</option>';
    }).join("");
    return '<div class="vault-modal" id="vhModal">'
      + '<div class="vault-modal__bd" data-vh-act="modal-cancel"></div>'
      + '<div class="vault-modal__card" role="dialog" aria-modal="true" aria-label="' + (isNew ? '항목 추가' : '항목 수정') + '">'
        + '<div class="vault-modal__head">'
          + '<h3>' + (isNew ? '항목 추가' : '항목 수정') + '</h3>'
          + '<button type="button" class="vault-modal__x" data-vh-act="modal-cancel" aria-label="닫기">×</button>'
        + '</div>'
        + '<div class="vault-modal__body">'
          + '<label class="vault-fld"><span>분류</span><select id="vhGroup" class="vault-in">' + opts + '</select></label>'
          + '<label class="vault-fld"><span>서비스명 <em class="req">*</em></span><input type="text" id="vhName" class="vault-in" maxlength="80" placeholder="예) 구글 워크스페이스" value="' + esc(m.name) + '"></label>'
          + '<label class="vault-fld"><span>아이디</span><input type="text" id="vhUser" class="vault-in" autocomplete="off" placeholder="아이디 / 이메일" value="' + esc(m.username) + '"></label>'
          + '<label class="vault-fld"><span>비밀번호</span>'
            + '<span class="vault-pwwrap">'
              + '<input type="password" id="vhPw" class="vault-in" autocomplete="new-password" placeholder="비밀번호" value="' + esc(m.password) + '">'
              + '<button type="button" class="vault-pwtoggle" data-vh-act="modal-reveal" title="표시/숨기기">' + EYE_ICON + '</button>'
            + '</span></label>'
          + '<label class="vault-fld"><span>링크 <em>( 선택 )</em></span><input type="url" id="vhUrl" class="vault-in" placeholder="https://..." value="' + esc(m.url) + '"></label>'
          + '<label class="vault-fld"><span>메모 <em>( 선택 )</em></span><textarea id="vhMemo" class="vault-in vault-in--area" rows="2" maxlength="300" placeholder="복구 이메일, 보안 질문 힌트 등">' + esc(m.memo) + '</textarea></label>'
        + '</div>'
        + '<div class="vault-modal__foot">'
          + (isNew ? '' : '<button type="button" class="btn btn--danger btn--sm" data-vh-act="del" data-vh-id="' + esc(m.id) + '">삭제</button>')
          + '<div class="vault-modal__spacer"></div>'
          + '<button type="button" class="btn btn--sm" data-vh-act="modal-cancel">취소</button>'
          + '<button type="button" class="btn btn--primary btn--sm" data-vh-act="modal-save">저장</button>'
        + '</div>'
      + '</div>'
    + '</div>';
  }

  function syncModal() {
    if (!state.modal) return;
    var g = document.getElementById("vhGroup"), n = document.getElementById("vhName"),
        u = document.getElementById("vhUser"), p = document.getElementById("vhPw"),
        l = document.getElementById("vhUrl"), me = document.getElementById("vhMemo");
    if (g) state.modal.group = g.value;
    if (n) state.modal.name = n.value;
    if (u) state.modal.username = u.value;
    if (p) state.modal.password = p.value;
    if (l) state.modal.url = l.value;
    if (me) state.modal.memo = me.value;
  }
  function saveModal() {
    syncModal();
    var m = state.modal;
    var name = (m.name || "").trim();
    if (!name) {
      var n = document.getElementById("vhName");
      if (n) { n.focus(); n.classList.add("vault-in--err"); }
      return;
    }
    var now = todayIso();
    var clean = {
      group: normGroup(m.group), name: name,
      username: (m.username || "").trim(), password: m.password || "",
      url: normUrl(m.url), memo: (m.memo || "").trim(),
    };
    if (m.id) {
      var e = byId(m.id);
      if (e) {
        e.group = clean.group; e.name = clean.name; e.username = clean.username;
        e.password = clean.password; e.url = clean.url; e.memo = clean.memo; e.updatedAt = now;
      }
    } else {
      var rec = Object.assign({ id: uid(), createdAt: now, updatedAt: now }, clean);
      db.push(rec);
      state.group = rec.group;
    }
    save();
    state.modal = null;
    state.query = "";
    paint();
  }

  /* =========================================================
     복사
     ========================================================= */
  function copyText(txt, btn) {
    var done = function () { flashCopy(btn); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(done).catch(function () { legacyCopy(txt, done); });
    } else { legacyCopy(txt, done); }
  }
  function legacyCopy(txt, cb) {
    try {
      var ta = document.createElement("textarea");
      ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy");
      document.body.removeChild(ta);
    } catch (e) {}
    cb && cb();
  }
  function flashCopy(btn) {
    if (!btn) return;
    btn.classList.add("is-copied");
    setTimeout(function () { btn.classList.remove("is-copied"); }, 900);
  }

  /* =========================================================
     이벤트 위임
     ========================================================= */
  function wire() {
    host.addEventListener("click", onClick);
    host.addEventListener("input", onInput);
    host.addEventListener("keydown", onKey);
    host.addEventListener("submit", onSubmit);
  }
  function onSubmit(ev) {
    if (ev.target && ev.target.id === "vhGateForm") { ev.preventDefault(); submitGate(); }
  }
  function onInput(ev) {
    if (!document.getElementById("vault")) return;
    var s = ev.target;
    if (s && s.id === "vhSearch") {
      state.query = s.value;
      var body = document.getElementById("vhBody");
      if (body) body.innerHTML = state.query.trim() ? searchBody(state.query.trim()) : groupBody(state.group);
      syncTabs();
    }
  }
  function onKey(ev) {
    if (!document.getElementById("vault")) return;
    if (ev.key === "Escape" && state.modal) { state.modal = null; paint(); return; }
    if (ev.key === "Enter" && state.modal && ev.target && /^vh(Name|User|Pw|Url)$/.test(ev.target.id || "")) {
      ev.preventDefault(); saveModal();
    }
  }
  function syncTabs() {
    var tabs = host.querySelectorAll(".vault-tab");
    Array.prototype.forEach.call(tabs, function (t) {
      var on = t.getAttribute("data-vh-group") === state.group && !state.query.trim();
      t.classList.toggle("is-on", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
  }

  function onClick(ev) {
    if (!document.getElementById("vault")) return;
    var actEl = ev.target.closest("[data-vh-act]");
    var groupEl = ev.target.closest("[data-vh-group]");

    if (actEl) {
      var act = actEl.getAttribute("data-vh-act");
      var id = actEl.getAttribute("data-vh-id");
      if (handleAct(act, id, actEl)) { ev.preventDefault(); return; }
    }
    if (groupEl && !actEl) {
      state.group = normGroup(groupEl.getAttribute("data-vh-group"));
      state.query = "";
      paint(); return;
    }
  }

  function handleAct(act, id, el) {
    switch (act) {
      case "lock": {
        setUnlocked(false);
        state.reveal = {};
        state.modal = null;
        paint(); return true;
      }
      case "new": {
        var g = (el && el.getAttribute("data-vh-group")) || state.group;
        state.modal = { id: null, group: normGroup(g), name: "", username: "", password: "", url: "", memo: "" };
        paint(); return true;
      }
      case "edit": {
        var e = byId(id);
        if (e) { state.modal = { id: e.id, group: e.group, name: e.name, username: e.username, password: e.password, url: e.url, memo: e.memo }; paint(); }
        return true;
      }
      case "del": {
        var t = byId(id);
        if (t && confirm('“' + (t.name || "이 항목") + '” 을(를) 삭제할까요?')) {
          db = db.filter(function (x) { return x.id !== id; });
          delete state.reveal[id];
          save();
          state.modal = null;
          paint();
        }
        return true;
      }
      case "reveal": {
        state.reveal[id] = !state.reveal[id];
        paint(); return true;
      }
      case "copy": {
        var rec = byId(id);
        if (rec) {
          var which = el.getAttribute("data-vh-copy");
          copyText(which === "pw" ? (rec.password || "") : (rec.username || ""), el);
        }
        return true;
      }
      case "modal-reveal": {
        var pw = document.getElementById("vhPw");
        if (pw) {
          var toText = pw.type === "password";
          pw.type = toText ? "text" : "password";
          el.innerHTML = toText ? EYEOFF_ICON : EYE_ICON;
        }
        return true;
      }
      case "modal-save": saveModal(); return true;
      case "modal-cancel": state.modal = null; paint(); return true;
    }
    return false;
  }

  /* ---------- export ---------- */
  window.VaultHub = { render: render };
})();
