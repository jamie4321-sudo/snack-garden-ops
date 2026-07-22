/**
 * SNACK & GARDEN 운영관리 — Google Apps Script 백엔드
 * =====================================================
 * 하나의 Google 시트에 크루 · 일정을 저장/조회합니다.
 * 정적 사이트(GitHub Pages)에서 fetch 로 호출합니다.
 *
 * 시트 탭 (없으면 자동 생성, 필드가 늘어나면 끝에 컬럼을 자동 추가):
 *  - "crew"     : id | name | role | team | group | status | joinDate | phone | site | duties | note
 *                 | contractType | birthDate | disability | disabilityType | emergencyContact | badgeNumber | workHours
 *  - "schedule" : id | date | time | title | category | done | assignee | link
 *
 * 읽기/쓰기 모두 "컬럼 순서"가 아니라 "헤더 이름"으로 매칭합니다.
 * (실제 시트의 컬럼 순서가 달라도, 컬럼이 중간에 추가/삭제돼도 안전하게 동작)
 *
 * 배포: 배포 > 배포 관리 > 기존 배포 수정 > 새 버전으로 배포
 *   - 실행 계정: 나 / 액세스 권한: 모든 사용자
 * 배포 후 /exec URL 을 js/config.js 의 CONFIG.endpoint 에 붙여넣으세요.
 *
 * ★ 처음 한 번: Apps Script 편집기에서 seed() 함수를 실행하면
 *   현재 데모와 동일한 크루·일정이 시트에 채워집니다.
 */

var CREW_FIELDS = [
  "id","name","role","team","group","status","joinDate","phone","site","duties","note",
  "contractType","birthDate","disability","disabilityType","emergencyContact","badgeNumber","workHours"
];
var SCH_FIELDS = ["id","date","time","title","category","done","assignee","link"];
var ISSUE_FIELDS = ["id","text","link"];
var POINT_FIELDS = ["id","text"];
var INTERVIEW_FIELDS = ["id","date","time","crewId","crewName","type","condition","recorder","content","followUp","followUpNote","privateNote"];

var SHEET_ID = ""; // 비우면 이 스크립트에 연결된 시트를 사용

function ss_() { return SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }

function sheet_(name, fields) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(fields); sh.setFrozenRows(1); }
  ensureColumns_(sh, fields);
  return sh;
}

/** id 컬럼을 A열에 확보(중복/빈값 정리 포함)하고, fields 에 있는데 시트에 없는 컬럼은
 *  끝에 추가한다. 기존 컬럼 순서/데이터는 건드리지 않는다 — 컬럼 삽입으로 인한 정렬
 *  꼬임을 피하기 위해 항상 "끝에 추가"만 한다. */
function ensureColumns_(sh, fields) {
  ensureId_(sh);

  var lastCol = Math.max(sh.getLastColumn(), 1);
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var have = {};
  headers.forEach(function (h) { if (h) have[h] = true; });

  var missing = fields.filter(function (f) { return !have[f]; });
  if (missing.length) {
    sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
  }
}

/** id 컬럼이 없으면 A열에 추가하고, 매 호출마다 비어있는 id 를 채운다.
 *  과거 마이그레이션 과정에서 생긴 빈 헤더/중복 id 컬럼도 정리한다. */
