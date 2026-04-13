import {
  collection, query, orderBy, limit, startAfter, getDocs, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { db } from './firebase-config.js';

const PAGE_SIZE = 20;
const PHOTOS_COLLECTION = 'photos';

/**
 * 사진 목록을 Firestore에서 가져옵니다.
 * @param {'all'|'image'|'video'} filter
 * @param {*} lastDoc - 페이지네이션 커서
 * @returns {Promise<{docs: Array, items: Array, hasMore: boolean}>}
 */
export async function loadPhotos(filter = 'all', lastDoc = null, pageSize = PAGE_SIZE) {
  const constraints = [
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  ];

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  const q = query(collection(db, PHOTOS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  let items = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  // 클라이언트 사이드 필터링 (Firestore 복합 인덱스 불필요)
  if (filter === 'image') {
    items = items.filter(item => item.contentType && item.contentType.startsWith('image/'));
  } else if (filter === 'video') {
    items = items.filter(item => item.contentType && item.contentType.startsWith('video/'));
  }

  return {
    docs: snapshot.docs,
    items,
    hasMore: snapshot.docs.length === pageSize
  };
}

/**
 * 전체 사진 수를 가져옵니다.
 */
export async function getPhotoCount() {
  try {
    const coll = collection(db, PHOTOS_COLLECTION);
    const snapshot = await getCountFromServer(coll);
    return snapshot.data().count;
  } catch {
    return 0;
  }
}

/**
 * 갤러리 아이템 DOM 요소를 생성합니다.
 */
export function renderGalleryItem(item, index) {
  const div = document.createElement('div');
  div.className = 'gallery-item';
  div.style.animationDelay = `${index * 50}ms`;
  div.dataset.id = item.id;

  if (item.contentType && item.contentType.startsWith('video/')) {
    div.innerHTML = `
      <video src="${item.url}" preload="metadata" playsinline muted></video>
      <div class="video-overlay">
        <div class="play-icon"></div>
      </div>
      ${item.uploaderName && item.uploaderName !== 'anonymous'
        ? `<span class="uploader-tag">${escapeHtml(item.uploaderName)}</span>` : ''}
    `;
  } else {
    div.innerHTML = `
      <img src="${item.thumbnailUrl || item.url}" alt="" loading="lazy">
      ${item.uploaderName && item.uploaderName !== 'anonymous'
        ? `<span class="uploader-tag">${escapeHtml(item.uploaderName)}</span>` : ''}
    `;
  }

  return div;
}

/**
 * 배경 갤러리에 사진을 렌더링합니다.
 */
export function renderBackgroundGallery(items, container) {
  container.innerHTML = '';

  if (items.length === 0) return;

  // 최대 12장, 이미지만
  const images = items
    .filter(item => item.contentType && item.contentType.startsWith('image/'))
    .slice(0, 12);

  for (const item of images) {
    const img = document.createElement('img');
    img.src = item.thumbnailUrl || item.url;
    img.alt = '';
    img.loading = 'lazy';
    container.appendChild(img);
  }

  container.classList.add('loaded');
}

/**
 * 라이트박스 관리
 */
export class Lightbox {
  constructor() {
    this.el = document.getElementById('lightbox');
    this.contentEl = document.getElementById('lightbox-content');
    this.infoEl = document.getElementById('lightbox-info');
    this.items = [];
    this.currentIndex = 0;

    // 터치 스와이프
    this.touchStartX = 0;
    this.touchEndX = 0;

    this._bindEvents();
  }

  _bindEvents() {
    document.getElementById('lightbox-close').addEventListener('click', () => this.close());
    document.getElementById('lightbox-prev').addEventListener('click', () => this.prev());
    document.getElementById('lightbox-next').addEventListener('click', () => this.next());

    // 배경 클릭으로 닫기
    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });

    // 키보드 네비게이션
    document.addEventListener('keydown', (e) => {
      if (!this.el.classList.contains('active')) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
    });

    // 터치 스와이프
    this.contentEl.addEventListener('touchstart', (e) => {
      this.touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    this.contentEl.addEventListener('touchend', (e) => {
      this.touchEndX = e.changedTouches[0].screenX;
      const diff = this.touchStartX - this.touchEndX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) this.next();
        else this.prev();
      }
    }, { passive: true });
  }

  open(items, index) {
    this.items = items;
    this.currentIndex = index;
    this._render();
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('active'));
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.el.classList.remove('active');
    setTimeout(() => {
      this.el.hidden = true;
      this.contentEl.innerHTML = '';
    }, 300);
    document.body.style.overflow = '';
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this._render();
    }
  }

  next() {
    if (this.currentIndex < this.items.length - 1) {
      this.currentIndex++;
      this._render();
    }
  }

  _render() {
    const item = this.items[this.currentIndex];
    if (!item) return;

    if (item.contentType && item.contentType.startsWith('video/')) {
      this.contentEl.innerHTML = `<video src="${item.url}" controls playsinline autoplay></video>`;
    } else {
      this.contentEl.innerHTML = `<img src="${item.url}" alt="">`;
    }

    const name = item.uploaderName && item.uploaderName !== 'anonymous'
      ? item.uploaderName : '';
    const date = item.createdAt?.toDate
      ? formatDate(item.createdAt.toDate())
      : '';

    this.infoEl.textContent = [name, date].filter(Boolean).join(' · ');

    // 네비게이션 버튼 표시/숨기기
    document.getElementById('lightbox-prev').style.display =
      this.currentIndex > 0 ? '' : 'none';
    document.getElementById('lightbox-next').style.display =
      this.currentIndex < this.items.length - 1 ? '' : 'none';
  }
}

function formatDate(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${m}월 ${d}일 ${h}:${min}`;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
