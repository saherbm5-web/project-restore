/*
# Update car type options and opening fees

## Changes
- Update settings opening_day and opening_night to 1.0 (1 dinar)
- Update car_type_options to include hybrid and sedan
- The per-car-type pricing is handled in the app code (CAR_TYPE_PRICING map)
- km_price_day and km_price_night remain as default for legacy, actual pricing uses car type
*/

UPDATE settings
SET
  opening_day = 1.0,
  opening_night = 1.0,
  car_type_options = '["special","yellow","electric","hybrid","sedan","family","suv","lady"]'::jsonb
WHERE id = 1;
