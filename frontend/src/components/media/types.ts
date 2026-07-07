export type { MediaItem, MediaType, MediaCategory } from "../../types/media";
import type { MediaType, MediaCategory } from "../../types/media";

export type SortField = "name" | "uploadedAt" | "size";
export type SortDirection = "asc" | "desc";
export type TypeFilter = "All" | MediaType;
export type CategoryFilter = "All" | MediaCategory;

export interface UploadFormValues {
  name: string;
  files: File[];
}
