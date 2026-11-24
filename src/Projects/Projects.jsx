import { useState } from "react";
import { useSelector } from "react-redux";
import { NavLink, Outlet } from "react-router-dom";
import Style from "./Projects.module.css";

function Projects() {
  const { user } = useSelector((state) => state.auth || {});

  // Sidebar Open/Collapsed state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Permission & Admin States
  const [loading] = useState(false);

  const hasPermission = (primaryKey, ...fallbackKeys) => {
    if (user?.backendRole === "ADMIN") return true;
    if (user?.permissions?.[primaryKey]) return true;
    return fallbackKeys.some((key) => user?.permissions?.[key]);
  };

  return (
    <div className={Style.projectsContainer}>
      {/* Sidebar Section */}
      <aside className={`${Style.aside} ${!isSidebarOpen ? Style.asideCollapsed : ""}`}>
        <div className={Style.asideHeader}>
          {isSidebarOpen && <span className={Style.titleText}>Projects Portal</span>}
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
            {/* Summary Tab Check */}
            {hasPermission("projects_tab_summary", "projects_summary", "canAccessSummary") && (
              <NavLink
                to="Summery"
                title="Summary"
                className={({ isActive }) =>
                  isActive ? `${Style.asideLink} ${Style.active}` : Style.asideLink
                }
              >
                <span className={Style.navIcon}>📌</span>
                {isSidebarOpen && <span className={Style.linkText}>Summary</span>}
              </NavLink>
            )}

            {/* Serviced & Schedule Tab Check */}
            {hasPermission("projects_tab_serviced", "projects_schedule", "canAccessSchedule") && (
              <NavLink
                to="Serviced_and_Schedule"
                title="Serviced and Schedule"
                className={({ isActive }) =>
                  isActive ? `${Style.asideLink} ${Style.active}` : Style.asideLink
                }
              >
                <span className={Style.navIcon}>🛠️</span>
                {isSidebarOpen && <span className={Style.linkText}>Serviced and Schedule</span>}
              </NavLink>
            )}
          </nav>
        )}
      </aside>

      {/* Main Content Area */}
      <main className={Style.content}>
        <Outlet />
      </main>
    </div>
  );
}

export default Projects;