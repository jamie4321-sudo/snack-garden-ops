/* =========================================================
   연동 설정
   ---------------------------------------------------------
   endpoint 를 비워두면 → 데모 모드 (js/data.js 목업 사용)
   Apps Script 웹앱 배포 후 나오는 /exec URL 을 붙여넣으면
   → 라이브 모드 (구글시트에서 크루·일정 로드 + 등록 시 시트 저장)

   예) endpoint: "https://script.google.com/macros/s/AKfyc.../exec"
   ========================================================= */
window.CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfycbxNV7X2fDwkEB3yXnbrXfkm6y-0kChB0uLzMBUx2jKEfG61QcJXDVujQiSN8V4eOYHX/exec",

  /* ---------- 관리자 로그인 ----------
     아이디/비밀번호는 평문 대신 SHA-256 해시로 저장합니다.
     (정적 사이트라 완전한 보안은 아니며, 링크를 아는 사람이 그냥
      들어오는 것을 막는 관리자 게이트 수준입니다.)

     기본값 → 아이디: jamie / 비밀번호: 4231

     ▶ 바꾸는 방법
       1) 아래 값을 새 아이디/비밀번호로 정하고
       2) 브라우저 콘솔(F12)에 붙여넣어 해시를 뽑습니다:
          const enc=new TextEncoder();
          async function sha(s){const b=await crypto.subtle.digest('SHA-256',enc.encode(s));
            return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');}
          sha('새아이디').then(console.log); sha('새비밀번호').then(console.log);
       3) 나온 두 해시를 idHash / pwHash 에 넣으면 됩니다.               */
  auth: {
    idHash: "e7a4477ec945697c1003e467ec7b8fc2c485d90453882a203c08956d377d8cbd", // jamie
    pwHash: "bba155c5f227c6e52a8b2707a13e817137cbac50806b4822f99bbf0778c3f8fd"  // 4231
  },

  /* ---------- 비밀번호 HUB 게이트 ----------
     비밀번호 HUB(자격증명 게시판)에 들어갈 때 "한 번 더" 물어보는 비밀번호.
     pwHash 를 비워두면 → 위 관리자 로그인 비밀번호(auth.pwHash)를 그대로 사용합니다.
     별도 비밀번호를 쓰려면 위 안내대로 SHA-256 해시를 뽑아 pwHash 에 넣으세요.       */
  vault: {
    pwHash: ""   // 비우면 관리자 로그인 비밀번호(4231)로 진입
  },

  journalSheetUrl: "https://docs.google.com/spreadsheets/d/1oF0GK7OLod7YKg84ypJ95irHeSRbvZQXnP0qXJi_Zgc/edit"
};
