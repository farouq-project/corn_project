"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Camera, ImagePlus, X, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── constants ────────────────────────────────────────────────────────────────
const MAX_DIM      = 640;
const MAX_COLOURS  = 6;
const DOT_RADIUS   = 4;
const DIRECT_COLOR = "#22c55e"; // green-500 — direct detections
const SPLIT_COLOR  = "#f97316"; // orange-500 — split/estimated seeds

// ─── types ───────────────────────────────────────────────────────────────────
interface RefColor { r: number; g: number; b: number }
interface DetPoint { x: number; y: number; split: boolean }
interface DetResult { total: number; points: DetPoint[] }

// ─── pure algorithm ──────────────────────────────────────────────────────────

function euclidDist(r: number, g: number, b: number, ref: RefColor): number {
  return Math.sqrt((r - ref.r) ** 2 + (g - ref.g) ** 2 + (b - ref.b) ** 2);
}

function minDist(r: number, g: number, b: number, refs: RefColor[]): number {
  let best = Infinity;
  for (const ref of refs) {
    const d = euclidDist(r, g, b, ref);
    if (d < best) best = d;
  }
  return best;
}

function sampleColor(
  data: Uint8ClampedArray, cx: number, cy: number, w: number, h: number, radius = 4
): RefColor {
  let sr = 0, sg = 0, sb = 0, n = 0;
  const x0 = Math.max(0, cx - radius), y0 = Math.max(0, cy - radius);
  const x1 = Math.min(w - 1, cx + radius), y1 = Math.min(h - 1, cy + radius);
  for (let py = y0; py <= y1; py++) {
    for (let px = x0; px <= x1; px++) {
      const i = (py * w + px) * 4;
      sr += data[i]; sg += data[i + 1]; sb += data[i + 2]; n++;
    }
  }
  return { r: sr / n, g: sg / n, b: sb / n };
}

function strideSample<T>(arr: T[], n: number): T[] {
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]);
}

function kmeansSplit(pixelIdx: number[], k: number, imgW: number): { x: number; y: number }[] {
  const coords = pixelIdx.map(i => ({ x: i % imgW, y: Math.floor(i / imgW) }));
  if (k <= 1 || coords.length <= 1) {
    let sx = 0, sy = 0;
    for (const p of coords) { sx += p.x; sy += p.y; }
    return [{ x: sx / coords.length, y: sy / coords.length }];
  }
  const pts = coords.length > 2500 ? strideSample(coords, 2500) : coords;

  // Farthest-point initialisation starting from the top-left-most pixel
  let centroids: { x: number; y: number }[] = [];
  let seed = pts[0];
  for (const p of pts) if (p.x + p.y < seed.x + seed.y) seed = p;
  centroids.push({ ...seed });

  for (let c = 1; c < k; c++) {
    let farthestD = -1, farthestPt = pts[0];
    for (const p of pts) {
      let nearestD = Infinity;
      for (const ct of centroids) {
        const dx = p.x - ct.x, dy = p.y - ct.y;
        const d = dx * dx + dy * dy;
        if (d < nearestD) nearestD = d;
      }
      if (nearestD > farthestD) { farthestD = nearestD; farthestPt = p; }
    }
    centroids.push({ ...farthestPt });
  }

  // Lloyd's algorithm (6 iterations)
  for (let iter = 0; iter < 6; iter++) {
    const sums = centroids.map(() => ({ sx: 0, sy: 0, n: 0 }));
    for (const p of pts) {
      let bestIdx = 0, bestD = Infinity;
      for (let ci = 0; ci < centroids.length; ci++) {
        const dx = p.x - centroids[ci].x, dy = p.y - centroids[ci].y;
        const d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; bestIdx = ci; }
      }
      sums[bestIdx].sx += p.x; sums[bestIdx].sy += p.y; sums[bestIdx].n++;
    }
    centroids = centroids.map((ct, i) =>
      sums[i].n > 0 ? { x: sums[i].sx / sums[i].n, y: sums[i].sy / sums[i].n } : ct
    );
  }
  return centroids;
}

