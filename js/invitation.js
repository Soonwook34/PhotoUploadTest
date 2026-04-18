import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { db } from './firebase-config.js';
import {
  formatDate, formatDateShort, getDday,
  generateICS, downloadICS,
  buildMapUrl, copyToClipboard, showToast,
  loadInvitationImage, loadGalleryImages
} from './utils.js';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

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
  $('[data-bind="couple-names"]').innerHTML =
    `${groom.name} <span class="amp">&amp;</span> ${bride.name}`;
  $('[data-bind="wedding-date"]').textContent = formatDate(wedding.date);

  const heroImage = $('[data-bind="hero-image"]');
  if (heroUrl) {
    heroImage.style.backgroundImage = `url(${heroUrl})`;
    heroImage.classList.add('loaded');
    heroImage.querySelector('span')?.remove();
  }
}

function renderGreeting(data) {
  const { groom, bride, greeting } = data;
  $('[data-bind="greeting-title"]').textContent = greeting?.title || '초대합니다';
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
  $('[data-bind="info-date"]').textContent = formatDate(wedding.date);
  $('[data-bind="info-venue"]').textContent =
    `${wedding.venue.name}${wedding.venue.hall ? ' ' + wedding.venue.hall : ''}`;
  $('[data-bind="info-address"]').textContent = wedding.venue.address;

  if (wedding.venue.tel) {
    const venueTel = $('[data-bind="venue-tel"]');
    if (venueTel) {
      venueTel.href = `tel:${formatPhoneNumber(wedding.venue.tel)}`;
      venueTel.textContent = wedding.venue.tel;
      venueTel.parentElement.style.display = '';
    }
  }
}

function renderTransport(data) {
  const container = $('[data-bind="transport-list"]');
  if (!container) return;
  container.innerHTML = '';
  (data.transport || []).forEach((item) => {
    const el = document.createElement('div');
    el.className = 'transport-item';
    el.innerHTML = `
      <h3>${item.label}</h3>
      <p>${item.desc}</p>
    `;
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
  const groups = [
    { title: '신랑측', people: [
      { label: groom.name + ' (신랑)', phone: groom.phone },
      { label: formatParentName(groom.father) + ' (아버지)', phone: groom.father?.phone, hidden: groom.father?.deceased },
      { label: formatParentName(groom.mother) + ' (어머니)', phone: groom.mother?.phone, hidden: groom.mother?.deceased }
    ]},
    { title: '신부측', people: [
      { label: bride.name + ' (신부)', phone: bride.phone },
      { label: formatParentName(bride.father) + ' (아버지)', phone: bride.father?.phone, hidden: bride.father?.deceased },
      { label: formatParentName(bride.mother) + ' (어머니)', phone: bride.mother?.phone, hidden: bride.mother?.deceased }
    ]}
  ];

  container.innerHTML = '';
  groups.forEach((group) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'contact-group';
    const title = document.createElement('h3');
    title.textContent = group.title;
    wrapper.appendChild(title);

    group.people.forEach((p) => {
      if (!p.phone || p.hidden) return;
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
      wrapper.appendChild(row);
    });
    container.appendChild(wrapper);
  });
}

function renderAccounts(data) {
  const container = $('[data-bind="accounts"]');
  if (!container) return;
  const canCopy = data.features?.accountCopy !== false;

  const groups = [
    { title: '신랑측', accounts: data.groom.accounts || [] },
    { title: '신부측', accounts: data.bride.accounts || [] }
  ];

  container.innerHTML = '';
  groups.forEach((group) => {
    if (group.accounts.length === 0) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'account-group';
    const title = document.createElement('h3');
    title.textContent = group.title;
    wrapper.appendChild(title);

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
      wrapper.appendChild(row);
    });
    container.appendChild(wrapper);
  });
}

function renderGallery(urls) {
  const container = $('[data-bind="gallery"]');
  if (!container) return;
  if (!urls || urls.length === 0) {
    container.closest('section')?.style?.setProperty('display', 'none');
    return;
  }
  container.innerHTML = '';
  urls.forEach((url) => {
    const img = document.createElement('img');
    img.src = url;
    img.loading = 'lazy';
    img.alt = '';
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

function renderShareButtons(data) {
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
        const ics = generateICS(wedding, share.title || '결혼식');
        downloadICS(ics, 'wedding.ics');
      });
    } else {
      calBtn.style.display = 'none';
    }
  }

  const kakaoBtn = $('[data-bind="share-kakao"]');
  if (kakaoBtn) {
    // Kakao SDK 연동은 features.kakaoShare + Kakao JS 키 세팅 시 활성화
    // 현재는 버튼 숨김 (추후 확장 지점)
    kakaoBtn.style.display = features?.kakaoShare ? '' : 'none';
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
      loadInvitationImage('invitation/hero.jpg'),
      loadInvitationImage('invitation/og.jpg'),
      loadGalleryImages()
    ]);

    toggleSections(data);
    renderHero(data, heroUrl);
    renderDday(data);
    renderGreeting(data);
    renderWeddingInfo(data);
    renderTransport(data);
    renderMapApps(data);
    renderContacts(data);
    renderAccounts(data);
    renderGallery(galleryUrls);
    renderShareButtons(data);
    renderExternalLinks(data);
    injectOGTags(data, ogUrl);

    if (loading) loading.style.display = 'none';
    if (invitation) invitation.classList.add('loaded');
  } catch (err) {
    console.error('청첩장 로드 실패:', err);
    showError('네트워크 오류가 발생했습니다');
  }
}

init();
