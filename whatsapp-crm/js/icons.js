// Helper to insert lucide icons inline
export function icon(name, opts = {}) {
  const size = opts.size || 18;
  const cls  = opts.cls || '';
  return `<i data-lucide="${name}" style="width:${size}px;height:${size}px" class="${cls}"></i>`;
}

export function refreshIcons() {
  if (window.lucide && window.lucide.createIcons) {
    window.lucide.createIcons();
  }
}
