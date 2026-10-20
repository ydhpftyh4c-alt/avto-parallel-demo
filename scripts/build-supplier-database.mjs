import {DatabaseSync} from 'node:sqlite';
import {readFile,readdir,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {readJson,libraryRoot,carFolder} from './download-supplier-library.mjs';
await mkdir(libraryRoot,{recursive:true});const target=path.join(libraryRoot,'catalog.sqlite'),temporary=target+'.tmp';
const snapshots=await Promise.all((await readdir('data/import/listings')).filter(x=>x.endsWith('.json')).map(x=>readJson('data/import/listings/'+x)));
const access=await readJson('data/import/providers/access-report.json',[]);const sources=new Map(access.map(x=>[x.id,x]));for(const snapshot of snapshots)for(const source of snapshot.sources)sources.set(source.id,source);
const db=new DatabaseSync(temporary);db.exec('PRAGMA foreign_keys=ON; DROP TABLE IF EXISTS photos; DROP TABLE IF EXISTS vehicles_fts; DROP TABLE IF EXISTS vehicles; DROP TABLE IF EXISTS sources; CREATE TABLE sources(id TEXT PRIMARY KEY, document TEXT NOT NULL); CREATE TABLE vehicles(id TEXT PRIMARY KEY,provider TEXT NOT NULL REFERENCES sources(id),name TEXT NOT NULL,brand TEXT NOT NULL,model TEXT,year INTEGER,mileage_km INTEGER,price REAL,currency TEXT NOT NULL,document TEXT NOT NULL); CREATE INDEX vehicle_brand_year ON vehicles(brand,year); CREATE INDEX vehicle_provider ON vehicles(provider); CREATE INDEX vehicle_price ON vehicles(currency,price); CREATE TABLE photos(vehicle_id TEXT NOT NULL REFERENCES vehicles(id),position INTEGER NOT NULL,source_url TEXT NOT NULL,local_path TEXT,status TEXT NOT NULL,sha256 TEXT,PRIMARY KEY(vehicle_id,position)); CREATE VIRTUAL TABLE vehicles_fts USING fts5(id UNINDEXED,name,brand,model);');
const insertSource=db.prepare('INSERT INTO sources VALUES (?,?)'),insertVehicle=db.prepare('INSERT INTO vehicles VALUES (?,?,?,?,?,?,?,?,?,?)'),insertPhoto=db.prepare('INSERT INTO photos VALUES (?,?,?,?,?,?)'),insertFts=db.prepare('INSERT INTO vehicles_fts VALUES (?,?,?,?)');
let total=0,photos=0,downloaded=0;db.exec('BEGIN');
try{
 for(const [id,source] of sources)insertSource.run(id,JSON.stringify(source));
 for(const car of snapshots.flatMap(x=>x.listings)){
  insertVehicle.run(car.id,car.provider,car.name,car.brand,car.model??null,car.year,car.mileage_km,car.price,car.currency,JSON.stringify(car));insertFts.run(car.id,car.name,car.brand,car.model??'');total++;
  const media=await readJson(path.join(carFolder(car),'media.json'));
  const images=media?.images?.length?media.images:car.images.map(url=>({url:car.provider==='lotte'?'https://img.lotte-autoglobal.net'+url+'/dims/format/webp/resize/1176/cropcenter/1176x840/composite/wm_224/quality/90/optimize':url,status:'not_downloaded'}));
  for(const [position,image] of images.entries()){const local=image.status==='downloaded'?path.relative(libraryRoot,path.join(carFolder(car),'photos',image.file)).split(path.sep).join('/'):null;insertPhoto.run(car.id,position,image.url,local,image.status||'pending',image.sha256??null);photos++;if(local)downloaded++;}
 }
 db.exec('COMMIT');if(db.prepare('PRAGMA quick_check').get().quick_check!=='ok')throw Error('Database integrity check failed');if(db.prepare('PRAGMA foreign_key_check').all().length)throw Error('Invalid database foreign keys');
}catch(e){try{db.exec('ROLLBACK');}catch{}db.close();throw e;}
db.close();await rename(temporary,target);console.log(JSON.stringify({file:target,vehicles:total,photo_urls:photos,downloaded_photos:downloaded,note:'Local database snapshot. Includes explicit source coverage; not all platform inventories.'}));
