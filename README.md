# Papershelf

기존 픽셀 폰트·오로라 배경·Markdown 편집기를 유지한 GitHub Pages + Supabase 개인 블로그입니다.
방문자는 발행된 글만 읽고, 지정한 **한 명의 관리자**만 글·토픽·사진을 작성합니다.

## 배포 설정

새 Supabase 프로젝트 `shpiczkprbylbhtomynw`에 DB와 비공개 사진 버킷을 구성했습니다. 기존 GPT Sites와 이전 프로젝트는 변경하지 않습니다.

1. Supabase Auth → URL Configuration의 Redirect URLs에 `https://woo2201.github.io/papershelf/`를 추가하고, Site URL도 이 주소로 설정합니다.
2. Supabase Auth의 **Confirm email**을 활성화합니다. 배포 전 GitHub Actions가 실제 공개 Auth 설정을 읽어 이메일 인증이 필수인지 확인합니다.
3. 지정한 관리자 이메일은 DB의 비공개 `papershelf_private.owner_bootstrap`에 등록합니다. 첫 이메일 인증이 완료되면 Auth 사용자의 UUID가 관리자에 연결됩니다. 브라우저가 보낸 이메일이나 user_metadata로 권한을 부여하지 않습니다. 기존 관리자 행은 자동 교체하지 않습니다.
4. GitHub → Settings → Pages → Build and deployment → Source를 **GitHub Actions**로 설정합니다.
5. `main` 변경 시 테스트 후 자동 배포합니다. Actions의 Deploy Papershelf 결과에서 실제 배포 주소를 확인합니다.

비밀 키 또는 service_role 키는 필요하지 않습니다. `assets/js/blog-client.js`의 publishable key는 공개용이며 실제 접근 제어는 DB와 Storage의 RLS가 담당합니다.

다른 프로젝트에 새로 설치하려면 [`supabase/setup.sql`](supabase/setup.sql)을 한 번 실행하고, 관리자 이메일을 비공개 테이블에 등록합니다. 기존 프로젝트에는 같은 스키마를 다시 적용하지 마세요. 최초 마이그레이션은 Supabase에 `papershelf_public_blog` 이름으로 기록되어 있습니다.

## 사용 방법

- 방문자: 로그인 없이 발행 글 열람, 토픽 필터, 검색, `?post=글ID` 주소 공유.
- 관리자: LOGIN → 이메일 링크를 같은 브라우저에서 열기 → New Entry.
- 새 글은 기본적으로 **초안**입니다. `공개 발행`을 선택하고 저장해야 방문자에게 보입니다. 해제하고 저장하면 비공개로 돌아갑니다.
- 저장 충돌 시 작성 내용은 편집기에 남습니다. `초안 백업` 후 `최신본 다시 열기`로 해결합니다. 자동 덮어쓰기나 자동 병합은 하지 않습니다.
- 토픽 수정은 관련 글 수정과 하나의 트랜잭션으로 저장됩니다. 하나라도 충돌하면 전체가 취소됩니다.
- ACCOUNT → `브라우저 기록 가져오기`: **현재 주소**의 localStorage/IndexedDB 기록을 복사합니다. 다른 주소의 브라우저 저장소에는 접근할 수 없으므로 기존 Sites에서 BACKUP 후 새 블로그에서 IMPORT를 사용하세요.
- 가져온 기록은 모두 초안이며 원본을 삭제하지 않습니다. 같은 내용을 반복 가져오면 중복되지 않습니다. 원본 내용이 달라졌다면 별도 초안으로 복사합니다.
- BACKUP에는 초안과 사진이 포함됩니다. 백업 파일을 공개 저장소에 올리지 마세요.

## 데이터와 권한

- `papershelf_posts`: 글마다 한 행, JSON 내용 + 발행 상태 + 버전. RLS는 발행 글 공개 읽기, 지정 관리자만 쓰기를 허용합니다.
- `papershelf_blog_settings`: 관리자 UUID와 토픽 목록. 관리자 본인만 읽고 토픽을 수정할 수 있으며, 클라이언트는 소유자를 변경할 수 없습니다.
- `papershelf_blog_save`: SECURITY INVOKER RPC. 예상 버전을 확인하고 충돌 시 `40001`을 반환합니다. 글/토픽 변경은 원자적으로 처리됩니다.
- `papershelf-blog-photos`: 비공개 버킷. 발행 글에 연결된 사진만 익명 읽기가 허용됩니다. 미발행 사진은 관리자만 읽습니다. 불변 사진 업로드로 다른 기기의 초안을 보호합니다.
- 원본 사진 버킷과 아카이브의 기존 권한은 변경하지 않습니다. 적용 시 프로젝트의 기존 Storage 정책이 새 버킷에 포괄 권한을 부여하지 않는지도 점검해야 합니다.
- 공개된 글/사진을 독자가 이미 다운로드하거나 브라우저에 캐시했다면 발행 취소로 그 사본까지 회수할 수는 없습니다.
- 사용자 세션은 SDK가 브라우저에 보관하고 갱신합니다. 계정 전환/로그아웃 시 편집 내용과 사진 URL을 비웁니다.

## 개발과 검증

```sh
npm ci
npx playwright install chromium
npm test
python3 -m http.server 8000
```

개발 로그인에는 `http://localhost:8000/`를 Supabase Redirect URLs에 추가해야 합니다. GitHub Actions 테스트는 네트워크를 모의하므로 실제 계정/이메일을 사용하지 않습니다.

- `tests/database.cjs`: PGlite의 실제 PostgreSQL 엔진에서 SQL을 적용해 RLS, 다른 계정의 쓰기 차단, 초안/사진 비공개, 발행 취소, 버전 충돌과 트랜잭션 롤백을 검증합니다. Auth/Storage 기본 스키마는 테스트용 대체물입니다.
- `tests/browser.cjs`: Chromium에서 실제 SDK + 모의 Supabase API로 로그인 유지, 관리자/방문자 화면, 사진, 가져오기, 두 브라우저의 충돌, 모바일과 글 주소를 검증합니다.
- 새 운영 Supabase DB에서도 익명/다른 계정의 쓰기 차단을 확인했습니다. Security Advisor 경고는 없습니다. 관리자 실제 이메일 발송/인증은 본인이 로그인해 확인해야 합니다.

화면은 `index.html`, `assets/css/styles.css` 및 `assets/css/blog.css`, `assets/js/app.js`에 있고, DB/Auth 연동은 `assets/js/blog-client.js`, `assets/js/blog.js`로 분리했습니다. SDK는 2.118.0으로 고정했으며 `npm run build:sdk`로 재생성합니다.

현재 글 본문은 브라우저에서 불러옵니다. 고유 주소는 지원하지만 글별 정적 HTML/검색엔진용 메타데이터/소셜 공유 미리보기 자동 생성은 아직 포함하지 않습니다. 필요하면 추후 정적 생성 단계를 추가할 수 있습니다.
