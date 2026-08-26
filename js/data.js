/* =========================================================
   목업 데이터 (데모 모드)
   ---------------------------------------------------------
   실제 연동 시 이 배열들이 Google 시트에서 내려온 JSON 으로
   대체됩니다. 컬럼명 = 시트 헤더명 과 1:1 로 맞춰 두었습니다.
   ========================================================= */

/* --- 크루 목록 : 시트 "crew" (헤더 = 아래 key) ---
   group : 업무 그룹 = 스낵 | 가든 | 총무지원 (아바타 색 구분)
   disability : 장애여부 = 장애 | 비장애 */
window.CREW = [
  { id:"c1", name:"김하이든", role:"파트리더",  team:"헤이든",   group:"총무지원", status:"재직", joinDate:"2023-03-02", phone:"010-1234-5678", site:"판교 오아시스",  duties:["운영총괄","발주"],        note:"법인카드 상신 담당", contractType:"정규", birthDate:"", disability:"비장애", disabilityType:"", emergencyContact:"", badgeNumber:"O0052", workHours:"08:00-17:00(8h)" },
  { id:"c2", name:"이레오",   role:"시니어 크루", team:"레오",     group:"총무지원", status:"재직", joinDate:"2023-08-14", phone:"010-2345-6789", site:"판교 오아시스",  duties:["온보딩","일정"],          note:"31일 온보딩 진행", contractType:"정규", birthDate:"", disability:"비장애", disabilityType:"", emergencyContact:"", badgeNumber:"O0271", workHours:"08:00-17:00(8h)" },
  { id:"c3", name:"박엘리",   role:"매니저",     team:"엘리",     group:"총무지원", status:"재직", joinDate:"2022-11-01", phone:"010-3456-7890", site:"카렌 현장",     duties:["교육","경조지원"],        note:"퇴사 크루·경조 대응", contractType:"정규", birthDate:"", disability:"비장애", disabilityType:"", emergencyContact:"", badgeNumber:"O0371", workHours:"07:00-16:00(8h)" },
  { id:"c4", name:"최스칼렛", role:"크루",       team:"스칼렛",   group:"스낵",     status:"재직", joinDate:"2024-01-09", phone:"010-4567-8901", site:"판교 오아시스",  duties:["KEP검토","제안서"],       note:"Pay 제안서 1차", contractType:"계약", birthDate:"", disability:"비장애", disabilityType:"", emergencyContact:"", badgeNumber:"", workHours:"09:00-18:00(8h)" },
  { id:"c5", name:"정배라",   role:"신입 크루",  team:"배라",     group:"스낵",     status:"재직", joinDate:"2026-07-20", phone:"010-5678-9012", site:"판교 오아시스",  duties:["성수 OJT"],              note:"OJT 진행 중", contractType:"단기계약", birthDate:"", disability:"비장애", disabilityType:"", emergencyContact:"", badgeNumber:"", workHours:"09:00-18:00(8h)" },
  { id:"c6", name:"한카렌",   role:"현장 리드",  team:"카렌",     group:"가든",     status:"재직", joinDate:"2023-05-22", phone:"010-6789-0123", site:"카렌 현장",     duties:["백오피스","점검"],        note:"현장 백오피스 점검", contractType:"정규", birthDate:"", disability:"비장애", disabilityType:"", emergencyContact:"", badgeNumber:"", workHours:"07:00-16:00(8h)" },
  { id:"c7", name:"오미라",   role:"크루",       team:"미라",     group:"스낵",     status:"휴직", joinDate:"2024-06-03", phone:"010-7890-1234", site:"판교 오아시스",  duties:["리더 주간보고"],          note:"육아휴직 (~2026.09)", contractType:"정규", birthDate:"", disability:"비장애", disabilityType:"", emergencyContact:"", badgeNumber:"", workHours:"09:00-18:00(8h)" },
  { id:"c8", name:"신엔조",   role:"크루",       team:"엔조",     group:"가든",     status:"재직", joinDate:"2025-02-17", phone:"010-8901-2345", site:"판교 오아시스",  duties:["반차/근태"],             note:"7/24 오후 반차", contractType:"계약", birthDate:"1995-05-06", disability:"장애", disabilityType:"발달장애", emergencyContact:"010-0000-0000 (모)", badgeNumber:"", workHours:"07:00-16:00(8h)" },
  { id:"c9", name:"강아라",   role:"크루",       team:"아라",     group:"스낵",     status:"퇴사", joinDate:"2022-04-11", leftDate:"2026-06-30", phone:"010-9012-3456", site:"판교 오아시스",  duties:[],                        note:"2026.06 퇴사", contractType:"계약", birthDate:"", disability:"비장애", disabilityType:"", emergencyContact:"", badgeNumber:"", workHours:"09:00-18:00(8h)" },
];

