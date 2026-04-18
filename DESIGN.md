# 디자인 시스템 가이드 — Wedding Pass

사용자가 디자인한 **보딩패스/항공권 모티프** 의 실물 청첩장과 모바일 청첩장·업로드 페이지의 디자인 통일성을 확보하기 위한 레퍼런스 문서.

> 모든 수치·색상 값은 **실물 시안을 분석한 근사치** 이며, 실제 적용 시 현재 프로젝트 색상 토큰과 조화롭게 조정 가능.

---

## 1. 컨셉 & 내러티브

**"두 사람이 시작하는 하나의 비행" — 항공권(Boarding Pass) 메타포**

| 요소 | 표현 |
|------|------|
| 내러티브 | 결혼 = 함께 떠나는 첫 여정 |
| 주요 헤드라인 | "READY FOR TAKEOFF AS ONE", "JOIN US FOR OUR FIRST FLIGHT!" |
| 레이아웃 | 항공권 스타일 (본권 + 스터브 분할, 천공선, 좌우 사이드 레일) |
| 장식 요소 | 비행기 아이콘, 연속 chevron(`>>>`), 언더스코어 연결어(`WEDDING_PASS_...`) |
| 데이터 표기 | `26.09.20`, `11:00 AM` 같은 모노스페이스 기호학(터미널/티켓 느낌) |

**톤앤매너**: 미니멀 · 정보 중심 · 약간의 레트로 테크 감성 (OCR 폰트 + 모노스페이스 대문자)

---

## 2. 색상 팔레트

### 브랜드 컬러
| 이름 | 값 | 용도 |
|------|-----|------|
| `--color-mint-bg` | `#B8E0DB` | 하단 패널 배경, 카드 배경 |
| `--color-mint` | `#81C7C0` | 하트, 강조 배경, 라벨 포인트, CTA 배경 |
| `--color-mint-pale` | `#F2FCFB` / `#F9FFFE` | 섹션 배경, 페이지 기본 톤 |
| `--color-ink` | `#2D2D2D` | 본문/이름 등 주요 텍스트 |
| `--color-ink-black` | `#000000` | 제목/대비 강한 포인트 (실물 ticket 상단) |
| `--color-gray-chevron` | `#B8B8B8` ~ `#9AA0A0` | chevron(`>>>`), 보조 라인 |
| `--color-gray-muted` | `#888` / `#999` | 부연 설명 텍스트 |
| `--color-weekday-sun` | `#E57AA1` | 일요일 라벨 (pink) |
| `--color-weekday-sat` | `#5B9AD6` | 토요일 라벨 (blue) |

### 현재 프로젝트와의 매핑
- 실물 시안의 민트는 기존 [css/invitation.css](css/invitation.css) 의 `#81C7C0` 계열과 **동일 레인지**
- `--color-mint-bg` 를 하단 패널용으로 **새로 추가** 필요 (`#B8E0DB`)
- 배경: `#F9FFFE` (기본) → 상단 본권 영역 / `#B8E0DB` → 하단 패널

### CSS Custom Properties (권장)
```css
:root {
    --color-mint:        #81C7C0;
    --color-mint-bg:     #B8E0DB;
    --color-mint-pale:   #F2FCFB;
    --color-bg:          #F9FFFE;

    --color-ink:         #2D2D2D;
    --color-ink-strong:  #000000;
    --color-gray-chevron:#B8B8B8;
    --color-gray-muted:  #888;
}
```

---

## 3. 타이포그래피

실물 시안은 **3 family** 를 조합함.

### A. 모노스페이스 (OCR-A / ticker 폰트)
가장 강한 정체성. 티켓 스터브·번호·라벨·날짜 표시에 사용.

| 용도 | 예시 | 비고 |
|------|------|------|
| 메타 헤더 | `>>>>>> WEDDING_PASS >>>> 2026_09_20 >>>>` | 상/하단 레일 |
| 대형 숫자 | `26·09·20`, `11:00 AM` | 우측 스터브의 날짜/시간 (진하고 큰) |
| 섹션 라벨 | `EVENT_DETAILS`, `VENUE`, `DATE`, `TIME`, `GROOM`, `BRIDE` | 전부 대문자 + tracking |
| 영문 이름 | `PARK / SOONWOOK`, `YANG / SOHEE` | 이름 아래 부가 표기 |
| 사이드 레일 | 세로로 90° 회전된 `WEDDING_PASS_...` 연결 문자열 | 장식 겸 메타 |

**파일**: [assets/fonts/ocr-a-regular.otf](assets/fonts/ocr-a-regular.otf)

**CSS**:
```css
@font-face {
    font-family: 'OCR A';
    src: url('../assets/fonts/ocr-a-regular.otf') format('opentype');
    font-display: swap;
}

.mono { font-family: 'OCR A', ui-monospace, 'SF Mono', Menlo, monospace; }
```

