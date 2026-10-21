import {legacyDestination} from './site-routing.mjs';
if(document.body.dataset.page==='home'){const target=legacyDestination(location.href,document.baseURI);if(target)location.replace(target);}
const toggle=document.querySelector('.menu-toggle'),nav=document.getElementById('navigation');
function closeMenu(){nav.classList.remove('open');toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-label','Открыть меню');}
toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';nav.classList.toggle('open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',open?'Закрыть меню':'Открыть меню');});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){closeMenu();toggle.focus();}});
nav.addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
matchMedia('(max-width:760px)').addEventListener('change',closeMenu);
document.querySelectorAll('.reveal').forEach(element=>element.classList.add('visible'));
const $=id=>document.getElementById(id),draftKey='parallel-contact-draft-v1';
if($('lead-form')){
 const message=$('lead-message'),draftStatus=$('draft-status'),clear=$('clear-draft');
 function persist(){try{if(message.value)localStorage.setItem(draftKey,message.value);else localStorage.removeItem(draftKey);draftStatus.textContent=message.value?'Черновик сохранён на этом устройстве.':'';}catch{draftStatus.textContent='Черновик не удалось сохранить.';}clear.hidden=!message.value;}
 try{message.value=(localStorage.getItem(draftKey)||'').slice(0,1500);if(!message.value){const previous=JSON.parse(localStorage.getItem('parallel-brief-draft-v1')||'null');if(previous&&typeof previous==='object'){message.value=String(previous.text||'').slice(0,1500);for(const [key,id] of [['model','brief-model'],['market','brief-market'],['condition','brief-condition'],['budget','brief-budget']]){if(typeof previous[key]==='string')$(id).value=previous[key].slice(0,150);}}}}catch{}clear.hidden=!message.value;
 try{const budget=sessionStorage.getItem('parallel-budget-brief-v1');if(budget){message.value=budget.slice(0,1500);sessionStorage.removeItem('parallel-budget-brief-v1');persist();}}catch{}
 message.addEventListener('input',persist);clear.addEventListener('click',()=>{message.value='';for(const id of ['brief-model','brief-market','brief-condition','brief-budget'])$(id).value='';try{localStorage.removeItem('parallel-brief-draft-v1');}catch{}persist();message.focus();});
 $('compose-brief').addEventListener('click',()=>{const amount=$('brief-budget');if(!amount.checkValidity()){amount.reportValidity();return;}message.value=['Здравствуйте! Ищу автомобиль.',$('brief-model').value.trim(),$('brief-market').value?'Направление: '+$('brief-market').selectedOptions[0].textContent:'',$('brief-condition').value?'Состояние: '+$('brief-condition').selectedOptions[0].textContent:'',amount.value?'Бюджет на весь заказ: до '+new Intl.NumberFormat('ru-RU').format(Number(amount.value))+' ₽.':'','Прошу уточнить наличие, возможность ввоза и полную стоимость.'].filter(Boolean).join('\n');persist();message.focus();});
 $('lead-form').addEventListener('submit',async event=>{event.preventDefault();if(!message.value.trim()){$('lead-status').textContent='Сначала напишите пожелания.';message.focus();return;}try{await navigator.clipboard.writeText(message.value);$('lead-status').textContent='Текст скопирован. Отправьте его при личном обращении. Автоматически ничего не отправлено.';}catch{message.focus();message.select();$('lead-status').textContent='Текст выделен. Скопируйте его вручную.';}});
}
if($('calc-form')){
 const ids=['car-price','rate','delivery','service','duties'];
 const queryParams=new URL(location.href).searchParams;
 if(queryParams.get('price'))$('car-price').value=queryParams.get('price');
 if(queryParams.get('currency')&&$('currency'))$('currency').value=queryParams.get('currency');
 const carName=queryParams.get('name');
 if(carName){
  const notice=document.createElement('p');
  notice.className='field-note';
  notice.id='calc-car-name';
  notice.textContent='Расчёт для выбранного автомобиля: '+carName;
  $('calc-form').prepend(notice);
 }
 function calculate(){const inputs=ids.map($);if(inputs.some(input=>input.value===''||!input.checkValidity())){$('total').textContent='— ₽';$('calc-status').textContent='Заполните все расходы и курс корректными числами.';return null;}const [price,rate,delivery,service,duties]=inputs.map(input=>Number(input.value)),total=price*rate+delivery+service+duties;if(!Number.isFinite(total)||total>Number.MAX_SAFE_INTEGER){$('total').textContent='— ₽';$('calc-status').textContent='Сумма слишком велика. Проверьте значения.';return null;}$('total').textContent=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(total)+' ₽';$('calc-status').textContent='Сумма по вашим данным. Не является таможенным расчётом.';return total;}
 $('calc-form').addEventListener('input',calculate);
 $('currency')?.addEventListener('change',()=>{const rate=$('rate');if(rate)rate.value='';calculate();});
 $('calc-form').addEventListener('submit',event=>{event.preventDefault();const total=calculate();if(total===null)return;const header=carName?'Здравствуйте! Хочу обсудить бюджет автомобиля ('+carName+').':'Здравствуйте! Хочу обсудить бюджет автомобиля.';const text=header+'\nЦена: '+$('car-price').value+' '+$('currency').value+'; мой курс: '+$('rate').value+' ₽.\nЛогистика: '+$('delivery').value+' ₽; услуги: '+$('service').value+' ₽; обязательные платежи: '+$('duties').value+' ₽.\nПредварительный итог по моим данным: '+Math.round(total)+' ₽. Прошу проверить все расходы.';try{sessionStorage.setItem('parallel-budget-brief-v1',text);}catch{}location.href=new URL('contacts/#request',document.baseURI);});
}