/* --- 일정 : 시트 "schedule" (헤더 = id,date,time,title,category,done,assignee,link) --- */
window.SCHEDULE = [
  // 이번 주 7/20 ~ 7/24
  { id:"s1",  date:"2026-07-20", time:"08:30", title:"배라 성수 OJT",                 category:"교육",  done:true,  assignee:"배라" },
  { id:"s2",  date:"2026-07-20", time:"09:00", title:"AI스터디 공유 · 오아시스/조경엘라", category:"내부",  done:true,  assignee:"팀" },
  { id:"s3",  date:"2026-07-20", time:"10:00", title:"리더 주간보고 미라 정리",         category:"보고",  done:true,  assignee:"미라" },
  { id:"s4",  date:"2026-07-20", time:"10:00", title:"스칼렛 생일",                    category:"기타",  done:true,  assignee:"스칼렛" },
  { id:"s5",  date:"2026-07-20", time:"11:00", title:"레오 31일 온보딩 관련 일정 조율", category:"운영",  done:true,  assignee:"레오" },
  { id:"s6",  date:"2026-07-20", time:"15:30", title:"AI스터디 A3·O3 리더미팅 확인",    category:"내부",  done:true,  assignee:"팀" },
  { id:"s7",  date:"2026-07-20", time:"17:00", title:"KEP검토 확인 · 헤이든/스칼렛",     category:"운영",  done:true,  assignee:"헤이든" },
  { id:"s8",  date:"2026-07-20", time:"17:30", title:"Pay 제안서 1차 시작",             category:"운영",  done:true,  assignee:"스칼렛" },

  { id:"s9",  date:"2026-07-21", time:"11:00", title:"스낵 DS크루 면접 (편은진님)",      category:"채용",  done:true,  assignee:"헤이든" },
  { id:"s10", date:"2026-07-21", time:"11:00", title:"레오 31일 온보딩 관련 일정 조율", category:"운영",  done:true,  assignee:"레오" },
  { id:"s11", date:"2026-07-21", time:"15:00", title:"카카오산업안전보건협의체 2층 어피치", category:"외부",  done:false, assignee:"헤이든" },
  { id:"s12", date:"2026-07-21", time:"16:00", title:"링키지랩 주간 미팅",              category:"내부",  done:true,  assignee:"팀", link:"https://docs.google.com/document/d/EXAMPLE_DOC_ID/edit" },
  { id:"s13", date:"2026-07-21", time:"17:00", title:"KEP검토 확인 · 헤이든/스칼렛",     category:"운영",  done:true,  assignee:"헤이든" },
  { id:"s14", date:"2026-07-21", time:"17:30", title:"Pay 제안서 1차 시작",             category:"운영",  done:true,  assignee:"스칼렛" },

  { id:"s15", date:"2026-07-22", time:"",      title:"찰스 원카드 신청",                category:"행정",  done:false, assignee:"찰스" },
  { id:"s16", date:"2026-07-22", time:"",      title:"카카오게임즈 안전보건협의체",        category:"외부",  done:false, assignee:"헤이든" },
  { id:"s17", date:"2026-07-22", time:"10:00", title:"가든 단기 면접 (1)",              category:"채용",  done:false, assignee:"가든" },
  { id:"s18", date:"2026-07-22", time:"11:00", title:"가든 단기 면접 (2)",              category:"채용",  done:false, assignee:"가든" },
  { id:"s19", date:"2026-07-22", time:"12:00", title:"엘리 매니저 교육 · 퇴사/경조 발생 시", category:"교육",  done:false, assignee:"엘리" },
  { id:"s20", date:"2026-07-22", time:"15:00", title:"가든 백오피스 정리",              category:"운영",  done:false, assignee:"가든" },
  { id:"s21", date:"2026-07-22", time:"16:00", title:"카렌 현장 백오피스 점검",          category:"운영",  done:false, assignee:"카렌" },
  { id:"s22", date:"2026-07-22", time:"17:00", title:"KEP검토 확인 · 헤이든/스칼렛",     category:"운영",  done:false, assignee:"헤이든" },
  { id:"s23", date:"2026-07-22", time:"17:30", title:"Pay 제안서 1차 시작",             category:"운영",  done:false, assignee:"스칼렛" },

  { id:"s24", date:"2026-07-23", time:"10:00", title:"가든 단기 면접 (1)",              category:"채용",  done:false, assignee:"가든" },
  { id:"s25", date:"2026-07-23", time:"11:00", title:"가든 단기 면접 (2)",              category:"채용",  done:false, assignee:"가든" },
  { id:"s26", date:"2026-07-23", time:"14:30", title:"조경 전체층 라운딩 · 엘리",         category:"운영",  done:false, assignee:"엘리" },
  { id:"s27", date:"2026-07-23", time:"17:00", title:"온보딩관련 미팅 · 레오",           category:"운영",  done:false, assignee:"레오" },

  { id:"s28", date:"2026-07-24", time:"",      title:"엔조 오후 반차",                  category:"근태",  done:false, assignee:"엔조" },

  // 다음 주 7/27 ~ 7/31
  { id:"s29", date:"2026-07-28", time:"15:00", title:"링키지랩 주간 미팅",              category:"내부",  done:false, assignee:"팀" },
  { id:"s30", date:"2026-07-29", time:"",      title:"온보딩관련(7/31) 미팅 사진 확인 · 레오", category:"운영", done:false, assignee:"레오" },
  { id:"s31", date:"2026-07-31", time:"",      title:"연차",                          category:"휴일",  done:false, assignee:"팀" },
];

