import { KeyRound, Mail, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  clearAuthMessages,
  googleLoginUser,
  loginUser,
  registerUser,
  requestEmailVerification,
  resetPassword,
} from "../../Fetures/Inventory/authSlice";
import styles from "./AuthForm.module.css";

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const getAuthenticatedHome = (authenticatedUser) =>
  authenticatedUser?.backendRole === "CLIENT" ? "/Clints/ClientProfile" : "/";

const AuthForm = ({ initialMode = "signup" }) => {
  const [isSignUp, setIsSignUp] = useState(initialMode === "signup");
  const [signupRole, setSignupRole] = useState("EMPLOYEE");
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [googleReady, setGoogleReady] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error, successMessage, user } = useSelector((state) => state.auth);

  const initialFormState = {
    name: "",
    email: "",
    password: "",
  };

  const [formData, setFormData] = useState(initialFormState);

  // Auto redirect to Home page if user is already logged in or owner
  useEffect(() => {
    if (user) {
      navigate(getAuthenticatedHome(user));
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!googleClientId) return undefined;

    const initializeGoogle = () => {
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: ({ credential }) => {
          dispatch(googleLoginUser(credential))
            .unwrap()
            .then((result) => {
              if (!result.pendingApproval) {
                navigate(getAuthenticatedHome(result));
              }
            })
            .catch((message) => alert(message));
        },
      });
      setGoogleReady(true);
    };

    if (window.google?.accounts?.id) {
      initializeGoogle();
      return undefined;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = initializeGoogle;
    script.onerror = () => setGoogleReady(false);
    document.head.appendChild(script);
    return () => {
      script.onload = null;
      script.onerror = null;
    };
  }, [dispatch, navigate]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(clearAuthMessages());

    if (isSignUp) {
      if (!formData.name || !formData.email || !formData.password) {
        alert("Please fill in all fields!");
        return;
      }
      dispatch(registerUser({ ...formData, role: signupRole })).then((res) => {
        if (!res.error) setFormData({ ...initialFormState, email: formData.email });
      });
    } else {
      if (!formData.email || !formData.password) {
        alert("Please enter email and password!");
        return;
      }
      dispatch(
        loginUser({ email: formData.email, password: formData.password })
      ).then((res) => {
        if (!res.error) {
          setFormData(initialFormState);
          navigate(getAuthenticatedHome(res.payload));
        }
      });
    }
  };

  const handleGoogleLogin = () => {
    dispatch(clearAuthMessages());
    window.google?.accounts?.id?.prompt();
  };

  const handleResendVerification = () => {
    if (!formData.email.trim()) {
      alert("Please enter your email address first.");
      return;
    }
    dispatch(clearAuthMessages());
    dispatch(requestEmailVerification(formData.email));
  };

 const handleResetPassword = (e) => {
  e.preventDefault();
  if (!resetEmail) {
    alert("Please enter your email!");
    return;
  }
  dispatch(resetPassword(resetEmail)).then((res) => {
    if (!res.error) {
      alert(res.payload);
      setShowForgotModal(false);
    }
  });
};

  const toggleMode = (mode) => {
    dispatch(clearAuthMessages());
    setIsSignUp(mode === "signup");
    setFormData(initialFormState);
  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.tabHeader}>
          <button
            type="button"
            className={`${styles.tabBtn} ${isSignUp ? styles.activeTab : ""}`}
            onClick={() => toggleMode("signup")}
          >
            Sign Up
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${!isSignUp ? styles.activeTab : ""}`}
            onClick={() => toggleMode("login")}
          >
            Log In
          </button>
        </div>

        <h2>{isSignUp ? "Create New Account" : "Welcome Back"}</h2>

        {error && <div className={styles.errorAlert}>{error}</div>}
        {successMessage && (
          <div className={styles.successAlert}>{successMessage}</div>
        )}

        {user && !isSignUp && (
          <div className={styles.loggedInInfo}>
            Logged in as: <strong>{user.name || user.email}</strong>
          </div>
        )}

        <form onSubmit={handleSubmit} className={styles.formGroup}>
          {isSignUp && (
            <div className={styles.inputField}>
              <label>Full Name *</label>
              <input
                type="text"
                name="name"
                placeholder="Your Name"
                value={formData.name}
                onChange={handleChange}
                required={isSignUp}
              />
            </div>
          )}

          {isSignUp && (
            <div className={styles.inputField}>
              <label>Account type *</label>
              <select
                value={signupRole}
                onChange={(e) => setSignupRole(e.target.value)}
              >
                <option value="EMPLOYEE">Employee</option>
                <option value="CLIENT">Client</option>
              </select>
            </div>
          )}

          {isSignUp && signupRole === "CLIENT" && (
            <div className={styles.inputField}>
              <label>Company you want to access *</label>
              <input
                type="text"
                name="companyName"
                placeholder="Company name (admin will confirm)"
                value={formData.companyName || ""}
                onChange={handleChange}
                required
              />
            </div>
          )}

          <div className={styles.inputField}>
            <label>Email Address *</label>
            <input
              type="email"
              name="email"
              placeholder="e.g. name@company.com"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className={styles.inputField}>
            <label>Password *</label>
            <input
              type="password"
              name="password"
              placeholder="Enter password"
              value={formData.password}
              onChange={handleChange}
              minLength={12}
              required
            />
          </div>

          {!isSignUp && (
            <div className={styles.forgotPassWrapper}>
              <button
                type="button"
                className={styles.forgotLink}
                onClick={() => {
                  setResetEmail(formData.email || "");
                  setShowForgotModal(true);
                }}
              >
                Forgot Password?
              </button>
            </div>
          )}

          <div className={styles.actionRow}>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading}
            >
              {loading
                ? "Processing..."
                : isSignUp
                ? "Sign Up"
                : "Log In"}
            </button>

            {!isSignUp && (
              <button
                type="button"
                className={styles.switchBtn}
                onClick={handleResendVerification}
                disabled={loading}
              >
                Resend verification email
              </button>
            )}

            {googleReady && (
              <button
                type="button"
                className={styles.googleBtn}
                onClick={handleGoogleLogin}
                disabled={loading}
              >
                Continue with Google
              </button>
            )}

            <button
              type="button"
              className={styles.switchBtn}
              onClick={() => toggleMode(isSignUp ? "login" : "signup")}
            >
              {isSignUp ? "Already have account? Login" : "Need account? Sign Up"}
            </button>
          </div>
        </form>
      </div>

      {showForgotModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalCard}>
            <button
              type="button"
              className={styles.closeBtn}
              onClick={() => setShowForgotModal(false)}
            >
              <X size={20} />
            </button>

            <div className={styles.modalHeader}>
              <div className={styles.iconCircle}>
                <KeyRound size={26} color="#2563eb" />
              </div>
              <h3>Reset Your Password</h3>
              <p>Enter your account email to receive a secure password reset link.</p>
            </div>

            <form onSubmit={handleResetPassword} className={styles.modalBody}>
              <div className={styles.inputWrapper}>
                <Mail className={styles.fieldIcon} size={18} />
                <input
                  type="email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="Enter your email address"
                  required
                />
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.cancelBtn}
                  onClick={() => setShowForgotModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className={styles.sendLinkBtn} disabled={loading}>
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthForm;