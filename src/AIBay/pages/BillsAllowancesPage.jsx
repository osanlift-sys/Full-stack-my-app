import { useEffect, useMemo, useState } from 'react';
import { apiClient, getApiErrorMessage } from '../../api/apiClient';
import { fetchAllPages } from '../../api/apiResources';
import styles from '../AIBay.module.css';

const billTypes = [
  { value: 'night', label: 'Night Bill' },
  { value: 'lunch', label: 'Lunch Bill' },
  { value: 'phone', label: 'Phone Bill' },
  { value: 'others', label: 'Others Bill' },
];

const getToday = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatAmount = (amount) =>
  `৳ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function BillsAllowancesPage() {
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [billType, setBillType] = useState('night');
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [date, setDate] = useState(getToday);
  const [amount, setAmount] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => getToday().slice(0, 7));
  const [nameFilter, setNameFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      fetchAllPages('/income', { type: 'ALLOWANCE' }),
      apiClient.get('/income/employees'),
    ])
      .then(([items, employeeResponse]) => {
        if (!Array.isArray(employeeResponse.data?.items)) {
          throw new Error('The API response did not contain an employee list.');
        }
        if (active) {
          setRecords(items.map((item) => ({
            id: item.id,
            ...item.details,
            billType: item.category,
            amount: Number(item.amount) || 0,
            date: item.details?.date || item.occurredAt?.slice(0, 10) || '',
          })));
          setEmployees(employeeResponse.data.items.filter((employee) => employee.name?.trim()));
        }
      })
      .catch((error) => { if (active) setLoadError(getApiErrorMessage(error)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredRecords = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase();
    return records.filter((record) => (
      (!selectedMonth || String(record.date || '').startsWith(selectedMonth)) &&
      (!normalizedName || String(record.name || '').toLowerCase().includes(normalizedName))
    ));
  }, [records, selectedMonth, nameFilter]);

  const totalAmount = filteredRecords.reduce(
    (total, record) => total + (Number(record.amount) || 0),
    0
  );

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const cleanName = name.trim();
    const cleanDetails = details.trim();
    const numericAmount = Number(amount);
    if (
      !cleanName ||
      !date ||
      !billTypes.some((type) => type.value === billType) ||
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      setFormError('Enter a bill type, name, date, and an amount greater than zero.');
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.post('/income', {
        type: 'ALLOWANCE',
        category: billType,
        amount: String(numericAmount),
        occurredAt: new Date(`${date}T12:00:00`).toISOString(),
        details: { name: cleanName, details: cleanDetails, date },
      });
      setAmount('');
      setDetails('');
      const saved = await fetchAllPages('/income', { type: 'ALLOWANCE' });
      setRecords(saved.map((item) => ({
        id: item.id,
        ...item.details,
        billType: item.category,
        amount: Number(item.amount) || 0,
        date: item.details?.date || item.occurredAt?.slice(0, 10) || '',
      })));
      setSuccessMessage('Bill / allowance record saved.');
    } catch (error) {
      console.error('Bills / Allowances save error:', error);
      setFormError(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h2>Bills / Allowances</h2>
      <p className={styles.description}>Add and review night, lunch, phone, and other bills.</p>

      <form className={styles.conveyanceForm} onSubmit={handleSubmit}>
        <label className={styles.conveyanceField}>
          <span>Bill type</span>
          <select
            value={billType}
            onChange={(event) => setBillType(event.target.value)}
            required
          >
            {billTypes.map((type) => (
              <option key={type.value} value={type.value}>{type.label}</option>
            ))}
          </select>
        </label>
        <label className={styles.conveyanceField}>
          <span>Employee Name</span>
          <select
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={loading || employees.length === 0}
            required
          >
            <option value="">
              {loading
                ? 'Loading employees...'
                : employees.length === 0
                  ? 'No employee accounts found'
                  : '-- Select employee --'}
            </option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.name.trim()}>
                {employee.name.trim()}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.conveyanceField}>
          <span>Details</span>
          <input
            type="text"
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Write bill details"
          />
        </label>
        <label className={styles.conveyanceField}>
          <span>Date</span>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </label>
        <label className={styles.conveyanceField}>
          <span>Amount (BDT)</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <button className={styles.conveyanceSubmit} type="submit" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Add Bill / Allowance'}
        </button>
      </form>

      {formError && <p className={styles.conveyanceError} role="alert">{formError}</p>}
      {successMessage && <p className={styles.conveyanceSuccess} role="status">{successMessage}</p>}

      <div className={styles.conveyanceFilters}>
        <label className={styles.conveyanceField}>
          <span>Filter by month</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          />
        </label>
        <label className={styles.conveyanceField}>
          <span>Filter by name</span>
          <input
            type="search"
            value={nameFilter}
            onChange={(event) => setNameFilter(event.target.value)}
            placeholder="Search name"
          />
        </label>
      </div>

      <div className={styles.collectionTotal}>
        <span>Filtered Total</span>
        <strong>{formatAmount(totalAmount)}</strong>
      </div>

      {loadError ? (
        <p className={styles.collectionMessage} role="alert">{loadError}</p>
      ) : loading ? (
        <p className={styles.collectionMessage}>Loading bills / allowances...</p>
      ) : filteredRecords.length === 0 ? (
        <p className={styles.collectionMessage}>No records match these filters.</p>
      ) : (
        <div className={styles.collectionTableWrapper}>
          <table className={styles.collectionTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Details</th>
                <th>Bill type</th>
                <th className={styles.collectionAmount}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td>{record.date || '-'}</td>
                  <td>{record.name || '-'}</td>
                  <td>{record.details || '-'}</td>
                  <td>
                    {billTypes.find((type) => type.value === record.billType)?.label || record.billType || '-'}
                  </td>
                  <td className={styles.collectionAmount}>
                    {formatAmount(Number(record.amount) || 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default BillsAllowancesPage;
