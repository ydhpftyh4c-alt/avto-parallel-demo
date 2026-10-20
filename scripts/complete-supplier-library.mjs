import {hydrateLibrary,atomic,libraryRoot} from './download-supplier-library.mjs';
import path from 'node:path';
const job={started_at:new Date().toISOString(),phase:'details',status:'running',scope:'existing_snapshots_only_not_complete_platform_inventory'};
try{
 await atomic(path.join(libraryRoot,'job.json'),job);await hydrateLibrary({detailsOnly:true});
 job.phase='photos';await atomic(path.join(libraryRoot,'job.json'),job);await hydrateLibrary();job.status='finished_snapshot_pass';
}catch(e){job.status='stopped';job.error=e.message;process.exitCode=1;}finally{job.updated_at=new Date().toISOString();await atomic(path.join(libraryRoot,'job.json'),job);console.log(JSON.stringify(job));}
