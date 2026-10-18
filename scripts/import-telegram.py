#!/usr/bin/env python3
"""Import a Telegram HTML export into documented per-vehicle folders.
Run once with --source; reruns require --overwrite to protect manual edits.
"""
import argparse, hashlib, json, re, shutil, unicodedata
from collections import Counter
from datetime import datetime
from html.parser import HTMLParser
from pathlib import Path
from PIL import Image, ImageOps

ROOT=Path(__file__).resolve().parents[1]
class Node:
 def __init__(self,tag='',attrs=()):self.tag=tag;self.attrs=dict(attrs);self.children=[]
 def walk(self):
  yield self
  for c in self.children:
   if isinstance(c,Node):yield from c.walk()
 def find(self,cls):return [n for n in self.walk() if cls in n.attrs.get('class','').split()]
 def text(self):return ''.join(c.text() if isinstance(c,Node) else c for c in self.children)
class Parser(HTMLParser):
 def __init__(self):super().__init__();self.root=Node();self.stack=[self.root]
 def handle_starttag(self,t,a):
  n=Node(t,a);self.stack[-1].children.append(n)
  if t=='br':n.children.append('\n')
  if t not in ['img','meta','link','br','hr','input','source']:self.stack.append(n)
 def handle_endtag(self,t):
  for i in range(len(self.stack)-1,0,-1):
   if self.stack[i].tag==t:self.stack=self.stack[:i];break
 def handle_data(self,d):self.stack[-1].children.append(d)
def dump(path,data):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
def slug(text):
 text=unicodedata.normalize('NFKD',text).encode('ascii','ignore').decode().lower()
 return re.sub(r'[^a-z0-9]+','-',text).strip('-') or 'model-unspecified'
def stamp(s):return datetime.strptime(s[:19],'%d.%m.%Y %H:%M:%S') if s else None
def clean(s):return s.replace('\ufe0f','').replace('\u20e3','')
def amount(s):
 # Only explicit million-scale ruble amounts; never interpret phone numbers or percentages as prices.
 hits=re.findall(r'(?<!\d)(\d{1,2}[. ]\d{3}[. ]\d{3})(?!\d)',clean(s))
 return int(re.sub(r'\D','',hits[-1])) if hits else None
