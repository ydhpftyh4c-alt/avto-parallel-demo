'use strict';
const agentCars=catalogCars;
let importModelCars=[];
let cars=agentCars;
let catalogView='offers';
let modelsPromise=null,catalogRequest=0;
async function ensureModels(){if(importModelCars.length)return;if(!modelsPromise)modelsPromise=fetch('import-catalog.json?v=20261020-3').then(response=>{if(!response.ok)throw Error('Models unavailable');return response.json();}).then(data=>{if(!Array.isArray(data))throw Error('Invalid models');importModelCars=data;}).catch(error=>{modelsPromise=null;throw error;});await modelsPromise;}
function readSaved(key){try{const value=JSON.parse(localStorage.getItem(key)||'[]');return new Set(Array.isArray(value)?value.filter(id=>typeof id==='string'):[]);}catch{return new Set();}}
const favorites=readSaved('parallel-favorites-v1');
const comparison=new Set();
let comparisonBriefContext=null;
function persistFavorites(){try{localStorage.setItem('parallel-favorites-v1',JSON.stringify([...favorites]));}catch{document.querySelector('#selection-status').textContent='Избранное сохранено до закрытия страницы: хранилище браузера недоступно.';}}
const carPage=car=>(isModel(car)?'models/':'cars/')+car.slug+'/';

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
  const visible = cars.filter(car => (!document.querySelector('#favorites-only').checked || favorites.has(car.record_id)) && (activeType === 'all' || car.types.includes(activeType)) && (country.value === 'all' || car.country === country.value) && (brandFilter.value==='all' || brandName(car)===brandFilter.value) && (catalogView==='models' || stateFilter.value==='all' || car.status===stateFilter.value) && matchesLimits(car) && words.every(word=>normalizeSearch(car.name).replace(/\s/g,'').includes(word.replace(/\s/g,''))));
  visible.sort((a,b)=>{if(catalogView==='models')return a.name.localeCompare(b.name,'ru');if(sort.value==='newest')return dateValue(b.date).localeCompare(dateValue(a.date)) || b.id-a.id;const aKnown=a.price!==null && a.currency==='RUB',bKnown=b.price!==null && b.currency==='RUB';if(aKnown!==bKnown)return aKnown?-1:1;return aKnown?(sort.value==='price-asc'?a.price-b.price:b.price-a.price):dateValue(b.date).localeCompare(dateValue(a.date));});
  grid.replaceChildren(...visible.slice(0,shownLimit).map(car => {
    const article = el('article',isModel(car)?'car model-card':'car');
    const visual = el('div','car-visual');
    const image = el('img');
    image.src=car.image_small||car.image;if(car.image_small){image.srcset=car.image_small+' 480w, '+car.image_large+' 960w';image.sizes='(max-width:420px) 90vw, (max-width:760px) 44vw, 30vw';} image.alt=isModel(car)?'Схематичная иллюстрация автомобиля, не фотография модели':car.images.length?car.name+' — фотография из объявления':'Фотография отсутствует в экспорте'; image.width=720; image.height=480; image.loading='lazy'; image.decoding='async';
    if(isModel(car) && car.example_image){image.src=car.example_image;image.removeAttribute('srcset');image.alt=car.name+' — пример из объявления агентства, версия может отличаться';visual.append(image);article.classList.add('model-has-example');}else if(!isModel(car))visual.append(image);else visual.append(el('span','model-brand-name',brandLabels[car.brand]||car.brand),el('span','model-body-label',car.body));
    visual.append(el('span','car-tag',isModel(car)?'МОДЕЛЬ ПОД ЗАКАЗ':car.status==='unknown'?'ПУБЛИКАЦИЯ '+car.date:statusLabels[car.status]));
    const data=el('div','car-data');
    const heading=el('h3');const pageLink=el('a','',car.name);pageLink.href=carPage(car);heading.append(pageLink);data.append(el('p','car-meta',isModel(car)?car.body:car.body+' / '+car.year),heading,el('p','car-mileage',isModel(car)?'Выбор года и версии — при подборе':car.mileage));
    const bottom=el('div','car-bottom');
    const price=el('div','');price.append(el('strong','car-price',priceLabel(car)),el('small','price-date',isModel(car)?'Стоимость после выбора версии':car.price===null?'Сумма не указана в публикации':'Цена на '+car.priceDate));
    const button=el('button','','↗');button.type='button';button.setAttribute('aria-label','Подробнее о '+car.name);button.addEventListener('click',()=>openCar(car));
    bottom.append(price,button);data.append(bottom);
    const actions=el('div','car-actions');const favorite=el('button','',favorites.has(car.record_id)?'♥ Сохранено':'♡ В избранное');favorite.type='button';favorite.setAttribute('aria-pressed',String(favorites.has(car.record_id)));favorite.setAttribute('aria-label','Избранное: '+car.name);favorite.addEventListener('click',()=>{if(favorites.has(car.record_id))favorites.delete(car.record_id);else favorites.add(car.record_id);persistFavorites();if(document.querySelector('#favorites-only').checked)renderCars(false);else{favorite.textContent=favorites.has(car.record_id)?'♥ Сохранено':'♡ В избранное';favorite.setAttribute('aria-pressed',String(favorites.has(car.record_id)));updateSelectionCounts();}});
    const compare=el('button','',comparison.has(car.record_id)?'✓ В сравнении':'+ Сравнить');compare.type='button';compare.setAttribute('aria-pressed',String(comparison.has(car.record_id)));compare.addEventListener('click',()=>{if(comparison.has(car.record_id))comparison.delete(car.record_id);else if(comparison.size<3)comparison.add(car.record_id);else{document.querySelector('#selection-status').textContent='Можно сравнить до трёх автомобилей. Удалите один в окне сравнения.';return;}compare.textContent=comparison.has(car.record_id)?'✓ В сравнении':'+ Сравнить';compare.setAttribute('aria-pressed',String(comparison.has(car.record_id)));updateSelectionCounts();});actions.append(favorite,compare);data.append(actions);if(car.example_caption)data.append(el('p','example-caption',car.example_caption));article.append(visual,data);return article;
  }));
  document.querySelector('#empty').hidden = visible.length > 0;
  document.querySelector('#empty').textContent=catalogView==='models'?'Модель пока не добавлена в справочник. Обсудите индивидуальный подбор с агентством.':document.querySelector('#favorites-only').checked?'В этом разделе нет сохранённых автомобилей по выбранным условиям. Отключите «Только избранное» или смените раздел.':'Автомобилей по этим условиям нет. Измените поиск или сбросьте фильтры.';
  document.querySelector('#catalog-status').textContent = `Показано ${Math.min(shownLimit,visible.length)} из ${visible.length} по условиям · всего в каталоге ${cars.length}`;
  more.hidden=visible.length<=shownLimit;updateSelectionCounts();syncSearchSuggestions();renderActiveFilters();
  reset.hidden=!document.querySelector('#favorites-only').checked && activeType==='all' && brandFilter.value==='all' && country.value==='all' && !search.value && sort.value==='newest' && stateFilter.value==='unknown' && !hasLimits();
}
function renderPhoto(){
  const image=document.querySelector('#detail-image');
  const hasPhotos=selectedCar.images.length>0;
  image.src=hasPhotos?selectedCar.images[photoIndex]:selectedCar.image;image.alt=hasPhotos?selectedCar.name+' — фото '+(photoIndex+1)+' из '+selectedCar.images.length:isModel(selectedCar)?'Схематичная иллюстрация автомобиля':'Фото в экспорте отсутствует';
  document.querySelectorAll('#gallery-thumbs button').forEach((button,index)=>{button.classList.toggle('selected',index===photoIndex);button.setAttribute('aria-pressed',String(index===photoIndex));});
  document.querySelector('#photo-prev').disabled=!hasPhotos;document.querySelector('#photo-next').disabled=!hasPhotos;
  document.querySelector('#photo-counter').textContent=hasPhotos?(photoIndex+1)+' / '+selectedCar.images.length:isModel(selectedCar)?'Выбор модели':'Нет фотографий';
}
function openCar(car, writeHistory = true){
  selectedCar=car;photoIndex=0;setGalleryExpanded(false);document.querySelector('#photo-expand').hidden=!car.images.length;
  document.querySelector('#detail-title').textContent=car.name;document.querySelector('#detail-page-link').href=carPage(car);
  document.querySelector('#detail-kind').textContent=isModel(car)?'СПРАВОЧНИК МОДЕЛЕЙ':'ИЗ КАНАЛА АГЕНТСТВА';
  document.querySelector('.gallery-caption').textContent=isModel(car)?'Это справочная модель. Конкретные машины с фото смотрите в разделе «Под заказ».':'Фотографии из объявления. Используйте стрелки для просмотра.';
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
  document.querySelector('#gallery-thumbs').replaceChildren(...selectedCar.images.map((src,index)=>{const button=el('button',index===photoIndex?'selected':'');button.type='button';button.setAttribute('aria-label','Показать фото '+(index+1));button.setAttribute('aria-pressed',String(index===photoIndex));const thumbnail=el('img');thumbnail.src=src;thumbnail.alt='';thumbnail.loading='lazy';thumbnail.width=100;thumbnail.height=72;button.append(thumbnail);button.addEventListener('click',()=>{photoIndex=index;renderPhoto();});return button;}));
  document.querySelector('#gallery-thumbs').hidden=selectedCar.images.length<2;
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
document.querySelector('#detail-select').addEventListener('click',()=>{const car=selectedCar;dialog.close();setBriefCar(car);document.querySelector('#lead-message').value=isModel(car)?`Интересует подбор ${car.name}. Планируемое направление: ${marketLabels[direction.value]}. Прошу проверить возможность поставки и рассчитать предварительную стоимость для подходящей версии.`:`Интересует ${car.name}. Цена в объявлении на ${car.priceDate}: ${priceLabel(car)}. Прошу уточнить наличие и актуальные условия.`;document.querySelector('#request').scrollIntoView();persistBriefDraft();document.querySelector('#lead-message').focus({preventScroll:true});});
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
  document.querySelector('#catalog-purpose').textContent=modelView?'Справочник моделей для подбора. Версию, доступность и возможность ввоза проверяем индивидуально.':'Фотографии и данные из публикаций агентства. Актуальную цену и наличие уточняйте у Дмитрия.';
  if(modelView){limits.forEach(([,input])=>input.value='');sort.value='newest';}
}
async function switchView(view){const request=++catalogRequest;try{if(view==='models')await ensureModels();}catch{document.querySelector('#catalog-status').textContent='Не удалось загрузить модели. Попробуйте ещё раз или позвоните Дмитрию.';return;}if(request!==catalogRequest)return;applyView(view);setActiveType('all');country.value='all';brandFilter.value='all';search.value='';sort.value='newest';stateFilter.value='unknown';limits.forEach(([,input])=>input.value='');updateCatalog();}
document.querySelector('#view-models').addEventListener('click',()=>switchView('models'));document.querySelector('#view-offers').addEventListener('click',()=>switchView('offers'));direction.addEventListener('change',writeCatalogUrl);
function writeCatalogUrl(){
  const url=new URL(location.href);url.searchParams.set('view',catalogView);if(catalogView==='models')url.searchParams.set('from',direction.value);else url.searchParams.delete('from');
  for(const [key,value,defaultValue] of [['saved',document.querySelector('#favorites-only').checked?'1':'',''],['brand',brandFilter.value,'all'],['q',search.value.trim(),''],['type',activeType,'all'],['country',country.value,'all'],['sort',sort.value,'newest'],['status',stateFilter.value,'unknown']]){if(value===defaultValue)url.searchParams.delete(key);else url.searchParams.set(key,value);}
  for(const [key,input] of limits){if(input.value!=='' && input.validity.valid)url.searchParams.set(key,input.value);else url.searchParams.delete(key);}
  history.replaceState(history.state,'',url);
}
function updateCatalog(){renderCars();writeCatalogUrl();}
async function restoreCatalog(){const request=++catalogRequest;
  const params=new URL(location.href).searchParams;document.querySelector('#favorites-only').checked=params.get('saved')==='1';
  const linkedOffer=agentCars.some(car=>car.slug===params.get('car'));
  const legacyFilters=!params.has('view') && ['status','budget','yearFrom','kmTo'].some(key=>params.has(key));
  const view=params.get('view')==='models'||params.get('car')?.startsWith('model-')?'models':'offers';try{if(view==='models' || params.get('compare')?.includes('model-'))await ensureModels();}catch{document.querySelector('#catalog-status').textContent='Не удалось загрузить модели. Переключитесь на объявления или повторите попытку.';return;}if(request!==catalogRequest)return;applyView(view);direction.value=['cn','kr','eu'].includes(params.get('from'))?params.get('from'):'cn';
  const type=params.get('type');setActiveType([...document.querySelectorAll('.filter')].some(button=>button.dataset.type===type)?type:'all');
  brandFilter.value=[...brandFilter.options].some(option=>option.value===params.get('brand'))?params.get('brand'):'all';
  country.value=[...country.options].some(option=>option.value===params.get('country'))?params.get('country'):'all';
  sort.value=[...sort.options].some(option=>option.value===params.get('sort'))?params.get('sort'):'newest';
  stateFilter.value=[...stateFilter.options].some(option=>option.value===params.get('status'))?params.get('status'):'unknown';
  for(const [key,input] of limits){const value=params.get(key)||'';input.value=/^\d{1,10}$/.test(value)?value:'';if(!input.validity.valid)input.value='';}
  document.querySelector('#advanced-filters').open=hasLimits();
  if(params.has('compare')){const cap=params.get('wishBudget')||'';comparisonBriefContext={market:['cn','kr','eu'].includes(params.get('wishMarket'))?params.get('wishMarket'):'',budget:/^\d{1,10}$/.test(cap)&&Number(cap)>0&&Number(cap)<=1000000000?Number(cap):null};comparison.clear();const known=new Set([...agentCars,...importModelCars].map(car=>car.record_id));for(const id of params.get('compare').split(',').slice(0,3))if(known.has(id))comparison.add(id);}
  search.value=(params.get('q')||'').slice(0,80);renderCars();if(location.hash==='#request')prefillBriefFromSearch();if(comparison.size && params.has('compare'))openComparison();
  if(catalogView==='models'){sort.value='newest';stateFilter.value='unknown';limits.forEach(([,input])=>input.value='');renderCars();}
  const car=cars.find(item=>item.slug===params.get('car'));
  if(car)openCar(car,false);else{if(dialog.open)dialog.close();if(params.has('car'))document.querySelector('#catalog-status').textContent='Автомобиль по этой ссылке не найден. Выберите другой из каталога.';}
}
limits.forEach(([,input])=>input.addEventListener('input',updateCatalog));
stateFilter.addEventListener('change',updateCatalog);more.addEventListener('click',()=>{shownLimit+=12;renderCars(false);});
brandFilter.addEventListener('change',updateCatalog);country.addEventListener('change',updateCatalog);sort.addEventListener('change',updateCatalog);search.addEventListener('input',updateCatalog);
reset.addEventListener('click',()=>{document.querySelector('#favorites-only').checked=false;setActiveType('all');country.value='all';brandFilter.value='all';sort.value='newest';stateFilter.value='unknown';search.value='';limits.forEach(([,input])=>input.value='');document.querySelector('#advanced-filters').open=false;updateCatalog();search.focus();});
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
calc.addEventListener('submit',event=>{event.preventDefault();calculate();if(budget===null)return;document.querySelector('#lead-message').value=`Хочу обсудить предварительный бюджет ${rubles.format(budget)}. Цена: ${document.querySelector('#car-price').value} ${document.querySelector('#currency').value}; курс: ${document.querySelector('#rate').value} ₽. Логистика: ${document.querySelector('#delivery').value} ₽; услуги: ${document.querySelector('#service').value} ₽; платежи: ${document.querySelector('#duties').value} ₽. Все суммы введены мной и требуют проверки.`;document.querySelector('#request').scrollIntoView();persistBriefDraft();document.querySelector('#lead-message').focus({preventScroll:true});});
const lead = document.querySelector('#lead-form');
lead.addEventListener('submit',async event=>{event.preventDefault();const text=document.querySelector('#lead-message').value.trim();const status=document.querySelector('#lead-status');if(!text){status.textContent='Добавьте модель или пожелания.';document.querySelector('#lead-message').focus();return;}try{await navigator.clipboard.writeText(text);status.textContent='Пожелания скопированы. Их можно использовать в личном обращении. Ничего не отправлено.';}catch{document.querySelector('#lead-message').select();status.textContent='Текст выделен — скопируйте его вручную. Ничего не отправлено.';}});
if('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches){const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');observer.unobserve(entry.target);}}),{threshold:.08});document.querySelectorAll('.reveal').forEach(element=>observer.observe(element));document.documentElement.classList.add('motion-ready');}





