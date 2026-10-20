export const bodyLabels={suv:'Кроссовер / внедорожник',sedan:'Седан',minivan:'Минивэн',hatchback:'Компактный',coupe:'Спортивный',truck:'Грузовой',bus:'Автобус',other:'Другой / не указан'};
const aliases={'киа':'kia','хендай':'hyundai','хундай':'hyundai','бмв':'bmw','мерседес':'benz','тойота':'toyota','соренто':'sorento','спортаж':'sportage','туссан':'tucson','ауди':'audi','мини':'mini','генезис':'genesis','шевроле':'chevrolet','ренo':'renault','рено':'renault','сантафе':'santa fe'};
export const normalizeQuery=value=>String(value).toLowerCase().replace(/[а-яё]+/g,word=>aliases[word]||word).replace(/[\s-]+/g,' ').trim();
export function filterListings(cars,filters,saved=new Set()){
 const words=normalizeQuery(filters.q||'').split(' ').filter(Boolean);
 const result=cars.filter(car=>(!filters.saved||saved.has(car.id))&&(!filters.provider||filters.provider==='all'||car.provider===filters.provider)&&(!filters.brand||filters.brand==='all'||car.brand===filters.brand)&&(!filters.body||filters.body==='all'||car.body===filters.body)&&(!filters.currency||filters.currency==='all'||car.currency===filters.currency)&&(!filters.year||(car.year!==null&&car.year>=filters.year))&&(!filters.mileage&&filters.mileage!==0||(car.mileage_km!==null&&car.mileage_km<=filters.mileage))&&(!filters.price||(filters.currency!=='all'&&car.price!==null&&car.price<=filters.price))&&words.every(word=>normalizeQuery(car.name).includes(word)));
 const numeric=(a,b,key,desc=false)=>{if(a[key]===null)return b[key]===null?0:1;if(b[key]===null)return -1;return desc?b[key]-a[key]:a[key]-b[key];};
 if(!filters.sort||filters.sort==='default')result.sort((a,b)=>(b.published_at||'').localeCompare(a.published_at||'')||b.external_id.localeCompare(a.external_id));
 if(filters.sort==='year-desc')result.sort((a,b)=>numeric(a,b,'year',true));
 if(filters.sort==='mileage-asc')result.sort((a,b)=>numeric(a,b,'mileage_km'));
 if(filters.currency&&filters.currency!=='all'&&filters.sort?.startsWith('price-'))result.sort((a,b)=>numeric(a,b,'price',filters.sort==='price-desc'));
 return result;
}
export function sourceImage(path,width=640){
 if(!/^\/goods\/[a-zA-Z0-9_./-]+\.(jpg|jpeg|png)$/i.test(path||'')||path.includes('..'))return 'assets/import-model.svg';
 return 'https://img.lotte-autoglobal.net'+path+'/dims/format/webp/resize/'+width+'/cropcenter/'+width+'x'+Math.round(width/1.4)+'/composite/wm_224/quality/90/optimize';
}
export function listingBrief(cars){
 if(!cars.length||cars.length>5)throw Error('Выберите от одного до пяти автомобилей.');
 return ['Здравствуйте! Интересуют автомобили под заказ:',...cars.map((car,index)=>`${index+1}. ${car.name}${car.year?' · '+car.year+' г.':'.'} Цена продавца: ${car.price===null?'по запросу':car.price+' '+car.currency}.\n${car.source_url}\nДанные загружены: ${new Date(car.observed_at).toLocaleDateString('ru-RU')}.`),'Прошу проверить наличие, состояние, комплектацию, возможность ввоза и рассчитать полную стоимость с доставкой, пошлинами, утильсбором и услугами.'].join('\n\n');
}
