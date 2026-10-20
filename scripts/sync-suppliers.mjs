import {checkSupplierAccess} from './check-supplier-access.mjs';
import {syncLotte} from './parse-supplier-listings.mjs';
import {generateOrderCatalog} from './generate-order-catalog.mjs';
await checkSupplierAccess();await syncLotte();await generateOrderCatalog();
console.log('Supplier snapshot ready. Run the website build before publishing.');