// Quick selection uses the same catalogue state and shareable filters.
document.querySelector('#hero-finder').addEventListener('submit',async event=>{event.preventDefault();await switchView('models');if(catalogView!=='models')return;direction.value=document.querySelector('#hero-market').value;search.value=document.querySelector('#hero-query').value.trim();updateCatalog();document.querySelector('#catalog').scrollIntoView();search.focus({preventScroll:true});});
let scrollFrame=0;
function updateScrollEffects(){scrollFrame=0;const max=document.documentElement.scrollHeight-innerHeight;document.querySelector('.reading-progress').style.transform='scaleX('+(max>0?Math.min(1,scrollY/max):0)+')';}
addEventListener('scroll',()=>{if(!scrollFrame)scrollFrame=requestAnimationFrame(updateScrollEffects);},{passive:true});
updateScrollEffects();

const drivingStories=[
 {slug:'porsche-taycan',kicker:'ЭЛЕКТРИЧЕСКИЙ РИТМ',title:'Почувствуйте\nкаждый поворот.',description:'Когда сам маршрут становится причиной отправиться в путь.'},
 {slug:'mercedes-glc',kicker:'МЕСТО ДЛЯ ВАШИХ ПЛАНОВ',title:'Горизонт\nстановится ближе.',description:'Городские будни. Загородные выходные. Планы, которым хочется дать больше пространства.'},
 {slug:'toyota-bz3x',kicker:'ДРУГОЙ ВЗГЛЯД НА ПРИВЫЧНОЕ',title:'Откройте\nновый маршрут.',description:'Знакомые улицы могут ощущаться по-новому. Начните с автомобиля, который вам интересен.'}
];
let storyIndex=0,storyPhotoIndex=0,storyAnimation=null;
const storyImage=document.querySelector('#story-image');
function showDrivingStory(animate=true){
 const story=drivingStories[storyIndex],car=agentCars.find(item=>item.slug===story.slug);if(!car)return;
 const src=car.images[storyPhotoIndex]||car.image;
 storyImage.src=src;storyImage.alt=car.name+' — фотография '+(storyPhotoIndex+1)+' из объявления';
 document.querySelector('#story-kicker').textContent=story.kicker;document.querySelector('#story-title').textContent=story.title;document.querySelector('#story-description').textContent=story.description;
 document.querySelector('#story-car-name').textContent=car.name;
 document.querySelector('#story-source').textContent='Публикация '+car.date+' · '+(statusLabels[car.status]||'Наличие уточняйте');
 document.querySelector('#story-photo-count').textContent=String(storyPhotoIndex+1).padStart(2,'0')+' / '+String(car.images.length).padStart(2,'0');
 document.querySelectorAll('[data-story]').forEach((button,index)=>{button.classList.toggle('active',index===storyIndex);button.setAttribute('aria-pressed',String(index===storyIndex));});
 if(storyAnimation)storyAnimation.cancel();
 if(animate && !matchMedia('(prefers-reduced-motion: reduce)').matches)storyAnimation=storyImage.animate([{opacity:.35,transform:'scale(1.035)'},{opacity:1,transform:'scale(1)'}],{duration:650,easing:'cubic-bezier(.2,.65,.3,1)'});
}
document.querySelectorAll('[data-story]').forEach(button=>button.addEventListener('click',()=>{storyIndex=Number(button.dataset.story);storyPhotoIndex=0;showDrivingStory();}));
document.querySelector('#story-next-photo').addEventListener('click',()=>{const car=agentCars.find(item=>item.slug===drivingStories[storyIndex].slug);storyPhotoIndex=(storyPhotoIndex+1)%car.images.length;showDrivingStory();});
document.querySelector('#story-open').addEventListener('click',()=>{const car=agentCars.find(item=>item.slug===drivingStories[storyIndex].slug);switchView('offers');openCar(car);});
showDrivingStory(false);

