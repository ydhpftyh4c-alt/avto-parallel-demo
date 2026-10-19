import {readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
export async function readImportModels(){
 const records=[];async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const file=path.join(dir,item.name);if(item.isDirectory())await walk(file);else if(item.name==='model.json')records.push(JSON.parse(await readFile(file,'utf8')));}}await walk('data/import/models');return records;
}
export async function generateImportCatalog(){
 const models=await readImportModels();const ids=new Set();const config=JSON.parse(await readFile('data/import/config.json','utf8'));
 const publicModels=models.map((model,index)=>{
  if(ids.has(model.model_id)||!model.name||!model.source?.url?.startsWith('https://'))throw Error('Invalid or duplicate import model');ids.add(model.model_id);
  if(model.import_status!=='requires_verification')throw Error('Unverified model cannot claim confirmed availability');
  if(model.estimate.low_rub!==null || model.estimate.high_rub!==null)throw Error('Pricing is disabled: numeric estimates cannot be published');
  return {id:index+1,record_id:model.model_id,record_kind:'model',slug:model.slug,brand:model.brand,name:model.name,types:model.types,country:model.brand_country,body:model.body,year:'Год и версию выбираем при подборе',mileage:'Новый или с пробегом — по запросу',engine:'Двигатель и мощность выбираются отдельно',price:null,currency:'RUB',pricePrefix:'',priceDate:'',priceNote:'Ориентировочную стоимость рассчитаем для выбранной версии и направления. Сейчас автоматическая оценка не подключена.',date:'19.10.2026',status:'unknown',statusDate:'',specs:{year:null,mileage_km:null,is_new:false},price_history:[],features:['Выбор года и комплектации','Направления: Китай, Корея, Европа — проверяем по запросу','Возможность поставки требует подтверждения'],description:'Справочная карточка модели, а не объявление о конкретном автомобиле. Региональные версии могут отличаться. Возможность ввоза, доступность и итоговую стоимость агентство подтверждает для конкретной машины.',image:'assets/import-model.svg',images:[],source_url:model.source.url,source_checked_at:model.source.checked_at};
 }).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
 await writeFile('import-catalog-data.js','// Generated model directory: no live quotes or numeric import estimates.\nconst importModelCars = '+JSON.stringify(publicModels,null,2)+';\n');
 console.log(`Import directory generated: ${publicModels.length} initial reference models; live feeds: ${config.live_supplier_feeds}.`);return publicModels;
}
