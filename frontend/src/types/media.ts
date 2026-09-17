export type MediaType = "Image" | "Video";
export type MediaCategory = "Advertisement" | "Promotion" | "Branding" | "Announcement" | "Emergency";

export const MEDIA_CATEGORIES: MediaCategory[] = ["Advertisement", "Promotion", "Branding", "Announcement", "Emergency"];

export interface MediaItem {
  id: string;
  name: string;
  type: MediaType;
  category: MediaCategory;
  thumbnail: string;
  originalFile: string;
  size: number;
  dimensions: string;
  duration?: number | null;
  uploadedAt: number;
  uploadedBy: string;
  checksum?: string | null;
  /** Owning client; null or absent means it belongs to the operator. Only administrators can change it. */
  clientId?: string | null;
}

export interface MediaUpdatePayload {
  name?: string;
  category?: MediaCategory;
  duration?: number;
  dimensions?: string;
  clientId?: string | null;
}
