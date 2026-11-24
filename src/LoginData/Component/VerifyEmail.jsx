import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { apiClient, getApiErrorMessage } from "../../api/apiClient";
import styles from "./AuthForm.module.css";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [message, setMessage] = useState("Verifying your email address...");
  const [error, setError] = useState("");
  const verificationRequest = useRef(null);

  useEffect(() => {
    if (!token) return undefined;

    let active = true;
    if (verificationRequest.current?.token !== token) {
      verificationRequest.current = {
        token,
        promise: apiClient.post("/auth/email-verification/complete", { token }),
      };
    }

    verificationRequest.current.promise
      .then(() => {
        if (active) {
          setMessage("Email verified. If your account requires approval, you can sign in after an administrator approves it.");
        }
      })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError));
      });

    return () => {
      active = false;
    };
  }, [token]);

  const displayError = error || (!token ? "This verification link is missing its token." : "");

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <h2>Verify Email</h2>
        {displayError ? (
          <div className={styles.errorAlert}>{displayError}</div>
        ) : (
          <div className={styles.successAlert}>{message}</div>
        )}
        <Link className={styles.switchBtn} to="/Login">
          Go to login
        </Link>
      </div>
    </div>
  );
};

export default VerifyEmail;
