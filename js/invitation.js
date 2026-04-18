import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { db } from './firebase-config.js';
import {
  formatDateMono, getDday,
  toJsDate,
  generateICS, downloadICS,
  buildMapUrl, copyToClipboard, showToast,
  loadInvitationImageFallback, loadGalleryImages
} from './utils.js';
import { Lightbox } from '../shared/lightbox.js';
import { hydrateIcons } from './icons.js';

let lightbox = null;

const $ = (sel) => document.querySelector(sel);

const DEFAULT_LABELS = {
  heroLabel: 'WEDDING_INVITATION',
  greetingLabel: 'GREETING',
  greetingHeadline: 'JOIN US FOR OUR FIRST FLIGHT',
  eventDetailsLabel: 'EVENT_DETAILS',
  storyLabel: 'OUR_STORY',
  directionsLabel: 'DIRECTIONS',
  contactsLabel: 'CONTACTS',
  uploadLabel: 'UPLOAD_YOUR_PHOTOS',
  uploadSub: '소중한 사진과 영상을 함께 남겨주세요',
  uploadCta: 'UPLOAD',
  accountsLabel: 'ACCOUNTS',
  accountsSub: '축하의 마음을 전해 주세요',
  shareHeadline: 'SAVE_THE_DATE',
  shareCalendarCta: 'ADD_TO_CALENDAR',
  shareLinkCta: 'COPY_LINK',
  shareKakaoCta: 'KAKAO_SHARE',
  thankYouLabel: 'THANK_YOU',
  thankYouText: '함께해 주셔서 감사합니다'
};

function renderLabels(data) {
  const labels = { ...DEFAULT_LABELS, ...(data.design?.labels || {}) };
  document.querySelectorAll('[data-bind-label]').forEach((el) => {
    const key = el.dataset.bindLabel;
    if (labels[key] != null) el.textContent = labels[key];
  });
}

function formatParentName(parent) {
  if (!parent || !parent.name) return '';
  return parent.deceased ? `故 ${parent.name}` : parent.name;
}

function formatPhoneNumber(raw) {
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  return digits;
}

function renderHero(data, heroUrl) {
  const { groom, bride, wedding } = data;
  const spaced = (s) => [...(s || '')].join(' ');
  $('[data-bind="groom-name"]').textContent = spaced(groom.name);
  $('[data-bind="bride-name"]').textContent = spaced(bride.name);
  $('[data-bind="groom-sub"]').textContent =
    `${(groom.surnameEn || '').toUpperCase()} / ${(groom.nameEn || '').toUpperCase()}`;
  $('[data-bind="bride-sub"]').textContent =
    `${(bride.surnameEn || '').toUpperCase()} / ${(bride.nameEn || '').toUpperCase()}`;
  $('[data-bind="hero-date-mono"]').textContent = formatDateMono(wedding.date);

  const heroImage = $('[data-bind="hero-image"]');
  if (heroUrl) {
    heroImage.style.backgroundImage = `url(${heroUrl})`;
    heroImage.classList.add('loaded');
    heroImage.querySelector('span')?.remove();
  }
}

function renderGreeting(data) {
  const { groom, bride, greeting } = data;
  $('[data-bind="greeting-body"]').textContent = greeting?.body || '';

  const groomParents = [formatParentName(groom.father), formatParentName(groom.mother)]
    .filter(Boolean).join(' · ');
  const brideParents = [formatParentName(bride.father), formatParentName(bride.mother)]
    .filter(Boolean).join(' · ');

  $('[data-bind="groom-parents"]').innerHTML =
    `${groomParents} 의 ${groom.rank} <strong>${groom.name}</strong>`;
  $('[data-bind="bride-parents"]').innerHTML =
    `${brideParents} 의 ${bride.rank} <strong>${bride.name}</strong>`;
}

function renderWeddingInfo(data) {
  const { wedding } = data;
  const d = toJsDate(wedding.date);
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const h = d.getHours();
  const m = d.getMinutes();
  const hour12 = h % 12 || 12;
  const ampm = h < 12 ? 'AM' : 'PM';
  $('[data-bind="info-date-mono"]').textContent = `${yy}·${mm}·${dd}`;
  $('[data-bind="info-time-mono"]').textContent =
    `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${ampm}`;
  $('[data-bind="info-venue"]').textContent =
    `${wedding.venue.name}${wedding.venue.hall ? ' ' + wedding.venue.hall : ''}`;
  $('[data-bind="info-address"]').textContent = wedding.venue.address || '';
}

