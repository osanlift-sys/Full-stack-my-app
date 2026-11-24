export const DEFAULT_NOTES = [
  'This offer excludes VAT, Tax, and AIT.',
  'One-year warranty on all electrical equipment (excluding high voltage, earthquake, water damage).',
  'The offer is valid for 15 days from the date of issuance.',
];

export const DEFAULT_PAYMENT_MODE = [
  'Payment by cash.',
  '80% advance.',
  '20% handover date.'
];

export const convertToWords = (num) => {
  if (!num && num !== 0) return 'Zero Taka Only';

  const [takaStr, paisaStr] = Number(num).toFixed(2).split('.');
  const taka = parseInt(takaStr, 10);
  const paisa = parseInt(paisaStr, 10);

  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  };

  let result = taka === 0 ? 'Zero Taka' : `${inWords(taka)} Taka`;

  if (paisa > 0) {
    result += ` and ${inWords(paisa)} Paisa`;
  }

  return `${result} Only`;
};