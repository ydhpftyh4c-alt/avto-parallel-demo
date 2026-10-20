import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),directory=path.join(root,'.local-source/retouch-benchmark');await mkdir(directory,{recursive:true});
const db=new DatabaseSync(path.join(root,'.admin-data/admin.sqlite'),{readOnly:true});
const rows=db.prepare("SELECT * FROM photo_tasks WHERE json_extract(details,'$.outside_mask_unchanged')=1 ORDER BY rowid LIMIT 8").all();db.close();if(rows.length<3)throw Error('Для замера нужны хотя бы три обработанных исходника.');
const python=process.env.RETOUCH_PYTHON||path.join(root,'.local-source/retouch-env',process.platform==='win32'?'Scripts/python.exe':'bin/python');
const worker=spawn(python,[path.join(root,'server/retouch.py'),'--stream'],{windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,PYTHONIOENCODING:'utf-8'}});
let pending,buffer='';worker.stderr.on('data',chunk=>process.stderr.write(chunk));worker.on('error',error=>pending?.reject(error));worker.on('close',code=>{if(pending)pending.reject(Error('Worker stopped: '+code));});
worker.stdout.on('data',chunk=>{buffer+=chunk;let end;while((end=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,end);buffer=buffer.slice(end+1);if(!line.trim())continue;const value=JSON.parse(line),request=pending;pending=null;request?.resolve(value);}});
const results=[],started=performance.now();try{for(const [index,row] of rows.entries()){
 const original=JSON.parse(await readFile(path.join(root,'.admin-data/retouch',row.id,'task.json'),'utf8'));
 const task={...original,mask:path.join(directory,String(index+1)+'-mask.png'),output:path.join(directory,String(index+1)+'-result.png')};
 const time=performance.now();const result=await new Promise((resolve,reject)=>{pending={resolve,reject};worker.stdin.write(JSON.stringify(task)+'\n');});if(result.state!=='review')throw Error(result.error||result.state);const wall=(performance.now()-time)/1000;results.push({...result,wall_seconds:Number(wall.toFixed(3))});console.log(JSON.stringify({sample:index+1,seconds:result.seconds,wall_seconds:wall,peak_vram_mib:result.peak_vram_mib}));
}const seconds=(performance.now()-started)/1000,warm=results.slice(1).map(r=>r.wall_seconds).sort((a,b)=>a-b),median=warm[Math.floor(warm.length/2)];
const report={date:new Date().toISOString(),gpu:'NVIDIA GeForce RTX 2060 SUPER',samples:results.length,total_seconds:Number(seconds.toFixed(2)),cold_seconds:results[0].wall_seconds,warm_median_seconds:median,peak_vram_mib:Math.max(...results.map(r=>r.peak_vram_mib)),local_per_hour:Math.floor(results.length/seconds*3600),network_not_included:true,results};
await writeFile(path.join(directory,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,results:undefined}));}finally{worker.stdin.end();worker.kill();}
