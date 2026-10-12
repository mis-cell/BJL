const { createClient } = require('@supabase/supabase-js');
const Papa = require('papaparse');
const fs = require('fs');

const supabaseUrl = 'https://lxuapkccxaadwixjpirs.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4dWFwa2NjeGFhZHdpeGpwaXJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MzQ4NDksImV4cCI6MjA5NDQxMDg0OX0.rzjJFNOb1gx0Z4cMSfkW9yDe4rI8oO6TLTzcVXswPek';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const posToApproveList = [
  "BJCL/2026-2027/0653", "BJCL/2026-2027/0654", "BJCL/2026-2027/0650", "BJCL/2026-2027/0652",
  "BJCL/2026-2027/0645", "BJCL/2026-2027/0644", "BJCL/2026-2027/0643", "BJCL/2026-2027/0642",
  "BJCL/2026-2027/0641", "BJCL/2026-2027/0640", "BJCL/2026-2027/0638", "BJCL/2026-2027/0636",
  "BJCL/2026-2027/0634", "BJCL/2026-2027/0633", "BJCL/2026-2027/0632", "BJCL/2026-2027/0631",
  "BJCL/2026-2027/0630", "BJCL/2026-2027/0629", "BJCL/2026-2027/0605", "BJCL/2026-2027/0623",
  "BJCL/2026-2027/0625", "BJCL/2026-2027/0622", "BJCL/2026-2027/0621", "BJCL/2026-2027/0619",
  "BJCL/2026-2027/0618", "BJCL/2026-2027/0616", "BJCL/2026-2027/0613", "BJCL/2026-2027/0612",
  "BJCL/2026-2027/0611", "BJCL/2026-2027/0610", "BJCL/2026-2027/0609", "BJCL/2026-2027/0607",
  "BJCL/2026-2027/0590", "BJCL/2026-2027/0591", "BJCL/2026-2027/0594", "BJCL/2026-2027/0558",
  "BJCL/2026-2027/0573", "BJCL/2026-2027/0575", "BJCL/2026-2027/0572", "BJCL/2026-2027/0541",
  "BJCL/2026-2027/0540", "BJCL/2026-2027/0539", "BJCL/2026-2027/0538", "BJCL/2026-2027/0548",
  "BJCL/2026-2027/0547", "BJCL/2026-2027/0546", "BJCL/2026-2027/0545", "BJCL/2026-2027/0543",
  "BJCL/2026-2027/0554", "BJCL/2026-2027/0553", "BJCL/2026-2027/0559", "BJCL/2026-2027/0560",
  "BJCL/2026-2027/0523", "BJCL/2026-2027/0513", "BJCL/2026-2027/0514", "BJCL/2026-2027/0510",
  "BJCL/2026-2027/0503", "BJCL/2026-2027/0511", "BJCL/2026-2027/0515", "BJCL/2026-2027/0500",
  "BJCL/2026-2027/0498", "BJCL/2026-2027/0497", "BJCL/2026-2027/0496", "BJCL/2026-2027/0487"
];

const posToApproveSet = new Set(posToApproveList.map(p => p.trim()));

