"use client";
import { useState, useEffect } from "react";
import { Download, Smartphone, Share2, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function InstallIconButton() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }
    setIsMobile(isMobileDevice());

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Hide if already installed, or on desktop without a prompt
  if (isInstalled) return null;
  if (!isMobile && !prompt) return null;

  const handleClick = async () => {
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === "accepted") setIsInstalled(true);
      setPrompt(null);
    } else {
      setShowModal(true);
    }
  };

  const ios = isIOS();

  return (
    <>
      <button
        onClick={handleClick}
        title="Pasang Aplikasi"
        className="relative p-2 rounded-lg hover:bg-gray-100 transition text-gray-500 hover:text-gray-700"
      >
        <Download className="w-5 h-5" />
      </button>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-green-600" />
                <h3 className="text-sm font-semibold text-gray-900">Cara Pasang Aplikasi</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {ios ? (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <span>Buka di <strong>Safari</strong> (browser lain tidak mendukung)</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <span>Tap ikon <Share2 className="inline w-4 h-4 text-blue-500" /> <strong>Share</strong> di bawah layar</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                  <span>Pilih <strong>&ldquo;Add to Home Screen&rdquo;</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">4</span>
                  <span>Tap <strong>&ldquo;Add&rdquo;</strong></span>
                </li>
              </ol>
            ) : (
              <ol className="space-y-3 text-sm text-gray-700">
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">1</span>
                  <span>Tap ikon <strong>⋮</strong> (tiga titik) di pojok kanan atas Chrome</span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">2</span>
                  <span>Pilih <strong>&ldquo;Add to Home screen&rdquo;</strong> atau <strong>&ldquo;Install app&rdquo;</strong></span>
                </li>
                <li className="flex gap-3">
                  <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-xs font-bold flex items-center justify-center flex-shrink-0">3</span>
                  <span>Tap <strong>&ldquo;Add&rdquo;</strong> / <strong>&ldquo;Install&rdquo;</strong></span>
                </li>
              </ol>
            )}

            <p className="mt-4 text-xs text-amber-600 bg-amber-50 rounded-lg p-2.5">
              Catatan: Untuk instalasi otomatis (tanpa langkah manual), akses aplikasi melalui HTTPS.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
