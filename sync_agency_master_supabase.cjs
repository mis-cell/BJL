const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://lxuapkccxaadwixjpirs.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4dWFwa2NjeGFhZHdpeGpwaXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MzQ4NDksImV4cCI6MjA5NDQxMDg0OX0.rzjJFNOb1gx0Z4cMSfkW9yDe4rI8oO6TLTzcVXswPek';

const supabase = createClient(supabaseUrl, supabaseKey);

async function syncAgencies() {
  console.log('Loading deduplicated master JSON...');
  const jsonPath = path.join(__dirname, 'src/data/areaLogicMasterData.json');
  const records = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));

  console.log(`Found ${records.length} records. Cleaning existing agency_master table...`);

  // Clear existing agency_master table
  const { error: delErr } = await supabase.from('agency_master').delete().gte('id', 0);
  if (delErr) {
    console.warn('Notice clearing by numeric ID:', delErr.message);
    await supabase.from('agency_master').delete().neq('area_code', '___NON_EXISTENT___');
  }

  const payload = records.map(r => ({
    area_code: String(r.AREA_CODE).trim(),
    area_name: String(r.AREA_NAME).trim().toUpperCase(),
    agency_code: String(r.AGENCY_CODE).trim(),
    agency_name: String(r.AGENCY_NAME).trim()
  }));

  console.log(`Inserting ${payload.length} deduplicated records into Supabase agency_master table...`);

  const batchSize = 100;
  let insertedCount = 0;

  for (let i = 0; i < payload.length; i += batchSize) {
    const batch = payload.slice(i, i + batchSize);
    const { data, error } = await supabase.from('agency_master').insert(batch).select('id');
    if (error) {
      console.error(`Batch ${i / batchSize + 1} insert notice:`, error.message);
      // Fallback: try inserting without area_name if column not added yet
      const fallbackBatch = batch.map(({ area_name, ...rest }) => rest);
      const { error: fbErr } = await supabase.from('agency_master').insert(fallbackBatch);
      if (fbErr) {
        console.error('Fallback insert failed:', fbErr.message);
      } else {
        insertedCount += batch.length;
      }
    } else {
      insertedCount += (data ? data.length : batch.length);
    }
  }

  console.log(`Successfully synced ${insertedCount} unique agency records to Supabase agency_master table!`);
}

syncAgencies().catch(err => {
  console.error('Error syncing agency master:', err);
  process.exit(1);
});
