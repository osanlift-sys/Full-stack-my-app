import { useState } from "react";
import { useSelector } from "react-redux";
import { NavLink, Outlet } from "react-router-dom";
import Style from "./EmployeeData.module.css";

function EmployeeData() {
  const { user } = useSelector((state) => state.auth || {});

  // Sidebar Open/Collapsed state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Permission & Admin States
  const loading = false;

  const hasPermission = (featureKey) => {
    if (user?.backendRole === "ADMIN") return true;
    return Boolean(user?.permissions?.[featureKey]);
  };

  return (
    <div className={Style.employeeContainer}>
      {/* Sidebar Section */}
      <aside className={`${Style.aside} ${!isSidebarOpen ? Style.asideCollapsed : ""}`}>
        <div className={Style.asideHeader}>
          {isSidebarOpen && <span className={Style.titleText}>Employee Portal</span>}
          <button
            type="button"
            className={Style.toggleBtn}
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {isSidebarOpen ? "◀" : "▶"}
          </button>
        </div>

        {!loading && (
          <nav className={Style.asideNav}>
            {/* Your Profile Link */}
            <NavLink
              to="YourProfile"
              title="Your Profile"
              className={({ isActive }) =>
                isActive ? `${Style.asideLink} ${Style.active}` : Style.asideLink
              }
            >
              <span className={Style.navIcon}>👤</span>
              {isSidebarOpen && <span className={Style.linkText}>Your Profile</span>}
            </NavLink>

            {/* Attendance Link */}
            {(hasPermission("emp_tab_attendance") || hasPermission("canGiveAttendance")) && (
              <NavLink
                to="Attendance"
                title="Attendance"
                className={({ isActive }) =>
                  isActive ? `${Style.asideLink} ${Style.active}` : Style.asideLink
                }
              >
                <span className={Style.navIcon}>📋</span>
                {isSidebarOpen && <span className={Style.linkText}>Attendance</span>}
              </NavLink>
            )}

            {/* Employee List Link */}
            {hasPermission("emp_tab_list") && (
              <NavLink
                to="EmployeeList"
                title="Employee List"
                className={({ isActive }) =>
                  isActive ? `${Style.asideLink} ${Style.active}` : Style.asideLink
                }
              >
                <span className={Style.navIcon}>👥</span>
                {isSidebarOpen && <span className={Style.linkText}>Employee List</span>}
              </NavLink>
            )}

            {/* Payroll Link */}
            {hasPermission("emp_tab_payroll") && (
              <NavLink
                to="Payroll"
                title="Payroll & Salary"
                className={({ isActive }) =>
                  isActive ? `${Style.asideLink} ${Style.active}` : Style.asideLink
                }
              >
                <span className={Style.navIcon}>💳</span>
                {isSidebarOpen && <span className={Style.linkText}>Payroll & Salary</span>}
              </NavLink>
            )}
          </nav>
        )}
      </aside>

      {/* Main Content Area */}
      <main className={Style.main}>
        <Outlet />
      </main>
    </div>
  );
}

export default EmployeeData;