### B. 한글 산세리프 (디스플레이/본문)
한글 이름·혼주 정보·안내문 등.

- 이미 연결된 **Google Fonts `Orbit`** 유지 (기존 프로젝트 폰트)
- 이름(`박 순 욱`)은 **음절 사이 공백** 을 넣어 디스플레이 효과
- `letter-spacing: 0.2em` ~ `0.3em` 로 시각적 여유

**CSS**:
```css
.couple-name {
    font-family: 'Orbit', sans-serif;
    font-size: 28px;
    letter-spacing: 0.2em;
    font-weight: 400;
    color: var(--color-ink);
}
/* 렌더링 시 이름 글자 사이 공백을 직접 넣거나 text-indent 기법 사용 */
```

### C. 영문 산세리프 (헤드라인)
- "READY FOR TAKEOFF AS ONE :)", "JOIN US FOR OUR FIRST FLIGHT!", "SAVE THE DATE!"
- 볼드체, 상당히 **조밀한 tracking** (모노 대비 밀도 있는 가로)

```css
.headline-en {
    font-family: 'Orbit', 'Helvetica Neue', Arial, sans-serif;
    font-weight: 700;
    font-size: 18px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink-strong);
}
```

### 폰트 위계 (Web)
| 레벨 | 크기 (mobile) | 용도 |
|------|---------------|------|
| XXL | 28-32px | 커플 이름 |
| XL | 22-24px | 우측 스터브의 날짜/시간 대형 숫자 |
| L | 18-20px | 영문 헤드라인, 섹션 제목 |
| M | 15-16px | 본문 |
| S | 13px | 라벨 (mono, uppercase) |
| XS | 11-12px | chevron rail, 부연 설명 |

---

## 4. 아이콘/그래픽

### 업로드된 SVG 세트
| 파일 | 시안 상 용도 |
|------|-------------|
| [assets/icons/heart.svg](assets/icons/heart.svg) | 커플 이름 사이 민트 하트, 캘린더의 결혼일 마커 |
| [assets/icons/plane.svg](assets/icons/plane.svg) | 하단 패널 "FIRST FLIGHT!" 아래 비행기 아이콘 |
| [assets/icons/flight-takeoff.svg](assets/icons/flight-takeoff.svg) | 이륙 모션이 담긴 변형 — 전환 효과·상단 장식 후보 |
| [assets/icons/engagement-ring.svg](assets/icons/engagement-ring.svg) | 반지 아이콘 — 특별 섹션(예: "Our Story", "언약") 강조 |

### 색상 제어
SVG 는 `fill="currentColor"` 로 내보내 CSS 의 `color` 값으로 색 변경 가능하게 할 것. 없다면 수동 `fill` 지정.

```css
.icon {
    width: 24px;
    height: 24px;
    color: var(--color-mint);
}
```

```html
<img src="assets/icons/heart.svg" class="icon" alt="">
```

---

## 5. 장식 모티프 (반복 등장하는 그래픽 언어)

### 5-1. Chevron Rail (`>>>>>>`)
- 상/하단 수평 바 + 일부 우측 스터브에 반복
- 색상: `var(--color-gray-chevron)` (은은한 회색)
- 내용: `>>>>>> WEDDING_PASS >>>> 2026_09_20 >>>> NAMSAN_ARTS_WEDDING_HALL >>>>>>` 처럼 **메타 정보가 중간중간 삽입**
- 구분자: `>>>` 4~6개 연속

**CSS**:
```css
.rail {
    font-family: 'OCR A', monospace;
    font-size: 11px;
    color: var(--color-gray-chevron);
    letter-spacing: 0.1em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: 8px 0;
}
```

웹 버전에서는 **가로 스크롤 마키(marquee) 애니메이션** 으로 활용 가능 (좌→우 끊임없이 흐름).

### 5-2. Vertical Side Rail
- 양쪽 세로 가장자리에 **90° 회전된** `WEDDING_PASS_PARK_SOONWOOK_AND_YANG_SOHEE_...` 문자열
- 매우 가는 폭, 높이 전체
- 장식 + 정보 밀도 동시에

**CSS** (모바일에서는 가시성 낮아 생략 가능):
```css
.side-rail {
    position: absolute;
    top: 0; bottom: 0;
    left: 0;
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-family: 'OCR A', monospace;
    font-size: 9px;
    color: var(--color-ink);
    letter-spacing: 0.05em;
    line-height: 1;
    padding: 12px 2px;
}
```