function renderCalendar(data) {
  const el = $('[data-bind="calendar"]');
  if (!el) return;
  const d = toJsDate(data.wedding.date);
  if (!d) return;
  const year = d.getFullYear();
  const month = d.getMonth();
  const weddingDay = d.getDate();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startCol = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const heads = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  let html = `<p class="cal-title">${monthNames[month]} ${year}</p>`;
  html += `<div class="cal-grid">`;
  heads.forEach((h, i) => {
    const cls = i === 0 ? 'sun' : i === 6 ? 'sat' : '';
    html += `<div class="cal-head ${cls}">${h}</div>`;
  });
  for (let i = 0; i < startCol; i++) html += `<div class="cal-day empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const col = (startCol + day - 1) % 7;
    const cls = [
      day === weddingDay ? 'wedding' : '',
      col === 0 ? 'sun' : '',
      col === 6 ? 'sat' : ''
    ].filter(Boolean).join(' ');
    html += `<div class="cal-day ${cls}">${day}</div>`;
  }
  html += `</div>`;
  el.innerHTML = html;
}

const TRANSPORT_LABEL_MAP = { subway: 'SUBWAY', bus: 'BUS', car: 'CAR', walk: 'WALK' };

function renderTransport(data) {
  const container = $('[data-bind="transport-list"]');
  if (!container) return;
  container.innerHTML = '';
  (data.transport || []).forEach((item) => {
    const el = document.createElement('div');
    el.className = 'transport-item';
    const h3 = document.createElement('h3');
    h3.textContent = TRANSPORT_LABEL_MAP[item.type] || (item.label || '').toUpperCase();
    const p = document.createElement('p');
    p.textContent = item.desc || '';
    el.append(h3, p);
    container.appendChild(el);
  });
}

function renderMapApps(data) {
  const section = $('[data-bind="map-apps"]');
  if (!section) return;
  if (!data.features?.mapApps) {
    section.style.display = 'none';
    return;
  }
  const apps = [
    { key: 'naver', label: '네이버지도' },
    { key: 'kakao', label: '카카오맵' },
    { key: 'tmap', label: '티맵' }
  ];
  section.innerHTML = '';
  apps.forEach(({ key, label }) => {
    const btn = document.createElement('a');
    btn.className = 'map-btn';
    btn.href = buildMapUrl(key, data.wedding.venue);
    btn.textContent = label;
    section.appendChild(btn);
  });
}

function renderContacts(data) {
  const { groom, bride } = data;
  const container = $('[data-bind="contacts"]');
  if (!container) return;

  function renderRow(p) {
    if (!p.phone || p.hidden) return null;
    const row = document.createElement('div');
    row.className = 'contact-row';
    const tel = formatPhoneNumber(p.phone);
    row.innerHTML = `
      <span class="contact-label">${p.label}</span>
      <div class="contact-actions">
        <a class="contact-btn" href="tel:${tel}" aria-label="전화">전화</a>
        <a class="contact-btn" href="sms:${tel}" aria-label="문자">문자</a>
      </div>
    `;
    return row;
  }

  const groups = [
    {
      title: 'GROOM_SIDE',
      main: { label: groom.name + ' (신랑)', phone: groom.phone },
      parents: [
        { label: formatParentName(groom.father) + ' (아버지)', phone: groom.father?.phone, hidden: groom.father?.deceased },
        { label: formatParentName(groom.mother) + ' (어머니)', phone: groom.mother?.phone, hidden: groom.mother?.deceased }
      ]
    },
    {
      title: 'BRIDE_SIDE',
      main: { label: bride.name + ' (신부)', phone: bride.phone },
      parents: [
        { label: formatParentName(bride.father) + ' (아버지)', phone: bride.father?.phone, hidden: bride.father?.deceased },
        { label: formatParentName(bride.mother) + ' (어머니)', phone: bride.mother?.phone, hidden: bride.mother?.deceased }
      ]
    }
  ];

  container.innerHTML = '';
  groups.forEach((group) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'contact-group';
    const title = document.createElement('h3');
    title.textContent = group.title;
    wrapper.appendChild(title);

    const mainRow = renderRow(group.main);
    if (mainRow) wrapper.appendChild(mainRow);

    const parentRows = group.parents.map(renderRow).filter(Boolean);
    if (parentRows.length > 0) {
      const details = document.createElement('details');
      details.className = 'contact-parents';
      const summary = document.createElement('summary');
      summary.className = 'contact-parents-toggle';
      summary.innerHTML = '<span>혼주에게 연락</span><span class="chevron">›</span>';
      details.appendChild(summary);
      parentRows.forEach((r) => details.appendChild(r));
      wrapper.appendChild(details);
    }

    container.appendChild(wrapper);
  });
}

function renderAccounts(data) {
  const container = $('[data-bind="accounts"]');
  if (!container) return;
  const canCopy = data.features?.accountCopy !== false;

  const groups = [
    { title: 'GROOM', accounts: data.groom.accounts || [] },
    { title: 'BRIDE', accounts: data.bride.accounts || [] }
  ];

  container.innerHTML = '';
  groups.forEach((group) => {
    if (group.accounts.length === 0) return;
    const details = document.createElement('details');
    details.className = 'account-group';

    const summary = document.createElement('summary');
    summary.className = 'account-toggle';
    summary.innerHTML = `<span>${group.title}</span><span class="chevron">›</span>`;
    details.appendChild(summary);

    const rows = document.createElement('div');
    rows.className = 'account-rows';

    group.accounts.forEach((acc) => {
      const row = document.createElement('div');
      row.className = 'account-row';
      row.innerHTML = `
        <div class="account-info">
          <div class="account-label">${acc.label}</div>
          <div class="account-detail">${acc.bank} ${acc.number}</div>
          <div class="account-holder">예금주: ${acc.holder}</div>
        </div>
        ${canCopy ? '<button class="account-copy" type="button">복사</button>' : ''}
      `;
      if (canCopy) {
        row.querySelector('.account-copy').addEventListener('click', async () => {
          const ok = await copyToClipboard(acc.number);
          showToast(ok ? '계좌번호가 복사되었습니다' : '복사에 실패했습니다');
        });
      }
      rows.appendChild(row);
    });

    details.appendChild(rows);
    container.appendChild(details);
  });
}

function renderGallery(urls) {
  const container = $('[data-bind="gallery"]');
  if (!container) return;
  if (!urls || urls.length === 0) {
    container.closest('section')?.style?.setProperty('display', 'none');
    return;
  }
  const items = urls.map((url) => ({ url, contentType: 'image/jpeg' }));
  container.innerHTML = '';
  urls.forEach((url, index) => {
    const img = document.createElement('img');
    img.src = url;
    img.loading = 'lazy';
    img.alt = '';
    img.style.cursor = 'pointer';
    img.addEventListener('click', () => {
      if (!lightbox) lightbox = new Lightbox();
      lightbox.open(items, index);
    });
    container.appendChild(img);
  });
}

function renderDday(data) {
  const el = $('[data-bind="dday"]');
  if (!el) return;
  if (!data.features?.countdown) {
    el.style.display = 'none';
    return;
  }
  el.textContent = getDday(data.wedding.date);
}

function renderShareButtons(data, ogUrl) {
  const { features, share, wedding } = data;

  const linkBtn = $('[data-bind="share-link"]');
  if (linkBtn) {
    if (features?.linkShare) {
      linkBtn.addEventListener('click', async () => {
        const ok = await copyToClipboard(share.url || location.href);
        showToast(ok ? '링크가 복사되었습니다' : '복사에 실패했습니다');
      });
    } else {
      linkBtn.style.display = 'none';
    }
  }

  const calBtn = $('[data-bind="share-calendar"]');
  if (calBtn) {
    if (features?.addToCalendar) {
      calBtn.addEventListener('click', () => {
        const ics = generateICS(wedding, share.title || '결혼식', share.url);
        downloadICS(ics, 'wedding.ics');
      });
    } else {
      calBtn.style.display = 'none';
    }
  }

  const kakaoBtn = $('[data-bind="share-kakao"]');
  if (kakaoBtn) {
    const canKakao = !!features?.kakaoShare && !!window.Kakao?.isInitialized?.();
    if (canKakao) {
      kakaoBtn.style.display = '';
      kakaoBtn.addEventListener('click', () => {
        try {
          const content = {
            title: share.title || '결혼식 청첩장',
            description: share.description || '',
            link: {
              mobileWebUrl: share.url || location.href,
              webUrl: share.url || location.href
            }
          };
          if (ogUrl) content.imageUrl = ogUrl;
          window.Kakao.Share.sendDefault({ objectType: 'feed', content });
        } catch (e) {
          console.error('Kakao share failed:', e);
          showToast('카카오 공유에 실패했습니다');
        }
      });
    } else {
      kakaoBtn.style.display = 'none';
    }
  }
}

function renderExternalLinks(data) {
  const flowerBtn = $('[data-bind="flower-delivery"]');
  if (flowerBtn) {
    if (data.features?.flowerDelivery && data.externalLinks?.flowerDelivery) {
      flowerBtn.href = data.externalLinks.flowerDelivery;
    } else {
      flowerBtn.closest('section')?.style?.setProperty('display', 'none');
    }
  }

  const uploadBtn = $('[data-bind="upload-link"]');
  if (uploadBtn) {
    uploadBtn.href = data.externalLinks?.uploadPage || 'upload/';
  }
}

function injectOGTags(data, ogUrl) {
  const setMeta = (property, content) => {
    if (!content) return;
    let el = document.querySelector(`meta[property="${property}"]`);
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute('property', property);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };
  setMeta('og:title', data.share?.title);
  setMeta('og:description', data.share?.description);
  setMeta('og:url', data.share?.url);
  if (ogUrl) setMeta('og:image', ogUrl);
  document.title = data.share?.title || document.title;
}

function toggleSections(data) {
  const { features } = data;
  const section = (selector, visible) => {
    const el = $(selector);
    if (el) el.style.display = visible ? '' : 'none';
  };
  section('[data-section="countdown"]', !!features?.countdown);
  section('[data-section="gallery"]', true);
  section('[data-section="map-apps"]', !!features?.mapApps);
  section('[data-section="accounts"]', true);
  section('[data-section="guestbook"]', !!features?.guestbook);
  section('[data-section="rsvp"]', !!features?.rsvp);
  section('[data-section="charter-bus"]', !!features?.charterBus);
}

function showError(message) {
  const loading = $('#loading');
  if (loading) {
    loading.innerHTML = `
      <p style="color:#999;font-size:14px;">${message}</p>
      <button onclick="location.reload()" class="btn-retry">다시 시도</button>
    `;
  }
}

async function init() {
  const loading = $('#loading');
  const invitation = $('.invitation');
  try {
    const snap = await getDoc(doc(db, 'config', 'invitation'));
    if (!snap.exists()) {
      showError('청첩장 데이터를 불러올 수 없습니다');
      return;
    }
    const data = snap.data();

    const [heroUrl, ogUrl, galleryUrls] = await Promise.all([
      loadInvitationImageFallback('invitation/hero'),
      loadInvitationImageFallback('invitation/og'),
      loadGalleryImages()
    ]);

    if (data.share?.kakaoJsKey && window.Kakao && !window.Kakao.isInitialized()) {
      try {
        window.Kakao.init(data.share.kakaoJsKey);
      } catch (e) {
        console.warn('Kakao init failed:', e);
      }
    }

    toggleSections(data);
    renderLabels(data);
    renderHero(data, heroUrl);
    renderDday(data);
    renderGreeting(data);
    renderWeddingInfo(data);
    renderCalendar(data);
    renderTransport(data);
    renderMapApps(data);
    renderContacts(data);
    renderAccounts(data);
    renderGallery(galleryUrls);
    renderShareButtons(data, ogUrl);
    renderExternalLinks(data);
    injectOGTags(data, ogUrl);

    await hydrateIcons();

    if (loading) loading.style.display = 'none';
    if (invitation) invitation.classList.add('loaded');
  } catch (err) {
    console.error('청첩장 로드 실패:', err);
    showError('네트워크 오류가 발생했습니다');
  }
}

init();
