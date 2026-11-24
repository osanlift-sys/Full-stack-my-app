import html2pdf from 'html2pdf.js';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import footer from "../../assets/Footer.png";
import header from "../../assets/header.png";
import watermark from "../../assets/main-logo.png";
import seal from "../../assets/Seal.png";
import signature from "../../assets/signature.png";
import {
  deleteOffer,
  fetchAllSavedOffers,
  fetchOfferProducts,
  fetchPurchaseProducts,
  resetFormState,
  saveOffer,
  setSavedOfferInfo,
  updateOffer
} from '../../Fetures/Inventory/OfferSlice';
import {
  isOfferPdfStorageSupported,
  requestOfferPdfDirectory,
  saveOfferRelatedPdf
} from '../../utils/offerPdfStorage';
import styles from './OfferInvoice.module.css';

const OfferInvoice = () => {
  const invoiceRef = useRef(null);
  const dispatch = useDispatch();

  const {
    loading: isSaving,
    isUpdating,
    isDeleting,
    savedOfferInfo,
    allSavedOffers = [],
    offerList: offerProductList = [],
    purchaseList: purchaseProductList = []
  } = useSelector((state) => state.offer);

  const [isPdfPrinting, setIsPdfPrinting] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [activeSuggestionRow, setActiveSuggestionRow] = useState(null);
  const [selectedCompany, setSelectedCompany] = useState('');

  const defaultHeader = {
    date: new Date().toLocaleDateString('en-US'),
    toCompany: '',
    address: '',
    subject: ''
  };

  const [items, setItems] = useState([
    { name: '', quantity: 1, unit: 'Pcs', price: 0 }
  ]);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [showDiscount, setShowDiscount] = useState(false);

  const [headerData, setHeaderData] = useState(defaultHeader);

  const [notes, setNotes] = useState([
    'This offers excluding vat, tax.',
    'One-year Warranty. Without high voltage, earthquake, water fall. .',
    
  ]);

  const [paymentMode, setPaymentMode] = useState({
    mode: 'Payment by cash.',
    advance: '80% advanced.',
    handover: '20% handover date.'
  });

  useEffect(() => {
    dispatch(fetchOfferProducts());
    dispatch(fetchPurchaseProducts());
    dispatch(fetchAllSavedOffers());
  }, [dispatch]);

  const uniqueCompanies = Array.from(
    new Set(allSavedOffers.map((off) => off.headerData?.toCompany || off.companyName))
  ).filter(Boolean);

  const filteredOffers = selectedCompany
    ? allSavedOffers.filter(
        (off) =>
          (off.headerData?.toCompany || off.companyName) === selectedCompany
      )
    : allSavedOffers;

  const handleCompanyChange = (e) => {
    const comp = e.target.value;
    setSelectedCompany(comp);
    dispatch(resetFormState());
    setHeaderData(defaultHeader);
    setItems([{ name: '', quantity: 1, unit: 'Pcs', price: 0 }]);
    setDiscountAmount(0);
    setShowDiscount(false);
  };

  const handleSelectSavedOffer = (e) => {
    const selectedDocId = e.target.value;

    if (!selectedDocId) {
      dispatch(resetFormState());
      setHeaderData(defaultHeader);
      setItems([{ name: '', quantity: 1, unit: 'Pcs', price: 0 }]);
      setDiscountAmount(0);
      setShowDiscount(false);
      return;
    }

    const offerData = allSavedOffers.find((item) => item.docId === selectedDocId);

    if (offerData) {
      const rawCompName = offerData.companyName || offerData.headerData?.toCompany || "Unassigned_Company";
      const cleanCompKey = rawCompName.trim().replace(/\s+/g, '_');
      
      dispatch(setSavedOfferInfo({
        companyId: offerData.companyId,
        companyName: cleanCompKey,
        id: offerData.id,
        offerNo: offerData.offerNo || offerData.docId
      }));
      setHeaderData(offerData.headerData || defaultHeader);
      
      if (offerData.items && Array.isArray(offerData.items)) {
        setItems(offerData.items.map((i) => ({ ...i })));
      } else {
        setItems([{ name: '', quantity: 1, unit: 'Pcs', price: 0 }]);
      }
      setDiscountAmount(Number(offerData.discountAmount) || 0);
      setShowDiscount(Number(offerData.discountAmount) > 0);

      if (offerData.notes && Array.isArray(offerData.notes)) {
        setNotes([...offerData.notes]);
      }
      
      setPaymentMode(offerData.paymentMode || {});

      if (offerData.headerData?.toCompany) {
        setSelectedCompany(offerData.headerData.toCompany);
      }
    }
  };

  const subtotal = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0),
    0
  );
  const appliedDiscount = showDiscount
    ? Math.min(Math.max(Number(discountAmount) || 0, 0), subtotal)
    : 0;
  const grandTotal = subtotal - appliedDiscount;

  const handleHeaderChange = (e) => {
    setHeaderData({ ...headerData, [e.target.name]: e.target.value });
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = items.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setItems(updatedItems);
  };

  const getProductName = (prod) => {
    return prod?.ItemsName || prod?.itemsName || prod?.name || prod?.title || '';
  };

  const getProductPrice = (prod) => {
    return prod?.SalingPrice ?? prod?.salingPrice ?? prod?.SellingPrice ?? prod?.sellingPrice ?? prod?.price ?? 0;
  };

  const handleSelectProduct = (index, selectedProduct) => {
    const updatedItems = items.map((item, i) => {
      if (i === index) {
        return {
          ...item,
          name: getProductName(selectedProduct),
          unit: selectedProduct.unit || selectedProduct.Unit || item.unit || 'Pcs',
          price: getProductPrice(selectedProduct)
        };
      }
      return item;
    });

    setItems(updatedItems);
    setActiveSuggestionRow(null);
  };

  const handleNoteChange = (index, value) => {
    const updatedNotes = [...notes];
    updatedNotes[index] = value;
    setNotes(updatedNotes);
  };

  const handlePaymentChange = (e) => {
    setPaymentMode({ ...paymentMode, [e.target.name]: e.target.value });
  };

  const addItemRow = () => {
    setItems([...items, { name: '', quantity: 1, unit: 'Pcs', price: 0 }]);
  };

  const removeItemRow = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const addNoteRow = () => {
    setNotes([...notes, '']);
  };

  const removeNoteRow = (index) => {
    setNotes(notes.filter((_, i) => i !== index));
  };

  const handleSaveOffer = () => {
    if (!headerData.toCompany.trim()) {
      alert("Please enter a Company Name before saving!");
      return;
    }

    const offerPayload = {
      headerData,
      items,
      notes,
      paymentMode,
      subtotal,
      discountAmount: appliedDiscount,
      grandTotal,
    };

    dispatch(saveOffer(offerPayload))
      .unwrap()
      .then(() => {
        alert("Offer saved successfully!");
        dispatch(fetchAllSavedOffers());
      })
      .catch((err) => {
        alert("Failed to save offer: " + err);
      });
  };

  const handleUpdateOffer = () => {
    if (!savedOfferInfo?.id) {
      alert("Please select an existing offer to update.");
      return;
    }

    const offerPayload = {
      headerData,
      items,
      notes,
      paymentMode,
      subtotal,
      discountAmount: appliedDiscount,
      grandTotal,
    };

    dispatch(updateOffer({ offerId: savedOfferInfo.id, offerPayload }))
      .unwrap()
      .then(() => {
        alert("Offer updated successfully!");
        dispatch(fetchAllSavedOffers());
      })
      .catch((err) => {
        alert("Failed to update offer: " + err);
      });
  };

  const handleDeleteOffer = async () => {
    if (!savedOfferInfo?.id) {
      alert("No active saved offer selected to delete.");
      return;
    }

    if (window.confirm("Are you sure you want to delete this offer?")) {
      dispatch(deleteOffer(savedOfferInfo.id))
        .unwrap()
        .then(() => {
          alert("Offer deleted successfully!");
          dispatch(resetFormState());
          setHeaderData(defaultHeader);
          setItems([{ name: '', quantity: 1, unit: 'Pcs', price: 0 }]);
          setDiscountAmount(0);
          setShowDiscount(false);
          dispatch(fetchAllSavedOffers());
        })
        .catch((err) => {
          alert("Failed to delete offer: " + err);
        });
    }
  };

  const handleDownloadPDF = () => {
    if (!savedOfferInfo?.id) {
      alert('Please save the offer first so it has an Offer ID.');
      return;
    }

    if (!isOfferPdfStorageSupported()) {
      alert('Saving to a selected folder requires Chrome or Edge with folder access enabled.');
      return;
    }

    const directoryHandlePromise = requestOfferPdfDirectory().then(
      (handle) => ({ handle }),
      (error) => ({ error })
    );
    const offerId = savedOfferInfo.offerNo || savedOfferInfo.id;
    setIsPdfPrinting(true);
    window.scrollTo(0, 0);

    setTimeout(() => {
      const element = invoiceRef.current;
      const filename = `Offer_${offerId}.pdf`;

      const options = {
        margin: [40, 10, 26, 10],
        filename,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          scrollX: 0,
          scrollY: 0,
          onclone: (clonedDoc) => {
            const pdfElement = clonedDoc.querySelector(`.${styles.pdfMode}`);
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
                span.style.lineHeight = '1.4';
                span.style.paddingBottom = '2px';
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
          avoid: [`.${styles.pageBreakAvoid}`, '.summary-container', `.${styles.invoiceFooter}`]
        }
      };

      html2pdf()
        .from(element)
        .set(options)
        .toPdf()
        .get('pdf')
        .then((pdf) => {
          const totalPages = pdf.internal.getNumberOfPages();
          const headerImage = new Image();
          const footerImage = new Image();
          const watermarkImage = new Image();
          headerImage.src = header;
          footerImage.src = footer;
          watermarkImage.src = watermark;

          return new Promise((resolve) => {
            let loadedCount = 0;
            const checkLoaded = () => {
              loadedCount++;
              if (loadedCount === 3) {
                const headerProperties = pdf.getImageProperties(headerImage);
                const footerProperties = pdf.getImageProperties(footerImage);
                const headerWidth = 200;
                const headerHeight = (headerProperties.height * headerWidth) / headerProperties.width;
                const footerWidth = 200;
                const footerHeight = (footerProperties.height * footerWidth) / footerProperties.width;

                for (let page = 1; page <= totalPages; page++) {
                  pdf.setPage(page);

                  const watermarkWidth = 90;
                  const watermarkHeight = (watermarkImage.height * watermarkWidth) / watermarkImage.width;
                  const watermarkX = (210 - watermarkWidth) / 2;
                  const watermarkY = (297 - watermarkHeight) / 2;

                  pdf.saveGraphicsState();
                  if (pdf.setGState) {
                    pdf.setGState(new pdf.GState({ opacity: 0.08 }));
                  }
                  pdf.addImage(watermarkImage, 'PNG', watermarkX, watermarkY, watermarkWidth, watermarkHeight);
                  pdf.restoreGraphicsState();
                  pdf.addImage(headerImage, 'PNG', 5, 3, headerWidth, headerHeight);
                  pdf.addImage(footerImage, 'PNG', 5, 297 - footerHeight - 3, footerWidth, footerHeight);
                }
                resolve(pdf);
              }
            };

            headerImage.onload = checkLoaded;
            footerImage.onload = checkLoaded;
            watermarkImage.onload = checkLoaded;
            if (headerImage.complete) checkLoaded();
            if (footerImage.complete) checkLoaded();
            if (watermarkImage.complete) checkLoaded();
          });
        })
        .then(async (pdf) => {
          const directoryResult = await directoryHandlePromise;
          if (directoryResult.error) throw directoryResult.error;
          await saveOfferRelatedPdf(directoryResult.handle, pdf.output('blob'), {
            companyName: headerData.toCompany,
            offerId,
            fileName: filename
          });
          setIsPdfPrinting(false);
        })
        .catch((error) => {
          console.error('PDF generation error:', error);
          if (error.name !== 'AbortError') {
            alert(`Could not save the offer PDF: ${error.message}`);
          }
          setIsPdfPrinting(false);
        });
    }, 200);
  };

  const numberToWords = (num) => {
    if (!num && num !== 0) return 'Zero Taka Only';
    
    // Sonkhake string ba float e convert kore integer ebong decimal alada kora
    const numStr = Number(num).toFixed(2);
    const [takaStr, paisaStr] = numStr.split('.');
    const taka = parseInt(takaStr, 10);
    const paisa = parseInt(paisaStr, 10);

    const a = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
      'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const inWords = (n) => {
      if (n < 20) return a[n];
      if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
      if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + inWords(n % 100) : '');
      if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
      if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
      return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
    };

    let result = taka === 0 ? 'Zero Taka' : `${inWords(taka)} Taka`;

    if (paisa > 0) {
      result += ` and ${inWords(paisa)} Paisa`;
    }

    return `${result} Only`;
  };

  return (
    <div className={styles.mainWrapper} onClick={() => setActiveSuggestionRow(null)}>
      {/* Action Bar */}
      <div className={`${styles.actionBar} ${styles.noPrint}`}>
        <div className={styles.actionSelectors}>
          <label className={styles.actionField}>
            <span>Company:</span>
            <select onChange={handleCompanyChange} value={selectedCompany}>
              <option value="">-- All Companies --</option>
              {uniqueCompanies.map((comp, idx) => (
                <option key={idx} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.actionField}>
            <span>Select Offer:</span>
            <select
              onChange={handleSelectSavedOffer}
              value={savedOfferInfo?.id || ''}
            >
              <option value="">-- New Offer --</option>
              {filteredOffers.map((off) => {
                const compName = off.headerData?.toCompany || off.companyName || 'No Company';
                const dateVal = off.headerData?.date || defaultHeader.date;
                return (
                  <option key={off.docId} value={off.docId}>
                    {off.offerNo || off.docId} - {dateVal} ({compName})
                  </option>
                );
              })}
            </select>
          </label>
        </div>

        <div className={styles.actionButtons}>
          <button
            className={styles.btnAction}
            onClick={handleSaveOffer}
            disabled={isSaving || savedOfferInfo?.id}
            style={{ backgroundColor: savedOfferInfo?.id ? '#ccc' : '#198754' }}
          >
            {isSaving ? 'Saving...' : '💾 Save'}
          </button>

          <button
            className={styles.btnAction}
            onClick={handleUpdateOffer}
            disabled={isUpdating || !savedOfferInfo?.id}
            style={{ backgroundColor: savedOfferInfo?.id ? '#ffc107' : '#ccc', color: savedOfferInfo?.id ? '#000' : '#fff' }}
          >
            {isUpdating ? 'Updating...' : '✏️ Update'}
          </button>

          <button
            className={styles.btnAction}
            onClick={handleDeleteOffer}
            disabled={isDeleting || !savedOfferInfo?.id}
            style={{ backgroundColor: savedOfferInfo?.id ? '#dc3545' : '#ccc' }}
          >
            {isDeleting ? 'Deleting...' : '🗑️ Delete'}
          </button>

          <button
            type="button"
            className={`${styles.btnAction} ${styles.signatureToggle} ${showSignature ? styles.signatureEnabled : ''}`}
            onClick={() => setShowSignature((visible) => !visible)}
            aria-pressed={showSignature}
          >
            {showSignature ? '✍️ Remove Signature' : '✍️ Add Signature'}
          </button>

          <button
            className={styles.btnAction}
            onClick={handleDownloadPDF}
            disabled={isPdfPrinting}
            title="Choose the D: drive root the first time; PDFs are saved under Osan lift\\Company\\Offer ID."
          >
            {isPdfPrinting ? '⏳ Saving PDF...' : '📥 PDF'}
          </button>
        </div>
      </div>

      {/* Invoice Document Container */}
      <div className={`${styles.invoiceContainer} ${isPdfPrinting ? styles.pdfMode : ''}`} ref={invoiceRef}>
        {!isPdfPrinting && (
          <div className={`${styles.companyHeader} no-pdf-img`}>
            <div style={{ width: "100%", height: "110px" }}>
              <img src={header} alt="Logo" style={{ width: "100%" }} />
            </div>
          </div>
        )}

        <div className={styles.documentType}>PRICE OFFER</div>

        {/* Header Info */}
        <div className={styles.infoSection}>
          <div className={styles.infoRow}>
            <span className={styles.bold}>Date: </span>
            {isPdfPrinting ? (
              <span className={styles.inlineInput} style={{ width: '120px' }}>{headerData.date || ''}</span>
            ) : (
              <input
                type="text"
                name="date"
                className={styles.inlineInput}
                style={{ width: '120px' }}
                value={headerData.date || ''}
                onChange={handleHeaderChange}
              />
            )}
          </div>
          <div className={styles.infoRow}>
            <span className={styles.bold}>Offer No: </span>
            <span>{savedOfferInfo?.offerNo || 'Generated when saved'}</span>
          </div>
          <div className={styles.toAddress}>
            <span className={styles.bold}>To,</span>
            {isPdfPrinting ? (
              <>
                <div className={`${styles.blockInput} ${styles.bold}`}>{headerData.toCompany || ''}</div>
                <div className={styles.blockInput}>{headerData.address || ''}</div>
              </>
            ) : (
              <>
                <input
                  type="text"
                  name="toCompany"
                  placeholder="Company Name"
                  className={`${styles.blockInput} ${styles.bold}`}
                  value={headerData.toCompany || ''}
                  onChange={handleHeaderChange}
                />
                <input
                  type="text"
                  name="address"
                  placeholder="Company Address"
                  className={styles.blockInput}
                  value={headerData.address || ''}
                  onChange={handleHeaderChange}
                />
              </>
            )}
          </div>
          <div className={styles.subjectLine}>
            <span className={styles.bold}>Subject: </span>
            {isPdfPrinting ? (
              <span className={`${styles.inlineInput} ${styles.bold}`} style={{ width: '80%' }}>{headerData.subject || ''}</span>
            ) : (
              <input
                type="text"
                name="subject"
                placeholder="Enter subject"
                className={`${styles.inlineInput} ${styles.bold}`}
                style={{ width: '80%' }}
                value={headerData.subject || ''}
                onChange={handleHeaderChange}
              />
            )}
          </div>
          <p className={styles.noMargin} style={{ marginTop: '6px' }}>Dear Sir,</p>
          <p className={styles.noMargin}>We are pleased to submit our best price offer for your consideration:</p>
        </div>

        {/* Dynamic Items Table */}
        <table className={styles.invoiceTable}>
          <thead>
            <tr>
              <th style={{ width: '5%' }}>SL</th>
              <th style={{ width: '43%' }}>Description of Items</th>
              <th style={{ width: '9%' }}>Qty</th>
              <th style={{ width: '9%' }}>Unit</th>
              <th style={{ width: '14%' }}>Price</th>
              <th style={{ width: '15%' }}>Total</th>
              <th className={styles.noPrint} style={{ width: '5%' }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => {
              const totalItemPrice = (Number(item.quantity) || 0) * (Number(item.price) || 0);
              const searchSearchTerm = (item.name || '').trim().toLowerCase();

              const filteredOfferProds = offerProductList.filter((p) =>
                getProductName(p).toLowerCase().includes(searchSearchTerm)
              );
              
              const filteredPurchaseProds = purchaseProductList.filter((p) =>
                getProductName(p).toLowerCase().includes(searchSearchTerm)
              );

              return (
                <tr key={index}>
                  <td className={styles.textCenter}>{index + 1}</td>
                  <td style={{ position: 'relative' }}>
                    {isPdfPrinting ? (
                      <div className={styles.tableInput}>{item.name || ''}</div>
                    ) : (
                      <input
                        type="text"
                        className={styles.tableInput}
                        placeholder="Item name / description"
                        value={item.name || ''}
                        style={{ color: '#000000', fontWeight: 'normal' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSuggestionRow(index);
                        }}
                        onChange={(e) => {
                          handleItemChange(index, 'name', e.target.value);
                          setActiveSuggestionRow(index);
                        }}
                      />
                    )}

                    {activeSuggestionRow === index && searchSearchTerm.length > 0 && (
                      <div
                        className={`${styles.suggestionsDropdown} ${styles.noPrint}`}
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
                          <div className={styles.suggestionCategory} style={{ padding: '6px', borderBottom: '1px solid #eee' }}>
                            <strong style={{ fontSize: '11px', color: '#2e7d32' }}>Offer Products</strong>
                            {filteredOfferProds.map((prod, pIdx) => (
                              <div
                                key={`off-${prod.id || pIdx}`}
                                className={styles.suggestionItem}
                                style={{
                                  padding: '6px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f9f9f9',
                                  fontSize: '13px',
                                  color: '#2e7d32',
                                  fontWeight: '500'
                                }}
                                onClick={() => handleSelectProduct(index, prod)}
                              >
                                {getProductName(prod)} ({getProductPrice(prod)} Tk)
                              </div>
                            ))}
                          </div>
                        )}

                        {filteredPurchaseProds.length > 0 && (
                          <div className={styles.suggestionCategory} style={{ padding: '6px' }}>
                            <strong style={{ fontSize: '11px', color: '#1565c0' }}>Purchase Products</strong>
                            {filteredPurchaseProds.map((prod, pIdx) => (
                              <div
                                key={`pur-${prod.id || pIdx}`}
                                className={styles.suggestionItem}
                                style={{
                                  padding: '6px',
                                  cursor: 'pointer',
                                  borderBottom: '1px solid #f9f9f9',
                                  fontSize: '13px',
                                  color: '#1565c0',
                                  fontWeight: '500'
                                }}
                                onClick={() => handleSelectProduct(index, prod)}
                              >
                                {getProductName(prod)} — Selling: ({getProductPrice(prod)} Tk)
                              </div>
                            ))}
                          </div>
                        )}

                        {filteredOfferProds.length === 0 && filteredPurchaseProds.length === 0 && (
                          <div style={{ padding: '8px', fontSize: '12px', color: '#d32f2f', textAlign: 'center' }}>
                            No product found
                          </div>
                        )}
                      </div>
                    )}
                  </td>
                  <td>
                    {isPdfPrinting ? (
                      <span className={`${styles.tableInput} ${styles.pdfTableValue}`}>{item.quantity ?? ''}</span>
                    ) : (
                      <input
                        type="number"
                        className={`${styles.tableInput} ${styles.textCenter}`}
                        value={item.quantity ?? ''}
                        onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                      />
                    )}
                  </td>
                  <td>
                    {isPdfPrinting ? (
                      <span className={`${styles.tableInput} ${styles.pdfTableValue}`}>{item.unit || ''}</span>
                    ) : (
                      <input
                        type="text"
                        className={`${styles.tableInput} ${styles.textCenter}`}
                        value={item.unit || ''}
                        onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                      />
                    )}
                  </td>
                  <td>
                    {isPdfPrinting ? (
                      <span className={`${styles.tableInput} ${styles.pdfTableValue}`}>{item.price ?? ''}</span>
                    ) : (
                      <input
                        type="number"
                        className={`${styles.tableInput} ${styles.textCenter}`}
                        value={item.price ?? ''}
                        onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                      />
                    )}
                  </td>
                  <td className={`${styles.cellTotal} ${styles.textCenter} ${styles.bold}`}>{totalItemPrice.toLocaleString()}</td>
                  <td className={`${styles.noPrint} ${styles.textCenter}`}>
                    <button className={styles.btnDelete} onClick={() => removeItemRow(index)}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {showDiscount ? (
              <>
                <tr>
                  <td colSpan="5" className={`${styles.bold} ${styles.textCenter}`}>Subtotal:</td>
                  <td className={`${styles.cellTotal} ${styles.textCenter} ${styles.bold}`}>{subtotal.toLocaleString()}</td>
                  <td className={styles.noPrint}></td>
                </tr>
                <tr>
                  <td colSpan="5" className={`${styles.bold} ${styles.textCenter}`}>- Discount (BDT):</td>
                  <td className={`${styles.cellTotal} ${styles.textCenter}`}>
                    {isPdfPrinting ? (
                      `- ${appliedDiscount.toLocaleString()}`
                    ) : (
                      <input
                        type="number"
                        className={`${styles.tableInput} ${styles.textCenter}`}
                        aria-label="Discount amount in BDT"
                        min="0"
                        max={subtotal}
                        step="0.01"
                        value={discountAmount}
                        onChange={(e) => setDiscountAmount(e.target.value)}
                      />
                    )}
                  </td>
                  <td className={styles.noPrint}></td>
                </tr>
                <tr>
                  <td colSpan="5" className={`${styles.bold} ${styles.textCenter}`}>Net Total:</td>
                  <td className={`${styles.cellTotal} ${styles.textCenter} ${styles.bold}`}>{grandTotal.toLocaleString()}</td>
                  <td className={styles.noPrint}></td>
                </tr>
              </>
            ) : (
              <tr>
                <td colSpan="5" className={`${styles.bold} ${styles.textCenter}`}>Total Amount:</td>
                <td className={`${styles.cellTotal} ${styles.textCenter} ${styles.bold}`}>{grandTotal.toLocaleString()}</td>
                <td className={styles.noPrint}></td>
              </tr>
            )}
          </tfoot>
        </table>

        <div className={`${styles.addRowContainer} ${styles.noPrint}`}>
          <button className={styles.btnAddRow} onClick={addItemRow}>+ Add Item</button>
          <button
            type="button"
            className={styles.btnAddRow}
            onClick={() => {
              if (showDiscount) setDiscountAmount(0);
              setShowDiscount(!showDiscount);
            }}
          >
            {showDiscount ? '− Remove Discount' : '+ Add Discount'}
          </button>
        </div>

        {/* Amount in Words */}
        <div className={styles.inWordsSection}>
          <span className={styles.bold}>In Words: </span>
          <span>{numberToWords(grandTotal)}</span>
        </div>

        {/* Terms & Conditions Section */}
        <div className={`${styles.notesSection} ${styles.pageBreakAvoid}`}>
          <span className={styles.bold}>Terms & Conditions:</span>
          {notes.map((note, index) => (
            <div key={index} className={styles.noteRow}>
              <span className={styles.noteLabel}>{index + 1}. </span>
              {isPdfPrinting ? (
                <span className={styles.noteInput}>{note || ''}</span>
              ) : (
                <input
                  type="text"
                  className={styles.noteInput}
                  value={note || ''}
                  onChange={(e) => handleNoteChange(index, e.target.value)}
                />
              )}
              <button className={`${styles.btnDelete} ${styles.inlineDelete} ${styles.noPrint}`} onClick={() => removeNoteRow(index)}>✕</button>
            </div>
          ))}
          <div className={`${styles.addNoteBox} ${styles.noPrint}`}>
            <button className={styles.btnAddNote} onClick={addNoteRow}>+ Add Term</button>
          </div>

          <div className={styles.paymentMode}>
            <span className={styles.bold}>Mode of Payment:</span>
            <div className={styles.paymentLine}>
              {isPdfPrinting ? (
                <div className={styles.blockInput}>{paymentMode.mode || ''}</div>
              ) : (
                <input
                  type="text"
                  name="mode"
                  className={styles.blockInput}
                  value={paymentMode.mode || ''}
                  onChange={handlePaymentChange}
                />
              )}
            </div>
            <div className={styles.paymentLine}>
              {isPdfPrinting ? (
                <div className={styles.blockInput}>{paymentMode.advance || ''}</div>
              ) : (
                <input
                  type="text"
                  name="advance"
                  className={styles.blockInput}
                  value={paymentMode.advance || ''}
                  onChange={handlePaymentChange}
                />
              )}
            </div>
            <div className={styles.paymentLine}>
              {isPdfPrinting ? (
                <div className={styles.blockInput}>{paymentMode.handover || ''}</div>
              ) : (
                <input
                  type="text"
                  name="handover"
                  className={styles.blockInput}
                  value={paymentMode.handover || ''}
                  onChange={handlePaymentChange}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer Section */}
        <div className={`${styles.invoiceFooter} ${styles.pageBreakAvoid}`}>
          <div>
            
            <div className={styles.sealCircle}>
              <img src={seal} alt="Seal" />
              {showSignature && (
                <img className={styles.sealSignature} src={signature} alt="Signature" />
              )}
            </div>
            <p className={`${styles.noMargin} ${styles.bold}`} style={{ fontSize: '11px' }}>Thanking You. Yours Truly</p>
          </div>
          <div>
            <div className={styles.signatureLine}></div>
            <p className={`${styles.noMargin} ${styles.bold}`} style={{ fontSize: '11px', textAlign: 'center' }}>Receiver's Signature & Seal</p>
          </div>
        </div>

        {!isPdfPrinting && (
          <div className={`${styles.bottomContact} no-pdf-img ${styles.pageBreakAvoid}`}>
            <img src={footer} alt="Footer" style={{ width: "100%" }} />
          </div>
        )}
      </div>
    </div>
  );
};

export default OfferInvoice;