import { ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';
import { collection, addDoc, serverTimestamp, Timestamp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { storage, db } from './firebase-config.js';
import exifr from 'https://cdn.jsdelivr.net/npm/exifr/dist/lite.esm.js';

const MAX_FILES = 50;
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;  // 50MB
const MAX_VIDEO_SIZE = 1024 * 1024 * 1024;  // 1GB
const CONCURRENT_UPLOADS = 5;

/**
 * 이미 업로드한 파일 수를 가져옵니다.
 */
export function getUploadedCount(uid) {
  return parseInt(localStorage.getItem(`upload_count_${uid}`) || '0', 10);
}

function setUploadedCount(uid, count) {
  localStorage.setItem(`upload_count_${uid}`, String(count));
}

/**
 * 파일 목록을 검증합니다.
 * @returns {{ valid: File[], errors: string[] }}
 */
export function validateFiles(files, uid) {
  const valid = [];
  const errors = [];
  const currentCount = getUploadedCount(uid);
  const remaining = MAX_FILES - currentCount;

  if (remaining <= 0) {
    errors.push('이미 최대 업로드 수(50개)에 도달했습니다.');
    return { valid, errors };
  }

  const filesToProcess = Array.from(files).slice(0, remaining);

  if (files.length > remaining) {
    errors.push(`남은 업로드 가능 수는 ${remaining}개입니다. 처음 ${remaining}개만 선택됩니다.`);
  }

  for (const file of filesToProcess) {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      errors.push(`"${file.name}" - 사진 또는 영상 파일만 업로드할 수 있습니다.`);
      continue;
    }

    if (isImage && file.size > MAX_IMAGE_SIZE) {
      errors.push(`"${file.name}" - 이미지는 최대 50MB까지 가능합니다.`);
      continue;
    }

    if (isVideo && file.size > MAX_VIDEO_SIZE) {
      errors.push(`"${file.name}" - 영상은 최대 1GB까지 가능합니다.`);
      continue;
    }

    valid.push(file);
  }

  return { valid, errors };
}

const THUMB_MAX_SIZE = 1440;
const THUMB_QUALITY = 0.7;

/**
 * 사진 EXIF에서 촬영 시간을 추출합니다.
 * @returns {Promise<Date|null>}
 */
export async function extractTakenAt(file) {
  if (!file.type.startsWith('image/')) return null;
  try {
    const exif = await exifr.parse(file, ['DateTimeOriginal']);
    return exif?.DateTimeOriginal || null;
  } catch {
    return null;
  }
}

/**
 * 갤러리 표시용 썸네일을 생성합니다 (800px, JPEG 70%).
 * 원본은 그대로 보존되고, 이 썸네일은 별도 경로에 업로드됩니다.
 * @returns {Promise<Blob|null>}
 */
export async function createDisplayThumbnail(file) {
  if (file.type.startsWith('image/')) {
    return createImageThumbnail(file);
  }
  if (file.type.startsWith('video/')) {
    return createVideoThumbnail(file);
  }
  return null;
}

async function createImageThumbnail(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    let targetWidth = width;
    let targetHeight = height;
    if (width > THUMB_MAX_SIZE || height > THUMB_MAX_SIZE) {
      if (width > height) {
        targetWidth = THUMB_MAX_SIZE;
        targetHeight = Math.round(height * (THUMB_MAX_SIZE / width));
      } else {
        targetHeight = THUMB_MAX_SIZE;
        targetWidth = Math.round(width * (THUMB_MAX_SIZE / height));
      }
    }

    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    return await canvas.convertToBlob({ type: 'image/jpeg', quality: THUMB_QUALITY });
  } catch {
    return null;
  }
}

function createVideoThumbnail(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration * 0.1);
    };

    video.onseeked = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        const scale = Math.min(THUMB_MAX_SIZE / Math.max(w, h), 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => { cleanup(); resolve(blob); },
          'image/jpeg',
          THUMB_QUALITY
        );
      } catch {
        cleanup();
        resolve(null);
      }
    };

    video.onerror = () => { cleanup(); resolve(null); };

    // 5초 타임아웃
    setTimeout(() => { cleanup(); resolve(null); }, 5000);
  });
}

/**
 * 비디오에서 첫 프레임을 추출하여 Data URL로 반환합니다.
 * iOS 15+ 에서 canvas.drawImage(video) 정상 동작.
 */
function extractVideoFrame(blobUrl) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = blobUrl;

    const timeout = setTimeout(() => reject(new Error('timeout')), 5000);

    video.onloadeddata = () => {
      video.currentTime = 0.001;
    };

    video.onseeked = () => {
      try {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) { clearTimeout(timeout); reject(new Error('no dimensions')); return; }
        const scale = Math.min(300 / Math.max(w, h), 1);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        clearTimeout(timeout);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      } catch (e) {
        clearTimeout(timeout);
        reject(e);
      }
    };

    video.onerror = () => { clearTimeout(timeout); reject(new Error('video error')); };
  });
}

/**
 * 미리보기 썸네일을 생성합니다.
 * 이미지: Data URL 문자열 반환
 * 영상: canvas 프레임 추출 시도, 실패 시 Object URL 폴백
 * @returns {Promise<{type: 'image'|'video'|'video-thumb', url: string}>}
 */
