export type GpsReading = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export function captureCurrentPosition(): Promise<GpsReading> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Brauzeringiz geolokatsiyani qo'llab-quvvatlamaydi."));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        });
      },
      (error) => {
        reject(new Error(error.message || "Joylashuvni aniqlab bo'lmadi."));
      },
      {
        enableHighAccuracy: true,
        timeout: 15_000,
        maximumAge: 0,
      },
    );
  });
}
