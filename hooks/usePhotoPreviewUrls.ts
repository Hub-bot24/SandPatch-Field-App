"use client";

import { useEffect, useState } from "react";
import { PHOTO_NUMBERS, type PhotoNumber, type PhotoRecord } from "@/types/record";

/**
 * Derives object URLs for the currently loaded photo blobs and revokes
 * them on change/unmount, so previews never leak memory across a long
 * field session with many records.
 */
export function usePhotoPreviewUrls(
  photos: Partial<Record<PhotoNumber, PhotoRecord>>,
): Partial<Record<PhotoNumber, string>> {
  const [urls, setUrls] = useState<Partial<Record<PhotoNumber, string>>>({});

  useEffect(() => {
    const nextUrls: Partial<Record<PhotoNumber, string>> = {};
    for (const photoNumber of PHOTO_NUMBERS) {
      const photo = photos[photoNumber];
      if (photo) {
        nextUrls[photoNumber] = URL.createObjectURL(photo.blob);
      }
    }
    // Creation and revocation must stay paired in the same effect: doing
    // the createObjectURL calls during render instead (e.g. via useMemo)
    // risks leaking a URL if React re-invokes the render body without a
    // matching cleanup (as Strict Mode deliberately does in development).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrls(nextUrls);

    return () => {
      for (const url of Object.values(nextUrls)) {
        if (url) URL.revokeObjectURL(url);
      }
    };
  }, [photos]);

  return urls;
}