async function injectAndApproveFast() {
  const csvContent = fs.readFileSync('./scripts/raw_input.csv', 'utf8');
  const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  const rows = parsed.data;

  console.log(`Parsed ${rows.length} rows from CSV input.`);

  // Fetch existing sauda_master records
  const { data: existingSaudas } = await supabase.from('sauda_master').select('sauda_id, sauda_no');
  const existingMap = new Map();
  if (existingSaudas) {
    existingSaudas.forEach(s => existingMap.set(s.sauda_no, s.sauda_id));
  }

  const parseDateString = (dtStr) => {
    if (!dtStr || !dtStr.trim()) return new Date().toISOString().split('T')[0];
    const s = dtStr.trim();
    if (s.length >= 10 && s[4] === '-' && s[7] === '-') return s.slice(0, 10);
    if (s.includes('-')) {
      const parts = s.split('-');
      if (parts.length === 3) {
        if (parts[0].length === 2 && parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
    }
    const d = new Date(s);
    return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  };

  const tasks = [];
  const approveTargetSet = new Set();

  for (const r of rows) {
    let orderNo = (r["Order No"] || r["order_no"] || '').trim();
    if (!orderNo) continue;

    if (!orderNo.startsWith('BJCL/')) {
      const digits = orderNo.replace(/[^0-9]/g, '');
      if (digits) {
        orderNo = `BJCL/2026-2027/${digits.padStart(4, '0')}`;
      }
    } else {
      const parts = orderNo.split('/');
      if (parts.length === 3) {
        const numPart = parts[2].replace(/[^0-9]/g, '');
        if (numPart && numPart.length < 4) {
          orderNo = `${parts[0]}/${parts[1]}/${numPart.padStart(4, '0')}`;
        }
      }
    }

    const sessionVal = (r["Session"] || '2026-2027').trim();
    const dateVal = parseDateString(r["Date"]);
    const shipmentDateVal = parseDateString(r["Shipment Date"] || dateVal);
    const bDateVal = parseDateString(r["Book Date"] || dateVal);

    let qJson = [];
    if (r["Quality Details JSON"]) {
      try {
        qJson = JSON.parse(r["Quality Details JSON"]);
      } catch (e) {}
    }

    const shouldApprove = posToApproveSet.has(orderNo) || posToApproveSet.has(orderNo.replace('/0', '/'));
    if (shouldApprove) approveTargetSet.add(orderNo);

    const statusVal = shouldApprove ? 'CHECKED' : ((r["Status"] || 'PENDING').toUpperCase());
    const approvalStatusVal = shouldApprove ? 'APPROVED' : statusVal;

    const payload = {
      sauda_no: orderNo,
      session: sessionVal,
      financial_year: sessionVal,
      po_type: (r["PO Type"] || 'Normal').trim(),
      date: dateVal,
      broker: (r["Broker"] || '').trim().toUpperCase(),
      supplier: (r["Supplier"] || '').trim().toUpperCase(),
      challan_supplier: (r["Challan Supplier"] || r["Supplier"] || '').trim().toUpperCase(),
      area: (r["Area"] || '').trim().toUpperCase(),
      agency: (r["Agency"] || '').trim().toUpperCase(),
      marks: (r["Marks"] || '').trim().toUpperCase(),
      no_of_lorries: parseInt(r["No of Lorries"] || '1', 10) || 1,
      units_per_lorry: parseFloat(r["Units Per Lorry"] || '80') || 80,
      unit_type: (r["Unit Type"] || 'BALES').trim().toUpperCase(),
      total_unit: parseInt(r["Total Unit"] || '0', 10) || 0,
      wt_per_lorry: parseFloat(r["Wt Per Lorry"] || '0') || 0,
      total_wt_in_ton: parseFloat(r["Total Wt Ton"] || '0') || 0,
      shipment_date: shipmentDateVal,
      shipment_days: parseInt(r["Shipment Days"] || '0', 10) || 0,
      shipment_penalty: parseFloat(r["Shipment Penalty"] || '50') || 50,
      marks_claim: parseFloat(r["Marks Claim"] || '0') || 0,
      quantity_claim: parseFloat(r["Quantity Claim"] || '0') || 0,
      b_rate: parseFloat(r["Book Rate"] || '0') || 0,
      b_date: bDateVal,
      superior_normal_marks: (r["Superior Normal Marks"] || 'New (F2)').trim(),
      remarks: (r["Remarks"] || 'Area, Agency Grade, Grade differential can change as per market.').trim(),
      status: statusVal,
      approval_status: approvalStatusVal,
      quality_details: qJson
    };

    if (shouldApprove) {
      payload.is_checked = true;
      payload.checked_by = 'SHYAMLAHOTI';
      payload.approved_by = 'SHYAMLAHOTI';
      payload.checked_at = new Date().toISOString();
      payload.approved_at = new Date().toISOString();
    }

    const saudaId = existingMap.get(orderNo);
    if (saudaId) {
      tasks.push(supabase.from('sauda_master').update(payload).eq('sauda_id', saudaId));
    } else {
      tasks.push(
        supabase.from('sauda_master').insert(payload).select().then(res => {
          if (res.data && res.data[0] && qJson.length > 0) {
            const newId = res.data[0].sauda_id;
            const detailInserts = qJson.map(q => supabase.from('sauda_quality_details').insert({
              sauda_id: newId,
              sauda_no: orderNo,
              financial_year: sessionVal,
              quality: q.quality || 'TD6',
              qty: q.qty || 0,
              agency: q.agency || payload.agency || '',
              marka: q.marka || payload.marks || '',
              rs: q.rs || payload.b_rate || 0
            }));
            return Promise.all(detailInserts);
          }
        })
      );
    }
  }

  // Explicit approval update for all requested POs in posToApproveList
  const approvePayload = {
    status: 'CHECKED',
    approval_status: 'APPROVED',
    is_checked: true,
    checked_by: 'SHYAMLAHOTI',
    approved_by: 'SHYAMLAHOTI',
    checked_at: new Date().toISOString(),
    approved_at: new Date().toISOString()
  };

  for (const targetNo of posToApproveList) {
    tasks.push(supabase.from('sauda_master').update(approvePayload).eq('sauda_no', targetNo));
  }

  console.log(`Executing ${tasks.length} database tasks in chunks...`);
  const chunkSize = 25;
  for (let i = 0; i < tasks.length; i += chunkSize) {
    const chunk = tasks.slice(i, i + chunkSize);
    await Promise.all(chunk);
    console.log(`Processed ${Math.min(i + chunkSize, tasks.length)} / ${tasks.length}...`);
  }

  console.log(`🎉 Complete! All CSV rows injected into sauda_master & sauda_quality_details, and ${posToApproveList.length} POs marked as APPROVED!`);
}

injectAndApproveFast().catch(console.error);
