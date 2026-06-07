"""
Google Drive Service — optional file sharing for question banks.

Requires:
  GOOGLE_SERVICE_ACCOUNT_JSON  — path to a service-account credentials .json file
  GOOGLE_DRIVE_FOLDER_ID       — the ID of the shared Drive folder

If either setting is blank the service is disabled and upload() returns None.
"""

import os
import logging
from typing import Optional

from ..config import settings

logger = logging.getLogger(__name__)


def _drive_configured() -> bool:
    return bool(settings.GOOGLE_SERVICE_ACCOUNT_JSON and settings.GOOGLE_DRIVE_FOLDER_ID)


def upload_to_drive(local_path: str, filename: str) -> Optional[str]:
    """
    Upload a file to the configured Google Drive folder.

    Returns the file's web-view URL (shareable link), or None if Drive is not
    configured or the upload fails.
    """
    if not _drive_configured():
        logger.info("[DriveService] Not configured — skipping Drive upload.")
        return None

    try:
        from googleapiclient.discovery import build  # type: ignore
        from googleapiclient.http import MediaFileUpload  # type: ignore
        from google.oauth2 import service_account  # type: ignore

        scopes = ["https://www.googleapis.com/auth/drive.file"]
        json_path = settings.GOOGLE_SERVICE_ACCOUNT_JSON

        creds = service_account.Credentials.from_service_account_file(
            json_path, scopes=scopes
        )
        service = build("drive", "v3", credentials=creds, cache_discovery=False)

        # Determine MIME type
        mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

        file_metadata = {
            "name": filename,
            "parents": [settings.GOOGLE_DRIVE_FOLDER_ID],
        }

        media = MediaFileUpload(local_path, mimetype=mime, resumable=False)
        uploaded = (
            service.files()
            .create(body=file_metadata, media_body=media, fields="id,webViewLink")
            .execute()
        )

        # Make the file readable by anyone with the link
        service.permissions().create(
            fileId=uploaded["id"],
            body={"type": "anyone", "role": "reader"},
        ).execute()

        link = uploaded.get("webViewLink")
        logger.info(f"[DriveService] Uploaded '{filename}' → {link}")
        return link

    except ImportError:
        logger.warning(
            "[DriveService] google-api-python-client not installed. "
            "Run: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib"
        )
        return None

    except Exception as e:
        logger.error(f"[DriveService] Upload failed: {e}")
        return None
