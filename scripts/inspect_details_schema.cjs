const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxuapkccxaadwixjpirs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4dWFwa2NjeGFhZHdpeGpwaXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MzQ4NDksImV4cCI6MjA5NDQxMDg0OX0.rzjJFNOb1gx0Z4cMSfkW9yDe4rI8oO6TLTzcVXswPek';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data: mid, error: midErr } = await supabase.from('material_inspection_details').select('*').limit(1);
  if (midErr) console.error("midErr:", midErr);
  else console.log("material_inspection_details keys:", Object.keys(mid[0] || {}));

  const { data: id, error: idErr } = await supabase.from('inspection_details').select('*').limit(1);
  if (idErr) console.error("idErr:", idErr);
  else console.log("inspection_details keys:", Object.keys(id[0] || {}));
}

inspect();
