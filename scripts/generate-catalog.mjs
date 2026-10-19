import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
export async function readVehicles(directory='data/vehicles'){
 const result=[];
 async function walk(folder){for(const entry of await readdir(folder,{withFileTypes:true})){const target=path.join(folder,entry.name);if(entry.isDirectory())await walk(target);else if(entry.name==='vehicle.json')result.push(JSON.parse(await readFile(target,'utf8')));}}
 await walk(directory);return result.sort((a,b)=>a.record_id.localeCompare(b.record_id));
}
export async function generateCatalog(){
 const all=await readVehicles();const seen=new Set();
 for(const car of all){if(seen.has(car.record_id))throw Error('Duplicate record: '+car.record_id);seen.add(car.record_id);if(!car.slug || !car.name || !Array.isArray(car.images) || !car.date)throw Error('Incomplete record: '+car.record_id);if(car.price!==null && (!Number.isFinite(car.price)||car.price<=0))throw Error('Invalid price: '+car.record_id);}
 const visible=all.filter(car=>!car.review_required && car.record_kind==='vehicle');
 // Full source texts are never shipped to the browser bundle.
 const fields=['record_id','id','slug','brand','name','types','country','body','year','mileage','engine','price','currency','pricePrefix','priceDate','priceNote','date','status','statusDate','specs','price_history','features','description','images','image'];
 const publicCars=visible.map(car=>{const record=Object.fromEntries(fields.map(key=>[key,car[key]]));if(existsSync('assets/vehicles/'+car.slug+'-480.webp')){record.image_small='assets/vehicles/'+car.slug+'-480.webp';record.image_large='assets/vehicles/'+car.slug+'-960.webp';}return record;});
 await writeFile('catalog-data.js','// Generated from per-vehicle JSON. Do not edit directly.\nconst catalogCars = '+JSON.stringify(publicCars)+';\n');
 console.log(`Catalog generated: ${visible.length} public records, ${all.length-visible.length} records awaiting review.`);
 return publicCars;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await generateCatalog();
