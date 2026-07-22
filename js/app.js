/* =========================================================
   SNACK & GARDEN — OPS · 앱 로직 (라우팅 + 렌더)
   ========================================================= */
(function () {
  "use strict";

  var TODAY = "2026-07-22"; // 데모 기준일 (실서비스에선 new Date())

  var view = document.getElementById("view");
  var viewTitle = document.getElementById("viewTitle");
  var navItems = Array.prototype.slice.call(document.querySelectorAll(".nav__item[data-view]"));

  /* ---------- date helpers ---------- */
  var WD = ["일", "월", "화", "수", "목", "금", "토"];
  function d(iso) { var p = iso.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function wd(iso) { return d(iso).getDay(); }
  function label(iso) { var p = iso.split("-"); return +p[2] + " <small>" + WD[wd(iso)] + "</small>"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function hue(name) { var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return h; }

  function pad2(n) { return ("0" + n).slice(-2); }
  function isoOf(dt) { return dt.getFullYear() + "-" + pad2(dt.getMonth() + 1) + "-" + pad2(dt.getDate()); }
  function addDays(iso, n) { var dt = d(iso); dt.setDate(dt.getDate() + n); return isoOf(dt); }
  function startOfWeek(iso) { var day = wd(iso); return addDays(iso, day === 0 ? -6 : 1 - day); } // 월요일 시작
  function startOfMonth(iso) { var p = iso.split("-"); return p[0] + "-" + p[1] + "-01"; }
  function daysInMonth(y, m0) { return new Date(y, m0 + 1, 0).getDate(); }
  function addMonths(iso, n) {
    var p = iso.split("-").map(Number);
    var total = p[1] - 1 + n;
    var y = p[0] + Math.floor(total / 12);
    var m0 = ((total % 12) + 12) % 12;
    var day = Math.min(p[2], daysInMonth(y, m0));
    return y + "-" + pad2(m0 + 1) + "-" + pad2(day);
  }
  function fmtRangeShort(a, b) {
    var da = d(a), db = d(b);
    if (da.getMonth() === db.getMonth()) return pad2(da.getMonth() + 1) + "." + pad2(da.getDate()) + " — " + pad2(db.getDate());
    return pad2(da.getMonth() + 1) + "." + pad2(da.getDate()) + " — " + pad2(db.getMonth() + 1) + "." + pad2(db.getDate());
  }

  /* ---------- misc helpers ---------- */
  function newId(prefix) { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function findById(arr, id) { for (var i = 0; i < arr.length; i++) if (String(arr[i].id) === String(id)) return arr[i]; return null; }
  function indexById(arr, id) { for (var i = 0; i < arr.length; i++) if (String(arr[i].id) === String(id)) return i; return -1; }

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
      id: r.id || "", name: r.name || "", role: r.role || "", team: r.team || "", group: r.group || "미지정",
      status: r.status || "재직", joinDate: fmtDay(r.joinDate), phone: r.phone || "",
      site: r.site || "", duties: toArr(r.duties), note: r.note || "",
      contractType: r.contractType || "", birthDate: fmtDay(r.birthDate),
      disability: r.disability || "비장애", disabilityType: r.disabilityType || "",
      emergencyContact: r.emergencyContact || "", badgeNumber: r.badgeNumber || "",
      workHours: r.workHours || "",
    };
  }

  /** 입사일 기준 근속기간을 "N년 M개월" 형태로 계산 */
  function tenureOf(iso) {
    if (!iso) return "—";
    var start = d(iso), now = d(TODAY);
    var months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (now.getDate() < start.getDate()) months--;
    if (months < 0) months = 0;
    var y = Math.floor(months / 12), m = months % 12;
    if (y && m) return y + "년 " + m + "개월";
    if (y) return y + "년";
    return m + "개월";
  }

  /** 구글시트에서 크루·일정 로드 (실패 시 데모 데이터 유지)
   *  Apps Script /exec 응답이 브라우저·중간 캐시에 잡히는 걸 막기 위해 매번 캐시버스팅 */
  function loadData() {
    var ep = endpoint();
    if (!ep) return Promise.resolve(false);
    var url = ep + (ep.indexOf("?") > -1 ? "&" : "?") + "action=all&_ts=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.crew && d.crew.length) window.CREW = d.crew.map(normCrew);
        if (d && d.schedule && d.schedule.length) window.SCHEDULE = d.schedule;
        return true;
      })
      .catch(function (e) { console.warn("[시트 로드 실패] 데모 데이터로 표시합니다.", e); return false; });
  }

  /** 시트에 저장/수정/삭제 (Content-Type 미지정 → CORS 프리플라이트 회피, fire-and-forget) */
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
  var schedMode = "week";   // "week" | "month"
  var schedAnchor = TODAY;  // 현재 보고 있는 기준 날짜

  function computeRangeLabel() {
    if (schedMode === "week") {
      var ws = startOfWeek(schedAnchor), we = addDays(ws, 4);
      var monthLbl = d(ws).getFullYear() + "년 " + (d(ws).getMonth() + 1) + "월";
      return monthLbl + ' <span>' + fmtRangeShort(ws, we) + ' · WEEK</span>';
    }
    var a = d(schedAnchor);
    return a.getFullYear() + "년 " + (a.getMonth() + 1) + "월 <span>MONTH</span>";
  }

  function weekLabelFor(ws) {
    var we = addDays(ws, 4);
    var containsToday = TODAY >= ws && TODAY <= we;
    var lead = containsToday ? "This week" : (d(ws).getMonth() + 1) + "." + (+ws.split("-")[2]) + " 주";
    return lead + " · " + fmtRangeShort(ws, we);
  }

  function renderSchedule() {
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
      + '<button class="iconbtn" data-nav="-1" aria-label="이전">&larr;</button>'
      + '<span class="cal-toolbar__range">' + computeRangeLabel() + '</span>'
      + '<button class="iconbtn" data-nav="1" aria-label="다음">&rarr;</button>'
      + '</div>'
      + '<div class="seg">'
      + '<button class="btn btn--sm btn--primary" data-mode="today">오늘</button>'
      + '<button class="btn btn--sm ' + (schedMode === "week" ? "is-on" : "") + '" data-mode="week">주간</button>'
      + '<button class="btn btn--sm ' + (schedMode === "month" ? "is-on" : "") + '" data-mode="month">월간</button>'
      + '</div>'
      + '</div>';

    if (schedMode === "week") {
      var ws = startOfWeek(schedAnchor);
      var days = [0, 1, 2, 3, 4].map(function (i) { return addDays(ws, i); });
      html += '<p class="week-label">' + weekLabelFor(ws) + '</p>';
      html += '<div class="week">' + days.map(dayCard).join("") + '</div>';
    } else {
      html += monthGridHtml(schedAnchor);
    }

    view.innerHTML = html;
  }

  /* ---------- 월간 뷰 ---------- */
  function monthGridHtml(anchor) {
    var ms = startOfMonth(anchor);
    var gridStart = addDays(ms, -wd(ms));
    var cells = [];
    for (var i = 0; i < 42; i++) cells.push(addDays(gridStart, i));
    var curMonth = d(anchor).getMonth();

    var head = '<div class="month-head">' + WD.map(function (w, i) {
      return '<div class="month-head__d' + (i === 0 ? " is-sun" : "") + '">' + w + '</div>';
    }).join("") + '</div>';

    var body = '<div class="month-grid">' + cells.map(function (iso) {
      return monthCell(iso, d(iso).getMonth() === curMonth);
    }).join("") + '</div>';

    return head + body;
  }

  function monthCell(iso, inMonth) {
    var events = window.SCHEDULE.filter(function (e) { return e.date === iso; })
      .sort(function (a, b) { return (a.time || "99").localeCompare(b.time || "99"); });
    var isToday = iso === TODAY;
    var isSun = wd(iso) === 0;
    var max = 3;
    var shown = events.slice(0, max).map(function (e) {
      var color = CATCOLOR[e.category] || "#cbd5e1";
      return '<div class="mchip' + (e.done ? " is-done" : "") + '" data-id="' + esc(e.id || "") + '" title="' + esc(e.title) + '">'
        + '<span class="mchip__dot" style="background:' + color + '"></span>'
        + '<span class="mchip__t">' + esc(e.title) + '</span></div>';
    }).join("");
    var more = events.length > max
      ? '<div class="mchip mchip--more" data-date="' + iso + '">+' + (events.length - max) + '건 더보기</div>'
      : "";
    var dnum = +iso.split("-")[2];

    return '<div class="mcell' + (inMonth ? "" : " is-out") + (isToday ? " is-today" : "") + '" data-date="' + iso + '">'
      + '<div class="mcell__head"><span class="mcell__d' + (isSun ? " is-sun" : "") + '">' + dnum + '</span></div>'
      + '<div class="mcell__body">' + shown + more + '</div>'
      + '</div>';
  }

  /* ---------- 일정 등록/수정 모달 ---------- */
  var CATEGORIES = ["운영", "채용", "교육", "내부", "외부", "보고", "근태", "행정", "휴일", "기타"];

  function openEventModal(prefill) {
    var el = document.getElementById("eventModal");
    if (!el) { el = buildEventModal(); document.body.appendChild(el); }
    var form = el.querySelector("form");
    form.reset();
    var editing = !!(prefill && prefill.id);
    form.dataset.id = editing ? prefill.id : "";
    el.querySelector("#eventModalTitle").textContent = editing ? "일정 수정" : "일정 등록";
    el.querySelector("#eventDelBtn").hidden = !editing;
    form.date.value = (prefill && prefill.date) || TODAY;
    form.time.value = (prefill && prefill.time) || "";
    form.title.value = (prefill && prefill.title) || "";
    form.category.value = (prefill && prefill.category) || "운영";
    form.assignee.value = (prefill && prefill.assignee) || "";
    form.link.value = (prefill && prefill.link) || "";
    form.done.checked = !!(prefill && prefill.done);
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
      + '<div class="modal__head"><h3 id="eventModalTitle">일정 등록</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
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
      + '<label class="fld fld--check"><input type="checkbox" name="done"><span>완료 처리</span></label>'
      + '<div class="modal__foot">'
        + '<button type="button" class="btn btn--danger" id="eventDelBtn" hidden>삭제</button>'
        + '<div class="modal__spacer"></div>'
        + '<button type="button" class="btn" data-close>취소</button>'
        + '<button type="submit" class="btn btn--primary">저장</button>'
      + '</div>'
      + '</form>'
      + '</div>';

    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) closeEventModal();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !wrap.hidden) closeEventModal();
    });
    wrap.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var title = f.title.value.trim();
      if (!title) return;
      var id = f.dataset.id;
      var evt = {
        id: id || newId("s"),
        date: f.date.value,
        time: f.time.value || "",
        title: title,
        category: f.category.value,
        done: f.done.checked,
        assignee: f.assignee.value.trim(),
        link: f.link.value.trim(),
      };
      if (id) {
        var idx = indexById(window.SCHEDULE, id);
        if (idx > -1) window.SCHEDULE[idx] = evt; else window.SCHEDULE.push(evt);
        saveToSheet({ type: "schedule", action: "update", id: evt.id, date: evt.date, time: evt.time,
                      title: evt.title, category: evt.category, done: evt.done, assignee: evt.assignee, link: evt.link });
      } else {
        window.SCHEDULE.push(evt);
        saveToSheet({ type: "schedule", action: "add", id: evt.id, date: evt.date, time: evt.time,
                      title: evt.title, category: evt.category, done: evt.done, assignee: evt.assignee, link: evt.link });
      }
      closeEventModal();
      renderSchedule();
    });
    wrap.querySelector("#eventDelBtn").addEventListener("click", function () {
      var id = wrap.querySelector("form").dataset.id;
      if (!id) return;
      if (!confirm("이 일정을 삭제할까요?")) return;
      window.SCHEDULE = window.SCHEDULE.filter(function (s) { return String(s.id) !== String(id); });
      saveToSheet({ type: "schedule", action: "delete", id: id });
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
      body = '<div class="evt__add" data-date="' + iso + '">일정 입력…</div>';
    } else {
      body = events.map(evtRow).join("") + '<div class="evt__add" data-date="' + iso + '">+ 추가</div>';
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
    var actions = '<span class="evt__actions">'
      + '<button type="button" class="evt__act evt__act--next" data-id="' + esc(e.id || "") + '" title="다음 날로 업무 이관">&rarr;</button>'
      + '<button type="button" class="evt__act evt__act--del" data-id="' + esc(e.id || "") + '" title="삭제">&times;</button>'
      + '</span>';
    return '<div class="evt' + (e.done ? " is-done" : "") + '" data-id="' + esc(e.id || "") + '" title="' + esc(e.category) + (e.assignee ? " · " + esc(e.assignee) : "") + ' · 클릭하여 수정">'
      + (e.done
          ? '<span class="evt__check">&check;</span>'
          : '<span class="evt__cat" style="background:' + color + '"></span>')
      + '<span class="evt__body">' + lead + '<span class="evt__text">' + esc(e.title) + '</span></span>'
      + link
      + actions
      + '</div>';
  }

  /* ---------- 일정 이관 / 빠른 삭제 (호버 버튼) ---------- */
  function moveEventToNextDay(id) {
    var evt = findById(window.SCHEDULE, id);
    if (!evt) return;
    evt.date = addDays(evt.date, 1);
    saveToSheet({ type: "schedule", action: "update", id: evt.id, date: evt.date, time: evt.time,
                  title: evt.title, category: evt.category, done: evt.done, assignee: evt.assignee, link: evt.link });
    renderSchedule();
  }
  function deleteEventQuick(id) {
    if (!confirm("이 일정을 삭제할까요?")) return;
    window.SCHEDULE = window.SCHEDULE.filter(function (s) { return String(s.id) !== String(id); });
    saveToSheet({ type: "schedule", action: "delete", id: id });
    renderSchedule();
  }

  /* ---------- 일정 인라인 등록 (팝업 없이 날짜 칸에서 바로 입력) ---------- */
  function activateQuickAdd(trigger) {
    var iso = trigger.getAttribute("data-date");
    var input = document.createElement("input");
    input.type = "text";
    input.className = "evt__quickinput";
    input.placeholder = "일정 제목 입력 후 Enter";
    input.maxLength = 60;
    trigger.replaceWith(input);
    input.focus();

    var done = false;
    function commit() {
      if (done) return;
      done = true;
      var title = input.value.trim();
      if (!title) { renderSchedule(); return; }
      var evt = { id: newId("s"), date: iso, time: "", title: title, category: "기타", done: false, assignee: "", link: "" };
      window.SCHEDULE.push(evt);
      saveToSheet({ type: "schedule", action: "add", id: evt.id, date: evt.date, time: evt.time,
                    title: evt.title, category: evt.category, done: evt.done, assignee: evt.assignee, link: evt.link });
      renderSchedule();
    }
    function cancel() {
      if (done) return;
      done = true;
      renderSchedule();
    }
    input.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); commit(); }
      else if (ev.key === "Escape") { cancel(); }
    });
    input.addEventListener("blur", function () { commit(); });
  }

  /* ======================================================
     CREW VIEW
     ====================================================== */
  var crewFilter = "전체";
  var crewQuery = "";
  var crewDetailId = null;
  var crewDetailTab = "basic";
  var CREW_GROUPS = ["스낵", "가든", "총무지원"];
  var CREW_STATUSES = ["재직", "휴직", "퇴사"];
  var CREW_CONTRACTS = ["정규", "계약", "단기계약"];
  var CREW_DISABILITY = ["비장애", "장애"];
  var CREW_TABS = [
    { key: "basic", label: "기본정보" },
    { key: "interview", label: "면담기록" },
    { key: "growth", label: "성장평가" },
    { key: "issue", label: "이슈기록" },
    { key: "attendance", label: "근태요약" },
    { key: "edu", label: "교육OJT" },
    { key: "change", label: "인사변동" },
    { key: "ai", label: "AI 지원가이드" },
    { key: "sensitive", label: "민감정보", locked: true },
  ];

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
    if (crewDetailId) {
      var detailC = findById(window.CREW, crewDetailId);
      if (detailC) { renderCrewDetail(detailC); return; }
      crewDetailId = null;
    }

    var crew = window.CREW;
    var active = crew.filter(function (c) { return c.status === "재직"; }).length;
    var leave = crew.filter(function (c) { return c.status === "휴직"; }).length;
    var out = crew.filter(function (c) { return c.status === "퇴사"; }).length;

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Crew / Roster</p>'
      + '<h2>크루 목록</h2>'
      + '<p class="sub">팀 크루의 현황과 담당 업무를 한눈에. <span class="muted">행을 클릭하면 상세 정보를 볼 수 있어요.</span></p></div>'
      + '<button class="btn btn--primary" id="addCrewBtn">+ 크루 등록</button>'
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
      + '<th>크루</th><th>상태</th><th>입사일</th><th>근무지</th><th>장애유형</th><th>담당 업무</th><th>비고</th>'
      + '</tr></thead><tbody id="crewBody">' + tbodyHTML() + '</tbody></table></div>';

    view.innerHTML = html;
  }

  function statCard(mod, num, unit, label) {
    return '<div class="stat' + (mod ? " stat--" + mod : "") + '"><div class="stat__num">' + num + '<small>' + unit + '</small></div>'
      + '<div class="stat__label">' + label + '</div></div>';
  }

  function disabilityBadge(c) {
    var isDisabled = c.disability === "장애";
    var label = isDisabled ? (c.disabilityType || "장애") : "비장애";
    return '<span class="badge ' + (isDisabled ? "badge--dis" : "badge--nodis") + '">' + esc(label) + '</span>';
  }

  function crewRow(c) {
    var g = groupOf(c.group);
    var st = STATUS[c.status] || STATUS["재직"];
    return '<tr data-id="' + esc(c.id || "") + '">'
      + '<td><div class="crew-name">'
        + '<span><b>' + esc(c.name) + '</b>'
          + '<span class="t"><i class="gdot" style="background:' + g.bg + '"></i>' + esc(c.group || "미지정") + '</span>'
        + '</span>'
      + '</div></td>'
      + '<td><span class="badge badge--' + st.key + '">' + st.icon + esc(c.status) + '</span></td>'
      + '<td class="mono-cell">' + esc(c.joinDate) + '</td>'
      + '<td>' + esc(c.site) + '</td>'
      + '<td>' + disabilityBadge(c) + '</td>'
      + '<td><div class="tagset">' + (c.duties.length ? c.duties.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join("") : '<span class="muted">—</span>') + '</div></td>'
      + '<td class="muted">' + esc(c.note || "—") + '</td>'
      + '</tr>';
  }

  /* ---------- 크루 상세 페이지 ---------- */
  function renderCrewDetail(c) {
    var g = groupOf(c.group);
    var initial = (c.name || "?").slice(0, 1);

    var html = '<div class="crew-detail">';
    html += '<button class="btn btn--sm" id="crewBackBtn">&larr; 목록으로</button>';

    html += '<div class="crew-detail__banner">'
      + '<div class="crew-detail__avatar" style="background:' + g.bg + ';color:' + g.fg + '">' + esc(initial) + '</div>'
      + '<div class="crew-detail__info">'
        + '<h2>' + esc(c.name) + '</h2>'
        + '<p class="muted">' + esc(c.team || c.group || "—") + '</p>'
        + '<div class="crew-detail__tags">'
          + '<span class="chip-tag">📅 ' + esc(c.joinDate || "—") + '</span>'
          + (c.workHours ? '<span class="chip-tag">⏱ ' + esc(c.workHours) + '</span>' : "")
          + '<span class="chip-tag">🎖 ' + tenureOf(c.joinDate) + '</span>'
        + '</div>'
      + '</div>'
      + '<div class="crew-detail__actions">'
        + '<button class="btn" id="crewDetailEditBtn">✏️ 수정</button>'
        + '<button class="btn btn--danger" id="crewDetailDelBtn">🗑 삭제</button>'
      + '</div>'
    + '</div>';

    html += '<div class="crew-tabs">' + CREW_TABS.map(function (t) {
      return '<button class="crew-tab' + (t.key === crewDetailTab ? " is-on" : "") + '" data-tab="' + t.key + '">'
        + esc(t.label) + (t.locked ? " 🔒" : "") + '</button>';
    }).join("") + '</div>';

    html += '<div class="crew-tab-panel">' + crewTabPanel(c, crewDetailTab) + '</div>';
    html += '</div>';

    view.innerHTML = html;
  }

  function crewTabPanel(c, tab) {
    if (tab !== "basic") {
      return '<div class="placeholder placeholder--sm"><p class="muted">이 탭은 준비 중입니다.</p></div>';
    }
    return '<div class="detail-grid">'
      + detailField("이름", c.name)
      + detailField("소속팀", c.team || c.group)
      + detailField("계약현황", c.contractType)
      + detailField("업무시간", c.workHours)
      + detailField("입사일", c.joinDate)
      + detailField("근속", tenureOf(c.joinDate))
      + detailField("생년월일", c.birthDate)
      + detailField("연락처", c.phone)
      + detailField("장애여부", c.disability)
      + detailField("장애유형", c.disabilityType)
      + detailField("비상연락처", c.emergencyContact)
      + detailField("출입증번호", c.badgeNumber)
      + detailField("상태", c.status)
      + '</div>';
  }
  function detailField(label, value) {
    return '<div class="detail-fld"><span class="detail-fld__label">' + esc(label) + '</span>'
      + '<span class="detail-fld__value">' + esc(value || "—") + '</span></div>';
  }

  /* ---------- 크루 등록/수정 모달 ---------- */
  function openCrewModal(prefill) {
    var el = document.getElementById("crewModal");
    if (!el) { el = buildCrewModal(); document.body.appendChild(el); }
    var form = el.querySelector("form");
    form.reset();
    var editing = !!(prefill && prefill.id);
    form.dataset.id = editing ? prefill.id : "";
    el.querySelector("#crewModalTitle").textContent = editing ? "크루 정보 수정" : "신규 크루 등록";
    el.querySelector("#crewDelBtn").hidden = !editing;
    form.name.value = (prefill && prefill.name) || "";
    form.role.value = (prefill && prefill.role) || "";
    form.team.value = (prefill && prefill.team) || "";
    form.group.value = (prefill && prefill.group) || "스낵";
    form.status.value = (prefill && prefill.status) || "재직";
    form.contractType.value = (prefill && prefill.contractType) || "정규";
    form.workHours.value = (prefill && prefill.workHours) || "";
    form.joinDate.value = (prefill && prefill.joinDate) || "";
    form.phone.value = (prefill && prefill.phone) || "";
    form.birthDate.value = (prefill && prefill.birthDate) || "";
    form.emergencyContact.value = (prefill && prefill.emergencyContact) || "";
    form.disability.value = (prefill && prefill.disability) || "비장애";
    form.disabilityType.value = (prefill && prefill.disabilityType) || "";
    form.site.value = (prefill && prefill.site) || "";
    form.badgeNumber.value = (prefill && prefill.badgeNumber) || "";
    form.duties.value = (prefill && prefill.duties && prefill.duties.join(", ")) || "";
    form.note.value = (prefill && prefill.note) || "";
    el.hidden = false;
    setTimeout(function () { form.name.focus(); }, 30);
  }
  function closeCrewModal() {
    var el = document.getElementById("crewModal");
    if (el) el.hidden = true;
  }

  function buildCrewModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "crewModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop" data-close></div>'
      + '<div class="modal__card" role="dialog" aria-modal="true" aria-label="크루 등록">'
      + '<div class="modal__head"><h3 id="crewModalTitle">신규 크루 등록</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<form id="crewForm">'
      + '<label class="fld"><span>이름</span><input type="text" name="name" maxlength="20" required placeholder="이름"></label>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>직책</span><input type="text" name="role" maxlength="20" placeholder="크루 / 매니저 …"></label>'
        + '<label class="fld"><span>팀 표기 <em>(선택)</em></span><input type="text" name="team" maxlength="20" placeholder="닉네임 등"></label>'
      + '</div>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>업무 그룹</span><select name="group">' + CREW_GROUPS.map(function (g) { return '<option value="' + g + '">' + g + '</option>'; }).join("") + '</select></label>'
        + '<label class="fld"><span>상태</span><select name="status">' + CREW_STATUSES.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join("") + '</select></label>'
      + '</div>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>계약현황</span><select name="contractType">' + CREW_CONTRACTS.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join("") + '</select></label>'
        + '<label class="fld"><span>업무시간 <em>(선택)</em></span><input type="text" name="workHours" placeholder="09:00-18:00(8h)"></label>'
      + '</div>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>입사일</span><input type="date" name="joinDate"></label>'
        + '<label class="fld"><span>연락처</span><input type="text" name="phone" placeholder="010-0000-0000"></label>'
      + '</div>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>생년월일 <em>(선택)</em></span><input type="date" name="birthDate"></label>'
        + '<label class="fld"><span>비상연락처 <em>(선택)</em></span><input type="text" name="emergencyContact" placeholder="010-0000-0000"></label>'
      + '</div>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>장애여부</span><select name="disability">' + CREW_DISABILITY.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join("") + '</select></label>'
        + '<label class="fld"><span>장애유형 <em>(선택)</em></span><input type="text" name="disabilityType" placeholder="발달장애 등"></label>'
      + '</div>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>근무지</span><input type="text" name="site" maxlength="30" placeholder="판교 오아시스"></label>'
        + '<label class="fld"><span>출입증번호 <em>(선택)</em></span><input type="text" name="badgeNumber" placeholder="O0000"></label>'
      + '</div>'
      + '<label class="fld"><span>담당 업무 <em>(쉼표로 구분)</em></span><input type="text" name="duties" placeholder="발주, 온보딩"></label>'
      + '<label class="fld"><span>비고 <em>(선택)</em></span><input type="text" name="note" maxlength="60" placeholder="메모"></label>'
      + '<div class="modal__foot">'
        + '<button type="button" class="btn btn--danger" id="crewDelBtn" hidden>삭제</button>'
        + '<div class="modal__spacer"></div>'
        + '<button type="button" class="btn" data-close>취소</button>'
        + '<button type="submit" class="btn btn--primary">저장</button>'
      + '</div>'
      + '</form>'
      + '</div>';

    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) closeCrewModal();
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !wrap.hidden) closeCrewModal();
    });
    wrap.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var name = f.name.value.trim();
      if (!name) return;
      var id = f.dataset.id;
      var c = {
        id: id || newId("c"),
        name: name, role: f.role.value.trim(), team: f.team.value.trim(),
        group: f.group.value, status: f.status.value, joinDate: f.joinDate.value,
        phone: f.phone.value.trim(), site: f.site.value.trim(),
        duties: toArr(f.duties.value), note: f.note.value.trim(),
        contractType: f.contractType.value, workHours: f.workHours.value.trim(),
        birthDate: f.birthDate.value, emergencyContact: f.emergencyContact.value.trim(),
        disability: f.disability.value, disabilityType: f.disabilityType.value.trim(),
        badgeNumber: f.badgeNumber.value.trim(),
      };
      var idx = id ? indexById(window.CREW, id) : -1;
      if (idx > -1) window.CREW[idx] = c; else window.CREW.push(c);
      saveToSheet(Object.assign({ type: "crew", action: id ? "update" : "add" }, c));
      closeCrewModal();
      renderCrew();
    });
    wrap.querySelector("#crewDelBtn").addEventListener("click", function () {
      var id = wrap.querySelector("form").dataset.id;
      if (!id) return;
      if (!confirm("이 크루 정보를 삭제할까요?")) return;
      window.CREW = window.CREW.filter(function (c) { return String(c.id) !== String(id); });
      saveToSheet({ type: "crew", action: "delete", id: id });
      closeCrewModal();
      renderCrew();
    });
    return wrap;
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

  /* ---------- view 내부 이벤트 위임 (한 번만 등록) ---------- */
  function wireDelegation() {
    view.addEventListener("click", function (ev) {
      if (ev.target.closest("#addEventBtn")) { openEventModal({ date: TODAY }); return; }
      if (ev.target.closest("#addCrewBtn")) { openCrewModal(null); return; }

      var mchip = ev.target.closest(".mchip[data-id]");
      if (mchip) { var mev = findById(window.SCHEDULE, mchip.getAttribute("data-id")); if (mev) openEventModal(mev); return; }

      var mmore = ev.target.closest(".mchip--more[data-date]");
      if (mmore) { schedMode = "week"; schedAnchor = mmore.getAttribute("data-date"); renderSchedule(); return; }

      var nextBtn = ev.target.closest(".evt__act--next[data-id]");
      if (nextBtn) { moveEventToNextDay(nextBtn.getAttribute("data-id")); return; }

      var delBtn = ev.target.closest(".evt__act--del[data-id]");
      if (delBtn) { deleteEventQuick(delBtn.getAttribute("data-id")); return; }

      var evtEl = ev.target.closest(".evt[data-id]");
      if (evtEl) { var sev = findById(window.SCHEDULE, evtEl.getAttribute("data-id")); if (sev) openEventModal(sev); return; }

      var addDay = ev.target.closest(".evt__add[data-date]");
      if (addDay) { activateQuickAdd(addDay); return; }

      var mcell = ev.target.closest(".mcell[data-date]");
      if (mcell) { openEventModal({ date: mcell.getAttribute("data-date") }); return; }

      var navBtn = ev.target.closest(".cal-toolbar__nav .iconbtn[data-nav]");
      if (navBtn) {
        var dir = +navBtn.getAttribute("data-nav");
        schedAnchor = schedMode === "month" ? addMonths(schedAnchor, dir) : addDays(schedAnchor, dir * 7);
        renderSchedule(); return;
      }
      var modeBtn = ev.target.closest(".seg [data-mode]");
      if (modeBtn) {
        var mode = modeBtn.getAttribute("data-mode");
        if (mode === "today") schedAnchor = TODAY; else schedMode = mode;
        renderSchedule(); return;
      }

      var crewRowEl = ev.target.closest(".crew-table tbody tr[data-id]");
      if (crewRowEl) { crewDetailId = crewRowEl.getAttribute("data-id"); crewDetailTab = "basic"; renderCrew(); return; }

      var crewBackBtn = ev.target.closest("#crewBackBtn");
      if (crewBackBtn) { crewDetailId = null; renderCrew(); return; }

      var crewTabBtn = ev.target.closest(".crew-tab[data-tab]");
      if (crewTabBtn) { crewDetailTab = crewTabBtn.getAttribute("data-tab"); renderCrew(); return; }

      var crewDetailEditBtn = ev.target.closest("#crewDetailEditBtn");
      if (crewDetailEditBtn) { var cd = findById(window.CREW, crewDetailId); if (cd) openCrewModal(cd); return; }

      var crewDetailDelBtn = ev.target.closest("#crewDetailDelBtn");
      if (crewDetailDelBtn) {
        if (confirm("이 크루 정보를 삭제할까요?")) {
          var delId = crewDetailId;
          window.CREW = window.CREW.filter(function (c) { return String(c.id) !== String(delId); });
          saveToSheet({ type: "crew", action: "delete", id: delId });
          crewDetailId = null;
          renderCrew();
        }
        return;
      }

      var filterBtn = ev.target.closest("#crewFilter button[data-f]");
      if (filterBtn) { crewFilter = filterBtn.getAttribute("data-f"); renderCrew(); return; }
    });

    view.addEventListener("input", function (ev) {
      if (ev.target.id === "crewSearch") {
        crewQuery = ev.target.value;
        var body = document.getElementById("crewBody");
        if (body) body.innerHTML = tbodyHTML();
      }
    });
  }
  wireDelegation();

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
