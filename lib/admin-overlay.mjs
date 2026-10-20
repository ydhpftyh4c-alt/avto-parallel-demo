import {readFile} from 'node:fs/promises';
import {sourceImage} from '../order-engine.mjs';
export function applyAdminOverlay(catalog,overlay){
 if(!overlay)return catalog;if(overlay.schema_version!==1||!Array.isArray(overlay.records))throw Error('Invalid admin export');const cars=new Map(catalog.listings.map(car=>[car.id,car]));
 for(const record of overlay.records){if(typeof record.id!=='string'||!/^[a-zA-Z0-9-]+$/.test(record.id)||!['draft','published','archived'].includes(record.state))throw Error('Invalid exported state');if(record.state!=='published'){cars.delete(record.id);continue;}const car=record.car;if(!car||car.id!==record.id||!car.name||!car.images?.length||car.images.some(image=>sourceImage(image)==='assets/import-model.svg')||!['agency','supplier'].includes(car.category)||!['RUB','USD','EUR','CNY','KRW','GEL'].includes(car.currency)||car.price!==null&&!(car.price>0))throw Error('Invalid published admin car: '+record.id);const link=new URL(car.source_url);if(link.protocol!=='https:')throw Error('Invalid exported source URL');cars.set(record.id,car);}
 const listings=[...cars.values()];return {...catalog,listings,agency_photo_count:listings.filter(car=>car.category==='agency').length};
}
export async function readAdminOverlay(file='data/admin-catalog.json'){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
