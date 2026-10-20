import {readFile,writeFile} from 'node:fs/promises';
import {readVehicles} from './generate-catalog.mjs';
export async function generateOrderCatalog(){
 const snapshot=JSON.parse(await readFile('data/import/listings/lotte.json','utf8'));
 const access=JSON.parse(await readFile('data/import/providers/access-report.json','utf8'));
 const ids=new Set();for(const car of snapshot.listings){
  if(ids.has(car.id)||!/^lotte-[A-Z]?\d+$/.test(car.id)||!car.name||!car.source_url.startsWith('https://m.lotte-autoglobal.net/car/gd/')||car.currency!=='USD'||car.price!==null&&!(car.price>0)||!Array.isArray(car.images)||!Number.isFinite(Date.parse(car.observed_at)))throw Error('Invalid supplier record: '+car.id);ids.add(car.id);
 }
 const rows=await readVehicles();
 const bodyMap={suv:'suv',sedan:'sedan',liftback:'liftback',hatchback:'hatchback',minivan:'minivan',pickup:'pickup',convertible:'convertible',motorcycle:'motorcycle'};
 const agency=rows.filter(car=>!car.review_required&&car.record_kind==='vehicle'&&car.images.length).map(car=>({id:'agency-'+car.record_id,provider:'agency',provider_name:'Авто || ПараLLель',external_id:car.record_id,market:null,category:'agency',legacy_slug:car.slug,status:car.status,brand:car.brand,brand_name:car.name.split(' ')[0],name:car.name,year:car.specs?.year??null,mileage_km:car.specs?.mileage_km??null,engine_cc:null,engine_text:car.engine,fuel:null,transmission:null,drive:null,body:car.types.map(type=>bodyMap[type]).find(Boolean)||'other',color:null,price:car.price,price_prefix:car.pricePrefix||'',price_note:car.priceNote,price_date:car.priceDate,currency:car.currency,price_basis:'agency_publication',source_url:'https://ydhpftyh4c-alt.github.io/avto-parallel-demo/cars/'+car.slug+'/',images:car.images,published_at:car.date.split('.').reverse().join('-'),observed_at:'2026-10-18T00:00:00Z',availability:'requires_confirmation',import_eligibility:'not_verified'}));
 const listings=[...snapshot.listings.filter(car=>car.images.length).map(car=>({...car,category:'supplier',status:'unknown'})),...agency];
 const result={...snapshot,listings,sources:[...snapshot.sources,...access],agency_photo_count:agency.length,agency_hidden_without_photos:rows.filter(car=>!car.review_required&&!car.images.length).length};await writeFile('order-catalog.json',JSON.stringify(result)+'\n');console.log(`Unified catalog: ${snapshot.listings.length} supplier listings and ${agency.length} agency listings with photos.`);return result;
}
