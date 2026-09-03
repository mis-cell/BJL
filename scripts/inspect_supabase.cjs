const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://lxuapkccxaadwixjpirs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4dWFwa2NjeGFhZHdpeGpwaXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MzQ4NDksImV4cCI6MjA5NDQxMDg0OX0.rzjJFNOb1gx0Z4cMSfkW9yDe4rI8oO6TLTzcVXswPek';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectDetails() {
  console.log("Inspecting 'material_inspection_details' table...");
  const { data, error } = await supabase.from('material_inspection_details').select('*').limit(3);
  if (error) console.error("Error:", error);
  else console.log("Sample records:", data);
}

inspectDetails();