function updateSelectionCounts(){document.querySelector('#favorites-count').textContent=favorites.size;document.querySelector('#compare-count').textContent=comparison.size+' / 3';}
function comparisonFields(car){return [['Тип',isModel(car)?'Модель под заказ':'Объявление агентства'],['Кузов',car.body],['Год',isModel(car)?'Выбирается при подборе':car.year],['Пробег',isModel(car)?'Выбирается при подборе':car.mileage],['Двигатель',isModel(car)?'Выбирается при подборе':car.engine],['Стоимость',priceLabel(car)],['Актуальность',isModel(car)?'Поставка требует проверки':'Цена на '+car.priceDate+' · '+statusLabels[car.status]]];}
function renderComparison(){
 const records=[...agentCars,...importModelCars];const selected=[...comparison].map(id=>records.find(car=>car.record_id===id)).filter(Boolean);const panel=document.querySelector('#compare-grid');
 panel.style.gridTemplateColumns='repeat('+Math.max(selected.length,1)+',minmax(0,1fr))';
 const fields=selected.map(comparisonFields);const different=fields[0]?.map((_,row)=>new Set(fields.map(values=>values[row][1])).size>1)||[];
 const filter=document.querySelector('#compare-differences');filter.disabled=selected.length<2;if(filter.disabled)filter.checked=false;
 panel.replaceChildren(...selected.map((car,column)=>{const card=el('article','compare-card');const title=el('h3');const link=el('a','',car.name);link.href=carPage(car);title.append(link);card.append(title);
 const photo=car.image_small||car.example_image;if(photo){const image=el('img','compare-image');image.src=photo;image.alt=car.name+(isModel(car)?' — пример из объявления, версия может отличаться':' — фото из объявления');image.width=480;image.height=320;image.loading='lazy';card.append(image);if(isModel(car))card.append(el('p','example-caption','Фото примера; год и версия могут отличаться.'));}else card.append(el('div','compare-no-photo','Фото конкретной версии пока нет'));
 const spec=el('dl');for(const [row,[label,value]] of fields[column].entries()){const group=el('div','compare-row');group.classList.toggle('different',different[row]);group.hidden=filter.checked&&!different[row];group.append(el('dt','',label),el('dd','',value));spec.append(group);}card.append(spec);
 const remove=el('button','','Убрать из сравнения ×');remove.type='button';remove.addEventListener('click',()=>{comparison.delete(car.record_id);renderComparison();renderCars(false);document.querySelector('#close-compare').focus();});card.append(remove);return card;}));
 const share=new URL(location.href);share.search='';share.searchParams.set('compare',[...comparison].join(','));if(comparisonBriefContext?.market)share.searchParams.set('wishMarket',comparisonBriefContext.market);if(comparisonBriefContext?.budget)share.searchParams.set('wishBudget',comparisonBriefContext.budget);share.hash='catalog';document.querySelector('#compare-share-url').value=comparison.size?share.href:'';
 document.querySelector('#compare-status').textContent=comparison.size?'':'Добавьте до трёх автомобилей кнопкой «Сравнить» в каталоге.';document.querySelector('#copy-selection').disabled=!comparison.size;document.querySelector('#compare-brief').disabled=!comparison.size;
}
function openComparison(){renderComparison();const panel=document.querySelector('#compare-dialog');if(!panel.open)panel.showModal();}
document.querySelector('#favorites-only').addEventListener('change',()=>{renderCars();writeCatalogUrl();});
document.querySelector('#open-compare').addEventListener('click',openComparison);document.querySelector('#close-compare').addEventListener('click',()=>document.querySelector('#compare-dialog').close());
document.querySelector('#copy-selection').addEventListener('click',async()=>{const input=document.querySelector('#compare-share-url');try{await navigator.clipboard.writeText(input.value);document.querySelector('#compare-status').textContent='Ссылка на сравнение скопирована.';}catch{input.focus();input.select();document.querySelector('#compare-status').textContent='Скопируйте выделенную ссылку вручную.';}});

