/**
 * 공용 Lightbox 클래스 — 청첩장(/) + 업로드(/upload/) 페이지 공유.
 *
 * DOM 요구사항: 호출 페이지에 다음 요소가 있어야 함
 *   #lightbox, #lightbox-close, #lightbox-prev, #lightbox-next,
 *   #lightbox-content, #lightbox-info
 *
 * item 형태(모두 선택):
 *   { url, thumbnailUrl?, contentType?, uploaderName?, takenAt?, createdAt? }
 *   contentType 가 'video/*' 이면 <video>, 그 외는 <img> 로 렌더.
 */
export class Lightbox {
  constructor() {
    this.el = document.getElementById('lightbox');
    this.contentEl = document.getElementById('lightbox-content');
    this.infoEl = document.getElementById('lightbox-info');
    this.items = [];
    this.currentIndex = 0;

    this._touchStartX = 0;
    this._touchStartY = 0;
    this._touchMoved = false;
    this._renderToken = 0;

    this._bindEvents();
  }

  _bindEvents() {
    document.getElementById('lightbox-close').addEventListener('click', () => this.close());
    document.getElementById('lightbox-prev').addEventListener('click', () => this.prev());
    document.getElementById('lightbox-next').addEventListener('click', () => this.next());

    this.el.addEventListener('click', (e) => {
      if (e.target === this.el) this.close();
    });

    document.addEventListener('keydown', (e) => {
      if (!this.el.classList.contains('active')) return;
      if (e.key === 'Escape') this.close();
      if (e.key === 'ArrowLeft') this.prev();
      if (e.key === 'ArrowRight') this.next();
    });

    this.el.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      this._touchStartX = t.clientX;
      this._touchStartY = t.clientY;
      this._touchMoved = false;
    }, { passive: true });

    this.el.addEventListener('touchmove', (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - this._touchStartX;
      const dy = t.clientY - this._touchStartY;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
        this._touchMoved = true;
        e.preventDefault();
      }
    }, { passive: false });

    this.el.addEventListener('touchend', (e) => {
      if (!this._touchMoved) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this._touchStartX;
      const dy = t.clientY - this._touchStartY;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0) this.next();
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
    const renderToken = ++this._renderToken;

    if (item.contentType && item.contentType.startsWith('video/')) {
      this.contentEl.innerHTML = `<video src="${item.url}" controls controlsList="nodownload" playsinline autoplay></video>`;
    } else {
      const src = item.thumbnailUrl || item.url;
      const img = new Image();
      img.alt = '';
      img.draggable = false;
      const swap = () => {
        if (renderToken !== this._renderToken) return;
        this.contentEl.innerHTML = '';
        this.contentEl.appendChild(img);
      };
      img.onload = swap;
      img.onerror = swap;
      img.src = src;
      if (img.complete && img.naturalWidth > 0) {
        swap();
      } else {
        this.contentEl.innerHTML = '';
      }
    }

    const name = item.uploaderName && item.uploaderName !== 'anonymous'
      ? item.uploaderName : '';
    const date = item.takenAt?.toDate
      ? formatShortDate(item.takenAt.toDate())
      : item.createdAt?.toDate
        ? formatShortDate(item.createdAt.toDate())
        : '';

    const info = [name, date].filter(Boolean).join(' · ');
    this.infoEl.textContent = info;
    this.infoEl.style.display = info ? '' : 'none';

    document.getElementById('lightbox-prev').style.display =
      this.currentIndex > 0 ? '' : 'none';
    document.getElementById('lightbox-next').style.display =
      this.currentIndex < this.items.length - 1 ? '' : 'none';
  }
}

function formatShortDate(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${m}월 ${d}일 ${h}:${min}`;
}
