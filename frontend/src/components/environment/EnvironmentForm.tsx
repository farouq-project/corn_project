"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin, Navigation, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(1, "Nama lingkungan wajib diisi"),
  address: z.string().optional(),
  latitude: z.coerce.number().optional().nullable(),
  longitude: z.coerce.number().optional().nullable(),
  season_id: z.coerce.number().optional().nullable(),
  elevation_m: z.coerce.number().int().optional().nullable(),
  avg_temperature_c: z.coerce.number().optional().nullable(),
  total_rainfall_mm: z.coerce.number().optional().nullable(),
  luas_ha: z.coerce.number().optional().nullable(),
  notes: z.string().optional(),
});

export type EnvironmentFormData = z.infer<typeof schema>;

interface Props {
  defaultValues?: Partial<EnvironmentFormData>;
  seasons: Array<{ id: number; season_name: string }>;
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
    if (!navigator.geolocation) { alert("Browser tidak mendukung geolokasi."); return; }
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
      () => { setLocating(false); alert("Gagal mendapatkan lokasi. Pastikan izin lokasi diaktifkan."); }
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

  // Fetch weather via Open-Meteo (free, no key needed)
  const fetchWeather = async (latVal: number, lngVal: number) => {
    setFetchingWeather(true);
    try {
      const url = `https://api.open-meteo.com/v1/climate?latitude=${latVal}&longitude=${lngVal}&start_year=2020&end_year=2023&models=CMIP6_MRI_ESM2_0&daily=temperature_2m_mean,precipitation_sum`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.daily) {
        const temps: number[] = data.daily.temperature_2m_mean?.filter((v: number | null) => v !== null) ?? [];
        const rains: number[] = data.daily.precipitation_sum?.filter((v: number | null) => v !== null) ?? [];
        if (temps.length > 0) {
          setValue("avg_temperature_c", Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10);
        }
        if (rains.length > 0) {
          // Annual total from daily average
          const dailyAvg = rains.reduce((a, b) => a + b, 0) / rains.length;
          setValue("total_rainfall_mm", Math.round(dailyAvg * 365));
        }
      }
    } catch {
      // Fallback: use forecast API
      try {
        const url2 = `https://api.open-meteo.com/v1/forecast?latitude=${latVal}&longitude=${lngVal}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=16&timezone=auto`;
        const res2 = await fetch(url2);
        const data2 = await res2.json();
        if (data2.daily) {
          const maxTemps: number[] = data2.daily.temperature_2m_max ?? [];
          const minTemps: number[] = data2.daily.temperature_2m_min ?? [];
          const rains: number[] = data2.daily.precipitation_sum ?? [];
          if (maxTemps.length > 0) {
            const avgTemp = maxTemps.map((max: number, i: number) => (max + (minTemps[i] ?? max)) / 2)
              .reduce((a: number, b: number) => a + b, 0) / maxTemps.length;
            setValue("avg_temperature_c", Math.round(avgTemp * 10) / 10);
          }
          if (rains.length > 0) {
            const dailyAvg = rains.reduce((a: number, b: number) => a + b, 0) / rains.length;
            setValue("total_rainfall_mm", Math.round(dailyAvg * 365));
          }
        }
      } catch { /* ignore */ }
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
      {/* Nama Lingkungan */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lingkungan *</label>
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

      {/* Musim */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Musim</label>
        <select {...register("season_id")} className={inputCls}>
          <option value="">-- Pilih Musim --</option>
          {seasons.map(s => <option key={s.id} value={s.id}>{s.season_name}</option>)}
        </select>
      </div>

      {/* Auto-detected fields */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-100">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Data Otomatis dari GPS</p>
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
            <input type="number" step="0.1" {...register("avg_temperature_c")} placeholder="Auto" className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Curah Hujan (mm/thn)</label>
            <input type="number" step="0.1" {...register("total_rainfall_mm")} placeholder="Auto" className={inputCls} />
          </div>
        </div>
        {!lat && !lng && (
          <p className="text-xs text-gray-400">Klik "Lokasi Saat Ini" atau masukkan koordinat GPS untuk mengisi otomatis</p>
        )}
        {fetchingWeather && (
          <p className="text-xs text-blue-500">Mengambil data iklim dari Open-Meteo...</p>
        )}
      </div>

      {/* Luas */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Luas (ha)</label>
        <input type="number" step="0.01" {...register("luas_ha")} placeholder="contoh: 2.5" className={inputCls} />
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
          {isSubmitting ? "Menyimpan..." : editMode ? "Simpan Perubahan" : "Buat Lingkungan"}
        </button>
      </div>
    </form>
  );
}
