import type { Settings, CarType } from './supabase';

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  opening_day: 1.0,
  opening_night: 1.0,
  km_price_day: 0.28,
  km_price_night: 0.33,
  wait_price_per_min: 0.05,
  night_start_hour: 22,
  night_end_hour: 6,
  car_type_options: ['electric', 'hybrid', 'petrol', 'premium', 'lady', 'family'],
};

export const INCLUDED_KM = 3;

export interface CarTypePricing {
  opening: number;
  km_price_day: number;
  km_price_night: number;
}

export const CAR_TYPE_PRICING: Record<CarType, CarTypePricing> = {
  electric: { opening: 1.0, km_price_day: 0.28, km_price_night: 0.33 },
  hybrid: { opening: 1.0, km_price_day: 0.30, km_price_night: 0.35 },
  petrol: { opening: 1.0, km_price_day: 0.28, km_price_night: 0.33 },
  premium: { opening: 1.5, km_price_day: 0.40, km_price_night: 0.45 },
  lady: { opening: 1.0, km_price_day: 0.28, km_price_night: 0.33 },
  family: { opening: 1.0, km_price_day: 0.35, km_price_night: 0.40 },
};

export interface DBPricingSettings {
  night_start_hour: number;
  night_end_hour: number;
  wait_price_per_min: number;
  included_km?: number;
  car_pricing: Record<string, CarTypePricing>;
}

export function getCarTypePricing(
  carType: CarType,
  dbSettings?: DBPricingSettings | null,
): CarTypePricing {
  if (dbSettings?.car_pricing?.[carType]) {
    return dbSettings.car_pricing[carType];
  }
  return CAR_TYPE_PRICING[carType] ?? CAR_TYPE_PRICING.petrol;
}

let cachedPricing: DBPricingSettings | null = null;

export async function loadPricingSettings(): Promise<DBPricingSettings | null> {
  if (cachedPricing) return cachedPricing;
  try {
    const { supabase } = await import('./supabase');
    const { data } = await supabase
      .from('pricing_settings')
      .select('night_start_hour, night_end_hour, wait_price_per_min, included_km, car_pricing')
      .eq('id', 1)
      .maybeSingle();
    if (data) {
      cachedPricing = data as DBPricingSettings;
    }
    return cachedPricing;
  } catch {
    return null;
  }
}

export function isNightTime(
  date: Date,
  nightStart: number = 22,
  nightEnd: number = 6,
): boolean {
  const hour = date.getHours();
  if (nightStart > nightEnd) {
    return hour >= nightStart || hour < nightEnd;
  }
  return hour >= nightStart && hour < nightEnd;
}

export function calculatePrice(
  distanceKm: number,
  waitMin: number,
  isNight: boolean,
  settings: Settings | null | undefined = DEFAULT_SETTINGS,
  carType: CarType = 'petrol',
  dbSettings?: DBPricingSettings | null,
): number {
  const pricing = getCarTypePricing(carType, dbSettings);
  const s = settings ?? DEFAULT_SETTINGS;

  const opening = pricing.opening;
  const kmPrice = isNight ? pricing.km_price_night : pricing.km_price_day;
  const waitPrice = dbSettings
    ? dbSettings.wait_price_per_min
    : parseFloat(String(s.wait_price_per_min ?? DEFAULT_SETTINGS.wait_price_per_min)) || DEFAULT_SETTINGS.wait_price_per_min;

  const extraKm = Math.max(0, distanceKm - (dbSettings?.included_km ?? INCLUDED_KM));
  const total = opening + extraKm * kmPrice + waitMin * waitPrice;
  return Math.round(total * 100) / 100;
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}