/* --- 면담 & 근무 기록 : 시트 "interviews"
   (헤더 = id,date,time,crewId,crewName,type,condition,recorder,content,followUp,followUpNote,privateNote) ---
   condition : 좋음 | 보통 | 우려됨    followUp : "필요" | "" */
window.INTERVIEWS = [
  { id:"iv1", date:"2026-07-20", time:"14:00", crewId:"c5", crewName:"정배라", type:"온보딩 면담",
    condition:"좋음", recorder:"제이미",
    content:"성수 OJT 첫 주 소회 공유. 업무 습득 속도 빠르고 팀 적응 원활. 발주 프로세스에 관심 많음.",
    followUp:"", followUpNote:"", privateNote:"" },
  { id:"iv2", date:"2026-07-18", time:"11:30", crewId:"c7", crewName:"오미라", type:"정기 면담",
    condition:"우려됨", recorder:"제이미",
    content:"육아휴직 복귀 시점 관련 논의. 복귀 후 근무형태(단축근무) 조정 희망.",
    followUp:"필요", followUpNote:"인사팀과 단축근무 가능 여부 확인 후 8월 초 재면담 예정.", privateNote:"복귀 의사 확고하나 일정 유동적. 배려 필요." },
  { id:"iv3", date:"2026-07-15", time:"16:00", crewId:"c8", crewName:"신엔조", type:"근무 관련",
    condition:"보통", recorder:"제이미",
    content:"반차/근태 사용 패턴 점검. 업무 몰입도 양호, 반복 업무에서 집중력 편차 있음.",
    followUp:"필요", followUpNote:"주 1회 업무 우선순위 체크인 도입.", privateNote:"" },
];

/* --- 근태 기록 : 시트 "attendance" (헤더 = id,date,time,crewId,crewName,kind,reason,recorder)
   kind : 지각 | 조퇴 --- */
window.ATTENDANCE = [
  { id:"at1", date:"2026-07-21", time:"09:15", crewId:"c8", crewName:"신엔조", kind:"지각", reason:"버스 지연", recorder:"제이미" },
  { id:"at2", date:"2026-07-24", time:"14:00", crewId:"c8", crewName:"신엔조", kind:"조퇴", reason:"병원 진료", recorder:"제이미" },
];

/* --- 인사 변동 : 시트 "hrchanges" (헤더 = id,crewId,crewName,type,typeLabel,date,before,after,reason,recorder,link)
   type : 입사 | 퇴사 | 휴직 | 복직 | 파트이동 | 직급변경 | 기타
   typeLabel : type="기타"일 때 직접 입력한 유형명   link : 관련 링크(선택) --- */
window.HR_CHANGES = [
  { id:"hc1", crewId:"c5", crewName:"정배라", type:"입사", typeLabel:"", date:"2026-07-20", before:"", after:"신입 크루 · 스낵", reason:"성수 OJT로 입사", recorder:"제이미", link:"" },
  { id:"hc2", crewId:"c7", crewName:"오미라", type:"휴직", typeLabel:"", date:"2026-06-01", before:"재직", after:"육아휴직", reason:"육아휴직 (~2026.09)", recorder:"제이미", link:"" },
  { id:"hc3", crewId:"c9", crewName:"강아라", type:"퇴사", typeLabel:"", date:"2026-06-30", before:"재직", after:"퇴사", reason:"개인 사유로 퇴사", recorder:"제이미", link:"https://docs.google.com/document/d/EXAMPLE_DOC_ID/edit" },
  { id:"hc4", crewId:"c1", crewName:"김하이든", type:"입사", typeLabel:"", date:"2023-03-02", before:"", after:"정규직 · 총무지원", reason:"공채 입사", recorder:"제이미", link:"" },
  { id:"hc5", crewId:"c2", crewName:"이레오", type:"입사", typeLabel:"", date:"2023-08-14", before:"", after:"크루 · 총무지원", reason:"경력 채용", recorder:"제이미", link:"" },
  { id:"hc6", crewId:"c1", crewName:"김하이든", type:"직급변경", typeLabel:"", date:"2024-04-01", before:"크루", after:"파트리더", reason:"파트리더 승진", recorder:"제이미", link:"" },
];

