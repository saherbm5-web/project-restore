'use client';

import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';

export interface GeoLocation {
  lat: number;
  lng: number;
}

export async function requestLocationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    const status = await Geolocation.requestPermissions();
    return status.location === 'granted';
  }
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve(true),
      () => resolve(false),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
    );
  });
}

export async function getCurrentLocation(): Promise<GeoLocation> {
  if (Capacitor.isNativePlatform()) {
    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0,
    });
    return { lat: pos.coords.latitude, lng: pos.coords.longitude };
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

export interface LocationWatch {
  clear: () => void;
}

export async function watchLocation(
  callback: (loc: GeoLocation) => void,
): Promise<LocationWatch> {
  if (Capacitor.isNativePlatform()) {
    const watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
      (pos) => {
        if (pos) {
          callback({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      },
    );
    return {
      clear: () => { void Geolocation.clearWatch({ id: watchId }); },
    };
  }

  const browserWatchId = navigator.geolocation.watchPosition(
    (pos) => callback({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    () => {},
    { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 },
  );

  return {
    clear: () => { navigator.geolocation.clearWatch(browserWatchId); },
  };
}
