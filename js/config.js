/* =========================================================
   연동 설정
   ---------------------------------------------------------
   endpoint 를 비워두면 → 데모 모드 (js/data.js 목업 사용)
   Apps Script 웹앱 배포 후 나오는 /exec URL 을 붙여넣으면
   → 라이브 모드 (구글시트에서 크루·일정 로드 + 등록 시 시트 저장)

   예) endpoint: "https://script.google.com/macros/s/AKfyc.../exec"
   ========================================================= */
window.CONFIG = {
  endpoint: "https://script.google.com/macros/s/AKfycbxNV7X2fDwkEB3yXnbrXfkm6y-0kChB0uLzMBUx2jKEfG61QcJXDVujQiSN8V4eOYHX/exec"
};
