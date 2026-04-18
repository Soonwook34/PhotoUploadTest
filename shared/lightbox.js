/**
 * 공용 Lightbox 클래스 — 청첩장(/) + 업로드(/upload/) 페이지 공유.
 *
 * 구조: 스트립(strip) 캐러셀 — 모든 아이템을 한 줄에 슬라이드로 배치하고
 * 트랙 전체를 translateX 로 이동. 스와이프 시 옆 사진이 실시간으로 보이며,
 * 다음 사진이 이미 DOM에 있으므로 로드 공백이 없음.
 *
 * 성능: `_loadAround` 로 현재 인덱스 ±2 범위만 실제 src 세팅(지연 로딩).
 *
 * DOM 요구사항: 호출 페이지에 다음 요소가 있어야 함
 *   #lightbox, #lightbox-close, #lightbox-prev, #lightbox-next,
 *   #lightbox-content, #lightbox-info, #lightbox-counter
 */
export class Lightbox {
  constructor() {
    this.el = document.getElementById('lightbox');
    this.contentEl = document.getElementById('lightbox-content');
    this.infoEl = document.getElementById('lightbox-info');
    this.counterEl = document.getElementById('lightbox-counter');
    this.items = [];
    this.currentIndex = 0;
    this.track = null;

    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragAxis = null;
    this._dragging = false;

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
      if (!this.track) return;
      const t = e.changedTouches[0];
      this._dragStartX = t.clientX;
      this._dragStartY = t.clientY;
      this._dragAxis = null;
      this._dragging = true;
      this.track.style.transition = 'none';
    }, { passive: true });

    this.el.addEventListener('touchmove', (e) => {
      if (!this._dragging || !this.track) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this._dragStartX;
      const dy = t.clientY - this._dragStartY;

      if (this._dragAxis === null) {
        if (Math.abs(dx) + Math.abs(dy) < 8) return;
        this._dragAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }

      if (this._dragAxis === 'x') {
        if (e.cancelable) e.preventDefault();
        let offset = dx;
        if ((this.currentIndex === 0 && dx > 0) ||
            (this.currentIndex === this.items.length - 1 && dx < 0)) {
          offset = dx / 3;
        }
        this.track.style.transform =
          `translateX(calc(${-this.currentIndex * 100}vw + ${offset}px))`;
      } else {
        this._dragging = false;
        this._setPosition(this.currentIndex, true);
      }
    }, { passive: false });

    this.el.addEventListener('touchend', (e) => {
      if (!this._dragging) return;
      this._dragging = false;
      if (this._dragAxis !== 'x') return;

      const t = e.changedTouches[0];
      const dx = t.clientX - this._dragStartX;
      const width = window.innerWidth || document.documentElement.clientWidth;
      const threshold = width * 0.2;

      let newIndex = this.currentIndex;
      if (dx < -threshold && this.currentIndex < this.items.length - 1) {
        newIndex = this.currentIndex + 1;
      } else if (dx > threshold && this.currentIndex > 0) {
        newIndex = this.currentIndex - 1;
      }

      if (newIndex !== this.currentIndex) {
        this.currentIndex = newIndex;
        this._setPosition(this.currentIndex, true);
        this._loadAround(this.currentIndex);
        this._updateOverlays();
        this._syncVideos();
      } else {
        this._setPosition(this.currentIndex, true);
      }
    }, { passive: true });
  }

  open(items, index) {
    this.items = items;
    this.currentIndex = index;
    this._buildTrack();
    this._setPosition(this.currentIndex, false);
    this._loadAround(this.currentIndex);
    this._updateOverlays();
    this._syncVideos();
    this.el.hidden = false;
    requestAnimationFrame(() => this.el.classList.add('active'));
    document.body.style.overflow = 'hidden';
  }

  close() {
    this.el.classList.remove('active');
    setTimeout(() => {
      this.el.hidden = true;
      this.contentEl.innerHTML = '';
      this.track = null;
      this.items = [];
    }, 300);
    document.body.style.overflow = '';
  }

  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this._setPosition(this.currentIndex, true);
      this._loadAround(this.currentIndex);
      this._updateOverlays();
      this._syncVideos();
    }
  }

  next() {
    if (this.currentIndex < this.items.length - 1) {
      this.currentIndex++;
      this._setPosition(this.currentIndex, true);
      this._loadAround(this.currentIndex);
      this._updateOverlays();
      this._syncVideos();
    }
  }

  _buildTrack() {
    this.contentEl.innerHTML = '';
    const track = document.createElement('div');
    track.className = 'lightbox-track';
    this.items.forEach((_, i) => {
      const slide = document.createElement('div');
      slide.className = 'lightbox-slide';
      slide.dataset.index = String(i);
      track.appendChild(slide);
    });
    this.contentEl.appendChild(track);
    this.track = track;
  }

  _loadAround(index) {
    if (!this.track) return;
    const range = 2;
    const from = Math.max(0, index - range);
    const to = Math.min(this.items.length - 1, index + range);
    for (let i = from; i <= to; i++) {
      const slide = this.track.children[i];
      if (!slide || slide.childElementCount > 0) continue;
      const item = this.items[i];
      if (!item) continue;
      if (item.contentType?.startsWith('video/')) {
        const v = document.createElement('video');
        v.src = item.url;
        v.controls = true;
        v.controlsList = 'nodownload';
        v.playsInline = true;
        slide.appendChild(v);
      } else {
        const img = document.createElement('img');
        img.alt = '';
        img.draggable = false;
        img.src = item.thumbnailUrl || item.url;
        slide.appendChild(img);
      }
    }
  }

  _setPosition(index, animate) {
    if (!this.track) return;
    this.track.style.transition = animate ? 'transform 0.25s ease-out' : 'none';
    this.track.style.transform = `translateX(-${index * 100}vw)`;
  }

  _updateOverlays() {
    if (this.counterEl) {
      if (this.items.length > 1) {
        this.counterEl.textContent = `${this.currentIndex + 1} / ${this.items.length}`;
        this.counterEl.style.display = '';
      } else {
        this.counterEl.style.display = 'none';
      }
    }

    const item = this.items[this.currentIndex];
    if (this.infoEl) {
      const name = item?.uploaderName && item.uploaderName !== 'anonymous'
        ? item.uploaderName : '';
      const date = item?.takenAt?.toDate
        ? formatShortDate(item.takenAt.toDate())
        : item?.createdAt?.toDate
          ? formatShortDate(item.createdAt.toDate())
          : '';
      const info = [name, date].filter(Boolean).join(' · ');
      this.infoEl.textContent = info;
      this.infoEl.style.display = info ? '' : 'none';
    }

    document.getElementById('lightbox-prev').style.display =
      this.currentIndex > 0 ? '' : 'none';
    document.getElementById('lightbox-next').style.display =
      this.currentIndex < this.items.length - 1 ? '' : 'none';
  }

  _syncVideos() {
    if (!this.track) return;
    Array.from(this.track.children).forEach((slide, i) => {
      const v = slide.querySelector('video');
      if (!v) return;
      if (i === this.currentIndex) {
        v.play().catch(() => {});
      } else {
        v.pause();
      }
    });
  }
}

function formatShortDate(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${m}월 ${d}일 ${h}:${min}`;
}
