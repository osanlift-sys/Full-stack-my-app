import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProjects } from '../../Fetures/Inventory/ProjectsSlice';
import styles from '../AIBay.module.css';

const formatCollectedDate = (bill) => {
  const date = bill.collectedDate || bill.collectionDate || bill.collectedAt ||
    bill.lastServicingDate || bill.servicingDate;

  if (!date) return bill.month || '-';

  const dateValue = typeof date?.toDate === 'function' ? date.toDate() : new Date(date);
  if (Number.isNaN(dateValue.getTime())) return String(date);

  return dateValue.toLocaleDateString();
};

function IncomeFromServicingProjectsPage() {
  const dispatch = useDispatch();
  const { projects = [], loading } = useSelector((state) => state.project || {});
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    dispatch(fetchProjects())
      .unwrap()
      .catch((error) => {
        setLoadError(error?.message || String(error));
      });
  }, [dispatch]);

  const collections = useMemo(
    () => projects.flatMap((project) =>
      (project.billList || [])
        .map((bill, index) => ({
          id: `${project.id}-${bill.month || index}`,
          projectName: project.projectName || '-',
          collectedDate: formatCollectedDate(bill),
          amount: Number(bill.collectedBill) || 0,
        }))
        .filter((collection) => collection.amount > 0)
    ),
    [projects]
  );
  const totalCollected = collections.reduce((total, collection) => total + collection.amount, 0);

  return (
    <section className={styles.panel}>
      <h2>Income from Servicing Projects</h2>
      <p className={styles.description}>
        Collected amounts recorded in project bills.
      </p>

      <div className={styles.collectionTotal}>
        <span>Total Collected</span>
        <strong>৳ {totalCollected.toLocaleString('en-IN')}</strong>
      </div>

      {loadError ? (
        <p className={styles.collectionMessage} role="alert">
          Could not load project collections: {loadError}
        </p>
      ) : loading && collections.length === 0 ? (
        <p className={styles.collectionMessage}>Loading project collections...</p>
      ) : collections.length === 0 ? (
        <p className={styles.collectionMessage}>No collected amounts found.</p>
      ) : (
        <div className={styles.collectionTableWrapper}>
          <table className={styles.collectionTable}>
            <thead>
              <tr>
                <th>Project Name</th>
                <th>Collected Date</th>
                <th className={styles.collectionAmount}>Collected Amount</th>
              </tr>
            </thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.id}>
                  <td>{collection.projectName}</td>
                  <td>{collection.collectedDate}</td>
                  <td className={styles.collectionAmount}>
                    ৳ {collection.amount.toLocaleString('en-IN')}
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

export default IncomeFromServicingProjectsPage;
