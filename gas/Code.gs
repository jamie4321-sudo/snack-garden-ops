/**
 * SNACK & GARDEN 운영관리 — Google Apps Script 백엔드
 * =====================================================
 * 하나의 Google 시트에 크루 · 일정을 저장/조회합니다.
 * 정적 사이트(GitHub Pages)에서 fetch 로 호출합니다.
 *
 * 시트 탭 (없으면 자동 생성):
 *  - "crew"     : id | name | role | team | group | status | joinDate | phone | site | duties | note
 *  - "schedule" : id | date | time | title | category | done | assignee | link
 *
 * 기존에 id 컬럼 없이 쓰던 시트도 자동으로 id 컬럼을 앞에 추가하고
 * 기존 행에 id 를 채워 넣습니다 (ensureId_).
 *
 * 배포: 배포 > 새 배포 > 웹 앱
 *   - 실행 계정: 나 / 액세스 권한: 모든 사용자
 * 배포 후 /exec URL 을 js/config.js 의 CONFIG.endpoint 에 붙여넣으세요.
 *
 * ★ 처음 한 번: Apps Script 편집기에서 seed() 함수를 실행하면
 *   현재 데모와 동일한 크루·일정이 시트에 채워집니다.
 */

var CREW_HEADERS = ["id","name","role","team","group","status","joinDate","phone","site","duties","note"];
var SCH_HEADERS  = ["id","date","time","title","category","done","assignee","link"];

var SHEET_ID = ""; // 비우면 이 스크립트에 연결된 시트를 사용

function ss_() { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name, headers) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); }
  ensureId_(sh);
  return sh;
}

/** 기존(레거시) 시트에 id 컬럼이 없으면 A열에 추가하고, 매 호출마다 비어있는 id 를 채운다.
 *  (한 번만 실행되는 게 아니라 항상 검사 — 이후에 수동으로 행을 추가/붙여넣기 해도 자동 복구됨) */
function ensureId_(sh) {
  if (sh.getLastRow() === 0) { sh.getRange(1, 1).setValue("id"); return; }

  // 과거 마이그레이션 과정에서 생긴, 데이터 없는 빈 헤더 컬럼 정리
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  for (var c = headers.length; c >= 1; c--) {
    if (headers[c - 1] === "") {
      var last0 = sh.getLastRow();
      var hasData = last0 > 1 && sh.getRange(2, c, last0 - 1, 1).getValues().some(function (row) { return row[0] !== ""; });
      if (!hasData) sh.deleteColumn(c);
    }
  }

  if (sh.getRange(1, 1).getValue() !== "id") {
    sh.insertColumnBefore(1);
    sh.getRange(1, 1).setValue("id");
  }

  // "id" 라는 이름의 컬럼이 A열 말고 또 있으면(과거 중복 삽입 버그로 생김) 제거
  var lastCol2 = sh.getLastColumn();
  for (var c2 = lastCol2; c2 >= 2; c2--) {
    if (sh.getRange(1, c2).getValue() === "id") sh.deleteColumn(c2);
  }

  var last = sh.getLastRow();
  if (last < 2) return;
  var idRange = sh.getRange(2, 1, last - 1, 1);
  var ids = idRange.getValues();
  var changed = false;
  for (var i = 0; i < ids.length; i++) {
    if (!ids[i][0]) { ids[i][0] = Utilities.getUuid(); changed = true; }
  }
  if (changed) idRange.setValues(ids);
}

function rows_(name) {
  var sh = sheet_(name, []);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values.shift();
  return values.map(function (r) {
    var o = {};
    head.forEach(function (h, i) { if (h) o[h] = r[i]; }); // 빈 헤더는 무시
    return o;
  });
}

function findRowById_(sh, id) {
  if (!id) return -1;
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

/** 조회: GET ?action=crew | schedule | all */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "all";
  if (action === "crew")     return json_(rows_("crew"));
  if (action === "schedule") return json_(mapSchedule_(rows_("schedule")));
  return json_({ crew: rows_("crew"), schedule: mapSchedule_(rows_("schedule")) });
}

function mapSchedule_(list) {
  return list.map(function (r) {
    r.done = (r.done === true || String(r.done).toLowerCase() === "true" || r.done === "완료" || r.done === "y");
    r.date = fmtDate_(r.date);
    r.time = fmtTime_(r.time);
    return r;
  });
}

function isDateLike_(v) { return Object.prototype.toString.call(v) === "[object Date]"; }

/** 날짜를 YYYY-MM-DD 로 정규화. 실제 Date 객체, "YYYY-MM-DD..." 문자열,
 *  혹은 (원인 불명으로) 이미 Date.toString() 형태로 뭉개진 문자열까지 모두 방어적으로 처리. */
