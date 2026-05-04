"""
Upload all assets from assets/overlays/ and assets/backgrounds/ to Supabase Storage.
Re-run whenever new images are added.

Requirements:
  pip install supabase

Usage:
  set SUPABASE_URL=https://vehmnoydkoexuvvlmznu.supabase.co
  set SUPABASE_SERVICE_KEY=<your service role key from Supabase dashboard -> Settings -> API>
  python ml/upload_assets.py
"""

import mimetypes
import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client

load_dotenv(Path(__file__).parent.parent / ".env")

BUCKET = "adverb-assets"
ROOT = Path(__file__).parent.parent
ASSET_DIRS = {
    "overlays":    ROOT / "assets" / "overlays",
    "backgrounds": ROOT / "assets" / "backgrounds",
}
IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def main() -> None:
    url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not url or not key:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.")

    client = create_client(url, key)
    storage = client.storage.from_(BUCKET)

    uploaded = 0
    skipped = 0

    for folder_name, folder_path in ASSET_DIRS.items():
        if not folder_path.exists():
            print(f"Skipping {folder_path} (not found)")
            continue

        files = sorted(p for p in folder_path.iterdir() if p.suffix.lower() in IMAGE_EXTS)
        print(f"\n{folder_name}: {len(files)} files")

        for file_path in files:
            storage_key = f"{folder_name}/{file_path.name}"
            mime = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"

            with open(file_path, "rb") as f:
                data = f.read()

            try:
                storage.upload(
                    path=storage_key,
                    file=data,
                    file_options={"content-type": mime, "upsert": "true"},
                )
                print(f"  uploaded: {storage_key}")
                uploaded += 1
            except Exception as e:
                print(f"  error {storage_key}: {e}")
                skipped += 1

    print(f"\nDone. {uploaded} uploaded, {skipped} failed.")
    print(f"Public base: {url}/storage/v1/object/public/{BUCKET}")


if __name__ == "__main__":
    main()
