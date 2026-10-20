export const supplierPlatforms=Object.freeze([
 {id:'mobile-de',name:'mobile.de',market:'eu',region:'Европа',url:'https://www.mobile.de/ru',hosts:['mobile.de']},
 {id:'encar',name:'Encar',market:'kr',region:'Корея',url:'https://www.encar.com/index.htm',hosts:['encar.com']},
 {id:'che168',name:'Che168 Global',market:'cn',region:'Китай',url:'https://global.che168.com/ru',hosts:['che168.com']},
 {id:'lotte',name:'LOTTE Auto Global',market:'kr',region:'Корея',url:'https://m.lotte-autoglobal.net/co/main/mainView.do',hosts:['lotte-autoglobal.net']}
]);
export function identifyListing(value){
 if(value.trim().length>800)throw Error('Ссылка слишком длинная. Уберите рекламные параметры или укажите короткую ссылку на объявление.');
 const url=new URL(value.trim());
 if(url.protocol!=='https:'||url.username||url.password||url.port)throw Error('Нужна HTTPS-ссылка на одну из четырёх площадок, без логина и пароля.');
 const provider=supplierPlatforms.find(item=>item.hosts.some(host=>url.hostname===host||url.hostname.endsWith('.'+host)));
 if(!provider)throw Error('Поддерживаются ссылки mobile.de, Encar, Che168 и LOTTE Auto Global.');
 // Keep listing identifiers intact; discard only known advertising tracking tags.
 for(const key of [...url.searchParams.keys()])if(/^utm_/i.test(key)||['ysclid','gclid','fbclid'].includes(key))url.searchParams.delete(key);
 url.hash='';return {provider,url:url.href};
}
export function makeSupplierBrief({providerId,model='',link='',budget=''}){
 let provider=supplierPlatforms.find(item=>item.id===providerId);if(!provider)throw Error('Выберите площадку.');
 let listing;if(link){listing=identifyListing(link);provider=listing.provider;}
 if(!model.trim()&&!listing)throw Error('Выберите марку и модель или вставьте ссылку на объявление.');
 if(budget!==''&&(!/^\d+$/.test(String(budget))||Number(budget)<1||Number(budget)>1e9))throw Error('Укажите бюджет целым числом от 1 до 1 000 000 000 ₽.');
 return {provider,text:[`Хочу обсудить подбор автомобиля${model.trim()?' '+model.trim():''}.`,`Площадка: ${provider.name}. Направление: ${provider.region}.`,listing?'Ссылка: '+listing.url:'Конкретное объявление пока не выбрано.',budget!==''?'Мой бюджет с доставкой: до '+Number(budget).toLocaleString('ru-RU')+' ₽.':'', 'Прошу проверить наличие, состояние, комплектацию, возможность ввоза и полную стоимость с доставкой, пошлинами и утильсбором.'].filter(Boolean).join('\n')};
}
