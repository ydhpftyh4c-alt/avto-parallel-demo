import {checkGeneratedPages} from './check-pages.mjs';
import {generatePages} from './generate-pages.mjs';
import {readFile, mkdir, copyFile, cp, stat} from 'node:fs/promises';
import path from 'node:path';
import {generateCatalog} from './generate-catalog.mjs';
import './check-data.mjs';
import './check-import-data.mjs';
import './check-selection.mjs';
import './check-suppliers.mjs';
import {generateOrderCatalog} from './generate-order-catalog.mjs';
import {generateImportCatalog} from './generate-import-catalog.mjs';
import {generateBuyerSection} from './generate-buyer-section.mjs';
await generateBuyerSection();
const root=process.cwd();
const html=await readFile('index.html','utf8');
const app=await readFile('app.js','utf8');
const guideSource=await readFile('guide.js','utf8');
const supplierSource=await readFile('suppliers.js','utf8');
await generateOrderCatalog();
await import('./check-order.mjs');
const catalog=await generateCatalog();
const importCatalog=await generateImportCatalog();
if(new Set(catalog.map(car=>car.id)).size!==catalog.length)throw Error('Duplicate listing IDs');
for(const car of catalog){if(!car.image || (car.price!==null && !(car.price>0)) || !car.date || !car.priceDate)throw Error('Incomplete listing: '+car.name);}
const resources=[...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match=>match[1]).filter(value=>!/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(value));
resources.push(...importCatalog.map(car=>car.image));
resources.push(...catalog.flatMap(car=>[car.image,car.image_small,car.image_large,...car.images].filter(Boolean)));
for(const [,set] of html.matchAll(/\bsrcset="([^"]+)"/g))resources.push(...set.split(',').map(item=>item.trim().split(/\s+/)[0]));
for(const resource of new Set(resources)){const file=path.resolve(root,resource.split('?')[0]);if(!file.startsWith(root+path.sep))throw Error('Invalid resource path');await stat(file);}
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
if(new Set(ids).size!==ids.length)throw Error('Duplicate HTML IDs');
const uiSource=app+'\n'+guideSource+'\n'+supplierSource;const dynamicIds=[...uiSource.matchAll(/\.id\s*=\s*['"]([^'"]+)['"]/g)].map(match=>match[1]);
const referencedIds=[...uiSource.matchAll(/querySelector\(\s*['"]#([a-zA-Z0-9_-]+)['"]\s*\)/g)].map(match=>match[1]);
for(const id of new Set(referencedIds))if(!ids.includes(id)&&!dynamicIds.includes(id))throw Error('UI control is missing from HTML: '+id);
for(const [,anchor] of html.matchAll(/href="#([^"]+)"/g)){if(!ids.includes(anchor))throw Error('Broken anchor: '+anchor);}
await mkdir('dist',{recursive:true});
for(const file of ['index.html','styles.css','app.js','guide.js','selection-engine.mjs','suppliers.js','supplier-engine.mjs','catalog-data.js','import-catalog-data.js','import-catalog.json','order.html','order.css','order.js','order-engine.mjs','order-catalog.json','.nojekyll'])await copyFile(file,'dist/'+file);
await cp('assets','dist/assets',{recursive:true});
await cp('photo-review','dist/photo-review',{recursive:true});
await cp('data/import/reference','dist/data/import/reference',{recursive:true});
await cp('data/vehicles','dist/data/vehicles',{recursive:true});
await generatePages(catalog,importCatalog);
await checkGeneratedPages(catalog,importCatalog);
console.log('Build passed: script syntax, local assets, unique IDs and anchor targets. Output: dist/');

