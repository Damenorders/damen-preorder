-- Fish orders: a 4th submission status, Invoiced. Additive only: one new value
-- on the shared enum; the app offers it on fish orders only. For fish, Invoiced
-- (not Shipped) is what sinks an order to the bottom of the list.

alter type submission_status add value if not exists 'invoiced';