BRANDS={'bmw':'BMW','mercedes-benz':'Mercedes-Benz','li-auto':'Li Auto','land-rover':'Land Rover','qiyuan':'Qiyuan','byd':'BYD','zeekr':'Zeekr','mini':'MINI'}
BODIES={'suv':'Кроссовер','sedan':'Седан','hatchback':'Хэтчбек','liftback':'Лифтбек','electric':'Электромобиль','motorcycle':'Мотоцикл','minivan':'Минивэн','pickup':'Пикап','convertible':'Кабриолет','unspecified':'Кузов не указан'}
STABLE={838:'toyota-bz3x',828:'porsche-taycan',811:'qiyuan-a07',799:'volkswagen-jetta',758:'bmw-x3',721:'mercedes-glc',697:'kia-optima',676:'mazda-cx5'}

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--source',type=Path,required=True);ap.add_argument('--overwrite',action='store_true');args=ap.parse_args()
 source=args.source.resolve()
 if not (source/'messages.html').is_file():raise SystemExit('messages.html is required')
 if (ROOT/'data/vehicles').exists() and not args.overwrite:raise SystemExit('Vehicle folders already exist. Review manual edits before using --overwrite.')
 private=ROOT/'.local-source';private.mkdir(exist_ok=True)
 # Retain every original byte locally. The original export remains untouched.
 shutil.copytree(source,private/'telegram-export',dirs_exist_ok=True)
 cfg=json.loads((ROOT/'scripts/import/curation.json').read_text(encoding='utf-8-sig'))
 p=Parser();p.feed((source/'messages.html').read_text(encoding='utf8'));messages=[]
 for n in p.root.find('message'):
  ds=n.find('date');refs=[a.attrs.get('href','') for r in n.find('reply_to') for a in r.walk() if a.tag=='a']
  photos=[a.attrs['href'] for a in n.walk() if a.tag=='a' and a.attrs.get('href','').startswith('photos/')]
  messages.append(dict(id=int(n.attrs['id'].replace('message','')),date=ds[0].attrs.get('title','') if ds else '',text='\n'.join(x.text().strip() for x in n.find('text')),photos=photos,reply_to=int(re.search(r'(\d+)$',refs[0]).group(1)) if refs else None,missing_video=bool(n.find('media_video') and 'Not included' in n.text())))
 byid={m['id']:m for m in messages};dump(private/'messages.json',messages)
 groups=[];groupof={}
 for m in messages:
  dt=stamp(m['date'])
  if dt is None:
   groups.append({'messages':[m],'last':None});groupof[m['id']]=groups[-1];continue
  if not groups or groups[-1]['last'] is None or not 0<=(dt-groups[-1]['last']).total_seconds()<=3:groups.append({'messages':[],'last':dt})
  g=groups[-1];g['messages'].append(m);g['last']=dt;groupof[m['id']]=g
 # Seed reviewed editorial text for the eight already-live cards; this file is optional and versioned.
 seed_path=ROOT/'scripts/import/editorial-overrides.json';seeds=json.loads(seed_path.read_text(encoding='utf8')) if seed_path.exists() else {}
 records=[];owners={};photo_owners={};message_owners={}
 for row in cfg['vehicles']:
  mid=row['message_id'];variant=row.get('variant');key=f'tg-{mid:04d}'+(f'-{variant:02d}' if variant else '')
  brand=row['brand'];modelslug=slug(row['model']);folder=ROOT/'data/vehicles'/brand/modelslug/key
  record={'schema_version':1,'record_id':key,'id':mid if not variant else mid*100+variant,'slug':STABLE.get(mid) if not variant and mid in STABLE else brand+'-'+modelslug+'-'+key,'brand':brand,'model':row['model'],'name':BRANDS.get(brand,brand.title())+' '+row['model'],'types':row['types'],'country':row['country'],'body':BODIES[row['types'][-1]],'year':str(row['year'])+' год' if row['year'] else 'Год не указан','mileage':f"{row['mileage_km']:,}".replace(',',' ')+' км' if row['mileage_km'] is not None else 'Новый — по объявлению' if row.get('is_new') else 'Пробег не указан','engine':'Уточняйте по объявлению','price':row['price'],'currency':row['currency'],'pricePrefix':'от ' if mid in [779,796,797,811] else '', 'priceDate':byid[mid]['date'][:10], 'priceNote':'Цена и состав расходов указаны в публикации продавца. Актуальность и наличие требуют подтверждения.','date':byid[mid]['date'][:10],'status':'unknown','statusDate':byid[mid]['date'][:10],'review_required':mid in cfg['needs_review_ids'] or row.get('review_required',False),'record_kind':'offer_group' if mid in [116,319] else 'vehicle','specs':{'year':row['year'],'mileage_km':row['mileage_km'],'is_new':row.get('is_new',False)},'features':[],'description':'Данные перенесены из публикации агентства. Характеристики, состояние и историю необходимо проверить перед покупкой.','source_message_ids':[mid],'price_history':[],'status_history':[],'images':[],'image':'assets/no-photo.svg'}
  if mid==187:record['priceNote']='Цена без тюнинга — 1 900 000 ₽; с тюнингом в публикации указано 2 200 000 ₽. Уточняйте состав предложения.'
  if mid==224:record['priceNote']='Средняя ориентировочная цена модели из публикации, не стоимость конкретной комплектации.'
  if mid==779:record['priceNote']='Цена в грузинских лари, без пересчёта в рубли. Условия ввоза и все расходы уточняйте.'
  if mid==346:record['priceNote']='Цена в долларах США для автомобиля в Грузии. Итоговые расходы в России не рассчитаны.'
  source_lines=byid[mid]['text'].splitlines()
  for line in source_lines:
   if len(line)<130 and re.search(r'\d[.,]\d',line) and re.search(r'бензин|дизель|л\.с|сил|tsi|автомат|\bа[тt]\b',line,re.I) and not re.search(r'цен|руб|пробег',line,re.I):record['engine']=line.strip('* •🔹');break
  if str(mid) in seeds:
   for field in ['name','year','mileage','engine','features','description','priceNote','pricePrefix']:record[field]=seeds[str(mid)][field]
  if row['price']:record['price_history'].append({'date':byid[mid]['date'][:10],'amount':row['price'],'currency':row['currency'],'message_id':mid,'kind':'initial','applies_to_current':True})
  record['_folder']=folder;record['_row']=row;records.append(record);owners.setdefault(mid,[]).append(record)
 for duplicate,target in cfg['duplicate_messages'].items():
  if int(duplicate) in byid and target in owners:
   owners[int(duplicate)]=owners[target]
   for r in owners[target]:
    r['source_message_ids'].append(int(duplicate))
    if stamp(byid[int(duplicate)]['date'])>stamp(byid[target]['date']):r['date']=byid[int(duplicate)]['date'][:10]
 # Associate albums only by same posting batch or explicit, manually reviewed links.
 for mid,rs in list(owners.items()):
  linked=[groupof[mid]]+[groupof[i] for i in cfg['explicit_photo_links'].get(str(mid),[]) if i in groupof]
  for g in linked:
   for m in g['messages']:
    for r in rs:
     message_owners.setdefault(m['id'],set()).add(r['record_id'])
     if m['id'] not in r['source_message_ids']:r['source_message_ids'].append(m['id'])
     if not r['_row'].get('shared_album'):
      for photo in m['photos']:photo_owners.setdefault(photo,set()).add(r['record_id'])
 # Replies can target any photograph in an album, not only its caption.
 unresolved=[]
 for m in messages:
  if not m['reply_to']:continue
  targets=message_owners.get(m['reply_to'],set())
  if not targets:
   unresolved.append({'message_id':m['id'],'reply_to':m['reply_to'],'reason':'target_missing_from_export' if m['reply_to'] not in byid else 'target_not_resolved_to_vehicle'});continue
  tx=clean(m['text']).lower()
  for r in records:
   if r['record_id'] not in targets:continue
   if m['id'] not in r['source_message_ids']:r['source_message_ids'].append(m['id'])
   message_owners.setdefault(m['id'],set()).add(r['record_id'])
   state='sold' if 'продан' in tx else 'reserved' if any(w in tx for w in ['забронирован','задаток']) else None
   if state:
    r['status']=state;r['statusDate']=m['date'][:10];r['status_history'].append({'date':m['date'][:10],'status':state,'message_id':m['id']})
   if m['id']==587:
    for value,note in [(3950000,'Чёрный цвет, приблизительная цена'),(3850000,'Вариант 2025 года из того же ответа')]:r['price_history'].append({'date':m['date'][:10],'amount':value,'currency':'RUB','message_id':587,'kind':'variant_quote','applies_to_current':False,'note':note})
   if any(w in tx for w in ['снижение','понижение','снижени','понижени']):
    value=amount(m['text']);temporary='до конца недели' in tx
    if value:
     r['price_history'].append({'date':m['date'][:10],'amount':value,'currency':'RUB','message_id':m['id'],'kind':'temporary' if temporary else 'price_update','applies_to_current':not temporary})
     if not temporary:r['price']=value;r['currency']='RUB';r['priceDate']=m['date'][:10]
 # All photo assets retain their exact export filename in provenance, plus a deduplicating checksum.
 photo_cache={};allphotos=sorted(p for p in (source/'photos').glob('*') if p.is_file() and '_thumb' not in p.stem)
 assigned=set();inventory=[]
 for r in records:
  folder=r.pop('_folder');r.pop('_row');folder.mkdir(parents=True,exist_ok=True);media=[];seen=set()
  paths=[photo for photo,ids in photo_owners.items() if r['record_id'] in ids]
  for photo in paths:
   src=source/photo;digest=hashlib.sha256(src.read_bytes()).hexdigest();assigned.add(photo)
   if digest in seen:continue
   seen.add(digest);name=f'{len(media)+1:03d}.jpg';dest=folder/'photos'/name;dest.parent.mkdir(exist_ok=True)
   with Image.open(src) as original:
    im=ImageOps.exif_transpose(original).convert('RGB');im.thumbnail((1440,1080));im.save(dest,quality=82,optimize=True)
    if not media:ImageOps.fit(im,(720,480)).save(folder/'cover.jpg',quality=82,optimize=True)
   rel=dest.relative_to(ROOT).as_posix();r['images'].append(rel);media.append({'file':'photos/'+name,'source_file':photo,'source_sha256':digest,'width':im.width,'height':im.height})
  if media:r['image']=(folder/'cover.jpg').relative_to(ROOT).as_posix()
  r['source_message_ids']=sorted(set(r['source_message_ids']))
  dump(folder/'vehicle.json',r)
  dump(folder/'sources.json',{'export_date':cfg['export_date'],'messages':[byid[i] for i in r['source_message_ids'] if i in byid],'media':media})
  (folder/'README.md').write_text(f"# {r['name']}\n\nID: {r['record_id']}\n\n- `vehicle.json` — карточка, цена, статус и история.\n- `sources.json` — исходные сообщения и связь фотографий с экспортом.\n- `photos/` — фотографии этой машины, без EXIF.\n- `cover.jpg` — обложка для каталога (если есть фото).\n\nНаличие не подтверждается автоматически. Исходные тексты — сведения продавца, не результаты независимой проверки.\n",encoding='utf8')
  inventory.append({'record_id':r['record_id'],'name':r['name'],'path':folder.relative_to(ROOT).as_posix(),'status':r['status'],'review_required':r['review_required'],'price':r['price'],'currency':r['currency'],'photos':len(media)})
 # Every remaining group is retained, including news, services, unidentified cars and missing videos.
 intake=[]
 for g in groups:
  leftovers=[m for m in g['messages'] if m['id'] not in message_owners]
  photos=list(dict.fromkeys(photo for m in g['messages'] for photo in m['photos'] if photo not in assigned))
  if not leftovers and not photos:continue
  ids=[m['id'] for m in g['messages']];texts=[m for m in leftovers if m['text']]
  category='news' if any(i in cfg['news_ids'] for i in ids) else 'cases' if any(i in cfg['case_ids'] for i in ids) else 'needs-review' if photos or any(m['reply_to'] for m in leftovers) else 'channel-notes'
  key='message-'+str(ids[0]).replace('-','service-');folder=ROOT/'data/intake'/category/key;folder.mkdir(parents=True,exist_ok=True)
  media=[]
  for photo in photos:
   src=source/photo;digest=hashlib.sha256(src.read_bytes()).hexdigest();dest=folder/'photos'/src.name;dest.parent.mkdir(exist_ok=True)
   with Image.open(src) as original:
    im=ImageOps.exif_transpose(original).convert('RGB');im.thumbnail((1440,1080));im.save(dest,quality=82,optimize=True)
   assigned.add(photo);media.append({'file':'photos/'+src.name,'source_file':photo,'source_sha256':digest})
  dump(folder/'record.json',{'category':category,'related_message_ids':ids,'reason':'Not promoted to a product without reliable vehicle identification or media association.','messages':leftovers,'media':media})
  intake.append({'id':key,'category':category,'path':folder.relative_to(ROOT).as_posix(),'message_ids':[m['id'] for m in leftovers],'photos':len(media)})
 # Avatar/service photo nodes have no date and are still captured above; retain any orphan original files.
 unreferenced=[]
 for src in allphotos:
  rel=src.relative_to(source).as_posix()
  if rel not in assigned:
   folder=ROOT/'data/intake/unreferenced-files';folder.mkdir(parents=True,exist_ok=True);shutil.copy2(src,folder/src.name);assigned.add(rel);unreferenced.append(rel)
 accounted={i for item in intake for i in item['message_ids']}|set(message_owners)
 assert accounted==set(byid),'Message accounting mismatch'
 assert len(assigned)==len(allphotos),'Photo accounting mismatch'
 report={'schema_version':1,'export_date':cfg['export_date'],'message_count':len(messages),'text_posts':sum(bool(m['text']) for m in messages),'original_photos':len(allphotos),'thumbnail_files':len(list((source/'photos').glob('*_thumb*'))),'vehicle_records':len(records),'vehicle_photos':sum(x['photos'] for x in inventory),'review_required_records':sum(r['review_required'] for r in records),'statuses':dict(Counter(r['status'] for r in records)),'intake_groups':len(intake),'unreferenced_originals':unreferenced,'missing_videos':sum(m['missing_video'] for m in messages),'unresolved_replies':unresolved,'all_messages_accounted_for':len(accounted),'all_original_photos_accounted_for':len(assigned),'vehicles':inventory,'intake':intake}
 dump(ROOT/'data/import-report.json',report)
 (ROOT/'data/INVENTORY.md').write_text('# Реестр автомобилей\n\nСтатус `unknown` означает «наличие уточняйте», а не «в продаже».\n\n| ID | Автомобиль | Статус | Цена | Фото | Папка |\n| --- | --- | --- | --- | --- | --- |\n'+''.join(f"| {r['record_id']} | {r['name']} | {r['status']} | {r['price'] or 'не указана'} {r['currency']} | {r['photos']} | [{r['path']}]({r['path'].removeprefix('data/')}) |\n" for r in inventory),encoding='utf8')
 print(json.dumps({k:v for k,v in report.items() if k not in ['vehicles','intake','unresolved_replies','unreferenced_originals']},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
