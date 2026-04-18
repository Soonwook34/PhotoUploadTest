import { ensureAuth, db } from './firebase-config.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { validateFiles, generateThumbnail, uploadAll, getUploadedCount } from './upload.js';
import { loadPhotos, getPhotoCount, renderGalleryItem, renderBackgroundGallery, Lightbox, INITIAL_PAGE_SIZE, MORE_PAGE_SIZE, escapeHtml } from './gallery.js';

// === Utilities ===
function withTimeout(promise, ms, message = 'Request timed out') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeoutId));
}

function formatDateLanding(value) {
  const d = value?.toDate ? value.toDate() : new Date(value);
  if (isNaN(d)) return '';
  const wd = ['일','월','화','수','목','금','토'][d.getDay()];
  return `${d.getFullYear()}. ${String(d.getMonth()+1).padStart(2,'0')}. ${String(d.getDate()).padStart(2,'0')}. ${wd}요일`;
}

function bindInvitation(data) {
  if (!data) return;
  const g = data.groom?.name || '';
  const b = data.bride?.name || '';
  if (g && b) {
    document.title = `${g} & ${b} 결혼식`;
    const names = document.querySelector('[data-bind="couple-names"]');
    if (names) names.innerHTML = `${g} <span class="heart">&amp;</span> ${b}`;
  }
  const dateStr = data.wedding?.date;
  if (dateStr) {
    const el = document.querySelector('[data-bind="wedding-date"]');
    if (el) el.textContent = formatDateLanding(dateStr);
  }
}

// === State ===
let currentUser = null;
let currentScreen = 'landing';
let selectedFiles = [];
let previewObjectURLs = [];
let galleryItems = [];
let galleryLoadedIds = new Set();
let galleryLastDoc = null;
let galleryHasMore = false;
let galleryFilter = 'all';
let isUploading = false;
let isLoadingGallery = false;
let masonryInstance = null;

// === DOM References ===
const loadingScreen = document.getElementById('loading-screen');
const offlineBanner = document.getElementById('offline-banner');
const screens = {
  landing: document.getElementById('screen-landing'),
  upload: document.getElementById('screen-upload'),
  gallery: document.getElementById('screen-gallery')
};

// Landing
const bgGallery = document.getElementById('bg-gallery');
const photoCount = document.getElementById('photo-count');

// Upload
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const uploaderNameInput = document.getElementById('uploader-name');
const filePreview = document.getElementById('file-preview');
const fileCountEl = document.getElementById('file-count');
const previewGrid = document.getElementById('preview-grid');
const btnStartUpload = document.getElementById('btn-start-upload');
const uploadProgress = document.getElementById('upload-progress');
const progressText = document.getElementById('progress-text');
const progressCount = document.getElementById('progress-count');
const progressBar = document.getElementById('progress-bar');
const progressFiles = document.getElementById('progress-files');
const uploadComplete = document.getElementById('upload-complete');
const completeMessage = document.getElementById('complete-message');

// Gallery
const galleryGrid = document.getElementById('gallery-grid');
const galleryEmpty = document.getElementById('gallery-empty');
const galleryLoading = document.getElementById('gallery-loading');
const btnLoadMore = document.getElementById('btn-load-more');

// Lightbox
const lightbox = new Lightbox();

// === Screen Management ===
function showScreen(name) {
  if (currentScreen === name) return;

  Object.entries(screens).forEach(([key, el]) => {
    el.classList.toggle('active', key === name);
  });

  currentScreen = name;

  if (name === 'gallery') {
    if (galleryItems.length > 0) {
      if (galleryGrid.children.length > 0) {
        applyGalleryFilter();
      } else {
        renderGalleryItems(galleryItems);
      }
    } else {
      showGalleryLoading();
      galleryEmpty.hidden = true;
      btnLoadMore.hidden = true;
      if (!isLoadingGallery) loadGallery(true);
    }
  }
}

