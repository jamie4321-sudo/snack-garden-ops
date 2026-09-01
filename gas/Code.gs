/**
 * SNACK & GARDEN 운영관리 — Google Apps Script 백엔드
 * =====================================================
 * 하나의 Google 시트에 크루 · 일정을 저장/조회합니다.
 * 정적 사이트(GitHub Pages)에서 fetch 로 호출합니다.
 *
 * 시트 탭 (없으면 자동 생성, 필드가 늘어나면 끝에 컬럼을 자동 추가):
 *  - "crew"     : id | name | role | team | group | status | joinDate | leftDate | phone | site | duties | note
 *                 | contractType | contractEndDate | birthDate | disability | disabilityType | emergencyContact | badgeNumber | workHours
 *                 (leftDate = 퇴사일, status="퇴사"일 때만 의미 있음)
 *                 (contractEndDate = 계약 종료일, contractType="단기계약"일 때만 의미 있음)
 *  - "schedule" : id | date | time | title | category | done | assignee | link
 *  - "interviews"  : id | date | time | crewId | crewName | type | condition | recorder | content | followUp | followUpNote | privateNote
 *  - "attendance"  : id | date | time | crewId | crewName | kind | reason | recorder  (kind = 지각|조퇴)
 *  - "education"   : id | category | title | crewId | crewName | date | dueDate | status | provider | hours | note | link | checklist
 *                    (category = OJT온보딩|법정의무교육|정기교육, status = 예정|진행중|완료)
 *                    link = 온보딩 드라이브 폴더 URL, checklist = 온보딩 6영역 체크리스트 JSON 문자열
 *  - "notes"       : id | date | time | part | text | author | link | deletedAt
 *                    삭제("delete") 시 행을 지우지 않고 deletedAt(ISO datetime)만 채워 보관함으로 이동.
 *                    deletedAt 이 NOTE_RETENTION_DAYS(1년)보다 오래되면 자동으로 완전히 삭제됨.
 *  - "hrchanges"   : id | crewId | crewName | type | typeLabel | date | before | after | reason | recorder | link
 *                    (type = 입사|퇴사|휴직|복직|파트이동|직급변경|기타, typeLabel 은 type="기타"일 때 직접 입력한 유형명)
 *
 * 면담일지(별도 스프레드시트 "2026 면담일지_DS", 장애크루 개인별 탭) — 읽기 전용, ?action=journal
 *   ⚠️ 여러 명이 함께 쓰는 실사용 시트입니다. getRange().getValues() 로만 읽고,
 *      절대 setValue/appendRow/deleteRow 등 쓰기 동작을 추가하지 마세요.
 *   JOURNAL_SHEET_ID 로 그 시트를 열어, 탭들 중 JOURNAL_SKIP_TABS 에 없는 탭을 모두 크루 탭으로
 *   보고 "일자" 헤더가 있는 행을 찾아 그 아래 데이터를 그대로 읽어온다.
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
  "id","name","role","team","group","status","joinDate","leftDate","phone","site","duties","note",
  "contractType","contractEndDate","birthDate","disability","disabilityType","emergencyContact","badgeNumber","workHours"
];
// link = 대표(첫 번째) 링크 · links = 최대 5개 링크의 JSON 배열 문자열
var SCH_FIELDS = ["id","date","time","title","category","done","assignee","link","links","alarm","alarmTime"];
var ISSUE_FIELDS = ["id","text","link"];
var POINT_FIELDS = ["id","text"];
var REPORT_FIELDS = ["id","text","link","urgent","done","reportedAt"];
var INTERVIEW_FIELDS = ["id","date","time","crewId","crewName","type","condition","recorder","content","followUp","followUpNote","privateNote"];
var ATTENDANCE_FIELDS = ["id","date","time","crewId","crewName","kind","reason","recorder"];
var NOTE_FIELDS = ["id","date","time","part","text","author","link","deletedAt"];
// 노트 삭제 시 즉시 지우지 않고 deletedAt(ISO datetime)만 채워 보관함으로 이동시킨다.
// deletedAt 이 이 기간(일)보다 오래되면 handleNote_/doGet 호출 시점에 완전히 삭제된다.
var NOTE_RETENTION_DAYS = 365;
var EDUCATION_FIELDS = ["id","category","title","crewId","crewName","date","dueDate","status","provider","hours","note","link","checklist"];
var HRCHANGE_FIELDS = ["id","crewId","crewName","type","typeLabel","date","before","after","reason","recorder","link"];
// 거래명세서 : 공급자=주식회사 링키지랩(앱 상수). items 는 품목 배열의 JSON 문자열로 저장한다.
// driveUrl : 저장 시 생성해 드라이브에 보관한 PDF 링크(서버에서 채움).
var STATEMENT_FIELDS = ["id","docNo","billDate","dueDate","customerName","contactName","customerBizNo","bankName","accountNo","accountHolder","phone","email","items","shipping","supplyAmount","vat","total","memo","status","createdAt","driveUrl"];
// 견적서 : 거래명세서와 동일 양식. items 각 품목 = {name,spec,unit,price,qty}. repName/repPhone/repEmail = 발행처 담당자.
var QUOTE_FIELDS = ["id","docNo","quoteDate","validUntil","customerName","contactName","customerBizNo","repName","repPhone","repEmail","items","shipping","supplyAmount","vat","total","notes","status","createdAt","driveUrl"];
// 청구서 : 견적서 + 입금기한/입금계좌 + 수신 연락처·회계담당·청구문구. 대표자 인감은 발행처(회사) 정보에서 관리.
var INVOICE_FIELDS = ["id","docNo","invoiceDate","dueDate","customerName","contactName","customerBizNo","customerPhone","customerEmail","repName","repPhone","repEmail","bankName","accountNo","accountHolder","accountingName","accountingEmail","purpose","items","shipping","supplyAmount","vat","total","notes","status","createdAt","driveUrl"];
var PARTNER_FIELDS = ["id","name","contact","bizNo","ceo","addr"];
// 업무 프로세스 HUB(개인용) : 중첩 구조(단계·판단기준·보고·담당·자료·사례)는 JSON 문자열로 저장한다.
//   tags = 태그 JSON 배열 · favorite = "Y"|"" · processSteps/decisionPoints/relatedResources/pastCases = JSON 배열 · reportRules/stakeholders = JSON 객체
var PROCESS_FIELDS = ["id","title","category","subCategory","purpose","trigger","priority","tags","processSteps","decisionPoints","reportRules","stakeholders","relatedResources","pastCases","favorite","createdAt","updatedAt"];

// 발행처(공급자) 고정 정보 — 앱의 window.COMPANY 와 동일하게 유지
var COMPANY = {
  name: "주식회사 링키지랩",
  bizNo: "235-88-00278",
  ceo: "박대영",
  addr: "서울특별시 성동구 성수동2가 314-37번지 3층"
};
// 거래명세서 PDF 보관 폴더.
//  ▶ 특정 드라이브 폴더를 지정하려면 STATEMENT_FOLDER_ID 에 폴더 ID를 넣으세요.
//    (폴더 URL 이 .../folders/XXXXXXXX 이면 XXXXXXXX 부분이 폴더 ID)
//  ▶ 비워두면 내 드라이브에 STATEMENT_FOLDER_NAME 이름의 폴더를 자동 생성해서 사용합니다.
var STATEMENT_FOLDER_ID = "";
var STATEMENT_FOLDER_NAME = "거래명세서";

// 업무 보고 · AI 보고서 게시보드 사진 갤러리 보관 폴더.
//  ▶ REPORT_PHOTO_FOLDER_ID 에 폴더 ID를 넣으면 그 폴더를, 비우면 이름으로 자동 생성.
//  ▶ 업로드한 사진은 화면(<img>) 표시를 위해 '링크가 있는 모든 사용자 · 보기'로 공유됩니다.
var REPORT_PHOTO_FOLDER_ID = "";
var REPORT_PHOTO_FOLDER_NAME = "업무보고 사진";
var REPORT_PHOTO_LIMIT = 300;   // 조회 최대 사진 수

// ── 업무 보고 · 드라이브 관리 폴더 ─────────────────────────────
//  업무 보고 화면에 노출할 구글 드라이브 폴더 목록.
//  각 폴더의 파일(제목·형식·수정일·링크)을 자동으로 읽어 목록화한다.
//  ▶ id 에 폴더 ID를 넣으세요. (폴더 URL 이 .../folders/XXXX 이면 XXXX 부분)
//  ▶ id 가 비어 있으면 해당 폴더는 빈 목록으로 표시된다.
//  폴더를 추가하려면 { name, id } 한 줄만 더하면 된다.
var DRIVE_FOLDERS = [
  { name: "안전매뉴얼", id: "" },
  { name: "교육 자료",  id: "" }
];
var DRIVE_FILES_LIMIT = 100;  // 폴더당 최대 조회 파일 수

// 운영 데이터(크루·일정·면담·근태) 스프레드시트. 독립형(standalone) 스크립트라
// getActiveSpreadsheet() 는 웹앱 요청 상황에서 불안정해서 ID를 고정한다.
var SHEET_ID = "1NG8IozqEbilXBEFLjZZANJf1tQlL5wVzP29xg_Z9W6M";

// 면담일지는 운영 데이터와 별도의 스프레드시트에 있고, 팀별로 시트가 나뉜다.
// 팀이 추가되면 { team, id } 한 줄만 더하면 된다.
var JOURNAL_SHEETS = [
  { team: "스낵",    id: "1oF0GK7OLod7YKg84ypJ95irHeSRbvZQXnP0qXJi_Zgc" },
  { team: "가든",    id: "1XLQUdFDpwe_JD4uuplxwz7wu2AgzQkrHOn2lxVUSBu0" },
  { team: "총무지원", id: "1WI32s1CgnW5UqMl-bFFxh-ODQzpPas76py3CzxR2_pQ" }
];
// (하위호환) 예전 단일 상수를 참조하는 코드가 있으면 첫 팀으로 대체
var JOURNAL_SHEET_ID = JOURNAL_SHEETS[0].id;
// 면담일지 탭이 아닌 탭(그 시트 안의 빈 운영 데이터 탭 + 안내/템플릿 탭 + 설문 응답 탭)은 건너뛴다
var JOURNAL_SKIP_TABS = [
  "crew", "schedule", "issues", "points", "reports", "interviews", "attendance", "notes", "education",
  "카테고리", "작성 예시", "NEW 면담일지 가이드라인", "설문지 응답 시트1"
];

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
  if (action === "reports")  return json_(mapReports_(rows_("reports", REPORT_FIELDS)));
  if (action === "interviews") return json_(mapInterviews_(rows_("interviews", INTERVIEW_FIELDS)));
  if (action === "attendance") return json_(mapAttendance_(rows_("attendance", ATTENDANCE_FIELDS)));
  if (action === "notes")      return json_(mapNotes_(rows_notesFresh_()));
  if (action === "education")  return json_(mapEducation_(rows_("education", EDUCATION_FIELDS)));
  if (action === "hrchanges")  return json_(mapDates_(rows_("hrchanges", HRCHANGE_FIELDS), ["date"]));
  if (action === "partners")   return json_(rows_("partners", PARTNER_FIELDS));
  if (action === "statements") return json_(mapDates_(rows_("statements", STATEMENT_FIELDS), ["billDate","dueDate"]));
  if (action === "quotes")     return json_(mapDates_(rows_("quotes", QUOTE_FIELDS), ["quoteDate","validUntil"]));
  if (action === "invoices")   return json_(mapDates_(rows_("invoices", INVOICE_FIELDS), ["invoiceDate","dueDate"]));
  if (action === "processes")  return json_(mapProcesses_(rows_("processes", PROCESS_FIELDS)));
  if (action === "journal")    return json_(getJournalData_());
  if (action === "kpi")        return json_(getKpi_());
  if (action === "drivefolders") return json_(getDriveFolders_());
  if (action === "reportphotos") return json_(getReportPhotos_((e.parameter && e.parameter.docId) || ""));
  if (action === "debug")      return json_(getDebugInfo_());
  return json_({
    crew: rows_("crew", CREW_FIELDS),
    schedule: mapSchedule_(rows_("schedule", SCH_FIELDS)),
    issues: rows_("issues", ISSUE_FIELDS),
    points: rows_("points", POINT_FIELDS),
    reports: mapReports_(rows_("reports", REPORT_FIELDS)),
    interviews: mapInterviews_(rows_("interviews", INTERVIEW_FIELDS)),
    attendance: mapAttendance_(rows_("attendance", ATTENDANCE_FIELDS)),
    notes: mapNotes_(rows_notesFresh_()),
    education: mapEducation_(rows_("education", EDUCATION_FIELDS)),
    hrChanges: mapDates_(rows_("hrchanges", HRCHANGE_FIELDS), ["date"]),
    partners: rows_("partners", PARTNER_FIELDS),
    statements: mapDates_(rows_("statements", STATEMENT_FIELDS), ["billDate","dueDate"]),
    quotes: mapDates_(rows_("quotes", QUOTE_FIELDS), ["quoteDate","validUntil"]),
    invoices: mapDates_(rows_("invoices", INVOICE_FIELDS), ["invoiceDate","dueDate"]),
    processes: mapProcesses_(rows_("processes", PROCESS_FIELDS))
  });
}

/** 업무 프로세스 HUB : JSON 문자열 컬럼을 객체/배열로 복원하고 favorite 을 불리언으로 정규화한다. */
function mapProcesses_(list) {
  var jsonFields = ["tags","processSteps","decisionPoints","reportRules","stakeholders","relatedResources","pastCases"];
  return list.map(function (r) {
    jsonFields.forEach(function (f) {
      if (typeof r[f] === "string" && r[f]) { try { r[f] = JSON.parse(r[f]); } catch (e) {} }
    });
    r.favorite = (r.favorite === true || r.favorite === "Y" || r.favorite === "y" || String(r.favorite).toLowerCase() === "true");
    r.createdAt = r.createdAt ? fmtDate_(r.createdAt) : "";
    r.updatedAt = r.updatedAt ? fmtDate_(r.updatedAt) : "";
    return r;
  });
}

