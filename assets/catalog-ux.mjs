const defaults={util:'all',q:'',provider:'all',brand:'all',body:'all',fuel:'all',drive:'all',year:null,mileage:null,price:null,currency:'all',sort:'default',saved:false,status:'unknown'};
const format=new Intl.NumberFormat('ru-RU');
export function clearListingFilter(filters,key){
 if(!Object.hasOwn(defaults,key))return {...filters};
 const next={...filters,[key]:defaults[key]};
 if(key==='currency'){next.price=null;if(next.sort?.startsWith('price-'))next.sort='default';}
 return next;
}
export function activeListingFilters(filters,labels={}){
 const items=[],add=(key,label)=>items.push({key,label});
 if(filters.q)add('q','Поиск: '+filters.q);
 for(const [key,prefix] of [['brand','Марка'],['body','Кузов'],['fuel','Топливо'],['drive','Привод'],['provider','Площадка']])if(filters[key]&&filters[key]!=='all')add(key,prefix+': '+(labels[key]||filters[key]));
 if(filters.year!==null&&filters.year!==undefined&&filters.year!=='')add('year','От '+filters.year+' года');
 if(filters.mileage!==null&&filters.mileage!==undefined&&filters.mileage!=='')add('mileage','До '+format.format(filters.mileage)+' км');
 if(filters.price!==null&&filters.price!==undefined&&filters.price!=='')add('price','Цена до '+format.format(filters.price)+(filters.currency!=='all'?' '+filters.currency:''));
 else if(filters.currency&&filters.currency!=='all')add('currency','Цены в '+filters.currency);
 if(filters.sort&&filters.sort!=='default')add('sort',labels.sort||filters.sort);
 if(filters.status&&filters.status!=='unknown')add('status',labels.status||filters.status);
 if(filters.saved)add('saved','Моя подборка');
 if(filters.util&&filters.util!=='all')add('util',filters.util==='known'?'Утильсбор: мощность указана':'Утильсбор: предварительный отбор');
 return items;
}
const brandNames={bmw:'BMW',byd:'BYD',mini:'MINI',kia:'Kia',hyundai:'Hyundai',ssangyong:'SsangYong','mercedes-benz':'Mercedes-Benz','land-rover':'Land Rover','renault-korea':'Renault Korea'};
const readableWords=text=>text.replace(/\b[A-Z]{4,}\b/g,word=>word[0]+word.slice(1).toLowerCase());
export function listingCardText(car){
 const full=String(car.name||''),brand=String(car.brand_name||''),model=String(car.model||''),trim=String(car.trim||'');
 const canonical=[brand,model,trim].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
 // Only split the original provider's canonical title; preserve editorial titles verbatim.
 if(car.provider==='lotte'&&brand&&model&&full.replace(/\s+/g,' ').trim()===canonical){return {title:(brandNames[car.brand]||readableWords(brand))+' '+readableWords(model),subtitle:trim,full};}
 return {title:full,subtitle:'',full};
}