function ensureId_(sh) {
  if (sh.getLastRow() === 0) { sh.getRange(1, 1).setValue("id"); return; }

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

function headerRow_(sh) {
  var lastCol = Math.max(sh.getLastColumn(), 1);
  return sh.getRange(1, 1, 1, lastCol).getValues()[0];
}

function rows_(name, fields) {
  var sh = sheet_(name, fields || []);
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

/** 헤더 이름 기준으로 한 행을 추가/수정한다.
 *  valuesObj 에 있는 필드만 반영하고, 시트에 있지만 valuesObj 에 없는(=우리가 모르는) 컬럼은
 *  add 시 빈 값, update 시 기존 값을 그대로 유지한다. */
function upsertRowByHeader_(sh, id, valuesObj) {
  var headers = headerRow_(sh);
  var row = findRowById_(sh, id);

  if (row < 0) {
    var newRow = headers.map(function (h) { return valuesObj.hasOwnProperty(h) ? valuesObj[h] : ""; });
    sh.appendRow(newRow);
  } else {
    var existing = sh.getRange(row, 1, 1, headers.length).getValues()[0];
    var updated = headers.map(function (h, i) { return valuesObj.hasOwnProperty(h) ? valuesObj[h] : existing[i]; });
    sh.getRange(row, 1, 1, headers.length).setValues([updated]);
  }
}

/** 조회: GET ?action=crew | schedule | issues | all */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "all";
  if (action === "crew")     return json_(rows_("crew", CREW_FIELDS));
  if (action === "schedule") return json_(mapSchedule_(rows_("schedule", SCH_FIELDS)));
  if (action === "issues")   return json_(rows_("issues", ISSUE_FIELDS));
  if (action === "points")   return json_(rows_("points", POINT_FIELDS));
  if (action === "interviews") return json_(mapInterviews_(rows_("interviews", INTERVIEW_FIELDS)));
  return json_({
    crew: rows_("crew", CREW_FIELDS),
    schedule: mapSchedule_(rows_("schedule", SCH_FIELDS)),
    issues: rows_("issues", ISSUE_FIELDS),
    points: rows_("points", POINT_FIELDS),
    interviews: mapInterviews_(rows_("interviews", INTERVIEW_FIELDS))
  });
}

function mapSchedule_(list) {
  return list.map(function (r) {
    r.done = (r.done === true || String(r.done).toLowerCase() === "true" || r.done === "완료" || r.done === "y");
    r.date = fmtDate_(r.date);
    r.time = fmtTime_(r.time);
    return r;
  });
}

function mapInterviews_(list) {
  return list.map(function (r) {
    r.date = fmtDate_(r.date);
    r.time = fmtTime_(r.time);
    r.followUp = (r.followUp === true || r.followUp === "필요" || String(r.followUp).toLowerCase() === "true") ? "필요" : "";
    return r;
  });
}

function isDateLike_(v) { return Object.prototype.toString.call(v) === "[object Date]"; }

/** 날짜를 YYYY-MM-DD 로 정규화. 실제 Date 객체, "YYYY-MM-DD..." 문자열,
 *  혹은 이미 Date.toString() 형태로 뭉개진 문자열까지 모두 방어적으로 처리. */
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

/** 저장/수정/삭제: POST body(JSON) { type:"crew"|"schedule"|"issue", action:"add"|"update"|"delete", ... } */
function doPost(e) {
  var data = {};
  try { data = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "bad json" }); }
  var action = data.action || "add";

  if (data.type === "crew")     return handleCrew_(action, data);
  if (data.type === "schedule") return handleSchedule_(action, data);
  if (data.type === "issue")    return handleIssue_(action, data);
  if (data.type === "point")    return handlePoint_(action, data);
  if (data.type === "interview") return handleInterview_(action, data);
  return json_({ ok: false, error: "unknown type" });
}

function crewValuesObj_(data) {
  return {
    id: data.id, name: data.name || "", role: data.role || "", team: data.team || "", group: data.group || "미지정",
    status: data.status || "재직", joinDate: data.joinDate || "", phone: data.phone || "", site: data.site || "",
    duties: (data.duties || []).join(", "), note: data.note || "",
    contractType: data.contractType || "", birthDate: data.birthDate || "",
    disability: data.disability || "", disabilityType: data.disabilityType || "",
    emergencyContact: data.emergencyContact || "", badgeNumber: data.badgeNumber || "",
    workHours: data.workHours || ""
  };
}

function handleCrew_(action, data) {
  var sh = sheet_("crew", CREW_FIELDS);

  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    upsertRowByHeader_(sh, id, crewValuesObj_(Object.assign({}, data, { id: id })));
    return json_({ ok: true, id: id });
  }

  if (action === "delete") {
    var row = findRowById_(sh, data.id);
    if (row < 0) return json_({ ok: false, error: "not found" });
    sh.deleteRow(row);
    return json_({ ok: true });
  }

  return json_({ ok: false, error: "unknown action" });
}

function scheduleValuesObj_(data) {
  return {
    id: data.id, date: data.date || "", time: data.time || "", title: data.title || "",
    category: data.category || "", done: data.done ? "완료" : "", assignee: data.assignee || "", link: data.link || ""
  };
}

function handleSchedule_(action, data) {
  var sh = sheet_("schedule", SCH_FIELDS);

  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    upsertRowByHeader_(sh, id, scheduleValuesObj_(Object.assign({}, data, { id: id })));
    return json_({ ok: true, id: id });
  }

  if (action === "delete") {
    var row = findRowById_(sh, data.id);
    if (row < 0) return json_({ ok: false, error: "not found" });
    sh.deleteRow(row);
    return json_({ ok: true });
  }

  return json_({ ok: false, error: "unknown action" });
}

function handleIssue_(action, data) {
  var sh = sheet_("issues", ISSUE_FIELDS);

  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    upsertRowByHeader_(sh, id, { id: id, text: data.text || "", link: data.link || "" });
    return json_({ ok: true, id: id });
  }

  if (action === "delete") {
    var row = findRowById_(sh, data.id);
    if (row < 0) return json_({ ok: false, error: "not found" });
    sh.deleteRow(row);
    return json_({ ok: true });
  }

  return json_({ ok: false, error: "unknown action" });
}