function detect(
  imageData: ImageData, refs: RefColor[], sensitivity: number, minArea: number
): DetResult {
  const { data, width: w, height: h } = imageData;
  const maxPossibleDist = Math.sqrt(3 * 255 * 255); // ≈ 441.7
  const thresh = (sensitivity / 100) * maxPossibleDist;
  const n = w * h;

  // Mark seed pixels
  const isSeed = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    isSeed[i] = minDist(data[o], data[o + 1], data[o + 2], refs) < thresh ? 1 : 0;
  }

  // Union-find connected components (4-connectivity)
  const parent = new Int32Array(n).fill(-1);
  function find(a: number): number {
    while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; }
    return a;
  }
  function union(a: number, b: number) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!isSeed[i]) continue;
      if (parent[i] === -1) parent[i] = i;
      if (x > 0 && isSeed[i - 1]) { if (parent[i - 1] === -1) parent[i - 1] = i - 1; union(i, i - 1); }
      if (y > 0 && isSeed[i - w]) { if (parent[i - w] === -1) parent[i - w] = i - w; union(i, i - w); }
    }
  }

  // Group pixels by their root
  const groups = new Map<number, { area: number; sx: number; sy: number; pixels: number[] }>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!isSeed[i]) continue;
      const root = find(i);
      let g = groups.get(root);
      if (!g) { g = { area: 0, sx: 0, sy: 0, pixels: [] }; groups.set(root, g); }
      g.area++; g.sx += x; g.sy += y; g.pixels.push(i);
    }
  }

  const blobs = Array.from(groups.values()).filter(g => g.area >= minArea);
  if (!blobs.length) return { total: 0, points: [] };

  const sortedAreas = [...blobs.map(g => g.area)].sort((a, b) => a - b);
  const median = sortedAreas[Math.floor(sortedAreas.length / 2)];

  let total = 0;
  const points: DetPoint[] = [];
  for (const g of blobs) {
    const count = Math.max(1, Math.round(g.area / median));
    total += count;
    if (count === 1) {
      points.push({ x: g.sx / g.area, y: g.sy / g.area, split: false });
    } else {
      for (const c of kmeansSplit(g.pixels, count, w)) {
        points.push({ x: c.x, y: c.y, split: true });
      }
    }
  }
  return { total, points };
}

