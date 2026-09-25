export interface AreaDifferential {
  area: string;
  diffs: Record<string, number>;
}

export const EXCEL_SEED_DATA: AreaDifferential[] = [
  {
    area: "DAISEE",
    diffs: { TD4: 600, TD5: -300, TD6: -200, TD7: -500, TD8: -1000, "H.BALES": -50, DRUMS: -100 }
  },
  {
    area: "TULSIHATTA",
    diffs: { TD5: 750, TD6: 350, TD7: -50, TD8: -550 }
  },
  {
    area: "BANGLADESH",
    diffs: { "BTR HD KS": 2800, "BTR HD CS": 2300, "BTR HD BS": 1800, "BTR NB KS": 800, "BTR NB FFS": 1300, "BTR NB (SMR)": 200 }
  },
  {
    area: "GRP LOOSE",
    diffs: { TD5: 400, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "L/A TARABARI",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100 }
  },
  {
    area: "U/ASSAM",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100, LOOSE: -200 }
  },
  {
    area: "KANKI",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "RAIGANJ",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "DHULIYAAN",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "MALDA",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "BELAKOBA",
    diffs: { TD4: 200, TD5: 0, TD6: -400, TD7: -900 }
  },
  {
    area: "SONAPATIL",
    diffs: { TD5: 750, TD6: 350, TD7: -50, TD8: -550 }
  },
  {
    area: "DHUBRI",
    diffs: { TD4: 700, TD5: 350, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "PURNEA",
    diffs: { TD5: 450, TD6: 150, TD7: -250, TD8: -750 }
  },
  {
    area: "SAHARSA",
    diffs: { TD5: 600, TD6: 200, TD7: -200, TD8: -700 }
  },
  {
    area: "SUPAUL",
    diffs: { TD5: 600, TD6: 200, TD7: -200, TD8: -700 }
  },
  {
    area: "KISHANGANJ",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "ISLAMPUR",
    diffs: { TD5: 800, TD6: 400, TD7: 0, TD8: -500 }
  },
  {
    area: "MADHEPURA",
    diffs: { TD5: 600, TD6: 200, TD7: -200, TD8: -700 }
  },
  {
    area: "FORBESGANJ",
    diffs: { TD5: 450, TD6: 150, TD7: -250, TD8: -750 }
  },
  {
    area: "GULABBAGH",
    diffs: { TD5: 450, TD6: 150, TD7: -250, TD8: -750 }
  },
  {
    area: "KASBA",
    diffs: { TD5: 450, TD6: 150, TD7: -250, TD8: -750 }
  },
  {
    area: "JALPAIGURI",
    diffs: { TD4: 200, TD5: 0, TD6: -400, TD7: -900 }
  },
  {
    area: "COOCHBEHAR",
    diffs: { TD4: 200, TD5: 0, TD6: -400, TD7: -900 }
  },
  {
    area: "DUMDUMA",
    diffs: { TD4: 2000, TD5: 1600, TD6: 1100, TD7: 500, TD8: 100 }
  },
  {
    area: "N/LAKHIMPUR",
    diffs: { TD4: 2000, TD5: 1600, TD6: 1100, TD7: 500, TD8: 100 }
  },
  {
    area: "DHEMAJI",
    diffs: { TD4: 2000, TD5: 1600, TD6: 1100, TD7: 500, TD8: 100 }
  },
  {
    area: "KOKRAJHAR",
    diffs: { TD4: 700, TD5: 350, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "BONGAIGAON",
    diffs: { TD4: 700, TD5: 350, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "NAGAON",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100 }
  },
  {
    area: "KHARUPETIA",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100 }
  },
  {
    area: "BARPETA ROAD",
    diffs: { TD4: 1000, TD5: 600, TD6: 200, TD7: -200, TD8: -700 }
  },
  {
    area: "BILASIPARA",
    diffs: { TD4: 700, TD5: 350, TD6: 0, TD7: -400, TD8: -900 }
  },
  {
    area: "MANKACHAR",
    diffs: { TD4: 500, TD5: 200, TD6: -100, TD7: -500, TD8: -1000 }
  },
  {
    area: "AGARTALA",
    diffs: { TD5: 600, TD6: 200, TD7: -200, TD8: -700 }
  },
  {
    area: "SILCHAR",
    diffs: { TD4: 1800, TD5: 1400, TD6: 900, TD7: 300, TD8: -100 }
  },
  {
    area: "KHARAGPUR",
    diffs: { TD5: 0, TD6: -400, TD7: -800, TD8: -1300 }
  },
  {
    area: "BAHARAMPUR",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "KRISHNANAGAR",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "KALYANI",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "HABRA",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  },
  {
    area: "BONGAON",
    diffs: { TD4: 0, TD5: -200, TD6: -500, TD7: -1000 }
  }
];

