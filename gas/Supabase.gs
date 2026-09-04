/**
 * Supabase 연동 — 면담일지 "읽기 전용 미러"
 * =====================================================
 * 데이터 흐름 (단방향):
 *   구글시트(마스터, 다른 분들이 편집)
 *     └─(GAS 가 getValues 로 읽기만)→ Supabase.journal_entries
 *         └─(GAS 프록시가 service_role 로 조회)→ 앱
 *   ⚠️ 이 파일은 구글시트에 절대 쓰지 않습니다. 시트는 getJournalData_() 로 읽기만.
 *
 * 스크립트 속성(프로젝트 설정 > 스크립트 속성)에 아래 2개 필요:
 *   SUPABASE_URL         = https://wxzuexxfktykmhcmrnvh.supabase.co   (끝 슬래시 없이/있어도 무방)
 *   SUPABASE_SERVICE_KEY = <service_role 키>  ← 절대 공개 금지, repo/프론트에 넣지 말 것
 *
 * 최초 1회 셋업(편집기에서 실행):
 *   1) supabase/schema.sql 을 Supabase SQL Editor 에서 실행(테이블 생성)
 *   2) 위 스크립트 속성 2개 등록
 *   3) syncJournalToSupabase   실행 → 첫 미러링 (권한 승인 팝업 허용)
 *   4) installJournalSyncTrigger 실행 → 매일 새벽 자동 동기화 트리거 설치
 *   5) 배포 관리 > 새 버전으로 배포 (?action=journal 이 Supabase 를 읽게 됨)
 * 확인:  journalSupabaseSelfTest 실행 → 로그에 tabs/rows 개수 출력
 */

/* ---------- 설정/헤더 ---------- */
function sb_url_()   { return String(PropertiesService.getScriptProperties().getProperty("SUPABASE_URL") || "").replace(/\/+$/, ""); }
function sb_key_()   { return PropertiesService.getScriptProperties().getProperty("SUPABASE_SERVICE_KEY") || ""; }
function sb_ready_() { return !!(sb_url_() && sb_key_()); }
function sb_rest_(path) { return sb_url_() + "/rest/v1/" + path; }
function sb_headers_(extra) {
  var k = sb_key_();
  var h = { "apikey": k, "Authorization": "Bearer " + k, "Content-Type": "application/json" };
  if (extra) Object.keys(extra).forEach(function (kk) { h[kk] = extra[kk]; });
  return h;
}
function sb_hash_(team, sheetId, tab, idx, data) {
  var s = team + "|" + sheetId + "|" + tab + "|" + idx + "|" + JSON.stringify(data);
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8);
  return raw.map(function (b) { return ("0" + (b & 0xFF).toString(16)).slice(-2); }).join("");
}

/* ---------- 페이지네이션 조회(PostgREST 기본 상한 대비) ---------- */
function sb_getAll_(pathBase) {
  var out = [], page = 1000, offset = 0;
  while (true) {
    var url = sb_rest_(pathBase) + (pathBase.indexOf("?") > -1 ? "&" : "?") + "limit=" + page + "&offset=" + offset;
    var res = UrlFetchApp.fetch(url, { method: "get", headers: sb_headers_(), muteHttpExceptions: true });
    if (res.getResponseCode() >= 300) throw new Error("Supabase GET 실패 " + res.getResponseCode() + " " + res.getContentText());
    var arr = JSON.parse(res.getContentText() || "[]");
    out = out.concat(arr);
    if (arr.length < page) break;
    offset += page;
  }
  return out;
}

/* =========================================================
   동기화: 시트(읽기 전용) → Supabase
   업서트(on_conflict merge) 후, 이번 실행에 없던 행/탭은 삭제.
   → 시트에서 지운 행·탭도 정확히 반영되고, 교체 중 빈 구간이 없습니다.
   ========================================================= */
