-- =========================================================
-- 면담일지 Supabase 미러 스키마
-- 실행: Supabase 대시보드 > SQL Editor 에 붙여넣고 Run
-- ---------------------------------------------------------
-- 이 테이블들은 "구글시트(마스터, 다른 분들이 편집)"를 GAS가
-- 읽기 전용으로 복제(mirror)해 넣는 하류 저장소입니다.
-- 앱은 GAS 프록시(service_role 키 보유)를 통해서만 읽습니다.
-- RLS 전면 차단 → anon/authenticated(공개 키)로는 한 줄도 못 읽습니다.
-- service_role(GAS Script Property) 만 RLS 를 우회합니다.
-- =========================================================

-- 면담일지 행: 시트 표기가 불규칙해서 행을 파싱하지 않고 통째 JSONB 로 보관
create table if not exists public.journal_entries (
  id         bigint generated always as identity primary key,
  team       text        not null,               -- 스낵 / 가든 / 총무지원
  sheet_id   text        not null,               -- 원본 스프레드시트 ID
  tab_name   text        not null,               -- 탭 이름(= 크루 닉네임)
  gid        bigint,                             -- 탭 gid(시트 딥링크용)
  row_index  int         not null,               -- 탭 내 순서
  data       jsonb       not null,               -- {일자, 구분, 세부구분, 내용, 면담자, ...}
  row_hash   text,                               -- 변경 감지/디버그용
  synced_at  timestamptz not null default now(), -- 이번 동기화 시각(스테일 정리 기준)
  unique (sheet_id, tab_name, row_index)
);

create index if not exists idx_journal_entries_lookup on public.journal_entries (sheet_id, tab_name, row_index);
create index if not exists idx_journal_entries_synced on public.journal_entries (synced_at);

-- 시트 메타(팀 · 제목) — 앱의 시트 링크/제목 표기에 사용
create table if not exists public.journal_sheets (
  sheet_id   text        primary key,
  team       text        not null,
  title      text,
  synced_at  timestamptz not null default now()
);

-- =========================================================
-- 범용 앱 데이터 저장소 (단계적 시트→Supabase 이전용)
-- 크루·일정·근태 등 앱이 직접 쓰는 데이터를 coll(컬렉션)별로 보관.
-- data(jsonb) = 시트 한 행과 동일한 {필드:값} 객체 → 앱 계약 그대로 유지.
-- =========================================================
create table if not exists public.app_rows (
  coll       text        not null,               -- crew / schedule / attendance ...
  id         text        not null,               -- 레코드 id
  data       jsonb       not null,               -- 시트 한 행과 동일한 객체
  ord        double precision not null default (extract(epoch from now()) * 1000), -- 정렬(시트 순서 보존)
  updated_at timestamptz not null default now(),
  primary key (coll, id)
);
create index if not exists idx_app_rows_coll on public.app_rows (coll, ord);

alter table public.app_rows enable row level security;  -- 공개 키 접근 전면 차단(service_role 만)

-- ---- RLS: 전면 차단 (정책 없음 = 공개 키로 접근 불가) ----
alter table public.journal_entries enable row level security;
alter table public.journal_sheets  enable row level security;
-- 일부러 어떤 policy 도 만들지 않습니다.
-- => anon/authenticated 는 select/insert/update/delete 모두 거부됩니다.
-- => GAS 가 쓰는 service_role 키는 RLS 를 우회하므로 동기화/읽기 정상 동작합니다.
