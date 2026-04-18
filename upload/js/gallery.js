import {
  collection, query, orderBy, limit, startAfter, getDocs, getCountFromServer
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { db } from './firebase-config.js';

export const INITIAL_PAGE_SIZE = 20;
export const MORE_PAGE_SIZE = 15;
const PHOTOS_COLLECTION = 'photos';

/**
 * 사진 목록을 Firestore에서 가져옵니다.
 * @param {*} lastDoc - 페이지네이션 커서
 * @param {number} pageSize - 가져올 개수
 * @returns {Promise<{items: Array, lastDoc: *, hasMore: boolean}>}
 */
export async function loadPhotos(lastDoc = null, pageSize = INITIAL_PAGE_SIZE) {
  const constraints = [orderBy('createdAt', 'desc')];

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  constraints.push(limit(pageSize));

  const q = query(collection(db, PHOTOS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  const items = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  return {
    lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
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
 * <img>를 DOM에 직접 삽입하여 imagesLoaded가 추적 가능하게 함.
 */
export function renderGalleryItem(item) {
  const div = document.createElement('div');
  div.className = 'gallery-item';
  div.dataset.id = item.id;
  div.dataset.contentType = item.contentType || '';

  const uploaderTag = item.uploaderName && item.uploaderName !== 'anonymous'
    ? `<span class="uploader-tag">${escapeHtml(item.uploaderName)}</span>` : '';

  if (item.contentType?.startsWith('video/')) {
    if (item.thumbnailUrl) {
      div.innerHTML = `<img src="${item.thumbnailUrl}" alt="" draggable="false">
        <div class="video-overlay"><div class="play-icon"></div></div>${uploaderTag}`;
      div.querySelector('img').onload = () => div.classList.add('loaded');
    } else {
      div.innerHTML = `<video src="${item.url}#t=0.001" preload="metadata" playsinline muted></video>
        <div class="video-overlay"><div class="play-icon"></div></div>${uploaderTag}`;
      div.querySelector('video').onloadeddata = () => div.classList.add('loaded');
    }
  } else {
    const src = item.thumbnailUrl || item.url;
    div.innerHTML = `<img src="${src}" alt="" draggable="false">${uploaderTag}`;
    div.querySelector('img').onload = () => div.classList.add('loaded');
  }

  return div;
}

/**
 * 배경 갤러리에 사진을 렌더링합니다.
 */
export function renderBackgroundGallery(items, container) {
  container.innerHTML = '';

  if (items.length === 0) return;

  const images = items
    .filter(item => item.contentType && item.contentType.startsWith('image/'));

  if (images.length === 0) return;

  // 뷰포트를 채울 수 있도록 필요한 이미지 수 계산 (정사각형 셀 기준, 약간 넘치게)
  const gap = 4;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const cols = vw >= 768 ? 4 : 3;
  const cellSize = (vw - gap * (cols - 1)) / cols;
  const rows = Math.ceil((vh + gap) / (cellSize + gap));
  const needed = rows * cols;

  const selected = images.slice(0, needed);

  for (let i = 0; i < selected.length; i++) {
    const img = document.createElement('img');
    img.src = selected[i].thumbnailUrl || selected[i].url;
    img.alt = '';
    img.draggable = false;
    // 이미지 로드 완료 시 개별 fade-in (순서대로 약간의 딜레이)
    img.onload = () => {
      setTimeout(() => img.classList.add('loaded'), i * 60);
    };
    container.appendChild(img);
  }
}

export { Lightbox } from '../../shared/lightbox.js';

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
