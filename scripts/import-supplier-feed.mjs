import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readImportModels} from './generate-import-catalog.mjs';
export function validateSupplierQuote(quote,knownModels){
 const safe=/^[a-z0-9][a-z0-9._-]{0,100}$/;
 if(!safe.test(quote.provider_id||'')||!safe.test(quote.external_id||''))throw Error('Invalid provider/external ID');
 if(!knownModels.has(quote.model_id))throw Error('Unknown model_id: import the model reference first');
 if(!['cn','kr','eu'].includes(quote.market))throw Error('Unknown source market');
 if(!['CNY','KRW','EUR','USD','GBP'].includes(quote.currency))throw Error('Unsupported source currency');
 if(!Number.isFinite(quote.price)||quote.price<=0)throw Error('Source price must be a positive number');
 const sourceUrl=new URL(quote.source_url);if(sourceUrl.protocol!=='https:'||sourceUrl.username||sourceUrl.password)throw Error('HTTPS source URL without credentials required');
 if(!/^\d{4}-\d{2}-\d{2}T/.test(quote.observed_at)||!Number.isFinite(Date.parse(quote.observed_at)))throw Error('ISO timestamp required');
 if(quote.year!==null && (!Number.isInteger(quote.year)||quote.year<1900||quote.year>2100))throw Error('Invalid year');
 for(const field of ['engine_cc','power_kw','mileage_km'])if(quote[field]!==null && (!Number.isFinite(quote[field])||quote[field]<0))throw Error('Invalid '+field);
 return {...quote,schema_version:1,import_eligibility:'not_verified',estimate_status:'not_calculated'};
}
async function main(){
 const index=process.argv.indexOf('--file');if(index<0||!process.argv[index+1])throw Error('Usage: node scripts/import-supplier-feed.mjs --file authorized-export.json');
 const input=JSON.parse(await readFile(process.argv[index+1],'utf8'));if(!Array.isArray(input.quotes))throw Error('quotes array required');
 const models=new Set((await readImportModels()).map(model=>model.model_id));const normalized=input.quotes.map(quote=>validateSupplierQuote(quote,models));
 const ids=new Set();for(const quote of normalized){const key=quote.provider_id+'/'+quote.external_id;if(ids.has(key))throw Error('Duplicate quote in export');ids.add(key);}
 // Only metadata and prices from the supplied export; no remote photo downloads or scraping.
 for(const quote of normalized){const folder=path.join('data/import/supplier-offers',quote.provider_id);await mkdir(folder,{recursive:true});await writeFile(path.join(folder,quote.external_id+'.json'),JSON.stringify(quote,null,2)+'\n');}
 console.log(`Imported ${normalized.length} supplier quotes. Import eligibility and landed estimates remain unverified.`);
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
