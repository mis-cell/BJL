const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = 'https://lxuapkccxaadwixjpirs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4dWFwa2NjeGFhZHdpeGpwaXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MzQ4NDksImV4cCI6MjA5NDQxMDg0OX0.rzjJFNOb1gx0Z4cMSfkW9yDe4rI8oO6TLTzcVXswPek';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function generateCsv() {
  const { data: fullData } = await supabase.from('sauda_master').select('*').order('created_at', { ascending: false });

  if (!fullData) {
    console.log('No data');
    return;
  }

  const headers = [
    "Order No", "Session", "PO Type", "Date", "Broker", "Supplier", "Challan Supplier",
    "Area", "Agency", "Marks", "No of Lorries", "Units Per Lorry", "Unit Type", "Total Unit",
    "Wt Per Lorry", "Total Wt Ton", "Shipment Date", "Shipment Days", "Shipment Penalty",
    "Marks Claim", "Quantity Claim", "Book Rate", "Book Date", "Superior Normal Marks",
    "Remarks", "Status", "Quality Details JSON", "Sauda ID", "Created At"
  ];

  const formatDate = (dt) => {
    if (!dt) return '';
    if (dt.length === 10 && dt[4] === '-') {
      const parts = dt.split('-');
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return dt;
  };

  const rows = fullData.map(row => {
    let qDetailsStr = '';
    if (Array.isArray(row.quality_details) && row.quality_details.length > 0) {
      qDetailsStr = JSON.stringify(row.quality_details);
    } else if (typeof row.quality_details === 'string') {
      qDetailsStr = row.quality_details;
    }

    return [
      row.sauda_no || '',
      row.session || '2026-2027',
      row.po_type || 'Normal',
      formatDate(row.date),
      row.broker || '',
      row.supplier || '',
      row.challan_supplier || '',
      row.area || '',
      row.agency || '',
      row.marks || '',
      row.no_of_lorries || 1,
      row.units_per_lorry || row.units_per_lorry_type || 80,
      row.unit_type || 'BALES',
      row.total_unit || 0,
      row.wt_per_lorry || 0,
      row.total_wt_in_ton || 0,
      formatDate(row.shipment_date),
      row.shipment_days || 0,
      row.shipment_penalty || 0,
      row.marks_claim || 0,
      row.quantity_claim || 0,
      row.b_rate || 0,
      formatDate(row.b_date),
      row.superior_normal_marks || 'New (F2)',
      row.remarks || '',
      (row.status || 'PENDING').toUpperCase(),
      qDetailsStr,
      row.sauda_id || '',
      row.created_at || ''
    ];
  });

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const csvLines = [
    headers.map(escapeCsv).join(','),
    ...rows.map(r => r.map(escapeCsv).join(','))
  ];

  const csvContent = csvLines.join('\n');
  fs.writeFileSync('./scripts/sauda_export_updated.csv', csvContent, 'utf8');
  console.log(`Generated sauda_export_updated.csv with ${rows.length} rows.`);

  // Print sample for 0539
  const row539 = fullData.find(r => r.sauda_no === 'BJCL/2026-2027/0539');
  if (row539) {
    console.log('--- 0539 CSV Row ---');
    console.log(JSON.stringify(row539.quality_details, null, 2));
  }
}

generateCsv().catch(console.error);
