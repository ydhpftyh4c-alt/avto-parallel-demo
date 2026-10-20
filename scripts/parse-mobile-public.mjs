import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {atomic,getPublic,pause,slug} from './download-supplier-library.mjs';
const search='https://www.mobile.de/ru/'+encodeURIComponent('транспортные-средства')+'/'+encodeURIComponent('поиск')+'.html';
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x([\da-f]+);/gi,(_,x)=>String.fromCodePoint(parseInt(x,16))).replace(/&#(\d+);/g,(_,x)=>String.fromCodePoint(Number(x))).replace(/&nbsp;/g,' ');
const text=s=>decode(s.replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
export function parseMobileSearch(html,observedAt=new Date().toISOString()){
 const total=text(html.match(/data-testid="result-list-header"[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]||'').match(/[\d\s]+/);
 if(!total)throw Error('mobile.de search schema changed or access challenge');
 const listings=[];
 for(const m of html.matchAll(/data-testid="(?:base|top)-result-listing-\d+">([\s\S]*?)(?=data-testid="(?:base|top)-result-listing-\d+">|data-testid="srp-pagination")/g)){
  const fragment=m[1];const href=decode(fragment.match(/<a\b[^>]*\bhref="([^"]+)"/)?.[1]||'');const url=new URL(href);const id=url.searchParams.get('id');if(!/^\d{5,20}$/.test(id||'')||url.hostname!=='www.mobile.de')throw Error('Invalid mobile.de listing URL');
  const title=fragment.match(/data-testid="listing-title-card-view"[^>]*title="([^"]+)"/);if(!title)throw Error('Missing mobile.de title');const name=decode(title[1]);
  const trim=decode(fragment.match(/data-testid="listing-title-card-view"[^>]*>[\s\S]*?<\/span><span[^>]*title="([^"]+)"/)?.[1]||'');
  const priceText=text(fragment.match(/data-testid="price-label"[^>]*>([\s\S]*?)<\//)?.[1]||'');const price=/€/.test(priceText)?Number(priceText.replace(/[^\d]/g,'')):null;
  const attrs=text(fragment.match(/data-testid="listing-details-attributes"[^>]*>([\s\S]*?)<\/section>/)?.[1]||'');const year=attrs.match(/учет\s+\d{2}\/(\d{4})/);const km=attrs.match(/([\d\s]+)\s*км/);
  const images=[...fragment.matchAll(/<img\b[^>]*data-testid="(?:base|top)-result-listing-\d+-image[^\"]*"[^>]*\ssrc="(https:\/\/img\.classistatic\.de\/[^"<>]+)"/g)].map(x=>decode(x[1]));
  if(!images.length)continue;
  url.search='';url.searchParams.set('id',id);const make=name.startsWith('Mercedes-Benz ')?'Mercedes-Benz':name.startsWith('Land Rover ')?'Land Rover':name.split(' ')[0];
  listings.push({id:'mobile-de-'+id,provider:'mobile-de',provider_name:'mobile.de',external_id:id,market:'eu',brand:slug(make),brand_name:make,model:name.slice(make.length).trim(),trim,name:[name,trim].filter(Boolean).join(' '),year:year?Number(year[1]):null,mileage_km:km?Number(km[1].replace(/\s/g,'')):null,engine_cc:null,fuel:null,transmission:null,drive:null,body:'other',color:null,price,currency:'EUR',price_basis:'seller_listing_excludes_import',source_url:url.href,images:[...new Set(images)],published_at:null,observed_at:observedAt,availability:'requires_confirmation',import_eligibility:'not_verified'});
 }
 if(!listings.length)throw Error('No actual mobile.de cards found');
 const pages=Number(html.match(/>(\d+)\/(\d+)<\/span>/)?.[2]||1);
 return {total:Number(total[0].replace(/\s/g,'')),pages,listings};
}
export async function syncMobileSearch({maxPages=50,fromCache=false}={}){
 if(!Number.isInteger(maxPages)||maxPages<1||maxPages>50)throw Error('maxPages must be between 1 and 50');
 const cache='.local-source/suppliers/mobile-pages';await mkdir(cache,{recursive:true});const records=new Map(),signatures=new Set();let first,last=1,fetched=0,snapshot;const started_at=new Date().toISOString();
 for(let page=1;page<=Math.min(last,maxPages);page++){
  const file=path.join(cache,page+'.html');const url=new URL(search);url.search=new URLSearchParams({dam:'false',isSearchRequest:'true',s:'Car',vc:'Car',pageNumber:String(page)}).toString();
  const html=fromCache?await readFile(file,'utf8'):await(await getPublic(url)).text();const parsed=parseMobileSearch(html);first??=parsed;last=first.pages;
  const signature=parsed.listings.map(x=>x.id).join(',');if(signatures.has(signature))throw Error('Repeated mobile.de page; stopping');signatures.add(signature);
  if(!fromCache)await writeFile(file,html);for(const car of parsed.listings)records.set(car.id,car);fetched++;
  snapshot={schema_version:1,kind:'supplier_listings_snapshot',started_at,completed_at:new Date().toISOString(),sources:[{id:'mobile-de',name:'mobile.de',market:'eu',url:search,status:'partial_public_search',expected_at_start:first.total,pages_fetched:fetched,search_page_limit:last,unique_listings:records.size,coverage:'partial_search_window',note:'Public search exposes at most 50 pages. This is NOT the complete platform inventory.'}],listings:[...records.values()]};
  await atomic('.local-source/suppliers/mobile-progress.json',snapshot);console.log(`mobile.de ${page}/${Math.min(last,maxPages)}: ${records.size} unique; platform count ${first.total}; coverage PARTIAL`);if(page<Math.min(last,maxPages)&&!fromCache)await pause(750);
 }
 await atomic('data/import/listings/mobile-de.json',snapshot);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await syncMobileSearch({maxPages:Number(process.argv.find(x=>x.startsWith('--pages='))?.split('=')[1]||50),fromCache:process.argv.includes('--from-cache')});
