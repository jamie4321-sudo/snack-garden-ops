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

  function normInterview(r) {
    return {
      id: r.id || "", date: fmtDay(r.date), time: r.time || "",
      crewId: r.crewId || "", crewName: r.crewName || "",
      type: r.type || "정기 면담", condition: r.condition || "보통",
      recorder: r.recorder || "", content: r.content || "",
      followUp: (r.followUp === true || r.followUp === "필요" || String(r.followUp).toLowerCase() === "true") ? "필요" : "",
      followUpNote: r.followUpNote || "", privateNote: r.privateNote || "",
    };
  }

  function normAttendance(r) {
    return {
      id: r.id || "", date: fmtDay(r.date), time: r.time || "",
      crewId: r.crewId || "", crewName: r.crewName || "",
      kind: r.kind || "지각", reason: r.reason || "", recorder: r.recorder || "",
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
        if (d && d.issues) window.SUMMARY.issues = d.issues;
        if (d && d.points) window.SUMMARY.points = d.points;
        if (d && d.interviews) window.INTERVIEWS = d.interviews.map(normInterview);
        if (d && d.attendance) window.ATTENDANCE = d.attendance.map(normAttendance);
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
      + '<div class="summary__head"><h3>이달의 사업 · 이슈</h3><span class="chip-mono">' + esc((String(s.monthLabel || "").split(" ")[0]) || (d(TODAY).getFullYear() + "년")) + '</span>'
        + '<button type="button" class="issue-add" id="addIssueBtn" title="이슈 추가">+</button>'
      + '</div>'
      + '<ul>' + (s.issues.length ? s.issues.map(function (it) {
          var body = esc(it.text);
          var link = it.link ? ' <a class="link-chip" href="' + esc(it.link) + '" target="_blank" rel="noopener" title="링크 열기">🔗</a>' : "";
          return '<li data-id="' + esc(it.id || "") + '">'
            + '<span class="issue-text">' + body + '</span>' + link
            + '<span class="evt__actions">'
              + '<button type="button" class="evt__act issue-act--edit" data-id="' + esc(it.id || "") + '" title="수정">✎</button>'
              + '<button type="button" class="evt__act evt__act--del issue-act--del" data-id="' + esc(it.id || "") + '" title="삭제">&times;</button>'
            + '</span>'
          + '</li>';
        }).join("") : '<li class="muted" style="cursor:default"><span class="issue-text">— 등록된 이슈가 없습니다</span></li>') + '</ul>'
      + '</div>'
      + '<div class="summary__col">'
      + '<div class="summary__subhead"><h4>Focus Point</h4>'
        + '<button type="button" class="issue-add" id="addPointBtn" title="포인트 추가">+</button>'
      + '</div>'
      + '<ul>' + (s.points && s.points.length ? s.points.map(function (p) {
          return '<li data-id="' + esc(p.id || "") + '">'
            + '<span class="issue-text">' + esc(p.text) + '</span>'
            + '<span class="evt__actions">'
              + '<button type="button" class="evt__act point-act--edit" data-id="' + esc(p.id || "") + '" title="수정">✎</button>'
              + '<button type="button" class="evt__act point-act--del" data-id="' + esc(p.id || "") + '" title="삭제">&times;</button>'
            + '</span>'
          + '</li>';
        }).join("") : '<li class="muted" style="cursor:default"><span class="issue-text">— 등록된 포인트가 없습니다</span></li>') + '</ul>'
      + '</div>'
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
      '<div class="modal__backdrop"></div>'
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
    // 작성 중 실수로 닫히지 않도록 배경 클릭·ESC 닫기는 비활성화 (X·취소 버튼으로만 닫힘)
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
    if (!events.length) {
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
    var toggle = e.category === "휴일" ? '' : ('<button type="button" class="evt__toggle" data-id="' + esc(e.id || "") + '"'
      + (e.done ? '' : ' style="border-color:' + color + '"')
      + ' aria-pressed="' + (e.done ? "true" : "false") + '" title="' + (e.done ? "완료 해제" : "완료 처리") + '">'
      + (e.done ? "&check;" : "") + '</button>');
    return '<div class="evt' + (e.done ? " is-done" : "") + '" data-id="' + esc(e.id || "") + '" title="' + esc(e.category) + (e.assignee ? " · " + esc(e.assignee) : "") + ' · 클릭하여 수정">'
      + toggle
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
  function toggleEventDone(id) {
    var evt = findById(window.SCHEDULE, id);
    if (!evt) return;
    evt.done = !evt.done;
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
  function deleteIssueQuick(id) {
    if (!confirm("이 이슈를 삭제할까요?")) return;
    window.SUMMARY.issues = window.SUMMARY.issues.filter(function (it) { return String(it.id) !== String(id); });
    saveToSheet({ type: "issue", action: "delete", id: id });
    renderSchedule();
  }
  function deletePointQuick(id) {
    if (!confirm("이 포인트를 삭제할까요?")) return;
    window.SUMMARY.points = (window.SUMMARY.points || []).filter(function (p) { return String(p.id) !== String(id); });
    saveToSheet({ type: "point", action: "delete", id: id });
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

  /* ---------- 이달의 사업 · 이슈 등록/수정 모달 ---------- */
  function openIssueModal(prefill) {
    var el = document.getElementById("issueModal");
    if (!el) { el = buildIssueModal(); document.body.appendChild(el); }
    var form = el.querySelector("form");
    form.reset();
    var editing = !!(prefill && prefill.id);
    form.dataset.id = editing ? prefill.id : "";
    el.querySelector("#issueModalTitle").textContent = editing ? "이슈 수정" : "이슈 등록";
    el.querySelector("#issueDelBtn").hidden = !editing;
    form.text.value = (prefill && prefill.text) || "";
    form.link.value = (prefill && prefill.link) || "";
    el.hidden = false;
    setTimeout(function () { form.text.focus(); }, 30);
  }
  function closeIssueModal() {
    var el = document.getElementById("issueModal");
    if (el) el.hidden = true;
  }

  function buildIssueModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "issueModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop"></div>'
      + '<div class="modal__card" role="dialog" aria-modal="true" aria-label="이슈 등록">'
      + '<div class="modal__head"><h3 id="issueModalTitle">이슈 등록</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<form id="issueForm">'
      + '<label class="fld"><span>내용</span><input type="text" name="text" maxlength="80" required placeholder="예) 헤이든 — 팔로업 사항 : 법인카드 상신"></label>'
      + '<label class="fld"><span>링크 <em>(선택 · 입력 시 🔗 버튼 생성)</em></span><input type="url" name="link" placeholder="https://docs.google.com/..."></label>'
      + '<div class="modal__foot">'
        + '<button type="button" class="btn btn--danger" id="issueDelBtn" hidden>삭제</button>'
        + '<div class="modal__spacer"></div>'
        + '<button type="button" class="btn" data-close>취소</button>'
        + '<button type="submit" class="btn btn--primary">저장</button>'
      + '</div>'
      + '</form>'
      + '</div>';

    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) closeIssueModal();
    });
    // 작성 중 실수로 닫히지 않도록 배경 클릭·ESC 닫기는 비활성화 (X·취소 버튼으로만 닫힘)
    wrap.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var text = f.text.value.trim();
      if (!text) return;
      var id = f.dataset.id;
      var it = { id: id || newId("i"), text: text, link: f.link.value.trim() };
      var idx = id ? indexById(window.SUMMARY.issues, id) : -1;
      if (idx > -1) window.SUMMARY.issues[idx] = it; else window.SUMMARY.issues.push(it);
      saveToSheet({ type: "issue", action: id ? "update" : "add", id: it.id, text: it.text, link: it.link });
      closeIssueModal();
      renderSchedule();
    });
    wrap.querySelector("#issueDelBtn").addEventListener("click", function () {
      var id = wrap.querySelector("form").dataset.id;
      if (!id) return;
      if (!confirm("이 이슈를 삭제할까요?")) return;
      window.SUMMARY.issues = window.SUMMARY.issues.filter(function (it) { return String(it.id) !== String(id); });
      saveToSheet({ type: "issue", action: "delete", id: id });
      closeIssueModal();
      renderSchedule();
    });
    return wrap;
  }

  /* ---------- Focus Point 등록/수정 모달 ---------- */
  function openPointModal(prefill) {
    var el = document.getElementById("pointModal");
    if (!el) { el = buildPointModal(); document.body.appendChild(el); }
    var form = el.querySelector("form");
    form.reset();
    var editing = !!(prefill && prefill.id);
    form.dataset.id = editing ? prefill.id : "";
    el.querySelector("#pointModalTitle").textContent = editing ? "Focus Point 수정" : "Focus Point 등록";
    el.querySelector("#pointDelBtn").hidden = !editing;
    form.text.value = (prefill && prefill.text) || "";
    el.hidden = false;
    setTimeout(function () { form.text.focus(); }, 30);
  }
  function closePointModal() {
    var el = document.getElementById("pointModal");
    if (el) el.hidden = true;
  }

  function buildPointModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "pointModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop"></div>'
      + '<div class="modal__card" role="dialog" aria-modal="true" aria-label="Focus Point 등록">'
      + '<div class="modal__head"><h3 id="pointModalTitle">Focus Point 등록</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<form id="pointForm">'
      + '<label class="fld"><span>내용</span><input type="text" name="text" maxlength="80" required placeholder="예) 이번 주 핵심 : 신규 크루 온보딩 완료"></label>'
      + '<div class="modal__foot">'
        + '<button type="button" class="btn btn--danger" id="pointDelBtn" hidden>삭제</button>'
        + '<div class="modal__spacer"></div>'
        + '<button type="button" class="btn" data-close>취소</button>'
        + '<button type="submit" class="btn btn--primary">저장</button>'
      + '</div>'
      + '</form>'
      + '</div>';

    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) closePointModal();
    });
    // 작성 중 실수로 닫히지 않도록 배경 클릭·ESC 닫기는 비활성화 (X·취소 버튼으로만 닫힘)
    wrap.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var text = f.text.value.trim();
      if (!text) return;
      if (!Array.isArray(window.SUMMARY.points)) window.SUMMARY.points = [];
      var id = f.dataset.id;
      var p = { id: id || newId("p"), text: text };
      var idx = id ? indexById(window.SUMMARY.points, id) : -1;
      if (idx > -1) window.SUMMARY.points[idx] = p; else window.SUMMARY.points.push(p);
      saveToSheet({ type: "point", action: id ? "update" : "add", id: p.id, text: p.text });
      closePointModal();
      renderSchedule();
    });
    wrap.querySelector("#pointDelBtn").addEventListener("click", function () {
      var id = wrap.querySelector("form").dataset.id;
      if (!id) return;
      if (!confirm("이 포인트를 삭제할까요?")) return;
      window.SUMMARY.points = (window.SUMMARY.points || []).filter(function (p) { return String(p.id) !== String(id); });
      saveToSheet({ type: "point", action: "delete", id: id });
      closePointModal();
      renderSchedule();
    });
    return wrap;
  }

  /* ======================================================
     CREW VIEW
     ====================================================== */
  var crewDisFilter = "전체";
  var crewGroupFilter = "전체";
  var crewStatusFilter = "전체";
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
    { key: "attendance", label: "근태기록" },
    { key: "edu", label: "교육OJT" },
    { key: "change", label: "인사변동" },
    { key: "ai", label: "AI 지원가이드" },
    { key: "sensitive", label: "민감정보", locked: true },
  ];

  function filteredCrew() {
    return window.CREW.filter(function (c) {
      if (crewDisFilter !== "전체" && c.disability !== crewDisFilter) return false;
      if (crewGroupFilter !== "전체" && c.group !== crewGroupFilter) return false;
      if (crewQuery) {
        var hay = (c.name + c.team + c.role + c.duties.join("") + c.site).toLowerCase();
        if (hay.indexOf(crewQuery.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  var STATUS_LABEL = { "재직": "재직 인원", "휴직": "휴직 인원", "퇴사": "퇴사 인원" };

  function crewSection(status, rows) {
    if (!rows.length) return "";
    return '<tr class="crew-section crew-section--' + (STATUS[status] ? STATUS[status].key : "") + '">'
      + '<td colspan="7">' + esc(STATUS_LABEL[status] || status)
      + ' <span class="crew-section__n">' + rows.length + '명</span></td></tr>'
      + rows.map(crewRow).join("");
  }

  function tbodyHTML() {
    var base = filteredCrew(); // 장애여부·그룹·검색 필터 적용 (상태는 아래서 그룹핑)
    var order = crewStatusFilter === "전체" ? ["재직", "휴직", "퇴사"] : [crewStatusFilter];
    var out = order.map(function (s) {
      return crewSection(s, base.filter(function (c) { return c.status === s; }));
    }).join("");
    return out || '<tr><td colspan="7" class="muted" style="text-align:center;padding:36px">검색 결과가 없습니다</td></tr>';
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
    var roster = active + leave;                 // 해당 월 재직 총원 (재직 + 휴직, 퇴사 제외)
    var mo = d(TODAY).getMonth() + 1;            // 기준 월
    var yr = d(TODAY).getFullYear();             // 기준 연도

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Crew / Roster</p>'
      + '<h2>크루 목록</h2>'
      + '<p class="sub">팀 크루의 현황과 담당 업무를 한눈에. <span class="muted">행을 클릭하면 상세 정보를 볼 수 있어요.</span></p></div>'
      + '<button class="btn btn--primary" id="addCrewBtn">+ 크루 등록</button>'
      + '</div>';

    html += '<div class="stats">'
      + statCard("acid", roster, "명", "Total", mo + "월 기준 총 인원")
      + statCard("green", active, "명", "Active", "휴직 제외")
      + statCard("", leave, "명", "On leave", "현재 휴직")
      + statCard(out ? "warn" : "", out, "명", "Left", yr + "년 퇴사")
      + '</div>';

    html += '<div class="toolbar-row">'
      + '<div class="filter" id="crewStatusFilter">'
      + ["전체", "재직", "휴직", "퇴사"].map(function (s) {
          return '<button class="btn btn--sm btn--pill ' + (s === crewStatusFilter ? "is-on" : "") + '" data-s="' + s + '">' + s + '</button>';
        }).join("")
      + '</div>'
      + '<div class="filter filter--xs" id="crewDisFilter">'
      + ["전체", "비장애", "장애"].map(function (f) {
          return '<button class="btn btn--xs btn--pill ' + (f === crewDisFilter ? "is-on" : "") + '" data-f="' + f + '">' + f + '</button>';
        }).join("")
      + '</div>'
      + '<div class="filter filter--xs" id="crewGroupFilter">'
      + ["전체"].concat(CREW_GROUPS).map(function (g) {
          return '<button class="btn btn--xs btn--pill ' + (g === crewGroupFilter ? "is-on" : "") + '" data-g="' + g + '">' + g + '</button>';
        }).join("")
      + '</div>'
      + '<input class="searchbox" id="crewSearch" type="search" placeholder="이름 · 팀 · 담당업무 검색" value="' + esc(crewQuery) + '">'
      + '</div>';

    html += '<div class="table-wrap"><table class="crew-table"><thead><tr>'
      + '<th>크루</th><th>상태</th><th>입사일</th><th>근무지</th><th>장애유형</th><th>담당 업무</th><th>비고</th>'
      + '</tr></thead><tbody id="crewBody">' + tbodyHTML() + '</tbody></table></div>';

    view.innerHTML = html;
  }

  function statCard(mod, num, unit, label, sub) {
    return '<div class="stat' + (mod ? " stat--" + mod : "") + '"><div class="stat__num">' + num + '<small>' + unit + '</small></div>'
      + '<div class="stat__label">' + label + '</div>'
      + (sub ? '<div class="stat__sub">' + esc(sub) + '</div>' : '')
      + '</div>';
  }

  function disabilityBadge(c) {
    var isDisabled = c.disability === "장애";
    var label = isDisabled ? (c.disabilityType || "장애") : "비장애";
    return '<span class="badge ' + (isDisabled ? "badge--dis" : "badge--nodis") + '">' + esc(label) + '</span>';
  }

  function crewRow(c) {
    var g = groupOf(c.group);
    var st = STATUS[c.status] || STATUS["재직"];
    return '<tr data-id="' + esc(c.id || "") + '"' + (c.status === "퇴사" ? ' class="is-left"' : "") + '>'
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

    var html = '<div class="crew-detail">';
    html += '<button class="btn btn--sm" id="crewBackBtn">&larr; 목록으로</button>';

    html += '<div class="crew-detail__banner">'
      + '<div class="crew-detail__info">'
        + '<h2><i class="gdot gdot--lg" style="background:' + g.bg + '" title="' + esc(c.group || "미지정") + '"></i>' + esc(c.name) + '</h2>'
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
    if (tab === "interview") return crewInterviewBoard(c);
    if (tab === "attendance") return crewAttendanceBoard(c);
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

  /* ---------- 면담 기록 게시판 행 (크루 상세 탭 · 전체 목록 공용) ----------
     crewCell : 6열(전체 목록) 표에서 첫 행에만 넘기는 <td rowspan> HTML.
                생략하면(크루 상세 탭 · 그룹 내 이어지는 행) 크루 칸 없이 출력. */
  function interviewBoardRow(r, crewCell) {
    var cond = condOf(r.condition);
    var issueTag = r.type === "근무 이슈" ? '<span class="board__issue-tag" title="근무 이슈">issue</span> ' : '';
    var flags = "";
    if (r.followUp === "필요") flags += '<span class="board__flag board__flag--follow" title="' + esc(r.followUpNote || "후속 조치 필요") + '">후속</span>';
    if (r.privateNote) flags += '<span class="board__flag board__flag--private" title="비공개 메모">🔒</span>';
    return '<tr class="board__row" data-iv-id="' + esc(r.id || "") + '">'
      + (crewCell || '')
      + '<td class="board__date mono">' + fmtDotDate(r.date) + (r.time ? '<span class="board__time"> · ' + esc(r.time) + '</span>' : '') + '</td>'
      + '<td class="board__type">' + issueTag + esc(r.type) + '</td>'
      + '<td class="board__cond"><span class="board__conddot" style="background:' + cond.c + '"></span>' + esc(r.condition) + '</td>'
      + '<td class="board__content"><span class="board__ctext">' + esc(r.content || "—") + '</span></td>'
      + '<td class="board__flags">' + (flags || '<span class="muted">—</span>') + '</td>'
      + '</tr>';
  }

  /* 같은 크루의 기록이 2건 이상이면 하나의 그룹(rowspan)으로 묶어서 출력 */
  function groupedInterviewRowsHTML(rows) {
    var order = [];
    var map = {};
    rows.forEach(function (r) {
      var key = r.crewId || r.crewName || "—";
      if (!map[key]) { map[key] = { crewName: r.crewName, rows: [] }; order.push(key); }
      map[key].rows.push(r);
    });
    return order.map(function (key) {
      var g = map[key];
      return g.rows.map(function (r, i) {
        if (i !== 0) return interviewBoardRow(r);
        var crewCell = '<td class="board__crew"' + (g.rows.length > 1 ? ' rowspan="' + g.rows.length + '"' : '') + '>'
          + '<b>' + esc(g.crewName || "—") + '</b>'
          + (g.rows.length > 1 ? '<span class="board__crew__n">' + g.rows.length + '건</span>' : '')
          + '</td>';
        return interviewBoardRow(r, crewCell);
      }).join("");
    }).join("");
  }

  /* ---------- 크루 상세 · 면담기록 게시판 ---------- */
  function crewInterviewBoard(c) {
    var rows = (window.INTERVIEWS || []).filter(function (r) {
      return String(r.crewId) === String(c.id) || (r.crewName && r.crewName === c.name);
    }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.time || "") < (b.time || "") ? 1 : -1;
    });

    var head = '<div class="board__head">'
      + '<h3 class="board__title">면담 기록 <span class="chip-mono">' + rows.length + '건</span></h3>'
      + '<button type="button" class="btn btn--sm btn--primary" id="crewAddInterviewBtn">+ 면담 기록</button>'
      + '</div>';

    if (!rows.length) {
      return '<div class="board">' + head
        + '<div class="board__empty">아직 등록된 면담 기록이 없습니다.<br><span class="muted">우측 상단 <b style="color:var(--accent-text)">+ 면담 기록</b>으로 첫 기록을 남겨보세요.</span></div>'
        + '</div>';
    }

    var body = rows.map(function (r) { return interviewBoardRow(r); }).join("");

    return '<div class="board">' + head
      + '<div class="board__scroll"><table class="board__table"><thead><tr>'
      + '<th>날짜</th><th>유형</th><th>컨디션</th><th>내용</th><th>표시</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>'
      + '</div>';
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
      '<div class="modal__backdrop"></div>'
      + '<div class="modal__card modal__card--crew" role="dialog" aria-modal="true" aria-label="크루 등록">'
      + '<div class="modal__head"><h3 id="crewModalTitle">신규 크루 등록</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<form id="crewForm">'
      + '<label class="fld"><span>이름</span><input type="text" name="name" maxlength="20" required placeholder="이름"></label>'
      + '<div class="fld-row--3">'
        + '<label class="fld"><span>직책</span><input type="text" name="role" maxlength="20" placeholder="크루 / 매니저 …"></label>'
        + '<label class="fld"><span>팀 표기 <em>(선택)</em></span><input type="text" name="team" maxlength="20" placeholder="닉네임 등"></label>'
        + '<label class="fld"><span>업무 그룹</span><select name="group">' + CREW_GROUPS.map(function (g) { return '<option value="' + g + '">' + g + '</option>'; }).join("") + '</select></label>'
      + '</div>'
      + '<div class="fld-row--3">'
        + '<label class="fld"><span>상태</span><select name="status">' + CREW_STATUSES.map(function (s) { return '<option value="' + s + '">' + s + '</option>'; }).join("") + '</select></label>'
        + '<label class="fld"><span>계약현황</span><select name="contractType">' + CREW_CONTRACTS.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join("") + '</select></label>'
        + '<label class="fld"><span>업무시간 <em>(선택)</em></span><input type="text" name="workHours" placeholder="09:00-18:00(8h)"></label>'
      + '</div>'
      + '<div class="fld-row--3">'
        + '<label class="fld"><span>입사일</span><input type="date" name="joinDate"></label>'
        + '<label class="fld"><span>연락처</span><input type="text" name="phone" placeholder="010-0000-0000"></label>'
        + '<label class="fld"><span>생년월일 <em>(선택)</em></span><input type="date" name="birthDate"></label>'
      + '</div>'
      + '<div class="fld-row--3">'
        + '<label class="fld"><span>비상연락처 <em>(선택)</em></span><input type="text" name="emergencyContact" placeholder="010-0000-0000"></label>'
        + '<label class="fld"><span>장애여부</span><select name="disability">' + CREW_DISABILITY.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join("") + '</select></label>'
        + '<label class="fld"><span>장애유형 <em>(선택)</em></span><input type="text" name="disabilityType" placeholder="발달장애 등"></label>'
      + '</div>'
      + '<div class="fld-row--3">'
        + '<label class="fld"><span>근무지</span><input type="text" name="site" maxlength="30" placeholder="판교 오아시스"></label>'
        + '<label class="fld"><span>출입증번호 <em>(선택)</em></span><input type="text" name="badgeNumber" placeholder="O0000"></label>'
        + '<label class="fld"><span>담당 업무 <em>(쉼표로 구분)</em></span><input type="text" name="duties" placeholder="발주, 온보딩"></label>'
      + '</div>'
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
    // 작성 중 실수로 닫히지 않도록 배경 클릭·ESC 닫기는 비활성화 (X·취소 버튼으로만 닫힘)
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
     INTERVIEW · 면담 & 근무 기록
     ====================================================== */
  var CURRENT_USER = "제이미";
  var INTERVIEW_TYPES = ["정기 면담", "수시 면담", "온보딩 면담", "근무 관련", "근무 이슈", "고충 처리", "기타"];
  var CONDITIONS = [
    { key: "좋음",   emoji: "😊", c: "var(--green)" },
    { key: "보통",   emoji: "😐", c: "var(--slate)" },
    { key: "우려됨", emoji: "😟", c: "var(--red)" },
  ];
  function condOf(k) { for (var i = 0; i < CONDITIONS.length; i++) if (CONDITIONS[i].key === k) return CONDITIONS[i]; return CONDITIONS[1]; }
  var interviewCond = "전체";
  var interviewQuery = "";

  function fmtDotDate(iso) {
    if (!iso) return "—";
    var p = iso.split("-");
    if (p.length < 3) return iso;
    return p[0] + "." + p[1] + "." + p[2] + " <small>" + WD[wd(iso)] + "</small>";
  }

  function filteredInterviews() {
    var list = (window.INTERVIEWS || []).slice();
    list = list.filter(function (r) {
      if (interviewCond !== "전체" && r.condition !== interviewCond) return false;
      if (interviewQuery) {
        var hay = (r.crewName + r.type + r.content + r.recorder).toLowerCase();
        if (hay.indexOf(interviewQuery.toLowerCase()) === -1) return false;
      }
      return true;
    });
    // 최신순 (일자 desc, 시간 desc)
    return list.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.time || "") < (b.time || "") ? 1 : -1;
    });
  }

  function renderInterview() {
    var all = window.INTERVIEWS || [];
    var followCnt = all.filter(function (r) { return r.followUp === "필요"; }).length;
    var worryCnt = all.filter(function (r) { return r.condition === "우려됨"; }).length;

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Crew / Interview</p>'
      + '<h2>면담 &amp; 근무기록</h2>'
      + '<p class="sub">크루 면담과 근무 관련 기록을 시간순으로. <span class="muted">🔒 비공개 메모는 기록자 참고용입니다.</span></p></div>'
      + '<button class="btn btn--primary" id="addInterviewBtn">+ 기록 등록</button>'
      + '</div>';

    html += '<div class="stats stats--3">'
      + statCard("acid", all.length, "건", "Total")
      + statCard("", followCnt, "건", "후속조치 필요")
      + statCard(worryCnt ? "warn" : "", worryCnt, "건", "우려됨")
      + '</div>';

    html += '<div class="toolbar-row">'
      + '<div class="filter" id="ivCondFilter">'
      + ["전체"].concat(CONDITIONS.map(function (c) { return c.key; })).map(function (f) {
          return '<button class="btn btn--sm btn--pill ' + (f === interviewCond ? "is-on" : "") + '" data-c="' + f + '">' + f + '</button>';
        }).join("")
      + '</div>'
      + '<input class="searchbox" id="ivSearch" type="search" placeholder="크루 · 유형 · 내용 검색" value="' + esc(interviewQuery) + '">'
      + '</div>';

    var rows = filteredInterviews();
    html += '<div class="board">'
      + '<div class="board__scroll"><table class="board__table board__table--iv"><thead><tr>'
      + '<th>크루</th><th>날짜</th><th>유형</th><th>컨디션</th><th>내용</th><th>표시</th>'
      + '</tr></thead><tbody id="ivBody">'
      + (rows.length ? groupedInterviewRowsHTML(rows)
          : '<tr><td colspan="6" class="board__empty">기록이 없습니다. <b style="color:var(--accent-text)">+ 기록 등록</b>으로 첫 면담을 남겨보세요.</td></tr>')
      + '</tbody></table></div>'
      + '</div>';

    view.innerHTML = html;
  }

  /* 면담 저장/삭제 후: 크루 상세를 보고 있으면 상세로, 아니면 면담 목록으로 갱신 */
  function rerenderAfterInterview() {
    if (crewDetailId) renderCrew(); else renderInterview();
  }

  /* ---------- 면담 기록 등록/수정 모달 ---------- */
  function openInterviewModal(prefill) {
    var el = document.getElementById("interviewModal");
    if (!el) { el = buildInterviewModal(); document.body.appendChild(el); }
    var form = el.querySelector("form");
    form.reset();
    var editing = !!(prefill && prefill.id);
    form.dataset.id = editing ? prefill.id : "";
    el.querySelector("#interviewModalTitle").textContent = editing ? "면담 · 근무 기록 수정" : "면담 · 근무 기록 등록";
    el.querySelector("#interviewDelBtn").hidden = !editing;

    // 크루 셀렉트 옵션 재구성 (현재 크루 목록 반영)
    var sel = form.crewId;
    sel.innerHTML = '<option value="">크루 선택</option>' + (window.CREW || []).map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.name) + (c.group ? ' · ' + esc(c.group) : '') + '</option>';
    }).join("");

    form.crewId.value = (prefill && prefill.crewId) || "";
    form.date.value = (prefill && prefill.date) || TODAY;
    form.time.value = (prefill && prefill.time) || "";
    form.type.value = (prefill && prefill.type) || "정기 면담";
    form.content.value = (prefill && prefill.content) || "";
    form.followUpNote.value = (prefill && prefill.followUpNote) || "";
    form.privateNote.value = (prefill && prefill.privateNote) || "";
    form.querySelector("#ivRecorder").textContent = (prefill && prefill.recorder) || CURRENT_USER;

    // 컨디션 세그먼트
    var cond = (prefill && prefill.condition) || "보통";
    form.condition.value = cond;
    Array.prototype.forEach.call(el.querySelectorAll(".ivseg__btn"), function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-cond") === cond);
    });

    // 후속조치 토글 → 조치 내용 노출
    var need = !!(prefill && prefill.followUp === "필요");
    form.followUp.checked = need;
    el.querySelector("#ivFollowWrap").hidden = !need;

    el.hidden = false;
    setTimeout(function () { form.crewId.focus(); }, 30);
  }
  function closeInterviewModal() {
    var el = document.getElementById("interviewModal");
    if (el) el.hidden = true;
  }

  function buildInterviewModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "interviewModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop"></div>'
      + '<div class="modal__card modal__card--iv" role="dialog" aria-modal="true" aria-label="면담 기록 등록">'
      + '<div class="modal__head"><h3 id="interviewModalTitle">면담 · 근무 기록 등록</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<form id="interviewForm">'
      + '<div class="fld-row">'
        + '<label class="fld"><span>크루 <em>*</em></span><select name="crewId" required></select></label>'
        + '<label class="fld"><span>일자 <em>*</em></span><input type="date" name="date" required></label>'
      + '</div>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>시간 <em>(선택)</em></span><input type="time" name="time"></label>'
        + '<label class="fld"><span>유형</span><select name="type">'
          + INTERVIEW_TYPES.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join("")
        + '</select></label>'
      + '</div>'
      + '<div class="fld-row">'
        + '<div class="fld"><span>크루 컨디션</span>'
          + '<input type="hidden" name="condition" value="보통">'
          + '<div class="ivseg">' + CONDITIONS.map(function (c) {
              return '<button type="button" class="ivseg__btn" data-cond="' + c.key + '" style="--c:' + c.c + '">' + c.key + '</button>';
            }).join("") + '</div>'
        + '</div>'
        + '<div class="fld"><span>기록자</span><div class="iv-recorder" id="ivRecorder">' + esc(CURRENT_USER) + '</div></div>'
      + '</div>'
      + '<label class="fld"><span>주요 내용 <em>*</em></span><textarea name="content" rows="5" required placeholder="면담 내용, 주요 발언, 관찰 사항 등을 기록하세요…"></textarea></label>'
      + '<label class="fld fld--check fld--check-box"><input type="checkbox" name="followUp"><span>후속 조치 필요 <em>— 체크하면 조치 내용 입력란이 열립니다</em></span></label>'
      + '<label class="fld" id="ivFollowWrap" hidden><span>조치 내용</span><textarea name="followUpNote" rows="2" placeholder="필요한 후속 조치를 적어주세요…"></textarea></label>'
      + '<label class="fld fld--private"><span>🔒 비공개 메모 <em>— 기록자 참고용 (민감 내용용)</em></span><textarea name="privateNote" rows="2" placeholder="공식 기록에 남기기 어려운 내용…"></textarea></label>'
      + '<div class="modal__foot">'
        + '<button type="button" class="btn btn--danger" id="interviewDelBtn" hidden>삭제</button>'
        + '<div class="modal__spacer"></div>'
        + '<button type="button" class="btn" data-close>취소</button>'
        + '<button type="submit" class="btn btn--primary">저장</button>'
      + '</div>'
      + '</form>'
      + '</div>';

    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) { closeInterviewModal(); return; }
      var segBtn = ev.target.closest(".ivseg__btn");
      if (segBtn) {
        var form = wrap.querySelector("form");
        form.condition.value = segBtn.getAttribute("data-cond");
        Array.prototype.forEach.call(wrap.querySelectorAll(".ivseg__btn"), function (b) { b.classList.toggle("is-on", b === segBtn); });
        return;
      }
    });
    // 작성 중 실수로 닫히지 않도록 배경 클릭·ESC 닫기는 비활성화 (X·취소 버튼으로만 닫힘)
    wrap.querySelector('input[name="followUp"]').addEventListener("change", function (ev) {
      wrap.querySelector("#ivFollowWrap").hidden = !ev.target.checked;
    });
    wrap.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var content = f.content.value.trim();
      var crewId = f.crewId.value;
      if (!crewId) { alert("크루를 선택해주세요."); f.crewId.focus(); return; }
      if (!content) { f.content.focus(); return; }
      var crew = findById(window.CREW || [], crewId);
      var id = f.dataset.id;
      var rec = {
        id: id || newId("iv"),
        date: f.date.value,
        time: f.time.value || "",
        crewId: crewId,
        crewName: crew ? crew.name : "",
        type: f.type.value,
        condition: f.condition.value || "보통",
        recorder: (id && findById(window.INTERVIEWS || [], id) || {}).recorder || CURRENT_USER,
        content: content,
        followUp: f.followUp.checked ? "필요" : "",
        followUpNote: f.followUp.checked ? f.followUpNote.value.trim() : "",
        privateNote: f.privateNote.value.trim(),
      };
      if (!window.INTERVIEWS) window.INTERVIEWS = [];
      var idx = id ? indexById(window.INTERVIEWS, id) : -1;
      if (idx > -1) window.INTERVIEWS[idx] = rec; else window.INTERVIEWS.push(rec);
      // 주의: 봉투의 type("interview")과 면담 유형(rec.type)이 충돌하지 않도록 유형은 ivType 으로 전송
      saveToSheet({
        type: "interview", action: id ? "update" : "add",
        id: rec.id, date: rec.date, time: rec.time,
        crewId: rec.crewId, crewName: rec.crewName,
        ivType: rec.type, condition: rec.condition, recorder: rec.recorder,
        content: rec.content, followUp: rec.followUp, followUpNote: rec.followUpNote, privateNote: rec.privateNote
      });
      closeInterviewModal();
      rerenderAfterInterview();
    });
    wrap.querySelector("#interviewDelBtn").addEventListener("click", function () {
      var id = wrap.querySelector("form").dataset.id;
      if (!id) return;
      if (!confirm("이 기록을 삭제할까요?")) return;
      window.INTERVIEWS = (window.INTERVIEWS || []).filter(function (r) { return String(r.id) !== String(id); });
      saveToSheet({ type: "interview", action: "delete", id: id });
      closeInterviewModal();
      rerenderAfterInterview();
    });
    return wrap;
  }

  /* ======================================================
     ATTENDANCE · 근태 기록 (지각 · 결근 · 조퇴 · 병가 · 기타)
     ====================================================== */
  var ATT_KINDS = [
    { key: "지각", c: "var(--amber)" },
    { key: "결근", c: "var(--red)" },
    { key: "조퇴", c: "var(--slate)" },
    { key: "병가", c: "#60a5fa" },
    { key: "기타", c: "#b39dff" },
  ];
  function attKindOf(k) { for (var i = 0; i < ATT_KINDS.length; i++) if (ATT_KINDS[i].key === k) return ATT_KINDS[i]; return ATT_KINDS[0]; }
  var attKindFilter = "전체";
  var attQuery = "";
  var attAnchor = TODAY; // 근태 기록 목록에서 보고 있는 기준 월

  function attMonthLabel(iso) { var p = (iso || attAnchor).split("-"); return +p[0] + "년 " + +p[1] + "월"; }

  function attendanceInMonth() {
    var ym = attAnchor.slice(0, 7);
    return (window.ATTENDANCE || []).filter(function (r) { return (r.date || "").slice(0, 7) === ym; });
  }

  function filteredAttendance() {
    var list = attendanceInMonth();
    list = list.filter(function (r) {
      if (attKindFilter !== "전체" && r.kind !== attKindFilter) return false;
      if (attQuery) {
        var hay = (r.crewName + r.kind + r.reason + r.recorder).toLowerCase();
        if (hay.indexOf(attQuery.toLowerCase()) === -1) return false;
      }
      return true;
    });
    return list.sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.time || "") < (b.time || "") ? 1 : -1;
    });
  }

  /* ---------- 근태 기록 게시판 행 (크루 상세 탭 · 전체 목록 공용) ---------- */
  function attendanceBoardRow(r, showCrew) {
    var kind = attKindOf(r.kind);
    return '<tr class="board__row" data-att-id="' + esc(r.id || "") + '">'
      + (showCrew ? '<td class="board__crew"><b>' + esc(r.crewName || "—") + '</b></td>' : '')
      + '<td class="board__date mono">' + fmtDotDate(r.date) + '</td>'
      + '<td class="board__cond"><span class="board__conddot" style="background:' + kind.c + '"></span>' + esc(r.kind) + '</td>'
      + '<td class="board__type mono">' + esc(r.time || "—") + '</td>'
      + '<td class="board__content"><span class="board__ctext">' + esc(r.reason || "—") + '</span></td>'
      + '<td class="board__recorder muted">' + esc(r.recorder || "—") + '</td>'
      + '</tr>';
  }

  /* ---------- 크루 상세 · 근태 기록 게시판 ---------- */
  function crewAttendanceBoard(c) {
    var rows = (window.ATTENDANCE || []).filter(function (r) {
      return String(r.crewId) === String(c.id) || (r.crewName && r.crewName === c.name);
    }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (a.time || "") < (b.time || "") ? 1 : -1;
    });

    var head = '<div class="board__head">'
      + '<h3 class="board__title">근태 기록 <span class="chip-mono">' + rows.length + '건</span></h3>'
      + '<button type="button" class="btn btn--sm btn--primary" id="crewAddAttendanceBtn">+ 근태 기록</button>'
      + '</div>';

    if (!rows.length) {
      return '<div class="board">' + head
        + '<div class="board__empty">아직 등록된 근태 기록이 없습니다.<br><span class="muted">우측 상단 <b style="color:var(--accent-text)">+ 근태 기록</b>으로 기록해보세요.</span></div>'
        + '</div>';
    }

    var body = rows.map(function (r) { return attendanceBoardRow(r, false); }).join("");

    return '<div class="board">' + head
      + '<div class="board__scroll"><table class="board__table"><thead><tr>'
      + '<th>날짜</th><th>구분</th><th>시간</th><th>사유</th><th>기록자</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>'
      + '</div>';
  }

  function renderAttendance() {
    var all = attendanceInMonth();

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Crew / Attendance</p>'
      + '<h2>근태 기록</h2>'
      + '<p class="sub">크루의 지각 · 결근 · 조퇴 · 병가 등 근태 기록을 시간순으로. <span class="muted">구분 카드를 누르면 해당 인원을 볼 수 있어요.</span></p></div>'
      + '<button class="btn btn--primary" id="addAttendanceBtn">+ 근태 기록</button>'
      + '</div>';

    html += '<div class="at-nav">'
      + '<button class="iconbtn" data-at-nav="-1" aria-label="이전 달">&larr;</button>'
      + '<span class="cal-toolbar__range">' + attMonthLabel() + '</span>'
      + '<button class="iconbtn" data-at-nav="1" aria-label="다음 달">&rarr;</button>'
      + '</div>';

    html += '<div class="stats">'
      + statCard("acid", all.length, "건", "Total")
      + ATT_KINDS.map(function (k) {
          var n = all.filter(function (r) { return r.kind === k.key; }).length;
          return '<div class="stat stat--clickable' + (n ? " stat--warn" : "") + '" data-kind="' + esc(k.key) + '">'
            + '<div class="stat__num">' + n + '<small>건</small></div>'
            + '<div class="stat__label">' + esc(k.key) + '</div>'
            + '</div>';
        }).join("")
      + '</div>';

    html += '<div class="toolbar-row">'
      + '<div class="filter" id="atKindFilter">'
      + ["전체"].concat(ATT_KINDS.map(function (k) { return k.key; })).map(function (f) {
          return '<button class="btn btn--sm btn--pill ' + (f === attKindFilter ? "is-on" : "") + '" data-k="' + f + '">' + f + '</button>';
        }).join("")
      + '</div>'
      + '<input class="searchbox" id="atSearch" type="search" placeholder="크루 · 사유 검색" value="' + esc(attQuery) + '">'
      + '</div>';

    var rows = filteredAttendance();
    html += '<div class="board">'
      + '<div class="board__scroll"><table class="board__table board__table--iv board__table--at"><thead><tr>'
      + '<th>크루</th><th>날짜</th><th>구분</th><th>시간</th><th>사유</th><th>기록자</th>'
      + '</tr></thead><tbody id="atBody">'
      + (rows.length ? rows.map(function (r) { return attendanceBoardRow(r, true); }).join("")
          : '<tr><td colspan="6" class="board__empty">기록이 없습니다. <b style="color:var(--accent-text)">+ 근태 기록</b>으로 첫 기록을 남겨보세요.</td></tr>')
      + '</tbody></table></div>'
      + '</div>';

    view.innerHTML = html;
  }

  /* 근태 저장/삭제 후: 크루 상세를 보고 있으면 상세로, 아니면 근태 목록으로 갱신 */
  function rerenderAfterAttendance() {
    if (crewDetailId) renderCrew(); else renderAttendance();
  }

  /* ---------- 근태 기록 등록/수정 모달 ---------- */
  function openAttendanceModal(prefill) {
    var el = document.getElementById("attendanceModal");
    if (!el) { el = buildAttendanceModal(); document.body.appendChild(el); }
    var form = el.querySelector("form");
    form.reset();
    var editing = !!(prefill && prefill.id);
    form.dataset.id = editing ? prefill.id : "";
    el.querySelector("#attendanceModalTitle").textContent = editing ? "근태 기록 수정" : "근태 기록 등록";
    el.querySelector("#attendanceDelBtn").hidden = !editing;

    var sel = form.crewId;
    sel.innerHTML = '<option value="">크루 선택</option>' + (window.CREW || []).map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.name) + (c.group ? ' · ' + esc(c.group) : '') + '</option>';
    }).join("");

    form.crewId.value = (prefill && prefill.crewId) || "";
    form.date.value = (prefill && prefill.date) || TODAY;
    form.time.value = (prefill && prefill.time) || "";
    form.reason.value = (prefill && prefill.reason) || "";

    var kind = (prefill && prefill.kind) || "지각";
    form.kind.value = kind;
    Array.prototype.forEach.call(el.querySelectorAll(".ivseg__btn"), function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-kind") === kind);
    });

    el.hidden = false;
    setTimeout(function () { form.crewId.focus(); }, 30);
  }
  function closeAttendanceModal() {
    var el = document.getElementById("attendanceModal");
    if (el) el.hidden = true;
  }

  function buildAttendanceModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "attendanceModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop"></div>'
      + '<div class="modal__card modal__card--iv" role="dialog" aria-modal="true" aria-label="근태 기록 등록">'
      + '<div class="modal__head"><h3 id="attendanceModalTitle">근태 기록 등록</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<form id="attendanceForm">'
      + '<div class="fld-row">'
        + '<label class="fld"><span>크루 <em>*</em></span><select name="crewId" required></select></label>'
        + '<label class="fld"><span>일자 <em>*</em></span><input type="date" name="date" required></label>'
      + '</div>'
      + '<div class="fld"><span>구분</span>'
        + '<input type="hidden" name="kind" value="지각">'
        + '<div class="ivseg">' + ATT_KINDS.map(function (k) {
            return '<button type="button" class="ivseg__btn" data-kind="' + k.key + '" style="--c:' + k.c + '">' + k.key + '</button>';
          }).join("") + '</div>'
      + '</div>'
      + '<label class="fld"><span>시간 <em>(선택)</em></span><input type="time" name="time"></label>'
      + '<label class="fld"><span>사유 <em>(선택)</em></span><input type="text" name="reason" maxlength="80" placeholder="사유를 입력하세요…"></label>'
      + '<div class="modal__foot">'
        + '<button type="button" class="btn btn--danger" id="attendanceDelBtn" hidden>삭제</button>'
        + '<div class="modal__spacer"></div>'
        + '<button type="button" class="btn" data-close>취소</button>'
        + '<button type="submit" class="btn btn--primary">저장</button>'
      + '</div>'
      + '</form>'
      + '</div>';

    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) { closeAttendanceModal(); return; }
      var segBtn = ev.target.closest(".ivseg__btn");
      if (segBtn) {
        var form = wrap.querySelector("form");
        form.kind.value = segBtn.getAttribute("data-kind");
        Array.prototype.forEach.call(wrap.querySelectorAll(".ivseg__btn"), function (b) { b.classList.toggle("is-on", b === segBtn); });
        return;
      }
    });
    wrap.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var crewId = f.crewId.value;
      if (!crewId) { alert("크루를 선택해주세요."); f.crewId.focus(); return; }
      var crew = findById(window.CREW || [], crewId);
      var id = f.dataset.id;
      var rec = {
        id: id || newId("at"),
        date: f.date.value,
        time: f.time.value || "",
        crewId: crewId,
        crewName: crew ? crew.name : "",
        kind: f.kind.value || "지각",
        reason: f.reason.value.trim(),
        recorder: (id && findById(window.ATTENDANCE || [], id) || {}).recorder || CURRENT_USER,
      };
      if (!window.ATTENDANCE) window.ATTENDANCE = [];
      var idx = id ? indexById(window.ATTENDANCE, id) : -1;
      if (idx > -1) window.ATTENDANCE[idx] = rec; else window.ATTENDANCE.push(rec);
      saveToSheet({
        type: "attendance", action: id ? "update" : "add",
        id: rec.id, date: rec.date, time: rec.time,
        crewId: rec.crewId, crewName: rec.crewName,
        kind: rec.kind, reason: rec.reason, recorder: rec.recorder
      });
      closeAttendanceModal();
      rerenderAfterAttendance();
    });
    wrap.querySelector("#attendanceDelBtn").addEventListener("click", function () {
      var id = wrap.querySelector("form").dataset.id;
      if (!id) return;
      if (!confirm("이 기록을 삭제할까요?")) return;
      window.ATTENDANCE = (window.ATTENDANCE || []).filter(function (r) { return String(r.id) !== String(id); });
      saveToSheet({ type: "attendance", action: "delete", id: id });
      closeAttendanceModal();
      rerenderAfterAttendance();
    });
    return wrap;
  }

  /* ---------- 근태 구분별 인원 팝업 (게시판 형식, 읽기 전용) ---------- */
  function openAttendanceKindModal(kind) {
    var el = document.getElementById("attendanceKindModal");
    if (!el) { el = buildAttendanceKindModal(); document.body.appendChild(el); }

    var rows = attendanceInMonth().filter(function (r) { return r.kind === kind; })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (a.time || "") < (b.time || "") ? 1 : -1;
      });

    el.querySelector("#akModalTitle").textContent = kind + " · " + attMonthLabel();
    el.querySelector("#akModalCount").textContent = rows.length + "건";
    el.querySelector("#akModalBody").innerHTML = rows.length
      ? rows.map(function (r) {
          return '<tr>'
            + '<td class="board__crew"><b>' + esc(r.crewName || "—") + '</b></td>'
            + '<td class="board__date mono">' + fmtDotDate(r.date) + '</td>'
            + '<td class="board__type mono">' + esc(r.time || "—") + '</td>'
            + '<td class="board__content"><span class="board__ctext">' + esc(r.reason || "—") + '</span></td>'
            + '</tr>';
        }).join("")
      : '<tr><td colspan="4" class="board__empty">해당 월에 기록이 없습니다.</td></tr>';

    el.hidden = false;
  }
  function closeAttendanceKindModal() {
    var el = document.getElementById("attendanceKindModal");
    if (el) el.hidden = true;
  }
  function buildAttendanceKindModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "attendanceKindModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop" data-close></div>'
      + '<div class="modal__card modal__card--iv" role="dialog" aria-modal="true" aria-label="근태 구분별 인원">'
      + '<div class="modal__head"><h3><span id="akModalTitle"></span> <span class="chip-mono" id="akModalCount"></span></h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<div class="board__scroll"><table class="board__table"><thead><tr>'
      + '<th>크루</th><th>날짜</th><th>시간</th><th>사유</th>'
      + '</tr></thead><tbody id="akModalBody"></tbody></table></div>'
      + '</div>';
    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) closeAttendanceKindModal();
    });
    return wrap;
  }

  /* ======================================================
     DASHBOARD (placeholder)
     ====================================================== */
  /* 장애유형 팔레트 (감각적 · 애시드 라임 기준 조화) */
  var TYPE_PALETTE = ["#c6ff2e", "#4ade80", "#60a5fa", "#b39dff", "#f472b6", "#fb923c", "#f0b429", "#22d3ee", "#94a3b8"];

  /** 도넛 SVG 생성 — segments: [{label,value,color}] */
  function donutSVG(segments, total) {
    var r = 54, cx = 72, cy = 72, sw = 18;
    var C = 2 * Math.PI * r;
    var GAP = total > 0 ? Math.min(C * 0.012, 6) : 0; // 세그먼트 사이 미세 간격
    var offset = 0;
    var live = segments.filter(function (s) { return s.value > 0; });
    var arcs = live.map(function (s) {
      var frac = s.value / total;
      var len = Math.max(frac * C - GAP, 0.5);
      var el = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none"'
        + ' stroke="' + s.color + '" stroke-width="' + sw + '"'
        + ' stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '"'
        + ' stroke-dashoffset="' + (-offset).toFixed(2) + '"'
        + ' stroke-linecap="round"'
        + ' transform="rotate(-90 ' + cx + ' ' + cy + ')"></circle>';
      offset += frac * C;
      return el;
    }).join("");
    var track = '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--line-soft)" stroke-width="' + sw + '"></circle>';
    return '<svg class="donut" viewBox="0 0 144 144" role="img" aria-label="장애 · 비장애 비율">'
      + track + arcs
      + '<text class="donut__num" x="72" y="70" text-anchor="middle">' + total + '</text>'
      + '<text class="donut__unit" x="72" y="90" text-anchor="middle">전체 크루</text>'
      + '</svg>';
  }

  function pct(n, total) { return total > 0 ? (Math.round((n / total) * 1000) / 10) : 0; }

  function renderDashboard() {
    var crew = (window.CREW || []).filter(function (c) { return c.status !== "퇴사"; });
    var disabled = crew.filter(function (c) { return c.disability === "장애"; });
    var nondis = crew.filter(function (c) { return c.disability === "비장애"; });
    var other = crew.length - disabled.length - nondis.length;

    // 장애유형 집계
    var typeMap = {};
    disabled.forEach(function (c) {
      var t = (c.disabilityType || "").trim() || "미분류";
      typeMap[t] = (typeMap[t] || 0) + 1;
    });
    var types = Object.keys(typeMap).map(function (k) { return { label: k, value: typeMap[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
    var typeMax = types.reduce(function (m, t) { return Math.max(m, t.value); }, 0);

    var donutSegs = [
      { label: "장애", value: disabled.length, color: "var(--accent)" },
      { label: "비장애", value: nondis.length, color: "var(--slate)" },
    ];
    if (other > 0) donutSegs.push({ label: "미분류", value: other, color: "var(--line)" });

    var legend = donutSegs.map(function (s) {
      return '<li class="dleg__row">'
        + '<span class="dleg__dot" style="background:' + s.color + '"></span>'
        + '<span class="dleg__label">' + esc(s.label) + '</span>'
        + '<span class="dleg__val mono">' + s.value + '<small>명</small></span>'
        + '<span class="dleg__pct mono">' + pct(s.value, crew.length) + '%</span>'
        + '</li>';
    }).join("");

    var typeRows = types.length ? types.map(function (t, i) {
      var color = TYPE_PALETTE[i % TYPE_PALETTE.length];
      var w = typeMax > 0 ? Math.round((t.value / typeMax) * 100) : 0;
      return '<div class="tbar">'
        + '<span class="tbar__label">' + esc(t.label) + '</span>'
        + '<span class="tbar__track"><span class="tbar__fill" style="width:' + w + '%;background:' + color + '"></span></span>'
        + '<span class="tbar__val mono">' + t.value + '<small>명</small></span>'
        + '</div>';
    }).join("") : '<p class="muted" style="margin:8px 2px">— 장애 크루 데이터가 없습니다</p>';

    var html = '';
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Main / Dashboard</p>'
      + '<h2>대시보드</h2>'
      + '<p class="sub">크루 구성과 장애유형 분포를 한눈에.</p></div>'
      + '</div>';

    html += '<div class="dash-grid">'
      // 도넛 카드
      + '<section class="dash-card dash-card--donut">'
        + '<div class="summary__head"><h3>장애 · 비장애 현황</h3>'
          + '<span class="chip-mono">' + crew.length + '명</span></div>'
        + '<div class="donut-wrap">'
          + donutSVG(donutSegs, crew.length)
          + '<ul class="dleg">' + legend + '</ul>'
        + '</div>'
      + '</section>'
      // 유형 카드
      + '<section class="dash-card">'
        + '<div class="summary__head"><h3>장애유형별 분포</h3>'
          + '<span class="chip-mono">' + disabled.length + '명</span></div>'
        + '<div class="tbars">' + typeRows + '</div>'
      + '</section>'
      + '</div>';

    view.innerHTML = html;
  }

  /* ======================================================
     ROUTER
     ====================================================== */
  var VIEWS = {
    dashboard:   { title: "DASHBOARD", render: renderDashboard },
    crew:        { title: "CREW", render: renderCrew },
    interview:   { title: "INTERVIEW", render: renderInterview },
    attendance:  { title: "ATTENDANCE", render: renderAttendance },
    schedule:    { title: "SCHEDULE", render: renderSchedule },
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
      if (ev.target.closest("#addInterviewBtn")) { openInterviewModal(null); return; }

      var ivCondBtn = ev.target.closest("#ivCondFilter button[data-c]");
      if (ivCondBtn) { interviewCond = ivCondBtn.getAttribute("data-c"); renderInterview(); return; }

      if (ev.target.closest("#addAttendanceBtn")) { openAttendanceModal(null); return; }

      var atKindBtn = ev.target.closest("#atKindFilter button[data-k]");
      if (atKindBtn) { attKindFilter = atKindBtn.getAttribute("data-k"); renderAttendance(); return; }

      var atNavBtn = ev.target.closest(".at-nav .iconbtn[data-at-nav]");
      if (atNavBtn) { attAnchor = addMonths(attAnchor, +atNavBtn.getAttribute("data-at-nav")); renderAttendance(); return; }

      var atStatBtn = ev.target.closest(".stat--clickable[data-kind]");
      if (atStatBtn) { openAttendanceKindModal(atStatBtn.getAttribute("data-kind")); return; }

      var mchip = ev.target.closest(".mchip[data-id]");
      if (mchip) { var mev = findById(window.SCHEDULE, mchip.getAttribute("data-id")); if (mev) openEventModal(mev); return; }

      var mmore = ev.target.closest(".mchip--more[data-date]");
      if (mmore) { schedMode = "week"; schedAnchor = mmore.getAttribute("data-date"); renderSchedule(); return; }

      if (ev.target.closest("#addIssueBtn")) { openIssueModal(null); return; }

      var issueEditBtn = ev.target.closest(".issue-act--edit[data-id]");
      if (issueEditBtn) { var iev = findById(window.SUMMARY.issues, issueEditBtn.getAttribute("data-id")); if (iev) openIssueModal(iev); return; }

      var issueDelBtn = ev.target.closest(".issue-act--del[data-id]");
      if (issueDelBtn) { deleteIssueQuick(issueDelBtn.getAttribute("data-id")); return; }

      if (ev.target.closest("#addPointBtn")) { openPointModal(null); return; }

      var pointEditBtn = ev.target.closest(".point-act--edit[data-id]");
      if (pointEditBtn) { var pev = findById(window.SUMMARY.points || [], pointEditBtn.getAttribute("data-id")); if (pev) openPointModal(pev); return; }

      var pointDelBtn = ev.target.closest(".point-act--del[data-id]");
      if (pointDelBtn) { deletePointQuick(pointDelBtn.getAttribute("data-id")); return; }

      var nextBtn = ev.target.closest(".evt__act--next[data-id]");
      if (nextBtn) { moveEventToNextDay(nextBtn.getAttribute("data-id")); return; }

      var delBtn = ev.target.closest(".evt__act--del[data-id]");
      if (delBtn) { deleteEventQuick(delBtn.getAttribute("data-id")); return; }

      var toggleBtn = ev.target.closest(".evt__toggle[data-id]");
      if (toggleBtn) { toggleEventDone(toggleBtn.getAttribute("data-id")); return; }

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

      if (ev.target.closest("#crewAddInterviewBtn")) {
        var addC = findById(window.CREW, crewDetailId);
        openInterviewModal(addC ? { crewId: addC.id } : null);
        return;
      }

      var boardRow = ev.target.closest(".board__row[data-iv-id]");
      if (boardRow) { var bIv = findById(window.INTERVIEWS || [], boardRow.getAttribute("data-iv-id")); if (bIv) openInterviewModal(bIv); return; }

      if (ev.target.closest("#crewAddAttendanceBtn")) {
        var addAtC = findById(window.CREW, crewDetailId);
        openAttendanceModal(addAtC ? { crewId: addAtC.id } : null);
        return;
      }

      var atBoardRow = ev.target.closest(".board__row[data-att-id]");
      if (atBoardRow) { var bAt = findById(window.ATTENDANCE || [], atBoardRow.getAttribute("data-att-id")); if (bAt) openAttendanceModal(bAt); return; }

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

      var statusFilterBtn = ev.target.closest("#crewStatusFilter button[data-s]");
      if (statusFilterBtn) { crewStatusFilter = statusFilterBtn.getAttribute("data-s"); renderCrew(); return; }

      var disFilterBtn = ev.target.closest("#crewDisFilter button[data-f]");
      if (disFilterBtn) { crewDisFilter = disFilterBtn.getAttribute("data-f"); renderCrew(); return; }

      var groupFilterBtn = ev.target.closest("#crewGroupFilter button[data-g]");
      if (groupFilterBtn) { crewGroupFilter = groupFilterBtn.getAttribute("data-g"); renderCrew(); return; }
    });

    view.addEventListener("input", function (ev) {
      if (ev.target.id === "crewSearch") {
        crewQuery = ev.target.value;
        var body = document.getElementById("crewBody");
        if (body) body.innerHTML = tbodyHTML();
      }
      if (ev.target.id === "ivSearch") {
        interviewQuery = ev.target.value;
        var body = document.getElementById("ivBody");
        if (body) {
          var rows = filteredInterviews();
          body.innerHTML = rows.length ? groupedInterviewRowsHTML(rows)
            : '<tr><td colspan="6" class="board__empty">검색 결과가 없습니다.</td></tr>';
        }
      }
      if (ev.target.id === "atSearch") {
        attQuery = ev.target.value;
        var atBody = document.getElementById("atBody");
        if (atBody) {
          var atRows = filteredAttendance();
          atBody.innerHTML = atRows.length ? atRows.map(function (r) { return attendanceBoardRow(r, true); }).join("")
            : '<tr><td colspan="6" class="board__empty">검색 결과가 없습니다.</td></tr>';
        }
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
