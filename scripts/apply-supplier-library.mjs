import {readFile,readdir,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {atomic,readJson,libraryRoot} from './download-supplier-library.mjs';
const index=await readJson(path.join(libraryRoot,'index.json'));if(!index)throw Error('Download the library first');
const records={};let galleries=0,edits=0;
const fields=['name','trim','year','mileage_km','engine_cc','fuel','transmission','drive','body','color','price','currency'];
for(const item of index){
 const dir=path.resolve(libraryRoot,item.folder);if(!dir.startsWith(libraryRoot+path.sep))throw Error('Unsafe library path');
 const media=await readJson(path.join(dir,'media.json'));const source=await readJson(path.join(dir,'source.json'));const vehicle=await readJson(path.join(dir,'vehicle.json'));const override={};
 if(media?.detail_fetched_at&&media.images?.length){override.images=media.images.map(img=>source.provider==='lotte'?img.source_path:img.url);override.gallery_fetched_at=media.detail_fetched_at;galleries++;}
 for(const field of fields)if(vehicle[field]!==source[field]){const value=vehicle[field];if(value!==null&&typeof value!=='string'&&typeof value!=='number')throw Error('Invalid editable field '+field+' for '+item.id);if(typeof value==='string'&&value.length>300)throw Error('Text too long: '+item.id);if(typeof value==='number'&&(!Number.isFinite(value)||value<0))throw Error('Invalid number: '+item.id);override[field]=value;}
 if(vehicle.hidden===true)override.hidden=true;
 const edited=await readdir(path.join(dir,'edited')).catch(e=>{if(e.code==='ENOENT')return [];throw e;});
 const positions=new Set();for(const file of edited){if(!/^\d{3}\.(jpg|jpeg|png|webp|avif)$/i.test(file))continue;const number=Number(file.split('.')[0])-1;if(positions.has(number))throw Error('Two replacements for the same photo: '+item.id+'/'+file);positions.add(number);if(!media?.images[number])throw Error('Edited photo has no source photo: '+item.id+'/'+file);const target='assets/buyer-photos/'+item.id+'/'+file;await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(dir,'edited',file),target);override.images??=[...source.images];override.images[number]=target;}
 if(Object.keys(override).length){records[item.id]=override;if(Object.keys(override).some(x=>!['images','gallery_fetched_at'].includes(x))||edited.length)edits++;}
}
await atomic('data/import/listing-overrides.json',{schema_version:1,records});
console.log(JSON.stringify({full_galleries:galleries,manually_edited:edits,note:'Local data updated. Run build and publish separately.'}));