function fmtDate_(v) {
  if (!v && v !== 0) return "";
  if (isDateLike_(v)) {
    var m = ("0" + (v.getMonth() + 1)).slice(-2), day = ("0" + v.getDate()).slice(-2);
    return v.getFullYear() + "-" + m + "-" + day;
  }
  var s = String(v);
  var iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  var parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.getFullYear() + "-" + ("0" + (parsed.getMonth() + 1)).slice(-2) + "-" + ("0" + parsed.getDate()).slice(-2);
  }
  return s;
}

/** 시간을 HH:MM 으로 정규화. Date 객체(시간만 입력된 셀은 1899-12-30 기준 Date 로 내려옴)와
 *  이미 문자열로 뭉개진 값 모두에서 HH:MM 패턴을 추출한다. */
function fmtTime_(v) {
  if (!v) return "";
  if (isDateLike_(v)) {
    return ("0" + v.getHours()).slice(-2) + ":" + ("0" + v.getMinutes()).slice(-2);
  }
  var s = String(v);
  var hm = s.match(/(\d{1,2}):(\d{2})/);
  if (hm) return ("0" + hm[1]).slice(-2) + ":" + hm[2];
  return s.slice(0, 5);
}

/** 저장/수정/삭제: POST body(JSON) { type:"crew"|"schedule", action:"add"|"update"|"delete", ... } */
function doPost(e) {
  var data = {};
  try { data = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "bad json" }); }
  var action = data.action || "add";

  if (data.type === "crew")     return handleCrew_(action, data);
  if (data.type === "schedule") return handleSchedule_(action, data);
  return json_({ ok: false, error: "unknown type" });
}

function handleCrew_(action, data) {
  var sh = sheet_("crew", CREW_HEADERS);

  if (action === "add") {
    var id = data.id || Utilities.getUuid();
    sh.appendRow([
      id, data.name || "", data.role || "", data.team || "", data.group || "미지정",
      data.status || "재직", data.joinDate || "", data.phone || "", data.site || "",
      (data.duties || []).join(", "), data.note || ""
    ]);
    return json_({ ok: true, id: id });
  }

  if (action === "update") {
    var row = findRowById_(sh, data.id);
    if (row < 0) return json_({ ok: false, error: "not found" });
    sh.getRange(row, 1, 1, CREW_HEADERS.length).setValues([[
      data.id, data.name || "", data.role || "", data.team || "", data.group || "미지정",
      data.status || "재직", data.joinDate || "", data.phone || "", data.site || "",
      (data.duties || []).join(", "), data.note || ""
    ]]);
    return json_({ ok: true });
  }

  if (action === "delete") {
    var row2 = findRowById_(sh, data.id);
    if (row2 < 0) return json_({ ok: false, error: "not found" });
    sh.deleteRow(row2);
    return json_({ ok: true });
  }

  return json_({ ok: false, error: "unknown action" });
}

function handleSchedule_(action, data) {
  var sh = sheet_("schedule", SCH_HEADERS);

  if (action === "add") {
    var id = data.id || Utilities.getUuid();
    sh.appendRow([
      id, data.date || "", data.time || "", data.title || "",
      data.category || "", data.done ? "완료" : "", data.assignee || "", data.link || ""
    ]);
    return json_({ ok: true, id: id });
  }

  if (action === "update") {
    var row = findRowById_(sh, data.id);
    if (row < 0) return json_({ ok: false, error: "not found" });
    sh.getRange(row, 1, 1, SCH_HEADERS.length).setValues([[
      data.id, data.date || "", data.time || "", data.title || "",
      data.category || "", data.done ? "완료" : "", data.assignee || "", data.link || ""
    ]]);
    return json_({ ok: true });
  }

  if (action === "delete") {
    var row2 = findRowById_(sh, data.id);
    if (row2 < 0) return json_({ ok: false, error: "not found" });
    sh.deleteRow(row2);
    return json_({ ok: true });
  }

  return json_({ ok: false, error: "unknown action" });
}

/** ★ 처음 한 번만 실행: 데모와 동일한 데이터로 시트를 채웁니다.
 *  (기존 데이터는 지우고 새로 씁니다) */
