// Technical shortlist only. This never determines a person's legal entitlement or a fee.
export const recyclingScreenVersion='2026-10-21';
const passengerBodies=new Set(['sedan','suv','hatchback','liftback','coupe','convertible','minivan']);
const combustion=new Set(['GASOLINE','PETROL','DIESEL','LPG','CNG','БЕНЗИН','ДИЗЕЛЬ','ГАЗ']);
const positive=value=>typeof value==='number'&&Number.isFinite(value)&&value>0;
export function recyclingScreen(car){
 if(!passengerBodies.has(car.body)||!combustion.has(String(car.fuel||'').trim().toUpperCase()))return 'excluded';
 if(!positive(car.engine_cc)||car.engine_cc>3000)return 'excluded';
 const kw=positive(car.power_kw)?car.power_kw:null,hp=positive(car.power_hp)?car.power_hp:null;
 if(kw===null&&hp===null)return 'unknown_power';
 if(kw!==null&&kw>117.68||hp!==null&&hp>160)return 'excluded';
 return 'technical_match';
}
export function matchesRecyclingScreen(car,mode){
 if(!mode||mode==='all')return true;
 const result=recyclingScreen(car);
 if(mode==='known')return result==='technical_match';
 if(mode==='precheck')return result==='technical_match'||result==='unknown_power';
 return false;
}
export function recyclingScreenLabel(car){return recyclingScreen(car)==='technical_match'?'ДВС до 3 л и 160 л.с. · льготу проверить':'ДВС до 3 л · мощность уточнить';}