function paintOverlay(canvas: HTMLCanvasElement, base: ImageData, points: DetPoint[]) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.putImageData(base, 0, 0);
  for (const { x, y, split } of points) {
    const color = split ? SPLIT_COLOR : DIRECT_COLOR;
    // White halo for visibility on any background colour
    ctx.beginPath();
    ctx.arc(x, y, DOT_RADIUS + 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

// ─── component ────────────────────────────────────────────────────────────────

export default function SeedCounter() {
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const cameraInputRef  = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const imageDataRef    = useRef<ImageData | null>(null);

  const [hasImage,     setHasImage]     = useState(false);
  const [refColors,    setRefColors]    = useState<RefColor[]>([]);
  const [sensitivity,  setSensitivity]  = useState(30);
  const [minArea,      setMinArea]      = useState(20);
  const [result,       setResult]       = useState<DetResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const loadFile = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      imageDataRef.current = ctx.getImageData(0, 0, w, h);
      setHasImage(true);
      setRefColors([]);
      setResult(null);
    };
    img.src = url;
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadFile(file);
    e.target.value = "";
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const imageData = imageDataRef.current;
    if (!canvas || !imageData || refColors.length >= MAX_COLOURS) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) * (canvas.width  / rect.width));
    const y = Math.floor((e.clientY - rect.top)  * (canvas.height / rect.height));
    const color = sampleColor(imageData.data, x, y, canvas.width, canvas.height);
    setRefColors(prev => [...prev, color]);
  };

  const removeColor = (idx: number) =>
    setRefColors(prev => prev.filter((_, i) => i !== idx));

  const handleReset = () => {
    imageDataRef.current = null;
    setHasImage(false);
    setRefColors([]);
    setResult(null);
  };

  // Reactive detection — debounced 80 ms so slider drag doesn't cause jank
  useEffect(() => {
    const canvas    = canvasRef.current;
    const imageData = imageDataRef.current;
    if (!canvas || !imageData) return;

    if (refColors.length === 0) {
      // Restore clean image, clear count
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.putImageData(imageData, 0, 0);
      setResult(null);
      return;
    }

    const outer = setTimeout(() => {
      setIsProcessing(true);
      // Inner timeout yields to React so the spinner can render before the CPU work begins
      const inner = setTimeout(() => {
        const c  = canvasRef.current;
        const id = imageDataRef.current;
        if (!c || !id) { setIsProcessing(false); return; }
        const det = detect(id, refColors, sensitivity, minArea);
        paintOverlay(c, id, det.points);
        setResult(det);
        setIsProcessing(false);
      }, 0);
      return () => clearTimeout(inner);
    }, 80);

    return () => clearTimeout(outer);
  }, [refColors, sensitivity, minArea]);

  const total          = result?.total ?? 0;
  const hasSplitPoints = (result?.points ?? []).some(p => p.split);

  return (
    <div className="flex flex-col lg:flex-row gap-5 items-start">

      {/* ── Left: image / canvas ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Canvas is always mounted so canvasRef.current is never null inside loadFile.
            It is visually hidden (not display:none) until an image is loaded. */}
        <div className={cn(
          "relative rounded-xl overflow-hidden bg-gray-900 shadow-sm border border-gray-200",
          !hasImage && "hidden"
        )}>
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={cn(
              "block max-w-full",
              refColors.length < MAX_COLOURS ? "cursor-crosshair" : "cursor-default"
            )}
          />
          {hasImage && refColors.length === 0 && (
            <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
              <p className="bg-black/60 text-white text-sm px-4 py-2 rounded-full backdrop-blur-sm">
                Klik gambar untuk mengambil sampel warna benih
              </p>
            </div>
          )}
        </div>

        {hasImage && (result?.points.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-4 text-xs text-gray-500 px-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
              Deteksi langsung
            </span>
            {hasSplitPoints && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" />
                Estimasi (benih tergabung)
              </span>
            )}
          </div>
        )}

        {/* Empty state — shown only before any photo is loaded */}
        {!hasImage && (
          <div className="flex flex-col items-center justify-center gap-5 rounded-xl border-2 border-dashed border-gray-200 bg-white p-16 sm:p-20">
            <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
              <Camera className="w-7 h-7 text-green-500" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Unggah foto benih</p>
              <p className="text-xs text-gray-400 mt-1">Ambil foto lapangan atau pilih dari galeri untuk memulai</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 active:bg-green-800 transition-colors"
              >
                <Camera className="w-4 h-4" />
                Ambil Foto
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-700 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <ImagePlus className="w-4 h-4" />
                Pilih dari Galeri
              </button>
            </div>
          </div>
        )}

        {/* Hidden file inputs */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* ── Right: controls panel ────────────────────────────────────────── */}
      <div className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">

        {/* Count */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 text-center">
          {isProcessing ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 h-16">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Menghitung...</span>
            </div>
          ) : (
            <>
              <div className={cn(
                "text-6xl font-bold tabular-nums leading-none transition-colors duration-200",
                total > 0 ? "text-green-600" : "text-gray-200"
              )}>
                {total}
              </div>
              <div className="text-sm text-gray-400 mt-2">benih terdeteksi</div>
            </>
          )}
        </div>

        {/* Reference colours */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Warna Referensi
            </p>
            {refColors.length > 0 && (
              <button
                onClick={() => setRefColors([])}
                className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                Hapus Semua
              </button>
            )}
          </div>
          {refColors.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-1">
              {hasImage
                ? "Klik pada gambar untuk menambah warna benih"
                : "Unggah foto terlebih dahulu"}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {refColors.map((c, i) => (
                <div key={i} className="relative group/swatch">
                  <div
                    className="w-8 h-8 rounded-lg border border-black/10 shadow-sm"
                    style={{ backgroundColor: `rgb(${Math.round(c.r)},${Math.round(c.g)},${Math.round(c.b)})` }}
                    title={`RGB(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`}
                  />
                  <button
                    onClick={() => removeColor(i)}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm opacity-0 group-hover/swatch:opacity-100 hover:bg-red-50 transition-opacity"
                    aria-label="Hapus warna"
                  >
                    <X className="w-2.5 h-2.5 text-gray-500" />
                  </button>
                </div>
              ))}
              {refColors.length < MAX_COLOURS && (
                <div className="w-8 h-8 rounded-lg border border-dashed border-gray-200 flex items-center justify-center text-[10px] text-gray-300">
                  +{MAX_COLOURS - refColors.length}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sliders */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-5">
          {/* Sensitivity */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Sensitivitas Warna
              </label>
              <span className="text-xs font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                {sensitivity}
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={80}
              value={sensitivity}
              onChange={e => setSensitivity(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-green-600 bg-gray-200"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Ketat</span>
              <span>Longgar</span>
            </div>
          </div>

          {/* Min blob area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Min. Ukuran Blob
              </label>
              <span className="text-xs font-mono bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                {minArea} px
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={200}
              value={minArea}
              onChange={e => setMinArea(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-green-600 bg-gray-200"
            />
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Sensitif</span>
              <span>Hanya besar</span>
            </div>
          </div>
        </div>

        {/* Photo actions (only shown when an image is loaded) */}
        {hasImage && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                Foto Baru
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                Pilih File
              </button>
            </div>
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Reset
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
