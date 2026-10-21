import {photoPresenter} from './photo-transition.mjs?v=20261021-photos-1';
import {recentKey,rememberViewed} from './buyer-discovery.mjs?v=20261021-discovery-1';
import {sourceImage,listingBrief} from '../order-engine.mjs?v=20261021-discovery-1';
import {vehiclePrice,vehicleFacts,vehicleBackHref} from './vehicle-page-data.mjs?v=20261021-discovery-1';
import {normalizeBuyerNeeds,buyerNeedsBrief} from './buyer-needs.mjs?v=20261021-discovery-1';
const $=id=>document.getElementById(id),params=new URL(location.href).searchParams,id=params.get('id'),root=new URL(location.pathname.replace(/\/cars\/vehicle\/?$/,'')+'/',location.origin),savedKey='parallel-order-selection-v1';
let car=null,paths=[],photo=0,loading=false;const failed=new Set();
const mainPhoto=photoPresenter($('car-photo')),largePhoto=photoPresenter($('car-lightbox-image'));let photoRevision=0;
$('car-back').href=$('car-back-bottom').href=vehicleBackHref(params.get('back')||'');
function node(tag,text){const element=document.createElement(tag);if(text!==undefined)element.textContent=text;return element;}
function imageUrl(path,width=960){const url=sourceImage(path,width);return url==='assets/import-model.svg'?null:new URL(url,root).href;}
function savedCars(){try{const value=JSON.parse(localStorage.getItem(savedKey)||'[]');return new Set(Array.isArray(value)?value.filter(item=>typeof item==='string').slice(0,5):[]);}catch{return new Set();}}
function updateSave(){const selected=savedCars().has(car.id);$('car-save').setAttribute('aria-pressed',String(selected));$('car-save').textContent=selected?'Убрать из подборки':'Добавить в подборку';}
function syncLightbox(){
 $('car-expand').disabled=false;
 if(!$('car-lightbox').open)return;
 const path=paths[photo];if(!path)return;largePhoto.show(imageUrl(path),car.name+' — фото '+(photo+1));
 $('car-lightbox-count').textContent=(photo+1)+' / '+paths.length;
 $('car-lightbox-prev').disabled=$('car-lightbox-next').disabled=paths.length<2;
}
async function renderPhoto(){
 const revision=++photoRevision;
 const focusedThumb=$('car-thumbnails').contains(document.activeElement);
 paths=car.images.filter(path=>!failed.has(path)&&imageUrl(path));const image=$('car-photo');
 if(!paths.length){mainPhoto.reset();$('car-expand').disabled=true;if($('car-lightbox').open)$('car-lightbox').close();$('car-no-photo').hidden=false;$('car-prev').disabled=$('car-next').disabled=true;$('car-photo-count').textContent='Нет доступных фото';$('car-thumbnails').replaceChildren();return;}
 photo=((photo%paths.length)+paths.length)%paths.length;const path=paths[photo];$('car-no-photo').hidden=true;$('car-photo-count').textContent='Загружаем фото…';const outcome=await mainPhoto.show(imageUrl(path),car.name+' — фото '+(photo+1));if(revision!==photoRevision||outcome==='stale')return;if(outcome==='failed'){failed.add(path);renderPhoto();return;}mainPhoto.warm([imageUrl(paths[(photo+1)%paths.length]),imageUrl(paths[(photo+paths.length-1)%paths.length])]);syncLightbox();$('car-photo-count').textContent=(photo+1)+' / '+paths.length;$('car-prev').disabled=$('car-next').disabled=paths.length<2;
 $('car-thumbnails').replaceChildren(...paths.map((path,index)=>{const button=node('button');button.type='button';button.setAttribute('aria-label','Фото '+(index+1)+' из '+paths.length);button.setAttribute('aria-pressed',String(index===photo));const thumb=node('img');thumb.src=imageUrl(path,160);thumb.alt='';thumb.width=88;thumb.height=64;thumb.loading='lazy';thumb.decoding='async';thumb.referrerPolicy='no-referrer';thumb.onerror=()=>{thumb.hidden=true;};button.append(thumb);button.addEventListener('click',()=>{photo=index;renderPhoto();const replacement=$('car-thumbnails').children[index];replacement?.focus({preventScroll:true});});return button;}));if(focusedThumb)$('car-thumbnails').children[photo]?.focus({preventScroll:true});
}
function render(){
 try{localStorage.setItem(recentKey,JSON.stringify(rememberViewed(JSON.parse(localStorage.getItem(recentKey)||'[]'),car.id)));}catch{}$('car-mobile-price').textContent=vehiclePrice(car);
 document.title=car.name+' — Авто || ПараLLель';$('car-title').textContent=car.name;$('car-source').textContent=car.category==='agency'?'Объявление Авто || ПараLLель':car.provider_name+' · под заказ';$('car-summary').textContent=[car.year?car.year+' г.':'Год не указан',car.mileage_km!==null&&car.mileage_km!==undefined?new Intl.NumberFormat('ru-RU').format(car.mileage_km)+' км':'Пробег не указан',car.fuel].filter(Boolean).join(' · ');$('car-price').textContent=vehiclePrice(car);
 $('car-price-note').textContent=car.category==='agency'?'Цена из публикации агентства'+(car.price_date?' на '+car.price_date:'')+'. Состав расходов и актуальную сумму уточняйте.':'Цена зарубежного продавца. Доставка, пошлины, утильсбор и услуги агентства рассчитываются отдельно.';
 const status=car.status==='sold'?'В объявлении есть отметка о продаже.':car.status==='reserved'?'В объявлении есть отметка о бронировании.':'Наличие требует подтверждения.';const observed=new Date(car.observed_at);$('car-availability').textContent=status+' '+(Number.isNaN(observed.getTime())?'Дата загрузки не указана.':'Сохранённые данные от '+observed.toLocaleDateString('ru-RU')+'.');
 $('car-specs').replaceChildren(...vehicleFacts(car).flatMap(([label,value])=>[node('dt',label),node('dd',value)]));$('car-description').textContent=car.description||'';$('car-description-section').hidden=!car.description;
 try{const original=new URL(car.source_url);if(['http:','https:'].includes(original.protocol)){$('car-original').href=original.href;$('car-original').hidden=false;}}catch{}
 let brief=listingBrief([car]);try{const back=new URLSearchParams(params.get('back')||'');const needs=normalizeBuyerNeeds({budget:back.get('budgetWish'),body:back.get('body'),year:back.get('year'),mileage:back.get('mileage')});if(needs.budget!==null){brief+='\n\n'+buyerNeedsBrief(needs,{q:back.get('q'),brand:back.get('brand')});$('car-budget-note').textContent='В запрос добавлен ваш бюджет на весь заказ. Соответствие автомобиля этому бюджету пока не подтверждено.';$('car-budget-note').hidden=false;}}catch{}
  $('car-brief').value=brief;updateSave();
  if($('car-calc-link')){if(car.price){$('car-calc-link').href='../../budget/?price='+encodeURIComponent(car.price)+'&currency='+encodeURIComponent(car.currency||'USD')+'&name='+encodeURIComponent(car.name)+'#calculator';$('car-calc-link').hidden=false;}else{$('car-calc-link').hidden=true;}}
  renderPhoto();$('car-content').hidden=false;$('car-mobile-action').hidden=false;$('car-loading').hidden=true;
}
function shardKey(val){return(String(val).split('').reduce((a,c)=>(a*31+c.charCodeAt(0))>>>0,0)%64).toString(16).padStart(2,'0');}
async function load(){if(loading)return;loading=true;$('car-error').hidden=true;$('car-loading').hidden=false;
 try{if(!id||id.length>150)throw Error('В ссылке нет корректного номера объявления. Выберите автомобиль в каталоге.');
 let cached;try{cached=JSON.parse(sessionStorage.getItem('parallel-car-preview-v1')||'null');}catch{}
 if(cached?.car?.id===id&&Date.now()-cached.at>=0&&Date.now()-cached.at<300000&&Array.isArray(cached.car.images)&&cached.car.images.length){car=cached.car;}else{
   try{
     const key=shardKey(id),shardRes=await fetch(new URL('data/records/shard-'+key+'.json',root),{cache:'no-cache',signal:AbortSignal.timeout(8000)});
     if(shardRes.ok){const shardMap=await shardRes.json(),found=shardMap[id];if(found&&Array.isArray(found.images)&&found.images.length)car=found;}
   }catch{}
   if(!car){
     const response=await fetch(new URL('order-catalog.json',root),{cache:'no-cache',signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Каталог временно недоступен. Повторите загрузку или свяжитесь с агентством.');const data=await response.json();car=data.listings?.find(item=>item.id===id&&item.images?.length);if(!car)throw Error('Объявление отсутствует в текущем каталоге. Оно могло быть снято с публикации. Вернитесь к выбору автомобилей.');
   }
 }
 render();
 }catch(error){$('car-loading').hidden=true;$('car-content').hidden=true;$('car-mobile-action').hidden=true;$('car-error').hidden=false;$('car-error-message').textContent=error instanceof TypeError||error.name==='TimeoutError'?'Не удалось загрузить данные. Проверьте подключение и повторите попытку.':error.message;}finally{loading=false;}
}
$('car-photo-retry').addEventListener('click',()=>{failed.clear();photo=0;renderPhoto();});
$('car-retry').addEventListener('click',load);$('car-prev').addEventListener('click',()=>{photo--;renderPhoto();});$('car-next').addEventListener('click',()=>{photo++;renderPhoto();});$('car-gallery').addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();photo+=event.key==='ArrowLeft'?-1:1;renderPhoto();}});
$('car-save').addEventListener('click',()=>{const saved=savedCars();if(saved.has(car.id))saved.delete(car.id);else if(saved.size<5)saved.add(car.id);else{$('car-action-status').textContent='В подборке уже пять машин. Уберите одну в каталоге, чтобы добавить эту.';return;}try{localStorage.setItem(savedKey,JSON.stringify([...saved]));updateSave();$('car-action-status').textContent=saved.has(car.id)?'Добавлено. Машина появится в вашей подборке в каталоге.':'Убрано из подборки.';}catch{$('car-action-status').textContent='Хранилище браузера недоступно. Не удалось сохранить подборку.';}});
window.addEventListener('storage',event=>{if(event.key===savedKey&&car)updateSave();});
window.addEventListener('pageshow',event=>{if(event.persisted&&car)updateSave();});
$('car-share').addEventListener('click',async()=>{const url=new URL(location.href);url.search='';url.searchParams.set('id',car.id);url.hash='';if(typeof navigator.share==='function'){try{await navigator.share({title:car.name+' — Авто || ПараLLель',text:car.name+' — объявление в Авто || ПараLLель',url:url.href});$('car-action-status').textContent='Ссылка отправлена.';return;}catch(err){if(err.name==='AbortError')return;}}try{await navigator.clipboard.writeText(url.href);$('car-action-status').textContent='Ссылка на автомобиль скопирована.';}catch{$('car-action-status').textContent='Скопируйте ссылку вручную: '+url.href;}});
$('car-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('car-brief').value);$('car-copy-status').textContent='Запрос скопирован. Отправьте его при личном обращении. Автоматически ничего не отправлено.';}catch{$('car-brief').focus();$('car-brief').select();$('car-copy-status').textContent='Текст выделен. Скопируйте его вручную.';}});
$('car-expand').addEventListener('click',()=>{if(!paths.length)return;$('car-lightbox').showModal();syncLightbox();});
$('car-lightbox-close').addEventListener('click',()=>$('car-lightbox').close());
$('car-lightbox').addEventListener('click',event=>{if(event.target===$('car-lightbox')){const rect=$('car-lightbox').getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)$('car-lightbox').close();}});
$('car-lightbox').addEventListener('close',()=>{largePhoto.reset();$('car-expand').focus({preventScroll:true});});
$('car-lightbox-prev').addEventListener('click',()=>{photo--;renderPhoto();});
$('car-lightbox-next').addEventListener('click',()=>{photo++;renderPhoto();});
$('car-lightbox').addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();photo+=event.key==='ArrowLeft'?-1:1;renderPhoto();}});
load();