function interviewValuesObj_(data) {
  return {
    id: data.id, date: data.date || "", time: data.time || "",
    crewId: data.crewId || "", crewName: data.crewName || "",
    type: data.ivType || "", condition: data.condition || "",
    recorder: data.recorder || "", content: data.content || "",
    followUp: data.followUp ? "필요" : "", followUpNote: data.followUpNote || "", privateNote: data.privateNote || ""
  };
}

function handleInterview_(action, data) {
  var sh = sheet_("interviews", INTERVIEW_FIELDS);

  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    upsertRowByHeader_(sh, id, interviewValuesObj_(Object.assign({}, data, { id: id })));
    return json_({ ok: true, id: id });
  }

  if (action === "delete") {
    var row = findRowById_(sh, data.id);
    if (row < 0) return json_({ ok: false, error: "not found" });
    sh.deleteRow(row);
    return json_({ ok: true });
  }

  return json_({ ok: false, error: "unknown action" });
}

function handlePoint_(action, data) {
  var sh = sheet_("points", POINT_FIELDS);

  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    upsertRowByHeader_(sh, id, { id: id, text: data.text || "" });
    return json_({ ok: true, id: id });
  }

  if (action === "delete") {
    var row = findRowById_(sh, data.id);
    if (row < 0) return json_({ ok: false, error: "not found" });
    sh.deleteRow(row);
    return json_({ ok: true });
  }

  return json_({ ok: false, error: "unknown action" });
}

/** ★ 처음 한 번만 실행: 데모와 동일한 데이터로 시트를 채웁니다.
 *  (기존 데이터는 지우고 새로 씁니다) */
function seed() {
  var crew = [
    ["c1","김하이든","파트리더","헤이든","총무지원","재직","2023-03-02","010-1234-5678","판교 오아시스","운영총괄, 발주","법인카드 상신 담당","정규","","비장애","","","","08:00-17:00(8h)"],
    ["c2","이레오","시니어 크루","레오","총무지원","재직","2023-08-14","010-2345-6789","판교 오아시스","온보딩, 일정","31일 온보딩 진행","정규","","비장애","","","","08:00-17:00(8h)"],
    ["c3","박엘리","매니저","엘리","총무지원","재직","2022-11-01","010-3456-7890","카렌 현장","교육, 경조지원","퇴사 크루·경조 대응","정규","","비장애","","","","08:00-17:00(8h)"],
    ["c4","최스칼렛","크루","스칼렛","스낵","재직","2024-01-09","010-4567-8901","판교 오아시스","KEP검토, 제안서","Pay 제안서 1차","정규","","비장애","","","","09:00-18:00(8h)"],
    ["c5","정배라","신입 크루","배라","스낵","재직","2026-07-20","010-5678-9012","판교 오아시스","성수 OJT","OJT 진행 중","계약","","비장애","","","","09:00-18:00(8h)"],
    ["c6","한카렌","현장 리드","카렌","가든","재직","2023-05-22","010-6789-0123","카렌 현장","백오피스, 점검","현장 백오피스 점검","정규","","비장애","","","","07:00-16:00(8h)"],
    ["c7","오미라","크루","미라","스낵","휴직","2024-06-03","010-7890-1234","판교 오아시스","리더 주간보고","육아휴직 (~2026.09)","정규","","비장애","","","","09:00-18:00(8h)"],
    ["c8","신엔조","크루","엔조","가든","재직","2025-02-17","010-8901-2345","판교 오아시스","반차/근태","7/24 오후 반차","계약","","비장애","","","","07:00-16:00(8h)"],
    ["c9","강아라","크루","아라","스낵","퇴사","2022-04-11","010-9012-3456","판교 오아시스","","2026.06 퇴사","계약","","비장애","","","","09:00-18:00(8h)"]
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
  var issues = [
    ["i1","헤이든 — 팔로업 사항 : 법인카드 상신",""],
    ["i2","헤이든 — 안내 사항","https://docs.google.com/document/d/EXAMPLE_DOC_ID/edit"]
  ];
  writeAll_("crew", CREW_FIELDS, crew);
  writeAll_("schedule", SCH_FIELDS, sch);
  writeAll_("issues", ISSUE_FIELDS, issues);
}

function writeAll_(name, fields, data) {
  var ss = ss_();
  var sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  sh.clear();
  sh.appendRow(fields);
  sh.setFrozenRows(1);
  if (data.length) sh.getRange(2, 1, data.length, fields.length).setValues(data);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
