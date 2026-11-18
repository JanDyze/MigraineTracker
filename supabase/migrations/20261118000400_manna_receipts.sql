-- Manna: photos. A receipt can be attached to an entry, and a photo to a note. The pictures live in a private
-- storage bucket, each person's in their own folder (<user id>/<file>), and only they can see or change them.
alter table manna.transactions add column if not exists receipt_path text;
alter table manna.notes add column if not exists image_path text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manna-receipts', 'manna-receipts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Manna: owner reads photos" on storage.objects for select to authenticated
  using (bucket_id = 'manna-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Manna: owner adds photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'manna-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Manna: owner changes photos" on storage.objects for update to authenticated
  using (bucket_id = 'manna-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Manna: owner deletes photos" on storage.objects for delete to authenticated
  using (bucket_id = 'manna-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);
