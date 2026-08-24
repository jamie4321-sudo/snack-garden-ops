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
