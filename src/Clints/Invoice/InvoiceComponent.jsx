/* eslint-disable react-hooks/set-state-in-effect */
import html2pdf from 'html2pdf.js';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import footerImg from "../../assets/Footer.png";
import headerImg from "../../assets/header.png";
import watermarkImg from "../../assets/main-logo.png";

import {
  DEFAULT_NOTES,
  DEFAULT_PAYMENT_MODE,
  convertToWords
} from './invoiceConstants.js';

import {
  voidBill,
  fetchAllCompanies,
  fetchOffersByCompany,
  fetchSpecificOfferFromDb,
  resetInvoiceData,
  resetSaveStatus,
  saveBill,
  setFilterMode,
  setSubSourceFilter,
  updateBill
} from '../../Fetures/Inventory/InvoiceSlice.js';
import InvoiceFooter from '../../Pad/InvoiceFooter.jsx';
import InvoiceHeader from '../../Pad/InvoiceHeader.jsx';
import {
  isOfferPdfStorageSupported,
  requestOfferPdfDirectory,
  saveOfferRelatedPdf
} from '../../utils/offerPdfStorage';
import './InvoiceComponent.css';

const normalizeOfferDate = (value) => {
  const usDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value || '');
  if (!usDate) return value;

  const [, month, day, year] = usDate;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12));
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return value;
  }

  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
};

