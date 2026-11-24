import { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../../api/apiClient';
import { fetchAllPages } from '../../api/apiResources';
import styles from '../AIBay.module.css';

const toAmount = (value) => Number(String(value ?? 0).replace(/,/g, '')) || 0;

const formatAmount = (amount) =>
  `৳ ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const isJobBill = (bill) => {
  const items = Array.isArray(bill.items)
    ? bill.items
    : Array.isArray(bill.products)
      ? bill.products
      : [];

  return items.some((item) =>
    String(item.unit || item.Unit || '').trim().toLowerCase() === 'job'
  );
};

function IncomeFromSparePartsPage() {
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;

    const fetchBills = async () => {
      try {
        const billRows = (await fetchAllPages('/bills'))
          .filter((bill) => !isJobBill(bill))
          .map((bill) => {
            const collected = toAmount(
              bill.paidAmount ?? bill.receivedAmount ?? bill.totalReceived ?? bill.collectedBill
            );
            const total = toAmount(
              bill.grandTotal ?? bill.totalBill ?? bill.billAmount ?? bill.total
            );
            const dueValue = bill.dueAmount ?? bill.dueBill ?? bill.due;

            return {
              id: bill.id,
              clientName:
                bill.companyName ||
                bill.toCompany ||
                bill.customerName ||
                bill.headerData?.toCompany ||
                bill.headerData?.companyName ||
                'Unknown Client',
              collected,
              due: dueValue === undefined || dueValue === null || dueValue === ''
                ? Math.max(total - collected, 0)
                : toAmount(dueValue),
            };
          });

        if (active) setBills(billRows);
      } catch (error) {
        if (active) setLoadError(getApiErrorMessage(error));
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchBills();
    return () => {
      active = false;
    };
  }, []);

  const totals = bills.reduce(
    (result, bill) => ({
      collected: result.collected + bill.collected,
      due: result.due + bill.due,
    }),
    { collected: 0, due: 0 }
  );

  return (
    <section className={styles.panel}>
      <h2>Income from Spare Parts</h2>
      <p className={styles.description}>Collected and due amounts from customer bills.</p>

      {loading ? (
        <p className={styles.collectionMessage}>Loading bills...</p>
      ) : loadError ? (
        <p className={styles.collectionMessage} role="alert">
          Could not load bills: {loadError}
        </p>
      ) : bills.length === 0 ? (
        <p className={styles.collectionMessage}>No bills found.</p>
      ) : (
        <div className={styles.collectionTableWrapper}>
          <table className={styles.collectionTable}>
            <thead>
              <tr>
                <th>Client Name</th>
                <th className={styles.collectionAmount}>Collected Bill</th>
                <th className={styles.collectionAmount}>Due Bill</th>
              </tr>
            </thead>
            <tbody>
              {bills.map((bill) => (
                <tr key={bill.id}>
                  <td>{bill.clientName}</td>
                  <td className={styles.collectionAmount}>{formatAmount(bill.collected)}</td>
                  <td className={styles.collectionAmount}>{formatAmount(bill.due)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th>Total</th>
                <th className={styles.collectionAmount}>{formatAmount(totals.collected)}</th>
                <th className={styles.collectionAmount}>{formatAmount(totals.due)}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

export default IncomeFromSparePartsPage;
