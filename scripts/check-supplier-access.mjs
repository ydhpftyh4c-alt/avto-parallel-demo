import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export async function checkSupplierAccess(){
 const sources=[{id:'mobile-de',name:'mobile.de',market:'eu',url:'https://services.mobile.de/search-api/search',status:'api_access_required'},{id:'encar',name:'Encar',market:'kr',url:'https://api.encar.com/search/car/list/general',status:'access_restricted'},{id:'che168',name:'Che168 Global',market:'cn',url:'https://global.che168.com/ru',status:'bot_challenge'}],result=[];
 for(const source of sources){
  try{const response=await fetch(source.url,{signal:AbortSignal.timeout(20000)});const body=await response.text();const status=response.status===401?'api_access_required':/has_been_cr_blocked|abnormal|access denied/i.test(body)||response.status===403||response.status===429?'access_restricted':/__tst_status|EO_Bot_Ssid/.test(body)?'bot_challenge':'not_connected';result.push({...source,status,checked_at:new Date().toISOString(),http_status:response.status,response_bytes:Buffer.byteLength(body),automatic_import:false,note:'Response is not a verified public listing feed. No access bypass attempted.'});console.log(`${source.name}: HTTP ${response.status}, ${status}`);}catch{result.push({...source,status:'request_failed',checked_at:new Date().toISOString(),http_status:null,automatic_import:false,note:'Request failed. No access bypass attempted.'});}
 }
 await mkdir('data/import/providers',{recursive:true});await writeFile('data/import/providers/access-report.json',JSON.stringify(result,null,2)+'\n');return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await checkSupplierAccess();
