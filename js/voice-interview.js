/* =========================================================
   SNACK & GARDEN — OPS · 녹음 면담 모듈 (voice-interview.js)
   ---------------------------------------------------------
   · app.js 수정 없이 동작하는 독립 모듈
   · 크루 상세 "+ 면담 기록" 버튼 옆에 "🎙️ 녹음 면담" 버튼을 주입
   · 흐름: 녹음(실시간 받아적기) → AI 정리(GAS→Gemini)
           → 검토(외부 전사 텍스트 통합 가능)
           → 기존 면담 기록 폼에 자동 채움 → 사람이 최종 저장
   · 원본 음성은 저장하지 않음 (받아적기 텍스트만 사용)
   ========================================================= */
(function () {
  "use strict";

  /* ---------------- 설정 ---------------- */
  var IV_TYPES = ["정기 면담", "수시 면담", "온보딩 면담", "근무 관련", "근무 이슈", "고충 처리", "기타"];
  var CONDS = ["좋음", "보통", "우려됨"];

  function endpoint() { return (window.CONFIG && window.CONFIG.endpoint || "").trim(); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  /* ---------------- 스타일 주입 ---------------- */
  var css = ""
    + "#viBtn{display:inline-flex;align-items:center;gap:6px}"
    + "#viBtn .vi-dot{width:7px;height:7px;border-radius:50%;background:var(--red);box-shadow:0 0 7px rgba(255,90,82,.55)}"
    + ".vi-ovl{position:fixed;inset:0;background:rgba(0,0,0,.66);backdrop-filter:blur(3px);display:flex;align-items:flex-end;justify-content:center;z-index:120}"
    + ".vi-modal{background:var(--panel);border:1px solid var(--line);border-radius:var(--r-lg) var(--r-lg) 0 0;width:100%;max-width:560px;max-height:92vh;overflow-y:auto;padding:20px 18px 26px;box-shadow:var(--shadow)}"
    + "@media(min-width:640px){.vi-ovl{align-items:center;padding:20px}.vi-modal{border-radius:var(--r-lg)}}"
    + ".vi-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px}"
    + ".vi-steplabel{font-size:11px;letter-spacing:.1em;color:var(--ink-3);margin-bottom:4px}"
    + ".vi-title{font-size:16px;font-weight:700;color:var(--ink)}"
    + ".vi-x{background:none;border:none;color:var(--ink-3);font-size:20px;cursor:pointer;line-height:1}"
    + ".vi-steps{display:flex;gap:6px;margin-bottom:18px}"
    + ".vi-steps span{flex:1;height:3px;border-radius:2px;background:var(--line)}"
    + ".vi-steps span.on{background:var(--accent)}"
    + ".vi-fld{margin-bottom:12px}"
    + ".vi-fld>span{display:block;font-size:12px;color:var(--ink-2);margin-bottom:5px;font-weight:600}"
    + ".vi-fld select,.vi-fld input[type=text],.vi-fld textarea{width:100%;font:inherit;font-size:14px;background:var(--panel-2);border:1px solid var(--line);border-radius:var(--r-sm);color:var(--ink);padding:9px 11px;box-sizing:border-box}"
    + ".vi-fld textarea{resize:vertical;line-height:1.6}"
    + ".vi-consent{display:flex;gap:8px;align-items:flex-start;background:var(--panel-2);border:1px solid var(--line);border-radius:var(--r);padding:11px;font-size:13px;color:var(--ink-2);line-height:1.55;margin-bottom:14px;cursor:pointer}"
    + ".vi-consent input{margin-top:2px;accent-color:var(--accent)}"
    + ".vi-recstage{text-align:center;padding:4px 0}"
    + ".vi-recbtn{width:78px;height:78px;border-radius:50%;border:1px solid var(--line);background:var(--panel-2);cursor:pointer;font-size:28px;transition:.2s;margin-bottom:8px}"
    + ".vi-recbtn:disabled{opacity:.35;cursor:not-allowed}"
    + ".vi-recbtn.live{border-color:var(--red);background:rgba(255,90,82,.1);animation:viPulse 1.6s infinite}"
    + "@keyframes viPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,90,82,.35)}50%{box-shadow:0 0 0 13px rgba(255,90,82,0)}}"
    + ".vi-timer{font-size:24px;font-weight:700;letter-spacing:.05em;font-variant-numeric:tabular-nums;color:var(--ink)}"
    + ".vi-state{font-size:12px;color:var(--ink-3);letter-spacing:.06em;margin:3px 0 12px}"
    + ".vi-state.live{color:var(--red)}"
    + ".vi-live{background:var(--panel-2);border:1px solid var(--line-soft);border-radius:var(--r);padding:11px;font-size:13px;color:var(--ink-2);text-align:left;line-height:1.7;min-height:70px;max-height:130px;overflow-y:auto}"
    + ".vi-subnote{font-size:11px;color:var(--ink-3);margin-top:7px;text-align:left;line-height:1.6}"
    + ".vi-warn{font-size:12px;color:var(--amber);background:rgba(240,180,41,.08);border:1px solid rgba(240,180,41,.25);border-radius:var(--r-sm);padding:8px 11px;line-height:1.6;margin-bottom:12px}"
    + ".vi-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:16px}"
    + ".vi-skip{margin-top:13px;padding-top:13px;border-top:1px dashed var(--line);font-size:12px;color:var(--ink-3);text-align:center;line-height:1.6}"
    + ".vi-skip a{color:var(--accent-text);cursor:pointer;text-decoration:underline;font-weight:600}"
    + ".vi-proc{text-align:center;padding:28px 0}"
    + ".vi-spin{width:36px;height:36px;border:3px solid var(--line);border-top-color:var(--accent);border-radius:50%;margin:0 auto 14px;animation:viSp .8s linear infinite}"
    + "@keyframes viSp{to{transform:rotate(360deg)}}"
    + ".vi-proc p{font-size:14px;color:var(--ink-2)}.vi-proc .vi-mini{font-size:12px;color:var(--ink-3);margin-top:5px}"
    + ".vi-badge{display:inline-flex;align-items:center;gap:6px;font-size:11px;letter-spacing:.06em;color:var(--accent-text);border:1px solid rgba(198,255,46,.35);background:rgba(198,255,46,.07);border-radius:99px;padding:4px 10px;margin-bottom:12px}"
    + ".vi-paste{background:var(--panel-2);border:1px solid var(--line);border-radius:var(--r);padding:11px;margin-top:4px}"
    + ".vi-paste summary{font-size:13px;font-weight:600;color:var(--ink-2);cursor:pointer;list-style:none}"
    + ".vi-paste summary::before{content:'\\25B8 ';color:var(--accent-text)}"
    + ".vi-paste[open] summary::before{content:'\\25BE '}"
    + ".vi-paste p{font-size:12px;color:var(--ink-3);line-height:1.6;margin:7px 0}"
    + ".vi-paste textarea{width:100%;font:inherit;font-size:13px;background:var(--bg);border:1px solid var(--line);border-radius:var(--r-sm);color:var(--ink);padding:9px;line-height:1.6;resize:vertical;box-sizing:border-box}"
    + ".vi-paste .vi-mergerow{text-align:right;margin-top:7px}"
    + ".vi-err{font-size:12px;color:var(--red);line-height:1.6;margin-top:10px;text-align:center}"
    + ".vi-condrow{display:flex;gap:6px}"
    + ".vi-condrow button{flex:1;font:inherit;font-size:13px;padding:8px 0;border-radius:var(--r-sm);border:1px solid var(--line);background:var(--panel-2);color:var(--ink-2);cursor:pointer}"
    + ".vi-condrow button.on{border-color:var(--accent);color:var(--accent-text);background:rgba(198,255,46,.07)}"
    + ".vi-chk{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--ink-2);cursor:pointer;margin-bottom:12px}"
    + ".vi-chk input{accent-color:var(--accent)}";
  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  /* ---------------- 버튼 주입 ----------------
     크루 상세가 렌더될 때마다 "+ 면담 기록" 옆에 녹음 버튼을 붙인다. */
  function injectBtn() {
    var anchor = document.getElementById("crewAddInterviewBtn");
    if (!anchor || document.getElementById("viBtn")) return;
    var b = document.createElement("button");
    b.type = "button";
    b.id = "viBtn";
    b.className = anchor.className; // 기존 버튼 스타일 그대로
    b.classList.remove("btn--primary");
    b.innerHTML = '<span class="vi-dot"></span>녹음 면담';
    anchor.parentNode.insertBefore(b, anchor.nextSibling);
    b.style.marginLeft = "6px";
    b.addEventListener("click", openModal);
  }
  new MutationObserver(injectBtn).observe(document.body, { childList: true, subtree: true });
  injectBtn();

  /* ---------------- 상태 ---------------- */
  var S = null; // 세션 상태

  function freshState() {
    return {
      step: 1, sec: 0, tick: null,
      recording: false, wantRecording: false,
      recog: null, finalText: "", interimText: "",
      result: null, // AI 정리 결과 {content, condition, followUp, followUpNote}
    };
  }

  /* ---------------- 모달 ---------------- */
  function openModal() {
    closeModal();
    S = freshState();
    var crews = (window.CREW || []).map(function (c) {
      return '<option value="' + esc(c.id) + '">' + esc(c.name) + (c.group ? " · " + esc(c.group) : "") + "</option>";
    }).join("");
    var types = IV_TYPES.map(function (t) { return "<option>" + esc(t) + "</option>"; }).join("");
    var speechOK = !!(window.SpeechRecognition || window.webkitSpeechRecognition);

    var ovl = document.createElement("div");
    ovl.className = "vi-ovl";
    ovl.id = "viOvl";
    ovl.innerHTML =
      '<div class="vi-modal" role="dialog" aria-modal="true" aria-label="녹음 면담">'
      + '<div class="vi-head"><div><div class="vi-steplabel" id="viStepLabel">STEP 1 · 4 — 녹음</div>'
      + '<div class="vi-title" id="viTitle">🎙️ 녹음 면담</div></div>'
      + '<button type="button" class="vi-x" id="viClose">×</button></div>'
      + '<div class="vi-steps"><span id="viS1" class="on"></span><span id="viS2"></span><span id="viS3"></span><span id="viS4"></span></div>'

      /* STEP 1 — 녹음 */
      + '<div id="viStep1">'
      + '<div class="vi-fld"><span>크루 선택</span><select id="viCrew"><option value="">크루 선택</option>' + crews + "</select></div>"
      + '<div class="vi-fld"><span>면담 유형</span><select id="viType">' + types + "</select></div>"
      + '<label class="vi-consent"><input type="checkbox" id="viConsent"> 크루에게 녹음 및 기록 활용에 대한 동의를 받았습니다. <span style="color:var(--ink-3)">(체크해야 녹음 시작 가능 · 원본 음성은 저장되지 않습니다)</span></label>'
      + (speechOK ? "" : '<div class="vi-warn">⚠ 이 브라우저는 실시간 받아적기를 지원하지 않아요 (크롬 권장). 아래 "녹음 없이 텍스트만 붙여넣기"를 이용해주세요.</div>')
      + '<div class="vi-recstage">'
      + '<button type="button" class="vi-recbtn" id="viRecBtn"' + (speechOK ? "" : " disabled") + ">🎙️</button>"
      + '<div class="vi-timer" id="viTimer">00:00</div>'
      + '<div class="vi-state" id="viState">대기 중 · 버튼을 눌러 시작</div>'
      + '<div class="vi-live" id="viLive"><span style="color:var(--ink-3)">녹음이 시작되면 실시간 받아적기가 여기에 표시됩니다…</span></div>'
      + '<p class="vi-subnote">· 탭하면 일시정지/재개 · 받아적기가 부실해도 괜찮아요 — 검토 단계에서 클로바노트 등 외부 전사 텍스트를 추가해 통합할 수 있습니다.</p>'
      + "</div>"
      + '<div class="vi-foot"><button type="button" class="btn" id="viCancel1">취소</button>'
      + '<button type="button" class="btn btn--primary" id="viFinish" disabled>녹음 종료 → AI 정리</button></div>'
      + '<div class="vi-skip">이미 클로바노트 등 다른 앱으로 녹음했나요? <a id="viGoPaste">녹음 없이 텍스트만 붙여넣기 →</a></div>'
      + "</div>"

      /* STEP 1-B — 텍스트 전용 */
      + '<div id="viStep1b" hidden>'
      + '<div class="vi-fld"><span>크루 선택</span><select id="viCrewB"><option value="">크루 선택</option>' + crews + "</select></div>"
      + '<div class="vi-fld"><span>면담 유형</span><select id="viTypeB">' + types + "</select></div>"
      + '<label class="vi-consent"><input type="checkbox" id="viConsentB"> 크루에게 녹음 및 기록 활용에 대한 동의를 받았습니다.</label>'
      + '<div class="vi-fld"><span>전사 텍스트 붙여넣기</span>'
      + '<textarea id="viPasteOnly" rows="7" placeholder="클로바노트·다글로·음성메모 등에서 변환한 텍스트를 붙여넣으세요.\n여러 앱의 텍스트를 이어 붙여넣어도 됩니다 — AI가 교차 확인해 통합 정리해요."></textarea></div>'
      + '<div class="vi-foot"><button type="button" class="btn" id="viBackToRec">← 녹음 화면으로</button>'
      + '<button type="button" class="btn btn--primary" id="viSumB">✦ AI 정리</button></div>'
      + "</div>"

      /* STEP 2 — 정리 중 */
      + '<div id="viStep2" hidden><div class="vi-proc"><div class="vi-spin"></div>'
      + '<p id="viProcMsg">AI가 면담 내용을 정리하고 있어요…</p>'
      + '<p class="vi-mini" id="viProcMini">설정된 양식(주요 내용 / 크루 컨디션 / 후속 조치)에 맞춰 요약 중</p>'
      + '<div class="vi-err" id="viErr" hidden></div></div></div>'

      /* STEP 3 — 검토 */
      + '<div id="viStep3" hidden>'
      + '<span class="vi-badge" id="viBadge">✦ AI 정리 결과 — 자동 입력됨</span>'
      + '<div class="vi-warn">⚠ 저장 전 반드시 검토·수정하세요. AI 정리 결과는 초안이며, 최종 기록 책임은 작성자에게 있습니다.</div>'
      + '<div class="vi-fld"><span>주요 논의 내용</span><textarea id="viContent" rows="6"></textarea></div>'
      + '<div class="vi-fld"><span>크루 컨디션</span><div class="vi-condrow" id="viCondRow">'
      + CONDS.map(function (c) { return '<button type="button" data-c="' + c + '">' + c + "</button>"; }).join("")
      + "</div></div>"
      + '<label class="vi-chk"><input type="checkbox" id="viFollow"> 후속 조치 필요</label>'
      + '<div class="vi-fld" id="viFollowWrap" hidden><span>후속 조치 내용</span><textarea id="viFollowNote" rows="2"></textarea></div>'
      + '<details class="vi-paste"><summary>📋 외부 녹음 텍스트 추가하기</summary>'
      + '<p>클로바노트, 다글로, 음성메모 등 <b style="color:var(--ink-2)">어떤 앱의 전사 텍스트든</b> 붙여넣으면 지금 초안과 함께 참고해 통합 정리해요 — 빠진 내용은 추가, 겹치는 내용은 병합. 여러 개를 이어 붙여도 됩니다.</p>'
      + '<textarea id="viExtra" rows="4" placeholder="녹음 앱에서 변환한 텍스트를 복사해 여기에 붙여넣기"></textarea>'
      + '<div class="vi-mergerow"><button type="button" class="btn" id="viMerge">✦ 추가해서 통합 정리</button></div></details>'
      + '<div class="vi-foot"><button type="button" class="btn" id="viBack1">← 처음으로</button>'
      + '<button type="button" class="btn btn--primary" id="viToForm">면담 기록 폼에 채우기</button></div>'
      + "</div>";

    document.body.appendChild(ovl);

    /* 이벤트 바인딩 */
    byId("viClose").addEventListener("click", confirmClose);
    byId("viCancel1").addEventListener("click", confirmClose);
    byId("viRecBtn").addEventListener("click", toggleRec);
    byId("viConsent").addEventListener("change", syncConsent);
    byId("viFinish").addEventListener("click", finishAndSummarize);
    byId("viGoPaste").addEventListener("click", function () { showStep("1b"); });
    byId("viBackToRec").addEventListener("click", function () { showStep(1); });
    byId("viSumB").addEventListener("click", summarizeFromPaste);
    byId("viBack1").addEventListener("click", function () { stopRecog(); showStep(1); });
    byId("viToForm").addEventListener("click", pushToForm);
    byId("viMerge").addEventListener("click", mergeExtra);
    byId("viFollow").addEventListener("change", function () { byId("viFollowWrap").hidden = !this.checked; });
    byId("viCondRow").addEventListener("click", function (ev) {
      var b = ev.target.closest("button[data-c]"); if (!b) return;
      Array.prototype.forEach.call(this.querySelectorAll("button"), function (x) { x.classList.toggle("on", x === b); });
    });
    ovl.addEventListener("click", function (ev) { if (ev.target === ovl) confirmClose(); });

    // 현재 보고 있는 크루를 기본 선택
    var detailCrewBtn = document.getElementById("crewAddInterviewBtn");
    // crewDetailId는 app.js 내부 변수라 접근 불가 → 화면의 크루 이름으로는 추정하지 않고, 사용자가 선택
    syncConsent();
  }

  function byId(id) { return document.getElementById(id); }

  function closeModal() {
    stopRecog(); clearInterval(S && S.tick);
    var ovl = byId("viOvl"); if (ovl) ovl.remove();
    S = null;
  }
  function confirmClose() {
    if (S && (S.finalText || (S.result && S.result.content))) {
      if (!confirm("작성 중인 내용이 사라집니다. 닫을까요?")) return;
    }
    closeModal();
  }

  function showStep(n) {
    ["1", "1b", "2", "3"].forEach(function (k) { byId("viStep" + k).hidden = (String(n) !== k); });
    var order = { "1": 1, "1b": 1, "2": 2, "3": 3 };
    var cur = order[String(n)];
    for (var i = 1; i <= 4; i++) byId("viS" + i).classList.toggle("on", i <= cur);
    var labels = { "1": "STEP 1 · 4 — 녹음", "1b": "STEP 1 · 4 — 텍스트 붙여넣기", "2": "STEP 2 · 4 — AI 정리", "3": "STEP 3 · 4 — 검토 & 수정" };
    var titles = { "1": "🎙️ 녹음 면담", "1b": "📋 녹음 없이 시작", "2": "✦ 정리 중", "3": "📝 검토 후 폼으로" };
    byId("viStepLabel").textContent = labels[String(n)];
    byId("viTitle").textContent = titles[String(n)];
    S.step = n;
  }

  /* ---------------- 녹음 (실시간 받아적기) ---------------- */
  function syncConsent() {
    var ok = byId("viConsent").checked;
    var btn = byId("viRecBtn");
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) return;
    btn.disabled = !ok;
  }

  function toggleRec() {
    if (S.recording) { pauseRecog(); return; }
    startRecog();
  }

  function startRecog() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    S.wantRecording = true;
    var r = new SR();
    r.lang = "ko-KR"; r.continuous = true; r.interimResults = true;
    r.onresult = function (ev) {
      var interim = "";
      for (var i = ev.resultIndex; i < ev.results.length; i++) {
        var t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) S.finalText += t + " ";
        else interim += t;
      }
      S.interimText = interim;
      renderLive();
    };
    r.onerror = function (ev) {
      if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
        S.wantRecording = false; setRecUI(false);
        byId("viState").textContent = "마이크 권한이 거부되었어요 — 브라우저 설정에서 허용해주세요";
      }
    };
    r.onend = function () {
      // 크롬은 일정 시간 후 인식을 스스로 끊음 → 녹음 중이면 자동 재시작
      if (S && S.wantRecording) { try { r.start(); } catch (e) { /* 재시작 경합 무시 */ } }
    };
    S.recog = r;
    try { r.start(); } catch (e) { /* 이미 시작됨 */ }
    setRecUI(true);
    S.tick = setInterval(function () {
      S.sec++;
      var m = String(Math.floor(S.sec / 60)).padStart(2, "0"), s = String(S.sec % 60).padStart(2, "0");
      byId("viTimer").textContent = m + ":" + s;
    }, 1000);
    byId("viFinish").disabled = false;
  }

  function pauseRecog() {
    S.wantRecording = false;
    if (S.recog) try { S.recog.stop(); } catch (e) {}
    clearInterval(S.tick);
    setRecUI(false);
    byId("viState").textContent = "일시정지 · 탭하면 재개";
  }

  function stopRecog() {
    if (!S) return;
    S.wantRecording = false;
    if (S.recog) { try { S.recog.onend = null; S.recog.stop(); } catch (e) {} S.recog = null; }
    clearInterval(S.tick);
  }

  function setRecUI(live) {
    S.recording = live;
    var b = byId("viRecBtn"), st2 = byId("viState");
    if (!b) return;
    b.classList.toggle("live", live);
    b.textContent = live ? "⏸" : "🎙️";
    st2.classList.toggle("live", live);
    if (live) st2.textContent = "● 녹음 중 (탭하면 일시정지)";
  }

  function renderLive() {
    var el = byId("viLive"); if (!el) return;
    el.textContent = (S.finalText + S.interimText) || "";
    if (!el.textContent) el.innerHTML = '<span style="color:var(--ink-3)">…</span>';
    el.scrollTop = el.scrollHeight;
  }

  /* ---------------- AI 정리 (GAS 호출) ---------------- */
  function callSummarize(payload, onOK) {
    var ep = endpoint();
    showStep(2);
    byId("viErr").hidden = true;
    if (!ep) { showErr("구글시트 연동(endpoint)이 설정되지 않았어요. js/config.js 확인 후 이용해주세요."); return; }
    fetch(ep, { method: "POST", body: JSON.stringify(Object.assign({ type: "summarize" }, payload)) })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.ok) { showErr((data && data.error) || "정리에 실패했어요. 잠시 후 다시 시도해주세요."); return; }
        onOK(data.result || {});
      })
      .catch(function () { showErr("서버 호출에 실패했어요. 네트워크 상태를 확인해주세요."); });
  }

  function showErr(msg) {
    var el = byId("viErr");
    el.textContent = "⚠ " + msg;
    el.hidden = false;
    var back = document.createElement("div");
    back.style.marginTop = "10px";
    back.innerHTML = '<button type="button" class="btn">← 돌아가기</button>';
    back.querySelector("button").addEventListener("click", function () { back.remove(); showStep(S.lastInput === "paste" ? "1b" : 1); });
    el.appendChild(back);
  }

  function finishAndSummarize() {
    stopRecog(); setRecUI(false);
    var txt = (S.finalText + " " + S.interimText).trim();
    if (!byId("viConsent").checked) { alert("동의 체크가 필요합니다."); showStep(1); return; }
    if (!txt) { alert("받아적힌 내용이 없어요. 녹음을 진행하거나 '텍스트만 붙여넣기'를 이용해주세요."); return; }
    S.lastInput = "rec";
    S.crewSel = byId("viCrew").value; S.typeSel = byId("viType").value;
    byId("viProcMsg").textContent = "AI가 면담 내용을 정리하고 있어요…";
    callSummarize({ transcript: txt, ivType: S.typeSel }, function (r) { S.result = r; fillReview("✦ AI 정리 결과 — 실시간 받아적기 기반"); });
  }

  function summarizeFromPaste() {
    if (!byId("viConsentB").checked) { alert("동의 체크가 필요합니다."); return; }
    var txt = byId("viPasteOnly").value.trim();
    if (!txt) { alert("전사 텍스트를 먼저 붙여넣어주세요."); return; }
    S.lastInput = "paste";
    S.crewSel = byId("viCrewB").value; S.typeSel = byId("viTypeB").value;
    byId("viProcMsg").textContent = "붙여넣은 텍스트를 정리하고 있어요…";
    callSummarize({ transcript: txt, ivType: S.typeSel }, function (r) { S.result = r; fillReview("✦ AI 정리 결과 — 외부 전사 텍스트 기반"); });
  }

  function mergeExtra() {
    var extra = byId("viExtra").value.trim();
    if (!extra) { alert("외부 전사 텍스트를 먼저 붙여넣어주세요."); return; }
    // 현재 검토 화면의 (수정됐을 수 있는) 초안을 기준으로 통합
    var draft = collectReview();
    byId("viProcMsg").textContent = "기존 초안과 외부 녹음 텍스트를 통합 정리하고 있어요…";
    byId("viProcMini").textContent = "빠진 내용 추가 · 중복 내용 병합 중";
    callSummarize({ transcript: extra, draft: draft, ivType: S.typeSel, mode: "merge" }, function (r) {
      S.result = r;
      fillReview("✦ AI 정리 결과 — 초안 + 외부 텍스트 통합 (중복 병합됨)");
      byId("viExtra").value = "";
    });
  }

  function fillReview(badge) {
    showStep(3);
    byId("viBadge").textContent = badge;
    var r = S.result || {};
    byId("viContent").value = r.content || "";
    byId("viFollow").checked = (r.followUp === "필요");
    byId("viFollowWrap").hidden = !(r.followUp === "필요");
    byId("viFollowNote").value = r.followUpNote || "";
    var cond = CONDS.indexOf(r.condition) >= 0 ? r.condition : "보통";
    Array.prototype.forEach.call(byId("viCondRow").querySelectorAll("button"), function (b) {
      b.classList.toggle("on", b.getAttribute("data-c") === cond);
    });
  }

  function collectReview() {
    var condBtn = byId("viCondRow").querySelector("button.on");
    return {
      content: byId("viContent").value,
      condition: condBtn ? condBtn.getAttribute("data-c") : "보통",
      followUp: byId("viFollow").checked ? "필요" : "불필요",
      followUpNote: byId("viFollowNote").value,
    };
  }

  /* ---------------- 기존 면담 기록 폼에 채우기 ----------------
     app.js를 수정하지 않기 위해:
     ① 화면의 "+ 면담 기록" 버튼을 프로그램적으로 클릭해 기존 모달을 연다
     ② 열린 폼의 필드를 AI 결과로 채운다 → 사용자가 검토 후 기존 저장 버튼으로 저장 */
  function pushToForm() {
    var r = collectReview();
    var crewSel = S.crewSel, typeSel = S.typeSel;
    closeModal();

    var addBtn = document.getElementById("crewAddInterviewBtn");
    if (addBtn) addBtn.click();

    // 모달이 즉시 생성·표시되므로 다음 프레임에 채운다
    setTimeout(function () {
      var form = document.querySelector("#interviewModal form");
      if (!form) { alert("면담 기록 폼을 찾지 못했어요. '+ 면담 기록'을 눌러 직접 붙여넣어주세요."); return; }
      if (crewSel) form.crewId.value = crewSel;
      form.type.value = typeSel || "정기 면담";
      form.content.value = r.content;
      form.condition.value = r.condition;
      var seg = document.querySelector('#interviewModal .ivseg__btn[data-cond="' + r.condition + '"]');
      if (seg) seg.click();
      if (r.followUp === "필요") {
        if (!form.followUp.checked) form.followUp.click();
        form.followUpNote.value = r.followUpNote;
      }
    }, 80);
  }
})();
