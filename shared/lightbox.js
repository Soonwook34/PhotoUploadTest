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
    this.counterEl = document.getElementById('lightbox-counter');
    this.items = [];
    this.currentIndex = 0;

    this._dragStartX = 0;
    this._dragStartY = 0;
    this._dragAxis = null;
    this._dragging = false;
    this._animating = false;
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
      if (this._animating) return;
      const img = this.contentEl.querySelector('img');
      if (!img) return;
      const t = e.changedTouches[0];
      this._dragStartX = t.clientX;
      this._dragStartY = t.clientY;
      this._dragAxis = null;
      this._dragging = true;
      img.style.transition = 'none';
    }, { passive: true });

    this.el.addEventListener('touchmove', (e) => {
      if (!this._dragging) return;
      const img = this.contentEl.querySelector('img');
      if (!img) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - this._dragStartX;
      const dy = t.clientY - this._dragStartY;

      if (this._dragAxis === null) {
        if (Math.abs(dx) + Math.abs(dy) < 8) return;
        this._dragAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      }

      if (this._dragAxis === 'x') {
        if (e.cancelable) e.preventDefault();
        img.style.transform = `translateX(${dx}px)`;
      } else {
        // vertical gesture — let go of the drag
        this._dragging = false;
        img.style.transition = '';
      }
    }, { passive: false });

    this.el.addEventListener('touchend', (e) => {
      if (!this._dragging) return;
      this._dragging = false;
      const img = this.contentEl.querySelector('img');
      if (!img || this._dragAxis !== 'x') return;

      const t = e.changedTouches[0];
      const dx = t.clientX - this._dragStartX;
      const width = window.innerWidth || document.documentElement.clientWidth;
      const threshold = width * 0.25;

      img.style.transition = 'transform 0.2s ease-out';

      const direction = dx < 0 ? -1 : 1;
      const canMove =
        (direction === -1 && this.currentIndex < this.items.length - 1) ||
        (direction === 1 && this.currentIndex > 0);

      if (Math.abs(dx) > threshold && canMove) {
        this._animating = true;
        const onEnd = () => {
          img.removeEventListener('transitionend', onEnd);
          this._animating = false;
          if (direction === -1) this.next();
          else this.prev();
        };
        img.addEventListener('transitionend', onEnd);
        img.style.transform = `translateX(${direction * width}px)`;
      } else {
        img.style.transform = '';
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
      img.style.transition = 'none';
      img.style.transform = '';
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

    this._preloadAdjacent();

    if (this.counterEl) {
      if (this.items.length > 1) {
        this.counterEl.textContent = `${this.currentIndex + 1} / ${this.items.length}`;
        this.counterEl.style.display = '';
      } else {
        this.counterEl.style.display = 'none';
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

  _preloadAdjacent() {
    const preload = (idx) => {
      if (idx < 0 || idx >= this.items.length) return;
      const item = this.items[idx];
      if (!item || item.contentType?.startsWith('video/')) return;
      const src = item.thumbnailUrl || item.url;
      if (!src) return;
      const img = new Image();
      img.src = src;
    };
    preload(this.currentIndex + 1);
    preload(this.currentIndex - 1);
  }
}

function formatShortDate(date) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours();
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${m}월 ${d}일 ${h}:${min}`;
}
