import {spawn} from 'node:child_process';
import {readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {fail} from './store.mjs';
export function moscowClock(date=new Date()){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));return {day:parts.year+'-'+parts.month+'-'+parts.day,hour:Number(parts.hour)};}
export class JobRunner{
 constructor(store,root,onRefresh,{enabled=true}={}){this.store=store;this.root=root;this.onRefresh=onRefresh;this.enabled=enabled;this.current=null;this.busy=false;this.timer=setInterval(()=>this.tick().catch(e=>console.error('Scheduler:',e.message)),15000);this.timer.unref();}
 async external(){try{const file=path.join(this.root,'vehicle-library/.download.lock'),pid=Number(await readFile(file,'utf8'));if(!Number.isInteger(pid)||pid<=0)return null;if(pid===this.current?.child.pid)return null;this.externalPid=pid;try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH'){await unlink(file);this.externalPid=null;return null;}return {active:true,pid};}let progress;try{progress=JSON.parse(await readFile(path.join(this.root,'vehicle-library/progress.json'),'utf8'));}catch{}return {active:true,pid,progress};}catch(e){if(e.code==='ENOENT'){if(this.externalPid){try{process.kill(this.externalPid,0);return {active:true,pid:this.externalPid};}catch{this.externalPid=null;}}return null;}throw e;}}
 enqueue(kind,scheduled=false){if(!['lotte','mobile-de','library','access'].includes(kind))throw fail('Неизвестный загрузчик.');if(this.store.db.prepare("SELECT 1 FROM jobs WHERE kind=? AND state IN ('queued','running','paused','cancelling')").get(kind))throw fail('Такое задание уже есть в очереди.',409);const id=randomUUID();this.store.db.prepare("INSERT INTO jobs(id,kind,state,scheduled) VALUES (?,?,'queued',?)").run(id,kind,Number(scheduled));this.store.audit('job_queued',id);return id;}
 async tick(){if(this.busy||!this.enabled)return;this.busy=true;try{
  const clock=moscowClock(),schedule=this.store.setting('schedule'),inWindow=clock.hour>=schedule.start&&clock.hour<schedule.end;
  if(this.current?.scheduled&&(!schedule.enabled||!inWindow)){this.stop(this.current.id,'paused');return;}
  if(schedule.enabled&&inWindow&&this.store.configured()&&this.store.setting('last_night')!==clock.day){
   await this.onRefresh('backup');
   this.store.db.prepare("UPDATE jobs SET state='queued' WHERE state='paused' AND scheduled=1").run();
   for(const kind of ['access','lotte','mobile-de','library']){try{this.enqueue(kind,true);}catch(e){if(e.status!==409)throw e;}}
   this.store.setSetting('last_night',clock.day);
  }
  if(this.current||await this.external())return;
  const job=this.store.db.prepare("SELECT * FROM jobs WHERE state='queued' AND (scheduled=0 OR ?=1) ORDER BY rowid LIMIT 1").get(Number(schedule.enabled&&inWindow));if(!job)return;
  this.start(job);
 }finally{this.busy=false;}}
 start(job){const child=spawn(process.execPath,[path.join(this.root,'server/task.mjs'),job.kind],{cwd:this.root,windowsHide:true,stdio:['ignore','pipe','pipe']});let finish;const completion=new Promise(resolve=>finish=resolve);this.current={...job,child,completion};this.store.db.prepare("UPDATE jobs SET state='running',started=?,finished=NULL,error=NULL WHERE id=?").run(new Date().toISOString(),job.id);let stopped=null;const log=chunk=>{const text=chunk.toString().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'');this.store.db.prepare('UPDATE jobs SET log=substr(log||?,-64000) WHERE id=?').run(text,job.id);};child.stdout.on('data',log);child.stderr.on('data',log);child.on('error',error=>{stopped=error.message;});child.on('close',async code=>{
   const state=this.current?.id===job.id?this.current.stopState:null;const success=code===0&&!state&&!stopped;
   try{const lock=path.join(this.root,'vehicle-library/.download.lock');if(Number(await readFile(lock,'utf8'))===child.pid)await unlink(lock);}catch(e){if(e.code!=='ENOENT')console.error('Job lock:',e.message);}
   try{if(success||state==='paused')await this.onRefresh('refresh');this.store.db.prepare('UPDATE jobs SET state=?,finished=?,error=? WHERE id=?').run(state||(success?'success':'failed'),new Date().toISOString(),success?null:stopped||state||'Загрузчик завершился с кодом '+code,job.id);}catch(e){this.store.db.prepare("UPDATE jobs SET state='failed',error=?,finished=? WHERE id=?").run(e.message,new Date().toISOString(),job.id);}finally{this.current=null;finish();}
  });}
 stop(id,state='cancelled'){if(this.current?.id===id){this.current.stopState=state;this.store.db.prepare("UPDATE jobs SET state='cancelling' WHERE id=?").run(id);this.current.child.kill('SIGTERM');return;}const job=this.store.db.prepare('SELECT state FROM jobs WHERE id=?').get(id);if(!job)throw fail('Задание не найдено.',404);if(!['queued','paused'].includes(job.state))throw fail('Задание уже завершено.',409);this.store.db.prepare("UPDATE jobs SET state='cancelled',finished=? WHERE id=?").run(new Date().toISOString(),id);}
 async close(){clearInterval(this.timer);if(this.current){const completion=this.current.completion;this.stop(this.current.id,'interrupted');await completion;}}
}
