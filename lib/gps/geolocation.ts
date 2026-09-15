import type { GpsReading } from "@/types/record";

export type GpsErrorCode = "PERMISSION_DENIED" | "POSITION_UNAVAILABLE" | "TIMEOUT" | "UNSUPPORTED";

export type GpsResult =
  | { status: "success"; reading: GpsReading }
  | { status: "error"; code: GpsErrorCode; message: string };

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
};

function messageForCode(code: GpsErrorCode): string {
  switch (code) {
    case "PERMISSION_DENIED":
      return "Location permission was denied. Enable location access for this app in your browser/device settings, then try again. You can still save this record without GPS.";
    case "POSITION_UNAVAILABLE":
      return "Location is currently unavailable (no GPS signal or no network fix). Try moving to open sky and try again.";
    case "TIMEOUT":
      return "Getting the GPS position timed out. Try again, ideally with a clear view of the sky.";
    case "UNSUPPORTED":
      return "This browser does not support geolocation.";
    default:
      return "Unable to get GPS position.";
  }
}

/**
 * Wraps navigator.geolocation in a Promise with clean, user-facing error
 * handling. Never throws - callers always get a discriminated result, and
 * a denial or failure must never block saving the record (see spec: "Do
 * not block saving if GPS is poor").
 */
export function getCurrentGpsReading(options: PositionOptions = DEFAULT_OPTIONS): Promise<GpsResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ status: "error", code: "UNSUPPORTED", message: messageForCode("UNSUPPORTED") });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const reading: GpsReading = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        };
        resolve({ status: "success", reading });
      },
      (error) => {
        let code: GpsErrorCode;
        switch (error.code) {
          case error.PERMISSION_DENIED:
            code = "PERMISSION_DENIED";
            break;
          case error.POSITION_UNAVAILABLE:
            code = "POSITION_UNAVAILABLE";
            break;
          case error.TIMEOUT:
            code = "TIMEOUT";
            break;
          default:
            code = "POSITION_UNAVAILABLE";
        }
        resolve({ status: "error", code, message: messageForCode(code) });
      },
      options,
    );
  });
}
