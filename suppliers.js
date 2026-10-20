import {identifyListing,makeSupplierBrief} from './supplier-engine.mjs?v=20261020-5';
const panel=document.getElementById('supplier-catalog');
const form=document.getElementById('supplier-form');
const brand=document.getElementById('supplier-brand'),model=document.getElementById('supplier-model'),provider=document.getElementById('supplier-provider');
const status=document.getElementById('supplier-status'),referenceStatus=document.getElementById('supplier-reference-status');
let reference,loading;
function option(value,label){const el=document.createElement('option');el.value=value;el.textContent=label;return el;}
async function loadReference(){
 if(loading)return loading;
 loading=(async()=>{
  referenceStatus.textContent='Загружаем справочник марок…';
  try{
   const response=await fetch('data/import/reference/mobile-de.json?v=20261020-5');if(!response.ok)throw Error('Reference fetch failed');
   reference=await response.json();if(!Array.isArray(reference.brands))throw Error('Invalid reference');
   for(const item of [...reference.brands].sort((a,b)=>a.name.localeCompare(b.name)))brand.append(option(item.id,item.name));
   brand.disabled=false;
   const count=reference.brands.reduce((sum,item)=>sum+item.models.length,0);
   referenceStatus.textContent=`${reference.brands.length} марок · ${count.toLocaleString('ru-RU')} названий моделей. Справочник mobile.de от ${new Date(reference.checked_at).toLocaleDateString('ru-RU')}. Это не объявления и не подтверждение возможности ввоза.`;
  }catch{referenceStatus.textContent='Справочник сейчас не загрузился. Можно вставить ссылку на объявление или повторить загрузку.';loading=null;document.getElementById('supplier-retry').hidden=false;}
 })();return loading;
}
panel.addEventListener('toggle',()=>{if(panel.open)loadReference();});
document.getElementById('supplier-retry').addEventListener('click',event=>{event.currentTarget.hidden=true;loadReference();});
brand.addEventListener('change',()=>{
 model.replaceChildren(option('','Выберите модель'));
 const selected=reference?.brands.find(item=>item.id===brand.value);
 for(const item of selected?.models||[])model.append(option(item.id,item.name));
 model.disabled=!selected?.models.length;status.textContent='';
});
const link=document.getElementById('supplier-link');
link.addEventListener('change',()=>{link.setCustomValidity('');if(!link.value.trim())return;try{const match=identifyListing(link.value);provider.value=match.provider.id;status.textContent='Площадка определена: '+match.provider.name+'. Данные объявления ещё не проверены.';}catch(error){link.setCustomValidity(error.message);status.textContent=error.message;}});
link.addEventListener('input',()=>link.setCustomValidity(''));
form.addEventListener('submit',event=>{
 event.preventDefault();status.textContent='';
 try{
  const selected=reference?.brands.find(item=>item.id===brand.value),selectedModel=selected?.models.find(item=>item.id===model.value);
  const name=selectedModel?[selected.name,selectedModel.name].join(' '):'';
  const result=makeSupplierBrief({providerId:provider.value,model:name,link:link.value.trim(),budget:document.getElementById('supplier-budget').value});
  document.getElementById('lead-message').value=result.text;
  const briefModel=document.getElementById('brief-model');briefModel.value=name;delete briefModel.dataset.recordId;
  document.getElementById('brief-market').value=result.provider.market;
  document.getElementById('brief-budget').value=document.getElementById('supplier-budget').value;
  document.getElementById('brief-condition').value='';
  document.getElementById('lead-message').dispatchEvent(new Event('input',{bubbles:true}));
  document.getElementById('lead-status').textContent='Запрос подготовлен. Проверьте текст и скопируйте для обсуждения. Ничего не отправлено.';
  document.getElementById('request').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  document.getElementById('lead-message').focus({preventScroll:true});
 }catch(error){status.textContent=error.message;}
});
if(location.hash==='#supplier-catalog'){panel.open=true;loadReference();}
