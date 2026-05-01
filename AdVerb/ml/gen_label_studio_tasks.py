"""
Generate a Label Studio import file from assets/metadata.yaml + Supabase public URLs.

Run after upload_assets.py.

Usage:
  python ml/gen_label_studio_tasks.py

Outputs:
  ml/label_studio_tasks.json   — import into Label Studio via "Import" button
  ml/label_studio_config.xml   — paste into Label Studio project "Labeling Setup"

After labeling, export annotations as JSON and run:
  python ml/apply_label_studio_export.py <export_file.json>
"""

import json
import os
from pathlib import Path

import yaml
from dotenv import load_dotenv

ROOT = Path(__file__).parent.parent
METADATA_FILE = ROOT / "assets" / "metadata.yaml"
TASKS_OUT = Path(__file__).parent / "label_studio_tasks.json"
CONFIG_OUT = Path(__file__).parent / "label_studio_config.xml"

load_dotenv(ROOT / ".env")

LABEL_CONFIG = """<View>
  <Image name="image" value="$image" zoom="true"/>
  <Header value="$filename"/>

  <Header value="Quality"/>
  <Choices name="quality" toName="image" choice="single" showInline="true" required="true">
    <Choice value="good" selected="true"/>
    <Choice value="blurry"/>
    <Choice value="cropped"/>
    <Choice value="wrong_category"/>
  </Choices>

  <Header value="Background"/>
  <Choices name="background" toName="image" choice="single" showInline="true" required="true">
    <Choice value="transparent" selected="true"/>
    <Choice value="white"/>
    <Choice value="colored_or_gradient"/>
  </Choices>

  <Header value="Category correct? (pre-assigned: $category)"/>
  <Choices name="category_ok" toName="image" choice="single" showInline="true" required="true">
    <Choice value="yes" selected="true"/>
    <Choice value="no_reassign"/>
  </Choices>

  <TextArea name="notes" toName="image" placeholder="Optional: reassign category, describe issue..." rows="2"/>
</View>"""


def main() -> None:
    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not supabase_url:
        raise SystemExit("SUPABASE_URL not set in .env")

    public_base = f"{supabase_url}/storage/v1/object/public/adverb-assets"

    with open(METADATA_FILE, "r") as f:
        metadata = yaml.safe_load(f) or {}

    tasks = []
    for key, meta in metadata.items():
        if not isinstance(meta, dict):
            continue
        category = meta.get("category", "")
        if category == "background":
            continue  # backgrounds don't need labeling

        filename = Path(key).name
        image_url = f"{public_base}/{key}"

        tasks.append({
            "data": {
                "image": image_url,
                "filename": filename,
                "category": category,
                "tags": meta.get("tags") or [],
                "brand_hint": meta.get("brand_hint") or "",
            }
        })

    TASKS_OUT.write_text(json.dumps(tasks, indent=2))
    CONFIG_OUT.write_text(LABEL_CONFIG)

    print(f"Generated {len(tasks)} tasks → {TASKS_OUT}")
    print(f"Label config → {CONFIG_OUT}")
    print()
    print("Label Studio setup:")
    print("  1. pip install label-studio")
    print("  2. label-studio start               # opens at http://localhost:8080")
    print("  3. Create project → Labeling Setup → paste contents of label_studio_config.xml")
    print("  4. Import → Upload Files → select label_studio_tasks.json")
    print("  5. Label all tasks")
    print("  6. Export → JSON → save as label_studio_export.json")
    print("  7. python ml/apply_label_studio_export.py label_studio_export.json")


if __name__ == "__main__":
    main()
