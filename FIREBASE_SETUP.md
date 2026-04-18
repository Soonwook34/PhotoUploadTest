# Firebase 설정 가이드

결혼식 청첩장 + 사진 업로드 웹앱을 위한 **최초 Firebase 설정 가이드**입니다.

> 최초 세팅 이후 규칙을 업데이트하거나 새 기능을 켤 때는 [FIREBASE_RULES_UPDATE.md](FIREBASE_RULES_UPDATE.md) 를 참조하세요.

---

## 1. Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com) 접속 후 Google 계정 로그인
2. **"프로젝트 추가"** 클릭
3. 프로젝트 이름 입력 (예: `wedding-photo-upload`)
4. Google Analytics → **사용 안함**으로 끄기
5. **"프로젝트 만들기"** → 완료되면 **"계속"**

---

## 2. 웹 앱 등록 (config 값 얻기)

1. 프로젝트 대시보드 상단의 **프로젝트 이름 옆 `+ 앱 추가`** 클릭
2. **웹 아이콘 `</>`** 선택
3. 앱 닉네임 입력 (예: `wedding-web`)
4. **"Firebase 호스팅 설정"은 체크하지 않음**
5. **"앱 등록"** 클릭
6. **`<script> 태그 사용`** 을 선택하면 아래와 같은 config 코드가 표시됨:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.firebasestorage.app",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

7. **이 값들을 복사해 두기** → 나중에 `js/firebase-config.js`에 입력
8. **"콘솔로 이동"** 클릭

---

## 3. 익명 인증(Authentication) 활성화

> Firebase Console 왼쪽 사이드바 메뉴 구조 (2026년 기준):
> ```
> 프로젝트 개요
> 설정
> ─────────────
> 제품 카테고리
>   데이터베이스 및 스토리지
>   보안              ← 인증은 여기 안에 있음
>   AI 서비스
>   호스팅 및 서비스러
>   DevOps 및 사용자 참여
>   애널리틱스
> ```

1. 왼쪽 사이드바에서 **"보안"** 클릭하여 펼치기
2. **"인증"** (Authentication) 클릭
3. **"시작하기"** 클릭
4. **"Sign-in method"** (로그인 방법) 탭 클릭
5. 목록에서 **"익명"** 클릭
6. **"사용 설정"** 토글 켜기 → **"저장"**

---

## 4. Firestore Database 생성

