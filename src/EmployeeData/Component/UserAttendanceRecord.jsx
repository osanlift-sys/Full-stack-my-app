/* eslint-disable react-hooks/set-state-in-effect */
import html2pdf from "html2pdf.js";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { apiClient, getApiErrorMessage } from "../../api/apiClient";
import { fetchAllPages } from "../../api/apiResources";
import MonthFilter from "./MonthFilter";
import styles from "./UserAttendanceRecord.module.css";

function UserAttendanceRecord({ employeeName, employeeEmail, employeeId, userRole }) {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [employeeDetails, setEmployeeDetails] = useState({
    name: employeeName || "Employee",
    designation: "N/A",
    baseSalary: 0,
    advanceDeduction: 0,
  });

  const [summary, setSummary] = useState({
    totalHours: 0,
    totalOvertime: 0,
    fridayCount: 0,
    presentDays: 0,
    leaveDays: 0,
    absentDays: 0,
    totalPayableDays: 0,
    baseSalary: 0,
    dailyRate: 0,
    grossPayable: 0,
    fridayAllowance: 0,
    advanceDeduction: 0,
    netPayable: 0,
  });

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const reportRef = useRef();

  const [showBackdateModal, setShowBackdateModal] = useState(false);
  const [backdateForm, setBackdateForm] = useState({
    date: new Date().toISOString().split("T")[0],
    inTime: "09:00 AM",
    outTime: "06:00 PM",
    status: "Present",
    advanceDeduction: 0,
  });
  const [isUpdating, setIsUpdating] = useState(false);

  // Redux Selectors
  const currentMonth = useSelector((state) => state.attendance?.selectedMonthYear) || "September 2026";
  const currentUser = useSelector((state) => state.auth?.user);

  const normalizedRole = String(userRole || "").toLowerCase().trim();
  const isAdminOrOwner =
    currentUser?.backendRole === "ADMIN" ||
    normalizedRole === "admin" ||
    normalizedRole === "owner";

  const parseTimeToHours = (timeStr) => {
    if (!timeStr || timeStr === "--") return null;
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return null;

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toUpperCase();

    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return hours + minutes / 60;
  };

  const fetchAttendanceAndPayroll = async () => {
    setLoading(true);

    try {
      setLoadError("");
      const monthDate = new Date(`${currentMonth} 1`);
      if (Number.isNaN(monthDate.getTime())) throw new Error("Select a valid attendance month.");
      const month = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
      const from = `${month}-01`;
      const to = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().slice(0, 10);
      if (!employeeId && !currentUser.employeeId) {
        throw new Error("The API account is missing its employee profile ID.");
      }
      const targetEmployeeId = employeeId || currentUser.employeeId;
      const [attendance, payrollData] = await Promise.all([
        fetchAllPages("/attendance", { employeeId: targetEmployeeId, from, to }),
        currentUser.backendRole === "ADMIN" || currentUser.permissions?.emp_tab_payroll
          ? (async () => {
            if (currentUser.backendRole === "ADMIN") {
              await apiClient.post("/payroll/recalculate", undefined, { params: { month } });
            }
            const { data } = await apiClient.get("/payroll", {
              params: { month, employeeId: targetEmployeeId, page: 1, limit: 1 },
            });
            return data.items[0] || null;
          })()
          : Promise.resolve(null),
      ]);

      const rows = attendance.map((data) => {
        const inTime = data.statusIn || "--";
        const outTime = data.statusOut || "--";
        const inHours = parseTimeToHours(inTime);
        const outHours = parseTimeToHours(outTime);
        const totalHours = inHours !== null && outHours !== null && outHours > inHours
          ? outHours - inHours
          : 0;
        const status = data.status === "PRESENT" ? "Present"
          : data.status === "LEAVE" ? "Leave" : "Absent";
        return {
          ...data,
          inTime,
          outTime,
          status,
          totalHours: totalHours.toFixed(2),
          overtimeHours: Math.max(0, totalHours - 9).toFixed(2),
          isFriday: new Date(`${data.date}T00:00:00`).getDay() === 5,
          advanceDeduction: Number(data.advanceDeduction) || 0,
        };
      }).sort((a, b) => new Date(b.date) - new Date(a.date));
      const salary = payrollData || {};
      const baseSalary = Number(salary.baseSalary) || 0;
      const fridayAllowance = Number(salary.fridayAllowance) || 0;
      const advanceDeduction = Number(salary.advanceDeduction) || 0;
      const netPayable = Number(salary.netPayable) || 0;
      setEmployeeDetails({
        name: employeeName || currentUser.name || "Employee",
        designation: currentUser.designation || "N/A",
        baseSalary,
        advanceDeduction,
      });
      setAttendanceRecords(rows);
      setSummary({
        totalHours: rows.reduce((total, row) => total + Number(row.totalHours), 0).toFixed(2),
        totalOvertime: rows.reduce((total, row) => total + Number(row.overtimeHours), 0).toFixed(2),
        fridayCount: rows.filter((row) => row.isFriday && row.status === "Present").length,
        presentDays: Number(salary.presentDays) || rows.filter((row) => row.status === "Present").length,
        leaveDays: Number(salary.leaveDays) || rows.filter((row) => row.status === "Leave").length,
        absentDays: Number(salary.absentDays) || 0,
        totalPayableDays: (Number(salary.presentDays) || 0) + (Number(salary.leaveDays) || 0),
        baseSalary,
        dailyRate: Math.round(baseSalary / 30),
        grossPayable: Math.max(0, netPayable - fridayAllowance + advanceDeduction),
        fridayAllowance,
        advanceDeduction,
        netPayable,
      });
    } catch (err) {
      setLoadError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendanceAndPayroll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeName, employeeEmail, employeeId, currentMonth, currentUser]);

  const handleEditRow = (record) => {
    setBackdateForm({
      date: record.date,
      inTime: record.inTime !== "--" ? record.inTime : "09:00 AM",
      outTime: record.outTime !== "--" ? record.outTime : "06:00 PM",
      status: record.status || "Present",
      advanceDeduction: record.advanceDeduction || 0,
    });
    setShowBackdateModal(true);
  };

  const handleDeleteAttendanceRow = async (docId, date) => {
    if (!isAdminOrOwner) {
      alert("Access Denied: Only Admin or Owner can delete attendance records!");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete attendance record for date: ${date}?`)) return;
    alert("Attendance deletion is not available: the API has no DELETE /attendance/:id endpoint.");
  };

  const handleBackdateSubmit = async (e) => {
    e.preventDefault();

    if (!isAdminOrOwner) {
      alert("Access Denied: Only Admin or Owner can update attendance!");
      return;
    }

    if (!employeeId && !currentUser.employeeId) {
      alert("The API account is missing its employee profile ID.");
      return;
    }

    setIsUpdating(true);
    try {
      const targetDate = new Date(backdateForm.date);
      await apiClient.put("/attendance", {
        employeeId: employeeId || currentUser.employeeId,
        date: backdateForm.date,
        status: backdateForm.status.toUpperCase(),
        statusIn: backdateForm.inTime,
        statusOut: backdateForm.outTime,
        advanceDeduction: String(backdateForm.advanceDeduction || 0),
        notes: `Updated by administrator on ${targetDate.toISOString().slice(0, 10)}`,
      });

      alert(`Attendance saved/updated successfully for ${backdateForm.date}`);
      setShowBackdateModal(false);
      fetchAttendanceAndPayroll();
    } catch (error) {
      console.error("Error updating backdate attendance:", error);
      alert(getApiErrorMessage(error));
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownloadPDF = () => {
    const element = reportRef.current;
    const opt = {
      margin: 8,
      filename: `${employeeDetails.name}_${currentMonth}_Payslip.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className={styles.attendanceWrapper}>
      <MonthFilter />

      <div className={styles.topActions}>
        {isAdminOrOwner && (
          <button
            onClick={() => {
              setBackdateForm({
                date: new Date().toISOString().split("T")[0],
                inTime: "09:00 AM",
                outTime: "06:00 PM",
                status: "Present",
                advanceDeduction: 0,
              });
              setShowBackdateModal(true);
            }}
            className={styles.addBackdateBtn}
          >
            + Add / Update Backdate
          </button>
        )}

        <button onClick={handleDownloadPDF} className={styles.downloadPdfBtn}>
          Download PDF Statement
        </button>
      </div>

      {loading ? (
        <p className={styles.loading}>Loading Data...</p>
      ) : loadError ? (
        <p className={styles.error} role="alert">{loadError}</p>
      ) : (
        <div ref={reportRef} className={styles.pdfArea}>
          <div className={styles.companyHeader}>
            <h2>OSAN LIFT</h2>
            <p>Monthly Employee Statement & Salary Payslip</p>
          </div>

          <div className={styles.headerFlex}>
            <div>
              <h3 className={styles.sectionTitle}>Month: {currentMonth}</h3>
              <p className={styles.subTitle}>
                Employee: <strong>{employeeDetails.name}</strong> (
                <span className={styles.designationBadge}>
                  {employeeDetails.designation}
                </span>
                )
              </p>
            </div>
          </div>

          {/* Summary Grid */}
          <div className={styles.summaryGrid}>
            <div className={styles.summaryCard}>
              <span>Present Days</span>
              <strong>{summary.presentDays} Days</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Leave Days</span>
              <strong>{summary.leaveDays} Days</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Absent Days</span>
              <strong className={styles.dangerText}>{summary.absentDays} Days</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Friday Duty</span>
              <strong>{summary.fridayCount} Days</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Total Duty</span>
              <strong>{summary.totalHours} hrs</strong>
            </div>
            <div className={styles.summaryCard}>
              <span>Overtime</span>
              <strong>{summary.totalOvertime} hrs</strong>
            </div>
          </div>

          {/* Salary Grid */}
          <div className={styles.salaryGrid}>
            <div className={styles.salaryCard}>
              <span>Base Salary</span>
              <strong>৳ {summary.baseSalary.toLocaleString()}</strong>
            </div>
            <div className={styles.salaryCard}>
              <span>Daily Rate</span>
              <strong>৳ {summary.dailyRate.toLocaleString()}</strong>
            </div>
            <div className={styles.salaryCard}>
              <span>Friday Bonus (+)</span>
              <strong className={styles.successText}>
                +৳ {summary.fridayAllowance.toLocaleString()}
              </strong>
            </div>
            <div className={styles.salaryCard}>
              <span>Advance (-)</span>
              <strong className={styles.dangerText}>
                -৳ {summary.advanceDeduction.toLocaleString()}
              </strong>
            </div>
            <div className={`${styles.salaryCard} ${styles.highlightCard}`}>
              <span>Net Payable Salary</span>
              <strong>৳ {summary.netPayable.toLocaleString()}</strong>
            </div>
          </div>

          {/* Attendance Table */}
          <div className={styles.tableResponsive}>
            <table className={styles.attTable}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>In Time</th>
                  <th>Out Time</th>
                  <th>Duty Hours</th>
                  <th>Overtime</th>
                  <th>Advance</th>
                  <th>Status</th>
                  {isAdminOrOwner && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {attendanceRecords.length === 0 ? (
                  <tr>
                    <td colSpan={isAdminOrOwner ? "8" : "7"} className={styles.noData}>
                      No records found for this month.
                    </td>
                  </tr>
                ) : (
                  attendanceRecords.map((item) => (
                    <tr
                      key={item.id}
                      className={item.isFriday ? styles.fridayRow : ""}
                    >
                      <td>{item.date}</td>
                      <td>{item.inTime}</td>
                      <td>{item.outTime}</td>
                      <td>
                        <strong>{item.totalHours} hrs</strong>
                      </td>
                      <td>
                        {parseFloat(item.overtimeHours) > 0 ? (
                          <span className={styles.otBadge}>
                            +{item.overtimeHours} hrs
                          </span>
                        ) : (
                          "--"
                        )}
                      </td>
                      <td>
                        {item.advanceDeduction > 0 ? (
                          <strong className={styles.dangerText}>
                            ৳ {item.advanceDeduction}
                          </strong>
                        ) : (
                          "--"
                        )}
                      </td>
                      <td>
                        {item.isFriday && item.status === "Present" ? (
                          <span className={styles.fridayBadge}>Friday (Payable)</span>
                        ) : (
                          item.status
                        )}
                      </td>
                      {isAdminOrOwner && (
                        <td>
                          <div className={styles.actionGroup}>
                            <button
                              onClick={() => handleEditRow(item)}
                              className={styles.editBtn}
                            >
                              ✏ Edit
                            </button>
                            <button
                              onClick={() => handleDeleteAttendanceRow(item.id, item.date)}
                              className={styles.deleteBtn}
                            >
                              🗑 Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit / Backdate Modal */}
      {showBackdateModal && isAdminOrOwner && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>
              Add / Edit Attendance & Advance Record
            </h3>

            <form onSubmit={handleBackdateSubmit}>
              <div className={styles.formGroup}>
                <label>Select Date:</label>
                <input
                  type="date"
                  value={backdateForm.date}
                  onChange={(e) =>
                    setBackdateForm({ ...backdateForm, date: e.target.value })
                  }
                  required
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label>In Time:</label>
                <input
                  type="text"
                  placeholder="09:00 AM"
                  value={backdateForm.inTime}
                  onChange={(e) =>
                    setBackdateForm({ ...backdateForm, inTime: e.target.value })
                  }
                  required
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Out Time:</label>
                <input
                  type="text"
                  placeholder="06:00 PM"
                  value={backdateForm.outTime}
                  onChange={(e) =>
                    setBackdateForm({ ...backdateForm, outTime: e.target.value })
                  }
                  required
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Advance Deduction (Tk):</label>
                <input
                  type="number"
                  placeholder="0"
                  value={backdateForm.advanceDeduction}
                  onChange={(e) =>
                    setBackdateForm({
                      ...backdateForm,
                      advanceDeduction: e.target.value,
                    })
                  }
                  className={styles.formInput}
                />
              </div>

              <div className={styles.formGroup}>
                <label>Status:</label>
                <select
                  value={backdateForm.status}
                  onChange={(e) =>
                    setBackdateForm({ ...backdateForm, status: e.target.value })
                  }
                  className={styles.formSelect}
                >
                  <option value="Present">Present</option>
                  <option value="Leave">Leave</option>
                  <option value="Absent">Absent</option>
                </select>
              </div>

              <div className={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowBackdateModal(false)}
                  className={styles.cancelBtn}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className={styles.saveBtn}
                >
                  {isUpdating ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default UserAttendanceRecord;