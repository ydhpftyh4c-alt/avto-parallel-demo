import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,copyFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {AdminStore} from './store.mjs';
import {PhotoQueue,validateRegions,canAutoApply} from './photos.mjs';
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhXQAAAAASUVORK5CYII=','base64');
test('photo queue: private originals, deduplication, review, version conflicts, reversible acceptance and caching',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'parallel-photos-')),directory=path.join(root,'private');await mkdir(path.join(root,'assets/vehicles'),{recursive:true});await mkdir(path.join(directory,'uploads'),{recursive:true});await writeFile(path.join(root,'assets/vehicles/a.png'),png);
 const store=new AdminStore(directory,'https://example.com/');const car={id:'test-1',name:'Test car',brand:'bmw',body:'suv',provider:'lotte',images:['assets/vehicles/a.png']};store.sync({listings:[car,{...car,id:'test-2'}]});let calls=0;
 const queue=new PhotoQueue(store,root,directory,{processor:async task=>{calls++;await copyFile(task.input,task.output);await writeFile(task.mask,png);return {state:'review',outside_mask_unchanged:true};}});clearInterval(queue.timer);
 try{
  assert.throws(()=>validateRegions([[0,0,.8,.8]]));assert.throws(()=>validateRegions([[1,0,.1,.1]]));assert.throws(()=>queue.enqueue('test-1',-1));
  const id=queue.enqueue('test-1',0,[[.1,.1,.1,.1]]);assert.throws(()=>queue.enqueue('test-1',0),/уже/);await queue.tick();assert.equal(queue.row(id).state,'review');assert.equal(store.get('test-1').car.images[0],car.images[0]);
  const version=store.get('test-1').version;store.save('test-1',{version,car:{name:'Edited by owner'}});await assert.rejects(queue.action(id,{action:'accept',version}),error=>error.status===409);
  const current=store.get('test-1');await queue.action(id,{action:'accept',version:current.version});assert.equal(queue.row(id).state,'accepted');assert.equal(store.get('test-1').car.name,'Edited by owner');assert.match(store.get('test-1').car.images[0],/^assets\/buyer-photos\/admin\//);assert.deepEqual(await readFile(path.join(queue.folder,id,'input')),png);assert.deepEqual(await readFile(path.join(root,'assets/vehicles/a.png')),png);
  const after=store.get('test-1');store.restore('test-1',after.history[0].id,after.version);assert.equal(store.get('test-1').car.images[0],car.images[0]);
  const other=queue.enqueue('test-2',0,[[.1,.1,.1,.1]]);await queue.tick();assert.equal(calls,1);assert.equal(JSON.parse(queue.row(other).details).cached,true);await queue.action(other,{action:'reject'});assert.equal(store.get('test-2').car.images[0],car.images[0]);
  await queue.action(other,{action:'retry',regions:[]});await queue.tick();assert.equal(calls,2);assert.equal(queue.row(other).state,'review');
  store.setSetting('retouch_schedule',{enabled:false,limit:1});assert.equal(queue.enqueueNight(),0);
  store.sync({listings:[car,{...car,id:'test-2'},{...car,id:'test-3'},{...car,id:'test-4'}]});
  store.setSetting('retouch_schedule',{enabled:true,limit:1});assert.equal(queue.enqueueNight(),1);assert.equal(queue.enqueueNight(),0,'unfinished night backlog must not grow');
  const pending=store.db.prepare("SELECT id FROM photo_tasks WHERE state='queued' AND scheduled=1").get();await queue.action(pending.id,{action:'reject'});assert.equal(queue.row(pending.id).state,'rejected');assert.equal(queue.enqueueNight(),1);
  assert.throws(()=>queue.list({state:'unsafe'}));assert.throws(()=>queue.list({page:-1}));assert.ok(queue.list({state:'review'}).items.every(row=>row.state==='review'));
 }finally{await queue.close();store.close();}
});
test('automatic replacement requires the verified template, confidence, unchanged outer pixels and no prior rejection',()=>{
 const row={original:'/goods/test/a.jpg',regions:'[]'},result={state:'review',coverage:.035,outside_mask_unchanged:true,model_sha256:'7ba7aa7ac37a4d41fdbbeba3a2af7ead18058552997e3a3cd1a3b2210c9e6b4c',detections:[{template:'lotte-wm224',confidence:.96}]};
 assert.ok(canAutoApply(row,result));for(const change of [{coverage:.2},{outside_mask_unchanged:false},{auto_blocked:true},{model_sha256:'other'},{detections:[{template:'lotte-wm224',confidence:.7}]}])assert.ok(!canAutoApply(row,{...result,...change}));assert.ok(!canAutoApply({...row,regions:'[[0,0,0.1,0.1]]'},result));assert.ok(!canAutoApply({...row,original:'assets/vehicles/a.jpg'},result));
});
test('persistent worker reuses one process and recovers after a reported processing failure',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'parallel-photo-worker-')),directory=path.join(root,'private');await mkdir(path.join(root,'server'));const store=new AdminStore(directory,'https://example.com/');store.sync({listings:[]});
 await writeFile(path.join(root,'server/retouch.py'),`const readline=require('node:readline');readline.createInterface({input:process.stdin}).on('line',line=>{const task=JSON.parse(line);console.log(JSON.stringify(task.id==='bad'?{state:'failed',error:'fixture failure'}:{state:'review',pid:process.pid,id:task.id}));});`);
 const queue=new PhotoQueue(store,root,directory);clearInterval(queue.timer);queue.python=process.execPath;
 try{for(const id of ['one','two','bad','three'])await mkdir(path.join(queue.folder,id),{recursive:true});const first=await queue.execute({id:'one'}),second=await queue.execute({id:'two'});assert.equal(first.pid,second.pid);assert.equal(second.id,'two');await assert.rejects(queue.execute({id:'bad'}),/fixture failure/);const third=await queue.execute({id:'three'});assert.equal(third.pid,first.pid);}finally{await queue.close();store.close();}
});
test('automatic pipeline replaces a qualified photo and preserves edits made during processing',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'parallel-photo-auto-')),directory=path.join(root,'private');await mkdir(path.join(directory,'uploads'),{recursive:true});const store=new AdminStore(directory,'https://example.com/');store.sync({listings:[{id:'auto-test',provider:'lotte',name:'Original title',brand:'bmw',images:['/goods/test/a.jpg']}]});store.setSetting('retouch_schedule',{enabled:true,auto_apply:true,limit:10});
 const queue=new PhotoQueue(store,root,directory,{processor:async task=>{const current=store.get('auto-test');store.save('auto-test',{version:current.version,car:{name:'Owner changed title'}});await writeFile(task.output,png);await writeFile(task.mask,png);return {state:'review',coverage:.035,outside_mask_unchanged:true,model_sha256:'7ba7aa7ac37a4d41fdbbeba3a2af7ead18058552997e3a3cd1a3b2210c9e6b4c',detections:[{template:'lotte-wm224',confidence:.96}]};}});clearInterval(queue.timer);queue.input=async row=>{await mkdir(path.join(queue.folder,row.id),{recursive:true});await writeFile(path.join(queue.folder,row.id,'input'),png);return 'test-input-hash';};
 try{const id=queue.enqueue('auto-test',0);await queue.tick();assert.equal(queue.row(id).state,'accepted');assert.equal(store.get('auto-test').car.name,'Owner changed title');assert.match(store.get('auto-test').car.images[0],/^assets\/buyer-photos\/admin\//);assert.equal(store.db.prepare("SELECT COUNT(*) n FROM audit WHERE action='photo_auto_applied'").get().n,1);const current=store.get('auto-test');store.restore('auto-test',current.history[0].id,current.version);assert.equal(store.get('auto-test').car.images[0],'/goods/test/a.jpg');}finally{await queue.close();store.close();}
});
