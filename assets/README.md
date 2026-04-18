# assets/

사이트 디자인에 사용되는 **정적 에셋** 저장소. 이 폴더의 파일은 저장소에 커밋되며 브라우저가 직접 로드함.

> **비교**: `firebase/` 는 개인정보를 포함한 Firebase Console 업로드용 로컬 파일(gitignored). `assets/` 는 **디자인용 정적 자원** 으로 git 에 포함되고 GitHub Pages 로 서빙됨.

## 폴더 구조

```
assets/
├── fonts/     # 웹폰트 (.woff2 우선, .woff / .ttf 허용)
├── icons/     # SVG 아이콘 (재사용 glyph)
└── images/    # 래스터 이미지 (.png / .jpg / .webp)
```

## 권장 포맷

| 종류 | 권장 | 대안 | 참고 |
|------|------|------|------|
| 폰트 | `.woff2` | `.woff`, `.ttf` | woff2 가 평균 30% 더 작음. 라이선스 확인 필수 |
| 아이콘 | `.svg` (단색/stroke) | — | `currentColor` fill 로 만들면 CSS 로 색 제어 가능 |
| 이미지 | `.webp` | `.jpg` (사진), `.png` (투명 필요) | 용량 최적화 후 커밋 (모바일 로드 고려) |

## 참조 경로 (중요)

이 프로젝트는 두 페이지(루트 `/`, `/upload/`) 와 각 CSS 에서 서로 경로가 다릅니다.

### HTML 에서 직접 참조

- **루트 페이지** [index.html](../index.html): `assets/icons/heart.svg`
- **업로드 페이지** [upload/index.html](../upload/index.html): `../assets/icons/heart.svg`

### CSS 에서 `url()` 참조 (CSS 파일 기준 상대경로)

- **루트 CSS** [css/invitation.css](../css/invitation.css): `url('../assets/fonts/MyFont.woff2')`
- **업로드 CSS** [upload/css/style.css](../upload/css/style.css): `url('../../assets/fonts/MyFont.woff2')`

### 예시: `@font-face` (루트 CSS 기준)

```css
@font-face {
  font-family: 'CustomSerif';
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url('../assets/fonts/CustomSerif.woff2') format('woff2'),
       url('../assets/fonts/CustomSerif.woff')  format('woff');
}

body {
  font-family: 'CustomSerif', 'Orbit', sans-serif;
}
```

### 예시: SVG 아이콘 (HTML)

```html
<!-- 루트 페이지 -->
<img src="assets/icons/heart.svg" alt="" width="24" height="24">

<!-- 업로드 페이지 -->
<img src="../assets/icons/heart.svg" alt="" width="24" height="24">
```

### 예시: SVG 인라인 (색상 동적 제어)

```html
<svg width="24" height="24" fill="currentColor">
  <use href="assets/icons/heart.svg#icon"/>
</svg>
```

## 파일 명명 규칙

- **소문자 + 하이픈**: `bride-name.svg`, `ring-icon.svg` (공백·대문자·한글 피함 — URL 인코딩 문제)
- **용도가 드러나게**: `btn-share-kakao.svg`, `hero-bg.webp`
- **버전/사이즈 필요 시 접미사**: `logo.svg`, `logo-white.svg`, `hero@2x.webp`

## 라이선스 체크리스트

- [ ] 상용/개인 프로젝트 사용 허용 확인
- [ ] 재배포(GitHub public repo) 허용 여부 확인
- [ ] 필요 시 `assets/LICENSES.md` 에 출처·라이선스 기록
