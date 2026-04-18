import { ref, getDownloadURL, listAll } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';
import { storage } from './firebase-config.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export function formatDate(iso) {
  const d = new Date(iso);
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

export function formatDateShort(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

export function getDday(iso) {
  const target = new Date(iso);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  const diff = Math.round((target - now) / (1000 * 60 * 60 * 24));
  if (diff > 0) return `D-${diff}`;
  if (diff < 0) return `D+${Math.abs(diff)}`;
  return 'D-DAY';
}

export function generateICS(wedding, title) {
  const start = new Date(wedding.date);
  const end = new Date(start.getTime() + (wedding.durationMinutes || 90) * 60 * 1000);
  const fmt = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const uid = `wedding-${start.getTime()}@invitation`;
  const location = [wedding.venue.name, wedding.venue.hall, wedding.venue.address].filter(Boolean).join(' ');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wedding Invitation//KO',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${title}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
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
  const { name, address, coord } = venue;
  const { lat, lng } = coord || {};
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
