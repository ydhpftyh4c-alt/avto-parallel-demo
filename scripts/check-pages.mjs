import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {readVehicles} from './generate-catalog.mjs';
export async function checkGeneratedPages(catalog,models){
 const root=process.cwd();let links=0;
 for(const car of [...catalog,...models]){
  const relative=(car.record_kind==='model'?'models/':'cars/')+car.slug+'/index.html';const html=await readFile(relative,'utf8');
  if(!html.includes('<h1>')||!html.includes('rel="canonical"')||!html.includes('og:image'))throw Error('Missing page metadata: '+relative);
  for(const [,ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)){
   if(/^[a-z][a-z0-9+.-]*:/i.test(ref))continue;
   const target=path.resolve(path.dirname(path.join(root,relative)),ref.split('?')[0]);
   if(target!==root&&!target.startsWith(root+path.sep))throw Error('Page link outside repository');
   await stat(target);links++;
  }
 }
 for(const car of (await readVehicles()).filter(car=>!car.review_required&&!car.images.length)){
  const html=await readFile('cars/'+car.slug+'/index.html','utf8');
  if(!html.includes('noindex,follow')||html.includes('assets/import-model.svg')||!html.includes('Карточка скрыта из каталога'))throw Error('Photo-less page is still advertising a car: '+car.slug);
 }
 console.log('Static page audit passed: '+(catalog.length+models.length)+' pages, '+links+' local links/assets; photo-less pages hidden.');
}
