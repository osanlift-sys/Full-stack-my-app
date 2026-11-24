import html2pdf from 'html2pdf.js';
import { useState } from 'react';
import styles from '../Serviced_and_Schedule.module.css';
import ProjectTableRow from './ProjectTableRow';

const MainProjectTable = ({
  filteredProjects,
  selectedMonth,
  monthsList,
  getLastServicingDateFromProj,
  totals
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollector, setSelectedCollector] = useState('All');

  const targetMonth = selectedMonth === 'All' ? monthsList[new Date().getMonth() + 1] : selectedMonth;
  const availableCollectors = [...new Set(
    filteredProjects
      .map((proj) => (proj.billList || []).find((bill) => bill.month === targetMonth)?.collectedBy?.trim())
      .filter(Boolean)
  )];

  const searchedProjects = filteredProjects.filter((proj) => {
    const term = searchTerm.toLowerCase();
    const name = (proj.projectName || '').toLowerCase();
    const address = (proj.address || '').toLowerCase();
    const phone = (proj.phoneNo || '').toLowerCase();
    const matchesSearch = name.includes(term) || address.includes(term) || phone.includes(term);
    const bill = (proj.billList || []).find((item) => item.month === targetMonth) || {};
    const matchesCollector = selectedCollector === 'All' || bill.collectedBy?.trim() === selectedCollector;
    return matchesSearch && matchesCollector;
  });

  const tableTotals = selectedCollector === 'All'
    ? totals
    : filteredProjects
      .filter((proj) => {
        const bill = (proj.billList || []).find((item) => item.month === targetMonth) || {};
        return bill.collectedBy?.trim() === selectedCollector;
      })
      .reduce((acc, proj) => {
        const bill = (proj.billList || []).find((item) => item.month === targetMonth) || {};
        const servicingBill = Number(bill.servicingBill) || 0;
        const sparePartsBill = Number(bill.sparePartsBill) || 0;
        const lastMonthDue = Number(bill.lastMonthDue) || 0;
        const totalBill = servicingBill + sparePartsBill + lastMonthDue;
        const collectedBill = Number(bill.collectedBill) || 0;

        acc.liftQty += Number(proj.liftQty) || 1;
        acc.servicingBill += servicingBill;
        acc.sparePartsBill += sparePartsBill;
        acc.lastMonthDue += lastMonthDue;
        acc.totalBill += totalBill;
        acc.collectedBill += collectedBill;
        acc.totalDue += totalBill - collectedBill;
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

  const downloadPDF = () => {
    const element = document.getElementById('project-table-pdf');
    
    element.classList.add('pdf-exporting');

    const options = {
      margin:       [8, 8, 8, 8],
      filename:     `Project_Report_${selectedMonth || 'All'}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        windowWidth: 1280 
      },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().from(element).set(options).save().then(() => {
      element.classList.remove('pdf-exporting');
    });
  };

  return (
    <div className={styles.tableWrapper}>
      <style>{`
        /* PDF export korar somoy background white, text black, ebong actions column hide hobe */
        #project-table-pdf.pdf-exporting {
          background-color: #ffffff !important;
          color: #000000 !important;
        }
        #project-table-pdf.pdf-exporting th:last-child,
        #project-table-pdf.pdf-exporting td:last-child {
          display: none !important;
        }
        #project-table-pdf.pdf-exporting table {
          width: 100% !important;
          border-collapse: collapse !important;
        }
        #project-table-pdf.pdf-exporting th {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
          border: 1px solid #cbd5e1 !important;
          padding: 5px 6px !important;
          font-size: 10px !important;
        }
        #project-table-pdf.pdf-exporting td {
          background-color: #ffffff !important;
          color: #1e293b !important;
          border: 1px solid #cbd5e1 !important;
          padding: 5px 6px !important;
          font-size: 10px !important;
        }
        #project-table-pdf.pdf-exporting .pdf-title {
          color: #0f172a !important;
          display: block !important;
        }
        #project-table-pdf.pdf-exporting tr.totalRow {
          background-color: #f8fafc !important;
          color: #0f172a !important;
          font-weight: bold !important;
        }
        #project-table-pdf.pdf-exporting tr.totalRow td {
          color: #0f172a !important;
        }
      `}</style>

      {/* Search Bar & PDF Download Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px', padding: '0 4px' }}>
        <button
          type="button"
          onClick={downloadPDF}
          style={{
            padding: '10px 18px',
            border: 0,
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 600,
            backgroundColor: '#0284c7',
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          📄 Download PDF (Landscape)
        </button>

        <select
          aria-label="Filter by collector"
          value={selectedCollector}
          onChange={(e) => setSelectedCollector(e.target.value)}
          style={{
            padding: '9px 14px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            backgroundColor: '#0f172a',
            color: '#fff',
            fontSize: '14px',
            outline: 'none'
          }}
        >
          <option value="All">All Collectors</option>
          {availableCollectors.map((collector) => (
            <option key={collector} value={collector}>{collector}</option>
          ))}
        </select>

        <input
          className={styles.tableSearch}
          type="text"
          placeholder="🔍 Search project by name, address..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            padding: '9px 14px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            backgroundColor: '#0f172a',
            color: '#fff',
            width: '300px',
            fontSize: '14px',
            outline: 'none'
          }}
        />
      </div>

      <div 
        id="project-table-pdf" 
        style={{ 
          width: '100%', 
          boxSizing: 'border-box'
        }}
      >
        <div className="pdf-title" style={{ marginBottom: '12px', fontWeight: 700, fontSize: '16px', textAlign: 'center', display: 'none' }}>
          Project Report - {selectedMonth || 'All'}
        </div>

        <table 
          className={styles.projectTable}
          style={{ 
            width: '100%', 
            borderCollapse: 'collapse', 
            tableLayout: 'fixed'
          }}
        >
          <thead>
            <tr>
              <th style={{ width: '4%' }} className={styles.textCenter}>Sl</th>
              <th style={{ width: '18%', textAlign: 'left' }}>Project Name</th>
              <th style={{ width: '8%' }} className={styles.textCenter}>Whose</th>
              <th style={{ width: '6%' }} className={styles.textCenter}>Lift Qty</th>
              <th style={{ width: '10%' }} className={styles.textCenter}>Last Date</th>
              <th style={{ width: '9%' }} className={styles.textCenter}>Status</th>
              <th style={{ width: '7%' }} className={styles.textRight}>Serv. Bill</th>
              <th style={{ width: '7%' }} className={styles.textRight}>Spare</th>
              <th style={{ width: '7%' }} className={styles.textRight}>Last Due</th>
              <th style={{ width: '7%' }} className={styles.textRight}>Total Bill</th>
              <th style={{ width: '7%' }} className={styles.textRight}>Collected</th>
              <th style={{ width: '7%' }} className={styles.textRight}>Cust. Due</th>
              <th style={{ width: '6%' }} className={styles.textCenter}>Coll. By</th>
              <th style={{ width: '6%' }} className={styles.textCenter}>Approved By</th>
            </tr>
          </thead>
          <tbody>
            {searchedProjects.length === 0 ? (
              <tr>
                <td colSpan="14" style={{ textAlign: 'center', padding: '20px' }}>
                  No projects found.
                </td>
              </tr>
            ) : (
              searchedProjects.map((proj, idx) => (
                <ProjectTableRow
                  key={proj.id || idx}
                  proj={proj}
                  idx={idx}
                  selectedMonth={selectedMonth}
                  monthsList={monthsList}
                  getLastServicingDateFromProj={getLastServicingDateFromProj}
                />
              ))
            )}
          </tbody>

          {searchedProjects.length > 0 && (
            <tfoot>
              <tr className={`${styles.totalRow} totalRow`}>
                <td colSpan="3" className={styles.textRight}>Total:</td>
                <td className={styles.textCenter}>{tableTotals.liftQty.toLocaleString()}</td>
                <td colSpan="2"></td>
                <td className={styles.textRight}>{tableTotals.servicingBill.toLocaleString()}</td>
                <td className={styles.textRight}>{tableTotals.sparePartsBill.toLocaleString()}</td>
                <td className={styles.textRight}>{tableTotals.lastMonthDue.toLocaleString()}</td>
                <td className={styles.textRight}>{tableTotals.totalBill.toLocaleString()}</td>
                <td className={styles.textRight}>{tableTotals.collectedBill.toLocaleString()}</td>
                <td className={`${styles.textRight} ${styles.textDanger}`}>{tableTotals.totalDue.toLocaleString()}</td>
                <td colSpan="2"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

export default MainProjectTable;