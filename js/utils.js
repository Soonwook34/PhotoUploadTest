import { ref, getDownloadURL, listAll } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';
import { storage } from './firebase-config.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

/** Firestore Timestamp / ISO 문자열 / Date → Date 객체 */
export function toJsDate(v) {
  if (!v) return null;
  if (typeof v.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  return new Date(v);
}

/** Firestore GeoPoint / {lat,lng} → {lat,lng} */
export function toCoord(v) {
  if (!v) return null;
  if (typeof v.latitude === 'number') return { lat: v.latitude, lng: v.longitude };
  return v;
}

export function formatDate(value) {
  const d = toJsDate(value);
  if (!d) return '';
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const date = d.getDate();
  const weekday = WEEKDAYS[d.getDay()];
  const h = d.getHours();
  const m = d.getMinutes();
  const ampm = h < 12 ? '오전' : '오후';
  const hour12 = h % 12 || 12;
  const minutePart = m === 0 ? '' : ` ${m}분`;
  return `${year}년 ${month}월 ${date}일 ${weekday}요일 ${ampm} ${hour12}시${minutePart}`;
}

export function formatDateShort(value) {
  const d = toJsDate(value);
  if (!d) return '';
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function getDday(value) {
  const target = toJsDate(value);
  if (!target) return '';
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((target - now) / (1000 * 60 * 60 * 24));
  if (diff > 0) return `D-${diff}`;
  if (diff < 0) return `D+${Math.abs(diff)}`;
  return 'D-DAY';
}

function icsEscape(s) {
  return String(s || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function generateICS(wedding, title, url) {
  const start = toJsDate(wedding.date);
  const end = new Date(start.getTime() + (wedding.durationMinutes || 90) * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const uid = `wedding-${start.getTime()}@invitation`;
  const location = [wedding.venue.name, wedding.venue.hall, wedding.venue.address].filter(Boolean).join(' ');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wedding Invitation//KO',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${icsEscape(title)}`,
    `LOCATION:${icsEscape(location)}`
  ];
  if (url) {
    lines.push(`DESCRIPTION:${icsEscape(`청첩장: ${url}`)}`);
    lines.push(`URL:${url}`);
  }
  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(icsText, filename = 'wedding.ics') {
  const blob = new Blob([icsText], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function buildMapUrl(app, venue) {
  const { name, address } = venue;
  const { lat, lng } = toCoord(venue.coord) || {};
  const encodedName = encodeURIComponent(name);
  const encodedAddress = encodeURIComponent(address);
  switch (app) {
    case 'naver':
      if (lat && lng) return `nmap://place?lat=${lat}&lng=${lng}&name=${encodedName}&appname=invitation`;
      return `nmap://search?query=${encodedAddress}&appname=invitation`;
    case 'kakao':
      if (lat && lng) return `kakaomap://look?p=${lat},${lng}`;
      return `kakaomap://search?q=${encodedAddress}`;
    case 'tmap':
      if (lat && lng) return `tmap://route?goalname=${encodedName}&goalx=${lng}&goaly=${lat}`;
      return `tmap://search?name=${encodedName}`;
    default:
      return '#';
  }
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

export function showToast(message, duration = 2000) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), duration);
}

export async function loadInvitationImage(path) {
  try {
    return await getDownloadURL(ref(storage, path));
  } catch {
    return null;
  }
}

// 폴더별 listAll 결과를 캐시해 중복 요청/불필요한 404 로그를 방지.
const _folderItemsCache = new Map();
function listFolderItems(folderPath) {
  if (!_folderItemsCache.has(folderPath)) {
    const p = listAll(ref(storage, folderPath))
      .then((res) => res.items)
      .catch(() => []);
    _folderItemsCache.set(folderPath, p);
  }
  return _folderItemsCache.get(folderPath);
}

/**
 * 폴더를 listAll 한 뒤 basename 이 일치하는 파일을 찾아 URL 반환.
 * 확장자를 순차 시도하지 않으므로 404 console 에러가 발생하지 않음.
 * 예: loadInvitationImageFallback('invitation/hero') → 'invitation/hero.jpeg' 자동 매칭
 */
export async function loadInvitationImageFallback(basePath) {
  const slash = basePath.lastIndexOf('/');
  const folder = slash === -1 ? '' : basePath.slice(0, slash);
  const base = slash === -1 ? basePath : basePath.slice(slash + 1);

  const items = await listFolderItems(folder);
  const match = items.find((it) => {
    const name = it.name;
    const dot = name.lastIndexOf('.');
    const itemBase = dot === -1 ? name : name.slice(0, dot);
    return itemBase === base;
  });
  if (!match) return null;
  try {
    return await getDownloadURL(match);
  } catch {
    return null;
  }
}

export async function loadGalleryImages() {
  try {
    const folderRef = ref(storage, 'invitation/gallery');
    const { items } = await listAll(folderRef);
    items.sort((a, b) => a.name.localeCompare(b.name));
    const urls = await Promise.all(items.map((item) => getDownloadURL(item)));
    return urls;
  } catch {
    return [];
  }
}
