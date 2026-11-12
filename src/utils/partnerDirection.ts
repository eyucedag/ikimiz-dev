export interface Coordinates { latitude: number; longitude: number }

export function partnerDirection(from: Coordinates, to: Coordinates, heading: number | null) {
  const radians = Math.PI / 180;
  const lat1 = from.latitude * radians;
  const lat2 = to.latitude * radians;
  const deltaLat = lat2 - lat1;
  const deltaLon = (to.longitude - from.longitude) * radians;
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const distance = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  const bearing = (Math.atan2(Math.sin(deltaLon) * Math.cos(lat2),
    Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon)) / radians + 360) % 360;
  return { distance, rotation: distance < 3 ? null : (bearing - (heading ?? 0) + 360) % 360 };
}
