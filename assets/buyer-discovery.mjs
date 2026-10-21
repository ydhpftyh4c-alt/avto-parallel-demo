import {cleanCatalogSearch} from './vehicle-page-data.mjs';
export const recentKey='parallel-recent-cars-v1',searchesKey='parallel-saved-searches-v1';
export function rememberViewed(ids,id){return [id,...(Array.isArray(ids)?ids:[])].filter((value,index,all)=>typeof value==='string'&&value.length>0&&value.length<=150&&all.indexOf(value)===index).slice(0,8);}
export function recentListings(ids,cars){const known=new Map(cars.filter(car=>car.images?.length).map(car=>[car.id,car]));return rememberViewed(ids,'').filter(Boolean).map(id=>known.get(id)).filter(Boolean);}
export function searchSnapshot(search,label){const params=new URLSearchParams(cleanCatalogSearch(search));params.sort();const query=params.toString();return {query,label:String(label||params.get('q')||'Мой поиск').trim().slice(0,80)||'Мой поиск'};}
export function rememberSearch(items,entry){const safe=(Array.isArray(items)?items:[]).filter(item=>item&&typeof item.query==='string'&&typeof item.label==='string').map(item=>searchSnapshot(item.query,item.label));return [entry,...safe.filter(item=>item.query!==entry.query)].slice(0,5);}
