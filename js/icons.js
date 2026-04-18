const _cache = new Map();

function fetchIcon(name) {
  if (!_cache.has(name)) {
    _cache.set(name, fetch(`assets/icons/${name}.svg`).then((r) => r.text()).catch(() => ''));
  }
  return _cache.get(name);
}

export async function hydrateIcons(root = document) {
  const els = root.querySelectorAll('.icon-inline[data-icon]');
  await Promise.all([...els].map(async (el) => {
    const svg = await fetchIcon(el.dataset.icon);
    if (!svg) return;
    el.innerHTML = svg;
    const inner = el.querySelector('svg');
    if (inner) {
      inner.removeAttribute('width');
      inner.removeAttribute('height');
      inner.setAttribute('aria-hidden', 'true');
    }
  }));
}
