import {mkdir,readFile,writeFile,rename,stat,statfs,open,unlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export const libraryRoot=path.resolve('vehicle-library');
export const slug=value=>String(value||'other').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)||'other';
export const carFolder=car=>path.join(libraryRoot,slug(car.provider),slug(car.brand),slug(car.model||car.name),slug(car.external_id));
export const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function atomic(file,value){await mkdir(path.dirname(file),{recursive:true});await writeFile(file+'.tmp',typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');await rename(file+'.tmp',file);}
export async function readJson(file,fallback=null){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
async function createOnly(file,value){try{await writeFile(file,JSON.stringify(value,null,2)+'\n',{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}}
export async function initializeLibrary(cars){
 await mkdir(libraryRoot,{recursive:true});
 for(const car of cars){const dir=carFolder(car);await mkdir(path.join(dir,'photos'),{recursive:true});await mkdir(path.join(dir,'edited'),{recursive:true});await createOnly(path.join(dir,'vehicle.json'),{...car,editor_note:'Редактируйте описание здесь. Фото для замены кладите в edited с теми же номерами. Повторная загрузка не перезаписывает этот файл.'});await createOnly(path.join(dir,'source.json'),car);}
 await atomic(path.join(libraryRoot,'index.json'),cars.map(car=>({id:car.id,name:car.name,folder:path.relative(libraryRoot,carFolder(car)).split(path.sep).join('/')})));
 await writeFile(path.join(libraryRoot,'README.txt'),'ЛОКАЛЬНАЯ БИБЛИОТЕКА АВТОМОБИЛЕЙ\n\nИсточник / марка / модель / ID\nvehicle.json — ваши правки (загрузчик не перезаписывает).\nsource.json — исходные данные первого экспорта для сравнения с правками.\nphotos/ — скачанные фотографии, существующие файлы не перезаписываются.\nedited/ — ваши отредактированные фотографии с теми же номерами, например 001.jpg или 001.webp.\nmedia.json — все найденные снимки, статусы загрузки и контрольные суммы.\nprogress.json в корне — фактический прогресс текущего прохода, не обещание полноты всех площадок.\nЭта папка не публикуется автоматически и исключена из Git.\n');
}
export function parseMobileGallery(html,id){
 const candidates=[];
 const walk=value=>{if(!value||typeof value!=='object')return;if(String(value.id)===String(id)&&Array.isArray(value.images))candidates.push(value.images);for(const child of Object.values(value))if(child&&typeof child==='object')walk(child);};
 for(const m of html.matchAll(/<script[^>]*>(self\.__next_f\.push\([\s\S]*?)<\/script>/g)){
  let payload;try{payload=JSON.parse(m[1].slice('self.__next_f.push('.length,-1));}catch{continue;}
  if(typeof payload[1]!=='string')continue;
  for(const match of payload[1].matchAll(/"links":(\[[^\]]*\]),"images":(\[[^\]]*\])/g)){
   try{const links=JSON.parse(match[1]);if(links.some(link=>link.href==='/svc/ml-recommendations-by-id/'+id))candidates.push(JSON.parse(match[2]));}catch{}
  }
  for(const line of payload[1].split('\n')){const index=line.indexOf(':');if(index<0)continue;try{walk(JSON.parse(line.slice(index+1)));}catch{}}
 }
 const values=candidates.sort((a,b)=>b.length-a.length)[0];
 if(!values?.length)throw Error('Missing mobile.de gallery for listing '+id);
 const images=[];for(const item of values){if(!/^img\.classistatic\.de\/api\/v1\/mo-prod\/images\/[a-f0-9/-]+$/i.test(item.uri||''))throw Error('Unexpected mobile.de gallery URL');if(images.some(x=>x.source_path===item.uri))continue;images.push({source_path:item.uri,url:'https://'+item.uri+'?rule=mo-1600',file:String(images.length+1).padStart(3,'0')+'.jpg'});}
 return {images,options:[]};
}
export function parseLotteGallery(html,id){
 if(!/Buy Used|car-info|swiper-slide-img/i.test(html))throw Error('LOTTE detail schema changed: '+id);
 const images=[];
 const gallery=html.match(/<ul class="swiper-wrapper"[^>]*>([\s\S]*?)<\/ul>/)?.[1];
 if(!gallery)throw Error('Missing primary LOTTE gallery: '+id);
 for(const m of gallery.matchAll(/<img\b[^>]*\bsrc="(https:\/\/img\.lotte-autoglobal\.net\/goods\/[^"<>]+)"/gi)){
  let url=m[1].replace(/&amp;/g,'&');const u=new URL(url);u.pathname=u.pathname.replace(/\/{2,}/g,'/');url=u.href;
  if(!u.pathname.includes('/composite/wm_224/')||!u.pathname.includes('/dims/'))continue;
  const key=u.pathname.split('/dims/')[0];if(!images.some(x=>x.source_path===key))images.push({source_path:key,url,file:String(images.length+1).padStart(3,'0')+'.webp'});
 }
 if(!images.length)throw Error('No verified gallery images: '+id);
 const options=[...html.matchAll(/<ul class="option-list">([\s\S]*?)<\/ul>/g)].flatMap(m=>[...m[1].matchAll(/<li>([\s\S]*?)<\/li>/g)].map(x=>x[1].replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim())).filter(Boolean);
 return {images,options:[...new Set(options)]};
}
export async function getPublic(url){
 const r=await fetch(url,{signal:AbortSignal.timeout(30000)});
 if([401,403,429].includes(r.status))throw Error('Access stopped: HTTP '+r.status+' '+new URL(url).host);
 if(!r.ok){const e=Error('HTTP '+r.status);e.status=r.status;throw e;}
 return r;
}
function imageType(bytes){if(bytes.length<16)return null;if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'webp';if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';if(bytes.toString('ascii',4,8)==='ftyp'&&['avif','avis'].includes(bytes.toString('ascii',8,12)))return 'avif';return null;}
export async function hydrateLibrary({limit=Infinity,detailsOnly=false,provider='all'}={}){
 const lock=path.join(libraryRoot,'.download.lock');await mkdir(libraryRoot,{recursive:true});
 const handle=await open(lock,'wx');await handle.writeFile(String(process.pid));
 const progress={started_at:new Date().toISOString(),source:provider,total:0,processed:0,completed:0,unavailable:0,photos:0,bytes:0,status:'initializing',details_only:detailsOnly};
 try{
 const snapshots=await Promise.all((await readdir('data/import/listings')).filter(x=>x.endsWith('.json')).map(x=>readJson('data/import/listings/'+x)));
 const allCars=snapshots.flatMap(x=>x.listings);const cars=allCars.filter(x=>provider==='all'||x.provider===provider);progress.total=cars.length;
 if(!(limit>0))throw Error('Limit must be positive');
 await atomic(path.join(libraryRoot,'progress.json'),progress);
 const existingIndex=await readJson(path.join(libraryRoot,'index.json'),[]);const existingIds=new Set(existingIndex.map(x=>x.id));
 const missing=allCars.filter(x=>!existingIds.has(x.id));if(missing.length){await initializeLibrary(missing);await atomic(path.join(libraryRoot,'index.json'),[...existingIndex,...missing.map(car=>({id:car.id,name:car.name,folder:path.relative(libraryRoot,carFolder(car)).split(path.sep).join('/')}))]);}
 progress.status='running';const {createHash}=await import('node:crypto');
 for(const car of cars.slice(0,limit)){
  const disk=await statfs(libraryRoot);if(Number(disk.bavail)*Number(disk.bsize)<5*1024**3)throw Error('Less than 5 GB free; stopped');
  const dir=carFolder(car),mediaFile=path.join(dir,'media.json');let media=await readJson(mediaFile);
  if(!media?.detail_fetched_at){
   let response;try{response=await getPublic(car.source_url);}catch(e){if(e.status===404||e.status===410){await atomic(mediaFile,{status:'unavailable',checked_at:new Date().toISOString(),images:[]});progress.unavailable++;progress.processed++;continue;}throw e;}
   const html=await response.text();if(/has_been_cr_blocked|Verifying the safety|<title>[^<]*captcha/i.test(html))throw Error('Access challenge: '+car.provider);
   const gallery=car.provider==='lotte'?parseLotteGallery(html,car.external_id):car.provider==='mobile-de'?parseMobileGallery(html,car.external_id):null;if(!gallery)throw Error('Unsupported source');media={detail_fetched_at:new Date().toISOString(),status:'pending',...gallery};await atomic(mediaFile,media);await pause(300);
  }
  progress.current_id=car.id;progress.current_gallery_size=media.images.length;
  if(!detailsOnly){
   let cursor=0,failed=false,saves=Promise.resolve();
   const save=()=>{saves=saves.then(async()=>{await atomic(mediaFile,media);progress.updated_at=new Date().toISOString();await atomic(path.join(libraryRoot,'progress.json'),progress);});return saves;};
   const worker=async()=>{while(cursor<media.images.length&&!failed){const img=media.images[cursor++];try{
    let file=path.join(dir,'photos',img.file);
    try{const s=await stat(file);if(s.size>0){img.status='downloaded';img.bytes=s.size;progress.photos++;progress.bytes+=s.size;continue;}}catch(e){if(e.code!=='ENOENT')throw e;}
    let r;try{r=await getPublic(img.url);}catch(e){if([404,410].includes(e.status)){img.status='unavailable';await save();continue;}throw e;}
    if(!r.headers.get('content-type')?.startsWith('image/'))throw Error('Non-image response');
    const bytes=Buffer.from(await r.arrayBuffer()),type=imageType(bytes);if(bytes.length>20*1024**2||!type)throw Error('Invalid image response');
    img.file=img.file.replace(/\.[a-z]+$/,'.'+type);file=path.join(dir,'photos',img.file);
    await writeFile(file+'.tmp',bytes);await rename(file+'.tmp',file);Object.assign(img,{status:'downloaded',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});progress.photos++;progress.bytes+=bytes.length;
    await save();await pause(150);
   }catch(e){failed=true;throw e;}}};
   const results=await Promise.allSettled([worker(),worker()]);await saves;const error=results.find(x=>x.status==='rejected');if(error)throw error.reason;
  }
  media.status=media.images.every(x=>x.status==='downloaded')?'downloaded':detailsOnly?'gallery_indexed':'partial_download';await atomic(mediaFile,media);progress.processed++;if(media.status==='downloaded')progress.completed++;
  progress.updated_at=new Date().toISOString();await atomic(path.join(libraryRoot,'progress.json'),progress);
  if(progress.processed%10===0)console.log(JSON.stringify(progress));
 }
 progress.status=progress.processed===cars.length?'finished_snapshot_pass':'limited_pass';
 }catch(e){progress.status='stopped';progress.error=e.message;throw e;}finally{progress.updated_at=new Date().toISOString();await atomic(path.join(libraryRoot,'progress.json'),progress);await handle.close();await unlink(lock);console.log(JSON.stringify(progress));}
 return progress;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const arg=process.argv.find(x=>x.startsWith('--limit='));await hydrateLibrary({limit:arg?Number(arg.split('=')[1]):Infinity,detailsOnly:process.argv.includes('--details-only'),provider:process.argv.find(x=>x.startsWith('--provider='))?.split('=')[1]||'all'});
}
