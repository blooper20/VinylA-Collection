-- 에디션 시각 표현 (2026-07-31)
--
-- 배경: EDITION_LABEL만으로는 "컬러반"이라고 적어도 그게 무슨 색인지,
-- 그걸 앨범 커버에 보여줄지를 표현할 수 없었다. 실물 컬렉션에서 컬러반은
-- 재킷이 아니라 "디스크 자체"가 다르고, 한정반/사인반 같은 건 재킷에 붙은
-- 하이프 스티커로 구분된다. 이 두 가지는 서로 독립이라("한정반이면서 스플래터반")
-- 따로 저장하고, 스티커는 EDITION_TAG에만 붙는다.
--
--   EDITION_COLOR     : 실물 디스크 바탕색(hex). 값이 있으면 커버에 미니 레코드
--                       칩으로, 상세·호버에서는 실제 디스크 색으로 드러난다.
--   EDITION_COLOR_ALT : 두 번째 색(hex). 스플래터반의 튄 색, 마블반의 섞인
--                       색처럼 두 색으로 이루어진 실물을 위한 것.
--                       스플래터에서 NULL = 여러 색이 섞여 튄 기본 형태,
--                       마블에서 NULL = 바탕색에서 파생한 톤.
--   EDITION_SPLATTER_FORM : 튄 물감의 형태. 실물마다 확연히 달라서 고를 수 있게
--                       한다 — streak(길고 가는 줄기) / drip(꼬리 달린 물방울) /
--                       speck(짧은 꼬리 달린 작은 점). NULL이면 streak.
--   EDITION_STYLE     : LP 종류 = 디스크 렌더링 변형(solid/clear/splatter/
--                       marbled/pictureDisc). NULL이면 특별한 디스크가 아님.
--   EDITION_TAG       : 에디션 구분(한정반/사인반/수입반 등). 재킷에 붙은 표시로
--                       나타난다. LP 종류와 서로 독립이라 "한정반이면서
--                       스플래터반"처럼 둘 다 지정할 수 있다. 'custom'이면
--                       프리셋이 아니라 EDITION_TAG_TEXT의 문구를 쓴다.
--   EDITION_TAG_TEXT  : 직접 입력한 표시 문구. 스티커가 작아 10자로 제한한다.
--   EDITION_STICKER_STYLE : 그 표시의 모양 — foil(금박 스티커) / stamp(도장).
--                       NULL이면 foil.
--   EDITION_ON_COVER  : 앨범 커버(그리드/상세)에 이 에디션을 시각적으로
--                       드러낼지 여부. false면 기존처럼 텍스트 뱃지만 표시.
--
-- 순서: 컬럼 추가만 하는 순수 추가형(additive) 마이그레이션이므로 기존
-- 코드에 영향이 없다. 다만 이 컬럼에 쓰는 코드가 배포되기 전에 먼저
-- 실행되어야 한다 — 코드가 먼저 배포되면 없는 컬럼에 INSERT하면서
-- 42703으로 저장이 실패한다. (2026-07-31 DB-001 사고의 반대 방향)
--
-- 실행: Supabase SQL Editor에서 이 파일 전체를 실행

alter table public."USER_VINYL"
  add column if not exists "EDITION_COLOR" text,
  add column if not exists "EDITION_COLOR_ALT" text,
  add column if not exists "EDITION_STYLE" text,
  add column if not exists "EDITION_SPLATTER_FORM" text,
  add column if not exists "EDITION_TAG" text,
  add column if not exists "EDITION_TAG_TEXT" text,
  add column if not exists "EDITION_STICKER_STYLE" text,
  add column if not exists "EDITION_ON_COVER" boolean not null default false;

-- 두 색 컬럼은 클라이언트에서 인라인 스타일/그라디언트에 직접 들어가므로
-- DB 레벨에서 형식을 못 박아 CSS 주입 여지를 없앤다(앱에서도 동일 검증).
alter table public."USER_VINYL"
  drop constraint if exists "user_vinyl_edition_color_check";
alter table public."USER_VINYL"
  add constraint "user_vinyl_edition_color_check"
  check ("EDITION_COLOR" is null or "EDITION_COLOR" ~ '^#[0-9A-Fa-f]{6}$') not valid;

alter table public."USER_VINYL"
  drop constraint if exists "user_vinyl_edition_color_alt_check";
alter table public."USER_VINYL"
  add constraint "user_vinyl_edition_color_alt_check"
  check ("EDITION_COLOR_ALT" is null or "EDITION_COLOR_ALT" ~ '^#[0-9A-Fa-f]{6}$') not valid;

-- EDITION_STYLE도 같은 이유로 알려진 키만 허용. 프리셋을 추가할 때 이
-- 제약도 함께 갱신할 것.
alter table public."USER_VINYL"
  drop constraint if exists "user_vinyl_edition_style_check";
alter table public."USER_VINYL"
  add constraint "user_vinyl_edition_style_check"
  check ("EDITION_STYLE" is null or "EDITION_STYLE" in ('solid','clear','splatter','marbled','pictureDisc')) not valid;

alter table public."USER_VINYL"
  drop constraint if exists "user_vinyl_edition_splatter_form_check";
alter table public."USER_VINYL"
  add constraint "user_vinyl_edition_splatter_form_check"
  check ("EDITION_SPLATTER_FORM" is null or "EDITION_SPLATTER_FORM" in ('streak','drip','speck')) not valid;

alter table public."USER_VINYL"
  drop constraint if exists "user_vinyl_edition_tag_check";
alter table public."USER_VINYL"
  add constraint "user_vinyl_edition_tag_check"
  check ("EDITION_TAG" is null or "EDITION_TAG" in
    ('limited','reissue','originalPressing','deluxeBoxSet','signed','import','domestic','heavyweight180g','custom')) not valid;

-- 직접 입력 문구는 스티커 안에 들어가야 하므로 DB에서도 길이를 못 박는다.
alter table public."USER_VINYL"
  drop constraint if exists "user_vinyl_edition_tag_text_check";
alter table public."USER_VINYL"
  add constraint "user_vinyl_edition_tag_text_check"
  check ("EDITION_TAG_TEXT" is null or char_length("EDITION_TAG_TEXT") between 1 and 10) not valid;

alter table public."USER_VINYL"
  drop constraint if exists "user_vinyl_edition_sticker_style_check";
alter table public."USER_VINYL"
  add constraint "user_vinyl_edition_sticker_style_check"
  check ("EDITION_STICKER_STYLE" is null or "EDITION_STICKER_STYLE" in ('foil','stamp')) not valid;
