// src/lib/share/buildCardBlob.ts
// Standalone utility for rendering a TripShareCard SVG + optional map JPEG → PNG blob.
// Used by TripShareModal (web) and the native share fast-path (iOS/Android).

import { CARD_W, CARD_H } from "@/components/share/TripShareCard";

/* ── Image helpers ───────────────────────────────────────────────── */

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new window.Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/** Draw an image into a canvas covering it (object-fit: cover). */
export function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  cw: number,
  ch: number,
) {
  const pr = img.width / img.height;
  const cr = cw / ch;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (pr > cr) { sw = img.height * cr; sx = (img.width - sw) / 2; }
  else         { sh = img.width / cr;  sy = (img.height - sh) / 2; }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
}

/* ── Font embedding ──────────────────────────────────────────────── */

let fontFaceCSS: string | null = null;

/** Fetch a font as a base64 data-URL. Tries local bundle first, then CDN. */
async function fetchFontDataUrl(localPath: string, cdnUrl: string): Promise<string> {
  for (const url of [localPath, cdnUrl]) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const buf = await r.arrayBuffer();
      if (buf.byteLength < 1000) continue; // reject HTML error pages
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return `data:font/woff2;base64,${btoa(binary)}`;
    } catch { /* try next */ }
  }
  return "";
}

export async function getFontFaceCSS(): Promise<string> {
  if (fontFaceCSS) return fontFaceCSS;
  try {
    // The share card is rasterised on-device (often offline, straight after a
    // trip), so every face is inlined as a data URL from the local bundle.
    // Spectral only, same as the app: the card is the brand leaving the phone.
    const [medium, bold, extrabold] = await Promise.all([
      fetchFontDataUrl(
        "/fonts/Spectral-Medium.woff2",
        "https://fonts.gstatic.com/s/spectral/v15/rnCs-xNNww_2s0amA9vKsW3BafaPWnII.woff2",
      ),
      fetchFontDataUrl(
        "/fonts/Spectral-Bold.woff2",
        "https://fonts.gstatic.com/s/spectral/v15/rnCs-xNNww_2s0amA9uCt23BafaPWnII.woff2",
      ),
      fetchFontDataUrl(
        "/fonts/Spectral-ExtraBold.woff2",
        "https://fonts.gstatic.com/s/spectral/v15/rnCs-xNNww_2s0amA9uetG3BafaPWnII.woff2",
      ),
    ]);
    fontFaceCSS = `
      @font-face { font-family: 'Spectral'; font-weight: 500; src: url('${medium}') format('woff2'); }
      @font-face { font-family: 'Spectral'; font-weight: 700; src: url('${bold}') format('woff2'); }
      @font-face { font-family: 'Spectral'; font-weight: 800; src: url('${extrabold}') format('woff2'); }
    `;
  } catch {
    fontFaceCSS = "";
  }
  return fontFaceCSS;
}

/* ── App icon ────────────────────────────────────────────────────── */

let cachedIconUrl: string | null = null;

export async function loadIconDataUrl(): Promise<string | null> {
  if (cachedIconUrl) return cachedIconUrl;
  try {
    const res = await fetch("/img/glovebox-app-icon.png");
    const blob = await res.blob();
    const img = await loadImage(URL.createObjectURL(blob));
    const c = document.createElement("canvas"); c.width = 64; c.height = 64;
    c.getContext("2d")!.drawImage(img, 0, 0, 64, 64);
    cachedIconUrl = c.toDataURL("image/png");
    return cachedIconUrl;
  } catch { return null; }
}

/* ── Core composite function ─────────────────────────────────────── */

/**
 * Composite a rendered TripShareCard SVG element + optional map JPEG into a PNG blob.
 *
 * @param svgEl   - The live SVGSVGElement rendered by <TripShareCard>
 * @param mapDataUrl - Optional JPEG data URL to use as the background layer
 * @param scale   - Output scale multiplier (default 3 → 1170×2079 px)
 */
export async function buildCardBlob(
  svgEl: SVGSVGElement,
  mapDataUrl: string | null | undefined,
  scale = 3,
): Promise<Blob> {
  const cw = CARD_W * scale;
  const ch = CARD_H * scale;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;

  // 1. Map layer
  if (mapDataUrl) {
    const mapImg = await loadImage(mapDataUrl);
    drawCover(ctx, mapImg, cw, ch);
  }

  // 2. SVG overlay - inject embedded font so it renders in the blob URL context
  const embeddedFont = await getFontFaceCSS();
  const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
  const styleEl = svgClone.querySelector("style");
  if (styleEl && embeddedFont) {
    styleEl.textContent = embeddedFont;
  }

  const svgData = new XMLSerializer().serializeToString(svgClone);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl  = URL.createObjectURL(svgBlob);
  try {
    const svgImg = await loadImage(svgUrl);
    ctx.drawImage(svgImg, 0, 0, cw, ch);
  } finally {
    URL.revokeObjectURL(svgUrl);
  }

  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob null"))), "image/png", 1),
  );
}

/* ── Share / save helpers ────────────────────────────────────────── */

/**
 * Write a PNG blob to the Capacitor cache directory and invoke the native share sheet.
 * Call only when `isNative` is true.
 */
export async function nativeShareBlob(blob: Blob, label: string): Promise<void> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const reader = new FileReader();
  const du: string = await new Promise((res, rej) => {
    reader.onload = () => res(reader.result as string);
    reader.onerror = rej;
    reader.readAsDataURL(blob);
  });
  const fname = `glovebox-trip-${Date.now()}.png`;
  await Filesystem.writeFile({ path: fname, data: du.split(",")[1], directory: Directory.Cache });
  const { uri } = await Filesystem.getUri({ path: fname, directory: Directory.Cache });
  await Share.share({ title: label, url: uri, dialogTitle: "Share your trip" });
}

/**
 * Share or save a PNG blob.
 * - mode "share" on native → native share sheet
 * - mode "share" on web → Web Share API if available, else download
 * - mode "save" → download
 */
export async function shareBlob(blob: Blob, label: string, mode: "share" | "save"): Promise<void> {
  const { isNative } = await import("@/lib/native/platform");
  if (mode === "share") {
    if (isNative) {
      await nativeShareBlob(blob, label);
      return;
    }
    const file = new File([blob], "glovebox-trip.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: label });
      return;
    }
  }
  // Fallback: download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `glovebox-trip-${Date.now()}.png`; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
