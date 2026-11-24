import { useState } from "react";
import { useSelector } from "react-redux";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import Style from "./Clints.module.css";

function Clints() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const user = useSelector((state) => state.auth?.user);
  const location = useLocation();
  const isClient = user?.backendRole === "CLIENT";

  if (isClient && location.pathname.replace(/\/+$/, "") !== "/Clints/ClientProfile") {
    return <Navigate to="/Clints/ClientProfile" replace />;
  }

  return (
    <div className={Style.clintsContainer}>
      {!isClient && (
        <aside className={`${Style.aside} ${!isSidebarOpen ? Style.asideCollapsed : ""}`}>
          <div className={Style.asideHeader}>
            {isSidebarOpen && <span className={Style.titleText}>Client Portal</span>}
            <button
              type="button"
              className={Style.toggleBtn}
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
            >
              {isSidebarOpen ? "◀" : "▶"}
            </button>
          </div>

          <nav className={Style.asideNav}>
            <NavLink
              to="ClintList"
              title="Client List"
              className={({ isActive }) =>
                isActive ? `${Style.asideLink} ${Style.active}` : Style.asideLink
              }
            >
              <span className={Style.navIcon}>👥</span>
              {isSidebarOpen && <span className={Style.linkText}>Client List</span>}
            </NavLink>

            <NavLink
              to="Offer"
              title="Offer"
              className={({ isActive }) =>
                isActive ? `${Style.asideLink} ${Style.active}` : Style.asideLink
              }
            >
              <span className={Style.navIcon}>🏷️</span>
              {isSidebarOpen && <span className={Style.linkText}>Offer</span>}
            </NavLink>

            <NavLink
              to="Challan"
              title="Challan"
              className={({ isActive }) =>
                isActive ? `${Style.asideLink} ${Style.active}` : Style.asideLink
              }
            >
              <span className={Style.navIcon}>📦</span>
              {isSidebarOpen && <span className={Style.linkText}>Challan</span>}
            </NavLink>

            <NavLink
              to="Invoice"
              title="Invoice"
              className={({ isActive }) =>
                isActive ? `${Style.asideLink} ${Style.active}` : Style.asideLink
              }
            >
              <span className={Style.navIcon}>📄</span>
              {isSidebarOpen && <span className={Style.linkText}>Invoice</span>}
            </NavLink>
          </nav>
        </aside>
      )}

      {/* Main Content Area */}
      <main className={Style.formContainer}>
        <Outlet />
      </main>
    </div>
  );
}

export default Clints;