// === Initialize ===
async function init() {
  const spinner = loadingScreen.querySelector('.loading-spinner');
  const text = loadingScreen.querySelector('.loading-text');
  const retryBtn = document.getElementById('btn-retry-init');

  // UI 초기화 (재시도 시)
  spinner.style.display = '';
  text.textContent = '잠시만 기다려 주세요';
  retryBtn.hidden = true;
  retryBtn.style.opacity = '0';

  // 8초 후 "느림" 힌트 + 재시도 버튼 페이드인 (스피너 유지)
  const slowTimer = setTimeout(() => {
    text.textContent = '연결이 느립니다...';
    retryBtn.hidden = false;
    requestAnimationFrame(() => {
      retryBtn.style.transition = 'opacity 0.5s ease';
      retryBtn.style.opacity = '1';
    });
  }, 8000);

  retryBtn.onclick = () => {
    clearTimeout(slowTimer);
    init();
  };

  try {
    currentUser = await withTimeout(ensureAuth(), 10_000, 'Auth timed out');

    // 배경 갤러리 + 사진 수 + 청첩장 설정(이름/날짜) 병렬 로드
    const [photosResult, count, invitationSnap] = await Promise.all([
      withTimeout(loadPhotos(null, INITIAL_PAGE_SIZE), 10_000, 'Photos load timed out'),
      withTimeout(getPhotoCount(), 5_000, 'Count timed out').catch(() => 0),
      withTimeout(getDoc(doc(db, 'config', 'invitation')), 5_000, 'Invitation config timed out').catch(() => null)
    ]);
    clearTimeout(slowTimer);

    renderBackgroundGallery(photosResult.items, bgGallery);
    if (count > 0) {
      photoCount.textContent = `지금까지 ${count}장의 사진이 공유되었습니다`;
    }
    if (invitationSnap?.exists()) bindInvitation(invitationSnap.data());

    // 갤러리 캐시에 저장 + 미리 렌더링 (갤러리 진입 시 즉시 표시)
    galleryItems = photosResult.items;
    photosResult.items.forEach(item => galleryLoadedIds.add(item.id));
    galleryLastDoc = photosResult.lastDoc;
    galleryHasMore = photosResult.hasMore;
    renderGalleryItems(galleryItems);

    // 로딩 화면 제거
    loadingScreen.classList.remove('active');
    screens.landing.classList.add('active');
    currentScreen = 'landing';
  } catch (error) {
    clearTimeout(slowTimer);
    console.error('Initialization failed:', error);
    spinner.style.display = 'none';
    text.textContent = '연결에 실패했습니다.';
    retryBtn.hidden = false;
    retryBtn.style.opacity = '1';
  }
}

// === Event Listeners ===

// 이미지 저장 방지 (우클릭 차단)
bgGallery.addEventListener('contextmenu', e => e.preventDefault());
galleryGrid.addEventListener('contextmenu', e => e.preventDefault());
lightbox.el.addEventListener('contextmenu', e => e.preventDefault());

// Navigation
document.getElementById('btn-upload').addEventListener('click', () => {
  resetUploadScreen();
  showScreen('upload');
});

document.getElementById('btn-gallery').addEventListener('click', () => {
  showScreen('gallery');
});

document.getElementById('btn-back-upload').addEventListener('click', () => {
  if (isUploading) return;
  showScreen('landing');
});

document.getElementById('btn-back-gallery').addEventListener('click', () => {
  showScreen('landing');
});

document.getElementById('btn-upload-more').addEventListener('click', () => {
  resetUploadScreen();
});

document.getElementById('btn-go-gallery').addEventListener('click', () => {
  showScreen('gallery');
});

// Drop Zone
dropZone.addEventListener('click', () => {
  fileInput.click();
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  handleFiles(e.dataTransfer.files);
});

fileInput.addEventListener('change', () => {
  handleFiles(fileInput.files);
  fileInput.value = '';
});

// Add more files
document.getElementById('btn-add-files').addEventListener('click', () => {
  fileInput.click();
});

// Clear files
document.getElementById('btn-clear-files').addEventListener('click', () => {
  selectedFiles = [];
  renderPreviews();
});

// Start upload
btnStartUpload.addEventListener('click', startUpload);

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('active')) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    galleryFilter = btn.dataset.filter;
    applyGalleryFilter();
  });
});

// Load more
btnLoadMore.addEventListener('click', () => {
  loadGallery(false);
});

// Offline detection
window.addEventListener('online', () => {
  offlineBanner.classList.remove('visible');
});

window.addEventListener('offline', () => {
  offlineBanner.classList.add('visible');
});

