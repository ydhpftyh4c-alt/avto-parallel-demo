import http from 'node:http';
import {readFile,writeFile,mkdir,stat,copyFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {backup} from 'node:sqlite';
import {AdminStore,fail} from './store.mjs';
import {JobRunner} from './jobs.mjs';
import {loadCatalog} from './catalog.mjs';
import {PhotoQueue} from './photos.mjs';
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.xml':'application/xml; charset=utf-8','.ico':'image/x-icon'};
const loopback=host=>['127.0.0.1','localhost','::1','[::1]'].includes(host);
function imageExtension(bytes){if(bytes.length<16)throw fail('Файл не является изображением.');if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'png';if(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')return 'webp';if(bytes.toString('ascii',4,8)==='ftyp'&&['avif','avis'].includes(bytes.toString('ascii',8,12)))return 'avif';throw fail('Поддерживаются JPG, PNG, WebP и AVIF.');}
async function body(req,max=1024*1024){let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)throw fail('Файл слишком большой.',413);chunks.push(chunk);}return Buffer.concat(chunks);}
async function jsonBody(req){if(!req.headers['content-type']?.startsWith('application/json'))throw fail('Ожидается JSON.',415);try{return JSON.parse((await body(req)).toString('utf8'));}catch(e){if(e.status)throw e;throw fail('Некорректный JSON.');}}
export async function startAdminServer(options={}){
 const root=path.resolve(options.root||process.cwd()),directory=path.resolve(options.directory||process.env.ADMIN_DATA_DIR||path.join(root,'.admin-data')),host=options.host||process.env.ADMIN_HOST||'127.0.0.1',port=Number(options.port??process.env.ADMIN_PORT??4181);
 const origin=options.origin||process.env.ADMIN_ORIGIN||'http://127.0.0.1:'+port;const parsedOrigin=new URL(origin);if(origin!==parsedOrigin.origin||(!loopback(parsedOrigin.hostname)&&parsedOrigin.protocol!=='https:'))throw Error('ADMIN_ORIGIN must be an exact HTTPS origin for remote hosting.');if(!loopback(host)&&!process.env.ADMIN_ORIGIN&&!options.origin)throw Error('Set ADMIN_ORIGIN before exposing the server.');
 await mkdir(path.join(directory,'uploads'),{recursive:true});const store=new AdminStore(directory,process.env.PUBLIC_SITE_URL||'https://ydhpftyh4c-alt.github.io/avto-parallel-demo/');store.sync(await loadCatalog(root));
 if(!store.configured()&&process.env.ADMIN_INITIAL_PASSWORD){store.setup(process.env.ADMIN_INITIAL_USER||'admin',process.env.ADMIN_INITIAL_PASSWORD);delete process.env.ADMIN_INITIAL_PASSWORD;}
 const createBackup=async()=>{const folder=path.join(directory,'backups');await mkdir(folder,{recursive:true});const filename='admin-'+new Date().toISOString().replace(/[:.]/g,'-')+'.sqlite';await backup(store.db,path.join(folder,filename));store.setSetting('last_backup',{filename,created:new Date().toISOString()});return path.join(folder,filename);};
 const runner=new JobRunner(store,root,async action=>{if(action==='backup')return createBackup();store.sync(JSON.parse(await readFile(path.join(root,'order-catalog.json'),'utf8')));},{enabled:options.jobs!==false});
 const photos=new PhotoQueue(store,root,directory,options.photos||{});
 await photos.configureFromBenchmark();
 if(process.env.PHOTO_INITIAL_BATCH){const count=Number(process.env.PHOTO_INITIAL_BATCH);delete process.env.PHOTO_INITIAL_BATCH;if(store.configured()&&Number.isInteger(count)&&count>0&&count<=100)photos.enqueueBatch(count);}
 const failures=new Map();const cookieName='parallel_admin';
 const sessionCookie=(token,clear=false)=>`${cookieName}=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=${clear?0:43200}${parsedOrigin.protocol==='https:'?'; Secure':''}`;
 const send=(res,value,status=200)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');
  const admin=req.url?.startsWith('/api/admin')||req.url?.startsWith('/admin');if(admin)res.setHeader('Cache-Control','no-store');
  try{
   if(req.headers.host!==parsedOrigin.host)throw fail('Неверный адрес сервера.',403);
   const url=new URL(req.url,origin),pathname=decodeURIComponent(url.pathname);if(pathname.includes('\\')||pathname.includes('\0')||pathname.split('/').some(x=>x==='..'||x.startsWith('.')))throw fail('Недопустимый путь.',403);
   if(pathname.startsWith('/api/admin/')){
    const token=String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(cookieName+'='))?.slice(cookieName.length+1),session=store.session(token);
    const mutation=!['GET','HEAD'].includes(req.method);if(mutation&&req.headers.origin!==origin)throw fail('Запрос с другого сайта отклонён.',403);
    if(pathname==='/api/admin/session'&&req.method==='GET')return send(res,{configured:store.configured(),authenticated:!!session,csrf:session?.csrf,local_setup:loopback(parsedOrigin.hostname)});
    if(['/api/admin/login','/api/admin/setup'].includes(pathname)&&req.method==='POST'){
     const key=req.socket.remoteAddress,bucket=failures.get(key)||{count:0,until:Date.now()+900000};if(bucket.until<Date.now()){bucket.count=0;bucket.until=Date.now()+900000;}if(bucket.count>=10)throw fail('Слишком много попыток. Повторите через 15 минут.',429);
     const input=await jsonBody(req);try{if(pathname.endsWith('/setup')){if(!loopback(parsedOrigin.hostname))throw fail('Первичная настройка доступна только локально.',403);store.setup(input.username,input.password);}const auth=store.login(input.username,input.password);failures.delete(key);res.setHeader('Set-Cookie',sessionCookie(auth.token));return send(res,{csrf:auth.csrf});}catch(e){bucket.count++;failures.set(key,bucket);throw e;}
    }
    if(!session)throw fail('Войдите в админку.',401);if(mutation&&req.headers['x-csrf-token']!==session.csrf)throw fail('Обновите страницу и повторите действие.',403);
    if(pathname==='/api/admin/photos'&&req.method==='GET')return send(res,{...await photos.status(),...photos.list(Object.fromEntries(url.searchParams))});
    if(pathname==='/api/admin/photos'&&req.method==='POST'){const input=await jsonBody(req),id=photos.enqueue(input.car_id,input.index,input.regions);return send(res,{id},202);}
    if(pathname==='/api/admin/photos/sample'&&req.method==='POST')return send(res,{count:photos.sample()},202);
    if(pathname==='/api/admin/photos/run'&&req.method==='POST'){const setting=store.setting('retouch_schedule');store.setSetting('retouch_schedule',{...setting,paused:false});return send(res,{count:photos.enqueueBatch(Math.min(setting.limit,100))},202);}
    if(pathname==='/api/admin/photos/schedule'&&req.method==='PUT'){const input=await jsonBody(req);if(typeof input.enabled!=='boolean'||!Number.isInteger(input.limit)||input.limit<1||input.limit>5000||(input.auto_apply!==undefined&&typeof input.auto_apply!=='boolean'))throw fail('Некорректный режим обработки фото.');store.setSetting('retouch_schedule',{...store.setting('retouch_schedule'),enabled:input.enabled,paused:!input.enabled,auto_apply:input.auto_apply??store.setting('retouch_schedule').auto_apply,limit:input.limit});return send(res,{ok:true});}
    const photoMatch=pathname.match(/^\/api\/admin\/photos\/([a-f0-9-]+)(?:\/(input|mask|result))?$/);
    if(photoMatch){const row=photos.row(photoMatch[1]);if(req.method==='POST'&&!photoMatch[2])return send(res,await photos.action(row.id,await jsonBody(req)));if(req.method==='GET'&&photoMatch[2]){const filename=path.join(photos.folder,row.id,photoMatch[2]+(photoMatch[2]==='input'?'':'.png')),bytes=await readFile(filename);res.writeHead(200,{'Content-Type':photoMatch[2]==='input'?'image/'+imageExtension(bytes):'image/png'});return res.end(bytes);}}
    if(pathname==='/api/admin/logout'&&req.method==='POST'){store.logout(token);res.setHeader('Set-Cookie',sessionCookie('',true));return send(res,{ok:true});}
    if(pathname==='/api/admin/cars'&&req.method==='GET')return send(res,store.list(Object.fromEntries(url.searchParams)));
    if(pathname==='/api/admin/cars'&&req.method==='POST')return send(res,store.create(),201);
    const carMatch=pathname.match(/^\/api\/admin\/cars\/([a-zA-Z0-9-]+)(\/restore)?$/);
    if(carMatch){if(req.method==='GET'&&!carMatch[2])return send(res,store.get(carMatch[1]));if(req.method==='PUT'&&!carMatch[2]){const result=store.save(carMatch[1],await jsonBody(req));return send(res,result);}if(req.method==='POST'&&carMatch[2]){const input=await jsonBody(req);return send(res,store.restore(carMatch[1],input.revision,input.version));}}
    if(pathname==='/api/admin/uploads'&&req.method==='POST'){const bytes=await body(req,12*1024*1024),extension=imageExtension(bytes),filename=randomUUID()+'.'+extension;await writeFile(path.join(directory,'uploads',filename),bytes,{flag:'wx'});store.audit('upload',filename);return send(res,{path:'assets/buyer-photos/admin/'+filename},201);}
    if(pathname==='/api/admin/refresh'&&req.method==='POST'){store.sync(await loadCatalog(root));store.audit('refresh');return send(res,{ok:true});}
    if(pathname==='/api/admin/status'&&req.method==='GET')return send(res,{...store.stats(),external:await runner.external(),photo_processing:await photos.status()});
    if(pathname==='/api/admin/jobs'&&req.method==='POST'){const {kind}=await jsonBody(req);const id=runner.enqueue(kind);await runner.tick();return send(res,{id},202);}
    const stop=pathname.match(/^\/api\/admin\/jobs\/([a-f0-9-]+)\/stop$/);if(stop&&req.method==='POST'){runner.stop(stop[1]);return send(res,{ok:true});}
    if(pathname==='/api/admin/schedule'&&req.method==='PUT'){const input=await jsonBody(req);if(typeof input.enabled!=='boolean'||!Number.isInteger(input.start)||!Number.isInteger(input.end)||input.start<0||input.end>24||input.end<=input.start)throw fail('Задайте корректное ночное окно в пределах одних суток.');const schedule={enabled:input.enabled,start:input.start,end:input.end,timezone:'Europe/Moscow'};store.setSetting('schedule',schedule);store.audit('schedule');return send(res,schedule);}
    if(pathname==='/api/admin/backup'&&req.method==='POST'){const file=await createBackup();res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="'+path.basename(file)+'"'});return createReadStream(file).pipe(res);}
    if(pathname==='/api/admin/export'&&req.method==='POST'){
     const overlay=store.exportOverlay();for(const row of overlay.records.filter(x=>x.state==='published'))for(const image of row.car.images||[])if(image.startsWith('assets/buyer-photos/admin/')){const name=path.basename(image);await mkdir(path.join(root,'assets/buyer-photos/admin'),{recursive:true});try{await copyFile(path.join(directory,'uploads',name),path.join(root,image));}catch(error){if(error.code!=='ENOENT')throw error;await stat(path.join(root,image));}}
     const target=path.join(root,'data/admin-catalog.json');await writeFile(target+'.tmp',JSON.stringify(overlay)+'\n');const {rename}=await import('node:fs/promises');await rename(target+'.tmp',target);store.audit('export');return send(res,{ok:true,records:overlay.records.length,message:'Изменения сохранены в проект. Для GitHub Pages выполните сборку, проверку и публикацию.'});
    }
    throw fail('Метод или раздел не найден.',404);
   }
   if(!['GET','HEAD'].includes(req.method))throw fail('Метод не разрешён.',405);
   if(pathname==='/order-catalog.json'){res.setHeader('Cache-Control','no-store');return send(res,store.publicCatalog());}
   let file;
   const uploaded=pathname.match(/^\/assets\/buyer-photos\/admin\/([a-f0-9-]+\.(?:jpg|png|webp|avif))$/);if(uploaded){file=path.join(directory,'uploads',uploaded[1]);try{await stat(file);}catch(error){if(error.code!=='ENOENT')throw error;file=path.join(root,'assets/buyer-photos/admin',uploaded[1]);}}
   else if(pathname==='/admin'||pathname==='/admin/')file=path.join(root,'admin/index.html');
   else{const relative=pathname==='/'?'index.html':pathname.slice(1)+(pathname.endsWith('/')?'index.html':'');if(!/^(?:admin\/(?:admin\.js|photos\.js|admin\.css)|(?:assets|cars|models)\/|data\/vehicles\/|data\/import\/reference\/|(?:index\.html|styles\.css|app\.js|guide\.js|selection-engine\.mjs|suppliers\.js|supplier-engine\.mjs|catalog-data\.js|import-catalog-data\.js|import-catalog\.json|order\.html|order\.css|order\.js|order-engine\.mjs|robots\.txt|sitemap\.xml)$)/.test(relative))throw fail('Файл не найден.',404);file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))throw fail('Недопустимый путь.',403);}
   if(pathname.startsWith('/admin'))res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https://img.classistatic.de https://img.lotte-autoglobal.net data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
   const info=await stat(file);if(!info.isFile())throw fail('Файл не найден.',404);res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':info.size});if(req.method==='HEAD')return res.end();createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  }catch(error){if(res.headersSent)return res.destroy();send(res,{error:error.status?error.message:error.code==='ENOENT'?'Файл не найден.':'Не удалось выполнить действие.'},error.status||(error.code==='ENOENT'?404:500));if(!error.status&&error.code!=='ENOENT')console.error(error.message);}
 });
 server.requestTimeout=30000;server.headersTimeout=10000;await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 const close=async()=>{await runner.close();await photos.close();await new Promise(resolve=>server.close(resolve));store.close();};return {server,store,runner,photos,origin,close};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const app=await startAdminServer();console.log('Админка: '+app.origin+'/admin/');console.log('Сайт с изменениями: '+app.origin+'/');let closing=false;for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{if(closing)return;closing=true;await app.close();process.exit(0);});}
