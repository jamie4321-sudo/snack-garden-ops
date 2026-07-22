# 구글시트 연동 가이드 (5단계)

정적 사이트 → **Apps Script 웹앱** → **Google 시트** 구조입니다.
아래대로 하면 크루·일정을 시트에서 관리하고, 앱에서 등록하면 시트에 저장됩니다.

## 1. 시트 만들기
[sheets.new](https://sheets.new) 로 새 Google 시트를 하나 만듭니다. (탭은 그대로 둬도 됩니다 — 자동 생성됨)

## 2. 스크립트 붙여넣기
시트 상단 메뉴 **확장 프로그램 → Apps Script** →
편집기의 기존 코드를 지우고 `gas/Code.gs` 내용을 **전부 복사해 붙여넣기** → 저장(💾).

## 3. 데모 데이터 채우기 (처음 한 번)
편집기 상단 함수 선택 목록에서 **`seed`** 선택 → **실행(▶)**.
권한 요청이 뜨면 본인 계정으로 승인하세요.
→ `crew`(9명), `schedule`(7월 일정) 탭이 지금 화면과 동일하게 채워집니다.

## 4. 웹앱으로 배포
**배포 → 새 배포 → 유형: 웹 앱**
- 설명: `snack-garden-ops`
- **실행 계정: 나**
- **액세스 권한: 모든 사용자**

→ 배포하면 나오는 **웹 앱 URL**(`.../exec` 로 끝남)을 복사합니다.

## 5. 앱에 URL 연결
`js/config.js` 를 열어 붙여넣기:
```js
window.CONFIG = {
  endpoint: "https://script.google.com/macros/s/여기에_복사한_URL/exec"
};
```
저장 후 새로고침 → 좌측 하단 배지가 **`LIVE · 구글시트 연동`** 으로 바뀌면 완료입니다.

---

## 이후 사용법
- **크루 추가/수정** : 시트 `crew` 탭에서 직접 행을 편집 (헤더 순서 유지)
- **일정 추가** : 앱의 `+ 일정 등록` 버튼 → 시트 `schedule` 탭에 자동 저장
- **완료 표시** : `schedule` 탭 `done` 칸에 `완료` 입력
- **링크** : `schedule`/이슈에 URL 이 있으면 앱에서 `🔗` 버튼 자동 생성

## 시트 컬럼
```
crew     : name | role | team | group | status | joinDate | phone | site | duties | note
           group = 스낵 | 가든 | 총무지원  /  status = 재직 | 휴직 | 퇴사  /  duties = 콤마로 구분
schedule : date(YYYY-MM-DD) | time(HH:MM) | title | category | done | assignee | link
```

## 문제 해결
- 배지가 계속 `DEMO` → `config.js` endpoint 오타 / 저장 후 새로고침 확인
- 데이터가 비어 보임 → 3단계 `seed()` 실행 여부 확인
- 저장이 안 됨 → 4단계 **액세스 권한 = 모든 사용자** 인지 확인 (재배포 시 "새 버전")
