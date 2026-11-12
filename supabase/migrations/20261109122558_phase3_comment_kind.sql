-- Commit the enum value before any subsequent migration uses it.
alter type public.notification_type add value 'comment_posted';
