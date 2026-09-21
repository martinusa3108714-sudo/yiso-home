# YISO INTERIOR CMS 설치 및 운영 안내

이 버전은 기존 홈페이지 디자인을 유지하면서 프로젝트 데이터만 Supabase로 관리합니다. 최초 연결과 데이터 이전을 한 번 완료한 뒤에는 `/admin`에서 프로젝트를 등록·수정·삭제하면 재배포 없이 홈페이지에 반영됩니다.

## 1. Supabase 프로젝트 준비

1. Supabase에서 새 프로젝트를 만듭니다.
2. `SQL Editor`에서 [`supabase/schema.sql`](./supabase/schema.sql) 전체를 실행합니다.
3. `Authentication → Users`에 관리자 UID `a38f37f4-f7a8-4769-9ced-59d5babc31a9`가 존재하는지 확인합니다.
4. 이 UID의 관리자 등록문은 `schema.sql` 끝부분에 이미 포함돼 있으므로 별도 입력할 필요가 없습니다.

스키마는 다음 보안 규칙을 함께 설정합니다.

- 일반 방문자: 공개 프로젝트와 그 이미지 정보만 읽기 가능
- 관리자: `admin_users`에 등록된 로그인 사용자만 등록·수정·삭제 가능
- Storage: WebP만 업로드 가능하며 관리자만 업로드·교체·삭제 가능
- HOME 대표 프로젝트: 공개 프로젝트 중 최대 3개, 표시 순서 1~3만 허용
- 프로젝트 삭제: 연결된 `project_images` 행은 자동 삭제

## 2. 공개 연결 정보

이 완성본에는 다음 두 공개 연결값이 이미 `config.js`에 입력돼 있습니다.

- Project URL: `https://oiubuaanvszkqgwkgveo.supabase.co`
- Publishable key: 제공받은 `sb_publishable_...` 키

따라서 루트의 [`config.js`](./config.js)를 추가로 수정하지 않습니다.

```js
window.YISO_CMS_CONFIG = Object.freeze({
  supabaseUrl: "https://oiubuaanvszkqgwkgveo.supabase.co",
  supabasePublishableKey: "sb_publishable_K0SmFxPc4rYXz8h2A-srRw_xiZfO7GH",
  storageBucket: "projects",
  imageMaxLongEdge: 2560,
  imageWebpQuality: 0.86
});
```

`Secret key`, `service_role key`, 관리자 비밀번호는 `config.js`나 GitHub 저장소에 넣지 않습니다. 이 사이트에는 서버 전용 키가 필요하지 않습니다.

## 3. GitHub Pages에 한 번 배포

이 폴더 전체를 현재 GitHub Pages 저장소에 반영합니다. 기존 커스텀 도메인과 Pages 설정은 그대로 사용합니다.

- 일반 홈페이지: 기존 주소
- 관리자: `https://기존도메인/admin/`
- 동적 상세페이지: `project.html?slug=프로젝트-slug`
- 기존 상세페이지 주소: 새 동적 상세페이지로 자동 이동

## 4. 기존 31개 프로젝트 이전

1. `/admin/`에 접속해 위에서 만든 관리자 계정으로 로그인합니다.
2. `기존 프로젝트 가져오기`를 누릅니다.
3. `가져오기 시작`을 누르고 완료 문구가 나올 때까지 창을 유지합니다.

브라우저가 현재 사이트의 324개 프로젝트 이미지를 읽고, 각 이미지를 긴 변 최대 2560px·WebP 품질 86%로 변환한 다음 변환본만 Storage에 업로드합니다. 원본 JPG/PNG는 Supabase로 전송되지 않습니다.

모든 프로젝트가 확인된 뒤에만 `site_settings.cms_ready`가 `true`로 변경됩니다. 이전 도중 네트워크가 끊기면 홈페이지는 기존 로컬 데이터로 계속 표시되고, 다시 실행하면 이미 등록된 slug는 건너뜁니다.

## 5. 평소 프로젝트 등록 방법

1. `/admin/` 로그인
2. `+ NEW PROJECT`
3. 프로젝트 정보와 BUILT/CONCEPT 선택
4. JPG·PNG·WebP 여러 장 선택
5. 썸네일을 끌어 상세 이미지 순서 변경
6. `대표 설정`으로 대표 이미지 선택
7. 공개 여부, HOME 대표 여부와 순서 선택
8. `프로젝트 저장`

사진은 선택 즉시 브라우저에서 WebP로 변환됩니다. PC에서는 Drag & Drop을 사용하고, 모바일에서는 각 이미지의 `←`, `→` 버튼으로 순서를 바꿀 수 있습니다.

## 6. 삭제와 비공개

- `비공개`: Database와 Storage에는 남지만 일반 PROJECT/HOME/상세페이지에서 조회되지 않습니다.
- `삭제`: 프로젝트명을 포함한 확인 팝업을 거친 뒤 Database 행과 연결된 Storage 이미지를 함께 정리합니다.

실수로 삭제한 데이터의 휴지통 기능은 포함하지 않았습니다. 보존이 필요하면 삭제 대신 비공개를 사용하세요.

## 7. 배포 후 확인

SQL Editor에서 [`supabase/verify.sql`](./supabase/verify.sql)을 실행하면 전체 프로젝트 수, BUILT/CONCEPT 수, HOME 3개 제한, 이미지 수와 순서, Storage 설정을 확인할 수 있습니다.

권장 확인 순서:

1. 로그아웃 상태에서 `/admin/` 대시보드에 접근할 수 없는지 확인
2. 테스트용 비공개 프로젝트 등록
3. JPG/PNG 업로드 후 Storage에 `.webp`만 생성됐는지 확인
4. 공개 전환 후 PROJECT와 상세페이지 확인
5. HOME 대표 지정과 1~3 순서 확인
6. 이미지·프로젝트 Drag & Drop 순서 확인
7. 수정 후 새로고침해 데이터 유지 확인
8. 삭제 확인 팝업과 Storage 정리 확인

## 8. 파일 정리 원칙

기존 프로젝트별 HTML은 이전 주소 호환을 위한 작은 이동 페이지로 바뀌었습니다. 기존 로컬 이미지는 최초 이전 소스이자 Supabase 장애 시 읽기 전용 fallback이므로 현재 버전에서는 삭제하지 않았습니다. 더 이상 사용하지 않던 `project-detail.js`는 제거했습니다.

Supabase 이전과 운영 검증이 끝난 뒤 fallback까지 제거하기로 결정한 경우에만 로컬 이미지를 별도로 정리해야 합니다. 확인 없이 이미지 폴더를 먼저 삭제하면 최초 이전과 장애 fallback이 깨집니다.

## 공식 참고 문서

- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API 키: https://supabase.com/docs/guides/api/api-keys
- Storage 접근 제어: https://supabase.com/docs/guides/storage/security/access-control
- 이메일/비밀번호 로그인: https://supabase.com/docs/reference/javascript/auth-signinwithpassword
