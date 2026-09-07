import os
import shutil
import urllib.request
import urllib.error
import urllib.parse
import json
from abc import ABC, abstractmethod
from typing import BinaryIO
from app.core.config import settings

class StorageProvider(ABC):
    @abstractmethod
    def upload(self, file_obj: BinaryIO, filename: str, content_type: str, size: int) -> str:
        """Streams a file-like object to storage and returns a storage URI (e.g. supabase://bucket/path or local://path)"""
        pass

    @abstractmethod
    def delete(self, storage_uri: str) -> bool:
        """Deletes a file by its storage URI"""
        pass

    @abstractmethod
    def get_public_url(self, storage_uri: str, base_url_override: str | None = None) -> str:
        """Resolves a storage URI into a public HTTP/HTTPS URL"""
        pass

    @abstractmethod
    def verify_connection(self) -> None:
        """Verifies connection and configuration health, failing fast if unreachable"""
        pass

    @property
    def is_remote(self) -> bool:
        """True when objects live outside this server's filesystem and survive a redeploy."""
        return False


class LocalStorageProvider(StorageProvider):
    MEDIA_FOLDER = "media"

    def _resolve_media_path(self, filename: str) -> str | None:
        """Resolves a stored object name to an absolute path inside MEDIA_FOLDER, or None if it escapes it."""
        media_root = os.path.realpath(self.MEDIA_FOLDER)
        file_path = os.path.realpath(os.path.join(media_root, filename))
        try:
            if os.path.commonpath([media_root, file_path]) != media_root:
                return None
        except ValueError:
            # Different drives on Windows
            return None
        if file_path == media_root:
            return None
        return file_path

    def upload(self, file_obj: BinaryIO, filename: str, content_type: str, size: int) -> str:
        os.makedirs(self.MEDIA_FOLDER, exist_ok=True)
        # Object names are generated server-side, but never trust a path component regardless
        filename = os.path.basename(filename)
        file_path = self._resolve_media_path(filename)
        if not file_path:
            raise ValueError(f"Invalid storage object name: {filename}")
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file_obj, f, length=1024 * 1024)
        return f"local://{filename}"

    def delete(self, storage_uri: str) -> bool:
        clean = storage_uri
        if "local://" in clean:
            clean = "local://" + clean.split("local://", 1)[1]
        filename = clean.replace("local://", "")
        file_path = self._resolve_media_path(filename)
        if not file_path:
            return False
        if os.path.isfile(file_path):
            os.remove(file_path)
            return True
        return False

    def get_public_url(self, storage_uri: str, base_url_override: str | None = None) -> str:
        clean = storage_uri or ""
        if "supabase://" in clean:
            clean = "supabase://" + clean.split("supabase://", 1)[1]
        elif "local://" in clean:
            clean = "local://" + clean.split("local://", 1)[1]

        filename = clean.replace("local://", "").replace("supabase://media/", "").replace("supabase://", "")
        if "/uploads/" in filename:
            filename = filename.split("/uploads/")[-1]

        base_url = base_url_override or settings.API_BASE_URL
        return f"{base_url.rstrip('/')}/uploads/{urllib.parse.quote(filename, safe='/')}"

    def verify_connection(self) -> None:
        # Check if media directory is writable
        try:
            os.makedirs(self.MEDIA_FOLDER, exist_ok=True)
            temp_file = os.path.join(self.MEDIA_FOLDER, ".write_test")
            with open(temp_file, "w") as f:
                f.write("test")
            os.remove(temp_file)
        except Exception as e:
            raise RuntimeError(f"Local storage folder '{self.MEDIA_FOLDER}' is not writable: {str(e)}")


