# Kakao 공유 설정 가이드

청첩장의 "카카오톡 공유" 버튼을 실제로 동작시키려면 Kakao Developers 에서 JavaScript 키를 발급받아야 합니다. 이 문서는 키 발급부터 Firestore 저장까지의 절차를 담습니다.

> 실제 코드 연동(SDK 로드 + init + sendDefault)은 키 발급이 끝난 뒤 별도 커밋으로 진행됩니다 — 이 문서는 **사전 준비** 단계.

---

## 1. Kakao Developers 가입 및 앱 등록

1. [developers.kakao.com](https://developers.kakao.com/) 접속
2. 우측 상단 **"로그인"** → 기존 카카오톡 계정 사용
3. 첫 접속이라면 **개발자 등록** 안내에 따라 동의 (이메일 인증, 휴대폰 인증 등)
4. 상단 **"내 애플리케이션"** 클릭
5. **"애플리케이션 추가하기"** 버튼 클릭
6. 입력:
   - 앱 아이콘 (선택)
   - 앱 이름: `결혼식 청첩장` (공유 시 노출)
   - 사업자명: 개인이면 **본인 이름**
7. **"저장"**

---

## 2. JavaScript 키 확인

1. 생성된 앱 카드 클릭 → 앱 대시보드 진입
2. 좌측 메뉴 **"앱 키"** 탭
3. 네 가지 키 중 **"JavaScript 키"** 값 복사:
   | 키 종류 | 용도 |
   |--------|------|
   | 네이티브 앱 키 | Android/iOS 앱 (이번 프로젝트 불필요) |
   | REST API 키 | 서버용 (불필요) |
   | **JavaScript 키** | **웹 SDK용 — 이것을 사용** |
   | Admin 키 | 서버 관리자용 (노출 금지, 불필요) |

> JavaScript 키는 클라이언트에 노출되어도 괜찮습니다 (도메인 제한으로 보호됨). Firebase `apiKey` 와 같은 개념.

---

## 3. 사이트 도메인 등록 (필수)

JavaScript SDK는 **등록된 도메인에서만** 동작합니다. 등록 안 하면 `Kakao.init()` 에서 오류 발생.

1. 좌측 메뉴 **"앱 설정 > 플랫폼"**
2. **"Web 플랫폼 등록"** 클릭
3. 사이트 도메인 입력:
   ```
   https://soonwook34.github.io
   ```
   - 한 줄에 하나씩 입력
   - 커스텀 도메인이 있으면 함께 추가 (예: `https://wedding.example.com`)
   - 로컬 테스트를 위해 `http://localhost:5500` 등도 추가 가능
4. **"저장"**

---

## 4. 카카오톡 공유 활성화

1. 좌측 메뉴 **"제품 설정 > 카카오톡 공유"** (또는 "카카오 로그인" 밑 메뉴)
2. **"활성화 설정"** 또는 **"사용 설정"** 토글을 **ON**
3. 필요 시 "도메인" 섹션에서 3단계 도메인과 동일한지 재확인

> 기본 카카오톡 공유는 **비즈 앱 심사 없이** 바로 사용 가능 (2026년 기준). "카카오톡 채널" 이나 "앨범 공유" 같은 별도 기능은 심사가 필요할 수 있습니다.

---

## 5. JS 키 저장 위치

### 권장: Firestore `config/invitation.share.kakaoJsKey`

개인정보 관리 정책과 동일하게 **git에 키를 박지 않고 Firestore 에 저장**합니다. 교체 시 Console 에서 값만 바꾸면 되고 재배포 불필요.

**Firebase Console 작업**:
1. **Firestore Database > `config` 컬렉션 > `invitation` 문서**
2. "문서 편집" → `share` 맵 열기
3. 필드 추가:
   - 필드명: `kakaoJsKey`
   - 타입: `string`
   - 값: **2단계에서 복사한 JavaScript 키**
4. 저장

**로컬 템플릿에도 동일하게 반영** (`firebase/firestore/config/invitation.json` — gitignored):
```json
"share": {
  "title": "...",
  "description": "...",
  "url": "https://soonwook34.github.io/PhotoUploadTest/",
  "kakaoJsKey": "발급받은 JavaScript 키"
}
```

---

## 6. 이후 코드 연동 (키 발급 이후 별도 작업)

키가 Firestore 에 입력되면 아래 코드 변경이 예정되어 있습니다:

1. [index.html](index.html) 에 Kakao SDK CDN 스크립트 추가
   ```html
   <script src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.2/kakao.min.js" integrity="..." crossorigin="anonymous"></script>
   ```
2. [js/invitation.js](js/invitation.js) `init()` 에서 SDK 초기화:
   ```js
   if (data.share?.kakaoJsKey && window.Kakao && !window.Kakao.isInitialized()) {
     window.Kakao.init(data.share.kakaoJsKey);
   }
   ```
3. `renderShareButtons` 의 kakaoBtn 블록에 실제 공유 호출:
   ```js
   kakaoBtn.addEventListener('click', () => {
     window.Kakao.Share.sendDefault({
       objectType: 'feed',
       content: {
         title: share.title,
         description: share.description,
         imageUrl: ogImageUrl,
         link: { mobileWebUrl: share.url, webUrl: share.url }
       }
     });
   });
   ```

공유 카드에 쓸 **이미지는 필수 아님** (`objectType: 'text'` 로 대체 가능) 이지만, `feed` 타입에는 썸네일이 있는 편이 자연스럽습니다. 이미 올려둔 `invitation/og.jpg` 를 그대로 쓸 수 있음.

---

## 체크리스트

- [ ] Kakao Developers 가입 완료
- [ ] 앱 생성 완료
- [ ] JavaScript 키 복사 완료
- [ ] Web 플랫폼 도메인(`https://soonwook34.github.io`) 등록 완료
- [ ] 카카오톡 공유 활성화 완료
- [ ] Firestore `config/invitation.share.kakaoJsKey` 에 키 저장 완료
- [ ] (위 완료 후) 개발자에게 "키 발급 끝났다" 알림 → 코드 연동 진행

---

## 참고 링크

- [Kakao 공유 JavaScript 가이드](https://developers.kakao.com/docs/latest/ko/message/js-link)
- [Kakao.Share API 레퍼런스](https://developers.kakao.com/sdk/reference/js/release/Kakao.Share.html)
- [SDK 다운로드 (CDN 버전/무결성 해시)](https://developers.kakao.com/docs/latest/ko/getting-started/sdk-js)