/* --- 노트 기록 : 시트 "notes" (헤더 = id,date,time,part,text,author,link,deletedAt)
   part : 전체 | 스낵 | 가든 | 총무지원
   link : 관련 링크(선택)   deletedAt : 삭제 시각(ISO datetime, 있으면 보관함으로 이동 / 보관 기한 1년) --- */
window.NOTES = [
  { id:"nt1", date:"2026-07-24", time:"11:20", part:"가든", text:"카렌 현장 우산꽂이 파손 — 다음 발주 때 같이 신청", author:"제이미", link:"", deletedAt:"" },
  { id:"nt2", date:"2026-07-22", time:"09:05", part:"스낵", text:"성수 OJT 배라 명찰 아직 미발급, 뱃지번호 확인 필요", author:"제이미", link:"", deletedAt:"" },
  { id:"nt3", date:"2026-07-10", time:"14:40", part:"총무지원", text:"7월 발주서 초안 공유 드라이브", author:"제이미", link:"https://docs.google.com/document/d/EXAMPLE_DOC_ID/edit", deletedAt:"2026-07-15T05:00:00.000Z" },
];

/* --- 교육 관리 : 시트 "education"
   (헤더 = id,category,title,crewId,crewName,date,dueDate,status,provider,hours,note)
   category : OJT온보딩 | 법정의무교육 | 정기교육
   status   : 예정 | 진행중 | 완료
   crewName : 개인명 또는 "전체 크루"(crewId 는 비움) --- */
window.EDUCATION = [
  // OJT 온보딩
  { id:"ed1", category:"OJT온보딩", title:"성수 현장 OJT (1주차)", crewId:"c5", crewName:"정배라",
    date:"2026-07-20", dueDate:"", status:"진행중", provider:"레오", hours:"주 5일", note:"발주 프로세스 집중 습득" },
  { id:"ed2", category:"OJT온보딩", title:"신규 입사자 온보딩 오리엔테이션", crewId:"c5", crewName:"정배라",
    date:"2026-07-31", dueDate:"", status:"예정", provider:"레오", hours:"3시간", note:"7/31 온보딩 미팅" },

  // 법정의무교육 (연 1회 이수 의무)
  { id:"ed3", category:"법정의무교육", title:"직장 내 성희롱 예방교육", crewId:"", crewName:"전체 크루",
    date:"2026-03-12", dueDate:"2026-12-31", status:"완료", provider:"사내 (엘리)", hours:"1시간", note:"전 직원 이수 완료" },
  { id:"ed4", category:"법정의무교육", title:"개인정보보호 교육", crewId:"", crewName:"전체 크루",
    date:"", dueDate:"2026-12-31", status:"예정", provider:"온라인 이러닝", hours:"1시간", note:"하반기 진행 예정" },
  { id:"ed5", category:"법정의무교육", title:"장애인 인식개선 교육", crewId:"", crewName:"전체 크루",
    date:"2026-06-18", dueDate:"2026-08-31", status:"진행중", provider:"외부 강사", hours:"1시간", note:"일부 크루 미이수 — 8월 보충" },
  { id:"ed6", category:"법정의무교육", title:"산업안전보건 교육 (분기)", crewId:"", crewName:"전체 크루",
    date:"", dueDate:"2026-09-30", status:"예정", provider:"안전관리자", hours:"3시간", note:"3분기 정기 실시" },

  // 정기 교육
  { id:"ed7", category:"정기교육", title:"매니저 대응 교육 · 퇴사/경조 발생 시", crewId:"c3", crewName:"박엘리",
    date:"2026-07-22", dueDate:"", status:"예정", provider:"내부", hours:"1시간", note:"퇴사·경조 대응 프로세스" },
  { id:"ed8", category:"정기교육", title:"CS 응대 역량 강화", crewId:"", crewName:"스낵 파트",
    date:"2026-05-14", dueDate:"", status:"완료", provider:"외부 강사", hours:"2시간", note:"" },
];

/* --- 발행처(공급자) : 주식회사 링키지랩 (고정) ---
   전화·이메일·입금계좌는 명세서 편집 화면에서 입력하면 다음 명세서에 자동으로 채워집니다.
   logo : assets/logo.png 에 파일을 넣으면 자동으로 표시됩니다(없으면 회사명 텍스트). */
