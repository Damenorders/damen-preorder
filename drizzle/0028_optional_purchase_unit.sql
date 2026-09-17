-- The purchase unit is optional: most products are ordered without one on
-- file (the Order Book never recorded it), and the buyer picks the unit on
-- each order line anyway. A purchase pack may also be blank for products whose
-- pack was never recorded; the app still asks for one when a buyer adds a
-- supplier link by hand.

alter table public.item_sourcing
  alter column purchase_unit drop not null;
--> statement-breakpoint
alter table public.item_sourcing
  drop constraint if exists item_sourcing_pack_not_blank;
--> statement-breakpoint
alter table public.item_sourcing
  alter column purchase_pack set default '';