// === File Handling ===
async function handleFiles(fileList) {
  if (!currentUser) return;

  const { valid, errors } = validateFiles(fileList, currentUser.uid);

  // 에러 토스트 표시
  errors.forEach(err => showToast(err, 'error'));

  if (valid.length === 0) return;

  // 기존 선택에 추가 (50개 제한)
  const remaining = 50 - getUploadedCount(currentUser.uid) - selectedFiles.length;
  const sliced = valid.slice(0, Math.max(0, remaining));

  if (sliced.length < valid.length) {
    showToast(`최대 업로드 수를 초과하여 ${sliced.length}개만 추가됩니다.`, 'error');
  }

  // 중복 제거 (파일명 + 크기 + 수정일)
  const existingKeys = new Set(
    selectedFiles.map(f => `${f.name}_${f.size}_${f.lastModified}`)
  );
  const toAdd = sliced.filter(f => !existingKeys.has(`${f.name}_${f.size}_${f.lastModified}`));
  const dupCount = sliced.length - toAdd.length;
  if (dupCount > 0) {
    showToast(`이미 선택된 파일 ${dupCount}개를 제외했습니다.`);
  }

  if (toAdd.length === 0) return;

  const prevCount = selectedFiles.length;
  selectedFiles = [...selectedFiles, ...toAdd];
  renderPreviews();

  // 추가 선택 시 마지막 미리보기로 auto-scroll
  if (prevCount > 0) {
    requestAnimationFrame(() => {
      const lastPreview = previewGrid.lastElementChild;
      if (lastPreview) {
        lastPreview.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }
}

function renderPreviews() {
  // 이전 Object URL 해제
  previewObjectURLs.forEach(url => URL.revokeObjectURL(url));
  previewObjectURLs = [];

  if (selectedFiles.length === 0) {
    filePreview.hidden = true;
    dropZone.style.display = '';
    return;
  }

  dropZone.style.display = 'none';
  filePreview.hidden = false;

  const remaining = 50 - getUploadedCount(currentUser.uid);
  fileCountEl.textContent = `${selectedFiles.length}/${remaining} 선택됨`;

  previewGrid.innerHTML = '';

  // 1단계: 스켈레톤 플레이스홀더를 즉시 렌더링
  selectedFiles.forEach((file, i) => {
    const div = document.createElement('div');
    div.className = 'preview-item';
    div.id = `preview-${i}`;
    div.innerHTML = `
      <div class="skeleton" style="width:100%;height:100%"></div>
      ${file.type.startsWith('video/') ? '<span class="video-badge">영상</span>' : ''}
      <button class="preview-remove" data-index="${i}">&times;</button>
    `;
    previewGrid.appendChild(div);
  });

  // 삭제 버튼 이벤트 바로 연결
  previewGrid.querySelectorAll('.preview-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.dataset.index, 10);
      selectedFiles.splice(index, 1);
      renderPreviews();
    });
  });

  btnStartUpload.disabled = selectedFiles.length === 0;

  // 2단계: 썸네일을 병렬로 생성하여 스켈레톤 교체
  selectedFiles.forEach(async (file, i) => {
    const thumb = await generateThumbnail(file);
    const div = document.getElementById(`preview-${i}`);
    if (!div) return;
    const skeleton = div.querySelector('.skeleton');
    if (!skeleton) return;

    if (thumb.type === 'video-thumb' && thumb.url) {
      // canvas 추출 성공: <img>로 표시 (iOS 호환)
      const img = document.createElement('img');
      img.src = thumb.url;
      img.alt = '';
      skeleton.replaceWith(img);
    } else if (thumb.type === 'video') {
      if (thumb.url) {
        previewObjectURLs.push(thumb.url);
        const video = document.createElement('video');
        video.src = thumb.url + '#t=0.001';
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        skeleton.replaceWith(video);
      } else {
        const placeholder = document.createElement('div');
        placeholder.className = 'video-placeholder';
        placeholder.innerHTML = '<div class="play-icon"></div>';
        skeleton.replaceWith(placeholder);
      }
    } else {
      if (!thumb.url) return;
      const img = document.createElement('img');
      img.src = thumb.url;
      img.alt = '';
      skeleton.replaceWith(img);
    }
  });
}