window.COMPANY = {
  name: "주식회사 링키지랩",
  bizNo: "235-88-00278",
  ceo: "박대영",
  addr: "서울특별시 성동구 성수동2가 314-37번지 3층",
  logo: "./assets/logo.png",
};

/* --- 거래처(고객) : 시트 "partners" (헤더 = id,name,contact,bizNo,ceo,addr)
   name=고객명(상호), contact=담당자명. 명세서 등록 시 선택하면 자동 입력됩니다. --- */
window.PARTNERS = [
  { id:"p1", name:"카카오페이", contact:"김담당", bizNo:"", ceo:"", addr:"" },
];

/* --- 거래명세서 : 시트 "statements"
   (헤더 = id,docNo,billDate,dueDate,customerName,contactName,bankName,accountNo,accountHolder,phone,email,items,shipping,supplyAmount,vat,total,memo,status,createdAt)
   shipping : 배송비(부가세 별도). 세액(10%)이 붙어 총 공급가액·세액·합계에 합산됩니다.
   공급자 = 주식회사 링키지랩(고정) / items = 품목 배열 JSON. 각 품목 = { name, price(단가·부가세별도), qty }
   status : 작성 | 확정
   계산규칙 : 단가는 부가세 별도.
     공급가액 = round(단가 × 수량)  /  세액 = round(공급가액 × 0.1)  /  합계 = 공급가액 + 세액 --- */
window.STATEMENTS = [
  { id:"st1", docNo:"25010001", billDate:"2025-01-14", dueDate:"2025-01-30",
    customerName:"카카오페이", contactName:"김담당",
    bankName:"", accountNo:"", accountHolder:"주식회사 링키지랩", phone:"", email:"",
    items:[
      { name:"스낵 큐레이션 (1월)", price:1500000, qty:1 },
      { name:"운영 관리비",         price:500000,  qty:1 },
    ],
    shipping:0,
    supplyAmount:2000000, vat:200000, total:2200000,
    memo:"", status:"확정", createdAt:"2025-01-14T00:00:00.000Z" },
];

/* --- 상단 요약 : 시트 "summary" 또는 대시보드 카드 --- */
window.SUMMARY = {
  monthLabel: "2026년 7월",
  issues: [
    { id: "i1", text: "헤이든 — 팔로업 사항 : 법인카드 상신", link: "" },
    { id: "i2", text: "헤이든 — 안내 사항", link: "https://docs.google.com/document/d/EXAMPLE_DOC_ID/edit" },
  ],
  points: [],
  reports: [],
};

/* =========================================================
   발행 보고서 (업무 보고 · 게시형 문서)
   ---------------------------------------------------------
   html : .wrdoc 스코프 안에서 렌더링/인쇄되는 보고서 본문.
   새 보고서는 이 배열에 객체 하나를 추가하면 목록에 노출됩니다.
   ========================================================= */
