export interface AppUpdate {
  id: string;
  version_name: string;
  version_code: number;
  apk_filename: string;
  apk_url: string;
  checksum_sha256: string;
  file_size: number;
  release_notes?: string | null;
  mandatory: boolean;
  is_active: boolean;
  download_count: number;
  last_downloaded_at?: string | null;
  created_at: string;
  /**
   * Object-storage URI for the APK. Null means the file only exists on the backend's local disk,
   * which is wiped on every redeploy, so the release would stop downloading without warning.
   */
  storage_uri?: string | null;
}

export interface AppUpdateUploadPayload {
  file: File;
  versionName: string;
  versionCode: number;
  mandatory: boolean;
  isActive: boolean;
  releaseNotes?: string;
}
