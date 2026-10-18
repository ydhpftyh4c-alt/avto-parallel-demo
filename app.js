'use strict';
const cars = catalogCars;
let activeType = 'all';
const grid = document.querySelector('#car-grid');
const country = document.querySelector('#country');
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
  const visible = cars.filter(car => (activeType === 'all' || car.types.includes(activeType)) && (country.value === 'all' || car.country === country.value));
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
  document.querySelector('#catalog-status').textContent = `Показано автомобилей: ${visible.length}`;
}
function renderPhoto(){
  const image=document.querySelector('#detail-image');
  image.src=selectedCar.images[photoIndex];image.alt=selectedCar.name+' — фото '+(photoIndex+1)+' из '+selectedCar.images.length;
  document.querySelector('#photo-counter').textContent=(photoIndex+1)+' / '+selectedCar.images.length;
}
function openCar(car){
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
  renderPhoto();dialog.showModal();document.body.classList.add('dialog-open');
}
function movePhoto(direction){if(!selectedCar)return;photoIndex=(photoIndex+direction+selectedCar.images.length)%selectedCar.images.length;renderPhoto();}
document.querySelector('#photo-prev').addEventListener('click',()=>movePhoto(-1));
document.querySelector('#photo-next').addEventListener('click',()=>movePhoto(1));
dialog.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>document.body.classList.remove('dialog-open'));
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
dialog.addEventListener('keydown',event=>{if(event.target.matches('input,textarea,select'))return;if(event.key==='ArrowLeft'){event.preventDefault();movePhoto(-1);}if(event.key==='ArrowRight'){event.preventDefault();movePhoto(1);}});
document.querySelector('#detail-select').addEventListener('click',()=>{const car=selectedCar;dialog.close();document.querySelector('#lead-message').value=`Интересует ${car.name}. Цена в объявлении на ${car.priceDate}: ${priceLabel(car)}. Прошу уточнить наличие и актуальные условия.`;document.querySelector('#request').scrollIntoView();document.querySelector('#lead-form input').focus({preventScroll:true});});
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{
  activeType=button.dataset.type;
  document.querySelectorAll('.filter').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-pressed',String(item===button));});renderCars();
}));
country.addEventListener('change',renderCars);
renderCars();
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


