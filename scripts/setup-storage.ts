import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) throw new Error('Supabase credentials are missing.');

const supabase = createClient(url, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: buckets, error: listError } = await supabase.storage.listBuckets();
if (listError) throw listError;

if (!buckets.some((bucket) => bucket.id === 'instagram-posts')) {
  const { error } = await supabase.storage.createBucket('instagram-posts', {
    public: true,
    allowedMimeTypes: ['image/jpeg'],
    fileSizeLimit: 5 * 1024 * 1024,
  });
  if (error) throw error;
  console.log('Created Instagram post image storage.');
} else {
  console.log('Instagram post image storage already exists.');
}