window.WR_DOCS = [
  {
    id: "wr-mobility-landscaping-2026-08",
    kind: "html",
    type: "HTML",
    title: "모빌리티 조경 관리구역 변경 검토",
    date: "2026-08-25",
    category: "조경 관리",
    author: "Jamie · Snack & Garden",
    summary: "리모델링에 따른 플랜트박스 삭제가 현장 관리공수에 미치는 영향을 정량 환산하고 관리비 조정 기준을 검토.",
    html: [
      '<div class="wrdoc-head">',
        '<span class="wrdoc-eyebrow">Snack &amp; Garden · 조경 관리 검토</span>',
        '<h1 class="wrdoc-title">모빌리티 조경 관리구역 변경 검토</h1>',
        '<p class="wrdoc-lede">리모델링에 따른 플랜트박스 삭제가 실제 <b>현장 관리공수</b>에 미치는 영향을 정량 환산하고, 이를 근거로 9월 관리비 조정 기준을 판단하기 위한 검토 보고입니다.</p>',
        '<div class="wrdoc-meta"><span><b>대상</b> 7·8·9·13층</span><span><b>확정 삭제</b> 대형조성 12개</span><span><b>작성일</b> 2026-08-25</span></div>',
      '</div>',

      '<section class="wrdoc-sec"><h2><span class="wrdoc-no">01</span>기존 관리 현황</h2>',
        '<div class="wrdoc-tw"><table class="wrdoc-table"><thead><tr><th>구분</th><th>기본 플랜트박스</th><th>대형조성</th><th>소형·중형 화분</th></tr></thead>',
        '<tbody><tr><td>7층</td><td>56</td><td>9</td><td>10</td></tr>',
        '<tr><td>8층</td><td>71</td><td>9</td><td>3</td></tr>',
        '<tr class="has-del"><td>9층</td><td>67</td><td>9<span class="del-mark">−7 삭제</span></td><td>5</td></tr>',
        '<tr class="has-del"><td>13층</td><td>44</td><td>8<span class="del-mark">−5 삭제</span></td><td>1</td></tr>',
        '<tr class="wrdoc-total"><td>합계</td><td>238</td><td>35</td><td>19</td></tr></tbody></table></div>',
        '<div class="del-callout"><div class="dc-num">−12<small>개 삭제</small></div><div class="dc-body">리모델링으로 <b>대형조성 플랜트박스 총 12개</b>가 삭제됩니다. 9층 <b>7곳</b>, 13층 <b>5곳(플랜트월 포함)</b> — 현재 확정된 삭제량입니다.</div></div>',
      '</section>',

      '<section class="wrdoc-sec"><h2><span class="wrdoc-no">02</span>관리공수 환산 기준</h2>',
        '<div class="wrdoc-cards">',
          '<div class="wrdoc-card"><p class="k">기본 플랜트박스 1개</p><p class="v">1<small> 공수</small></p></div>',
          '<div class="wrdoc-card"><p class="k">대형조성 1개</p><p class="v">≈8<small> 공수</small></p></div>',
          '<div class="wrdoc-card"><p class="k">소형·중형 화분 1개</p><p class="v">1<small> 공수(단순환산)</small></p></div>',
        '</div>',
        '<div class="wrdoc-tw"><table class="wrdoc-table"><thead><tr><th>층</th><th>환산식</th><th>관리공수</th></tr></thead>',
        '<tbody><tr><td>7층</td><td>56 + (9×8) + 10</td><td>138</td></tr>',
        '<tr><td>8층</td><td>71 + (9×8) + 3</td><td>146</td></tr>',
        '<tr><td>9층</td><td>67 + (9×8) + 5</td><td>144</td></tr>',
        '<tr><td>13층</td><td>44 + (8×8) + 1</td><td>109</td></tr>',
        '<tr class="wrdoc-total"><td>전체</td><td>4개 층 합계</td><td>537</td></tr></tbody></table></div>',
        '<p class="wrdoc-note">4개 층 평균 537 ÷ 4 ≈ <b>134.3</b> → 1개 층 평균 관리공수 ≈ 134</p>',
      '</section>',

      '<section class="wrdoc-sec"><h2><span class="wrdoc-no">03</span>삭제 시나리오별 영향</h2>',
        '<div class="wrdoc-scen">',
          '<div class="wrdoc-scard"><p class="tag">시나리오 ①</p><p class="cond">대형조성 12개만 삭제</p><p class="big">17.9<small>%</small></p><p class="sub">공수 −96 · 층 환산 ≈ 0.72층</p></div>',
          '<div class="wrdoc-scard hot"><p class="tag">시나리오 ②</p><p class="cond">대형 12개 + 기본 32개 삭제</p><p class="big">23.8<small>%</small></p><p class="sub">공수 −128 · 층 환산 ≈ 0.95층</p></div>',
        '</div>',
        '<div class="wrdoc-tw"><table class="wrdoc-table"><thead><tr><th>삭제 조건</th><th>공수 감소</th><th>전체 감소율</th><th>층 환산</th></tr></thead>',
        '<tbody><tr><td>① 대형조성 12개만 삭제</td><td class="pos">−96</td><td>17.9%</td><td>≈ 0.72층</td></tr>',
        '<tr><td>② 대형 12개 + 기본 32개 삭제</td><td class="pos">−128</td><td>23.8%</td><td>≈ 0.95층</td></tr>',
        '<tr><td>정확한 1개 층 기준</td><td>≈ 134</td><td>25%</td><td>1층</td></tr></tbody></table></div>',
        '<div class="wrdoc-callout" style="border-left-color:#1b5e3f;"><span class="lbl" style="color:#1b5e3f;">검토 현황 (2026-08-25 기준)</span><p>현재 모빌리티 측에서는 <b>기본 플랜트박스 약 32개</b>의 <b>삭제 여부(삭제·유지)</b>를 검토 중입니다. <b>32개 삭제가 확정되면 시나리오 ②</b>(약 23.8% · 약 0.95개 층), <b>유지되면 시나리오 ①</b>(약 17.9% · 약 0.72개 층)이 적용됩니다.</p></div>',
      '</section>',

      '<section class="wrdoc-sec"><h2><span class="wrdoc-no">04</span>최종 판단</h2>',
        '<div class="wrdoc-tw"><table class="wrdoc-table"><thead><tr><th>구분</th><th>결과</th><th>해석</th></tr></thead>',
        '<tbody><tr><td>① 기본 32개 유지</td><td>약 0.72층 감소</td><td>4→3개 층 조정하기엔 감소폭이 다소 큼</td></tr>',
        '<tr><td>② 기본 32개 폐기</td><td>약 0.95층 / 23.8%</td><td>실질적 1개 층에 근접 → 3개 층 조정의 근거</td></tr></tbody></table></div>',
        '<div class="wrdoc-callout"><p><b>‘층이 사라지는 것’이 아니라 ‘식재 관리공수가 줄어드는 것’입니다.</b> 9층·13층은 여전히 관리구역으로 남으며, <b>이동·라운딩·잔여 식재 점검·병해충 확인</b> 등 고정 공수는 계속 발생합니다. 따라서 관리비 조정 기준은 ‘1개 층 삭제’가 아닌 <b>‘식재 관리공수 기준 약 1개 층 상당 감소’</b>로 보는 것이 정확합니다.</p></div>',
      '</section>',

      '<section class="wrdoc-sec"><h2><span class="wrdoc-no">05</span>층별 식물 · 삭제 구간 도면 <small style="font-size:12px;color:#838c86;font-weight:600;">(2026-08-25 기준)</small></h2>',
        '<p class="wrdoc-note" style="margin-bottom:12px;">초록 = 식물(플랜트박스) 위치, 보라 = 삭제 구간(대형조성 삭제분).</p>',
        '<div class="wrdoc-floors"><figure><figcaption>7F</figcaption><img src="./assets/floors/7f.png" alt="7F 도면" loading="lazy"></figure><figure><figcaption>8F</figcaption><img src="./assets/floors/8f.png" alt="8F 도면" loading="lazy"></figure><figure><figcaption>9F</figcaption><img src="./assets/floors/9f.png" alt="9F 도면" loading="lazy"></figure><figure><figcaption>13F</figcaption><img src="./assets/floors/13f.png" alt="13F 도면" loading="lazy"></figure></div>',
      '</section>',

      '<section class="wrdoc-sec"><h2><span class="wrdoc-no">06</span>비용 조정 방안</h2>',
        '<p class="wrdoc-note" style="margin:0 0 12px;">모빌리티 리모델링 관련 · 발주처 협의 기준</p>',
        '<p class="cs-p">리모델링으로 9층 및 13층 일부 식재가 삭제됨에 따라, 향후 관리 범위와 관리비 조정 기준을 아래와 같이 제안드립니다.</p>',
        '<p class="cs-p">현재 확인된 식재 삭제 범위를 관리 공수로 환산하면 <b>약 0.5개 층 수준</b>으로, 일 운영 기준 <b>약 1시간</b>의 작업량 감소가 예상됩니다.</p>',
        '<p class="cs-p">다만 식재 일부가 삭제되더라도 <b>9층과 13층은 기존 관리 구역으로 유지</b>되므로, 층간 이동·정기 라운딩·잔여 식재 점검 및 관수·병해충 예찰·방제 등 기본 관리 공수는 지속적으로 발생합니다.</p>',
        '<p class="cs-bt">현재 관리비 및 예상 조정 기준</p>',
        '<div class="wrdoc-cards cs-cards"><div class="wrdoc-card"><p class="k">현행 월 관리비</p><p class="v">3,773,000<small> 원</small></p></div><div class="wrdoc-card"><p class="k">예상 축소 작업량</p><p class="v">≈0.5<small> 개 층/일 1h</small></p></div><div class="wrdoc-card"><p class="k">1시간 상당액</p><p class="v">471,625<small> 원</small></p></div></div>',
        '<p class="wrdoc-note" style="margin:8px 0 0;">* 대형 플랜트박스는 <b>크기가 제각각</b>이라 단순 개수 비례가 어려워, 실제 작업량 기준 <b>약 0.5개 층(일 1시간)으로 보수적으로 산정</b>했습니다. · 1시간 상당 관리비 = 3,773,000원 ÷ 8시간 = 471,625원</p>',
        '<p class="cs-bt">운영 시 함께 고려가 필요한 사항</p>',
        '<div class="cs-key"><ul><li>리모델링 이후 소규모 화분이 추가되는 경우에도 <b>별도의 관리비 조정 없이 유연하게 대응</b>하고자 합니다.</li><li>일정 범위 내의 식재 증감은 별도 비용 조정 없이 운영하고, <b>실제 관리 공수에 영향을 주는 규모의 변동</b>이 발생하는 경우 관리비를 조정하는 방식이 양측 모두 효율적이라고 판단합니다.</li></ul></div>',
        '<p class="cs-bt">관리비 조정 제안</p>',
        '<div class="cs-opts"><div class="cs-opt"><p class="ot">1안 · 9월 적용</p><h4>9월 현행 관리비 유지</h4><p class="amt">3,773,000<small>원 유지</small></p><p class="amtsub">현행 유지</p><p class="d">9월은 리모델링·식재 이동·삭제가 계속 진행되는 과도기이며 4개 층을 모두 관리 중이므로 현행 관리비를 유지합니다. 안정화 이후 <b>10~11월 중 최종 협의</b>합니다.</p></div><div class="cs-opt rec"><p class="ot">2안 · 확정 조정</p><h4>관리 공수 확정 후 조정</h4><p class="amt">3,301,000<small>원</small></p><p class="amtsub">조정액 약 472,000원 (−1시간 상당)</p><p class="d">예상 감소분 <b>1시간 상당 관리비만 반영</b>하여 월 약 3,301,000원으로 조정하는 안입니다.<br><br>다만, <b>카카오 소싱비 기준 관련(SIMS 정산 등록) 추가 논의</b>가 필요합니다.</p></div></div>',
        '<div class="wrdoc-callout" style="border-left-color:#b5822e;"><span class="lbl" style="color:#b5822e;">결론</span><p>현재로서는 <b>9월까지 기존 관리비를 유지</b>하고, 리모델링 및 식재 삭제 범위가 최종 확정된 이후 <b>실제 관리 공수를 기준으로 관리비를 조정</b>하는 방향을 우선 제안드립니다. 추가 삭제 및 이동 식재가 확정되면 최종 관리 범위를 다시 산정하여 협의드리겠습니다.</p></div>',
      '</section>',

      '<section class="wrdoc-sec"><h2><span class="wrdoc-no">07</span>최종 요약</h2>',
        '<div class="wrdoc-summary">',
          '<p class="rlabel">Executive Summary</p>',
          '<p>모빌리티 리모델링에 따라 현재 <b>9층·13층 대형조성 플랜트박스 총 12개(플랜트월 포함)</b>가 삭제될 예정입니다.</p>',
          '<p>현장 관리공수 기준(대형 1개 ≈ 기본 8개)으로 환산하면, 확정 삭제분은 기존 관리공수의 <span class="hl">약 17.9%, 약 0.72개 층</span> 수준입니다.</p>',
          '<p>추가 검토 중인 <b>기본 플랜트박스 약 32개</b>까지 삭제될 경우 총 감소율은 <span class="hl">약 23.8%, 약 0.95개 층</span>에 해당합니다.</p>',
          '<p>따라서 기본 32개까지 최종 폐기되는 경우 <b>관리공수 기준 약 1개 층 상당 감소</b>로 보는 것이 적절하며, <b>폐기 확정 후 관리비 조정 기준을 최종 협의</b>하는 것이 좋겠습니다.</p>',
        '</div>',
      '</section>',
    ].join(""),
  },
  {
    id: "wr-evac-floor-white-2026-08",
    kind: "link",
    type: "HTML",
    title: "피난안내도 · 층별 화이트 안내도",
    date: "2026-08-25",
    category: "시설 안내",
    author: "Jamie · Snack & Garden",
    summary: "7·8·9·13F 피난안내도를 화이트 톤으로 재구성한 층별 안내 도면.",
    link: "https://claude.ai/code/artifact/33a26e06-d861-456d-ba04-cab744d2bfa6"
  },
];

/* =========================================================
   드라이브 관리 폴더 (업무 보고)
   ---------------------------------------------------------
   라이브(GAS 재배포) 시 action=drivefolders 응답으로 대체됩니다.
   아래는 데모/폴백 데이터입니다. (Code.gs 의 DRIVE_FOLDERS 에
   실제 폴더 ID를 넣고 재배포하면 자동으로 채워집니다.)
   ========================================================= */
window.DRIVE_FOLDERS = [
  { name: "안전매뉴얼", url: "", count: 3, files: [
    { name: "2506 온열질환예방지침(OPS).pdf",       type: "PDF", date: "2026-07-24", url: "" },
    { name: "2506 폭염 5대 기본수칙 자율점검표.pdf", type: "PDF", date: "2026-07-24", url: "" },
    { name: "2508 소화기-점검-및-사용방법.pdf",      type: "PDF", date: "2026-07-24", url: "" }
  ] },
  { name: "교육 자료", url: "", count: 2, files: [
    { name: "2508 신규 크루 온보딩 교육.pptx",  type: "PPT", date: "2026-08-05", url: "" },
    { name: "2507 식물 병해충 관리 가이드.pdf", type: "PDF", date: "2026-07-30", url: "" }
  ] }
];