/** 지정한 필드들을 fmtDate_ 로 정리한다 (범용 날짜 정리 헬퍼). */
function mapDates_(list, dateFields) {
  return list.map(function (r) {
    dateFields.forEach(function (f) { if (r[f]) r[f] = fmtDate_(r[f]); });
    return r;
  });
}

/** notes 시트 조회 전 보관 기한이 지난(1년 초과) 삭제 노트를 정리한다. */
function rows_notesFresh_() {
  var sh = sheet_("notes", NOTE_FIELDS);
  purgeExpiredNotes_(sh);
  return rows_("notes", NOTE_FIELDS);
}

function mapSchedule_(list) {
  return list.map(function (r) {
    r.done = (r.done === true || String(r.done).toLowerCase() === "true" || r.done === "완료" || r.done === "y");
    r.alarm = (r.alarm === true || String(r.alarm).toLowerCase() === "true" || r.alarm === "켜짐" || r.alarm === "y");
    r.date = fmtDate_(r.date);
    r.time = fmtTime_(r.time);
    r.alarmTime = r.alarmTime ? fmtTime_(r.alarmTime) : "";
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

function mapReports_(list) {
  return list.map(function (r) {
    r.urgent = (r.urgent === true || r.urgent === "긴급" || String(r.urgent).toLowerCase() === "true");
    r.done = (r.done === true || r.done === "완료" || String(r.done).toLowerCase() === "true");
    r.reportedAt = r.reportedAt ? fmtDate_(r.reportedAt) : "";
    return r;
  });
}

function mapAttendance_(list) {
  return list.map(function (r) {
    r.date = fmtDate_(r.date);
    r.time = fmtTime_(r.time);
    return r;
  });
}

function mapNotes_(list) {
  return list.map(function (r) {
    r.date = fmtDate_(r.date);
    r.time = fmtTime_(r.time);
    return r;
  });
}

function mapEducation_(list) {
  return list.map(function (r) {
    r.date = r.date ? fmtDate_(r.date) : "";
    r.dueDate = r.dueDate ? fmtDate_(r.dueDate) : "";
    return r;
  });
}

/** 진단용: ?action=debug — SHEET_ID 스프레드시트의 실제 제목·탭 목록·각 탭 행 수를 그대로 보여준다. */
function getDebugInfo_() {
  var info = { sheetId: SHEET_ID };
  try {
    var ss = ss_();
    info.sheetTitle = ss.getName();
    info.actualUrl = ss.getUrl();
    info.tabs = ss.getSheets().map(function (sh) {
      return { name: sh.getName(), lastRow: sh.getLastRow(), lastCol: sh.getLastColumn() };
    });
  } catch (err) {
    info.error = String(err);
  }
  return info;
}

/** 면담일지 탭: 탭마다(=크루 한 명) "일자" 헤더가 있는 행/열을 찾아 그 아래 데이터를
 *  그대로 읽어온다. 날짜 정규화·최신순 정렬 등은 프론트엔드에서 처리한다(시트 표기가
 *  "2025", "08-05"처럼 불규칙해서 서버에서 섣불리 파싱하지 않고 원본 그대로 내려준다). */
function getJournalData_() {
  var tabs = [];
  var sheets = [];
  var skipped = [];
  JOURNAL_SHEETS.forEach(function (cfg) {
    var ss;
    try { ss = SpreadsheetApp.openById(cfg.id); }
    catch (err) { sheets.push({ team: cfg.team, id: cfg.id, error: String(err) }); return; }
    sheets.push({ team: cfg.team, id: cfg.id, title: ss.getName() });
    ss.getSheets().forEach(function (sh) {
      var name = sh.getName();
      if (JOURNAL_SKIP_TABS.indexOf(name) > -1) return;
      var parsed = readJournalSheet_(sh);
      if (!parsed.rows.length) { skipped.push({ team: cfg.team, name: name }); return; }
      // team, sheetId 를 함께 실어 프론트에서 팀 필터/시트링크에 쓴다.
      tabs.push({ team: cfg.team, sheetId: cfg.id, name: name, gid: sh.getSheetId(), rows: parsed.rows });
    });
  });
  return { tabs: tabs, sheets: sheets, skippedNoData: skipped };
}

/** "일자" 헤더 셀을 찾을 때까지 처음 15행 x 6열을 훑는다(행뿐 아니라 열 오프셋도 대비). */
function readJournalSheet_(sh) {
  var lastRow = sh.getLastRow();
  var lastCol = sh.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return { rows: [], preview: [] };
  var scanRows = Math.min(lastRow, 15);
  var scanCols = Math.min(lastCol, 6);
  var preview = sh.getRange(1, 1, scanRows, scanCols).getValues();

  var headerRow = -1, headerCol = -1;
  for (var i = 0; i < preview.length && headerRow === -1; i++) {
    for (var j = 0; j < preview[i].length; j++) {
      if (String(preview[i][j]).trim() === "일자") { headerRow = i; headerCol = j; break; }
    }
  }
  if (headerRow === -1) return { rows: [], preview: preview };

  var values = sh.getRange(1, 1, lastRow, lastCol).getValues();
  var headers = values[headerRow].slice(headerCol).map(function (h) { return String(h).trim(); });
  var out = [];
  for (var r = headerRow + 1; r < values.length; r++) {
    var row = values[r].slice(headerCol);
    var hasData = row.some(function (v) { return String(v).trim() !== ""; });
    if (!hasData) continue;
    var obj = {};
    headers.forEach(function (h, ci) { if (h) obj[h] = row[ci]; });
    out.push(obj);
  }
  return { rows: out, preview: preview };
}

/** 2026 KPI 진행 데이터. 운영 스프레드시트의 "kpi" 탭을 읽는다.
 *  헤더(1행): no | subIndex | grade | current | note
 *  - subIndex 비어있는 행 = 목표 단위(grade=탁월/충족/노력필요, note=목표 메모)
 *  - subIndex 1..N = 세부목표(순서, current=현재값/상태, note=세부 메모)
 *  반환: { "<no>": { grade, note, sub: { "<0-based idx>": {current, note} } } } */
function getKpi_() {
  var ss;
  try { ss = SpreadsheetApp.openById(SHEET_ID); } catch (e) { return {}; }
  var sh = ss.getSheetByName("kpi");
  if (!sh || sh.getLastRow() < 2) return {};
  var vals = sh.getDataRange().getValues();
  var out = {};
  for (var i = 1; i < vals.length; i++) {
    var r = vals[i];
    var no = String(r[0] == null ? "" : r[0]).trim();
    if (!no) continue;
    out[no] = out[no] || { grade: "", note: "", sub: {} };
    var subIdx = String(r[1] == null ? "" : r[1]).trim();
    if (subIdx === "") {
      var g = String(r[2] == null ? "" : r[2]).trim();
      if (g) out[no].grade = g;
      var gn = String(r[4] == null ? "" : r[4]).trim();
      if (gn) out[no].note = gn;
    } else {
      var k = parseInt(subIdx, 10) - 1;
      if (!(k >= 0)) continue;
      // 세부목표 행에서 C열(grade)은 목표 등급과 무관 → 진행 상태(진행중/완료) 보관용으로 사용
      out[no].sub[k] = { current: r[3], note: String(r[4] == null ? "" : r[4]).trim(), status: String(r[2] == null ? "" : r[2]).trim() };
    }
  }
  return out;
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
  if (data.type === "report")   return handleReport_(action, data);
  if (data.type === "interview") return handleInterview_(action, data);
  if (data.type === "attendance") return handleAttendance_(action, data);
  if (data.type === "note")     return handleNote_(action, data);
  if (data.type === "education") return handleEducation_(action, data);
  if (data.type === "hrchange") return handleHrChange_(action, data);
  if (data.type === "partner")  return handlePartner_(action, data);
  if (data.type === "statement") return handleStatement_(action, data);
  if (data.type === "quote")    return handleQuote_(action, data);
  if (data.type === "invoice")  return handleInvoice_(action, data);
  if (data.type === "process")  return handleProcess_(action, data);
  if (data.type === "kpi")      return handleKpi_(action, data);
  if (data.type === "summarize") return handleSummarize_(data);
  if (data.type === "summarizeAudio") return handleSummarizeAudio_(data);
  if (data.type === "reportPhoto") return handleReportPhoto_(action, data);
  return json_({ ok: false, error: "unknown type" });
}

/** kpi 탭(header: no|subIndex|grade|current|note)을 확보. id 컬럼 강제 없이 그대로 둔다. */
function kpiSheet_() {
  var ss = ss_();
  var sh = ss.getSheetByName("kpi");
  if (!sh) { sh = ss.insertSheet("kpi"); sh.appendRow(["no", "subIndex", "grade", "current", "note"]); sh.setFrozenRows(1); }
  if (sh.getLastRow() === 0) { sh.appendRow(["no", "subIndex", "grade", "current", "note"]); sh.setFrozenRows(1); }
  return sh;
}

/** KPI 진행 저장(upsert). data: { no, subIndex(""|숫자), grade?, current?, note?, status? }
 *  (no, subIndex) 일치 행이 있으면 갱신, 없으면 추가. F열(설명) 등 뒤 컬럼은 건드리지 않음.
 *  status(진행중/완료)는 세부목표 행의 grade(C)열에 저장한다. */
function handleKpi_(action, data) {
  var sh = kpiSheet_();
  var no = String(data.no == null ? "" : data.no).trim();
  if (!no) return json_({ ok: false, error: "no required" });
  var subIndex = (data.subIndex === undefined || data.subIndex === null) ? "" : String(data.subIndex).trim();
  var last = sh.getLastRow();
  var vals = last > 1 ? sh.getRange(2, 1, last - 1, 5).getValues() : [];
  var rowNum = -1, cur = ["", "", "", "", ""];
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i][0]).trim() === no && String(vals[i][1]).trim() === subIndex) { rowNum = i + 2; cur = vals[i]; break; }
  }
  // 세부목표(subIndex 있음)의 status 는 grade(C)열에 저장 — grade 파라미터와 동일 컬럼 공유
  var grade = data.grade !== undefined ? data.grade
            : (data.status !== undefined ? data.status : cur[2]);
  var current = data.current !== undefined ? data.current : cur[3];
  var note = data.note !== undefined ? data.note : cur[4];
  var row = [no, subIndex, grade, current, note];
  if (rowNum > -1) sh.getRange(rowNum, 1, 1, 5).setValues([row]);
  else sh.appendRow(row);
  return json_({ ok: true });
}

