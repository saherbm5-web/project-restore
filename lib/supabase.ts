import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type RideStatus = 'pending' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';
export type AccuracyType = 'gps' | 'ip' | 'manual';
export type PaymentMethod = 'cash' | 'wallet' | 'cliq' | 'iban';
export type CarType = 'electric' | 'hybrid' | 'petrol' | 'premium' | 'lady' | 'family';

export const CAR_TYPE_LABELS: Record<CarType, string> = {
  electric: 'كهربائية',
  hybrid: 'هايبرد',
  petrol: 'بنزين',
  premium: 'مميز',
  lady: 'ليدي',
  family: 'عائلي',
};

export type FuelType = 'electric' | 'hybrid' | 'petrol';
export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  electric: 'كهرباء',
  hybrid: 'هايبرد',
  petrol: 'بنزين',
};

export interface Ride {
  id: string;
  customer_phone: string;
  from_address: string;
  to_address: string;
  from_lat: number | null;
  from_lng: number | null;
  to_lat: number | null;
  to_lng: number | null;
  distance_km: number | null;
  price: number | null;
  status: RideStatus;
  driver_id: string | null;
  accuracy_type: AccuracyType;
  payment_method: PaymentMethod;
  payment_proof_url: string | null;
  car_type: CarType | null;
  order_id: string | null;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  started_at: string | null;
  route_points: number[][] | null;
  final_price: number | null;
}

export type DriverStatus = 'pending_approval' | 'approved' | 'rejected';

export interface Driver {
  id: string;
  name: string;
  phone: string;
  car_number: string;
  is_online: boolean;
  is_approved: boolean;
  status: DriverStatus;
  car_type: string | null;
  fuel_type: string | null;
  car_model: string | null;
  car_color: string | null;
  license_number: string | null;
  current_lat: number | null;
  current_lng: number | null;
  location_updated_at: string | null;
  created_at: string;
  vehicle_license_url: string | null;
  driver_license_url: string | null;
  driver_with_car_url: string | null;
  selfie_url: string | null;
  national_id: string | null;
  car_year: string | null;
  rating: number;
  total_rides: number;
  per_km_price: number | null;
  is_fake?: boolean;
}

export interface Settings {
  id: number;
  opening_day: number;
  opening_night: number;
  km_price_day: number;
  km_price_night: number;
  wait_price_per_min: number;
  night_start_hour: number;
  night_end_hour: number;
  car_type_options: CarType[] | null;
}

export interface RideInsert {
  customer_phone: string;
  from_address: string;
  to_address: string;
  from_lat?: number | null;
  from_lng?: number | null;
  to_lat?: number | null;
  to_lng?: number | null;
  distance_km?: number | null;
  price?: number | null;
  status?: RideStatus;
  driver_id?: string | null;
  accuracy_type?: AccuracyType;
  payment_method?: PaymentMethod;
  payment_proof_url?: string | null;
  car_type?: CarType | null;
  order_id?: string | null;
}

export interface Wallet {
  id: string;
  phone: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export type TopupStatus = 'pending' | 'approved' | 'rejected';
export type TopupMethod = 'cliq' | 'iban';

export interface WalletTopup {
  id: string;
  wallet_id: string | null;
  phone: string;
  amount: number;
  method: TopupMethod;
  proof_url: string | null;
  status: TopupStatus;
  created_at: string;
}

export type UserRole = 'customer' | 'driver' | 'admin';

export interface Profile {
  id: string;
  phone: string;
  name: string | null;
  avatar_url: string | null;
  rating: number;
  total_rides: number;
  created_at: string;
  updated_at: string;
  email: string | null;
  role: UserRole;
  user_id: string | null;
}

export type WalletTransactionType = 'topup' | 'ride_payment' | 'admin_adjust';

export interface WalletTransaction {
  id: string;
  wallet_id: string | null;
  phone: string;
  amount: number;
  type: WalletTransactionType;
  reference: string | null;
  created_at: string;
}

export type PaymentStatus = 'pending' | 'paid';

export interface Payment {
  id: string;
  ride_id: string;
  phone: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  created_at: string;
}

export interface DriverRating {
  id: string;
  driver_id: string;
  ride_id: string;
  customer_phone: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

export type OrderStatus = 'pending' | 'accepted' | 'arrived' | 'in_progress' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  customer_id: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  status: OrderStatus;
  driver_id: string | null;
  created_at: string;
  otp_code?: string | null;
  payment_method?: string | null;
  car_type?: string | null;
  notes?: string | null;
}

export interface PromoCode {
  id: string;
  code: string;
  discount_value: number;
  discount_type: 'percent' | 'fixed';
  applicable_to: 'rider' | 'driver' | 'all';
  max_uses: number;
  used_count: number;
  expiry: string | null;
  is_active: boolean;
  created_at: string;
}

export interface PromoCustomer {
  id: string;
  code: string;
  discount_percent: number;
  max_uses: number;
  used_count: number;
  expiry: string | null;
  is_active: boolean;
  created_at: string;
}

export interface WalletBonusCode {
  id: string;
  code: string;
  bonus_value: number;
  bonus_type: 'percent' | 'fixed';
  min_recharge: number;
  max_uses: number;
  used_count: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

export interface PromoCaptain {
  id: string;
  code: string;
  bonus_percent: number;
  max_uses: number;
  used_count: number;
  expiry: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Broadcast {
  id: string;
  message: string;
  target: 'customers' | 'captains';
  created_at: string;
}
