import {request as httpRequest} from 'node:http';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {startAdminServer} from './index.mjs';
import {moscowClock} from './jobs.mjs';
import {applyAdminOverlay} from '../lib/admin-overlay.mjs';
const baseCar={id:'lotte-123456',provider:'lotte',provider_name:'LOTTE Auto Global',category:'supplier',name:'BMW X5',brand:'bmw',model:'X5',year:2021,mileage_km:40000,price:20000,currency:'USD',source_url:'https://m.lotte-autoglobal.net/car/gd/123456/',images:['/goods/test/car.jpg'],body:'suv',observed_at:'2026-10-20T00:00:00Z',status:'unknown'};
test('admin: authorization, durable editing, photos, history, public catalog and safe export',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'parallel-admin-test-'));await mkdir(path.join(root,'data'));await writeFile(path.join(root,'order-catalog.json'),JSON.stringify({listings:[baseCar],sources:[]}));const directory=path.join(root,'private'),origin='http://127.0.0.1:4191';let app=await startAdminServer({root,directory,port:4191,origin,jobs:false});let cookie='',csrf='';
 async function request(endpoint,{method='GET',body,authorized=true,requestOrigin=origin,token=csrf,headers={}}={}){const response=await fetch(origin+endpoint,{method,headers:{Origin:requestOrigin,...(authorized&&cookie?{Cookie:cookie}:{}),...(method!=='GET'?{'X-CSRF-Token':token}:{}),...(body!==undefined&&!(body instanceof Buffer)?{'Content-Type':'application/json'}:{}),...headers},body:body===undefined?undefined:body instanceof Buffer?body:JSON.stringify(body)});return response;}
 async function value(endpoint,options){const response=await request(endpoint,options);assert.equal(response.status,200,await response.clone().text());return response.json();}
 try{
  assert.equal((await request('/api/admin/cars')).status,401);
  assert.equal((await request('/api/admin/photos')).status,401);
  assert.equal((await request('/api/admin/photos/00000000-0000-0000-0000-000000000000/input')).status,401);
  assert.equal((await request('/api/admin/setup',{method:'POST',requestOrigin:'https://evil.example',body:{username:'admin',password:'test-only-password-2026'}})).status,403);
  const setup=await request('/api/admin/setup',{method:'POST',body:{username:'reviewer',password:'test-only-password-2026'}});assert.equal(setup.status,200);const setCookie=setup.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);cookie=setCookie.split(';')[0];csrf=(await setup.json()).csrf;
  assert.equal((await request('/api/admin/cars',{method:'POST',token:'wrong',body:{}})).status,403);
  assert.equal((await value('/api/admin/photos')).items.length,0);
  assert.equal((await request('/api/admin/photos',{method:'POST',token:'wrong',body:{car_id:'lotte-123456',index:0}})).status,403);
  assert.equal((await request('/api/admin/photos',{method:'POST',body:{car_id:'lotte-123456',index:0,regions:[[0,0,1,1]]}})).status,400);
  assert.equal((await request('/api/admin/photos/schedule',{method:'PUT',body:{enabled:true,limit:6000}})).status,400);
  await value('/api/admin/photos/schedule',{method:'PUT',body:{enabled:false,limit:20}});
  const createdResponse=await request('/api/admin/cars',{method:'POST',body:{}});assert.equal(createdResponse.status,201);let car=await createdResponse.json();const id=car.car.id;
  assert.equal((await request('/api/admin/cars/'+id,{method:'PUT',body:{version:car.version,state:'published',car:{name:'My car',brand:'bmw'}}})).status,400);
  assert.equal((await request('/api/admin/uploads',{method:'POST',body:Buffer.from('<svg onload="alert(1)"></svg>'),headers:{'Content-Type':'image/svg+xml'}})).status,400);
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhXQAAAAASUVORK5CYII=','base64');const uploaded=await request('/api/admin/uploads',{method:'POST',body:png,headers:{'Content-Type':'image/png'}});assert.equal(uploaded.status,201);const image=(await uploaded.json()).path;
  car=await value('/api/admin/cars/'+id,{method:'PUT',body:{version:car.version,state:'published',car:{name:'Тест автомобиля',brand:'bmw',description:'Безопасный текст <script>alert(1)</script>',images:[image],price:100,currency:'EUR'}}});assert.equal(car.version,2);
  const publicCatalog=await value('/order-catalog.json');assert.ok(publicCatalog.listings.some(x=>x.id===id&&x.price===100));assert.equal((await request('/'+image,{authorized:false})).status,200);
  assert.equal((await request('/api/admin/cars/'+id,{method:'PUT',body:{version:1,car:{name:'Stale'}}})).status,409);
  car=await value('/api/admin/cars/'+id,{method:'PUT',body:{version:car.version,car:{name:'Changed title'}}});const revision=car.history[0].id;car=await value('/api/admin/cars/'+id+'/restore',{method:'POST',body:{revision,version:car.version}});assert.equal(car.car.name,'Тест автомобиля');
  let imported=await value('/api/admin/cars/lotte-123456');imported=await value('/api/admin/cars/lotte-123456',{method:'PUT',body:{version:imported.version,car:{name:'Название редактора'}}});app.store.sync({listings:[{...baseCar,price:25000,name:'New supplier title'}],sources:[]});const preserved=await value('/api/admin/cars/lotte-123456');assert.equal(preserved.car.name,'Название редактора');assert.equal(preserved.car.price,25000);
  const draftResponse=await request('/api/admin/cars',{method:'POST',body:{}});const draft=await draftResponse.json();await value('/api/admin/cars/'+draft.car.id,{method:'PUT',body:{version:draft.version,car:{description:'PRIVATE DRAFT CONTENT'}}});
  await value('/api/admin/export',{method:'POST'});const overlay=JSON.parse(await readFile(path.join(root,'data/admin-catalog.json'),'utf8'));assert.ok(!JSON.stringify(overlay).includes('PRIVATE DRAFT CONTENT'));assert.ok(!JSON.stringify(overlay).includes('test-only-password'));assert.ok((await stat(path.join(root,image))).size>0);const exported=applyAdminOverlay({listings:[baseCar]},overlay);assert.ok(exported.listings.some(x=>x.id===id));assert.ok(!exported.listings.some(x=>x.id===draft.car.id));
  const backup=await request('/api/admin/backup',{method:'POST'});assert.equal(backup.status,200);assert.equal(Buffer.from(await backup.arrayBuffer()).toString('ascii',0,15),'SQLite format 3');
  assert.equal((await request('/api/admin/jobs',{method:'POST',body:{kind:'evil; echo bad'}})).status,400);
  const queued=await request('/api/admin/jobs',{method:'POST',body:{kind:'access'}});assert.equal(queued.status,202);const job=await queued.json();await value('/api/admin/jobs/'+job.id+'/stop',{method:'POST'});
  assert.equal((await request('/api/admin/schedule',{method:'PUT',body:{enabled:true,start:6,end:2}})).status,400);await value('/api/admin/schedule',{method:'PUT',body:{enabled:false,start:2,end:6}});
  assert.equal((await request('/server/index.mjs',{authorized:false})).status,404);assert.equal((await request('/private/admin.sqlite',{authorized:false})).status,404);assert.equal(await new Promise((resolve,reject)=>{const req=httpRequest(origin+'/api/admin/cars',{headers:{Host:'evil.example'}},res=>{res.resume();resolve(res.statusCode);});req.on('error',reject);req.end();}),403);
  await app.close();app=await startAdminServer({root,directory,port:4191,origin,jobs:false});const afterRestart=await value('/api/admin/cars/'+id);assert.equal(afterRestart.car.name,'Тест автомобиля');assert.equal((await value('/api/admin/status')).schedule.enabled,false);
  await value('/api/admin/logout',{method:'POST'});assert.equal((await request('/api/admin/cars')).status,401);
  for(let attempt=0;attempt<10;attempt++){const response=await request('/api/admin/login',{method:'POST',body:{username:'reviewer',password:'wrong'}});assert.equal(response.status,401);}assert.equal((await request('/api/admin/login',{method:'POST',body:{username:'reviewer',password:'wrong'}})).status,429);
 }finally{await app.close();}
});
test('Moscow night window and exports reject unsafe published records',()=>{assert.deepEqual(moscowClock(new Date('2026-10-20T23:30:00Z')),{day:'2026-10-21',hour:2});assert.throws(()=>applyAdminOverlay({listings:[]},{schema_version:1,records:[{id:'bad',state:'published',car:{id:'bad',name:'x',images:['https://evil.example/image.jpg']}}]}));});
