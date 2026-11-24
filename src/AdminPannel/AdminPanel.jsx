import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { setSelectedRequest, setSupportRequests } from "../Fetures/Inventory/supportSlice";
import { apiClient } from "../api/apiClient";
import { fetchAllPages } from "../api/apiResources";
import styles from "./AdminPanel.module.css";

function AdminPanel() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const currentUser = useSelector((state) => state.auth?.user);

  // Redux Toolkit state for support requests
  const supportRequests = useSelector((state) => state.support?.supportRequests || []);

  const [activeTab, setActiveTab] = useState("permissions");
  const [employees, setEmployees] = useState([]);
  const [requests, setRequests] = useState([]);
  const [signupRequests, setSignupRequests] = useState([]);
  const [pendingClientRequests, setPendingClientRequests] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [clientCompanySelections, setClientCompanySelections] = useState({});
  const [permissions, setPermissions] = useState({});
  const [adminList, setAdminList] = useState([]);
  const [managedUsers, setManagedUsers] = useState([]);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [processingRequestId, setProcessingRequestId] = useState(null);

  const availableFeatures = [
    { key: "nav_home", label: "Header -> Home Navigation", category: "Header Menu" },
    { key: "nav_ai_bay", label: "Header -> AI Bay Navigation", category: "Header Menu" },
    { key: "nav_clients", label: "Header -> Clients Navigation", category: "Header Menu" },
    { key: "nav_projects", label: "Header -> Projects Navigation", category: "Header Menu" },
    { key: "nav_inventory", label: "Header -> Inventory & Billing Navigation", category: "Header Menu" },
    { key: "inventory_tab_products", label: "Inventory -> View Products", category: "Inventory Portal" },
    { key: "inventory_action_products", label: "Inventory -> Manage Products", category: "Inventory Actions" },
    { key: "inventory_action_stock", label: "Inventory -> Adjust Stock", category: "Inventory Actions" },
    { key: "orders_tab_manage", label: "Orders -> View Orders", category: "Orders" },
    { key: "orders_action_manage", label: "Orders -> Manage Orders and Payments", category: "Orders" },
    { key: "reports_tab_dashboard", label: "Reports -> View Employee Dashboard", category: "Reports" },
    { key: "reports_action_financial", label: "Reports -> View Financial Reports", category: "Reports" },
    { key: "nav_employee", label: "Header -> Employee's Data Navigation", category: "Header Menu" },
    { key: "nav_admin", label: "Header -> Admin Panel Navigation", category: "Header Menu" },
    { key: "clients_tab_list", label: "Clients -> Sidebar: Client List Page", category: "Clients Portal" },
    { key: "clients_tab_offer", label: "Clients -> Sidebar: Offer Page", category: "Clients Portal" },
    { key: "clients_tab_challan", label: "Clients -> Sidebar: Challan Page", category: "Clients Portal" },
    { key: "clients_tab_invoice", label: "Clients -> Sidebar: Invoice Page", category: "Clients Portal" },
    { key: "clients_action_save", label: "Clients -> Action: Save Offer/Challan", category: "Clients Actions" },
    { key: "clients_action_update", label: "Clients -> Action: Update Offer/Challan", category: "Clients Actions" },
    { key: "clients_action_delete", label: "Clients -> Action: Delete Offer/Challan", category: "Clients Actions" },
    { key: "clients_action_pdf", label: "Clients -> Action: Download PDF", category: "Clients Actions" },
    { key: "projects_tab_summary", label: "Projects -> Sidebar: Summary Page", category: "Projects Portal" },
    { key: "projects_tab_serviced", label: "Projects -> Sidebar: Serviced & Schedule Page", category: "Projects Portal" },
    { key: "projects_action_add", label: "Projects -> Action: Add New Project", category: "Projects Actions" },
    { key: "projects_action_save", label: "Projects -> Action: Save changes", category: "Projects Actions" },
    { key: "projects_action_edit", label: "Projects -> Action: Edit Project Info", category: "Projects Actions" },
    { key: "projects_action_update", label: "Projects -> Action: Update Servicing Schedule", category: "Projects Actions" },
    { key: "projects_action_delete", label: "Projects -> Action: Delete Project", category: "Projects Actions" },
    { key: "emp_tab_profile", label: "Employee -> Sidebar: Your Profile Page", category: "Employee Portal" },
    { key: "emp_tab_attendance", label: "Employee -> Sidebar: Attendance Page", category: "Employee Portal" },
    { key: "emp_tab_list", label: "Employee -> Sidebar: Employee List Page", category: "Employee Portal" },
    { key: "emp_tab_payroll", label: "Employee -> Sidebar: Payroll & Salary Page", category: "Employee Portal" },
    { key: "emp_action_edit_profile", label: "Employee -> Action: Edit Profile Info", category: "Employee Actions" },
    { key: "emp_action_download_pdf", label: "Employee -> Action: Download PDF Statement", category: "Employee Actions" },
  ];

  const fetchData = useCallback(async () => {
    try {
      const [allUsers, employeeRequests, attendanceRequests, supportRequests, companyResponse] = await Promise.all([
        fetchAllPages("/admin/users"),
        apiClient.get("/admin/employee-requests").then(({ data }) => data.items),
        fetchAllPages("/attendance/requests"),
        fetchAllPages("/support/requests"),
        apiClient.get("/admin/companies").then(({ data }) => data),
      ]);
      const availableCompanies = companyResponse.items.filter((company) => company.status === "ACTIVE");
      const clientRequests = allUsers.filter(
        (user) => user.role === "CLIENT" && user.status === "PENDING"
      );
      const empList = allUsers
        .filter((user) => user.role === "EMPLOYEE")
        .map((user) => ({
          ...user,
          employeeId: user.employee?.id,
          designation: user.employee?.designation,
          phone: user.employee?.phone,
          baseSalary: user.employee?.baseSalary,
        }));
      setEmployees(empList);
      setManagedUsers(allUsers);
      const permMap = Object.fromEntries(allUsers.map((user) => [
        user.email.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_"),
        user.permissions ?? null,
      ]));
      setPermissions(permMap);
      const signupList = employeeRequests.map((user) => ({
        ...user,
        employeeId: user.employee?.id,
        status: user.employee?.approvalStatus || user.status,
      }));
      setSignupRequests(signupList);
      setPendingClientRequests(clientRequests);
      setCompanies(availableCompanies);
      setClientCompanySelections(Object.fromEntries(clientRequests.map((client) => {
        const requestedCompany = String(client.requestedCompanyName || "")
          .normalize("NFKC")
          .trim()
          .replace(/\s+/g, " ")
          .toLowerCase();
        const matchedCompany = availableCompanies.find(
          (company) => company.normalizedName === requestedCompany
        );
        return [client.id, matchedCompany?.id || client.companies?.[0]?.id || ""];
      })));
      const admins = allUsers.filter((user) => user.role === "ADMIN").map((user) => user.email.toLowerCase());
      setAdminList(admins);
      setRequests(attendanceRequests.map((item) => ({
        ...(item.requestData || {}),
        id: item.id,
        employeeId: item.employeeId,
        recipientUserId: item.employee?.id,
        employeeName: item.employee?.name,
        employeeEmail: item.employee?.email,
        date: item.requestedDate,
        status: item.status.toLowerCase(),
      })));
      dispatch(setSupportRequests(supportRequests.filter((item) => item.status !== "complete")));
    } catch (err) {
      console.error("Admin Fetch Error:", err);
      alert(err?.response?.data?.error?.message || err?.message || "Failed to load Admin Panel data.");
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  useEffect(() => {
    Promise.resolve().then(fetchData);
  }, [fetchData]);

  const isAdmin = currentUser?.backendRole === "ADMIN";
  const pendingSignupRequests = signupRequests.filter(
    (request) => String(request.status || "pending").toLowerCase() === "pending"
  );
  const pendingSignupCount = pendingSignupRequests.length + pendingClientRequests.length;
  const pendingRequests = requests.filter(
    (request) => String(request.status || "pending").toLowerCase() === "pending"
  );

  // Handle Redirect to Response Page
  const handleOpenResponsePage = (req) => {
    dispatch(setSelectedRequest(req));
    navigate("/technical-support-response");
  };

  const handleAttendanceRequest = async (req, decision) => {
    if (!isAdmin) {
      alert("Access Denied: Only Admin or Owner can review attendance requests.");
      return;
    }
    if (req.status && req.status.toLowerCase() !== "pending") return;

    setProcessingRequestId(req.id);
    try {
      if (decision === "approve") {
        const requestType = String(req.type || "").toUpperCase();
        if (!["IN", "OUT", "LEAVE", "ADVANCE"].includes(requestType)) {
          throw new Error(`Unsupported attendance request type: ${requestType || "Unknown"}.`);
        }
        if (requestType === "ADVANCE" && (!Number.isFinite(Number(req.amount)) || Number(req.amount) <= 0)) {
          throw new Error("The advance request has an invalid amount.");
        }
        const attendance = {
          employeeId: req.employeeId,
          date: req.date,
          status: requestType === "LEAVE" ? "LEAVE" : "PRESENT",
          notes: req.reason || "",
        };
        if (requestType === "IN") attendance.statusIn = req.time || "";
        if (requestType === "OUT") attendance.statusOut = req.time || "";
        if (requestType === "ADVANCE") attendance.advanceDeduction = String(req.amount || 0);
        await apiClient.put("/attendance", attendance);
      }
      await apiClient.patch(`/attendance/requests/${encodeURIComponent(req.id)}/review`, {
        status: decision === "approve" ? "APPROVED" : "REJECTED",
      });
      if (req.recipientUserId) {
        await apiClient.post("/notifications", {
          userId: req.recipientUserId,
          title: `${req.type || "Attendance"} request ${decision === "approve" ? "approved" : "rejected"}`,
          message: `Your ${req.type || "attendance"} request for ${req.date} was ${decision === "approve" ? "approved" : "rejected"}.`,
          payload: { attendanceRequestId: req.id },
        });
      }
      await fetchData();
    } catch (err) {
      console.error(`Failed to ${decision} attendance request:`, err);
      alert(err?.response?.data?.error?.message || err.message || `Failed to ${decision} attendance request.`);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleSignupRequest = async (req, decision) => {
    if (!isAdmin) {
      alert("Access Denied: Only Admin or Owner can review signup requests.");
      return;
    }

    setProcessingRequestId(req.id);
    try {
      await apiClient.patch(
        `/admin/employees/${encodeURIComponent(req.employeeId)}/approval`,
        { decision: decision === "approve" ? "APPROVED" : "REJECTED" }
      );
      await fetchData();
    } catch (error) {
      console.error(`Failed to ${decision} signup request:`, error);
      alert(error.message || `Failed to ${decision} signup request.`);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleClientSignupRequest = async (request, decision) => {
    if (!isAdmin) {
      alert("Access Denied: Only Admin or Owner can review signup requests.");
      return;
    }

    setProcessingRequestId(request.id);
    try {
      const status = decision === "approve" ? "ACTIVE" : "REJECTED";
      const payload = { status };
      if (decision === "approve") {
        const companyId = clientCompanySelections[request.id];
        if (!companyId) throw new Error("Select an active company before approving this client.");
        if (!request.emailVerifiedAt) throw new Error("The client must verify their email before approval.");
        payload.companyId = companyId;
      }
      await apiClient.patch(`/admin/users/${encodeURIComponent(request.id)}/status`, payload);
      await fetchData();
    } catch (requestError) {
      console.error(`Failed to ${decision} client signup request:`, requestError);
      alert(requestError?.response?.data?.error?.message || requestError.message || `Failed to ${decision} client signup request.`);
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleAddAdmin = async (e) => {
    e.preventDefault();
    if (!newAdminEmail) return;

    const rawEmail = newAdminEmail.trim().toLowerCase();
    try {
      const target = managedUsers.find((user) => user.email.toLowerCase() === rawEmail);
      if (!target) {
        throw new Error("This email is not registered. The API can assign Admin role only to an existing account.");
      }
      await apiClient.patch(`/admin/users/${encodeURIComponent(target.id)}/role`, { role: "ADMIN" });
      await fetchData();
      setNewAdminEmail("");
      alert("Admin role assigned successfully.");
    } catch (err) {
      console.error("Add Admin Error:", err);
      alert(err?.response?.data?.error?.message || err.message || "Failed to assign Admin role.");
    }
  };

  const handleRemoveAdmin = async (targetEmail) => {
    try {
      const target = managedUsers.find((user) => user.email.toLowerCase() === targetEmail.toLowerCase());
      if (!target) throw new Error("Admin account was not found.");
      await apiClient.patch(`/admin/users/${encodeURIComponent(target.id)}/role`, { role: "EMPLOYEE" });
      await fetchData();
      alert("Admin role removed. The account must have an approved employee profile to access employee features.");
    } catch (err) {
      console.error("Remove Admin Error:", err);
      alert(err?.response?.data?.error?.message || err.message || "Failed to remove Admin role.");
    }
  };

  const handlePermissionToggle = async (userEmail, featureKey) => {
    const target = managedUsers.find((user) => user.email.toLowerCase() === userEmail.toLowerCase());
    if (!target) {
      alert("The selected user is no longer available.");
      return;
    }
    const cleanEmail = userEmail.toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
    const currentPerms = permissions[cleanEmail] || {};
    const updatedValue = !currentPerms[featureKey];

    const updatedUserPerms = {
      ...currentPerms,
      [featureKey]: updatedValue,
    };

    try {
      await apiClient.put(`/admin/users/${encodeURIComponent(target.id)}/permissions`, {
        permissions: updatedUserPerms,
      });
      setPermissions((prev) => ({ ...prev, [cleanEmail]: updatedUserPerms }));
    } catch (err) {
      console.error("Permission Save Error:", err);
      alert("Failed to update permission");
    }
  };

  if (loading) {
    return <div className={styles.loader}>Loading Admin Panel...</div>;
  }

  if (!isAdmin) {
    return (
      <div className={styles.unauthorized}>
        <h2>Access Denied</h2>
        <p>You do not have permission to view the Admin Panel.</p>
      </div>
    );
  }

  const groupedFeatures = availableFeatures.reduce((acc, feat) => {
    acc[feat.category] = acc[feat.category] || [];
    acc[feat.category].push(feat);
    return acc;
  }, {});

  return (
    <div className={styles.adminContainer}>
      <h2 className={styles.heading}>Admin Control Panel</h2>

      {/* Tab Navigation Section */}
      <div className={styles.tabWrapper}>
        <div className={styles.tabButtons}>
          <button
            className={`${styles.tabBtn} ${activeTab === "permissions" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("permissions")}
          >
            Access Control
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "signupRequests" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("signupRequests")}
          >
            Signup Requests ({pendingSignupCount})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "requests" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("requests")}
          >
            Attendance Requests ({pendingRequests.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "supportRequests" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("supportRequests")}
          >
            Technical Support ({supportRequests.length})
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === "admins" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("admins")}
          >
            Manage Admins ({adminList.length})
          </button>
        </div>
      </div>

      {/* Access Control / Permissions Tab */}
      {activeTab === "permissions" && (
        <div className={styles.cardGrid}>
          {employees.map((emp) => {
            const cleanEmail = (emp.email || "").toLowerCase().replace(/[^a-zA-Z0-9]/g, "_");
            const userPerms = permissions[cleanEmail];

            return (
              <div key={emp.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h4 className={styles.userName}>{emp.name || "N/A"}</h4>
                  <p className={styles.userEmail}>{emp.email}</p>
                </div>

                <div className={styles.toggleGroup}>
                  {userPerms === null && (
                    <p role="status">Permissions cannot be edited because the admin user API does not return existing permission values.</p>
                  )}
                  {Object.entries(groupedFeatures).map(([category, items]) => (
                    <div key={category} className={styles.categorySection}>
                      <span className={styles.categoryTitle}>{category}</span>
                      {items.map((feat) => (
                        <div key={feat.key} className={styles.toggleItem}>
                          <span className={styles.featureLabel}>{feat.label}</span>
                          <label className={styles.switch}>
                            <input
                              type="checkbox"
                              checked={Boolean(userPerms?.[feat.key])}
                              disabled={userPerms === null}
                              onChange={() => handlePermissionToggle(emp.email, feat.key)}
                            />
                            <span className={styles.slider}></span>
                          </label>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "signupRequests" && (
        <div className={styles.cardGrid}>
          {pendingSignupCount === 0 ? (
            <p className={styles.emptyText}>No pending signup requests.</p>
          ) : (
            <>
              {pendingSignupRequests.map((request) => (
                <div key={request.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h4 className={styles.userName}>{request.name || "New User"}</h4>
                    <p className={styles.userEmail}>{request.email || request.id}</p>
                  </div>
                  <p className={styles.requestDetail}>
                    <strong>Requested:</strong>{" "}
                    {request.requestedAt
                      ? new Date(request.requestedAt).toLocaleString()
                      : "N/A"}
                  </p>
                  <p className={styles.requestDetail}>
                    <strong>Status:</strong>{" "}
                    <span className={styles.typeBadge}>{request.status || "Pending"}</span>
                  </p>
                  <div className={styles.actionBtns}>
                    <button
                      className={styles.approveBtn}
                      onClick={() => handleSignupRequest(request, "approve")}
                      disabled={processingRequestId === request.id}
                    >
                      {processingRequestId === request.id ? "Please wait..." : "Approve"}
                    </button>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => handleSignupRequest(request, "reject")}
                      disabled={processingRequestId === request.id}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {pendingClientRequests.map((request) => (
                <div key={request.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h4 className={styles.userName}>{request.name || "Client"}</h4>
                    <p className={styles.userEmail}>{request.email}</p>
                  </div>
                  <p className={styles.requestDetail}>
                    <strong>Requested company:</strong> {request.requestedCompanyName || "Select a company"}
                  </p>
                  <p className={styles.requestDetail}>
                    <strong>Email:</strong> {request.emailVerifiedAt ? "Verified" : "Not verified"}
                  </p>
                  <label className={styles.requestDetail} htmlFor={`client-company-${request.id}`}>
                    Assign company
                  </label>
                  <select
                    id={`client-company-${request.id}`}
                    className={styles.requestSelect}
                    value={clientCompanySelections[request.id] || ""}
                    onChange={(event) => setClientCompanySelections((current) => ({
                      ...current,
                      [request.id]: event.target.value,
                    }))}
                  >
                    <option value="">Select an active company</option>
                    {companies.map((company) => (
                      <option key={company.id} value={company.id}>{company.name}</option>
                    ))}
                  </select>
                  <div className={styles.actionBtns}>
                    <button
                      className={styles.approveBtn}
                      onClick={() => handleClientSignupRequest(request, "approve")}
                      disabled={processingRequestId === request.id || !request.emailVerifiedAt || !clientCompanySelections[request.id]}
                    >
                      {processingRequestId === request.id ? "Please wait..." : "Approve client"}
                    </button>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => handleClientSignupRequest(request, "reject")}
                      disabled={processingRequestId === request.id}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {activeTab === "requests" && (
        <div className={styles.cardGrid}>
          {pendingRequests.length === 0 ? (
            <p className={styles.emptyText}>No pending attendance requests.</p>
          ) : (
            pendingRequests.map((req) => (
              <div key={req.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <h4 className={styles.userName}>{req.employeeName || "Unknown Employee"}</h4>
                  <p className={styles.userEmail}>{req.employeeEmail || "No email provided"}</p>
                </div>
                <p className={styles.requestDetail}>
                  <strong>Request:</strong> {req.type || "Unknown"}
                </p>
                <p className={styles.requestDetail}>
                  <strong>Date:</strong> {req.date || "N/A"}
                </p>
                {req.type === "ADVANCE" && (
                  <p className={styles.requestDetail}>
                    <strong>Amount:</strong> ৳ {Number(req.amount || 0).toLocaleString()}
                  </p>
                )}
                {(req.type === "ADVANCE" || req.type === "LEAVE") && (
                  <p className={styles.requestDetail}>
                    <strong>Reason:</strong> {req.reason || "N/A"}
                  </p>
                )}
                {(req.type === "IN" || req.type === "OUT") && (
                  <p className={styles.requestDetail}>
                    <strong>Time:</strong> {req.time || "N/A"}
                  </p>
                )}
                <p className={styles.requestDetail}>
                  <strong>Status:</strong>{" "}
                  <span className={styles.typeBadge}>{req.status || "Pending"}</span>
                </p>
                {(!req.status || req.status.toLowerCase() === "pending") && (
                  <div className={styles.actionBtns}>
                    <button
                      className={styles.approveBtn}
                      onClick={() => handleAttendanceRequest(req, "approve")}
                      disabled={processingRequestId === req.id}
                    >
                      {processingRequestId === req.id ? "Please wait..." : "Approve"}
                    </button>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => handleAttendanceRequest(req, "reject")}
                      disabled={processingRequestId === req.id}
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Technical Support Requests Tab */}
      {activeTab === "supportRequests" && (
        <div>
          {supportRequests.length === 0 ? (
            <p className={styles.emptyText}>No pending technical support requests.</p>
          ) : (
            <div className={styles.cardGrid}>
              {supportRequests.map((req) => (
                <div key={req.id} className={styles.card}>
                  <div className={styles.cardHeader}>
                    <h4 className={styles.userName}>{req.userName || "Unknown User"}</h4>
                    <p className={styles.userEmail}>{req.email}</p>
                  </div>
                  <p className={styles.requestDetail}>
                    <strong>Service:</strong> {req.serviceTitle}
                  </p>
                  <p className={styles.requestDetail}>
                    <strong>WhatsApp:</strong> {req.whatsapp}
                  </p>
                  <p className={styles.requestDetail}>
                    <strong>Status:</strong>{" "}
                    <span className={styles.typeBadge}>{req.status || "Pending"}</span>
                  </p>

                  <div className={styles.actionBtns}>
                    <button
                      className={styles.approveBtn}
                      onClick={() => handleOpenResponsePage(req)}
                    >
                      Respond Request
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Manage Admins Tab */}
      {activeTab === "admins" && (
        <div>
          <form onSubmit={handleAddAdmin} className={styles.adminForm}>
            <input
              type="email"
              placeholder="Enter email to make Admin"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              required
            />
            <button type="submit" className={styles.addBtn}>
              Add Admin
            </button>
          </form>

          <div className={styles.adminList}>
            {adminList.map((email) => (
              <div key={email} className={styles.adminItem}>
                <span className={styles.adminEmail}>{email}</span>
                {email !== currentUser?.email && (
                  <button onClick={() => handleRemoveAdmin(email)} className={styles.removeBtn}>
                    Remove
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminPanel;