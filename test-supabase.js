require('dotenv').config({ path: 'apps/mobile/.env' });
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
async function test() {
  const { data, error } = await supabase.from('ALBUM_MASTER').select('ALBUM_ID,GENRES').limit(10);
  console.log(data, error);
}
test();
