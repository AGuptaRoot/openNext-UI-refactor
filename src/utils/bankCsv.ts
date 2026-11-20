import type { BankRow } from '../types/reconciliation';

/**
 * Bank statement CSV → rows (GST suite, CRM 3.53.0). Read in the browser: the file itself is never uploaded
 * or stored. Finds the header row (a "Date" column), then the description, reference, debit / withdrawal,
 * credit / deposit and balance columns. A single "Amount" column needs a Dr / Cr column next to it; the
 * direction is never guessed from a sign. Dates are sent as written: the server normalises them.
 */

/** Split CSV text into rows of cells (quotes and commas inside quotes handled). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

/** "1,23,456.70", "₹ 500.00 Cr", "(200)" → a positive number (0 when empty). */
export function amountOf(value: string): number {
  const cleaned = String(value || '').replace(/[₹,\s]/g, '').replace(/(cr|dr)\.?$/i, '').replace(/^\((.*)\)$/, '$1');
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.abs(Math.round(n * 100) / 100) : 0;
}

const find = (header: string[], ...patterns: RegExp[]): number => {
  for (const re of patterns) {
    const i = header.findIndex((h) => re.test(h));
    if (i >= 0) return i;
  }
  return -1;
};

export interface BankCsvResult {
  rows: BankRow[];
  problem: string;
}

export function bankRowsFromCsv(text: string): BankCsvResult {
  const table = parseCsv(text);
  const headerAt = table.findIndex((r) => r.some((c) => /^(txn\.?\s*|transaction\s*|value\s*)?date$/i.test(c)));
  if (headerAt < 0) return { rows: [], problem: 'No "Date" column found. Export the statement as CSV with a header row.' };
  const header = table[headerAt].map((h) => h.toLowerCase());
  const col = {
    date: find(header, /^(txn\.?\s*|transaction\s*)date$/, /^date$/, /value\s*date/),
    description: find(header, /narration|description|particulars|details|remarks/),
    reference: find(header, /utr|ref|cheque|chq/),
    debit: find(header, /withdrawal|debit|^dr$/),
    credit: find(header, /deposit|credit|^cr$/),
    amount: find(header, /^amount/),
    drcr: find(header, /^(dr\s*\/\s*cr|cr\s*\/\s*dr|type|dr\/cr)$/),
    balance: find(header, /balance/)
  };
  const single = col.debit < 0 && col.credit < 0;
  if (single && (col.amount < 0 || col.drcr < 0)) {
    return { rows: [], problem: 'Need separate Withdrawal and Deposit columns, or an Amount column with a Dr / Cr column.' };
  }
  const rows: BankRow[] = [];
  for (const r of table.slice(headerAt + 1)) {
    const get = (i: number) => (i >= 0 ? r[i] || '' : '');
    let credit = amountOf(get(col.credit));
    let debit = amountOf(get(col.debit));
    if (single) {
      const amount = amountOf(get(col.amount));
      const type = get(col.drcr).toLowerCase();
      credit = /^c/.test(type) ? amount : 0;
      debit = /^d/.test(type) ? amount : 0;
    }
    rows.push({
      date: get(col.date),
      description: get(col.description),
      reference: get(col.reference),
      credit,
      debit,
      balance: amountOf(get(col.balance)),
    });
  }
  return { rows: rows.filter((r) => r.date && (r.credit > 0 || r.debit > 0)), problem: '' };
}
