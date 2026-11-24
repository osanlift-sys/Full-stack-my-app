import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { fetchProjects } from '../../Fetures/Inventory/ProjectsSlice';
import { fetchPayrollData } from '../../Fetures/Inventory/payrollSlice';
import { getApiErrorMessage } from '../../api/apiClient';
import { fetchAllPages } from '../../api/apiResources';
import styles from '../AIBay.module.css';

const getCurrentMonth = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
};

const toAmount = (value) => Number(String(value ?? 0).replace(/,/g, '')) || 0;

const formatAmount = (amount) =>
  `৳ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getMonthKey = (value) => {
  if (!value) return '';
  if (typeof value?.toDate === 'function') return getMonthKey(value.toDate());
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    return getMonthKey(new Date(value.seconds * 1000));
  }

  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{1,2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}`;

  const dayFirstMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dayFirstMatch) {
    return `${dayFirstMatch[3]}-${dayFirstMatch[2].padStart(2, '0')}`;
  }

  const parsedDate = new Date(text);
  return Number.isNaN(parsedDate.getTime()) ? '' : getMonthKey(parsedDate);
};

const isInSelectedMonth = (record, selectedMonth, dateFields) => {
  const dateValue = dateFields.map((field) => record[field]).find(Boolean);
  return getMonthKey(dateValue) === selectedMonth;
};

const getBillMonthTotals = (bills, selectedMonth) =>
  bills.reduce((totals, bill) => {
    const billDate = bill.date || bill.headerData?.date || bill.createdAt;
    const wasIssuedThisMonth = getMonthKey(billDate) === selectedMonth;

    const amountPaid = toAmount(
      bill.paidAmount ?? bill.receivedAmount ?? bill.totalReceived ?? bill.collectedBill
    );
    const billAmount = toAmount(
      bill.grandTotal ?? bill.totalBill ?? bill.billAmount ?? bill.total
    );
    const due = bill.dueAmount === undefined || bill.dueAmount === null || bill.dueAmount === ''
      ? Math.max(billAmount - amountPaid, 0)
      : Math.max(toAmount(bill.dueAmount), 0);

    const paymentHistory = Array.isArray(bill.paymentHistory) ? bill.paymentHistory : [];
    const recordedPayments = paymentHistory.reduce((result, payment) => {
      const paymentAmount = toAmount(payment.amount);
      const paymentDate =
        payment.date || payment.receivedDate || payment.paymentDate ||
        bill.receivedDate || bill.paymentDate || billDate;
      result.total += paymentAmount;
      if (getMonthKey(paymentDate) === selectedMonth) result.selectedMonth += paymentAmount;
      return result;
    }, { total: 0, selectedMonth: 0 });

    const unrecordedPayment = Math.max(amountPaid - recordedPayments.total, 0);
    const fallbackCollectionDate = bill.receivedDate || bill.paymentDate || billDate;
    const unrecordedPaymentThisMonth =
      getMonthKey(fallbackCollectionDate) === selectedMonth ? unrecordedPayment : 0;
    const collectedThisMonth = recordedPayments.selectedMonth + unrecordedPaymentThisMonth;

    if (wasIssuedThisMonth) totals.billed += billAmount;
    totals.collected += collectedThisMonth;
    totals.outstanding += due;
    return totals;
  }, { billed: 0, collected: 0, outstanding: 0 });

