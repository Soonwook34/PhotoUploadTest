# Firebase Rules 업데이트 가이드

청첩장 + 사진 업로드 앱을 위한 Firestore / Storage 보안 규칙과 데이터 구조를 **언제든지 최신 상태로 맞출 때 참조하는 가이드**입니다.

기능을 점진적으로 활성화할 때마다(예: RSVP, 방명록 추가) 이 문서의 해당 섹션 규칙을 복붙하여 적용하면 됩니다.

---

## 목차

- [1. Firestore Rules 최신 버전](#1-firestore-rules-최신-버전)
- [2. Storage Rules 최신 버전](#2-storage-rules-최신-버전)
- [3. Storage 폴더 구조 규약](#3-storage-폴더-구조-규약)
- [4. Firestore 컬렉션/문서 구조](#4-firestore-컬렉션문서-구조)
- [5. 기능별 활성화 체크리스트](#5-기능별-활성화-체크리스트)
- [6. 규칙 배포 방법](#6-규칙-배포-방법)

---

## 1. Firestore Rules 최신 버전

Firebase Console > **Firestore Database > 규칙** 탭에 붙여넣고 **게시** 클릭.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ========== 하객 업로드 사진 ==========
    match /photos/{photoId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if false;
    }

    // ========== 청첩장 데이터 ==========
    // 읽기는 누구나 가능, 쓰기는 Firebase Console에서만 (웹에서 편집 불가)
    match /config/{docId} {
      allow read: if true;
      allow write: if false;
    }

    // ========== RSVP (참석 여부) ==========
    // features.rsvp = true 일 때 활성화
    // 생성만 가능 (익명 인증 필요), 조회/수정/삭제 불가
    // → 조회는 Firebase Console 또는 Admin SDK에서만
    match /rsvp/{rsvpId} {
      allow read: if false;
      allow create: if request.auth != null
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 30
        && request.resource.data.side in ['groom', 'bride']
        && request.resource.data.attending is bool;
      allow update, delete: if false;
    }

    // ========== 방명록 ==========
    // features.guestbook = true 일 때 활성화
    // 공개 게시판 방식: 누구나 읽기, 익명 인증 사용자는 쓰기
    match /guestbook/{msgId} {
      allow read: if true;
      allow create: if request.auth != null
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 30
        && request.resource.data.message is string
        && request.resource.data.message.size() > 0
        && request.resource.data.message.size() <= 500;
      allow update, delete: if false;
    }
  }
}
```

### 규칙별 설명

| 컬렉션 | Read | Create | Update/Delete |
|--------|------|--------|---------------|
| `photos` | public | 익명 인증 사용자 | 금지 |
| `config` | public | **금지** (Console에서만 편집) | 금지 |
| `rsvp` | 금지 (Console 조회) | 익명 + 유효성 검증 | 금지 |
| `guestbook` | public | 익명 + 유효성 검증 | 금지 |

---

## 2. Storage Rules 최신 버전

Firebase Console > **Storage > Rules** 탭에 붙여넣고 **게시** 클릭.

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {

    // ========== 하객 업로드 원본 ==========
    match /uploads/{uid}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.uid == uid
        && request.resource.size < 1073741824
        && request.resource.contentType.matches('image/.*|video/.*');
    }

    // ========== 하객 업로드 썸네일 ==========
    match /thumbnails/{uid}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null
        && request.auth.uid == uid
        && request.resource.size < 1048576
        && request.resource.contentType == 'image/jpeg';
    }

    // ========== 청첩장 이미지/음원 ==========
    // 공개 읽기, 쓰기는 Firebase Console에서만
    match /invitation/{allPaths=**} {
      allow read: if true;
      allow write: if false;
    }
  }
}
```

### 경로별 설명

| 경로 | Read | Write |
|------|------|-------|
| `/uploads/{uid}/*` | public | 본인만 (1GB 이하, 이미지/영상) |
| `/thumbnails/{uid}/*` | public | 본인만 (1MB 이하, JPEG) |
| `/invitation/**` | public | **금지** (Console에서만 업로드) |

---

## 3. Storage 폴더 구조 규약

청첩장 이미지는 Firestore에 URL을 박아두지 않고 **Storage의 고정 경로 규칙**으로 관리합니다.
이미지 교체 시 파일만 덮어쓰면 되며, 코드 수정이나 Firestore 편집이 필요 없습니다.

```
/invitation/
  hero.jpg          # 메인 커버 이미지 (필수)
  og.jpg            # 카카오톡/링크 공유 썸네일 (선택)
  bgm.mp3           # 배경음악 (선택, features.bgm = true 일 때만 로드)
  gallery/          # 갤러리 사진 폴더 (파일 자동 스캔)
    01.jpg
    02.jpg
    03.jpg
    ...

/uploads/{uid}/...       # (기존) 하객 업로드 원본
/thumbnails/{uid}/...    # (기존) 하객 업로드 썸네일
```

### 파일명 규약

| 파일 | 경로 | 필수/선택 | 참고 |
|------|------|-----------|------|
| 메인 커버 | `invitation/hero.jpg` | 필수 | 세로형 권장 (3:4 or 4:5) |
| 공유 썸네일 | `invitation/og.jpg` | 선택 | 1200x630 권장 |
| 배경음악 | `invitation/bgm.mp3` | 선택 | 가급적 2MB 이하 |
| 갤러리 사진 | `invitation/gallery/*.jpg` | 선택 | 파일명 사전순 정렬 (`01.jpg`, `02.jpg` 식으로 prefix 숫자 권장) |

### 이미지 교체/추가 방법

1. Firebase Console > **Storage** 이동
2. `invitation` 폴더 진입
3. 파일 **드래그 앤 드롭** 또는 **파일 업로드** 버튼
4. 동일 이름으로 덮어쓰기 하면 즉시 반영됨
5. 브라우저 캐시 때문에 즉시 보이지 않으면 강제 새로고침 (Cmd+Shift+R)

---

## 4. Firestore 컬렉션/문서 구조

### `config/invitation` (단일 문서, 모든 개인정보)

```javascript
{
  groom: {
    name: "홍길동",
    nameEn: "Gildong Hong",
    rank: "장남",
    phone: "010-1234-5678",
    father: { name: "홍판서", phone: "010-...", deceased: false },
    mother: { name: "김춘섬", phone: "010-...", deceased: false },
    accounts: [
      { bank: "카카오뱅크", number: "3333001234567", holder: "홍길동", label: "신랑" },
      { bank: "국민은행",   number: "123456789012", holder: "홍판서", label: "아버지" },
      { bank: "신한은행",   number: "110123456789", holder: "김춘섬", label: "어머니" }
    ]
  },

  bride: { /* groom과 동일 구조 */ },

  wedding: {
    date: "2026-10-10T14:00:00+09:00",
    durationMinutes: 90,
    venue: {
      name: "더채플앳청담",
      hall: "5층 그랜드홀",
      address: "서울특별시 강남구 청담동 123-45",
      addressDetail: "삼성로 732",
      tel: "02-1234-5678",
      coord: { lat: 37.5245, lng: 127.0467 }
    }
  },

  transport: [
    { type: "subway",  label: "지하철",   desc: "압구정로데오역 3번 출구 도보 5분" },
    { type: "bus",     label: "버스",     desc: "강남01, 4412 청담사거리 하차" },
    { type: "car",     label: "자차",     desc: "건물 지하 2시간 무료 주차" }
  ],

  charterBus: {
    enabled: false,
    routes: []
  },

  greeting: {
    title: "초대합니다",
    body: "서로를 향한 마음을 모아\n인생의 새로운 출발을 하려 합니다."
  },

  share: {
    title: "길동 ♥ 영희 결혼합니다",
    description: "2026년 10월 10일 토요일 오후 2시",
    url: "https://soonwook34.github.io/PhotoUploadTest/"
  },

  externalLinks: {
    flowerDelivery: "",
    uploadPage: "upload/"
  },

  features: {
    bgm: false,
    countdown: true,
    calendar: true,
    addToCalendar: true,
    kakaoShare: true,
    linkShare: true,
    mapApps: true,
    accountCopy: true,
    rsvp: false,
    guestbook: false,
    charterBus: false,
    flowerDelivery: false
  }
}
```

### `rsvp/{autoId}` (추후 활성화)

```javascript
{
  side: "groom",              // 'groom' | 'bride'
  name: "김철수",
  phone: "010-1234-5678",     // optional
  attending: true,
  guestCount: 2,
  mealIncluded: true,
  message: "축하합니다",
  createdAt: Timestamp
}
```

### `guestbook/{autoId}` (추후 활성화)

```javascript
{
  name: "김철수",
  message: "두 분 결혼 축하드립니다",
  createdAt: Timestamp
}
```

---

## 5. 기능별 활성화 체크리스트

모든 기능은 `config/invitation` 의 `features.*` 플래그로 on/off 됩니다.
새 기능을 켤 때마다 아래 체크리스트를 따라가세요.

### 배경음악 (BGM)
- [ ] Storage에 `invitation/bgm.mp3` 업로드
- [ ] Firestore `features.bgm = true` 변경

### 캘린더 일정 등록 버튼 (.ics)
- [ ] `wedding.date` 와 `durationMinutes` 정확히 입력
- [ ] Firestore `features.addToCalendar = true`

### 카카오톡 공유
- [ ] Kakao Developers에서 앱 등록 후 JavaScript 키 발급
- [ ] [js/invitation.js](js/invitation.js) 상단의 `KAKAO_JS_KEY` 에 키 입력
- [ ] 플랫폼 > Web > 사이트 도메인에 `https://soonwook34.github.io` 등록
- [ ] Storage에 `invitation/og.jpg` 업로드
- [ ] Firestore `features.kakaoShare = true`

### 지도 앱 연동 (네이버/카카오/티맵)
- [ ] `wedding.venue.coord.lat`, `lng` 입력
- [ ] `wedding.venue.name`, `address` 정확히 입력
- [ ] Firestore `features.mapApps = true`

### 전세버스
- [ ] `charterBus.routes` 배열 작성 (출발지/시간/기사연락처/차량번호)
- [ ] Firestore `charterBus.enabled = true`, `features.charterBus = true`

### RSVP (참석 여부)
- [ ] Firestore Rules에 위 섹션 1의 `match /rsvp/{rsvpId}` 블록 포함 확인 → **게시**
- [ ] Firestore `features.rsvp = true`
- [ ] (확인 방법) Firebase Console > Firestore > `rsvp` 컬렉션에서 응답 조회

### 방명록
- [ ] Firestore Rules에 위 섹션 1의 `match /guestbook/{msgId}` 블록 포함 확인 → **게시**
- [ ] Firestore `features.guestbook = true`

### 화환 보내기
- [ ] `externalLinks.flowerDelivery` 에 외부 URL 입력
- [ ] Firestore `features.flowerDelivery = true`

---

## 6. 규칙 배포 방법

### 방법 A: Firebase Console (추천)

1. [Firebase Console](https://console.firebase.google.com) 접속 → 프로젝트 선택
2. **Firestore Database > 규칙** 탭
3. 섹션 1의 규칙 전체를 붙여넣기 → **게시** 클릭
4. **Storage > Rules** 탭
5. 섹션 2의 규칙 전체를 붙여넣기 → **게시** 클릭

### 방법 B: Firebase CLI (선택)

```bash
# 초기 설정 (최초 1회)
npm install -g firebase-tools
firebase login
firebase init firestore storage

# firestore.rules, storage.rules 파일에 위 규칙 저장 후
firebase deploy --only firestore:rules,storage
```

### 검증

- Firebase Console > **Firestore > 규칙 > 플레이그라운드** 에서 시뮬레이션 가능
- Storage 동일하게 **Rules Playground** 제공
- 각 경로별 read/write 를 인증된/미인증 상태로 테스트

---

## 변경 이력 기록 (선택)

규칙을 변경한 날짜와 이유를 아래에 기록해두면 추후 디버깅에 유용합니다.

| 날짜 | 변경 내용 | 이유 |
|------|-----------|------|
| 2026-04-18 | `config/{docId}` read-only 규칙 추가 | 청첩장 데이터 분리 |
| 2026-04-18 | `invitation/{allPaths=**}` Storage 규칙 추가 | 청첩장 이미지 경로 분리 |
