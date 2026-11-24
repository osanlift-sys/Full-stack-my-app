import { BrainCircuit, Sparkles } from 'lucide-react';
import { NavLink, Outlet } from 'react-router-dom';
import { useState } from 'react';
import styles from './AIBay.module.css';

export const aiBayIncomeRoutes = [
  { path: 'servicing-projects', title: 'Income from Servicing Projects' },
  { path: 'spare-parts', title: 'Income from Spare Parts' },
  { path: 'service-sales', title: 'Income from Service Sales' },
  { path: 'installation', title: 'Income from Installation' },
  { path: 'conveyance', title: 'Conveyance' },
  { path: 'bills-allowances', title: 'Bills / Allowances' },
];

function AIBay() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <main className={styles.page}>
      <aside className={`${styles.sidebar} ${!isSidebarOpen ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <span className={styles.sidebarTitle}>AI Bay</span>
          <button
            type="button"
            className={styles.toggleButton}
            onClick={() => setIsSidebarOpen((open) => !open)}
            title={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
            aria-label={isSidebarOpen ? 'Collapse AI Bay sidebar' : 'Expand AI Bay sidebar'}
          >
            {isSidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        <nav className={styles.navigation} aria-label="AI Bay income sections">
          {aiBayIncomeRoutes.map((route, index) => (
            <NavLink
              key={route.path}
              to={route.path}
              title={route.title}
              className={({ isActive }) =>
                isActive ? `${styles.navLink} ${styles.activeNavLink}` : styles.navLink
              }
            >
              <span className={styles.navIcon} aria-hidden="true">
                {['🛠️', '📦', '🔧', '🏗️', '🚗', '🧾'][index]}
              </span>
              <span className={styles.linkText}>{route.title}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <section className={styles.content}>
        <header className={styles.header}>
          <div className={styles.icon} aria-hidden="true">
            <BrainCircuit size={30} />
          </div>
          <div>
            <p className={styles.eyebrow}>
              <Sparkles size={15} />
              AI workspace
            </p>
            <h1>AI Bay</h1>
          </div>
        </header>
        <Outlet />
      </section>
    </main>
  );
}

export default AIBay;
