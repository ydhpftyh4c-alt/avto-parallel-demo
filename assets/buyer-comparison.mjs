import {bodyLabels} from '../order-engine.mjs';
const format=new Intl.NumberFormat('ru-RU');
const number=(value,suffix='')=>typeof value==='number'&&Number.isFinite(value)?format.format(value)+suffix:'Не указан';
const text=value=>typeof value==='string'&&value.trim()?value.trim():'Не указано';
const market={kr:'Корея',cn:'Китай',eu:'Европа'};
const status={sold:'Продано',reserved:'Забронировано',unknown:'Без отметки о продаже'};
export function comparisonRows(cars){
 if(!Array.isArray(cars)||cars.length<2||cars.length>5||new Set(cars.map(car=>car.id)).size!==cars.length)throw Error('Для сравнения выберите от двух до пяти разных автомобилей.');
 const fields=[['price','Цена из объявления',car=>car.price===null||!Number.isFinite(car.price)?'По запросу':(car.price_prefix||'')+format.format(car.price)+' '+(car.currency==='RUB'?'₽':text(car.currency))],['year','Год выпуска',car=>number(car.year)],['mileage','Пробег',car=>number(car.mileage_km,' км')],['engine','Двигатель',car=>car.engine_text?.trim()||number(car.engine_cc,' см³')],['fuel','Топливо',car=>text(car.fuel)],['transmission','Коробка передач',car=>text(car.transmission)],['drive','Привод',car=>text(car.drive)],['body','Кузов',car=>bodyLabels[car.body]||'Не указан'],['color','Цвет',car=>text(car.color)],['market','Источник',car=>car.category==='agency'?'Объявление агентства':(market[car.market]||'Направление не указано')+' · '+text(car.provider_name)],['status','Отметка о продаже',car=>status[car.status]||status.unknown]];
 return fields.map(([key,label,get])=>{const values=cars.map(get);return {key,label,values,same:values.every(value=>value.normalize('NFKC').toLocaleLowerCase('ru-RU')===values[0].normalize('NFKC').toLocaleLowerCase('ru-RU'))};});
}
