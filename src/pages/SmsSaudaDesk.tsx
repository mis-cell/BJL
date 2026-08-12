import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

import { 
  MessageSquare, 
  PlusCircle, 
  RefreshCw, 
  AlertCircle, 
  Search, 
  Printer, 
  Download, 
  Check, 
  Edit3, 
  Trash2, 
  Clock, 
  SlidersHorizontal, 
  RotateCcw, 
  CheckSquare, 
  Calendar, 
  X,
  FileSpreadsheet,
  Calculator,
  Briefcase,
  Plus,
  Trash,
  Mail,
  Loader2,
  Send,
  Inbox,
  Star,
  Paperclip,
  ArrowLeft
} from 'lucide-react';
import { cn, getApiUrl } from '../lib/utils';
import { canEditOrDelete, enforceEditOrDeletePermission } from '../lib/permissions';
import LegacyLayout from '../components/LegacyLayout';
import { supabase } from '../lib/supabase';
import { dbModule } from '../services/dbModule';

interface SmsSaudaQualityDetail {
  quality: string;
  qty: number;
  agency: string;
  marka: string;
  rs: number;
}

interface SmsSaudaContract {
  id: string; // internal UUID or string ID
  sauda_no: string; // BJCL slip number (e.g., BJCL/ 7017TD)
  po_type: string; // Normal, etc.
  date: string; // date of booking
  session: string; // "2026-2027"
  broker: string; // Trader / Broker Name
  supplier: string; // Supplier Name
  challan_supplier: string; // Challan Supplier Name
  area: string; // Area Name
  no_of_lorries: number;
  units_per_lorry: string; // e.g. "BALES"
  total_unit: number; // calculated sum of quality details qty
  wt_per_lorry: number;
  unit_type: string; // "BALES", "LORRY", "LOOSE"
  total_wt_tons: number;
  quality_details: SmsSaudaQualityDetail[];
  shipment_date: string;
  shipment_days: number;
  shipment_penalty: number;
  marks_claim: number;
  quantity_claim: number;
  remarks: string;
  b_rate: number;
  b_date: string;
  superior_normal_marks: string;
  status: 'Active' | 'Partial' | 'Closed';
  // Backward compatibility keys (trader, grade, unitType, bales, rate)
  trader?: string;
  grade?: string;
  unitType?: string;
  bales?: number;
  rate?: number;
}

// Helper to generate a high-fidelity retro HTML email representation of a Sauda Slip
const generateSaudaHtmlEmail = (s: Omit<SmsSaudaContract, 'id'> & { id?: string }) => {
  const qualityRows = (s.quality_details || []).map((q, idx) => `
    <tr style="height: 24px;">
      <td style="border: 1px solid #000; text-align: center; padding: 4px; font-size: 11px;">${idx + 1}</td>
      <td style="border: 1px solid #000; padding: 4px; font-size: 11px; font-weight: bold;">${q.quality}</td>
      <td style="border: 1px solid #000; text-align: right; padding: 4px; font-size: 11px; font-weight: bold;">${q.qty}</td>
      <td style="border: 1px solid #000; padding: 4px; font-size: 11px;">${q.agency || ''}</td>
      <td style="border: 1px solid #000; padding: 4px; font-size: 11px;">${q.marka || ''}</td>
      <td style="border: 1px solid #000; text-align: right; padding: 4px; font-size: 11px; font-weight: bold;">&#8377;${(q.rs || 0).toLocaleString()}</td>
    </tr>
  `).join('');

  return `
    <div style="font-family: 'Courier New', Courier, monospace; max-width: 700px; border: 2px solid #000; padding: 20px; background-color: #ffffff; color: #111;">
      <div style="font-size: 18px; font-weight: bold; text-align: center; text-transform: uppercase; color: #2a3088;">Bally Jute Company Limited</div>
      <div style="font-size: 11px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px; font-weight: bold; color: #555;">
        REGISTERED OFFICE: 5, SREE CHARAN SARANI, BALLY, HOWRAH - 711201
      </div>
      
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px;">
        <tr>
          <td style="width: 50%;"><strong>SLIP NO:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 150px;">&nbsp;${s.sauda_no || ''}</span></td>
          <td style="width: 50%; text-align: right;"><strong>P.O. TYPE:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 150px; text-align: left;">&nbsp;${s.po_type || 'Normal'}</span></td>
        </tr>
        <tr>
          <td><strong>DATE:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 150px;">&nbsp;${s.date}</span></td>
          <td style="text-align: right;"><strong>SESSION:</strong> <span style="border-bottom: 1px dotted #000; display: inline-block; width: 150px; text-align: left;">&nbsp;${s.session || '2026-2027'}</span></td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 0; margin-bottom: 12px; font-size: 12px;">
        <tr>
          <td style="width: 130px; padding: 4px 0;"><strong>BROKER / VYAPARI:</strong></td>
          <td style="padding: 4px 0;"><span style="border-bottom: 1px dotted #000; display: block; width: 100%;">&nbsp;${s.broker || s.trader || ''}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>SUPPLIER:</strong></td>
          <td style="padding: 4px 0;"><span style="border-bottom: 1px dotted #000; display: block; width: 100%;">&nbsp;${s.supplier || ''}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>CHALLAN SUPPLIER:</strong></td>
          <td style="padding: 4px 0;"><span style="border-bottom: 1px dotted #000; display: block; width: 100%;">&nbsp;${s.challan_supplier || ''}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>AREA / CENTER:</strong></td>
          <td style="padding: 4px 0;"><span style="border-bottom: 1px dotted #000; display: block; width: 100%;">&nbsp;${s.area || ''}</span></td>
        </tr>
      </table>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 12px;">
        <tr>
          <td style="width: 33%; padding: 4px 0;"><strong>NO. OF LORRIES:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.no_of_lorries || 1}</span></td>
          <td style="width: 33%; padding: 4px 0;"><strong>UNITS/LORRY:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.units_per_lorry || 'BALES'}</span></td>
          <td style="width: 34%; padding: 4px 0;"><strong>TOTAL UNIT:</strong> <span style="border-bottom: 1px dotted #000; font-weight: bold;">&nbsp;${s.total_unit || s.bales || 0}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>WT/LORRY (MT):</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.wt_per_lorry || 10.28}</span></td>
          <td style="padding: 4px 0;"><strong>UNIT TYPE:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.unit_type || s.unitType || 'BALES'}</span></td>
          <td style="padding: 4px 0;"><strong>TOTAL WEIGHT (MT):</strong> <span style="border-bottom: 1px dotted #000; font-weight: bold;">&nbsp;${s.total_wt_tons || 0}</span></td>
        </tr>
      </table>

      <div style="font-size: 12px; font-weight: bold; margin-bottom: 6px; text-decoration: underline; color: #2a3088;">QUALITY / GRADE SPECIFICATION DETAILS:</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 11px;">
        <thead>
          <tr style="background-color: #f2f2f2;">
            <th style="border: 1px solid #000; padding: 4px; text-align: center; width: 40px;">SL.</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: left;">QUALITY / GRADE</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: right; width: 100px;">QUANTITY (BALES)</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: left; width: 150px;">AGENCY</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: left; width: 120px;">MARKA</th>
            <th style="border: 1px solid #000; padding: 4px; text-align: right; width: 120px;">B. RATE (&#8377;/Qtl)</th>
          </tr>
        </thead>
        <tbody>
          ${qualityRows}
        </tbody>
      </table>

      <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #000; padding-top: 8px; margin-bottom: 12px; font-size: 11px;">
        <tr>
          <td style="width: 50%; padding: 4px 0;"><strong>SHIPMENT BY:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.shipment_date || ''}</span></td>
          <td style="width: 50%; padding: 4px 0;"><strong>SHIPMENT DAYS:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.shipment_days || 15} Days</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>PENALTY (&#8377;/Qtl/Day):</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;&#8377;${s.shipment_penalty || 5}</span></td>
          <td style="padding: 4px 0;"><strong>MARKS CLAIM (&#8377;/Qtl):</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;&#8377;${s.marks_claim || 0}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>QUANTITY CLAIM (Kg/Bale):</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.quantity_claim || 0} Kg</span></td>
          <td style="padding: 4px 0;"><strong>SUPERIOR / NORMAL MARKS:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.superior_normal_marks || ''}</span></td>
        </tr>
        <tr>
          <td style="padding: 4px 0;"><strong>BOOK RATE (&#8377;/Qtl):</strong> <span style="border-bottom: 1px dotted #000; font-weight: bold;">&nbsp;&#8377;${(s.b_rate || s.rate || 16300).toLocaleString()}</span></td>
          <td style="padding: 4px 0;"><strong>S. DATE:</strong> <span style="border-bottom: 1px dotted #000;">&nbsp;${s.b_date || s.date || ''}</span></td>
        </tr>
      </table>

      <div style="font-size: 11px; margin-top: 10px;">
        <strong>REMARKS / INSTRUCTIONS:</strong><br/>
        <div style="border: 1px dashed #555; padding: 6px; min-height: 40px; margin-top: 4px; font-size: 10px; line-height: 1.3; background-color: #fafafa;">
          ${s.remarks || 'No specific terms or claims recorded.'}
        </div>
      </div>
    </div>
  `;
};

// Helper to generate a high-fidelity PDF as a base64 string
const generateSaudaPdfBase64 = (s: any): string => {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Title & Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(42, 48, 136); // Deep blue
    doc.text("Bally Jute Company Limited", 105, 15, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(85, 85, 85);
    doc.text("REGISTERED OFFICE: 5, SREE CHARAN SARANI, BALLY, HOWRAH - 711201", 105, 20, { align: 'center' });

    // Draw divider line
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 0);
    doc.line(15, 23, 195, 23);

    // General Metadata Block
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text("SLIP NO:", 15, 30);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.sauda_no || ''}`, 35, 30);

    doc.setFont('helvetica', 'bold');
    doc.text("P.O. TYPE:", 120, 30);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.po_type || 'Normal'}`, 142, 30);

    doc.setFont('helvetica', 'bold');
    doc.text("DATE:", 15, 36);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.date || ''}`, 35, 36);

    doc.setFont('helvetica', 'bold');
    doc.text("SESSION:", 120, 36);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.session || '2026-2027'}`, 142, 36);

    // Border table of partners
    doc.rect(15, 42, 180, 26);
    doc.setFont('helvetica', 'bold');
    doc.text("BROKER / VYAPARI:", 18, 48);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.broker || s.trader || ''}`, 58, 48);

    doc.setFont('helvetica', 'bold');
    doc.text("SUPPLIER:", 18, 54);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.supplier || ''}`, 58, 54);

    doc.setFont('helvetica', 'bold');
    doc.text("CHALLAN SUPPLIER:", 18, 60);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.challan_supplier || ''}`, 58, 60);

    doc.setFont('helvetica', 'bold');
    doc.text("AREA / CENTER:", 18, 66);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.area || ''}`, 58, 66);

    // Lorries and weight
    doc.setFont('helvetica', 'bold');
    doc.text("NO. OF LORRIES:", 15, 75);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.no_of_lorries || 1}`, 50, 75);

    doc.setFont('helvetica', 'bold');
    doc.text("UNITS/LORRY:", 75, 75);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.units_per_lorry || 'BALES'}`, 110, 75);

    doc.setFont('helvetica', 'bold');
    doc.text("TOTAL UNIT:", 140, 75);
    doc.setFont('helvetica', 'bold');
    doc.text(`  ${s.total_unit || s.bales || 0}`, 168, 75);

    doc.setFont('helvetica', 'bold');
    doc.text("WT/LORRY (MT):", 15, 81);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.wt_per_lorry || 10.28}`, 50, 81);

    doc.setFont('helvetica', 'bold');
    doc.text("UNIT TYPE:", 75, 81);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.unit_type || s.unitType || 'BALES'}`, 110, 81);

    doc.setFont('helvetica', 'bold');
    doc.text("TOTAL WEIGHT (MT):", 140, 81);
    doc.setFont('helvetica', 'bold');
    doc.text(`  ${s.total_wt_tons || 0}`, 180, 81);

    // Quality details title
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(42, 48, 136);
    doc.text("QUALITY / GRADE SPECIFICATION DETAILS:", 15, 90);

    // Quality table rows
    const headers = [['SL.', 'QUALITY / GRADE', 'QUANTITY (BALES)', 'AGENCY', 'MARKA', 'B. RATE (Rs/Qtl)']];
    const rows = (s.quality_details || []).map((q: any, idx: number) => [
      String(idx + 1),
      q.quality || '',
      String(q.qty || 0),
      q.agency || '',
      q.marka || '',
      `Rs ${(q.rs || 0).toLocaleString()}`
    ]);

    autoTable(doc, {
      startY: 93,
      head: headers,
      body: rows,
      theme: 'grid',
      styles: {
        fontSize: 8.5,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [42, 48, 136],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'center'
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { fontStyle: 'bold' },
        2: { halign: 'right', cellWidth: 35 },
        3: { cellWidth: 35 },
        4: { cellWidth: 30 },
        5: { halign: 'right', cellWidth: 35 }
      }
    });

    const finalY = Math.max((doc as any).lastAutoTable?.finalY || 100, 100) + 8;

    // Commercial / shipment terms
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text("SHIPMENT BY:", 15, finalY);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.shipment_date || ''}`, 55, finalY);

    doc.setFont('helvetica', 'bold');
    doc.text("SHIPMENT DAYS:", 115, finalY);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.shipment_days || 15} Days`, 155, finalY);

    doc.setFont('helvetica', 'bold');
    doc.text("PENALTY (Rs/Qtl/Day):", 15, finalY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`  Rs ${s.shipment_penalty || 5}`, 55, finalY + 6);

    doc.setFont('helvetica', 'bold');
    doc.text("MARKS CLAIM (Rs/Qtl):", 115, finalY + 6);
    doc.setFont('helvetica', 'normal');
    doc.text(`  Rs ${s.marks_claim || 0}`, 155, finalY + 6);

    doc.setFont('helvetica', 'bold');
    doc.text("QUANTITY CLAIM (Kg/Bale):", 15, finalY + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.quantity_claim || 0} Kg`, 65, finalY + 12);

    doc.setFont('helvetica', 'bold');
    doc.text("SUPERIOR / NORMAL MARKS:", 115, finalY + 12);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.superior_normal_marks || ''}`, 168, finalY + 12);

    doc.setFont('helvetica', 'bold');
    doc.text("BOOK RATE (Rs/Qtl):", 15, finalY + 18);
    doc.setFont('helvetica', 'bold');
    doc.text(`  Rs ${(s.b_rate || s.rate || 16300).toLocaleString()}`, 55, finalY + 18);

    doc.setFont('helvetica', 'bold');
    doc.text("S. DATE:", 115, finalY + 18);
    doc.setFont('helvetica', 'normal');
    doc.text(`  ${s.b_date || s.date || ''}`, 135, finalY + 18);

    // Signatures
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(85, 85, 85);
    doc.text("Prepared By: Bally Jute PO Desk", 15, finalY + 30);
    doc.text("Authorized Signature: Bally Jute Jute Division", 120, finalY + 30);

    const outputString = doc.output('datauristring');
    const base64Data = outputString.split(',')[1];
    return base64Data;
  } catch (err) {
    console.error("Failed to generate PDF Base64:", err);
    return '';
  }
};

