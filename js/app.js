/* =========================================================
   SNACK & GARDEN — OPS · 앱 로직 (라우팅 + 렌더)
   ========================================================= */
(function () {
  "use strict";

  var TODAY = "2026-07-22"; // 데모 기준일 (실서비스에선 new Date())

  var view = document.getElementById("view");
  var viewTitle = document.getElementById("viewTitle");
  var navItems = Array.prototype.slice.call(document.querySelectorAll(".nav__item[data-view]"));

  /* ---------- helpers ---------- */
  var WD = ["일", "월", "화", "수", "목", "금", "토"];
  function d(iso) { var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function wd(iso) { return d(iso).getDay(); }
  function label(iso) { var p = iso.split("-"); return +p[2] + " <small>" + WD[wd(iso)] + "</small>"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function hue(name) { var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return h; }

  var CATCOLOR = { 채용:"#b39dff", 교육:"#f472b6", 운영:"#c6ff2e", 내부:"#60a5fa", 외부:"#fb923c", 보고:"#4ade80", 근태:"#ff5a52", 행정:"#94a3b8", 휴일:"#4ade80", 기타:"#cbd5e1" };

  /* 업무 그룹 색상 : 스낵=노랑 / 가든=형광초록 / 총무지원=파랑 */
  var GROUP = {
    "스낵":    { bg:"#F5C518", fg:"#2e2400" },  // yellow
    "가든":    { bg:"#C6FF2E", fg:"#1a2400" },  // acid green
    "총무지원": { bg:"#4C8DE6", fg:"#ffffff" },  // blue
  };
  function groupOf(g) { return GROUP[g] || { bg:"#8a8a90", fg:"#fff" }; }

  /* 상태 배지 아이콘 (얇은 라인 SVG) */
  var IC = {
    check: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/></svg>',
    minus: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/></svg>',
  };
  var STATUS = {
    "재직": { key:"active", icon: IC.check },
    "휴직": { key:"leave",  icon: IC.clock },
    "퇴사": { key:"out",    icon: IC.minus },
  };

  /* ======================================================
     DATA LAYER — 데모(목업) / 라이브(구글시트) 자동 전환
     ====================================================== */
  function endpoint() { return (window.CONFIG && window.CONFIG.endpoint || "").trim(); }
  function isLive() { return !!endpoint(); }

  function toArr(v) {
    if (Array.isArray(v)) return v;
    return String(v || "").split(",").map(function (s) { return s.trim(); }).filter(Boolean);
  }
  /* 시트가 날짜를 ISO datetime 으로 내려줄 때 → YYYY-MM-DD 로 정리
     (저장된 자정 기준값의 타임존 시프트를 +12h 로 보정) */
  function fmtDay(v) {
    if (!v) return "";
    var s = String(v);
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    var d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return new Date(d.getTime() + 12 * 3600 * 1000).toISOString().slice(0, 10);
  }
  function normCrew(r) {
    return {
      name: r.name || "", role: r.role || "", team: r.team || "", group: r.group || "미지정",
      status: r.status || "재직", joinDate: fmtDay(r.joinDate), phone: r.phone || "",
      site: r.site || "", duties: toArr(r.duties), note: r.note || "",
    };
  }

  /** 구글시트에서 크루·일정 로드 (실패 시 데모 데이터 유지) */
  function loadData() {
    var ep = endpoint();
    if (!ep) return Promise.resolve(false);
    var url = ep + (ep.indexOf("?") > -1 ? "&" : "?") + "action=all";
    return fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.crew && d.crew.length) window.CREW = d.crew.map(normCrew);
        if (d && d.schedule && d.schedule.length) window.SCHEDULE = d.schedule;
        return true;
      })
      .catch(function (e) { console.warn("[시트 로드 실패] 데모 데이터로 표시합니다.", e); return false; });
  }

  /** 시트에 저장 (Content-Type 미지정 → CORS 프리플라이트 회피, fire-and-forget) */
  function saveToSheet(payload) {
    var ep = endpoint();
    if (!ep) return Promise.resolve();
    return fetch(ep, { method: "POST", body: JSON.stringify(payload) })
      .catch(function (e) { console.warn("[시트 저장 실패]", e); });
  }

  function updateModeBadge() {
    var foot = document.querySelector(".side__foot");
    if (!foot) return;
    var live = isLive();
    foot.innerHTML = '<span class="dot"></span> ' + (live ? "LIVE · 구글시트 연동" : "DEMO · 목업 데이터");
    foot.classList.toggle("is-live", live);
  }

  /* ======================================================
     SCHEDULE VIEW
     ====================================================== */
  function renderSchedule() {
    var week1 = ["2026-07-20", "2026-07-21", "2026-07-22", "2026-07-23", "2026-07-24"];
    var week2 = ["2026-07-27", "2026-07-28", "2026-07-29", "2026-07-30", "2026-07-31"];
    var s = window.SUMMARY;

    var html = "";

    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Operation / Schedule</p>'
      + '<h2>일정 관리</h2>'
      + '<p class="sub">이달의 사업 현황과 날짜별 일정을 한눈에.</p></div>'
      + '<button class="btn btn--primary" id="addEventBtn">+ 일정 등록</button>'
      + '</div>';

    html += '<div class="summary">'
      + '<div class="summary__col">'
      + '<div class="summary__head"><h3>이달의 사업 · 이슈</h3><span class="chip-mono">' + esc(s.monthLabel) + '</span></div>'
      + '<ul>' + s.issues.map(function (it) {
          var body = esc(it.text);
          if (it.link) body += ' <a class="link-chip" href="' + esc(it.link) + '" target="_blank" rel="noopener" title="링크 열기">🔗</a>';
          return '<li>' + body + '</li>';
        }).join("") + '</ul>'
      + '</div>'
      + '<div class="summary__col"><h4>Focus Point</h4><p class="summary__point">'
      + (s.points && s.points.length ? s.points.map(esc).join("<br>") : "— 등록된 포인트가 없습니다") + '</p></div>'
      + '</div>';

    html += '<div class="cal-toolbar">'
      + '<div class="cal-toolbar__nav">'
      + '<button class="iconbtn">&larr;</button>'
      + '<span class="cal-toolbar__range">2026년 7월 <span>20 — 31 · 2 WEEKS</span></span>'
      + '<button class="iconbtn">&rarr;</button>'
      + '</div>'
      + '<div class="seg"><button class="btn btn--sm btn--primary">오늘</button>'
      + '<button class="btn btn--sm">주간</button><button class="btn btn--sm">월간</button></div>'
      + '</div>';

    html += '<p class="week-label">This week · 07.20 — 07.24</p>';
    html += '<div class="week">' + week1.map(dayCard).join("") + '</div>';
    html += '<p class="week-label">Next week · 07.27 — 07.31</p>';
    html += '<div class="week">' + week2.map(dayCard).join("") + '</div>';

    view.innerHTML = html;
    var addBtn = document.getElementById("addEventBtn");
    if (addBtn) addBtn.addEventListener("click", openEventModal);
  }

  /* ---------- 일정 등록 모달 ---------- */
  var CATEGORIES = ["운영", "채용", "교육", "내부", "외부", "보고", "근태", "행정", "기타"];

  function openEventModal() {
    var el = document.getElementById("eventModal");
    if (!el) { el = buildEventModal(); document.body.appendChild(el); }
    var form = el.querySelector("form");
    form.reset();
    form.date.value = TODAY;
    el.hidden = false;
    setTimeout(function () { form.title.focus(); }, 30);
  }
  function closeEventModal() {
    var el = document.getElementById("eventModal");
    if (el) el.hidden = true;
  }

  function buildEventModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "eventModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop" data-close></div>'
      + '<div class="modal__card" role="dialog" aria-modal="true" aria-label="일정 등록">'
      + '<div class="modal__head"><h3>일정 등록</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<form id="eventForm">'
      + '<label class="fld"><span>날짜</span><input type="date" name="date" required></label>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>시간 <em>(선택)</em></span><input type="time" name="time"></label>'
        + '<label class="fld"><span>카테고리</span><select name="category">'
          + CATEGORIES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join("")
        + '</select></label>'
      + '</div>'
      + '<label class="fld"><span>제목</span><input type="text" name="title" maxlength="60" required placeholder="일정 제목"></label>'
      + '<label class="fld"><span>담당 <em>(선택)</em></span><input type="text" name="assignee" maxlength="20" placeholder="담당자 / 팀"></label>'
      + '<label class="fld"><span>링크 <em>(선택 · 입력 시 🔗 버튼 생성)</em></span><input type="url" name="link" placeholder="https://docs.google.com/..."></label>'
      + '<div class="modal__foot">'
        + '<button type="button" class="btn" data-close>취소</button>'
        + '<button type="submit" class="btn btn--primary">등록</button>'
      + '</div>'
      + '</form>'
      + '</div>';

    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) closeEventModal();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") closeEventModal();
    });
    wrap.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var title = f.title.value.trim();
      if (!title) return;
      var evt = {
        date: f.date.value,
        time: f.time.value || "",
        title: title,
        category: f.category.value,
        done: false,
        assignee: f.assignee.value.trim(),
        link: f.link.value.trim(),
      };
      window.SCHEDULE.push(evt);   // 낙관적 반영 (즉시 표시)
      saveToSheet({ type: "schedule", date: evt.date, time: evt.time, title: evt.title,
                    category: evt.category, done: evt.done, assignee: evt.assignee, link: evt.link });
      closeEventModal();
      renderSchedule();
    });
    return wrap;
  }

  function dayCard(iso) {
    var events = window.SCHEDULE.filter(function (e) { return e.date === iso; })
      .sort(function (a, b) { return (a.time || "99").localeCompare(b.time || "99"); });
    var isToday = iso === TODAY;
    var isSun = wd(iso) === 0;
    var isHoliday = events.some(function (e) { return e.category === "휴일"; });
    var doneCount = events.filter(function (e) { return e.done; }).length;

    var cls = "day" + (isToday ? " is-today" : "") + (isSun ? " is-sun" : "") + (isHoliday ? " is-holiday" : "");

    var body;
    if (isHoliday) {
      body = '<div class="holiday-mark">' + esc(events[0].title) + '</div>';
    } else if (!events.length) {
      body = '<div class="evt__add">일정 입력…</div>';
    } else {
      body = events.map(evtRow).join("") + '<div class="evt__add">+ 추가</div>';
    }

    return '<div class="' + cls + '">'
      + '<div class="day__head"><span class="day__date">' + label(iso) + '</span>'
      + '<span class="day__count">' + (events.length ? doneCount + "/" + events.length : "—") + '</span></div>'
      + '<div class="day__body">' + body + '</div>'
      + '</div>';
  }

  function evtRow(e) {
    var color = CATCOLOR[e.category] || "#cbd5e1";
    var lead = e.time ? '<span class="evt__time">' + esc(e.time) + '</span>' : '';
    var link = e.link
      ? '<a class="evt__link" href="' + esc(e.link) + '" target="_blank" rel="noopener" title="링크 열기" onclick="event.stopPropagation()">🔗</a>'
      : '';
    return '<div class="evt' + (e.done ? " is-done" : "") + '" title="' + esc(e.category) + (e.assignee ? " · " + esc(e.assignee) : "") + '">'
      + (e.done
          ? '<span class="evt__check">&check;</span>'
          : '<span class="evt__cat" style="background:' + color + '"></span>')
      + '<span class="evt__body">' + lead + '<span class="evt__text">' + esc(e.title) + '</span></span>'
      + link
      + '</div>';
  }

  /* ======================================================
     CREW VIEW
     ====================================================== */
  var crewFilter = "전체";
  var crewQuery = "";

  function filteredCrew() {
    return window.CREW.filter(function (c) {
      if (crewFilter !== "전체" && c.status !== crewFilter) return false;
      if (crewQuery) {
        var hay = (c.name + c.team + c.role + c.duties.join("") + c.site).toLowerCase();
        if (hay.indexOf(crewQuery.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  function tbodyHTML() {
    var rows = filteredCrew();
    return rows.length
      ? rows.map(crewRow).join("")
      : '<tr><td colspan="7" class="muted" style="text-align:center;padding:36px">검색 결과가 없습니다</td></tr>';
  }

  function renderCrew() {
    var crew = window.CREW;
    var active = crew.filter(function (c) { return c.status === "재직"; }).length;
    var leave = crew.filter(function (c) { return c.status === "휴직"; }).length;
    var out = crew.filter(function (c) { return c.status === "퇴사"; }).length;

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Crew / Roster</p>'
      + '<h2>크루 목록</h2>'
      + '<p class="sub">팀 크루의 현황과 담당 업무를 한눈에.</p></div>'
      + '<button class="btn btn--primary" onclick="alert(\'구글시트 연동 후 활성화됩니다\')">+ 크루 등록</button>'
      + '</div>';

    html += '<div class="stats">'
      + statCard("acid", crew.length, "명", "Total")
      + statCard("green", active, "명", "Active")
      + statCard("", leave, "명", "On leave")
      + statCard("", out, "명", "Left")
      + '</div>';

    html += '<div class="toolbar-row">'
      + '<div class="filter" id="crewFilter">'
      + ["전체", "재직", "휴직", "퇴사"].map(function (f) {
          return '<button class="btn btn--sm btn--pill ' + (f === crewFilter ? "is-on" : "") + '" data-f="' + f + '">' + f + '</button>';
        }).join("")
      + '</div>'
      + '<input class="searchbox" id="crewSearch" type="search" placeholder="이름 · 팀 · 담당업무 검색" value="' + esc(crewQuery) + '">'
      + '</div>';

    html += '<div class="table-wrap"><table class="crew-table"><thead><tr>'
      + '<th>크루</th><th>직책</th><th>상태</th><th>입사일</th><th>근무지</th><th>담당 업무</th><th>비고</th>'
      + '</tr></thead><tbody id="crewBody">' + tbodyHTML() + '</tbody></table></div>';

    view.innerHTML = html;

    document.getElementById("crewFilter").addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-f]"); if (!b) return;
      crewFilter = b.getAttribute("data-f"); renderCrew();
    });
    var sb = document.getElementById("crewSearch");
    sb.addEventListener("input", function () {
      crewQuery = sb.value;
      document.getElementById("crewBody").innerHTML = tbodyHTML();
    });
  }

  function statCard(mod, num, unit, label) {
    return '<div class="stat' + (mod ? " stat--" + mod : "") + '"><div class="stat__num">' + num + '<small>' + unit + '</small></div>'
      + '<div class="stat__label">' + label + '</div></div>';
  }

  function crewRow(c) {
    var g = groupOf(c.group);
    var st = STATUS[c.status] || STATUS["재직"];
    return '<tr>'
      + '<td><div class="crew-name">'
        + '<span><b>' + esc(c.name) + '</b>'
          + '<span class="t"><i class="gdot" style="background:' + g.bg + '"></i>' + esc(c.group || "미지정") + '</span>'
        + '</span>'
      + '</div></td>'
      + '<td>' + esc(c.role) + '</td>'
      + '<td><span class="badge badge--' + st.key + '">' + st.icon + esc(c.status) + '</span></td>'
      + '<td class="mono-cell">' + esc(c.joinDate) + '</td>'
      + '<td>' + esc(c.site) + '</td>'
      + '<td><div class="tagset">' + (c.duties.length ? c.duties.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("") : '<span class="muted">—</span>') + '</div></td>'
      + '<td class="muted">' + esc(c.note || "—") + '</td>'
      + '</tr>';
  }

  /* ======================================================
     DASHBOARD (placeholder)
     ====================================================== */
  function renderDashboard() {
    view.innerHTML = '<div class="placeholder">'
      + '<p class="eyebrow">Main / Dashboard</p>'
      + '<h2>대시보드</h2>'
      + '<p class="muted">크루 · 일정 요약 위젯이 이 자리에 들어갑니다.</p>'
      + '<p class="muted">좌측에서 <b style="color:var(--accent-text)">크루 목록</b> · <b style="color:var(--accent-text)">일정 관리</b>를 확인해 보세요.</p>'
      + '</div>';
  }

  /* ======================================================
     ROUTER
     ====================================================== */
  var VIEWS = {
    dashboard: { title: "DASHBOARD", render: renderDashboard },
    crew:      { title: "CREW", render: renderCrew },
    schedule:  { title: "SCHEDULE", render: renderSchedule },
  };

  function go(name) {
    if (!VIEWS[name]) name = "schedule";
    navItems.forEach(function (a) { a.classList.toggle("is-active", a.getAttribute("data-view") === name); });
    viewTitle.textContent = VIEWS[name].title;
    if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
    VIEWS[name].render();
    window.scrollTo(0, 0);
  }

  navItems.forEach(function (a) {
    a.addEventListener("click", function () { go(a.getAttribute("data-view")); });
  });

  /* ---------- theme toggle ---------- */
  (function initTheme() {
    var btn = document.getElementById("themeToggle");
    if (!btn) return;
    var lbl = btn.querySelector(".lbl");
    function isLight() { return document.documentElement.getAttribute("data-theme") === "light"; }
    function sync() { lbl.textContent = isLight() ? "LIGHT" : "DARK"; }
    sync();
    btn.addEventListener("click", function () {
      if (isLight()) {
        document.documentElement.removeAttribute("data-theme");
        try { localStorage.setItem("sg-theme", "dark"); } catch (e) {}
      } else {
        document.documentElement.setAttribute("data-theme", "light");
        try { localStorage.setItem("sg-theme", "light"); } catch (e) {}
      }
      sync();
    });
  })();

  /* ---------- boot : 데이터 로드 후 라우팅 ---------- */
  function boot() {
    updateModeBadge();
    var initial = location.hash.slice(1) || "schedule";
    if (isLive()) {
      view.innerHTML = '<div class="placeholder"><p class="eyebrow">Loading</p>'
        + '<h2 class="muted">구글시트에서 불러오는 중…</h2></div>';
      loadData().then(function () { go(initial); });
    } else {
      go(initial);
    }
  }
  boot();
})();
