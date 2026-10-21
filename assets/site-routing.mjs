import {cleanCatalogSearch} from './vehicle-page-data.mjs';
export function legacyDestination(href,base){
 const current=new URL(href),hash=current.hash.slice(1),keys=[...new URLSearchParams(cleanCatalogSearch(current.search)).keys()];
 const sections={catalog:'catalog/',request:'contacts/',calculator:'budget/',process:'import/',inspiration:'catalog/'};
 const target=current.searchParams.has('car')?'catalog/':sections[hash]||(keys.length?'catalog/':null);
 if(!target)return null;
 const next=new URL(target,base);next.search=current.search;
 next.hash=target==='catalog/'?'catalog':hash;
 return next.href;
}
