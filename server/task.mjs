const kind=process.argv[2];
if(kind==='lotte'){const {syncLotte}=await import('../scripts/parse-supplier-listings.mjs');await syncLotte();}
else if(kind==='mobile-de'){const {syncMobileSearch}=await import('../scripts/parse-mobile-public.mjs');await syncMobileSearch();}
else if(kind==='access'){const {checkSupplierAccess}=await import('../scripts/check-supplier-access.mjs');await checkSupplierAccess();}
else if(kind==='library'){const {hydrateLibrary}=await import('../scripts/download-supplier-library.mjs');await hydrateLibrary({detailsOnly:true});await import('../scripts/apply-supplier-library.mjs');const {generateOrderCatalog}=await import('../scripts/generate-order-catalog.mjs');await generateOrderCatalog();await hydrateLibrary();}
else throw Error('Unsupported task');
if(kind!=='library'){const {generateOrderCatalog}=await import('../scripts/generate-order-catalog.mjs');await generateOrderCatalog();}