function AIBayHomePage() {
  const dispatch = useDispatch();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [undatedProjectBills, setUndatedProjectBills] = useState(false);

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      try {
        const [bills, projects, payroll, installationRows, conveyanceRows,
          allowanceRows, purchases] = await Promise.all([
          fetchAllPages('/bills'),
          dispatch(fetchProjects()).unwrap(),
          dispatch(fetchPayrollData(
            new Date(`${selectedMonth}-01T12:00:00`).toLocaleString('en-US', {
              month: 'long',
              year: 'numeric',
            })
          )).unwrap(),
          fetchAllPages('/income', { type: 'INSTALLATION' }),
          fetchAllPages('/income', { type: 'CONVEYANCE' }),
          fetchAllPages('/income', { type: 'ALLOWANCE' }),
          fetchAllPages('/purchases'),
        ]);

        const installationRecords = installationRows.map((item) => ({
          ...item.details,
          amount: Number(item.amount) || 0,
          paymentReceived: Number(item.amount) || 0,
          date: item.details?.date || item.occurredAt,
        }));
        const conveyanceRecords = conveyanceRows.map((item) => ({
          ...item.details, amount: Number(item.amount) || 0,
          date: item.details?.date || item.occurredAt,
        }));
        const allowanceRecords = allowanceRows.map((item) => ({
          ...item.details, amount: Number(item.amount) || 0,
          date: item.details?.date || item.occurredAt,
        }));
        const purchaseTransactions = purchases.map((item) => ({
          ...item, date: item.purchasedAt,
        }));

        const billTotals = getBillMonthTotals(bills, selectedMonth);
        const billIncome = billTotals.collected;

        let projectIncome = 0;
        let hasMonthOnlyProjectBills = false;
        projects.forEach((project) => {
          (project.billList || []).forEach((bill) => {
            const billDate = bill.collectedDate || bill.collectionDate || bill.collectedAt ||
              bill.servicingDate || bill.lastServicingDate;
            let matchesMonth = false;
            if (billDate) {
              matchesMonth = getMonthKey(billDate) === selectedMonth;
            } else if (bill.month) {
              const selectedMonthName = new Date(`${selectedMonth}-01T12:00:00`)
                .toLocaleString('en-US', { month: 'long' });
              matchesMonth = String(bill.month).toLowerCase() === selectedMonthName.toLowerCase();
              if (matchesMonth) hasMonthOnlyProjectBills = true;
            }

            if (matchesMonth) projectIncome += toAmount(bill.collectedBill);
          });
        });

        const monthInstallationRecords = installationRecords.filter((record) =>
          isInSelectedMonth(record, selectedMonth, ['date', 'createdAt'])
        );
        const installationIncome = monthInstallationRecords.reduce(
          (total, record) => total + toAmount(record.paymentReceived),
          0
        );
        const installationExpenses = monthInstallationRecords.reduce(
          (total, record) => total + toAmount(record.expense),
          0
        );

        const payrollGross = payroll.reduce(
          (total, employee) =>
            total + toAmount(employee.grossPayable) + toAmount(employee.fridayAllowance),
          0
        );
        const conveyanceExpenses = conveyanceRecords
          .filter((record) => isInSelectedMonth(record, selectedMonth, ['date', 'createdAt']))
          .reduce((total, record) => total + toAmount(record.amount), 0);
        const allowanceExpenses = allowanceRecords
          .filter((record) => isInSelectedMonth(record, selectedMonth, ['date', 'createdAt']))
          .reduce((total, record) => total + toAmount(record.amount), 0);
        const purchaseExpenses = purchaseTransactions
          .filter((record) => isInSelectedMonth(record, selectedMonth, ['date', 'createdAt']))
          .reduce((total, record) => total + toAmount(record.totalAmount), 0);

        const totalIncome = billIncome + projectIncome + installationIncome;
        const totalExpenses =
          payrollGross + conveyanceExpenses + allowanceExpenses + installationExpenses + purchaseExpenses;

        if (active) {
          setSummary({
            totalIncome,
            totalExpenses,
            netIncome: totalIncome - totalExpenses,
            billTotals,
            incomeBreakdown: [
              { label: 'Customer bill collections', amount: billIncome },
              { label: 'Project bill collections', amount: projectIncome },
              { label: 'Installation payments received', amount: installationIncome },
            ],
            expenseBreakdown: [
              { label: 'Gross salary payable', amount: payrollGross },
              { label: 'Installation expenses', amount: installationExpenses },
              { label: 'Conveyance', amount: conveyanceExpenses },
              { label: 'Bills / allowances', amount: allowanceExpenses },
              { label: 'Stock purchases this month', amount: purchaseExpenses },
            ],
            undatedPurchaseTotal: 0,
          });
          setUndatedProjectBills(hasMonthOnlyProjectBills);
        }
      } catch (error) {
        console.error('AI Bay financial summary load error:', error);
        if (active) setLoadError(getApiErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };

    loadSummary();
    return () => {
      active = false;
    };
  }, [dispatch, selectedMonth]);

  return (
    <section className={styles.panel}>
      <h2>Income &amp; Expense Summary</h2>
      <p className={styles.description}>
        Monthly income, expenses, and net income from the app&apos;s recorded financial data.
      </p>

      <div className={styles.conveyanceFilters}>
        <label className={styles.conveyanceField}>
          <span>Filter by month</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => {
              if (event.target.value) {
                setLoading(true);
                setLoadError('');
                setSelectedMonth(event.target.value);
              }
            }}
            required
          />
        </label>
      </div>

      {loadError ? (
        <p className={styles.conveyanceError} role="alert">
          Could not load the financial summary: {loadError}
        </p>
      ) : loading && !summary ? (
        <p className={styles.collectionMessage}>Loading financial summary...</p>
      ) : summary ? (
        <>
          <div className={styles.financialSummaryCards} aria-live="polite">
            <div className={styles.financialSummaryCard}>
              <span>Total income</span>
              <strong>{formatAmount(summary.totalIncome)}</strong>
            </div>
            <div className={styles.financialSummaryCard}>
              <span>Total expenses</span>
              <strong>{formatAmount(summary.totalExpenses)}</strong>
            </div>
            <div className={styles.financialSummaryCard}>
              <span>Net income</span>
              <strong>{formatAmount(summary.netIncome)}</strong>
            </div>
          </div>

          <div className={styles.financialBreakdowns}>
            <section className={styles.financialBreakdown}>
              <h3>Income</h3>
              {summary.incomeBreakdown.map((item) => (
                <div className={styles.financialBreakdownRow} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{formatAmount(item.amount)}</strong>
                </div>
              ))}
            </section>
            <section className={styles.financialBreakdown}>
              <h3>Expenses</h3>
              {summary.expenseBreakdown.map((item) => (
                <div className={styles.financialBreakdownRow} key={item.label}>
                  <span>{item.label}</span>
                  <strong>{formatAmount(item.amount)}</strong>
                </div>
              ))}
            </section>
          </div>

          <section className={styles.financialBreakdown}>
            <h3>Invoices &amp; outstanding (not collected income)</h3>
            <div className={styles.financialBreakdownRow}>
              <span>Invoices issued this month</span>
              <strong>{formatAmount(summary.billTotals.billed)}</strong>
            </div>
            <div className={styles.financialBreakdownRow}>
              <span>Collected this month (all bills)</span>
              <strong>{formatAmount(summary.billTotals.collected)}</strong>
            </div>
            <div className={styles.financialBreakdownRow}>
              <span>Outstanding from all unpaid bills</span>
              <strong>{formatAmount(summary.billTotals.outstanding)}</strong>
            </div>
          </section>

          {summary.undatedPurchaseTotal > 0 && (
            <p className={styles.financialNote}>
              Historical stock purchase cost without transaction dates:{' '}
              <strong>{formatAmount(summary.undatedPurchaseTotal)}</strong>. It is shown separately
              and is not included in this month&apos;s expenses or net income.
            </p>
          )}
          {undatedProjectBills && (
            <p className={styles.financialNote}>
              Some project bill records contain a month but no year, so they are matched by month name.
            </p>
          )}
          {loading && <p className={styles.collectionMessage}>Updating summary...</p>}
        </>
      ) : (
        <p className={styles.collectionMessage}>No financial summary is available.</p>
      )}
    </section>
  );
}

export default AIBayHomePage;
