/**
 * Runs inside every page of the verification browser (serialized with toString, so it must not
 * reference anything outside its own body). It keeps the page on Radar MDE and reports what would
 * have left: window.open to another origin, a click on a link to another origin or a non-http
 * scheme (mailto:, tel:, https://wa.me), and navigator.share. Same-origin links are untouched.
 *
 * @param {string} origin  The run's origin, for example http://127.0.0.1:4173
 * @param {any} win        The page's window
 */
export function installOutboundGuard(origin, win) {
  if (win.__radarOutboundGuard) return;
  win.__radarOutboundGuard = true;
  const record = (entry) => {
    const full = { ...entry, at: new Date().toISOString(), from: String(win.location && win.location.href) };
    if (typeof win.__radarRecordOutbound === "function") {
      Promise.resolve(win.__radarRecordOutbound(full)).catch(() => {});
    }
  };
  const leaves = (raw) => {
    let url;
    try {
      url = new URL(String(raw), win.location.href);
    } catch {
      return false;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return url.protocol !== "javascript:" && url.protocol !== "blob:";
    return url.origin !== origin;
  };

  const realOpen = typeof win.open === "function" ? win.open.bind(win) : null;
  win.open = function open(url, target, features) {
    if (url != null && leaves(url)) {
      record({ kind: "window.open", url: new URL(String(url), win.location.href).href, target: target == null ? null : String(target), features: features == null ? null : String(features) });
      return null;
    }
    return realOpen ? realOpen(url, target, features) : null;
  };

  win.addEventListener(
    "click",
    (event) => {
      const start = event.target;
      const anchor = start && typeof start.closest === "function" ? start.closest("a[href]") : null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!leaves(href)) return;
      event.preventDefault();
      record({ kind: "link", url: new URL(href, win.location.href).href, target: anchor.getAttribute("target") || null, text: (anchor.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120) });
    },
    true,
  );

  if (win.navigator && typeof win.navigator.share === "function") {
    win.navigator.share = (data) => {
      const d = data || {};
      record({ kind: "share", url: d.url == null ? null : String(d.url), title: d.title == null ? null : String(d.title), text: d.text == null ? null : String(d.text), files: Array.isArray(d.files) ? d.files.length : 0 });
      return Promise.resolve();
    };
  }
}