document.querySelector('#compare-dialog').addEventListener('close',()=>{const url=new URL(location.href);for(const key of ['compare','wishMarket','wishBudget'])url.searchParams.delete(key);history.replaceState(history.state,'',url);});

function hideSearchSuggestions(){document.querySelector('#search-suggestions').hidden=true;search.setAttribute('aria-expanded','false');search.removeAttribute('aria-activedescendant');}
function syncSearchSuggestions(){
 document.querySelector('#clear-search').hidden=!search.value;
 const list=document.querySelector('#search-suggestions');const words=normalizeSearch(search.value).split(' ').filter(Boolean);
 if(document.activeElement!==search||!words.length){hideSearchSuggestions();return;}
 const matches=cars.filter(car=>(brandFilter.value==='all'||brandName(car)===brandFilter.value)&&(country.value==='all'||car.country===country.value)&&(activeType==='all'||car.types.includes(activeType))&&(catalogView==='models'||stateFilter.value==='all'||car.status===stateFilter.value)&&(!document.querySelector('#favorites-only').checked||favorites.has(car.record_id))&&matchesLimits(car)&&words.every(word=>normalizeSearch(car.name).replace(/\s/g,'').includes(word.replace(/\s/g,'')))).slice(0,6);
 list.replaceChildren(...matches.map((car,index)=>{const option=el('div','search-option');option.id='search-option-'+index;option.setAttribute('role','option');option.setAttribute('aria-selected','false');option.append(el('span','',car.name),el('small','',isModel(car)?'Модель под заказ':priceLabel(car)));option.addEventListener('pointerdown',event=>event.preventDefault());option.addEventListener('click',()=>chooseSearchSuggestion(car.name));return option;}));
 list.hidden=!matches.length;search.setAttribute('aria-expanded',String(matches.length>0));search.removeAttribute('aria-activedescendant');
}
function chooseSearchSuggestion(name){search.value=name;updateCatalog();hideSearchSuggestions();search.focus({preventScroll:true});}
search.addEventListener('focus',syncSearchSuggestions);search.addEventListener('blur',hideSearchSuggestions);
search.addEventListener('keydown',event=>{const list=document.querySelector('#search-suggestions');if(event.key==='Escape'){hideSearchSuggestions();return;}if(list.hidden)return;const options=[...list.children];let index=options.findIndex(option=>option.id===search.getAttribute('aria-activedescendant'));if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();index=index<0?(event.key==='ArrowDown'?0:options.length-1):(index+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;for(const [i,option] of options.entries())option.setAttribute('aria-selected',String(i===index));search.setAttribute('aria-activedescendant',options[index].id);}if(event.key==='Enter'&&index>=0){event.preventDefault();chooseSearchSuggestion(options[index].querySelector('span').textContent);}});
document.querySelector('#clear-search').addEventListener('click',()=>{search.value='';updateCatalog();search.focus();});
document.querySelector('#compare-differences').addEventListener('change',renderComparison);
document.querySelector('#compare-brief').addEventListener('click',()=>{const records=[...agentCars,...importModelCars];const names=[...comparison].map(id=>records.find(car=>car.record_id===id)?.name).filter(Boolean);document.querySelector('#compare-dialog').close();document.querySelector('#brief-model').value=names.join(', ');delete document.querySelector('#brief-model').dataset.recordId;document.querySelector('#brief-market').value=comparisonBriefContext?.market||'';if(comparisonBriefContext)document.querySelector('#brief-budget').value=comparisonBriefContext.budget??'';document.querySelector('#lead-message').value='Хочу обсудить подборку: '+names.join(', ')+'. Прошу уточнить наличие, состояние, стоимость и подходящие версии.';if(comparisonBriefContext?.market||comparisonBriefContext?.budget)document.querySelector('#compose-brief').click();document.querySelector('#request').scrollIntoView();persistBriefDraft();document.querySelector('#lead-message').focus({preventScroll:true});});
function setGalleryExpanded(expanded){dialog.classList.toggle('gallery-expanded',expanded);const button=document.querySelector('#photo-expand');button.setAttribute('aria-pressed',String(expanded));button.textContent=expanded?'Вернуться к характеристикам ↙':'Увеличить фото ⛶';}
document.querySelector('#photo-expand').addEventListener('click',()=>setGalleryExpanded(!dialog.classList.contains('gallery-expanded')));
document.querySelector('#detail-image').addEventListener('click',()=>{if(selectedCar?.images.length)setGalleryExpanded(!dialog.classList.contains('gallery-expanded'));});
dialog.addEventListener('cancel',event=>{if(dialog.classList.contains('gallery-expanded')){event.preventDefault();setGalleryExpanded(false);document.querySelector('#photo-expand').focus();}});

