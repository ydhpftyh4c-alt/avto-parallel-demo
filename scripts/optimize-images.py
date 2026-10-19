"""Generate responsive derivatives from agency covers; requires Pillow."""
from pathlib import Path
import json
from PIL import Image,ImageOps
root=Path(__file__).resolve().parents[1]
out=root/'assets/vehicles';out.mkdir(exist_ok=True)
for file in (root/'data/vehicles').rglob('vehicle.json'):
 car=json.loads(file.read_text(encoding='utf-8-sig'))
 if car.get('review_required') or car.get('record_kind')!='vehicle' or not car.get('images'):continue
 with Image.open(root/car['image']) as raw:
  original=ImageOps.exif_transpose(raw).convert('RGB')
  for width in [480,960]:
   im=original.copy();im.thumbnail((width,width));im.save(out/(car['slug']+'-'+str(width)+'.webp'),'WEBP',quality=80)
with Image.open(root/'assets/hero.jpg') as raw:
 for width in [640,1280,1920]:
  im=raw.convert('RGB');im.thumbnail((width,width));im.save(root/('assets/hero-'+str(width)+'.webp'),'WEBP',quality=82)
print('Responsive WebP derivatives generated; source images unchanged.')
with Image.open(root/'assets/brand-logo.png') as raw:
 im=raw.convert('RGB');im.thumbnail((192,192));im.save(root/'assets/brand-logo.webp','WEBP',quality=90)
 for size,name in [(64,'brand-icon.png'),(180,'apple-touch-icon.png')]:
  im=raw.convert('RGB');im.thumbnail((size,size));im.save(root/'assets'/name,optimize=True)
