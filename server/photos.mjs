import {readFile,writeFile,mkdir,stat,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {randomUUID,createHash} from 'node:crypto';
import {sourceImage} from '../order-engine.mjs';
import {fail} from './store.mjs';
import {moscowClock} from './jobs.mjs';

export const PHOTO_VERSION='lama-ocr-2';
export function canAutoApply(row,result){return !result.auto_blocked&&row.original.startsWith('/goods/')&&JSON.parse(row.regions).length===0&&result.state==='review'&&result.outside_mask_unchanged===true&&result.coverage>=.005&&result.coverage<=.08&&result.model_sha256==='7ba7aa7ac37a4d41fdbbeba3a2af7ead18058552997e3a3cd1a3b2210c9e6b4c'&&result.detections?.some(item=>item.template==='lotte-wm224'&&item.confidence>=.85);}
export function validateRegions(regions=[]){
 if(!Array.isArray(regions)||regions.length>12)throw fail('Не более 12 выделенных областей.');
 for(const box of regions)if(!Array.isArray(box)||box.length!==4||box.some(n=>typeof n!=='number'||!Number.isFinite(n))||box[0]<0||box[1]<0||box[2]<=0||box[3]<=0||box[0]+box[2]>1.001||box[1]+box[3]>1.001||box[2]*box[3]>.25)throw fail('Некорректная область фотографии.');
 return regions;
}
export class PhotoQueue{
 constructor(store,root,directory,{processor}={}){
  this.store=store;this.root=root;this.directory=directory;this.folder=path.join(directory,'retouch');this.processor=processor;this.enabled=true;
  this.python=process.env.RETOUCH_PYTHON||path.join(root,'.local-source/retouch-env',process.platform==='win32'?'Scripts/python.exe':'bin/python');
  this.model=process.env.RETOUCH_MODEL||path.join(root,'.local-source/retouch-models/big-lama.pt');
  store.db.exec(`CREATE TABLE IF NOT EXISTS photo_tasks(id TEXT PRIMARY KEY,car_id TEXT NOT NULL REFERENCES cars(id),original TEXT NOT NULL,regions TEXT NOT NULL,state TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL,details TEXT NOT NULL DEFAULT '{}',error TEXT,input_hash TEXT,cache_key TEXT,scheduled INTEGER NOT NULL DEFAULT 0); CREATE INDEX IF NOT EXISTS photo_state ON photo_tasks(state);`);
  store.db.prepare("UPDATE photo_tasks SET state='interrupted',error='Сервер был перезапущен' WHERE state='processing'").run();
  store.setDefault('retouch_schedule',{enabled:false,limit:1000,auto_apply:false});
  this.timer=setInterval(()=>{if(this.worker&&!this.current&&Date.now()-this.lastWork>60000){this.worker.kill();this.worker=null;}this.tick().catch(e=>console.error('Photos:',e.message));},1000);this.timer.unref();
 }
 async status(){let installed=false;try{await stat(this.python);await stat(this.model);installed=true;}catch{}return {installed,busy:!!this.current,schedule:this.store.setting('retouch_schedule'),capacity:this.store.setting('photo_benchmark'),counts:this.store.db.prepare('SELECT state,COUNT(*) count FROM photo_tasks GROUP BY state').all()};}
 list({page=1,state='all'}={}){page=Number(page);if(!Number.isInteger(page)||page<1||page>100000||!['all','queued','processing','review','no_mark','failed','accepted','rejected','interrupted'].includes(state))throw fail('Некорректный фильтр фото.');const total=this.store.db.prepare("SELECT COUNT(*) n FROM photo_tasks WHERE ?='all' OR state=?").get(state,state).n;const items=this.store.db.prepare("SELECT p.*,COALESCE(json_extract(c.edits,'$.name'),json_extract(c.source,'$.name')) name FROM photo_tasks p JOIN cars c ON c.id=p.car_id WHERE ?='all' OR p.state=? ORDER BY p.rowid DESC LIMIT 30 OFFSET ?").all(state,state,(page-1)*30).map(row=>({...row,regions:JSON.parse(row.regions),details:JSON.parse(row.details)}));return {items,page,pages:Math.max(1,Math.ceil(total/30)),total};}
 row(id){const row=this.store.db.prepare('SELECT * FROM photo_tasks WHERE id=?').get(id);if(!row)throw fail('Задание не найдено.',404);return row;}
 async configureFromBenchmark(){try{const report=JSON.parse(await readFile(path.join(this.root,'.local-source/retouch-benchmark/report.json'),'utf8'));if(!Number.isFinite(report.local_per_hour)||report.local_per_hour<=0)return;const schedule=this.store.setting('schedule'),limit=Math.max(100,Math.min(5000,Math.round(report.local_per_hour*.3*(schedule.end-schedule.start)/100)*100));this.store.setSetting('photo_benchmark',{gpu:report.gpu,samples:report.samples,total_seconds:report.total_seconds,warm_median_seconds:report.warm_median_seconds,peak_vram_mib:report.peak_vram_mib,local_per_hour:report.local_per_hour,night_limit:limit,network_not_included:true});const setting=this.store.setting('retouch_schedule');if(setting.automation_version!==2)this.store.setSetting('retouch_schedule',{enabled:true,paused:false,auto_apply:true,limit,automation_version:2});}catch(error){if(error.code!=='ENOENT')console.error('Photo calibration:',error.message);}}
 enqueueBatch(limit,scheduled=false){if(!Number.isInteger(limit)||limit<1||limit>5000)throw fail('Некорректный размер партии.');const cars=this.store.db.prepare("SELECT * FROM cars WHERE json_extract(source,'$.provider') IN ('lotte','mobile-de') AND state!='archived' ORDER BY CASE state WHEN 'published' THEN 0 ELSE 1 END,CASE json_extract(source,'$.provider') WHEN 'lotte' THEN 0 ELSE 1 END,id DESC").all().map(row=>this.store.document(row));const seen=this.store.db.prepare('SELECT * FROM photo_tasks WHERE car_id=? AND original=? ORDER BY rowid DESC LIMIT 1');let count=0;for(let index=0;index<100;index++)for(const car of cars){if(count>=limit)return count;const original=car.images?.[index];if(!original||original.startsWith('assets/buyer-photos/admin/'))continue;const previous=seen.get(car.id,original);if(previous){if(previous.state==='no_mark'&&JSON.parse(previous.details).version!==PHOTO_VERSION){this.store.db.prepare("UPDATE photo_tasks SET state='queued',scheduled=?,details='{}',error=NULL WHERE id=?").run(Number(scheduled),previous.id);count++;}continue;}this.enqueue(car.id,index,[],scheduled);count++;}return count;}
 sample(){let count=0;for(const provider of ['lotte','mobile-de']){const candidates=this.store.db.prepare("SELECT * FROM cars WHERE json_extract(source,'$.provider')=? AND state!='archived' ORDER BY id DESC").all(provider);const brands=new Set();let added=0;for(const diverse of [true,false])for(const row of candidates){if(added>=10)break;const car=this.store.document(row);if(!car.images?.length||diverse&&brands.has(car.brand)||this.store.db.prepare('SELECT 1 FROM photo_tasks WHERE car_id=?').get(car.id))continue;try{this.enqueue(car.id,0);brands.add(car.brand);added++;count++;}catch(error){if(!error.status)throw error;}}}return count;}
 enqueue(carId,index,regions=[],scheduled=false){
  validateRegions(regions);const car=this.store.get(carId).car;if(!Number.isInteger(index)||index<0||index>=car.images.length)throw fail('Фото не найдено.');
  const original=car.images[index];if(original.startsWith('assets/buyer-photos/admin/'))throw fail('Это уже загруженное или обработанное фото. Выберите исходное.');
  if(this.store.db.prepare("SELECT 1 FROM photo_tasks WHERE car_id=? AND original=? AND state IN ('queued','processing','review')").get(carId,original))throw fail('Это фото уже находится в очереди или на проверке.',409);
  const id=randomUUID(),now=new Date().toISOString();this.store.db.prepare("INSERT INTO photo_tasks(id,car_id,original,regions,state,created,updated,scheduled) VALUES (?,?,?,?,'queued',?,?,?)").run(id,carId,original,JSON.stringify(regions),now,now,Number(scheduled));this.store.audit('photo_queued',id);return id;
 }
 enqueueNight(){const setting=this.store.setting('retouch_schedule');if(!setting.enabled||this.store.db.prepare("SELECT 1 FROM photo_tasks WHERE scheduled=1 AND state IN ('queued','processing') LIMIT 1").get())return 0;return this.enqueueBatch(setting.limit,true);}
 async input(row){
  if(row.input_hash){try{const original=await readFile(path.join(this.folder,row.id,'input'));if(createHash('sha256').update(original).digest('hex')===row.input_hash)return row.input_hash;}catch(error){if(error.code!=='ENOENT')throw error;}}
  const address=sourceImage(row.original,1600);if(address==='assets/import-model.svg')throw Error('Unsupported image source');
  let bytes;
  if(address.startsWith('https://')){const remote=new URL(address);if(!['img.lotte-autoglobal.net','img.classistatic.de'].includes(remote.hostname)||remote.port)throw Error('Unsupported image host');const response=await fetch(remote,{redirect:'manual',signal:AbortSignal.timeout(30000)});if(!response.ok)throw Error('Image download HTTP '+response.status);if(!response.headers.get('content-type')?.startsWith('image/'))throw Error('Source did not return an image');let length=0;const chunks=[];for await(const chunk of response.body){length+=chunk.length;if(length>12*1024*1024)throw Error('Image exceeds 12 MB');chunks.push(chunk);}bytes=Buffer.concat(chunks);}
  else{const relative=address.replace(/^\//,'');if(!/^(assets\/|data\/vehicles\/)/.test(relative)||relative.includes('..')||relative.includes('\\'))throw Error('Unsupported local image');const filename=path.resolve(this.root,relative);if(!filename.startsWith(this.root+path.sep))throw Error('Invalid local image');const info=await stat(filename);if(info.size>12*1024*1024)throw Error('Image exceeds 12 MB');bytes=await readFile(filename);}
  await mkdir(path.join(this.folder,row.id),{recursive:true});await writeFile(path.join(this.folder,row.id,'input'),bytes);return createHash('sha256').update(bytes).digest('hex');
 }
 async execute(task){
  const file=path.join(this.folder,task.id,'task.json');await writeFile(file,JSON.stringify(task));
  if(!this.worker){const child=spawn(this.python,[path.join(this.root,'server/retouch.py'),'--stream'],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONIOENCODING:'utf-8'}});this.worker=child;let output='',errors='';
   const failRequest=error=>{if(this.worker!==child)return;if(this.request){clearTimeout(this.request.timer);this.request.reject(error);this.request=null;}if(this.worker===child)this.worker=null;};
   child.stdout.on('data',chunk=>{output+=chunk.toString();if(output.length>128000){child.kill();failRequest(Error('Некорректный ответ обработчика'));return;}let end;while((end=output.indexOf('\n'))>=0){const line=output.slice(0,end).trim();output=output.slice(end+1);if(!line)continue;try{const result=JSON.parse(line);if(!this.request)continue;const pending=this.request;this.request=null;clearTimeout(pending.timer);this.lastWork=Date.now();if(result.state==='failed')pending.reject(Error(result.error));else pending.resolve(result);}catch(error){failRequest(error);}}});
   child.stderr.on('data',chunk=>{errors=(errors+chunk.toString()).slice(-2000);});child.on('error',failRequest);child.on('close',()=>failRequest(Error(errors||'Обработчик остановлен')));child.stdin.on('error',failRequest);
  }
  return new Promise((resolve,reject)=>{this.request={resolve,reject,timer:setTimeout(()=>{this.worker?.kill();},300000)};this.lastWork=Date.now();this.worker.stdin.write(JSON.stringify(task)+'\n');});
 }
 async tick(){
  if(!this.enabled||this.current||this.checking)return;this.checking=true;
  let row;try{
   if(!(await this.status()).installed&&!this.processor)return;
   const clock=moscowClock(),schedule=this.store.setting('schedule'),retouch=this.store.setting('retouch_schedule');
   if(retouch.paused)return;
   const window=schedule.enabled&&retouch.enabled&&clock.hour>=schedule.start&&clock.hour<schedule.end;
   const available=window&&(!this.nightAvailable||await this.nightAvailable());
   if(available&&this.store.configured()&&this.store.setting('last_photo_night')!==clock.day){this.enqueueNight();this.store.setSetting('last_photo_night',clock.day);}
   row=this.store.db.prepare("SELECT * FROM photo_tasks WHERE state='queued' AND (scheduled=0 OR ?=1) ORDER BY rowid LIMIT 1").get(Number(available));
  }finally{this.checking=false;}if(!row||!this.enabled)return;
  this.current=row.id;let done;this.completion=new Promise(resolve=>done=resolve);
  const started=Date.now();try{
   this.store.db.prepare("UPDATE photo_tasks SET state='processing',updated=? WHERE id=?").run(new Date().toISOString(),row.id);
   let modelKey='test-processor';if(!this.processor){const info=await stat(this.model);modelKey=info.size+':'+info.mtimeMs;}
   const hash=await this.input(row),cacheKey=createHash('sha256').update(hash+row.regions+PHOTO_VERSION+modelKey+this.store.get(row.car_id).car.provider).digest('hex');
   const cached=this.store.db.prepare("SELECT * FROM photo_tasks WHERE cache_key=? AND state IN ('review','accepted','rejected') AND id!=? LIMIT 1").get(cacheKey,row.id);
   const dir=path.join(this.folder,row.id),task={id:row.id,input:path.join(dir,'input'),mask:path.join(dir,'mask.png'),output:path.join(dir,'result.png'),model:this.model,regions:JSON.parse(row.regions),provider:this.store.get(row.car_id).car.provider,template:row.original.startsWith('/goods/')?'lotte-wm224':null};
   let result;
   if(cached){await copyFile(path.join(this.folder,cached.id,'result.png'),task.output);await copyFile(path.join(this.folder,cached.id,'mask.png'),task.mask);result={...JSON.parse(cached.details),state:'review',cached:true,auto_blocked:cached.state==='rejected'||JSON.parse(cached.details).auto_blocked};}
   else result=await (this.processor?this.processor(task):this.execute(task));
   if(!['review','no_mark'].includes(result.state))throw Error('Некорректный результат обработчика');
   result.pipeline_seconds=Number(((Date.now()-started)/1000).toFixed(2));
   this.store.db.prepare('UPDATE photo_tasks SET state=?,details=?,input_hash=?,cache_key=?,updated=?,error=NULL WHERE id=?').run(result.state,JSON.stringify(result),hash,cacheKey,new Date().toISOString(),row.id);
   if(this.store.setting('retouch_schedule').auto_apply&&canAutoApply(row,result)){try{await this.action(row.id,{action:'accept',version:this.store.get(row.car_id).version});this.store.audit('photo_auto_applied',row.id);}catch(error){this.store.db.prepare('UPDATE photo_tasks SET error=? WHERE id=?').run('Автозамена пропущена: '+error.message,row.id);}}
  }catch(error){this.store.db.prepare("UPDATE photo_tasks SET state='failed',error=?,updated=? WHERE id=?").run(error.message,new Date().toISOString(),row.id);}finally{this.current=null;this.child=null;done();}
 }
 async action(id,input){this.actions??=new Set();if(this.actions.has(id))throw fail('Действие уже выполняется.',409);this.actions.add(id);try{return await this.performAction(id,input);}finally{this.actions.delete(id);}}
 async performAction(id,input){const row=this.row(id);if(input.action==='reject'&&row.state==='queued'){this.store.db.prepare("UPDATE photo_tasks SET state='rejected',updated=? WHERE id=?").run(new Date().toISOString(),id);return {ok:true};}if(['queued','processing'].includes(row.state))throw fail('Дождитесь обработки.',409);
  if(input.action==='retry'){validateRegions(input.regions||[]);this.store.db.prepare("UPDATE photo_tasks SET state='queued',scheduled=0,regions=?,error=NULL,details='{}',updated=? WHERE id=?").run(JSON.stringify(input.regions||[]),new Date().toISOString(),id);return {ok:true};}
  if(input.action==='reject'){this.store.db.prepare("UPDATE photo_tasks SET state='rejected',updated=? WHERE id=?").run(new Date().toISOString(),id);return {ok:true};}
  if(input.action!=='accept'||row.state!=='review')throw fail('Результат ещё не готов к замене.');
  const current=this.store.get(row.car_id);if(input.version!==current.version)throw fail('Карточка изменилась. Обновите сравнение перед заменой.',409);
  const images=[...current.car.images],index=images.indexOf(row.original);if(index<0)throw fail('Исходное фото уже заменено в карточке.',409);
  const filename=randomUUID()+'.png';await copyFile(path.join(this.folder,id,'result.png'),path.join(this.directory,'uploads',filename));images[index]='assets/buyer-photos/admin/'+filename;
  this.store.save(row.car_id,{version:current.version,car:{images}});this.store.db.prepare("UPDATE photo_tasks SET state='accepted',updated=? WHERE id=?").run(new Date().toISOString(),id);this.store.audit('photo_accepted',id);return {ok:true};
 }
 async close(){clearInterval(this.timer);this.enabled=false;this.worker?.kill();if(this.current)await this.completion;}
}
