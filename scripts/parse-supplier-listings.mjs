import {readFile,writeFile,mkdir,rename,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const origin='https://m.lotte-autoglobal.net';
const brands={'HYUNDAI':'hyundai','KIA':'kia','GENESIS':'genesis','BENZ':'mercedes-benz','BMW':'bmw','AUDI':'audi','VOLKSWAGEN':'volkswagen','CHEVROLET(GM)':'chevrolet','CHEVROLET':'chevrolet','RENAULT KOREA':'renault-korea','SSANGYONG':'ssangyong','KGM':'kgm','MINI':'mini','LAND ROVER':'land-rover'};
const positive=value=>{const number=Number(value);return value!==null&&value!==undefined&&value!==''&&Number.isFinite(number)&&number>0?number:null;};
const nonnegative=value=>{const number=Number(value);return value!==null&&value!==undefined&&value!==''&&Number.isFinite(number)&&number>=0?number:null;};
const text=value=>String(value??'').replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim();
const slug=value=>text(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export function normalizeLotte(item,photos,observedAt){
 const id=String(item.gdId||'');if(!/^[A-Z]?\d{6,20}$/.test(id))throw Error('Invalid LOTTE listing ID');
 const make=text(item.mcmpNm),model=text(item.modelNm);if(!make||!model)throw Error('Missing make/model: '+id);
 const year=positive(item.mnfYear);if(year!==null&&(!Number.isInteger(year)||year<1900||year>2100))throw Error('Invalid year: '+id);
 const sourcePhotoPaths=photos.filter(photo=>String(photo.gdId)===id).map(photo=>(String(photo.afilePath||'').replace(/\/$/,'')+'/'+String(photo.regFileNm||'')));
 if(!sourcePhotoPaths.length&&item.imgPath1)sourcePhotoPaths.push(item.imgPath1);
 const images=[...new Set(sourcePhotoPaths)].filter(photo=>/^\/goods\/[a-zA-Z0-9_./-]+\.(jpg|jpeg|png)$/i.test(photo)&&!photo.includes('..')).slice(0,5);
 const price=positive(item.dcCarAmt)??positive(item.carAmt);
 const sourceBody=text(item.mocaCdNm),bodyMap={SUV:'suv',SEDAN:'sedan',MINIVAN:'minivan',COMPACT:'hatchback','SPORT CAR':'coupe',TRUCK:'truck',BUS:'bus'};
 const date=text(item.dpStartDe||item.gdRegDe),published=/^\d{8}$/.test(date)?date.slice(0,4)+'-'+date.slice(4,6)+'-'+date.slice(6,8):null;
 return {id:'lotte-'+id,provider:'lotte',provider_name:'LOTTE Auto Global',external_id:id,market:'kr',brand:brands[make]||slug(make),brand_name:make,model,trim:text(item.gradNm),name:[make,model,text(item.gradNm)].filter(Boolean).join(' '),year,mileage_km:nonnegative(item.drgMil),engine_cc:nonnegative(item.dpmVal),fuel:text(item.gasSeNm)||null,transmission:text(item.trmsSeValNm)||null,drive:text(item.drsyValNm)||null,body:bodyMap[sourceBody.toUpperCase()]||'other',body_source:sourceBody||null,color:text(item.extClrCdNm)||null,price,currency:'USD',price_basis:'seller_listing_excludes_import',source_url:origin+'/car/gd/'+id+'/',images,published_at:published,observed_at:observedAt,availability:'requires_confirmation',import_eligibility:'not_verified'};
}
export async function fetchLottePage(page){
 const response=await fetch(origin+'/by/buy/selectGdListAjax.do',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({pageIndex:String(page)}),signal:AbortSignal.timeout(30000)});
 if(!response.ok)throw Error('LOTTE HTTP '+response.status+'; stopping without bypass or retries');
 let data;try{data=await response.json();}catch{throw Error('LOTTE returned a non-JSON page; stopping');}
 if(!Array.isArray(data.resultList)||!Array.isArray(data.resultImgList)||!data.paginationInfo)throw Error('LOTTE response schema changed');
 if(data.paginationInfo.currentPageNo!==page)throw Error('Unexpected pagination; stopping');
 return data;
}
export async function syncLotte({fromCache=false}={}){
 let startedAt=new Date().toISOString(),completedAt=startedAt;const cache='.local-source/suppliers/lotte-pages';await mkdir(cache,{recursive:true});
 const records=new Map(),seenPages=new Set();let expected=null,lastPage=null,page=1;
 while(lastPage===null||page<=lastPage){
  const cacheFile=path.join(cache,String(page)+'.json');
  const cachedTime=fromCache?(await stat(cacheFile)).mtime:null;
  if(cachedTime&&Date.now()-cachedTime.getTime()>86400000)throw Error('Cache is older than 24 hours; run a fresh import');
  const data=fromCache?JSON.parse(await readFile(cacheFile,'utf8')):await fetchLottePage(page),observedAt=cachedTime?cachedTime.toISOString():new Date().toISOString();
  if(data.paginationInfo?.currentPageNo!==page)throw Error('Invalid cached page number');
  if(page===1&&fromCache)startedAt=observedAt;completedAt=observedAt;
  if(lastPage===null){expected=data.paginationInfo.totalRecordCount;lastPage=data.paginationInfo.lastPageNo;if(!Number.isInteger(lastPage)||lastPage<1||lastPage>2000)throw Error('Unexpected page count');console.log(`LOTTE: ${expected} listings across ${lastPage} pages`);}
  const signature=data.resultList.map(item=>item.gdId).join(',');if(seenPages.has(signature)&&signature)throw Error('Repeated page; refusing incomplete import');seenPages.add(signature);
  // Cache contains public listing responses only and stays outside Git/public files.
  if(!fromCache)await writeFile(cacheFile,JSON.stringify(data));
  for(const item of data.resultList){const car=normalizeLotte(item,data.resultImgList,observedAt);records.set(car.id,car);}
  if(page%20===0||page===lastPage)console.log(`LOTTE ${page}/${lastPage}: ${records.size} unique listings`);
  if(!data.resultList.length&&page<lastPage)throw Error('Unexpected empty page before catalog end');
  page++;if(page<=lastPage&&!fromCache)await new Promise(resolve=>setTimeout(resolve,300));
 }
 const snapshot={schema_version:1,started_at:startedAt,completed_at:completedAt,kind:'supplier_listings_snapshot',sources:[{id:'lotte',name:'LOTTE Auto Global',market:'kr',url:origin+'/by/buy/gdListView.do?menuId=MENU_0004',status:'public_catalog_imported',expected_at_start:expected,pages_fetched:lastPage,unique_listings:records.size,coverage:'all_pages_at_fetch_time',note:'Inventory can change while pages are being fetched; counts may differ.'}],listings:[...records.values()]};
 await mkdir('data/import/listings',{recursive:true});const target='data/import/listings/lotte.json';await writeFile(target+'.tmp',JSON.stringify(snapshot)+'\n');await rename(target+'.tmp',target);
 console.log(`Saved ${records.size} actual supplier listings. No landed prices or confirmed availability claimed.`);
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await syncLotte({fromCache:process.argv.includes('--from-cache')});
