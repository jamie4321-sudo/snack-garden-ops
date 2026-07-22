/* =========================================================
   목업 데이터 (데모 모드)
   ---------------------------------------------------------
   실제 연동 시 이 배열들이 Google 시트에서 내려온 JSON 으로
   대체됩니다. 컬럼명 = 시트 헤더명 과 1:1 로 맞춰 두었습니다.
   ========================================================= */

/* --- 크루 목록 : 시트 "crew" (헤더 = 아래 key) ---
   group : 업무 그룹 = 스낵 | 가든 | 총무지원 (아바타 색 구분) */
window.CREW = [
  { id:"c1", name:"김하이든", role:"파트리더",  team:"헤이든",   group:"총무지원", status:"재직", joinDate:"2023-03-02", phone:"010-1234-5678", site:"판교 오아시스",  duties:["운영총괄","발주"],        note:"법인카드 상신 담당" },
  { id:"c2", name:"이레오",   role:"시니어 크루", team:"레오",     group:"총무지원", status:"재직", joinDate:"2023-08-14", phone:"010-2345-6789", site:"판교 오아시스",  duties:["온보딩","일정"],          note:"31일 온보딩 진행" },
  { id:"c3", name:"박엘리",   role:"매니저",     team:"엘리",     group:"총무지원", status:"재직", joinDate:"2022-11-01", phone:"010-3456-7890", site:"카렌 현장",     duties:["교육","경조지원"],        note:"퇴사 크루·경조 대응" },
  { id:"c4", name:"최스칼렛", role:"크루",       team:"스칼렛",   group:"스낵",     status:"재직", joinDate:"2024-01-09", phone:"010-4567-8901", site:"판교 오아시스",  duties:["KEP검토","제안서"],       note:"Pay 제안서 1차" },
  { id:"c5", name:"정배라",   role:"신입 크루",  team:"배라",     group:"스낵",     status:"재직", joinDate:"2026-07-20", phone:"010-5678-9012", site:"판교 오아시스",  duties:["성수 OJT"],              note:"OJT 진행 중" },
  { id:"c6", name:"한카렌",   role:"현장 리드",  team:"카렌",     group:"가든",     status:"재직", joinDate:"2023-05-22", phone:"010-6789-0123", site:"카렌 현장",     duties:["백오피스","점검"],        note:"현장 백오피스 점검" },
  { id:"c7", name:"오미라",   role:"크루",       team:"미라",     group:"스낵",     status:"휴직", joinDate:"2024-06-03", phone:"010-7890-1234", site:"판교 오아시스",  duties:["리더 주간보고"],          note:"육아휴직 (~2026.09)" },
  { id:"c8", name:"신엔조",   role:"크루",       team:"엔조",     group:"가든",     status:"재직", joinDate:"2025-02-17", phone:"010-8901-2345", site:"판교 오아시스",  duties:["반차/근태"],             note:"7/24 오후 반차" },
  { id:"c9", name:"강아라",   role:"크루",       team:"아라",     group:"스낵",     status:"퇴사", joinDate:"2022-04-11", phone:"010-9012-3456", site:"판교 오아시스",  duties:[],                        note:"2026.06 퇴사" },
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

/* --- 상단 요약 : 시트 "summary" 또는 대시보드 카드 --- */
window.SUMMARY = {
  monthLabel: "2026년 7월",
  issues: [
    { text: "헤이든 — 팔로업 사항 : 법인카드 상신", link: "" },
    { text: "헤이든 — 안내 사항", link: "https://docs.google.com/document/d/EXAMPLE_DOC_ID/edit" },
  ],
  points: [],
};
