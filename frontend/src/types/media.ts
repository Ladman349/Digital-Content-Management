export type MediaType = "Image" | "Video";
export type MediaCategory = "Advertisement" | "Promotion" | "Branding" | "Announcement" | "Emergency";

export interface MediaItem {
  id: string;
  name: string;
  type: MediaType;
  category: MediaCategory;
  thumbnail: string;
  originalFile: string;
  size: number; // in bytes
  dimensions: string; // e.g. "1920x1080"
  duration?: number; // in seconds, for videos
  uploadedAt: number; // timestamp
  uploadedBy: string;
}
