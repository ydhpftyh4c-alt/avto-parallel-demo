const bodies=new Set(['all','suv','sedan','liftback','hatchback','minivan','coupe','pickup','convertible','motorcycle','truck','bus','other']);
export function normalizeBuyerNeeds(input={}){
 const integer=(value,min,max,label)=>{if(value===null||value===undefined||value==='')return null;const text=String(value);if(!/^\d+$/.test(text))throw Error(label+': введите целое число.');const number=Number(text);if(!Number.isSafeInteger(number)||number<min||number>max)throw Error(label+': значение вне допустимых пределов.');return number;};
 return {body:bodies.has(input.body)?input.body:'all',budget:integer(input.budget,1,1000000000,'Бюджет'),year:integer(input.year,1900,2100,'Год'),mileage:integer(input.mileage,0,10000000,'Пробег')};
}
// A total-order budget is a request to calculate, never a foreign seller-price filter.
export function applyBuyerNeeds(filters,input){const needs=normalizeBuyerNeeds(input);return {...filters,body:needs.body,year:needs.year,mileage:needs.mileage};}
export function buyerNeedsBrief(input,filters={}){
 const needs=normalizeBuyerNeeds(input),format=new Intl.NumberFormat('ru-RU');
 const body={all:'пока не определился',suv:'кроссовер / внедорожник',sedan:'седан',liftback:'лифтбек',hatchback:'хэтчбек',minivan:'минивэн',coupe:'купе',pickup:'пикап',convertible:'кабриолет',motorcycle:'мотоцикл',truck:'грузовой',bus:'автобус',other:'другой кузов'}[needs.body];
 return ['Мои пожелания к подбору:',filters.q?'Модель или комплектация: '+String(filters.q).slice(0,100):'',filters.brand&&filters.brand!=='all'?'Марка: '+filters.brand:'','Кузов: '+body,needs.year!==null?'Год выпуска от '+needs.year:'',needs.mileage!==null?'Пробег до '+format.format(needs.mileage)+' км':'',needs.budget!==null?'Бюджет на весь заказ: до '+format.format(needs.budget)+' ₽. Прошу проверить, какие варианты подходят с учётом всех расходов.':'Бюджет пока не определён.', 'Прошу проверить наличие, состояние и возможность ввоза, рассчитать доставку, пошлины, утильсбор и услуги.'].filter(Boolean).join('\n');
}
