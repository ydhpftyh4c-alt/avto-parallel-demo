export const bodyLabels={suv:'Кроссовер / внедорожник',sedan:'Седан',minivan:'Минивэн',hatchback:'Хэтчбек',coupe:'Спортивный',liftback:'Лифтбек',pickup:'Пикап',convertible:'Кабриолет',motorcycle:'Мотоцикл',truck:'Грузовой',bus:'Автобус',other:'Другой / не указан'};
const aliases={'киа':'kia','хендай':'hyundai','хундай':'hyundai','хендэ':'hyundai','бмв':'bmw','мерседес':'benz','мерседесбенц':'benz','тойота':'toyota','соренто':'sorento','спортаж':'sportage','спортейдж':'sportage','туссан':'tucson','туксон':'tucson','ауди':'audi','мини':'mini','генезис':'genesis','дженезис':'genesis','шевроле':'chevrolet','рено':'renault','сантафе':'santa fe','санта':'santa','фе':'fe','джили':'geely','чери':'chery','хавал':'haval','фольксваген':'volkswagen','фольцваген':'volkswagen','вольво':'volvo','лексус':'lexus','мазда':'mazda','ниссан':'nissan','хонда':'honda','порше':'porsche','шкода':'skoda','пежо':'peugeot','ситроен':'citroen','опель':'opel','форд':'ford','бентли':'bentley','ленд':'land','ровер':'rover','дискавери':'discovery','дефендер':'defender','тигуан':'tiguan','туарег':'touareg','камри':'camry','королла':'corolla','октавия':'octavia','кодьяк':'kodiaq','эльантра':'elantra','элантра':'elantra','куга':'kuga'};
export const normalizeQuery=value=>String(value).normalize('NFKC').toLowerCase().replace(/ё/g,'е').replace(/[а-я]+/g,word=>aliases[word]||word).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
// Compact comparison covers model spellings such as SantaFe / Santa Fe and CX-5 / CX5.
export function matchesListingQuery(text,query){if(!String(query).trim())return true;const target=normalizeQuery(text).replace(/ /g,'');return normalizeQuery(query).split(' ').filter(Boolean).every(word=>target.includes(word));}
export function modelSuggestions(cars,query,limit=4){
 const normalized=normalizeQuery(query).replace(/ /g,'');if(normalized.length<2)return [];
 const seen=new Map();
 for(const car of cars){if(!car.images?.length)continue;const label=[car.brand_name||car.brand,car.model].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();if(!car.model||!label||!matchesListingQuery(label,query))continue;const key=normalizeQuery(label).replace(/ /g,'');if(key===normalized)continue;const entry=seen.get(key);if(entry)entry.count++;else seen.set(key,{label,count:1});}
 return [...seen.values()].sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'ru')).slice(0,limit);
}
export function filterListings(cars,filters,saved=new Set()){
 const query=filters.q||'';
 const result=cars.filter(car=>car.images?.length>0&&(!filters.scope||filters.scope==='all'||car.category===filters.scope)&&(!filters.status||filters.status==='all'||(car.status||'unknown')===filters.status)&&(!filters.saved||saved.has(car.id))&&(!filters.provider||filters.provider==='all'||car.provider===filters.provider)&&(!filters.brand||filters.brand==='all'||car.brand===filters.brand)&&(!filters.body||filters.body==='all'||car.body===filters.body)&&(!filters.currency||filters.currency==='all'||car.currency===filters.currency)&&(!filters.year||(car.year!==null&&car.year>=filters.year))&&(!filters.mileage&&filters.mileage!==0||(car.mileage_km!==null&&car.mileage_km<=filters.mileage))&&(!filters.price||(filters.currency!=='all'&&car.price!==null&&car.price<=filters.price))&&matchesListingQuery([car.name,car.brand_name,car.model,car.trim,car.year].filter(Boolean).join(' '),query));
 const numeric=(a,b,key,desc=false)=>{if(a[key]===null)return b[key]===null?0:1;if(b[key]===null)return -1;return desc?b[key]-a[key]:a[key]-b[key];};
 if(!filters.sort||filters.sort==='default')result.sort((a,b)=>(b.published_at||'').localeCompare(a.published_at||'')||b.external_id.localeCompare(a.external_id));
 if(filters.sort==='year-desc')result.sort((a,b)=>numeric(a,b,'year',true));
 if(filters.sort==='mileage-asc')result.sort((a,b)=>numeric(a,b,'mileage_km'));
 if(filters.currency&&filters.currency!=='all'&&filters.sort?.startsWith('price-'))result.sort((a,b)=>numeric(a,b,'price',filters.sort==='price-desc'));
 return result;
}
export function sourceImage(path,width=640){
 if(/^https:\/\/img\.classistatic\.de\/api\/v1\/mo-prod\/images\/[a-f0-9/-]+\?rule=mo-\d+$/i.test(path||''))return path;
 if(/^(?:data\/vehicles|assets\/vehicles|assets\/buyer-photos)\/[a-zA-Z0-9_./-]+\.(jpg|jpeg|png|webp|avif)$/i.test(path||'')&&!path.includes('..'))return path;
 if(!/^\/goods\/[a-zA-Z0-9_./-]+\.(jpg|jpeg|png)$/i.test(path||'')||path.includes('..'))return 'assets/import-model.svg';
 return 'https://img.lotte-autoglobal.net'+path+'/dims/format/webp/resize/'+width+'/cropcenter/'+width+'x'+Math.round(width/1.4)+'/composite/wm_224/quality/90/optimize';
}
export function listingBrief(cars){
 if(!cars.length||cars.length>5)throw Error('Выберите от одного до пяти автомобилей.');
 return ['Здравствуйте! Интересуют автомобили:',...cars.map((car,index)=>`${index+1}. ${car.name}${car.year?' · '+car.year+' г.':'.'} Цена из объявления: ${car.price===null?'по запросу':(car.price_prefix||'')+car.price+' '+car.currency}.\n${car.source_url}\n${car.category==='agency'?'Цена на '+car.price_date:'Данные загружены: '+new Date(car.observed_at).toLocaleDateString('ru-RU')}.`),'Прошу проверить наличие, состояние, комплектацию, возможность ввоза и рассчитать полную стоимость с доставкой, пошлинами, утильсбором и услугами.'].join('\n\n');
}
