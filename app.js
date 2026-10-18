'use strict';
const cars = [
  {name:'Porsche 911',type:'coupe',country:'de',body:'Купе',category:'Для удовольствия',image:'sport.jpg'},
  {name:'BMW X5',type:'suv',country:'de',body:'Кроссовер',category:'Для больших планов',image:'suv.jpg'},
  {name:'Zeekr 001',type:'electric',country:'cn',body:'Электромобиль',category:'Новая энергия',image:'electric.jpg'},
  {name:'Toyota Camry',type:'sedan',country:'jp',body:'Седан',category:'Каждый день',image:'sedan.jpg'},
  {name:'Li Auto L7',type:'suv',country:'cn',body:'Кроссовер',category:'Больше пространства',image:'family.jpg'},
  {name:'Porsche Taycan',type:'electric',country:'de',body:'Электромобиль',category:'Другой импульс',image:'touring.jpg'}
];
let activeType = 'all';
const grid = document.querySelector('#car-grid');
const country = document.querySelector('#country');
function renderCars(){
  const visible = cars.filter(car => (activeType === 'all' || car.type === activeType) && (country.value === 'all' || car.country === country.value));
  grid.replaceChildren(...visible.map(car => {
    const article = document.createElement('article');
    article.className = 'car';
    article.innerHTML = `<div class="car-visual"><img src="assets/${car.image}" alt="Иллюстрация автомобильной категории; не фото конкретного предложения" width="640" height="430" loading="lazy" decoding="async"><span class="car-tag">${car.category}</span></div><div class="car-data"><p class="car-meta">${car.body} / ДЕМО-МОДЕЛЬ</p><h3>${car.name}</h3><div class="car-bottom"><span>Стоимость — по запросу</span><button type="button" aria-label="Выбрать ${car.name}">↗</button></div></div>`;
    article.querySelector('button').addEventListener('click',()=>{
      document.querySelector('#lead-message').value = `Интересует ${car.name}. Хочу обсудить возможность подбора и импорта.`;
      document.querySelector('#request').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
      document.querySelector('#lead-form input').focus({preventScroll:true});
    });
    return article;
  }));
  document.querySelector('#empty').hidden = visible.length > 0;
  document.querySelector('#catalog-status').textContent = `Показано моделей: ${visible.length}`;
}
document.querySelectorAll('.filter').forEach(button=>button.addEventListener('click',()=>{
  activeType = button.dataset.type;
  document.querySelectorAll('.filter').forEach(item=>{item.classList.toggle('active',item===button);item.setAttribute('aria-pressed',String(item===button));});
  renderCars();
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

