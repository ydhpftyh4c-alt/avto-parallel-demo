// Deterministic selection from verified fields; never computes landed prices or import eligibility.
export const bodyLabels={any:'Любой кузов',suv:'Кроссовер',sedan:'Седан или лифтбек',electric:'Электропривод'};
export function normalizePreferences(input={}){
 const body=Object.hasOwn(bodyLabels,input.body)?input.body:'any';
 const market=['cn','kr','eu','any'].includes(input.market)?input.market:'any';
 const raw=input.budget;
 let budget=null;
 if(raw!==null&&raw!==undefined&&raw!==''){
  if(typeof raw==='boolean'||!/^\d+$/.test(String(raw)))throw Error('Введите целый бюджет в рублях.');
  budget=Number(raw);if(!Number.isSafeInteger(budget)||budget<1||budget>1000000000)throw Error('Бюджет должен быть от 1 до 1 000 000 000 ₽.');
 }
 const preferences={body,market,budget};if(typeof input.query==='string'&&input.query.trim())preferences.query=input.query.trim().slice(0,80);return preferences;
}
function matchesBody(car,body){if(car.types?.includes('motorcycle'))return false;if(body==='any')return true;if(body==='sedan')return car.types?.some(type=>['sedan','liftback'].includes(type));return car.types?.includes(body);}
function timestamp(date){const [day,month,year]=String(date||'').split('.').map(Number);const time=Date.UTC(year,month-1,day);return Number.isFinite(time)?time:0;}
export function selectVehicles(offers,models,input){
 const preferences=normalizePreferences(input);
 const words=String(preferences.query||'').toLowerCase().normalize('NFKC').replace(/[\s-]+/g,' ').trim().split(' ').filter(Boolean);const matchesQuery=car=>words.every(word=>car.name.toLowerCase().normalize('NFKC').replace(/[\s-]+/g,'').includes(word.replace(/\s/g,'')));
 const suitable=offers.filter(car=>car.status==='unknown'&&matchesBody(car,preferences.body)&&matchesQuery(car));
 const matched=suitable.filter(car=>preferences.budget===null||(car.currency==='RUB'&&typeof car.price==='number'&&Number.isFinite(car.price)&&car.price>0&&car.price<=preferences.budget&&!String(car.pricePrefix||'').trim()));
 const ranked=[...matched].sort((a,b)=>timestamp(b.date)-timestamp(a.date)||(Number(Boolean(b.images?.length))-Number(Boolean(a.images?.length)))||String(a.record_id).localeCompare(String(b.record_id)));
 const referenceModels=models.filter(car=>matchesBody(car,preferences.body)&&matchesQuery(car)).sort((a,b)=>Number(Boolean(b.example_image))-Number(Boolean(a.example_image))||a.name.localeCompare(b.name,'ru'));
 return {preferences,offers:ranked.slice(0,3),models:referenceModels.slice(0,3),offerPool:ranked,modelPool:referenceModels,offerCount:matched.length,modelCount:referenceModels.length,excludedByBudget:preferences.budget!==null?suitable.length-matched.length:0};
}
