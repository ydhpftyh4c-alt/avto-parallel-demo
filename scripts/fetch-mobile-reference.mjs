import {mkdir,writeFile} from 'node:fs/promises';
const base='https://services.mobile.de/refdata/classes/Car/makes';
async function get(url){
 const response=await fetch(url,{headers:{Accept:'application/vnd.de.mobile.api+json','Accept-Language':'en'},signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(`Reference endpoint returned ${response.status}: ${url}`);
 const data=await response.json();if(!Array.isArray(data.values))throw Error('Invalid reference response');return data.values;
}
const makes=await get(base), brands=[];
for(const make of makes.filter(item=>!['OTHER','ANDERE'].includes(item.name))){
 const url=base+'/'+encodeURIComponent(make.name)+'/models';
 const values=await get(url);
 brands.push({id:make.name,name:make.description||make.name,models:values.filter(item=>!['OTHER','ANDERE'].includes(item.name)).map(item=>({id:item.name,name:item.description||item.name}))});
 await new Promise(resolve=>setTimeout(resolve,150));
}
const data={schema_version:1,source:'mobile.de public reference API',source_url:base,documentation:'https://services.mobile.de/docs/search-api.html',checked_at:new Date().toISOString(),kind:'model_reference',note:'Names only. Not listings, stock, prices or confirmation of import eligibility.',brands};
await mkdir('data/import/reference',{recursive:true});
await writeFile('data/import/reference/mobile-de.json',JSON.stringify(data)+'\n');
console.log(`Reference downloaded: ${brands.length} makes, ${brands.reduce((sum,brand)=>sum+brand.models.length,0)} model names; zero ads.`);
