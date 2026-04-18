export function createFlap(char = ' ', modifier = '') {
  const el = document.createElement('span');
  el.className = 'flap' + (modifier ? ` flap--${modifier}` : '');
  const inner = document.createElement('span');
  inner.className = 'flap__char';
  inner.textContent = char;
  el.appendChild(inner);
  return el;
}

export function setFlap(flapEl, newChar) {
  const inner = flapEl.querySelector('.flap__char');
  if (!inner || inner.textContent === String(newChar)) return;
  flapEl.classList.add('flap--flipping');
  setTimeout(() => { inner.textContent = newChar; }, 150);
  setTimeout(() => { flapEl.classList.remove('flap--flipping'); }, 300);
}

export function startFlipboard(container, { target, title }) {
  container.innerHTML = '';

  const titleRow = document.createElement('div');
  titleRow.className = 'flipboard__row flipboard__row--title';
  for (const ch of title) {
    titleRow.appendChild(
      ch === ' ' ? createFlap('', 'spacer') : createFlap(ch)
    );
  }
  container.appendChild(titleRow);

  const timeRow = document.createElement('div');
  timeRow.className = 'flipboard__row flipboard__row--time';
  const slots = [];
  const pushDigit = unit => {
    const f = createFlap('0');
    f.dataset.unit = unit;
    timeRow.appendChild(f);
    slots.push({ unit, el: f });
  };
  pushDigit('d100'); pushDigit('d10'); pushDigit('d1');
  timeRow.appendChild(createFlap('D', 'label'));
  timeRow.appendChild(createFlap('', 'spacer'));
  pushDigit('h10'); pushDigit('h1');
  timeRow.appendChild(createFlap(':', 'sep'));
  pushDigit('m10'); pushDigit('m1');
  timeRow.appendChild(createFlap(':', 'sep'));
  pushDigit('s10'); pushDigit('s1');
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
