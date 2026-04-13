import { ensureAuth } from './firebase-config.js';
import { validateFiles, generateThumbnail, uploadAll, getUploadedCount } from './upload.js';
import { loadPhotos, getPhotoCount, renderGalleryItem, renderBackgroundGallery, Lightbox } from './gallery.js';

// === State ===
let currentUser = null;
let currentScreen = 'landing';
let selectedFiles = [];
let galleryItems = [];
let galleryLoadedIds = new Set();
let galleryLastDoc = null;
let galleryHasMore = false;
let galleryFilter = 'all';
let isUploading = false;
let isLoadingGallery = false;

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
    galleryLoading.hidden = false;
    galleryEmpty.hidden = true;
    btnLoadMore.hidden = true;
    loadGallery(true);
  }
}

// === Initialize ===
async function init() {
  try {
    currentUser = await ensureAuth();

    // 배경 갤러리 + 사진 수를 병렬 로드
    const [{ items }, count] = await Promise.all([
      loadPhotos('all', null, 12),
      getPhotoCount()
    ]);
    renderBackgroundGallery(items, bgGallery);
    if (count > 0) {
      photoCount.textContent = `지금까지 ${count}장의 사진이 공유되었습니다`;
    }

    // 로딩 화면 제거
    loadingScreen.classList.remove('active');
    screens.landing.classList.add('active');
    currentScreen = 'landing';
  } catch (error) {
    console.error('Initialization failed:', error);
    loadingScreen.querySelector('.loading-text').textContent =
      '초기화에 실패했습니다. 페이지를 새로고침해 주세요.';
  }
}

// === Event Listeners ===

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

// Clear files
document.getElementById('btn-clear-files').addEventListener('click', () => {
  selectedFiles = [];
  renderPreviews();
});

// Start upload
btnStartUpload.addEventListener('click', startUpload);

// Gallery filters - 클라이언트 사이드 필터링 (서버 재로드 없음)
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
  const toAdd = valid.slice(0, Math.max(0, remaining));

  if (toAdd.length < valid.length) {
    showToast(`최대 업로드 수를 초과하여 ${toAdd.length}개만 추가됩니다.`, 'error');
  }

  selectedFiles = [...selectedFiles, ...toAdd];
  renderPreviews();
}

function revokePreviewUrls() {
  // blob URL이 더 이상 생성되지 않으므로 no-op
}

function renderPreviews() {
  revokePreviewUrls();

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
    if (!div || !thumb.url) return;
    const skeleton = div.querySelector('.skeleton');
    if (!skeleton) return;

    if (thumb.type === 'video') {
      const placeholder = document.createElement('div');
      placeholder.className = 'video-placeholder';
      placeholder.innerHTML = '<div class="play-icon"></div>';
      skeleton.replaceWith(placeholder);
    } else {
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
    onFileProgress: (index, progress) => {
      // 개별 파일 진행률은 UI에 반영하지 않음 (전체 프로그레스 바로 충분)
    },
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
  revokePreviewUrls();
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

// 서버에서 데이터 로드 (필터 없이 전체 로드, 클라이언트에서 필터링)
async function loadGallery(reset = false) {
  if (isLoadingGallery) return;
  isLoadingGallery = true;

  if (reset) {
    galleryItems = [];
    galleryLoadedIds = new Set();
    galleryLastDoc = null;
    galleryHasMore = false;
  }

  try {
    const { lastDoc, items, hasMore } = await loadPhotos(
      'all',
      galleryLastDoc
    );

    galleryLastDoc = lastDoc;
    galleryHasMore = hasMore;

    // 중복 제거
    const newItems = items.filter(item => !galleryLoadedIds.has(item.id));
    newItems.forEach(item => galleryLoadedIds.add(item.id));
    galleryItems = [...galleryItems, ...newItems];
  } catch (error) {
    console.error('Gallery load failed:', error);
    showToast('사진을 불러올 수 없습니다. 다시 시도해 주세요.', 'error');
  } finally {
    isLoadingGallery = false;
  }

  applyGalleryFilter();
}

// 클라이언트 사이드 필터링 + DOM 렌더링
function applyGalleryFilter() {
  galleryGrid.innerHTML = '';

  let filtered = galleryItems;
  if (galleryFilter === 'image') {
    filtered = galleryItems.filter(item => item.contentType && item.contentType.startsWith('image/'));
  } else if (galleryFilter === 'video') {
    filtered = galleryItems.filter(item => item.contentType && item.contentType.startsWith('video/'));
  }

  if (filtered.length === 0) {
    galleryEmpty.hidden = false;
    galleryLoading.hidden = true;
    btnLoadMore.hidden = true;
    return;
  }

  galleryEmpty.hidden = true;
  galleryLoading.hidden = true;

  filtered.forEach((item, i) => {
    const el = renderGalleryItem(item, i);
    el.addEventListener('click', () => {
      const idx = filtered.findIndex(gi => gi.id === item.id);
      lightbox.open(filtered, idx >= 0 ? idx : 0);
    });
    galleryGrid.appendChild(el);
  });

  btnLoadMore.hidden = !galleryHasMore;
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

// === Utility ===
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// === Start ===
init();
