// Shared helpers for Shopify's product CSV (current format).
// HEADERS is the exact header row of https://help.shopify.com/csv/product_template.csv
// (checked 2026-09-27). `npm run demo:verify -- --live` re-downloads the template and diffs it.

export const TEMPLATE_URL = 'https://help.shopify.com/csv/product_template.csv';

export const HEADERS = [
  'Title',
  'URL handle',
  'Description',
  'Vendor',
  'Product category',
  'Type',
  'Tags',
  'Published on online store',
  'Status',
  'SKU',
  'Barcode',
  'Option1 name',
  'Option1 value',
  'Option1 Linked To',
  'Option2 name',
  'Option2 value',
  'Option2 Linked To',
  'Option3 name',
  'Option3 value',
  'Option3 Linked To',
  'Price',
  'Compare-at price',
  'Cost per item',
  'Charge tax',
  'Tax code',
  'Unit price total measure',
  'Unit price total measure unit',
  'Unit price base measure',
  'Unit price base measure unit',
  'Inventory tracker',
  'Inventory quantity',
  'Continue selling when out of stock',
  'Weight value (grams)',
  'Weight unit for display',
  'Requires shipping',
  'Fulfillment service',
  'Product image URL',
  'Image position',
  'Image alt text',
  'Variant image URL',
  'Gift card',
  'SEO title',
  'SEO description',
  'Color (product.metafields.shopify.color-pattern)',
  'Google Shopping / Google product category',
  'Google Shopping / Gender',
  'Google Shopping / Age group',
  'Google Shopping / Manufacturer part number (MPN)',
  'Google Shopping / Ad group name',
  'Google Shopping / Ads labels',
  'Google Shopping / Condition',
  'Google Shopping / Custom product',
  'Google Shopping / Custom label 0',
  'Google Shopping / Custom label 1',
  'Google Shopping / Custom label 2',
  'Google Shopping / Custom label 3',
  'Google Shopping / Custom label 4',
];

/** Quotes a single CSV field only when it has to (comma, quote, newline, edge whitespace). */
export function encodeField(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  if (/[",\r\n]/.test(text) || /^\s|\s$/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/**
 * Turns row objects (keyed by header name) into CSV text with LF line endings.
 * Unknown keys throw, so a typo in a column name can never silently drop data.
 */
export function toCsv(rows, headers = HEADERS) {
  const known = new Set(headers);
  const lines = [headers.map(encodeField).join(',')];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!known.has(key)) throw new Error(`Unknown CSV column: "${key}"`);
    }
    lines.push(headers.map((header) => encodeField(row[header])).join(','));
  }
  return `${lines.join('\n')}\n`;
}

/** RFC 4180 parser (quoted fields, escaped quotes, newlines inside quotes). Returns string[][]. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  if (inQuotes) throw new Error('CSV ends inside a quoted field');
  return rows;
}
