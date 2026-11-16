-- Other Preorders: a submission status, Ordered, between Pending and Ready.
-- Additive only: one new value on the shared enum; the app offers it on
-- Other orders only.

alter type submission_status add value if not exists 'ordered';
