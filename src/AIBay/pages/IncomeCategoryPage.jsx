import styles from '../AIBay.module.css';

function IncomeCategoryPage({ title }) {
  return (
    <section className={styles.panel}>
      <h2>{title}</h2>
      <p className={styles.description}>
        This page is set up for {title.toLowerCase()} records.
      </p>
    </section>
  );
}

export default IncomeCategoryPage;
