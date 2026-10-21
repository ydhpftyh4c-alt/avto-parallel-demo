# Preliminary recycling-fee shortlist

Implemented 2026-10-21. This is a technical screening aid, not a fee calculator, exemption, proof of M1 category, or confirmation of eligibility for personal import. No monetary savings or fixed payable amounts are shown.

- precheck: known passenger-style body, known petrol/diesel/gas combustion fuel, positive declared displacement up to 3000 cc; any declared numeric power must be <=117.68 kW and <=160 metric hp. Missing power remains explicitly unknown and may conceal power above the limit.
- known: same screening, with at least one explicit numeric power field. Both fields are checked if supplied; a value above either boundary excludes the record.
- Unknown displacement/fuel/body, non-passenger bodies, hybrids and electric vehicles are excluded rather than guessed. Separate legal rules for those powertrains are not implemented. No power is inferred from model, badge, year or engine size.
- Personal import conditions, repeat imports, registration/ownership periods and vehicle category require document review. This shortlist cannot establish those facts.

Current normalized catalog has no power_kw/power_hp values. Strict screening therefore returns no records until real power data is supplied. Preliminary records are visibly marked as needing power confirmation. No source snapshots or live admin database were overwritten.

Sources consulted:
- https://www.nalog.gov.ru/rn60/news/activities_fts/16590008/ — FNS explanation of power limits, hybrids and electric cars; publication itself marked archived, not treated as a full current legal code.
- https://www.nalog.gov.ru/rn77/about_fts/about_nalog/16602625/ — FNS explanation that calculation includes power in kW.
- https://epp.genproc.gov.ru/ru/urtp/mass-media/news/regional/e8410434/ — personal-import conditions matter; early disposal may entail reassessment.

No claim is made that all rules or later amendments have been modeled. Verify current rules at import time.
