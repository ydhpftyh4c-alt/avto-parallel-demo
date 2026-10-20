import {readFile,writeFile} from 'node:fs/promises';
export async function generateOrderCatalog(){
 const snapshot=JSON.parse(await readFile('data/import/listings/lotte.json','utf8'));
 const access=JSON.parse(await readFile('data/import/providers/access-report.json','utf8'));
 const ids=new Set();for(const car of snapshot.listings){
  if(ids.has(car.id)||!/^lotte-[A-Z]?\d+$/.test(car.id)||!car.name||!car.source_url.startsWith('https://m.lotte-autoglobal.net/car/gd/')||car.currency!=='USD'||car.price!==null&&!(car.price>0)||!Array.isArray(car.images)||!Number.isFinite(Date.parse(car.observed_at)))throw Error('Invalid supplier record: '+car.id);ids.add(car.id);
 }
 const result={...snapshot,sources:[...snapshot.sources,...access]};await writeFile('order-catalog.json',JSON.stringify(result)+'\n');console.log(`Order catalog generated: ${result.listings.length} actual listings, ${result.sources.filter(source=>source.status==='public_catalog_imported').length} imported source(s).`);return result;
}
