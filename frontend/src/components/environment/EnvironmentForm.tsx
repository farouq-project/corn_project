"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, Navigation, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  environment_code: z.string().optional(), // editable in edit mode
  name: z.string().min(1, "Nama kebun percobaan wajib diisi"),
  address: z.string().optional(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  season_name: z.string().optional(),
  elevation_m: z.coerce.number().int().optional().nullable(),
  avg_temperature_c: z.coerce.number().optional().nullable(),
  total_rainfall_mm: z.coerce.number().optional().nullable(),
  luas_ha: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
});

export type EnvironmentFormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<EnvironmentFormData>;
  seasons?: Array<{ id: number; season_name: string }>; // kept for backward compat, unused
  onSubmit: (data: EnvironmentFormData) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
  editMode?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GoogleMapsInstance = any;

declare global {
  interface Window {
    google: GoogleMapsInstance;
    initGoogleMaps?: () => void;
  }
}

export function EnvironmentForm({ defaultValues, seasons, onSubmit, onCancel, isSubmitting, editMode }: Props) {
  const [locating, setLocating] = useState(false);
  const [fetchingWeather, setFetchingWeather] = useState(false);
  const [mapsReady, setMapsReady] = useState(false);
  const addressRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<GoogleMapsInstance>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<EnvironmentFormData>({
    resolver: zodResolver(schema) as never,
    defaultValues: defaultValues ?? {},
  });

  const lat = watch("latitude");
  const lng = watch("longitude");

  // Load Google Maps script
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    if (window.google?.maps) { setMapsReady(true); return; }

    window.initGoogleMaps = () => setMapsReady(true);
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  // Init Places Autocomplete
  useEffect(() => {
    if (!mapsReady || !addressRef.current) return;
    autocompleteRef.current = new window.google.maps.places.Autocomplete(addressRef.current, {
      types: ["geocode"],
      fields: ["geometry", "formatted_address"],
    });
    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current!.getPlace();
      if (place.geometry?.location) {
        const newLat = place.geometry.location.lat();
        const newLng = place.geometry.location.lng();
        setValue("latitude", newLat);
        setValue("longitude", newLng);
        setValue("address", place.formatted_address ?? "");
        fetchElevation(newLat, newLng);
        fetchWeather(newLat, newLng);
      }
    });
  }, [mapsReady]);

  // Get current location
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("Browser tidak mendukung geolokasi.");
      return;
    }
    // Geolocation requires HTTPS — detect insecure context and warn
    if (typeof window !== "undefined" && window.location.protocol !== "https:" && window.location.hostname !== "localhost") {
      alert("Geolokasi memerlukan koneksi HTTPS. Halaman ini menggunakan HTTP, sehingga browser memblokir akses lokasi.\n\nSolusi: Aktifkan HTTPS di server (Certbot/Let's Encrypt), atau masukkan koordinat GPS secara manual.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newLat = pos.coords.latitude;
        const newLng = pos.coords.longitude;
        setValue("latitude", newLat);
        setValue("longitude", newLng);
        setLocating(false);
        // Reverse geocode
        if (mapsReady) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat: newLat, lng: newLng } }, (results: GoogleMapsInstance, status: string) => {
            if (status === "OK" && results?.[0]) {
              setValue("address", results[0].formatted_address);
            }
          });
        }
        fetchElevation(newLat, newLng);
        fetchWeather(newLat, newLng);
      },
      (err) => {
        setLocating(false);
        const msgs: Record<number, string> = {
          1: "Izin lokasi ditolak. Aktifkan izin lokasi di pengaturan browser.",
          2: "Lokasi tidak tersedia. Pastikan GPS aktif.",
          3: "Timeout mendapatkan lokasi. Coba lagi.",
        };
        alert(msgs[err.code] ?? `Error ${err.code}: ${err.message}`);
      }
    );
  };

  // Fetch elevation via Google Elevation API
  const fetchElevation = (latVal: number, lngVal: number) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !mapsReady) return;
    const elevator = new window.google.maps.ElevationService();
    elevator.getElevationForLocations({ locations: [{ lat: latVal, lng: lngVal }] }, (results: GoogleMapsInstance, status: string) => {
      if (status === "OK" && results?.[0]) {
        setValue("elevation_m", Math.round(results[0].elevation));
      }
    });
  };

  // Fetch weather via Open-Meteo forecast API (free, no key)
  const fetchWeather = async (latVal: number, lngVal: number) => {
    setFetchingWeather(true);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latVal}&longitude=${lngVal}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=16&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Weather API failed");
      const data = await res.json();
      const maxTemps: number[] = data.daily?.temperature_2m_max ?? [];
      const minTemps: number[] = data.daily?.temperature_2m_min ?? [];
      const rains: number[] = (data.daily?.precipitation_sum ?? []).filter((v: number | null) => v !== null);

      if (maxTemps.length > 0) {
        const avgTemp = maxTemps.map((max: number, i: number) => (max + (minTemps[i] ?? max)) / 2)
          .reduce((a: number, b: number) => a + b, 0) / maxTemps.length;
        setValue("avg_temperature_c", Math.round(avgTemp * 10) / 10);
      }
      if (rains.length > 0) {
        // Estimate annual rainfall from 16-day daily average
        const dailyAvg = rains.reduce((a: number, b: number) => a + b, 0) / rains.length;
        setValue("total_rainfall_mm", Math.round(dailyAvg * 365));
      }
    } catch {
      // silent fail — user can fill manually
    } finally {
      setFetchingWeather(false);
    }
  };

  const refetchAll = () => {
    if (lat && lng) {
      fetchElevation(lat, lng);
      fetchWeather(lat, lng);
    }
  };

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Kode Lokasi — always editable, auto-generated if left blank */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Kode Lokasi <span className="text-gray-400 font-normal text-xs">(opsional — dibuat otomatis jika kosong)</span>
        </label>
        <input {...register("environment_code")} placeholder="contoh: KEBUN-26"
          className={`${inputCls} font-mono`} />
      </div>

      {/* Nama Kebun Percobaan */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Kebun Percobaan *</label>
        <input {...register("name")} placeholder="contoh: Kebun Percobaan Normal 2026" className={inputCls} />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      {/* GPS */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700">Lokasi GPS</label>
          <button type="button" onClick={getCurrentLocation} disabled={locating}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition disabled:opacity-50">
            <Navigation className="w-3.5 h-3.5" />
            {locating ? "Mendeteksi..." : "Lokasi Saat Ini"}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Latitude</label>
            <input type="number" step="0.0000001" {...register("latitude")} placeholder="-6.9272" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Longitude</label>
            <input type="number" step="0.0000001" {...register("longitude")} placeholder="107.7705" className={inputCls} />
          </div>
        </div>
        {lat && lng && (
          <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-1 text-xs text-blue-600 hover:underline">
            <MapPin className="w-3 h-3" /> Lihat di Google Maps
          </a>
        )}
      </div>

      {/* Alamat */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Alamat</label>
        <input
          ref={(el) => {
            addressRef.current = el;
            const { ref } = register("address");
            if (typeof ref === "function") ref(el);
          }}
          placeholder={mapsReady ? "Ketik alamat untuk saran otomatis..." : "Ketik alamat lengkap"}
          className={cn(inputCls, mapsReady && "border-blue-200")}
        />
        {!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
          <p className="text-xs text-amber-600 mt-1">Google Maps API key belum dikonfigurasi — saran alamat tidak aktif</p>
        )}
      </div>

      {/* Musim — manual text, optional */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Musim <span className="text-gray-400 font-normal text-xs">(opsional)</span></label>
        <input {...register("season_name")} placeholder="contoh: Musim Hujan 2026"
          className={inputCls} />
      </div>

      {/* Auto-detected fields */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Data dari GPS</p>
          {lat && lng && (
            <button type="button" onClick={refetchAll} disabled={fetchingWeather}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50">
              <RefreshCw className={cn("w-3.5 h-3.5", fetchingWeather && "animate-spin")} />
              {fetchingWeather ? "Mengambil..." : "Refresh"}
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Elevasi (m dpl)</label>
            <input type="number" {...register("elevation_m")} placeholder="Auto" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Suhu Rata (°C)</label>
            <input type="number" step="0.1" {...register("avg_temperature_c")}
              placeholder={fetchingWeather ? "Mengambil..." : "Auto"} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Curah Hujan (mm/thn)</label>
            <input type="number" step="0.1" {...register("total_rainfall_mm")}
              placeholder={fetchingWeather ? "Mengambil..." : "Auto"} className={inputCls} />
          </div>
        </div>
        {!lat && !lng && (
          <p className="text-xs text-gray-400">Klik "Lokasi Saat Ini" atau masukkan koordinat GPS untuk mengisi otomatis</p>
        )}
        {fetchingWeather && (
          <p className="text-xs text-blue-500 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" /> Mengambil data iklim dari Open-Meteo...
          </p>
        )}
      </div>

      {/* Luas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Luas (m²)</label>
        <input type="number" step="1" {...register("luas_ha")} placeholder="contoh: 2500" className={inputCls} />
        <p className="text-xs text-gray-400 mt-0.5">Masukkan luas lahan dalam meter persegi</p>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Catatan</label>
        <textarea {...register("notes")} rows={2} className={cn(inputCls, "resize-none")} />
      </div>

      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition">
          Batal
        </button>
        <button type="submit" disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition">
          {isSubmitting ? "Menyimpan..." : editMode ? "Simpan Perubahan" : "Buat Lokasi"}
        </button>
      </div>
    </form>
  );
}