function syncJournalToSupabase() { return syncJournalToSupabase_(); }
function syncJournalToSupabase_() {
  if (!sb_ready_()) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY 스크립트 속성이 필요합니다.");
  var runAt = new Date().toISOString();
  var data = getJournalData_();           // ← 기존 읽기 전용 함수 재사용(시트 쓰기 없음)
  var tabs = data.tabs || [];
  var sheets = data.sheets || [];

  var totalRows = 0;
  tabs.forEach(function (t) {
    var rows = t.rows || [];
    totalRows += rows.length;
    if (!rows.length) return;
    var payload = rows.map(function (r, i) {
      return {
        team: t.team, sheet_id: t.sheetId, tab_name: t.name, gid: t.gid || null,
        row_index: i, data: r, row_hash: sb_hash_(t.team, t.sheetId, t.name, i, r),
        synced_at: runAt
      };
    });
    // 500행씩 청크 업서트
    for (var s = 0; s < payload.length; s += 500) {
      var chunk = payload.slice(s, s + 500);
      var res = UrlFetchApp.fetch(
        sb_rest_("journal_entries?on_conflict=sheet_id,tab_name,row_index"),
        {
          method: "post",
          headers: sb_headers_({ "Prefer": "resolution=merge-duplicates,return=minimal" }),
          payload: JSON.stringify(chunk),
          muteHttpExceptions: true
        }
      );
      if (res.getResponseCode() >= 300)
        throw new Error("journal_entries upsert 실패 [" + t.name + "] " + res.getResponseCode() + " " + res.getContentText());
    }
  });

  // 이번 실행에 갱신되지 않은 행 삭제(= 시트에서 사라진 행/탭)
  sb_deleteStale_("journal_entries", runAt);

  // 시트 메타 업서트 후 스테일 삭제
  if (sheets.length) {
    var meta = sheets.filter(function (s) { return s.id; }).map(function (s) {
      return { sheet_id: s.id, team: s.team, title: s.title || "", synced_at: runAt };
    });
    if (meta.length) {
      var mres = UrlFetchApp.fetch(
        sb_rest_("journal_sheets?on_conflict=sheet_id"),
        { method: "post", headers: sb_headers_({ "Prefer": "resolution=merge-duplicates,return=minimal" }),
          payload: JSON.stringify(meta), muteHttpExceptions: true }
      );
      if (mres.getResponseCode() >= 300)
        throw new Error("journal_sheets upsert 실패 " + mres.getResponseCode() + " " + mres.getContentText());
    }
    sb_deleteStale_("journal_sheets", runAt);
  }

  var summary = { ok: true, at: runAt, tabs: tabs.length, rows: totalRows, sheets: sheets.length };
  Logger.log("[syncJournalToSupabase] " + JSON.stringify(summary));
  return summary;
}

function sb_deleteStale_(table, runAt) {
  var url = sb_rest_(table + "?synced_at=lt." + encodeURIComponent(runAt));
  var res = UrlFetchApp.fetch(url, { method: "delete", headers: sb_headers_({ "Prefer": "return=minimal" }), muteHttpExceptions: true });
  if (res.getResponseCode() >= 300)
    throw new Error(table + " stale 삭제 실패 " + res.getResponseCode() + " " + res.getContentText());
}

/* =========================================================
   읽기 프록시: Supabase → 기존 getJournalData_() 와 동일한 형태로 반환
   { tabs:[{team, sheetId, name, gid, rows:[{...}]}], sheets:[{team,id,title}], source }
   미설정/오류 시 시트 직접 읽기로 자동 폴백(안전 롤아웃).
   ========================================================= */
function getJournalFromSupabase_() {
  if (!sb_ready_()) return getJournalData_();   // 키 없으면 기존 방식(시트) 그대로
  try {
    var rows = sb_getAll_("journal_entries?select=team,sheet_id,tab_name,gid,row_index,data&order=sheet_id.asc,tab_name.asc,row_index.asc");
    var map = {}, order = [];
    rows.forEach(function (e) {
      var key = e.sheet_id + "||" + e.tab_name;
      if (!map[key]) { map[key] = { team: e.team, sheetId: e.sheet_id, name: e.tab_name, gid: e.gid, rows: [] }; order.push(key); }
      map[key].rows.push(e.data);
    });
    var tabs = order.map(function (k) { return map[k]; });

    var sheets = [];
    try {
      var sres = UrlFetchApp.fetch(sb_rest_("journal_sheets?select=team,sheet_id,title&order=team.asc"),
        { method: "get", headers: sb_headers_(), muteHttpExceptions: true });
      if (sres.getResponseCode() < 300)
        JSON.parse(sres.getContentText() || "[]").forEach(function (s) { sheets.push({ team: s.team, id: s.sheet_id, title: s.title }); });
    } catch (e2) {}

    return { tabs: tabs, sheets: sheets, source: "supabase" };
  } catch (err) {
    Logger.log("[getJournalFromSupabase_] 폴백(시트): " + err);
    return getJournalData_();   // 오류 시 시트 직접
  }
}

