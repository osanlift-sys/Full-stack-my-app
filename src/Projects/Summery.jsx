import html2pdf from 'html2pdf.js';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addNewProjectLocal,
  deleteProjectFromApi,
  fetchProjects,
  saveAllProjectsToApi,
  setSelectedMonth,
  setSelectedWhoseProject,
  updateProjectLocal
} from '../Fetures/Inventory/ProjectsSlice';
import './Summery.css';

const monthsList = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const Summery = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth || {});
  const isAdmin = user?.backendRole === "ADMIN";
  const currentUserEmail = (user?.email || "").trim().toLowerCase();
  const currentUserName = user?.name || currentUserEmail;
  
  // Current month বের করা (যেমন: October)
  const currentMonthName = new Date().toLocaleString('en-US', { month: 'long' });

  const { 
    projects = [], 
    selectedMonth, 
    selectedWhoseProject = 'All', 
    loading = false 
  } = useSelector((state) => state.project || {});

  // প্রথম লোড বা মাউন্ট হওয়ার সময় ফিল্টার মাস হিসেবে বর্তমান মাস সেট করা
  useEffect(() => {
    if (!selectedMonth || selectedMonth === 'All') {
      dispatch(setSelectedMonth(currentMonthName));
    }
  }, [dispatch, selectedMonth, currentMonthName]);

  const activeSelectedMonth = selectedMonth || currentMonthName;

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editingMonth, setEditingMonth] = useState(null);
  const [isSavingForm, setIsSavingForm] = useState(false);
  const [dueFilter, setDueFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPdfPrinting, setIsPdfPrinting] = useState(false);

  const tableRef = useRef(null);

  // Permission & Admin States
  const hasPermission = (featureKey, fallbackKey = "") => {
    if (user?.backendRole === "ADMIN") return true;
    if (user?.permissions?.[featureKey]) return true;
    if (fallbackKey && user?.permissions?.[fallbackKey]) return true;
    return false;
  };

  const initialFormState = {
    projectName: '',
    address: '',
    phoneNo: '',
    liftQty: '', 
    whoseProjects: '',
    servicingDate: '',
    servicingBill: '',
    sparePartsBill: '',
    lastMonthDue: '',
    collectedBill: '',
    collectedBy: '',
    approvedBy: '',
    approvedByEmail: '',
    servicedBy: ''
  };

  const [formData, setFormData] = useState(initialFormState);
  const canManageApproval =
    isAdmin &&
    (!formData.approvedBy || formData.approvedByEmail === currentUserEmail);

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleOpenAddModal = () => {
    if (!hasPermission('projects_action_add', 'canAddProjects')) {
      alert("You don't have permission to add new projects.");
      return;
    }
    setEditingId(null);
    setEditingMonth(null);
    setFormData(initialFormState);
    setShowModal(true);
  };

  const handleEdit = (proj) => {
    if (!hasPermission('projects_action_edit', 'canEditProjects')) {
      alert("You don't have permission to edit projects.");
      return;
    }
    setEditingId(proj.id);
    const currentBill = activeSelectedMonth === 'All'
      ? (proj.billList || [])[0] || {}
      : (proj.billList || []).find(b => b.month === activeSelectedMonth) || {};
    setEditingMonth(currentBill.month || (activeSelectedMonth === 'All' ? currentMonthName : activeSelectedMonth));

    setFormData({
      projectName: proj.projectName || '',
      address: proj.address || '',
      phoneNo: proj.phoneNo || '',
      liftQty: proj.liftQty || '',
      whoseProjects: proj.whoseProjects || '',
      servicingDate: currentBill.servicingDate || currentBill.lastServicingDate || proj.servicingDate || '',
      servicingBill: currentBill.servicingBill || '',
      sparePartsBill: currentBill.sparePartsBill || '',
      lastMonthDue: currentBill.lastMonthDue || '',
      collectedBill: currentBill.collectedBill || '',
      collectedBy: currentBill.collectedBy || '',
      approvedBy: currentBill.approvedBy || '',
      approvedByEmail: currentBill.approvedByEmail || '',
      servicedBy: currentBill.servicedBy || ''
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSavingForm) return;
    if (!formData.projectName.trim()) {
      alert('Project Name is required!');
      return;
    }
    if (!hasPermission('projects_action_save', 'canSaveProjects')) {
      alert("You don't have permission to save projects.");
      return;
    }

    let calculatedMonth = editingId && editingMonth
      ? editingMonth
      : activeSelectedMonth !== 'All' ? activeSelectedMonth : currentMonthName;
    if (!editingId && formData.servicingDate) {
      const dateObj = new Date(formData.servicingDate);
      if (!isNaN(dateObj.getTime())) {
        calculatedMonth = dateObj.toLocaleString('en-US', { month: 'long' });
      }
    }

    const payload = {
      ...formData,
      month: calculatedMonth
    };

    setIsSavingForm(true);
    try {
      if (editingId) {
        dispatch(updateProjectLocal({ id: editingId, ...payload }));
      } else {
        dispatch(addNewProjectLocal(payload));
      }

      await dispatch(saveAllProjectsToApi()).unwrap();
      alert('Project saved successfully!');
      setShowModal(false);
      setEditingId(null);
      setEditingMonth(null);
      setFormData(initialFormState);
    } catch (error) {
      alert(`Save failed: ${error instanceof Error ? error.message : String(error)}.`);
      setShowModal(false);
      setEditingId(null);
      setEditingMonth(null);
      setFormData(initialFormState);
    } finally {
      setIsSavingForm(false);
    }
  };

  const handleSaveToApi = () => {
    if (!hasPermission('projects_action_save', 'canSaveProjects')) {
      alert("You don't have permission to save projects.");
      return;
    }
    dispatch(saveAllProjectsToApi())
      .unwrap()
      .then(() => alert('All projects saved successfully!'))
      .catch((err) => alert('Save failed: ' + err));
  };

  const handleDelete = (id, name) => {
    if (!hasPermission('projects_action_delete', 'canDeleteProjects')) {
      alert("You don't have permission to delete projects.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete: ${name}?`)) {
      dispatch(deleteProjectFromApi(id))
        .unwrap()
        .catch((error) => alert(error));
    }
  };

  // PDF Download Handler Function
  const downloadSummaryPDF = () => {
    if (!tableRef || !tableRef.current) {
      console.error('Table element reference not found.');
      return;
    }

    setIsPdfPrinting(true);

    setTimeout(() => {
      const element = tableRef.current;
      const pdfOptions = {
        margin: [8, 8, 8, 8],
        filename: `Project_Summary_${activeSelectedMonth}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 1280 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
      };

      html2pdf()
        .set(pdfOptions)
        .from(element)
        .save()
        .then(() => {
          setIsPdfPrinting(false);
        })
        .catch((err) => {
          console.error('PDF Generation Error:', err);
          setIsPdfPrinting(false);
        });
    }, 150);
  };

  const availableWhoseProjects = ['All', ...new Set(projects.map(p => p.whoseProjects).filter(Boolean))];

  const filteredProjects = projects.filter((proj) => {
    const matchesWhose = selectedWhoseProject === 'All' || proj.whoseProjects === selectedWhoseProject;
    if (!matchesWhose) return false;

    // Search filter check
    const term = searchTerm.toLowerCase();
    const name = (proj.projectName || '').toLowerCase();
    if (term && !name.includes(term)) return false;

    const filteredBills = (proj.billList || []).filter(
      b => activeSelectedMonth === 'All' || b.month === activeSelectedMonth
    );
    if (activeSelectedMonth !== 'All' && filteredBills.length === 0) return false;

    const bill = filteredBills[0] || {};
    const servicingBill = Number(bill.servicingBill) || 0;
    const sparePartsBill = Number(bill.sparePartsBill) || 0;
    const lastMonthDue = Number(bill.lastMonthDue) || 0;
    const totalBill = servicingBill + sparePartsBill + lastMonthDue;
    const collectedBill = Number(bill.collectedBill) || 0;
    const totalDue = totalBill - collectedBill;

    if (dueFilter === 'WithDue') {
      return totalDue > 0;
    } else if (dueFilter === 'NoDue') {
      return totalDue <= 0;
    }

    return true;
  });

  const totals = filteredProjects.reduce((acc, proj) => {
    const filteredBills = (proj.billList || []).filter(
      b => activeSelectedMonth === 'All' || b.month === activeSelectedMonth
    );
    const bill = filteredBills[0] || {};

    const sBill = Number(bill.servicingBill) || 0;
    const pBill = Number(bill.sparePartsBill) || 0;
    const lDue = Number(bill.lastMonthDue) || 0;
    const tBill = sBill + pBill + lDue;
    const cBill = Number(bill.collectedBill) || 0;
    const tDue = tBill - cBill;

    acc.liftQty += Number(proj.liftQty) || 0;
    acc.servicingBill += sBill;
    acc.sparePartsBill += pBill;
    acc.lastMonthDue += lDue;
    acc.totalBill += tBill;
    acc.collectedBill += cBill;
    acc.totalDue += tDue;

    return acc;
  }, {
    liftQty: 0,
    servicingBill: 0,
    sparePartsBill: 0,
    lastMonthDue: 0,
    totalBill: 0,
    collectedBill: 0,
    totalDue: 0
  });

  const collectorSummary = filteredProjects.reduce((acc, proj) => {
    const filteredBills = (proj.billList || []).filter(
      b => activeSelectedMonth === 'All' || b.month === activeSelectedMonth
    );

    filteredBills.forEach(bill => {
      const amount = Number(bill.collectedBill) || 0;
      const collector = (bill.collectedBy && bill.collectedBy.trim()) ? bill.collectedBy.trim() : 'Unspecified';

      if (amount > 0) {
        acc[collector] = (acc[collector] || 0) + amount;
      }
    });

    return acc;
  }, {});

  const approverSummary = filteredProjects.reduce((acc, proj) => {
    const filteredBills = (proj.billList || []).filter(
      b => activeSelectedMonth === 'All' || b.month === activeSelectedMonth
    );

    filteredBills.forEach(bill => {
      const amount = Number(bill.collectedBill) || 0;
      const approver = bill.approvedBy && bill.approvedBy.trim() && bill.approvedBy.trim() !== '-'
        ? bill.approvedBy.trim()
        : null;

      if (approver && amount > 0) {
        acc[approver] = (acc[approver] || 0) + amount;
      }
    });

    return acc;
  }, {});

  const totalReceivedAmount = Object.values(collectorSummary).reduce(
    (total, amount) => total + amount,
    0
  );
  const totalApprovedAmount = Object.values(approverSummary).reduce(
    (total, amount) => total + amount,
    0
  );

  return (
    <div className="project-container">
      <style>{`
        ${isPdfPrinting ? `
          .project-container {
            background-color: #ffffff !important;
            color: #000000 !important;
          }
          .table-wrapper {
            background-color: #ffffff !important;
            border: none !important;
            box-shadow: none !important;
            overflow: visible !important;
          }
          .summary-cards-container {
            order: 2 !important;
            margin-top: 16px !important;
          }
          .summary-export-container > .table-wrapper {
            order: 1 !important;
          }
          .summary-export-container > .action-group {
            display: none !important;
          }
          .summary-search-row {
            display: none !important;
          }
          .summary-card {
            background-color: #ffffff !important;
            color: #000000 !important;
            border: 1px solid #cbd5e1 !important;
            backdrop-filter: none !important;
            padding: 10px !important;
          }
          .summary-card h4,
          .summary-card p,
          .summary-card .person-label,
          .summary-card strong {
            color: #000000 !important;
          }
          .summary-badge {
            background-color: #f8fafc !important;
            border: 1px solid #cbd5e1 !important;
          }
          .project-table th {
            background-color: #f1f5f9 !important;
            color: #000000 !important;
            border: 1px solid #cbd5e1 !important;
            padding: 6px !important;
            font-size: 9px !important;
          }
          .project-table td {
            color: #000000 !important;
            border: 1px solid #cbd5e1 !important;
            padding: 6px !important;
            font-size: 9px !important;
          }
          .project-table tr:hover {
            background-color: transparent !important;
          }
          .total-row {
            background-color: #f8fafc !important;
            color: #000000 !important;
            font-weight: bold !important;
          }
          .total-row td {
            color: #000000 !important;
          }
          .text-danger {
            color: #dc2626 !important;
          }
          .hide-on-pdf {
            display: none !important;
          }
        ` : ''}
      `}</style>

      <div className="header-bar">
        <h2>Projects & Bills Accounts</h2>
      </div>

      <div className="summary-export-container" ref={tableRef}>
      <div className="table-wrapper">
        <div style={{ padding: isPdfPrinting ? '10px' : '0' }}>
          {isPdfPrinting && (
            <h3 style={{ textAlign: 'center', marginBottom: '12px', color: '#000000', fontSize: '14px', fontWeight: 'bold' }}>
              Project Summary Report - {activeSelectedMonth}
            </h3>
          )}
          <table className="project-table" style={{ width: 'max-content', minWidth: '100%' }}>
            <thead>
              <tr>
                <th className="text-center">Sl</th>
                <th>Project Name</th>
                <th className="text-center">Whose</th>
                <th className="text-center">Lift Qty</th>
                <th className="text-center">Serv. Bill</th>
                <th className="text-center">Spare</th>
                <th className="text-center">Last Due</th>
                <th className="text-center">Total Bill</th>
                <th className="text-center">Collected</th>
                <th className="text-center">Total Due</th>
                <th className="text-center">Coll. By</th>
                <th className="text-center">Approve</th>
                <th className={`text-center ${isPdfPrinting ? 'hide-on-pdf' : ''}`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.length === 0 ? (
                <tr><td colSpan="13" className="text-center" style={{ padding: '30px', color: '#64748b' }}>No projects found[cite: 7].</td></tr>
              ) : (
                filteredProjects.map((proj, idx) => {
                  const filteredBills = (proj.billList || []).filter(
                    b => activeSelectedMonth === 'All' || b.month === activeSelectedMonth
                  );

                  const bill = filteredBills[0] || {};
                  const servicingBill = Number(bill.servicingBill) || 0;
                  const sparePartsBill = Number(bill.sparePartsBill) || 0;
                  const lastMonthDue = Number(bill.lastMonthDue) || 0;
                  const totalBill = servicingBill + sparePartsBill + lastMonthDue;
                  const collectedBill = Number(bill.collectedBill) || 0;
                  const totalDue = totalBill - collectedBill;

                  const canEdit = hasPermission('projects_action_edit', 'canEditProjects');
                  const canDelete = hasPermission('projects_action_delete', 'canDeleteProjects');

                  return (
                    <tr key={proj.id || idx}>
                      <td className="text-center">{idx + 1}</td>
                      <td><strong style={{ color: isPdfPrinting ? '#000000' : '#f8fafc' }}>{proj.projectName}</strong></td>
                      <td className="text-center">{proj.whoseProjects || '-'}</td>
                      <td className="text-center">{proj.liftQty}</td>
                      <td className="text-center">{servicingBill.toLocaleString()}</td>
                      <td className="text-center">{sparePartsBill.toLocaleString()}</td>
                      <td className="text-center">{lastMonthDue.toLocaleString()}</td>
                      <td className="text-center bold">{totalBill.toLocaleString()}</td>
                      <td className="text-center">{collectedBill.toLocaleString()}</td>
                      <td className="text-center bold text-danger">{totalDue.toLocaleString()}</td>
                      <td className="text-center">{bill.collectedBy || '-'}</td>
                      <td className="text-center">{bill.approvedBy || '-'}</td>
                      <td 
                        style={{ textAlign: 'center', padding: '6px 2px' }}
                        className={`${isPdfPrinting ? 'hide-on-pdf' : ''}`}
                      >
                        <div style={{ display: 'inline-flex', gap: '4px', justifyContent: 'center', alignItems: 'center' }}>
                          {canEdit && (
                            <button 
                              className="btn-edit" 
                              onClick={() => handleEdit(proj)}
                              style={{ padding: '3px 7px', fontSize: '11px', whiteSpace: 'nowrap' }}
                            >
                              Edit
                            </button>
                          )}
                          {canDelete && (
                            <button 
                              className="btn-delete" 
                              onClick={() => handleDelete(proj.id, proj.projectName)}
                              style={{ padding: '3px 7px', fontSize: '11px', whiteSpace: 'nowrap' }}
                            >
                              Delete
                            </button>
                          )}
                          {!canEdit && !canDelete && (
                            <span style={{ fontSize: '11px', color: '#64748b' }}>Read Only[cite: 7]</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {filteredProjects.length > 0 && (
              <tfoot>
                <tr className="total-row">
                  <td colSpan="3" className="text-center">Total:</td>
                  <td className="text-center">{totals.liftQty.toLocaleString()}</td>
                  <td className="text-center">{totals.servicingBill.toLocaleString()}</td>
                  <td className="text-center">{totals.sparePartsBill.toLocaleString()}</td>
                  <td className="text-center">{totals.lastMonthDue.toLocaleString()}</td>
                  <td className="text-center">{totals.totalBill.toLocaleString()}</td>
                  <td className="text-center">{totals.collectedBill.toLocaleString()}</td>
                  <td className="text-center text-danger">{totals.totalDue.toLocaleString()}</td>
                  <td colSpan={isPdfPrinting ? "2" : "3"}></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
      <div className="summary-cards-container">
        <div className="summary-card">
          <h4>💳 Received Amount Summary:</h4>
          <p className="collector-amount">
            Total Received: <strong>{totalReceivedAmount.toLocaleString()} Tk</strong>
          </p>
          <div className="summary-badge-group">
            {Object.keys(collectorSummary).length === 0 ? (
              <span className="no-summary-text">No collections found[cite: 7].</span>
            ) : (
              Object.entries(collectorSummary).map(([person, amount]) => (
                <div key={person} className="summary-badge collector-badge">
                  <span className="person-label">{person}: </span>
                  <strong className="collector-amount">{amount.toLocaleString()} Tk</strong>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="summary-card">
          <h4>✅ Approved Amount Summary:</h4>
          <p className="approver-amount">
            Total Approved: <strong>{totalApprovedAmount.toLocaleString()} Tk</strong>
          </p>
          <div className="summary-badge-group">
            {Object.keys(approverSummary).length === 0 ? (
              <span className="no-summary-text">No approvals found[cite: 7].</span>
            ) : (
              Object.entries(approverSummary).map(([person, amount]) => (
                <div key={person} className="summary-badge approver-badge">
                  <span className="person-label">{person}: </span>
                  <strong className="approver-amount">{amount.toLocaleString()} Tk</strong>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      <div className="action-group">
          <div className="filter-box">
            <label>Filter Month:</label>
            <select value={activeSelectedMonth} onChange={(e) => dispatch(setSelectedMonth(e.target.value))}>
              {monthsList.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="filter-box">
            <label>Whose Project:</label>
            <select value={selectedWhoseProject} onChange={(e) => dispatch(setSelectedWhoseProject(e.target.value))}>
              {availableWhoseProjects.map(wp => <option key={wp} value={wp}>{wp}</option>)}
            </select>
          </div>

          <div className="filter-box">
            <label>Due Status:</label>
            <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value)}>
              <option value="All">All Projects</option>
              <option value="WithDue">With Due Only</option>
              <option value="NoDue">Paid / No Due</option>
            </select>
          </div>

          <button className="btn btn-add" onClick={downloadSummaryPDF} disabled={isPdfPrinting}>
            {isPdfPrinting ? 'Generating PDF...' : '📄 Download PDF'}
          </button>

          {hasPermission('projects_action_add', 'canAddProjects') && (
            <button className="btn btn-add" onClick={handleOpenAddModal}>+ Add New Project</button>
          )}

          {hasPermission('projects_action_save', 'canSaveProjects') && (
            <button className="btn btn-save" onClick={handleSaveToApi} disabled={loading}>
              {loading ? 'Saving...' : '💾 Save'}
            </button>
          )}
      </div>
      <div className="summary-search-row">
        <input
          className="summary-search-input"
          type="text"
          placeholder="🔍 Search project name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>{editingId ? 'Edit Project' : 'Add New Project'}[cite: 7]</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="input-group">
                  <label htmlFor="projectName">Project Name *:</label>
                  <input
                    id="projectName"
                    type="text"
                    name="projectName"
                    value={formData.projectName}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="projectAddress">Project Address:</label>
                  <input
                    id="projectAddress"
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="projectPhone">Phone Number:</label>
                  <input
                    id="projectPhone"
                    type="tel"
                    name="phoneNo"
                    value={formData.phoneNo}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="liftQty">Lift Quantity:</label>
                  <input
                    id="liftQty"
                    type="number"
                    name="liftQty"
                    value={formData.liftQty}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="whoseProjects">Project Owner / Client:</label>
                  <input
                    id="whoseProjects"
                    type="text"
                    name="whoseProjects"
                    value={formData.whoseProjects}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="servicingDate">Servicing Date / Month:</label>
                  <input 
                    id="servicingDate"
                    type="date" 
                    name="servicingDate" 
                    value={formData.servicingDate} 
                    onChange={handleInputChange} 
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="servicingBill">Servicing Bill:</label>
                  <input
                    id="servicingBill"
                    type="number"
                    name="servicingBill"
                    value={formData.servicingBill}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="sparePartsBill">Spare Parts Bill:</label>
                  <input
                    id="sparePartsBill"
                    type="number"
                    name="sparePartsBill"
                    value={formData.sparePartsBill}
                    onChange={handleInputChange}
                  />
                </div>
                <div className="input-group">
                  <label htmlFor="lastMonthDue">Last Month Due:</label>
                  <input
                    id="lastMonthDue"
                    type="number"
                    name="lastMonthDue"
                    value={formData.lastMonthDue}
                    onChange={handleInputChange}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px', gridColumn: '1 / -1' }}>
                  <button
                    type="button"
                    className="btn btn-add"
                    disabled={!canManageApproval}
                    onClick={() => {
                      if (!isAdmin) {
                        alert('Only an owner or admin can approve this project.');
                        return;
                      }
                      if (!canManageApproval) {
                        alert('Only the admin who approved this project can change or remove the approval.');
                        return;
                      }
                      if (!currentUserName || !currentUserEmail) {
                        alert('Unable to identify the current user.');
                        return;
                      }
                      setFormData((previousFormData) => ({
                        ...previousFormData,
                        approvedBy: currentUserName,
                        approvedByEmail: currentUserEmail
                      }));
                    }}
                  >
                    {formData.approvedBy || 'Approved By'}
                  </button>
                  {formData.approvedBy &&
                    isAdmin &&
                    formData.approvedByEmail === currentUserEmail && (
                    <button
                      type="button"
                      className="btn btn-cancel"
                      onClick={() => setFormData((previousFormData) => ({
                        ...previousFormData,
                        approvedBy: '',
                        approvedByEmail: ''
                      }))}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="input-group">
                  <label htmlFor="servicedBy">Serviced By:</label>
                  <input
                    id="servicedBy"
                    type="text"
                    name="servicedBy"
                    value={formData.servicedBy}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn btn-add" disabled={isSavingForm}>
                  {isSavingForm ? 'Saving...' : editingId ? 'Update Project' : 'Add Project'}
                </button>
                <button
                  type="button"
                  className="btn btn-cancel"
                  onClick={() => {
                    setShowModal(false);
                    setEditingId(null);
                    setEditingMonth(null);
                  }}
                >
                  Cancel[cite: 7]
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Summery;