export function createFlap(char = ' ') {
  const ch = char || ' ';
  const el = document.createElement('span');
  el.className = 'flap';
  el.innerHTML = `
    <span class="flap__half flap__half--top"><span class="flap__char">${ch}</span></span>
    <span class="flap__half flap__half--bottom"><span class="flap__char">${ch}</span></span>
    <span class="flap__fold flap__fold--down"><span class="flap__char">${ch}</span></span>
    <span class="flap__fold flap__fold--up"><span class="flap__char">${ch}</span></span>
    <span class="flap__hinge"></span>
  `;
  return el;
}

export function setFlap(flapEl, newChar) {
  const chars = flapEl.querySelectorAll('.flap__char');
  if (chars[0].textContent === String(newChar)) return;
  const oldChar = chars[0].textContent;

  chars[0].textContent = newChar;
  chars[1].textContent = oldChar;
  chars[2].textContent = oldChar;
  chars[3].textContent = newChar;

  flapEl.classList.add('flap--flipping');

  setTimeout(() => {
    chars[1].textContent = newChar;
    chars[2].textContent = newChar;
    flapEl.classList.remove('flap--flipping');
  }, 550);
}

export function startFlipboard(container, { target, title }) {
  container.innerHTML = '';

  const TITLE_WIDTH = 13;
  const pad = Math.max(0, Math.floor((TITLE_WIDTH - title.length) / 2));
  const paddedTitle =
    ' '.repeat(pad) + title + ' '.repeat(Math.max(0, TITLE_WIDTH - pad - title.length));

  const titleRow = document.createElement('div');
  titleRow.className = 'flipboard__row flipboard__row--title';
  for (const ch of paddedTitle) {
    titleRow.appendChild(createFlap(ch === ' ' ? '' : ch));
  }
  container.appendChild(titleRow);

  const timeRow = document.createElement('div');
  timeRow.className = 'flipboard__row flipboard__row--time';
  const slots = [];
  const addDigit = (unit) => {
    const f = createFlap('0');
    f.dataset.unit = unit;
    timeRow.appendChild(f);
    slots.push({ unit, el: f });
  };
  addDigit('d100'); addDigit('d10'); addDigit('d1');
  timeRow.appendChild(createFlap('D'));
  timeRow.appendChild(createFlap(''));
  addDigit('h10'); addDigit('h1');
  timeRow.appendChild(createFlap(':'));
  addDigit('m10'); addDigit('m1');
  timeRow.appendChild(createFlap(':'));
  addDigit('s10'); addDigit('s1');
  container.appendChild(timeRow);

  const tick = () => {
    const diff = Math.max(0, target.getTime() - Date.now());
    const days  = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const mins  = Math.floor((diff % 3600000) / 60000);
    const secs  = Math.floor((diff % 60000) / 1000);
    const vals = {
      d100: Math.floor(days / 100) % 10,
      d10:  Math.floor(days / 10)  % 10,
      d1:   days   % 10,
      h10:  Math.floor(hours / 10),
      h1:   hours  % 10,
      m10:  Math.floor(mins / 10),
      m1:   mins   % 10,
      s10:  Math.floor(secs / 10),
      s1:   secs   % 10,
    };
    for (const { unit, el } of slots) setFlap(el, String(vals[unit]));
  };
  tick();
  return setInterval(tick, 1000);
}