/* =========================================================
   트리거 설치 / 셀프테스트 (편집기에서 수동 실행)
   ========================================================= */
function installJournalSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "syncJournalToSupabase") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("syncJournalToSupabase").timeBased().everyDays(1).atHour(4).create();
  Logger.log("면담일지 동기화 트리거 설치 완료: 매일 04:00 (KST) syncJournalToSupabase");
}

function removeJournalSyncTrigger() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "syncJournalToSupabase") { ScriptApp.deleteTrigger(t); n++; }
  });
  Logger.log("면담일지 동기화 트리거 " + n + "개 제거");
}

function journalSupabaseSelfTest() {
  Logger.log("SUPABASE_URL 설정됨: " + !!sb_url_() + " / SERVICE_KEY 설정됨: " + !!sb_key_());
  if (!sb_ready_()) { Logger.log("스크립트 속성 미설정 — 시트 폴백 상태"); return; }
  var j = getJournalFromSupabase_();
  var rowN = (j.tabs || []).reduce(function (a, t) { return a + (t.rows ? t.rows.length : 0); }, 0);
  Logger.log("source=" + j.source + " · tabs=" + (j.tabs || []).length + " · rows=" + rowN + " · sheets=" + (j.sheets || []).length);
}

/* =========================================================
   범용 앱 데이터 저장소 (app_rows) — 단계적 시트→Supabase 이전
   ---------------------------------------------------------
   · 어떤 컬렉션(테이블명)을 Supabase 로 쓸지는 스크립트 속성
     SB_COLLECTIONS (쉼표구분) 로 관리 → 코드 재배포 없이 켜고 끔.
   · migrateTableToSupabase("crew") 실행 시: 시트→app_rows 복사 + 자동 활성화.
   · rows_() 와 각 핸들러가 sbEnabled_(coll) 이면 Supabase, 아니면 시트.
   ========================================================= */

function sbColls_() {
  var raw = PropertiesService.getScriptProperties().getProperty("SB_COLLECTIONS") || "";
  return raw.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
}
function sbEnabled_(coll) { return sb_ready_() && sbColls_().indexOf(coll) > -1; }
function sbSetEnabled_(coll, on) {
  var list = sbColls_(), i = list.indexOf(coll);
  if (on && i < 0) list.push(coll);
  if (!on && i > -1) list.splice(i, 1);
  PropertiesService.getScriptProperties().setProperty("SB_COLLECTIONS", list.join(","));
}

// 컬렉션명 → 필드 상수(Code.gs 의 전역). 특수(정산/PDF·노트 소프트삭제 등)는 우선 제외.
function fieldsFor_(coll) {
  var m = {
    crew: CREW_FIELDS, schedule: SCH_FIELDS, issues: ISSUE_FIELDS, points: POINT_FIELDS,
    reports: REPORT_FIELDS, interviews: INTERVIEW_FIELDS, attendance: ATTENDANCE_FIELDS,
    notes: NOTE_FIELDS, education: EDUCATION_FIELDS, hrchanges: HRCHANGE_FIELDS,
    partners: (typeof PARTNER_FIELDS !== "undefined" ? PARTNER_FIELDS : null),
    processes: (typeof PROCESS_FIELDS !== "undefined" ? PROCESS_FIELDS : null),
    drivehub: (typeof DRIVEHUB_FIELDS !== "undefined" ? DRIVEHUB_FIELDS : null),
    quotes: (typeof QUOTE_FIELDS !== "undefined" ? QUOTE_FIELDS : null),
    invoices: (typeof INVOICE_FIELDS !== "undefined" ? INVOICE_FIELDS : null)
  };
  return m[coll] || null;
}