function renderActiveFilters(){
 const panel=document.querySelector('#active-filters');const chips=[];
 function add(label,clear){const button=el('button','',label+' ×');button.type='button';button.setAttribute('aria-label','Снять фильтр: '+label);button.addEventListener('click',()=>{clear();updateCatalog();document.querySelector('#catalog-status').tabIndex=-1;document.querySelector('#catalog-status').focus({preventScroll:true});});chips.push(button);}
 if(activeType!=='all')add(document.querySelector('.filter.active').textContent,()=>setActiveType('all'));
 if(brandFilter.value!=='all')add('Марка: '+brandFilter.selectedOptions[0].textContent,()=>brandFilter.value='all');
 if(country.value!=='all')add('Страна марки: '+country.selectedOptions[0].textContent,()=>country.value='all');
 if(search.value.trim())add('Поиск: '+search.value.trim(),()=>search.value='');
 if(catalogView==='offers'&&stateFilter.value!=='unknown')add('Статус: '+stateFilter.selectedOptions[0].textContent,()=>stateFilter.value='unknown');
 if(document.querySelector('#favorites-only').checked)add('Избранное',()=>document.querySelector('#favorites-only').checked=false);
 for(const [key,input] of limits){if(input.value!=='')add(({budget:'Бюджет до: ',yearFrom:'Год от: ',kmTo:'Пробег до: '}[key])+input.value+({budget:' ₽',yearFrom:'',kmTo:' км'}[key]),()=>input.value='');}
 panel.replaceChildren(...chips);panel.hidden=!chips.length;
}
function setBriefCar(car){document.querySelector('#brief-model').value=car.name;document.querySelector('#brief-model').dataset.recordId=car.record_id;document.querySelector('#brief-market').value=isModel(car)?direction.value:'';}
document.querySelector('#compose-brief').addEventListener('click',()=>{
 const model=document.querySelector('#brief-model');const market=document.querySelector('#brief-market');const condition=document.querySelector('#brief-condition');const amount=document.querySelector('#brief-budget');
 if(!amount.reportValidity())return;
 const car=[...agentCars,...importModelCars].find(item=>item.record_id===model.dataset.recordId&&item.name===model.value.trim());
 const lines=['Здравствуйте! '+(model.value.trim()?'Интересует подбор: '+model.value.trim()+'.':'Хочу обсудить подбор автомобиля.')];
 if(market.value)lines.push('Планируемое направление: '+marketLabels[market.value]+'.');
 if(condition.value)lines.push('Состояние: '+(condition.value==='new'?'новый автомобиль':'автомобиль с пробегом')+'.');
 if(amount.value)lines.push('Желаемый бюджет до '+priceFormat.format(Number(amount.value))+' ₽. Это мой ориентир, не расчёт стоимости.');
 if(car&&!isModel(car))lines.push('В объявлении на '+car.priceDate+': '+priceLabel(car)+'. Актуальность цены и наличие прошу подтвердить.');
 lines.push('Прошу уточнить доступные версии, возможность поставки и полный состав расходов.');
 if(car)lines.push(new URL(carPage(car),location.href).href);
 document.querySelector('#lead-message').value=lines.join('\n');document.querySelector('#lead-status').textContent='Текст подготовлен. Его можно изменить и скопировать. Ничего не отправлено.';persistBriefDraft();document.querySelector('#lead-message').focus({preventScroll:true});
});

