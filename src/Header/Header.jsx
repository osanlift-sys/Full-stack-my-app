import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, NavLink } from "react-router-dom";
import logo from "../assets/main-logo.png";
import { logoutUser } from "../Fetures/Inventory/authSlice";
import { Avatar } from "../LoginData/Component/Avatar/Avatar";
import Style from "./Header.module.css";

export const Header = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth || {});
  const currentUserEmail = (user?.email || "").trim().toLowerCase();
  const permissions = user?.permissions || {};
  const isAdmin = user?.backendRole === "ADMIN" || user?.role === "Admin";
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logoutUser());
    setIsMobileMenuOpen(false);
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const hasAccess = (newKey, legacyKey) => {
    if (isAdmin) return true;
    return Boolean(permissions[newKey] || permissions[legacyKey]);
  };

  const profileName = [user?.name].find(
    (name) =>
      typeof name === "string" &&
      name.trim() &&
      name.trim().toLowerCase() !== currentUserEmail
  );
  const activeProfile = {
    ...user,
    name: profileName || user?.name || currentUserEmail || "User",
    photoURL: user?.photoURL || null,
  };

  return (
    <header className={Style.headerWrapper}>
      <nav className={Style.header}>
        {/* Logo */}
        <Link to="/" className={Style.logoLink} onClick={closeMobileMenu}>
          <img className={Style.Logo} src={logo} alt="MM Engineering" />
        </Link>

        {/* Hamburger Menu Icon (For Mobile) */}
        <button
          className={Style.hamburgerBtn}
          onClick={toggleMobileMenu}
          aria-label="Toggle Navigation"
        >
          <span className={`${Style.bar} ${isMobileMenuOpen ? Style.openBar1 : ""}`}></span>
          <span className={`${Style.bar} ${isMobileMenuOpen ? Style.openBar2 : ""}`}></span>
          <span className={`${Style.bar} ${isMobileMenuOpen ? Style.openBar3 : ""}`}></span>
        </button>

        {/* Nav Links Container */}
        <div className={`${Style.menu} ${isMobileMenuOpen ? Style.menuOpen : ""}`}>
          <NavLink
            className={({ isActive }) => (isActive ? Style.active : Style.link)}
            to="/"
            onClick={closeMobileMenu}
          >
            Home
          </NavLink>

          <NavLink
            className={({ isActive }) => (isActive ? Style.active : Style.link)}
            to="Services"
            onClick={closeMobileMenu}
          >
            Our Services
          </NavLink>

          {user?.backendRole === "CLIENT" && (
            <NavLink
              className={({ isActive }) => (isActive ? Style.active : Style.link)}
              to="/Clints/ClientProfile"
              onClick={closeMobileMenu}
            >
              My Client Profile
            </NavLink>
          )}

          {hasAccess("nav_ai_bay") && (
            <NavLink
              className={({ isActive }) => (isActive ? Style.active : Style.link)}
              to="/ai-bay"
              onClick={closeMobileMenu}
            >
              AI Bay
            </NavLink>
          )}

          {hasAccess("nav_clients", "canAccessClients") && (
            <NavLink
              className={({ isActive }) => (isActive ? Style.active : Style.link)}
              to="/Clints"
              onClick={closeMobileMenu}
            >
              Clients
            </NavLink>
          )}

          {hasAccess("nav_projects", "canAccessProjects") && (
            <NavLink
              className={({ isActive }) => (isActive ? Style.active : Style.link)}
              to="/Projects"
              onClick={closeMobileMenu}
            >
              Projects
            </NavLink>
          )}

          {hasAccess("nav_inventory", "canAccessInventory") && (
            <NavLink
              className={({ isActive }) => (isActive ? Style.active : Style.link)}
              to="/InventoryBilling"
              onClick={closeMobileMenu}
            >
              Inventory
            </NavLink>
          )}

          {hasAccess("nav_employee", "canAccessEmployees") && (
            <NavLink
              className={({ isActive }) => (isActive ? Style.active : Style.link)}
              to="/EmployeeData"
              onClick={closeMobileMenu}
            >
              Employee's
            </NavLink>
          )}

          {hasAccess("nav_admin") && (
            <NavLink
              className={({ isActive }) => (isActive ? Style.active : Style.link)}
              to="/AdminPanel"
              onClick={closeMobileMenu}
            >
              Admin Panel
            </NavLink>
          )}

          {/* Mobile Auth Buttons */}
          <div className={Style.mobileAuthContainer}>
            {user ? (
              <div className={Style.userProfileGroup}>
                <Avatar profile={activeProfile} />
                <button onClick={handleRefresh} className={Style.refreshBtn}>
                  ↻ Refresh
                </button>
                <button onClick={handleLogout} className={Style.logoutBtn}>
                  Logout
                </button>
              </div>
            ) : (
              <div className={Style.authGroupMobile}>
                <NavLink className={Style.signupBtn} to="/SignUp" onClick={closeMobileMenu}>
                  Signup
                </NavLink>
                <NavLink className={Style.loginBtn} to="/Login" onClick={closeMobileMenu}>
                  Login
                </NavLink>
                <button onClick={handleRefresh} className={Style.refreshBtn}>
                  ↻ 
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Desktop Auth Buttons */}
        <div className={Style.desktopAuthContainer}>
          {user ? (
            <div className={Style.userProfileGroup}>
              <Avatar profile={activeProfile} />
              <button onClick={handleRefresh} className={Style.refreshBtn}>
                ↻
              </button>
              <button onClick={handleLogout} className={Style.logoutBtn}>
                Logout
              </button>
            </div>
          ) : (
            <div className={Style.loginContainer}>
              <NavLink className={Style.signupBtn} to="/SignUp">
                Signup
              </NavLink>
              <NavLink className={Style.loginBtn} to="/Login">
                Login
              </NavLink>
              <button onClick={handleRefresh} className={Style.refreshBtn}>
                ↻ Refresh
              </button>
            </div>
          )}
        </div>
      </nav>
    </header>
  );
};