// A bounded decoded-image cache shared by the galleries on this page.
const cache=new Map();
export function preloadPhoto(url){
 if(cache.has(url))return cache.get(url);
 const promise=new Promise((resolve,reject)=>{
  const image=new Image();image.referrerPolicy='no-referrer';image.decoding='async';
  const timer=setTimeout(()=>finish(new Error('Photo load timed out')),15000);
  function finish(error){clearTimeout(timer);image.onload=image.onerror=null;if(error)reject(error);else resolve(image);}
  image.onerror=()=>finish(new Error('Photo unavailable'));
  image.onload=async()=>{try{await image.decode();finish();}catch(error){finish(error);}};
  image.src=url;
 });
 cache.set(url,promise);promise.catch(()=>{if(cache.get(url)===promise)cache.delete(url);});
 while(cache.size>20)cache.delete(cache.keys().next().value);
 return promise;
}
// Latest navigation wins, even if an earlier image finishes loading later.
export function photoSequence({load=preloadPhoto,commit,busy=()=>{}}){
 let revision=0;
 return {cancel(){revision++;busy(false);},async show(url,alt){
  const ticket=++revision;busy(true);
  try{await load(url);if(ticket!==revision)return 'stale';commit(url,alt);return 'shown';}
  catch{ return ticket===revision?'failed':'stale'; }
  finally{if(ticket===revision)busy(false);}
 }};
}
export function photoPresenter(image){
 const stage=document.createElement('div');stage.className='photo-swap-stage';image.before(stage);stage.append(image);if(!image.getAttribute('src'))image.hidden=true;
 const hint=document.createElement('span');hint.className='photo-load-hint';hint.textContent='Загружаем фото…';hint.setAttribute('role','status');hint.hidden=true;stage.append(hint);
 let ghost=null,animation=null,visibleUrl='',hintTimer;
 function clearGhost(){animation?.cancel();animation=null;ghost?.remove();ghost=null;}
 const sequence=photoSequence({busy(value){clearTimeout(hintTimer);stage.setAttribute('aria-busy',String(value));hint.hidden=true;if(value)hintTimer=setTimeout(()=>{hint.hidden=false;},300);},commit(url,alt){
  clearGhost();
  if(visibleUrl&&visibleUrl!==url&&!image.hidden&&!matchMedia('(prefers-reduced-motion: reduce)').matches){ghost=image.cloneNode();ghost.removeAttribute('id');ghost.alt='';ghost.setAttribute('aria-hidden','true');ghost.classList.add('photo-swap-previous');stage.append(ghost);}
  image.src=url;image.alt=alt;image.referrerPolicy='no-referrer';image.hidden=false;visibleUrl=url;
  if(ghost&&ghost.animate){const previous=ghost;animation=previous.animate([{opacity:1},{opacity:0}],{duration:240,easing:'ease-out',fill:'forwards'});animation.finished.then(()=>{previous.remove();if(ghost===previous)ghost=null;}).catch(()=>{});}else clearGhost();
 }});
 return {show:sequence.show,reset(){sequence.cancel();clearGhost();visibleUrl='';image.hidden=true;image.removeAttribute('src');},warm(urls){if(navigator.connection?.saveData)return;for(const url of new Set(urls.filter(Boolean)))preloadPhoto(url).catch(()=>{});}};
}
