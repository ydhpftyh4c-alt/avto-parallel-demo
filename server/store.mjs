import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomBytes,randomUUID,scryptSync,timingSafeEqual,createHash} from 'node:crypto';
import {sourceImage,bodyLabels} from '../order-engine.mjs';
export const sha=value=>createHash('sha256').update(value).digest('hex');
export const fail=(message,status=400)=>Object.assign(Error(message),{status});
export function passwordHash(password){if(typeof password!=='string'||password.length<12||password.length>256)throw fail('Пароль должен содержать от 12 до 256 символов.');const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
function passwordMatches(password,stored){const [salt,hash]=stored.split(':');const actual=scryptSync(String(password).slice(0,256),salt,64);return timingSafeEqual(actual,Buffer.from(hash,'hex'));}
const numeric=(value,min,max,label)=>{if(value===null||value==='')return null;if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw fail('Некорректное значение: '+label);return value;};
const fields=['name','brand','model','trim','year','mileage_km','engine_cc','engine_text','fuel','transmission','drive','body','color','price','currency','description','status','images'];
export function validateEdits(input){
 const edits={};for(const key of fields){if(!Object.hasOwn(input,key))continue;let value=input[key];
 if(['year','mileage_km','engine_cc','price'].includes(key)){value=numeric(value,key==='year'?1900:key==='price'?1:0,key==='year'?2100:key==='mileage_km'?10000000:key==='engine_cc'?50000:1000000000,key);if(key==='year'&&value!==null&&!Number.isInteger(value))throw fail('Год должен быть целым.');}
 else if(key==='images'){if(!Array.isArray(value)||value.length>100||new Set(value).size!==value.length||value.some(x=>typeof x!=='string'||sourceImage(x)==='assets/import-model.svg'))throw fail('Некорректные фотографии.');value=[...value];}
 else{if(value===null&&['fuel','transmission','drive','color','engine_text','trim','model','description'].includes(key))value='';if(typeof value!=='string'||value.length>(key==='description'?10000:300))throw fail('Некорректное поле: '+key);value=value.trim();}
 if(['name','brand'].includes(key)&&!value)throw fail('Заполните название и марку.');
 if(key==='brand'&&!/^[a-z0-9][a-z0-9-]{0,79}$/.test(value))throw fail('Марка: латинские буквы, цифры и дефис.');
 if(key==='body'&&!Object.hasOwn(bodyLabels,value))throw fail('Некорректный кузов.');
 if(key==='currency'&&!['RUB','USD','EUR','KRW','CNY','GEL'].includes(value))throw fail('Некорректная валюта.');
 if(key==='status'&&!['unknown','sold','reserved'].includes(value))throw fail('Некорректный статус.');edits[key]=value;
 }return edits;
}
export class AdminStore{
 constructor(directory,publicSite){mkdirSync(directory,{recursive:true});this.directory=directory;this.publicSite=publicSite;this.db=new DatabaseSync(path.join(directory,'admin.sqlite'));this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(username TEXT PRIMARY KEY,password TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS cars(id TEXT PRIMARY KEY,source TEXT NOT NULL,edits TEXT NOT NULL DEFAULT '{}',state TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL,search TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS car_state ON cars(state,updated);
 CREATE TABLE IF NOT EXISTS history(id INTEGER PRIMARY KEY,car_id TEXT NOT NULL REFERENCES cars(id),snapshot TEXT NOT NULL,created TEXT NOT NULL,action TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,kind TEXT NOT NULL,state TEXT NOT NULL,scheduled INTEGER NOT NULL DEFAULT 0,started TEXT,finished TEXT,log TEXT NOT NULL DEFAULT '',error TEXT);
 CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,action TEXT NOT NULL,target TEXT,created TEXT NOT NULL);`);
 this.setDefault('schedule',{enabled:true,start:2,end:6,timezone:'Europe/Moscow'});this.setDefault('photo_processing',{enabled:false,status:'not_connected'});this.db.prepare("UPDATE jobs SET state='interrupted',error='Сервер был перезапущен',finished=? WHERE state='running'").run(new Date().toISOString());
 }
 setting(key){const row=this.db.prepare('SELECT value FROM settings WHERE key=?').get(key);return row?JSON.parse(row.value):null;}
 setDefault(key,value){this.db.prepare('INSERT OR IGNORE INTO settings VALUES (?,?)').run(key,JSON.stringify(value));}
 setSetting(key,value){this.db.prepare('INSERT INTO settings VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}
 audit(action,target=''){this.db.prepare('INSERT INTO audit(action,target,created) VALUES (?,?,?)').run(action,target,new Date().toISOString());}
 configured(){return !!this.db.prepare('SELECT 1 FROM users LIMIT 1').get();}
 setup(username,password){if(this.configured())throw fail('Администратор уже создан.',409);if(!/^[a-zA-Z0-9_.-]{3,60}$/.test(username||''))throw fail('Логин: от 3 до 60 латинских букв, цифр, точек или дефисов.');this.db.prepare('INSERT INTO users VALUES (?,?)').run(username,passwordHash(password));this.audit('setup',username);}
 login(username,password){const row=this.db.prepare('SELECT * FROM users WHERE username=?').get(String(username));if(!row||!passwordMatches(password,row.password))throw fail('Неверный логин или пароль.',401);const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');this.db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());this.db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(sha(token),csrf,Date.now()+12*3600000);this.audit('login',username);return {token,csrf};}
 session(token){return token?this.db.prepare('SELECT csrf,expires FROM sessions WHERE hash=? AND expires>?').get(sha(token),Date.now()):null;}
 logout(token){this.db.prepare('DELETE FROM sessions WHERE hash=?').run(sha(token||''));}
 sync(catalog){
  this.catalogMeta={...catalog,listings:[]};const first=!this.setting('seeded');const insert=this.db.prepare('INSERT INTO cars(id,source,state,updated,search) VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET version=CASE WHEN cars.source!=excluded.source THEN cars.version+1 ELSE cars.version END,source=excluded.source,search=CASE WHEN cars.edits=char(123,125) THEN excluded.search ELSE cars.search END');this.db.exec('BEGIN');try{for(const car of catalog.listings)insert.run(car.id,JSON.stringify(car),first?'published':'draft',new Date().toISOString(),(car.name+' '+car.brand).toLowerCase());this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}this.setSetting('seeded',true);this.cache=null;
 }
 row(id){const row=this.db.prepare('SELECT * FROM cars WHERE id=?').get(id);if(!row)throw fail('Объявление не найдено.',404);return row;}
 document(row){return {...JSON.parse(row.source),...JSON.parse(row.edits)};}
 get(id){const row=this.row(id);return {car:this.document(row),state:row.state,version:row.version,updated:row.updated,history:this.db.prepare('SELECT id,created,action FROM history WHERE car_id=? ORDER BY id DESC LIMIT 30').all(id)};}
 list({q='',state='all',provider='all',page=1}={}){if(!['all','draft','published','archived'].includes(state))throw fail('Некорректный статус публикации.');page=Number(page);if(!Number.isInteger(page)||page<1||page>100000)throw fail('Некорректная страница.');const where='WHERE (?=\'all\' OR state=?) AND (?=\'all\' OR json_extract(source,\'$.provider\')=?) AND search LIKE ?';const args=[state,state,provider,provider,'%'+String(q).toLowerCase().slice(0,100)+'%'];const total=this.db.prepare('SELECT COUNT(*) AS n FROM cars '+where).get(...args).n;const rows=this.db.prepare('SELECT * FROM cars '+where+' ORDER BY updated DESC,id LIMIT 30 OFFSET ?').all(...args,(page-1)*30);return {total,page,pages:Math.max(1,Math.ceil(total/30)),items:rows.map(row=>{const car=this.document(row);return {id:row.id,name:car.name,brand:car.brand,year:car.year,price:car.price,currency:car.currency,image:car.images?.[0],provider:car.provider_name,state:row.state,version:row.version};})};}
 save(id,input,replace=false){const row=this.row(id);if(input.version!==row.version)throw fail('Объявление уже изменено. Откройте его заново, чтобы не потерять правки.',409);const state=input.state??row.state;if(!['draft','published','archived'].includes(state))throw fail('Некорректный статус публикации.');const edits={...(replace?{}:JSON.parse(row.edits)),...validateEdits(input.car||{})},car={...JSON.parse(row.source),...edits};if(state==='published'&&(!car.images?.length||!car.name||!car.brand))throw fail('Для публикации нужны название, марка и хотя бы одно фото.');this.db.exec('BEGIN');try{this.db.prepare('INSERT INTO history(car_id,snapshot,created,action) VALUES (?,?,?,?)').run(id,JSON.stringify({edits:JSON.parse(row.edits),state:row.state}),new Date().toISOString(),'Изменение объявления');this.db.prepare('UPDATE cars SET edits=?,state=?,version=version+1,updated=?,search=? WHERE id=?').run(JSON.stringify(edits),state,new Date().toISOString(),(car.name+' '+car.brand+' '+(car.model||'')).toLowerCase(),id);this.audit('save',id);this.db.exec('COMMIT');}catch(e){this.db.exec('ROLLBACK');throw e;}this.cache=null;return this.get(id);}
 create(){const id='manual-'+randomUUID(),now=new Date().toISOString(),date=now.slice(0,10);const car={id,provider:'agency',provider_name:'Авто || ПараLLель',external_id:id,category:'agency',market:null,name:'Новое объявление',brand:'other',brand_name:'Другая марка',model:'',trim:'',year:null,mileage_km:null,engine_cc:null,engine_text:'',fuel:null,transmission:null,drive:null,body:'other',color:null,price:null,currency:'RUB',price_basis:'agency_publication',price_date:date.split('-').reverse().join('.'),price_note:'',source_url:new URL('?car='+id+'#catalog',this.publicSite).href,images:[],description:'',published_at:date,observed_at:now,availability:'requires_confirmation',import_eligibility:'not_verified',status:'unknown'};this.db.prepare('INSERT INTO cars(id,source,state,updated,search) VALUES (?,?,?,?,?)').run(id,JSON.stringify(car),'draft',now,car.name.toLowerCase());this.audit('create',id);return this.get(id);}
 restore(id,revision,version){const row=this.row(id),record=this.db.prepare('SELECT snapshot FROM history WHERE id=? AND car_id=?').get(Number(revision),id);if(!record)throw fail('Версия не найдена.',404);if(row.version!==version)throw fail('Объявление уже изменено.',409);const snapshot=JSON.parse(record.snapshot);const result=this.save(id,{version,state:snapshot.state,car:snapshot.edits},true);this.audit('restore',id);return result;}
 publicCatalog(){if(this.cache)return this.cache;const listings=this.db.prepare("SELECT * FROM cars WHERE state='published'").all().map(row=>this.document(row)).filter(car=>car.images?.length);return this.cache={...this.catalogMeta,listings,agency_photo_count:listings.filter(x=>x.category==='agency').length};}
 exportOverlay(){return {schema_version:1,records:this.db.prepare("SELECT * FROM cars WHERE edits!='{}' OR id LIKE 'manual-%' OR state!='published'").all().map(row=>row.state==='published'?{id:row.id,state:row.state,car:this.document(row)}:{id:row.id,state:row.state})};}
 stats(){return {counts:this.db.prepare('SELECT state,COUNT(*) AS count FROM cars GROUP BY state').all(),schedule:this.setting('schedule'),photo_processing:this.setting('photo_processing'),sources:this.catalogMeta?.sources||[],jobs:this.db.prepare('SELECT * FROM jobs ORDER BY rowid DESC LIMIT 20').all()};}
 close(){this.db.close();}
}
