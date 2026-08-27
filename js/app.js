/* =========================================================
   SNACK & GARDEN — OPS · 앱 로직 (라우팅 + 렌더)
   ========================================================= */
(function () {
  "use strict";

  var TODAY = isoOf(new Date()); // 오늘 날짜 (기기의 실제 날짜 기준)

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
      status: r.status || "재직", joinDate: fmtDay(r.joinDate), leftDate: fmtDay(r.leftDate), phone: r.phone || "",
      site: r.site || "", duties: toArr(r.duties), note: r.note || "",
      contractType: r.contractType || "", contractEndDate: fmtDay(r.contractEndDate), birthDate: fmtDay(r.birthDate),
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

  function normEducation(r) {
    return {
      id: r.id || "", category: r.category || "정기교육", title: r.title || "",
      crewId: r.crewId || "", crewName: r.crewName || "전체 크루",
      date: fmtDay(r.date), dueDate: fmtDay(r.dueDate),
      status: r.status || "예정", provider: r.provider || "", hours: r.hours || "", note: r.note || "",
      link: r.link || "", checklist: r.checklist || "{}",
    };
  }

  function normNote(r) {
    return {
      id: r.id || "", date: r.date || "", time: r.time || "",
      part: r.part || "전체", text: r.text || "", author: r.author || "",
      link: r.link || "", deletedAt: r.deletedAt || "",
    };
  }

  function normHrChange(r) {
    return {
      id: r.id || "", crewId: r.crewId || "", crewName: r.crewName || "",
      type: r.type || "기타", typeLabel: r.typeLabel || "", date: fmtDay(r.date),
      before: r.before || "", after: r.after || "",
      reason: r.reason || "", recorder: r.recorder || "", link: r.link || "",
    };
  }

  /* 거래처 = 고객(공급받는자). name=고객명(상호), contact=담당자명 */
  function normPartner(r) {
    return {
      id: r.id || "", name: r.name || "", contact: r.contact || "",
      bizNo: r.bizNo || "", ceo: r.ceo || "", addr: r.addr || "",
    };
  }

  /** items 는 시트에서 JSON 문자열로 내려올 수 있어 배열로 파싱 */
  function parseItems_(v) {
    if (Array.isArray(v)) return v;
    if (!v) return [];
    try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function normStatement(r) {
    var items = parseItems_(r.items).map(function (it) {
      return { name: it.name || "", price: +it.price || 0, qty: +it.qty || 0 };
    });
    var shipping = +r.shipping || 0;
    var g = stmtGrand(items, shipping);
    return {
      id: r.id || "", docNo: r.docNo || "",
      billDate: fmtDay(r.billDate || r.date), dueDate: fmtDay(r.dueDate),
      customerName: r.customerName || "", contactName: r.contactName || "",
      bankName: r.bankName || "", accountNo: r.accountNo || "", accountHolder: r.accountHolder || "",
      phone: r.phone || "", email: r.email || "",
      items: items, shipping: shipping,
      supplyAmount: r.supplyAmount != null && r.supplyAmount !== "" ? +r.supplyAmount : g.supply,
      vat: r.vat != null && r.vat !== "" ? +r.vat : g.vat,
      total: r.total != null && r.total !== "" ? +r.total : g.total,
      memo: r.memo || "", status: r.status || "작성",
      createdAt: r.createdAt || "", driveUrl: r.driveUrl || "",
    };
  }

  /* ---------- 견적서(QUOTE) 정규화 ----------
     명세서와 계산식은 동일(단가 = 부가세 별도). 품목에 규격·단위를 추가로 보관하고
     발행처 담당자(repName/repPhone/repEmail)와 특이사항(notes)을 담습니다. */
  function normQuote(r) {
    var items = parseItems_(r.items).map(function (it) {
      return {
        name: it.name || "", spec: it.spec || "", unit: it.unit || "",
        price: +it.price || 0, qty: +it.qty || 0,
      };
    });
    var shipping = +r.shipping || 0;
    var g = stmtGrand(items, shipping);
    return {
      id: r.id || "", docNo: r.docNo || "",
      quoteDate: fmtDay(r.quoteDate || r.date), validUntil: fmtDay(r.validUntil),
      customerName: r.customerName || "", contactName: r.contactName || "",
      repName: r.repName || "", repPhone: r.repPhone || "", repEmail: r.repEmail || "",
      items: items, shipping: shipping,
      supplyAmount: r.supplyAmount != null && r.supplyAmount !== "" ? +r.supplyAmount : g.supply,
      vat: r.vat != null && r.vat !== "" ? +r.vat : g.vat,
      total: r.total != null && r.total !== "" ? +r.total : g.total,
      notes: r.notes || "", status: r.status || "작성",
      createdAt: r.createdAt || "", driveUrl: r.driveUrl || "",
    };
  }

  /** 숫자를 한글 금액으로 (예: 360000 → "삼십육만") */
  function numToKorean(n) {
    n = Math.round(+n || 0);
    if (n === 0) return "영";
    var digits = ["", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
    var small = ["", "십", "백", "천"];
    var big = ["", "만", "억", "조", "경"];
    var out = "";
    var groupIdx = 0;
    while (n > 0) {
      var group = n % 10000;
      if (group > 0) {
        var gs = "";
        var g = group, pos = 0;
        while (g > 0) {
          var digit = g % 10;
          if (digit > 0) gs = digits[digit] + small[pos] + gs;
          g = Math.floor(g / 10); pos++;
        }
        out = gs + big[groupIdx] + out;
      }
      n = Math.floor(n / 10000); groupIdx++;
    }
    return out;
  }

  /* ---------- 거래명세서 계산 (공급자=링키지랩, 단가 = 부가세 별도) ----------
     공급가액 = round(단가 × 수량) / 세액 = round(공급가액 × 0.1) / 합계 = 공급가액 + 세액 */
  function stmtLine(it) {
    var supply = Math.round((+it.price || 0) * (+it.qty || 0));
    var vat = Math.round(supply * 0.1);
    return { supply: supply, vat: vat, total: supply + vat };
  }
  function stmtTotals(items) {
    return (items || []).reduce(function (acc, it) {
      var l = stmtLine(it);
      acc.supply += l.supply; acc.vat += l.vat; acc.total += l.total;
      return acc;
    }, { supply: 0, vat: 0, total: 0 });
  }
  /** 품목 합계 + 배송비(부가세 별도)를 합산한 최종 합계 */
  function stmtGrand(items, shipping) {
    var t = stmtTotals(items);
    var ship = +shipping || 0;
    var shipVat = Math.round(ship * 0.1);
    return {
      itemsSupply: t.supply, itemsVat: t.vat,
      shipping: ship, shipVat: shipVat,
      supply: t.supply + ship,
      vat: t.vat + shipVat,
      total: t.supply + ship + t.vat + shipVat,
    };
  }
  /** 천 단위 콤마 (원화) */
  function won(n) { return (Math.round(+n || 0)).toLocaleString("en-US"); }

  /* 발행처(공급자) = 주식회사 링키지랩 — 고정 정보 */
  function company() {
    var base = (window.COMPANY || {});
    return {
      name: base.name || "주식회사 링키지랩",
      bizNo: base.bizNo || "235-88-00278",
      ceo: base.ceo || "박대영",
      addr: base.addr || "서울특별시 성동구 성수동2가 314-37번지 3층",
      logo: base.logo || "./assets/logo.png",
    };
  }
  /* 최근 입력한 연락처·입금계좌를 기억해 다음 명세서에 자동 채움 */
  function loadCompanyExtra() {
    try { return JSON.parse(localStorage.getItem("sg-company-extra") || "{}") || {}; } catch (e) { return {}; }
  }
  function saveCompanyExtra(e) {
    try { localStorage.setItem("sg-company-extra", JSON.stringify(e)); } catch (x) {}
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

  /* ---------- 연차 발생 (2년차 미만, 입사일·만근·회계일=입사일 기준) ----------
     이미지 규칙: ① 입사년 만근 매월 1일씩  ② 2년차 월차(계약연장 전) 매월 1일씩(총 11일 채움)
                 ③ 2년차 연차(계약연장 후) = (입사년 재직일 ÷ 365) × 15
     4시간 크루(반차 없음)=1일 올림 / 8시간 크루(반차 있음)=0.5일 올림 */
  function isFourHourCrew(workHours) {
    return /\(\s*4\s*h/i.test(String(workHours || "")) || /4\s*시간/.test(String(workHours || ""));
  }
  function roundLeave(days, workHours) {
    if (isFourHourCrew(workHours)) return Math.ceil(days - 1e-9);   // 4시간 크루(반차 없음) → 1일 올림
    return Math.ceil(days * 2 - 1e-9) / 2;                          // 8시간 크루(반차 있음) → 0.5일 올림
  }
  function fmtLeave(n) { return (Math.round(n * 100) / 100).toString(); }

  function round2(n) { return Math.round(n * 100) / 100; }

  /** 특정 달력연도에 그 크루에게 발생하는 연차. stage: before|hireYear|secondYear|flat */
  function leaveForYear(c, year) {
    var join = d(c.joinDate);
    var hy = join.getFullYear(), jm = join.getMonth();
    var rel = year - hy;
    if (rel < 0) return { stage: "before", days: 0 };
    if (rel === 0) { var m = 11 - jm; return { stage: "hireYear", days: m, monthly: m }; }
    if (rel === 1) {
      var secondMonthly = jm;
      var dw = Math.round((new Date(hy, 11, 31) - new Date(hy, jm, 1)) / 864e5); // 입사월 1일~12/31
      var pr = (dw / 365) * 15, raw = secondMonthly + pr;
      return { stage: "secondYear", days: roundLeave(raw, c.workHours), monthly: secondMonthly, daysWorked: dw, prorated: round2(pr), raw: round2(raw) };
    }
    return { stage: "flat", days: 15 };
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
        if (d && d.reports) window.SUMMARY.reports = d.reports;
        if (d && d.interviews) window.INTERVIEWS = d.interviews.map(normInterview);
        if (d && d.attendance) window.ATTENDANCE = d.attendance.map(normAttendance);
        if (d && d.education) window.EDUCATION = d.education.map(normEducation);
        if (d && d.notes) window.NOTES = d.notes.map(normNote);
        if (d && d.hrChanges) window.HR_CHANGES = d.hrChanges.map(normHrChange);
        if (d && d.partners) window.PARTNERS = d.partners.map(normPartner);
        if (d && d.statements) window.STATEMENTS = d.statements.map(normStatement);
        if (d && d.quotes) window.QUOTES = d.quotes.map(normQuote);
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

  /** 일정 링크(최대 5개) 정규화 — links(배열/JSON문자열) 우선, 없으면 단일 link 로 대체 */
  function evtLinks(e) {
    if (!e) return [];
    var arr = [];
    if (Array.isArray(e.links)) arr = e.links.slice();
    else if (typeof e.links === "string" && e.links) {
      try { var p = JSON.parse(e.links); if (Array.isArray(p)) arr = p; else arr = e.links.split("\n"); }
      catch (x) { arr = e.links.split("\n"); }
    }
    if (!arr.length && e.link) arr = [e.link];
    return arr.map(function (s) { return String(s || "").trim(); }).filter(Boolean).slice(0, 5);
  }

  /** 일정 저장 payload — 필드 하나만 바뀌어도 항상 전체 필드를 함께 보내 시트에서 값이 비는 걸 방지 */
  function schedulePayload_(evt, action) {
    var links = evtLinks(evt);
    return {
      type: "schedule", action: action, id: evt.id, date: evt.date, time: evt.time, title: evt.title,
      category: evt.category, done: evt.done, assignee: evt.assignee,
      link: links[0] || "", links: JSON.stringify(links),
      alarm: evt.alarm, alarmTime: evt.alarmTime || "",
    };
  }

  /** 보고 사항 저장 payload — 필드 하나만 바뀌어도 항상 전체 필드를 함께 보내 시트에서 값이 비는 걸 방지 */
  function reportPayload_(rp, action) {
    return {
      type: "report", action: action, id: rp.id, text: rp.text, link: rp.link,
      urgent: rp.urgent, done: rp.done, reportedAt: rp.reportedAt || "",
    };
  }

  function updateModeBadge() {
    var foot = document.querySelector(".side__foot");
    if (!foot) return;
    var status = foot.querySelector(".side__foot-status") || foot;
    var live = isLive();
    status.innerHTML = '<span class="dot"></span> ' + (live ? "LIVE · 구글시트 연동" : "DEMO · 목업 데이터");
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
      + '<div class="page-head__actions">'
        + '<button class="btn" id="openRepeatManageBtn">반복 일정 관리</button>'
        + '<button class="btn btn--primary" id="addEventBtn">+ 일정 등록</button>'
      + '</div>'
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

    var pendingReports = (s.reports || []).filter(function (rp) { return !rp.done; });
    html += '<div class="summary summary--report">'
      + '<div class="summary__col">'
      + '<div class="summary__head"><h3>상위리더 보고 사항</h3></div>'
      + '<ul>' + pendingReports.map(function (rp, idx) {
          var body = esc(rp.text);
          var link = rp.link ? ' <a class="link-chip" href="' + esc(rp.link) + '" target="_blank" rel="noopener" title="링크 열기">🔗</a>' : "";
          var urgentBtn = '<button type="button" class="report-urgent-toggle' + (rp.urgent ? " is-urgent" : "") + '" data-id="' + esc(rp.id || "") + '" title="' + (rp.urgent ? "긴급 해제" : "긴급으로 표시") + '">●</button>';
          return '<li data-id="' + esc(rp.id || "") + '" class="' + (rp.urgent ? "is-urgent" : "") + '">'
            + '<span class="report-num">' + (idx + 1) + '</span>'
            + urgentBtn
            + '<span class="issue-text">' + body + '</span>' + link
            + '<span class="evt__actions">'
              + '<button type="button" class="evt__act report-act--done" data-id="' + esc(rp.id || "") + '" title="보고 완료">✓</button>'
              + '<button type="button" class="evt__act report-act--edit" data-id="' + esc(rp.id || "") + '" title="수정">✎</button>'
              + '<button type="button" class="evt__act evt__act--del report-act--del" data-id="' + esc(rp.id || "") + '" title="삭제">&times;</button>'
            + '</span>'
          + '</li>';
        }).join("") + '<li class="report-add-row" data-report-add="1">' + (pendingReports.length ? "+ 추가" : "보고 사항 입력…") + '</li>' + '</ul>'
      + '</div>'
      + '</div>';

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

  var EVENT_LINK_MAX = 5;
  function eventLinkRowHTML(val) {
    return '<div class="evt-link-row">'
      + '<input type="url" class="evt-link-in" placeholder="https://docs.google.com/..." value="' + esc(val || "") + '">'
      + '<button type="button" class="evt-link-del" title="링크 삭제" aria-label="링크 삭제">&times;</button>'
      + '</div>';
  }
  /** 모달의 링크 목록을 links 배열로 다시 그린다 (최소 1행, 최대 5행) */
  function renderEventLinks(box, links) {
    if (!box) return;
    var arr = (links && links.length) ? links.slice(0, EVENT_LINK_MAX) : [""];
    box.innerHTML = arr.map(eventLinkRowHTML).join("");
    updateEventAddLinkBtn(box);
  }
  function updateEventAddLinkBtn(box) {
    var btn = document.getElementById("eventAddLinkBtn");
    if (!btn || !box) return;
    var count = box.querySelectorAll(".evt-link-row").length;
    btn.disabled = count >= EVENT_LINK_MAX;
    btn.textContent = count >= EVENT_LINK_MAX ? "링크는 최대 5개" : "🔗 링크 추가";
  }
  /** 모달 입력값에서 비어있지 않은 링크만 순서대로 수집 */
  function collectEventLinks(box) {
    if (!box) return [];
    return Array.prototype.map.call(box.querySelectorAll(".evt-link-in"), function (i) { return i.value.trim(); })
      .filter(Boolean).slice(0, EVENT_LINK_MAX);
  }

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
    renderEventLinks(el.querySelector("#eventLinks"), evtLinks(prefill));
    form.done.checked = !!(prefill && prefill.done);
    var alarmOn = !!(prefill && prefill.alarm);
    form.alarm.checked = alarmOn;
    form.alarmTime.value = (prefill && prefill.alarmTime) || (prefill && prefill.time) || "";
    el.querySelector("#eventAlarmWrap").hidden = !alarmOn;
    // 매주 반복은 신규 등록에만 제공 — 이미 저장된 일정을 수정할 땐 반복 묶음이 아닌 단일 일정이라 혼동을 피하기 위해 숨김
    el.querySelector("#eventRepeatWrap").hidden = editing;
    form.repeatWeekly.checked = false;
    form.repeatUntil.value = "";
    form.repeatUntil.min = form.date.value;
    el.querySelector("#eventRepeatEndWrap").hidden = true;
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
      + '<label class="fld"><span>날짜</span><input type="date" name="date"></label>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>시간 <em>(선택)</em></span><input type="time" name="time"></label>'
        + '<label class="fld"><span>카테고리</span><select name="category">'
          + CATEGORIES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join("")
        + '</select></label>'
      + '</div>'
      + '<label class="fld"><span>제목</span><input type="text" name="title" maxlength="60" placeholder="일정 제목"></label>'
      + '<label class="fld fld--check" id="eventRepeatWrap"><input type="checkbox" name="repeatWeekly"><span>매주 반복</span></label>'
      + '<label class="fld" id="eventRepeatEndWrap" hidden><span>반복 종료일</span><input type="date" name="repeatUntil"></label>'
      + '<label class="fld"><span>담당 <em>(선택)</em></span><input type="text" name="assignee" maxlength="20" placeholder="담당자 / 팀"></label>'
      + '<div class="fld"><span>링크 <em>(선택 · 최대 5개 · 목록엔 첫 번째만 표시)</em></span>'
        + '<div id="eventLinks" class="evt-links"></div>'
        + '<button type="button" class="btn btn--sm evt-links__add" id="eventAddLinkBtn">🔗 링크 추가</button>'
      + '</div>'
      + '<div class="fld-row">'
        + '<label class="fld fld--check"><input type="checkbox" name="done"><span>완료 처리</span></label>'
        + '<label class="fld fld--check"><input type="checkbox" name="alarm"><span>🔔 알림 설정</span></label>'
      + '</div>'
      + '<label class="fld" id="eventAlarmWrap" hidden><span>알림 시간</span><input type="time" name="alarmTime"></label>'
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
    wrap.querySelector('input[name="alarm"]').addEventListener("change", function (ev) {
      var f = wrap.querySelector("form");
      wrap.querySelector("#eventAlarmWrap").hidden = !ev.target.checked;
      if (ev.target.checked && !f.alarmTime.value) f.alarmTime.value = f.time.value || "09:00";
    });
    wrap.querySelector('input[name="repeatWeekly"]').addEventListener("change", function (ev) {
      wrap.querySelector("#eventRepeatEndWrap").hidden = !ev.target.checked;
    });
    wrap.querySelector('input[name="date"]').addEventListener("change", function (ev) {
      wrap.querySelector('input[name="repeatUntil"]').min = ev.target.value;
    });
    // 링크 추가/삭제 (최대 5개)
    var linksBox = wrap.querySelector("#eventLinks");
    wrap.querySelector("#eventAddLinkBtn").addEventListener("click", function () {
      if (linksBox.querySelectorAll(".evt-link-row").length >= EVENT_LINK_MAX) return;
      linksBox.insertAdjacentHTML("beforeend", eventLinkRowHTML(""));
      updateEventAddLinkBtn(linksBox);
      var ins = linksBox.querySelector(".evt-link-row:last-child .evt-link-in");
      if (ins) ins.focus();
    });
    linksBox.addEventListener("click", function (ev) {
      if (!ev.target.closest(".evt-link-del")) return;
      var rows = linksBox.querySelectorAll(".evt-link-row");
      if (rows.length <= 1) { linksBox.querySelector(".evt-link-in").value = ""; }
      else ev.target.closest(".evt-link-row").remove();
      updateEventAddLinkBtn(linksBox);
    });
    // 작성 중 실수로 닫히지 않도록 배경 클릭·ESC 닫기는 비활성화 (X·취소 버튼으로만 닫힘)
    wrap.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      // 모달이 스크롤 컨테이너(overflow) 안에 있어 브라우저 기본 필수입력(required) 툴팁이
      // 잘려서 안 보일 수 있어 — required 속성 대신 직접 확인 후 알림으로 안내
      if (!f.date.value) {
        alert("날짜를 선택해주세요.");
        f.date.focus();
        return;
      }
      var title = f.title.value.trim();
      if (!title) {
        alert("제목을 입력해주세요.");
        f.title.focus();
        return;
      }
      if (f.repeatWeekly.checked && !f.repeatUntil.value) {
        alert("반복 종료일을 선택해주세요.");
        f.repeatUntil.focus();
        return;
      }
      var id = f.dataset.id;
      var _links = collectEventLinks(wrap.querySelector("#eventLinks"));
      var evt = {
        id: id || newId("s"),
        date: f.date.value,
        time: f.time.value || "",
        title: title,
        category: f.category.value,
        done: f.done.checked,
        assignee: f.assignee.value.trim(),
        link: _links[0] || "",
        links: _links,
        alarm: f.alarm.checked,
        alarmTime: f.alarm.checked ? (f.alarmTime.value || f.time.value || "") : "",
      };
      if (id) {
        var idx = indexById(window.SCHEDULE, id);
        if (idx > -1) window.SCHEDULE[idx] = evt; else window.SCHEDULE.push(evt);
        saveToSheet(schedulePayload_(evt, "update"));
      } else {
        window.SCHEDULE.push(evt);
        saveToSheet(schedulePayload_(evt, "add"));
        // 매주 반복: 같은 요일로 반복 종료일까지 각각 별개의 일정으로 추가 생성
        if (f.repeatWeekly.checked && f.repeatUntil.value) {
          var cursor = addDays(evt.date, 7);
          var addedCount = 0;
          while (cursor <= f.repeatUntil.value) {
            var occurrence = Object.assign({}, evt, { id: newId("s"), date: cursor });
            window.SCHEDULE.push(occurrence);
            saveToSheet(schedulePayload_(occurrence, "add"));
            addedCount++;
            cursor = addDays(cursor, 7);
          }
          // 반복 생성 결과를 바로 확인할 수 있도록 안내 — 현재 화면(주간/월간)에 안 보여도
          // 실제로는 생성됐다는 걸 알 수 있게(캘린더에서 다음 주·다음 달로 넘겨야 보임)
          if (addedCount) {
            alert("'" + title + "' 일정이 " + WD[wd(evt.date)] + "요일마다 총 " + (addedCount + 1) + "건 등록되었습니다.\n(오늘 보고 있는 화면 밖의 일정은 '다음' 버튼이나 월간 보기로 넘겨야 보여요)");
          }
        }
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
    var alarmMark = e.alarm ? '<span class="evt__alarm-mark" title="알림 ' + esc(e.alarmTime || e.time || "") + '">🔔</span>' : '';
    var lead = (e.time || alarmMark) ? '<span class="evt__time">' + (e.time ? esc(e.time) : '') + alarmMark + '</span>' : '';
    var _links = evtLinks(e);
    var link = _links.length
      ? '<a class="evt__link" href="' + esc(_links[0]) + '" target="_blank" rel="noopener" title="링크 열기' + (_links.length > 1 ? ' (외 ' + (_links.length - 1) + '개는 수정에서 확인)' : '') + '" onclick="event.stopPropagation()">🔗' + (_links.length > 1 ? '<span class="evt__link-badge">' + _links.length + '</span>' : '') + '</a>'
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
    saveToSheet(schedulePayload_(evt, "update"));
    renderSchedule();
  }
  function toggleEventDone(id) {
    var evt = findById(window.SCHEDULE, id);
    if (!evt) return;
    evt.done = !evt.done;
    saveToSheet(schedulePayload_(evt, "update"));
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
  function deleteReportQuick(id) {
    if (!confirm("이 보고 사항을 삭제할까요?")) return;
    window.SUMMARY.reports = (window.SUMMARY.reports || []).filter(function (rp) { return String(rp.id) !== String(id); });
    saveToSheet({ type: "report", action: "delete", id: id });
    renderSchedule();
  }
  function toggleReportUrgent(id) {
    var rp = findById(window.SUMMARY.reports || [], id);
    if (!rp) return;
    rp.urgent = !rp.urgent;
    saveToSheet(reportPayload_(rp, "update"));
    renderSchedule();
  }
  function completeReportQuick(id) {
    var rp = findById(window.SUMMARY.reports || [], id);
    if (!rp) return;
    rp.done = true;
    rp.reportedAt = TODAY;
    saveToSheet(reportPayload_(rp, "update"));
    renderSchedule();
  }
  function uncompleteReportQuick(id) {
    var rp = findById(window.SUMMARY.reports || [], id);
    if (!rp) return;
    rp.done = false;
    saveToSheet(reportPayload_(rp, "update"));
    renderWorkReport();
  }
  function deleteWorkReportQuick(id) {
    if (!confirm("이 보고 완료 항목을 삭제할까요?")) return;
    window.SUMMARY.reports = (window.SUMMARY.reports || []).filter(function (rp) { return String(rp.id) !== String(id); });
    saveToSheet({ type: "report", action: "delete", id: id });
    renderWorkReport();
  }

  /* ---------- 보고 사항 인라인 등록 (팝업 없이 목록 하단에서 바로 입력) ---------- */
  function activateReportQuickAdd(trigger) {
    var input = document.createElement("input");
    input.type = "text";
    input.className = "evt__quickinput";
    input.placeholder = "보고 사항 입력 후 Enter";
    input.maxLength = 120;
    trigger.replaceWith(input);
    input.focus();

    var done = false;
    function commit() {
      if (done) return;
      done = true;
      var text = input.value.trim();
      if (!text) { renderSchedule(); return; }
      if (!Array.isArray(window.SUMMARY.reports)) window.SUMMARY.reports = [];
      var rp = { id: newId("r"), text: text, link: "", urgent: false, done: false, reportedAt: "" };
      window.SUMMARY.reports.push(rp);
      saveToSheet(reportPayload_(rp, "add"));
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
      var evt = { id: newId("s"), date: iso, time: "", title: title, category: "기타", done: false, assignee: "", link: "", alarm: false, alarmTime: "" };
      window.SCHEDULE.push(evt);
      saveToSheet(schedulePayload_(evt, "add"));
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

  /* ---------- 상위리더 보고 사항 등록/수정 모달 ---------- */
  function openReportModal(prefill) {
    var el = document.getElementById("reportModal");
    if (!el) { el = buildReportModal(); document.body.appendChild(el); }
    var form = el.querySelector("form");
    form.reset();
    var editing = !!(prefill && prefill.id);
    form.dataset.id = editing ? prefill.id : "";
    el.querySelector("#reportModalTitle").textContent = editing ? "보고 사항 수정" : "보고 사항 등록";
    el.querySelector("#reportDelBtn").hidden = !editing;
    form.text.value = (prefill && prefill.text) || "";
    form.link.value = (prefill && prefill.link) || "";
    el.hidden = false;
    setTimeout(function () { form.text.focus(); }, 30);
  }
  function closeReportModal() {
    var el = document.getElementById("reportModal");
    if (el) el.hidden = true;
  }

  function buildReportModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "reportModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop"></div>'
      + '<div class="modal__card" role="dialog" aria-modal="true" aria-label="보고 사항 등록">'
      + '<div class="modal__head"><h3 id="reportModalTitle">보고 사항 등록</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<form id="reportForm">'
      + '<label class="fld"><span>내용</span><input type="text" name="text" maxlength="120" required placeholder="예) 8월 온보딩 계획 공유 필요"></label>'
      + '<label class="fld"><span>링크 <em>(선택 · 입력 시 🔗 버튼 생성)</em></span><input type="url" name="link" placeholder="https://docs.google.com/..."></label>'
      + '<div class="modal__foot">'
        + '<button type="button" class="btn btn--danger" id="reportDelBtn" hidden>삭제</button>'
        + '<div class="modal__spacer"></div>'
        + '<button type="button" class="btn" data-close>취소</button>'
        + '<button type="submit" class="btn btn--primary">저장</button>'
      + '</div>'
      + '</form>'
      + '</div>';

    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) closeReportModal();
    });
    // 작성 중 실수로 닫히지 않도록 배경 클릭·ESC 닫기는 비활성화 (X·취소 버튼으로만 닫힘)
    wrap.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var text = f.text.value.trim();
      if (!text) return;
      if (!Array.isArray(window.SUMMARY.reports)) window.SUMMARY.reports = [];
      var id = f.dataset.id;
      var existing = id ? findById(window.SUMMARY.reports, id) : null;
      var rp = {
        id: id || newId("r"), text: text, link: f.link.value.trim(),
        urgent: existing ? !!existing.urgent : false,
        done: existing ? !!existing.done : false,
        reportedAt: existing ? (existing.reportedAt || "") : "",
      };
      var idx = id ? indexById(window.SUMMARY.reports, id) : -1;
      if (idx > -1) window.SUMMARY.reports[idx] = rp; else window.SUMMARY.reports.push(rp);
      saveToSheet(reportPayload_(rp, id ? "update" : "add"));
      closeReportModal();
      renderSchedule();
    });
    wrap.querySelector("#reportDelBtn").addEventListener("click", function () {
      var id = wrap.querySelector("form").dataset.id;
      if (!id) return;
      if (!confirm("이 보고 사항을 삭제할까요?")) return;
      window.SUMMARY.reports = (window.SUMMARY.reports || []).filter(function (rp) { return String(rp.id) !== String(id); });
      saveToSheet({ type: "report", action: "delete", id: id });
      closeReportModal();
      renderSchedule();
    });
    return wrap;
  }

  /* ======================================================
     WORK REPORT · 업무 보고 (보고 완료된 상위리더 보고 사항, 월별/연별 조회)
     ====================================================== */
  var wrAnchor = TODAY;   // 업무 보고에서 보고 있는 기준 월/년
  var wrMode = "month";   // "month" | "year"

  function monthLabelFromKey(key) {
    if (!key) return "날짜 미상";
    var p = key.split("-");
    return +p[0] + "년 " + +p[1] + "월";
  }
  function wrScopeLabel() { return wrMode === "year" ? (+wrAnchor.slice(0, 4)) + "년" : monthLabel(wrAnchor); }

  function completedReportsInScope() {
    var all = (window.SUMMARY.reports || []).filter(function (rp) { return rp.done; });
    if (wrMode === "year") {
      var y = wrAnchor.slice(0, 4);
      return all.filter(function (rp) { return (rp.reportedAt || "").slice(0, 4) === y; });
    }
    var ym = wrAnchor.slice(0, 7);
    return all.filter(function (rp) { return (rp.reportedAt || "").slice(0, 7) === ym; });
  }

  function groupReportsByMonth(list) {
    var byMonth = {};
    list.forEach(function (rp) {
      var m = (rp.reportedAt || "").slice(0, 7);
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(rp);
    });
    return byMonth;
  }

  var wrArchMode = "grid";                        // 아카이브 표시 : "grid" | "timeline"
  var wrArchYear = String(TODAY).slice(0, 4);     // 아카이브 선택 연도
  var wrExpandedMonth = null;                      // 그리드에서 펼친 월 "YYYY-MM"

  function renderWorkReport() {
    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Operation / Work Report</p>'
      + '<h2>업무 보고</h2>'
      + '<p class="sub">AI 보고서 · 드라이브 자료 · 리더 보고 아카이브를 한 곳에서 관리합니다.</p></div>'
      + '</div>';

    html += '<section class="wr-zone"><div class="wr-zone__head"><span class="wr-zone__no">①</span><h3>AI 보고서 게시 보드</h3></div>'
      + renderWrDocsBoard() + '</section>';

    html += '<section class="wr-zone"><div class="wr-zone__head"><span class="wr-zone__no">②</span><h3>드라이브 관리 폴더</h3></div>'
      + '<div id="wrDriveWrap">' + renderDriveFolders() + '</div></section>';

    html += '<section class="wr-zone"><div class="wr-zone__head"><span class="wr-zone__no">③</span><h3>리더 보고 아카이브</h3></div>'
      + '<div id="wrArchWrap">' + renderArchive() + '</div></section>';

    view.innerHTML = html;
    ensureDriveFolders();
  }

  function workReportRow(rp) {
    var link = rp.link ? ' <a class="link-chip" href="' + esc(rp.link) + '" target="_blank" rel="noopener" title="링크 열기">🔗</a>' : "";
    return '<li data-id="' + esc(rp.id || "") + '">'
      + '<span class="wr-date">' + esc((rp.reportedAt || "").slice(5)) + '</span>'
      + '<span class="issue-text">' + esc(rp.text) + '</span>' + link
      + '<span class="evt__actions">'
        + '<button type="button" class="evt__act wr-act--undo" data-id="' + esc(rp.id || "") + '" title="완료 취소">↺</button>'
        + '<button type="button" class="evt__act evt__act--del wr-act--del" data-id="' + esc(rp.id || "") + '" title="삭제">&times;</button>'
      + '</span>'
      + '</li>';
  }

  /* ------ 발행 보고서 (게시형 문서) ------ */
  function wrDocs() { return Array.isArray(window.WR_DOCS) ? window.WR_DOCS : []; }

  function renderWrDocsBoard() {
    var docs = wrDocs().slice().sort(function (a, b) {
      return (b.date || "").localeCompare(a.date || "");
    });
    var cards = docs.map(function (d) {
      var t = (d.type || "DOC").toLowerCase();
      var open = d.kind === "link" ? "파일 열기 &rarr;" : "보고서 열기 &rarr;";
      return '<button type="button" class="wr-doc-card" data-doc="' + esc(d.id) + '">'
        + '<span class="wr-doc-card__top"><span class="wr-badge b-' + esc(t) + '">' + esc(d.type || "DOC") + '</span>'
        + '<span class="wr-doc-card__cat">' + esc(d.category || "보고서") + '</span></span>'
        + '<span class="wr-doc-card__title">' + esc(d.title) + '</span>'
        + (d.summary ? '<span class="wr-doc-card__sum">' + esc(d.summary) + '</span>' : '')
        + '<span class="wr-doc-card__foot"><span class="wr-doc-card__date">' + esc(d.date || "") + '</span>'
        + '<span class="wr-doc-card__open">' + open + '</span></span>'
        + '</button>';
    }).join("");
    return '<div class="wr-docs__grid">' + cards
      + '<div class="wr-doc-add" title="js/data.js 의 WR_DOCS 배열에 추가">＋ 보고서 추가<span>data.js · WR_DOCS</span></div>'
      + '</div>';
  }

  /* ② 드라이브 관리 폴더 */
  function driveFolders() { return Array.isArray(window.DRIVE_FOLDERS) ? window.DRIVE_FOLDERS : []; }
  var wrDriveOpen = {};       // 폴더 index -> 더보기 펼침 여부
  var wrDriveLoaded = false;  // 라이브 로드 1회

  function renderDriveFolders() {
    var folders = driveFolders();
    if (!folders.length) return '<div class="note-empty">연동된 드라이브 폴더가 없습니다. (Code.gs 의 DRIVE_FOLDERS 설정)</div>';
    return folders.map(function (fd, fi) {
      var files = fd.files || [];
      var openAll = !!wrDriveOpen[fi];
      var shown = openAll ? files : files.slice(0, 3);
      var rows = shown.map(function (f) {
        var t = (f.type || "FILE").toLowerCase();
        var open = f.url
          ? '<a class="wr-frow__open" href="' + esc(f.url) + '" target="_blank" rel="noopener">🔗 열기</a>'
          : '<span class="wr-frow__open is-off">열기</span>';
        return '<div class="wr-frow"><span class="wr-badge b-' + esc(t) + '">' + esc(f.type || "FILE") + '</span>'
          + '<span class="wr-frow__name" title="' + esc(f.name) + '">' + esc(f.name) + '</span>'
          + '<span class="wr-frow__date">' + esc(f.date || "") + '</span>' + open + '</div>';
      }).join("");
      var more = files.length > 3
        ? '<button type="button" class="wr-fmore" data-drive-more="' + fi + '">'
          + (openAll ? '접기' : '더보기 (' + (files.length - 3) + '건 더)') + '</button>'
        : "";
      var driveBtn = fd.url
        ? '<a class="wr-drivebtn" href="' + esc(fd.url) + '" target="_blank" rel="noopener">🔗 드라이브 폴더</a>'
        : '<span class="wr-drivebtn is-off" title="폴더 ID 미설정 (Code.gs DRIVE_FOLDERS)">🔗 드라이브 폴더</span>';
      return '<div class="panel wr-folder">'
        + '<div class="wr-folder__head"><span class="wr-folder__title">' + esc(fd.name)
        + ' <span class="cnt">' + (fd.count != null ? fd.count : files.length) + '건</span></span>' + driveBtn + '</div>'
        + (rows || '<div class="wr-frow wr-frow--empty">파일이 없습니다.</div>') + more
        + '</div>';
    }).join("");
  }

  function ensureDriveFolders() {
    if (wrDriveLoaded) return;
    var ep = endpoint(); if (!ep) return;   // 데모 모드는 폴백 데이터 사용
    wrDriveLoaded = true;
    var url = ep + (ep.indexOf("?") > -1 ? "&" : "?") + "action=drivefolders&_ts=" + Date.now();
    fetch(url, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (d) {
      if (Array.isArray(d)) {   // 신규 GAS 배포됨 → 라이브 폴더로 교체
        window.DRIVE_FOLDERS = d;
        var wrap = document.getElementById("wrDriveWrap");
        if (wrap) wrap.innerHTML = renderDriveFolders();
      }
    }).catch(function () { /* 실패 시 폴백 유지 */ });
  }

  /* ③ 리더 보고 아카이브 (그리드 / 타임라인) */
  function completedReportsAll() {
    return (window.SUMMARY.reports || []).filter(function (rp) { return rp.done; });
  }
  function wrYears() {
    var ys = {};
    completedReportsAll().forEach(function (rp) { var y = (rp.reportedAt || "").slice(0, 4); if (y) ys[y] = true; });
    ys[wrArchYear] = true;
    return Object.keys(ys).sort().reverse();
  }
  function reportsByMonthForYear(year) {
    var by = {};
    completedReportsAll().forEach(function (rp) {
      var d = rp.reportedAt || ""; if (d.slice(0, 4) !== year) return;
      var m = d.slice(0, 7); (by[m] = by[m] || []).push(rp);
    });
    Object.keys(by).forEach(function (m) {
      by[m].sort(function (a, b) { return (b.reportedAt || "").localeCompare(a.reportedAt || ""); });
    });
    return by;
  }

  function renderArchive() {
    var years = wrYears();
    var yseg = years.map(function (y) {
      return '<button class="' + (y === wrArchYear ? "on" : "") + '" data-wr-year="' + y + '">' + y + '년</button>';
    }).join("");
    var total = completedReportsAll().filter(function (rp) { return (rp.reportedAt || "").slice(0, 4) === wrArchYear; }).length;
    var modeSeg = '<div class="seg wr-arch__mode">'
      + '<button class="' + (wrArchMode === "grid" ? "on" : "") + '" data-wr-arch="grid">월 그리드</button>'
      + '<button class="' + (wrArchMode === "timeline" ? "on" : "") + '" data-wr-arch="timeline">타임라인</button>'
      + '</div>';
    var bar = '<div class="wr-arch__bar">'
      + '<div class="seg wr-arch__years">' + yseg + '</div>'
      + '<div class="wr-arch__right"><span class="wr-arch__stat"><b>' + total + '</b>건 · ' + wrArchYear + ' 누적</span>' + modeSeg + '</div>'
      + '</div>';
    var body = wrExpandedMonth
      ? renderArchiveMonth(wrExpandedMonth)
      : (wrArchMode === "timeline" ? renderArchiveTimeline(wrArchYear) : renderArchiveGrid(wrArchYear));
    return bar + body;
  }

  function renderArchiveGrid(year) {
    var by = reportsByMonthForYear(year);
    var keys = Object.keys(by);
    if (!keys.length) return '<div class="note-empty">' + year + '년 보고 완료 사항이 없습니다.</div>';
    var maxM = Math.max.apply(null, keys.map(function (k) { return +k.slice(5, 7); }));
    var minM = Math.min.apply(null, keys.map(function (k) { return +k.slice(5, 7); }));
    var tiles = "";
    for (var m = maxM; m >= minM; m--) {
      var key = year + "-" + (m < 10 ? "0" + m : m);
      var items = by[key] || [];
      var peek = items.slice(0, 3).map(function (rp) { return '<li>' + esc(rp.text) + '</li>'; }).join("")
        || '<li class="muted">보고 완료 사항 없음</li>';
      var moreN = items.length - 3;
      tiles += '<button type="button" class="wr-mtile' + (items.length ? "" : " empty") + '" data-wr-month="' + key + '">'
        + '<div class="wr-mtile__top"><span class="wr-mtile__m">' + m + '<small>월</small></span>'
        + '<span class="wr-mtile__cnt' + (items.length ? "" : " zero") + '">' + items.length + '건</span></div>'
        + '<ul class="wr-mtile__peek">' + peek + '</ul>'
        + (moreN > 0 ? '<div class="wr-mtile__more">+' + moreN + '건 더 · 펼치기 →</div>' : (items.length ? '<div class="wr-mtile__more">펼치기 →</div>' : ''))
        + '</button>';
    }
    return '<div class="wr-months">' + tiles + '</div>';
  }

  function renderArchiveTimeline(year) {
    var by = reportsByMonthForYear(year);
    var keys = Object.keys(by).sort().reverse();
    if (!keys.length) return '<div class="note-empty">' + year + '년 보고 완료 사항이 없습니다.</div>';
    var html = '<div class="wr-timeline">';
    keys.forEach(function (m) {
      var items = by[m];
      html += '<div class="wr-tl__month"><div class="wr-tl__mark"></div>'
        + '<div class="wr-tl__head">' + (+m.slice(5, 7)) + '월 <span class="chip-mono">' + items.length + '건</span></div>'
        + '<ul class="wr-tl__list">'
        + items.map(function (rp) {
            var link = rp.link ? ' <a class="link-chip" href="' + esc(rp.link) + '" target="_blank" rel="noopener">🔗</a>' : "";
            return '<li><span class="wr-tl__date">' + esc((rp.reportedAt || "").slice(5)) + '</span><span class="issue-text">' + esc(rp.text) + '</span>' + link + '</li>';
          }).join("")
        + '</ul></div>';
    });
    return html + '</div>';
  }

  function renderArchiveMonth(key) {
    var by = reportsByMonthForYear(key.slice(0, 4));
    var items = by[key] || [];
    return '<div class="wr-month-detail">'
      + '<button type="button" class="wr-back" data-wr-back="1">← 아카이브</button>'
      + '<h4 class="wr-month-detail__title">' + monthLabelFromKey(key) + ' <span class="chip-mono">' + items.length + '건</span></h4>'
      + '<ul class="wr-list">' + items.map(workReportRow).join("") + '</ul>'
      + '</div>';
  }

  function rerenderArchive() {
    var wrap = document.getElementById("wrArchWrap");
    if (wrap) wrap.innerHTML = renderArchive();
  }

  function findWrDoc(id) {
    return wrDocs().filter(function (d) { return String(d.id) === String(id); })[0] || null;
  }

  function openWrDocModal(id) {
    var doc = findWrDoc(id);
    if (!doc) return;
    var el = document.getElementById("wrDocModal");
    if (!el) { el = buildWrDocModal(); document.body.appendChild(el); }
    el.dataset.docId = doc.id;
    el.querySelector("#wrDocModalTitle").textContent = doc.title;
    el.querySelector("#wrDocBody").innerHTML = '<div class="wrdoc">' + doc.html + '</div>';
    el.querySelector("#wrDocBody").scrollTop = 0;
    el.hidden = false;
  }
  function closeWrDocModal() {
    var el = document.getElementById("wrDocModal");
    if (el) el.hidden = true;
  }
  function buildWrDocModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "wrDocModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop" data-close></div>'
      + '<div class="modal__card modal__card--doc" role="dialog" aria-modal="true" aria-label="발행 보고서">'
      + '<div class="modal__head"><h3 id="wrDocModalTitle">보고서</h3>'
      + '<div class="modal__head-actions">'
      + '<button type="button" class="btn btn--primary" data-wr-print>PDF 다운로드</button>'
      + '<button type="button" class="modal__x" data-close aria-label="닫기">×</button>'
      + '</div></div>'
      + '<div class="wrdoc-scroll" id="wrDocBody"></div>'
      + '</div>';
    wrap.addEventListener("click", function (ev) {
      if (ev.target.closest("[data-close]")) { closeWrDocModal(); return; }
      if (ev.target.closest("[data-wr-print]")) { printWrDoc(wrap.dataset.docId); return; }
    });
    return wrap;
  }

  function printWrDoc(id) {
    var doc = findWrDoc(id);
    if (!doc) return;
    var old = document.getElementById("wrPrintArea");
    if (old) old.parentNode.removeChild(old);
    var area = document.createElement("div");
    area.id = "wrPrintArea";
    area.innerHTML = '<div class="wrdoc wrdoc--print">' + doc.html + '</div>';
    document.body.appendChild(area);
    document.body.classList.add("is-wr-printing");
    var cleanup = function () {
      document.body.classList.remove("is-wr-printing");
      if (area && area.parentNode) area.parentNode.removeChild(area);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(function () { window.print(); }, 60);
    setTimeout(cleanup, 60000); // 안전장치
  }

  /* ======================================================
     CREW VIEW
     ====================================================== */
  var crewDisFilter = "전체";
  var crewGroupFilter = "전체";
  var crewStatusFilter = "전체";
  var crewSortDir = "asc";        // 입사일 정렬 방향 : "asc"(오래된 입사순) | "desc"(최신 입사순)
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
    { key: "leave", label: "연차관리" },
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

  /** 입사일(joinDate, ISO "YYYY-MM-DD") 기준 정렬. 값이 없으면 항상 맨 뒤로. */
  function sortByJoinDate(rows) {
    var dir = crewSortDir === "desc" ? -1 : 1;
    return rows.slice().sort(function (a, b) {
      var ja = a.joinDate || "", jb = b.joinDate || "";
      if (!ja && !jb) return 0;
      if (!ja) return 1;   // 빈 값은 방향과 무관하게 뒤로
      if (!jb) return -1;
      return ja < jb ? -1 * dir : ja > jb ? 1 * dir : 0;
    });
  }

  function tbodyHTML() {
    var base = sortByJoinDate(filteredCrew()); // 필터 적용 후 입사일순 정렬 (상태는 아래서 그룹핑)
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

    var sortArrow = crewSortDir === "desc" ? "↓" : "↑";
    var sortLabel = crewSortDir === "desc" ? "최신 입사순" : "오래된 입사순";
    html += '<div class="table-wrap"><table class="crew-table"><thead><tr>'
      + '<th>크루</th><th>상태</th>'
      + '<th class="th-sort is-active" id="crewSortJoin" role="button" tabindex="0" aria-label="입사일 기준 정렬 (' + sortLabel + ')" title="클릭하면 정렬 방향 전환 · 현재 ' + sortLabel + '">'
      + '입사일 <span class="th-sort__arrow">' + sortArrow + '</span></th>'
      + '<th>청구사</th><th>장애유형</th><th>담당 업무</th><th>비고</th>'
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

  /** 입사 12주(84일) 이내 재직 크루는 수습 기간으로 간주 */
  function isProbation(c) {
    if (!c.joinDate || c.status !== "재직") return false;
    var days = daysBetweenISO(c.joinDate, TODAY);
    return days >= 0 && days < 84;
  }

  function crewRow(c) {
    var g = groupOf(c.group);
    var st = STATUS[c.status] || STATUS["재직"];
    var probationBadge = isProbation(c) ? ' <span class="badge--probation">수습</span>' : '';
    return '<tr data-id="' + esc(c.id || "") + '"' + (c.status === "퇴사" ? ' class="is-left"' : "") + '>'
      + '<td><div class="crew-name">'
        + '<span><b>' + esc(c.name) + '</b>'
          + '<span class="t"><i class="gdot" style="background:' + g.bg + '"></i>' + esc(c.group || "미지정") + probationBadge + '</span>'
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

    // 크루 상세에서 면담일지가 아직 안 실렸으면 로드 후 통계 채워 재렌더 (라이브 모드에서만)
    if (crewDetailId === c.id && !(window.JOURNAL && window.JOURNAL.tabs)
        && window.CONFIG && window.CONFIG.endpoint && typeof loadJournalOnce === "function") {
      loadJournalOnce().then(function () {
        if (crewDetailId === c.id) renderCrewDetail(c);
      });
    }
  }

  /* ---------- 크루 상세 · AI 면담 요약 카드 (상단 고정) ----------
     - 서술 요약(장점/누락/지원방향, 근태 타임라인)은 window.CREW_SUMMARY 캐시에서.
     - 통계(건수·기간·카테고리·지각 언급)는 window.JOURNAL 에서 실시간 집계. */
  var crewSummaryOpen = true;

  function crewJournalStats(nick) {
    var tabs = (window.JOURNAL && window.JOURNAL.tabs) || null;
    if (!tabs) return null;
    var t = null;
    for (var i = 0; i < tabs.length; i++) { if (String(tabs[i].name).trim() === nick) { t = tabs[i]; break; } }
    if (!t) return null;
    var rows = normalizeJournalRows(t.rows);
    if (!rows.length) return null;
    var cat = {}, late = 0;
    rows.forEach(function (r) {
      var c = r.category || "(미분류)";
      cat[c] = (cat[c] || 0) + 1;
      if (/지각|늦잠|늦게|연착|결근|조퇴|무단/.test(r.content)) late++;
    });
    var dated = rows.map(function (r) { return r.date; }).filter(Boolean).sort();
    var cats = Object.keys(cat).map(function (k) { return { k: k, v: cat[k] }; })
      .sort(function (a, b) { return b.v - a.v; });
    return { count: rows.length, first: dated[0] || "", last: dated[dated.length - 1] || "", late: late, cats: cats, src: "면담일지" };
  }

  /** 비장애 크루: 앱에서 직접 작성한 면담기록(INTERVIEWS)·근태(ATTENDANCE)로 통계 집계 */
  function crewInappStats(c) {
    var mine = function (r) { return String(r.crewId) === String(c.id) || (r.crewName && r.crewName === c.name); };
    var iv = (window.INTERVIEWS || []).filter(mine);
    var at = (window.ATTENDANCE || []).filter(mine);
    if (!iv.length && !at.length) return null;
    var cat = {};
    iv.forEach(function (r) { var k = r.type || "면담"; cat[k] = (cat[k] || 0) + 1; });
    var late = at.filter(function (r) { return /지각|결근|조퇴|무단/.test((r.kind || "") + (r.reason || "")); }).length;
    var dated = iv.map(function (r) { return r.date; }).filter(Boolean).sort();
    var cats = Object.keys(cat).map(function (k) { return { k: k, v: cat[k] }; })
      .sort(function (a, b) { return b.v - a.v; });
    return { count: iv.length, first: dated[0] || "", last: dated[dated.length - 1] || "", late: late, cats: cats, src: "면담기록" };
  }

  /** 면담일지(닉네임 매칭, 여러 팀 시트 합산) + 앱 면담기록·근태를 모두 취합한 통계 */
  function crewCombinedStats(c) {
    var nick = crewNickname(c.name);
    var tabs = (window.JOURNAL && window.JOURNAL.tabs) || [];
    var jrows = [];
    tabs.forEach(function (t) { if (String(t.name).trim() === nick) jrows = jrows.concat(normalizeJournalRows(t.rows)); });
    var mine = function (r) { return String(r.crewId) === String(c.id) || (r.crewName && r.crewName === c.name); };
    var iv = (window.INTERVIEWS || []).filter(mine);
    var at = (window.ATTENDANCE || []).filter(mine);
    if (!jrows.length && !iv.length && !at.length) return null;
    var cat = {}, late = 0, dates = [];
    jrows.forEach(function (r) {
      var k = r.category || "(미분류)"; cat[k] = (cat[k] || 0) + 1;
      if (/지각|늦잠|늦게|연착|결근|조퇴|무단/.test(r.content)) late++;
      if (r.date) dates.push(r.date);
    });
    iv.forEach(function (r) { var k = r.type || "면담"; cat[k] = (cat[k] || 0) + 1; if (r.date) dates.push(r.date); });
    at.forEach(function (r) { if (/지각|결근|조퇴|무단/.test((r.kind || "") + (r.reason || ""))) late++; });
    dates.sort();
    var cats = Object.keys(cat).map(function (k) { return { k: k, v: cat[k] }; }).sort(function (a, b) { return b.v - a.v; });
    var srcs = [];
    if (jrows.length) srcs.push("면담일지");
    if (iv.length || at.length) srcs.push("면담기록");
    return { count: jrows.length + iv.length, first: dates[0] || "", last: dates[dates.length - 1] || "", late: late, cats: cats, src: srcs.join("+") };
  }

  function levelClass(l) {
    return l === "지원 필요" ? "need" : l === "수행 중" ? "doing" : l === "독립 수행" ? "indep" : l === "확장 수행" ? "ext" : "obs";
  }

  /* 스낵 파트 비장애 크루 평가 기준 (참고용, 카드 하단 접이식) */
  var EVAL_SNACK = {
    "업무": [
      { name: "운영 프로세스의 이해 및 실행", items: [
        "타겟타임 및 운영에 대한 이해를 바탕으로 업무를 수행할 수 있다.",
        "주어진 스낵/오아시스 존의 셋팅·운영 등 기본 사항을 준비할 수 있다.",
        "정리/정돈·청소 등 위생 관리 업무를 적절히 진행할 수 있다.",
        "매장운영 전반의 프로세스를 이해하고 실행할 수 있다." ] },
      { name: "크루 케어 (파트리더)", items: [
        "사유 발생 시 적극적으로 현장대응·공유·면담일지 작성(후 공유)으로 크루를 지원한다.",
        "관리자로서 크루가 더 잘 회사 생활을 하도록 도움 되는 사항을 모색·제안·공유할 수 있다.",
        "업무 내용·이슈를 정확히 공유하고 공감을 통해 개인에게 동기를 부여할 수 있다.",
        "인원별 성향을 파악하고 적절한 업무를 부여할 수 있다." ] },
      { name: "자산 발주 및 관리", items: [
        "발주 품목의 재고현황을 파악하고 수치를 협의/확인 후 발주할 수 있다.",
        "정확한 입고일·입고검수를 진행할 수 있다.",
        "전월 재고 / 당월 입고 / 당월 실제 재고를 누락 없이 확인할 수 있다.",
        "재고사항을 정해진 FORM에 정리하고 정해진 일정에 리포트할 수 있다." ] },
      { name: "업무 공유", items: [
        "필요한 업무 사항을 누락 없이 공유한다.",
        "적절한 판단력과 업무 노하우로 문제해결·개선 능력을 발휘한다." ] },
      { name: "회사의 규정·안전 준수 여부", items: [
        "담당자의 요청·협의 사항을 확인하고 적절히 공유하여 답을 도출한다.",
        "지속적인 커뮤니케이션으로 담당자와 원만한 관계를 유지할 수 있다." ] }
    ],
    "역량": [
      { name: "매장운영 프로세스 개선 제안 노력", items: [
        "운영 프로세스를 숙지하고 개선점을 찾아 제안하는 노력을 하는가?",
        "운영에 필요한 절차를 기획·제안하여 효율성을 제고하는가?",
        "본인만의 노하우를 공유하고 실제 좋은 사례로 채택·반영되는가?" ] },
      { name: "의사소통", items: [
        "파트 내 크루와 소통·협력·존중하며 도움을 주려 노력하는가?",
        "파트 내 커뮤니케이션과 분위기를 와해시키지 않고 화합하려 노력하는가?",
        "외부 구성원과 소통하며 업무를 조정·반영·수행하는가? (외부담당자)" ] },
      { name: "업무 개선 노력", items: [
        "본인 업무 노하우를 공유·전파하여 전체 운영 개선에 도움을 주는가?",
        "본인 업무 발전·확대를 위해 개인적 배움·노력을 진행하는가?" ] },
      { name: "장애크루에 대한 관심·교육·케어", items: [
        "장애크루를 이해·공감·존중하며 관심을 갖는가?",
        "장애크루 눈높이에 맞는 반복훈련·요청을 진행하여 케어해 나가는가?",
        "장애크루 문제 발생 시 적극 개입하고 해결·개선을 위해 노력하는가?" ] },
      { name: "업무에 대한 기본자세", items: [
        "주어진 업무를 성실·책임감 있게 최선을 다하는가?",
        "주어진 업무 외 다양한 일에 수용적·적극적으로 대응해 나가는가?" ] }
    ]
  };

  /* 스낵 파트 장애 크루 수습평가 기준 (참고용, 카드 하단 접이식) */
  var EVAL_SNACK_DIS = {
    "업무": [
      { name: "운영 이해", items: [
        "타겟타임 및 운영에 대한 이해를 바탕으로 업무를 수행할 수 있다.",
        "주어진 스낵/오아시스 존의 셋팅·운영 등 기본 사항을 준비할 수 있다.",
        "자산의 재고조사를 진행할 수 있다." ] },
      { name: "자산 관리의 이해", items: [
        "재고·발주 관리의 기본을 이해하고 서브지원이 가능한가?",
        "층별 수량을 누락하지 않고 진열이 가능한가?",
        "층별 이슈를 파악하고 공유할 수 있는가?",
        "품목의 폐기 일자를 이해하고 업무를 수행할 수 있는가?" ] },
      { name: "운영 수행도", items: [
        "주도적으로 품목의 변경과 수량을 파악하고 진열/관리할 수 있는가?",
        "1일 진열 수량 파악에 대한 실수는 얼마나 되는가? (공지 미확인 등 사유로 인한)",
        "품목별 진열 수량을 이해하고 특성에 맞춰 관리할 수 있는가?" ] },
      { name: "입출고 - 식자재·부자재", items: [
        "매니저가 요청한 식재료를 정확히 개수에 맞게 이동·진열·관리하는가?",
        "거래명세서를 확인하고 입고 수량을 확인할 수 있는가?" ] },
      { name: "설비 관리", items: [
        "설비/매장 내외부 정리·정돈·청소 등을 단독 수행이 가능한가?",
        "설비 관리에 대한 이슈를 공유할 수 있는가?" ] }
    ],
    "역량": [
      { name: "업무에 대한 주도성·집중력", items: [
        "맡겨진 업무를 완벽히 이해하고 주도적으로 수행해 내는가?",
        "업무시간 내 맡겨진 업무에 집중하여 적절히 수행해 내는가?" ] },
      { name: "매니저의 업무요청사항을 잘 따르는가?", items: [
        "매니저의 업무요청사항을 주의 깊게 듣고 잘 이행하는가?",
        "매니저의 요청 방식이 아닌 본인만의 방식을 고집하지 않는가?",
        "요청 방식을 잘 이해하지 못했을 경우 재확인하여 실수를 줄이는가?" ] },
      { name: "동료 존중·도움", items: [
        "동료를 이해·도와주고 존중하는가?",
        "영어이름을 쓰고 존댓말을 사용하는가?",
        "동료를 무시·놀리는 말과 행동을 하지 않는가?",
        "동료 간 문제 발생 시 매니저에게 도움을 청하는가?",
        "동료에게 폭언(폭력)을 사용한 사례가 있는가?" ] },
      { name: "청결유지 및 공공예절 준수 여부", items: [
        "식재료를 다루는 담당자로서 손씻기·개인 위생을 관리하는가?",
        "엘리베이터·화장실·사무실·휴게공간 등에서 공공예절을 잘 지키는가?" ] },
      { name: "회사의 규정/안전 준수 여부", items: [
        "회사의 기본 규정·절차를 이해하고 범위 내에서 질서를 지키고 행동·요청하는가?",
        "근무시간에 업무에 집중하지 않고 본인이 하고 싶은 일만 고집하는가?",
        "매장 내 안전 규정을 지키고 사고가 발생하지 않도록 신중히 업무를 수행하는가?" ] }
    ]
  };

  /* 가든(조경) 장애 크루 평가서 기준 (참고용, 카드 하단 접이식) */
  var EVAL_GARDEN_DIS = {
    "업무": [
      { name: "업무 목적 및 내용 이해", items: [
        "관수·정리 등 배정된 조경 작업의 목적과 기본 방법을 이해하고 수행하려는 태도를 보이는가?",
        "관리 구역 상태를 안내에 따라 확인하고, 불편·이상한 점 인지 시 알리려는 노력을 하는가?" ] },
      { name: "자산 및 장비 관리", items: [
        "전정 가위·물통 등 배정 장비를 안내받은 방법에 따라 안전하게 사용하려는가?",
        "장비 사용 후 정해진 장소에 정리하거나, 어려울 경우 도움을 요청할 수 있는가?" ] },
      { name: "업무 상황 인지 및 공유", items: [
        "작업 중 불편·이상 상황(식물 상태·장비 문제 등)을 인지·느꼈을 때 공유하려는 태도를 보이는가?",
        "협업 중 문제 발생 시 혼자 해결하려 하기보다 동료·담당자에게 알릴 수 있는가?" ] },
      { name: "안내 이해 및 수용태도", items: [
        "안내받은 작업 설명·시범을 집중하여 듣고 이해하려는 태도를 보이는가?",
        "반복 설명·추가 안내가 필요한 상황에서 거부감 없이 다시 시도하려는 자세를 보이는가?" ] },
      { name: "작업 정리 및 안전 행동", items: [
        "작업 후 본인이 사용한 도구·작업 공간을 함께 정리하려는 노력을 보이는가?",
        "작업 중·후 위험 요소 인지 시 즉시 알리거나 안전하게 행동하려는 태도를 보이는가?" ] }
    ],
    "역량": [
      { name: "업무인수의 능동성·수용성·적절성", items: [
        "배정된 조경 업무를 거부 없이 수용하고 끝까지 수행하려는 태도를 보이는가?",
        "업무 변경·인수인계 시 설명을 듣고 이해하려는 노력을 보이는가?" ] },
      { name: "조경 환경 이해 및 수행", items: [
        "반복 관리하는 공간의 위치·특징을 점차 익히고 기억하려는 태도를 보이는가?",
        "계절 변화에 따른 작업 안내를 이해하고 안내에 따라 수행하려는가?" ] },
      { name: "동료크루 이해·존중·배려·기회부여", items: [
        "동료 크루의 차이를 인식하고 서로 존중하는 태도로 함께 작업하는가?",
        "협업 상황에서 기다리기·순서 지키기·요청에 응답하기 등 기본 협업 태도를 보이는가?",
        "본인이 수행 가능한 작업에 대해 참여하려는 의지를 보이는가?" ] },
      { name: "성실성·책임감", items: [
        "출근·작업 시작·마무리 등 근무 흐름에 맞춰 성실히 참여하려는 태도를 보이는가?",
        "맡은 작업에 대해 중간에 포기하지 않고 끝까지 해보려는 책임감을 보이는가?" ] },
      { name: "의사소통 (내부/외부)", items: [
        "작업 중 자신의 상태(어려움·완료 여부 등)를 말·행동·표정 등 익숙한 방식으로 표현할 수 있는가?",
        "동료·매니저와 소통 시 기본적인 배려·협력 의지를 보이는가?",
        "협업을 위해 필요한 도움을 요청하거나 안내에 반응하는 태도를 보이는가?" ] }
    ]
  };

  function evalStatusClass(s) {
    return s === "강점" ? "good" : (s === "성장 필요" || s === "성장필요") ? "grow" : "obs";
  }
  function evalRubricHtml(rubric, title, evalMap) {
    evalMap = evalMap || null;
    var assessed = 0;
    function group(t, arr) {
      return '<div class="aisum__eval-group"><h5>' + t + '</h5>'
        + arr.map(function (ind) {
          var a = evalMap && evalMap[ind.name];
          if (a) assessed++;
          return '<div class="aisum__eval-ind"><b>' + esc(ind.name) + '</b>'
            + (a ? ' <span class="aisum__evbadge aisum__evbadge--' + evalStatusClass(a.status) + '">' + esc(a.status) + '</span>' : '')
            + (a && a.note ? '<p class="aisum__evnote">' + esc(a.note) + '</p>' : '')
            + '<ul>' + ind.items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>';
        }).join("") + '</div>';
    }
    var bodyHtml = '<div class="aisum__eval-body">' + group("업무", rubric["업무"]) + group("역량", rubric["역량"]) + '</div>';
    var note = evalMap ? ' <span class="aisum__evtag">면담기록 대조</span>' : ' <span class="muted">(참고)</span>';
    return '<details class="aisum__eval"' + (evalMap ? ' open' : '') + '><summary>' + esc(title) + note + '</summary>' + bodyHtml + '</details>';
  }

  /* 전 크루 공통 역량 평가 기준 (탁월/충족/노력필요) */
  var EVAL_COMMON = [
    { name: "오픈마인드", def: "서로에 대한 이해와 존중을 바탕으로 소통하고 협력하는 사람", similar: "수용성, 이타적, 알아가기, 동료의식, 배려심, 협업, 커뮤니케이션, 착한화법, 장애감수성 등",
      탁월: ["장애·장애인에 대한 지식·정보를 동료에게 긍정적으로 전파한다", "동료 입장에서 생각해 효과적으로 의사를 전달할 방법을 찾고 이해시킨다", "동료가 장애로 어려움 발생 시 장애 특성에 맞춘 문제해결 방법을 제시한다"],
      충족: ["장애·장애인에 대해 이해하고 행동한다", "장애·장애인 관련 지식·정보를 계속 알아간다", "동료를 알아가고 서로 이해하기 위한 회사 행사 등에 적극 참여한다"],
      노력필요: ["장애·장애인을 알아가고 이해하려 노력하지 않거나 관심이 없다", "특정 동료 외 다른 동료와 원만한 관계를 못 맺거나 동료를 비하한다", "동료의 이야기를 경청하지 않고 의견을 무시한 채 자기 주장만 한다"] },
    { name: "성실성", def: "업무를 성실히 수행하는 모습으로 책임감을 보여주는 사람", similar: "기한 준수, 책임감, 자기관리 등",
      탁월: ["솔선수범으로 동료의 모범이 되거나 동료가 업무를 잘하도록 돕는다", "회사와 자기 성장·발전을 위해 주도적으로 노력한다", "어려운 상황에서도 새로운 문제 해결방법을 적용해 임무를 완수한다"],
      충족: ["부여된 업무 달성을 위해 실행계획을 스스로 세운다", "부여된 업무의 성과기준·일정을 준수한다", "예상 못한 상황·어려움이 발생해도 끝까지 포기하지 않는다"],
      노력필요: ["업무의 달성수준·달성기간이 일정하지 않다", "주어진 업무를 미뤄둔다", "책임을 회피하며 타인에게 전가한다"] },
    { name: "자기주도성", def: "담당 업무의 새로운 지식·기술 정보를 항상 찾고 배우고 도전하는 사람", similar: "적극성, 도전의식, 문제의식, 창의성, 학습지향성, 자기계발, 문제해결 능력 등",
      탁월: ["부여 업무 외 다른 업무를 스스로 찾아 건의하거나 직접 수행한다", "관행적 방법의 문제점을 인식하고 개선점을 제시한다", "향후 상황을 예측하고 대응하기 위해 자발적으로 행동한다"],
      충족: ["자신의 업무활동·결과를 개선하기 위한 방법을 찾는다", "새 지식·기술 정보를 업무에 반영해 적절한 결과물을 산출한다", "긴급 상황에서 문제를 미루지 않고 즉각 대응한다"],
      노력필요: ["업무 관련 지식습득에 관심이 없고 교육 프로그램에 불참한다", "새 아이디어·기술 적용에 부정적이다", "리더가 요구한 것 외 별도 훈련·교육 실적이 없다"] },
    { name: "실무지식", def: "본업에 경험과 지식을 가지고 업무를 수행하며 학습을 통해 성장", similar: "자기계발, 학습지향성, 적극성 등",
      탁월: ["관련 경험·지식으로 복잡·광범위·예외적 업무를 정확히 처리한다", "동료 팀원(파트원)에게 지도·조언이 가능하다", "기본지식·경험 바탕으로 업무 프로세스 개선을 통해 동료·부서 성장에 기여한다"],
      충족: ["본인 업무 관련 충분한 지식·기능을 보유하고 적절히 활용한다", "업무 처리능력이 다른 팀원과 비교해 평균 수준이다", "정확성·실수/누락 확인을 위해 매뉴얼을 참조하거나 타인과 공동 점검한다"],
      노력필요: ["경험·지식 부족으로 실무처리 문제가 많고 업무 범위가 제한적이다", "일부 지식 부족으로 실무처리에 문제가 발생한다", "스스로 업무를 수행하는 것이 어렵다"] },
    { name: "팀워크", def: "팀 목표·기능을 인식하고 구성원 상호간 지식·기술·정보를 공유해 조직 성과를 달성하려는 자세", similar: "동참, 협력, 수용성 등",
      탁월: ["동료와 협력하며 개인 성과·이익보다 팀(파트) 목표 달성을 우선시한다", "동료 간 토론 기회 제공, 다양한 의견 제시 등 적극 참여·소통한다", "팀 내 인간관계·갈등을 앞장서 해결해 우호적이고 강한 팀 의식을 조성한다"],
      충족: ["팀의 목표·기능을 정확히 이해한다", "수시로 아이디어·의견을 제시해 팀(파트) 의사결정·계획 수립을 돕는다", "회사·팀(파트)의 다양한 활동에 적극 참여한다", "팀이 효과적으로 일하도록 자발적으로 협력한다"],
      노력필요: ["자신의 편익만 고려한다", "팀(파트)에서 발생한 갈등을 방치하고 모르는 척한다", "동료를 존중·배려하지 않고 부서 내 갈등을 유발한다"] }
  ];

  function evalCommonHtml(assess) {
    assess = assess || null;
    function lv(cls, label, arr) {
      return '<div class="aisum__cmp-lv aisum__cmp-lv--' + cls + '"><span class="aisum__cmp-lvl">' + label + '</span><ul>'
        + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>';
    }
    var body = EVAL_COMMON.map(function (c2) {
      var a = assess && assess[c2.name];
      return '<div class="aisum__cmp">'
        + '<div class="aisum__cmp-head"><b>' + esc(c2.name) + '</b>'
        + (a ? ' <span class="aisum__evbadge aisum__evbadge--' + (a.level === "탁월" ? "good" : a.level === "충족" ? "grow" : "obs") + '">' + esc(a.level) + '</span>' : '')
        + '<span class="aisum__cmp-def">' + esc(c2.def) + '</span></div>'
        + (a && a.note ? '<p class="aisum__evnote">' + esc(a.note) + '</p>' : '')
        + lv("top", "탁월", c2["탁월"]) + lv("meet", "충족", c2["충족"]) + lv("need", "노력필요", c2["노력필요"])
        + '</div>';
    }).join("");
    var note = assess ? ' <span class="aisum__evtag">면담기록 대조</span>' : ' <span class="muted">(참고)</span>';
    return '<details class="aisum__eval aisum__eval--cmp"' + (assess ? ' open' : '') + '><summary>📋 공통 역량 평가 기준 (전 크루)' + note + '</summary>'
      + '<div class="aisum__cmp-body">' + body + '</div></details>';
  }

  function summaryDimBlock(name, dm, labels) {
    var L = labels || ["장점", "누락 / 개선", "지원방향"];
    function list(items, cls, lbl, mark) {
      if (!items || !items.length) return "";
      return '<div class="aisum__box aisum__box--' + cls + '"><h5>' + mark + ' ' + lbl + '</h5><ul>'
        + items.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>';
    }
    var inner = list(dm.good, "good", L[0], "▲")
      + list(dm.gap, "gap", L[1], "●")
      + list(dm.support, "sup", L[2], "◆");
    if (!inner) return "";
    return '<div class="aisum__dim"><h4>' + esc(name) + '</h4><div class="aisum__grid">' + inner + '</div></div>';
  }

  function crewSummaryCard(c) {
    var nick = crewNickname(c.name);
    var sum = (window.CREW_SUMMARY || {})[nick];
    // 면담일지(시트) + 앱 면담기록을 모두 취합
    var stats = crewCombinedStats(c);
    var srcLabel = (stats && stats.src) || "면담일지+면담기록";
    var dataReady = !!(window.JOURNAL && window.JOURNAL.tabs);

    // 요약도 통계도 없고 데이터도 다 실렸으면 안내 문구.
    if (!sum && !stats && dataReady) {
      return '<div class="placeholder placeholder--sm"><p class="muted">'
        + '면담일지·면담기록이 없어 AI 지원가이드를 만들 수 없습니다.<br>'
        + '<span class="muted">기록이 쌓이면 매주 자동으로 요약이 생성됩니다.</span></p></div>';
    }

    var head = '<button type="button" class="aisum__head" id="crewSummaryToggle" aria-expanded="' + (crewSummaryOpen ? "true" : "false") + '">'
      + '<span class="aisum__title">🤖 AI 지원가이드'
      + (sum && sum.tag ? ' <span class="aisum__tag' + (sum.risk ? ' aisum__tag--risk' : '') + '">' + esc(sum.tag) + '</span>' : '')
      + '</span>';

    var chips = "";
    if (stats) {
      chips = '<span class="aisum__stats">'
        + '<span class="aisum__chip">기록 <b>' + stats.count + '</b>건</span>'
        + (stats.first ? '<span class="aisum__chip">' + esc(stats.first.slice(0, 7)) + ' ~ ' + esc(stats.last.slice(0, 7)) + '</span>' : '')
        + (stats.late ? '<span class="aisum__chip aisum__chip--warn">지각 언급 <b>' + stats.late + '</b></span>' : '')
        + '</span>';
    } else if (!dataReady) {
      chips = '<span class="aisum__stats"><span class="aisum__chip">통계 불러오는 중…</span></span>';
    }
    head += chips + '<span class="aisum__caret">' + (crewSummaryOpen ? "▾" : "▸") + '</span></button>';

    var body = "";
    if (crewSummaryOpen) {
      body += '<div class="aisum__body">';
      if (sum && sum.headline) body += '<p class="aisum__headline">' + esc(sum.headline) + '</p>';
      var isManager = c.disability !== "장애"; // 비장애 = 장애크루 직무지도·운영 관리자
      // 확인된/핵심 강점
      if (sum && sum.strengths && sum.strengths.length) {
        body += '<div class="aisum__strengths"><span class="aisum__strengths-lbl">' + (isManager ? "확인된 강점" : "핵심 강점") + '</span>'
          + sum.strengths.map(function (s) { return '<span class="aisum__strength">★ ' + esc(s) + '</span>'; }).join("")
          + '</div>';
      }
      if (stats && stats.cats.length) {
        body += '<div class="aisum__cats">' + stats.cats.slice(0, 8).map(function (x) {
          return '<span class="aisum__cat">' + esc(x.k) + ' <b>' + x.v + '</b></span>';
        }).join("") + '</div>';
      }

      // 성장 포인트 (직전 연말 대비 · 장애/비장애 공통 · 연도 자동)
      var gY = (sum && (sum.growthYear || sum.growth2026)) || null; // growth2026: 구버전 폴백
      if (gY && ((gY.points && gY.points.length) || gY.summary)) {
        var gyr = parseInt(gY.year, 10) || (new Date()).getFullYear();
        body += '<div class="aisum__growth">'
          + '<h4 class="aisum__growth-h">🌱 ' + gyr + '년 성장 포인트 <span class="aisum__dtype">’' + String(gyr - 1).slice(-2) + '년 말 대비</span></h4>';
        if (gY.summary) body += '<p class="aisum__growth-sum">' + esc(gY.summary) + '</p>';
        if (gY.points && gY.points.length) {
          body += '<div class="aisum__growth-list">' + gY.points.map(function (p) {
            return '<div class="aisum__growth-row">'
              + (p.area ? '<span class="aisum__growth-area">' + esc(p.area) + '</span>' : '')
              + '<span class="aisum__growth-ba">'
              + '<span class="aisum__growth-before">' + esc(p.before || "—") + '</span>'
              + '<span class="aisum__growth-arrow">→</span>'
              + '<span class="aisum__growth-after">' + esc(p.after || "") + '</span>'
              + '</span></div>';
          }).join("") + '</div>';
        }
        body += '</div>';
      }

      if (isManager) {
        /* ---- 비장애 = 직무지도·운영 관리자 성장 지원 가이드 (인사평가 아님) ---- */
        var hasNew = !!(sum && (sum.level || (sum.leaderSupport && sum.leaderSupport.length) || sum.coreGoal));
        if (hasNew) {
          var mrole = (sum && sum.role) || c.role || "";
          if (mrole || sum.level) {
            body += '<div class="aisum__mgrbadges">'
              + (mrole ? '<span class="aisum__rolebadge">' + esc(mrole) + '</span>' : '')
              + (sum.level ? '<span class="aisum__level aisum__level--' + levelClass(sum.level) + '">' + esc(sum.level) + '</span>' : '')
              + '</div>';
          }
          if (sum.coreGoal) body += '<p class="aisum__goal"><span class="aisum__goal-lbl">핵심 목표</span> ' + esc(sum.coreGoal) + '</p>';
          if (sum.growthAreas && sum.growthAreas.length) {
            body += '<div class="aisum__dim"><h4>● 성장 필요 영역 <span class="aisum__dtype">행동 기준</span></h4><ul class="aisum__tips">'
              + sum.growthAreas.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>';
          }
          if (sum.leaderSupport && sum.leaderSupport.length) {
            body += '<div class="aisum__dim"><h4>🧭 리더 지원 가이드</h4><div class="aisum__lead">'
              + sum.leaderSupport.map(function (s) {
                return '<div class="aisum__leadrow">' + (s.method ? '<span class="aisum__method">' + esc(s.method) + '</span>' : '')
                  + '<span>' + esc(s.action) + '</span></div>';
              }).join("") + '</div></div>';
          }
          if (sum.nextCheck && sum.nextCheck.length) {
            body += '<div class="aisum__dim"><h4>🔎 다음 면담 확인사항</h4><ul class="aisum__tips">'
              + sum.nextCheck.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>';
          }
          if (sum.supportIntensity) {
            var isteps = ["직접지원", "방법지원", "코칭", "결과리뷰", "모니터링", "권한위임"];
            var icur = isteps.indexOf(sum.supportIntensity);
            body += '<div class="aisum__dim"><h4>지원 강도</h4><div class="aisum__intensity">'
              + isteps.map(function (s, i) { return '<span class="aisum__istep' + (i === icur ? " is-on" : (i < icur ? " is-past" : "")) + '">' + esc(s) + '</span>'; }).join("")
              + '</div></div>';
          }
        } else if (sum && (sum.roadmap || sum.competencies)) {
          /* 미마이그레이션 폴백: 기존 로드맵/역량 표시 */
          if (sum.roadmap && sum.roadmap.length) {
            body += '<div class="aisum__dim"><h4>🎯 성장 로드맵</h4><div class="aisum__road">'
              + sum.roadmap.map(function (r) { return '<div class="aisum__roadrow"><span class="aisum__roadstage">' + esc(r.stage) + '</span><span>' + esc(r.item) + '</span></div>'; }).join("") + '</div></div>';
          }
          if (sum.competencies) {
            var morder = ["장애 이해·감수성", "직무지도·행동지원", "소통·정서지원", "서비스 운영·품질", "협업·리더십", "자기관리·전문성"];
            Object.keys(sum.competencies).sort(function (x, y) { var ix = morder.indexOf(x), iy = morder.indexOf(y); return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy); }).forEach(function (k) { body += summaryDimBlock(k, sum.competencies[k], ["강점", "보완점", "성장방향"]); });
          }
        }
      } else {
        /* ---- 장애 크루 (지원 중심) ---- */
        if (sum && sum.attendance) {
          var a = sum.attendance;
          body += '<div class="aisum__dim"><h4>근태 — 지각 타임라인</h4><div class="aisum__tl">'
            + (a.timeline || []).map(function (t) {
              return '<p class="aisum__tlrow' + (t.flag ? ' is-flag' : '') + '"><span class="aisum__tld">'
                + esc(t.date) + '</span><span>' + esc(t.note) + '</span></p>';
            }).join("")
            + '</div>' + (a.summary ? '<p class="aisum__note">' + esc(a.summary) + '</p>' : '') + '</div>';
        }
        if (sum && sum.triggers && sum.triggers.length) {
          body += '<div class="aisum__dim"><h4>⚠ 위기신호 · 트리거 &amp; 대응</h4><div class="aisum__triggers">'
            + sum.triggers.map(function (t) {
              return '<div class="aisum__trigger"><span class="aisum__trig-sig">' + esc(t.signal) + '</span>'
                + '<span class="aisum__trig-arrow">→</span><span class="aisum__trig-res">' + esc(t.response) + '</span></div>';
            }).join("") + '</div></div>';
        }
        if (sum && sum.disabilityTips && sum.disabilityTips.length) {
          var dtype = (c.disabilityType || c.disability || "").trim();
          body += '<div class="aisum__dim"><h4>장애특성 맞춤 지원'
            + (dtype ? ' <span class="aisum__dtype">' + esc(dtype) + '</span>' : '') + '</h4><ul class="aisum__tips">'
            + sum.disabilityTips.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>';
        }
        if (sum && sum.dimensions) {
          var order = ["성향", "건강", "업무 발전도", "대인관계"];
          Object.keys(sum.dimensions).sort(function (x, y) {
            var ix = order.indexOf(x), iy = order.indexOf(y);
            return (ix < 0 ? 99 : ix) - (iy < 0 ? 99 : iy);
          }).forEach(function (k) { body += summaryDimBlock(k, sum.dimensions[k]); });
        }
        // 상담·직무지도 지원 멘트 예시 (장애 크루)
        if (sum && sum.supportScripts && sum.supportScripts.length) {
          body += '<div class="aisum__dim"><h4>💬 지원 멘트 예시 <span class="aisum__dtype">상담·직무지도</span></h4><div class="aisum__scripts">'
            + sum.supportScripts.map(function (s) {
              return '<div class="aisum__script">'
                + (s.situation ? '<span class="aisum__script-sit">' + esc(s.situation) + '</span>' : '')
                + '<p class="aisum__script-line">' + esc(s.script) + '</p></div>';
            }).join("") + '</div></div>';
        }
      }
      // 평가 기준(참고/면담대조) 하단 접이식 — 파트·장애여부별 + 전 크루 공통
      var evalR = null, evalT = "";
      if (c.group === "스낵" && isManager) { evalR = EVAL_SNACK; evalT = "📋 스낵 비장애 크루 평가 기준"; }
      else if (c.group === "스낵" && !isManager) { evalR = EVAL_SNACK_DIS; evalT = "📋 스낵 장애 크루 평가 기준 (수습·정규전환)"; }
      else if (c.group === "가든" && !isManager) { evalR = EVAL_GARDEN_DIS; evalT = "📋 가든(조경) 장애 크루 평가 기준 (수습)"; }
      if (evalR) body += evalRubricHtml(evalR, evalT, sum && sum.evalMap);
      body += evalCommonHtml(sum && sum.evalCommon);
      if (!sum) body += '<p class="aisum__pending">아직 이 크루의 AI 요약이 생성되지 않았습니다. 위 통계는 ' + srcLabel + '에서 실시간 집계한 값입니다.</p>';
      else if (sum.updated) body += '<p class="aisum__meta">요약 생성일 ' + esc(sum.updated) + ' · ' + srcLabel + ' 기반</p>';
      body += '</div>';
    }
    return '<section class="aisum' + (sum && sum.risk ? ' aisum--risk' : '') + '">' + head + body + '</section>';
  }

  function crewTabPanel(c, tab) {
    if (tab === "interview") return crewInterviewBoard(c);
    if (tab === "attendance") return crewAttendanceBoard(c);
    if (tab === "leave") return crewLeaveBoard(c);
    if (tab === "change") return crewHrChangeBoard(c);
    if (tab === "ai") return crewSummaryCard(c);
    if (tab !== "basic") {
      return '<div class="placeholder placeholder--sm"><p class="muted">이 탭은 준비 중입니다.</p></div>';
    }
    return '<div class="detail-grid">'
      + detailField("이름", c.name)
      + detailField("소속팀", c.team || c.group)
      + detailField("계약현황", c.contractType)
      + (c.contractType === "단기계약" ? detailField("계약 종료일", c.contractEndDate) : "")
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
      + (c.status === "퇴사" ? detailField("퇴사일", c.leftDate) : "")
      + '</div>';
  }
  function detailField(label, value) {
    return '<div class="detail-fld"><span class="detail-fld__label">' + esc(label) + '</span>'
      + '<span class="detail-fld__value">' + esc(value || "—") + '</span></div>';
  }

  /* ---------- 연차관리 탭 (올해 중심 + 작년 비교) ---------- */
  function leaveStageSub(st, hourTag) {
    if (st.stage === "hireYear") return "만근 시 매월 1일씩";
    if (st.stage === "secondYear") return hourTag;
    if (st.stage === "flat") return "3년차 이상 · 연 15일 정액";
    return "입사 전";
  }
  function leaveHeroCard(label, num, sub, hot) {
    return '<div class="leave__card' + (hot ? ' leave__card--hot' : '') + '">'
      + '<span class="leave__lbl">' + label.replace(/(\d{4})/, '<b>$1</b>') + ' 사용 가능</span>'
      + '<span class="leave__num">' + esc(num) + '<em>일</em></span>'
      + '<span class="leave__sub">' + esc(sub) + '</span></div>';
  }
  function leaveBreakdown(c, secondYear, st, hourTag, title) {
    var join = d(c.joinDate), jm = join.getMonth(), hireY = join.getFullYear();
    return '<h4 class="leave__h">📐 ' + esc(title) + '</h4>'
      + '<div class="leave__steps">'
      + leaveStep("①", "입사년 월차", "입사 후 만근 매월 1일씩 (" + hireY + "년 내)", (11 - jm) + "일", false)
      + leaveStep("②", "2년차 월차 <em>계약연장 전</em>", secondYear + "년 만근 매월 1일씩", st.monthly + "일", false)
      + leaveStep("③", "2년차 연차 <em>계약연장 후</em>", "(입사년 재직일 " + st.daysWorked + " ÷ 365) × 15", st.prorated + "일", false)
      + leaveStep("=", secondYear + "년 총 연차", "② + ③ = " + st.raw + "일 → " + hourTag, fmtLeave(st.days) + "일", true)
      + '</div>';
  }

  function crewLeaveBoard(c) {
    if (!c || !c.joinDate) return '<div class="leave"><div class="leave__empty"><span>🗓️</span><p>입사일 정보가 없어 연차를 계산할 수 없어요.<br>크루 정보 <b>수정</b>에서 입사일을 입력해주세요.</p></div></div>';
    var join = d(c.joinDate);
    if (!join || isNaN(join.getTime())) return '<div class="leave"><div class="leave__empty"><span>🗓️</span><p>입사일 형식을 확인해주세요.</p></div></div>';

    var curYear = d(TODAY).getFullYear(), prevYear = curYear - 1, hy = join.getFullYear();
    var cur = leaveForYear(c, curYear), prev = leaveForYear(c, prevYear);
    var hourTag = isFourHourCrew(c.workHours) ? "4시간 크루 · 반차 없음(1일 올림)" : "8시간 크루 · 반차 0.5일 올림";
    var nthYear = curYear - hy + 1;

    var hero;
    if (prev.stage === "before") {
      hero = '<div class="leave__hero leave__hero--solo">'
        + leaveHeroCard("올해 " + curYear, fmtLeave(cur.days), leaveStageSub(cur, hourTag), true)
        + '</div><div class="leave__delta">🎉 올해 입사 · 첫 해 연차입니다</div>';
    } else {
      var delta = round2(cur.days - prev.days), dtxt;
      if (cur.stage === "flat" && prev.stage === "secondYear") dtxt = "🎉 올해부터 <b>연 15일 정액</b> (" + nthYear + "년차) · 작년 대비 +" + fmtLeave(delta) + "일";
      else if (delta > 0) dtxt = "작년보다 <b>+" + fmtLeave(delta) + "일</b> 늘었어요";
      else if (delta < 0) dtxt = "작년보다 <b>" + fmtLeave(delta) + "일</b>";
      else dtxt = "작년과 <b>동일</b>";
      hero = '<div class="leave__hero">'
        + leaveHeroCard("작년 " + prevYear, fmtLeave(prev.days), leaveStageSub(prev, hourTag), false)
        + leaveHeroCard("올해 " + curYear, fmtLeave(cur.days), leaveStageSub(cur, hourTag), true)
        + '</div><div class="leave__delta">' + dtxt + '</div>';
    }

    var facts = '<div class="leave__facts">'
      + leaveFact("입사일", c.joinDate)
      + leaveFact("근속", tenureOf(c.joinDate))
      + leaveFact("올해", nthYear + "년차")
      + leaveFact("기준", "회계일 = 입사일")
      + '</div>';

    var breakdown;
    if (cur.stage === "secondYear") breakdown = leaveBreakdown(c, curYear, cur, hourTag, "올해(" + curYear + ") 계산 근거");
    else if (prev.stage === "secondYear") breakdown = leaveBreakdown(c, prevYear, prev, hourTag, "작년(" + prevYear + ") 계산 근거 · 참고");
    else if (cur.stage === "hireYear") breakdown = '<h4 class="leave__h">📐 올해(' + curYear + ') 계산 근거</h4>'
        + '<div class="leave__steps">' + leaveStep("①", "입사년 월차", "입사 후 만근 매월 1일씩 (" + curYear + "년 내)", cur.monthly + "일", true) + '</div>';
    else breakdown = '<div class="leave__flat"><span class="leave__flatnum">15<em>일</em></span>'
        + '<div class="leave__flatbody"><b>연 15일 정액</b><p class="muted">' + nthYear + '년차 — 매년 동일하게 15일의 연차가 발생합니다. (근속 가산은 별도 규정)</p></div></div>';

    return '<div class="leave">' + hero + facts + breakdown + leaveRulesHtml() + '</div>';
  }
  function leaveFact(label, val) {
    return '<div class="leave__fact"><span>' + esc(label) + '</span><b>' + esc(val) + '</b></div>';
  }
  function leaveStep(no, title, desc, val, isTotal) {
    return '<div class="leave__step' + (isTotal ? ' leave__step--total' : '') + '">'
      + '<span class="leave__stepno">' + no + '</span>'
      + '<div class="leave__stepbody"><b>' + title + '</b><p>' + desc + '</p></div>'
      + '<span class="leave__stepval">' + esc(val) + '</span>'
      + '</div>';
  }
  function leaveRulesHtml() {
    return '<div class="leave__rules">'
      + '<p class="leave__rulehead">📋 연차 발생 규칙 <span>2년차 이하 · 입사 후 1년 · 회계일 기준</span></p>'
      + '<ul>'
        + '<li>입사년: 만근 기준 매월 1일씩 발생</li>'
        + '<li>2년차 월차: 만근 기준 매월 1일씩 발생</li>'
        + '<li>2년차 연차: (입사년 재직일 ÷ 365) × 15일</li>'
        + '<li>3년차부터는 동일하게 연 15일 발생</li>'
      + '</ul>'
      + '<p class="leave__note">※ <b>4시간 크루</b>(반차 없음): 소수점 발생 시 1일로 올림 · <b>8시간 크루</b>(반차 있음): 0.5일로 올림</p>'
      + '</div>';
  }

  /* ---------- 면담 기록 게시판 행 (크루 상세 탭 · 전체 목록 공용) ----------
     crewCell : 6열(전체 목록) 표에서 첫 행에만 넘기는 <td rowspan> HTML.
                생략하면(크루 상세 탭 · 그룹 내 이어지는 행) 크루 칸 없이 출력. */
  function interviewBoardRow(r, crewCell) {
    var cond = condOf(r.condition);
    var issueDot = r.type === "근무 이슈" ? '<span class="board__issue-dot" title="근무 이슈"></span>' : '';
    var flags = "";
    if (r.followUp === "필요") flags += '<span class="board__flag board__flag--follow" title="' + esc(r.followUpNote || "후속 조치 필요") + '">후속</span>';
    if (r.privateNote) flags += '<span class="board__flag board__flag--private" title="비공개 메모">🔒</span>';
    return '<tr class="board__row" data-iv-id="' + esc(r.id || "") + '">'
      + (crewCell || '')
      + '<td class="board__date mono">' + fmtDotDate(r.date) + (r.time ? '<span class="board__time"> · ' + esc(r.time) + '</span>' : '') + '</td>'
      + '<td class="board__type">' + esc(r.type) + issueDot + '</td>'
      + '<td class="board__cond"><span class="board__conddot" style="background:' + cond.c + '"></span>' + esc(r.condition) + '</td>'
      + '<td class="board__content"><span class="board__ctext">' + esc(r.content || "—") + '</span></td>'
      + '<td class="board__flags">' + (flags || '<span class="muted">—</span>') + '</td>'
      + '</tr>';
  }

  /* 같은 크루의 기록이 2건 이상이면 하나의 그룹(rowspan)으로 묶어서 출력
     이름(crewName) 기준으로 묶는다 — crewId는 과거 데이터에서 값이 비어있거나
     레코드마다 다르게 저장된 경우가 있어 그룹핑 기준으로 신뢰할 수 없다. */
  function groupedInterviewRowsHTML(rows) {
    var order = [];
    var map = {};
    rows.forEach(function (r) {
      var key = (r.crewName && r.crewName.trim()) || r.crewId || "—";
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
    form.contractEndDate.value = (prefill && prefill.contractEndDate) || "";
    el.querySelector("#crewContractEndWrap").hidden = form.contractType.value !== "단기계약";
    form.workHours.value = (prefill && prefill.workHours) || "";
    form.joinDate.value = (prefill && prefill.joinDate) || "";
    form.leftDate.value = (prefill && prefill.leftDate) || "";
    el.querySelector("#crewLeftDateWrap").hidden = form.status.value !== "퇴사";
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
      + '<label class="fld" id="crewLeftDateWrap" hidden><span>퇴사일</span><input type="date" name="leftDate"></label>'
      + '<label class="fld" id="crewContractEndWrap" hidden><span>계약 종료일</span><input type="date" name="contractEndDate"></label>'
      + '<div class="fld-row--3">'
        + '<label class="fld"><span>비상연락처 <em>(선택)</em></span><input type="text" name="emergencyContact" placeholder="010-0000-0000"></label>'
        + '<label class="fld"><span>장애여부</span><select name="disability">' + CREW_DISABILITY.map(function (t) { return '<option value="' + t + '">' + t + '</option>'; }).join("") + '</select></label>'
        + '<label class="fld"><span>장애유형 <em>(선택)</em></span><input type="text" name="disabilityType" placeholder="발달장애 등"></label>'
      + '</div>'
      + '<div class="fld-row--3">'
        + '<label class="fld"><span>청구사</span><input type="text" name="site" maxlength="30" placeholder="판교 오아시스"></label>'
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
    wrap.querySelector('select[name="status"]').addEventListener("change", function (ev) {
      wrap.querySelector("#crewLeftDateWrap").hidden = ev.target.value !== "퇴사";
    });
    wrap.querySelector('select[name="contractType"]').addEventListener("change", function (ev) {
      wrap.querySelector("#crewContractEndWrap").hidden = ev.target.value !== "단기계약";
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
        leftDate: f.status.value === "퇴사" ? f.leftDate.value : "",
        phone: f.phone.value.trim(), site: f.site.value.trim(),
        duties: toArr(f.duties.value), note: f.note.value.trim(),
        contractType: f.contractType.value, workHours: f.workHours.value.trim(),
        contractEndDate: f.contractType.value === "단기계약" ? f.contractEndDate.value : "",
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
  var ivAnchor = TODAY;   // 면담 & 근무기록 목록에서 보고 있는 기준 월/년
  var ivMode = "month";   // "month" | "year"

  function ivScopeLabel() { return ivMode === "year" ? (+ivAnchor.slice(0, 4)) + "년" : monthLabel(ivAnchor); }

  function fmtDotDate(iso) {
    if (!iso) return "—";
    var p = iso.split("-");
    if (p.length < 3) return iso;
    return p[0] + "." + p[1] + "." + p[2] + " <small>" + WD[wd(iso)] + "</small>";
  }

  function interviewsInScope() {
    if (ivMode === "year") {
      var y = ivAnchor.slice(0, 4);
      return (window.INTERVIEWS || []).filter(function (r) { return (r.date || "").slice(0, 4) === y; });
    }
    var ym = ivAnchor.slice(0, 7);
    return (window.INTERVIEWS || []).filter(function (r) { return (r.date || "").slice(0, 7) === ym; });
  }

  function filteredInterviews() {
    var list = interviewsInScope();
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
    var all = interviewsInScope();
    var followCnt = all.filter(function (r) { return r.followUp === "필요"; }).length;
    var worryCnt = all.filter(function (r) { return r.condition === "우려됨"; }).length;

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Crew / Interview</p>'
      + '<h2>면담 &amp; 근무기록</h2>'
      + '<p class="sub">크루 면담과 근무 관련 기록을 시간순으로. <span class="muted">🔒 비공개 메모는 기록자 참고용입니다.</span></p></div>'
      + '<button class="btn btn--primary" id="addInterviewBtn">+ 기록 등록</button>'
      + '</div>';

    html += '<div class="month-nav">'
      + '<div class="month-nav__nav">'
        + '<button class="iconbtn" data-iv-nav="-1" aria-label="이전">&larr;</button>'
        + '<span class="month-nav__label">' + ivScopeLabel() + '</span>'
        + '<button class="iconbtn" data-iv-nav="1" aria-label="다음">&rarr;</button>'
      + '</div>'
      + '<div class="seg month-nav__seg">'
        + '<button class="btn btn--sm ' + (ivMode === "month" ? "is-on" : "") + '" data-iv-mode="month">월간</button>'
        + '<button class="btn btn--sm ' + (ivMode === "year" ? "is-on" : "") + '" data-iv-mode="year">' + ivAnchor.slice(0, 4) + '년</button>'
      + '</div>'
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
  var attAnchor = TODAY;    // 근태 기록 목록에서 보고 있는 기준 월/년
  var attMode = "month";    // "month" | "year"

  function monthLabel(iso) { var p = iso.split("-"); return +p[0] + "년 " + +p[1] + "월"; }
  function attScopeLabel() { return attMode === "year" ? (+attAnchor.slice(0, 4)) + "년" : monthLabel(attAnchor); }

  function attendanceInScope() {
    if (attMode === "year") {
      var y = attAnchor.slice(0, 4);
      return (window.ATTENDANCE || []).filter(function (r) { return (r.date || "").slice(0, 4) === y; });
    }
    var ym = attAnchor.slice(0, 7);
    return (window.ATTENDANCE || []).filter(function (r) { return (r.date || "").slice(0, 7) === ym; });
  }

  function filteredAttendance() {
    var list = attendanceInScope();
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

  /* ---------- 근태 기록 게시판 행 (크루 상세 탭 · 전체 목록 공용) ----------
     crewCell : 6열(전체 목록) 표에서 첫 행에만 넘기는 <td rowspan> HTML.
                생략하면(크루 상세 탭 · 그룹 내 이어지는 행) 크루 칸 없이 출력. */
  function attendanceBoardRow(r, crewCell) {
    var kind = attKindOf(r.kind);
    return '<tr class="board__row" data-att-id="' + esc(r.id || "") + '">'
      + (crewCell || '')
      + '<td class="board__date mono">' + fmtDotDate(r.date) + '</td>'
      + '<td class="board__cond"><span class="board__conddot" style="background:' + kind.c + '"></span>' + esc(r.kind) + '</td>'
      + '<td class="board__type mono">' + esc(r.time || "—") + '</td>'
      + '<td class="board__content"><span class="board__ctext">' + esc(r.reason || "—") + '</span></td>'
      + '<td class="board__recorder muted">' + esc(r.recorder || "—") + '</td>'
      + '</tr>';
  }

  /* 같은 크루의 근태 기록이 2건 이상이면 하나의 그룹(rowspan)으로 묶어서 출력
     이름(crewName) 기준으로 묶는다 — crewId는 신뢰할 수 없는 경우가 있다. */
  function groupedAttendanceRowsHTML(rows) {
    var order = [];
    var map = {};
    rows.forEach(function (r) {
      var key = (r.crewName && r.crewName.trim()) || r.crewId || "—";
      if (!map[key]) { map[key] = { crewName: r.crewName, rows: [] }; order.push(key); }
      map[key].rows.push(r);
    });
    return order.map(function (key) {
      var g = map[key];
      return g.rows.map(function (r, i) {
        if (i !== 0) return attendanceBoardRow(r);
        var crewCell = '<td class="board__crew"' + (g.rows.length > 1 ? ' rowspan="' + g.rows.length + '"' : '') + '>'
          + '<b>' + esc(g.crewName || "—") + '</b>'
          + (g.rows.length > 1 ? '<span class="board__crew__n">' + g.rows.length + '건</span>' : '')
          + '</td>';
        return attendanceBoardRow(r, crewCell);
      }).join("");
    }).join("");
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

    var body = rows.map(function (r) { return attendanceBoardRow(r); }).join("");

    return '<div class="board">' + head
      + '<div class="board__scroll"><table class="board__table"><thead><tr>'
      + '<th>날짜</th><th>구분</th><th>시간</th><th>사유</th><th>기록자</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>'
      + '</div>';
  }

  function renderAttendance() {
    var all = attendanceInScope();

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Crew / Attendance</p>'
      + '<h2>근태 기록</h2>'
      + '<p class="sub">크루의 지각 · 결근 · 조퇴 · 병가 등 근태 기록을 시간순으로. <span class="muted">구분 카드를 누르면 해당 인원을 볼 수 있어요.</span></p></div>'
      + '<button class="btn btn--primary" id="addAttendanceBtn">+ 근태 기록</button>'
      + '</div>';

    html += '<div class="month-nav">'
      + '<div class="month-nav__nav">'
        + '<button class="iconbtn" data-at-nav="-1" aria-label="이전">&larr;</button>'
        + '<span class="month-nav__label">' + attScopeLabel() + '</span>'
        + '<button class="iconbtn" data-at-nav="1" aria-label="다음">&rarr;</button>'
      + '</div>'
      + '<div class="seg month-nav__seg">'
        + '<button class="btn btn--sm ' + (attMode === "month" ? "is-on" : "") + '" data-at-mode="month">월간</button>'
        + '<button class="btn btn--sm ' + (attMode === "year" ? "is-on" : "") + '" data-at-mode="year">' + attAnchor.slice(0, 4) + '년</button>'
      + '</div>'
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
      + (rows.length ? groupedAttendanceRowsHTML(rows)
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

    var rows = attendanceInScope().filter(function (r) { return r.kind === kind; })
      .sort(function (a, b) {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1;
        return (a.time || "") < (b.time || "") ? 1 : -1;
      });

    el.querySelector("#akModalTitle").textContent = kind + " · " + attScopeLabel();
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
      + '<div class="board__scroll"><table class="board__table board__table--ak"><thead><tr>'
      + '<th>크루</th><th>날짜</th><th>시간</th><th>사유</th>'
      + '</tr></thead><tbody id="akModalBody"></tbody></table></div>'
      + '</div>';
    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) closeAttendanceKindModal();
    });
    return wrap;
  }

  /* ======================================================
     HR CHANGE · 인사 변동 (입사 · 퇴사 · 휴직 · 복직 · 파트이동 · 직급변경 · 기타)
     ====================================================== */
  var HR_CHANGE_TYPES = [
    { key: "입사", c: "var(--green)" },
    { key: "퇴사", c: "var(--red)" },
    { key: "휴직", c: "var(--amber)" },
    { key: "복직", c: "#60a5fa" },
    { key: "파트이동", c: "#b39dff" },
    { key: "직급변경", c: "#f472b6" },
    { key: "기타", c: "var(--slate)" },
  ];
  function hcTypeOf(t) { for (var i = 0; i < HR_CHANGE_TYPES.length; i++) if (HR_CHANGE_TYPES[i].key === t) return HR_CHANGE_TYPES[i]; return HR_CHANGE_TYPES[HR_CHANGE_TYPES.length - 1]; }
  function hcTypeLabel(r) { return (r.type === "기타" && r.typeLabel) ? r.typeLabel : r.type; }
  function hcChangeText(r) {
    if (r.before && r.after) return esc(r.before) + ' → ' + esc(r.after);
    if (r.after) return esc(r.after);
    if (r.before) return esc(r.before);
    return '—';
  }

  /* ---------- 파트별 이직률 (연도 기준) ----------
     이직률 = 해당 연도 퇴사자 수 / 해당 연도 평균 재직인원 × 100
     평균 재직인원 = (연초 재직인원 + 연말(또는 오늘) 재직인원) / 2
     크루의 소속 그룹은 "현재" 값을 기준으로 집계한다(과거 시점 그룹 변경 이력은 반영하지 않음). */
  function hcCrewActiveAt(c, dateISO) {
    if (!c.joinDate || c.joinDate > dateISO) return false;
    if (c.leftDate && c.leftDate <= dateISO) return false;
    return true;
  }
  function turnoverStatsOf(list, year) {
    var startISO = year + "-01-01";
    var endISO = year === TODAY.slice(0, 4) ? TODAY : year + "-12-31";
    var startCount = list.filter(function (c) { return hcCrewActiveAt(c, startISO); }).length;
    var endCount = list.filter(function (c) { return hcCrewActiveAt(c, endISO); }).length;
    var avg = (startCount + endCount) / 2;
    var left = list.filter(function (c) { return c.status === "퇴사" && c.leftDate && c.leftDate.slice(0, 4) === year; }).length;
    var rate = avg > 0 ? Math.round((left / avg) * 1000) / 10 : 0;
    return { left: left, avg: avg, rate: rate };
  }
  function turnoverStats(year) {
    var crew = window.CREW || [];
    var out = { "전체": turnoverStatsOf(crew, year) };
    CREW_GROUPS.forEach(function (g) {
      out[g] = turnoverStatsOf(crew.filter(function (c) { return c.group === g; }), year);
    });
    return out;
  }
  function turnoverCardsHTML(year) {
    var t = turnoverStats(year);
    return '<div class="stats">' + ["전체"].concat(CREW_GROUPS).map(function (k) {
      var s = t[k];
      return statCard("", s.rate, "%", k + " 이직률", s.left + "명 · 평균 " + s.avg.toFixed(1) + "명");
    }).join("") + '</div>';
  }

  var hcTypeFilter = "전체";
  var hcCrewFilter = "전체"; // "전체" | crewId — 현재 크루 목록 기준으로 특정 크루만 골라보기
  var hcQuery = "";
  var hcAnchor = TODAY;    // 인사 변동 목록에서 보고 있는 기준 월/년
  var hcMode = "month";    // "month" | "year"

  function hcScopeLabel() { return hcMode === "year" ? (+hcAnchor.slice(0, 4)) + "년" : monthLabel(hcAnchor); }

  /* 2023년부터의 이력이 계속 누적되는 구조 — 월/연 네비게이션으로 원하는 시점을 조회 */
  function hrChangesInScope() {
    if (hcMode === "year") {
      var y = hcAnchor.slice(0, 4);
      return (window.HR_CHANGES || []).filter(function (r) { return (r.date || "").slice(0, 4) === y; });
    }
    var ym = hcAnchor.slice(0, 7);
    return (window.HR_CHANGES || []).filter(function (r) { return (r.date || "").slice(0, 7) === ym; });
  }

  function filteredHrChanges() {
    var list = hrChangesInScope().filter(function (r) {
      if (hcTypeFilter !== "전체" && r.type !== hcTypeFilter) return false;
      if (hcCrewFilter !== "전체" && String(r.crewId) !== String(hcCrewFilter)) return false;
      if (hcQuery) {
        var hay = (r.crewName + hcTypeLabel(r) + r.before + r.after + r.reason + r.recorder).toLowerCase();
        if (hay.indexOf(hcQuery.toLowerCase()) === -1) return false;
      }
      return true;
    });
    return list.sort(function (a, b) { return (a.date || "") < (b.date || "") ? 1 : -1; });
  }

  /* ---------- 인사 변동 게시판 행 (크루 상세 탭 · 전체 목록 공용) ----------
     crewCell : 6열(전체 목록) 표에서 첫 행에만 넘기는 <td rowspan> HTML.
                생략하면(크루 상세 탭 · 그룹 내 이어지는 행) 크루 칸 없이 출력. */
  function hrChangeBoardRow(r, crewCell) {
    var t = hcTypeOf(r.type);
    return '<tr class="board__row" data-hc-id="' + esc(r.id || "") + '">'
      + (crewCell || '')
      + '<td class="board__date mono">' + fmtDotDate(r.date) + '</td>'
      + '<td class="board__cond"><span class="board__conddot" style="background:' + t.c + '"></span>' + esc(hcTypeLabel(r)) + '</td>'
      + '<td class="board__content"><span class="board__ctext">' + hcChangeText(r) + '</span></td>'
      + '<td class="board__content"><span class="board__ctext">' + esc(r.reason || "—") + '</span>' + hcLinkChip(r) + '</td>'
      + '<td class="board__recorder muted">' + esc(r.recorder || "—") + '</td>'
      + '</tr>';
  }

  function hcLinkChip(r) {
    return r.link ? ' <a class="link-chip" href="' + esc(r.link) + '" target="_blank" rel="noopener" title="링크 열기">🔗</a>' : "";
  }

  /* 같은 크루의 변동 기록이 2건 이상이면 하나의 그룹(rowspan)으로 묶어서 출력
     이름(crewName) 기준으로 묶는다 — crewId는 신뢰할 수 없는 경우가 있다. */
  function groupedHrChangeRowsHTML(rows) {
    var order = [];
    var map = {};
    rows.forEach(function (r) {
      var key = (r.crewName && r.crewName.trim()) || r.crewId || "—";
      if (!map[key]) { map[key] = { crewName: r.crewName, rows: [] }; order.push(key); }
      map[key].rows.push(r);
    });
    return order.map(function (key) {
      var g = map[key];
      return g.rows.map(function (r, i) {
        if (i !== 0) return hrChangeBoardRow(r);
        var crewCell = '<td class="board__crew"' + (g.rows.length > 1 ? ' rowspan="' + g.rows.length + '"' : '') + '>'
          + '<b>' + esc(g.crewName || "—") + '</b>'
          + (g.rows.length > 1 ? '<span class="board__crew__n">' + g.rows.length + '건</span>' : '')
          + '</td>';
        return hrChangeBoardRow(r, crewCell);
      }).join("");
    }).join("");
  }

  /* ---------- 크루 상세 · 인사 변동 게시판 ---------- */
  function crewHrChangeBoard(c) {
    var rows = (window.HR_CHANGES || []).filter(function (r) {
      return String(r.crewId) === String(c.id) || (r.crewName && r.crewName === c.name);
    }).sort(function (a, b) { return (a.date || "") < (b.date || "") ? 1 : -1; });

    var head = '<div class="board__head">'
      + '<h3 class="board__title">인사 변동 <span class="chip-mono">' + rows.length + '건</span></h3>'
      + '<button type="button" class="btn btn--sm btn--primary" id="crewAddHrChangeBtn">+ 인사 변동</button>'
      + '</div>';

    if (!rows.length) {
      return '<div class="board">' + head
        + '<div class="board__empty">아직 등록된 인사 변동 이력이 없습니다.<br><span class="muted">우측 상단 <b style="color:var(--accent-text)">+ 인사 변동</b>으로 첫 기록을 남겨보세요.</span></div>'
        + '</div>';
    }

    var body = rows.map(function (r) { return hrChangeBoardRow(r); }).join("");

    return '<div class="board">' + head
      + '<div class="board__scroll"><table class="board__table"><thead><tr>'
      + '<th>날짜</th><th>유형</th><th>내용</th><th>사유</th><th>기록자</th>'
      + '</tr></thead><tbody>' + body + '</tbody></table></div>'
      + '</div>';
  }

  function renderHrChange() {
    var rows = filteredHrChanges();

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Crew / HR Change</p>'
      + '<h2>인사 변동</h2>'
      + '<p class="sub">입사 · 퇴사 · 휴직 · 복직 · 파트이동 · 직급변경 등 인사 변동을 이력으로 남겨두세요.</p></div>'
      + '<div class="page-head__actions">'
        + '<button class="btn btn--ghost" id="hcBackfillBtn">📥 크루 정보로 채우기</button>'
        + '<button class="btn btn--primary" id="addHrChangeBtn">+ 인사 변동</button>'
      + '</div>'
      + '</div>';

    var hcTurnoverYear = hcAnchor.slice(0, 4);
    html += '<div class="board__head" style="padding:0 0 10px;border:none">'
      + '<h3 class="board__title">파트별 이직률 <span class="chip-mono">' + hcTurnoverYear + '년</span></h3>'
      + '</div>';
    html += turnoverCardsHTML(hcTurnoverYear);

    html += '<div class="month-nav">'
      + '<div class="month-nav__nav">'
        + '<button class="iconbtn" data-hc-nav="-1" aria-label="이전">&larr;</button>'
        + '<span class="month-nav__label">' + hcScopeLabel() + '</span>'
        + '<button class="iconbtn" data-hc-nav="1" aria-label="다음">&rarr;</button>'
      + '</div>'
      + '<div class="seg month-nav__seg">'
        + '<button class="btn btn--sm ' + (hcMode === "month" ? "is-on" : "") + '" data-hc-mode="month">월간</button>'
        + '<button class="btn btn--sm ' + (hcMode === "year" ? "is-on" : "") + '" data-hc-mode="year">' + hcAnchor.slice(0, 4) + '년</button>'
      + '</div>'
      + '</div>';

    html += '<div class="toolbar-row">'
      + '<div class="filter" id="hcTypeFilter">' + ["전체"].concat(HR_CHANGE_TYPES.map(function (t) { return t.key; })).map(function (f) {
          return '<button class="btn btn--sm btn--pill ' + (f === hcTypeFilter ? "is-on" : "") + '" data-t="' + f + '">' + f + '</button>';
        }).join("") + '</div>'
      + '<select class="filter-select" id="hcCrewFilter">'
        + '<option value="전체"' + (hcCrewFilter === "전체" ? ' selected' : '') + '>전체 크루</option>'
        + (window.CREW || []).slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) {
            return '<option value="' + esc(c.id) + '"' + (String(c.id) === String(hcCrewFilter) ? ' selected' : '') + '>' + esc(c.name) + (c.group ? ' · ' + esc(c.group) : '') + '</option>';
          }).join("")
      + '</select>'
      + '<input class="searchbox" id="hcSearch" type="search" placeholder="크루 · 유형 · 내용 · 사유 검색" value="' + esc(hcQuery) + '">'
      + '</div>';

    html += '<div class="board">'
      + '<div class="board__head"><h3 class="board__title">인사 변동 <span class="chip-mono">' + rows.length + '건</span></h3></div>'
      + '<div class="board__scroll"><table class="board__table board__table--hc" id="hcTable"><thead><tr>'
      + '<th>크루</th><th>날짜</th><th>유형</th><th>내용</th><th>사유</th><th>기록자</th>'
      + '</tr></thead><tbody id="hcBody">'
      + (rows.length ? groupedHrChangeRowsHTML(rows)
          : '<tr><td colspan="6" class="board__empty">기록이 없습니다. <b style="color:var(--accent-text)">+ 인사 변동</b>으로 첫 이력을 남겨보세요.</td></tr>')
      + '</tbody></table></div>'
      + '</div>';

    view.innerHTML = html;
  }

  /* 인사 변동 저장/삭제 후: 크루 상세를 보고 있으면 상세로, 아니면 목록으로 갱신 */
  function rerenderAfterHrChange() {
    if (crewDetailId) renderCrew(); else renderHrChange();
  }

  function pushHrChangeRecord_(rec) {
    if (!window.HR_CHANGES) window.HR_CHANGES = [];
    window.HR_CHANGES.push(rec);
    saveToSheet({
      type: "hrchange", action: "add",
      id: rec.id, crewId: rec.crewId, crewName: rec.crewName,
      hcType: rec.type, typeLabel: rec.typeLabel, date: rec.date,
      before: rec.before, after: rec.after, reason: rec.reason, recorder: rec.recorder, link: rec.link || ""
    });
  }

  /* 크루 목록의 입사일(joinDate) · 퇴사일(leftDate)을 기준으로, 아직 해당 인사 변동
     기록이 없는 크루만 골라 "입사"/"퇴사" 기록을 일괄 생성한다.
     이미 기록이 있는 크루는 건너뛰므로 여러 번 눌러도 중복되지 않는다.
     퇴사 크루인데 크루 정보에 퇴사일이 비어있으면(크루 수정에서 입력 필요) 건너뛴다. */
  function backfillFromCrewList() {
    var existingByType = { 입사: {}, 퇴사: {} };
    (window.HR_CHANGES || []).forEach(function (r) {
      if (existingByType[r.type] && r.crewId) existingByType[r.type][r.crewId] = true;
    });

    var hireTargets = (window.CREW || []).filter(function (c) { return c.joinDate && !existingByType.입사[c.id]; });
    var leaveTargets = (window.CREW || []).filter(function (c) { return c.status === "퇴사" && c.leftDate && !existingByType.퇴사[c.id]; });
    var missingLeftDate = (window.CREW || []).filter(function (c) { return c.status === "퇴사" && !c.leftDate && !existingByType.퇴사[c.id]; }).length;

    if (!hireTargets.length && !leaveTargets.length) {
      alert(missingLeftDate
        ? "새로 생성할 기록은 없습니다. 다만 퇴사일이 비어있는 퇴사 크루가 " + missingLeftDate + "명 있어요 — 크루 수정에서 퇴사일을 입력한 뒤 다시 눌러주세요."
        : "이미 모든 크루의 입사 · 퇴사 기록이 있습니다.");
      return;
    }

    var parts = [];
    if (hireTargets.length) parts.push("입사 " + hireTargets.length + "명");
    if (leaveTargets.length) parts.push("퇴사 " + leaveTargets.length + "명");
    var msg = parts.join(" · ") + "의 기록을 크루 목록 정보를 기준으로 생성할까요?";
    if (missingLeftDate) msg += "\n(퇴사일이 비어있는 " + missingLeftDate + "명은 이번에 건너뜁니다)";
    if (!confirm(msg)) return;

    hireTargets.forEach(function (c) {
      pushHrChangeRecord_({
        id: newId("hc"), crewId: c.id, crewName: c.name,
        type: "입사", typeLabel: "", date: c.joinDate,
        before: "", after: (c.role || "") + (c.group ? " · " + c.group : ""),
        reason: "크루 목록 입사일 기준 자동 생성", recorder: CURRENT_USER,
      });
    });
    leaveTargets.forEach(function (c) {
      pushHrChangeRecord_({
        id: newId("hc"), crewId: c.id, crewName: c.name,
        type: "퇴사", typeLabel: "", date: c.leftDate,
        before: (c.role || "") + (c.group ? " · " + c.group : ""), after: "퇴사",
        reason: c.note || "크루 목록 퇴사일 기준 자동 생성", recorder: CURRENT_USER,
      });
    });
    renderHrChange();
  }

  /* ---------- 인사 변동 등록/수정 모달 ---------- */
  function openHrChangeModal(prefill) {
    var el = document.getElementById("hrChangeModal");
    if (!el) { el = buildHrChangeModal(); document.body.appendChild(el); }
    var form = el.querySelector("form");
    form.reset();
    var editing = !!(prefill && prefill.id);
    form.dataset.id = editing ? prefill.id : "";
    el.querySelector("#hrChangeModalTitle").textContent = editing ? "인사 변동 수정" : "인사 변동 등록";
    el.querySelector("#hrChangeDelBtn").hidden = !editing;

    var sel = form.crewId;
    sel.innerHTML = '<option value="">크루 선택</option>' + (window.CREW || []).map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.name) + (c.group ? ' · ' + esc(c.group) : '') + '</option>';
    }).join("");

    form.crewId.value = (prefill && prefill.crewId) || "";
    form.date.value = (prefill && prefill.date) || TODAY;
    form.before.value = (prefill && prefill.before) || "";
    form.after.value = (prefill && prefill.after) || "";
    form.reason.value = (prefill && prefill.reason) || "";
    form.link.value = (prefill && prefill.link) || "";
    form.querySelector("#hcRecorder").textContent = (prefill && prefill.recorder) || CURRENT_USER;

    var type = (prefill && prefill.type) || "입사";
    form.type.value = type;
    Array.prototype.forEach.call(el.querySelectorAll(".ivseg__btn"), function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-type") === type);
    });
    form.typeLabel.value = (prefill && prefill.typeLabel) || "";
    el.querySelector("#hcTypeLabelWrap").hidden = type !== "기타";

    el.hidden = false;
    setTimeout(function () { form.crewId.focus(); }, 30);
  }
  function closeHrChangeModal() {
    var el = document.getElementById("hrChangeModal");
    if (el) el.hidden = true;
  }

  function buildHrChangeModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "hrChangeModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop"></div>'
      + '<div class="modal__card modal__card--iv" role="dialog" aria-modal="true" aria-label="인사 변동 등록">'
      + '<div class="modal__head"><h3 id="hrChangeModalTitle">인사 변동 등록</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<form id="hrChangeForm">'
      + '<div class="fld-row">'
        + '<label class="fld"><span>크루 <em>*</em></span><select name="crewId" required></select></label>'
        + '<label class="fld"><span>일자 <em>*</em></span><input type="date" name="date" required></label>'
      + '</div>'
      + '<div class="fld"><span>유형</span>'
        + '<input type="hidden" name="type" value="입사">'
        + '<div class="ivseg">' + HR_CHANGE_TYPES.map(function (t) {
            return '<button type="button" class="ivseg__btn" data-type="' + t.key + '" style="--c:' + t.c + '">' + t.key + '</button>';
          }).join("") + '</div>'
      + '</div>'
      + '<label class="fld" id="hcTypeLabelWrap" hidden><span>유형명 직접 입력 <em>*</em></span><input type="text" name="typeLabel" maxlength="30" placeholder="예) 파견 전환, 직무 재배치 등"></label>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>변경 전 <em>(선택)</em></span><input type="text" name="before" maxlength="60" placeholder="예) 스낵 · 크루"></label>'
        + '<label class="fld"><span>변경 후 <em>(선택)</em></span><input type="text" name="after" maxlength="60" placeholder="예) 가든 · 시니어 크루"></label>'
      + '</div>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>사유 · 메모 <em>(선택)</em></span><input type="text" name="reason" maxlength="120" placeholder="변동 사유를 입력하세요…"></label>'
        + '<div class="fld"><span>기록자</span><div class="iv-recorder" id="hcRecorder">' + esc(CURRENT_USER) + '</div></div>'
      + '</div>'
      + '<label class="fld"><span>링크 <em>(선택 · 입력 시 🔗 버튼 생성)</em></span><input type="url" name="link" placeholder="https://docs.google.com/..."></label>'
      + '<div class="modal__foot">'
        + '<button type="button" class="btn btn--danger" id="hrChangeDelBtn" hidden>삭제</button>'
        + '<div class="modal__spacer"></div>'
        + '<button type="button" class="btn" data-close>취소</button>'
        + '<button type="submit" class="btn btn--primary">저장</button>'
      + '</div>'
      + '</form>'
      + '</div>';

    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) { closeHrChangeModal(); return; }
      var segBtn = ev.target.closest(".ivseg__btn");
      if (segBtn) {
        var form = wrap.querySelector("form");
        var type = segBtn.getAttribute("data-type");
        form.type.value = type;
        Array.prototype.forEach.call(wrap.querySelectorAll(".ivseg__btn"), function (b) { b.classList.toggle("is-on", b === segBtn); });
        wrap.querySelector("#hcTypeLabelWrap").hidden = type !== "기타";
        return;
      }
    });
    wrap.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var crewId = f.crewId.value;
      if (!crewId) { alert("크루를 선택해주세요."); f.crewId.focus(); return; }
      var type = f.type.value || "입사";
      var typeLabel = type === "기타" ? f.typeLabel.value.trim() : "";
      if (type === "기타" && !typeLabel) { alert("유형명을 입력해주세요."); f.typeLabel.focus(); return; }
      var crew = findById(window.CREW || [], crewId);
      var id = f.dataset.id;
      var rec = {
        id: id || newId("hc"),
        crewId: crewId,
        crewName: crew ? crew.name : "",
        type: type,
        typeLabel: typeLabel,
        date: f.date.value,
        before: f.before.value.trim(),
        after: f.after.value.trim(),
        reason: f.reason.value.trim(),
        recorder: (id && findById(window.HR_CHANGES || [], id) || {}).recorder || CURRENT_USER,
        link: f.link.value.trim(),
      };
      if (!window.HR_CHANGES) window.HR_CHANGES = [];
      var idx = id ? indexById(window.HR_CHANGES, id) : -1;
      if (idx > -1) window.HR_CHANGES[idx] = rec; else window.HR_CHANGES.push(rec);
      // 주의: 봉투의 type("hrchange")과 변동 유형(rec.type)이 충돌하지 않도록 유형은 hcType 으로 전송
      saveToSheet({
        type: "hrchange", action: id ? "update" : "add",
        id: rec.id, crewId: rec.crewId, crewName: rec.crewName,
        hcType: rec.type, typeLabel: rec.typeLabel, date: rec.date,
        before: rec.before, after: rec.after, reason: rec.reason, recorder: rec.recorder, link: rec.link
      });
      closeHrChangeModal();
      rerenderAfterHrChange();
    });
    wrap.querySelector("#hrChangeDelBtn").addEventListener("click", function () {
      var id = wrap.querySelector("form").dataset.id;
      if (!id) return;
      if (!confirm("이 인사 변동 기록을 삭제할까요?")) return;
      window.HR_CHANGES = (window.HR_CHANGES || []).filter(function (r) { return String(r.id) !== String(id); });
      saveToSheet({ type: "hrchange", action: "delete", id: id });
      closeHrChangeModal();
      rerenderAfterHrChange();
    });
    return wrap;
  }

  /* ======================================================
     NOTE · 노트 기록 (파트별 빠른 메모)
     ====================================================== */
  var NOTE_PARTS = ["스낵", "가든", "총무지원"];
  var NOTE_RETENTION_DAYS = 365; // 삭제한 노트 보관 기한
  var noteFilter = "전체";
  var noteQuickPart = "전체";
  var noteView = "active"; // "active" | "archive"
  var noteSelected = {}; // 체크박스로 선택한 노트 id → true (일괄 삭제용, 활성 목록에서만 사용)

  function noteSelectedIds() { return Object.keys(noteSelected).filter(function (id) { return noteSelected[id]; }); }

  /* 삭제되었거나 더 이상 존재하지 않는 노트의 선택은 자동으로 정리 */
  function pruneNoteSelection() {
    var valid = {};
    (window.NOTES || []).forEach(function (n) { if (!n.deletedAt) valid[n.id] = true; });
    Object.keys(noteSelected).forEach(function (id) { if (!valid[id]) delete noteSelected[id]; });
  }

  function noteLinkChip(n) {
    return n.link ? ' <a class="link-chip" href="' + esc(n.link) + '" target="_blank" rel="noopener" title="링크 열기">🔗</a>' : "";
  }

  /** deletedAt(ISO datetime) → 만료일까지 남은 일수 (0 이면 오늘 만료) */
  function noteDaysLeft(deletedAt) {
    if (!deletedAt) return null;
    var dt = new Date(deletedAt);
    if (isNaN(dt.getTime())) return null;
    var expiresAt = dt.getTime() + NOTE_RETENTION_DAYS * 24 * 3600 * 1000;
    return Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 3600 * 1000)));
  }
  function noteDeletedDateLabel(deletedAt) {
    if (!deletedAt) return "—";
    var dt = new Date(deletedAt);
    if (isNaN(dt.getTime())) return "—";
    return fmtDotDate(isoOf(dt));
  }

  function noteByPart(list) {
    if (noteFilter === "전체") return list;
    return list.filter(function (n) { return n.part === noteFilter; });
  }

  function noteInScope() {
    var list = (window.NOTES || []).filter(function (n) { return !n.deletedAt; }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      if ((a.time || "") !== (b.time || "")) return (a.time || "") < (b.time || "") ? 1 : -1;
      return String(b.id).localeCompare(String(a.id));
    });
    return noteByPart(list);
  }

  function noteArchiveScope() {
    var list = (window.NOTES || []).filter(function (n) { return !!n.deletedAt; }).sort(function (a, b) {
      return a.deletedAt < b.deletedAt ? 1 : -1;
    });
    return noteByPart(list);
  }

  function renderNote() {
    var html = "";
    var archivedCount = (window.NOTES || []).filter(function (n) { return !!n.deletedAt; }).length;

    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Operation / Note</p>'
      + '<h2>노트 기록</h2>'
      + '<p class="sub">' + (noteView === "archive"
          ? '삭제한 메모를 모아둔 보관함입니다. 삭제 후 ' + NOTE_RETENTION_DAYS + '일이 지나면 자동으로 완전히 삭제됩니다.'
          : '갑자기 떠오른 메모를 파트별로 바로 남겨두세요.') + '</p></div>'
      + '<div class="page-head__actions">' + (noteView === "archive"
          ? '<button class="btn btn--ghost" id="noteBackBtn">← 노트로 돌아가기</button>'
          : '<button class="btn btn--ghost" id="noteArchiveBtn">🗄 보관함' + (archivedCount ? ' (' + archivedCount + ')' : '') + '</button>') + '</div>'
      + '</div>';

    if (noteView === "archive") {
      var arows = noteArchiveScope();
      html += '<div class="toolbar-row">'
        + '<div class="filter" id="noteFilter">' + ["전체"].concat(NOTE_PARTS).map(function (p) {
            return '<button class="btn btn--sm btn--pill ' + (p === noteFilter ? "is-on" : "") + '" data-note-filter="' + p + '">' + p + '</button>';
          }).join("") + '</div>'
        + '</div>';

      html += '<div class="board"><div class="board__head"><h3 class="board__title">보관함 <span class="chip-mono">' + arows.length + '건</span></h3></div>';
      html += arows.length
        ? '<div class="board__scroll"><table class="board__table board__table--note-archive"><thead><tr>'
          + '<th>날짜</th><th>파트</th><th>내용</th><th>삭제일 · 보관기한</th><th></th>'
          + '</tr></thead><tbody>' + arows.map(noteArchiveBoardRow).join("") + '</tbody></table></div>'
        : '<div class="board__empty">보관함이 비어있습니다.</div>';
      html += '</div>';

      view.innerHTML = html;
      return;
    }

    pruneNoteSelection();
    var rows = noteInScope();
    var selCount = noteSelectedIds().length;
    var allChecked = rows.length > 0 && rows.every(function (n) { return !!noteSelected[n.id]; });

    html += '<div class="note-quickadd">'
      + '<textarea id="noteQuickText" rows="3" placeholder="지금 남기고 싶은 메모를 적어주세요…"></textarea>'
      + '<input type="url" id="noteQuickLink" class="note-quickadd__link" placeholder="관련 링크 (선택)">'
      + '<div class="note-quickadd__foot">'
        + '<div class="seg" id="noteQuickPart">' + ["전체"].concat(NOTE_PARTS).map(function (p) {
            return '<button type="button" class="btn btn--sm btn--pill' + (p === noteQuickPart ? " is-on" : "") + '" data-note-quick-part="' + p + '">' + p + '</button>';
          }).join("") + '</div>'
        + '<span class="note-quickadd__hint">Ctrl+Enter 로 저장</span>'
        + '<button type="button" class="btn btn--primary btn--sm" id="noteQuickSaveBtn">저장</button>'
      + '</div>'
      + '</div>';

    html += '<div class="toolbar-row">'
      + '<div class="filter" id="noteFilter">' + ["전체"].concat(NOTE_PARTS).map(function (p) {
          return '<button class="btn btn--sm btn--pill ' + (p === noteFilter ? "is-on" : "") + '" data-note-filter="' + p + '">' + p + '</button>';
        }).join("") + '</div>'
      + '</div>';

    html += '<div class="board"><div class="board__head"><h3 class="board__title">노트 기록 <span class="chip-mono">' + rows.length + '건</span></h3>'
      + (selCount ? '<button type="button" class="btn btn--sm btn--danger" id="noteBulkDeleteBtn">선택 삭제 (' + selCount + ')</button>' : '')
      + '</div>';
    html += rows.length
      ? '<div class="board__scroll"><table class="board__table board__table--note"><thead><tr>'
        + '<th><input type="checkbox" class="note-check-all"' + (allChecked ? ' checked' : '') + '></th>'
        + '<th>날짜</th><th>파트</th><th>내용</th><th>작성자</th>'
        + '</tr></thead><tbody>' + rows.map(noteBoardRow).join("") + '</tbody></table></div>'
      : '<div class="board__empty">아직 남긴 메모가 없습니다. 위 칸에 바로 적어보세요.</div>';
    html += '</div>';

    view.innerHTML = html;

    var qta = document.getElementById("noteQuickText");
    if (qta) {
      qta.addEventListener("keydown", function (ev) {
        if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") { ev.preventDefault(); commitNoteQuickAdd(); }
      });
    }
  }

  function noteBoardRow(n) {
    var g = groupOf(n.part);
    var checked = !!noteSelected[n.id];
    return '<tr class="board__row' + (checked ? ' is-selected' : '') + '" data-note-id="' + esc(n.id || "") + '">'
      + '<td class="board__check"><input type="checkbox" class="note-check" data-id="' + esc(n.id || "") + '"' + (checked ? ' checked' : '') + '></td>'
      + '<td class="board__date mono">' + fmtDotDate(n.date) + (n.time ? '<span class="board__time"> · ' + esc(n.time) + '</span>' : '') + '</td>'
      + '<td><span class="ob-card__group"><i class="gdot" style="background:' + g.bg + '"></i>' + esc(n.part || "전체") + '</span></td>'
      + '<td class="board__content"><span class="board__ctext">' + esc(n.text) + '</span>' + noteLinkChip(n) + '</td>'
      + '<td class="board__recorder muted">' + esc(n.author || "—") + '</td>'
      + '</tr>';
  }

  function noteArchiveBoardRow(n) {
    var g = groupOf(n.part);
    var daysLeft = noteDaysLeft(n.deletedAt);
    return '<tr class="board__row board__row--static">'
      + '<td class="board__date mono">' + fmtDotDate(n.date) + (n.time ? '<span class="board__time"> · ' + esc(n.time) + '</span>' : '') + '</td>'
      + '<td><span class="ob-card__group"><i class="gdot" style="background:' + g.bg + '"></i>' + esc(n.part || "전체") + '</span></td>'
      + '<td class="board__content"><span class="board__ctext">' + esc(n.text) + '</span>' + noteLinkChip(n) + '</td>'
      + '<td class="mono-cell">' + noteDeletedDateLabel(n.deletedAt) + (daysLeft === null ? '' : ' · ' + daysLeft + '일 남음') + '</td>'
      + '<td class="board__note-actions">'
        + '<button type="button" class="btn btn--sm note-act--restore" data-id="' + esc(n.id || "") + '">복원</button>'
        + '<button type="button" class="btn btn--sm btn--danger note-act--purge" data-id="' + esc(n.id || "") + '">완전 삭제</button>'
      + '</td>'
      + '</tr>';
  }

  function commitNoteQuickAdd() {
    var ta = document.getElementById("noteQuickText");
    if (!ta) return;
    var text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    var linkEl = document.getElementById("noteQuickLink");
    var now = new Date();
    var note = {
      id: newId("nt"), date: TODAY, time: pad2(now.getHours()) + ":" + pad2(now.getMinutes()),
      part: noteQuickPart, text: text, author: CURRENT_USER,
      link: linkEl ? linkEl.value.trim() : "", deletedAt: "",
    };
    if (!window.NOTES) window.NOTES = [];
    window.NOTES.push(note);
    saveToSheet({ type: "note", action: "add", id: note.id, date: note.date, time: note.time, part: note.part, text: note.text, author: note.author, link: note.link });
    renderNote();
  }

  function bulkDeleteSelectedNotes() {
    var ids = noteSelectedIds();
    if (!ids.length) return;
    if (!confirm("선택한 메모 " + ids.length + "개를 삭제할까요? 보관함에서 " + NOTE_RETENTION_DAYS + "일간 볼 수 있어요.")) return;
    var now = new Date().toISOString();
    ids.forEach(function (id) {
      var n = findById(window.NOTES || [], id);
      if (n) n.deletedAt = now;
      saveToSheet({ type: "note", action: "delete", id: id });
    });
    noteSelected = {};
    renderNote();
  }

  function restoreNoteQuick(id) {
    var n = findById(window.NOTES || [], id);
    if (!n) return;
    n.deletedAt = "";
    saveToSheet({ type: "note", action: "restore", id: id });
    renderNote();
  }

  function purgeNoteForever(id) {
    if (!confirm("이 메모를 완전히 삭제할까요? 복원할 수 없습니다.")) return;
    window.NOTES = (window.NOTES || []).filter(function (n) { return String(n.id) !== String(id); });
    saveToSheet({ type: "note", action: "purge", id: id });
    renderNote();
  }

  /* ---------- 노트 수정 모달 ---------- */
  function openNoteModal(prefill) {
    var el = document.getElementById("noteModal");
    if (!el) { el = buildNoteModal(); document.body.appendChild(el); }
    var form = el.querySelector("form");
    form.reset();
    form.dataset.id = (prefill && prefill.id) || "";
    form.text.value = (prefill && prefill.text) || "";
    form.link.value = (prefill && prefill.link) || "";
    var part = (prefill && prefill.part) || "전체";
    form.part.value = part;
    Array.prototype.forEach.call(el.querySelectorAll("#noteModalPart [data-part]"), function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-part") === part);
    });
    el.hidden = false;
    setTimeout(function () { form.text.focus(); }, 30);
  }
  function closeNoteModal() {
    var el = document.getElementById("noteModal");
    if (el) el.hidden = true;
  }
  function buildNoteModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "noteModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop"></div>'
      + '<div class="modal__card" role="dialog" aria-modal="true" aria-label="노트 수정">'
      + '<div class="modal__head"><h3>노트 수정</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<form id="noteForm">'
      + '<input type="hidden" name="part" value="전체">'
      + '<div class="fld"><span>파트</span><div class="seg" id="noteModalPart">' + ["전체"].concat(NOTE_PARTS).map(function (p) {
          return '<button type="button" class="btn btn--sm btn--pill" data-part="' + p + '">' + p + '</button>';
        }).join("") + '</div></div>'
      + '<label class="fld"><span>내용</span><textarea name="text" rows="4" maxlength="500" required placeholder="메모 내용을 입력하세요…"></textarea></label>'
      + '<label class="fld"><span>링크 <em>(선택 · 입력 시 🔗 버튼 생성)</em></span><input type="url" name="link" placeholder="https://docs.google.com/..."></label>'
      + '<div class="modal__foot">'
        + '<button type="button" class="btn btn--danger" id="noteDelBtn">삭제</button>'
        + '<div class="modal__spacer"></div>'
        + '<button type="button" class="btn" data-close>취소</button>'
        + '<button type="submit" class="btn btn--primary">저장</button>'
      + '</div>'
      + '</form>'
      + '</div>';

    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) { closeNoteModal(); return; }
      var segBtn = ev.target.closest("#noteModalPart [data-part]");
      if (segBtn) {
        var form = wrap.querySelector("form");
        form.part.value = segBtn.getAttribute("data-part");
        Array.prototype.forEach.call(wrap.querySelectorAll("#noteModalPart [data-part]"), function (b) { b.classList.toggle("is-on", b === segBtn); });
        return;
      }
    });
    wrap.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var text = f.text.value.trim();
      if (!text) return;
      var id = f.dataset.id;
      var existing = id ? findById(window.NOTES || [], id) : null;
      var note = {
        id: id || newId("nt"),
        date: existing ? existing.date : TODAY,
        time: existing ? existing.time : "",
        part: f.part.value || "전체",
        text: text,
        link: f.link.value.trim(),
        author: existing ? existing.author : CURRENT_USER,
        deletedAt: existing ? existing.deletedAt : "",
      };
      if (!window.NOTES) window.NOTES = [];
      var idx = id ? indexById(window.NOTES, id) : -1;
      if (idx > -1) window.NOTES[idx] = note; else window.NOTES.push(note);
      saveToSheet({ type: "note", action: id ? "update" : "add", id: note.id, date: note.date, time: note.time, part: note.part, text: note.text, author: note.author, link: note.link });
      closeNoteModal();
      renderNote();
    });
    wrap.querySelector("#noteDelBtn").addEventListener("click", function () {
      var id = wrap.querySelector("form").dataset.id;
      if (!id) return;
      if (!confirm("이 메모를 삭제할까요? 보관함에서 " + NOTE_RETENTION_DAYS + "일간 볼 수 있어요.")) return;
      var n = findById(window.NOTES || [], id);
      if (n) n.deletedAt = new Date().toISOString();
      saveToSheet({ type: "note", action: "delete", id: id });
      closeNoteModal();
      renderNote();
    });
    return wrap;
  }

  /* ======================================================
     NOTIFY · 알림 설정 (생일 · 입사 기념일 축하 팝업)
     ====================================================== */
  var NOTIFY_KEY = "sg-notify-settings";
  var NOTIFY_SHOWN_KEY = "sg-notify-shown";
  var NOTIFY_TIMINGS = [
    { key: "0", label: "당일" },
    { key: "1", label: "1일 전" },
    { key: "3", label: "3일 전" },
    { key: "7", label: "1주일 전" },
  ];
  var notifyScope = "week"; // "week" | "month" — 다가오는 축하 미리보기 범위

  function loadNotifySettings() {
    var base = { birthday: true, anniversary: true, timing: "0" };
    try {
      var raw = localStorage.getItem(NOTIFY_KEY);
      if (raw) return Object.assign(base, JSON.parse(raw));
    } catch (e) {}
    return base;
  }
  function saveNotifySettings(s) {
    try { localStorage.setItem(NOTIFY_KEY, JSON.stringify(s)); } catch (e) {}
  }

  /** "MM-DD" 를 기준으로, 오늘 이후(오늘 포함) 가장 가까운 다음 발생일(YYYY-MM-DD)을 구한다. */
  function nextOccurrence(mmdd, todayIso) {
    if (!mmdd) return null;
    var ty = +todayIso.slice(0, 4);
    var cand = ty + "-" + mmdd;
    if (cand < todayIso) cand = (ty + 1) + "-" + mmdd;
    return cand;
  }
  function daysBetweenISO(a, b) { return Math.round((d(b) - d(a)) / 86400000); }

  /** scopeDays 이내에 다가오는 생일 · 입사기념일 목록 (설정 on/off 와 무관하게, 미리보기용) */
  function upcomingCelebrations(scopeDays) {
    var out = [];
    (window.CREW || []).forEach(function (c) {
      if (c.status === "퇴사") return;
      if (c.birthDate) {
        var occ = nextOccurrence(c.birthDate.slice(5), TODAY);
        var days = daysBetweenISO(TODAY, occ);
        if (days <= scopeDays) out.push({ crew: c, type: "birthday", occursOn: occ, daysUntil: days });
      }
      if (c.joinDate) {
        var occ2 = nextOccurrence(c.joinDate.slice(5), TODAY);
        var years = +occ2.slice(0, 4) - +c.joinDate.slice(0, 4);
        var days2 = daysBetweenISO(TODAY, occ2);
        if (years > 0 && days2 <= scopeDays) out.push({ crew: c, type: "anniversary", years: years, occursOn: occ2, daysUntil: days2 });
      }
    });
    out.sort(function (a, b) { return a.daysUntil - b.daysUntil; });
    return out;
  }

  /** 설정된 알림 시점(당일/N일 전)에 정확히 해당하는, 오늘 팝업으로 띄울 목록 */
  function todaysCelebrations(settings) {
    var offset = +settings.timing || 0;
    var out = [];
    (window.CREW || []).forEach(function (c) {
      if (c.status === "퇴사") return;
      if (settings.birthday && c.birthDate) {
        var occ = nextOccurrence(c.birthDate.slice(5), TODAY);
        if (daysBetweenISO(TODAY, occ) === offset) out.push({ crew: c, type: "birthday", occursOn: occ, daysUntil: offset });
      }
      if (settings.anniversary && c.joinDate) {
        var occ2 = nextOccurrence(c.joinDate.slice(5), TODAY);
        var years = +occ2.slice(0, 4) - +c.joinDate.slice(0, 4);
        if (years > 0 && daysBetweenISO(TODAY, occ2) === offset) out.push({ crew: c, type: "anniversary", years: years, occursOn: occ2, daysUntil: offset });
      }
    });
    return out;
  }

  function celebMessage(item) {
    var n = item.daysUntil || 0;
    var when = n === 0 ? "오늘은" : n === 1 ? "내일은" : n + "일 후엔";
    return item.type === "birthday"
      ? when + " " + esc(item.crew.name) + "님의 생일이에요!"
      : when + " " + esc(item.crew.name) + "님의 입사 " + item.years + "주년이에요!";
  }

  /** 팝업(하루 한 번, 설정된 알림 시점에 해당하는 축하가 있을 때만) */
  function checkCelebrationPopup() {
    var settings = loadNotifySettings();
    if (!settings.birthday && !settings.anniversary) return;
    var shownFor = "";
    try { shownFor = localStorage.getItem(NOTIFY_SHOWN_KEY) || ""; } catch (e) {}
    if (shownFor === TODAY) return;
    var list = todaysCelebrations(settings);
    if (!list.length) return;
    try { localStorage.setItem(NOTIFY_SHOWN_KEY, TODAY); } catch (e) {}
    openCelebrationModal(list);
  }

  function openCelebrationModal(list) {
    var el = document.getElementById("celebModal");
    if (el) el.remove();
    el = document.createElement("div");
    el.className = "modal";
    el.id = "celebModal";
    el.innerHTML =
      '<div class="modal__backdrop" data-close></div>'
      + '<div class="modal__card celeb-card" role="dialog" aria-modal="true" aria-label="축하 알림">'
      + '<div class="modal__head"><h3>🎉 오늘의 축하 소식</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<div class="celeb-list">' + list.map(function (item) {
          return '<div class="celeb-item">'
            + '<span class="celeb-item__icon">' + (item.type === "birthday" ? "🎂" : "🎉") + '</span>'
            + '<span class="celeb-item__text">' + celebMessage(item) + '</span>'
          + '</div>';
        }).join("") + '</div>'
      + '<div class="modal__foot"><div class="modal__spacer"></div><button type="button" class="btn btn--primary" data-close>축하해요!</button></div>'
      + '</div>';
    el.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) el.remove();
    });
    document.body.appendChild(el);
  }

  function renderNotify() {
    var settings = loadNotifySettings();
    var scopeDays = notifyScope === "week" ? 7 : 30;
    var upcoming = upcomingCelebrations(scopeDays);

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Operation / Notify</p>'
      + '<h2>알림 설정</h2>'
      + '<p class="sub">크루의 생일 · 입사 기념일을 놓치지 않도록 축하 알림을 관리하세요.</p></div>'
      + '</div>';

    html += '<div class="notify-card">'
      + '<div class="notify-row notify-row--setting">'
        + '<div class="notify-row__label"><b>생일 알림</b><span class="muted">크루 생일에 축하 팝업을 띄워요</span></div>'
        + '<button type="button" class="switch' + (settings.birthday ? " is-on" : "") + '" role="switch" aria-checked="' + (settings.birthday ? "true" : "false") + '" data-notify-toggle="birthday"><span class="switch__knob"></span></button>'
      + '</div>'
      + '<div class="notify-row notify-row--setting">'
        + '<div class="notify-row__label"><b>입사 기념일 알림</b><span class="muted">크루 입사 기념일에 축하 팝업을 띄워요</span></div>'
        + '<button type="button" class="switch' + (settings.anniversary ? " is-on" : "") + '" role="switch" aria-checked="' + (settings.anniversary ? "true" : "false") + '" data-notify-toggle="anniversary"><span class="switch__knob"></span></button>'
      + '</div>'
      + '</div>';

    html += '<div class="notify-card">'
      + '<div class="notify-row__label" style="margin-bottom:12px"><b>알림 시점</b><span class="muted">구글 캘린더처럼, 당일 또는 며칠 전에 미리 알려드려요</span></div>'
      + '<div class="seg" id="notifyTiming">' + NOTIFY_TIMINGS.map(function (t) {
          return '<button type="button" class="btn btn--sm btn--pill' + (t.key === settings.timing ? " is-on" : "") + '" data-notify-timing="' + t.key + '">' + t.label + '</button>';
        }).join("") + '</div>'
      + '</div>';

    html += '<div class="page-head" style="margin-top:8px">'
      + '<div><h3 style="margin:0 0 4px;font-size:18px;">다가오는 축하</h3><p class="sub" style="margin:0">설정과 무관하게, 앞으로 다가오는 생일 · 기념일을 미리 볼 수 있어요.</p></div>'
      + '<div class="seg">'
        + '<button class="btn btn--sm btn--pill' + (notifyScope === "week" ? " is-on" : "") + '" data-notify-scope="week">이번 주</button>'
        + '<button class="btn btn--sm btn--pill' + (notifyScope === "month" ? " is-on" : "") + '" data-notify-scope="month">이번 달</button>'
      + '</div>'
      + '</div>';

    html += upcoming.length
      ? '<div class="notify-upcoming">' + upcoming.map(notifyRow).join("") + '</div>'
      : '<div class="note-empty">해당 기간에 예정된 생일 · 기념일이 없습니다.</div>';

    html += '<div class="notify-preview"><button type="button" class="btn" id="notifyPreviewBtn">🎉 축하 팝업 미리보기</button></div>';

    view.innerHTML = html;
  }

  function notifyRow(item) {
    var g = groupOf(item.crew.group);
    var badge = item.daysUntil === 0 ? "오늘" : "D-" + item.daysUntil;
    var metaLabel = item.type === "birthday"
      ? fmtDotDate(item.occursOn) + " · 생일"
      : fmtDotDate(item.occursOn) + " · 입사 " + item.years + "주년";
    return '<div class="notify-row">'
      + '<span class="notify-row__icon">' + (item.type === "birthday" ? "🎂" : "🎉") + '</span>'
      + '<i class="gdot" style="background:' + g.bg + '"></i>'
      + '<span class="notify-row__name">' + esc(item.crew.name) + '</span>'
      + '<span class="notify-row__meta">' + metaLabel + '</span>'
      + '<span class="notify-row__badge' + (item.daysUntil === 0 ? " is-today" : "") + '">' + badge + '</span>'
      + '</div>';
  }

  /* ---------- 일정 알림 (컴퓨터 시간 기준 실시간 감시) ---------- */
  var ALARM_FIRED_KEY = "sg-alarm-fired";

  function loadFiredAlarms() {
    try {
      var raw = JSON.parse(localStorage.getItem(ALARM_FIRED_KEY) || "null");
      if (raw && raw.date === TODAY) return raw;
    } catch (e) {}
    return { date: TODAY, ids: [] };
  }
  function markAlarmFired(id) {
    var f = loadFiredAlarms();
    f.ids.push(id);
    try { localStorage.setItem(ALARM_FIRED_KEY, JSON.stringify(f)); } catch (e) {}
  }

  function checkEventAlarms() {
    var now = new Date();
    var hhmm = pad2(now.getHours()) + ":" + pad2(now.getMinutes());
    var fired = loadFiredAlarms();
    (window.SCHEDULE || []).forEach(function (e) {
      if (!e.alarm || !e.alarmTime || e.date !== TODAY) return;
      if (e.alarmTime !== hhmm) return;
      if (fired.ids.indexOf(e.id) > -1) return;
      markAlarmFired(e.id);
      openEventAlarmModal(e);
    });
  }

  /** 알림음 — 지정된 mp3 파일(assets/sound/alarm.mp3)을 재생.
   *  브라우저는 사용자가 페이지를 한 번이라도 클릭/터치해야 소리를 허용하므로,
   *  대개 화면을 조작한 뒤라면 정상 재생되고, 아니면 조용히 무시된다.
   *  파일 재생이 막히면 Web Audio 차임으로 대체한다. */
  var _alarmAudioEl = null;
  var _alarmAudioCtx = null;
  function playAlarmChime_() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!_alarmAudioCtx) _alarmAudioCtx = new AC();
      var ctx = _alarmAudioCtx;
      if (ctx.state === "suspended" && ctx.resume) ctx.resume();
      var chime = function (freq, startAt, dur) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        var t0 = ctx.currentTime + startAt;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      };
      chime(880, 0, 0.5);
      chime(660, 0.45, 0.7);
    } catch (err) { /* 소리 재생 불가 시 무시 */ }
  }
  function playAlarmSound_() {
    try {
      if (!_alarmAudioEl) {
        _alarmAudioEl = new Audio("assets/sound/alarm.mp3");
        _alarmAudioEl.preload = "auto";
      }
      _alarmAudioEl.muted = false;
      _alarmAudioEl.volume = 1;
      _alarmAudioEl.currentTime = 0;
      var p = _alarmAudioEl.play();
      if (p && p.catch) p.catch(function () { playAlarmChime_(); });
    } catch (err) { playAlarmChime_(); }
  }

  /** 페이지에서 첫 클릭/터치/키 입력이 발생하는 순간, 소리를 '무음으로 살짝 재생 후 정지'해
   *  브라우저의 자동재생 잠금을 미리 풀어둔다. 이후 알림 시간엔 클릭 없이도 소리가 난다.
   *  (브라우저 정책상 최초 상호작용 1회는 반드시 필요 — 그 1회를 이 unlock에 활용) */
  var _alarmPrimed = false;
  function primeAlarmSound_() {
    if (_alarmPrimed) return;
    _alarmPrimed = true;
    try {
      // Web Audio 컨텍스트 깨우기
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        if (!_alarmAudioCtx) _alarmAudioCtx = new AC();
        if (_alarmAudioCtx.state === "suspended" && _alarmAudioCtx.resume) _alarmAudioCtx.resume();
      }
      // mp3 엘리먼트 unlock (무음 재생 → 즉시 정지)
      if (!_alarmAudioEl) {
        _alarmAudioEl = new Audio("assets/sound/alarm.mp3");
        _alarmAudioEl.preload = "auto";
      }
      _alarmAudioEl.muted = true;
      var p = _alarmAudioEl.play();
      var reset = function () {
        try {
          _alarmAudioEl.pause();
          _alarmAudioEl.currentTime = 0;
          _alarmAudioEl.muted = false;
        } catch (e) {}
      };
      if (p && p.then) p.then(reset, reset); else reset();
    } catch (err) { /* 무시 */ }
  }

  function openEventAlarmModal(e) {
    playAlarmSound_();
    var el = document.getElementById("alarmModal");
    if (el) el.remove();
    el = document.createElement("div");
    el.className = "modal";
    el.id = "alarmModal";
    el.innerHTML =
      '<div class="modal__backdrop" data-close></div>'
      + '<div class="modal__card celeb-card" role="dialog" aria-modal="true" aria-label="일정 알림">'
      + '<div class="modal__head"><h3>🔔 일정 알림</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<div class="celeb-list"><div class="celeb-item">'
        + '<span class="celeb-item__icon">⏰</span>'
        + '<span class="celeb-item__text">' + esc(e.alarmTime) + ' · ' + esc(e.title) + (e.assignee ? ' <span class="muted">(' + esc(e.assignee) + ')</span>' : '') + '</span>'
      + '</div></div>'
      + '<div class="modal__foot"><div class="modal__spacer"></div><button type="button" class="btn btn--primary" data-close>확인</button></div>'
      + '</div>';
    el.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) el.remove();
    });
    document.body.appendChild(el);
  }

  /* ======================================================
     JOURNAL · 면담일지 검토 (외부 구글시트, 읽기 전용)
     ====================================================== */
  var journalQuery = "";
  var journalTeam = "스낵"; // 현재 보고 있는 팀 시트 (스낵/가든/총무지원)
  var pad2j = function (n) { return ("0" + n).slice(-2); };

  /** 면담일지가 있는 크루들의 소속팀 목록 (크루 목록 기준, 스낵→가든→총무지원 순). */
  function journalTeams() {
    var order = ["스낵", "가든", "총무지원"];
    var present = {};
    journalGroups().forEach(function (g) { present[g.team] = 1; });
    var arr = order.filter(function (t) { return present[t]; });
    Object.keys(present).forEach(function (t) { if (arr.indexOf(t) < 0) arr.push(t); });
    return arr.length ? arr : ["스낵"];
  }

  function crewNickname(name) {
    if (!name) return "";
    var i = name.indexOf("(");
    return (i > -1 ? name.slice(0, i) : name).trim();
  }

  /** 시트의 불규칙한 날짜 표기("2025", "08-05", "2025-08-06")를 보정한다.
   *  연도만 있는 행은 이후 "월-일"행의 연도로 이어받는다. */
  function normalizeJournalRows(rawRows) {
    var currentYear = null;
    var out = [];
    rawRows.forEach(function (r) {
      var raw = String(r["일자"] || "").trim();
      var full = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
      var yearOnly = raw.match(/^(\d{4})$/);
      var mmdd = raw.match(/^(\d{1,2})-(\d{1,2})$/);
      var dateIso = "";
      if (full) { currentYear = full[1]; dateIso = full[1] + "-" + pad2j(+full[2]) + "-" + pad2j(+full[3]); }
      else if (mmdd && currentYear) { dateIso = currentYear + "-" + pad2j(+mmdd[1]) + "-" + pad2j(+mmdd[2]); }
      else if (yearOnly) { currentYear = yearOnly[1]; }

      var content = String(r["내용"] || "").trim();
      if (!content) return; // 날짜만 있고 내용 없는 구분행은 제외
      out.push({
        date: dateIso, dateRaw: raw,
        category: String(r["구분"] || "").trim(),
        subCategory: String(r["세부 구분"] || "").trim(),
        content: content,
        author: String(r["면담자/작성자"] || "").trim(),
        cumCount: r["누적 횟수"] || ""
      });
    });
    // 시트에 적힌 순서(오래된 → 최근)를 뒤집어 최근이 먼저 오게 하고,
    // 날짜를 파싱할 수 있는 항목은 그 날짜 기준으로 다시 정렬한다.
    out.reverse();
    out.sort(function (a, b) {
      if (a.date && b.date) return a.date < b.date ? 1 : (a.date > b.date ? -1 : 0);
      if (a.date && !b.date) return -1;
      if (!a.date && b.date) return 1;
      return 0;
    });
    return out;
  }

  function journalRowDateDesc(a, b) {
    var da = a.date, db = b.date;
    if (da && db) return da < db ? 1 : (da > db ? -1 : 0);
    if (da && !db) return -1;
    if (!da && db) return 1;
    return 0;
  }

  /** 원본 탭들을 CREW 명단과 이름으로 매칭해 크루별 그룹으로 만든다.
   *  - 한 크루의 탭이 여러 팀 시트에 흩어져 있으면 합친다.
   *  - 팀 구분은 시트가 아니라 크루 목록의 소속팀(c.group) 기준. */
  function journalGroups() {
    var tabs = (window.JOURNAL && window.JOURNAL.tabs) || [];
    var nickToCrew = {};
    (window.CREW || []).forEach(function (c) { nickToCrew[crewNickname(c.name)] = c; });

    var byCrew = {};
    tabs.forEach(function (t) {
      var crew = nickToCrew[t.name.trim()];
      if (!crew) { console.warn("[면담일지] 크루 매칭 실패:", t.name, "(" + (t.team || "?") + ")"); return; }
      if (crew.status === "퇴사") return; // 퇴사 크루는 면담일지 목록에서 자동 제외
      var rows = normalizeJournalRows(t.rows);
      if (!rows.length) return;
      var g = byCrew[crew.id] || (byCrew[crew.id] = { crew: crew, team: crew.group || "스낵", refs: [], rows: [] });
      g.refs.push({ team: t.team, sheetId: t.sheetId || "", gid: t.gid });
      g.rows = g.rows.concat(rows);
    });

    var groups = Object.keys(byCrew).map(function (id) {
      var g = byCrew[id];
      g.rows.sort(journalRowDateDesc);
      // 시트 링크는 크루 소속팀 시트 탭을 우선, 없으면 첫 탭
      var ref = g.refs.filter(function (r) { return r.team === g.team; })[0] || g.refs[0];
      g.sheetId = ref.sheetId; g.gid = ref.gid;
      return g;
    });

    groups.sort(function (a, b) { return journalRowDateDesc(a.rows[0], b.rows[0]); });
    return groups;
  }

  function filteredJournalGroups() {
    var groups = journalGroups().filter(function (g) { return g.team === journalTeam; });
    if (!journalQuery) return groups;
    var q = journalQuery.toLowerCase();
    return groups.filter(function (g) {
      if (g.crew.name.toLowerCase().indexOf(q) > -1) return true;
      return g.rows.some(function (r) { return r.content.toLowerCase().indexOf(q) > -1 || (r.author || "").toLowerCase().indexOf(q) > -1; });
    });
  }

  function journalGidUrl(sheetId, gid) {
    var base = sheetId
      ? "https://docs.google.com/spreadsheets/d/" + sheetId + "/edit"
      : ((window.CONFIG && window.CONFIG.journalSheetUrl) || "").replace(/#.*$/, "");
    return base + "#gid=" + gid;
  }
  /** 특정 팀 시트의 전체 보기 URL (팀 헤더 링크용). */
  function journalTeamSheetUrl(team) {
    var sheets = (window.JOURNAL && window.JOURNAL.sheets) || [];
    var m = sheets.filter(function (s) { return s.team === team; })[0];
    if (m && m.id) return "https://docs.google.com/spreadsheets/d/" + m.id + "/edit";
    return (window.CONFIG && window.CONFIG.journalSheetUrl) || "#";
  }

  function journalCard(g) {
    var color = groupOf(g.crew.group);
    var latest = g.rows[0];
    var preview = latest.content.length > 150 ? latest.content.slice(0, 150) + "…" : latest.content;
    return '<article class="jcard" data-name="' + esc(g.crew.name) + '">'
      + '<div class="jcard__top">'
        + '<div class="jcard__who">'
          + '<span class="jcard__dot" style="background:' + color.bg + '"></span>'
          + '<div class="jcard__id">'
            + '<b class="jcard__name">' + esc(g.crew.name) + '</b>'
            + '<span class="jcard__meta mono">전체 ' + g.rows.length + '건' + (latest.date ? ' · 최근 ' + fmtDotDate(latest.date) : latest.dateRaw ? ' · 최근 ' + esc(latest.dateRaw) : '') + '</span>'
          + '</div>'
        + '</div>'
        + '<a class="jcard__link" href="' + esc(journalGidUrl(g.sheetId, g.gid)) + '" target="_blank" rel="noopener" title="시트에서 보기" onclick="event.stopPropagation()">🔗</a>'
      + '</div>'
      + (latest.category ? '<span class="jcard__cat">' + esc(latest.category) + '</span>' : '')
      + '<p class="jcard__preview">' + esc(preview) + '</p>'
      + '<div class="jcard__foot"><span class="muted">' + esc(latest.author || "—") + '</span></div>'
      + '</article>';
  }

  function renderJournal() {
    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Crew / Journal</p>'
      + '<h2>면담일지 검토</h2>'
      + '<p class="sub">팀별 장애크루 면담일지 시트의 최근 기록을 크루별로 모아봅니다.</p></div>'
      + '</div>';

    if (!isLive()) {
      html += '<div class="placeholder placeholder--sm"><p class="muted">데모 모드에서는 면담일지를 불러올 수 없습니다.</p></div>';
      view.innerHTML = html;
      return;
    }

    if (!window.JOURNAL) {
      html += '<div class="loading-screen"><div class="loading-spinner"></div><p class="loading-text">면담일지를 불러오는 중…</p></div>';
      view.innerHTML = html;
      loadJournalOnce().then(renderJournal);
      return;
    }

    // 로드된 팀 중 현재 선택이 없으면 첫 팀으로 보정
    var teams = journalTeams();
    if (teams.indexOf(journalTeam) < 0) journalTeam = teams[0];

    // 팀별 크루 수 (배지용)
    var countByTeam = {};
    journalGroups().forEach(function (g) { countByTeam[g.team] = (countByTeam[g.team] || 0) + 1; });

    html += '<div class="toolbar-row toolbar-row--split">'
      + '<div class="filter filter--xs" id="journalTeamFilter">'
      + teams.map(function (tm) {
          var n = countByTeam[tm] || 0;
          return '<button class="btn btn--xs btn--pill ' + (tm === journalTeam ? "is-on" : "") + '" data-jteam="' + esc(tm) + '">'
            + esc(tm) + ' <span class="chip-mono">' + n + '</span></button>';
        }).join("")
      + '</div>'
      + '<input class="searchbox" id="journalSearch" type="search" placeholder="크루 · 내용 검색" value="' + esc(journalQuery) + '">'
      + '</div>';

    var groups = filteredJournalGroups();
    html += '<div class="jlist" id="journalList">'
      + (groups.length ? groups.map(journalCard).join("")
          : '<div class="placeholder placeholder--sm"><p class="muted">' + (journalQuery ? "검색 결과가 없습니다." : esc(journalTeam) + " 팀의 면담일지를 찾지 못했습니다.") + '</p></div>')
      + '</div>';

    view.innerHTML = html;
  }

  function loadJournalOnce() {
    if (window.JOURNAL) return Promise.resolve(window.JOURNAL);
    var ep = endpoint();
    if (!ep) { window.JOURNAL = { tabs: [] }; return Promise.resolve(window.JOURNAL); }
    var url = ep + (ep.indexOf("?") > -1 ? "&" : "?") + "action=journal&_ts=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) { window.JOURNAL = (d && d.tabs) ? d : { tabs: [] }; return window.JOURNAL; })
      .catch(function (e) { console.warn("[면담일지 로드 실패]", e); window.JOURNAL = { tabs: [] }; return window.JOURNAL; });
  }

  /* ---------- 면담일지 상세 팝업 (게시판 형식, 읽기 전용) ---------- */
  function openJournalDetailModal(crewName) {
    var g = journalGroups().filter(function (x) { return x.crew.name === crewName; })[0];
    if (!g) return;
    var el = document.getElementById("journalDetailModal");
    if (!el) { el = buildJournalDetailModal(); document.body.appendChild(el); }

    el.querySelector("#jdModalTitle").textContent = g.crew.name;
    el.querySelector("#jdModalCount").textContent = g.rows.length + "건";
    el.querySelector("#jdModalAiBtn").setAttribute("data-crew-id", g.crew.id);
    el.querySelector("#jdModalLink").href = journalGidUrl(g.sheetId, g.gid);
    el.querySelector("#jdModalBody").innerHTML = g.rows.map(function (r) {
      return '<tr>'
        + '<td class="board__date mono">' + (r.date ? fmtDotDate(r.date) : esc(r.dateRaw || "—")) + '</td>'
        + '<td class="board__type mono">' + esc(r.category || "—") + '</td>'
        + '<td class="board__content"><span class="jd-content">' + esc(r.content) + '</span></td>'
        + '<td class="board__recorder muted">' + esc(r.author || "—") + '</td>'
        + '</tr>';
    }).join("");

    el.hidden = false;
  }
  function closeJournalDetailModal() {
    var el = document.getElementById("journalDetailModal");
    if (el) el.hidden = true;
  }
  function buildJournalDetailModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "journalDetailModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop" data-close></div>'
      + '<div class="modal__card modal__card--jd" role="dialog" aria-modal="true" aria-label="면담일지 전체 이력">'
      + '<div class="modal__head">'
        + '<h3><span id="jdModalTitle"></span> <span class="chip-mono" id="jdModalCount"></span></h3>'
        + '<div class="modal__head-actions">'
          + '<button type="button" class="btn btn--sm btn--primary" id="jdModalAiBtn">🤖 AI 지원가이드</button>'
          + '<a class="btn btn--sm" id="jdModalLink" target="_blank" rel="noopener">시트에서 보기 ↗</a>'
          + '<button type="button" class="modal__x" data-close aria-label="닫기">×</button>'
        + '</div>'
      + '</div>'
      + '<div class="board__scroll jd-scroll"><table class="board__table board__table--jd"><thead><tr>'
      + '<th>일자</th><th>구분</th><th>내용</th><th>작성자</th>'
      + '</tr></thead><tbody id="jdModalBody"></tbody></table></div>'
      + '</div>';
    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) { closeJournalDetailModal(); return; }
      var aiBtn = ev.target.closest("#jdModalAiBtn");
      if (aiBtn) {
        var id = aiBtn.getAttribute("data-crew-id");
        closeJournalDetailModal();
        if (id) { crewDetailId = id; crewDetailTab = "ai"; go("crew"); }
      }
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

  function dashAsOfLabel() { var p = TODAY.split("-"); return "'" + p[0].slice(2) + "년 " + (+p[1]) + "월 기준"; }

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
          + '<span class="chip-mono">' + crew.length + '명</span>'
          + '<span class="summary__asof mono">' + dashAsOfLabel() + '</span></div>'
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

    var dashTurnoverYear = TODAY.slice(0, 4);
    html += '<section class="dash-card" style="margin-bottom:16px">'
      + '<div class="summary__head"><h3>파트별 이직률</h3><span class="chip-mono">' + dashTurnoverYear + '년</span></div>'
      + turnoverCardsHTML(dashTurnoverYear)
      + '</section>';

    var dashUpcoming = upcomingCelebrations(7);
    html += '<section class="dash-card" style="margin-bottom:16px">'
      + '<div class="summary__head"><h3>다가오는 축하</h3>'
        + '<span class="chip-mono">이번 주</span></div>'
      + (dashUpcoming.length
          ? '<div class="notify-upcoming">' + dashUpcoming.map(notifyRow).join("") + '</div>'
          : '<div class="note-empty">이번 주 예정된 생일 · 기념일이 없습니다.</div>')
      + '</section>';

    view.innerHTML = html;
  }

  /* ======================================================
     EDUCATION · 교육 관리 (OJT온보딩 · 법정의무교육 · 정기교육)
     ====================================================== */
  var EDU_SECTIONS = [
    { key: "onboarding", label: "OJT 온보딩",   cat: "OJT온보딩",   c: "#b39dff" },
    { key: "legal",      label: "법정의무교육", cat: "법정의무교육", c: "#ff5a52" },
    { key: "regular",    label: "정기 교육",    cat: "정기교육",     c: "#60a5fa" },
  ];
  function eduSectionOf(k) { for (var i = 0; i < EDU_SECTIONS.length; i++) if (EDU_SECTIONS[i].key === k) return EDU_SECTIONS[i]; return EDU_SECTIONS[0]; }
  var eduSection = "onboarding";
  var eduQuery = "";
  var eduRefOpen = false; // 표준 프로세스 참고 패널
  var eduPeriodMode = "all"; // "all" | "month" | "year" — 월별/연별 검색
  var eduAnchor = TODAY;     // 기간 검색 기준 월/년

  // 정기 교육 참석 서명 웹 (edu-sign)
  var EDU_SIGN_URL = "https://jamie4321-sudo.github.io/edu-sign/";

  // 법정/정기 교육 상태 (수동 지정)
  var EDU_STATUS = [
    { key: "예정",   c: "var(--slate)" },
    { key: "진행중", c: "var(--amber)" },
    { key: "완료",   c: "var(--green)" },
  ];
  function eduStatusOf(k) { for (var i = 0; i < EDU_STATUS.length; i++) if (EDU_STATUS[i].key === k) return EDU_STATUS[i]; return EDU_STATUS[0]; }

  // 온보딩 드라이브 루트 (크루별 하위 폴더 링크를 붙여 관리)
  var ONBOARD_DRIVE_ROOT = "https://drive.google.com/drive/folders/1imSrDwPWdnItj3mXmrO2p9SL1_YTaDVW?usp=drive_link";

  /* ---- 온보딩 체크리스트 정의 ---- */
  var ONBOARD_STATUS = [
    { key: "none",     label: "미교육",       c: "var(--slate)" },
    { key: "learning", label: "교육중",       c: "var(--amber)" },
    { key: "support",  label: "지원필요",     c: "var(--red)" },
    { key: "indep",    label: "독립수행가능", c: "#60a5fa" },
    { key: "done",     label: "완료",         c: "var(--green)" },
  ];
  function onboardStatusOf(k) { for (var i = 0; i < ONBOARD_STATUS.length; i++) if (ONBOARD_STATUS[i].key === k) return ONBOARD_STATUS[i]; return ONBOARD_STATUS[0]; }
  // "혼자 수행 가능" 이상을 온보딩 달성으로 간주
  function onboardAchieved(k) { return k === "indep" || k === "done"; }

  // 파트별 직무 교육 순서
  var ONBOARD_JOB = {
    "스낵":    ["진열 기준", "수량 확인", "유통기한·위생관리", "재고 및 발주 흐름", "오아시스·라면존 스팟별 업무", "설비 기본관리", "현장 이슈 보고"],
    "가든":    ["관리구역 파악", "식물 기본관리", "관수 기준", "고사엽 제거·클렌징", "작업도구 사용", "중량물 및 안전교육", "병충해·누수·시설 이슈 보고", "담당 스팟 관리"],
    "총무지원": ["담당 업무 및 서비스 범위", "요청 접수 방법", "업무별 처리 기준", "사내 보안·개인정보 기준", "장비·자산관리", "처리 결과 기록 및 보고"],
  };
  function onboardAreas(crew) {
    var group = (crew && crew.group) || "";
    var job = ONBOARD_JOB[group] || ["직무 기본 이해", "핵심 업무 시연", "보조 수행", "직접 수행"];
    return [
      { key: "prep",    title: "① 입사 준비",     items: ["입사일·근무시간·직무 확인", "계정·업무 이메일 발급", "유니폼·출입권한 준비", "OJT 일정 안내"] },
      { key: "basic",   title: "② 기본 교육",     items: ["회사·조직 소개", "직장생활 기본 에티켓", "장애·비장애 크루 협업 방식", "메신저 사용 방법", "개인정보·보안 기본"] },
      { key: "job",     title: "③ 직무 교육 · " + (group || "공통"), items: job },
      { key: "safety",  title: "④ 안전 · 위생",   items: ["안전 수칙", "위생 기준", "중량물·설비 안전"] },
      { key: "perform", title: "⑤ 업무 수행 확인", items: ["매뉴얼 기준 수행 확인", "작업 속도·정확도 확인", "의사소통 확인", "단독 업무 수행"] },
      { key: "adapt",   title: "⑥ 초기 적응 확인", items: ["업무 적응도 확인", "동료 관계 확인", "근무환경·어려운 점 확인", "온보딩 완료 체크리스트 확인"] },
    ];
  }
  // 장애 크루 5단계 교육 방식
  var ONBOARD_DIS_STEPS = ["설명", "시범", "함께 수행", "혼자 수행", "피드백"];
  // 표준 9단계 온보딩 프로세스 (참고용)
  var ONBOARD_PROCESS = [
    ["1. 입사 확정",      "입사 1~2주 전", "입사일·근무시간·직무 확인 / 인사정보 확인 / 현장 배치 계획 수립", "팀장·인사"],
    ["2. 입사 전 준비",   "입사 전",       "계정 발급 확인 / 유니폼·출입권한 준비 / 교육 담당자 지정 / OJT 일정 안내", "팀장·파트리더"],
    ["3. 첫 출근 안내",   "Day 1",         "회사·조직 소개 / 담당 업무 안내 / 근무·휴게·기본 규칙 / 백오피스·면담실 안내", "파트리더"],
    ["4. 공통 기본교육",  "Day 1~3",       "에티켓 / 장애·비장애 협업 / 안전·위생 / 메신저 / 개인정보·보안", "파트리더·담당자"],
    ["5. 직무 OJT",       "1주차",         "선임 동행 → 시연 → 보조 수행 → 직접 수행 순으로 교육", "교육 담당자"],
    ["6. 업무 체크",      "1~2주차",       "매뉴얼 기준 수행 확인 / 속도·정확도·안전·소통 확인 / 재교육", "파트리더"],
    ["7. 독립 업무 전환", "2~4주차",       "담당 스팟·업무 배정 / 단독 수행 / 필요 시 선임 보완 지원", "파트리더"],
    ["8. 초기 적응 확인", "1개월 내",      "업무 적응도 / 동료 관계 / 근무환경 / 추가 교육·업무 조정", "팀장·파트리더"],
    ["9. 온보딩 완료",    "1개월 전후",    "체크리스트 완료 확인 / 미완료 교육 재진행 / 성장·교육 방향 설정", "팀장·파트리더"],
  ];

  function parseChecklist(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try { return JSON.parse(raw) || {}; } catch (e) { return {}; }
  }
  function onboardStats(rec, crew) {
    var areas = onboardAreas(crew);
    var cl = parseChecklist(rec.checklist);
    var total = 0, achieved = 0, touched = 0;
    areas.forEach(function (a) {
      a.items.forEach(function (_, i) {
        total++;
        var s = cl[a.key + ":" + i] || "none";
        if (s !== "none") touched++;
        if (onboardAchieved(s)) achieved++;
      });
    });
    return { total: total, achieved: achieved, touched: touched, pct: total ? Math.round(achieved / total * 100) : 0 };
  }
  function deriveOnboardStatus(stats) {
    if (stats.total && stats.achieved === stats.total) return "완료";
    if (stats.touched > 0) return "진행중";
    return "예정";
  }
  // 입사 후 일차(1일차부터) / 수습 종료까지 남은 일수
  function dayCountFrom(iso) { return iso ? daysBetweenISO(iso, TODAY) + 1 : null; }
  function probationLeft(iso) { return iso ? 84 - daysBetweenISO(iso, TODAY) : null; }

  function eduPayload(rec, action) {
    return {
      type: "education", action: action, id: rec.id, category: rec.category, title: rec.title,
      crewId: rec.crewId, crewName: rec.crewName, date: rec.date, dueDate: rec.dueDate,
      status: rec.status, provider: rec.provider, hours: rec.hours, note: rec.note,
      link: rec.link || "",
      checklist: typeof rec.checklist === "string" ? rec.checklist : JSON.stringify(rec.checklist || {}),
    };
  }

  /* 수습 크루(입사 84일 이내 재직)를 온보딩에 자동 편입 — 실시일 = 입사일.
     한 번 생성되면 시트에 저장되어 수습 종료 후에도 '완료' 기록으로 보존된다. */
  function ensureOnboardingRecords() {
    var list = window.EDUCATION || (window.EDUCATION = []);
    (window.CREW || []).forEach(function (c) {
      if (!isProbation(c)) return;
      var has = list.some(function (r) { return r.category === "OJT온보딩" && String(r.crewId) === String(c.id); });
      if (has) return;
      var rec = {
        id: "ob-" + c.id, category: "OJT온보딩", title: c.name + " 온보딩",
        crewId: c.id, crewName: c.name, date: c.joinDate || "", dueDate: "",
        status: "진행중", provider: "", hours: "", note: "", link: "", checklist: "{}",
      };
      list.push(rec);
      saveToSheet(eduPayload(rec, "add"));
    });
  }

  /* ---------- 이수기한 임박/초과 (법정·정기) ---------- */
  function eduDueSoon(r) {
    if (!r.dueDate || r.status === "완료") return false;
    return daysBetweenISO(TODAY, r.dueDate) <= 30;
  }
  function eduOverdue(r) {
    if (!r.dueDate || r.status === "완료") return false;
    return daysBetweenISO(TODAY, r.dueDate) < 0;
  }
  function eduDueCell(r) {
    if (!r.dueDate) return '<span class="muted">—</span>';
    var over = eduOverdue(r), soon = eduDueSoon(r);
    var cls = over ? " edu-due--over" : (soon ? " edu-due--soon" : "");
    var flag = over ? ' <b>초과</b>' : (soon ? ' <b>임박</b>' : '');
    return '<span class="edu-due mono' + cls + '">' + fmtDotDate(r.dueDate) + flag + '</span>';
  }

  function catRecords(cat) {
    return (window.EDUCATION || []).filter(function (r) { return r.category === cat; });
  }

  /* ---- 월별 / 연별 기간 검색 ---- */
  function eduInPeriod(iso) {
    if (eduPeriodMode === "all") return true;
    if (!iso) return false;
    if (eduPeriodMode === "year") return iso.slice(0, 4) === eduAnchor.slice(0, 4);
    return iso.slice(0, 7) === eduAnchor.slice(0, 7);
  }
  function eduPeriodLabel() {
    if (eduPeriodMode === "year") return (+eduAnchor.slice(0, 4)) + "년";
    if (eduPeriodMode === "month") return monthLabel(eduAnchor);
    return "전체 기간";
  }
  function eduPeriodControlHTML(hint) {
    var showNav = eduPeriodMode !== "all";
    return '<div class="edu-period" id="eduPeriod">'
      + '<div class="seg edu-period__seg">'
        + '<button class="btn btn--sm' + (eduPeriodMode === "all" ? " is-on" : "") + '" data-edu-period="all">전체</button>'
        + '<button class="btn btn--sm' + (eduPeriodMode === "month" ? " is-on" : "") + '" data-edu-period="month">월별</button>'
        + '<button class="btn btn--sm' + (eduPeriodMode === "year" ? " is-on" : "") + '" data-edu-period="year">연별</button>'
      + '</div>'
      + (showNav
          ? '<div class="edu-period__nav">'
            + '<button class="iconbtn iconbtn--sm" data-edu-pnav="-1" aria-label="이전">&larr;</button>'
            + '<span class="edu-period__label mono">' + eduPeriodLabel() + '</span>'
            + '<button class="iconbtn iconbtn--sm" data-edu-pnav="1" aria-label="다음">&rarr;</button>'
            + (hint ? '<span class="edu-period__hint">' + esc(hint) + '</span>' : '')
          + '</div>'
          : '')
      + '</div>';
  }

  /* ======================================================
     교육 뷰 — 섹션 라우팅
     ====================================================== */
  function renderEducation() {
    ensureOnboardingRecords();

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Crew / Education</p>'
      + '<h2>교육 관련</h2>'
      + '<p class="sub">OJT 온보딩 · 법정의무교육 · 정기 교육을 구분해 관리합니다.</p></div>'
      + eduHeadActions()
      + '</div>';

    // 섹션 탭
    html += '<div class="edu-tabs" id="eduTabs">' + EDU_SECTIONS.map(function (s) {
        var n = catRecords(s.cat).length;
        return '<button class="edu-tab' + (eduSection === s.key ? " is-on" : "") + '" data-edu-section="' + s.key + '" style="--c:' + s.c + '">'
          + '<i class="edu-cat__dot" style="background:' + s.c + '"></i>' + esc(s.label)
          + '<span class="edu-tab__count">' + n + '</span>'
          + '</button>';
      }).join("") + '</div>';

    html += (eduSection === "onboarding") ? onboardingSectionHTML() : tableSectionHTML(eduSectionOf(eduSection).cat);

    view.innerHTML = html;
  }

  function eduHeadActions() {
    if (eduSection === "onboarding") {
      return '<div class="page-head__actions">'
        + '<a class="btn btn--ghost" href="' + ONBOARD_DRIVE_ROOT + '" target="_blank" rel="noopener">📁 온보딩 드라이브</a>'
        + '<button class="btn btn--primary" id="addOnboardBtn">+ 온보딩 추가</button>'
        + '</div>';
    }
    if (eduSection === "regular") {
      return '<div class="page-head__actions">'
        + '<a class="btn btn--ghost" href="' + EDU_SIGN_URL + '" target="_blank" rel="noopener">✍️ 교육 서명 관리</a>'
        + '<button class="btn btn--primary" id="addEducationBtn">+ 교육 등록</button>'
        + '</div>';
    }
    return '<button class="btn btn--primary" id="addEducationBtn">+ 교육 등록</button>';
  }

  /* ---------- 온보딩 섹션 ---------- */
  function onboardingSectionHTML() {
    var recs = catRecords("OJT온보딩").filter(function (r) { return eduInPeriod(r.date); }).sort(function (a, b) {
      return (a.date || "") < (b.date || "") ? 1 : -1; // 최근 입사 우선
    });
    var probCount = (window.CREW || []).filter(isProbation).length;
    var active = recs.filter(function (r) {
      var crew = findById(window.CREW || [], r.crewId) || {};
      return deriveOnboardStatus(onboardStats(r, crew)) !== "완료";
    }).length;
    var avg = recs.length ? Math.round(recs.reduce(function (sum, r) {
      var crew = findById(window.CREW || [], r.crewId) || {};
      return sum + onboardStats(r, crew).pct;
    }, 0) / recs.length) : 0;

    var html = "";
    html += '<div class="stats stats--edu">'
      + statCard("acid", recs.length, "명", "온보딩 대상")
      + statCard(active ? "warn" : "", active, "명", "진행 중")
      + statCard("", probCount, "명", "수습 크루", "입사 12주 이내")
      + statCard("green", avg + "%", "", "평균 진행률")
      + '</div>';

    // 월별/연별 검색 (입사일 기준)
    html += '<div class="toolbar-row toolbar-row--edu">' + eduPeriodControlHTML("입사일 기준") + '</div>';

    // 표준 프로세스 참고 패널 (접이식)
    html += '<div class="ob-ref">'
      + '<button class="ob-ref__toggle" id="obRefToggle">'
        + '<span>📋 표준 온보딩 프로세스 · 파트별 직무 교육 · 장애 크루 5단계</span>'
        + '<span class="ob-ref__chev">' + (eduRefOpen ? "▲" : "▼") + '</span>'
      + '</button>'
      + (eduRefOpen ? obReferenceHTML() : "")
      + '</div>';

    if (!recs.length) {
      html += '<div class="board__empty ob-empty">진행 중인 온보딩이 없습니다. 수습 크루가 입사하면 자동으로 표시되며, <b style="color:var(--accent-text)">+ 온보딩 추가</b>로 직접 등록할 수도 있어요.</div>';
      return html;
    }

    html += '<div class="board"><div class="board__scroll"><table class="board__table board__table--ob"><thead><tr>'
      + '<th>크루</th><th>그룹</th><th>입사 · 경과</th><th>진행률</th><th>상태</th>'
      + '</tr></thead><tbody>' + recs.map(onboardRow).join("") + '</tbody></table></div></div>';
    return html;
  }

  function obReferenceHTML() {
    var proc = '<div class="ob-ref__block"><h4>표준 9단계 프로세스</h4>'
      + '<div class="ob-proc">' + ONBOARD_PROCESS.map(function (p) {
          return '<div class="ob-proc__row">'
            + '<span class="ob-proc__step">' + esc(p[0]) + '</span>'
            + '<span class="ob-proc__when mono">' + esc(p[1]) + '</span>'
            + '<span class="ob-proc__what">' + esc(p[2]) + '</span>'
            + '<span class="ob-proc__who">' + esc(p[3]) + '</span>'
          + '</div>';
        }).join("") + '</div></div>';

    var jobs = '<div class="ob-ref__block"><h4>파트별 직무 교육 순서</h4><div class="ob-jobs">'
      + Object.keys(ONBOARD_JOB).map(function (g) {
          var gg = groupOf(g);
          return '<div class="ob-jobs__part"><span class="ob-jobs__name"><i class="gdot" style="background:' + gg.bg + '"></i>' + esc(g) + '</span>'
            + '<span class="ob-jobs__seq">' + ONBOARD_JOB[g].map(esc).join(" → ") + '</span></div>';
        }).join("") + '</div></div>';

    var dis = '<div class="ob-ref__block ob-ref__block--dis"><h4>장애 크루 5단계 교육 방식</h4>'
      + '<div class="ob-dissteps">' + ONBOARD_DIS_STEPS.map(function (s, i) {
          return '<span class="ob-disstep"><b>' + (i + 1) + '</b>' + esc(s) + '</span>';
        }).join('<span class="ob-disarrow">→</span>') + '</div>'
      + '<p class="ob-ref__note">말 설명보다 <b>사진·체크리스트·실제 작업 위치</b> 매뉴얼을 함께 제공하고, 한 번에 여러 업무보다 <b>업무를 나눠 단계적으로 독립</b>시키는 구조로 진행합니다. 완료 기준은 “교육을 받았는지”가 아니라 <b>“혼자 수행할 수 있는지”</b>입니다.</p></div>';

    return '<div class="ob-ref__body">' + proc + jobs + dis + '</div>';
  }

  function onboardRow(rec) {
    var crew = findById(window.CREW || [], rec.crewId) || { name: rec.crewName, group: "" };
    var g = groupOf(crew.group);
    var stats = onboardStats(rec, crew);
    var st = deriveOnboardStatus(stats);
    var sc = eduStatusOf(st);
    var joined = rec.date || crew.joinDate || "";
    var dayN = dayCountFrom(joined);
    var left = probationLeft(joined);

    var meta = [];
    if (joined) meta.push("입사 " + fmtShortDot(joined));
    if (dayN != null && dayN > 0) meta.push(dayN + "일차");
    if (left != null && left > 0) meta.push('<span class="ob-dday">수습 D-' + left + '</span>');
    else if (left != null && left <= 0) meta.push('<span class="ob-dday ob-dday--done">수습 종료</span>');

    var disTag = crew.disability === "장애" ? ' <span class="ob-card__dis">장애 · 5단계</span>' : '';

    return '<tr class="board__row" data-ob-id="' + esc(rec.id) + '">'
      + '<td><b>' + esc(crew.name || rec.crewName) + '</b></td>'
      + '<td><span class="ob-card__group"><i class="gdot" style="background:' + g.bg + '"></i>' + esc(crew.group || "—") + disTag + '</span></td>'
      + '<td class="mono-cell">' + (meta.join(" · ") || "입사일 미입력") + '</td>'
      + '<td><div class="ob-row-progress"><div class="ob-progress"><div class="ob-progress__bar" style="width:' + stats.pct + '%"></div></div>'
        + '<span class="ob-row-progress__txt">' + stats.achieved + '/' + stats.total + ' · ' + stats.pct + '%</span></div></td>'
      + '<td><span class="edu-badge" style="--c:' + sc.c + '">' + esc(st) + '</span>'
        + (rec.link ? ' <a class="ob-card__link" href="' + esc(rec.link) + '" target="_blank" rel="noopener" title="드라이브 열기" onclick="event.stopPropagation()">Drive</a>' : '')
      + '</td>'
      + '</tr>';
  }

  function fmtShortDot(iso) {
    var p = (iso || "").split("-");
    return p.length === 3 ? (p[0].slice(2)) + "." + p[1] + "." + p[2] : iso;
  }

  /* ---------- 법정 / 정기 교육 표 섹션 ---------- */
  function filteredCatEducation(cat) {
    var list = catRecords(cat).filter(function (r) { return eduInPeriod(r.date); });
    if (eduQuery) {
      var q = eduQuery.toLowerCase();
      list = list.filter(function (r) {
        return (r.title + " " + r.crewName + " " + r.provider + " " + r.note).toLowerCase().indexOf(q) > -1;
      });
    }
    return list.sort(function (a, b) {
      var da = a.date || a.dueDate || "", db = b.date || b.dueDate || "";
      if (da !== db) return da < db ? 1 : -1;
      return String(b.id).localeCompare(String(a.id));
    });
  }
  // 이 교육 기록을 edu-sign(참석 서명 웹)의 "새 교육 세션" 입력값으로 그대로 넘겨서 여는 링크.
  // edu-sign 쪽 index.html이 ?date=&category=&title= 쿼리를 읽어 세션 등록 모달을 미리 채워서 띄운다.
  function eduSignUrl(r) {
    var params = [];
    if (r.date) params.push("date=" + encodeURIComponent(r.date));
    if (r.category) params.push("category=" + encodeURIComponent(r.category === "정기교육" ? "정기 교육" : r.category));
    if (r.title) params.push("title=" + encodeURIComponent(r.title));
    return EDU_SIGN_URL + (params.length ? "?" + params.join("&") : "") + "#/";
  }
  function eduTableRow(r) {
    return '<tr class="edu-row" data-edu-id="' + esc(r.id || "") + '">'
      + '<td class="edu-title"><b>' + esc(r.title || "—") + '</b>' + (r.note ? '<span class="edu-title__note">' + esc(r.note) + '</span>' : '') + '</td>'
      + '<td>' + esc(r.crewName || "전체 크루") + '</td>'
      + '<td class="mono-cell">' + (r.date ? fmtDotDate(r.date) : '<span class="muted">—</span>') + '</td>'
      + '<td>' + eduDueCell(r) + '</td>'
      + '<td><span class="edu-badge" style="--c:' + eduStatusOf(r.status).c + '">' + esc(r.status) + '</span></td>'
      + '<td class="muted">' + esc(r.provider || "—") + (r.hours ? ' <span class="edu-hours">' + esc(r.hours) + '</span>' : '') + '</td>'
      + '<td><a class="btn btn--sm" data-edu-signup href="' + esc(eduSignUrl(r)) + '" target="_blank" rel="noopener">서명 등록</a></td>'
      + '</tr>';
  }
  function tableSectionHTML(cat) {
    var all = catRecords(cat);
    var done = all.filter(function (r) { return r.status === "완료"; }).length;
    var dueCount = all.filter(eduDueSoon).length;

    var html = "";
    html += '<div class="stats stats--edu">'
      + statCard("acid", all.length, "건", "등록 교육")
      + statCard("green", done, "건", "완료")
      + statCard("", all.length - done, "건", "진행/예정")
      + statCard(dueCount ? "warn" : "", dueCount, "건", "이수기한 임박", "30일 이내 · 미완료")
      + '</div>';

    var alerts = all.filter(eduDueSoon).sort(function (a, b) { return (a.dueDate || "") < (b.dueDate || "") ? -1 : 1; });
    if (alerts.length) {
      html += '<div class="edu-alert"><span class="edu-alert__icon">⚠</span>'
        + '<div class="edu-alert__body"><b>이수기한 임박 · 초과 ' + alerts.length + '건</b><span>'
        + alerts.map(function (r) {
            var dp = (r.dueDate || "").split("-");
            var dl = dp.length === 3 ? (+dp[1]) + "/" + (+dp[2]) : r.dueDate;
            return esc(r.title) + ' (' + (eduOverdue(r) ? '기한초과 ' : '~') + dl + ')';
          }).join(" · ") + '</span></div></div>';
    }

    html += '<div class="toolbar-row toolbar-row--edu">'
      + eduPeriodControlHTML("실시일 기준")
      + '<input class="searchbox" id="eduSearch" type="search" placeholder="교육명 · 대상 · 담당 검색" value="' + esc(eduQuery) + '">'
      + '</div>';

    var rows = filteredCatEducation(cat);
    html += '<div class="board"><div class="board__scroll"><table class="board__table board__table--edu2"><thead><tr>'
      + '<th>교육명</th><th>대상</th><th>실시일</th><th>이수기한</th><th>상태</th><th>담당 · 기관</th><th>서명</th>'
      + '</tr></thead><tbody id="eduBody">'
      + (rows.length ? rows.map(eduTableRow).join("")
          : '<tr><td colspan="7" class="board__empty">등록된 교육이 없습니다. <b style="color:var(--accent-text)">+ 교육 등록</b>으로 추가해보세요.</td></tr>')
      + '</tbody></table></div></div>';
    return html;
  }

  /* ======================================================
     온보딩 상세 모달 (체크리스트 · 드라이브 링크)
     ====================================================== */
  var obDraft = null; // { id, link, checklist:{} }

  function openOnboardModal(rec, isNew) {
    var el = document.getElementById("onboardModal");
    if (el) el.remove();

    var crew = rec.crewId ? (findById(window.CREW || [], rec.crewId) || {}) : {};
    obDraft = { id: rec.id, crewId: rec.crewId || "", link: rec.link || "", checklist: parseChecklist(rec.checklist) };

    el = document.createElement("div");
    el.className = "modal";
    el.id = "onboardModal";
    el.innerHTML =
      '<div class="modal__backdrop"></div>'
      + '<div class="modal__card modal__card--ob" role="dialog" aria-modal="true" aria-label="온보딩 관리">'
      + '<div class="modal__head"><h3 id="obModalTitle"></h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<div class="ob-modal__body" id="obModalBody"></div>'
      + '<div class="modal__foot">'
        + '<button type="button" class="btn btn--danger" id="obDelBtn"' + (isNew ? " hidden" : "") + '>삭제</button>'
        + '<div class="modal__spacer"></div>'
        + '<button type="button" class="btn" data-close>취소</button>'
        + '<button type="button" class="btn btn--primary" id="obSaveBtn">저장</button>'
      + '</div>'
      + '</div>';
    document.body.appendChild(el);

    renderObModalBody(rec, crew, isNew);

    el.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) { el.remove(); obDraft = null; return; }

      var crewSel = ev.target.closest("#obCrewSelect");
      // (select change 는 별도 change 리스너)

      var stBtn = ev.target.closest(".ob-item__opt[data-ob-area]");
      if (stBtn) {
        var area = stBtn.getAttribute("data-ob-area");
        var idx = stBtn.getAttribute("data-ob-idx");
        var val = stBtn.getAttribute("data-ob-val");
        obDraft.checklist[area + ":" + idx] = val;
        // 같은 아이템 그룹의 활성 표시 갱신
        var group = stBtn.parentNode;
        Array.prototype.forEach.call(group.querySelectorAll(".ob-item__opt"), function (b) { b.classList.toggle("is-on", b === stBtn); });
        updateObProgress(el, crew);
        return;
      }
    });

    // 크루 선택 (신규)
    var sel = el.querySelector("#obCrewSelect");
    if (sel) {
      sel.addEventListener("change", function () {
        obDraft.crewId = sel.value;
        var c = findById(window.CREW || [], sel.value) || {};
        // 새 크루에 맞춰 본문 다시 렌더 (직무 항목·입사일 반영)
        var pseudo = { id: rec.id, crewId: sel.value, crewName: c.name || "", link: obDraft.link, date: c.joinDate || "", checklist: JSON.stringify(obDraft.checklist) };
        renderObModalBody(pseudo, c, isNew);
        // 링크 리스너 재연결
        wireObLink(el);
      });
    }
    wireObLink(el);

    el.querySelector("#obSaveBtn").addEventListener("click", function () {
      saveOnboarding(rec, isNew);
    });
    el.querySelector("#obDelBtn").addEventListener("click", function () {
      if (!confirm("이 온보딩 기록을 삭제할까요?")) return;
      window.EDUCATION = (window.EDUCATION || []).filter(function (r) { return String(r.id) !== String(rec.id); });
      saveToSheet({ type: "education", action: "delete", id: rec.id });
      el.remove(); obDraft = null;
      renderEducation();
    });

    el.hidden = false;
  }

  function wireObLink(el) {
    var linkInput = el.querySelector("#obLinkInput");
    if (linkInput) linkInput.addEventListener("input", function () { obDraft.link = linkInput.value.trim(); });
  }

  function renderObModalBody(rec, crew, isNew) {
    var el = document.getElementById("onboardModal");
    var body = el.querySelector("#obModalBody");
    var title = el.querySelector("#obModalTitle");

    var joined = rec.date || (crew && crew.joinDate) || "";
    var dayN = dayCountFrom(joined);
    var left = probationLeft(joined);
    title.innerHTML = (isNew ? "온보딩 추가" : esc(crew.name || rec.crewName || "온보딩")) + '<span class="ob-modal__sub">'
      + (joined ? "입사 " + fmtShortDot(joined) : "입사일 미입력")
      + (dayN != null && dayN > 0 ? " · " + dayN + "일차" : "")
      + (left != null && left > 0 ? " · 수습 D-" + left : "")
      + '</span>';

    var html = "";

    if (isNew) {
      html += '<label class="fld"><span>대상 크루 <em>*</em></span><select id="obCrewSelect">'
        + '<option value="">크루 선택</option>'
        + (window.CREW || []).filter(function (c) { return c.status !== "퇴사"; }).map(function (c) {
            return '<option value="' + esc(c.id) + '"' + (String(c.id) === String(rec.crewId) ? " selected" : "") + '>' + esc(c.name) + (c.group ? ' · ' + esc(c.group) : '') + (isProbation(c) ? ' · 수습' : '') + '</option>';
          }).join("")
        + '</select></label>';
    }

    // 진행률 요약
    var stats = onboardStats({ checklist: obDraft.checklist }, crew);
    html += '<div class="ob-modal__summary">'
      + '<div class="ob-progress ob-progress--lg"><div class="ob-progress__bar" id="obTotalBar" style="width:' + stats.pct + '%"></div></div>'
      + '<span class="ob-modal__pct" id="obTotalPct">독립수행 이상 ' + stats.achieved + '/' + stats.total + ' · ' + stats.pct + '%</span>'
      + '</div>';

    // 드라이브 링크
    html += '<label class="fld"><span>📁 드라이브 링크 <em>(크루별 온보딩 폴더)</em></span>'
      + '<input type="url" id="obLinkInput" value="' + esc(obDraft.link || "") + '" placeholder="' + esc(ONBOARD_DRIVE_ROOT) + '"></label>';

    // 장애 크루 안내
    if (crew && crew.disability === "장애") {
      html += '<div class="ob-dis-banner">'
        + '<b>장애 크루 5단계 방식</b> — '
        + ONBOARD_DIS_STEPS.map(esc).join(" → ")
        + '<span>업무를 나눠 단계적으로 독립시키고, 사진·체크리스트 매뉴얼을 함께 활용하세요.</span>'
        + '</div>';
    }

    // 6영역 체크리스트
    var areas = onboardAreas(crew);
    html += '<div class="ob-areas">';
    areas.forEach(function (a) {
      var aTot = a.items.length, aAch = 0;
      a.items.forEach(function (_, i) { if (onboardAchieved(obDraft.checklist[a.key + ":" + i] || "none")) aAch++; });
      html += '<div class="ob-area" data-ob-areakey="' + a.key + '">'
        + '<div class="ob-area__head"><h4>' + esc(a.title) + '</h4><span class="ob-area__count" data-ob-areacount="' + a.key + '">' + aAch + '/' + aTot + '</span></div>'
        + '<div class="ob-items">';
      a.items.forEach(function (item, i) {
        var cur = obDraft.checklist[a.key + ":" + i] || "none";
        html += '<div class="ob-item">'
          + '<span class="ob-item__label">' + esc(item) + '</span>'
          + '<div class="ob-item__opts">'
          + ONBOARD_STATUS.map(function (s) {
              return '<button type="button" class="ob-item__opt' + (cur === s.key ? " is-on" : "") + '" data-ob-area="' + a.key + '" data-ob-idx="' + i + '" data-ob-val="' + s.key + '" style="--c:' + s.c + '">' + esc(s.label) + '</button>';
            }).join("")
          + '</div>'
        + '</div>';
      });
      html += '</div></div>';
    });
    html += '</div>';

    body.innerHTML = html;
  }

  function updateObProgress(el, crew) {
    var stats = onboardStats({ checklist: obDraft.checklist }, crew);
    var bar = el.querySelector("#obTotalBar");
    var pct = el.querySelector("#obTotalPct");
    if (bar) bar.style.width = stats.pct + "%";
    if (pct) pct.textContent = "독립수행 이상 " + stats.achieved + "/" + stats.total + " · " + stats.pct + "%";
    // 영역별 카운트 갱신
    var areas = onboardAreas(crew);
    areas.forEach(function (a) {
      var aTot = a.items.length, aAch = 0;
      a.items.forEach(function (_, i) { if (onboardAchieved(obDraft.checklist[a.key + ":" + i] || "none")) aAch++; });
      var cnt = el.querySelector('[data-ob-areacount="' + a.key + '"]');
      if (cnt) cnt.textContent = aAch + "/" + aTot;
    });
  }

  function saveOnboarding(rec, isNew) {
    if (isNew && !obDraft.crewId) { alert("대상 크루를 선택해주세요."); return; }
    var crew = findById(window.CREW || [], obDraft.crewId) || {};
    var stats = onboardStats({ checklist: obDraft.checklist }, crew);
    var id = isNew ? ("ob-" + (obDraft.crewId || newId("x"))) : rec.id;
    // 신규인데 이미 같은 크루 온보딩이 있으면 그 레코드를 갱신
    var existing = findById(window.EDUCATION || [], id);
    var out = {
      id: id, category: "OJT온보딩",
      title: (crew.name || rec.crewName || "온보딩") + " 온보딩",
      crewId: obDraft.crewId || rec.crewId || "",
      crewName: crew.name || rec.crewName || "",
      date: (existing && existing.date) || crew.joinDate || rec.date || "",
      dueDate: "", status: deriveOnboardStatus(stats),
      provider: (existing && existing.provider) || "", hours: (existing && existing.hours) || "", note: (existing && existing.note) || "",
      link: obDraft.link || "",
      checklist: JSON.stringify(obDraft.checklist || {}),
    };
    if (!window.EDUCATION) window.EDUCATION = [];
    var idx = indexById(window.EDUCATION, id);
    if (idx > -1) window.EDUCATION[idx] = out; else window.EDUCATION.push(out);
    saveToSheet(eduPayload(out, idx > -1 ? "update" : "add"));
    var el = document.getElementById("onboardModal");
    if (el) el.remove();
    obDraft = null;
    renderEducation();
  }

  /* ======================================================
     법정 / 정기 교육 등록·수정 모달
     ====================================================== */
  var EDU_MODAL_CATS = [
    { key: "법정의무교육", c: "#ff5a52" },
    { key: "정기교육",     c: "#60a5fa" },
  ];

  function openEducationModal(prefill) {
    var el = document.getElementById("educationModal");
    if (!el) { el = buildEducationModal(); document.body.appendChild(el); }
    var form = el.querySelector("form");
    form.reset();
    var editing = !!(prefill && prefill.id);
    form.dataset.id = editing ? prefill.id : "";
    el.querySelector("#educationModalTitle").textContent = editing ? "교육 수정" : "교육 등록";
    el.querySelector("#educationDelBtn").hidden = !editing;

    var sel = form.crewId;
    sel.innerHTML = '<option value="__ALL__">전체 크루</option>'
      + '<option value="__SNACK__">스낵 파트</option>'
      + '<option value="__GARDEN__">가든 파트</option>'
      + '<option value="__GA__">총무지원 파트</option>'
      + '<option disabled>──────────</option>'
      + (window.CREW || []).map(function (c) {
          return '<option value="' + esc(c.id) + '">' + esc(c.name) + (c.group ? ' · ' + esc(c.group) : '') + '</option>';
        }).join("");
    if (prefill && prefill.crewId) form.crewId.value = prefill.crewId;
    else if (prefill && prefill.crewName) {
      var map = { "전체 크루": "__ALL__", "스낵 파트": "__SNACK__", "가든 파트": "__GARDEN__", "총무지원 파트": "__GA__" };
      form.crewId.value = map[prefill.crewName] || "__ALL__";
    } else form.crewId.value = "__ALL__";

    form.title.value = (prefill && prefill.title) || "";
    form.date.value = (prefill && prefill.date) || "";
    form.dueDate.value = (prefill && prefill.dueDate) || "";
    form.provider.value = (prefill && prefill.provider) || "";
    form.hours.value = (prefill && prefill.hours) || "";
    form.note.value = (prefill && prefill.note) || "";

    var cat = (prefill && prefill.category) || (eduSection === "regular" ? "정기교육" : "법정의무교육");
    form.category.value = cat;
    Array.prototype.forEach.call(el.querySelectorAll(".edu-catseg__btn"), function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-cat") === cat);
    });

    var status = (prefill && prefill.status) || "예정";
    form.status.value = status;
    Array.prototype.forEach.call(el.querySelectorAll(".edu-statseg__btn"), function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-status") === status);
    });

    el.hidden = false;
    setTimeout(function () { form.title.focus(); }, 30);
  }
  function closeEducationModal() {
    var el = document.getElementById("educationModal");
    if (el) el.hidden = true;
  }
  function resolveEduTarget(val) {
    var groups = { "__ALL__": "전체 크루", "__SNACK__": "스낵 파트", "__GARDEN__": "가든 파트", "__GA__": "총무지원 파트" };
    if (groups[val]) return { crewId: "", crewName: groups[val] };
    var crew = findById(window.CREW || [], val);
    return { crewId: val, crewName: crew ? crew.name : "" };
  }
  function buildEducationModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "educationModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop"></div>'
      + '<div class="modal__card modal__card--iv" role="dialog" aria-modal="true" aria-label="교육 등록">'
      + '<div class="modal__head"><h3 id="educationModalTitle">교육 등록</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<form id="educationForm">'
      + '<div class="fld"><span>구분</span>'
        + '<input type="hidden" name="category" value="법정의무교육">'
        + '<div class="ivseg edu-catseg">' + EDU_MODAL_CATS.map(function (c) {
            return '<button type="button" class="ivseg__btn edu-catseg__btn" data-cat="' + esc(c.key) + '" style="--c:' + c.c + '">' + esc(c.key) + '</button>';
          }).join("") + '</div>'
      + '</div>'
      + '<label class="fld"><span>교육명 <em>*</em></span><input type="text" name="title" maxlength="80" required placeholder="예) 직장 내 성희롱 예방교육"></label>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>대상</span><select name="crewId"></select></label>'
        + '<div class="fld"><span>상태</span>'
          + '<input type="hidden" name="status" value="예정">'
          + '<div class="ivseg edu-statseg">' + EDU_STATUS.map(function (s) {
              return '<button type="button" class="ivseg__btn edu-statseg__btn" data-status="' + esc(s.key) + '" style="--c:' + s.c + '">' + esc(s.key) + '</button>';
            }).join("") + '</div>'
        + '</div>'
      + '</div>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>실시일 <em>(선택)</em></span><input type="date" name="date"></label>'
        + '<label class="fld"><span>이수기한 <em>(선택)</em></span><input type="date" name="dueDate"></label>'
      + '</div>'
      + '<div class="fld-row">'
        + '<label class="fld"><span>담당 · 기관 <em>(선택)</em></span><input type="text" name="provider" maxlength="40" placeholder="예) 사내 · 외부 강사"></label>'
        + '<label class="fld"><span>교육시간 <em>(선택)</em></span><input type="text" name="hours" maxlength="20" placeholder="예) 1시간"></label>'
      + '</div>'
      + '<label class="fld"><span>비고 <em>(선택)</em></span><textarea name="note" rows="2" maxlength="200" placeholder="특이사항을 입력하세요…"></textarea></label>'
      + '<div class="modal__foot">'
        + '<button type="button" class="btn btn--danger" id="educationDelBtn" hidden>삭제</button>'
        + '<div class="modal__spacer"></div>'
        + '<button type="button" class="btn" data-close>취소</button>'
        + '<button type="submit" class="btn btn--primary">저장</button>'
      + '</div>'
      + '</form>'
      + '</div>';

    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) { closeEducationModal(); return; }
      var catBtn = ev.target.closest(".edu-catseg__btn");
      if (catBtn) {
        var form = wrap.querySelector("form");
        form.category.value = catBtn.getAttribute("data-cat");
        Array.prototype.forEach.call(wrap.querySelectorAll(".edu-catseg__btn"), function (b) { b.classList.toggle("is-on", b === catBtn); });
        return;
      }
      var statBtn = ev.target.closest(".edu-statseg__btn");
      if (statBtn) {
        var form2 = wrap.querySelector("form");
        form2.status.value = statBtn.getAttribute("data-status");
        Array.prototype.forEach.call(wrap.querySelectorAll(".edu-statseg__btn"), function (b) { b.classList.toggle("is-on", b === statBtn); });
        return;
      }
    });
    wrap.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var title = f.title.value.trim();
      if (!title) { alert("교육명을 입력해주세요."); f.title.focus(); return; }
      var target = resolveEduTarget(f.crewId.value);
      var id = f.dataset.id;
      var rec = {
        id: id || newId("ed"),
        category: f.category.value || "정기교육",
        title: title,
        crewId: target.crewId, crewName: target.crewName,
        date: f.date.value || "", dueDate: f.dueDate.value || "",
        status: f.status.value || "예정",
        provider: f.provider.value.trim(), hours: f.hours.value.trim(), note: f.note.value.trim(),
        link: "", checklist: "{}",
      };
      if (!window.EDUCATION) window.EDUCATION = [];
      var idx = id ? indexById(window.EDUCATION, id) : -1;
      if (idx > -1) window.EDUCATION[idx] = rec; else window.EDUCATION.push(rec);
      saveToSheet(eduPayload(rec, id ? "update" : "add"));
      closeEducationModal();
      renderEducation();
    });
    wrap.querySelector("#educationDelBtn").addEventListener("click", function () {
      var id = wrap.querySelector("form").dataset.id;
      if (!id) return;
      if (!confirm("이 교육 기록을 삭제할까요?")) return;
      window.EDUCATION = (window.EDUCATION || []).filter(function (r) { return String(r.id) !== String(id); });
      saveToSheet({ type: "education", action: "delete", id: id });
      closeEducationModal();
      renderEducation();
    });
    return wrap;
  }

  /* ======================================================
     ROUTER
     ====================================================== */
  /* ---------- 2026 KPI ---------- */
  function loadKpiOnce() {
    if (window.KPI_PROGRESS) return Promise.resolve(window.KPI_PROGRESS);
    var ep = endpoint();
    if (!ep) { window.KPI_PROGRESS = {}; return Promise.resolve(window.KPI_PROGRESS); }
    var url = ep + (ep.indexOf("?") > -1 ? "&" : "?") + "action=kpi&_ts=" + Date.now();
    return fetch(url, { cache: "no-store" })
      .then(function (r) { return r.json(); })
      .then(function (d) { window.KPI_PROGRESS = d || {}; return window.KPI_PROGRESS; })
      .catch(function (e) { console.warn("[KPI 로드 실패]", e); window.KPI_PROGRESS = {}; return window.KPI_PROGRESS; });
  }
  function kpiGradeClass(g) { return g === "탁월" ? "top" : g === "충족" ? "meet" : g === "노력필요" ? "need" : "na"; }

  function renderKpi() {
    var data = window.KPI_DATA || [];
    var prog = window.KPI_PROGRESS || {};
    var scoreMap = { "탁월": 1, "충족": 0.7, "노력필요": 0.3 };
    var wsum = 0, achieved = 0, weighted = 0;
    data.forEach(function (g) {
      wsum += g.weight;
      var p = prog[g.no];
      if (p && p.grade && scoreMap[p.grade] != null) { achieved++; weighted += g.weight * scoreMap[p.grade]; }
    });
    var pct = Math.round(weighted * 100);

    var html = '<div class="page-head"><div><p class="eyebrow">Operation / KPI</p>'
      + '<h2>' + (window.KPI_YEAR || 2026) + ' KPI</h2>'
      + '<p class="sub">스낵앤가든 사업팀 성과목표 — 파트별 세부목표 진행과 등급 기준.</p></div></div>';

    if (!data.length) {
      html += '<div class="placeholder placeholder--sm"><p class="muted">KPI 데이터가 없습니다.</p></div>';
      view.innerHTML = html; return;
    }

    html += '<div class="kpi-score">'
      + '<div class="kpi-score__main"><span class="kpi-score__pct">' + pct + '<small>%</small></span>'
      + '<span class="kpi-score__lbl">가중 달성도<br><span class="muted">등급 반영</span></span></div>'
      + '<div class="kpi-score__bars">' + data.map(function (g) {
        var p = prog[g.no] || {}; var s = (p.grade && scoreMap[p.grade] != null) ? scoreMap[p.grade] : 0;
        return '<div class="kpi-score__bar" title="' + esc(g.title) + ' · 비중 ' + Math.round(g.weight * 100) + '%">'
          + '<span class="kpi-score__fill kpi-score__fill--' + kpiGradeClass(p.grade || "") + '" style="height:' + Math.round(s * 100) + '%"></span></div>';
      }).join("") + '</div>'
      + '<div class="kpi-score__meta">' + achieved + ' / ' + data.length + ' 목표 등급 입력 · 비중 합 ' + Math.round(wsum * 100) + '%</div>'
      + '</div>';

    html += '<div class="kpi-list">' + data.map(function (g) {
      var p = prog[g.no] || {};
      var grade = p.grade || "미정";
      var parts = {};
      g.subgoals.forEach(function (s) { (parts[s.part] = parts[s.part] || []).push(s); });
      return '<section class="kpi-card">'
        + '<div class="kpi-card__head">'
          + '<span class="kpi-no">' + g.no + '</span>'
          + '<b class="kpi-title">' + esc(g.title) + '</b>'
          + '<span class="kpi-weight">비중 ' + Math.round(g.weight * 100) + '%</span>'
          + '<span class="kpi-gradepick">' + ["탁월", "충족", "노력필요"].map(function (lv) {
              return '<button type="button" class="kpi-gp' + (grade === lv ? " is-on kpi-gp--" + kpiGradeClass(lv) : "") + '" data-kpi-grade="' + g.no + "|" + lv + '">' + lv + '</button>';
            }).join("") + '</span>'
        + '</div>'
        + '<div class="kpi-parts">' + Object.keys(parts).map(function (pt) {
          return '<div class="kpi-part"><span class="kpi-part__name">' + esc(pt) + '</span><ul>'
            + parts[pt].map(function (s) {
              var idx = g.subgoals.indexOf(s);
              var sp = (p.sub && p.sub[idx]) || null;
              var curVal = sp && sp.current != null ? String(sp.current) : "";
              return '<li><span class="kpi-sub">' + esc(s.text) + '</span>'
                + (s.target ? ' <span class="kpi-target">' + esc(s.target) + '</span>' : '')
                + ' <input class="kpi-curin" type="text" data-kpi-cur="' + g.no + "|" + (idx + 1) + '" value="' + esc(curVal) + '" placeholder="현재값">'
                + '</li>';
            }).join("") + '</ul></div>';
        }).join("") + '</div>'
        + (p.note ? '<p class="kpi-note">' + esc(p.note) + '</p>' : '')
        + '<details class="kpi-more"><summary>등급 기준 · 실시일정 보기</summary><div class="kpi-grades">'
          + ["탁월", "충족", "노력필요"].map(function (lv) {
            return '<div class="kpi-gr kpi-gr--' + kpiGradeClass(lv) + '"><span class="kpi-gr__lbl">' + lv + '</span><ul>'
              + (g.grades[lv] || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join("") + '</ul></div>';
          }).join("") + '</div>'
          + (g.schedule ? '<p class="kpi-sched">🗓 ' + esc(g.schedule) + '</p>' : '')
        + '</details>'
      + '</section>';
    }).join("") + '</div>';

    view.innerHTML = html;

    // 라이브 모드: kpi 진행 데이터 로드 후 재렌더 (구조는 먼저 그려두고 진행률만 채움)
    if (isLive() && !window.KPI_PROGRESS && typeof loadKpiOnce === "function") {
      loadKpiOnce().then(function () { if (location.hash.slice(1) === "kpi") renderKpi(); });
    }
  }

  /* ======================================================
     청구 관리 — 거래명세서 (STATEMENT)
     ====================================================== */
  var stmtMode = null;      // null=목록 | "edit"=편집기 | "view"=보기
  var stmtEditId = null;    // 편집/보기 대상 id ("" = 신규)
  var stmtDraft = null;     // 편집 중 임시 명세서 객체
  var billTab = "statement"; // 청구 관리 활성 탭 : "statement"(거래명세서) | "quote"(견적서)

  /** 청구 관리 진입점 — 활성 탭(거래명세서/견적서/거래처)에 따라 목록/편집/보기 렌더 */
  function renderBilling() {
    if (billTab === "quote") renderQuote();
    else if (billTab === "partner") renderPartner();
    else renderStatement();
  }

  /** 청구 관리 상단 탭 (거래명세서 / 견적서 / 거래처) */
  function billTabsHTML(active) {
    return '<div class="seg bill-tabs">'
      + '<button type="button" class="btn btn--sm ' + (active === "statement" ? "is-on" : "") + '" data-bill-tab="statement">거래명세서</button>'
      + '<button type="button" class="btn btn--sm ' + (active === "quote" ? "is-on" : "") + '" data-bill-tab="quote">견적서</button>'
      + '<button type="button" class="btn btn--sm ' + (active === "partner" ? "is-on" : "") + '" data-bill-tab="partner">거래처</button>'
      + '</div>';
  }
  function bindBillTabs() {
    stmtOnAll(".bill-tabs [data-bill-tab]", "click", function () {
      var t = this.getAttribute("data-bill-tab");
      if (t === billTab) return;
      billTab = t;
      stmtMode = null; stmtEditId = null; stmtDraft = null;
      qMode = null; qEditId = null; qDraft = null;
      renderBilling();
    });
  }

  function stmtQ(sel) { return view.querySelector(sel); }
  function stmtOn(sel, evt, fn) { var el = view.querySelector(sel); if (el) el.addEventListener(evt, fn); }
  function stmtOnAll(sel, evt, fn) { Array.prototype.forEach.call(view.querySelectorAll(sel), function (el) { el.addEventListener(evt, fn); }); }

  function renderStatement() {
    if (stmtMode === "edit") { renderStatementEditor(); return; }
    if (stmtMode === "view") {
      var vs = findById(window.STATEMENTS || [], stmtEditId);
      if (vs) { renderStatementView(vs); return; }
      stmtMode = null;
    }
    renderStatementList();
  }

  function renderStatementList() {
    var list = (window.STATEMENTS || []).slice().sort(function (a, b) {
      return (b.billDate || "") < (a.billDate || "") ? -1 : (b.billDate || "") > (a.billDate || "") ? 1 : 0;
    });
    var yr = d(TODAY).getFullYear();
    var thisYear = list.filter(function (s) { return (s.billDate || "").slice(0, 4) === String(yr); });
    var sumTotal = thisYear.reduce(function (a, s) { return a + (+s.total || 0); }, 0);

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Billing / Statement</p>'
      + '<h2>청구 관리</h2>'
      + '<p class="sub">거래처별 명세서를 등록·관리하고 인쇄/PDF로 출력합니다. <span class="muted">행을 클릭하면 명세서를 볼 수 있어요.</span></p></div>'
      + '<div class="page-head__actions">'
        + billTabsHTML("statement")
        + '<button class="btn btn--primary" id="stmtAddBtn">+ 명세서 등록</button>'
      + '</div>'
      + '</div>';

    html += '<div class="stats">'
      + statCard("acid", list.length, "건", "Total", "전체 명세서")
      + statCard("green", thisYear.length, "건", "This year", yr + "년 등록")
      + statCard("", won(sumTotal), "원", "Amount", yr + "년 합계금액")
      + '</div>';

    // 게시판(board) 형식 목록 — 크루 목록과 동일한 간격(page-head 단일 헤더)
    if (!list.length) {
      html += '<div class="board">'
        + '<div class="board__empty">아직 등록된 거래명세서가 없습니다.<br><span class="muted">우측 상단 <b style="color:var(--accent-text)">+ 명세서 등록</b>으로 첫 명세서를 작성해보세요.</span></div>'
        + '</div>';
    } else {
      var body = list.map(function (s, i) {
        var first = (s.items[0] && s.items[0].name) || "—";
        var more = s.items.length > 1 ? ' <span class="muted">외 ' + (s.items.length - 1) + '건</span>' : '';
        var stCls = s.status === "확정" ? "badge--active" : "badge--leave";
        return '<tr class="board__row" data-st-id="' + esc(s.id) + '">'
          + '<td class="board__no">' + (list.length - i) + '</td>'
          + '<td class="board__no mono">' + esc(s.docNo || "—") + '</td>'
          + '<td class="board__date mono">' + esc(s.billDate || "—") + '</td>'
          + '<td class="board__supplier"><b>' + esc(s.customerName || "—") + '</b>' + (s.contactName ? ' <span class="muted">(' + esc(s.contactName) + ')</span>' : '') + '</td>'
          + '<td class="board__prod">' + esc(first) + more + '</td>'
          + '<td class="board__amt mono">' + won(s.supplyAmount) + '</td>'
          + '<td class="board__amt mono">' + won(s.vat) + '</td>'
          + '<td class="board__amt board__amt--total mono"><b>' + won(s.total) + '</b></td>'
          + '<td class="board__st"><span class="badge ' + stCls + '">' + esc(s.status) + '</span></td>'
          + '<td class="board__act">'
            + '<button class="btn btn--xs" data-act="edit" data-id="' + esc(s.id) + '">수정</button>'
            + '<button class="btn btn--xs" data-act="del" data-id="' + esc(s.id) + '">삭제</button>'
          + '</td>'
          + '</tr>';
      }).join("");
      html += '<div class="board">'
        + '<div class="board__scroll"><table class="board__table board__table--stmt"><thead><tr>'
        + '<th>번호</th><th>문서번호</th><th>청구일</th><th>고객명</th><th>품목</th><th class="num">공급가액</th><th class="num">세액</th><th class="num">합계</th><th>상태</th><th></th>'
        + '</tr></thead><tbody>' + body + '</tbody></table></div>'
        + '</div>';
    }
    view.innerHTML = html;

    bindBillTabs();
    stmtOn("#stmtAddBtn", "click", function () { openStatementEditor(null); });
    stmtOnAll(".board__table--stmt .board__row[data-st-id]", "click", function (ev) {
      if (ev.target.closest("button")) return;
      stmtMode = "view"; stmtEditId = this.getAttribute("data-st-id"); renderStatement();
    });
    stmtOnAll('.board__act button[data-act="edit"]', "click", function () { openStatementEditor(this.getAttribute("data-id")); });
    stmtOnAll('.board__act button[data-act="del"]', "click", function () { deleteStatement(this.getAttribute("data-id")); });
  }

  /** 문서번호 자동 생성 : YYMM + 4자리 순번 (예: 25010001) */
  function genDocNo() {
    var prefix = TODAY.slice(2, 4) + TODAY.slice(5, 7); // YYMM
    var max = 0;
    (window.STATEMENTS || []).forEach(function (s) {
      var dn = String(s.docNo || "");
      if (dn.slice(0, 4) === prefix) { var n = +dn.slice(4); if (n > max) max = n; }
    });
    return prefix + ("000" + (max + 1)).slice(-4);
  }

  function openStatementEditor(id) {
    var src = id ? findById(window.STATEMENTS || [], id) : null;
    if (src) {
      stmtDraft = JSON.parse(JSON.stringify(src));
    } else {
      var extra = loadCompanyExtra();
      stmtDraft = {
        id: "", docNo: genDocNo(), billDate: TODAY, dueDate: "",
        customerName: "", contactName: "",
        bankName: extra.bankName || "", accountNo: extra.accountNo || "",
        accountHolder: extra.accountHolder || company().name,
        phone: extra.phone || "", email: extra.email || "",
        items: [{ name: "", price: 0, qty: 0 }], shipping: 0,
        memo: "", status: "작성",
      };
    }
    stmtEditId = id || "";
    stmtMode = "edit";
    renderStatement();
  }

  function stmtItemRowHTML(it, i) {
    var l = stmtLine(it);
    return '<tr data-i="' + i + '">'
      + '<td class="stmt-idx">' + (i + 1) + '</td>'
      + '<td><input class="stmt-in" data-f="name" data-i="' + i + '" value="' + esc(it.name || "") + '" placeholder="품목명"></td>'
      + '<td><input class="stmt-in stmt-in--num" data-f="price" data-i="' + i + '" type="number" min="0" value="' + (it.price || "") + '" placeholder="0"></td>'
      + '<td><input class="stmt-in stmt-in--num stmt-in--qty" data-f="qty" data-i="' + i + '" type="number" min="0" value="' + (it.qty || "") + '" placeholder="0"></td>'
      + '<td class="num stmt-cell-supply">' + won(l.supply) + '</td>'
      + '<td class="num stmt-cell-vat">' + won(l.vat) + '</td>'
      + '<td class="num stmt-cell-total"><b>' + won(l.total) + '</b></td>'
      + '<td><button class="btn btn--xs stmt-del-item" data-i="' + i + '" title="행 삭제" aria-label="행 삭제">&times;</button></td>'
      + '</tr>';
  }

  function renderStatementEditor() {
    var s = stmtDraft;
    var g = stmtGrand(s.items, s.shipping);
    var partners = window.PARTNERS || [];
    var curCust = null;
    for (var pi = 0; pi < partners.length; pi++) { if (partners[pi].name && partners[pi].name === s.customerName) { curCust = partners[pi]; break; } }
    var custOpts = '<option value="">거래처 선택 / 직접입력</option>'
      + partners.map(function (p) { return '<option value="' + esc(p.id) + '"' + (curCust && curCust.id === p.id ? ' selected' : '') + '>' + esc(p.name) + (p.contact ? ' (' + esc(p.contact) + ')' : '') + '</option>'; }).join("");
    var co = company();

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Billing / Statement</p>'
      + '<h2>' + (stmtEditId ? "명세서 수정" : "명세서 등록") + '</h2>'
      + '<p class="sub">공급자는 <b>' + esc(co.name) + '</b>. 단가는 <b>부가세 별도</b>로 입력하면 공급가액·세액·합계가 자동 계산됩니다.</p></div>'
      + '<div class="page-head__actions">'
        + '<button class="btn" id="stmtCancelBtn">목록으로</button>'
        + '<button class="btn btn--primary" id="stmtSaveBtn">저장</button>'
      + '</div>'
      + '</div>';

    html += '<div class="stmt-editor">';

    // 문서 정보
    html += '<div class="stmt-section-label">문서 정보</div>';
    html += '<div class="stmt-form-grid">'
      + '<label class="stmt-field"><span>문서번호</span><input class="stmt-in" id="stmtDocNo" value="' + esc(s.docNo || "") + '" placeholder="25010001"></label>'
      + '<label class="stmt-field"><span>청구일</span><input class="stmt-in" id="stmtBillDate" type="date" value="' + esc(s.billDate || "") + '"></label>'
      + '<label class="stmt-field"><span>납부기한</span><input class="stmt-in" id="stmtDueDate" type="date" value="' + esc(s.dueDate || "") + '"></label>'
      + '<label class="stmt-field"><span>상태</span><select class="stmt-in" id="stmtStatus">'
        + ['작성', '확정'].map(function (o) { return '<option' + (s.status === o ? ' selected' : '') + '>' + o + '</option>'; }).join("")
      + '</select></label>'
      + '</div>';

    // 고객 정보
    html += '<div class="stmt-section-label">고객 정보 (공급받는자) <span class="stmt-hint">거래처 관리에 등록한 고객을 선택하면 자동 입력됩니다</span></div>';
    html += '<div class="stmt-form-grid">'
      + '<label class="stmt-field stmt-field--wide"><span>거래처 선택</span><select class="stmt-in" id="stmtCustSel">' + custOpts + '</select></label>'
      + '<label class="stmt-field"><span>고객명 (상호)</span><input class="stmt-in" id="stmtCustName" value="' + esc(s.customerName || "") + '" placeholder="예: 카카오페이"></label>'
      + '<label class="stmt-field"><span>담당자명</span><input class="stmt-in" id="stmtContact" value="' + esc(s.contactName || "") + '" placeholder="담당자"></label>'
      + '</div>';
    html += '<label class="stmt-partner-save"><input type="checkbox" id="stmtSaveCust" checked> 이 고객 정보를 거래처 관리에 저장/갱신</label>';

    // 입금 계좌 · 발행처 연락처
    html += '<div class="stmt-section-label">입금 계좌 · 발행처 연락처 <span class="stmt-hint">한 번 입력하면 다음 명세서에 자동으로 채워집니다</span></div>';
    html += '<div class="stmt-form-grid">'
      + '<label class="stmt-field"><span>은행명</span><input class="stmt-in" id="stmtBank" value="' + esc(s.bankName || "") + '" placeholder="예: 국민은행"></label>'
      + '<label class="stmt-field"><span>계좌번호</span><input class="stmt-in" id="stmtAccNo" value="' + esc(s.accountNo || "") + '" placeholder="000-00-000000"></label>'
      + '<label class="stmt-field"><span>예금주</span><input class="stmt-in" id="stmtAccHolder" value="' + esc(s.accountHolder || "") + '" placeholder="' + esc(co.name) + '"></label>'
      + '<label class="stmt-field"><span>전화번호</span><input class="stmt-in" id="stmtPhone" value="' + esc(s.phone || "") + '" placeholder="02-0000-0000"></label>'
      + '<label class="stmt-field stmt-field--wide"><span>이메일</span><input class="stmt-in" id="stmtEmail" value="' + esc(s.email || "") + '" placeholder="billing@linkagelab.co.kr"></label>'
      + '</div>';

    // 품목 테이블
    html += '<div class="stmt-section-label">품목 <span class="stmt-hint">단가는 부가세 별도 금액</span></div>';
    html += '<div class="table-wrap"><table class="crew-table stmt-item-table"><thead><tr>'
      + '<th class="stmt-idx">구분</th><th>품목</th><th class="num">단가</th><th class="num">수량</th>'
      + '<th class="num">공급가액</th><th class="num">세액</th><th class="num">합계</th><th></th>'
      + '</tr></thead><tbody id="stmtItemBody">'
      + s.items.map(stmtItemRowHTML).join("")
      + '</tbody><tfoot>'
      + '<tr class="stmt-ship-row">'
        + '<td colspan="4">배송비 <span class="stmt-hint">부가세 별도</span></td>'
        + '<td class="num"><input class="stmt-in stmt-in--num" id="stmtShip" type="number" min="0" value="' + (s.shipping || "") + '" placeholder="0"></td>'
        + '<td class="num" id="stmtShipVat">' + won(g.shipVat) + '</td>'
        + '<td class="num" id="stmtShipTotal">' + won(g.shipping + g.shipVat) + '</td>'
        + '<td></td>'
      + '</tr>'
      + '<tr class="stmt-total-row">'
        + '<td colspan="4">합계</td>'
        + '<td class="num" id="stmtTotSupply">' + won(g.supply) + '</td>'
        + '<td class="num" id="stmtTotVat">' + won(g.vat) + '</td>'
        + '<td class="num" id="stmtTotTotal"><b>' + won(g.total) + '</b></td>'
        + '<td></td>'
      + '</tr></tfoot></table></div>';
    html += '<button class="btn btn--sm" id="stmtAddItemBtn">+ 품목 추가</button>';

    // 비고
    html += '<label class="stmt-field stmt-field--wide" style="margin-top:16px"><span>비고 (선택)</span>'
      + '<input class="stmt-in" id="stmtMemo" value="' + esc(s.memo || "") + '" placeholder="비고를 입력해주세요."></label>';

    html += '</div>'; // .stmt-editor

    view.innerHTML = html;
    bindStatementEditor();
  }

  function bindStatementEditor() {
    stmtOn("#stmtCancelBtn", "click", function () { stmtMode = null; stmtDraft = null; renderStatement(); });
    stmtOn("#stmtSaveBtn", "click", saveStatement);
    stmtOn("#stmtAddItemBtn", "click", function () {
      syncDraftMeta();
      stmtDraft.items.push({ name: "", price: 0, qty: 0 });
      renderStatementEditor();
    });

    // 메타 입력
    ["#stmtDocNo", "#stmtBillDate", "#stmtDueDate", "#stmtStatus", "#stmtCustName", "#stmtContact",
     "#stmtBank", "#stmtAccNo", "#stmtAccHolder", "#stmtPhone", "#stmtEmail", "#stmtMemo"].forEach(function (sel) {
      stmtOn(sel, "input", syncDraftMeta);
    });

    // 고객(거래처) 선택 → 자동 채움
    stmtOn("#stmtCustSel", "change", function () {
      var p = findById(window.PARTNERS || [], this.value);
      if (!p) return;
      stmtQ("#stmtCustName").value = p.name;
      stmtQ("#stmtContact").value = p.contact || "";
      syncDraftMeta();
    });

    // 품목 입력 → 해당 행/합계만 갱신 (포커스 유지)
    stmtOnAll(".stmt-item-table input.stmt-in[data-i]", "input", function () {
      var i = +this.getAttribute("data-i"), f = this.getAttribute("data-f");
      var val = (f === "price" || f === "qty") ? (+this.value || 0) : this.value;
      stmtDraft.items[i][f] = val;
      if (f === "price" || f === "qty") recomputeStatementRow(i);
    });

    // 배송비 입력 → 합계 갱신
    stmtOn("#stmtShip", "input", function () {
      stmtDraft.shipping = +this.value || 0;
      recomputeStatementRow(-1);
    });

    // 행 삭제
    stmtOnAll(".stmt-del-item", "click", function () {
      var i = +this.getAttribute("data-i");
      syncDraftMeta();
      stmtDraft.items.splice(i, 1);
      if (!stmtDraft.items.length) stmtDraft.items.push({ name: "", price: 0, qty: 0 });
      renderStatementEditor();
    });
  }

  /** 품목 이외의 입력값을 draft 로 동기화 (재렌더 전 호출) */
  function syncDraftMeta() {
    if (!stmtDraft) return;
    var g = function (sel) { var el = stmtQ(sel); return el ? el.value : ""; };
    stmtDraft.docNo = g("#stmtDocNo");
    stmtDraft.billDate = g("#stmtBillDate");
    stmtDraft.dueDate = g("#stmtDueDate");
    stmtDraft.status = g("#stmtStatus");
    stmtDraft.customerName = g("#stmtCustName");
    stmtDraft.contactName = g("#stmtContact");
    stmtDraft.bankName = g("#stmtBank");
    stmtDraft.accountNo = g("#stmtAccNo");
    stmtDraft.accountHolder = g("#stmtAccHolder");
    stmtDraft.phone = g("#stmtPhone");
    stmtDraft.email = g("#stmtEmail");
    stmtDraft.memo = g("#stmtMemo");
    if (stmtQ("#stmtShip")) stmtDraft.shipping = +stmtQ("#stmtShip").value || 0;
  }

  function recomputeStatementRow(i) {
    if (i >= 0) {
      var row = view.querySelector('.stmt-item-table tbody tr[data-i="' + i + '"]');
      if (row) {
        var l = stmtLine(stmtDraft.items[i]);
        row.querySelector(".stmt-cell-supply").textContent = won(l.supply);
        row.querySelector(".stmt-cell-vat").textContent = won(l.vat);
        row.querySelector(".stmt-cell-total").innerHTML = "<b>" + won(l.total) + "</b>";
      }
    }
    var g = stmtGrand(stmtDraft.items, stmtDraft.shipping);
    if (stmtQ("#stmtShipVat")) stmtQ("#stmtShipVat").textContent = won(g.shipVat);
    if (stmtQ("#stmtShipTotal")) stmtQ("#stmtShipTotal").textContent = won(g.shipping + g.shipVat);
    if (stmtQ("#stmtTotSupply")) stmtQ("#stmtTotSupply").textContent = won(g.supply);
    if (stmtQ("#stmtTotVat")) stmtQ("#stmtTotVat").textContent = won(g.vat);
    if (stmtQ("#stmtTotTotal")) stmtQ("#stmtTotTotal").innerHTML = "<b>" + won(g.total) + "</b>";
  }

  function saveStatement() {
    syncDraftMeta();
    var s = stmtDraft;
    if (!s.customerName.trim()) { alert("고객명을 입력하세요."); if (stmtQ("#stmtCustName")) stmtQ("#stmtCustName").focus(); return; }
    var validItems = s.items.filter(function (it) { return (it.name || "").trim() || (+it.price) || (+it.qty); });
    if (!validItems.length) { alert("품목을 1개 이상 입력하세요."); return; }
    s.items = validItems;

    var g = stmtGrand(s.items, s.shipping);
    s.supplyAmount = g.supply; s.vat = g.vat; s.total = g.total;
    if (!s.id) s.id = newId("st");
    if (!s.createdAt) s.createdAt = s.billDate ? (s.billDate + "T00:00:00.000Z") : "";

    var rec = normStatement(s);
    if (!window.STATEMENTS) window.STATEMENTS = [];
    var idx = indexById(window.STATEMENTS, rec.id);
    if (idx > -1) window.STATEMENTS[idx] = rec; else window.STATEMENTS.push(rec);

    // 저장 → GAS 가 드라이브에 PDF 생성 후 링크(driveUrl) 반환 (읽기 가능하면 즉시 반영)
    saveToSheet({
      type: "statement", action: (idx > -1 ? "update" : "add"),
      id: rec.id, docNo: rec.docNo, billDate: rec.billDate, dueDate: rec.dueDate,
      customerName: rec.customerName, contactName: rec.contactName,
      bankName: rec.bankName, accountNo: rec.accountNo, accountHolder: rec.accountHolder,
      phone: rec.phone, email: rec.email,
      items: JSON.stringify(rec.items), shipping: rec.shipping,
      supplyAmount: rec.supplyAmount, vat: rec.vat, total: rec.total,
      memo: rec.memo, status: rec.status, createdAt: rec.createdAt,
    }).then(function (res) {
      if (!res || typeof res.json !== "function") return null;
      return res.json().catch(function () { return null; });
    }).then(function (j) {
      if (j && j.driveUrl) {
        var ix = indexById(window.STATEMENTS, rec.id);
        if (ix > -1) window.STATEMENTS[ix].driveUrl = j.driveUrl;
        if (stmtMode === "view" && String(stmtEditId) === String(rec.id)) renderStatement();
      }
    }).catch(function () {});

    // 연락처·입금계좌 기억
    saveCompanyExtra({ bankName: rec.bankName, accountNo: rec.accountNo, accountHolder: rec.accountHolder, phone: rec.phone, email: rec.email });

    // 고객(거래처) 저장/갱신
    if (stmtQ("#stmtSaveCust") && stmtQ("#stmtSaveCust").checked) {
      upsertPartner({ name: rec.customerName, contact: rec.contactName });
    }

    stmtDraft = null;
    stmtMode = "view"; stmtEditId = rec.id;
    renderStatement();
  }

  function upsertPartner(p) {
    if (!p.name) return;
    if (!window.PARTNERS) window.PARTNERS = [];
    var existing = null;
    for (var i = 0; i < window.PARTNERS.length; i++) {
      if (window.PARTNERS[i].name === p.name) { existing = window.PARTNERS[i]; break; }
    }
    var rec = normPartner({
      id: existing ? existing.id : newId("p"),
      name: p.name, contact: p.contact != null ? p.contact : (existing ? existing.contact : ""),
      bizNo: p.bizNo != null ? p.bizNo : (existing ? existing.bizNo : ""),
      ceo: p.ceo != null ? p.ceo : (existing ? existing.ceo : ""),
      addr: p.addr != null ? p.addr : (existing ? existing.addr : ""),
    });
    if (existing) { var ix = indexById(window.PARTNERS, existing.id); window.PARTNERS[ix] = rec; }
    else window.PARTNERS.push(rec);
    saveToSheet({ type: "partner", action: existing ? "update" : "add", id: rec.id, name: rec.name, contact: rec.contact, bizNo: rec.bizNo, ceo: rec.ceo, addr: rec.addr });
  }

  function deleteStatement(id) {
    var s = findById(window.STATEMENTS || [], id);
    if (!s) return;
    if (!confirm((s.billDate || "") + " · " + (s.customerName || "") + " 명세서를 삭제할까요?")) return;
    window.STATEMENTS = (window.STATEMENTS || []).filter(function (x) { return String(x.id) !== String(id); });
    saveToSheet({ type: "statement", action: "delete", id: id });
    stmtMode = null; renderStatement();
  }

  /** 거래명세서 레이아웃 (보기/인쇄 공용) — 링키지랩(공급자) 발행 양식 */
  function statementSheetHTML(s) {
    var co = company();
    var g = stmtGrand(s.items, s.shipping);
    var rows = "";
    var maxRows = Math.max(s.items.length, 4); // 빈 줄 포함
    for (var i = 0; i < maxRows; i++) {
      var it = s.items[i];
      if (it) {
        var l = stmtLine(it);
        rows += '<tr>'
          + '<td class="l">' + esc(it.name || "") + '</td>'
          + '<td class="r">' + won(it.price) + '</td>'
          + '<td class="r">' + won(it.qty) + '</td>'
          + '<td class="r">' + won(l.supply) + '</td>'
          + '<td class="r">' + won(l.vat) + '</td>'
          + '<td class="r">' + won(l.total) + '</td>'
          + '</tr>';
      } else {
        rows += '<tr class="stmt-sheet__blank"><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
      }
    }
    // 로고: 파일 있으면 이미지, 없으면 회사명 텍스트로 대체
    var logo = '<img class="stmt-sheet__logo" src="' + esc(co.logo) + '" alt="' + esc(co.name) + '" '
      + 'onerror="this.style.display=\'none\';this.nextSibling.style.display=\'inline-block\';">'
      + '<span class="stmt-sheet__logo-fallback" style="display:none">' + esc(co.name) + '</span>';

    return '<div class="stmt-sheet stmt-sheet--v2" id="stmtPrintArea">'
      // 헤더 : 좌측 제목+로고 / 우측 회사정보
      + '<div class="stmt-sheet__top">'
        + '<div class="stmt-sheet__brand">'
          + '<div class="stmt-sheet__title">거래명세서</div>'
          + '<div class="stmt-sheet__logowrap">' + logo + '</div>'
        + '</div>'
        + '<div class="stmt-sheet__co">'
          + '<div class="stmt-sheet__co-name">' + esc(co.name) + '</div>'
          + '<div class="stmt-sheet__co-line">' + esc(co.addr) + '</div>'
          + '<div class="stmt-sheet__co-line">사업자등록번호 ' + esc(co.bizNo) + ' · 대표 ' + esc(co.ceo) + '</div>'
          + (s.phone ? '<div class="stmt-sheet__co-line">' + esc(s.phone) + '</div>' : '')
          + (s.email ? '<div class="stmt-sheet__co-line">' + esc(s.email) + '</div>' : '')
        + '</div>'
      + '</div>'
      + '<div class="stmt-sheet__rule"></div>'
      // 고객 / 입금계좌
      + '<div class="stmt-sheet__meta">'
        + '<div class="stmt-sheet__meta-col">'
          + '<div class="stmt-sheet__meta-h">고객명 (담당자명)</div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">고객명</span><span class="mv">' + esc(s.customerName || "") + (s.contactName ? ' (' + esc(s.contactName) + ')' : '') + '</span></div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">문서번호</span><span class="mv">' + esc(s.docNo || "") + '</span></div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">청구일</span><span class="mv">' + esc(s.billDate || "") + '</span></div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">납부기한</span><span class="mv">' + esc(s.dueDate || "") + '</span></div>'
        + '</div>'
        + '<div class="stmt-sheet__meta-col stmt-sheet__meta-col--r">'
          + '<div class="stmt-sheet__meta-h">입금 계좌 정보</div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">은행명</span><span class="mv">' + esc(s.bankName || "") + '</span></div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">계좌번호</span><span class="mv">' + esc(s.accountNo || "") + '</span></div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">예금주</span><span class="mv">' + esc(s.accountHolder || "") + '</span></div>'
        + '</div>'
      + '</div>'
      // 품목 표
      + '<table class="stmt-sheet__items"><thead><tr>'
        + '<th class="l">품목</th><th class="r">단가</th><th class="r">수량</th><th class="r">공급가액</th><th class="r">세액</th><th class="r">합계</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table>'
      // 합계
      + '<div class="stmt-sheet__totals">'
        + (g.shipping ? '<div class="stmt-sheet__trow"><span class="tk">품목 공급가액</span><span class="tv">' + won(g.itemsSupply) + '</span></div>'
            + '<div class="stmt-sheet__trow"><span class="tk">배송비</span><span class="tv">' + won(g.shipping) + '</span></div>' : '')
        + '<div class="stmt-sheet__trow"><span class="tk">총 공급가액</span><span class="tv">' + won(s.supplyAmount) + '</span></div>'
        + '<div class="stmt-sheet__trow"><span class="tk">총 세액</span><span class="tv">' + won(s.vat) + '</span></div>'
        + '<div class="stmt-sheet__trow stmt-sheet__trow--grand"><span class="tk">총 합계</span><span class="tv">' + won(s.total) + '</span></div>'
      + '</div>'
      // 비고
      + '<div class="stmt-sheet__memo"><div class="stmt-sheet__memo-h">비고</div><div class="stmt-sheet__memo-b">' + (s.memo ? esc(s.memo) : '<span class="muted">비고를 입력해주세요.</span>') + '</div></div>'
      + '</div>';
  }

  function renderStatementView(s) {
    var html = "";
    html += '<div class="page-head stmt-actions">'
      + '<div><p class="eyebrow">Billing / Statement</p>'
      + '<h2>거래명세서 보기</h2>'
      + '<p class="sub">' + esc(s.docNo || "") + ' · ' + esc(s.billDate || "") + ' · ' + esc(s.customerName || "") + '</p></div>'
      + '<div class="page-head__actions">'
        + '<button class="btn" id="stmtBackBtn">목록으로</button>'
        + (s.driveUrl ? '<a class="btn" href="' + esc(s.driveUrl) + '" target="_blank" rel="noopener">📁 Drive에서 열기</a>' : '')
        + '<button class="btn" id="stmtEditBtn2">수정</button>'
        + '<button class="btn btn--primary" id="stmtPrintBtn">🖨 인쇄 / PDF</button>'
      + '</div>'
      + '</div>';
    html += statementSheetHTML(s);
    view.innerHTML = html;

    stmtOn("#stmtBackBtn", "click", function () { stmtMode = null; renderStatement(); });
    stmtOn("#stmtEditBtn2", "click", function () { openStatementEditor(s.id); });
    stmtOn("#stmtPrintBtn", "click", function () { window.print(); });
  }

  /* ======================================================
     견적 관리 — 견적서 (QUOTE)
     거래명세서와 동일한 양식/디자인. 공급자 = 링키지랩, 단가 = 부가세 별도.
     ====================================================== */
  var qMode = null;      // null=목록 | "edit" | "view"
  var qEditId = null;
  var qDraft = null;

  function loadQuoteExtra() {
    try { return JSON.parse(localStorage.getItem("sg-quote-extra") || "{}") || {}; } catch (e) { return {}; }
  }
  function saveQuoteExtra(e) {
    try { localStorage.setItem("sg-quote-extra", JSON.stringify(e)); } catch (x) {}
  }

  function renderQuote() {
    if (qMode === "edit") { renderQuoteEditor(); return; }
    if (qMode === "view") {
      var vq = findById(window.QUOTES || [], qEditId);
      if (vq) { renderQuoteView(vq); return; }
      qMode = null;
    }
    renderQuoteList();
  }

  function renderQuoteList() {
    var list = (window.QUOTES || []).slice().sort(function (a, b) {
      return (b.quoteDate || "") < (a.quoteDate || "") ? -1 : (b.quoteDate || "") > (a.quoteDate || "") ? 1 : 0;
    });
    var yr = d(TODAY).getFullYear();
    var thisYear = list.filter(function (s) { return (s.quoteDate || "").slice(0, 4) === String(yr); });
    var sumTotal = thisYear.reduce(function (a, s) { return a + (+s.total || 0); }, 0);

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Billing / Quote</p>'
      + '<h2>청구 관리</h2>'
      + '<p class="sub">고객사별 견적서를 등록·관리하고 인쇄/PDF로 출력합니다. <span class="muted">행을 클릭하면 견적서를 볼 수 있어요.</span></p></div>'
      + '<div class="page-head__actions">'
        + billTabsHTML("quote")
        + '<button class="btn btn--primary" id="qAddBtn">+ 견적서 등록</button>'
      + '</div>'
      + '</div>';

    html += '<div class="stats">'
      + statCard("acid", list.length, "건", "Total", "전체 견적서")
      + statCard("green", thisYear.length, "건", "This year", yr + "년 등록")
      + statCard("", won(sumTotal), "원", "Amount", yr + "년 합계금액")
      + '</div>';

    if (!list.length) {
      html += '<div class="board">'
        + '<div class="board__empty">아직 등록된 견적서가 없습니다.<br><span class="muted">우측 상단 <b style="color:var(--accent-text)">+ 견적서 등록</b>으로 첫 견적서를 작성해보세요.</span></div>'
        + '</div>';
    } else {
      var body = list.map(function (s, i) {
        var first = (s.items[0] && s.items[0].name) || "—";
        var more = s.items.length > 1 ? ' <span class="muted">외 ' + (s.items.length - 1) + '건</span>' : '';
        var stCls = s.status === "확정" ? "badge--active" : "badge--leave";
        return '<tr class="board__row" data-q-id="' + esc(s.id) + '">'
          + '<td class="board__no">' + (list.length - i) + '</td>'
          + '<td class="board__no mono">' + esc(s.docNo || "—") + '</td>'
          + '<td class="board__date mono">' + esc(s.quoteDate || "—") + '</td>'
          + '<td class="board__supplier"><b>' + esc(s.customerName || "—") + '</b>' + (s.contactName ? ' <span class="muted">(' + esc(s.contactName) + ')</span>' : '') + '</td>'
          + '<td class="board__prod">' + esc(first) + more + '</td>'
          + '<td class="board__amt mono">' + won(s.supplyAmount) + '</td>'
          + '<td class="board__amt mono">' + won(s.vat) + '</td>'
          + '<td class="board__amt board__amt--total mono"><b>' + won(s.total) + '</b></td>'
          + '<td class="board__st"><span class="badge ' + stCls + '">' + esc(s.status) + '</span></td>'
          + '<td class="board__act">'
            + '<button class="btn btn--xs" data-act="edit" data-id="' + esc(s.id) + '">수정</button>'
            + '<button class="btn btn--xs" data-act="del" data-id="' + esc(s.id) + '">삭제</button>'
          + '</td>'
          + '</tr>';
      }).join("");
      html += '<div class="board">'
        + '<div class="board__scroll"><table class="board__table board__table--stmt"><thead><tr>'
        + '<th>번호</th><th>견적번호</th><th>견적일자</th><th>고객명</th><th>품목</th><th class="num">공급가액</th><th class="num">세액</th><th class="num">합계</th><th>상태</th><th></th>'
        + '</tr></thead><tbody>' + body + '</tbody></table></div>'
        + '</div>';
    }
    view.innerHTML = html;

    bindBillTabs();
    stmtOn("#qAddBtn", "click", function () { openQuoteEditor(null); });
    stmtOnAll(".board__table--stmt .board__row[data-q-id]", "click", function (ev) {
      if (ev.target.closest("button")) return;
      qMode = "view"; qEditId = this.getAttribute("data-q-id"); renderQuote();
    });
    stmtOnAll('.board__act button[data-act="edit"]', "click", function () { openQuoteEditor(this.getAttribute("data-id")); });
    stmtOnAll('.board__act button[data-act="del"]', "click", function () { deleteQuote(this.getAttribute("data-id")); });
  }

  /** 견적번호 자동 생성 : Q + YYMM + 4자리 순번 (예: Q25010001) */
  function genQuoteNo() {
    var prefix = TODAY.slice(2, 4) + TODAY.slice(5, 7); // YYMM
    var max = 0;
    (window.QUOTES || []).forEach(function (s) {
      var dn = String(s.docNo || "").replace(/^Q/i, "");
      if (dn.slice(0, 4) === prefix) { var n = +dn.slice(4); if (n > max) max = n; }
    });
    return "Q" + prefix + ("000" + (max + 1)).slice(-4);
  }

  function openQuoteEditor(id) {
    var src = id ? findById(window.QUOTES || [], id) : null;
    if (src) {
      qDraft = JSON.parse(JSON.stringify(src));
    } else {
      var extra = loadQuoteExtra();
      qDraft = {
        id: "", docNo: genQuoteNo(), quoteDate: TODAY, validUntil: "",
        customerName: "", contactName: "",
        repName: extra.repName || "", repPhone: extra.repPhone || "", repEmail: extra.repEmail || "",
        items: [{ name: "", spec: "", unit: "", price: 0, qty: 0 }], shipping: 0,
        notes: "", status: "작성",
      };
    }
    qEditId = id || "";
    qMode = "edit";
    renderQuote();
  }

  function qItemRowHTML(it, i) {
    var l = stmtLine(it);
    return '<tr data-i="' + i + '">'
      + '<td class="stmt-idx">' + (i + 1) + '</td>'
      + '<td><input class="stmt-in" data-f="name" data-i="' + i + '" value="' + esc(it.name || "") + '" placeholder="품목명"></td>'
      + '<td><input class="stmt-in" data-f="spec" data-i="' + i + '" value="' + esc(it.spec || "") + '" placeholder="규격"></td>'
      + '<td><input class="stmt-in stmt-in--sm" data-f="unit" data-i="' + i + '" value="' + esc(it.unit || "") + '" placeholder="단위"></td>'
      + '<td><input class="stmt-in stmt-in--num" data-f="price" data-i="' + i + '" type="number" min="0" value="' + (it.price || "") + '" placeholder="0"></td>'
      + '<td><input class="stmt-in stmt-in--num stmt-in--qty" data-f="qty" data-i="' + i + '" type="number" min="0" value="' + (it.qty || "") + '" placeholder="0"></td>'
      + '<td class="num stmt-cell-supply">' + won(l.supply) + '</td>'
      + '<td class="num stmt-cell-vat">' + won(l.vat) + '</td>'
      + '<td class="num stmt-cell-total"><b>' + won(l.total) + '</b></td>'
      + '<td><button class="btn btn--xs stmt-del-item" data-i="' + i + '" title="행 삭제" aria-label="행 삭제">&times;</button></td>'
      + '</tr>';
  }

  function renderQuoteEditor() {
    var s = qDraft;
    var g = stmtGrand(s.items, s.shipping);
    var partners = window.PARTNERS || [];
    var curCust = null;
    for (var pi = 0; pi < partners.length; pi++) { if (partners[pi].name && partners[pi].name === s.customerName) { curCust = partners[pi]; break; } }
    var custOpts = '<option value="">거래처 선택 / 직접입력</option>'
      + partners.map(function (p) { return '<option value="' + esc(p.id) + '"' + (curCust && curCust.id === p.id ? ' selected' : '') + '>' + esc(p.name) + (p.contact ? ' (' + esc(p.contact) + ')' : '') + '</option>'; }).join("");
    var co = company();

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Billing / Quote</p>'
      + '<h2>' + (qEditId ? "견적서 수정" : "견적서 등록") + '</h2>'
      + '<p class="sub">공급자는 <b>' + esc(co.name) + '</b>. 단가는 <b>부가세 별도</b>로 입력하면 공급가액·세액·합계가 자동 계산됩니다.</p></div>'
      + '<div class="page-head__actions">'
        + '<button class="btn" id="qCancelBtn">목록으로</button>'
        + '<button class="btn btn--primary" id="qSaveBtn">저장</button>'
      + '</div>'
      + '</div>';

    html += '<div class="stmt-editor">';

    // 문서 정보
    html += '<div class="stmt-section-label">문서 정보</div>';
    html += '<div class="stmt-form-grid">'
      + '<label class="stmt-field"><span>견적번호</span><input class="stmt-in" id="qDocNo" value="' + esc(s.docNo || "") + '" placeholder="Q25010001"></label>'
      + '<label class="stmt-field"><span>견적일자</span><input class="stmt-in" id="qQuoteDate" type="date" value="' + esc(s.quoteDate || "") + '"></label>'
      + '<label class="stmt-field"><span>유효기간</span><input class="stmt-in" id="qValidUntil" type="date" value="' + esc(s.validUntil || "") + '"></label>'
      + '<label class="stmt-field"><span>상태</span><select class="stmt-in" id="qStatus">'
        + ['작성', '확정'].map(function (o) { return '<option' + (s.status === o ? ' selected' : '') + '>' + o + '</option>'; }).join("")
      + '</select></label>'
      + '</div>';

    // 고객 정보
    html += '<div class="stmt-section-label">고객 정보 (수신처) <span class="stmt-hint">거래처 관리에 등록한 고객을 선택하면 자동 입력됩니다</span></div>';
    html += '<div class="stmt-form-grid">'
      + '<label class="stmt-field stmt-field--wide"><span>거래처 선택</span><select class="stmt-in" id="qCustSel">' + custOpts + '</select></label>'
      + '<label class="stmt-field"><span>고객명 (상호)</span><input class="stmt-in" id="qCustName" value="' + esc(s.customerName || "") + '" placeholder="예: 카카오페이"></label>'
      + '<label class="stmt-field"><span>담당자명</span><input class="stmt-in" id="qContact" value="' + esc(s.contactName || "") + '" placeholder="담당자"></label>'
      + '</div>';
    html += '<label class="stmt-partner-save"><input type="checkbox" id="qSaveCust" checked> 이 고객 정보를 거래처 관리에 저장/갱신</label>';

    // 발행처 담당자
    html += '<div class="stmt-section-label">발행처 담당자 <span class="stmt-hint">한 번 입력하면 다음 견적서에 자동으로 채워집니다</span></div>';
    html += '<div class="stmt-form-grid">'
      + '<label class="stmt-field"><span>담당자명</span><input class="stmt-in" id="qRepName" value="' + esc(s.repName || "") + '" placeholder="예: 서준오 팀장"></label>'
      + '<label class="stmt-field"><span>연락처</span><input class="stmt-in" id="qRepPhone" value="' + esc(s.repPhone || "") + '" placeholder="010-0000-0000"></label>'
      + '<label class="stmt-field stmt-field--wide"><span>이메일</span><input class="stmt-in" id="qRepEmail" value="' + esc(s.repEmail || "") + '" placeholder="sales@linkagelab.co.kr"></label>'
      + '</div>';

    // 품목 테이블
    html += '<div class="stmt-section-label">품목 <span class="stmt-hint">단가는 부가세 별도 금액</span></div>';
    html += '<div class="table-wrap"><table class="crew-table stmt-item-table"><thead><tr>'
      + '<th class="stmt-idx">구분</th><th>품목</th><th>규격</th><th>단위</th><th class="num">단가</th><th class="num">수량</th>'
      + '<th class="num">공급가액</th><th class="num">세액</th><th class="num">합계</th><th></th>'
      + '</tr></thead><tbody id="qItemBody">'
      + s.items.map(qItemRowHTML).join("")
      + '</tbody><tfoot>'
      + '<tr class="stmt-ship-row">'
        + '<td colspan="6">배송비 <span class="stmt-hint">부가세 별도</span></td>'
        + '<td class="num"><input class="stmt-in stmt-in--num" id="qShip" type="number" min="0" value="' + (s.shipping || "") + '" placeholder="0"></td>'
        + '<td class="num" id="qShipVat">' + won(g.shipVat) + '</td>'
        + '<td class="num" id="qShipTotal">' + won(g.shipping + g.shipVat) + '</td>'
        + '<td></td>'
      + '</tr>'
      + '<tr class="stmt-total-row">'
        + '<td colspan="6">합계</td>'
        + '<td class="num" id="qTotSupply">' + won(g.supply) + '</td>'
        + '<td class="num" id="qTotVat">' + won(g.vat) + '</td>'
        + '<td class="num" id="qTotTotal"><b>' + won(g.total) + '</b></td>'
        + '<td></td>'
      + '</tr></tfoot></table></div>';
    html += '<button class="btn btn--sm" id="qAddItemBtn">+ 품목 추가</button>';

    // 특이사항
    html += '<label class="stmt-field stmt-field--wide" style="margin-top:16px"><span>특이사항 (선택)</span>'
      + '<input class="stmt-in" id="qNotes" value="' + esc(s.notes || "") + '" placeholder="예: 식물 식재 및 폐기 포함비용 / 도매시장 미보유 시 발주자와 협의하여 대체수종"></label>';

    html += '</div>'; // .stmt-editor

    view.innerHTML = html;
    bindQuoteEditor();
  }

  function bindQuoteEditor() {
    stmtOn("#qCancelBtn", "click", function () { qMode = null; qDraft = null; renderQuote(); });
    stmtOn("#qSaveBtn", "click", saveQuote);
    stmtOn("#qAddItemBtn", "click", function () {
      syncQuoteMeta();
      qDraft.items.push({ name: "", spec: "", unit: "", price: 0, qty: 0 });
      renderQuoteEditor();
    });

    ["#qDocNo", "#qQuoteDate", "#qValidUntil", "#qStatus", "#qCustName", "#qContact",
     "#qRepName", "#qRepPhone", "#qRepEmail", "#qNotes"].forEach(function (sel) {
      stmtOn(sel, "input", syncQuoteMeta);
    });

    stmtOn("#qCustSel", "change", function () {
      var p = findById(window.PARTNERS || [], this.value);
      if (!p) return;
      stmtQ("#qCustName").value = p.name;
      stmtQ("#qContact").value = p.contact || "";
      syncQuoteMeta();
    });

    stmtOnAll(".stmt-item-table input.stmt-in[data-i]", "input", function () {
      var i = +this.getAttribute("data-i"), f = this.getAttribute("data-f");
      var val = (f === "price" || f === "qty") ? (+this.value || 0) : this.value;
      qDraft.items[i][f] = val;
      if (f === "price" || f === "qty") recomputeQuoteRow(i);
    });

    stmtOn("#qShip", "input", function () {
      qDraft.shipping = +this.value || 0;
      recomputeQuoteRow(-1);
    });

    stmtOnAll(".stmt-del-item", "click", function () {
      var i = +this.getAttribute("data-i");
      syncQuoteMeta();
      qDraft.items.splice(i, 1);
      if (!qDraft.items.length) qDraft.items.push({ name: "", spec: "", unit: "", price: 0, qty: 0 });
      renderQuoteEditor();
    });
  }

  function syncQuoteMeta() {
    if (!qDraft) return;
    var g = function (sel) { var el = stmtQ(sel); return el ? el.value : ""; };
    qDraft.docNo = g("#qDocNo");
    qDraft.quoteDate = g("#qQuoteDate");
    qDraft.validUntil = g("#qValidUntil");
    qDraft.status = g("#qStatus");
    qDraft.customerName = g("#qCustName");
    qDraft.contactName = g("#qContact");
    qDraft.repName = g("#qRepName");
    qDraft.repPhone = g("#qRepPhone");
    qDraft.repEmail = g("#qRepEmail");
    qDraft.notes = g("#qNotes");
    if (stmtQ("#qShip")) qDraft.shipping = +stmtQ("#qShip").value || 0;
  }

  function recomputeQuoteRow(i) {
    if (i >= 0) {
      var row = view.querySelector('.stmt-item-table tbody tr[data-i="' + i + '"]');
      if (row) {
        var l = stmtLine(qDraft.items[i]);
        row.querySelector(".stmt-cell-supply").textContent = won(l.supply);
        row.querySelector(".stmt-cell-vat").textContent = won(l.vat);
        row.querySelector(".stmt-cell-total").innerHTML = "<b>" + won(l.total) + "</b>";
      }
    }
    var g = stmtGrand(qDraft.items, qDraft.shipping);
    if (stmtQ("#qShipVat")) stmtQ("#qShipVat").textContent = won(g.shipVat);
    if (stmtQ("#qShipTotal")) stmtQ("#qShipTotal").textContent = won(g.shipping + g.shipVat);
    if (stmtQ("#qTotSupply")) stmtQ("#qTotSupply").textContent = won(g.supply);
    if (stmtQ("#qTotVat")) stmtQ("#qTotVat").textContent = won(g.vat);
    if (stmtQ("#qTotTotal")) stmtQ("#qTotTotal").innerHTML = "<b>" + won(g.total) + "</b>";
  }

  function saveQuote() {
    syncQuoteMeta();
    var s = qDraft;
    if (!s.customerName.trim()) { alert("고객명을 입력하세요."); if (stmtQ("#qCustName")) stmtQ("#qCustName").focus(); return; }
    var validItems = s.items.filter(function (it) { return (it.name || "").trim() || (+it.price) || (+it.qty); });
    if (!validItems.length) { alert("품목을 1개 이상 입력하세요."); return; }
    s.items = validItems;

    var g = stmtGrand(s.items, s.shipping);
    s.supplyAmount = g.supply; s.vat = g.vat; s.total = g.total;
    if (!s.id) s.id = newId("q");
    if (!s.createdAt) s.createdAt = s.quoteDate ? (s.quoteDate + "T00:00:00.000Z") : "";

    var rec = normQuote(s);
    if (!window.QUOTES) window.QUOTES = [];
    var idx = indexById(window.QUOTES, rec.id);
    if (idx > -1) window.QUOTES[idx] = rec; else window.QUOTES.push(rec);

    saveToSheet({
      type: "quote", action: (idx > -1 ? "update" : "add"),
      id: rec.id, docNo: rec.docNo, quoteDate: rec.quoteDate, validUntil: rec.validUntil,
      customerName: rec.customerName, contactName: rec.contactName,
      repName: rec.repName, repPhone: rec.repPhone, repEmail: rec.repEmail,
      items: JSON.stringify(rec.items), shipping: rec.shipping,
      supplyAmount: rec.supplyAmount, vat: rec.vat, total: rec.total,
      notes: rec.notes, status: rec.status, createdAt: rec.createdAt,
    }).then(function (res) {
      if (!res || typeof res.json !== "function") return null;
      return res.json().catch(function () { return null; });
    }).then(function (j) {
      if (j && j.driveUrl) {
        var ix = indexById(window.QUOTES, rec.id);
        if (ix > -1) window.QUOTES[ix].driveUrl = j.driveUrl;
        if (qMode === "view" && String(qEditId) === String(rec.id)) renderQuote();
      }
    }).catch(function () {});

    saveQuoteExtra({ repName: rec.repName, repPhone: rec.repPhone, repEmail: rec.repEmail });

    if (stmtQ("#qSaveCust") && stmtQ("#qSaveCust").checked) {
      upsertPartner({ name: rec.customerName, contact: rec.contactName });
    }

    qDraft = null;
    qMode = "view"; qEditId = rec.id;
    renderQuote();
  }

  function deleteQuote(id) {
    var s = findById(window.QUOTES || [], id);
    if (!s) return;
    if (!confirm((s.quoteDate || "") + " · " + (s.customerName || "") + " 견적서를 삭제할까요?")) return;
    window.QUOTES = (window.QUOTES || []).filter(function (x) { return String(x.id) !== String(id); });
    saveToSheet({ type: "quote", action: "delete", id: id });
    qMode = null; renderQuote();
  }

  /** 견적서 레이아웃 (보기/인쇄 공용) — 거래명세서와 동일 양식 */
  function quoteSheetHTML(s) {
    var co = company();
    var g = stmtGrand(s.items, s.shipping);
    var rows = "";
    var maxRows = Math.max(s.items.length, 4);
    for (var i = 0; i < maxRows; i++) {
      var it = s.items[i];
      if (it) {
        var l = stmtLine(it);
        rows += '<tr>'
          + '<td class="l">' + esc(it.name || "") + '</td>'
          + '<td class="l">' + esc(it.spec || "") + '</td>'
          + '<td class="r">' + esc(it.unit || "") + '</td>'
          + '<td class="r">' + won(it.qty) + '</td>'
          + '<td class="r">' + won(it.price) + '</td>'
          + '<td class="r">' + won(l.supply) + '</td>'
          + '<td class="r">' + won(l.vat) + '</td>'
          + '<td class="r">' + won(l.total) + '</td>'
          + '</tr>';
      } else {
        rows += '<tr class="stmt-sheet__blank"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
      }
    }
    var logo = '<img class="stmt-sheet__logo" src="' + esc(co.logo) + '" alt="' + esc(co.name) + '" '
      + 'onerror="this.style.display=\'none\';this.nextSibling.style.display=\'inline-block\';">'
      + '<span class="stmt-sheet__logo-fallback" style="display:none">' + esc(co.name) + '</span>';

    return '<div class="stmt-sheet stmt-sheet--v2" id="stmtPrintArea">'
      + '<div class="stmt-sheet__top">'
        + '<div class="stmt-sheet__brand">'
          + '<div class="stmt-sheet__title">견적서</div>'
          + '<div class="stmt-sheet__logowrap">' + logo + '</div>'
        + '</div>'
        + '<div class="stmt-sheet__co">'
          + '<div class="stmt-sheet__co-name">' + esc(co.name) + '</div>'
          + '<div class="stmt-sheet__co-line">' + esc(co.addr) + '</div>'
          + '<div class="stmt-sheet__co-line">사업자등록번호 ' + esc(co.bizNo) + ' · 대표 ' + esc(co.ceo) + '</div>'
          + (s.repPhone ? '<div class="stmt-sheet__co-line">' + esc(s.repPhone) + '</div>' : '')
          + (s.repEmail ? '<div class="stmt-sheet__co-line">' + esc(s.repEmail) + '</div>' : '')
        + '</div>'
      + '</div>'
      + '<div class="stmt-sheet__rule"></div>'
      // 수신처 / 발행처 담당자
      + '<div class="stmt-sheet__meta">'
        + '<div class="stmt-sheet__meta-col">'
          + '<div class="stmt-sheet__meta-h">수신처</div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">고객명</span><span class="mv">' + esc(s.customerName || "") + (s.customerName ? " 귀하" : "") + (s.contactName ? ' (' + esc(s.contactName) + ')' : '') + '</span></div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">견적번호</span><span class="mv">' + esc(s.docNo || "") + '</span></div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">견적일자</span><span class="mv">' + esc(s.quoteDate || "") + '</span></div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">유효기간</span><span class="mv">' + esc(s.validUntil || "") + '</span></div>'
        + '</div>'
        + '<div class="stmt-sheet__meta-col stmt-sheet__meta-col--r">'
          + '<div class="stmt-sheet__meta-h">발행처 담당자</div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">담당자</span><span class="mv">' + esc(s.repName || "") + '</span></div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">연락처</span><span class="mv">' + esc(s.repPhone || "") + '</span></div>'
          + '<div class="stmt-sheet__mrow"><span class="mk">이메일</span><span class="mv">' + esc(s.repEmail || "") + '</span></div>'
        + '</div>'
      + '</div>'
      // 안내 문구 + 한글 합계
      + '<div class="stmt-sheet__mrow" style="margin:-14px 0 18px"><span class="mv">아래와 같이 견적합니다. &nbsp;&nbsp; <b>일금 ' + numToKorean(s.total) + '원정 (₩' + won(s.total) + ')</b> <span style="color:#888">· VAT 포함</span></span></div>'
      // 품목 표
      + '<table class="stmt-sheet__items"><thead><tr>'
        + '<th class="l">품목</th><th class="l">규격</th><th class="r">단위</th><th class="r">수량</th><th class="r">단가</th><th class="r">공급가액</th><th class="r">세액</th><th class="r">합계</th>'
      + '</tr></thead><tbody>' + rows + '</tbody></table>'
      // 합계
      + '<div class="stmt-sheet__totals">'
        + (g.shipping ? '<div class="stmt-sheet__trow"><span class="tk">품목 공급가액</span><span class="tv">' + won(g.itemsSupply) + '</span></div>'
            + '<div class="stmt-sheet__trow"><span class="tk">배송비</span><span class="tv">' + won(g.shipping) + '</span></div>' : '')
        + '<div class="stmt-sheet__trow"><span class="tk">공급가액 (VAT 별도)</span><span class="tv">' + won(s.supplyAmount) + '</span></div>'
        + '<div class="stmt-sheet__trow"><span class="tk">부가세액</span><span class="tv">' + won(s.vat) + '</span></div>'
        + '<div class="stmt-sheet__trow stmt-sheet__trow--grand"><span class="tk">합계 금액</span><span class="tv">' + won(s.total) + '</span></div>'
      + '</div>'
      // 특이사항
      + '<div class="stmt-sheet__memo"><div class="stmt-sheet__memo-h">특이사항</div><div class="stmt-sheet__memo-b">' + (s.notes ? esc(s.notes) : '<span class="muted">특이사항 없음</span>') + '</div></div>'
      + '</div>';
  }

  function renderQuoteView(s) {
    var html = "";
    html += '<div class="page-head stmt-actions">'
      + '<div><p class="eyebrow">Billing / Quote</p>'
      + '<h2>견적서 보기</h2>'
      + '<p class="sub">' + esc(s.docNo || "") + ' · ' + esc(s.quoteDate || "") + ' · ' + esc(s.customerName || "") + '</p></div>'
      + '<div class="page-head__actions">'
        + '<button class="btn" id="qBackBtn">목록으로</button>'
        + (s.driveUrl ? '<a class="btn" href="' + esc(s.driveUrl) + '" target="_blank" rel="noopener">📁 Drive에서 열기</a>' : '')
        + '<button class="btn" id="qEditBtn2">수정</button>'
        + '<button class="btn btn--primary" id="qPrintBtn">🖨 인쇄 / PDF</button>'
      + '</div>'
      + '</div>';
    html += quoteSheetHTML(s);
    view.innerHTML = html;

    stmtOn("#qBackBtn", "click", function () { qMode = null; renderQuote(); });
    stmtOn("#qEditBtn2", "click", function () { openQuoteEditor(s.id); });
    stmtOn("#qPrintBtn", "click", function () { window.print(); });
  }

  /* ======================================================
     거래처 관리 — 사업장(PARTNER) CRUD
     ====================================================== */
  function renderPartner() {
    var list = (window.PARTNERS || []).slice().sort(function (a, b) {
      return (a.name || "") < (b.name || "") ? -1 : (a.name || "") > (b.name || "") ? 1 : 0;
    });

    var html = "";
    html += '<div class="page-head">'
      + '<div><p class="eyebrow">Billing / Customer</p>'
      + '<h2>청구 관리</h2>'
      + '<p class="sub">고객사를 등록해두면 명세서·견적서 작성 시 선택만으로 자동 입력됩니다. <span class="muted">행을 클릭하면 수정할 수 있어요.</span></p></div>'
      + '<div class="page-head__actions">'
        + billTabsHTML("partner")
        + '<button class="btn btn--primary" id="partnerAddBtn">+ 거래처 등록</button>'
      + '</div>'
      + '</div>';

    html += '<div class="stats">'
      + statCard("acid", list.length, "곳", "Total", "등록 고객사")
      + '</div>';

    // 크루 목록과 동일한 간격(page-head 단일 헤더)
    if (!list.length) {
      html += '<div class="board">'
        + '<div class="board__empty">아직 등록된 거래처가 없습니다.<br><span class="muted">우측 상단 <b style="color:var(--accent-text)">+ 거래처 등록</b>으로 고객사를 추가하세요.</span></div>'
        + '</div>';
    } else {
      var body = list.map(function (p, i) {
        return '<tr class="board__row" data-pt-id="' + esc(p.id) + '">'
          + '<td class="board__no">' + (i + 1) + '</td>'
          + '<td class="board__supplier"><b>' + esc(p.name || "—") + '</b></td>'
          + '<td>' + esc(p.contact || "—") + '</td>'
          + '<td class="mono">' + esc(p.bizNo || "—") + '</td>'
          + '<td class="board__addr">' + esc(p.addr || "—") + '</td>'
          + '<td class="board__act">'
            + '<button class="btn btn--xs" data-act="pedit" data-id="' + esc(p.id) + '">수정</button>'
            + '<button class="btn btn--xs" data-act="pdel" data-id="' + esc(p.id) + '">삭제</button>'
          + '</td>'
          + '</tr>';
      }).join("");
      html += '<div class="board">'
        + '<div class="board__scroll"><table class="board__table board__table--partner"><thead><tr>'
        + '<th>번호</th><th>고객명 (상호)</th><th>담당자</th><th>사업자등록번호</th><th>주소</th><th></th>'
        + '</tr></thead><tbody>' + body + '</tbody></table></div>'
        + '</div>';
    }
    view.innerHTML = html;

    bindBillTabs();
    stmtOn("#partnerAddBtn", "click", function () { openPartnerModal(null); });
    stmtOnAll(".board__table--partner .board__row[data-pt-id]", "click", function (ev) {
      if (ev.target.closest("button")) return;
      openPartnerModal(findById(window.PARTNERS || [], this.getAttribute("data-pt-id")));
    });
    stmtOnAll('.board__act button[data-act="pedit"]', "click", function () { openPartnerModal(findById(window.PARTNERS || [], this.getAttribute("data-id"))); });
    stmtOnAll('.board__act button[data-act="pdel"]', "click", function () { deletePartnerById(this.getAttribute("data-id")); });
  }

  function openPartnerModal(prefill) {
    var el = document.getElementById("partnerModal");
    if (!el) { el = buildPartnerModal(); document.body.appendChild(el); }
    var form = el.querySelector("form");
    form.reset();
    var editing = !!(prefill && prefill.id);
    form.dataset.id = editing ? prefill.id : "";
    el.querySelector("#partnerModalTitle").textContent = editing ? "거래처 정보 수정" : "신규 거래처 등록";
    el.querySelector("#partnerDelBtn").hidden = !editing;
    form.name.value = (prefill && prefill.name) || "";
    form.contact.value = (prefill && prefill.contact) || "";
    form.bizNo.value = (prefill && prefill.bizNo) || "";
    form.ceo.value = (prefill && prefill.ceo) || "";
    form.addr.value = (prefill && prefill.addr) || "";
    el.hidden = false;
    setTimeout(function () { form.name.focus(); }, 30);
  }
  function closePartnerModal() {
    var el = document.getElementById("partnerModal");
    if (el) el.hidden = true;
  }
  function buildPartnerModal() {
    var wrap = document.createElement("div");
    wrap.className = "modal";
    wrap.id = "partnerModal";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal__backdrop"></div>'
      + '<div class="modal__card" role="dialog" aria-modal="true" aria-label="거래처 등록">'
      + '<div class="modal__head"><h3 id="partnerModalTitle">신규 거래처 등록</h3><button type="button" class="modal__x" data-close aria-label="닫기">×</button></div>'
      + '<form id="partnerForm">'
      + '<div class="fld-row--2">'
        + '<label class="fld"><span>고객명 (상호)</span><input type="text" name="name" maxlength="40" required placeholder="예: 카카오페이"></label>'
        + '<label class="fld"><span>담당자명</span><input type="text" name="contact" maxlength="20" placeholder="담당자"></label>'
      + '</div>'
      + '<div class="fld-row--2">'
        + '<label class="fld"><span>사업자등록번호 <em>(선택)</em></span><input type="text" name="bizNo" maxlength="20" placeholder="000-00-00000"></label>'
        + '<label class="fld"><span>대표자 <em>(선택)</em></span><input type="text" name="ceo" maxlength="20" placeholder="대표자명"></label>'
      + '</div>'
      + '<label class="fld"><span>주소 <em>(선택)</em></span><input type="text" name="addr" maxlength="120" placeholder="주소"></label>'
      + '<div class="modal__foot">'
        + '<button type="button" class="btn btn--danger" id="partnerDelBtn" hidden>삭제</button>'
        + '<div class="modal__spacer"></div>'
        + '<button type="button" class="btn" data-close>취소</button>'
        + '<button type="submit" class="btn btn--primary">저장</button>'
      + '</div>'
      + '</form>'
      + '</div>';

    wrap.addEventListener("click", function (ev) {
      if (ev.target.hasAttribute("data-close")) closePartnerModal();
    });
    wrap.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var f = ev.target;
      var name = f.name.value.trim();
      if (!name) return;
      var id = f.dataset.id;
      var rec = normPartner({
        id: id || newId("p"), name: name, contact: f.contact.value.trim(),
        bizNo: f.bizNo.value.trim(), ceo: f.ceo.value.trim(), addr: f.addr.value.trim(),
      });
      if (!window.PARTNERS) window.PARTNERS = [];
      var idx = id ? indexById(window.PARTNERS, id) : -1;
      if (idx > -1) window.PARTNERS[idx] = rec; else window.PARTNERS.push(rec);
      saveToSheet({ type: "partner", action: id ? "update" : "add", id: rec.id, name: rec.name, contact: rec.contact, bizNo: rec.bizNo, ceo: rec.ceo, addr: rec.addr });
      closePartnerModal();
      renderPartner();
    });
    wrap.querySelector("#partnerDelBtn").addEventListener("click", function () {
      var id = wrap.querySelector("form").dataset.id;
      if (!id) return;
      if (!confirm("이 거래처를 삭제할까요? (기존 명세서에는 영향 없음)")) return;
      window.PARTNERS = (window.PARTNERS || []).filter(function (p) { return String(p.id) !== String(id); });
      saveToSheet({ type: "partner", action: "delete", id: id });
      closePartnerModal();
      renderPartner();
    });
    return wrap;
  }
  function deletePartnerById(id) {
    var p = findById(window.PARTNERS || [], id);
    if (!p) return;
    if (!confirm((p.name || "") + " 거래처를 삭제할까요? (기존 명세서에는 영향 없음)")) return;
    window.PARTNERS = (window.PARTNERS || []).filter(function (x) { return String(x.id) !== String(id); });
    saveToSheet({ type: "partner", action: "delete", id: id });
    renderPartner();
  }

  var VIEWS = {
    statement:   { title: "BILLING", render: renderBilling },
    quote:       { title: "BILLING", render: renderBilling },
    partner:     { title: "PARTNER", render: renderPartner },
    dashboard:   { title: "DASHBOARD", render: renderDashboard },
    crew:        { title: "CREW", render: renderCrew },
    interview:   { title: "INTERVIEW", render: renderInterview },
    attendance:  { title: "ATTENDANCE", render: renderAttendance },
    journal:     { title: "JOURNAL", render: renderJournal },
    education:   { title: "EDUCATION", render: renderEducation },
    hrchange:    { title: "HR CHANGE", render: renderHrChange },
    schedule:    { title: "SCHEDULE", render: renderSchedule },
    note:        { title: "NOTE", render: renderNote },
    notify:      { title: "NOTIFY", render: renderNotify },
    workreport:  { title: "WORK REPORT", render: renderWorkReport },
    kpi:         { title: "2026 KPI", render: renderKpi },
  };

  function go(name) {
    // #quote · #partner 딥링크는 청구 관리의 해당 탭으로 진입
    var billDeepTab = (name === "quote" || name === "partner") ? name : null;
    if (billDeepTab) name = "statement";
    if (!VIEWS[name]) name = "schedule";
    // 사이드바로 청구관리 진입 시 항상 목록부터 (이전 보기/편집 상태 초기화)
    if (name === "statement") {
      stmtMode = null; stmtEditId = null; stmtDraft = null;
      qMode = null; qEditId = null; qDraft = null;
      billTab = billDeepTab || "statement";
    }
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
      var kpiGp = ev.target.closest(".kpi-gp[data-kpi-grade]");
      if (kpiGp) {
        var gp = kpiGp.getAttribute("data-kpi-grade").split("|");
        var no = gp[0], lv = gp[1];
        window.KPI_PROGRESS = window.KPI_PROGRESS || {};
        var p = window.KPI_PROGRESS[no] = window.KPI_PROGRESS[no] || { grade: "", note: "", sub: {} };
        p.grade = (p.grade === lv) ? "" : lv; // 같은 등급 다시 누르면 해제
        saveToSheet({ type: "kpi", no: no, grade: p.grade });
        renderKpi();
        return;
      }
      if (ev.target.closest("#addEventBtn")) { openEventModal({ date: TODAY }); return; }
      if (ev.target.closest("#addCrewBtn")) { openCrewModal(null); return; }
      if (ev.target.closest("#addInterviewBtn")) { openInterviewModal(null); return; }

      var ivCondBtn = ev.target.closest("#ivCondFilter button[data-c]");
      if (ivCondBtn) { interviewCond = ivCondBtn.getAttribute("data-c"); renderInterview(); return; }

      if (ev.target.closest("#addAttendanceBtn")) { openAttendanceModal(null); return; }

      var atKindBtn = ev.target.closest("#atKindFilter button[data-k]");
      if (atKindBtn) { attKindFilter = atKindBtn.getAttribute("data-k"); renderAttendance(); return; }

      var atNavBtn = ev.target.closest(".month-nav .iconbtn[data-at-nav]");
      if (atNavBtn) {
        var atDir = +atNavBtn.getAttribute("data-at-nav");
        attAnchor = addMonths(attAnchor, attMode === "year" ? atDir * 12 : atDir);
        renderAttendance(); return;
      }

      var atModeBtn = ev.target.closest(".month-nav [data-at-mode]");
      if (atModeBtn) { attMode = atModeBtn.getAttribute("data-at-mode"); renderAttendance(); return; }

      var hcNavBtn = ev.target.closest(".month-nav .iconbtn[data-hc-nav]");
      if (hcNavBtn) {
        var hcDir = +hcNavBtn.getAttribute("data-hc-nav");
        hcAnchor = addMonths(hcAnchor, hcMode === "year" ? hcDir * 12 : hcDir);
        renderHrChange(); return;
      }

      var hcModeBtn = ev.target.closest(".month-nav [data-hc-mode]");
      if (hcModeBtn) { hcMode = hcModeBtn.getAttribute("data-hc-mode"); renderHrChange(); return; }

      var atStatBtn = ev.target.closest(".stat--clickable[data-kind]");
      if (atStatBtn) { openAttendanceKindModal(atStatBtn.getAttribute("data-kind")); return; }

      if (ev.target.closest("#addEducationBtn")) { openEducationModal(null); return; }
      if (ev.target.closest("#addOnboardBtn")) {
        openOnboardModal({ id: "", crewId: "", crewName: "", date: "", link: "", checklist: "{}" }, true);
        return;
      }

      var eduSectionBtn = ev.target.closest("[data-edu-section]");
      if (eduSectionBtn) { eduSection = eduSectionBtn.getAttribute("data-edu-section"); eduQuery = ""; renderEducation(); return; }

      if (ev.target.closest("#obRefToggle")) { eduRefOpen = !eduRefOpen; renderEducation(); return; }

      var eduPeriodBtn = ev.target.closest("[data-edu-period]");
      if (eduPeriodBtn) { eduPeriodMode = eduPeriodBtn.getAttribute("data-edu-period"); renderEducation(); return; }

      var eduPnavBtn = ev.target.closest("[data-edu-pnav]");
      if (eduPnavBtn) {
        var epDir = +eduPnavBtn.getAttribute("data-edu-pnav");
        eduAnchor = addMonths(eduAnchor, eduPeriodMode === "year" ? epDir * 12 : epDir);
        renderEducation(); return;
      }

      var obCardEl = ev.target.closest(".board__row[data-ob-id]");
      if (obCardEl) {
        var obRec = findById(window.EDUCATION || [], obCardEl.getAttribute("data-ob-id"));
        if (obRec) openOnboardModal(obRec, false);
        return;
      }

      if (ev.target.closest("[data-edu-signup]")) return; // 새 탭으로 열리는 링크 — 행 클릭(수정 모달)으로 이어지지 않게 여기서 종료

      var eduRowEl = ev.target.closest(".edu-row[data-edu-id]");
      if (eduRowEl) { var eRec = findById(window.EDUCATION || [], eduRowEl.getAttribute("data-edu-id")); if (eRec) openEducationModal(eRec); return; }

      var ivNavBtn = ev.target.closest(".month-nav .iconbtn[data-iv-nav]");
      if (ivNavBtn) {
        var ivDir = +ivNavBtn.getAttribute("data-iv-nav");
        ivAnchor = addMonths(ivAnchor, ivMode === "year" ? ivDir * 12 : ivDir);
        renderInterview(); return;
      }

      var ivModeBtn = ev.target.closest(".month-nav [data-iv-mode]");
      if (ivModeBtn) { ivMode = ivModeBtn.getAttribute("data-iv-mode"); renderInterview(); return; }

      var jteamBtn = ev.target.closest("#journalTeamFilter button[data-jteam]");
      if (jteamBtn) { journalTeam = jteamBtn.getAttribute("data-jteam"); journalQuery = ""; renderJournal(); return; }

      var jcard = ev.target.closest(".jcard[data-name]");
      if (jcard) { openJournalDetailModal(jcard.getAttribute("data-name")); return; }

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

      var reportEditBtn = ev.target.closest(".report-act--edit[data-id]");
      if (reportEditBtn) { var rev = findById(window.SUMMARY.reports || [], reportEditBtn.getAttribute("data-id")); if (rev) openReportModal(rev); return; }

      var reportDelBtn = ev.target.closest(".report-act--del[data-id]");
      if (reportDelBtn) { deleteReportQuick(reportDelBtn.getAttribute("data-id")); return; }

      var reportDoneBtn = ev.target.closest(".report-act--done[data-id]");
      if (reportDoneBtn) { completeReportQuick(reportDoneBtn.getAttribute("data-id")); return; }

      var wrDocCard = ev.target.closest(".wr-doc-card[data-doc]");
      if (wrDocCard) {
        var wd = findWrDoc(wrDocCard.getAttribute("data-doc"));
        if (wd && wd.kind === "link" && wd.link) window.open(wd.link, "_blank", "noopener");
        else openWrDocModal(wrDocCard.getAttribute("data-doc"));
        return;
      }

      var wrDriveMore = ev.target.closest("[data-drive-more]");
      if (wrDriveMore) {
        var di = wrDriveMore.getAttribute("data-drive-more");
        wrDriveOpen[di] = !wrDriveOpen[di];
        var dwrap = document.getElementById("wrDriveWrap");
        if (dwrap) dwrap.innerHTML = renderDriveFolders();
        return;
      }
      var wrYearBtn = ev.target.closest("[data-wr-year]");
      if (wrYearBtn) { wrArchYear = wrYearBtn.getAttribute("data-wr-year"); wrExpandedMonth = null; rerenderArchive(); return; }
      var wrArchBtn = ev.target.closest("[data-wr-arch]");
      if (wrArchBtn) { wrArchMode = wrArchBtn.getAttribute("data-wr-arch"); wrExpandedMonth = null; rerenderArchive(); return; }
      var wrMonthBtn = ev.target.closest(".wr-mtile[data-wr-month]");
      if (wrMonthBtn) { wrExpandedMonth = wrMonthBtn.getAttribute("data-wr-month"); rerenderArchive(); return; }
      var wrBackBtn = ev.target.closest("[data-wr-back]");
      if (wrBackBtn) { wrExpandedMonth = null; rerenderArchive(); return; }

      var wrUndoBtn = ev.target.closest(".wr-act--undo[data-id]");
      if (wrUndoBtn) { uncompleteReportQuick(wrUndoBtn.getAttribute("data-id")); return; }

      var wrDelBtn = ev.target.closest(".wr-act--del[data-id]");
      if (wrDelBtn) { deleteWorkReportQuick(wrDelBtn.getAttribute("data-id")); return; }

      var wrNavBtn = ev.target.closest(".month-nav .iconbtn[data-wr-nav]");
      if (wrNavBtn) {
        var wrDir = +wrNavBtn.getAttribute("data-wr-nav");
        wrAnchor = addMonths(wrAnchor, wrMode === "year" ? wrDir * 12 : wrDir);
        renderWorkReport(); return;
      }

      var wrModeBtn = ev.target.closest(".month-nav [data-wr-mode]");
      if (wrModeBtn) { wrMode = wrModeBtn.getAttribute("data-wr-mode"); renderWorkReport(); return; }

      var reportUrgentBtn = ev.target.closest(".report-urgent-toggle[data-id]");
      if (reportUrgentBtn) { toggleReportUrgent(reportUrgentBtn.getAttribute("data-id")); return; }

      var reportAdd = ev.target.closest(".report-add-row[data-report-add]");
      if (reportAdd) { activateReportQuickAdd(reportAdd); return; }

      if (ev.target.closest("#noteQuickSaveBtn")) { commitNoteQuickAdd(); return; }

      var noteQuickPartBtn = ev.target.closest("#noteQuickPart [data-note-quick-part]");
      if (noteQuickPartBtn) {
        noteQuickPart = noteQuickPartBtn.getAttribute("data-note-quick-part");
        Array.prototype.forEach.call(view.querySelectorAll("#noteQuickPart [data-note-quick-part]"), function (b) {
          b.classList.toggle("is-on", b === noteQuickPartBtn);
        });
        return;
      }

      var noteFilterBtn = ev.target.closest("#noteFilter [data-note-filter]");
      if (noteFilterBtn) { noteFilter = noteFilterBtn.getAttribute("data-note-filter"); renderNote(); return; }

      if (ev.target.closest("#noteArchiveBtn")) { noteView = "archive"; renderNote(); return; }
      if (ev.target.closest("#noteBackBtn")) { noteView = "active"; renderNote(); return; }

      var noteCheckEl = ev.target.closest(".note-check[data-id]");
      if (noteCheckEl) {
        var ncId = noteCheckEl.getAttribute("data-id");
        if (noteSelected[ncId]) delete noteSelected[ncId]; else noteSelected[ncId] = true;
        renderNote();
        return;
      }

      if (ev.target.closest(".note-check-all")) {
        var ncAllChecked = ev.target.checked;
        noteInScope().forEach(function (n) {
          if (ncAllChecked) noteSelected[n.id] = true; else delete noteSelected[n.id];
        });
        renderNote();
        return;
      }

      if (ev.target.closest("#noteBulkDeleteBtn")) { bulkDeleteSelectedNotes(); return; }

      var noteBoardRowEl = ev.target.closest(".board__row[data-note-id]");
      if (noteBoardRowEl) { var nev = findById(window.NOTES || [], noteBoardRowEl.getAttribute("data-note-id")); if (nev) openNoteModal(nev); return; }

      var noteRestoreBtn = ev.target.closest(".note-act--restore[data-id]");
      if (noteRestoreBtn) { restoreNoteQuick(noteRestoreBtn.getAttribute("data-id")); return; }

      var notePurgeBtn = ev.target.closest(".note-act--purge[data-id]");
      if (notePurgeBtn) { purgeNoteForever(notePurgeBtn.getAttribute("data-id")); return; }

      var notifyToggleBtn = ev.target.closest(".switch[data-notify-toggle]");
      if (notifyToggleBtn) {
        var s = loadNotifySettings();
        var key = notifyToggleBtn.getAttribute("data-notify-toggle");
        s[key] = !s[key];
        saveNotifySettings(s);
        renderNotify();
        return;
      }

      var notifyTimingBtn = ev.target.closest("#notifyTiming [data-notify-timing]");
      if (notifyTimingBtn) {
        var s2 = loadNotifySettings();
        s2.timing = notifyTimingBtn.getAttribute("data-notify-timing");
        saveNotifySettings(s2);
        renderNotify();
        return;
      }

      var notifyScopeBtn = ev.target.closest("[data-notify-scope]");
      if (notifyScopeBtn) { notifyScope = notifyScopeBtn.getAttribute("data-notify-scope"); renderNotify(); return; }

      if (ev.target.closest("#notifyPreviewBtn")) {
        var previewList = todaysCelebrations(Object.assign({}, loadNotifySettings(), { birthday: true, anniversary: true }));
        if (!previewList.length) previewList = upcomingCelebrations(365).slice(0, 3);
        if (!previewList.length) { alert("미리 볼 생일 · 기념일 정보가 없습니다."); return; }
        openCelebrationModal(previewList);
        return;
      }

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
      if (crewRowEl && !crewRowEl.closest(".stmt-list, .stmt-item-table")) { crewDetailId = crewRowEl.getAttribute("data-id"); crewDetailTab = "basic"; renderCrew(); return; }

      var crewBackBtn = ev.target.closest("#crewBackBtn");
      if (crewBackBtn) { crewDetailId = null; renderCrew(); return; }

      var crewTabBtn = ev.target.closest(".crew-tab[data-tab]");
      if (crewTabBtn) { crewDetailTab = crewTabBtn.getAttribute("data-tab"); renderCrew(); return; }

      if (ev.target.closest("#crewSummaryToggle")) { crewSummaryOpen = !crewSummaryOpen; renderCrew(); return; }

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

      if (ev.target.closest("#addHrChangeBtn")) { openHrChangeModal(null); return; }
      if (ev.target.closest("#hcBackfillBtn")) { backfillFromCrewList(); return; }

      if (ev.target.closest("#crewAddHrChangeBtn")) {
        var addHcC = findById(window.CREW, crewDetailId);
        openHrChangeModal(addHcC ? { crewId: addHcC.id } : null);
        return;
      }

      var hcBoardRow = ev.target.closest(".board__row[data-hc-id]");
      if (hcBoardRow) { var bHc = findById(window.HR_CHANGES || [], hcBoardRow.getAttribute("data-hc-id")); if (bHc) openHrChangeModal(bHc); return; }

      var hcTypeBtn = ev.target.closest("#hcTypeFilter button[data-t]");
      if (hcTypeBtn) { hcTypeFilter = hcTypeBtn.getAttribute("data-t"); renderHrChange(); return; }

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

      var sortJoinBtn = ev.target.closest("#crewSortJoin");
      if (sortJoinBtn) { crewSortDir = crewSortDir === "asc" ? "desc" : "asc"; renderCrew(); return; }
    });

    // 입사일 정렬 헤더 : 키보드(Enter/Space) 접근성
    view.addEventListener("keydown", function (ev) {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.id === "crewSortJoin") {
        ev.preventDefault();
        crewSortDir = crewSortDir === "asc" ? "desc" : "asc";
        renderCrew();
      }
    });

    view.addEventListener("change", function (ev) {
      if (ev.target.classList && ev.target.classList.contains("kpi-curin")) {
        var kc = ev.target.getAttribute("data-kpi-cur").split("|");
        var no = kc[0], sub = kc[1];
        window.KPI_PROGRESS = window.KPI_PROGRESS || {};
        var p = window.KPI_PROGRESS[no] = window.KPI_PROGRESS[no] || { grade: "", note: "", sub: {} };
        var k = (+sub) - 1;
        p.sub[k] = { current: ev.target.value, note: (p.sub[k] && p.sub[k].note) || "" };
        saveToSheet({ type: "kpi", no: no, subIndex: sub, current: ev.target.value });
        // 현재값은 달성도(등급 기반)에 영향 없어 재렌더 불필요(포커스 유지)
      }
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
          atBody.innerHTML = atRows.length ? groupedAttendanceRowsHTML(atRows)
            : '<tr><td colspan="6" class="board__empty">검색 결과가 없습니다.</td></tr>';
        }
      }
      if (ev.target.id === "hcSearch") {
        hcQuery = ev.target.value;
        var hcBody = document.getElementById("hcBody");
        if (hcBody) {
          var hcRows = filteredHrChanges();
          hcBody.innerHTML = hcRows.length ? groupedHrChangeRowsHTML(hcRows)
            : '<tr><td colspan="6" class="board__empty">검색 결과가 없습니다.</td></tr>';
        }
      }
      if (ev.target.id === "hcCrewFilter") { hcCrewFilter = ev.target.value; renderHrChange(); }
      if (ev.target.id === "eduSearch") {
        eduQuery = ev.target.value;
        var eduBody = document.getElementById("eduBody");
        if (eduBody) {
          var eduRows = filteredCatEducation(eduSectionOf(eduSection).cat);
          eduBody.innerHTML = eduRows.length ? eduRows.map(eduTableRow).join("")
            : '<tr><td colspan="6" class="board__empty">검색 결과가 없습니다.</td></tr>';
        }
      }
      if (ev.target.id === "journalSearch") {
        journalQuery = ev.target.value;
        var jList = document.getElementById("journalList");
        if (jList) {
          var jGroups = filteredJournalGroups();
          jList.innerHTML = jGroups.length ? jGroups.map(journalCard).join("")
            : '<div class="placeholder placeholder--sm"><p class="muted">검색 결과가 없습니다.</p></div>';
        }
      }
    });
  }
  wireDelegation();

  /* ---------- 알림음 사전 준비 (첫 상호작용 시 자동 unlock) ---------- */
  (function initAlarmSoundPriming() {
    var evs = ["pointerdown", "click", "keydown", "touchstart"];
    var onFirst = function () {
      primeAlarmSound_();
      evs.forEach(function (t) { document.removeEventListener(t, onFirst, true); });
    };
    evs.forEach(function (t) { document.addEventListener(t, onFirst, true); });
  })();

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
      view.innerHTML = '<div class="loading-screen"><div class="loading-spinner"></div>'
        + '<p class="loading-text">구글시트에서 불러오는 중…</p></div>';
      loadData().then(function () { go(initial); checkCelebrationPopup(); checkEventAlarms(); });
    } else {
      go(initial);
      checkCelebrationPopup();
      checkEventAlarms();
    }
    setInterval(checkEventAlarms, 20000);
  }

  /* ---------- 관리자 로그인 : 아이디 + 비밀번호(SHA-256) ---------- */
  function sha256Hex(str) {
    var enc = new TextEncoder();
    return crypto.subtle.digest("SHA-256", enc.encode(str)).then(function (buf) {
      return Array.prototype.map
        .call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, "0"); })
        .join("");
    });
  }

  function unlock(remember) {
    try {
      if (remember) localStorage.setItem("sg-auth", "ok");
      else { localStorage.removeItem("sg-auth"); sessionStorage.setItem("sg-auth", "ok"); }
    } catch (e) {}
    document.documentElement.setAttribute("data-authed", "1");
    boot();
  }

  function logout() {
    try { localStorage.removeItem("sg-auth"); sessionStorage.removeItem("sg-auth"); } catch (e) {}
    location.reload();
  }

  function wireLock() {
    var form = document.getElementById("lockForm");
    var idInput = document.getElementById("loginId");
    var pwInput = document.getElementById("loginPw");
    var remember = document.getElementById("loginRemember");
    var btn = document.getElementById("loginBtn");
    var err = document.getElementById("lockError");
    if (!form) return;

    function shake() {
      form.classList.add("is-shake");
      setTimeout(function () { form.classList.remove("is-shake"); }, 400);
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      var id = (idInput.value || "").trim();
      var pw = pwInput.value || "";
      var cfg = (window.CONFIG && window.CONFIG.auth) || {};
      if (!id || !pw || !cfg.idHash || !cfg.pwHash) { err.hidden = false; shake(); return; }

      btn.disabled = true;
      Promise.all([sha256Hex(id.toLowerCase()), sha256Hex(pw)]).then(function (h) {
        btn.disabled = false;
        if (h[0] === cfg.idHash && h[1] === cfg.pwHash) {
          unlock(remember ? remember.checked : true);
        } else {
          err.hidden = false;
          shake();
          pwInput.value = "";
          pwInput.focus();
        }
      }).catch(function () { btn.disabled = false; err.hidden = false; shake(); });
    });

    setTimeout(function () { idInput.focus(); }, 60);
  }

  function wireLogout() {
    var btn = document.getElementById("logoutBtn");
    if (btn) btn.addEventListener("click", logout);
  }

  var alreadyAuthed =
    document.documentElement.getAttribute("data-authed") === "1" ||
    (function () { try { return sessionStorage.getItem("sg-auth") === "ok"; } catch (e) { return false; } })();

  wireLogout();
  if (alreadyAuthed) {
    document.documentElement.setAttribute("data-authed", "1");
    boot();
  } else {
    wireLock();
  }
})();
