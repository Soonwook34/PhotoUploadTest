# 결혼식 사진 업로드 웹앱

결혼식 하객들이 모바일로 접속하여 사진과 동영상을 업로드하고, 공유된 사진을 갤러리로 볼 수 있는 웹 페이지입니다.

**Live**: https://soonwook34.github.io/PhotoUploadTest/

---

## 주요 기능

- **로그인 불필요** - 링크 접속만으로 바로 사용 가능 (Firebase 익명 인증)
- **사진/동영상 업로드** - 1인당 최대 50개, 원본 보존 + 갤러리용 썸네일 자동 생성
- **실시간 갤러리** - 하객들이 올린 사진을 바로 확인, Masonry 레이아웃 + shimmer 로딩
- **모바일 최적화** - 스마트폰 환경에 맞춘 UI/UX, iOS 비디오 썸네일 지원
- **라이트박스** - 사진 전체화면 보기, 스와이프 네비게이션, 촬영/업로드 시간 표시
- **네트워크 복원력** - 연결 지연 시 재시도 버튼 자동 표시, 타임아웃 안전장치

---

## 기술 스택

| 항목 | 기술 |
|------|------|
| Frontend | Vanilla HTML / CSS / JS (ES Modules) |
| Gallery | [Masonry.js](https://masonry.desandro.com/) + [imagesLoaded](https://imagesloaded.desandro.com/) (CDN) |
| EXIF | [exifr](https://github.com/MikeKovarik/exifr) (CDN, 촬영 시간 추출) |
| Font | [Google Fonts - Orbit](https://fonts.google.com/specimen/Orbit) |
| Storage | Firebase Storage (파일) + Firestore (메타데이터) |
| Auth | Firebase Anonymous Authentication |
| Hosting | GitHub Pages |

---

## 프로젝트 구조

```
├── index.html              # SPA 메인 페이지 (랜딩/업로드/갤러리)
├── css/
│   └── style.css           # 모바일 우선 웨딩 테마 스타일
├── js/
│   ├── firebase-config.js  # Firebase 초기화 및 인증
│   ├── upload.js           # 파일 검증, 썸네일 생성, 업로드 큐
│   ├── gallery.js          # Firestore 조회, 갤러리 렌더링, 라이트박스
│   └── app.js              # 화면 전환, UI 상태 관리
├── FIREBASE_SETUP.md       # Firebase 설정 가이드
└── README.md
```

---

## 시작하기

### 1. Firebase 설정

Firebase 프로젝트를 처음 만드는 경우, 아래 가이드를 따라 설정하세요:

**[Firebase 설정 가이드 (FIREBASE_SETUP.md)](FIREBASE_SETUP.md)**

### 2. Config 값 입력

Firebase 설정 완료 후, `js/firebase-config.js` 파일의 `YOUR_` 부분을 실제 값으로 교체합니다:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. GitHub Pages 배포

1. GitHub 레포지토리 > **Settings** > **Pages**
2. Source: **Deploy from a branch**
3. Branch: **main** / **/ (root)** 선택 > **Save**
4. 1~2분 후 `https://soonwook34.github.io/PhotoUploadTest/` 에서 접속 가능

---

## 페이지 구성

### 랜딩 페이지
- 업로드된 사진이 배경에 표시
- 커플 이름, 날짜, 감사 인사
- "사진 올리기" / "갤러리 보기" 버튼

### 업로드 페이지
- 파일 선택 또는 드래그 앤 드롭
- 선택된 파일 미리보기 (이미지 썸네일 + 영상 첫 프레임)
- 추가 선택 버튼으로 파일 이어서 추가 가능 (중복 자동 제거, auto-scroll)
- 업로드 진행률 표시 (파일별 + 전체)
- EXIF 촬영 시간 자동 추출 및 저장
- 완료 후 애니메이션 및 안내

### 갤러리 페이지
- 전체 / 사진 / 영상 필터 (클라이언트 사이드, 깜빡임 없음)
- Masonry 레이아웃 (원본 비율 유지) + 스켈레톤 로딩 + 이미지 페이드인
- 전체화면 라이트박스 (터치 스와이프 지원, EXIF 촬영 시간 표시)
- "더 보기" 페이지네이션 (최초 20개, 이후 15개씩)

---

## 업로드 제한

| 항목 | 제한 |
|------|------|
| 1인당 최대 업로드 수 | 50개 |
| 이미지 최대 크기 | 50 MB |
| 동영상 최대 크기 | 1 GB |
| 허용 파일 형식 | 이미지 (jpg, png, heic, heif 등), 동영상 (mp4, mov 등) |
| 원본 보존 | 업로드 파일은 원본 그대로 저장 (EXIF 메타데이터 포함) |
| 갤러리용 썸네일 | 이미지 업로드 시 1440px JPEG 썸네일 자동 생성 |
| 동시 업로드 | 5개씩 |
