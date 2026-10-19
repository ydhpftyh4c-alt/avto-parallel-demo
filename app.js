'use strict';
const agentCars=catalogCars;
let cars=importModelCars;
let catalogView='models';
const isModel=car=>car.record_kind==='model';
const marketLabels={cn:'Китай',kr:'Корея',eu:'Европа'};
const direction=document.querySelector('#model-direction');
let activeType = 'all';
const grid = document.querySelector('#car-grid');
const country = document.querySelector('#country');
const search = document.querySelector('#catalog-search');
const brandFilter=document.querySelector('#brand-filter');
const brandName=car=>car.brand || car.name.split(' ')[0];
const brandLabels={toyota:'Toyota',porsche:'Porsche',skoda:'Škoda',qiyuan:'Qiyuan',mini:'MINI','mercedes-benz':'Mercedes-Benz','li-auto':'Li Auto','land-rover':'Land Rover',mazda:'Mazda',lexus:'Lexus',nissan:'Nissan',mitsubishi:'Mitsubishi',honda:'Honda',chevrolet:'Chevrolet',ducati:'Ducati',suzuki:'Suzuki',audi:'Audi',bmw:'BMW',byd:'BYD',geely:'Geely',hyundai:'Hyundai',kia:'Kia',volkswagen:'Volkswagen',zeekr:'Zeekr'};
const sort = document.querySelector('#catalog-sort');
const reset = document.querySelector('#catalog-reset');
const stateFilter=document.querySelector('#catalog-state');
const more=document.querySelector('#catalog-more');
let shownLimit=12;
const limits=[['budget',document.querySelector('#budget-max')],['yearFrom',document.querySelector('#year-min')],['kmTo',document.querySelector('#mileage-max')]];
function hasLimits(){return limits.some(([,input])=>input.value!=='');}
function matchesLimits(car){
  for(const [key,input] of limits){
    if(!input.validity.valid)return false;
    if(input.value==='')continue;
    const bound=Number(input.value);
    if(key==='budget' && (car.currency!=='RUB' || car.price===null || car.price>bound))return false;
    if(key==='yearFrom' && (car.specs?.year==null || car.specs.year<bound))return false;
    if(key==='kmTo' && (car.specs?.mileage_km==null || car.specs.mileage_km>bound))return false;
  }return true;
}
const statusLabels={unknown:'Наличие уточняйте',sold:'Продан — по каналу',reserved:'Забронирован — по каналу'};
const aliases = {'тойота':'toyota','порше':'porsche','порш':'porsche','фольксваген':'volkswagen','фольц':'volkswagen','джетта':'jetta','бмв':'bmw','мерседес':'mercedes','киа':'kia','мазда':'mazda','тайкан':'taycan','оптима':'optima','киюань':'qiyuan','шкода':'skoda','ауди':'audi','лексус':'lexus','ниссан':'nissan','хонда':'honda','митсубиси':'mitsubishi','хендай':'hyundai','хундай':'hyundai','джили':'geely','зикр':'zeekr','зеекр':'zeekr','мини':'mini','шевроле':'chevrolet','дукатти':'ducati','дукати':'ducati','лисян':'li auto'};
const normalizeSearch = text => text.toLowerCase().normalize('NFKC').replace(/ё/g,'е').replace(/[а-я]+/g,word=>aliases[word]||word).replace(/[\s-]+/g,' ').trim();
const dateValue = date => date.split('.').reverse().join('');
const priceFormat = new Intl.NumberFormat('ru-RU');
const dialog = document.querySelector('#car-dialog');
let selectedCar = null;
let photoIndex = 0;
function el(tag, className, text){
  const element = document.createElement(tag);
  if(className) element.className = className;
  if(text !== undefined) element.textContent = text;
  return element;
}
function priceLabel(car){if(isModel(car))return 'Расчёт по запросу';if(car.price===null)return 'Цена по запросу';return car.pricePrefix+priceFormat.format(car.price)+' '+({RUB:'₽',USD:'$',GEL:'GEL'}[car.currency]||car.currency||'₽');}
function renderCars(resetLimit=true){
  if(resetLimit)shownLimit=12;
  const invalid=limits.filter(([,input])=>!input.validity.valid);
  document.querySelector('#limits-error').textContent=invalid.length?'Проверьте параметры: бюджет — положительное целое число, год — от 1900 до 2100, пробег — целое число от нуля.':'';
  limits.forEach(([,input])=>input.setAttribute('aria-invalid',String(!input.validity.valid)));
  const activeLimitCount=limits.filter(([,input])=>input.value!=='').length;
  document.querySelector('#advanced-summary').textContent='Бюджет, год и пробег'+(activeLimitCount?' · '+activeLimitCount:'');
  const words=normalizeSearch(search.value).split(' ').filter(Boolean);
  const visible = cars.filter(car => (activeType === 'all' || car.types.includes(activeType)) && (country.value === 'all' || car.country === country.value) && (brandFilter.value==='all' || brandName(car)===brandFilter.value) && (catalogView==='models' || stateFilter.value==='all' || car.status===stateFilter.value) && matchesLimits(car) && words.every(word=>normalizeSearch(car.name).replace(/\s/g,'').includes(word.replace(/\s/g,''))));
  visible.sort((a,b)=>{if(catalogView==='models')return a.name.localeCompare(b.name,'ru');if(sort.value==='newest')return dateValue(b.date).localeCompare(dateValue(a.date)) || b.id-a.id;const aKnown=a.price!==null && a.currency==='RUB',bKnown=b.price!==null && b.currency==='RUB';if(aKnown!==bKnown)return aKnown?-1:1;return aKnown?(sort.value==='price-asc'?a.price-b.price:b.price-a.price):dateValue(b.date).localeCompare(dateValue(a.date));});
  grid.replaceChildren(...visible.slice(0,shownLimit).map(car => {
    const article = el('article',isModel(car)?'car model-card':'car');
    const visual = el('div','car-visual');
    const image = el('img');
    image.src=car.image; image.alt=isModel(car)?'Схематичная иллюстрация автомобиля, не фотография модели':car.images.length?car.name+' — фотография из объявления':'Фотография отсутствует в экспорте'; image.width=720; image.height=480; image.loading='lazy'; image.decoding='async';
    visual.append(image,el('span','car-tag',isModel(car)?'МОДЕЛЬ ПОД ЗАКАЗ':car.status==='unknown'?'ПУБЛИКАЦИЯ '+car.date:statusLabels[car.status]));
    const data=el('div','car-data');
    data.append(el('p','car-meta',car.body+' / '+car.year),el('h3','',car.name),el('p','car-mileage',car.mileage));
    const bottom=el('div','car-bottom');
    const price=el('div','');price.append(el('strong','car-price',priceLabel(car)),el('small','price-date',isModel(car)?'Стоимость после выбора версии':car.price===null?'Сумма не указана в публикации':'Цена на '+car.priceDate));
    const button=el('button','','↗');button.type='button';button.setAttribute('aria-label','Подробнее о '+car.name);button.addEventListener('click',()=>openCar(car));
    bottom.append(price,button);data.append(bottom);article.append(visual,data);return article;
  }));
  document.querySelector('#empty').hidden = visible.length > 0;
  document.querySelector('#empty').textContent=catalogView==='models'?'Модель пока не добавлена в справочник. Обсудите индивидуальный подбор с агентством.':'Автомобилей по этим условиям нет. Измените поиск или сбросьте фильтры.';
  document.querySelector('#catalog-status').textContent = `Показано ${Math.min(shownLimit,visible.length)} из ${visible.length} по условиям · всего в каталоге ${cars.length}`;
  more.hidden=visible.length<=shownLimit;
  reset.hidden=activeType==='all' && brandFilter.value==='all' && country.value==='all' && !search.value && sort.value==='newest' && stateFilter.value==='unknown' && !hasLimits();
}
function renderPhoto(){
  const image=document.querySelector('#detail-image');
  const hasPhotos=selectedCar.images.length>0;
  image.src=hasPhotos?selectedCar.images[photoIndex]:selectedCar.image;image.alt=hasPhotos?selectedCar.name+' — фото '+(photoIndex+1)+' из '+selectedCar.images.length:isModel(selectedCar)?'Схематичная иллюстрация автомобиля':'Фото в экспорте отсутствует';
  document.querySelector('#photo-prev').disabled=!hasPhotos;document.querySelector('#photo-next').disabled=!hasPhotos;
  document.querySelector('#photo-counter').textContent=hasPhotos?(photoIndex+1)+' / '+selectedCar.images.length:isModel(selectedCar)?'Выбор модели':'Нет фотографий';
}
function openCar(car, writeHistory = true){
  selectedCar=car;photoIndex=0;
  document.querySelector('#detail-title').textContent=car.name;
  document.querySelector('#detail-kind').textContent=isModel(car)?'СПРАВОЧНИК МОДЕЛЕЙ':'ИЗ КАНАЛА АГЕНТСТВА';
  document.querySelector('.gallery-caption').textContent=isModel(car)?'Иллюстрация справочная. Фотографии конкретных машин появятся после подключения предложений поставщиков.':'Фотографии из объявления. Используйте стрелки для просмотра.';
  document.querySelector('#detail-meta').textContent=car.body+' · '+car.year;
  document.querySelector('#detail-price').textContent=priceLabel(car);
  document.querySelector('#detail-price-date').textContent=isModel(car)?'Автоматическая оценка пока не подключена':(car.price===null?'Цена не указана':'Цена из канала на '+car.priceDate)+' · '+(statusLabels[car.status]||'Наличие уточняйте');
  document.querySelector('#detail-price-note').textContent=car.priceNote;
  const status=document.querySelector('#detail-status');
  status.textContent=isModel(car)?'Возможность поставки нужно проверить · '+marketLabels[direction.value]:car.status==='sold'?'Отметка о продаже: '+car.statusDate:car.status==='reserved'?'Отметка о бронировании: '+car.statusDate:'Наличие нужно подтвердить у агентства';
  status.classList.toggle('sold',car.status==='sold');
  const priceHistoryPanel=document.querySelector('#price-history');priceHistoryPanel.open=false;
  const events=car.price_history||[];priceHistoryPanel.hidden=!events.length;
  priceHistoryPanel.querySelector('summary').textContent='История цены · '+events.length;
  const labels={initial:'Цена в объявлении',price_update:'Изменение цены',temporary:'Историческая временная акция',variant_quote:'Цена другого варианта'};
  document.querySelector('#price-history-list').replaceChildren(...[...events].reverse().map(event=>{const item=el('li');const header=el('div','price-event-top');header.append(el('time','',event.date),el('strong','',priceLabel({price:event.amount,currency:event.currency,pricePrefix:''})));item.append(header,el('p','',labels[event.kind]||'Публикация цены'));if(event.note)item.append(el('small','',event.note));return item;}));
  const specs=document.querySelector('#detail-specs');specs.replaceChildren();
  for(const [label,value] of [['Год',car.year],['Пробег',car.mileage],['Двигатель',car.engine]]){specs.append(el('dt','',label),el('dd','',value));}
  document.querySelector('#detail-features').replaceChildren(...car.features.map(text=>el('li','',text)));
  document.querySelector('#detail-description').textContent=car.description;
  const sourceLink=document.querySelector('#model-source-link');sourceLink.hidden=!isModel(car);if(isModel(car))sourceLink.href=car.source_url;
  document.querySelector('#detail-source').textContent=isModel(car)?'Справочник моделей пополняется. Это не склад и не подтверждение возможности ввоза любой комплектации.':'Объявление агентства от '+car.date+'. Характеристики указаны продавцом и не являются результатом независимой проверки.';
  if(writeHistory){const url=new URL(location.href);url.searchParams.set('car',car.slug);url.searchParams.set('view',isModel(car)?'models':'offers');if(isModel(car))url.searchParams.set('from',direction.value);url.hash='catalog';history.pushState({avtoDialog:true},'',url);}
  const shareUrl=new URL(location.href);shareUrl.search='';shareUrl.searchParams.set('car',car.slug);shareUrl.searchParams.set('view',isModel(car)?'models':'offers');if(isModel(car))shareUrl.searchParams.set('from',direction.value);shareUrl.hash='catalog';
  document.querySelector('#car-share-url').value=shareUrl.href;
  document.querySelector('#share-status').textContent='';
  renderPhoto();if(!dialog.open)dialog.showModal();document.body.classList.add('dialog-open');
}
function movePhoto(direction){if(!selectedCar || !selectedCar.images.length)return;photoIndex=(photoIndex+direction+selectedCar.images.length)%selectedCar.images.length;renderPhoto();}
document.querySelector('#photo-prev').addEventListener('click',()=>movePhoto(-1));
document.querySelector('#photo-next').addEventListener('click',()=>movePhoto(1));
dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{
  document.body.classList.remove('dialog-open');
  const url=new URL(location.href);
  if(!url.searchParams.has('car'))return;
  if(history.state?.avtoDialog){history.back();}else{url.searchParams.delete('car');history.replaceState(null,'',url);}
});
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('keydown',event=>{if(event.target.matches('input,textarea,select'))return;if(event.key==='ArrowLeft'){event.preventDefault();movePhoto(-1);}if(event.key==='ArrowRight'){event.preventDefault();movePhoto(1);}});
document.querySelector('#detail-select').addEventListener('click',()=>{const car=selectedCar;dialog.close();document.querySelector('#lead-message').value=isModel(car)?`Интересует подбор ${car.name}. Планируемое направление: ${marketLabels[direction.value]}. Прошу проверить возможность поставки и рассчитать предварительную стоимость для подходящей версии.`:`Интересует ${car.name}. Цена в объявлении на ${car.priceDate}: ${priceLabel(car)}. Прошу уточнить наличие и актуальные условия.`;document.querySelector('#request').scrollIntoView();document.querySelector('#lead-form input').focus({preventScroll:true});});
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{
  activeType=button.dataset.type;
  document.querySelectorAll('.filter').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-pressed',String(item===button));});updateCatalog();
}));
function setActiveType(value){
  activeType=value;document.querySelectorAll('.filter').forEach(button=>{const active=button.dataset.type===value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
}
function applyView(view){
  catalogView=view;cars=view==='models'?importModelCars:agentCars;const modelView=view==='models';
  brandFilter.replaceChildren(new Option('Все марки','all'),...[...new Set(cars.map(brandName))].sort((a,b)=>a.localeCompare(b,'ru')).map(brand=>new Option(brandLabels[brand] || brand,brand)));
  document.querySelector('.catalog-sort').hidden=modelView;
  document.querySelectorAll('.filter').forEach(button=>button.hidden=button.dataset.type!=='all' && !cars.some(car=>car.types.includes(button.dataset.type)));
  for(const [id,active] of [['view-models',modelView],['view-offers',!modelView]]){const button=document.getElementById(id);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
  document.querySelector('.catalog-state').hidden=modelView;document.querySelector('#advanced-filters').hidden=modelView;document.querySelector('#offers-note').hidden=modelView;document.querySelector('#model-direction-wrap').hidden=!modelView;
  sort.options[0].textContent=modelView?'По названию':'Сначала свежие публикации';sort.disabled=modelView;sort.title=modelView?'Модели упорядочены по названию':'';
  document.querySelector('#catalog-purpose').textContent=modelView?'Выберите модель для индивидуального подбора из Китая, Кореи или Европы. Это начальная подборка, не полный мировой каталог. Доступность и возможность ввоза каждой версии требуют проверки.':'Конкретные автомобили из публикаций агентства. Цены и статусы относятся к датам сообщений, текущее наличие уточняйте.';
  if(modelView){limits.forEach(([,input])=>input.value='');sort.value='newest';}
}
function switchView(view){applyView(view);setActiveType('all');country.value='all';brandFilter.value='all';search.value='';sort.value='newest';stateFilter.value='unknown';limits.forEach(([,input])=>input.value='');updateCatalog();}
document.querySelector('#view-models').addEventListener('click',()=>switchView('models'));document.querySelector('#view-offers').addEventListener('click',()=>switchView('offers'));direction.addEventListener('change',writeCatalogUrl);
function writeCatalogUrl(){
  const url=new URL(location.href);url.searchParams.set('view',catalogView);if(catalogView==='models')url.searchParams.set('from',direction.value);else url.searchParams.delete('from');
  for(const [key,value,defaultValue] of [['brand',brandFilter.value,'all'],['q',search.value.trim(),''],['type',activeType,'all'],['country',country.value,'all'],['sort',sort.value,'newest'],['status',stateFilter.value,'unknown']]){if(value===defaultValue)url.searchParams.delete(key);else url.searchParams.set(key,value);}
  for(const [key,input] of limits){if(input.value!=='' && input.validity.valid)url.searchParams.set(key,input.value);else url.searchParams.delete(key);}
  history.replaceState(history.state,'',url);
}
function updateCatalog(){renderCars();writeCatalogUrl();}
function restoreCatalog(){
  const params=new URL(location.href).searchParams;
  const linkedOffer=agentCars.some(car=>car.slug===params.get('car'));
  const legacyFilters=!params.has('view') && ['status','budget','yearFrom','kmTo'].some(key=>params.has(key));
  applyView(params.get('view')==='offers'||linkedOffer||legacyFilters?'offers':'models');direction.value=['cn','kr','eu'].includes(params.get('from'))?params.get('from'):'cn';
  const type=params.get('type');setActiveType([...document.querySelectorAll('.filter')].some(button=>button.dataset.type===type)?type:'all');
  brandFilter.value=[...brandFilter.options].some(option=>option.value===params.get('brand'))?params.get('brand'):'all';
  country.value=[...country.options].some(option=>option.value===params.get('country'))?params.get('country'):'all';
  sort.value=[...sort.options].some(option=>option.value===params.get('sort'))?params.get('sort'):'newest';
  stateFilter.value=[...stateFilter.options].some(option=>option.value===params.get('status'))?params.get('status'):'unknown';
  for(const [key,input] of limits){const value=params.get(key)||'';input.value=/^\d{1,10}$/.test(value)?value:'';if(!input.validity.valid)input.value='';}
  document.querySelector('#advanced-filters').open=hasLimits();
  search.value=(params.get('q')||'').slice(0,80);renderCars();
  if(catalogView==='models'){sort.value='newest';stateFilter.value='unknown';limits.forEach(([,input])=>input.value='');renderCars();}
  const car=cars.find(item=>item.slug===params.get('car'));
  if(car)openCar(car,false);else{if(dialog.open)dialog.close();if(params.has('car'))document.querySelector('#catalog-status').textContent='Автомобиль по этой ссылке не найден. Выберите другой из каталога.';}
}
limits.forEach(([,input])=>input.addEventListener('input',updateCatalog));
stateFilter.addEventListener('change',updateCatalog);more.addEventListener('click',()=>{shownLimit+=12;renderCars(false);});
brandFilter.addEventListener('change',updateCatalog);country.addEventListener('change',updateCatalog);sort.addEventListener('change',updateCatalog);search.addEventListener('input',updateCatalog);
reset.addEventListener('click',()=>{setActiveType('all');country.value='all';brandFilter.value='all';sort.value='newest';stateFilter.value='unknown';search.value='';limits.forEach(([,input])=>input.value='');document.querySelector('#advanced-filters').open=false;updateCatalog();search.focus();});
window.addEventListener('popstate',restoreCatalog);
document.querySelector('#copy-car-link').addEventListener('click',async()=>{
  const input=document.querySelector('#car-share-url');const status=document.querySelector('#share-status');
  try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(input.value);status.textContent='Ссылка скопирована. Её можно отправить клиенту.';}catch{input.focus();input.select();status.textContent='Выделили ссылку — скопируйте её вручную.';}
});
restoreCatalog();
const toggle = document.querySelector('.menu-toggle');
const nav = document.querySelector('#navigation');
function closeMenu(){toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Открыть меню');nav.classList.remove('open');}
toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');nav.classList.toggle('open',open);});
nav.querySelectorAll('a').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('keydown',event=>{if(event.key==='Escape' && toggle.getAttribute('aria-expanded')==='true'){closeMenu();toggle.focus();}});
document.addEventListener('click',event=>{if(!event.target.closest('.header'))closeMenu();});
matchMedia('(min-width: 761px)').addEventListener('change',closeMenu);
const calc = document.querySelector('#calc-form');
const fields = ['car-price','rate','delivery','service','duties'];
const rubles = new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',maximumFractionDigits:0});
let budget = null;
function calculate(){
  const inputs = fields.map(id=>document.getElementById(id));
  const valid = inputs.every(input=>input.value.trim()!=='' && input.validity.valid);
  budget = valid ? Number(inputs[0].value)*Number(inputs[1].value)+inputs.slice(2).reduce((sum,input)=>sum+Number(input.value),0) : null;
  if(!Number.isFinite(budget))budget=null;
  document.querySelector('#total').textContent=budget===null?'— ₽':rubles.format(budget);
  document.querySelector('#calc-status').textContent=budget===null?'Заполните все поля корректными суммами.':'Сумма введённых расходов. Проверьте полноту платежей со специалистом.';
}
calc.addEventListener('input',calculate);
document.querySelector('#currency').addEventListener('change',()=>{document.querySelector('#rate').value='';calculate();});
calc.addEventListener('submit',event=>{event.preventDefault();calculate();if(budget===null)return;document.querySelector('#lead-message').value=`Хочу обсудить предварительный бюджет ${rubles.format(budget)}. Цена: ${document.querySelector('#car-price').value} ${document.querySelector('#currency').value}; курс: ${document.querySelector('#rate').value} ₽. Логистика: ${document.querySelector('#delivery').value} ₽; услуги: ${document.querySelector('#service').value} ₽; платежи: ${document.querySelector('#duties').value} ₽. Все суммы введены мной и требуют проверки.`;document.querySelector('#request').scrollIntoView();document.querySelector('#lead-form input').focus({preventScroll:true});});
const lead = document.querySelector('#lead-form');
lead.addEventListener('submit',event=>{event.preventDefault();const phone=lead.elements.phone;const digits=phone.value.replace(/\D/g,'');if(digits.length<10 || digits.length>15){phone.setCustomValidity('Введите от 10 до 15 цифр номера телефона.');phone.reportValidity();return;}document.querySelector('#lead-status').textContent='Демопроверка пройдена. Заявка не отправлена. Для реальных обращений нужно подключить приём заявок и добавить документы компании.';});
lead.elements.phone.addEventListener('input',()=>{lead.elements.phone.setCustomValidity('');document.querySelector('#lead-status').textContent='';});
lead.addEventListener('input',()=>{document.querySelector('#lead-status').textContent='';});
if('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(element=>observer.observe(element));document.documentElement.classList.add('motion-ready');}




