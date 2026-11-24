import html2pdf from 'html2pdf.js';
import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import footerImg from '../../../assets/Footer.png';
import headerImg from '../../../assets/header.png';
import watermarkImg from '../../../assets/main-logo.png';
import InvoiceFooter from '../../../Pad/InvoiceFooter.jsx';
import InvoiceHeader from '../../../Pad/InvoiceHeader.jsx';
import {
  isOfferPdfStorageSupported,
  requestOfferPdfDirectory,
  saveServicingDocumentPdf
} from '../../../utils/offerPdfStorage';
import './Checklist.css';

const Checklist = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pdfRef = useRef(null);

  const { projectInfo, billInfo } = location.state || {};

  const [isPdfPrinting, setIsPdfPrinting] = useState(false);

  const [checklistData, setChecklistData] = useState({
    liftNo: '02',
    checkingDate: billInfo?.lastServicingDate || new Date().toISOString().split('T')[0],
    month: billInfo?.month || 'August',
    note: '',
    categories: [
      {
        title: 'Power',
        items: [
          { name: 'DESA Power Check.', checked: true },
          { name: 'Stabilizer Voltage Check.', checked: true }
        ]
      },
      {
        title: 'Cabin',
        items: [
          { name: 'Emergency Light & Intercom Checking.', checked: true },
          { name: 'Exit Switch Check.', checked: true },
          { name: 'Suspension Rod & Spring Check.', checked: true },
          { name: 'Starting, Travelling & Stopping Check.', checked: true },
          { name: 'Safety Sensor Check.', checked: true },
          { name: 'Over Load Check.', checked: true }
        ]
      },
      {
        title: 'Control Panel',
        items: [
          { name: 'Dust Cleaning.', checked: true },
          { name: 'Cable dressing Check.', checked: true },
          { name: 'Breaking Register Check.', checked: true }
        ]
      },
      {
        title: 'Door Drive',
        items: [
          { name: 'Door Opening & Closing Check.', checked: true },
          { name: 'Door Roller & Cam Check.', checked: true },
          { name: 'Door Sensor & Cam Check.', checked: true }
        ]
      },
      {
        title: 'Motor Gear',
        items: [
          { name: 'Dust Cleaning.', checked: false },
          { name: 'Gear Oil Checking.', checked: true },
          { name: 'Gear Oil Mark Low/Medium/Max.', checked: true },
          { name: 'Motor Fan Condition Ok/Not Ok', checked: true },
          { name: 'Bearing Noise Check.', checked: false },
          { name: 'Break Working Condition.', checked: false }
        ]
      },
      {
        title: 'Hoist Way',
        items: [
          { name: 'Magnet Switch Check.', checked: false },
          { name: 'All Limit Switch check.', checked: true },
          { name: 'Leveling Switch Check.', checked: true },
          { name: 'Pit Cleaning.', checked: false },
          { name: 'Traveling Cable Check.', checked: false }
        ]
      },
      {
        title: 'Speed Governor',
        items: [
          { name: 'Rope Tension & Hope Condition Check.', checked: false },
          { name: 'Switch & Sensor Check.', checked: false }
        ]
      },
      {
        title: 'Landing',
        items: [
          { name: 'Dust Cleaning.', checked: false },
          { name: 'Door Alignment & Header Checking.', checked: false },
          { name: 'Door Shield & Sleeper Checking.', checked: false },
          { name: 'Door Contact Checking.', checked: false },
          { name: 'Door Gap Checking.', checked: false }
        ]
      },
      {
        title: 'Guide',
        items: [
          { name: 'Guide rail cleaning Oiling & all Shoes Checking & Cleaning.', checked: false },
          { name: 'Counter Weight Check & Shoes Cleaning.', checked: false }
        ]
      },
      {
        title: 'Machine Room',
        items: [
          { name: 'Dust Cleaning.', checked: false }
        ]
      }
    ]
  });

  if (!projectInfo) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <h3>No project data found!</h3>
        <button onClick={() => navigate(-1)} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          🔙 Go Back
        </button>
      </div>
    );
  }

  const handleMetaChange = (field, value) => {
    setChecklistData((prev) => ({ ...prev, [field]: value }));
  };

  const handleItemChange = (catIdx, itemIdx, value) => {
    setChecklistData((prev) => ({
      ...prev,
      categories: prev.categories.map((category, index) => (
        index === catIdx
          ? {
              ...category,
              items: category.items.map((item, itemIndex) => (
                itemIndex === itemIdx
                  ? { ...(typeof item === 'string' ? { name: item } : item), name: value }
                  : item
              ))
            }
          : category
      ))
    }));
  };

  const handleItemCheck = (catIdx, itemIdx, checked) => {
    setChecklistData((prev) => ({
      ...prev,
      categories: prev.categories.map((category, index) => (
        index === catIdx
          ? {
              ...category,
              items: category.items.map((item, itemIndex) => (
                itemIndex === itemIdx
                  ? {
                      ...(typeof item === 'string' ? { name: item } : item),
                      checked
                    }
                  : item
              ))
            }
          : category
      ))
    }));
  };

  const handleAddItem = (catIdx) => {
    setChecklistData((prev) => ({
      ...prev,
      categories: prev.categories.map((category, index) => (
        index === catIdx
          ? { ...category, items: [...category.items, { name: '', checked: false }] }
          : category
      ))
    }));
  };

  const handleRemoveItem = (catIdx, itemIdx) => {
    setChecklistData((prev) => ({
      ...prev,
      categories: prev.categories.map((category, index) => (
        index === catIdx
          ? {
              ...category,
              items: category.items.filter((_, itemIndex) => itemIndex !== itemIdx)
            }
          : category
      ))
    }));
  };

  const handleDownloadPDF = () => {
    if (!isOfferPdfStorageSupported()) {
      alert('Saving to a selected folder requires Chrome or Edge with folder access enabled.');
      return;
    }

    const directoryHandlePromise = requestOfferPdfDirectory().then(
      (handle) => ({ handle }),
      (error) => ({ error })
    );
    const filename = `Checklist_${projectInfo.projectName || 'Project'}_${checklistData.month}.pdf`;
    setIsPdfPrinting(true);
    window.scrollTo(0, 0);

    setTimeout(() => {
      const element = pdfRef.current;

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
              const headerComp = pdfElement.querySelector('.company-header');
              if (headerComp) headerComp.style.display = 'none';

              const footerComp = pdfElement.querySelector('.bottom-contact');
              if (footerComp) footerComp.style.display = 'none';

              const inputs = pdfElement.querySelectorAll('input, textarea');
              inputs.forEach((input) => {
                const span = clonedDoc.createElement('span');
                span.innerText = input.value || input.placeholder || '';
                span.style.display = 'inline-block';
                span.style.fontFamily = 'inherit';
                span.style.fontSize = window.getComputedStyle(input).fontSize;
                span.style.fontWeight = window.getComputedStyle(input).fontWeight;
                span.style.color = window.getComputedStyle(input).color;
                if (input.parentNode) {
                  input.parentNode.replaceChild(span, input);
                }
              });
            }
          }
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['.category-block', '.note-section', '.checklist-footer'] }
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

                const hWidth = 200;
                const hHeight = (hProps.height * hWidth) / hProps.width;

                const fWidth = 200;
                const fHeight = (fProps.height * fWidth) / fProps.width;

                for (let i = 1; i <= totalPages; i++) {
                  pdf.setPage(i);

                  // Render watermark in exact center of each page
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
          await saveServicingDocumentPdf(directoryResult.handle, pdf.output('blob'), {
            companyName: projectInfo.projectName,
            fileName: filename
          });
          setIsPdfPrinting(false);
        })
        .catch((err) => {
          console.error('Checklist PDF saving failed:', err);
          if (err.name !== 'AbortError') {
            alert(`Could not save the checklist PDF: ${err.message}`);
          }
          setIsPdfPrinting(false);
        });
    }, 200);
  };

  return (
    <div className="main-wrapper">
      <div className="invoice-search-card no-print">
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', width: '100%' }}>
          <button className="btn-save-bill" onClick={() => navigate(-1)}>
            🔙 Back to Project
          </button>
          <button
            className="btn-download-pdf"
            onClick={handleDownloadPDF}
            disabled={isPdfPrinting}
            title="Choose the D: drive root the first time; checklists are saved under Osan Lift\\Servicing_bill\\Company."
          >
            {isPdfPrinting ? '⏳ Saving PDF...' : '📥 Download Checklist (PDF)'}
          </button>
        </div>
      </div>

      <div className={`checklist-container ${isPdfPrinting ? 'pdf-mode' : ''}`} ref={pdfRef}>
        <div className="company-header no-print-in-pdf">
          <InvoiceHeader imageOnly />
        </div>

        <div className="checklist-title">
          Check List of Lift (for the month of {checklistData.month})
        </div>

        <div className="meta-info-container">
          <div className="info-row">
            <span className="info-label">Name</span>
            <span className="info-colon">:</span>
            <span className="info-value bold">{projectInfo.projectName || '-------'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Address</span>
            <span className="info-colon">:</span>
            <span className="info-value">{projectInfo.address || 'N/A'}</span>
          </div>
          <div className="info-row-inline">
            <div className="info-row half">
              <span className="info-label">Lift No</span>
              <span className="info-colon">:</span>
              <span className="info-value">
                {isPdfPrinting ? (
                  checklistData.liftNo
                ) : (
                  <input
                    type="text"
                    value={checklistData.liftNo}
                    onChange={(e) => handleMetaChange('liftNo', e.target.value)}
                    className="inline-input"
                  />
                )}
              </span>
            </div>
            <div className="info-row half">
              <span className="info-label">Checking Date</span>
              <span className="info-colon">:</span>
              <span className="info-value">
                {isPdfPrinting ? (
                  checklistData.checkingDate
                ) : (
                  <input
                    type="date"
                    value={checklistData.checkingDate}
                    onChange={(e) => handleMetaChange('checkingDate', e.target.value)}
                    className="inline-input"
                  />
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="checklist-grid">
          {checklistData.categories.map((cat, catIdx) => (
            <div key={catIdx} className="category-block">
              <div className="category-header">{cat.title}</div>
              <ul className="category-list">
                {cat.items.map((item, itemIdx) => (
                  <li key={itemIdx} className="category-item">
                    {isPdfPrinting ? (
                      <span className="item-checkbox" aria-hidden="true">
                        {item.checked ? '✓' : ''}
                      </span>
                    ) : (
                      <input
                        type="checkbox"
                        className="item-checkbox"
                        checked={Boolean(item.checked)}
                        onChange={(e) => handleItemCheck(catIdx, itemIdx, e.target.checked)}
                        aria-label={`Mark ${item.name} complete`}
                      />
                    )}
                    <span className="item-text">
                      {isPdfPrinting ? (
                        item.name
                      ) : (
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) => handleItemChange(catIdx, itemIdx, e.target.value)}
                          className="table-input"
                          aria-label={`Checklist item ${itemIdx + 1}`}
                        />
                      )}
                    </span>
                    {!isPdfPrinting && (
                      <button
                        type="button"
                        className="remove-item-button no-print"
                        onClick={() => handleRemoveItem(catIdx, itemIdx)}
                        aria-label={`Remove checklist item ${itemIdx + 1}`}
                      >
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {!isPdfPrinting && (
                <button
                  type="button"
                  className="add-item-button no-print"
                  onClick={() => handleAddItem(catIdx)}
                >
                  + Add Item
                </button>
              )}
            </div>
          ))}
        </div>

        <div className="note-section">
          <strong>Note: </strong>
          {isPdfPrinting ? (
            <span>{checklistData.note}</span>
          ) : (
            <textarea
              rows="2"
              value={checklistData.note}
              onChange={(e) => handleMetaChange('note', e.target.value)}
              className="table-input"
              placeholder="Write optional note..."
            />
          )}
        </div>

        <div className="checklist-footer">
          <div className="sig-box">
            <div className="sig-line"></div>
            <p>Client's Signature</p>
          </div>
          <div className="sig-box">
            <div className="sig-line"></div>
            <p>Technician's Signature</p>
          </div>
        </div>

        <div className="bottom-contact no-print-in-pdf">
          <InvoiceFooter imageOnly />
        </div>
      </div>
    </div>
  );
};

export default Checklist;