function crewValuesObj_(data) {
  return {
    id: data.id, name: data.name || "", role: data.role || "", team: data.team || "", group: data.group || "미지정",
    status: data.status || "재직", joinDate: data.joinDate || "", leftDate: data.leftDate || "", phone: data.phone || "", site: data.site || "",
    duties: (data.duties || []).join(", "), note: data.note || "",
    contractType: data.contractType || "", contractEndDate: data.contractEndDate || "", birthDate: data.birthDate || "",
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
    category: data.category || "", done: data.done ? "완료" : "", assignee: data.assignee || "", link: data.link || "",
    links: (typeof data.links === "string") ? data.links : JSON.stringify(data.links || []),
    alarm: data.alarm ? "켜짐" : "", alarmTime: data.alarmTime || ""
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

function attendanceValuesObj_(data) {
  return {
    id: data.id, date: data.date || "", time: data.time || "",
    crewId: data.crewId || "", crewName: data.crewName || "",
    kind: data.kind || "지각", reason: data.reason || "", recorder: data.recorder || ""
  };
}

function handleAttendance_(action, data) {
  var sh = sheet_("attendance", ATTENDANCE_FIELDS);

  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    upsertRowByHeader_(sh, id, attendanceValuesObj_(Object.assign({}, data, { id: id })));
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

// 주의: 봉투의 type("hrchange")과 실제 변동 유형이 충돌하지 않도록 유형은 hcType 으로 전송받는다.
function hrChangeValuesObj_(data) {
  return {
    id: data.id, crewId: data.crewId || "", crewName: data.crewName || "",
    type: data.hcType || "기타", typeLabel: data.typeLabel || "", date: data.date || "",
    before: data.before || "", after: data.after || "",
    reason: data.reason || "", recorder: data.recorder || "", link: data.link || ""
  };
}

function handleHrChange_(action, data) {
  var sh = sheet_("hrchanges", HRCHANGE_FIELDS);

  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    upsertRowByHeader_(sh, id, hrChangeValuesObj_(Object.assign({}, data, { id: id })));
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

function noteValuesObj_(data) {
  return {
    id: data.id, date: data.date || "", time: data.time || "",
    part: data.part || "전체", text: data.text || "", author: data.author || "",
    link: data.link || "", deletedAt: data.deletedAt || ""
  };
}

function partnerValuesObj_(data) {
  return {
    id: data.id, name: data.name || "", contact: data.contact || "",
    bizNo: data.bizNo || "", ceo: data.ceo || "", addr: data.addr || ""
  };
}

function handlePartner_(action, data) {
  var sh = sheet_("partners", PARTNER_FIELDS);
  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    upsertRowByHeader_(sh, id, partnerValuesObj_(Object.assign({}, data, { id: id })));
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

function statementValuesObj_(data) {
  return {
    id: data.id, docNo: data.docNo || "", billDate: data.billDate || "", dueDate: data.dueDate || "",
    customerName: data.customerName || "", contactName: data.contactName || "", customerBizNo: data.customerBizNo || "",
    bankName: data.bankName || "", accountNo: data.accountNo || "", accountHolder: data.accountHolder || "",
    phone: data.phone || "", email: data.email || "",
    items: (typeof data.items === "string") ? data.items : JSON.stringify(data.items || []),
    shipping: data.shipping || 0,
    supplyAmount: data.supplyAmount || 0, vat: data.vat || 0, total: data.total || 0,
    memo: data.memo || "", status: data.status || "작성", createdAt: data.createdAt || "",
    driveUrl: data.driveUrl || ""
  };
}

function handleStatement_(action, data) {
  var sh = sheet_("statements", STATEMENT_FIELDS);
  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    var payload = Object.assign({}, data, { id: id });

    // 드라이브에 PDF 생성/갱신 (실패해도 시트 저장은 진행)
    var driveUrl = "";
    try { driveUrl = saveStatementPdf_(payload); } catch (e) { driveUrl = ""; }
    if (driveUrl) payload.driveUrl = driveUrl;

    upsertRowByHeader_(sh, id, statementValuesObj_(payload));
    return json_({ ok: true, id: id, driveUrl: driveUrl });
  }
  if (action === "delete") {
    var row = findRowById_(sh, data.id);
    if (row < 0) return json_({ ok: false, error: "not found" });
    // 관련 PDF 도 휴지통으로
    try {
      var headers = headerRow_(sh);
      var vals = rowValuesByHeader_(sh, row, headers);
      trashStatementPdf_(vals.docNo);
    } catch (e) {}
    sh.deleteRow(row);
    return json_({ ok: true });
  }
  return json_({ ok: false, error: "unknown action" });
}

/* ---------- 견적서(quote) 저장/삭제 : 거래명세서와 동일 구조 ---------- */
function quoteValuesObj_(data) {
  return {
    id: data.id, docNo: data.docNo || "", quoteDate: data.quoteDate || "", validUntil: data.validUntil || "",
    customerName: data.customerName || "", contactName: data.contactName || "", customerBizNo: data.customerBizNo || "",
    repName: data.repName || "", repPhone: data.repPhone || "", repEmail: data.repEmail || "",
    items: (typeof data.items === "string") ? data.items : JSON.stringify(data.items || []),
    shipping: data.shipping || 0,
    supplyAmount: data.supplyAmount || 0, vat: data.vat || 0, total: data.total || 0,
    notes: data.notes || "", status: data.status || "작성", createdAt: data.createdAt || "",
    driveUrl: data.driveUrl || ""
  };
}

function handleQuote_(action, data) {
  var sh = sheet_("quotes", QUOTE_FIELDS);
  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    var payload = Object.assign({}, data, { id: id });
    upsertRowByHeader_(sh, id, quoteValuesObj_(payload));
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

/* ---------- 청구서(invoice) 저장/삭제 : 견적서 + 입금기한·입금계좌 ---------- */
function invoiceValuesObj_(data) {
  return {
    id: data.id, docNo: data.docNo || "", invoiceDate: data.invoiceDate || "", dueDate: data.dueDate || "",
    customerName: data.customerName || "", contactName: data.contactName || "", customerBizNo: data.customerBizNo || "",
    customerPhone: data.customerPhone || "", customerEmail: data.customerEmail || "",
    repName: data.repName || "", repPhone: data.repPhone || "", repEmail: data.repEmail || "",
    bankName: data.bankName || "", accountNo: data.accountNo || "", accountHolder: data.accountHolder || "",
    accountingName: data.accountingName || "", accountingEmail: data.accountingEmail || "",
    purpose: data.purpose || "",
    items: (typeof data.items === "string") ? data.items : JSON.stringify(data.items || []),
    shipping: data.shipping || 0,
    supplyAmount: data.supplyAmount || 0, vat: data.vat || 0, total: data.total || 0,
    notes: data.notes || "", status: data.status || "작성", createdAt: data.createdAt || "",
    driveUrl: data.driveUrl || ""
  };
}

function handleInvoice_(action, data) {
  var sh = sheet_("invoices", INVOICE_FIELDS);
  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    var payload = Object.assign({}, data, { id: id });
    upsertRowByHeader_(sh, id, invoiceValuesObj_(payload));
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

/* ---------- 업무 프로세스 HUB(process) 저장/삭제 ---------- */
// 중첩 구조는 JSON 문자열로 저장한다. 프런트(process-hub.js)가 이미 문자열로 보내면 그대로,
// 혹시 객체로 오면 여기서 문자열화한다.
function processValuesObj_(data) {
  function j(v, empty) { return (typeof v === "string") ? v : JSON.stringify(v == null ? empty : v); }
  return {
    id: data.id, title: data.title || "", category: data.category || "", subCategory: data.subCategory || "",
    purpose: data.purpose || "", trigger: data.trigger || "", priority: data.priority || "today",
    tags: j(data.tags, []),
    processSteps: j(data.processSteps, []),
    decisionPoints: j(data.decisionPoints, []),
    reportRules: j(data.reportRules, {}),
    stakeholders: j(data.stakeholders, {}),
    relatedResources: j(data.relatedResources, []),
    pastCases: j(data.pastCases, []),
    favorite: (data.favorite === true || data.favorite === "Y") ? "Y" : "",
    createdAt: data.createdAt || "", updatedAt: data.updatedAt || ""
  };
}

function handleProcess_(action, data) {
  var sh = sheet_("processes", PROCESS_FIELDS);
  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    upsertRowByHeader_(sh, id, processValuesObj_(Object.assign({}, data, { id: id })));
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

/** 거래명세서 PDF 보관 폴더.
 *  STATEMENT_FOLDER_ID 가 지정돼 있으면 그 폴더를, 없으면 이름으로 찾거나 자동 생성. */
function statementFolder_() {
  if (STATEMENT_FOLDER_ID) {
    return DriveApp.getFolderById(STATEMENT_FOLDER_ID);
  }
  var it = DriveApp.getFoldersByName(STATEMENT_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(STATEMENT_FOLDER_NAME);
}

/** ★ 최초 1회 실행용 (밑줄 없는 공개 함수 → Apps Script 실행 목록에 보임).
 *  이 함수를 실행하고 권한을 승인하면 Drive · Docs 접근이 허용되고,
 *  지정한(또는 자동 생성된) 보관 폴더의 이름·링크를 로그로 확인할 수 있습니다. */
function authorizeStatement() {
  var folder = statementFolder_();                 // Drive 권한
  var doc = DocumentApp.create("_tmp_authorize_");  // Docs 권한
  DriveApp.getFileById(doc.getId()).setTrashed(true);
  var msg = "OK · 보관 폴더: " + folder.getName() + " · " + folder.getUrl();
  Logger.log(msg);
  return msg;
}

/* ── 업무 보고 · AI 보고서 게시보드 사진 갤러리 ──────────────
   · 프런트가 이미지(base64) + mimeType + name 을 보내면 보관 폴더에
     저장하고, 화면 표시용 썸네일 URL 을 돌려준다.
   · ?action=reportphotos 로 폴더의 사진 목록을 조회한다.
   · createFile 는 Drive 권한이 필요(거래명세서 기능과 동일 스코프).
     최초 1회는 authorizeStatement() 를 실행해 Drive 접근을 승인하세요. */
function reportPhotoFolder_() {
  if (REPORT_PHOTO_FOLDER_ID) return DriveApp.getFolderById(REPORT_PHOTO_FOLDER_ID);
  var it = DriveApp.getFoldersByName(REPORT_PHOTO_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(REPORT_PHOTO_FOLDER_NAME);
}

/** 보고서(docId)별 하위 폴더. docId 가 없으면 루트 폴더를 그대로 사용.
 *  create=true 면 없을 때 생성, false 면 없을 때 null 반환. */
function reportPhotoSubFolder_(docId, create) {
  var root = reportPhotoFolder_();
  docId = String(docId || "").trim();
  if (!docId) return root;
  var it = root.getFoldersByName(docId);
  if (it.hasNext()) return it.next();
  return create ? root.createFolder(docId) : null;
}

function reportPhotoObj_(f) {
  var id = f.getId();
  return {
    id: id,
    name: f.getName(),
    caption: f.getDescription() || "",
    date: Utilities.formatDate(f.getLastUpdated(), "Asia/Seoul", "yyyy-MM-dd"),
    url: f.getUrl(),                                                       // 원본 열기
    thumb: "https://drive.google.com/thumbnail?id=" + id + "&sz=w1600"      // 화면 표시용
  };
}

function getReportPhotos_(docId) {
  var folder = docId ? reportPhotoSubFolder_(docId, false) : reportPhotoFolder_();
  if (!folder) return [];   // 해당 보고서 폴더가 아직 없음 → 빈 목록
  var it = folder.getFiles(), arr = [], n = 0;
  while (it.hasNext() && n < REPORT_PHOTO_LIMIT) {
    var f = it.next();
    if ((f.getMimeType() || "").indexOf("image") !== 0) continue;   // 이미지 파일만
    n++;
    arr.push(reportPhotoObj_(f));
  }
  arr.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
  return arr;
}

function handleReportPhoto_(action, data) {
  if (action === "delete") {
    var id = String(data.id || "");
    if (!id) return json_({ ok: false, error: "id required" });
    try { DriveApp.getFileById(id).setTrashed(true); }   // 휴지통 이동(복구 가능)
    catch (e) { return json_({ ok: false, error: "삭제 실패: " + e }); }
    return json_({ ok: true });
  }
  // action === "add" (기본)
  var b64 = String(data.dataBase64 || "");
  if (!b64) return json_({ ok: false, error: "이미지 데이터가 비어 있어요." });
  var mime = String(data.mimeType || "image/jpeg");
  if (mime.indexOf("image") !== 0) return json_({ ok: false, error: "이미지 파일만 업로드할 수 있어요." });
  var name = String(data.name || ("photo_" + Date.now() + ".jpg"));
  var caption = String(data.caption || "");
  var file;
  try {
    var blob = Utilities.newBlob(Utilities.base64Decode(b64), mime, name);
    file = reportPhotoSubFolder_(data.docId, true).createFile(blob);   // 보고서별 폴더에 저장
    if (caption) file.setDescription(caption);
    // <img> 썸네일 핫링크 표시를 위해 링크 공유 허용
    try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e2) {}
  } catch (e) {
    return json_({ ok: false, error: "업로드 실패: " + e });
  }
  return json_({ ok: true, photo: reportPhotoObj_(file) });
}

/** docNo 로 만든 PDF 파일명 (동일 문서번호는 하나만 유지) */
/* ── 업무 보고 · 드라이브 폴더 목록 조회 ────────────────────── */
function getDriveFolders_() {
  return (DRIVE_FOLDERS || []).map(function (cfg) {
    var out = { name: cfg.name, id: cfg.id || "", url: "", count: 0, files: [] };
    if (!cfg.id) return out;
    try {
      var folder = DriveApp.getFolderById(cfg.id);
      out.url = folder.getUrl();
      var it = folder.getFiles(), arr = [], n = 0;
      while (it.hasNext() && n < DRIVE_FILES_LIMIT) {
        var f = it.next(); n++;
        arr.push({
          name: f.getName(),
          type: driveType_(f),
          date: Utilities.formatDate(f.getLastUpdated(), "Asia/Seoul", "yyyy-MM-dd"),
          url: f.getUrl()
        });
      }
      arr.sort(function (a, b) { return (b.date || "").localeCompare(a.date || ""); });
      out.files = arr; out.count = arr.length;
    } catch (err) { out.error = String(err); }
    return out;
  });
}

/** 파일 형식 라벨 (확장자 우선, 없으면 MIME 로 추정) */
function driveType_(f) {
  var n = f.getName() || "";
  var dot = n.lastIndexOf(".");
  if (dot > -1 && dot < n.length - 1) {
    var ext = n.slice(dot + 1).toUpperCase();
    if (ext === "JPEG") ext = "JPG";
    if (ext === "PPTX") ext = "PPT";
    if (ext === "DOCX") ext = "DOC";
    if (ext === "XLSX") ext = "XLS";
    return ext.length > 4 ? ext.slice(0, 4) : ext;
  }
  var mt = f.getMimeType() || "";
  if (mt.indexOf("pdf") > -1) return "PDF";
  if (mt.indexOf("spreadsheet") > -1) return "XLS";
  if (mt.indexOf("presentation") > -1) return "PPT";
  if (mt.indexOf("document") > -1) return "DOC";
  if (mt.indexOf("image") > -1) return "IMG";
  return "FILE";
}

function statementPdfName_(data) {
  var doc = String(data.docNo || data.id || "").replace(/[\\/:*?"<>|]/g, "");
  var cust = String(data.customerName || "").replace(/[\\/:*?"<>|]/g, "");
  return "거래명세서_" + doc + (cust ? "_" + cust : "") + ".pdf";
}

/** 같은 문서번호의 기존 PDF 를 휴지통으로 (중복 방지) */
function trashStatementPdf_(docNo) {
  if (!docNo) return;
  var folder = statementFolder_();
  var files = folder.getFiles();
  var frag = "거래명세서_" + String(docNo);
  while (files.hasNext()) {
    var f = files.next();
    if (f.getName().indexOf(frag) === 0) f.setTrashed(true);
  }
}

/** 명세서 데이터를 임시 Google Doc 으로 만들어 PDF 로 변환 후 폴더에 저장. PDF URL 반환. */
function saveStatementPdf_(data) {
  var items = [];
  try { items = (typeof data.items === "string") ? JSON.parse(data.items) : (data.items || []); } catch (e) { items = []; }

  var doc = DocumentApp.create("_tmp_stmt_" + (data.docNo || Date.now()));
  var body = doc.getBody();
  body.setMarginTop(36).setMarginBottom(36).setMarginLeft(36).setMarginRight(36);

  // 제목
  var title = body.appendParagraph("거래명세서");
  title.setHeading(DocumentApp.ParagraphHeading.TITLE);

  // 발행처
  var co = COMPANY;
  var coInfo = body.appendParagraph(co.name + "\n" + co.addr
    + "\n사업자등록번호 " + co.bizNo + " · 대표 " + co.ceo
    + (data.phone ? "\n" + data.phone : "")
    + (data.email ? "\n" + data.email : ""));
  coInfo.setFontSize(9).setForegroundColor("#555555");
  coInfo.setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

  body.appendHorizontalRule();

  // 고객 / 입금계좌
  var meta = body.appendParagraph(
    "고객명 : " + (data.customerName || "") + (data.contactName ? " (" + data.contactName + ")" : "")
    + "\n문서번호 : " + (data.docNo || "")
    + "\n청구일 : " + (data.billDate || "") + "    납부기한 : " + (data.dueDate || "")
    + "\n입금계좌 : " + [data.bankName, data.accountNo, data.accountHolder].filter(function (x) { return x; }).join(" / "));
  meta.setFontSize(10);

  // 품목 표
  var rows = [["품목", "단가", "수량", "공급가액", "세액", "합계"]];
  var tS = 0, tV = 0, tT = 0;
  items.forEach(function (it) {
    var supply = Math.round((+it.price || 0) * (+it.qty || 0));
    var vat = Math.round(supply * 0.1);
    var total = supply + vat;
    tS += supply; tV += vat; tT += total;
    rows.push([String(it.name || ""), won_(it.price), String(+it.qty || 0), won_(supply), won_(vat), won_(total)]);
  });
  // 배송비 (부가세 별도)
  var ship = +data.shipping || 0;
  if (ship > 0) {
    var shipVat = Math.round(ship * 0.1);
    tS += ship; tV += shipVat; tT += ship + shipVat;
    rows.push(["배송비", "", "", won_(ship), won_(shipVat), won_(ship + shipVat)]);
  }
  rows.push(["합계", "", "", won_(tS), won_(tV), won_(tT)]);
  var table = body.appendTable(rows);
  table.getRow(0).editAsText().setBold(true);
  table.getRow(rows.length - 1).editAsText().setBold(true);
  styleTableNums_(table);

  // 총 합계
  var tot = body.appendParagraph("총 공급가액 : " + won_(tS) + "    총 세액 : " + won_(tV) + "    총 합계 : " + won_(tT));
  tot.setBold(true).setAlignment(DocumentApp.HorizontalAlignment.RIGHT);

  // 비고
  if (data.memo) body.appendParagraph("비고 : " + data.memo).setFontSize(9).setForegroundColor("#444444");

  doc.saveAndClose();

  var pdf = DriveApp.getFileById(doc.getId()).getAs("application/pdf").setName(statementPdfName_(data));
  trashStatementPdf_(data.docNo);                 // 같은 문서번호 기존본 정리
  var file = statementFolder_().createFile(pdf);        // 기본 비공개(소유자 열람)
  DriveApp.getFileById(doc.getId()).setTrashed(true);   // 임시 Doc 삭제
  return file.getUrl();
}

/** 표 숫자 셀 우측 정렬 (품목 열 제외) */
function styleTableNums_(table) {
  for (var r = 0; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    for (var c = 1; c < row.getNumCells(); c++) {
      row.getCell(c).getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.RIGHT);
    }
  }
}

/** 천단위 콤마 */
function won_(n) {
  n = Math.round(+n || 0);
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/** 헤더 이름 기준으로 특정 행의 값을 { 헤더명: 값 } 객체로 읽어온다. */
function rowValuesByHeader_(sh, row, headers) {
  var vals = sh.getRange(row, 1, 1, headers.length).getValues()[0];
  var o = {};
  headers.forEach(function (h, i) { if (h) o[h] = vals[i]; });
  return o;
}

/** deletedAt 이 NOTE_RETENTION_DAYS 보다 오래된 노트를 완전히 삭제한다(보관 기한 만료). */
function purgeExpiredNotes_(sh) {
  var last = sh.getLastRow();
  if (last < 2) return;
  var headers = headerRow_(sh);
  var delCol = headers.indexOf("deletedAt") + 1;
  if (delCol < 1) return;
  var cutoff = Date.now() - NOTE_RETENTION_DAYS * 24 * 3600 * 1000;
  for (var r = last; r >= 2; r--) {
    var v = sh.getRange(r, delCol).getValue();
    if (!v) continue;
    var dt = new Date(v);
    if (!isNaN(dt.getTime()) && dt.getTime() < cutoff) sh.deleteRow(r);
  }
}

function handleNote_(action, data) {
  var sh = sheet_("notes", NOTE_FIELDS);
  purgeExpiredNotes_(sh);
  var headers = headerRow_(sh);

  if (action === "add") {
    var id = data.id || Utilities.getUuid();
    upsertRowByHeader_(sh, id, noteValuesObj_(Object.assign({}, data, { id: id, deletedAt: "" })));
    return json_({ ok: true, id: id });
  }

  if (action === "update") {
    var urow = findRowById_(sh, data.id);
    var keepDeletedAt = urow > 0 ? (rowValuesByHeader_(sh, urow, headers).deletedAt || "") : "";
    upsertRowByHeader_(sh, data.id, noteValuesObj_(Object.assign({}, data, { deletedAt: keepDeletedAt })));
    return json_({ ok: true, id: data.id });
  }

  if (action === "delete") {
    var drow = findRowById_(sh, data.id);
    if (drow < 0) return json_({ ok: false, error: "not found" });
    var dvals = rowValuesByHeader_(sh, drow, headers);
    dvals.deletedAt = new Date().toISOString();
    upsertRowByHeader_(sh, data.id, dvals);
    return json_({ ok: true });
  }

  if (action === "restore") {
    var rrow = findRowById_(sh, data.id);
    if (rrow < 0) return json_({ ok: false, error: "not found" });
    var rvals = rowValuesByHeader_(sh, rrow, headers);
    rvals.deletedAt = "";
    upsertRowByHeader_(sh, data.id, rvals);
    return json_({ ok: true });
  }

  if (action === "purge") {
    var prow = findRowById_(sh, data.id);
    if (prow < 0) return json_({ ok: false, error: "not found" });
    sh.deleteRow(prow);
    return json_({ ok: true });
  }

  return json_({ ok: false, error: "unknown action" });
}

function educationValuesObj_(data) {
  return {
    id: data.id, category: data.category || "정기교육", title: data.title || "",
    crewId: data.crewId || "", crewName: data.crewName || "전체 크루",
    date: data.date || "", dueDate: data.dueDate || "", status: data.status || "예정",
    provider: data.provider || "", hours: data.hours || "", note: data.note || "",
    link: data.link || "", checklist: data.checklist || "{}"
  };
}

function handleEducation_(action, data) {
  var sh = sheet_("education", EDUCATION_FIELDS);

  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    upsertRowByHeader_(sh, id, educationValuesObj_(Object.assign({}, data, { id: id })));
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

function handleReport_(action, data) {
  var sh = sheet_("reports", REPORT_FIELDS);

  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    upsertRowByHeader_(sh, id, {
      id: id, text: data.text || "", link: data.link || "", urgent: data.urgent ? "긴급" : "",
      done: data.done ? "완료" : "", reportedAt: data.reportedAt || ""
    });
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

/* =========================================================
   녹음 면담 · AI 정리 (Gemini)
   ---------------------------------------------------------
   · 프런트(voice-interview.js)가 전사 텍스트를 보내면
     Gemini API로 면담 양식에 맞게 요약해 돌려준다.
   · API 키는 코드에 절대 넣지 않는다:
     Apps Script 편집기 → 프로젝트 설정 → 스크립트 속성에
     GEMINI_API_KEY 로 저장 (키 발급: aistudio.google.com/apikey)
   · 음성 원본은 서버로 오지 않으며, 전사 텍스트도 저장하지 않는다.
   ========================================================= */
function handleSummarize_(data) {
  var key = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!key) return json_({ ok: false, error: "GEMINI_API_KEY 스크립트 속성이 설정되지 않았어요." });

  var transcript = String(data.transcript || "").slice(0, 60000);
  if (!transcript.trim()) return json_({ ok: false, error: "정리할 텍스트가 비어 있어요." });

  var ivType = String(data.ivType || "정기 면담");
  var isMerge = data.mode === "merge" && data.draft;

  var prompt =
    "너는 장애인 표준사업장 팀리더의 크루(직원) 면담 기록 작성을 돕는 보조자다.\n" +
    "아래 면담 전사 텍스트를 읽고, 반드시 다음 JSON 형식으로만 답하라. JSON 외 다른 텍스트·마크다운·백틱 금지.\n" +
    '{"content":"주요 논의 내용 (\\n으로 구분된 · 불릿 3~6줄, 산문체 자연스러운 한국어)",' +
    '"condition":"좋음|보통|우려됨 중 하나 (전사에서 드러난 크루 상태로 판단, 애매하면 보통)",' +
    '"followUp":"필요|불필요",' +
    '"followUpNote":"후속 조치가 필요하면 조치 내용을 · 불릿으로, 불필요하면 빈 문자열"}\n' +
    "규칙:\n" +
    "- 면담 유형: " + ivType + "\n" +
    "- 전사에는 여러 앱의 텍스트가 섞여 있을 수 있다. 교차 확인해 겹치는 내용은 하나로 합쳐라.\n" +
    "- 화자 표시(참석자1 등)가 없으면 질문-답변 문맥으로 추정하되, 불확실한 발언 귀속은 단정하지 마라.\n" +
    "- 전사에 없는 내용을 지어내지 마라. 민감한 건강·개인 정보는 업무에 필요한 수준으로만 간결히.\n";

  if (isMerge) {
    prompt +=
      "\n[통합 모드] 아래 '기존 초안'은 작성자가 이미 검토·수정한 내용이다. 초안의 내용과 표현을 최대한 유지하면서,\n" +
      "- 전사 텍스트에만 있는 내용은 새 불릿으로 추가하고\n" +
      "- 겹치는 내용은 중복 없이 하나로 병합하라.\n" +
      "기존 초안:\n" + JSON.stringify(data.draft) + "\n";
  }

  prompt += "\n면담 전사 텍스트:\n" + transcript;

  var res;
  try {
    res = UrlFetchApp.fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(key),
      {
        method: "post",
        contentType: "application/json",
        muteHttpExceptions: true,
        payload: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
        }),
      }
    );
  } catch (e) {
    return json_({ ok: false, error: "Gemini 호출 실패: " + e });
  }

  if (res.getResponseCode() !== 200) {
    return json_({ ok: false, error: "Gemini 오류(" + res.getResponseCode() + "). 키·사용량을 확인해주세요." });
  }

  try {
    var body = JSON.parse(res.getContentText());
    var text = body.candidates[0].content.parts[0].text;
    var out = JSON.parse(text.replace(/^```json|```$/g, "").trim());
    return json_({
      ok: true,
      result: {
        content: String(out.content || ""),
        condition: ["좋음", "보통", "우려됨"].indexOf(out.condition) >= 0 ? out.condition : "보통",
        followUp: out.followUp === "필요" ? "필요" : "불필요",
        followUpNote: String(out.followUpNote || ""),
      },
    });
  } catch (e) {
    return json_({ ok: false, error: "AI 응답 해석 실패 — 다시 시도해주세요." });
  }
}

/* =========================================================
   녹음 파일 직접 분석 (Gemini 멀티모달)
   ---------------------------------------------------------
   · 프런트가 오디오 파일(base64) + mimeType 를 보내면
     Gemini 가 음성을 직접 듣고(받아쓰기) 면담 양식으로 요약한다.
   · 클로바노트처럼 "파일 전체를 통째로" 처리 → 실시간 받아쓰기보다 정확.
   · 음성은 Gemini(구글)로 전송되어 처리되며, 서버에 저장하지 않는다.
   ========================================================= */
function handleSummarizeAudio_(data) {
  var key = PropertiesService.getScriptProperties().getProperty("GEMINI_API_KEY");
  if (!key) return json_({ ok: false, error: "GEMINI_API_KEY 스크립트 속성이 설정되지 않았어요." });

  var b64 = String(data.audioBase64 || "");
  if (!b64) return json_({ ok: false, error: "오디오 데이터가 비어 있어요." });
  var mime = String(data.mimeType || "audio/mp4");
  var ivType = String(data.ivType || "정기 면담");

  var prompt =
    "너는 장애인 표준사업장 팀리더의 크루(직원) 면담 기록 작성을 돕는 보조자다.\n" +
    "첨부된 면담 녹음(오디오)을 끝까지 듣고, 반드시 다음 JSON 형식으로만 답하라. JSON 외 다른 텍스트·마크다운·백틱 금지.\n" +
    '{"content":"주요 논의 내용 (\\n으로 구분된 · 불릿 3~6줄, 산문체 자연스러운 한국어)",' +
    '"condition":"좋음|보통|우려됨 중 하나 (녹음에서 드러난 크루 상태로 판단, 애매하면 보통)",' +
    '"followUp":"필요|불필요",' +
    '"followUpNote":"후속 조치가 필요하면 조치 내용을 · 불릿으로, 불필요하면 빈 문자열"}\n' +
    "규칙:\n" +
    "- 면담 유형: " + ivType + "\n" +
    "- 오디오에서 실제로 들린 내용만 근거로 삼고, 안 들린 내용을 지어내지 마라.\n" +
    "- 화자가 여럿이면 질문-답변 맥락으로 크루(직원)의 상태·발언을 판단하되, 불확실한 귀속은 단정하지 마라.\n" +
    "- 민감한 건강·개인 정보는 업무에 필요한 수준으로만 간결히.\n";

  var res;
  try {
    res = UrlFetchApp.fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=" + encodeURIComponent(key),
      {
        method: "post",
        contentType: "application/json",
        muteHttpExceptions: true,
        payload: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: mime, data: b64 } },
            { text: prompt },
          ] }],
          generationConfig: { temperature: 0.3, responseMimeType: "application/json" },
        }),
      }
    );
  } catch (e) {
    return json_({ ok: false, error: "Gemini 호출 실패: " + e });
  }

  if (res.getResponseCode() !== 200) {
    return json_({ ok: false, error: "Gemini 오류(" + res.getResponseCode() + "). 파일 형식(mp3·m4a·wav)·크기·사용량을 확인해주세요." });
  }

  try {
    var body = JSON.parse(res.getContentText());
    var text = body.candidates[0].content.parts[0].text;
    var out = JSON.parse(text.replace(/^```json|```$/g, "").trim());
    return json_({
      ok: true,
      result: {
        content: String(out.content || ""),
        condition: ["좋음", "보통", "우려됨"].indexOf(out.condition) >= 0 ? out.condition : "보통",
        followUp: out.followUp === "필요" ? "필요" : "불필요",
        followUpNote: String(out.followUpNote || ""),
      },
    });
  } catch (e) {
    return json_({ ok: false, error: "AI 응답 해석 실패 — 다시 시도해주세요." });
  }
}