// 이전 시 저장할 값 = doGet 이 내려주는 것과 동일하게 정규화(날짜/시간/불리언/JSON).
// 시간(HH:MM) 이 있는 표는 반드시 map 을 거쳐야 타임존 밀림이 없다.
function sheetMappedRows_(coll) {
  switch (coll) {
    case "crew":       return sheetRows_("crew", CREW_FIELDS);
    case "schedule":   return mapSchedule_(sheetRows_("schedule", SCH_FIELDS));
    case "issues":     return sheetRows_("issues", ISSUE_FIELDS);
    case "points":     return sheetRows_("points", POINT_FIELDS);
    case "reports":    return mapReports_(sheetRows_("reports", REPORT_FIELDS));
    case "interviews": return mapInterviews_(sheetRows_("interviews", INTERVIEW_FIELDS));
    case "attendance": return mapAttendance_(sheetRows_("attendance", ATTENDANCE_FIELDS));
    case "education":  return mapEducation_(sheetRows_("education", EDUCATION_FIELDS));
    case "hrchanges":  return mapDates_(sheetRows_("hrchanges", HRCHANGE_FIELDS), ["date"]);
    case "partners":   return sheetRows_("partners", PARTNER_FIELDS);
    case "processes":  return mapProcesses_(sheetRows_("processes", PROCESS_FIELDS));
    case "drivehub":   return mapDrivehub_(sheetRows_("drivehub", DRIVEHUB_FIELDS));
    case "quotes":     return mapDates_(sheetRows_("quotes", QUOTE_FIELDS), ["quoteDate", "validUntil"]);
    case "invoices":   return mapDates_(sheetRows_("invoices", INVOICE_FIELDS), ["invoiceDate", "dueDate"]);
    default:           return sheetRows_(coll, fieldsFor_(coll) || []);
  }
}

// 지원 테이블 일괄 이전(노트=소프트삭제, 정산서=PDF 는 제외 · 추후 별도 처리)
function migrateAllSupported() {
  var list = ["crew", "schedule", "issues", "points", "reports", "interviews",
              "attendance", "education", "hrchanges", "partners", "processes",
              "drivehub", "quotes", "invoices"];
  var already = sbColls_();
  var out = [];
  list.forEach(function (c) {
    // 이미 Supabase 로 이전된 컬렉션은 건너뜀(앱에서 수정한 데이터를 시트로 덮어쓰지 않도록)
    if (already.indexOf(c) > -1) { out.push({ ok: true, coll: c, skipped: "already enabled" }); return; }
    try { out.push(migrateTableToSupabase(c)); }
    catch (e) { out.push({ ok: false, coll: c, error: String(e) }); }
  });
  Logger.log("[migrateAllSupported] " + JSON.stringify(out));
  return out;
}

/* ---- 한방 프리페치: 이전된 컬렉션 전부를 1회 쿼리로 (all 번들 가속) ----
   각 GAS 실행(요청)마다 전역이 초기화되므로 요청 범위 캐시로 안전하다. */
var _sbAllCache = null;
function sbPrefetchAll_() {
  if (_sbAllCache) return _sbAllCache;
  _sbAllCache = {};
  var enabled = sbColls_();
  if (!sb_ready_() || !enabled.length) return _sbAllCache;
  try {
    var rows = sb_getAll_("app_rows?select=coll,id,data,ord&coll=in.(" + enabled.join(",") + ")&order=coll.asc,ord.asc");
    rows.forEach(function (r) {
      var o = r.data || {};
      if (o.id == null || o.id === "") o.id = r.id;
      (_sbAllCache[r.coll] = _sbAllCache[r.coll] || []).push(o);
    });
    enabled.forEach(function (c) { if (!_sbAllCache[c]) _sbAllCache[c] = []; }); // 빈 컬렉션도 캐시 히트
  } catch (err) {
    Logger.log("[sbPrefetchAll_ 실패] " + err);
    _sbAllCache = {};
  }
  return _sbAllCache;
}

/* ---- 읽기: app_rows → 시트 rows_ 와 동일한 [{필드:값}] ----
   프리페치 캐시에 있으면 그걸 쓰고(왕복 0), 없으면 단건 쿼리. */
function sbRows_(coll) {
  if (_sbAllCache && _sbAllCache[coll]) return _sbAllCache[coll];
  var arr = sb_getAll_("app_rows?coll=eq." + encodeURIComponent(coll) + "&select=id,data,ord&order=ord.asc");
  return arr.map(function (r) {
    var o = r.data || {};
    if (o.id == null || o.id === "") o.id = r.id;
    return o;
  });
}

