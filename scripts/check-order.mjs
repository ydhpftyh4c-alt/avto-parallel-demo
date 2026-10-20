import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {normalizeLotte} from './parse-supplier-listings.mjs';
import {filterListings,listingBrief,sourceImage} from '../order-engine.mjs';
const raw={gdId:'1234567890',mcmpNm:'KIA',modelNm:'SORENTO',gradNm:'2.2 Diesel',mnfYear:'2021',drgMil:50000,dpmVal:2199,carAmt:'18000',dcCarAmt:'17500',mocaCdNm:'SUV',gasSeNm:'DIESEL'};
const car=normalizeLotte(raw,[{gdId:'1234567890',afilePath:'/goods/test/',regFileNm:'test.jpg'}],'2026-10-20T12:00:00Z');
assert.equal(car.price,17500);assert.equal(car.currency,'USD');assert.equal(car.body,'suv');assert.equal(car.engine_cc,2199);assert.equal(car.images[0],'/goods/test/test.jpg');assert.equal(car.availability,'requires_confirmation');assert.equal(car.clsNo,undefined);assert.equal(car.selerId,undefined);
assert.equal(normalizeLotte({...raw,drgMil:0},[],car.observed_at).mileage_km,0);assert.equal(normalizeLotte({...raw,drgMil:null},[],car.observed_at).mileage_km,null);
assert.throws(()=>normalizeLotte({...raw,gdId:'../bad'},[],car.observed_at));assert.throws(()=>normalizeLotte({...raw,mnfYear:2200},[],car.observed_at));
assert.equal(normalizeLotte({...raw,gdId:'U2502571387'},[],car.observed_at).id,'lotte-U2502571387');
assert.equal(sourceImage('/goods/../private.jpg'),'assets/import-model.svg');assert.equal(sourceImage('https://evil.example/x.jpg'),'assets/import-model.svg');assert.match(sourceImage(car.images[0]),/img\.lotte-autoglobal\.net\/goods\/test\/test.jpg/);assert.match(sourceImage(car.images[0]),/composite\/wm_224/);
const filters={currency:'USD'};assert.equal(filterListings([car],{...filters,q:'киа соренто'}).length,1);assert.equal(filterListings([car],{...filters,price:17000}).length,0);assert.equal(filterListings([car],{...filters,price:17500,year:2021,mileage:50000}).length,1);
assert.equal(filterListings([{...car,mileage_km:null}],{...filters,mileage:50000}).length,0);assert.equal(filterListings([{...car,mileage_km:0}],{...filters,mileage:0}).length,1);
assert.equal(filterListings([car],{currency:'all',price:20000}).length,0);assert.equal(filterListings([car],{currency:'KRW'}).length,0);assert.equal(filterListings([car],{...filters,saved:true},new Set()).length,0);
assert.equal(filterListings([{...car,id:'x',price:null},car],{...filters,sort:'price-asc'})[0].id,car.id);
assert.match(listingBrief([car]),/17500 USD/);assert.match(listingBrief([car]),/полную стоимость/);assert.throws(()=>listingBrief([]));assert.throws(()=>listingBrief(Array(6).fill(car)));
const snapshot=JSON.parse(await readFile('data/import/listings/lotte.json','utf8'));assert.ok(snapshot.sources[0].pages_fetched>0);assert.equal(snapshot.sources[0].unique_listings,snapshot.listings.length);assert.equal(new Set(snapshot.listings.map(item=>item.id)).size,snapshot.listings.length);
for(const item of snapshot.listings){assert.equal(item.availability,'requires_confirmation');assert.equal(item.import_eligibility,'not_verified');assert.equal(item.price_basis,'seller_listing_excludes_import');assert.equal(item.clsNo,undefined);for(const field of ['mileage_km','engine_cc'])assert.ok(item[field]===null||Number.isFinite(item[field])&&item[field]>=0);}
const html=await readFile('catalog-section.html','utf8'),js=await readFile('order.js','utf8'),ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length);
for(const [,id] of js.matchAll(/\$\('([^']+)'\)/g))assert.ok(ids.includes(id),'Missing order UI element: '+id);
for(const [,resource] of html.matchAll(/(?:src|href)="([^"#]+)"/g))if(!/^[a-z]+:/i.test(resource))await stat(resource.split(/[?#]/)[0]||'.');
console.log(`Unified catalog checks passed: parser, ${snapshot.listings.length} actual records, currency-safe filters, photo URLs, selection and UI links.`);

const buyer=JSON.parse(await readFile('order-catalog.json','utf8'));assert.ok(buyer.listings.every(item=>item.images.length>0));assert.equal(buyer.agency_photo_count,buyer.listings.filter(item=>item.category==='agency').length);assert.ok(buyer.agency_hidden_without_photos>0);assert.ok(buyer.listings.some(item=>item.category==='agency'));assert.ok(buyer.listings.some(item=>item.category==='supplier'));assert.equal(filterListings([{...car,images:[]}],{}).length,0);assert.equal(filterListings([{...car,category:'agency'}],{scope:'supplier'}).length,0);assert.equal(sourceImage('data/vehicles/kia/test/photos/001.jpg'),'data/vehicles/kia/test/photos/001.jpg');