const InvoiceComponent = () => {
  const invoiceRef = useRef(null);
  const dispatch = useDispatch();

  const { 
    companiesList = [], 
    offersList = [], 
    challanData = null, 
    loadingCompanies = false, 
    loadingOffers = false, 
    loadingChallan = false,
    savingBill = false, 
    updatingBill = false, 
    deletingBill = false, 
    saveSuccess = false, 
    updateSuccess = false, 
    deleteSuccess = false, 
    savedBillIds: reduxSavedBillIds = null, 
    error: invoiceError = null,
    subSourceFilter = 'offers_only'
  } = useSelector((state) => state.invoice || state.challan || {});

  const { offerList: offerProductList = [], purchaseList: purchaseProductList = [] } = useSelector((state) => state.offer || {});

  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [isPdfPrinting, setIsPdfPrinting] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [manualInvoice, setManualInvoice] = useState(null);

  const [existingBillIds, setExistingBillIds] = useState(null);
  const [paidAmount, setPaidAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);
  const [showPaidAmount, setShowPaidAmount] = useState(true);
  const [showDueAmount, setShowDueAmount] = useState(true);

  const [activeSuggestionRow, setActiveSuggestionRow] = useState(null);

  const [editableHeader, setEditableHeader] = useState({
    invoiceNo: '',
    date: new Date().toLocaleDateString('en-GB'),
    toCompany: '',
    address: '',
    subject: 'Bill / Invoice for Goods & Services',
    purchaseOrderNo: ''
  });

  const [editableItems, setEditableItems] = useState([]);
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [paymentMode, setPaymentMode] = useState(DEFAULT_PAYMENT_MODE);
  const [showPaymentMode, setShowPaymentMode] = useState(true);
  const [localFilterType, setLocalFilterType] = useState('all');

  useEffect(() => {
    dispatch(fetchAllCompanies());
  }, [dispatch]);

  const mapChallanToState = useCallback((data, docId) => {
    if (!data) return;

    const matchedBill = data.matchedBill;
    const targetData = matchedBill || data;
    
    const headerInfo = targetData.headerData || data.headerData || {};

    const extractedInvoiceNo = 
      targetData.billNo || 
      targetData.offerNo || 
      headerInfo.offerNo || 
      headerInfo.billNo || 
      `INV-${Date.now().toString().slice(-6)}`;

    const sourceDate =
      targetData.date || 
      headerInfo.date || 
      new Date().toLocaleDateString('en-GB');
    const extractedDate = targetData.sourceType === 'offer'
      ? normalizeOfferDate(sourceDate)
      : sourceDate;

    const extractedCompany = 
      targetData.toCompany || 
      targetData.companyName || 
      headerInfo.toCompany || 
      headerInfo.companyName || 
      '';

    const extractedAddress = 
      targetData.address || 
      headerInfo.address || 
      '';

    const extractedSubject = 
      targetData.subject || 
      headerInfo.subject || 
      'Bill / Invoice for Goods & Services';

    const extractedPurchaseOrderNo =
      targetData.purchaseOrderNo ||
      headerInfo.purchaseOrderNo ||
      targetData.workOrderNo ||
      headerInfo.workOrderNo ||
      '';

    setEditableHeader({
      invoiceNo: extractedInvoiceNo,
      date: extractedDate,
      toCompany: extractedCompany,
      address: extractedAddress,
      subject: extractedSubject,
      purchaseOrderNo: extractedPurchaseOrderNo
    });

    const sourceItems = targetData.items || targetData.products || [];
    const formattedItems = sourceItems.map((item) => ({
      name: item.name || item.itemName || item.description || item.productName || '',
      quantity: parseFloat(item.quantity || item.qty || item.count) || 1,
      unit: item.unit || 'Pcs',
      price: parseFloat(item.price ?? item.unitPrice ?? item.rate ?? item.amount) || 0
    }));

    setEditableItems(formattedItems);
    setPaidAmount(parseFloat(targetData.paidAmount || targetData.receivedAmount) || 0);
    setDiscountAmount(Number(targetData.discountAmount) || 0);
    setShowDiscount(Number(targetData.discountAmount) > 0);
    setShowPaidAmount(targetData.showPaidAmount ?? true);
    setShowDueAmount(targetData.showDueAmount ?? true);

    if (Array.isArray(targetData.notes) && targetData.notes.length > 0) {
      setNotes(targetData.notes);
    } else {
      setNotes(DEFAULT_NOTES);
    }

    if (targetData.paymentMode) {
      if (Array.isArray(targetData.paymentMode)) {
        setPaymentMode(targetData.paymentMode);
      } else {
        setPaymentMode([
          targetData.paymentMode.mode,
          targetData.paymentMode.advance,
          targetData.paymentMode.handover
        ].filter(Boolean));
      }
    } else {
      setPaymentMode(DEFAULT_PAYMENT_MODE);
    }
    setShowPaymentMode(targetData.showPaymentMode ?? true);

    if (matchedBill || targetData.billNo || targetData.sourceType === 'bill') {
      setExistingBillIds({
        billId: targetData.id || docId,
        salesId: targetData.salesId || targetData.id || docId
      });
    } else {
      setExistingBillIds(null);
    }
  }, []);

  useEffect(() => {
    if (challanData && !manualInvoice) {
      mapChallanToState(challanData, selectedOfferId);
    }
  }, [challanData, manualInvoice, selectedOfferId, mapChallanToState]);

  const activeBillIds = reduxSavedBillIds || existingBillIds;

  const handleFilterTypeChange = (mode) => {
    setLocalFilterType(mode);
    dispatch(setFilterMode(mode));
    setSelectedCompany('');
    setSelectedOfferId('');
    setManualInvoice(null);
    setDiscountAmount(0);
    setShowDiscount(false);
    setShowPaidAmount(true);
    setShowDueAmount(true);
    dispatch(resetInvoiceData());
  };

  const handleSubSourceChange = (subSource) => {
    dispatch(setSubSourceFilter(subSource));
    setSelectedOfferId('');
    setManualInvoice(null);
    setDiscountAmount(0);
    setShowDiscount(false);
    setShowPaidAmount(true);
    setShowDueAmount(true);
    dispatch(resetInvoiceData());
    if (selectedCompany) {
      dispatch(fetchOffersByCompany({ 
        companyId: selectedCompany,
        filterMode: localFilterType,
        subSourceFilter: subSource 
      }));
    }
  };

  const handleCompanyChange = (e) => {
    const companyId = e.target.value;
    setSelectedCompany(companyId);
    setSelectedOfferId('');
    setManualInvoice(null);
    setEditableItems([]);
    setExistingBillIds(null);
    setPaidAmount(0);
    setDiscountAmount(0);
    setShowDiscount(false);
    setShowPaidAmount(true);
    setShowDueAmount(true);
    dispatch(resetInvoiceData());
    if (companyId) {
      dispatch(fetchOffersByCompany({
        companyId,
        filterMode: localFilterType,
        subSourceFilter
      }));
    }
  };

  const handleOfferChange = (e) => {
    const offerId = e.target.value;
    setSelectedOfferId(offerId);
    setManualInvoice(null);
    setExistingBillIds(null);
    setDiscountAmount(0);
    setShowDiscount(false);
    if (selectedCompany && offerId) {
      const selectedItem = offersList.find((item) => item.id === offerId);
      const sourceType = selectedItem?.sourceType || 'offer';

      dispatch(fetchSpecificOfferFromDb({ 
        offerId, 
        sourceType
      }));
    }
  };

  const handleReset = useCallback(() => {
    setSelectedCompany('');
    setSelectedOfferId('');
    setManualInvoice(null);
    setExistingBillIds(null);
    setPaidAmount(0);
    setDiscountAmount(0);
    setShowDiscount(false);
    setShowPaidAmount(true);
    setShowDueAmount(true);
    setEditableItems([]);
    setNotes(DEFAULT_NOTES);
    setPaymentMode(DEFAULT_PAYMENT_MODE);
    setShowPaymentMode(true);
    setEditableHeader({
      invoiceNo: '',
      date: new Date().toLocaleDateString('en-GB'),
      toCompany: '',
      address: '',
      subject: '',
      purchaseOrderNo: ''
    });
    dispatch(resetInvoiceData());
  }, [dispatch]);

  const handleCreateBlankInvoice = () => {
    setSelectedCompany('');
    setSelectedOfferId('');
    setManualInvoice(true);
    setExistingBillIds(null);
    setPaidAmount(0);
    setDiscountAmount(0);
    setShowDiscount(false);
    setShowPaidAmount(true);
    setShowDueAmount(true);
    setNotes(DEFAULT_NOTES);
    setPaymentMode(DEFAULT_PAYMENT_MODE);
    setShowPaymentMode(true);
    setEditableHeader({
      invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleDateString('en-GB'),
      toCompany: '',
      address: '',
      subject: 'Bill / Invoice for Goods & Services',
      purchaseOrderNo: ''
    });
    setEditableItems([{ name: 'Sample Item Name', quantity: 1, unit: 'Pcs', price: 0 }]);
    dispatch(resetInvoiceData());
  };

  const handleHeaderChange = (field, value) => setEditableHeader((prev) => ({ ...prev, [field]: value }));

  const handleItemChange = (index, field, value) => {
    setEditableItems((prevItems) => {
      const updated = [...prevItems];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const getProductName = (prod) => prod?.ItemsName || prod?.itemsName || prod?.name || prod?.title || '';
  const getProductPrice = (prod) => prod?.SalingPrice ?? prod?.salingPrice ?? prod?.SellingPrice ?? prod?.sellingPrice ?? prod?.price ?? 0;

  const handleSelectProduct = (index, selectedProduct) => {
    setEditableItems((prevItems) => {
      const updated = [...prevItems];
      updated[index] = {
        ...updated[index],
        name: getProductName(selectedProduct),
        unit: selectedProduct.unit || selectedProduct.Unit || updated[index]?.unit || 'Pcs',
        price: parseFloat(getProductPrice(selectedProduct)) || 0
      };
      return updated;
    });
    setActiveSuggestionRow(null);
  };

  const handleAddRow = () => setEditableItems((prev) => [...prev, { name: '', quantity: 1, unit: 'Pcs', price: 0 }]);
  const handleRemoveRow = (index) => setEditableItems((prev) => prev.filter((_, i) => i !== index));

  const handleNoteChange = (index, value) => {
    setNotes((prevNotes) => {
      const updated = [...prevNotes];
      updated[index] = value;
      return updated;
    });
  };
  const handleAddNote = () => setNotes((prev) => [...prev, 'New condition note...']);
  const handleRemoveNote = (index) => setNotes((prev) => prev.filter((_, i) => i !== index));

  const handlePaymentChange = (index, value) => {
    setPaymentMode((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleAddPaymentRow = () => setPaymentMode((prev) => [...prev, 'New payment condition...']);
  const handleRemovePaymentRow = (index) => setPaymentMode((prev) => prev.filter((_, i) => i !== index));

  const subtotal = useMemo(() => {
    return editableItems.reduce(
      (sum, item) => sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0),
      0
    );
  }, [editableItems]);

  const appliedDiscount = showDiscount
    ? Math.min(Math.max(Number(discountAmount) || 0, 0), subtotal)
    : 0;
  const grandTotal = subtotal - appliedDiscount;
  const currentPaid = parseFloat(paidAmount) || 0;
  const dueAmount = grandTotal - currentPaid;

  const buildBillPayload = useCallback(() => {
    const safePaid = Number(paidAmount) || 0;
    const safeGrandTotal = Number(grandTotal) || 0;
    const createdType = manualInvoice ? 'General' : 'offer_based';

    return {
      billNo: editableHeader.invoiceNo,
      companyId: selectedCompany || undefined,
      companyName: editableHeader.toCompany.trim(),
      toCompany: editableHeader.toCompany,
      address: editableHeader.address,
      subject: editableHeader.subject,
      purchaseOrderNo: editableHeader.purchaseOrderNo,
      date: editableHeader.date,
      items: editableItems,
      subtotal,
      discountAmount: appliedDiscount,
      grandTotal: safeGrandTotal,
      paidAmount: safePaid,
      dueAmount: safeGrandTotal - safePaid,
      showPaidAmount,
      showDueAmount,
      notes,
      paymentMode,
      showPaymentMode,
      isBlankCreated: Boolean(manualInvoice),
      createdType: createdType,
      offerId: selectedOfferId || null,
      createdAt: new Date().toISOString()
    };
  }, [paidAmount, grandTotal, subtotal, appliedDiscount, manualInvoice, editableHeader, editableItems, showPaidAmount, showDueAmount, notes, paymentMode, showPaymentMode, selectedOfferId, selectedCompany]);

  const handleSaveBill = () => {
    dispatch(saveBill(buildBillPayload()));
  };

  const handleUpdateBill = () => {
    if (!activeBillIds?.billId) {
      alert("Document ID not found. Save bill first.");
      return;
    }
    dispatch(updateBill({
      billId: activeBillIds.billId,
      billData: buildBillPayload()
    }));
  };

  const handleDeleteBill = () => {
    if (!activeBillIds?.billId) {
      alert("This bill hasn't been saved yet.");
      return;
    }
    if (window.confirm("Are you sure you want to delete this bill?")) {
      dispatch(voidBill(activeBillIds.billId));
    }
  };

  useEffect(() => {
    if (saveSuccess) {
      alert('Bill successfully saved!');
      dispatch(resetSaveStatus());
    } else if (updateSuccess) {
      alert('Bill successfully updated!');
      dispatch(resetSaveStatus());
    } else if (deleteSuccess) {
      alert('Bill successfully voided!');
      dispatch(resetSaveStatus());
      handleReset();
    }
  }, [saveSuccess, updateSuccess, deleteSuccess, dispatch, handleReset]);

  const handleDownloadPDF = () => {
    if (!isOfferPdfStorageSupported()) {
      alert('Saving to a selected folder requires Chrome or Edge with folder access enabled.');
      return;
    }

    const directoryHandlePromise = requestOfferPdfDirectory().then(
      (handle) => ({ handle }),
      (error) => ({ error })
    );
    const currentData = challanData || manualInvoice;
    const selectedDocument = offersList.find((item) => item.id === selectedOfferId);
    const offerId =
      selectedDocument?.offerNo ||
      currentData?.offerNo ||
      currentData?.billNo ||
      editableHeader.invoiceNo ||
      selectedOfferId;
    const filename = `Invoice_Bill_${editableHeader.invoiceNo || 'Draft'}.pdf`;
    setIsPdfPrinting(true);
    window.scrollTo(0, 0);

    setTimeout(() => {
      const element = invoiceRef.current;

      const options = {
        margin: [38, 10, 24, 10],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc) => {
            const pdfElement = clonedDoc.querySelector('.pdf-mode');
            if (pdfElement) {
              pdfElement.style.width = '100%';
              
              const headerComponent = pdfElement.querySelector('.invoice-header-component');
              if (headerComponent) {
                headerComponent.style.display = 'none';
              }

              const inputs = pdfElement.querySelectorAll('input, textarea');
              inputs.forEach((input) => {
                const span = clonedDoc.createElement('span');
                span.innerText = input.value || input.placeholder || '';
                span.style.display = 'inline-block';
                span.style.fontFamily = 'inherit';
                span.style.fontSize = window.getComputedStyle(input).fontSize;
                span.style.fontWeight = window.getComputedStyle(input).fontWeight;
                span.style.color = window.getComputedStyle(input).color;
                span.style.lineHeight = '1.35';
                span.style.paddingBottom = '1px';
                span.style.wordBreak = 'break-word';
                span.style.whiteSpace = 'pre-wrap';

                if (input.parentNode) {
                  input.parentNode.replaceChild(span, input);
                }
              });
            }
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: {
          mode: ['css', 'legacy'],
          avoid: ['.page-break-avoid', '.summary-container', '.invoice-footer']
        }
      };

      html2pdf()
        .from(element)
        .set(options)
        .toPdf()
        .get('pdf')
        .then((pdf) => {
          const totalPages = pdf.internal.getNumberOfPages();
          const hImg = new Image();
          const fImg = new Image();
          const wmImg = new Image();
          hImg.src = headerImg;
          fImg.src = footerImg;
          wmImg.src = watermarkImg;

          return new Promise((resolve) => {
            let loadedCount = 0;
            const checkLoaded = () => {
              loadedCount++;
              if (loadedCount === 3) {
                const hProps = pdf.getImageProperties(hImg);
                const fProps = pdf.getImageProperties(fImg);

                const hWidth = 200; // mm
                const hHeight = (hProps.height * hWidth) / hProps.width;

                const fWidth = 200; // mm
                const fHeight = (fProps.height * fWidth) / fProps.width;

                for (let i = 1; i <= totalPages; i++) {
                  pdf.setPage(i);

                  // Watermark in exact center of each page
                  const wmWidth = 85; // mm
                  const wmHeight = (wmImg.height * wmWidth) / wmImg.width;
                  const wmX = (210 - wmWidth) / 2;
                  const wmY = (297 - wmHeight) / 2;

                  pdf.saveGraphicsState();
                  if (pdf.setGState) {
                    pdf.setGState(new pdf.GState({ opacity: 0.05 }));
                  }
                  pdf.addImage(wmImg, 'PNG', wmX, wmY, wmWidth, wmHeight);
                  pdf.restoreGraphicsState();

                  // Header & Footer on every page
                  pdf.addImage(hImg, 'PNG', 5, 2, hWidth, hHeight);
                  pdf.addImage(fImg, 'PNG', 5, 297 - fHeight - 2, fWidth, fHeight);
                }
                resolve(pdf);
              }
            };

            hImg.onload = checkLoaded;
            fImg.onload = checkLoaded;
            wmImg.onload = checkLoaded;
            if (hImg.complete) checkLoaded();
            if (fImg.complete) checkLoaded();
            if (wmImg.complete) checkLoaded();
          });
        })
        .then(async (pdf) => {
          const directoryResult = await directoryHandlePromise;
          if (directoryResult.error) throw directoryResult.error;
          await saveOfferRelatedPdf(directoryResult.handle, pdf.output('blob'), {
            companyName: editableHeader.toCompany,
            offerId,
            fileName: filename
          });
          setIsPdfPrinting(false);
        })
        .catch((err) => {
          console.error('PDF generation error:', err);
          if (err.name !== 'AbortError') {
            alert(`Could not save the invoice PDF: ${err.message}`);
          }
          setIsPdfPrinting(false);
        });
    }, 200);
  };

  const currentActiveData = challanData || manualInvoice;

  return (
    <div className="main-wrapper" onClick={() => setActiveSuggestionRow(null)}>
      <div className="invoice-search-card no-print">
        <div className="filter-container">
          <span className="filter-title">🔍 Filter Category:</span>

          <label className={`filter-label ${localFilterType === 'all' ? 'active' : ''}`}>
            <input 
              type="radio" 
              name="filterType" 
              value="all" 
              checked={localFilterType === 'all'} 
              onChange={() => handleFilterTypeChange('all')} 
            />
            <span>All Data</span>
          </label>

          <label className={`filter-label ${localFilterType === 'offer_based' ? 'active' : ''}`}>
            <input 
              type="radio" 
              name="filterType" 
              value="offer_based" 
              checked={localFilterType === 'offer_based'} 
              onChange={() => handleFilterTypeChange('offer_based')} 
            />
            <span>🏷️ Offer Based</span>
          </label>

          <label className={`filter-label ${localFilterType === 'general' ? 'active' : ''}`}>
            <input 
              type="radio" 
              name="filterType" 
              value="general" 
              checked={localFilterType === 'general'} 
              onChange={() => handleFilterTypeChange('general')} 
            />
            <span>📄 General (Blank)</span>
          </label>
        </div>

        {localFilterType === 'offer_based' && (
          <div className="filter-container sub-filter-container">
            <span className="filter-title">📑 Select Source:</span>

            <label className={`filter-label ${subSourceFilter === 'offers_only' ? 'active' : ''}`}>
              <input 
                type="radio" 
                name="subSourceFilter" 
                value="offers_only" 
                checked={subSourceFilter === 'offers_only'} 
                onChange={() => handleSubSourceChange('offers_only')} 
              />
              <span>🏷️ Raw Offers</span>
            </label>

            <label className={`filter-label ${subSourceFilter === 'bills_only' ? 'active' : ''}`}>
              <input 
                type="radio" 
                name="subSourceFilter" 
                value="bills_only" 
                checked={subSourceFilter === 'bills_only'} 
                onChange={() => handleSubSourceChange('bills_only')} 
              />
              <span>🧾 Saved Bills</span>
            </label>
          </div>
        )}

        <div className="dropdown-filter-group">
          <div className="select-box">
            <label className="select-label">🏢 Select Company Name</label>
            <select value={selectedCompany} onChange={handleCompanyChange} className="select-dropdown" disabled={loadingCompanies}>
              <option value="">{loadingCompanies ? "Loading..." : "-- Choose Company --"}</option>
              {companiesList.map((comp) => (
                <option key={comp.id} value={comp.id}>{comp.displayName || comp.id}</option>
              ))}
            </select>
          </div>

          <div className="select-box">
            <label className="select-label">📄 Select Offer / Bill ID</label>
            <select value={selectedOfferId} onChange={handleOfferChange} className="select-dropdown" disabled={!selectedCompany || loadingOffers}>
              <option value="">{loadingOffers ? "Loading..." : "-- Choose Offer / Bill ID --"}</option>
              {offersList.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.displayLabel || offer.billNo || offer.id}
                </option>
              ))}
            </select>
          </div>

          <div className="select-box quick-actions-box">
            <label className="select-label">Quick Actions:</label>
            <div className="quick-actions-buttons">
              <button 
                type="button" 
                className="btn-save-bill btn-create-blank" 
                onClick={handleCreateBlankInvoice}
              >
                ➕ Create Blank
              </button>

              <button 
                type="button" 
                className="btn-save-bill btn-reset-action" 
                onClick={handleReset}
              >
                🔄 Reset
              </button>
            </div>
          </div>
        </div>

        {invoiceError && <p className="error-text invoice-error-text">{invoiceError}</p>}

        {currentActiveData && (
          <div className="action-buttons-wrap">
            {!activeBillIds && (
              <button className="btn-save-bill" onClick={handleSaveBill} disabled={savingBill}>
                {savingBill ? "💾 Saving ..." : "💾 Save Bill"}
              </button>
            )}

            {activeBillIds && (
              <button 
                className="btn-save-bill btn-update-bill" 
                onClick={handleUpdateBill} 
                disabled={updatingBill}
              >
                {updatingBill ? "✏️ Updating ..." : "✏️ Update Bill"}
              </button>
            )}

            {activeBillIds && (
              <button 
                className="btn-save-bill btn-delete-bill" 
                onClick={handleDeleteBill} 
                disabled={deletingBill}
              >
                {deletingBill ? "🗑️ Deleting ..." : "🗑️ Delete Bill"}
              </button>
            )}

            <button
              type="button"
              className={`btn-save-bill btn-signature-toggle ${showSignature ? 'signature-enabled' : ''}`}
              onClick={() => setShowSignature((visible) => !visible)}
              aria-pressed={showSignature}
            >
              {showSignature ? '✍️ Remove Signature' : '✍️ Add Signature'}
            </button>

            <button
              className="btn-download-pdf"
              onClick={handleDownloadPDF}
              disabled={isPdfPrinting}
              title="Choose the D: drive root the first time; PDFs are saved under Osan lift\\Company\\Offer ID."
            >
              {isPdfPrinting ? '⏳ Saving PDF...' : '📥 Download Invoice Bill (PDF)'}
            </button>
          </div>
        )}
      </div>

      {loadingChallan ? (
        <div className="no-data-placeholder">Loading Details....</div>
      ) : currentActiveData ? (
        <div className={`invoice-container ${isPdfPrinting ? 'pdf-mode' : ''}`} ref={invoiceRef}>
          <div className="invoice-content-wrap">
            <InvoiceHeader 
              isPdfPrinting={isPdfPrinting}
              editableHeader={editableHeader}
              handleHeaderChange={handleHeaderChange}
            />

            <table className="invoice-table">
              <thead>
                <tr>
                  <th className="table-col-sl">S.l No.</th>
                  <th className="table-col-desc">Items Description</th>
                  <th className="table-col-qty">Qty</th>
                  <th className="table-col-unit">Unit</th>
                  <th className="table-col-price">Price (BDT)</th>
                  <th className="table-col-total">Total (BDT)</th>
                  {!isPdfPrinting && <th className="no-print table-col-action">Action</th>}
                </tr>
              </thead>
              <tbody>
                {editableItems.length > 0 ? (
                  editableItems.map((item, index) => {
                    const itemTotal = (parseFloat(item.quantity) || 0) * (parseFloat(item.price) || 0);
                    return (
                      <tr key={index} className="page-break-avoid">
                        <td className="text-center">{index + 1}</td>
                        <td style={{ position: 'relative' }}>
                          {isPdfPrinting ? item.name : (
                            <>
                              <input 
                                type="text" 
                                className="table-input" 
                                value={item.name} 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSuggestionRow(index);
                                }}
                                onChange={(e) => {
                                  handleItemChange(index, 'name', e.target.value);
                                  setActiveSuggestionRow(index);
                                }} 
                              />

                              {activeSuggestionRow === index && item.name && item.name.trim().length > 0 && (() => {
                                const searchTerm = item.name.trim().toLowerCase();
                                const filteredOfferProds = offerProductList.filter((p) =>
                                  getProductName(p).toLowerCase().includes(searchTerm)
                                );
                                const filteredPurchaseProds = purchaseProductList.filter((p) =>
                                  getProductName(p).toLowerCase().includes(searchTerm)
                                );

                                if (filteredOfferProds.length === 0 && filteredPurchaseProds.length === 0) {
                                  return null;
                                }

                                return (
                                  <div
                                    className="suggestions-dropdown no-print"
                                    onClick={(e) => e.stopPropagation()}
                                    style={{
                                      position: 'absolute',
                                      top: '100%',
                                      left: 0,
                                      right: 0,
                                      backgroundColor: '#ffffff',
                                      border: '1px solid #ccc',
                                      borderRadius: '4px',
                                      boxShadow: '0px 4px 10px rgba(0,0,0,0.15)',
                                      zIndex: 999,
                                      maxHeight: '200px',
                                      overflowY: 'auto'
                                    }}
                                  >
                                    {filteredOfferProds.length > 0 && (
                                      <div style={{ padding: '4px 6px', borderBottom: '1px solid #eee' }}>
                                        <strong style={{ fontSize: '11px', color: '#2e7d32' }}>Offer Products</strong>
                                        {filteredOfferProds.map((prod, pIdx) => (
                                          <div
                                            key={`off-${prod.id || pIdx}`}
                                            style={{
                                              padding: '6px',
                                              cursor: 'pointer',
                                              borderBottom: '1px solid #f9f9f9',
                                              fontSize: '13px',
                                              color: '#2e7d32',
                                              fontWeight: '500',
                                              textAlign: 'left'
                                            }}
                                            onClick={() => handleSelectProduct(index, prod)}
                                          >
                                            {getProductName(prod)} ({getProductPrice(prod)} BDT)
                                          </div>
                                        ))}
                                      </div>
                                    )}

                                    {filteredPurchaseProds.length > 0 && (
                                      <div style={{ padding: '4px 6px' }}>
                                        <strong style={{ fontSize: '11px', color: '#1565c0' }}>Purchase Products</strong>
                                        {filteredPurchaseProds.map((prod, pIdx) => (
                                          <div
                                            key={`pur-${prod.id || pIdx}`}
                                            style={{
                                              padding: '6px',
                                              cursor: 'pointer',
                                              borderBottom: '1px solid #f9f9f9',
                                              fontSize: '13px',
                                              color: '#1565c0',
                                              fontWeight: '500',
                                              textAlign: 'left'
                                            }}
                                            onClick={() => handleSelectProduct(index, prod)}
                                          >
                                            {getProductName(prod)} — ({getProductPrice(prod)} BDT)
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </>
                          )}
                        </td>
                        <td className="text-center">
                          {isPdfPrinting ? item.quantity : (
                            <input type="number" className="table-input text-center" value={item.quantity} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} />
                          )}
                        </td>
                        <td className="text-center">
                          {isPdfPrinting ? item.unit : (
                            <input type="text" className="table-input text-center" value={item.unit} onChange={(e) => handleItemChange(index, 'unit', e.target.value)} />
                          )}
                        </td>
                        <td className="text-center">
                          {isPdfPrinting ? parseFloat(item.price || 0).toFixed(2) : (
                            <input type="number" className="table-input text-center" value={item.price} onChange={(e) => handleItemChange(index, 'price', e.target.value)} step="0.01" />
                          )}
                        </td>
                        <td className="text-center bold">
                          {itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        {!isPdfPrinting && (
                          <td className="text-center no-print">
                            <button type="button" className="btn-delete" onClick={() => handleRemoveRow(index)}>✕</button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={isPdfPrinting ? "6" : "7"} className="text-center empty-items-cell">
                      No items available.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                {showDiscount ? (
                  <>
                    <tr className="page-break-avoid">
                      <td colSpan="5" className="text-right bold">Subtotal:</td>
                      <td className="text-center bold">
                        {subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {!isPdfPrinting && <td className="no-print"></td>}
                    </tr>
                    <tr className="page-break-avoid">
                      <td colSpan="5" className="text-right bold">- Discount (BDT):</td>
                      <td className="text-center bold">
                        {isPdfPrinting ? (
                          `- ${appliedDiscount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        ) : (
                          <input
                            type="number"
                            className="table-input text-center"
                            aria-label="Discount amount in BDT"
                            min="0"
                            max={subtotal}
                            step="0.01"
                            value={discountAmount}
                            onChange={(e) => setDiscountAmount(e.target.value)}
                          />
                        )}
                      </td>
                      {!isPdfPrinting && <td className="no-print"></td>}
                    </tr>
                    <tr className="page-break-avoid">
                      <td colSpan="5" className="text-right bold">Net Total:</td>
                      <td className="text-center bold">
                        {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {!isPdfPrinting && <td className="no-print"></td>}
                    </tr>
                  </>
                ) : (
                  <tr className="page-break-avoid">
                    <td colSpan="5" className="text-right bold">Grand Total:</td>
                    <td className="text-center bold">
                      {grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {!isPdfPrinting && <td className="no-print"></td>}
                  </tr>
                )}

                {showPaidAmount && (
                  <tr className="page-break-avoid">
                    <td colSpan="5" className="text-right bold paid-amount-title">
                      <div className="amount-row-label">
                        <span>Paid / Advance Amount:</span>
                        {!isPdfPrinting && (
                          <button type="button" className="btn-delete no-print" onClick={() => setShowPaidAmount(false)}>
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-center bold">
                      {isPdfPrinting ? (
                        currentPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      ) : (
                        <input 
                          type="number" 
                          className="table-input text-center bold paid-amount-input" 
                          value={paidAmount} 
                          onChange={(e) => setPaidAmount(e.target.value === '' ? 0 : parseFloat(e.target.value))} 
                          step="0.01"
                        />
                      )}
                    </td>
                    {!isPdfPrinting && <td className="no-print"></td>}
                  </tr>
                )}

                {showDueAmount && (
                  <tr className="page-break-avoid">
                    <td colSpan="5" className="text-right bold due-amount-title">
                      <div className="amount-row-label">
                        <span>Net Due Amount:</span>
                        {!isPdfPrinting && (
                          <button type="button" className="btn-delete no-print" onClick={() => setShowDueAmount(false)}>
                            Remove
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="text-center bold due-amount-value">
                      {dueAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    {!isPdfPrinting && <td className="no-print"></td>}
                  </tr>
                )}
              </tfoot>
            </table>

            {!isPdfPrinting && (
              <div className="add-row-container no-print">
                {!showPaidAmount && (
                  <button type="button" className="btn-add-row amount-toggle-button" onClick={() => setShowPaidAmount(true)}>
                    + Add Paid / Advance Amount
                  </button>
                )}
                {!showDueAmount && (
                  <button type="button" className="btn-add-row amount-toggle-button" onClick={() => setShowDueAmount(true)}>
                    + Add Net Due Amount
                  </button>
                )}
                <button
                  type="button"
                  className="btn-add-row amount-toggle-button"
                  onClick={() => {
                    if (showDiscount) setDiscountAmount(0);
                    setShowDiscount(!showDiscount);
                  }}
                >
                  {showDiscount ? '− Remove Discount' : '+ Add Discount'}
                </button>
                <button className="btn-add-row" onClick={handleAddRow}>+ Add Item</button>
              </div>
            )}

            <div className="summary-container page-break-avoid">
              <div className="in-words-section">
                <strong>In Words: </strong> {convertToWords(grandTotal)}
              </div>

              <div className="notes-section">
                <div className="invoice-note-list">
                  {notes.map((note, index) => (
                    <div key={index} className="note-row">
                      <span className="note-label"><strong>Note {String(index + 1).padStart(2, '0')}- </strong></span>
                      {isPdfPrinting ? <span className="note-text">{note}</span> : (
                        <input type="text" className="inline-input note-input" value={note} onChange={(e) => handleNoteChange(index, e.target.value)} />
                      )}
                      {!isPdfPrinting && (
                        <button className="btn-delete no-print inline-delete" onClick={() => handleRemoveNote(index)}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
                {!isPdfPrinting && (
                  <div className="no-print add-note-box">
                    <button className="btn-add-note" onClick={handleAddNote}>+ Add Note</button>
                  </div>
                )}

                {/* Dynamic Payment Mode Section */}
                {showPaymentMode ? (
                  <div className="payment-mode">
                    <div className="payment-line">
                      <strong>Mode of Payment:</strong>
                      {!isPdfPrinting && (
                        <button
                          type="button"
                          className="btn-delete no-print"
                          onClick={() => setShowPaymentMode(false)}
                          style={{ marginLeft: '8px' }}
                        >
                          Remove Payment Mode
                        </button>
                      )}
                    </div>
                    {Array.isArray(paymentMode) && paymentMode.map((payment, index) => (
                      <div key={index} className="note-row" style={{ marginTop: '3px' }}>
                        <span className="note-label"><strong>{index + 1}. </strong></span>
                        {isPdfPrinting ? (
                          <span className="note-text">{payment}</span>
                        ) : (
                          <input
                            type="text"
                            className="inline-input note-input"
                            value={payment}
                            onChange={(e) => handlePaymentChange(index, e.target.value)}
                          />
                        )}
                        {!isPdfPrinting && (
                          <button className="btn-delete no-print inline-delete" onClick={() => handleRemovePaymentRow(index)}>✕</button>
                        )}
                      </div>
                    ))}
                    {!isPdfPrinting && (
                      <div className="no-print add-note-box" style={{ marginTop: '4px' }}>
                        <button className="btn-add-note" onClick={handleAddPaymentRow}>+ Add Payment Mode</button>
                      </div>
                    )}
                  </div>
                ) : !isPdfPrinting ? (
                  <div className="no-print add-note-box">
                    <button className="btn-add-note" onClick={() => setShowPaymentMode(true)}>
                      + Add Payment Mode
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <InvoiceFooter showSignature={showSignature} />
        </div>
      ) : (
        <div className="no-data-placeholder">
          <p>Please select a <strong>Company Name</strong> and an <strong>Offer / Bill ID</strong>, or click <strong>"Create Blank"</strong> to make a manual invoice.</p>
        </div>
      )}
    </div>
  );
};

export default InvoiceComponent;