-- A new enum value must commit before the next migration uses it.
alter type public.submission_status add value 'returned';
