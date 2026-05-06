from PIL import Image
from pathlib import Path

BACKGROUNDS = [
    ("black",         "#0a0a0a"),
    ("white",         "#ffffff"),
    ("deep-navy",     "#0f1b2d"),
    ("slate",         "#1e293b"),
    ("charcoal",      "#2d2d2d"),
    ("cream",         "#faf7f2"),
    ("electric-blue", "#1a1aff"),
    ("forest-green",  "#1a3a2a"),
    ("deep-red",      "#2d0a0a"),
    ("warm-grey",     "#e8e4df"),
]

REPO_ROOT = Path(__file__).resolve().parent.parent
out = REPO_ROOT / "assets" / "backgrounds"
out.mkdir(parents=True, exist_ok=True)

for name, color in BACKGROUNDS:
    img = Image.new("RGB", (1600, 700), color)
    path = out / f"{name}.jpg"
    img.save(path, quality=95)
    print(f"Generated: {path.name}")

print(f"\n{len(BACKGROUNDS)} backgrounds written to {out}")
