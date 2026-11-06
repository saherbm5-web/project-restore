export function openDirectGPS(lat: number, lng: number, label: string) {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const googleNav = `google.navigation:q=${lat},${lng}&mode=d`;
  const appleNav = `maps://?daddr=${lat},${lng}&dirflg=d`;
  const geoNav = `geo:${lat},${lng}?q=${lat},${lng}(${encodeURIComponent(label)})`;

  if (isIOS) {
    window.location.href = appleNav;
  } else {
    window.location.href = googleNav;
    setTimeout(() => {
      window.location.href = geoNav;
    }, 1000);
  }
}
