

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { apiClient, getApiErrorMessage } from "../../api/apiClient";
import { fetchAllPages } from "../../api/apiResources";
import styles from "./Attendance.module.css";

function Attendance() {
  const currentUser = useSelector((state) => state.auth?.user);
  const currentUserEmail = currentUser?.email || "";

  const [employeeData, setEmployeeData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [notifications, setNotifications] = useState([]);
  const [notificationError, setNotificationError] = useState("");

  const [todayRequests, setTodayRequests] = useState({ in: null, out: null });

  // Modal States
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveDate, setLeaveDate] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceReason, setAdvanceReason] = useState("");

  const now = new Date();
  const todayDate = now.toISOString().split("T")[0];
  const currentMonth = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  useEffect(() => {
    const email = currentUserEmail.toLowerCase().trim();
    if (!email) {
      return undefined;
    }

    let active = true;
    apiClient.get("/notifications", { params: { page: 1, limit: 100 } })
      .then(({ data }) => {
        if (active) {
          setNotifications(data.items.map((item) => ({ ...item, read: Boolean(item.readAt) })));
          setNotificationError("");
        }
      })
      .catch((error) => {
        if (active) setNotificationError(getApiErrorMessage(error));
      });
    return () => { active = false; };
  }, [currentUserEmail]);

  useEffect(() => {
    const fetchEmployeeAndStatus = async () => {
      if (!currentUserEmail || currentUser?.backendRole !== "EMPLOYEE" || !currentUser.employeeId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setEmployeeData({
          id: currentUser.employeeId,
          name: currentUser.name,
          email: currentUser.email,
          avatar: currentUser.photoURL,
          designation: currentUser.designation,
        });
        const requests = await fetchAllPages("/attendance/requests");
        const today = requests.filter((request) => request.requestedDate === todayDate);
        const inRequest = today.find((request) => request.requestData?.type === "IN");
        const outRequest = today.find((request) => request.requestData?.type === "OUT");
        setTodayRequests({
          in: inRequest ? { ...inRequest.requestData, status: inRequest.status } : null,
          out: outRequest ? { ...outRequest.requestData, status: outRequest.status } : null,
        });
      } catch (err) {
        setMessage({ type: "error", text: getApiErrorMessage(err) });
      } finally {
        setLoading(false);
      }
    };

    fetchEmployeeAndStatus();
  }, [currentUserEmail, todayDate, currentUser]);

  const handleNotificationRead = async (notificationId) => {
    try {
      await apiClient.patch(`/notifications/${encodeURIComponent(notificationId)}/read`);
      setNotifications((items) => items.map((item) =>
        item.id === notificationId ? { ...item, read: true } : item
      ));
    } catch (err) {
      console.error("Mark notification as read error:", err);
      setNotificationError(getApiErrorMessage(err));
    }
  };

  // Attendance (IN / OUT) Submit
  const handleAttendanceSubmit = async (type) => {
    if (!employeeData) return;

    if (type === "IN" && todayRequests.in) {
      setMessage({ type: "warning", text: "You have already submitted In-Time attendance for today." });
      return;
    }

    if (type === "OUT" && todayRequests.out) {
      setMessage({ type: "warning", text: "You have already submitted Out-Time attendance for today." });
      return;
    }

    try {
      setIsSubmitting(true);
      setMessage({ type: "", text: "" });

      const currentTime = new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });

      const requestData = { type, time: currentTime };
      await apiClient.post("/attendance/requests", {
        requestedDate: todayDate,
        requestData,
      });

      setTodayRequests((prev) => ({
        ...prev,
        [type.toLowerCase()]: requestData,
      }));

      setMessage({
        type: "success",
        text: `${type} Time attendance request submitted! Waiting for admin approval.`,
      });
    } catch (err) {
      console.error("Attendance Submit Error:", err);
      setMessage({ type: "error", text: getApiErrorMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Leave Request Submit
  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    if (!leaveDate || !leaveReason) return;

    try {
      setIsSubmitting(true);
      const reqMonth = new Date(leaveDate).toLocaleString("en-US", { month: "long", year: "numeric" });

      await apiClient.post("/attendance/requests", {
        requestedDate: leaveDate,
        requestData: {
          type: "LEAVE",
          monthYear: reqMonth,
          reason: leaveReason,
        },
      });

      setMessage({ type: "success", text: "Leave request submitted! Waiting for admin approval." });
      setShowLeaveModal(false);
      setLeaveReason("");
      setLeaveDate("");
    } catch (err) {
      console.error("Leave Request Error:", err);
      setMessage({ type: "error", text: getApiErrorMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Advance Salary Request Submit
  const handleAdvanceSubmit = async (e) => {
    e.preventDefault();
    if (!advanceAmount || Number(advanceAmount) <= 0) return;

    try {
      setIsSubmitting(true);

      await apiClient.post("/attendance/requests", {
        requestedDate: todayDate,
        requestData: {
          type: "ADVANCE",
          monthYear: currentMonth,
          amount: Number(advanceAmount),
          reason: advanceReason || "N/A",
        },
      });

      setMessage({ type: "success", text: "Advance Salary request submitted! Waiting for admin approval." });
      setShowAdvanceModal(false);
      setAdvanceAmount("");
      setAdvanceReason("");
    } catch (err) {
      console.error("Advance Request Error:", err);
      setMessage({ type: "error", text: getApiErrorMessage(err) });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.loader}>Verifying employee account...</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Employee Self Portal</h2>

      {(notifications.length > 0 || notificationError) && (
        <section className={styles.notificationSection} aria-label="Notifications">
          <h3 className={styles.notificationHeading}>Notifications</h3>
          {notificationError && <p className={styles.notificationError}>{notificationError}</p>}
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`${styles.notification} ${notification.read ? "" : styles.unreadNotification}`}
            >
              <div>
                <strong>{notification.title}</strong>
                <p>{notification.message}</p>
              </div>
              {!notification.read && (
                <button
                  type="button"
                  className={styles.markReadBtn}
                  onClick={() => handleNotificationRead(notification.id)}
                >
                  Mark as read
                </button>
              )}
            </div>
          ))}
        </section>
      )}

      {message.text && (
        <div className={`${styles.alert} ${styles[message.type]}`}>
          {message.text}
        </div>
      )}

      {employeeData ? (
        <div className={styles.card}>
          <div className={styles.profileHeader}>
            <img
              src={employeeData.avatar || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='%23ccc'><path d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/></svg>"}
              alt="Profile Avatar"
              className={styles.avatar}
            />
            <div>
              <h3 className={styles.name}>{employeeData.name}</h3>
              <p className={styles.designation}>{employeeData.designation}</p>
              <p className={styles.email}>{employeeData.email}</p>
            </div>
          </div>

          <div className={styles.dateBox}>
            <div>Date: <strong>{todayDate}</strong></div>
            <div style={{ fontSize: "0.85rem", color: "#64748b", marginTop: "4px" }}>
              Month: {currentMonth}
            </div>
          </div>

          {/* Action Buttons */}
          <div className={styles.btnGrid}>
            <button
              onClick={() => handleAttendanceSubmit("IN")}
              disabled={isSubmitting || Boolean(todayRequests.in)}
              className={`${styles.submitBtn} ${styles.inBtn}`}
            >
              {todayRequests.in ? `IN: ${todayRequests.in.time}` : "Give IN"}
            </button>

            <button
              onClick={() => handleAttendanceSubmit("OUT")}
              disabled={isSubmitting || Boolean(todayRequests.out)}
              className={`${styles.submitBtn} ${styles.outBtn}`}
            >
              {todayRequests.out ? `OUT: ${todayRequests.out.time}` : "Give OUT"}
            </button>

            <button
              onClick={() => setShowLeaveModal(true)}
              className={`${styles.submitBtn} ${styles.leaveBtn}`}
            >
              Apply Leave
            </button>

            <button
              onClick={() => setShowAdvanceModal(true)}
              className={`${styles.submitBtn} ${styles.advanceBtn}`}
            >
              Request Advance
            </button>
          </div>
        </div>
      ) : (
        <div className={styles.unauthorized}>
          <p>Logged in account (<b>{currentUserEmail || "Guest"}</b>) is not matched with any employee record.</p>
        </div>
      )}

      {/* Leave Modal */}
      {showLeaveModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Apply for Leave</h3>
            <form onSubmit={handleLeaveSubmit}>
              <label>Select Date:</label>
              <input
                type="date"
                value={leaveDate}
                onChange={(e) => setLeaveDate(e.target.value)}
                required
              />
              <label>Reason:</label>
              <textarea
                value={leaveReason}
                onChange={(e) => setLeaveReason(e.target.value)}
                placeholder="Reason for leave..."
                required
              />
              <div className={styles.modalBtns}>
                <button type="submit" className={styles.saveBtn}>Submit Request</button>
                <button type="button" onClick={() => setShowLeaveModal(false)} className={styles.cancelBtn}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Advance Salary Modal */}
      {showAdvanceModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h3>Request Advance Salary</h3>
            <form onSubmit={handleAdvanceSubmit}>
              <label>Amount (BDT):</label>
              <input
                type="number"
                value={advanceAmount}
                onChange={(e) => setAdvanceAmount(e.target.value)}
                placeholder="e.g. 5000"
                required
              />
              <label>Reason / Note:</label>
              <textarea
                value={advanceReason}
                onChange={(e) => setAdvanceReason(e.target.value)}
                placeholder="Why do you need advance salary?"
              />
              <div className={styles.modalBtns}>
                <button type="submit" className={styles.saveBtn}>Submit Request</button>
                <button type="button" onClick={() => setShowAdvanceModal(false)} className={styles.cancelBtn}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Attendance;