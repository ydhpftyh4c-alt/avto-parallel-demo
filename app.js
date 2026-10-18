'use strict';
const cars = catalogCars;
let activeType = 'all';
const grid = document.querySelector('#car-grid');
const country = document.querySelector('#country');
const search = document.querySelector('#catalog-search');
const sort = document.querySelector('#catalog-sort');
const reset = document.querySelector('#catalog-reset');
const aliases = {'тойота':'toyota','порше':'porsche','порш':'porsche','фольксваген':'volkswagen','фольц':'volkswagen','джетта':'jetta','бмв':'bmw','мерседес':'mercedes','киа':'kia','мазда':'mazda','тайкан':'taycan','оптима':'optima','киюань':'qiyuan'};
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
function priceLabel(car){return car.pricePrefix + priceFormat.format(car.price) + ' ₽';}
function renderCars(){
  const words=normalizeSearch(search.value).split(' ').filter(Boolean);
  const visible = cars.filter(car => (activeType === 'all' || car.types.includes(activeType)) && (country.value === 'all' || car.country === country.value) && words.every(word=>normalizeSearch(car.name).replace(/\s/g,'').includes(word.replace(/\s/g,''))));
  visible.sort((a,b)=>sort.value==='price-asc'?a.price-b.price:sort.value==='price-desc'?b.price-a.price:dateValue(b.date).localeCompare(dateValue(a.date)) || b.id-a.id);
  grid.replaceChildren(...visible.map(car => {
    const article = el('article','car');
    const visual = el('div','car-visual');
    const image = el('img');
    image.src=car.image; image.alt=car.name+' — фотография из объявления'; image.width=720; image.height=480; image.loading='lazy'; image.decoding='async';
    visual.append(image,el('span','car-tag','ПУБЛИКАЦИЯ '+car.date));
    const data=el('div','car-data');
    data.append(el('p','car-meta',car.body+' / '+car.year),el('h3','',car.name),el('p','car-mileage',car.mileage));
    const bottom=el('div','car-bottom');
    const price=el('div','');price.append(el('strong','car-price',priceLabel(car)),el('small','price-date','Цена на '+car.priceDate));
    const button=el('button','','↗');button.type='button';button.setAttribute('aria-label','Подробнее о '+car.name);button.addEventListener('click',()=>openCar(car));
    bottom.append(price,button);data.append(bottom);article.append(visual,data);return article;
  }));
  document.querySelector('#empty').hidden = visible.length > 0;
  document.querySelector('#catalog-status').textContent = `Показано ${visible.length} из ${cars.length} автомобилей`;
  reset.hidden=activeType==='all' && country.value==='all' && !search.value && sort.value==='newest';
}
function renderPhoto(){
  const image=document.querySelector('#detail-image');
  image.src=selectedCar.images[photoIndex];image.alt=selectedCar.name+' — фото '+(photoIndex+1)+' из '+selectedCar.images.length;
  document.querySelector('#photo-counter').textContent=(photoIndex+1)+' / '+selectedCar.images.length;
}
function openCar(car, writeHistory = true){
  selectedCar=car;photoIndex=0;
  document.querySelector('#detail-title').textContent=car.name;
  document.querySelector('#detail-meta').textContent=car.body+' · '+car.year;
  document.querySelector('#detail-price').textContent=priceLabel(car);
  document.querySelector('#detail-price-date').textContent='Цена из канала на '+car.priceDate+' · наличие уточняйте';
  document.querySelector('#detail-price-note').textContent=car.priceNote;
  const specs=document.querySelector('#detail-specs');specs.replaceChildren();
  for(const [label,value] of [['Год',car.year],['Пробег',car.mileage],['Двигатель',car.engine]]){specs.append(el('dt','',label),el('dd','',value));}
  document.querySelector('#detail-features').replaceChildren(...car.features.map(text=>el('li','',text)));
  document.querySelector('#detail-description').textContent=car.description;
  document.querySelector('#detail-source').textContent='Источник: объявление №'+car.id+' от '+car.date+'. Характеристики указаны продавцом и не являются результатом независимой проверки.';
  if(writeHistory){const url=new URL(location.href);url.searchParams.set('car',car.slug);url.hash='catalog';history.pushState({avtoDialog:true},'',url);}
  const shareUrl=new URL(location.href);shareUrl.search='';shareUrl.searchParams.set('car',car.slug);shareUrl.hash='catalog';
  document.querySelector('#car-share-url').value=shareUrl.href;
  document.querySelector('#share-status').textContent='';
  renderPhoto();if(!dialog.open)dialog.showModal();document.body.classList.add('dialog-open');
}
function movePhoto(direction){if(!selectedCar)return;photoIndex=(photoIndex+direction+selectedCar.images.length)%selectedCar.images.length;renderPhoto();}
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
document.querySelector('#detail-select').addEventListener('click',()=>{const car=selectedCar;dialog.close();document.querySelector('#lead-message').value=`Интересует ${car.name}. Цена в объявлении на ${car.priceDate}: ${priceLabel(car)}. Прошу уточнить наличие и актуальные условия.`;document.querySelector('#request').scrollIntoView();document.querySelector('#lead-form input').focus({preventScroll:true});});
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{
  activeType=button.dataset.type;
  document.querySelectorAll('.filter').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-pressed',String(item===button));});updateCatalog();
}));
function setActiveType(value){
  activeType=value;document.querySelectorAll('.filter').forEach(button=>{const active=button.dataset.type===value;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
}
function writeCatalogUrl(){
  const url=new URL(location.href);
  for(const [key,value,defaultValue] of [['q',search.value.trim(),''],['type',activeType,'all'],['country',country.value,'all'],['sort',sort.value,'newest']]){if(value===defaultValue)url.searchParams.delete(key);else url.searchParams.set(key,value);}
  history.replaceState(history.state,'',url);
}
function updateCatalog(){renderCars();writeCatalogUrl();}
function restoreCatalog(){
  const params=new URL(location.href).searchParams;
  const type=params.get('type');setActiveType([...document.querySelectorAll('.filter')].some(button=>button.dataset.type===type)?type:'all');
  country.value=[...country.options].some(option=>option.value===params.get('country'))?params.get('country'):'all';
  sort.value=[...sort.options].some(option=>option.value===params.get('sort'))?params.get('sort'):'newest';
  search.value=(params.get('q')||'').slice(0,80);renderCars();
  const car=cars.find(item=>item.slug===params.get('car'));
  if(car)openCar(car,false);else{if(dialog.open)dialog.close();if(params.has('car'))document.querySelector('#catalog-status').textContent='Автомобиль по этой ссылке не найден. Выберите другой из каталога.';}
}
country.addEventListener('change',updateCatalog);sort.addEventListener('change',updateCatalog);search.addEventListener('input',updateCatalog);
reset.addEventListener('click',()=>{setActiveType('all');country.value='all';sort.value='newest';search.value='';updateCatalog();search.focus();});
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



