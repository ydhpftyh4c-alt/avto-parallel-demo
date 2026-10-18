import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {readVehicles} from './generate-catalog.mjs';
const rows=await readVehicles();const root=process.cwd();const report=JSON.parse(await readFile('data/import-report.json','utf8'));
const ids=new Set(),slugs=new Set(),covered=new Set(),photoSources=new Set();
const check=(value,message)=>{if(!value)throw Error(message);};
for(const car of rows){
 check(!ids.has(car.record_id),'Duplicate ID');ids.add(car.record_id);check(!slugs.has(car.slug),'Duplicate slug');slugs.add(car.slug);
 check(['unknown','sold','reserved'].includes(car.status),'Invalid status: '+car.record_id);
 const entry=report.vehicles.find(row=>row.record_id===car.record_id);check(entry,'Missing inventory record');
 const source=JSON.parse(await readFile(path.join(entry.path,'sources.json'),'utf8'));const sourceIds=new Set(source.messages.map(message=>message.id));
 car.source_message_ids.forEach(id=>{check(sourceIds.has(id),'Missing source message');covered.add(id);});
 const permanent=car.price_history.filter(event=>event.applies_to_current);
 if(permanent.length){const latest=permanent.at(-1);check(car.price===latest.amount && car.currency===latest.currency,'Current price disagrees with history: '+car.record_id);}
 if(car.status_history.length)check(car.status===car.status_history.at(-1).status,'Current status disagrees with history');
 for(const media of source.media){const file=path.resolve(entry.path,media.file);check(file.startsWith(root+path.sep),'Unsafe media path');await stat(file);photoSources.add(media.source_file);}
 for(const image of [car.image,...car.images])await stat(image);
}
for(const item of report.intake){const file=JSON.parse(await readFile(path.join(item.path,'record.json'),'utf8'));file.messages.forEach(message=>covered.add(message.id));for(const media of file.media){photoSources.add(media.source_file);await stat(path.join(item.path,media.file));}}
check(rows.length===report.vehicle_records,'Inventory total mismatch');check(covered.size===report.message_count,'Unaccounted message');check(photoSources.size===report.original_photos,'Unaccounted original photo');
const get=id=>rows.find(car=>car.record_id===id);
check(get('tg-0004').price===1400000 && get('tg-0004').status==='sold','Rapid update/photo-reply regression');
check(get('tg-0095').price===1400000 && get('tg-0095').status==='sold','Audi photo-reply regression');
check(get('tg-0688').price===5990000 && get('tg-0688').status==='sold','Expired temporary discount must not replace regular price');
check(get('tg-0346').currency==='USD' && get('tg-0346').price===35000,'USD conversion regression');
check(get('tg-0779').currency==='GEL' && get('tg-0779').price===79000,'GEL conversion regression');
check(get('tg-0731').source_message_ids.includes(817),'Repost was not merged');
check(report.missing_videos===52,'Missing video audit mismatch');
console.log(`Data audit passed: ${rows.length} records, ${covered.size} messages, ${photoSources.size} original photos.`);
