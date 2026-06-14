-- Rate reconciliation — 6 Jun 2026 (Jaz)
-- Finding: 2 active sites bill £27/hr in SigOS but the canonical Regular Hours Sheet
-- (avgWeeklyEarnings = "truth for revenue") implies £25/hr. SigOS overstates revenue.
--   Smile Dental : £27×15h = £405/wk SigOS vs £375 canonical  (+£30/wk phantom)
--   RG Setsquare : £27×4h  = £108/wk SigOS vs £100 canonical  (+£8/wk phantom)
-- ROLLBACK reference (pre-change state, both rateConfirmed=true):
--   RG Setsquare  id=blissful-heyrovsky-8  was 27.00
--   Smile Dental  id=blissful-heyrovsky-8  was 27.00
--
-- APPLY ONLY AFTER NELSON CONFIRMS these two are at the £25 floor (pricing-adjacent).

-- == APPLY (align to canonical £25) ==
UPDATE sites SET "billingRatePerHour" = 25.00, "updatedAt" = now()
WHERE name = 'Smile Dental'  AND "billingRatePerHour" = 27.00;
UPDATE sites SET "billingRatePerHour" = 25.00, "updatedAt" = now()
WHERE name = 'RG Setsquare'  AND "billingRatePerHour" = 27.00;

-- == ROLLBACK (revert to £27 if Nelson says the rise to £27 is real) ==
-- UPDATE sites SET "billingRatePerHour" = 27.00, "updatedAt" = now() WHERE name = 'Smile Dental';
-- UPDATE sites SET "billingRatePerHour" = 27.00, "updatedAt" = now() WHERE name = 'RG Setsquare';
