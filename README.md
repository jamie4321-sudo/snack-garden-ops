# 🥗 SNACK & GARDEN — 운영관리 시스템

스낵앤가든 팀리더용 **크루 관리 · 일정 관리** 대시보드입니다.
블랙 + 카카오 옐로우 디자인, GitHub Pages 정적 배포 + Google 시트 연동을 목표로 합니다.

## 현재 상태 (1차 디자인)
- ✅ **일정 관리** — 주간 캘린더(이번 주/다음 주), 완료 체크, 카테고리 색상, 이달 이슈 요약 패널
- ✅ **크루 목록** — 통계 카드, 상태 필터(재직/휴직/퇴사), 검색, 담당업무 태그
- 🔜 나머지 메뉴(면담·평가·근태·KPI 등)는 좌측에 자리만 잡아둠

지금은 **데모 모드**(`js/data.js` 목업)로 동작합니다.

## 구조
```
index.html      레이아웃 · 사이드바
css/styles.css  디자인 · 반응형
js/data.js      목업 데이터 (시트 헤더와 1:1)
js/app.js       라우팅 · 렌더 (일정/크루)
gas/Code.gs     Google Apps Script 백엔드
```

## 구글시트 연동 (다음 단계)
1. 새 Google 시트 생성 → 확장프로그램 > Apps Script → `gas/Code.gs` 붙여넣기
2. 배포 > 새 배포 > 웹 앱 (실행: 나 / 액세스: 모든 사용자) → `/exec` URL 복사
3. 시트 탭 헤더는 `Code.gs` 주석대로 (`crew`, `schedule`) — 자동 생성됨
4. `js/data.js` 를 시트 fetch 로 교체 (다음 반복에서 작업 예정)

## 배포 (GitHub Pages)
이 폴더를 리포지토리 루트로 push → Settings > Pages > 브랜치 지정.
