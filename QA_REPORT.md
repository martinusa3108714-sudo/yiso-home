# YISO INTERIOR CMS 검수 기록

검수 기준일: 2026-09-21

## 로컬 자동 검수 대상

- 기존 공개 페이지와 링크
- 31개 프로젝트 seed 데이터와 324개 상세 이미지
- BUILT 16개 / CONCEPT 15개 구분
- HOME 대표 프로젝트 3개
- 동적 PROJECT 목록 및 상세페이지 모듈
- 관리자 로그인·CRUD·정렬·이미지 최적화 코드
- Supabase schema, RLS, Storage policy
- PC·모바일 관리자 반응형 CSS
- JavaScript 문법과 ZIP 무결성

## 로컬 자동 검수 결과

- `tools/validate-site.mjs`: 1,022개 검사 통과 / 실패 0
- 프로젝트 seed: 31개 정상
- 프로젝트 구분: BUILT 16개 / CONCEPT 15개
- 상세 이미지: 324개 로컬 원본 경로 정상
- HOME 대표: 유니온 스퀘어 / 스파 더 스페이스 / 금샘도서관, 순서 1~3 정상
- 기존 프로젝트 URL 31개: 동적 상세페이지 리다이렉트 정상
- 공개 CMS seed fallback: 31개 프로젝트와 324개 이미지 정규화 정상
- 관리자 ES Module: import/export 연결 정상
- JavaScript/MJS 문법 검사: 통과
- 로컬 HTTP 응답: HOME / PROJECT / 동적 상세 / ADMIN 정상
- Secret/Service Role 키 패턴: 공개 설정 파일에 없음

현재 실행 환경에는 Playwright 브라우저 실행 파일이 없어 픽셀 기반 PC·모바일 캡처 자동화는 실행할 수 없었습니다. 대신 기존 사이트의 반응형 CSS를 유지하고, 관리자 화면은 900px·680px 미디어 쿼리와 모바일용 순서 이동 버튼을 별도로 적용했습니다.

## 실제 Supabase 연결 후 확인해야 하는 항목

아래 항목은 Supabase Project URL, Publishable Key, 관리자 Auth 사용자가 연결된 배포 환경에서 확인합니다.

- 관리자 로그인과 비관리자 차단
- RLS의 익명 읽기·관리자 쓰기 정책
- 실제 Database 등록·수정·삭제
- 실제 Storage 업로드·삭제
- 브라우저 WebP 변환 결과와 원본 미업로드
- 세션 만료와 네트워크 오류 메시지
- 최초 31개 프로젝트 이전 완료
- GitHub Pages 커스텀 도메인의 실제 반영

실운영 DB 스키마와 데이터 없이 성공했다고 가정하지 않으며, 설치 후 [`CMS_SETUP.md`](./CMS_SETUP.md)의 배포 후 확인 순서와 [`supabase/verify.sql`](./supabase/verify.sql)로 최종 확인합니다.

## 제공된 Supabase 연결값 확인

- Project URL 접속: 정상
- Publishable Key 요청: Supabase API 응답 수신
- 현재 응답: `public.site_settings` 테이블 미생성
- 판단: 연결값은 적용됐으며, Supabase SQL Editor에서 `supabase/schema.sql` 전체 실행이 필요함
- 관리자 UID: `schema.sql`의 `admin_users` 등록문에 반영 완료
