import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {identifyListing,makeSupplierBrief,supplierPlatforms} from '../supplier-engine.mjs';
for(const source of supplierPlatforms)assert.equal(identifyListing(source.url).provider.id,source.id);
for(const bad of ['https://mobile.de.evil.org/a','https://evilencar.com/','http://www.encar.com/','https://user:password@mobile.de/','javascript:alert(1)','https://mobile.de:8443/a'])assert.throws(()=>identifyListing(bad));
assert.equal(identifyListing('https://suchen.mobile.de/fahrzeuge/details.html?id=123&utm_source=x&ysclid=y').url,'https://suchen.mobile.de/fahrzeuge/details.html?id=123');
const brief=makeSupplierBrief({providerId:'mobile-de',link:'https://www.encar.com/dc/dc_cardetailview.do?carid=123',budget:'3000000'});
assert.equal(brief.provider.market,'kr');assert.match(brief.text,/carid=123/);assert.match(brief.text,/проверить наличие/);
assert.throws(()=>makeSupplierBrief({providerId:'mobile-de'}));
assert.throws(()=>makeSupplierBrief({providerId:'mobile-de',model:'Kia K5',budget:'-2'}));
assert.throws(()=>makeSupplierBrief({providerId:'mobile-de',model:'Kia K5',budget:'2.5'}));
const reference=JSON.parse(await readFile('data/import/reference/mobile-de.json','utf8'));
assert.equal(reference.kind,'model_reference');assert.ok(reference.brands.length>100);
const keys=new Set();for(const brand of reference.brands){assert.ok(brand.id&&brand.name);assert.ok(!keys.has(brand.id));keys.add(brand.id);const models=new Set();for(const model of brand.models){assert.ok(model.id&&model.name);assert.ok(!models.has(model.id));models.add(model.id);assert.equal(model.price,undefined);}}
console.log('Supplier checks passed: sources, URL allowlist, safe brief, real reference structure.');