### 5-3. 언더스코어 연결어 (`WEDDING_PASS`, `SAVE_THE_DATE`, `FLIGHT_001`)
- **공백 대신 `_`** 로 단어 연결 → 터미널/코드 감성
- 모두 **대문자**
- 문장 부호 `:)` 간혹 삽입 — 위트 (ticket 의 stamp 느낌)

### 5-4. 얇은 수평 분할선
- `1px solid var(--color-ink)` 혹은 `0.5px` 더 가늘게
- 섹션 간 단호한 구획
- 모노 라벨 바로 아래에 반복 등장

### 5-5. `·` (middle dot) 구분자
- `2026.09.20 (일) 11:00` 형식에 `.` 사용
- 연도/월/일 사이, 시/분 사이

---

## 6. 레이아웃 패턴

### 6-1. 듀얼 패널 (Dual Panel)
- **상단**: 흰 배경 티켓 본권 (정보 본체)
- **하단**: 민트 배경 티켓 (감성·캘린더·QR)
- 두 패널 사이 시각적 구분: 검정 배경 띠 + 여백 / 또는 perforation 점선

### 6-2. 본권 + 스터브 (Stub) 분할
- 큰 좌측 영역 + 우측 좁은 "스터브" (항공권 절취선 구조)
- 실제 perforation 라인은 생략하되, **얇은 수직선 또는 배경색 차이** 로 암시
- 스터브 상/하단에도 chevron 바

### 6-3. 모바일 적응 권장 (상단 본권)
```
┌─────────────────────────┐
│  top chevron rail       │
│  "READY FOR TAKEOFF"    │
│                         │
│   박 순 욱  ♥  양 소 희   │
│   PARK/SOONWOOK ...     │
│  ─────────────────────  │
│  GROOM    BRIDE         │
│  박종필·김순한    양경호·장진숙 │
│  ─────────────────────  │
│  DATE & TIME   VENUE    │
│  2026.09.20...  남산...  │
│                         │
│  bottom chevron rail    │
└─────────────────────────┘
```
- 모바일에서는 우측 스터브를 **접어 하단에 붙이기** 또는 **생략**
- 대신 `EVENT_DETAILS` 블록을 카드로 분리

### 6-4. 모바일 적응 권장 (하단 패널)
```
┌───────── mint bg ────────┐
│  top chevron rail        │
│                          │
│   SEP 2026 캘린더         │
│   S M T W T F S          │
│   ...하이라이트된 20        │
│                          │
│   ✈  JOIN US FOR OUR     │
│       FIRST FLIGHT!      │
│                          │
│   인사말 한국어 두 줄      │
│                          │
│   [QR] 모바일 청첩장       │
│   [QR] 오시는 길           │
│                          │
│  bottom chevron rail     │
└──────────────────────────┘
```

### 간격 원칙
- 섹션 사이 **56~72px** (여유 큰 공간)
- 아이템 사이 **16~24px**
- 컴포넌트 내부 `padding: 20px 24px`

---

## 7. 컴포넌트 레시피

### 7-1. 섹션 헤더 (모노 라벨)
```html
<p class="section-label">EVENT_DETAILS</p>
```
```css
.section-label {
    font-family: 'OCR A', monospace;
    font-size: 11px;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--color-ink);
    margin-bottom: 8px;
}
```

### 7-2. 키-밸류 블록 (라벨 위, 값 아래)
```html
<div class="kv">
    <p class="section-label">DATE</p>
    <p class="kv-value mono">26·09·20</p>
</div>
```
```css
.kv { margin-bottom: 20px; }
.kv-value.mono {
    font-family: 'OCR A', monospace;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--color-ink-strong);
}
```

### 7-3. 커플 네임 블록
```html
<div class="couple">
    <div class="couple-side">
        <h1 class="couple-name">박 순 욱</h1>
        <p class="couple-sub mono">PARK / SOONWOOK</p>
    </div>
    <img class="couple-heart" src="assets/icons/heart.svg" alt="">
    <div class="couple-side">
        <h1 class="couple-name">양 소 희</h1>
        <p class="couple-sub mono">YANG / SOHEE</p>
    </div>
</div>
```
```css
.couple { display: flex; align-items: center; justify-content: space-around; gap: 16px; }
.couple-heart { width: 28px; height: 28px; color: var(--color-mint); }
```

### 7-4. 캘린더 위젯
- 7x5/6 그리드, 헤더 S/M/T/W/T/F/S
- 일/토 색상 포인트
- 결혼일에 **민트 원 + 하얀 숫자** 오버레이

```css
.calendar { font-family: 'OCR A', monospace; font-size: 14px; }
.calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px 10px; }
.calendar-head.sun { color: var(--color-weekday-sun); }
.calendar-head.sat { color: var(--color-weekday-sat); }
.calendar-day.wedding {
    background: var(--color-mint-pale);
    color: var(--color-ink-strong);
    border-radius: 50%;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    width: 28px; height: 28px;
}
```

