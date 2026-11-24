import html2pdf from 'html2pdf.js';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';

import {
  addOrUpdateBill,
  deleteBillFromApi,
  deleteMonthBill,
  saveBillToApi
} from '../../Fetures/Inventory/ProjectsSlice';
import { fetchPurchaseProducts } from '../../Fetures/Inventory/OfferSlice';
import formatServicingDate from './formatServicingDate';

import './ProjectDetails.css';

const monthsList = [
  'January', 'February', 'March', 'April', 'May', 'June', 
  'July', 'August', 'September', 'October', 'November', 'December'
];

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [isExportingTable, setIsExportingTable] = useState(false);
  const tableRef = useRef(null);

  // Redux store থেকে বর্তমান ইউজারের ইমেইল বা তথ্য নেওয়া
  const currentUser = useSelector((state) => state.auth?.user || state.user?.currentUser || null);
  const userEmail = (currentUser?.email || '').trim().toLowerCase();
  const currentUserName =
    currentUser?.name ||
    userEmail;
  const purchaseProducts = useSelector((state) => state.offer?.purchaseList || []);
  const purchaseLoading = useSelector((state) => state.offer?.purchaseLoading || false);
  const purchaseError = useSelector((state) => state.offer?.purchaseError || null);
  const [showSparePartSuggestions, setShowSparePartSuggestions] = useState(false);
  const [isSavingBill, setIsSavingBill] = useState(false);

  useEffect(() => {
    dispatch(fetchPurchaseProducts());
  }, [dispatch]);

  const isAdminOrOwner = currentUser?.backendRole === 'ADMIN';

  const projects = useSelector((state) => state.project?.projects || state.projectDetails?.projects || []);
  const project = projects.find((p) => String(p.id) === String(id));

  const [showBillModal, setShowBillModal] = useState(false);

  const [billForm, setBillForm] = useState({
    month: 'January',
    servicingBill: '',
    sparePartsName: '',
    sparePartsStockId: '',
    sparePartsQuantity: 0,
    sparePartsUnitPrice: '',
    sparePartsBill: '',
    lastMonthDue: '',
    dueMonths: [],
    collectedBill: '',
    collectedBy: '',
    collectedByEmail: '',
    approvedBy: '',
    servicedBy: '',
    lastServicingDate: '',
    servicingStatus: 'Pending'
  });

  if (!project) {
    return (
      <div className="details-container">
        <div className="not-found-card">
          <h2>Project Not Found</h2>
          <p>Project ID: <strong>{id}</strong></p>
          <button className="btn btn-back" onClick={() => navigate(-1)}>
            ← Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const billList = project.billList || [];
  const defaultBillMonth = monthsList[new Date().getMonth()];

  const getPreviousMonthBill = (targetMonth) => {
    const targetMonthIndex = monthsList.indexOf(targetMonth);
    return billList
      .filter((bill) => {
        const billMonthIndex = monthsList.indexOf(bill.month);
        return billMonthIndex >= 0 && billMonthIndex < targetMonthIndex;
      })
      .sort((a, b) => monthsList.indexOf(b.month) - monthsList.indexOf(a.month))[0] || null;
  };

  const getPreviousMonthDue = (targetMonth) => {
    const targetMonthIndex = monthsList.indexOf(targetMonth);
    const previousBills = billList
      .filter((bill) => monthsList.indexOf(bill.month) >= 0 && monthsList.indexOf(bill.month) < targetMonthIndex)
      .sort((a, b) => monthsList.indexOf(a.month) - monthsList.indexOf(b.month));
    const dueBalances = [];

    previousBills.forEach((bill, index) => {
      if (index === 0) {
        const carriedDue = Number(bill.lastMonthDue) || 0;
        if (carriedDue > 0) {
          dueBalances.push({ month: 'Previous months', amount: carriedDue });
        }
      }

      const monthlyCharges = (Number(bill.servicingBill) || 0) + (Number(bill.sparePartsBill) || 0);
      if (monthlyCharges > 0) {
        dueBalances.push({ month: bill.month, amount: monthlyCharges });
      }

      let collection = Number(bill.collectedBill) || 0;
      for (const balance of dueBalances) {
        const paidAmount = Math.min(balance.amount, collection);
        balance.amount -= paidAmount;
        collection -= paidAmount;
        if (collection <= 0) break;
      }
    });

    const outstandingMonths = dueBalances.filter((balance) => balance.amount > 0);
    return {
      amount: outstandingMonths.reduce((total, balance) => total + balance.amount, 0),
      months: outstandingMonths
    };
  };

  const handleOpenMakeBill = (existingBill = null) => {
    setShowSparePartSuggestions(false);
    if (existingBill) {
      const previousDue = getPreviousMonthDue(existingBill.month);
      setBillForm({ 
        ...existingBill,
        lastMonthDue: previousDue.amount,
        dueMonths: previousDue.months,
        servicingBill: existingBill.servicingBill ?? '',
        sparePartsName: existingBill.sparePartsName || '',
        sparePartsStockId: existingBill.sparePartsStockId || '',
        sparePartsQuantity: existingBill.sparePartsQuantity ?? 0,
        sparePartsUnitPrice: existingBill.sparePartsUnitPrice ?? '',
        servicingStatus: existingBill.servicingStatus || 'Pending',
        collectedByEmail: existingBill.collectedByEmail || ''
      });
    } else {
      const previousDue = getPreviousMonthDue(defaultBillMonth);
      const previousBill = getPreviousMonthBill(defaultBillMonth);
      setBillForm({
        month: defaultBillMonth,
        servicingBill: previousBill?.servicingBill ?? '',
        sparePartsName: '',
        sparePartsStockId: '',
        sparePartsQuantity: 0,
        sparePartsUnitPrice: '',
        sparePartsBill: '',
        lastMonthDue: previousDue.amount,
        dueMonths: previousDue.months,
        collectedBill: '',
        collectedBy: '',
        collectedByEmail: '',
        approvedBy: '',
        servicedBy: '',
        lastServicingDate: '',
        servicingStatus: 'Pending'
      });
    }
    setShowBillModal(true);
  };

  const handleBillInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'sparePartsName') {
      setBillForm((previousForm) => ({
        ...previousForm,
        sparePartsName: value,
        sparePartsStockId: '',
        sparePartsQuantity: 0,
        sparePartsUnitPrice: '',
        sparePartsBill: '',
      }));
      setShowSparePartSuggestions(true);
      return;
    }

    if (name === 'sparePartsQuantity') {
      setBillForm((previousForm) => ({
        ...previousForm,
        sparePartsQuantity: value,
        sparePartsBill:
          (Number(value) || 0) * (Number(previousForm.sparePartsUnitPrice) || 0),
      }));
      return;
    }

    if (name === 'sparePartsUnitPrice') {
      setBillForm((previousForm) => ({
        ...previousForm,
        sparePartsUnitPrice: value,
        sparePartsBill:
          (Number(previousForm.sparePartsQuantity) || 0) * (Number(value) || 0),
      }));
      return;
    }

    if (name === 'month') {
      const previousDue = getPreviousMonthDue(value);
      const previousBill = getPreviousMonthBill(value);
      setBillForm((previousForm) => ({
        ...previousForm,
        month: value,
        servicingBill: previousBill?.servicingBill ?? '',
        lastMonthDue: previousDue.amount,
        dueMonths: previousDue.months
      }));
      return;
    }
    setBillForm((previousForm) => ({ ...previousForm, [name]: value }));
  };

  const getSparePartName = (product) =>
    String(product.ItemsName || product.itemsName || product.name || product.title || '');
  const getSparePartSellingPrice = (product) =>
    Number(
      product.SalingPrice ??
        product.salingPrice ??
        product.SellingPrice ??
        product.sellingPrice ??
        product.price ??
        0
    ) || 0;
  const sparePartSearchTerm = billForm.sparePartsName.trim().toLowerCase();
  const sparePartSuggestions = sparePartSearchTerm
    ? purchaseProducts
        .filter((product) =>
          getSparePartName(product).toLowerCase().includes(sparePartSearchTerm)
        )
        .slice(0, 8)
    : [];

  const handleSelectSparePart = (product) => {
    const name = getSparePartName(product);
    const unitPrice = getSparePartSellingPrice(product);
    const quantity = 1;
    setBillForm((previousForm) => ({
      ...previousForm,
      sparePartsName: name,
      sparePartsStockId: product.id || name.trim().toLowerCase(),
      sparePartsQuantity: quantity,
      sparePartsUnitPrice: unitPrice,
      sparePartsBill: unitPrice * quantity,
    }));
    setShowSparePartSuggestions(false);
  };

  const isCollectionApproved = Boolean(
    billForm.approvedBy?.trim() && billForm.approvedBy.trim() !== '-'
  );
  const canRemoveCollectionAttribution = isAdminOrOwner || (
    !isCollectionApproved &&
    Boolean(userEmail && billForm.collectedByEmail === userEmail)
  );

  const handleMarkCollected = () => {
    if (!userEmail || !currentUserName) {
      alert('Unable to identify the current user.');
      return;
    }

    if (billForm.collectedBy && billForm.collectedByEmail !== userEmail) {
      alert("You can't replace another user's collection attribution.");
      return;
    }

    setBillForm((previousForm) => ({
      ...previousForm,
      collectedBy: currentUserName,
      collectedByEmail: userEmail
    }));
  };

  const handleRemoveCollectedBy = () => {
    if (isCollectionApproved && !isAdminOrOwner) {
      alert('This collection is approved. Only an admin or owner can remove it.');
      return;
    }

    if (!canRemoveCollectionAttribution) {
      alert("You can only remove your own collection attribution.");
      return;
    }

    if (!window.confirm(`Remove ${billForm.collectedBy}'s collection attribution?`)) {
      return;
    }

    setBillForm((previousForm) => ({
      ...previousForm,
      collectedBy: '',
      collectedByEmail: ''
    }));
  };

  const handleDeleteBill = async (month) => {
    if (window.confirm(`Are you sure you want to delete the bill for ${month}?`)) {
      try {
        await dispatch(deleteBillFromApi({ projectId: project.id, month })).unwrap();
        dispatch(deleteMonthBill({ projectId: project.id, month }));
      } catch (error) {
        alert(`Failed to delete bill: ${error}`);
      }
    }
  };

  const handleBillSubmit = async (e) => {
    e.preventDefault();
    const sparePartsQuantity = Number(billForm.sparePartsQuantity) || 0;
    if (sparePartsQuantity > 0 && !billForm.sparePartsStockId) {
      alert('Please select a spare part from the stock suggestions before saving.');
      return;
    }
    if (sparePartsQuantity > 0) {
      alert('This bill cannot be saved with a stock quantity: the API has no atomic project-service-record and inventory-adjustment endpoint.');
      return;
    }

    const billData = {
      ...billForm,
      sparePartsQuantity,
      sparePartsUnitPrice: Number(billForm.sparePartsUnitPrice) || 0,
      sparePartsBill: Number(billForm.sparePartsBill) || 0,
      sparePartsStockDeducted: Boolean(billForm.sparePartsStockId && sparePartsQuantity > 0),
    };

    setIsSavingBill(true);
    try {
      await dispatch(saveBillToApi({ projectId: project.id, billData })).unwrap();
      dispatch(addOrUpdateBill({ projectId: project.id, billData }));
      setShowBillModal(false);
      setShowSparePartSuggestions(false);
    } catch (error) {
      alert(`Failed to save bill: ${error}`);
    } finally {
      setIsSavingBill(false);
    }
  };

  const handleGenerateBill = (bill) => {
    const previousDue = getPreviousMonthDue(bill.month);
    navigate('/service-bill', {
      state: {
        projectInfo: {
          id: project.id,
          projectName: project.projectName,
          address: project.address,
          phoneNo: project.phoneNo,
          whoseProjects: project.whoseProjects
        },
        billInfo: {
          ...bill,
          dueMonths: previousDue.months
        }
      }
    });
  };

  // Checklist Generate Handler
  const handleGenerateChecklist = (bill) => {
    navigate('/checklist', {
      state: {
        projectInfo: {
          id: project.id,
          projectName: project.projectName,
          address: project.address,
          phoneNo: project.phoneNo,
          whoseProjects: project.whoseProjects
        },
        billInfo: bill
      }
    });
  };

  const handleDownloadTablePDF = () => {
    if (!tableRef.current) {
      alert('Project details table is not available for export.');
      return;
    }

    setIsExportingTable(true);
    setTimeout(() => {
      html2pdf()
        .set({
          margin: 5,
          filename: `Project_Details_${project.projectName || 'Project'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, windowWidth: 1280 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        })
        .from(tableRef.current)
        .save()
        .then(() => setIsExportingTable(false))
        .catch((error) => {
          console.error('Project details PDF export failed:', error);
          alert('Could not download the project details PDF.');
          setIsExportingTable(false);
        });
    }, 100);
  };

  return (
    <div className="details-container">
      {/* Header Banner Section */}
      <div className="details-header">
        <div className="header-info">
          <h2>{project.projectName}</h2>
          <div className="meta-badges">
            <span className="meta-item"><strong>Client:</strong> {project.whoseProjects || 'N/A'}</span>
            <span className="meta-divider">•</span>
            <span className="meta-item"><strong>Address:</strong> {project.address || 'N/A'}</span>
            <span className="meta-divider">•</span>
            <span className="meta-item"><strong>Phone:</strong> {project.phoneNo || 'N/A'}</span>
          </div>
        </div>
        <div className="header-actions">
          <button className="btn btn-make-bill" onClick={() => handleOpenMakeBill()}>
            <span>＋</span> Create Bill
          </button>
          <button
            className="btn btn-download-table"
            onClick={handleDownloadTablePDF}
            disabled={isExportingTable}
          >
            {isExportingTable ? 'Preparing PDF...' : 'Download Table PDF'}
          </button>
          <button className="btn btn-back" onClick={() => navigate(-1)}>
            ← Back
          </button>
        </div>
      </div>

      {/* Main Billing Table */}
      <div
        className={`table-wrapper ${isExportingTable ? 'table-pdf-exporting' : ''}`}
        ref={tableRef}
      >
        {isExportingTable && <h3 className="table-pdf-title">{project.projectName} - Monthly Bills</h3>}
        <table className="project-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Date</th>
              <th>Status</th>
              <th>Servicing</th>
              <th>Spare Parts</th>
              <th>Last Due</th>
              <th>Total Bill</th>
              <th>Collected</th>
              <th>Due</th>
              <th>Collected By</th>
              <th>Approved By</th>
              <th>Serviced By</th>
              <th className={`text-center ${isExportingTable ? 'hide-in-table-pdf' : ''}`}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {billList.length === 0 ? (
              <tr>
                <td colSpan="13" className="no-data">
                  No monthly bills created for this project yet.
                </td>
              </tr>
            ) : (
              billList.map((bill, index) => {
                const sBill = Number(bill.servicingBill) || 0;
                const pBill = Number(bill.sparePartsBill) || 0;
                const lDue = Number(bill.lastMonthDue) || 0;
                const tBill = sBill + pBill + lDue;
                const cBill = Number(bill.collectedBill) || 0;
                const due = tBill - cBill;
                const status = bill.servicingStatus || 'Pending';

                return (
                  <tr key={index}>
                    <td className="font-bold month-col">{bill.month}</td>
                    <td>{formatServicingDate(bill.lastServicingDate || bill.servicingDate)}</td>
                    <td>
                      <span className={`status-badge ${status.toLowerCase() === 'complete' ? 'badge-complete' : 'badge-pending'}`}>
                        {status}
                      </span>
                    </td>
                    <td>৳ {sBill.toLocaleString('en-IN')}</td>
                    <td>৳ {pBill.toLocaleString('en-IN')}</td>
                    <td>৳ {lDue.toLocaleString('en-IN')}</td>
                    <td className="font-bold">৳ {tBill.toLocaleString('en-IN')}</td>
                    <td className="text-success font-bold">৳ {cBill.toLocaleString('en-IN')}</td>
                    <td className={due > 0 ? 'text-danger font-bold' : ''}>৳ {due.toLocaleString('en-IN')}</td>
                    <td>{bill.collectedBy || '-'}</td>
                    <td>{bill.approvedBy || '-'}</td>
                    <td>{bill.servicedBy || '-'}</td>
                    <td className={`action-buttons ${isExportingTable ? 'hide-in-table-pdf' : ''}`}>
                      <button className="btn-action btn-print" title="Generate Bill" onClick={() => handleGenerateBill(bill)}>
                        📄 Bill
                      </button>

                      <button className="btn-action btn-checklist" title="Generate Checklist" onClick={() => handleGenerateChecklist(bill)}>
                        📋 Checklist
                      </button>

                      <button className="btn-action btn-update" title="Update Bill" onClick={() => handleOpenMakeBill(bill)}>
                        🔄 Update
                      </button>

                      {isAdminOrOwner && (
                        <button className="btn-action btn-delete" title="Delete Bill" onClick={() => handleDeleteBill(bill.month)}>
                          🗑️ Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modern Modal Overlay */}
      {showBillModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{project.projectName} - {billForm.month} Bill</h3>
              <button className="close-btn" onClick={() => setShowBillModal(false)}>✕</button>
            </div>
            
            <form onSubmit={handleBillSubmit}>
              <div className="form-grid">
                <div className="input-field">
                  <label>Select Month</label>
                  <select name="month" value={billForm.month} onChange={handleBillInputChange}>
                    {monthsList.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                
                <div className="input-field">
                  <label>Servicing Date</label>
                  <input type="date" name="lastServicingDate" value={billForm.lastServicingDate} onChange={handleBillInputChange} />
                </div>
                
                <div className="input-field">
                  <label>Servicing Status</label>
                  <select name="servicingStatus" value={billForm.servicingStatus} onChange={handleBillInputChange}>
                    <option value="Pending">Pending</option>
                    <option value="Complete">Complete</option>
                  </select>
                </div>

                <div className="input-field">
                  <label>Servicing Bill (৳) - Auto from previous month</label>
                  <input type="number" placeholder="0.00" name="servicingBill" value={billForm.servicingBill} onChange={handleBillInputChange} />
                </div>

                <div className="input-field">
                  <label>Spare Parts Name</label>
                  <div className="spare-parts-field">
                    <input
                      type="text"
                      placeholder="Search spare parts in stock"
                      name="sparePartsName"
                      value={billForm.sparePartsName}
                      autoComplete="off"
                      onFocus={() => setShowSparePartSuggestions(true)}
                      onChange={handleBillInputChange}
                    />
                    {showSparePartSuggestions && sparePartSearchTerm && (
                      <div className="spare-parts-suggestions">
                        {sparePartSuggestions.length > 0 ? (
                          sparePartSuggestions.map((product) => (
                            <button
                              type="button"
                              className="spare-parts-suggestion"
                              key={product.id}
                              onClick={() => handleSelectSparePart(product)}
                            >
                              <span>{getSparePartName(product)}</span>
                              <small>
                                Selling: ৳ {getSparePartSellingPrice(product).toLocaleString('en-IN')}
                                {' · '}Stock: {Number(product.QTY ?? product.quantity) || 0}
                              </small>
                            </button>
                          ))
                        ) : (
                          <p className="spare-parts-no-match">
                            {purchaseError
                              ? `Could not load stock items: ${purchaseError}`
                              : purchaseLoading
                                ? 'Loading stock items...'
                                : 'No matching stock item.'}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="input-field">
                  <label>Spare Parts Quantity (Pcs)</label>
                  <input
                    type="number"
                    placeholder="0"
                    name="sparePartsQuantity"
                    min="0"
                    step="1"
                    value={billForm.sparePartsQuantity}
                    onChange={handleBillInputChange}
                  />
                </div>

                <div className="input-field">
                  <label>Spare Parts Bill (৳)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    name="sparePartsBill"
                    value={billForm.sparePartsBill}
                    readOnly={Boolean(billForm.sparePartsStockId)}
                    onChange={handleBillInputChange}
                  />
                </div>

                <div className="input-field">
                  <label>Last Month Due (৳)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    name="lastMonthDue"
                    value={billForm.lastMonthDue}
                    onChange={handleBillInputChange}
                  />
                  {billForm.dueMonths?.length > 0 && (
                    <small className="due-months">
                      Due from: {billForm.dueMonths.map(({ month, amount }) =>
                        `${month} (৳ ${Number(amount).toLocaleString('en-IN')})`
                      ).join(', ')}
                    </small>
                  )}
                  {billForm.dueMonths?.length === 0 && (
                    <small className="due-months">No previous month dues.</small>
                  )}
                </div>

                <div className="input-field">
                  <label>Collected Amount (৳)</label>
                  <input type="number" placeholder="0.00" name="collectedBill" value={billForm.collectedBill} onChange={handleBillInputChange} />
                </div>

                <div className="input-field">
                  <label>Collected By</label>
                  <div className="collection-controls">
                    <button
                      type="button"
                      className="btn btn-update"
                      onClick={handleMarkCollected}
                      disabled={
                        !currentUserName ||
                        Boolean(billForm.collectedBy && billForm.collectedByEmail !== userEmail)
                      }
                    >
                      {billForm.collectedBy || 'Collected'}
                    </button>
                    {billForm.collectedBy && canRemoveCollectionAttribution && (
                      <button
                        type="button"
                        className="btn btn-delete"
                        onClick={handleRemoveCollectedBy}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>

                <div className="input-field">
                  <label>Serviced By</label>
                  <input type="text" placeholder="Technician Name" name="servicedBy" value={billForm.servicedBy} onChange={handleBillInputChange} />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-cancel" onClick={() => setShowBillModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-save" disabled={isSavingBill}>
                  {isSavingBill ? 'Saving...' : 'Save & Sync'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;