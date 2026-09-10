import type { MediaItem } from "../types/media";
import { isVideoUrl } from "./format";

/** Returns a safe image URL for a media thumbnail, or null when only an icon should be shown. */
export function thumbnailUrl(media: MediaItem | undefined | null): string | null {
  if (!media) return null;
  if (media.type === "Video") return null;
  if (!media.thumbnail || isVideoUrl(media.thumbnail)) {
    return media.originalFile && !isVideoUrl(media.originalFile) ? media.originalFile : null;
  }
  return media.thumbnail;
}

export interface FileProbe {
  dimensions?: string;
  duration?: number;
}

/** Reads real dimensions/duration from a local file before upload so the library stores accurate metadata. */
export function probeFile(file: File): Promise<FileProbe> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const done = (probe: FileProbe) => {
      URL.revokeObjectURL(url);
      resolve(probe);
    };
    if (file.type.startsWith("video/")) {
      const v = document.createElement("video");
      v.preload = "metadata";
      v.onloadedmetadata = () => done({ dimensions: `${v.videoWidth}x${v.videoHeight}`, duration: Math.round(v.duration) || undefined });
      v.onerror = () => done({});
      v.src = url;
    } else if (file.type.startsWith("image/")) {
      const img = new Image();
      img.onload = () => done({ dimensions: `${img.naturalWidth}x${img.naturalHeight}` });
      img.onerror = () => done({});
      img.src = url;
    } else {
      done({});
    }
  });
}