function prefillBriefFromSearch(){const model=document.querySelector('#brief-model');if(!model.value.trim() && search.value.trim()){model.value=search.value.trim();document.querySelector('#brief-market').value=catalogView==='models'?direction.value:'';document.querySelector('.brief-builder').open=true;}}
document.querySelectorAll('a[href="#request"]').forEach(link=>link.addEventListener('click',prefillBriefFromSearch));

function persistBriefDraft(){
 const text=document.querySelector('#lead-message').value.slice(0,1500);const model=document.querySelector('#brief-model');const budget=document.querySelector('#brief-budget');const draft={text,model:model.value.slice(0,150),recordId:model.dataset.recordId||'',market:document.querySelector('#brief-market').value,condition:document.querySelector('#brief-condition').value,budget:budget.validity.valid?budget.value:''};
 try{if(!text&&!draft.model&&!draft.budget)localStorage.removeItem('parallel-brief-draft-v1');else localStorage.setItem('parallel-brief-draft-v1',JSON.stringify(draft));document.querySelector('#draft-status').textContent=text||draft.model?'Черновик сохранён на этом устройстве.':'';}catch{document.querySelector('#draft-status').textContent='Черновик доступен до закрытия страницы: сохранение недоступно.';}
 document.querySelector('#clear-draft').hidden=!text&&!draft.model&&!draft.budget;
}
function restoreBriefDraft(){
 try{const draft=JSON.parse(localStorage.getItem('parallel-brief-draft-v1')||'null');if(!draft||typeof draft!=='object'||Array.isArray(draft))return;
 if(typeof draft.text==='string')document.querySelector('#lead-message').value=draft.text.slice(0,1500);
 if(typeof draft.model==='string')document.querySelector('#brief-model').value=draft.model.slice(0,150);
 if(typeof draft.recordId==='string'&&draft.recordId.length<150)document.querySelector('#brief-model').dataset.recordId=draft.recordId;
 document.querySelector('#brief-market').value=['cn','kr','eu'].includes(draft.market)?draft.market:'';
 document.querySelector('#brief-condition').value=['new','used'].includes(draft.condition)?draft.condition:'';
 const amount=String(draft.budget??'');document.querySelector('#brief-budget').value=/^\d{1,10}$/.test(amount)&&Number(amount)>0&&Number(amount)<=1000000000?amount:'';
 if(document.querySelector('#lead-message').value||document.querySelector('#brief-model').value){document.querySelector('#draft-status').textContent='Восстановлен черновик с этого устройства.';document.querySelector('#clear-draft').hidden=false;}
 }catch{}
}
restoreBriefDraft();
let briefSaveTimer;
document.querySelector('#lead-form').addEventListener('input',()=>{clearTimeout(briefSaveTimer);briefSaveTimer=setTimeout(persistBriefDraft,350);});
document.querySelector('#lead-form').addEventListener('change',persistBriefDraft);
document.querySelector('#clear-draft').addEventListener('click',()=>{clearTimeout(briefSaveTimer);document.querySelector('#lead-message').value='';document.querySelector('#brief-model').value='';delete document.querySelector('#brief-model').dataset.recordId;for(const id of ['brief-budget','brief-market','brief-condition'])document.getElementById(id).value='';try{localStorage.removeItem('parallel-brief-draft-v1');}catch{}document.querySelector('#draft-status').textContent='Черновик удалён.';document.querySelector('#clear-draft').hidden=true;document.querySelector('#lead-status').textContent='';document.querySelector('#lead-message').focus();});
addEventListener('pagehide',()=>{if(briefSaveTimer){clearTimeout(briefSaveTimer);persistBriefDraft();}});