export async function generateThumbnail(file) {
  if (file.type.startsWith('video/')) {
    const blobUrl = URL.createObjectURL(file);
    try {
      const dataUrl = await extractVideoFrame(blobUrl);
      URL.revokeObjectURL(blobUrl);
      return { type: 'video-thumb', url: dataUrl };
    } catch {
      return { type: 'video', url: blobUrl };
    }
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ type: 'image', url: reader.result });
    reader.onerror = () => resolve({ type: 'image', url: '' });
    reader.readAsDataURL(file);
  });
}

/**
 * 단일 파일을 Firebase Storage에 업로드합니다.
 * @param {Blob} fileBlob - 업로드할 파일 또는 압축된 Blob
 * @param {string} originalName - 원본 파일 이름
 * @param {string} contentType - MIME 타입
 * @param {string} uid - 사용자 UID
 * @param {string} uploaderName - 업로더 이름
 * @param {function} onProgress - 진행률 콜백 (0~1)
 * @returns {Promise<{url: string, storagePath: string}>}
 */
async function uploadSingleFile(file, originalName, contentType, uid, uploaderName, onProgress) {
  const timestamp = Date.now();
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `uploads/${uid}/${timestamp}_${safeName}`;
  const storageRef = ref(storage, path);
  const metadata = {
    contentType: contentType,
    customMetadata: {
      uploaderName: uploaderName || 'anonymous',
      originalName: originalName
    }
  };

  // 원본 업로드 + 썸네일 생성/업로드를 병렬 실행
  const originalUpload = new Promise((resolve, reject) => {
    const task = uploadBytesResumable(storageRef, file, metadata);
    task.on('state_changed',
      (snapshot) => onProgress(snapshot.bytesTransferred / snapshot.totalBytes),
      reject,
      async () => {
        try { resolve(await getDownloadURL(task.snapshot.ref)); }
        catch (e) { reject(e); }
      }
    );
  });

  const thumbnailUpload = (async () => {
    try {
      const thumbBlob = await createDisplayThumbnail(file);
      if (!thumbBlob) return null;
      const thumbPath = `thumbnails/${uid}/${timestamp}_${safeName}.jpg`;
      const thumbRef = ref(storage, thumbPath);
      await uploadBytesResumable(thumbRef, thumbBlob, { contentType: 'image/jpeg' });
      return await getDownloadURL(thumbRef);
    } catch {
      return null;
    }
  })();

  const [url, thumbnailUrl, takenAt] = await Promise.all([
    originalUpload, thumbnailUpload, extractTakenAt(file)
  ]);

  // Firestore에 메타데이터 저장
  await addDoc(collection(db, 'photos'), {
    url,
    thumbnailUrl,
    fileName: originalName,
    contentType,
    size: file.size,
    uid,
    uploaderName: uploaderName || 'anonymous',
    storagePath: path,
    takenAt: takenAt ? Timestamp.fromDate(takenAt) : null,
    createdAt: serverTimestamp()
  });

  return { url, storagePath: path };
}

/**
 * 여러 파일을 동시 업로드합니다 (최대 5개씩).
 * @param {File[]} files
 * @param {string} uid
 * @param {string} uploaderName
 * @param {object} callbacks
 * @param {function} callbacks.onFileProgress - (fileIndex, progress)
 * @param {function} callbacks.onFileComplete - (fileIndex, success)
 * @param {function} callbacks.onAllComplete - (successCount, failCount)
 * @param {function} callbacks.onOverallProgress - (progress 0~1)
 */
export async function uploadAll(files, uid, uploaderName, callbacks) {
  const { onFileProgress, onFileComplete, onAllComplete, onOverallProgress } = callbacks;

  let completedCount = 0;
  let successCount = 0;
  let failCount = 0;
  const fileProgresses = new Array(files.length).fill(0);

  function updateOverallProgress() {
    const total = fileProgresses.reduce((sum, p) => sum + p, 0) / files.length;
    onOverallProgress(total);
  }

  // 큐 기반 동시 업로드
  const queue = files.map((file, index) => ({ file, index }));
  const active = new Set();

  async function processNext() {
    if (queue.length === 0) return;

    const { file, index } = queue.shift();
    active.add(index);

    try {
      const contentType = file.type;

      await uploadSingleFile(
        file,
        file.name,
        contentType,
        uid,
        uploaderName,
        (progress) => {
          fileProgresses[index] = progress;
          onFileProgress(index, progress);
          updateOverallProgress();
        }
      );

      successCount++;
      onFileComplete(index, true);
    } catch (error) {
      console.error(`Upload failed for ${file.name}:`, error);
      failCount++;
      onFileComplete(index, false);
    } finally {
      fileProgresses[index] = 1;
      completedCount++;
      active.delete(index);
      updateOverallProgress();

      if (completedCount === files.length) {
        // 업로드 카운트 갱신
        const currentCount = getUploadedCount(uid);
        setUploadedCount(uid, currentCount + successCount);
        onAllComplete(successCount, failCount);
      } else {
        processNext();
      }
    }
  }

  // 동시에 CONCURRENT_UPLOADS 개 시작
  const initialBatch = Math.min(CONCURRENT_UPLOADS, queue.length);
  for (let i = 0; i < initialBatch; i++) {
    processNext();
  }
}