### 7-5. Chevron 바 (Marquee)
```html
<div class="rail">
    <span>&gt;&gt;&gt;&gt;&gt;&gt; WEDDING_PASS &gt;&gt;&gt;&gt; 2026_09_20 &gt;&gt;&gt;&gt; NAMSAN_ARTS_WEDDING_HALL &gt;&gt;&gt;&gt;&gt;&gt;</span>
</div>
```
옵션: 긴 텍스트라면 `animation: marquee 25s linear infinite` 로 흐르게.

### 7-6. CTA 버튼 (기존 `.btn-upload` 재사용)
- 기존 스타일 민트 배경 + 흰 글자 유지
- 추가로 모노 라벨 버튼 변형:
```css
.btn-mono {
    font-family: 'OCR A', monospace;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    padding: 12px 32px;
    background: var(--color-ink-strong);
    color: #fff;
    border: none;
    border-radius: 2px;
}
```

---

## 8. 모바일 적응 전략

| 요소 | 데스크톱 (실물 청첩장) | 모바일 웹 |
|------|----------------------|-----------|
| 듀얼 패널 | 좌우 배치 | **세로 스택** (상단 본권 → 하단 민트) |
| 우측 스터브 | 항공권 절취선 | 별도 "EVENT_DETAILS" 카드로 분리 |
| 사이드 레일 | 세로 회전 텍스트 | **모바일 생략** (≤768px) / 또는 최상단·최하단 수평 레일로 변환 |
| Chevron 바 | 정적 | **marquee 애니메이션** 가능 |
| 캘린더 | 인쇄 정적 | 클릭 시 D-day 강조, 탭하면 .ics 다운로드 트리거 |
| QR | 정적 이미지 | **버튼/링크** 로 대체 (이미 `share-link`, `btn-upload` 등 존재) |

### 브레이크포인트 (권장)
```css
/* 기본: ≤480px (하객 주력 환경) */
/* 태블릿: 481-768px — 약간 여유 공간 */
/* 데스크톱: ≥769px — 사이드 레일 노출 */
```

---

## 9. 페이지 섹션별 적용 가이드

현재 [index.html](index.html) 의 섹션 구조 기준:

| 섹션 | 실물 시안 매핑 | 디자인 방향 |
|------|----------------|-------------|
| `hero` | 상단 본권 전체 | 듀얼 패널 상단 — 커플 이름 + 영문 부제 + chevron rail |
| `greeting` | (시안 하단 인사말) | 민트 배경 블록 + "JOIN US FOR OUR FIRST FLIGHT!" 헤드라인 |
| `info` (예식 안내) | `DATE & TIME`, `VENUE` 블록 | 모노 라벨 + 값, 수평 분할선 |
| `gallery` | — (시안 외) | OCR 라벨 "OUR_STORY" 정도로 꾸미기 |
| `location` (오시는 길) | `VENUE` 스터브 + QR "오시는 길" | chevron rail + 지도 버튼들 |
| `contacts` | 기존 유지 | 모노 라벨 + 접힘 토글 |
| `photo-link` | "모바일 청첩장" QR 대체 | `btn-mono` 스타일 CTA |
| `account` | 기존 유지 | 모노 라벨 통일 |
| `share` | "SAVE_THE_DATE!" | chevron 대형 헤드라인 |
| `flower` | 비행기 아이콘 활용 여지 | — |

---

## 10. 자산 체크리스트 & 추가 필요 자산

### 이미 있음
- [x] OCR-A 폰트 (`assets/fonts/ocr-a-regular.otf`)
- [x] heart, plane, flight-takeoff, engagement-ring SVG
- [x] favicon 세트 (`assets/icons/favicon/`)
- [x] Tiffany 계열 팔레트 기 반영 (`#81C7C0`, `#B8E0DB`, `#F2FCFB`)

### 추가로 준비하면 좋은 것
- [ ] **hero 배경 이미지** (실물 티켓 느낌의 뉴트럴 배경) — Storage `/invitation/hero.jpeg` 에 아날로그 톤 사진
- [ ] **체크-인 도장** SVG (`stamp.svg`) — "SAVE THE DATE" 근처 포인트
- [ ] **perforation 점선** SVG 또는 CSS 패턴 — 패널 간 분리
- [ ] **웨딩 홀 로고/약도 SVG** — `VENUE` 섹션 시각화

---

## 11. 데모/참고 키워드

- "Boarding pass wedding invitation"
- "Airline ticket save the date"
- "OCR-A typography minimalist"
- "Marquee chevron web design"

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-04-18 | 초안 작성 (실물 시안 기반) |
