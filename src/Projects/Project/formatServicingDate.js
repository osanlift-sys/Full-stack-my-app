const formatServicingDate = (value) => {
  if (!value) return '-';

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value).trim());
  if (isoDate) {
    const [, year, month, day] = isoDate;
    const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      parsedDate.getUTCFullYear() !== Number(year) ||
      parsedDate.getUTCMonth() !== Number(month) - 1 ||
      parsedDate.getUTCDate() !== Number(day)
    ) {
      return '-';
    }

    return `${day}/${month}/${year}`;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? '-' : parsedDate.toLocaleDateString('en-GB');
};

export default formatServicingDate;