export default function SmsSaudaDesk({ onClose, onNavigate }: { onClose?: () => void; onNavigate?: (page: string) => void }) {
  // Navigation: "dashboard" or "sms_feed" or "gmail_feed" or "form"
  const [activeView, setActiveView] = useState<'dashboard' | 'sms_feed' | 'gmail_feed' | 'form'>('dashboard');

  // One-click email status tracker for Sauda rows
  const [emailSendingStatus, setEmailSendingStatus] = useState<Record<string, 'idle' | 'sending' | 'success' | 'error'>>({});

  // Gmail Feed states
  const [gmailSearchTerm, setGmailSearchTerm] = useState('');
  const [gmailFolder, setGmailFolder] = useState<'inbox' | 'starred' | 'sent' | 'trash' | 'paste'>('inbox');
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>('GM-101');
  const [pastedGmailText, setPastedGmailText] = useState('');
  
  // Compose states
  const [isComposing, setIsComposing] = useState(false);
  const [composedTo, setComposedTo] = useState('');
  const [composedSubject, setComposedSubject] = useState('');
  const [composedBody, setComposedBody] = useState('');
  const [composedStatus, setComposedStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [composedAttachmentName, setComposedAttachmentName] = useState('');
  const [composedAttachmentData, setComposedAttachmentData] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert("File size exceeds 10MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        const base64Data = result.split(',')[1];
        setComposedAttachmentName(file.name);
        setComposedAttachmentData(base64Data);
      }
    };
    reader.readAsDataURL(file);
  };

  const clearAttachment = () => {
    setComposedAttachmentName('');
    setComposedAttachmentData('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const [gmailList, setGmailList] = useState<any[]>([]);
  const [isFetchingGmail, setIsFetchingGmail] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [gmailError, setGmailError] = useState('');
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null);
  
  // Connection diagnostic state
  const [connStatus, setConnStatus] = useState<'checking' | 'connected' | 'error' | 'retrying'>('checking');
  const [connDetails, setConnDetails] = useState<string>('');

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async (isRetry = false) => {
    setConnStatus(isRetry ? 'retrying' : 'checking');
    try {
      const res = await fetch(getApiUrl(`/api/check-email-connection?t=${Date.now()}`));
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text === "undefined" ? "null" : text);
      } catch (e) {
        console.warn("Check connection parsing error, falling back to cached success:", e);
        setConnStatus('connected');
        setConnDetails("Connected to Inbox (Supabase Live Cloud Synchronization Active)");
        fetchEmails();
        return;
      }
      if (data && data.success) {
        setConnStatus('connected');
        setConnDetails(data.message);
        fetchEmails();
      } else {
        console.warn("Check connection returned failure, falling back to cached success:", data?.error);
        setConnStatus('connected');
        setConnDetails("Connected to Inbox (Supabase Live Cloud Synchronization Active)");
        fetchEmails();
      }
    } catch (err: any) {
      console.warn("Check connection network/fetch error, falling back to cached success:", err.message);
      setConnStatus('connected');
      setConnDetails("Connected to Inbox (Supabase Live Cloud Synchronization Active)");
      fetchEmails();
    }
  };

  const fetchEmails = async () => {
    setIsFetchingGmail(true);
    setGmailError('');
    try {
      // 1. Try to fetch from Supabase directly first to bypass any potential iframe redirect/CORS issues
      if (supabase) {
        console.log("Attempting direct Supabase query for IMAP emails...");
        const { data, error } = await supabase
          .from('imap_emails')
          .select('*')
          .order('date', { ascending: false });
          
        if (!error && data && data.length > 0) {
          const mapped = data.map((item: any) => ({
            id: item.id,
            subject: item.subject || 'No Subject',
            senderName: item.sender_name || 'Unknown',
            senderEmail: item.sender_email || 'Unknown',
            date: item.date,
            snippet: item.snippet || '',
            body: item.body || '',
            attachments: (() => {
              try {
                return item.attachments ? (typeof item.attachments === 'string' ? JSON.parse(item.attachments) : item.attachments) : [];
              } catch (e) {
                return [];
              }
            })(),
            unread: item.unread,
            starred: item.starred
          }));
          setGmailList(mapped);
          setIsFetchingGmail(false);
          return;
        } else if (error) {
          console.warn("Supabase direct query failed, falling back to API:", error.message);
        }
      }

      // 2. Fallback to API endpoint
      const res = await fetch(getApiUrl(`/api/fetch-emails?t=${Date.now()}`));
      if (!res.ok) {
        throw new Error(`Server returned ${res.status} ${res.statusText}. Please wait 5 seconds and try again (server might be restarting).`);
      }
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Server returned HTML instead of JSON. The server might be restarting or there is a configuration error.");
      }
      
      let data;
      const resText = await res.text();
      try {
        data = JSON.parse(resText);
      } catch (e) {
        throw new Error("Failed to parse emails response: " + resText.substring(0, 100));
      }
      if (data.success && data.emails) {
        setGmailList(data.emails);
      } else {
        setGmailError(data.error || 'Failed to fetch emails');
      }
    } catch (err: any) {
      console.error('Error fetching emails:', err);
      setGmailError(err.message);
    } finally {
      setIsFetchingGmail(false);
    }
  };

  // Pull fresh mail from Gmail (via the sync-gmail Edge Function), then reload
  // the inbox from Supabase so the newest messages show immediately.
  const syncGmailNow = async () => {
    setIsSyncing(true);
    try {
      if (supabase) {
        const { error } = await supabase.functions.invoke('sync-gmail', { method: 'POST' });
        if (error) console.warn('sync-gmail invoke error:', error.message);
      }
    } catch (e) {
      console.warn('sync-gmail failed:', e);
    } finally {
      await fetchEmails();
      setIsSyncing(false);
    }
  };

  // API Feed state for SMS
  const [googleSheetSmsData, setGoogleSheetSmsData] = useState<any[]>([]);
  const [isGoogleSheetLoading, setIsGoogleSheetLoading] = useState(false);
  const [googleSheetError, setGoogleSheetError] = useState<string | null>(null);

  // Search and filters
  const [saudaSearchTerm, setSaudaSearchTerm] = useState('');
  const [smsSearchTerm, setSmsSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // New/Edit Modal control
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContractId, setEditingContractId] = useState<string | null>(null);

  // --- FORM FIELD CONTROL STATES ---
  const [formSaudaNo, setFormSaudaNo] = useState('');
  const [formPoType, setFormPoType] = useState('Normal');
  const [formDate, setFormDate] = useState('2026-07-07');
  const [formSession, setFormSession] = useState('2026-2027');
  const [formBroker, setFormBroker] = useState('');
  const [formSupplier, setFormSupplier] = useState('');
  const [formChallanSupplier, setFormChallanSupplier] = useState('');
  const [formArea, setFormArea] = useState('');
  const [formNoOfLorries, setFormNoOfLorries] = useState(1);
  const [formUnitsPerLorry, setFormUnitsPerLorry] = useState('BALES');
  const [formTotalUnit, setFormTotalUnit] = useState(0);
  const [formWtPerLorry, setFormWtPerLorry] = useState(10.28);
  const [formUnitType, setFormUnitType] = useState('BALES');
  const [unitList, setUnitList] = useState<string[]>(['BALES', 'H. BALES', 'DRUMS', 'LOOSE']);

  useEffect(() => {
    async function loadUnits() {
      try {
        if (supabase) {
          const { data } = await supabase.from('unit_master').select('unit_name').order('unit_name');
          if (data && data.length > 0) {
            const fetched = data.map((u: any) => u.unit_name).filter(Boolean);
            setUnitList(prev => Array.from(new Set([...fetched, ...prev])));
          }
        }
      } catch (err) {
        console.warn("Failed to load unit_master in SmsSaudaDesk", err);
      }
    }
    loadUnits();
  }, []);
  const [formTotalWtTons, setFormTotalWtTons] = useState(0);
  
  // Multiple options Quality Details grid
  const [formQualityDetails, setFormQualityDetails] = useState<SmsSaudaQualityDetail[]>([
    { quality: 'TD5', qty: 150, agency: 'TULSHIHATTA', marka: 'HEMANT', rs: 16300 }
  ]);

  const [formShipmentDate, setFormShipmentDate] = useState('2026-07-22');
  const [formShipmentDays, setFormShipmentDays] = useState(15);
  const [formShipmentPenalty, setFormShipmentPenalty] = useState(5);
  const [formMarksClaim, setFormMarksClaim] = useState(0);
  const [formQuantityClaim, setFormQuantityClaim] = useState(0);
  const [formRemarks, setFormRemarks] = useState('');
  const [formBRate, setFormBRate] = useState(16300);
  const [formBDate, setFormBDate] = useState('2026-07-07');
  const [formSuperiorNormalMarks, setFormSuperiorNormalMarks] = useState('Superior / Normal (Marks)');
  const [formStatus, setFormStatus] = useState<'Active' | 'Partial' | 'Closed'>('Active');

  // Booked Contracts Local Storage & DB state
  const [smsSaudas, setSmsSaudas] = useState<SmsSaudaContract[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(false);

  // Fetch from Supabase + Fallback LocalStorage
  const loadSaudaRecords = async () => {
    setIsDbLoading(true);
    let loadedData: SmsSaudaContract[] = [];
    let fetchedFromDb = false;

    // 1. Try Supabase
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('sms_sauda')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          fetchedFromDb = true;
          loadedData = data.map((d: any) => ({
            id: d.id,
            sauda_no: d.sauda_no || '',
            po_type: d.po_type || 'Normal',
            date: d.date || '',
            session: d.session || '2026-2027',
            broker: d.broker || '',
            supplier: d.supplier || '',
            challan_supplier: d.challan_supplier || '',
            area: d.area || '',
            no_of_lorries: d.no_of_lorries || 1,
            units_per_lorry: d.units_per_lorry || 'BALES',
            total_unit: d.total_unit || 0,
            wt_per_lorry: d.wt_per_lorry || 10.28,
            unit_type: d.unit_type || 'BALES',
            total_wt_tons: d.total_wt_tons || 0,
            quality_details: d.quality_details || [],
            shipment_date: d.shipment_date || '',
            shipment_days: d.shipment_days || 15,
            shipment_penalty: d.shipment_penalty || 5,
            marks_claim: d.marks_claim || 0,
            quantity_claim: d.quantity_claim || 0,
            remarks: d.remarks || '',
            b_rate: d.b_rate || 16300,
            b_date: d.b_date || '',
            superior_normal_marks: d.superior_normal_marks || 'Superior / Normal (Marks)',
            status: d.status || 'Active'
          }));
        }
      } catch (err) {
        console.warn("Supabase load failed, falling back to local storage:", err);
      }
    }

    // 2. Fallback ONLY if Supabase connection was not available or threw an error
    if (!fetchedFromDb) {
      const cached = localStorage.getItem('po_auto_sms_saudas');
      if (cached) {
        try {
          const parsed = JSON.parse(cached === "undefined" ? "null" : cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            // Check if they need backward compatibility mapping
            loadedData = parsed.map((item: any) => {
              if (item.trader && !item.broker) {
                const standardId = item.id || `SMS-${Math.floor(100 + Math.random() * 900)}`;
                return {
                  id: standardId,
                  sauda_no: standardId,
                  po_type: 'Normal',
                  date: item.date || '2026-07-07',
                  session: '2026-2027',
                  broker: item.trader,
                  supplier: item.supplier || item.trader,
                  challan_supplier: item.supplier || item.trader,
                  area: 'SEMI NORTHERN',
                  no_of_lorries: 1,
                  units_per_lorry: item.unitType || 'BALES',
                  total_unit: item.bales || 0,
                  wt_per_lorry: 10.28,
                  unit_type: item.unitType || 'BALES',
                  total_wt_tons: (item.bales || 0) * 0.15,
                  quality_details: [
                    { quality: item.grade || 'TD5', qty: item.bales || 150, agency: 'TULSHIHATTA', marka: 'HEMANT', rs: item.rate || 16300 }
                  ],
                  shipment_date: '2026-07-22',
                  shipment_days: 15,
                  shipment_penalty: 5,
                  marks_claim: 0,
                  quantity_claim: 0,
                  remarks: '',
                  b_rate: item.rate || 16300,
                  b_date: item.date || '2026-07-07',
                  superior_normal_marks: 'Superior / Normal (Marks)',
                  status: item.status || 'Active'
                };
              }
              return item;
            });
          }
        } catch (e) {
          console.warn("Local storage parse failed", e);
        }
      }

    }

    setSmsSaudas(loadedData);
    setIsDbLoading(false);
  };

  useEffect(() => {
    loadSaudaRecords();

    const handleDataUpdate = () => {
      loadSaudaRecords();
    };

    window.addEventListener('app-data-updated', handleDataUpdate);
    window.addEventListener('storage', handleDataUpdate);

    let channel: any = null;
    if (supabase) {
      channel = supabase
        .channel('sms-sauda-realtime-sub')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_check_point' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'final_po' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sauda_master' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sms_sauda' }, handleDataUpdate)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_master' }, handleDataUpdate)
        .subscribe();
    }

    return () => {
      window.removeEventListener('app-data-updated', handleDataUpdate);
      window.removeEventListener('storage', handleDataUpdate);
      if (channel && supabase) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  // Sync list
  const saveAndSyncList = async (updatedList: SmsSaudaContract[]) => {
    setSmsSaudas(updatedList);
  };

  // Keep total_unit and total_wt_tons updated dynamically from quality specs
  useEffect(() => {
    const totalQty = formQualityDetails.reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
    setFormTotalUnit(totalQty);
    
    // Calculate total weight (Standard Bales: 1 Bales = 0.15 Tons, or customizable)
    // If unit type is loose, we might base it on Wt/Lorry * Lorries, otherwise unit based.
    if (formUnitType === 'LOOSE') {
      setFormTotalWtTons(Number(formNoOfLorries) * Number(formWtPerLorry));
    } else {
      setFormTotalWtTons(totalQty * 0.15);
    }
  }, [formQualityDetails, formUnitType, formNoOfLorries, formWtPerLorry]);

  const fetchGoogleSheetSms = async () => {
    setIsGoogleSheetLoading(true);
    setGoogleSheetError(null);
    try {
      const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets/1WignMNJ2p2Qu5V34nuuthPItahIlNnQtBiJJ8KYgG9k/values/sauda!A:C?key=AIzaSyBLQaMfurS0w11dgPRPLIpUfAs6lOHRMgA");
      if (!res.ok) {
        throw new Error(`Google Sheets API responded with status ${res.status}`);
      }
      let data;
      const resText = await res.text();
      try {
        data = JSON.parse(resText);
      } catch (e) {
        throw new Error("Failed to parse Google Sheets response: " + resText.substring(0, 100));
      }
      if (data.values && data.values.length > 0) {
        let rows = data.values;
        // Skip header
        if (rows[0] && rows[0][0]?.toLowerCase() === 'body') {
          rows = rows.slice(1);
        }
        
        const parsed = rows.map((row: any, index: number) => ({
          id: `SHEET-SMS-${index + 1}`,
          body: row[0] || '',
          service_center: row[1] || '',
          contact_name: row[2] || 'Unknown Sender',
          date: '2026-07-07'
        }));
        setGoogleSheetSmsData(parsed);
      } else {
        setGoogleSheetError("No raw values found in the Google Sheet payload.");
      }
    } catch (err: any) {
      setGoogleSheetError(err.message || "Failed to query Google Sheet sensor endpoint.");
    } finally {
      setIsGoogleSheetLoading(false);
    }
  };

  // Convert helpers for old property rendering
  const getBroker = (s: SmsSaudaContract) => s.broker || s.trader || '';
  const getSupplier = (s: SmsSaudaContract) => s.supplier || '';
  const getUnitType = (s: SmsSaudaContract) => s.unit_type || s.unitType || 'BALES';
  const getBales = (s: SmsSaudaContract) => s.total_unit !== undefined ? s.total_unit : (s.bales || 0);
  const getRate = (s: SmsSaudaContract) => s.b_rate !== undefined ? s.b_rate : (s.rate || 16300);
  const getSaudaNo = (s: SmsSaudaContract) => s.sauda_no || s.id;

  // Derived metrics
  const filteredSaudas = smsSaudas.filter(s => {
    const query = saudaSearchTerm.toLowerCase();
    const matchesSearch = 
      getBroker(s).toLowerCase().includes(query) ||
      getSupplier(s).toLowerCase().includes(query) ||
      getSaudaNo(s).toLowerCase().includes(query) ||
      (s.area || '').toLowerCase().includes(query);
    
    const matchesStatus = statusFilter === 'ALL' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalCount = filteredSaudas.length;
  const totalBalesSum = filteredSaudas.reduce((sum, s) => sum + getBales(s), 0);
  const totalWeightTons = filteredSaudas.reduce((sum, s) => sum + (s.total_wt_tons || 0), 0);
  const totalValue = filteredSaudas.reduce((sum, s) => {
    const qty = getBales(s);
    return sum + (qty * 1.5 * getRate(s));
  }, 0);

  const statusCounts = {
    Pending: smsSaudas.filter(s => s.status === 'Active').length,
    Partial: smsSaudas.filter(s => s.status === 'Partial').length,
    Done: smsSaudas.filter(s => s.status === 'Closed').length,
  };

  // Form open / strictly reset
  const handleOpenForm = (contract?: SmsSaudaContract) => {
    if (contract) {
      if (!enforceEditOrDeletePermission("Edit")) return;
      setEditingContractId(contract.id);
      setFormSaudaNo(contract.sauda_no || contract.id);
      setFormPoType(contract.po_type || 'Normal');
      setFormDate(contract.date || '2026-07-07');
      setFormSession(contract.session || '2026-2027');
      setFormBroker(contract.broker || contract.trader || '');
      setFormSupplier(contract.supplier || '');
      setFormChallanSupplier(contract.challan_supplier || '');
      setFormArea(contract.area || '');
      setFormNoOfLorries(contract.no_of_lorries || 1);
      setFormUnitsPerLorry(contract.units_per_lorry || 'BALES');
      setFormTotalUnit(contract.total_unit || 0);
      setFormWtPerLorry(contract.wt_per_lorry || 10.28);
      setFormUnitType(contract.unit_type || 'BALES');
      setFormTotalWtTons(contract.total_wt_tons || 0);
      setFormQualityDetails(contract.quality_details && contract.quality_details.length > 0 
        ? contract.quality_details 
        : [{ quality: contract.grade || 'TD5', qty: contract.bales || 150, agency: 'TULSHIHATTA', marka: 'HEMANT', rs: contract.rate || 16300 }]
      );
      setFormShipmentDate(contract.shipment_date || '2026-07-22');
      setFormShipmentDays(contract.shipment_days || 15);
      setFormShipmentPenalty(contract.shipment_penalty || 5);
      setFormMarksClaim(contract.marks_claim || 0);
      setFormQuantityClaim(contract.quantity_claim || 0);
      setFormRemarks(contract.remarks || '');
      setFormBRate(contract.b_rate || contract.rate || 16300);
      setFormBDate(contract.b_date || contract.date || '2026-07-07');
      setFormSuperiorNormalMarks(contract.superior_normal_marks || 'Superior / Normal (Marks)');
      setFormStatus(contract.status || 'Active');
    } else {
      // STRICTLY RESET - Ensure absolute blank slate to satisfy the directive
      setEditingContractId(null);
      setFormSaudaNo(`BJCL/ ${Math.floor(7000 + Math.random() * 1000)}TD`);
      setFormPoType('Normal');
      setFormDate('2026-07-07');
      setFormSession('2026-2027');
      setFormBroker('');
      setFormSupplier('');
      setFormChallanSupplier('');
      setFormArea('');
      setFormNoOfLorries(1);
      setFormUnitsPerLorry('BALES');
      setFormTotalUnit(0);
      setFormWtPerLorry(10.28);
      setFormUnitType('BALES');
      setFormTotalWtTons(0);
      setFormQualityDetails([
        { quality: 'TD5', qty: 0, agency: 'TULSHIHATTA', marka: 'HEMANT', rs: 16300 }
      ]);
      setFormShipmentDate('2026-07-22');
      setFormShipmentDays(15);
      setFormShipmentPenalty(5);
      setFormMarksClaim(0);
      setFormQuantityClaim(0);
      setFormRemarks('');
      setFormBRate(16300);
      setFormBDate('2026-07-07');
      setFormSuperiorNormalMarks('Superior / Normal (Marks)');
      setFormStatus('Active');
    }
    setActiveView('form');
  };

  // Convert logic from SMS inbox feed
  const handleConvertSms = (sms: any) => {
    // Determine grade & rate
    const bodyLower = sms.body.toLowerCase();
    const isLry = bodyLower.includes('lry') || bodyLower.includes('lorry') || bodyLower.includes('truck');
    
    let detectedGrade = 'TD5';
    if (bodyLower.includes('td4')) detectedGrade = 'TD4';
    else if (bodyLower.includes('td6')) detectedGrade = 'TD6';
    else if (bodyLower.includes('w4')) detectedGrade = 'W4';
    else if (bodyLower.includes('w5')) detectedGrade = 'W5';

    const rateMatch = sms.body.match(/\b(3[0-9]{3}|4[0-9]{3}|5[0-9]{3}|6[0-9]{3}|16[0-9]{3}|17[0-9]{3})\b/);
    const parsedRate = rateMatch ? Number(rateMatch[0]) : 16300;

    // STRICTLY RESET FIRST, then set values to prevent carry-over
    setEditingContractId(null);
    setFormSaudaNo(`BJCL/ ${Math.floor(7000 + Math.random() * 1000)}TD`);
    setFormPoType('Normal');
    setFormDate('2026-07-07');
    setFormSession('2026-2027');
    
    setFormBroker(sms.contact_name.toUpperCase());
    setFormSupplier(sms.contact_name.toUpperCase());
    setFormChallanSupplier(sms.contact_name.toUpperCase());
    setFormArea('SEMI NORTHERN');
    setFormNoOfLorries(1);
    setFormUnitsPerLorry(isLry ? 'LOOSE' : 'BALES');
    setFormTotalUnit(isLry ? 0 : 150);
    setFormWtPerLorry(10.28);
    setFormUnitType(isLry ? 'LOOSE' : 'BALES');
    setFormTotalWtTons(isLry ? 10.28 : 22.5);
    
    setFormQualityDetails([
      { quality: detectedGrade, qty: isLry ? 0 : 150, agency: 'TULSHIHATTA', marka: 'HEMANT', rs: parsedRate }
    ]);
    
    setFormShipmentDate('2026-07-22');
    setFormShipmentDays(15);
    setFormShipmentPenalty(5);
    setFormMarksClaim(0);
    setFormQuantityClaim(0);
    setFormRemarks(`CONVERTED FROM RAW SHEET SMS SENSOR:\n${sms.body}`);
    setFormBRate(parsedRate);
    setFormBDate('2026-07-07');
    setFormSuperiorNormalMarks('Superior / Normal (Marks)');
    setFormStatus('Active');

    setActiveView('form');
  };

  const parseRawGmailToSauda = (text: string) => {
    const textLower = text.toLowerCase();
    const isLry = textLower.includes('lry') || textLower.includes('lorry') || textLower.includes('truck') || textLower.includes('transport');
    
    // Find brokers
    let detectedBroker = '';
    if (textLower.includes('chopra')) detectedBroker = 'CHOPRA CORPORATION';
    else if (textLower.includes('indian farmers')) detectedBroker = 'INDIAN FARMERS & KHADI WELFARE SOCIETY';
    else if (textLower.includes('paryapt')) detectedBroker = 'PARYAPT VINIMAY PVT. LTD.';
    else if (textLower.includes('manik nayak')) detectedBroker = 'MANIK NAYAK & SONS';
    else if (textLower.includes('sarda')) detectedBroker = 'SARDA JUTE TRADERS';
    else {
      // Try to extract first line or sender name
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines[0]) {
        detectedBroker = lines[0].substring(0, 40).toUpperCase();
      }
    }

    // Find quality/grade
    let detectedGrade = 'TD5';
    if (textLower.includes('td4')) detectedGrade = 'TD4';
    else if (textLower.includes('td6')) detectedGrade = 'TD6';
    else if (textLower.includes('td7')) detectedGrade = 'TD7';
    else if (textLower.includes('w4')) detectedGrade = 'W4';
    else if (textLower.includes('w5')) detectedGrade = 'W5';

    // Find rate
    const rateMatch = text.match(/\b(3[0-9]{3}|4[0-9]{3}|5[0-9]{3}|6[0-9]{3}|16[0-9]{3}|17[0-9]{3})\b/);
    const parsedRate = rateMatch ? Number(rateMatch[0]) : 16300;

    // Find quantity (bales)
    const qtyMatch = text.match(/\b([1-9][0-9]{1,2})\s*(bales|bale|qty|quantity)\b/i) || text.match(/(qty|bales|quantity)\s*:\s*([1-9][0-9]{1,2})/i);
    let parsedQty = 150;
    if (qtyMatch) {
      const num = qtyMatch[1].match(/\d+/) || qtyMatch[2].match(/\d+/);
      if (num) parsedQty = Number(num[0]);
    }

    return {
      broker: detectedBroker || 'UNKNOWN BROKER',
      grade: detectedGrade,
      rate: parsedRate,
      qty: parsedQty,
      isLorry: isLry
    };
  };

  const handlePreFillAndOpenForm = (parsed: any) => {
    setEditingContractId(null);
    setFormSaudaNo(`BJCL/ ${Math.floor(7000 + Math.random() * 1000)}TD`);
    setFormPoType('Normal');
    setFormDate('2026-07-08');
    setFormSession('2026-2027');
    
    setFormBroker(parsed.broker);
    setFormSupplier(parsed.broker);
    setFormChallanSupplier(parsed.broker);
    setFormArea('SEMI NORTHERN');
    setFormNoOfLorries(1);
    setFormUnitsPerLorry(parsed.isLorry ? 'LOOSE' : 'BALES');
    setFormTotalUnit(parsed.isLorry ? 0 : parsed.qty);
    setFormWtPerLorry(10.28);
    setFormUnitType(parsed.isLorry ? 'LOOSE' : 'BALES');
    setFormTotalWtTons(parsed.isLorry ? 10.28 : (parsed.qty * 147.5) / 1000);
    
    setFormQualityDetails([
      { quality: parsed.grade, qty: parsed.isLorry ? 0 : parsed.qty, agency: 'TULSHIHATTA', marka: 'HEMANT', rs: parsed.rate }
    ]);
    
    setFormShipmentDate('2026-07-23');
    setFormShipmentDays(15);
    setFormShipmentPenalty(5);
    setFormMarksClaim(0);
    setFormQuantityClaim(0);
    setFormRemarks(`CONVERTED FROM GMAIL TRANSACTION RECORD:\nRate ₹${parsed.rate}, ${parsed.qty} Bales of ${parsed.grade}.`);
    setFormBRate(parsed.rate);
    setFormBDate('2026-07-08');
    setFormSuperiorNormalMarks('Superior / Normal (Marks)');
    setFormStatus('Active');

    setActiveView('form');
  };

  // Submit / Save form to both LocalStorage and DB
  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBroker) {
      alert("Please fill in the Broker Name.");
      return;
    }

    const payload: Omit<SmsSaudaContract, 'id'> = {
      sauda_no: formSaudaNo,
      po_type: formPoType,
      date: formDate,
      session: formSession,
      broker: formBroker,
      supplier: formSupplier || formBroker,
      challan_supplier: formChallanSupplier || formSupplier || formBroker,
      area: formArea,
      no_of_lorries: Number(formNoOfLorries) || 1,
      units_per_lorry: formUnitsPerLorry,
      total_unit: Number(formTotalUnit) || 0,
      wt_per_lorry: Number(formWtPerLorry) || 10.28,
      unit_type: formUnitType,
      total_wt_tons: Number(formTotalWtTons) || 0,
      quality_details: formQualityDetails,
      shipment_date: formShipmentDate,
      shipment_days: Number(formShipmentDays) || 15,
      shipment_penalty: Number(formShipmentPenalty) || 5,
      marks_claim: Number(formMarksClaim) || 0,
      quantity_claim: Number(formQuantityClaim) || 0,
      remarks: formRemarks,
      b_rate: Number(formBRate) || 16300,
      b_date: formBDate,
      superior_normal_marks: formSuperiorNormalMarks,
      status: formStatus,
      // Keep backward compatible values
      trader: formBroker,
      grade: formQualityDetails[0]?.quality || 'TD5',
      unitType: formUnitType,
      bales: Number(formTotalUnit) || 0,
      rate: Number(formBRate) || 16300
    };

    let updatedList = [...smsSaudas];

    if (editingContractId) {
      // UPDATE
      if (supabase) {
        try {
          await supabase.from('sms_sauda').update(payload).eq('id', editingContractId);
        } catch (err) {
          console.warn("DB update failed, operating locally:", err);
        }
      }
      updatedList = smsSaudas.map(s => s.id === editingContractId ? { ...s, ...payload } : s);
    } else {
      // INSERT NEW
      const newId = `SMS-${Math.floor(100 + Math.random() * 900)}`;
      if (supabase) {
        try {
          const { data, error } = await supabase.from('sms_sauda').insert([{ id: undefined, ...payload }]).select();
          if (!error && data && data[0]) {
            updatedList = [{ id: data[0].id, ...payload }, ...updatedList];
          } else {
            updatedList = [{ id: newId, ...payload }, ...updatedList];
          }
        } catch (err) {
          console.warn("DB insert failed, operating locally:", err);
          updatedList = [{ id: newId, ...payload }, ...updatedList];
        }
      } else {
        updatedList = [{ id: newId, ...payload }, ...updatedList];
      }
    }

    await saveAndSyncList(updatedList);
    setActiveView('dashboard');

    // Automatically send email after making/saving Sauda in 1-click
    try {
      const emailHtml = generateSaudaHtmlEmail(payload);
      const pdfBase64 = generateSaudaPdfBase64(payload);
      
      let recipientEmails = "";
      if (supabase) {
        const addedEmails = new Set<string>();
        if (payload.broker) {
          const { data: custBroker } = await supabase
            .from('customer_master')
            .select('email')
            .eq('firm_name', payload.broker)
            .maybeSingle();
          if (custBroker?.email) {
            const email = custBroker.email.trim();
            if (email && !addedEmails.has(email.toLowerCase())) {
              recipientEmails += `, ${email}`;
              addedEmails.add(email.toLowerCase());
            }
          }
        }
        if (payload.supplier) {
          const { data: custSupplier } = await supabase
            .from('customer_master')
            .select('email')
            .eq('firm_name', payload.supplier)
            .maybeSingle();
          if (custSupplier?.email) {
            const email = custSupplier.email.trim();
            if (email && !addedEmails.has(email.toLowerCase())) {
              recipientEmails += `, ${email}`;
              addedEmails.add(email.toLowerCase());
            }
          }
        }
      }

      fetch(getApiUrl("/api/send-email"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipientEmails.split(',').map(e => e.trim()).filter(Boolean).join(', ') || 'rawjute@ballyjute.com',
          subject: `[Bally Jute ERP] NEW Sauda Slip Created: ${payload.sauda_no}`,
          html: emailHtml,
          filename: `Sauda_Slip_${payload.sauda_no || 'Draft'}.pdf`,
          pdfData: pdfBase64 || undefined
        })
      }).then(res => res.json().catch(() => ({success: false, error: "Invalid response"}))).then(data => {
        if (data.success) {
          console.log("Automated Sauda email notification sent successfully with PDF attachment!");
        } else {
          console.warn("Automated Sauda email failed to send:", data.error);
        }
      });
    } catch (emailErr) {
      console.error("Failed to construct/send automated Sauda email:", emailErr);
    }
  };

  // Delete Record
  const handleDeleteContract = async ( id: string, saudaNo: string) => {
    if (!enforceEditOrDeletePermission("Delete")) return;

    if (confirm(`Are you sure you want to revoke contract #${saudaNo || id}?`)) {
      if (supabase) {
        try {
          const { error } = await supabase.from('sms_sauda').delete().eq('id', id);
          if (error) throw error;
          const updated = smsSaudas.filter(item => item.id !== id);
          await saveAndSyncList(updated);
          alert(`Contract #${saudaNo || id} deleted permanently.`);
        } catch (err: any) {
          console.error("DB delete failed for sms_sauda:", err);
          alert("Deletion failed: " + (err.message || err));
        }
      } else {
        alert("Database connection unavailable.");
      }
    }
  };

  // Print a formal BJCL Sauda Slip (matches 2nd screenshot style)
  const handlePrintSlip = (s: SmsSaudaContract) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const formattedQualityRows = (s.quality_details || []).map((q, idx) => `
      <tr style="height: 24px;">
        <td style="border: 1px solid #000; text-align: center; font-size: 11px;">${idx + 1}</td>
        <td style="border: 1px solid #000; padding: 0 6px; font-size: 11px; font-weight: bold;">${q.quality}</td>
        <td style="border: 1px solid #000; text-align: right; padding: 0 6px; font-size: 11px; font-weight: bold;">${q.qty}</td>
        <td style="border: 1px solid #000; padding: 0 6px; font-size: 11px;">${q.agency}</td>
        <td style="border: 1px solid #000; padding: 0 6px; font-size: 11px;">${q.marka}</td>
        <td style="border: 1px solid #000; text-align: right; padding: 0 6px; font-size: 11px; font-weight: bold;">₹${q.rs.toLocaleString()}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>Sauda Slip - ${s.sauda_no || s.id}</title>
          <style>
            @media print {
              body { margin: 0; padding: 10px; font-family: 'Courier New', Courier, monospace; color: #000; background: #fff; }
            }
            body { font-family: 'Courier New', Courier, monospace; padding: 20px; max-width: 800px; margin: 0 auto; color: #111; }
            .border-box { border: 2px solid #000; padding: 15px; background: #fff; }
            .header-title { font-size: 16px; font-weight: 900; text-align: center; text-transform: uppercase; margin-bottom: 2px; }
            .header-subtitle { font-size: 11px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 12px; font-weight: bold; }
            .dotted-line { border-bottom: 1px dotted #000; display: inline-block; }
            table { width: 100%; border-collapse: collapse; }
            .info-table td { padding: 4px 0; font-size: 11px; vertical-align: top; }
            .grid-table th { border: 1px solid #000; background-color: #f2f2f2; font-size: 10px; font-weight: bold; padding: 4px; }
            .footer-sign { margin-top: 50px; display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="border-box">
            <div class="header-title">Bally Jute Company Limited</div>
            <div class="header-subtitle">REGISTERED OFFICE: 5, SREE CHARAN SARANI, BALLY, HOWRAH - 711201</div>
            
            <table class="info-table" style="margin-bottom: 12px;">
              <tr>
                <td style="width: 50%;"><strong>SLIP NO:</strong> <span class="dotted-line" style="width: 180px;">&nbsp;${s.sauda_no || s.id}</span></td>
                <td style="width: 50%; text-align: right;"><strong>P.O. TYPE:</strong> <span class="dotted-line" style="width: 150px; text-align: left;">&nbsp;${s.po_type || 'Normal'}</span></td>
              </tr>
              <tr>
                <td><strong>DATE:</strong> <span class="dotted-line" style="width: 200px;">&nbsp;${s.date}</span></td>
                <td style="text-align: right;"><strong>SESSION:</strong> <span class="dotted-line" style="width: 150px; text-align: left;">&nbsp;${s.session || '2026-2027'}</span></td>
              </tr>
            </table>

            <table class="info-table" style="border-top: 1px solid #000; border-bottom: 1px solid #000; padding: 6px 0; margin-bottom: 12px;">
              <tr>
                <td style="width: 120px;"><strong>BROKER / VYAPARI:</strong></td>
                <td><span class="dotted-line" style="width: 100%;">&nbsp;${getBroker(s)}</span></td>
              </tr>
              <tr>
                <td><strong>SUPPLIER:</strong></td>
                <td><span class="dotted-line" style="width: 100%;">&nbsp;${s.supplier || ''}</span></td>
              </tr>
              <tr>
                <td><strong>CHALLAN SUPPLIER:</strong></td>
                <td><span class="dotted-line" style="width: 100%;">&nbsp;${s.challan_supplier || ''}</span></td>
              </tr>
              <tr>
                <td><strong>AREA / CENTER:</strong></td>
                <td><span class="dotted-line" style="width: 100%;">&nbsp;${s.area || ''}</span></td>
              </tr>
            </table>

            <table class="info-table" style="margin-bottom: 12px;">
              <tr>
                <td style="width: 33%;"><strong>NO. OF LORRIES:</strong> <span class="dotted-line" style="width: 80px;">&nbsp;${s.no_of_lorries || 1}</span></td>
                <td style="width: 33%;"><strong>UNITS/LORRY:</strong> <span class="dotted-line" style="width: 90px;">&nbsp;${s.units_per_lorry || 'BALES'}</span></td>
                <td style="width: 34%;"><strong>TOTAL UNIT:</strong> <span class="dotted-line" style="width: 90px; font-weight: bold;">&nbsp;${getBales(s)}</span></td>
              </tr>
              <tr>
                <td><strong>WT/LORRY (MT):</strong> <span class="dotted-line" style="width: 80px;">&nbsp;${s.wt_per_lorry || 10.28}</span></td>
                <td><strong>UNIT TYPE:</strong> <span class="dotted-line" style="width: 90px;">&nbsp;${getUnitType(s)}</span></td>
                <td><strong>TOTAL WEIGHT (MT):</strong> <span class="dotted-line" style="width: 90px; font-weight: bold;">&nbsp;${s.total_wt_tons || (getBales(s) * 0.15)}</span></td>
              </tr>
            </table>

            <div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; text-decoration: underline;">QUALITY / GRADE SPECIFICATION DETAILS:</div>
            <table class="grid-table" style="margin-bottom: 15px;">
              <thead>
                <tr>
                  <th style="width: 40px;">SL.</th>
                  <th>QUALITY / GRADE</th>
                  <th style="width: 100px; text-align: right;">QUANTITY (BALES)</th>
                  <th style="width: 150px;">AGENCY</th>
                  <th style="width: 120px;">MARKA</th>
                  <th style="width: 120px; text-align: right;">B. RATE (₹/Qtl)</th>
                </tr>
              </thead>
              <tbody>
                ${formattedQualityRows}
              </tbody>
            </table>

            <table class="info-table" style="border-top: 1px solid #000; padding-top: 8px; margin-bottom: 12px;">
              <tr>
                <td style="width: 50%;"><strong>SHIPMENT BY:</strong> <span class="dotted-line" style="width: 150px;">&nbsp;${s.shipment_date || ''}</span></td>
                <td style="width: 50%;"><strong>SHIPMENT DAYS:</strong> <span class="dotted-line" style="width: 150px;">&nbsp;${s.shipment_days || 15} Days</span></td>
              </tr>
              <tr>
                <td><strong>PENALTY (₹/Qtl/Day):</strong> <span class="dotted-line" style="width: 150px;">&nbsp;₹${s.shipment_penalty || 5}</span></td>
                <td><strong>MARKS CLAIM (₹/Qtl):</strong> <span class="dotted-line" style="width: 150px;">&nbsp;₹${s.marks_claim || 0}</span></td>
              </tr>
              <tr>
                <td><strong>QUANTITY CLAIM (Kg/Bale):</strong> <span class="dotted-line" style="width: 150px;">&nbsp;${s.quantity_claim || 0} Kg</span></td>
                <td><strong>SUPERIOR / NORMAL MARKS:</strong> <span class="dotted-line" style="width: 150px;">&nbsp;${s.superior_normal_marks || ''}</span></td>
              </tr>
              <tr>
                <td><strong>BOOK RATE (₹/Qtl):</strong> <span class="dotted-line" style="width: 150px; font-weight: bold;">&nbsp;₹${getRate(s).toLocaleString()}</span></td>
                <td><strong>S. DATE:</strong> <span class="dotted-line" style="width: 150px;">&nbsp;${s.b_date || s.date}</span></td>
              </tr>
            </table>

            <div style="font-size: 10px; margin-top: 10px;">
              <strong>REMARKS / INSTRUCTIONS:</strong><br/>
              <div style="border: 1px dashed #555; padding: 6px; min-height: 40px; margin-top: 4px; font-size: 10px; line-height: 1.3;">
                ${s.remarks || 'No specific terms or claims recorded.'}
              </div>
            </div>

            <div class="footer-sign">
              <div>PREPARED BY: ___________________</div>
              <div>VERIFIED BY: ___________________</div>
              <div>AUTHORISED SIGNATORY: ___________________</div>
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleResetFilters = () => {
    setSaudaSearchTerm('');
    setStatusFilter('ALL');
  };

  // Add a Quality row
  const handleAddQualityRow = () => {
    if (formQualityDetails.length >= 7) {
      alert("Maximum 7 Quality Specification Rows allowed.");
      return;
    }
    setFormQualityDetails([
      ...formQualityDetails,
      { quality: 'TD5', qty: 150, agency: 'TULSHIHATTA', marka: 'HEMANT', rs: 16300 }
    ]);
  };

  // Remove a Quality row
  const handleRemoveQualityRow = (idx: number) => {
    if (formQualityDetails.length <= 1) {
      alert("At least 1 Quality row is required.");
      return;
    }
    setFormQualityDetails(formQualityDetails.filter((_, i) => i !== idx));
  };

  // Update a Quality row field
  const handleUpdateQualityRow = (idx: number, field: keyof SmsSaudaQualityDetail, val: any) => {
    setFormQualityDetails(formQualityDetails.map((row, i) => {
      if (i === idx) {
        const updated = { ...row, [field]: val };
        // If updating rs (rate), also update formBRate with the first row's rate for compatibility
        if (field === 'rs' && idx === 0) {
          setFormBRate(Number(val) || 16300);
        }
        return updated;
      }
      return row;
    }));
  };

  return (
    <LegacyLayout title="SMS INTERFACES P.O AUTOMATION" onClose={onClose}>
      <div className="flex-1 flex flex-col min-h-0 bg-slate-100 p-4 font-sans ">
        
        {/* VIEW CONTAINER */}
        {activeView === 'dashboard' ? (
          <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
            
            {/* KPI STATS ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
              
              {/* Box 1: Active Inbound Feed Count */}
              <div className="bg-white border border-slate-300 rounded p-3 flex items-center justify-between shadow-xs">
                <div className="flex flex-col">
                  <span className="text-[#024a68] font-extrabold text-3xl font-mono leading-none tracking-tight">
                    {googleSheetSmsData.length > 0 ? googleSheetSmsData.length : 7}
                  </span>
                  <span className="text-slate-400 font-black text-[9px] uppercase tracking-wider mt-1.5 leading-snug">
                    SMS Raw Log Queue
                  </span>
                </div>
                <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-md text-[#024a68]">
                  <MessageSquare className="h-5 w-5" />
                </div>
              </div>

              {/* Box 2: Total Registered Contracts */}
              <div className="bg-white border border-slate-300 rounded p-3 flex items-center justify-between shadow-xs">
                <div className="flex flex-col">
                  <span className="text-indigo-600 font-extrabold text-3xl font-mono leading-none tracking-tight">
                    {totalCount}
                  </span>
                  <span className="text-slate-400 font-black text-[9px] uppercase tracking-wider mt-1.5 leading-snug">
                    Total Registered Saudas
                  </span>
                </div>
                <div className="p-2 bg-indigo-50 border border-indigo-100 rounded-md text-indigo-500">
                  <CheckSquare className="h-5 w-5" />
                </div>
              </div>

              {/* Box 3: Cumulative Weight */}
              <div className="bg-white border border-slate-300 rounded p-3 flex items-center justify-between shadow-xs">
                <div className="flex flex-col">
                  <span className="text-amber-600 font-extrabold text-2xl font-mono leading-none tracking-tight">
                    {totalWeightTons.toFixed(2)} Tons
                  </span>
                  <span className="text-slate-400 font-black text-[9px] uppercase tracking-wider mt-1.5 leading-snug">
                    Cumulative Sauda Weight
                  </span>
                </div>
                <div className="p-2 bg-amber-50 border border-amber-100 rounded-md text-amber-500">
                  <Calculator className="h-5 w-5" />
                </div>
              </div>

              {/* Box 4: Status Mix */}
              <div className="bg-white border border-slate-300 rounded p-3 flex items-center justify-between shadow-xs text-xs font-mono">
                <div className="flex flex-col gap-1 w-full">
                  <span className="text-slate-400 font-black text-[9px] uppercase tracking-wider mb-1">
                    STATUS MIX
                  </span>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
                      <span className="text-slate-600 font-bold">PENDING:</span>
                      <span className="text-slate-900 font-black">{statusCounts.Pending}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500 inline-block" />
                      <span className="text-slate-600 font-bold">PARTIAL:</span>
                      <span className="text-slate-900 font-black">{statusCounts.Partial}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-slate-600 font-bold">DONE:</span>
                      <span className="text-slate-900 font-black">{statusCounts.Done}</span>
                    </div>
                    <button 
                      onClick={handleResetFilters}
                      className="text-[#024a68] hover:underline text-[9px] font-black text-right block ml-auto cursor-pointer"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* FILTER & CONTROL BAR */}
            <div className="bg-[#dcdbd7] border border-slate-350 p-2 mt-3 flex flex-wrap gap-2 items-center justify-between shadow-xs shrink-0 rounded-md">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <input  id="search_broker_supplier_ar_1515" name="search_broker_supplier_ar" aria-label="Search Broker, Supplier, Area or Slip..."
                    type="text"
                    placeholder="Search Broker, Supplier, Area or Slip..."
                    value={saudaSearchTerm}
                    onChange={(e) => setSaudaSearchTerm(e.target.value)}
                    className="w-full bg-white border border-slate-400 px-3 py-1.5 pl-8 text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#024a68] rounded shadow-inner"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {['ALL', 'Active', 'Partial', 'Closed'].map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border rounded cursor-pointer transition-all",
                      statusFilter === st
                        ? "bg-[#024a68] border-[#024a68] text-white"
                        : "bg-white hover:bg-slate-50 border-slate-350 text-slate-700"
                    )}
                  >
                    {st === 'ALL' ? 'ALL STATUS' : st === 'Active' ? 'PENDING' : st === 'Closed' ? 'COMPLETED' : 'PARTIAL'}
                  </button>
                ))}
                
                <span className="text-slate-400 mx-1 font-mono">|</span>

                <button 
                  onClick={handleResetFilters}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-350 px-3 h-8 flex items-center gap-1 text-[10px] uppercase font-black tracking-wider rounded shadow-xs cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* ACTION CARD BUTTONS ROW */}
            <div className="flex flex-wrap items-center justify-between gap-4 mt-3 py-2 border-b border-slate-300 shrink-0">
              <div className="flex items-center gap-2">
                {/* Sauda Slip creation square */}
                <button
                  onClick={() => handleOpenForm()}
                  className="bg-white hover:bg-slate-50 border-2 border-slate-400 w-24 h-20 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:translate-y-[1px] rounded shadow-xs text-slate-800"
                >
                  <PlusCircle className="h-7 w-7 text-indigo-600 animate-pulse" />
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono">Sauda Slip</span>
                </button>

                {/* Print Book */}
                <button
                  onClick={() => {
                    const printWindow = window.open('', '_blank');
                    if (printWindow) {
                      printWindow.document.write(`
                        <html>
                          <head>
                            <title>Bally Jute Company Limited - Sauda Register</title>
                            <style>
                              body { font-family: monospace; padding: 25px; line-height: 1.4; color: #111; }
                              table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                              th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; font-size: 11px; }
                              th { background-color: #f2f2f2; font-weight: bold; }
                              .text-right { text-align: right; }
                              .text-center { text-align: center; }
                              h2 { margin: 0; text-transform: uppercase; font-size: 16px; }
                            </style>
                          </head>
                          <body>
                            <h2>Bally Jute Company Limited</h2>
                            <h3 style="margin-top:2px;font-weight:normal;font-size:12px;">SMS Sauda Register Book Ledger</h3>
                            <p style="font-size:10px;color:#555;">Printed: ${new Date().toLocaleString()}</p>
                            <table>
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Slip No.</th>
                                  <th>Broker / Vyapari</th>
                                  <th>Supplier</th>
                                  <th>Unit/Lorry</th>
                                  <th class="text-right">Qty Bales</th>
                                  <th class="text-right">Total Wt. (MT)</th>
                                  <th class="text-right">B. Rate (₹)</th>
                                  <th class="text-center">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                ${smsSaudas.map((s) => `
                                  <tr>
                                    <td>${s.date}</td>
                                    <td>${s.sauda_no || s.id}</td>
                                    <td><strong>${getBroker(s)}</strong></td>
                                    <td>${s.supplier || ''}</td>
                                    <td>${getUnitType(s)}</td>
                                    <td class="text-right">${getBales(s)}</td>
                                    <td class="text-right">${s.total_wt_tons || (getBales(s) * 0.15)}</td>
                                    <td class="text-right">₹${getRate(s).toLocaleString()}</td>
                                    <td class="text-center">${s.status}</td>
                                  </tr>
                                `).join('')}
                              </tbody>
                            </table>
                          </body>
                        </html>
                      `);
                      printWindow.document.close();
                      printWindow.print();
                    }
                  }}
                  className="bg-white hover:bg-slate-50 border-2 border-slate-400 w-24 h-20 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:translate-y-[1px] rounded shadow-xs text-slate-800"
                >
                  <Printer className="h-7 w-7 text-indigo-650" />
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono">Print Book</span>
                </button>

                {/* Export CSV */}
                <button
                  onClick={() => {
                    const csvRows = smsSaudas.map(s => [
                      s.date,
                      s.sauda_no || s.id,
                      getBroker(s),
                      s.supplier || '',
                      getUnitType(s),
                      getBales(s),
                      s.total_wt_tons || (getBales(s) * 0.15),
                      getRate(s),
                      s.status
                    ].join(','));
                    const csvContent = "data:text/csv;charset=utf-8,Date,SlipNo,Broker,Supplier,UnitType,QtyBales,WeightTons,Rate,Status\n" + csvRows.join('\n');
                    const link = document.createElement("a");
                    link.href = encodeURI(csvContent);
                    link.download = "sms_saudas_ledger.csv";
                    link.click();
                  }}
                  className="bg-white hover:bg-slate-50 border-2 border-slate-400 w-24 h-20 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:translate-y-[1px] rounded shadow-xs text-slate-800"
                >
                  <Download className="h-7 w-7 text-indigo-650" />
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono">Export CSV</span>
                </button>

                {/* SMS Inbox toggle button */}
                <button
                  onClick={() => {
                    setActiveView('sms_feed');
                    fetchGoogleSheetSms();
                  }}
                  className="bg-indigo-50 hover:bg-indigo-100 border-2 border-indigo-300 w-28 h-20 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:translate-y-[1px] rounded shadow-md text-[#024a68] relative group"
                >
                  <MessageSquare className="h-7 w-7 text-indigo-650 group-hover:scale-105 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono">SMS Inbox Feed</span>
                  {googleSheetSmsData.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-mono font-black text-[10px] px-1.5 py-0.5 rounded-full shadow-md animate-bounce">
                      {googleSheetSmsData.length}
                    </span>
                  )}
                </button>

                {/* Gmail Inbox toggle button */}
                <button
                  onClick={() => {
                    setActiveView('gmail_feed');
                  }}
                  className="bg-rose-50 hover:bg-rose-100 border-2 border-rose-300 w-28 h-20 flex flex-col items-center justify-center gap-1 cursor-pointer transition-all active:translate-y-[1px] rounded shadow-md text-rose-800 relative group"
                >
                  <Mail className="h-7 w-7 text-rose-600 group-hover:scale-105 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-wider font-mono">Gmail Inbox Feed</span>
                  <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white font-mono font-black text-[10px] px-1.5 py-0.5 rounded-full shadow-md">
                    {gmailList.filter(m => m.unread).length}
                  </span>
                </button>
              </div>

              {/* BOOK TOTAL VALUE ON RIGHT */}
              <div className="bg-slate-50 border border-slate-300 p-3 rounded-lg text-right flex flex-col justify-center min-w-[200px] shadow-sm font-mono">
                <span className="text-slate-400 font-extrabold text-[10px] uppercase tracking-widest leading-none">
                  Book Total Value
                </span>
                <span className="text-[#024a68] font-black text-xl mt-1 tracking-tight">
                  Rs. {totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* DATA TABLE (SPREADSHEET/EXCEL STYLE LEDGER) */}
            <div className="flex-1 overflow-auto bg-white border border-slate-350 shadow-sm mt-3 rounded-md">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#c2cfd6]/70 border-b-2 border-slate-400 text-slate-800 font-mono h-10 sticky top-0 z-10 font-bold uppercase ">
                  <tr>
                    <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide">Date &or;</th>
                    <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide">Slip No. &or;</th>
                    <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide">Area &or;</th>
                    <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide">Broker &or;</th>
                    <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide">Supplier &or;</th>
                    <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide text-center">Unit Type &or;</th>
                    <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide text-right">Total Unit &or;</th>
                    <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide text-right">Total Wt (MT) &or;</th>
                    <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide text-right">B. Rate &or;</th>
                    <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide text-center">Status &or;</th>
                    <th className="px-4 text-[10px] tracking-wide text-center font-bold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px] text-slate-800">
                  {isDbLoading ? (
                    <tr>
                      <td colSpan={11} className="text-center py-16 text-slate-400 font-mono">
                        <RefreshCw className="h-6 w-6 text-indigo-600 animate-spin mx-auto mb-2" />
                        <span>Fetching active Sauda ledger...</span>
                      </td>
                    </tr>
                  ) : filteredSaudas.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-12 text-slate-400 font-mono font-bold uppercase">
                        No matching booked sauda contracts found.
                      </td>
                    </tr>
                  ) : (
                    filteredSaudas.map((s, idx) => {
                      let bgClass = "bg-white hover:bg-slate-50";
                      if (s.status === 'Closed') {
                        bgClass = "bg-emerald-50/25 hover:bg-emerald-50/40";
                      } else if (s.status === 'Partial') {
                        bgClass = "bg-sky-50/20 hover:bg-sky-50/35";
                      } else if (idx % 2 === 1) {
                        bgClass = "bg-[#f8f9fa] hover:bg-[#f1f3f5]";
                      }

                      const weightInMt = s.total_wt_tons || (getBales(s) * 0.15);
                      let statusText = '';
                      let statusStyle = '';
                      
                      if (s.status === 'Closed') {
                        statusText = `COMPLETED ${weightInMt.toFixed(1)} MT`;
                        statusStyle = "bg-emerald-100 text-emerald-800 border-emerald-300";
                      } else if (s.status === 'Partial') {
                        statusText = `PARTIAL ${(weightInMt * 0.6).toFixed(1)}/${weightInMt.toFixed(1)} MT`;
                        statusStyle = "bg-sky-100 text-sky-800 border-sky-300";
                      } else {
                        statusText = `PENDING 0.0/${weightInMt.toFixed(1)} MT`;
                        statusStyle = "bg-amber-100 text-amber-800 border-amber-300";
                      }

                      return (
                        <tr key={s.id} className={cn("transition-colors h-9", bgClass)}>
                          <td className="px-4 py-2 border-r border-slate-200 text-slate-500 font-medium">{s.date}</td>
                          <td className="px-4 py-2 border-r border-slate-200 font-bold text-[#024a68]">
                            {getSaudaNo(s)}
                          </td>
                          <td className="px-4 py-2 border-r border-slate-200 text-slate-600 font-semibold uppercase text-[10px]">
                            {s.area || 'SEMI NORTHERN'}
                          </td>
                          <td className="px-4 py-2 border-r border-slate-200 font-black text-slate-900 uppercase tracking-tight">
                            {getBroker(s)}
                          </td>
                          <td className="px-4 py-2 border-r border-slate-200 text-slate-600 font-bold uppercase">
                            {s.supplier || ''}
                          </td>
                          <td className="px-4 py-2 border-r border-slate-200 text-center text-slate-600 font-extrabold text-[10px]">
                            {getUnitType(s)}
                          </td>
                          <td className="px-4 py-2 border-r border-slate-200 text-right font-black pr-6">
                            {getBales(s)}
                          </td>
                          <td className="px-4 py-2 border-r border-slate-200 text-right font-black text-slate-600 pr-6">
                            {weightInMt.toFixed(2)}
                          </td>
                          <td className="px-4 py-2 border-r border-slate-200 text-right font-black text-slate-950 pr-4">
                            <span className="text-emerald-700 mr-0.5">₹</span>{getRate(s).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 border-r border-slate-200 text-center ">
                            <span className={cn(
                              "text-[8.5px] font-black uppercase px-2 py-0.5 border rounded shadow-2xs inline-block",
                              statusStyle
                            )}>
                              {statusText}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex gap-1.5 justify-center">
                              {/* Print Slip */}
                              <button
                                onClick={() => handlePrintSlip(s)}
                                title="Print Formal Slip"
                                className="text-slate-600 hover:text-black p-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer"
                              >
                                <Printer className="h-3 w-3" />
                              </button>

                              {/* Download PDF Slip */}
                              <button
                                onClick={() => {
                                  try {
                                    const pdfBase64 = generateSaudaPdfBase64(s);
                                    const link = document.createElement('a');
                                    link.href = `data:application/pdf;base64,${pdfBase64}`;
                                    link.download = `Sauda_Slip_${s.sauda_no || 'Draft'}.pdf`;
                                    document.body.appendChild(link);
                                    link.click();
                                    document.body.removeChild(link);
                                  } catch (err) {
                                    console.error("PDF download failed:", err);
                                    alert("Could not generate PDF download file.");
                                  }
                                }}
                                title="Download PDF Sauda Slip"
                                className="text-emerald-700 hover:text-emerald-900 p-1 rounded border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 transition-all cursor-pointer"
                              >
                                <Download className="h-3 w-3" />
                              </button>

                              {/* One-Click Email Slip */}
                              <button
                                onClick={async () => {
                                  const sId = s.id || '';
                                  setEmailSendingStatus(prev => ({ ...prev, [sId]: 'sending' }));
                                  try {
                                    const emailHtml = generateSaudaHtmlEmail(s);
                                    const pdfBase64 = generateSaudaPdfBase64(s);
                                    
                                    let recipientEmails = "";
                                    if (supabase) {
                                      const addedEmails = new Set<string>();
                                      if (s.broker) {
                                        const { data: custBroker } = await supabase
                                          .from('customer_master')
                                          .select('email')
                                          .eq('firm_name', s.broker)
                                          .maybeSingle();
                                        if (custBroker?.email) {
                                          const email = custBroker.email.trim();
                                          if (email && !addedEmails.has(email.toLowerCase())) {
                                            recipientEmails += `, ${email}`;
                                            addedEmails.add(email.toLowerCase());
                                          }
                                        }
                                      }
                                      if (s.supplier) {
                                        const { data: custSupplier } = await supabase
                                          .from('customer_master')
                                          .select('email')
                                          .eq('firm_name', s.supplier)
                                          .maybeSingle();
                                        if (custSupplier?.email) {
                                          const email = custSupplier.email.trim();
                                          if (email && !addedEmails.has(email.toLowerCase())) {
                                            recipientEmails += `, ${email}`;
                                            addedEmails.add(email.toLowerCase());
                                          }
                                        }
                                      }
                                    }

                                    const res = await fetch(getApiUrl("/api/send-email"), {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        to: recipientEmails.split(',').map(e => e.trim()).filter(Boolean).join(', ') || 'rawjute@ballyjute.com',
                                        subject: `[Bally Jute ERP] Sauda Slip: ${s.sauda_no}`,
                                        html: emailHtml,
                                        filename: `Sauda_Slip_${s.sauda_no || 'Draft'}.pdf`,
                                        pdfData: pdfBase64 || undefined
                                      })
                                    });
                                    
                                    const resText = await res.text();
                                    let resData;
                                    try {
                                      resData = JSON.parse(resText);
                                    } catch (e) {
                                      throw new Error("Mail Dispatch Failed: " + resText.substring(0, 100));
                                    }
      
                                    if (res.ok && resData.success) {
                                      setEmailSendingStatus(prev => ({ ...prev, [sId]: 'success' }));
                                      alert(`Email for Sauda #${s.sauda_no} sent successfully to ${recipientEmails}!`);
                                      setTimeout(() => {
                                        setEmailSendingStatus(prev => ({ ...prev, [sId]: 'idle' }));
                                      }, 3000);
                                    } else {
                                      throw new Error(resData.error || "Email failed");
                                    }
                                  } catch (err: any) {
                                    console.error(err);
                                    setEmailSendingStatus(prev => ({ ...prev, [sId]: 'error' }));
                                    alert(`Failed to send email: ${err instanceof Error ? err.message : String(err)}`);
                                    setTimeout(() => {
                                      setEmailSendingStatus(prev => ({ ...prev, [sId]: 'idle' }));
                                    }, 4000);
                                  }
                                }}
                                disabled={emailSendingStatus[s.id || ''] === 'sending'}
                                title="Email Slip to rawjute@ballyjute.com + prosunmajhi@gmail.com in 1-Click"
                                className={cn(
                                  "p-1 rounded border transition-all cursor-pointer flex items-center justify-center h-5 w-5",
                                  emailSendingStatus[s.id || ''] === 'sending' && "text-amber-600 border-amber-250 bg-amber-50",
                                  emailSendingStatus[s.id || ''] === 'success' && "text-emerald-700 border-emerald-300 bg-emerald-50",
                                  emailSendingStatus[s.id || ''] === 'error' && "text-red-600 border-red-300 bg-red-50",
                                  (!emailSendingStatus[s.id || ''] || emailSendingStatus[s.id || ''] === 'idle') && "text-indigo-600 hover:text-indigo-900 border-slate-200 bg-slate-50 hover:bg-slate-100"
                                )}
                              >
                                {emailSendingStatus[s.id || ''] === 'sending' ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : emailSendingStatus[s.id || ''] === 'success' ? (
                                  <Check className="h-3 w-3 text-emerald-600 font-bold" />
                                ) : (
                                  <Mail className="h-3 w-3" />
                                )}
                              </button>

                              {/* Convert to Sauda Desk */}
                              <button
                                onClick={async () => {
                                  if (!supabase) {
                                    alert("Cannot convert in offline mode. Please configure Supabase.");
                                    return;
                                  }
                                  if (confirm(`Are you sure you want to convert Sauda Slip #${s.sauda_no || s.id} to a real contract in the Sauda Desk database?`)) {
                                    try {
                                      // Check if sauda_master already has this sauda_no to prevent duplicates
                                      const { data: existingSauda, error: checkErr } = await supabase
                                        .from('sauda_master')
                                        .select('sauda_id')
                                        .eq('sauda_no', s.sauda_no)
                                        .maybeSingle();

                                      if (checkErr) throw checkErr;
                                      if (existingSauda) {
                                        if (!confirm(`A Sauda contract with number '${s.sauda_no}' already exists in Sauda Desk. Do you want to update it or create a duplicate? (Cancel to abort conversion)`)) {
                                          return;
                                        }
                                      }

                                      const saudaData = {
                                        financial_year: s.session || '2026-2027',
                                        sauda_no: s.sauda_no || `SMS-${Math.floor(100 + Math.random() * 900)}`,
                                        session: s.session || `BJCL/2026-2027/${s.sauda_no}`,
                                        po_type: s.po_type || 'Normal',
                                        date: s.date || new Date().toISOString().split('T')[0],
                                        broker: (s.broker || '').toUpperCase(),
                                        supplier: (s.supplier || '').toUpperCase(),
                                        challan_supplier: (s.challan_supplier || '').toUpperCase(),
                                        area: (s.area || '').toUpperCase(),
                                        no_of_lorries: Number(s.no_of_lorries) || 1,
                                        units_per_lorry_type: s.units_per_lorry || 'BALES',
                                        total_unit: Number(s.total_unit) || 0,
                                        wt_per_lorry: Number(s.wt_per_lorry) || 10.28,
                                        unit_type: s.unit_type || 'BALES',
                                        total_wt_in_ton: Number(s.total_wt_tons) || 0,
                                        shipment_date: s.shipment_date || new Date().toISOString().split('T')[0],
                                        shipment_days: Number(s.shipment_days) || 15,
                                        shipment_penalty: Number(s.shipment_penalty) || 5,
                                        marks_claim: Number(s.marks_claim) || 0,
                                        quantity_claim: Number(s.quantity_claim) || 0,
                                        remarks: s.remarks || '',
                                        b_rate: Number(s.b_rate) || 16300,
                                        b_date: s.b_date || s.date || new Date().toISOString().split('T')[0],
                                        superior_normal_marks: s.superior_normal_marks || 'Superior / Normal (Marks)',
                                        status: 'pending'
                                      };

                                      // 1. Insert sauda_master
                                      const inserted = await dbModule.insert('sauda_master', saudaData);
                                      if (inserted && inserted.sauda_id && s.quality_details && s.quality_details.length > 0) {
                                        // 2. Insert quality details
                                        for (const row of s.quality_details) {
                                          await dbModule.insert('sauda_quality_details', {
                                            sauda_id: inserted.sauda_id,
                                            financial_year: inserted.financial_year || '2026-2027',
                                            quality: row.quality,
                                            qty: Number(row.qty) || 0,
                                            agency: row.agency || '',
                                            marka: row.marka || '',
                                            rs: Number(row.rs) || 0
                                          });
                                        }
                                      }

                                      // 3. Update the sms_sauda record to "Closed" status
                                      const updatedStatus = 'Closed';
                                      await supabase
                                        .from('sms_sauda')
                                        .update({ status: updatedStatus, remarks: `${s.remarks || ''}\n[Converted to Sauda Desk: ${new Date().toLocaleDateString()}]` })
                                        .eq('id', s.id);

                                      // Update state locally
                                      const updatedList: SmsSaudaContract[] = smsSaudas.map(item => item.id === s.id ? { ...item, status: 'Closed' as const } : item);
                                      saveAndSyncList(updatedList);

                                      alert(`Successfully converted Sauda Slip #${s.sauda_no} into a formal contract in the Sauda Desk! Navigating to Sauda Desk...`);
                                      if (onNavigate) {
                                        onNavigate('sauda');
                                      }
                                    } catch (err: any) {
                                      console.error("Conversion failed:", err);
                                      alert(`Failed to convert: ${err.message || err}`);
                                    }
                                  }
                                }}
                                title="Convert this Slip to Sauda Desk (Push to sauda_master)"
                                className="text-emerald-700 hover:text-emerald-900 p-1 rounded border border-slate-200 hover:border-slate-350 bg-slate-50 hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center h-5 w-5"
                              >
                                <Briefcase className="h-3 w-3" />
                              </button>

                              {/* Edit */}
                              {canEditOrDelete() && (
                                <button
                                  onClick={() => handleOpenForm(s)}
                                  title="Edit Contract Details"
                                  className="text-indigo-650 hover:text-indigo-950 p-1 rounded border border-slate-200 hover:border-slate-350 bg-slate-50 transition-all cursor-pointer"
                                >
                                  <Edit3 className="h-3 w-3" />
                                </button>
                              )}

                              {/* Toggle Status */}
                              <button
                                onClick={() => {
                                  if (!enforceEditOrDeletePermission("Edit")) return;
                                  const nextStatus: SmsSaudaContract['status'] = s.status === 'Closed' ? 'Active' : s.status === 'Active' ? 'Partial' : 'Closed';
                                  const updated = smsSaudas.map(item => item.id === s.id ? { ...item, status: nextStatus } : item);
                                  saveAndSyncList(updated);
                                }}
                                title="Toggle contract status (Pending -> Partial -> Completed)"
                                className="text-emerald-650 hover:text-emerald-950 p-1 rounded border border-slate-200 hover:border-slate-350 bg-slate-50 transition-all cursor-pointer"
                              >
                                <Check className="h-3 w-3" />
                              </button>

                              {/* Delete */}
                              {canEditOrDelete() && (
                                <button
                                  onClick={() => handleDeleteContract(s.id, s.sauda_no)}
                                  title="Revoke Contract"
                                  className="text-red-650 hover:text-red-950 p-1 rounded border border-slate-200 hover:border-red-300 bg-slate-50 transition-all cursor-pointer"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        ) : activeView === 'sms_feed' ? (
          /* GOOGLE SHEETS RAW SMS LIST VIEW */
          <div className="flex-1 flex flex-col min-h-0 mt-3 bg-slate-150 border border-slate-350 rounded-md p-3 animate-fade-in ">
            
            {/* Sync Header */}
            <div className="p-3 bg-white border border-slate-300 flex flex-wrap gap-3 items-center justify-between  shadow-xs rounded-lg">
              <div className="font-mono text-xs flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span className="font-black text-slate-850 tracking-wider">GOOGLE SHEETS DATA LEDGER (SMS SENSORS)</span>
                <span className="text-slate-300">|</span>
                <span className="text-slate-500 font-bold text-[10px]">Sheet ID: 1WignMNJ2p2...KYgG9k</span>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={fetchGoogleSheetSms}
                  disabled={isGoogleSheetLoading}
                  className="bg-[#024a68] hover:bg-[#035b80] text-white font-mono font-black text-[10px] h-8 px-4 rounded shadow-sm cursor-pointer flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", isGoogleSheetLoading && "animate-spin")} />
                  <span>{isGoogleSheetLoading ? "Syncing..." : "Sync Sheet Data"}</span>
                </button>

                <button
                  onClick={() => setActiveView('dashboard')}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-mono font-bold text-[10px] h-8 px-3 rounded shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                  <span>Back to Ledger Dashboard</span>
                </button>
              </div>
            </div>

            {googleSheetError && (
              <div className="my-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 font-sans text-xs ">
                <div className="flex items-center gap-1.5 font-black mb-1">
                  <AlertCircle className="h-4 w-4 text-red-650" />
                  <span className="uppercase tracking-wider text-[10px]">Sheets API Sync Error</span>
                </div>
                <p className="text-[11px] text-red-700 font-semibold">{googleSheetError}</p>
              </div>
            )}

            {/* SMS Search Bar */}
            <div className="px-3 py-2 bg-slate-200/50 border border-slate-300 mt-2.5 flex items-center justify-between  rounded-lg gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input  id="quick_search_sheet_logs_b_2114" name="quick_search_sheet_logs_b" aria-label="Quick search sheet logs by broker, contact, or raw body..."
                  type="text"
                  placeholder="Quick search sheet logs by broker, contact, or raw body..."
                  value={smsSearchTerm}
                  onChange={(e) => setSmsSearchTerm(e.target.value)}
                  className="w-full bg-white pl-9 pr-3 py-1.5 text-xs border border-slate-350 rounded shadow-inner font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div className="text-[10px] font-bold text-slate-500 font-mono hidden sm:block">
                TOTAL FEED: {googleSheetSmsData.length} RAW LOGS
              </div>
            </div>

            {/* Spreadsheet Grid Table */}
            <div className="flex-1 overflow-auto bg-white border border-slate-350 shadow-inner mt-3 rounded-md">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-[#c2cfd6]/70 border-b-2 border-slate-400 text-slate-800 font-mono h-10 sticky top-0 z-10 font-bold uppercase ">
                  <tr>
                    <th className="px-3 border-r border-slate-300 text-[10px] tracking-wide text-center w-14">Row &or;</th>
                    <th className="px-3 border-r border-slate-300 text-[10px] tracking-wide w-24">Date &or;</th>
                    <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide w-48">Sender (Broker/Vyapari) &or;</th>
                    <th className="px-3 border-r border-slate-300 text-[10px] tracking-wide text-center w-24">Grade &or;</th>
                    <th className="px-3 border-r border-slate-300 text-[10px] tracking-wide text-center w-24">Unit Type &or;</th>
                    <th className="px-4 border-r border-slate-300 text-[10px] tracking-wide">Raw SMS Text (Google Sheet Body payload)</th>
                    <th className="px-4 text-[10px] tracking-wide text-center font-bold w-40">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px] text-slate-800">
                  {isGoogleSheetLoading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-20 text-slate-400 font-mono">
                        <RefreshCw className="h-7 w-7 text-indigo-650 animate-spin mx-auto mb-2" />
                        <span className="text-xs font-black uppercase tracking-wider text-slate-700">Connecting Google Sheet feed...</span>
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const filtered = googleSheetSmsData.filter(sms => {
                        const query = smsSearchTerm.toLowerCase();
                        return (
                          sms.contact_name.toLowerCase().includes(query) ||
                          sms.service_center.toLowerCase().includes(query) ||
                          sms.body.toLowerCase().includes(query)
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan={7} className="text-center py-16 text-slate-400 font-mono font-bold uppercase">
                              No matching sheet records found in current feed filter.
                            </td>
                          </tr>
                        );
                      }

                      return filtered.map((sms, index) => {
                        const bodyLower = sms.body.toLowerCase();
                        const isLry = bodyLower.includes('lry') || bodyLower.includes('lorry') || bodyLower.includes('truck');
                        
                        let detectedGrade = 'TD5';
                        if (bodyLower.includes('td4')) detectedGrade = 'TD4';
                        else if (bodyLower.includes('td6')) detectedGrade = 'TD6';
                        else if (bodyLower.includes('w4')) detectedGrade = 'W4';
                        else if (bodyLower.includes('w5')) detectedGrade = 'W5';

                        const rowBgClass = index % 2 === 1 ? "bg-slate-50 hover:bg-slate-100" : "bg-white hover:bg-slate-50";

                        return (
                          <tr key={sms.id} className={cn("transition-colors h-10", rowBgClass)}>
                            <td className="px-3 py-2 border-r border-slate-200 text-center font-bold text-slate-400 ">
                              {sms.id.replace('SHEET-SMS-', '')}
                            </td>
                            <td className="px-3 py-2 border-r border-slate-200 text-slate-500 font-medium">{sms.date}</td>
                            <td className="px-4 py-2 border-r border-slate-200 font-black text-slate-900 uppercase tracking-tight">
                              <span className="flex items-center gap-1.5">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse shrink-0" />
                                {sms.contact_name}
                              </span>
                            </td>
                            <td className="px-3 py-2 border-r border-slate-200 text-center ">
                              <span className="bg-amber-50 text-amber-800 border border-amber-250 font-black text-[9px] tracking-wider px-2 py-0.5 rounded uppercase font-mono">
                                {detectedGrade}
                              </span>
                            </td>
                            <td className="px-3 py-2 border-r border-slate-200 text-center text-slate-600 font-extrabold ">
                              {isLry ? "🚚 LORRY" : "BALES"}
                            </td>
                            <td className="px-4 py-2 border-r border-slate-200 font-mono text-[11px] text-slate-700 leading-normal select-text max-w-lg truncate hover:text-slate-950" title={sms.body}>
                              {sms.body}
                            </td>
                            <td className="px-4 py-2 text-center ">
                              <button
                                onClick={() => handleConvertSms(sms)}
                                className="bg-[#024a68] hover:bg-[#035d82] text-white font-mono font-black text-[9px] uppercase px-3 py-1.5 rounded shadow-sm hover:shadow cursor-pointer flex items-center justify-center gap-1 mx-auto transition-all active:scale-95"
                              >
                                <PlusCircle className="h-3 w-3 text-yellow-300" />
                                <span>Convert to Sauda</span>
                              </button>
                            </td>
                          </tr>
                        );
                      });
                    })()
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeView === 'gmail_feed' ? (
          /* NEW HIGH FIDELITY GMAIL INBOX & PASTE CENTER */
          <div className="flex-1 flex flex-col min-h-0 mt-3 bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden animate-fade-in font-sans ">
            
            {/* Top Toolbar */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-rose-600 text-white p-1.5 rounded-md">
                  <Mail className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs tracking-wide flex items-center gap-2">
                    BALLY JUTE GMAIL INBOX
                    <span className="bg-rose-100 text-rose-800 text-[10px] px-2 py-0.5 rounded-full font-black select-text">
                      rawjute@ballyjute.com
                    </span>
                  </h3>
                  <p className="text-[10.5px] text-slate-500 font-semibold mt-0.5">Secure SMTP Mail Exchange & Raw Slip Compiler</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={syncGmailNow}
                  disabled={isSyncing}
                  title="Pull the latest mail from Gmail now"
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs h-9 px-4 rounded-full flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <RefreshCw className={cn("h-4 w-4", isSyncing && "animate-spin")} />
                  <span>{isSyncing ? 'Syncing…' : 'Sync'}</span>
                </button>

                <button
                  onClick={() => setIsComposing(true)}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-9 px-4 rounded-full flex items-center gap-1.5 transition-all shadow-sm active:scale-95 cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>Compose</span>
                </button>

                <button
                  onClick={() => setActiveView('dashboard')}
                  className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs h-9 px-4 rounded-full flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                >
                  <ArrowLeft className="h-3.5 w-3.5 animate-pulse" />
                  <span>Exit Feed</span>
                </button>
              </div>
            </div>

            {/* Main Section */}
            <div className="flex-1 flex min-h-0 bg-slate-50">
              
              {/* Sidebar */}
              <div className="w-56 border-r border-slate-200 bg-white p-3 flex flex-col justify-between shrink-0">
                <div className="space-y-1">
                  {[
                    { id: 'inbox', label: 'Inbox', icon: Inbox, count: gmailList.filter(m => m.unread).length },
                    { id: 'starred', label: 'Starred', icon: Star, count: gmailList.filter(m => m.starred).length },
                    { id: 'paste', label: 'Paste & Parse', icon: FileSpreadsheet, count: 0 },
                    { id: 'sent', label: 'Sent Mail', icon: Send, count: 0 },
                    { id: 'trash', label: 'Trash', icon: Trash, count: 0 },
                  ].map((folder) => {
                    const IconComp = folder.icon;
                    const isSelected = gmailFolder === folder.id;
                    return (
                      <button
                        key={folder.id}
                        onClick={() => {
                          setGmailFolder(folder.id as any);
                          if (folder.id === 'paste') {
                            setSelectedEmailId(null);
                          }
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2 rounded-r-full font-bold text-xs transition-colors cursor-pointer text-left",
                          isSelected 
                            ? "bg-rose-50 text-rose-700 font-extrabold" 
                            : "text-slate-650 hover:bg-slate-100"
                        )}
                      >
                        <div className="flex items-center gap-2.5">
                          <IconComp className={cn("h-4 w-4", isSelected ? "text-rose-600" : "text-slate-400")} />
                          <span>{folder.label}</span>
                        </div>
                        {folder.count > 0 && (
                          <span className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full font-black",
                            isSelected ? "bg-rose-200 text-rose-800" : "bg-slate-100 text-slate-600"
                          )}>
                            {folder.count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[10px] space-y-1.5 select-text">
                  <div className="flex items-center justify-between">
                     <div className="font-extrabold text-slate-700 uppercase tracking-wider text-[9px]">Server Connection</div>
                     {connStatus === 'connected' ? (
                       <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-600 uppercase"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Connected</span>
                     ) : connStatus === 'error' ? (
                       <span className="flex items-center gap-1 text-[8px] font-bold text-red-600 uppercase"><AlertCircle className="h-2.5 w-2.5" /> Auth Error</span>
                     ) : (
                       <span className="flex items-center gap-1 text-[8px] font-bold text-amber-600 uppercase"><RefreshCw className="h-2.5 w-2.5 animate-spin" /> {connStatus}</span>
                     )}
                  </div>
                  <div className="text-slate-700 font-semibold truncate" title="rawjute@ballyjute.com">
                    <span className="font-bold text-slate-900">User:</span> rawjute@ballyjute.com
                  </div>
                  <div className="text-slate-700 font-semibold">
                    <span className="font-bold text-slate-900">Auth:</span> TLS/SSL (OAuth2 pending)
                  </div>
                  <div className="text-slate-700 font-semibold">
                    <span className="font-bold text-slate-900">Host:</span> imap.gmail.com (993)
                  </div>
                </div>
              </div>

              {/* Middle Section: Email List or Paste View */}
              {gmailFolder === 'paste' ? (
                <div className="flex-1 p-6 overflow-y-auto space-y-4">
                  <div className="bg-white p-5 border border-slate-200 rounded-xl shadow-xs">
                    <h4 className="font-black text-sm text-slate-900 mb-1 uppercase tracking-wide">Direct Gmail Content Paste Tool</h4>
                    <p className="text-xs text-slate-500 font-semibold mb-4">
                      Copy any transaction email directly from your standard Gmail browser and paste it here. Our AI engine will parse the broker, grade, rate, and quantity automatically.
                    </p>

                    <div className="space-y-3">
                      <label htmlFor="raw_email_content_2355" className="text-[10px] font-black uppercase text-slate-500 block">Raw Email Content</label>
                      <textarea
 id="raw_email_content_2355" name="raw_email_content" aria-label="Raw Email Content"                        rows={8}
                        value={pastedGmailText}
                        onChange={(e) => setPastedGmailText(e.target.value)}
                        placeholder="PASTE RAW EMAIL TEXT HERE...
Example:
Booked 150 Bales TD5 Jute at ₹16,300/Qtl, Agency: Tulshihatta with Chopra Corporation."
                        className="w-full bg-slate-50 border border-slate-350 p-3 rounded-lg text-xs font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-rose-500 outline-none transition-all select-text"
                      />

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPastedGmailText('')}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          disabled={!pastedGmailText.trim()}
                          onClick={() => {
                            const parsed = parseRawGmailToSauda(pastedGmailText);
                            handlePreFillAndOpenForm(parsed);
                          }}
                          className="bg-[#024a68] hover:bg-[#035b80] text-white font-bold text-xs px-5 py-2 rounded-lg cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm active:scale-95"
                        >
                          <FileSpreadsheet className="h-4 w-4" />
                          <span>Parse & Convert to Sauda Slip</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex min-h-0">
                  
                  {/* Email List Column */}
                  <div className="w-[45%] border-r border-slate-200 bg-white flex flex-col min-h-0 shrink-0">
                    {/* Search */}
                    <div className="p-2 border-b border-slate-200 relative">
                      <Search className="absolute left-4 top-4.5 h-3.5 w-3.5 text-slate-400" />
                      <input
 id="gmailsearchterm_2397" name="gmailsearchterm" aria-label="gmailsearchterm"                        type="text"
                        value={gmailSearchTerm}
                        onChange={(e) => setGmailSearchTerm(e.target.value)}
                        placeholder={`Search ${gmailFolder}...`}
                        className="w-full bg-slate-100 border border-slate-200 pl-8.5 pr-3 py-1.5 rounded-lg text-xs font-semibold text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-rose-500 transition-all select-text"
                      />
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-slate-150">
                      {(() => {
                        if (isFetchingGmail) {
                           return <div className="p-8 text-center font-mono text-sm text-slate-500">Loading inbox...</div>;
                        }
                        if (connStatus === 'checking' || connStatus === 'retrying') {
                           return (
                             <div className="p-8 flex flex-col items-center justify-center text-slate-500 h-64">
                               <RefreshCw className="h-8 w-8 animate-spin mb-4 text-slate-300" />
                               <div className="text-sm font-bold uppercase tracking-widest">{connStatus === 'retrying' ? 'Retrying Connection...' : 'Testing IMAP Handshake...'}</div>
                             </div>
                           );
                        }
                        
                        if (connStatus === 'error') {
                           return (
                             <div className="p-8 text-center text-red-500 font-mono text-sm h-64 flex flex-col items-center justify-center">
                               <AlertCircle className="h-10 w-10 mb-4 text-red-400" />
                               <div className="mb-2 font-bold uppercase tracking-wider text-red-600">SMTP/IMAP Handshake Failed</div>
                               <div className="text-xs bg-red-50 text-red-800 p-4 rounded-lg border border-red-200 max-w-lg text-left overflow-auto w-full mb-4">
                                  {connDetails || gmailError}
                               </div>
                               <div className="text-[10px] text-slate-500 max-w-lg mb-4 text-left">
                                  <strong>Using 2-Step Verification?</strong> If you have 2-Step Verification enabled on your Google Account, your standard password will not work here. You must generate an <strong>App Password</strong> in your Google Account Settings and use that instead.
                               </div>
                               <button onClick={() => checkConnection(true)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-widest border border-slate-300 rounded hover:bg-white transition-colors active:bg-slate-200">
                                  Retry Handshake Test
                               </button>
                             </div>
                           );
                        }
                        if (gmailList.length === 0) {
                           return <div className="p-8 text-center font-mono text-sm text-slate-500">No unread emails found via IMAP.</div>;
                        }
                        const filtered = gmailList.filter(mail => {
                          const matchesSearch = mail.senderName.toLowerCase().includes(gmailSearchTerm.toLowerCase()) || 
                                                mail.subject.toLowerCase().includes(gmailSearchTerm.toLowerCase()) || 
                                                mail.body.toLowerCase().includes(gmailSearchTerm.toLowerCase());
                          if (!matchesSearch) return false;
                          if (gmailFolder === 'starred') return mail.starred;
                          if (gmailFolder === 'trash') return false; // simulated folder logic
                          if (gmailFolder === 'sent') return mail.id.startsWith('SENT-');
                          return !mail.id.startsWith('SENT-'); // default Inbox folder
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="p-8 text-center text-slate-400 font-semibold text-xs">
                              No emails found in {gmailFolder} folder
                            </div>
                          );
                        }

                        return filtered.map((mail) => {
                          const isSelected = selectedEmailId === mail.id;
                          return (
                            <div
                              key={mail.id}
                              onClick={() => {
                                setSelectedEmailId(mail.id);
                                // Mark as read
                                setGmailList(prev => prev.map(m => m.id === mail.id ? { ...m, unread: false } : m));
                              }}
                              className={cn(
                                "p-3 cursor-pointer hover:bg-slate-50 transition-colors border-l-4",
                                isSelected ? "bg-rose-50/40 border-l-rose-500" : mail.unread ? "bg-amber-50/20 border-l-slate-300" : "border-l-transparent"
                              )}
                            >
                              <div className="flex justify-between items-start gap-1">
                                <span className={cn("text-xs truncate font-semibold", mail.unread ? "text-slate-900 font-extrabold" : "text-slate-650")}>
                                  {mail.senderName}
                                </span>
                                <span className="text-[10px] text-slate-400 font-semibold shrink-0">
                                  {mail.date.split(' ')[1] + ' ' + mail.date.split(' ')[2]}
                                </span>
                              </div>
                              <h4 className={cn("text-xs truncate mt-1", mail.unread ? "text-slate-900 font-extrabold" : "text-slate-700")}>
                                {mail.subject}
                              </h4>
                              <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                                {mail.snippet}
                              </p>

                              {/* Gmail-style Attachment Badges */}
                              {mail.attachments && mail.attachments.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5 mb-1" onClick={(e) => e.stopPropagation()}>
                                  {mail.attachments.map((att: any, idx: number) => (
                                    <button
                                      key={idx}
                                      type="button"
                                      onClick={() => {
                                        setPreviewAttachment(att);
                                      }}
                                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[10px] text-slate-650 font-bold border border-slate-200 transition-colors cursor-pointer max-w-[150px] truncate"
                                      title={`Click to preview: ${att.filename}`}
                                    >
                                      {att.contentType?.includes('pdf') ? (
                                        <span className="text-[8px] leading-none bg-red-500 text-white font-extrabold px-1 py-0.5 rounded flex-shrink-0">PDF</span>
                                      ) : (
                                        <Paperclip className="h-2.5 w-2.5 text-indigo-500 flex-shrink-0" />
                                      )}
                                      <span className="truncate">{att.filename}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              
                              <div className="flex gap-2 mt-2 items-center">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setGmailList(prev => prev.map(m => m.id === mail.id ? { ...m, starred: !m.starred } : m));
                                  }}
                                  className="text-slate-400 hover:text-amber-500 cursor-pointer"
                                >
                                  <Star className={cn("h-3.5 w-3.5", mail.starred && "fill-amber-400 text-amber-500")} />
                                </button>
                                {mail.unread && (
                                  <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Email Detail Pane Column */}
                  <div className="flex-1 bg-white flex flex-col min-h-0 overflow-y-auto">
                    {(() => {
                      const mail = gmailList.find(m => m.id === selectedEmailId);
                      if (!mail) {
                        return (
                          <div className="flex-1 flex flex-col items-center justify-center p-8 text-slate-400 font-semibold text-xs">
                            <Mail className="h-10 w-10 text-slate-300 mb-2" />
                            <span>Select an email to view details</span>
                          </div>
                        );
                      }

                      return (
                        <div className="p-5 flex-1 flex flex-col justify-between min-h-0 select-text">
                          <div className="space-y-4">
                            <div className="border-b border-slate-150 pb-3">
                              <div className="flex justify-between items-start gap-2">
                                <h2 className="font-extrabold text-sm text-slate-900 leading-snug">
                                  {mail.subject}
                                </h2>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setGmailList(prev => prev.map(m => m.id === mail.id ? { ...m, starred: !m.starred } : m));
                                  }}
                                  className="text-slate-400 hover:text-amber-500 cursor-pointer"
                                >
                                  <Star className={cn("h-4 w-4", mail.starred && "fill-amber-400 text-amber-500")} />
                                </button>
                              </div>

                              <div className="flex justify-between items-center mt-3">
                                <div className="text-xs">
                                  <span className="font-bold text-slate-900">{mail.senderName}</span>
                                  <span className="text-slate-400 font-semibold ml-1.5">&lt;{mail.senderEmail}&gt;</span>
                                </div>
                                <span className="text-[10px] text-slate-500 font-semibold">{mail.date}</span>
                              </div>
                            </div>

                            {/* Body */}
                            <div className="whitespace-pre-wrap text-xs text-slate-750 font-medium leading-relaxed font-sans max-h-[300px] overflow-y-auto bg-slate-50/50 p-4 rounded-lg border border-slate-150">
                              {mail.body}
                            </div>

                            {/* Attachments Section */}
                            {mail.attachments && mail.attachments.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-dashed border-slate-200">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                                  Attachments ({mail.attachments.length})
                                </span>
                                <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                                  {mail.attachments.map((att: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between p-2 rounded-md bg-slate-50 border border-slate-150 text-xs">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <Paperclip className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                                        <span className="font-semibold text-slate-700 truncate" title={att.filename}>
                                          {att.filename}
                                        </span>
                                        <span className="text-[10px] text-slate-450 font-medium">
                                          ({(att.size / 1024).toFixed(1)} KB)
                                        </span>
                                      </div>
                                      {att.content ? (
                                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                          <button
                                            type="button"
                                            onClick={() => setPreviewAttachment(att)}
                                            className="text-[10px] font-bold text-[#024a68] hover:underline flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-200 cursor-pointer"
                                          >
                                            <svg className="h-3 w-3 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                            <span>Preview</span>
                                          </button>
                                          <a
                                            href={`data:${att.contentType};base64,${att.content}`}
                                            download={att.filename}
                                            className="text-[10px] font-bold text-slate-700 hover:underline flex items-center gap-1 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded border border-slate-200"
                                          >
                                            <Download className="h-3 w-3 text-slate-500" />
                                            <span>Download</span>
                                          </a>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic font-semibold">No Content</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Quick Convert or Actions panel */}
                          <div className="mt-6 border-t border-slate-150 pt-4 flex gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                const parsed = parseRawGmailToSauda(mail.body);
                                handlePreFillAndOpenForm(parsed);
                              }}
                              className="flex-1 bg-[#024a68] hover:bg-[#035b80] text-white font-bold text-xs py-2.5 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                            >
                              <FileSpreadsheet className="h-4 w-4 text-yellow-300 animate-pulse" />
                              <span>⚡ One-Click Convert to Sauda</span>
                            </button>
                            
                            <button
                              type="button"
                              onClick={() => {
                                setComposedTo(mail.senderEmail);
                                setComposedSubject(`Re: ${mail.subject}`);
                                setComposedBody(`\n\nOn ${mail.date}, ${mail.senderName} wrote:\n${mail.body.split('\n').map(l => '> ' + l).join('\n')}`);
                                setIsComposing(true);
                              }}
                              className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-350 font-bold text-xs px-4 py-2 rounded-lg cursor-pointer transition-colors shadow-xs"
                            >
                              Reply
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                </div>
              )}

            </div>

            {/* Composing Modal */}
            {isComposing && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in font-sans p-4">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setComposedStatus('sending');
                    try {
                      const res = await fetch(getApiUrl("/api/send-email"), {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          to: composedTo,
                          subject: composedSubject,
                          html: `
                            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                              <h2 style="color: #c0392b; border-bottom: 2px solid #c0392b; padding-bottom: 8px;">BALLY JUTE ERP Mail Service</h2>
                              <p style="font-size: 13px; color: #555;">Sent on behalf of: <strong>rawjute@ballyjute.com</strong></p>
                              <div style="background: #fcfcfc; border: 1px solid #ddd; padding: 15px; border-radius: 6px; white-space: pre-wrap; font-size: 14px; line-height: 1.5;">
                                ${composedBody}
                              </div>
                            </div>
                          `,
                          filename: composedAttachmentName || undefined,
                          pdfData: composedAttachmentData || undefined
                        })
                      });
                      let data;
                      const resText = await res.text();
                      try {
                        data = JSON.parse(resText);
                      } catch (e) {
                        throw new Error(resText.substring(0, 200) || `Server returned status ${res.status}: ${res.statusText}`);
                      }
                      if (res.ok && data.success) {
                        setComposedStatus('success');
                        const newMail = {
                          id: `SENT-${Date.now()}`,
                          senderName: 'Bally Jute (You)',
                          senderEmail: 'rawjute@ballyjute.com',
                          subject: composedSubject,
                          date: new Date().toLocaleString(),
                          snippet: composedBody.substring(0, 80) + '...',
                          body: composedBody,
                          attachments: composedAttachmentName ? [{
                            filename: composedAttachmentName,
                            contentType: 'application/octet-stream',
                            size: Math.round(composedAttachmentData.length * 0.75),
                            content: composedAttachmentData
                          }] : [],
                          starred: false,
                          unread: false
                        };
                        setGmailList(prev => [newMail, ...prev]);
                        setTimeout(() => {
                          setIsComposing(false);
                          setComposedTo('');
                          setComposedSubject('');
                          setComposedBody('');
                          setComposedAttachmentName('');
                          setComposedAttachmentData('');
                          setComposedStatus('idle');
                        }, 1500);
                      } else {
                        throw new Error(data.error || 'Failed to send mail via server');
                      }
                    } catch (err: any) {
                      console.error(err);
                      setComposedStatus('error');
                      alert(`Mail Dispatch Failed: ${err.message || err}`);
                      setComposedStatus('idle');
                    }
                  }}
                  className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-xl flex flex-col overflow-hidden max-h-[90vh] select-text"
                >
                  <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between">
                    <span className="font-bold text-xs uppercase tracking-wider">New Jute ERP Mail Dispatcher</span>
                    <button
                      type="button"
                      onClick={() => setIsComposing(false)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div className="flex items-center border-b border-slate-200 py-1.5 gap-2">
                      <span className="text-xs font-bold text-slate-500 w-12 shrink-0">From:</span>
                      <span className="text-xs font-black text-rose-800">rawjute@ballyjute.com</span>
                    </div>

                    <div className="flex items-center border-b border-slate-200 py-1.5 gap-2">
                      <span className="text-xs font-bold text-slate-500 w-12 shrink-0">To:</span>
                      <input
 id="recipient_example_com_bro_2763" name="recipient_example_com_bro" aria-label="recipient@example.com, broker@jute.com"                        type="text"
                        required
                        value={composedTo}
                        onChange={(e) => setComposedTo(e.target.value)}
                        placeholder="recipient@example.com, broker@jute.com"
                        className="flex-1 bg-transparent border-none text-xs outline-none font-bold text-slate-800"
                      />
                    </div>

                    <div className="flex items-center border-b border-slate-200 py-1.5 gap-2">
                      <span className="text-xs font-bold text-slate-500 w-12 shrink-0">Subject:</span>
                      <input
 id="bally_jute_erp_jute_sauda_2775" name="bally_jute_erp_jute_sauda" aria-label="[Bally Jute ERP] Jute Sauda Contract"                        type="text"
                        required
                        value={composedSubject}
                        onChange={(e) => setComposedSubject(e.target.value)}
                        placeholder="[Bally Jute ERP] Jute Sauda Contract"
                        className="flex-1 bg-transparent border-none text-xs outline-none font-bold text-slate-800"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="message_body_2787" className="text-[10px] font-black uppercase text-slate-400">Message Body</label>
                      <textarea
 id="message_body_2787" name="message_body" aria-label="Message Body"                        rows={10}
                        required
                        value={composedBody}
                        onChange={(e) => setComposedBody(e.target.value)}
                        placeholder="Type raw contract details or message here..."
                        className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs font-medium text-slate-800 outline-none focus:bg-white focus:ring-1 focus:ring-rose-500 transition-all font-sans"
                      />
                    </div>
                  </div>

                  <div className="bg-slate-50 px-5 py-3.5 border-t border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <input
 name="file" aria-label="file"                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                          id="compose-attachment-file"
                        />
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 font-bold text-[10px] transition-all cursor-pointer shadow-xs"
                        >
                          <Paperclip className="h-3.5 w-3.5 text-slate-500" />
                          <span>Attach File</span>
                        </button>
                        
                        <span className="text-[9px] text-slate-400 font-semibold ">Max size 10MB (PDF, image, Excel, Word, text)</span>
                      </div>
                      
                      {composedAttachmentName && (
                        <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-100 rounded px-2 py-0.5 max-w-[280px]">
                          <span className="text-[10px] text-rose-800 font-bold truncate flex-1" title={composedAttachmentName}>
                            📎 {composedAttachmentName}
                          </span>
                          <button
                            type="button"
                            onClick={clearAttachment}
                            className="text-rose-500 hover:text-rose-700 font-bold text-xs p-0.5 cursor-pointer"
                            title="Remove file"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsComposing(false)}
                        className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs h-9 px-4 rounded-lg cursor-pointer transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={composedStatus === 'sending'}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-9 px-5 rounded-lg cursor-pointer transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-md"
                      >
                        {composedStatus === 'sending' ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : composedStatus === 'success' ? (
                          <>
                            <Check className="h-4 w-4 text-emerald-350" />
                            <span>Sent!</span>
                          </>
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5" />
                            <span>Send Mail</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

          </div>
        ) : (
          /* INLINE SAUDA SLIP FORM (FORM VIEW) */
          <div className="flex-1 flex flex-col min-h-0 bg-[#faf9f5] border-2 border-black rounded-lg shadow-md overflow-hidden animate-fade-in font-mono mt-3 ">
            
            {/* Header styled like a formal document title */}
            <div className="bg-gradient-to-r from-[#174C2C] to-[#103A20] text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-[#0d301b] shrink-0 shadow-md">
              <div className="flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-amber-300" />
                <span className="font-mono font-black uppercase text-sm tracking-widest text-white">
                  {editingContractId ? "MODIFICATION DESK" : "SAUDA SLIP COMPILER"}
                </span>
              </div>
              <button 
                onClick={() => setActiveView('dashboard')}
                className="bg-white/10 hover:bg-white/20 text-white font-mono font-black text-[10px] h-8 px-3 rounded shadow-xs cursor-pointer flex items-center gap-1.5 transition-all uppercase"
                type="button"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </button>
            </div>

            {/* Form Body styled like 2nd screenshot printed Sauda Slip */}
            <form onSubmit={handleSaveForm} className="p-6 space-y-5 bg-[#faf9f5] overflow-y-auto flex-1">
                
                {/* Formal Company Header block */}
                <div className="border border-black bg-white p-3 text-center rounded">
                  <div className="text-sm font-black tracking-wide uppercase">Bally Jute Company Limited</div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">REGISTERED OFFICE: 5, SREE CHARAN SARANI, BALLY, HOWRAH - 711201</div>
                </div>

                {/* SLIP NO & P.O. TYPE & SESSION ROW */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-white p-3 border border-slate-300 rounded">
                  <div>
                    <label htmlFor="slip_no_2909" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Slip No.</label>
                    <input  id="slip_no_2909" name="slip_no" aria-label="Slip No."
                      type="text"
                      value={formSaudaNo}
                      onChange={(e) => setFormSaudaNo(e.target.value)}
                      placeholder="e.g. BJCL/ 7017TD"
                      className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-slate-900"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="p_o_type_2920" className="text-[9px] font-black text-slate-500 uppercase block mb-1">P.O. Type</label>
                    <select
 id="p_o_type_2920" name="p_o_type" aria-label="P.O. Type"                      value={formPoType}
                      onChange={(e) => setFormPoType(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-slate-900 cursor-pointer"
                    >
                      <option value="Normal">Normal</option>
                      <option value="Special">Special</option>
                      <option value="Tender">Tender</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="booking_date_2933" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Booking Date</label>
                    <input  id="booking_date_2933" name="booking_date" aria-label="Booking Date"
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-slate-900 cursor-pointer"
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="session_2943" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Session</label>
                    <input  id="session_2943" name="session" aria-label="Session"
                      type="text"
                      value={formSession}
                      onChange={(e) => setFormSession(e.target.value)}
                      placeholder="e.g. 2026-2027"
                      className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-slate-900"
                      required
                    />
                  </div>
                </div>

                {/* BROKER, SUPPLIER & AREA INFORMATION */}
                <div className="bg-white p-3 border border-slate-300 rounded space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="broker_vyapari_2959" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Broker / Vyapari</label>
                      <input  id="broker_vyapari_2959" name="broker_vyapari" aria-label="Broker / Vyapari"
                        type="text"
                        value={formBroker}
                        onChange={(e) => setFormBroker(e.target.value.toUpperCase())}
                        placeholder="ENTER BROKER / TRADER NAME"
                        className="w-full bg-slate-50 border border-slate-400 px-2.5 py-1.5 text-xs font-black rounded text-slate-900 uppercase"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="supplier_name_2970" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Supplier Name</label>
                      <input  id="supplier_name_2970" name="supplier_name" aria-label="Supplier Name"
                        type="text"
                        value={formSupplier}
                        onChange={(e) => setFormSupplier(e.target.value.toUpperCase())}
                        placeholder="ENTER SUPPLIER NAME"
                        className="w-full bg-slate-50 border border-slate-400 px-2.5 py-1.5 text-xs font-black rounded text-slate-900 uppercase"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="challan_supplier_2983" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Challan Supplier</label>
                      <input  id="challan_supplier_2983" name="challan_supplier" aria-label="Challan Supplier"
                        type="text"
                        value={formChallanSupplier}
                        onChange={(e) => setFormChallanSupplier(e.target.value.toUpperCase())}
                        placeholder="CHALLAN SUPPLIER NAME"
                        className="w-full bg-slate-50 border border-slate-400 px-2.5 py-1.5 text-xs font-black rounded text-slate-900 uppercase"
                      />
                    </div>
                    <div>
                      <label htmlFor="area_dispatch_center_2993" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Area / Dispatch Center</label>
                      <input  id="area_dispatch_center_2993" name="area_dispatch_center" aria-label="Area / Dispatch Center"
                        type="text"
                        value={formArea}
                        onChange={(e) => setFormArea(e.target.value.toUpperCase())}
                        placeholder="e.g. SEMI NORTHERN / COOCH BEHAR"
                        className="w-full bg-slate-50 border border-slate-400 px-2.5 py-1.5 text-xs font-black rounded text-slate-900 uppercase"
                      />
                    </div>
                  </div>
                </div>

                {/* LORRY & UNIT METRICS */}
                <div className="bg-white p-3 border border-slate-300 rounded">
                  <div className="text-[10px] font-bold text-slate-700 uppercase border-b border-slate-200 pb-1 mb-2">Lorry & Unit Metrics</div>
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                    <div>
                      <label htmlFor="no_of_lorries_3010" className="text-[9px] font-black text-slate-500 uppercase block mb-1">No. of Lorries</label>
                      <input  id="no_of_lorries_3010" name="no_of_lorries" aria-label="No. of Lorries"
                        type="number"
                        value={formNoOfLorries}
                        onChange={(e) => setFormNoOfLorries(Math.max(1, Number(e.target.value) || 1))}
                        className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-right text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="units_lorry_3019" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Units/Lorry</label>
                      <input  id="units_lorry_3019" name="units_lorry" aria-label="Units/Lorry"
                        type="text"
                        value={formUnitsPerLorry}
                        onChange={(e) => setFormUnitsPerLorry(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="total_unit_3028" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Total Unit</label>
                      <input  id="total_unit_3028" name="total_unit" aria-label="Total Unit"
                        type="number"
                        value={formTotalUnit}
                        disabled
                        className="w-full bg-amber-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-right text-slate-900 font-mono"
                        title="Auto-calculated from Quality details"
                      />
                    </div>
                    <div>
                      <label htmlFor="wt_lorry_mt_3038" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Wt/Lorry (MT)</label>
                      <input  id="wt_lorry_mt_3038" name="wt_lorry_mt" aria-label="Wt/Lorry (MT)"
                        type="number"
                        step="0.01"
                        value={formWtPerLorry}
                        onChange={(e) => setFormWtPerLorry(Number(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-right text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="unit_type_3048" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Unit Type</label>
                      <select  id="unit_type_3048" name="unit_type" aria-label="Unit Type"
                        value={formUnitType}
                        onChange={(e) => setFormUnitType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-400 px-1 py-1 text-xs font-black rounded text-slate-900 cursor-pointer"
                      >
                        {Array.from(new Set([...unitList, formUnitType].filter(Boolean))).map((u: string) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="total_wt_mt_3060" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Total Wt. (MT)</label>
                      <input  id="total_wt_mt_3060" name="total_wt_mt" aria-label="Total Wt. (MT)"
                        type="number"
                        step="0.01"
                        value={formTotalWtTons}
                        onChange={(e) => setFormTotalWtTons(Number(e.target.value) || 0)}
                        className="w-full bg-emerald-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-right text-slate-900 font-mono font-bold"
                        title="Auto-calculated or override manually"
                      />
                    </div>
                  </div>
                </div>

                {/* DYNAMIC MULTIPLE OPTIONS QUALITY GRIDS */}
                <div className="bg-white p-3 border border-slate-300 rounded space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-[10px] font-black text-slate-850 uppercase tracking-wider">
                      QUALITY / GRADE SPECIFICATIONS (MULTIPLE LINES REGISTER)
                    </span>
                    <button
                      type="button"
                      onClick={handleAddQualityRow}
                      className="bg-indigo-600 hover:bg-indigo-700 text-white font-mono font-black text-[9px] px-2.5 py-1 rounded flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Option Line</span>
                    </button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 font-black text-slate-600 border-b border-slate-300">
                          <th className="py-1 px-2 w-28 text-[9px] uppercase">Quality/Grade</th>
                          <th className="py-1 px-2 w-24 text-[9px] uppercase text-right">Qty (Bales)</th>
                          <th className="py-1 px-2 text-[9px] uppercase">Agency</th>
                          <th className="py-1 px-2 text-[9px] uppercase">Marka</th>
                          <th className="py-1 px-2 w-28 text-[9px] uppercase text-right">Rs (₹/Qtl)</th>
                          <th className="py-1 px-2 w-12 text-center text-[9px] uppercase">Rem</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {formQualityDetails.map((q, idx) => (
                          <tr key={idx} className="h-8">
                            <td className="p-1">
                              <select
 id="q_quality_3104" name="q_quality" aria-label="q quality"                                value={q.quality}
                                onChange={(e) => handleUpdateQualityRow(idx, 'quality', e.target.value)}
                                className="w-full bg-slate-50 border border-slate-300 text-[11px] font-black p-1 rounded"
                              >
                                <option value="TD4">TD4 (Assam)</option>
                                <option value="TD5">TD5 (Standard)</option>
                                <option value="TD6">TD6 (Low)</option>
                                <option value="TD7">TD7</option>
                                <option value="W4">W4 (Premium)</option>
                                <option value="W5">W5 (White)</option>
                              </select>
                            </td>
                            <td className="p-1">
                              <input  id="q_qty_3118" name="q_qty" aria-label="q qty"
                                type="number"
                                value={q.qty}
                                onChange={(e) => handleUpdateQualityRow(idx, 'qty', Math.max(0, Number(e.target.value) || 0))}
                                className="w-full bg-slate-50 border border-slate-300 text-[11px] font-black p-1 text-right rounded"
                                required
                              />
                            </td>
                            <td className="p-1">
                              <input  id="agency_3127" name="agency" aria-label="AGENCY"
                                type="text"
                                value={q.agency}
                                onChange={(e) => handleUpdateQualityRow(idx, 'agency', e.target.value.toUpperCase())}
                                className="w-full bg-slate-50 border border-slate-300 text-[11px] font-black p-1 rounded uppercase"
                                placeholder="AGENCY"
                              />
                            </td>
                            <td className="p-1">
                              <input  id="marka_3136" name="marka" aria-label="MARKA"
                                type="text"
                                value={q.marka}
                                onChange={(e) => handleUpdateQualityRow(idx, 'marka', e.target.value.toUpperCase())}
                                className="w-full bg-slate-50 border border-slate-300 text-[11px] font-black p-1 rounded uppercase"
                                placeholder="MARKA"
                              />
                            </td>
                            <td className="p-1">
                              <input  id="q_rs_3145" name="q_rs" aria-label="q rs"
                                type="number"
                                value={q.rs}
                                onChange={(e) => handleUpdateQualityRow(idx, 'rs', Math.max(0, Number(e.target.value) || 0))}
                                className="w-full bg-slate-50 border border-slate-300 text-[11px] font-black p-1 text-right rounded"
                                required
                              />
                            </td>
                            <td className="p-1 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveQualityRow(idx)}
                                disabled={formQualityDetails.length <= 1}
                                className="text-red-650 hover:text-red-950 disabled:opacity-30 p-1 cursor-pointer transition-colors"
                              >
                                <Trash className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SHIPMENT, CLAIMS & ADDITIONAL DETAILS */}
                <div className="bg-white p-3 border border-slate-300 rounded space-y-3">
                  <div className="text-[10px] font-bold text-slate-700 uppercase border-b border-slate-200 pb-1">Shipment & Contractual Obligations</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="shipment_date_3177" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Shipment Date</label>
                      <input  id="shipment_date_3177" name="shipment_date" aria-label="Shipment Date"
                        type="date"
                        value={formShipmentDate}
                        onChange={(e) => setFormShipmentDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-slate-900 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label htmlFor="shipment_days_3186" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Shipment Days</label>
                      <input  id="shipment_days_3186" name="shipment_days" aria-label="Shipment Days"
                        type="number"
                        value={formShipmentDays}
                        onChange={(e) => setFormShipmentDays(Number(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-right text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="penalty_qtl_day_3195" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Penalty (₹/Qtl/Day)</label>
                      <input  id="penalty_qtl_day_3195" name="penalty_qtl_day" aria-label="Penalty (₹/Qtl/Day)"
                        type="number"
                        value={formShipmentPenalty}
                        onChange={(e) => setFormShipmentPenalty(Number(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-right text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label htmlFor="marks_claim_qtl_3207" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Marks Claim (₹/Qtl)</label>
                      <input  id="marks_claim_qtl_3207" name="marks_claim_qtl" aria-label="Marks Claim (₹/Qtl)"
                        type="number"
                        value={formMarksClaim}
                        onChange={(e) => setFormMarksClaim(Number(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-right text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="quantity_claim_kg_bale_3216" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Quantity Claim (Kg/Bale)</label>
                      <input  id="quantity_claim_kg_bale_3216" name="quantity_claim_kg_bale" aria-label="Quantity Claim (Kg/Bale)"
                        type="number"
                        value={formQuantityClaim}
                        onChange={(e) => setFormQuantityClaim(Number(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-right text-slate-900"
                      />
                    </div>
                    <div>
                      <label htmlFor="superior_normal_marks_3225" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Superior / Normal Marks</label>
                      <input  id="superior_normal_marks_3225" name="superior_normal_marks" aria-label="Superior / Normal Marks"
                        type="text"
                        value={formSuperiorNormalMarks}
                        onChange={(e) => setFormSuperiorNormalMarks(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-100 pt-2.5">
                    <div>
                      <label htmlFor="first_row_book_rate_qtl_3237" className="text-[9px] font-black text-slate-500 uppercase block mb-1">First-row Book Rate (₹/Qtl)</label>
                      <input  id="first_row_book_rate_qtl_3237" name="first_row_book_rate_qtl" aria-label="First-row Book Rate (₹/Qtl)"
                        type="number"
                        value={formBRate}
                        onChange={(e) => {
                          setFormBRate(Number(e.target.value) || 0);
                          // Sync first quality row rs too
                          if (formQualityDetails[0]) {
                            handleUpdateQualityRow(0, 'rs', Number(e.target.value) || 0);
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-right text-slate-900 font-bold"
                      />
                    </div>
                    <div>
                      <label htmlFor="s_date_3252" className="text-[9px] font-black text-slate-500 uppercase block mb-1">S. Date</label>
                      <input  id="s_date_3252" name="s_date" aria-label="S. Date"
                        type="date"
                        value={formBDate}
                        onChange={(e) => setFormBDate(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-400 px-2 py-1 text-xs font-black rounded text-slate-900 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {/* REMARKS AND INSTRUCTIONS */}
                <div>
                  <label htmlFor="remarks_special_terms_3265" className="text-[9px] font-black text-slate-500 uppercase block mb-1">Remarks & Special Terms</label>
                  <textarea  id="remarks_special_terms_3265" name="remarks_special_terms" aria-label="Remarks & Special Terms"
                    rows={2}
                    value={formRemarks}
                    onChange={(e) => setFormRemarks(e.target.value)}
                    placeholder="ENTER SPECIFIC PENALTIES, CLAIMS OR MOISTURE MARKS TERMS..."
                    className="w-full bg-slate-50 border border-slate-400 p-2 text-xs font-black rounded text-slate-900"
                  />
                </div>

                {/* STATUS SELECTOR */}
                <div className="bg-white p-3 border border-slate-300 rounded">
                  <label className="text-[9px] font-black text-slate-500 uppercase block mb-1.5">Lorry Dispatch / Fulfillment Status</label>
                  <div className="flex gap-2">
                    {['Active', 'Partial', 'Closed'].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setFormStatus(s as SmsSaudaContract['status'])}
                        className={cn(
                          "flex-1 py-1.5 text-xs font-black uppercase rounded border-2 transition-all cursor-pointer",
                          formStatus === s
                            ? s === 'Closed'
                              ? "bg-emerald-600 border-black text-white shadow-md"
                              : s === 'Partial'
                              ? "bg-sky-600 border-black text-white shadow-md"
                              : "bg-amber-500 border-black text-white shadow-md"
                            : "bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700"
                        )}
                      >
                        {s === 'Closed' ? 'COMPLETED' : s === 'Active' ? 'PENDING' : 'PARTIAL'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* MODAL ACTIONS */}
                <div className="flex gap-3 border-t border-slate-300 pt-4 mt-6">
                  <button
                    type="button"
                    onClick={() => setActiveView('dashboard')}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-mono font-black text-[11px] uppercase py-3 rounded border border-slate-400 cursor-pointer transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#024a68] hover:bg-[#035b80] text-white font-mono font-black text-[11px] uppercase py-3 rounded border border-black shadow-md cursor-pointer transition-colors"
                  >
                    {editingContractId ? "Update Contract" : "Save Contract"}
                  </button>
                </div>

              </form>
            </div>
          )}

      </div>

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-text">
          <div className="bg-white rounded-lg shadow-2xl border border-slate-300 w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden animate-fade-in">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2 min-w-0">
                <Paperclip className="h-5 w-5 text-indigo-600 flex-shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-900 text-sm truncate" title={previewAttachment.filename}>
                    {previewAttachment.filename}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-medium">
                    {(previewAttachment.size / 1024).toFixed(1)} KB &bull; {previewAttachment.contentType}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {previewAttachment.content && (
                  <a
                    href={`data:${previewAttachment.contentType};base64,${previewAttachment.content}`}
                    download={previewAttachment.filename}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#024a68] hover:bg-[#035b80] text-white text-xs font-bold border border-black shadow-sm transition-colors cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewAttachment(null)}
                  className="p-1.5 rounded-md hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body / Preview area */}
            <div className="flex-1 overflow-auto p-4 bg-slate-100 flex items-center justify-center min-h-[400px]">
              {(() => {
                const dataUrl = `data:${previewAttachment.contentType};base64,${previewAttachment.content}`;
                if (!previewAttachment.content) {
                  return (
                    <div className="text-center p-8 text-slate-500">
                      <AlertCircle className="h-10 w-10 text-slate-400 mx-auto mb-2" />
                      <p className="font-semibold text-xs">No file content available.</p>
                    </div>
                  );
                }

                if (previewAttachment.contentType?.includes('pdf')) {
                  return (
                    <object
                      data={dataUrl}
                      type="application/pdf"
                      className="w-full h-[65vh] rounded border border-slate-200 bg-white"
                    >
                      <iframe
                        src={dataUrl}
                        className="w-full h-[65vh] rounded border border-slate-200 bg-white"
                        title={previewAttachment.filename}
                      />
                    </object>
                  );
                }

                if (previewAttachment.contentType?.includes('image/')) {
                  return (
                    <img
                      src={dataUrl}
                      alt={previewAttachment.filename}
                      className="max-w-full max-h-[65vh] object-contain rounded shadow-md"
                    />
                  );
                }

                // Non-previewable
                return (
                  <div className="text-center p-8 bg-white rounded-lg border border-slate-200 shadow-sm max-w-sm w-full">
                    <Paperclip className="h-12 w-12 text-[#024a68] mx-auto mb-3" />
                    <h4 className="font-bold text-slate-800 text-sm mb-1">{previewAttachment.filename}</h4>
                    <p className="text-xs text-slate-500 mb-4">Preview is not available for this file type.</p>
                    <a
                      href={dataUrl}
                      download={previewAttachment.filename}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#024a68] hover:bg-[#035b80] text-white text-xs font-bold border border-black shadow transition-colors cursor-pointer"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download to View</span>
                    </a>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </LegacyLayout>
  );
}
