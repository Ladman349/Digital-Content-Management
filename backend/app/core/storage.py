import os
import shutil
import urllib.request
import urllib.error
import json
from abc import ABC, abstractmethod
from app.core.config import settings

class StorageProvider(ABC):
    @abstractmethod
    def upload(self, file_content: bytes, filename: str, content_type: str) -> str:
        """Uploads file content and returns a storage URI (e.g. supabase://bucket/path or local://path)"""
        pass

    @abstractmethod
    def delete(self, storage_uri: str) -> bool:
        """Deletes a file by its storage URI"""
        pass

    @abstractmethod
    def get_public_url(self, storage_uri: str) -> str:
        """Resolves a storage URI into a public HTTP/HTTPS URL"""
        pass

    @abstractmethod
    def verify_connection(self) -> None:
        """Verifies connection and configuration health, failing fast if unreachable"""
        pass


class LocalStorageProvider(StorageProvider):
    MEDIA_FOLDER = "media"

    def upload(self, file_content: bytes, filename: str, content_type: str) -> str:
        os.makedirs(self.MEDIA_FOLDER, exist_ok=True)
        file_path = os.path.join(self.MEDIA_FOLDER, filename)
        with open(file_path, "wb") as f:
            f.write(file_content)
        return f"local://{filename}"

    def delete(self, storage_uri: str) -> bool:
        filename = storage_uri.replace("local://", "")
        file_path = os.path.join(self.MEDIA_FOLDER, filename)
        if os.path.exists(file_path):
            os.remove(file_path)
            return True
        return False

    def get_public_url(self, storage_uri: str) -> str:
        filename = storage_uri.replace("local://", "")
        return f"{settings.API_BASE_URL.rstrip('/')}/uploads/{filename}"

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
    def __init__(self):
        self.url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else ""
        self.key = settings.SUPABASE_SERVICE_ROLE_KEY or ""
        self.bucket = settings.SUPABASE_STORAGE_BUCKET

    def upload(self, file_content: bytes, filename: str, content_type: str) -> str:
        upload_url = f"{self.url}/storage/v1/object/{self.bucket}/{filename}"
        
        headers = {
            "Authorization": f"Bearer {self.key}",
            "Content-Type": content_type
        }
        
        req = urllib.request.Request(
            url=upload_url,
            data=file_content,
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
        if not storage_uri.startswith("supabase://"):
            return False
            
        # Parse uri: supabase://bucket/filename
        parts = storage_uri.replace("supabase://", "").split("/", 1)
        if len(parts) < 2:
            return False
        bucket, filename = parts
        
        delete_url = f"{self.url}/storage/v1/object/{bucket}"
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

    def get_public_url(self, storage_uri: str) -> str:
        if not storage_uri.startswith("supabase://"):
            return storage_uri
            
        parts = storage_uri.replace("supabase://", "").split("/", 1)
        bucket, filename = parts
        return f"{self.url}/storage/v1/object/public/{bucket}/{filename}"

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


def get_storage_provider() -> StorageProvider:
    # Use Supabase if configured, otherwise fallback to local filesystem storage
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        return SupabaseStorageProvider()
    return LocalStorageProvider()
