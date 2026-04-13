import { ref, uploadBytesResumable, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { storage, db } from './firebase-config.js';

const MAX_FILES = 50;
const MAX_IMAGE_SIZE = 50 * 1024 * 1024;  // 50MB
const MAX_VIDEO_SIZE = 200 * 1024 * 1024;  // 200MB
const COMPRESS_THRESHOLD = 500 * 1024;      // 500KB
const COMPRESS_MAX_WIDTH = 1920;
const COMPRESS_QUALITY = 0.8;
const CONCURRENT_UPLOADS = 3;

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
      errors.push(`"${file.name}" - 영상은 최대 200MB까지 가능합니다.`);
      continue;
    }

    valid.push(file);
  }

  return { valid, errors };
}

/**
 * 이미지를 클라이언트에서 압축합니다.
 * @returns {Promise<Blob>}
 */
export async function compressImage(file) {
  if (file.size <= COMPRESS_THRESHOLD || !file.type.startsWith('image/')) {
    return file;
  }

  // HEIC 등 지원되지 않는 포맷은 압축 건너뛰기
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = bitmap;

    // 이미 충분히 작으면 건너뛰기
    if (width <= COMPRESS_MAX_WIDTH && height <= COMPRESS_MAX_WIDTH) {
      if (file.size <= COMPRESS_THRESHOLD * 2) {
        bitmap.close();
        return file;
      }
    }

    // 비율 유지하며 리사이즈
    let targetWidth = width;
    let targetHeight = height;
    if (width > COMPRESS_MAX_WIDTH || height > COMPRESS_MAX_WIDTH) {
      if (width > height) {
        targetWidth = COMPRESS_MAX_WIDTH;
        targetHeight = Math.round(height * (COMPRESS_MAX_WIDTH / width));
      } else {
        targetHeight = COMPRESS_MAX_WIDTH;
        targetWidth = Math.round(width * (COMPRESS_MAX_WIDTH / height));
      }
    }

    const canvas = new OffscreenCanvas(targetWidth, targetHeight);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
    bitmap.close();

    const blob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality: COMPRESS_QUALITY
    });

    // 압축 결과가 원본보다 크면 원본 사용
    return blob.size < file.size ? blob : file;
  } catch {
    // createImageBitmap 실패 시 (HEIC 등) 원본 반환
    return file;
  }
}

/**
 * 미리보기 썸네일을 생성합니다.
 * @returns {Promise<string>} Data URL
 */
export async function generateThumbnail(file) {
  if (file.type.startsWith('video/')) {
    return generateVideoThumbnail(file);
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}

function generateVideoThumbnail(file) {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    const url = URL.createObjectURL(file);
    video.src = url;

    video.onloadeddata = () => {
      video.currentTime = Math.min(1, video.duration / 2);
    };

    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 300;
      canvas.height = Math.round(300 * (video.videoHeight / video.videoWidth)) || 300;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      URL.revokeObjectURL(url);
      resolve(dataUrl);
    };

    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };

    // 타임아웃 (3초 내에 못 만들면 빈 썸네일)
    setTimeout(() => {
      URL.revokeObjectURL(url);
      resolve('');
    }, 3000);
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
function uploadSingleFile(fileBlob, originalName, contentType, uid, uploaderName, onProgress) {
  return new Promise((resolve, reject) => {
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

    const task = uploadBytesResumable(storageRef, fileBlob, metadata);

    task.on('state_changed',
      (snapshot) => {
        const progress = snapshot.bytesTransferred / snapshot.totalBytes;
        onProgress(progress);
      },
      (error) => {
        reject(error);
      },
      async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);

          // Firestore에 메타데이터 저장
          await addDoc(collection(db, 'photos'), {
            url,
            fileName: originalName,
            contentType: contentType,
            size: fileBlob.size,
            uid,
            uploaderName: uploaderName || 'anonymous',
            storagePath: path,
            createdAt: serverTimestamp()
          });

          resolve({ url, storagePath: path });
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

/**
 * 여러 파일을 동시 업로드합니다 (최대 3개씩).
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
      // 이미지 압축
      const compressed = await compressImage(file);
      const contentType = compressed === file ? file.type : 'image/jpeg';

      await uploadSingleFile(
        compressed,
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
