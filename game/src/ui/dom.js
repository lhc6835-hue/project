// Small DOM helpers for the HTML overlay UI.
export function el(tag, attrs = {}, html = "") {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (html) n.innerHTML = html;
  return n;
}

export function toast(text) {
  const t = el("div", { class: "toast" }, text);
  document.getElementById("ui").append(t);
  setTimeout(() => t.remove(), 2300);
}

/** Inline pixel icons for currencies (CSS-drawn). */
export function icon(kind) {
  return `<i class="ic ic-${kind}"></i>`;
}

export function clear() { document.getElementById("ui").innerHTML = ""; }