// === Upload ===
async function startUpload() {
  if (!currentUser || selectedFiles.length === 0 || isUploading) return;

  isUploading = true;
  const uploaderName = uploaderNameInput.value.trim();
  const files = [...selectedFiles];

  // UI 전환
  filePreview.hidden = true;
  uploadProgress.hidden = false;
  uploadComplete.hidden = true;

  progressText.textContent = '업로드 중...';
  progressCount.textContent = `0/${files.length}`;
  progressBar.style.width = '0%';

  // 파일별 상태 UI 생성
  progressFiles.innerHTML = '';
  files.forEach((file, i) => {
    const item = document.createElement('div');
    item.className = 'progress-file-item';
    item.id = `progress-file-${i}`;
    item.innerHTML = `
      <span class="file-status"><span class="spinner-tiny"></span></span>
      <span class="file-name">${escapeHtml(file.name)}</span>
    `;
    progressFiles.appendChild(item);
  });

  let completedCount = 0;

  await uploadAll(files, currentUser.uid, uploaderName, {
    onFileProgress: () => {},
    onFileComplete: (index, success) => {
      completedCount++;
      const item = document.getElementById(`progress-file-${index}`);
      if (item) {
        item.querySelector('.file-status').innerHTML = success
          ? '<svg class="icon-check" viewBox="0 0 16 16"><path d="M3 8l4 4 6-7" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
          : '<svg class="icon-x" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
        item.classList.add(success ? 'done' : 'error');
      }
      progressCount.textContent = `${completedCount}/${files.length}`;
      progressText.textContent = `업로드 중... (${completedCount}/${files.length})`;
    },
    onOverallProgress: (progress) => {
      progressBar.style.width = `${Math.round(progress * 100)}%`;
    },
    onAllComplete: (successCount, failCount) => {
      isUploading = false;

      // 갤러리 캐시 무효화 (다음 진입 시 새로 로드)
      galleryItems = [];
      galleryLoadedIds = new Set();
      galleryLastDoc = null;
      galleryHasMore = false;
      if (masonryInstance) {
        masonryInstance.destroy();
        masonryInstance = null;
      }
      galleryGrid.innerHTML = '';

      // 완료 화면 표시
      uploadProgress.hidden = true;
      uploadComplete.hidden = false;

      if (failCount === 0) {
        completeMessage.textContent = `${successCount}장의 사진이 업로드되었습니다.`;
      } else {
        completeMessage.textContent =
          `${successCount}장 업로드 완료, ${failCount}장 실패`;
      }

      selectedFiles = [];
    }
  });
}

function resetUploadScreen() {
  selectedFiles = [];
  isUploading = false;

  dropZone.style.display = '';
  filePreview.hidden = true;
  uploadProgress.hidden = true;
  uploadComplete.hidden = true;
  previewGrid.innerHTML = '';
  progressFiles.innerHTML = '';
  progressBar.style.width = '0%';
  btnStartUpload.disabled = false;

  // 업로드 화면이 아직 아닌 경우 전환
  if (currentScreen !== 'upload') {
    showScreen('upload');
  }
}

// === Gallery ===

let galleryLoadingTimer = null;

function showGalleryLoading() {
  galleryLoading.hidden = false;
  clearTimeout(galleryLoadingTimer);
  galleryLoadingTimer = setTimeout(() => {
    hideGalleryLoading();
    if (galleryGrid.children.length === 0) {
      galleryEmpty.hidden = false;
    }
  }, 15000);
}

function hideGalleryLoading() {
  galleryLoading.hidden = true;
  clearTimeout(galleryLoadingTimer);
}

async function loadGallery(reset = false) {
  if (isLoadingGallery) return;
  isLoadingGallery = true;
  btnLoadMore.disabled = true;

  if (reset) {
    galleryItems = [];
    galleryLoadedIds = new Set();
    galleryLastDoc = null;
    galleryHasMore = false;
  }

  let newItems = [];
  try {
    const pageSize = reset ? INITIAL_PAGE_SIZE : MORE_PAGE_SIZE;
    const { lastDoc, items, hasMore } = await withTimeout(
      loadPhotos(galleryLastDoc, pageSize), 10_000, 'Gallery load timed out'
    );

    galleryLastDoc = lastDoc;
    galleryHasMore = hasMore;

    // 중복 제거
    newItems = items.filter(item => !galleryLoadedIds.has(item.id));
    newItems.forEach(item => galleryLoadedIds.add(item.id));
    galleryItems = [...galleryItems, ...newItems];
  } catch (error) {
    console.error('Gallery load failed:', error);
    showToast('사진을 불러올 수 없습니다. 다시 시도해 주세요.', 'error');
  } finally {
    isLoadingGallery = false;
    btnLoadMore.disabled = false;
    hideGalleryLoading();
    if (reset) {
      renderGalleryItems(galleryItems);
    } else {
      appendNewGalleryItems(newItems);
    }
  }
}

