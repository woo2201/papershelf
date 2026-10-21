# Papershelf — GitHub Pages 배포용

현재 Papershelf 게시 버전 4를 바탕으로 만든 정적 웹사이트입니다.
별도 패키지 설치, 빌드, 서버, API 키가 필요하지 않습니다.

## 1. GitHub에 올리기

1. GitHub에서 새 저장소를 만듭니다. 예: `papershelf`.
2. 이 ZIP 파일을 PC에서 압축 해제합니다.
3. 저장소에서 **Add file → Upload files**를 선택합니다.
4. `papershelf` 폴더 자체가 아니라 **폴더 안의 내용**을 올립니다.
   저장소 첫 화면에 `index.html`과 `assets` 폴더가 보여야 합니다.
   ZIP 파일 자체를 올리면 웹사이트로 실행되지 않습니다.
5. **Commit changes**로 저장합니다.
6. **Settings → Pages → Build and deployment**로 갑니다.
7. Source에서 **Deploy from a branch**를 선택합니다.
8. Branch에서 **main**, 폴더에서 **/(root)**를 선택하고 **Save**를 누릅니다.
9. 배포가 완료되면 Pages 설정 화면에 표시되는 사이트 주소로 접속합니다.

`.nojekyll`은 정적 파일을 그대로 게시하기 위한 빈 파일입니다.
파일 탐색기에서 숨겨지거나 업로드되지 않았다면 GitHub의 Add file → Create new file로
저장소 최상위에 `.nojekyll`이라는 빈 파일을 추가하면 됩니다.

## 2. 파일 구성

- `index.html`: 화면 구조와 스타일·스크립트 연결
- `assets/css/styles.css`: 전체 디자인, 폰트·배경 등 포함된 시각 자료
- `assets/js/vendor.js`: Markdown·HTML 정리·코드 강조용 라이브러리
- `assets/js/app.js`: 기록, 검색, 필터, 편집, 백업·가져오기, 배경 효과
- `assets/js/title-animation.js`: 제목 애니메이션
- `.nojekyll`: 정적 배포 설정
- `THIRD_PARTY_NOTICES.md`: 외부 라이브러리와 라이선스 안내

이미지·폰트 등 원본 HTML에 포함되어 있던 자료는 CSS/JavaScript 안에 그대로 보존했습니다.
리소스 경로는 상대 경로여서 저장소 이름이 달라도 사용할 수 있습니다.
수정 후 같은 파일을 GitHub에서 교체하고 커밋하면 다시 배포됩니다.

## 3. 기존 기록과 사진 옮기기

1. 기존 Sites의 Papershelf에서 **BACKUP**을 눌러 JSON 파일을 다운로드합니다.
2. GitHub Pages의 새 Papershelf에서 **IMPORT**를 누릅니다.
3. 위 JSON 파일을 선택하고 가져오기를 확인합니다.
4. 기록과 사진이 정상 표시되는지 확인합니다.

이 ZIP에는 브라우저에 따로 저장된 개인 기록·사진이 들어 있지 않습니다.
원본에 포함된 예시 콘텐츠는 들어 있습니다.
기존 Sites 주소와 GitHub Pages 주소는 저장 공간이 달라 자동 이전되지 않습니다.

## 4. 저장 방식

기록은 사용하는 브라우저의 localStorage, 사진은 IndexedDB에 저장됩니다.
다른 PC·브라우저·휴대폰과 자동 동기화되지 않습니다.
브라우저 사이트 데이터를 지우기 전에 BACKUP으로 백업해 두세요.
GitHub Pages로 옮겨도 이 저장 방식은 동일합니다.
Sites의 ChatGPT 접근 제한은 이 ZIP에 포함되지 않습니다.
GitHub Pages에 게시한 화면과 소스는 방문자에게 공개될 수 있습니다.
방문자의 브라우저에 저장된 기록은 GitHub에 자동 업로드되지 않습니다.

## 5. PC에서 미리 확인하기 (선택)

압축 해제한 폴더에서 `index.html`을 열어 확인할 수 있습니다.
보다 실제 배포와 비슷하게 확인하려면 Python 설치 환경에서 이 폴더를 터미널로 열고:

```bash
python -m http.server 8000
```

브라우저에서 `http://localhost:8000`을 엽니다. 종료는 Ctrl+C입니다.
로컬 확인 중 작성한 기록도 GitHub Pages로 자동 이전되지 않습니다.

## 공식 안내

- https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
