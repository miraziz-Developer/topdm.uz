#!/usr/bin/env python3
"""Update all brand assets with new logos from bozorliii.icons"""
import os, shutil
from pathlib import Path
from PIL import Image

ROOT = str(Path(__file__).resolve().parents[1])
SRC = os.environ.get("BOZORLIII_ICON_SOURCE", os.path.join(ROOT, "brand/assets"))
ASSETS = os.path.join(ROOT, "brand/assets")

def copyfile(src, dst):
    if os.path.abspath(src) == os.path.abspath(dst):
        return
    shutil.copy2(src, dst)
    print(f"  -> {os.path.basename(dst)}")

# 1. Update brand/assets/
print("Step 1: Updating brand/assets/")
for f in ["bozorliii-full-logo.png", "bozorliii-full.svg", "bozorliii-icon-32.png",
          "bozorliii-icon-180.png", "bozorliii-icon-192.png", "bozorliii-icon-512.png",
          "bozorliii-icon.svg"]:
    copyfile(os.path.join(SRC, f), os.path.join(ASSETS, f))

# Generate bozorliii-icon.png (120x120 from 512)
img = Image.open(os.path.join(SRC, "bozorliii-icon-512.png"))
img.resize((120, 120), Image.Resampling.LANCZOS).save(os.path.join(ASSETS, "bozorliii-icon.png"))
print("  -> bozorliii-icon.png")

# favicon + apple-touch-icon
copyfile(os.path.join(ASSETS, "bozorliii-icon-32.png"), os.path.join(ASSETS, "favicon.png"))
copyfile(os.path.join(ASSETS, "bozorliii-icon.svg"), os.path.join(ASSETS, "favicon.svg"))
copyfile(os.path.join(ASSETS, "bozorliii-icon-180.png"), os.path.join(ASSETS, "apple-touch-icon.png"))

# 2. Sync to all apps public/brand/
APPS = ["frontend", "merchant-crm", "platform-admin"]
for app in APPS:
    print(f"Step 2.{app}: Updating {app}/public/brand/")
    brand_dir = os.path.join(ROOT, app, "public/brand")
    for f in os.listdir(ASSETS):
        s = os.path.join(ASSETS, f)
        if os.path.isfile(s):
            shutil.copy2(s, os.path.join(brand_dir, f))

# 3. Root public files for each app
for app in APPS:
    pub = os.path.join(ROOT, app, "public")
    print(f"Step 3.{app}: Updating {app}/public/ favicons")
    copyfile(os.path.join(ASSETS, "favicon.png"), os.path.join(pub, "favicon.png"))
    copyfile(os.path.join(ASSETS, "favicon.svg"), os.path.join(pub, "favicon.svg"))
    copyfile(os.path.join(ASSETS, "apple-touch-icon.png"), os.path.join(pub, "apple-touch-icon.png"))
    for extra in ["icon-192.png", "icon-512.png", "logo.png"]:
        p = os.path.join(pub, extra)
        if os.path.exists(p):
            if extra == "logo.png":
                copyfile(os.path.join(ASSETS, "bozorliii-full-logo.png"), p)
            else:
                size = 192 if "192" in extra else 512
                copyfile(os.path.join(ASSETS, f"bozorliii-icon-{size}.png"), p)

# 4. merchant-crm-mobile
mobile_brand = os.path.join(ROOT, "merchant-crm-mobile/www/brand")
if os.path.isdir(mobile_brand):
    print("Step 4: Updating merchant-crm-mobile/www/brand/")
    for f in os.listdir(ASSETS):
        s = os.path.join(ASSETS, f)
        if os.path.isfile(s):
            shutil.copy2(s, os.path.join(mobile_brand, f))

print("\nAll brand assets updated successfully!")