function initMasonry() {
  if (masonryInstance) masonryInstance.destroy();
  masonryInstance = new Masonry(galleryGrid, {
    itemSelector: '.gallery-item:not(.gallery-item-hidden)',
    percentPosition: true,
    gutter: 4,
    transitionDuration: '0.2s'
  });
  imagesLoaded(galleryGrid).on('progress', () => {
    if (masonryInstance) masonryInstance.layout();
  });
  // imagesLoaded는 <video>를 추적하지 못하므로 별도 처리
  galleryGrid.querySelectorAll('.gallery-item video').forEach(video => {
    video.addEventListener('loadeddata', () => {
      if (masonryInstance) masonryInstance.layout();
    }, { once: true });
  });
}

function renderGalleryItems(items) {
  if (masonryInstance) {
    masonryInstance.destroy();
    masonryInstance = null;
  }
  galleryGrid.innerHTML = '';
  items.forEach(item => {
    const el = renderGalleryItem(item);
    el.addEventListener('click', () => openLightboxForItem(item));
    galleryGrid.appendChild(el);
  });
  applyGalleryFilter();
  initMasonry();
}

function applyGalleryFilter() {
  let visibleCount = 0;
  galleryGrid.querySelectorAll('.gallery-item, .gallery-item-hidden').forEach(el => {
    const ct = el.dataset.contentType || '';
    const show = galleryFilter === 'all'
      || (galleryFilter === 'image' && ct.startsWith('image/'))
      || (galleryFilter === 'video' && ct.startsWith('video/'));
    if (show) {
      el.classList.remove('gallery-item-hidden');
      el.classList.add('gallery-item');
      visibleCount++;
    } else {
      el.classList.remove('gallery-item');
      el.classList.add('gallery-item-hidden');
    }
  });

  galleryEmpty.hidden = visibleCount > 0;
  hideGalleryLoading();
  btnLoadMore.hidden = !galleryHasMore;

  if (masonryInstance) {
    masonryInstance.reloadItems();
    masonryInstance.layout();
  }
}

// 더보기: 새 항목만 현재 그리드에 추가 (전체 재렌더링 없음)
function appendNewGalleryItems(items) {
  btnLoadMore.hidden = !galleryHasMore;
  if (items.length === 0) return;

  const newElements = [];
  items.forEach(item => {
    const el = renderGalleryItem(item);
    el.addEventListener('click', () => openLightboxForItem(item));
    galleryGrid.appendChild(el);
    newElements.push(el);
  });

  // 필터 적용 (숨길 항목은 gallery-item-hidden으로 전환)
  applyGalleryFilter();

  // 필터 통과한 새 요소만 Masonry에 등���
  const visibleNew = newElements.filter(el => el.classList.contains('gallery-item'));
  if (masonryInstance && visibleNew.length > 0) {
    imagesLoaded(visibleNew).on('progress', () => {
      if (masonryInstance) masonryInstance.layout();
    });
    // video 요소 별도 처리
    visibleNew.forEach(el => {
      const video = el.querySelector('video');
      if (video) {
        video.addEventListener('loadeddata', () => {
          if (masonryInstance) masonryInstance.layout();
        }, { once: true });
      }
    });
  }
}

// 라이트박스 열기 (현재 필터 기준 visible 아이템 목록 사용)
function openLightboxForItem(item) {
  const visibleItems = galleryItems.filter(it => {
    if (galleryFilter === 'image') return it.contentType?.startsWith('image/');
    if (galleryFilter === 'video') return it.contentType?.startsWith('video/');
    return true;
  });
  const idx = visibleItems.findIndex(gi => gi.id === item.id);
  lightbox.open(visibleItems, idx >= 0 ? idx : 0);
}

// === Toast ===
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// === Start ===
init();
