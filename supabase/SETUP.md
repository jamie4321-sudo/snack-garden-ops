# 면담일지 → Supabase 미러 셋업 (GAS 프록시 방식)

구글시트(마스터, 다른 분들이 편집)는 **읽기만** 하고, 그 내용을 Supabase에 복제해
앱이 GAS 프록시를 통해 Supabase에서 읽도록 전환합니다. **시트로 쓰는 동작은 없습니다.**

```
스낵/가든/총무지원 시트 (원본, 편집 계속)
   └─ GAS 가 getValues 로 읽기만 ─→ Supabase.journal_entries (RLS 전면 차단)
                                         └─ GAS 프록시(service_role) ─→ 앱
```

프로젝트: `https://wxzuexxfktykmhcmrnvh.supabase.co`

---

## 1) 테이블 생성
Supabase 대시보드 → **SQL Editor** → [`supabase/schema.sql`](schema.sql) 내용 붙여넣고 **Run**.
→ `journal_entries`, `journal_sheets` 두 테이블 생성 + RLS 전면 차단.

## 2) service_role 키 확보
Supabase 대시보드 → **Project Settings → API** →
- **Project URL**: `https://wxzuexxfktykmhcmrnvh.supabase.co`
- **service_role** 키 복사 (⚠️ **secret** — 절대 공개·repo·프론트에 넣지 말 것)

## 3) GAS 스크립트 속성 등록 (키를 안전하게 넣는 곳)
Apps Script 편집기 → **프로젝트 설정(⚙️) → 스크립트 속성 → 속성 추가**:

| 속성 | 값 |
|---|---|
| `SUPABASE_URL` | `https://wxzuexxfktykmhcmrnvh.supabase.co` |
| `SUPABASE_SERVICE_KEY` | (2번에서 복사한 service_role 키) |

> service_role 키는 여기(Google 서버측 스크립트 속성)에만 저장됩니다.
> 저장소(Code.gs/Supabase.gs)나 프론트엔드 어디에도 키가 들어가지 않습니다.

## 4) GAS 코드 반영
Apps Script 편집기에서:
- [`gas/Supabase.gs`](../gas/Supabase.gs) 내용을 **새 파일(파일 + → 스크립트, 이름 `Supabase`)** 로 추가
- [`gas/Code.gs`](../gas/Code.gs) 의 `?action=journal` 라우트 한 줄이
  `getJournalFromSupabase_()` 로 바뀐 것 반영 (해당 줄만 교체하거나 Code.gs 전체 붙여넣기)
- **저장(Ctrl+S)**  ※ 저장 ≠ 배포

## 5) 첫 동기화 + 트리거
편집기 상단 함수 선택 후 **실행**:
1. `syncJournalToSupabase` — 첫 미러링 (처음엔 권한 승인 팝업: 고급 → 이동 → 허용)
2. `installJournalSyncTrigger` — 매일 04:00(KST) 자동 동기화 트리거 설치
3. `journalSupabaseSelfTest` — 로그(보기 → 실행 로그)에 `source=supabase · tabs=.. · rows=..` 확인

## 6) 배포
**배포 → 배포 관리 → 기존 배포 수정 → 새 버전으로 배포** (URL 유지).
→ 이제 앱의 `?action=journal` 이 Supabase 미러를 읽습니다.

---

## 동작·안전 요약
- **시트 불변**: `getJournalData_()`(읽기 전용)만 사용. 시트 쓰기 API 호출 없음.
- **삭제 반영**: 동기화는 업서트 후 "이번 실행에 없던 행/탭 삭제" → 시트에서 지운 행·탭도 정확히 반영.
- **민감정보 보호**: RLS 정책이 하나도 없어 공개(anon) 키로는 한 줄도 못 읽음. GAS의 service_role 만 접근.
- **안전 폴백**: 스크립트 속성 미설정이거나 Supabase 오류 시 `getJournalFromSupabase_()` 가 자동으로 시트 직접 읽기로 되돌아감 → 셋업 도중에도 화면은 정상.
- **롤백**: 문제가 생기면 Code.gs 의 그 한 줄을 `getJournalData_()` 로 되돌리고 재배포하면 원상복구.

## 조정
- 동기화 주기 변경: `installJournalSyncTrigger` 의 `.everyDays(1).atHour(4)` 수정 후 재실행.
- 수동 즉시 동기화: 편집기에서 `syncJournalToSupabase` 실행(또는 앱에 버튼 추가 가능).