1. 왼쪽 사이드바에서 **"데이터베이스 및 스토리지"** 클릭하여 펼치기
2. **"Firestore Database"** 클릭
3. **"데이터베이스 만들기"** 클릭
4. 위치 선택: **`asia-northeast3 (서울)`**
5. **"프로덕션 모드에서 시작"** 선택 → **"만들기"**
6. 생성 완료 후 **"규칙"** 탭 클릭
7. 기존 내용을 **전부 지우고** [FIREBASE_RULES_UPDATE.md의 섹션 1](FIREBASE_RULES_UPDATE.md#1-firestore-rules-최신-버전) 규칙을 붙여넣기
8. **"게시"** 클릭

### 컬렉션 요약
| 컬렉션 | 용도 | Read | Write |
|--------|------|------|-------|
| `photos` | 하객 업로드 사진 메타데이터 | public | 익명 인증 사용자 |
| `config` | 청첩장 개인정보 (이름/주소/계좌 등) | public | Console에서만 |
| `rsvp` | 참석 여부 응답 (추후) | 금지 | 익명 인증 + 검증 |
| `guestbook` | 방명록 (추후) | public | 익명 인증 + 검증 |

> 상세 규칙은 [FIREBASE_RULES_UPDATE.md](FIREBASE_RULES_UPDATE.md) 참조

---

## 5. Firebase Storage 활성화

1. 왼쪽 사이드바에서 **"데이터베이스 및 스토리지"** 안의 **"Storage"** 클릭
2. **"시작하기"** 클릭
3. **"프로덕션 모드에서 시작"** → **"다음"**
4. 위치는 자동 설정됨 → **"완료"**
5. **"Rules"** (규칙) 탭 클릭
6. 기존 내용을 **전부 지우고** [FIREBASE_RULES_UPDATE.md의 섹션 2](FIREBASE_RULES_UPDATE.md#2-storage-rules-최신-버전) 규칙을 붙여넣기
7. **"게시"** 클릭

### 폴더 구조 요약
```
/invitation/        # 청첩장 이미지 (hero.jpg, og.jpg, gallery/*) - public read only
/uploads/{uid}/     # 하객 업로드 원본
/thumbnails/{uid}/  # 하객 업로드 썸네일
```

> 상세 규약과 파일명 규칙은 [FIREBASE_RULES_UPDATE.md 섹션 3](FIREBASE_RULES_UPDATE.md#3-storage-폴더-구조-규약) 참조

---

## 6. Blaze (종량제) 플랜 업그레이드

> Storage를 사용하려면 Blaze 플랜이 필요합니다.
> 무료 사용량 한도 내에서는 **비용이 발생하지 않습니다.**

1. 왼쪽 하단 **"업그레이드"** 또는 프로젝트 이름 옆 **"Spark 요금제"** 클릭
2. **Blaze (종량제)** 선택
3. 결제 계정 연결 (신용카드 등록)
4. **예산 알림 설정 권장**: `10,000원`으로 설정

### 무료 한도 (걱정 안 해도 되는 수준)
| 항목 | 무료 한도 |
|------|----------|
| Storage 저장 용량 | 5 GB |
| Storage 다운로드 | 1 GB / 일 |
| Storage 업로드 | 50,000건 / 일 |
| Firestore 읽기 | 50,000건 / 일 |
| Firestore 쓰기 | 20,000건 / 일 |
| 익명 인증 | 무제한 |

---

## 7. GitHub Pages 도메인 승인

1. 왼쪽 사이드바 **"보안" > "인증"** 클릭
2. **"Settings"** (설정) 탭 클릭
3. **"승인된 도메인"** 섹션에서 **"도메인 추가"** 클릭
4. `soonwook34.github.io` 입력 → **"추가"**

---

## 8. 프로젝트에 config 값 입력

Firebase config는 **두 군데**에서 사용합니다 (둘 다 동일한 값):
- `js/firebase-config.js` (청첩장 메인 페이지)
- `upload/js/firebase-config.js` (사진 업로드 앱)

각 파일을 열고 `YOUR_` 부분을 2단계에서 복사한 값으로 교체:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",                              // 복사한 apiKey
  authDomain: "your-project.firebaseapp.com",       // 복사한 authDomain
  projectId: "your-project-id",                     // 복사한 projectId
  storageBucket: "your-project.firebasestorage.app", // 복사한 storageBucket
  messagingSenderId: "123456789012",                // 복사한 messagingSenderId
  appId: "1:123456789012:web:abcdef..."             // 복사한 appId
};
```

수정 후 git push하면 GitHub Pages에 자동 반영됩니다.

---

## 9. 청첩장 초기 데이터 입력

### Firestore에 `config/invitation` 문서 생성

> 실제 값을 담은 로컬 템플릿 JSON은 `firebase/invitation.json` 에 있습니다. 이 파일은 `.gitignore` 로 git에서 제외되며, 자세한 워크플로우는 [firebase/README.md](firebase/README.md) 참조.

1. Firebase Console > **Firestore Database** > **데이터** 탭
2. **컬렉션 시작** 클릭 → 컬렉션 ID: `config`
3. 문서 ID: `invitation` (자동 ID 해제, 직접 입력)
4. `firebase/invitation.json` 의 값을 참고하여 필드 입력 (스키마 설명은 [FIREBASE_RULES_UPDATE.md 섹션 4](FIREBASE_RULES_UPDATE.md#4-firestore-컬렉션문서-구조))
5. **저장**

### Storage에 청첩장 이미지 업로드

1. Firebase Console > **Storage**
2. **폴더 만들기** → `invitation`
3. `invitation` 폴더 진입 후 아래 파일 업로드:
   - `hero.jpg` (메인 커버)
   - `og.jpg` (공유 썸네일, 선택)
4. `invitation/gallery/` 하위 폴더 만든 후 갤러리 사진 업로드 (`01.jpg`, `02.jpg` 식)

---

## 설정 완료 체크리스트

- [ ] Firebase 프로젝트 생성됨
- [ ] 웹 앱 등록 및 config 값 복사됨
- [ ] 익명 인증 활성화됨
- [ ] Firestore Database 생성 및 규칙 배포됨
- [ ] Storage 활성화 및 규칙 배포됨
- [ ] Blaze 플랜 업그레이드됨
- [ ] GitHub Pages 도메인 승인됨
- [ ] `js/firebase-config.js`, `upload/js/firebase-config.js` 에 config 값 입력됨
- [ ] Firestore `config/invitation` 문서 생성 및 데이터 입력됨
- [ ] Storage `invitation/` 폴더에 이미지 업로드됨
