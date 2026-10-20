import {readFile,writeFile,readdir} from 'node:fs/promises';
import {readVehicles} from './generate-catalog.mjs';
import {sourceImage} from '../order-engine.mjs';
import {applyAdminOverlay,readAdminOverlay} from '../lib/admin-overlay.mjs';
export async function generateOrderCatalog(){
 const snapshots=await Promise.all((await readdir('data/import/listings')).filter(file=>file.endsWith('.json')).sort().map(async file=>JSON.parse(await readFile('data/import/listings/'+file,'utf8'))));
 const snapshot={...snapshots[0],sources:snapshots.flatMap(item=>item.sources),listings:snapshots.flatMap(item=>item.listings)};
 const access=JSON.parse(await readFile('data/import/providers/access-report.json','utf8'));
 const ids=new Set();for(const car of snapshot.listings){
  const sourceValid=car.provider==='lotte'?/^lotte-[A-Z]?\d+$/.test(car.id)&&car.source_url.startsWith('https://m.lotte-autoglobal.net/car/gd/')&&car.currency==='USD':car.provider==='mobile-de'&&/^mobile-de-\d+$/.test(car.id)&&new URL(car.source_url).hostname==='www.mobile.de'&&car.currency==='EUR';
  if(ids.has(car.id)||!sourceValid||!car.name||car.price!==null&&!(car.price>0)||!Array.isArray(car.images)||!Number.isFinite(Date.parse(car.observed_at)))throw Error('Invalid supplier record: '+car.id);ids.add(car.id);
 }
 const rows=await readVehicles();
 const bodyMap={suv:'suv',sedan:'sedan',liftback:'liftback',hatchback:'hatchback',minivan:'minivan',pickup:'pickup',convertible:'convertible',motorcycle:'motorcycle'};
 const agency=rows.filter(car=>!car.review_required&&car.record_kind==='vehicle'&&car.images.length).map(car=>({id:'agency-'+car.record_id,provider:'agency',provider_name:'Авто || ПараLLель',external_id:car.record_id,market:null,category:'agency',legacy_slug:car.slug,status:car.status,brand:car.brand,brand_name:car.name.split(' ')[0],name:car.name,year:car.specs?.year??null,mileage_km:car.specs?.mileage_km??null,engine_cc:null,engine_text:car.engine,fuel:null,transmission:null,drive:null,body:car.types.map(type=>bodyMap[type]).find(Boolean)||'other',color:null,price:car.price,price_prefix:car.pricePrefix||'',price_note:car.priceNote,price_date:car.priceDate,currency:car.currency,price_basis:'agency_publication',source_url:'https://ydhpftyh4c-alt.github.io/avto-parallel-demo/cars/'+car.slug+'/',images:car.images,published_at:car.date.split('.').reverse().join('-'),observed_at:'2026-10-18T00:00:00Z',availability:'requires_confirmation',import_eligibility:'not_verified'}));
 let overrides={};try{overrides=JSON.parse(await readFile('data/import/listing-overrides.json','utf8')).records;}catch(e){if(e.code!=='ENOENT')throw e;}
 const supplier=snapshot.listings.map(car=>{
  const edit=overrides[car.id]||{},allowed=new Set(['name','trim','year','mileage_km','engine_cc','fuel','transmission','drive','body','color','price','currency','hidden','images','gallery_fetched_at']);
  if(Object.keys(edit).some(key=>!allowed.has(key)))throw Error('Unknown override field: '+car.id);
  const result={...car,...edit};if(!result.name||result.name.length>300||!['USD','EUR','RUB','KRW','CNY','GEL'].includes(result.currency)||result.price!==null&&!(result.price>0)||result.year!==null&&(!Number.isInteger(result.year)||result.year<1900||result.year>2100)||['mileage_km','engine_cc'].some(key=>result[key]!==null&&(!Number.isFinite(result[key])||result[key]<0))||!Array.isArray(result.images)||result.images.some(photo=>sourceImage(photo)==='assets/import-model.svg'))throw Error('Invalid library override: '+car.id);
  return {...result,category:'supplier',status:'unknown'};
 });
 const listings=[...supplier.filter(car=>car.images.length&&!car.hidden),...agency];
 const base={...snapshot,listings,sources:[...snapshot.sources,...access.filter(item=>!snapshot.sources.some(source=>source.id===item.id))],agency_photo_count:agency.length,agency_hidden_without_photos:rows.filter(car=>!car.review_required&&!car.images.length).length};const result=applyAdminOverlay(base,await readAdminOverlay());await writeFile('order-catalog.json',JSON.stringify(result)+'\n');console.log(`Unified catalog: ${snapshot.listings.length} supplier listings and ${agency.length} agency listings with photos.`);return result;
}
