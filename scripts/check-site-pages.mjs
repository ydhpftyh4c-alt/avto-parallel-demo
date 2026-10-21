import {legacyDestination} from '../assets/site-routing.mjs';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const routes=['','catalog/','import/','budget/','contacts/'];
for(const route of routes){
 const html=await readFile(route+'index.html','utf8'),base=new URL(route?'../':'./','https://example.test/project/'+route);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);assert.equal(new Set(ids).size,ids.length,'Duplicate IDs: '+route);
 assert.ok(html.includes('aria-current="page"'));assert.ok(!/src="(?:app|guide|suppliers|catalog-data)\.js/.test(html));
 for(const [,href] of html.replace(/<base[^>]*>/g,'').matchAll(/(?:src|href)="([^"]+)"/g)){
  const url=new URL(href.replaceAll('&amp;','&'),base);if(url.origin!==base.origin)continue;
  const relative=decodeURIComponent(url.pathname.replace(/^\/project\//,''));await stat(!relative?'index.html':relative.endsWith('/')?relative+'index.html':relative);
  if(url.hash&&relative.endsWith('/')){const target=await readFile(relative+'index.html','utf8');assert.ok(target.includes('id="'+url.hash.slice(1)+'"'),'Missing target '+href+' on '+route);}
 }
}
const home=await readFile('index.html','utf8'),catalog=await readFile('catalog/index.html','utf8');
assert.ok(!home.includes('id="buyer-catalog"'));assert.ok(!home.includes('src="order.js'));assert.ok(catalog.includes('id="buyer-catalog"'));assert.ok(catalog.includes('src="order.js'));
const contact=await readFile('contacts/index.html','utf8');assert.ok(contact.includes('id="lead-form"'));
console.log('Site routes passed: independent pages, project-relative navigation, valid assets/anchors, active menu, catalog isolated from home.');

const root='https://example.test/project/';
assert.equal(legacyDestination(root+'?release=1',root),null);
assert.equal(new URL(legacyDestination(root+'?view=all&status=all#request',root)).pathname,'/project/contacts/');
const oldSearch=new URL(legacyDestination(root+'?view=supplier&brand=kia&util=precheck',root));assert.equal(oldSearch.pathname,'/project/catalog/');assert.equal(oldSearch.searchParams.get('util'),'precheck');
assert.equal(new URL(legacyDestination(root+'#calculator',root)).pathname,'/project/budget/');
assert.equal(new URL(legacyDestination(root+'?car=lotte-123#request',root)).pathname,'/project/catalog/');