class SupabaseStorageProvider(StorageProvider):
    def __init__(self, bucket: str | None = None):
        self.url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else ""
        self.key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
        self.bucket = bucket or settings.SUPABASE_STORAGE_BUCKET

    @property
    def is_remote(self) -> bool:
        return True

    def upload(self, file_obj: BinaryIO, filename: str, content_type: str, size: int) -> str:
        object_path = urllib.parse.quote(filename, safe="/")
        upload_url = f"{self.url}/storage/v1/object/{self.bucket}/{object_path}"

        headers = {
            "Authorization": f"Bearer {self.key}",
            "Content-Type": content_type,
            # Explicit length lets http.client stream the file-like body instead of buffering or chunking it
            "Content-Length": str(size),
            "cache-control": "public, max-age=31536000, immutable",
            "x-upsert": "true"
        }

        req = urllib.request.Request(
            url=upload_url,
            data=file_obj,
            headers=headers,
            method="POST"
        )

        try:
            with urllib.request.urlopen(req) as response:
                if response.status in (200, 201):
                    return f"supabase://{self.bucket}/{filename}"
                else:
                    raise RuntimeError(f"Supabase upload failed with HTTP status: {response.status}")
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8")
            raise RuntimeError(f"Supabase upload HTTP error: {e.code} - {error_body}")
        except Exception as e:
            raise RuntimeError(f"Supabase upload failed: {str(e)}")

    def delete(self, storage_uri: str) -> bool:
        clean = storage_uri or ""
        if "supabase://" in clean:
            clean = "supabase://" + clean.split("supabase://", 1)[1]
        else:
            return False

        # Parse uri: supabase://bucket/filename
        parts = clean.replace("supabase://", "").split("/", 1)
        if len(parts) < 2:
            return False
        bucket, filename = parts

        delete_url = f"{self.url}/storage/v1/object/{urllib.parse.quote(bucket, safe='')}"
        headers = {
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json"
        }
        payload = json.dumps({"prefixes": [filename]}).encode("utf-8")

        req = urllib.request.Request(
            url=delete_url,
            data=payload,
            headers=headers,
            method="DELETE"
        )

        try:
            with urllib.request.urlopen(req) as response:
                return response.status in (200, 204)
        except Exception:
            return False

    def get_public_url(self, storage_uri: str, base_url_override: str | None = None) -> str:
        clean = storage_uri or ""
        if "supabase://" in clean:
            clean = "supabase://" + clean.split("supabase://", 1)[1]
        else:
            return storage_uri

        parts = clean.replace("supabase://", "").split("/", 1)
        if len(parts) == 2:
            bucket, filename = parts
            return f"{self.url}/storage/v1/object/public/{bucket}/{urllib.parse.quote(filename, safe='/')}"
        return clean

    def verify_connection(self) -> None:
        if not self.url or not self.key:
            raise ValueError("Supabase storage url and service role key are not configured!")

        bucket_url = f"{self.url}/storage/v1/bucket/{self.bucket}"
        headers = {
            "Authorization": f"Bearer {self.key}"
        }

        req = urllib.request.Request(
            url=bucket_url,
            headers=headers,
            method="GET"
        )

        try:
            with urllib.request.urlopen(req) as response:
                if response.status != 200:
                    raise RuntimeError(f"Supabase bucket checks failed with status: {response.status}")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                raise RuntimeError(f"Supabase bucket '{self.bucket}' does not exist! Please create it in your Supabase project.")
            error_body = e.read().decode("utf-8")
            raise RuntimeError(f"Supabase storage bucket unreachable (HTTP {e.code}): {error_body}")
        except Exception as e:
            raise RuntimeError(f"Failed to connect to Supabase Storage: {str(e)}")


def get_storage_provider(bucket: str | None = None) -> StorageProvider:
    """
    Returns the configured storage backend, optionally targeting a specific bucket.

    Pass `bucket` to place objects somewhere other than the default media bucket
    (player APKs use settings.SUPABASE_APK_BUCKET). Falls back to local filesystem
    storage when Supabase is not configured, in which case the bucket is ignored.
    """
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        return SupabaseStorageProvider(bucket=bucket)
    return LocalStorageProvider()


def get_apk_storage_provider() -> StorageProvider:
    """Storage backend for player APKs."""
    return get_storage_provider(bucket=settings.SUPABASE_APK_BUCKET)
