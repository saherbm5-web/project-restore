export type AccuracyType = 'gps' | 'ip' | 'manual';

export interface LocationResult {
  lat: number;
  lng: number;
  address: string;
  accuracyType: AccuracyType;
}

export interface SearchResult {
  lat: number;
  lng: number;
  display_name: string;
}

export function reverseGeocode(lat: number, lng: number): Promise<string> {
  return fetch(
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
    { headers: { 'Accept-Language': 'ar' } },
  )
    .then((r) => r.json())
    .then((data) => data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`)
    .catch(() => `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
}

export function getGPSLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  });
}

export async function getIPLocation(): Promise<{ lat: number; lng: number }> {
  const res = await fetch('https://ipapi.co/json/');
  if (!res.ok) throw new Error('IP geolocation failed');
  const data = await res.json();
  if (!data.latitude || !data.longitude) throw new Error('IP geolocation no coords');
  return { lat: data.latitude, lng: data.longitude };
}

export async function searchAddress(query: string): Promise<SearchResult[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`,
    { headers: { 'Accept-Language': 'ar' } },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data as Array<{ lat: string; lon: string; display_name: string }>).map((r) => ({
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    display_name: r.display_name,
  }));
}
