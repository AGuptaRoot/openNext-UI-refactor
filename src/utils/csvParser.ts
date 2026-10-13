/**
 * Robust CSV/TSV/semicolon parser and sample template generator.
 * Auto-detects delimiter (comma, tab, semicolon) from the header line.
 * Handles quoted fields, inner commas, escaped quotes, and multiline values.
 */

function detectDelimiter(text: string): string {
  const firstLine = (text.split(/\r?\n/).find((line) => line.trim()) || '').replace(/^\uFEFF/, '');
  if (!firstLine) return ',';

  // Count delimiters outside of quotes on the header line
  const counts: Record<string, number> = { ',': 0, '\t': 0, ';': 0 };
  let inQuotes = false;
  for (let i = 0; i < firstLine.length; i++) {
    const char = firstLine[i];
    if (char === '"') {
      if (inQuotes && firstLine[i + 1] === '"') {
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && (char === ',' || char === '\t' || char === ';')) {
      counts[char] += 1;
    }
  }

  let best = ',';
  let bestCount = -1;
  for (const delimiter of [',', '\t', ';'] as const) {
    if (counts[delimiter] > bestCount) {
      best = delimiter;
      bestCount = counts[delimiter];
    }
  }
  return bestCount > 0 ? best : ',';
}

export function parseCsvString(text: string): Array<Record<string, string>> {
  if (!text || !text.trim()) return [];

  const delimiter = detectDelimiter(text);
  const lines: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      row.push(field.trim());
      field = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(field.trim());
      field = '';
      if (row.some((cell) => cell.length > 0)) {
        lines.push(row);
      }
      row = [];
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field.trim());
    if (row.some((cell) => cell.length > 0)) {
      lines.push(row);
    }
  }

  if (!lines.length) return [];

  // Strip BOM from first header if present
  const headers = lines[0].map((h) => h.replace(/^\uFEFF/, '').trim());
  const objects: Array<Record<string, string>> = [];

  for (let r = 1; r < lines.length; r++) {
    const values = lines[r];
    const obj: Record<string, string> = {};
    let hasValue = false;
    for (let h = 0; h < headers.length; h++) {
      const key = headers[h];
      if (!key) continue;
      const val = values[h] !== undefined ? values[h] : '';
      if (val) hasValue = true;
      obj[key] = val;
    }
    if (hasValue) objects.push(obj);
  }

  return objects;
}

export function generateSampleLeadCsv(): string {
  const headers = [
    'Name',
    'Company Name',
    'Email',
    'Phone',
    'Pipeline Stage',
    'Lead Source',
    'Budget / Value',
    'Job Title',
    'City',
    'State',
    'Country',
    'Notes',
  ];

  const rows = [
    [
      'Rahul Mehta',
      'Alpha Tech Pvt Ltd',
      'rahul.mehta@example.com',
      '+91 9000000001',
      'New',
      'Website',
      '75000',
      'VP Technology',
      'Mumbai',
      'Maharashtra',
      'India',
      'Interested in CRM automation package',
    ],
    [
      'Priya Sharma',
      'Nova Solutions',
      'priya.sharma@example.com',
      '+91 9000000002',
      'Contacted',
      'LinkedIn',
      '120000',
      'Operations Director',
      'Bengaluru',
      'Karnataka',
      'India',
      'Requested technical demo',
    ],
  ];

  const escapeCell = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCell).join(','));

  return [headerLine, ...rowLines].join('\r\n');
}

export function generateSampleClientCsv(): string {
  const headers = [
    'Company Name',
    'Company Email',
    'Company Phone',
    'Website',
    'Tax ID',
    'Category',
    'Status',
    'Tags',
    'Billing Street',
    'Billing City',
    'Billing State',
    'Billing Country',
    'Billing ZIP',
    'Contact Name',
    'Contact Email',
    'Contact Phone',
    'Contact Designation',
  ];

  const rows = [
    [
      'Acme Corporation',
      'contact@acme.com',
      '+91 98765 43210',
      'https://acme.com',
      'TAX-2026-0001',
      'Enterprise',
      'Active',
      'Key Account, Tier 1',
      '123 Business Boulevard',
      'Mumbai',
      'Maharashtra',
      'India',
      '400001',
      'John Smith',
      'john@acme.com',
      '+91 98765 43211',
      'Chief Procurement Officer',
    ],
    [
      'Zenith Retail Ventures',
      'info@zenithretail.in',
      '+91 99887 76655',
      'https://zenithretail.in',
      'TAX-2026-0003',
      'Retainer',
      'Active',
      'Referral Partner',
      '88 MG Road',
      'Bengaluru',
      'Karnataka',
      'India',
      '560001',
      'Amit Sharma',
      'amit@zenithretail.in',
      '+91 99887 76656',
      'Managing Partner',
    ],
  ];

  const escapeCell = (val: string) => `"${val.replace(/"/g, '""')}"`;
  const headerLine = headers.map(escapeCell).join(',');
  const rowLines = rows.map((r) => r.map(escapeCell).join(','));

  return [headerLine, ...rowLines].join('\r\n');
}