function seed() {
  var crew = [
    ["c1","김하이든","파트리더","헤이든","총무지원","재직","2023-03-02","010-1234-5678","판교 오아시스","운영총괄, 발주","법인카드 상신 담당"],
    ["c2","이레오","시니어 크루","레오","총무지원","재직","2023-08-14","010-2345-6789","판교 오아시스","온보딩, 일정","31일 온보딩 진행"],
    ["c3","박엘리","매니저","엘리","총무지원","재직","2022-11-01","010-3456-7890","카렌 현장","교육, 경조지원","퇴사 크루·경조 대응"],
    ["c4","최스칼렛","크루","스칼렛","스낵","재직","2024-01-09","010-4567-8901","판교 오아시스","KEP검토, 제안서","Pay 제안서 1차"],
    ["c5","정배라","신입 크루","배라","스낵","재직","2026-07-20","010-5678-9012","판교 오아시스","성수 OJT","OJT 진행 중"],
    ["c6","한카렌","현장 리드","카렌","가든","재직","2023-05-22","010-6789-0123","카렌 현장","백오피스, 점검","현장 백오피스 점검"],
    ["c7","오미라","크루","미라","스낵","휴직","2024-06-03","010-7890-1234","판교 오아시스","리더 주간보고","육아휴직 (~2026.09)"],
    ["c8","신엔조","크루","엔조","가든","재직","2025-02-17","010-8901-2345","판교 오아시스","반차/근태","7/24 오후 반차"],
    ["c9","강아라","크루","아라","스낵","퇴사","2022-04-11","010-9012-3456","판교 오아시스","","2026.06 퇴사"]
  ];
  var sch = [
    ["s1","2026-07-20","08:30","배라 성수 OJT","교육","완료","배라",""],
    ["s2","2026-07-20","09:00","AI스터디 공유 · 오아시스/조경엘라","내부","완료","팀",""],
    ["s3","2026-07-20","10:00","리더 주간보고 미라 정리","보고","완료","미라",""],
    ["s4","2026-07-20","10:00","스칼렛 생일","기타","완료","스칼렛",""],
    ["s5","2026-07-20","11:00","레오 31일 온보딩 관련 일정 조율","운영","완료","레오",""],
    ["s6","2026-07-20","15:30","AI스터디 A3·O3 리더미팅 확인","내부","완료","팀",""],
    ["s7","2026-07-20","17:00","KEP검토 확인 · 헤이든/스칼렛","운영","완료","헤이든",""],
    ["s8","2026-07-20","17:30","Pay 제안서 1차 시작","운영","완료","스칼렛",""],
    ["s9","2026-07-21","11:00","스낵 DS크루 면접 (편은진님)","채용","완료","헤이든",""],
    ["s10","2026-07-21","11:00","레오 31일 온보딩 관련 일정 조율","운영","완료","레오",""],
    ["s11","2026-07-21","15:00","카카오산업안전보건협의체 2층 어피치","외부","","헤이든",""],
    ["s12","2026-07-21","16:00","링키지랩 주간 미팅","내부","완료","팀","https://docs.google.com/document/d/EXAMPLE_DOC_ID/edit"],
    ["s13","2026-07-21","17:00","KEP검토 확인 · 헤이든/스칼렛","운영","완료","헤이든",""],
    ["s14","2026-07-21","17:30","Pay 제안서 1차 시작","운영","완료","스칼렛",""],
    ["s15","2026-07-22","","찰스 원카드 신청","행정","","찰스",""],
    ["s16","2026-07-22","","카카오게임즈 안전보건협의체","외부","","헤이든",""],
    ["s17","2026-07-22","10:00","가든 단기 면접 (1)","채용","","가든",""],
    ["s18","2026-07-22","11:00","가든 단기 면접 (2)","채용","","가든",""],
    ["s19","2026-07-22","12:00","엘리 매니저 교육 · 퇴사/경조 발생 시","교육","","엘리",""],
    ["s20","2026-07-22","15:00","가든 백오피스 정리","운영","","가든",""],
    ["s21","2026-07-22","16:00","카렌 현장 백오피스 점검","운영","","카렌",""],
    ["s22","2026-07-22","17:00","KEP검토 확인 · 헤이든/스칼렛","운영","","헤이든",""],
    ["s23","2026-07-22","17:30","Pay 제안서 1차 시작","운영","","스칼렛",""],
    ["s24","2026-07-23","10:00","가든 단기 면접 (1)","채용","","가든",""],
    ["s25","2026-07-23","11:00","가든 단기 면접 (2)","채용","","가든",""],
    ["s26","2026-07-23","14:30","조경 전체층 라운딩 · 엘리","운영","","엘리",""],
    ["s27","2026-07-23","17:00","온보딩관련 미팅 · 레오","운영","","레오",""],
    ["s28","2026-07-24","","엔조 오후 반차","근태","","엔조",""],
    ["s29","2026-07-28","15:00","링키지랩 주간 미팅","내부","","팀",""],
    ["s30","2026-07-29","","온보딩관련(7/31) 미팅 사진 확인 · 레오","운영","","레오",""],
    ["s31","2026-07-31","","연차","휴일","","팀",""]
  ];
  writeAll_("crew", CREW_HEADERS, crew);
  writeAll_("schedule", SCH_HEADERS, sch);
}

function writeAll_(name, headers, data) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  sh.appendRow(headers);
  sh.setFrozenRows(1);
  if (data.length) sh.getRange(2, 1, data.length, headers.length).setValues(data);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
