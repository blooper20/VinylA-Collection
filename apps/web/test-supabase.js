const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase
    .from('USER_VINYL')
    .select('*, ALBUM_MASTER(*)')
    .eq('USER_ID', '5e585d9e-cfab-47db-95a0-5fbf4f5a7eeb');
  console.log('Result:', data);
  console.log('Error:', error);
}
check();