export const PREDEFINED_RANKS: Record<string, number> = {
  // Top White / Mesta / Special
  'W1': 10, 'TD1': 10, 'M1': 10, 'BOT': 15,
  'W2': 20, 'TD2': 20, 'M2': 20, 'BTR': 25,
  'W3': 30, 'TD3': 30, 'M3': 30,
  'W4': 40, 'TD4': 40, 'M4': 40,
  'W5': 50, 'TD5': 50, 'M5': 50,
  'W6': 60, 'TD6': 60, 'M6': 60,
  'W7': 70, 'TD7': 70, 'M7': 70,
  'W8': 80, 'TD8': 80, 'M8': 80,
  'LOOSE': 90, 'DRUMS': 95, 'H.BALES': 100,
  'HABIJABI': 110, 'ROPE': 120, 'CUTTING': 130, 'TC': 140, 'REJECTION': 150
};

export const formatPoNumber = (sauda: any) => {
  if (!sauda) return '';
  if (sauda.sauda_no) {
    const numPart = parseInt(sauda.sauda_no, 10);
    const val = isNaN(numPart) ? sauda.sauda_no : numPart;
    const cleanNo = String(val).replace(/^(PO|SAUDA)[-\s]*/i, '');
    return `PO-${cleanNo}`;
  }
  return '';
};

export const compareQualities = (aStr: string, bStr: string): number => {
  const clean = (val: string) => {
    return (val || '')
      .toUpperCase()
      .trim()
      .replace(/[\s\-_]/g, '')
      .replace(/^ITEM\d*/, '')
      .trim();
  };

  const a = clean(aStr);
  const b = clean(bStr);

  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;

  const rankA = PREDEFINED_RANKS[a];
  const rankB = PREDEFINED_RANKS[b];

  if (rankA !== undefined && rankB !== undefined) {
    return rankA - rankB;
  }
  if (rankA !== undefined) return -1;
  if (rankB !== undefined) return 1;

  const regex = /^([A-Z]+)(\d+)(.*)$/;
  const matchA = a.match(regex);
  const matchB = b.match(regex);

  if (matchA && matchB) {
    const prefixA = matchA[1];
    const prefixB = matchB[1];
    if (prefixA !== prefixB) {
      return prefixA.localeCompare(prefixB);
    }
    const numA = parseInt(matchA[2], 10);
    const numB = parseInt(matchB[2], 10);
    if (numA !== numB) {
      return numA - numB;
    }
    return (matchA[3] || '').localeCompare(matchB[3] || '');
  }

  return a.localeCompare(b);
};

export const numberToWords = (num: number): string => {
  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
  if (!n) return '';
  let str = '';
  str += (Number(n[1]) !== 0) ? (a[Number(n[1])] || b[Number(n[1][0])] + ' ' + a[Number(n[1][1])]) + 'Crore ' : '';
  str += (Number(n[2]) !== 0) ? (a[Number(n[2])] || b[Number(n[2][0])] + ' ' + a[Number(n[2][1])]) + 'Lakh ' : '';
  str += (Number(n[3]) !== 0) ? (a[Number(n[3])] || b[Number(n[3][0])] + ' ' + a[Number(n[3][1])]) + 'Thousand ' : '';
  str += (Number(n[4]) !== 0) ? (a[Number(n[4])] || b[Number(n[4][0])] + ' ' + a[Number(n[4][1])]) + 'Hundred ' : '';
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[Number(n[5][0])] + ' ' + a[Number(n[5][1])]) : '';
  return str.trim() + ' Rupees Only';
};