/* ---- 쓰기: 업서트(ord 미포함 → 신규는 default, 기존은 유지) ---- */
function sbUpsertRow_(coll, id, obj) {
  obj = obj || {};
  if (obj.id == null || obj.id === "") obj.id = id;
  var payload = { coll: coll, id: String(id), data: obj, updated_at: new Date().toISOString() };
  var res = UrlFetchApp.fetch(
    sb_rest_("app_rows?on_conflict=coll,id"),
    { method: "post",
      headers: sb_headers_({ "Prefer": "resolution=merge-duplicates,return=minimal" }),
      payload: JSON.stringify(payload), muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) throw new Error("app_rows upsert 실패 [" + coll + "] " + res.getResponseCode() + " " + res.getContentText());
}
function sbDeleteRow_(coll, id) {
  var url = sb_rest_("app_rows?coll=eq." + encodeURIComponent(coll) + "&id=eq." + encodeURIComponent(String(id)));
  var res = UrlFetchApp.fetch(url, { method: "delete", headers: sb_headers_({ "Prefer": "return=minimal" }), muteHttpExceptions: true });
  if (res.getResponseCode() >= 300) throw new Error("app_rows delete 실패 [" + coll + "] " + res.getResponseCode() + " " + res.getContentText());
}

/* ---- 범용 쓰기 핸들러 (단순 CRUD 컬렉션용) ---- */
function sbHandle_(coll, action, data, valuesFn) {
  if (action === "add" || action === "update") {
    var id = data.id || Utilities.getUuid();
    var merged = Object.assign({}, data, { id: id });
    var obj = valuesFn ? valuesFn(merged) : merged;
    if (obj.id == null || obj.id === "") obj.id = id;
    sbUpsertRow_(coll, id, obj);
    return json_({ ok: true, id: id });
  }
  if (action === "delete") {
    if (!data.id) return json_({ ok: false, error: "no id" });
    sbDeleteRow_(coll, data.id);
    return json_({ ok: true });
  }
  return json_({ ok: false, error: "unknown action" });
}

/* ---- 이전(마이그레이션): 시트 → app_rows (재실행 안전) + 활성화 ---- */
function migrateTableToSupabase(coll) {
  if (!sb_ready_()) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_KEY 먼저 설정하세요.");
  var fields = fieldsFor_(coll);
  if (!fields) throw new Error("알 수 없는/미지원 컬렉션: " + coll);

  var rows = sheetMappedRows_(coll);   // ← 원본 시트에서 읽되, 엔드포인트와 동일하게 정규화(날짜·시간·불리언·JSON)
  var payload = rows.map(function (r, i) {
    var id = (r.id != null && r.id !== "") ? r.id : Utilities.getUuid();
    r.id = id;
    return { coll: coll, id: String(id), data: r, ord: i + 1, updated_at: new Date().toISOString() };
  });

  // 기존 잔여분 제거 후 새로 적재
  UrlFetchApp.fetch(sb_rest_("app_rows?coll=eq." + encodeURIComponent(coll)),
    { method: "delete", headers: sb_headers_({ "Prefer": "return=minimal" }), muteHttpExceptions: true });
  for (var s = 0; s < payload.length; s += 500) {
    var chunk = payload.slice(s, s + 500);
    var res = UrlFetchApp.fetch(sb_rest_("app_rows"),
      { method: "post", headers: sb_headers_({ "Prefer": "return=minimal" }),
        payload: JSON.stringify(chunk), muteHttpExceptions: true });
    if (res.getResponseCode() >= 300) throw new Error("app_rows 적재 실패 [" + coll + "] " + res.getResponseCode() + " " + res.getContentText());
  }
  sbSetEnabled_(coll, true);
  var msg = { ok: true, coll: coll, rows: payload.length, enabled: sbColls_() };
  Logger.log("[migrateTableToSupabase] " + JSON.stringify(msg));
  return msg;
}

// 되돌리기: 이 컬렉션을 다시 시트로 (app_rows 데이터는 남겨둠)
function disableSupabaseCollection(coll) { sbSetEnabled_(coll, false); Logger.log("'" + coll + "' → 시트로 되돌림. 활성=" + sbColls_()); }

// 현재 상태 확인
function supabaseCollectionsStatus() {
  Logger.log("Supabase 준비=" + sb_ready_() + " · 활성 컬렉션=" + JSON.stringify(sbColls_()));
}

// 크루 파일럿 원클릭: 이전 + 검증
function migrateCrewPilot() {
  var r = migrateTableToSupabase("crew");
  var check = sbRows_("crew");
  Logger.log("[크루 검증] app_rows 크루 " + check.length + "건 · 활성=" + JSON.stringify(sbColls_()));
  return r;
}
