import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchInstallationProjects } from '../../Fetures/Inventory/installationProjectsSlice';
import { apiClient, getApiErrorMessage } from '../../api/apiClient';
import { fetchAllPages } from '../../api/apiResources';
import styles from '../AIBay.module.css';

const getToday = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatAmount = (amount) =>
  `৳ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function IncomeFromInstallationPage() {
  const dispatch = useDispatch();
  const { projects = [], loading: projectsLoading } = useSelector(
    (state) => state.installationProjects || {}
  );
  const [records, setRecords] = useState([]);
  const [projectId, setProjectId] = useState('');
  const [date, setDate] = useState(getToday);
  const [expense, setExpense] = useState('');
  const [paymentReceived, setPaymentReceived] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [projectLoadError, setProjectLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    dispatch(fetchInstallationProjects())
      .unwrap()
      .catch((error) => {
        console.error('Installation projects load error:', error);
        setProjectLoadError(error?.message || 'Could not load projects.');
      });
  }, [dispatch]);

  useEffect(() => {
    let active = true;
    fetchAllPages('/income', { type: 'INSTALLATION' })
      .then((items) => {
        if (!active) return;
        setRecords(items.map((item) => ({
          id: item.id,
          ...item.details,
          date: item.details?.date || item.occurredAt?.slice(0, 10) || '',
          paymentReceived: Number(item.amount) || 0,
          expense: Number(item.details?.expense) || 0,
        })).sort((a, b) => String(b.date).localeCompare(String(a.date))));
        setLoadError('');
      })
      .catch((error) => {
        if (active) setLoadError(getApiErrorMessage(error));
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredRecords = useMemo(
    () => records.filter((record) => (
      (!selectedMonth || String(record.date || '').startsWith(selectedMonth)) &&
      (!projectFilter || record.projectId === projectFilter)
    )),
    [records, selectedMonth, projectFilter]
  );

  const totals = filteredRecords.reduce(
    (result, record) => ({
      expense: result.expense + (Number(record.expense) || 0),
      paymentReceived: result.paymentReceived + (Number(record.paymentReceived) || 0),
      finalIncome: result.finalIncome +
        ((Number(record.paymentReceived) || 0) - (Number(record.expense) || 0)),
    }),
    { expense: 0, paymentReceived: 0, finalIncome: 0 }
  );

  const numericExpense = Number(expense) || 0;
  const numericPayment = Number(paymentReceived) || 0;
  const finalIncome = numericPayment - numericExpense;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError('');
    setSuccessMessage('');

    const selectedProject = projects.find((project) => project.id === projectId);
    if (!selectedProject || !date) {
      setFormError('Select a project and date.');
      return;
    }
    if (
      expense === '' ||
      paymentReceived === '' ||
      !Number.isFinite(numericExpense) ||
      !Number.isFinite(numericPayment) ||
      numericExpense < 0 ||
      numericPayment < 0
    ) {
      setFormError('Enter valid expense and payment received amounts (zero or more).');
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.post('/income', {
        type: 'INSTALLATION',
        category: 'installation',
        amount: String(numericPayment),
        occurredAt: new Date(`${date}T12:00:00`).toISOString(),
        details: {
          projectId: selectedProject.id,
          projectName: selectedProject.projectName || selectedProject.name || selectedProject.id,
          date,
          expense: numericExpense,
        },
      });
      setExpense('');
      setPaymentReceived('');
      const rows = await fetchAllPages('/income', { type: 'INSTALLATION' });
      setRecords(rows.map((item) => ({
        id: item.id,
        ...item.details,
        date: item.details?.date || item.occurredAt?.slice(0, 10) || '',
        paymentReceived: Number(item.amount) || 0,
        expense: Number(item.details?.expense) || 0,
      })).sort((a, b) => String(b.date).localeCompare(String(a.date))));
      setSuccessMessage('Installation income record saved.');
    } catch (error) {
      console.error('Installation income save error:', error);
      setFormError(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className={styles.panel}>
      <h2>Income from Installation</h2>
      <p className={styles.description}>
        Record project expenses and payments received to calculate final income.
      </p>

      {projectLoadError && (
        <p className={styles.conveyanceError} role="alert">
          Could not load projects: {projectLoadError}
        </p>
      )}

      <form className={styles.conveyanceForm} onSubmit={handleSubmit}>
        <label className={styles.conveyanceField}>
          <span>Project</span>
          <select
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            required
            disabled={projectsLoading || projects.length === 0}
          >
            <option value="">
              {projectsLoading ? 'Loading projects...' : 'Select project'}
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.projectName || project.name || project.id}
              </option>
            ))}
          </select>
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
          <span>Expenses (BDT)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={expense}
            onChange={(event) => setExpense(event.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <label className={styles.conveyanceField}>
          <span>Payment received (BDT)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={paymentReceived}
            onChange={(event) => setPaymentReceived(event.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <div className={styles.conveyanceIncomePreview}>
          <span>Final income (payment received − expenses)</span>
          <strong>{formatAmount(finalIncome)}</strong>
        </div>
        <button className={styles.conveyanceSubmit} type="submit" disabled={isSaving || projects.length === 0}>
          {isSaving ? 'Saving...' : 'Add Installation Record'}
        </button>
      </form>

      {formError && <p className={styles.conveyanceError} role="alert">{formError}</p>}
      {successMessage && <p className={styles.conveyanceSuccess} role="status">{successMessage}</p>}

      <div className={styles.conveyanceFilters}>
        <label className={styles.conveyanceField}>
          <span>Filter by month (optional)</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => setSelectedMonth(event.target.value)}
          />
        </label>
        <button
          className={styles.conveyanceClearFilter}
          type="button"
          onClick={() => setSelectedMonth('')}
        >
          All months
        </button>
        <label className={styles.conveyanceField}>
          <span>Filter by project</span>
          <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.projectName || project.name || project.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={styles.installationTotals}>
        <div className={styles.collectionTotal}>
          <span>Total expenses</span>
          <strong>{formatAmount(totals.expense)}</strong>
        </div>
        <div className={styles.collectionTotal}>
          <span>Total payment received</span>
          <strong>{formatAmount(totals.paymentReceived)}</strong>
        </div>
        <div className={styles.collectionTotal}>
          <span>Final income</span>
          <strong>{formatAmount(totals.finalIncome)}</strong>
        </div>
      </div>

      {loadError ? (
        <p className={styles.collectionMessage} role="alert">{loadError}</p>
      ) : loading ? (
        <p className={styles.collectionMessage}>Loading installation income records...</p>
      ) : filteredRecords.length === 0 ? (
        <p className={styles.collectionMessage}>No records match these filters.</p>
      ) : (
        <div className={styles.collectionTableWrapper}>
          <table className={styles.collectionTable}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Project</th>
                <th className={styles.collectionAmount}>Expenses</th>
                <th className={styles.collectionAmount}>Payment received</th>
                <th className={styles.collectionAmount}>Final income</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record) => (
                <tr key={record.id}>
                  <td>{record.date || '-'}</td>
                  <td>{record.projectName || '-'}</td>
                  <td className={styles.collectionAmount}>
                    {formatAmount(Number(record.expense) || 0)}
                  </td>
                  <td className={styles.collectionAmount}>
                    {formatAmount(Number(record.paymentReceived) || 0)}
                  </td>
                  <td className={styles.collectionAmount}>
                    {formatAmount(
                      (Number(record.paymentReceived) || 0) - (Number(record.expense) || 0)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan="2">Filtered total</th>
                <th className={styles.collectionAmount}>{formatAmount(totals.expense)}</th>
                <th className={styles.collectionAmount}>{formatAmount(totals.paymentReceived)}</th>
                <th className={styles.collectionAmount}>{formatAmount(totals.finalIncome)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

export default IncomeFromInstallationPage;
