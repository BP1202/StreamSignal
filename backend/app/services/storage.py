import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Union
from app.core.config import get_settings


class StorageBackend(ABC):
    """
    Abstract storage backend interface for visual evidence binaries.
    Decouples byte persistence from database metadata and business logic.
    """

    @abstractmethod
    def save(self, storage_key: str, data: bytes) -> str:
        """Persist data bytes under the specified storage key."""
        pass

    @abstractmethod
    def exists(self, storage_key: str) -> bool:
        """Check whether data exists for the given storage key."""
        pass

    @abstractmethod
    def delete(self, storage_key: str) -> bool:
        """Remove data associated with the given storage key."""
        pass

    @abstractmethod
    def get_path(self, storage_key: str) -> Path:
        """Return the absolute path for local files, ensuring path confinement."""
        pass


class LocalFileStorage(StorageBackend):
    """
    Filesystem storage backend with strict canonical path traversal safeguards.
    Ensures all stored and retrieved files reside strictly inside the configured root.
    """

    def __init__(self, base_dir: Union[str, Path, None] = None):
        if base_dir is None:
            settings = get_settings()
            base_dir = settings.MEDIA_STORAGE_PATH

        self.base_dir = Path(base_dir).resolve()
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _resolve_safe_path(self, storage_key: str) -> Path:
        """
        Resolves a storage key and strictly verifies that it does not escape base_dir.
        Rejects attempts at directory traversal or absolute path injection.
        """
        # Normalize slashes
        clean_key = storage_key.strip().replace("\\", "/").lstrip("/")
        target_path = (self.base_dir / clean_key).resolve()

        # Enforce boundary confinement
        try:
            target_path.relative_to(self.base_dir)
        except ValueError:
            raise ValueError(f"Path traversal detected: key '{storage_key}' escapes storage root")

        return target_path

    def save(self, storage_key: str, data: bytes) -> str:
        """Write bytes to disk under safe resolved storage key."""
        target_path = self._resolve_safe_path(storage_key)
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(data)
        return storage_key

    def exists(self, storage_key: str) -> bool:
        """Check if storage key exists on disk."""
        try:
            target_path = self._resolve_safe_path(storage_key)
            return target_path.is_file()
        except ValueError:
            return False

    def delete(self, storage_key: str) -> bool:
        """Delete file on disk if it exists."""
        try:
            target_path = self._resolve_safe_path(storage_key)
            if target_path.is_file():
                target_path.unlink()
                return True
            return False
        except ValueError:
            return False

    def get_path(self, storage_key: str) -> Path:
        """Return safe resolved path."""
        return self._resolve_safe_path(storage_key)


_default_storage: Union[StorageBackend, None] = None


def get_storage() -> StorageBackend:
    """Return default configured storage backend instance."""
    global _default_storage
    if _default_storage is None:
        _default_storage = LocalFileStorage()
    return _default_storage
