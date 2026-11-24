/* eslint-disable react-hooks/set-state-in-effect */
import html2pdf from 'html2pdf.js';
import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import footer from "../../assets/Footer.png";
import header from "../../assets/header.png";
import watermark from "../../assets/main-logo.png";
import seal from "../../assets/Seal.png";
import signature from "../../assets/signature.png";

import {
  clearOffersList,
  createCustomChallan,
  fetchAllCompanies,
  fetchOffersByCompany,
  fetchSavedChallanById,
  fetchSavedChallans,
  fetchSpecificOfferForChallan,
  resetChallan,
  saveChallan,
} from '../../Fetures/Inventory/ChallanSlice';
import {
  isOfferPdfStorageSupported,
  requestOfferPdfDirectory,
  saveOfferRelatedPdf
} from '../../utils/offerPdfStorage';
import styles from './Challan.module.css';

const Challan = () => {
  const challanRef = useRef(null);
  const dispatch = useDispatch();

  const { 
    companiesList, 
    offersList, 
    savedChallans,
    challanData, 
    loadingCompanies, 
    loadingOffers, 
    loadingChallan, 
    loadingSavedChallans,
    savingChallan,
    error 
  } = useSelector((state) => state.challan);

  const [selectedCompany, setSelectedCompany] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [selectedSavedChallanId, setSelectedSavedChallanId] = useState('');
  const [isPdfPrinting, setIsPdfPrinting] = useState(false);
  const [showSignature, setShowSignature] = useState(false);

  const [editableHeader, setEditableHeader] = useState({
    toCompany: '',
    address: '',
    subject: '',
    workOrderNo: '' // নতুন ইনপুট ফিল্ডের জন্য স্টেট
  });
  const [editableItems, setEditableItems] = useState([]);
  const [editableDate, setEditableDate] = useState('');

  useEffect(() => {
    dispatch(fetchAllCompanies());
    dispatch(fetchSavedChallans());
  }, [dispatch]);

  useEffect(() => {
    if (challanData) {
      setEditableHeader({
        toCompany: challanData.toCompany || '',
        address: challanData.address || '',
        subject: challanData.subject || '',
        workOrderNo: challanData.workOrderNo || ''
      });
      setEditableDate(challanData.date || new Date().toISOString().slice(0, 10));
      setEditableItems(challanData.items || []);
    }
  }, [challanData]);

  const handleCompanyChange = (e) => {
    const companyDocId = e.target.value;
    setSelectedCompany(companyDocId);
    setSelectedOfferId('');
    setSelectedSavedChallanId('');
    setEditableItems([]);
    
    if (companyDocId) {
      dispatch(fetchOffersByCompany(companyDocId));
    } else {
      dispatch(clearOffersList());
    }
  };

  const handleOfferChange = (e) => {
    const offerId = e.target.value;
    setSelectedOfferId(offerId);
    setSelectedSavedChallanId('');

    if (selectedCompany && offerId) {
      dispatch(fetchSpecificOfferForChallan({ offerId }));
    }
  };

  const handleSavedChallanChange = (e) => {
    const challanId = e.target.value;
    if (!challanId) {
      setSelectedSavedChallanId('');
      return;
    }

    setSelectedCompany('');
    setSelectedOfferId('');
    setSelectedSavedChallanId(challanId);
    dispatch(fetchSavedChallanById(challanId));
  };

  const handleCreateRandomChallan = () => {
    setSelectedCompany('');
    setSelectedOfferId('');
    setSelectedSavedChallanId('');
    dispatch(createCustomChallan());
  };

  const handleReset = () => {
    setSelectedCompany('');
    setSelectedOfferId('');
    setSelectedSavedChallanId('');
    setEditableHeader({ toCompany: '', address: '', subject: '', workOrderNo: '' });
    setEditableDate('');
    setEditableItems([]);
    dispatch(resetChallan());
  };

  const handleSaveChallan = () => {
    if (!challanData) return;

    const challanPayload = {
      ...challanData,
      ...editableHeader,
      date: editableDate,
      items: editableItems,
    };

    dispatch(saveChallan({
      challanData: challanPayload,
      documentId: selectedSavedChallanId || challanData.id,
    }))
      .then((action) => {
        if (saveChallan.fulfilled.match(action)) {
          setSelectedSavedChallanId(action.payload.id);
          dispatch(fetchSavedChallans());
        }
      });
  };

  const handleRemoveItem = (indexToRemove) => {
    const updatedItems = editableItems.filter((_, index) => index !== indexToRemove);
    setEditableItems(updatedItems);
  };

  const handleItemChange = (index, field, value) => {
    const updatedItems = editableItems.map((item, i) => {
      if (i === index) {
        return { ...item, [field]: value };
      }
      return item;
    });
    setEditableItems(updatedItems);
  };

  const handleAddItem = () => {
    setEditableItems([...editableItems, { name: '', quantity: 1, unit: 'Pcs' }]);
  };

  const handleHeaderChange = (field, value) => {
    setEditableHeader(prev => ({ ...prev, [field]: value }));
  };

  const handleDownloadPDF = () => {
    if (!challanData) return;

    if (!isOfferPdfStorageSupported()) {
      alert('Saving to a selected folder requires Chrome or Edge with folder access enabled.');
      return;
    }

    const directoryHandlePromise = requestOfferPdfDirectory().then(
      (handle) => ({ handle }),
      (error) => ({ error })
    );
    const offerId = challanData.offerNo || selectedOfferId || challanData.challanNo;
    const filename = `Delivery_Challan_${challanData.challanNo}.pdf`;
    setIsPdfPrinting(true);
    window.scrollTo(0, 0);

    setTimeout(() => {
      const element = challanRef.current;

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
            const pdfElement = clonedDoc.querySelector(`.${styles['pdf-mode']}`);
            if (pdfElement) {
              pdfElement.style.width = '100%';

              const headerComponent = pdfElement.querySelector('.company-header');
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
          avoid: ['.page-break-avoid', '.summary-container', `.${styles['invoice-footer']}`]
        }
      };

      html2pdf()
        .from(element)
        .set(options)
        .toPdf()
        .get('pdf')
        .then((pdf) => {
          const totalPages = pdf.internal.getNumberOfPages();
          const headerImg = new Image();
          const footerImg = new Image();
          const watermarkImg = new Image();
          headerImg.src = header;
          footerImg.src = footer;
          watermarkImg.src = watermark;

          return new Promise((resolve) => {
            let loadedCount = 0;
            const checkLoaded = () => {
              loadedCount++;
              if (loadedCount === 3) {
                const headerProperties = pdf.getImageProperties(headerImg);
                const footerProperties = pdf.getImageProperties(footerImg);
                const headerWidth = 200;
                const headerHeight = (headerProperties.height * headerWidth) / headerProperties.width;
                const footerWidth = 200;
                const footerHeight = (footerProperties.height * footerWidth) / footerProperties.width;

                for (let i = 1; i <= totalPages; i++) {
                  pdf.setPage(i);

                  const watermarkWidth = 90;
                  const watermarkHeight = (watermarkImg.height * watermarkWidth) / watermarkImg.width;
                  const watermarkX = (210 - watermarkWidth) / 2;
                  const watermarkY = (297 - watermarkHeight) / 2;

                  pdf.saveGraphicsState();
                  if (pdf.setGState) {
                    pdf.setGState(new pdf.GState({ opacity: 0.08 }));
                  }
                  pdf.addImage(watermarkImg, 'PNG', watermarkX, watermarkY, watermarkWidth, watermarkHeight);
                  pdf.restoreGraphicsState();
                  pdf.addImage(headerImg, 'PNG', 5, 3, headerWidth, headerHeight);
                  pdf.addImage(footerImg, 'PNG', 5, 297 - footerHeight - 3, footerWidth, footerHeight);
                }
                resolve(pdf);
              }
            };

            headerImg.onload = checkLoaded;
            footerImg.onload = checkLoaded;
            watermarkImg.onload = checkLoaded;
            if (headerImg.complete) checkLoaded();
            if (footerImg.complete) checkLoaded();
            if (watermarkImg.complete) checkLoaded();
          });
        })
        .then(async (pdf) => {
          const directoryResult = await directoryHandlePromise;
          if (directoryResult.error) throw directoryResult.error;
          await saveOfferRelatedPdf(directoryResult.handle, pdf.output('blob'), {
            companyName: editableHeader.toCompany || challanData.toCompany,
            offerId,
            fileName: filename
          });
          setIsPdfPrinting(false);
        })
        .catch((err) => {
          console.error('Challan PDF saving failed:', err);
          if (err.name !== 'AbortError') {
            alert(`Could not save the challan PDF: ${err.message}`);
          }
          setIsPdfPrinting(false);
        });
    }, 200);
  };

  return (
    <div className="main-wrapper">
      
      {/* 1. Control Card */}
      <div className={`${styles['challan-search-card']} ${styles['no-print']} no-print`}>
        <div className={`${styles['dropdown-filter-group']} dropdown-filter-group`}>
          <div className={`${styles['select-box']} select-box`}>
            <label className={`${styles['select-label']} select-label`}>1. Select Company Name:</label>
            <select 
              value={selectedCompany} 
              onChange={handleCompanyChange} 
              className={`${styles['select-dropdown']} select-dropdown`}
              disabled={loadingCompanies}
            >
              <option value="">
                {loadingCompanies ? "Loading Companies..." : "-- Choose Company --"}
              </option>
              {companiesList.map((comp) => (
                <option key={comp.id} value={comp.id}>
                  {comp.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className={`${styles['select-box']} select-box`}>
            <label className={`${styles['select-label']} select-label`}>2. Select Offer ID:</label>
            <select 
              value={selectedOfferId} 
              onChange={handleOfferChange} 
              className={`${styles['select-dropdown']} select-dropdown`}
              disabled={!selectedCompany || loadingOffers}
            >
              <option value="">
                {loadingOffers ? "Loading Offers..." : "-- Choose Offer ID --"}
              </option>
              {offersList.map((offer) => (
                <option key={offer.id} value={offer.id}>
                  {offer.offerNo || offer.id} ({offer.date})
                </option>
              ))}
            </select>
          </div>

          <div className={`${styles['select-box']} select-box`}>
            <label className={`${styles['select-label']} select-label`}>3. Load Saved Challan:</label>
            <select
              value={selectedSavedChallanId}
              onChange={handleSavedChallanChange}
              className={`${styles['select-dropdown']} select-dropdown`}
              disabled={loadingSavedChallans}
            >
              <option value="">
                {loadingSavedChallans ? 'Loading Saved Challans...' : '-- Choose Saved Challan --'}
              </option>
              {savedChallans.map((challan) => (
                <option key={challan.id} value={challan.id}>
                  {challan.challanNo || challan.id} — {challan.toCompany || 'Unknown Client'} ({challan.date || 'No Date'})
                </option>
              ))}
            </select>
          </div>

          <div className={`${styles['select-box']} select-box`} style={{ justifyContent: 'flex-end', gap: '8px' }}>
            <label className={`${styles['select-label']} select-label`}>Actions:</label>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <button 
                type="button" 
                className={styles['btn-download-challan']} 
                style={{ backgroundColor: '#28a745', marginTop: '0', flex: 1 }}
                onClick={handleCreateRandomChallan}
              >
                ➕ Create Blank
              </button>

              <button 
                type="button" 
                className={styles['btn-download-challan']} 
                style={{ backgroundColor: '#dc3545', marginTop: '0', flex: 1 }}
                onClick={handleReset}
              >
                🔄 Reset
              </button>
            </div>
          </div>
        </div>

        {error && <p className="error-text">{error}</p>}

        {challanData && (
          <div className={styles['download-box']} style={{ marginTop: '15px' }}>
            <button
              type="button"
              className={styles['btn-download-challan']}
              onClick={handleSaveChallan}
              disabled={savingChallan || loadingChallan}
            >
              {savingChallan ? '💾 Saving...' : selectedSavedChallanId ? '💾 Update Saved Challan' : '💾 Save Challan'}
            </button>
            <button
              type="button"
              className={`${styles['btn-download-challan']} ${styles['signature-toggle']} ${showSignature ? styles['signature-enabled'] : ''}`}
              onClick={() => setShowSignature((visible) => !visible)}
              aria-pressed={showSignature}
            >
              {showSignature ? '✍️ Remove Signature' : '✍️ Add Signature'}
            </button>
            <button
              className={styles['btn-download-challan']}
              onClick={handleDownloadPDF}
              disabled={isPdfPrinting}
              title="Choose the D: drive root the first time; PDFs are saved under Osan lift\\Company\\Offer ID."
            >
              {isPdfPrinting ? '⏳ Saving PDF...' : '📥 Download Delivery Challan (PDF)'}
            </button>
          </div>
        )}
      </div>

      {/* 2. Challan Body */}
      {loadingChallan ? (
        <div className={`${styles['no-data-placeholder']} no-data-placeholder`}>Generating Delivery Challan...</div>
      ) : challanData ? (
        <div
          className={`${styles['invoice-container']} invoice-container ${isPdfPrinting ? `${styles['pdf-mode']} pdf-mode` : ''}`}
          ref={challanRef}
        >
          
          <div className={styles['challan-content-wrap']}>
            
            {/* Screen View Header Logo */}
            <div className="company-header no-print-in-pdf">
              <div className="logo-box">
                <img src={header} alt="Company Logo" className="logo-img" style={{ width: '100%' }} />
              </div>
            </div>

            <div className="document-type">DELIVERY CHALLAN</div>

            {/* Info Section */}
            <div className="info-section">
              <div className="meta-info-grid">
                <div><strong>Challan No: </strong>{challanData.challanNo}</div>
                <div>
                  <strong>Date: </strong>
                  {isPdfPrinting ? (
                    <span>{editableDate}</span>
                  ) : (
                    <input
                      type="date"
                      className={`${styles['table-input']} table-input`}
                      value={editableDate}
                      onChange={(e) => setEditableDate(e.target.value)}
                      aria-label="Challan Date"
                      style={{ width: '150px', display: 'inline-block' }}
                    />
                  )}
                </div>
              </div>

              {/* Purchase Order / Reference field */}
              <div className="work-order-line" style={{ marginTop: '8px' }}>
                <strong>Purchase Order / Ref: </strong>
                {isPdfPrinting ? (
                  <span>{editableHeader.workOrderNo}</span>
                ) : (
                  <input
                    type="text"
                    className={`${styles['table-input']} table-input`}
                    value={editableHeader.workOrderNo}
                    placeholder="Purchase Order No / Reference..."
                    onChange={(e) => handleHeaderChange('workOrderNo', e.target.value)}
                    style={{ width: 'auto', display: 'inline-block', minWidth: '250px' }}
                  />
                )}
              </div>

              <div className="to-address" style={{ marginTop: '8px' }}>
                <p className="no-margin"><strong>To,</strong></p>
                {isPdfPrinting ? (
                  <>
                    <div className="bold">{editableHeader.toCompany}</div>
                    <div>{editableHeader.address}</div>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      className={`${styles['table-input']} table-input bold`}
                      style={{ fontSize: '15px', fontWeight: 'bold', marginBottom: '4px' }}
                      value={editableHeader.toCompany}
                      placeholder="Company / Client Name"
                      onChange={(e) => handleHeaderChange('toCompany', e.target.value)}
                    />
                    <input
                      type="text"
                      className={`${styles['table-input']} table-input`}
                      value={editableHeader.address}
                      placeholder="Company Address"
                      onChange={(e) => handleHeaderChange('address', e.target.value)}
                    />
                  </>
                )}
              </div>

              <div className="subject-line challan-subject">
                <strong>Sub: </strong>
                {isPdfPrinting ? (
                  <span className="bold">{editableHeader.subject}</span>
                ) : (
                  <input
                    type="text"
                    className={`${styles['table-input']} table-input bold`}
                    value={editableHeader.subject}
                    placeholder="Subject..."
                    onChange={(e) => handleHeaderChange('subject', e.target.value)}
                  />
                )}
              </div>

              <div className="salutation challan-salutation">
                Dear Sir,<br />
                Please receive the following goods/materials in good condition:
              </div>
            </div>

            {/* Table */}
            <table className={`invoice-table ${styles['challan-table-wrapper']}`}>
              <thead>
                <tr>
                  <th style={{ width: '8%' }}>S.l No.</th>
                  <th style={{ width: '55%' }}>Items Description</th>
                  <th style={{ width: '12%' }}>Qty</th>
                  <th style={{ width: '13%' }}>Unit</th>
                  {!isPdfPrinting && <th className={`${styles['no-print']} no-print`} style={{ width: '12%' }}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {editableItems.length > 0 ? (
                  editableItems.map((item, index) => (
                    <tr key={index} className="page-break-avoid">
                      <td className="text-center">{index + 1}</td>
                      <td>
                        {isPdfPrinting ? (
                          item.name
                        ) : (
                          <input
                            type="text"
                            className={`${styles['table-input']} table-input`}
                            value={item.name}
                            placeholder="Item description..."
                            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                          />
                        )}
                      </td>
                      <td className="text-center">
                        {isPdfPrinting ? (
                          item.quantity
                        ) : (
                          <input
                            type="number"
                            className={`${styles['table-input']} table-input text-center`}
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          />
                        )}
                      </td>
                      <td className="text-center">
                        {isPdfPrinting ? (
                          item.unit
                        ) : (
                          <input
                            type="text"
                            className={`${styles['table-input']} table-input text-center`}
                            value={item.unit}
                            onChange={(e) => handleItemChange(index, 'unit', e.target.value)}
                          />
                        )}
                      </td>
                      {!isPdfPrinting && (
                        <td className={`text-center ${styles['no-print']} no-print`}>
                          <button
                            type="button"
                            className={styles['btn-delete-item']}
                            onClick={() => handleRemoveItem(index)}
                          >
                            ✖ Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isPdfPrinting ? "4" : "5"} className="text-center" style={{ color: 'red', padding: '15px' }}>
                      No items selected for this Challan.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {!isPdfPrinting && (
              <div className={`${styles['no-print']} no-print`} style={{ marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={handleAddItem}
                  style={{
                    backgroundColor: '#007bff',
                    color: '#fff',
                    border: 'none',
                    padding: '6px 14px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontWeight: 'bold'
                  }}
                >
                  ➕ Add Item
                </button>
              </div>
            )}
          </div>

          {/* Footer Section */}
          <div className={`page-break-avoid footer-section-wrap ${styles['footer-section-wrap']}`}>
            <div className={`invoice-footer ${styles['invoice-footer']}`}>
              <div>
            <div className={styles['seal-circle']}>
              <img src={seal} alt="Seal" />
              {showSignature && (
                <img className={styles['seal-signature']} src={signature} alt="Signature" />
              )}
            </div>
            <p className="no-margin bold" style={{ fontSize: '11px' }}>Thanking You. Yours Truly</p>
          </div>
              <div className="footer-center">
                <div className={styles['signature-title']}>
                  <p><strong>Receiver's Signature & Seal</strong></p>
                </div>
              </div>
            </div>

            {/* Screen View Footer Image */}
            <div className={`bottom-contact ${styles['bottom-contact']} no-print-in-pdf`}>
              <img src={footer} alt="footer" style={{ width: "100%" }} />
            </div>
          </div>

        </div>
      ) : (
        <div className={`${styles['no-data-placeholder']} no-data-placeholder`}>
          <p>Please select a <strong>Company Name</strong> and an <strong>Offer ID</strong> from above, or click <strong>"Create Blank"</strong> to write manually.</p>
        </div>
      )}
    </div>
  );
};

export default Challan;