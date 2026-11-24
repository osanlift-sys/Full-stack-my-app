import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { NavLink } from 'react-router-dom';
import {
  fetchOfferList,
  fetchSalesList,
  selectClientSummaryTotalsByMonth,
  selectFilteredClientsByMonth,
  setSearchTerm,
  setStatusFilter,
} from '../../Fetures/Inventory/clientSlice';
import { downloadInvoicePDF } from '../../HndlePDF/HndlePDF';
import './ClintList.css';

function ClintList() {
  const dispatch = useDispatch();
  const printRef = useRef(null);
  const [filterMonth, setFilterMonth] = useState('');
  const [isPdfPrinting, setIsPdfPrinting] = useState(false);

  useEffect(() => {
    dispatch(fetchOfferList());
    dispatch(fetchSalesList());
  }, [dispatch]);

  const loading = useSelector((state) => state.client.loading);
  const searchTerm = useSelector((state) => state.client.searchTerm);
  const statusFilter = useSelector((state) => state.client.statusFilter);
  const filteredClients = useSelector((state) =>
    selectFilteredClientsByMonth(state, filterMonth)
  );
  const totals = useSelector((state) =>
    selectClientSummaryTotalsByMonth(state, filterMonth)
  );

  const handleDownloadPDF = () => {
    if (filteredClients.length === 0) {
      alert('PDF তৈরি করার মতো কোনো ডাটা পাওয়া যায়নি!');
      return;
    }

    downloadInvoicePDF({
      elementRef: printRef,
      fileName: `Client_Summary_${filterMonth || 'All_Months'}_${new Date()
        .toISOString()
        .slice(0, 10)}`,
      setIsPdfPrinting,
    });
  };

  return (
    <div className="client-list-container">
      {/* Filter and Search Bar */}
      <div className="filter-wrapper">
        <input
          type="text"
          className="search-input"
          placeholder="Search by Client/Company Name..."
          value={searchTerm}
          onChange={(e) => dispatch(setSearchTerm(e.target.value))}
        />

        <select
          className="status-select"
          value={statusFilter}
          onChange={(e) => dispatch(setStatusFilter(e.target.value))}
        >
          <option value="ALL">All Clients</option>
          <option value="DUE">Due Only</option>
          <option value="PAID">Paid / No Due</option>
        </select>

        <input
          type="month"
          className="month-filter"
          aria-label="Filter clients by month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
        />

        <button
          type="button"
          className="btn-pdf"
          onClick={handleDownloadPDF}
          disabled={isPdfPrinting}
        >
          {isPdfPrinting ? '⏳ Generating PDF...' : '📄 Download PDF'}
        </button>
      </div>

      <div ref={printRef} className={`printable-content ${isPdfPrinting ? 'pdf-downloading' : ''}`}>
        <div className="pdf-company-header">
          <h2>OSAN LIFT</h2>
          <h3>Client Summary &amp; Ledger</h3>
          <p>
            {filterMonth ? `Month: ${filterMonth}` : 'All Months'} | Generated:{' '}
            {new Date().toLocaleDateString('en-GB')}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="summary-cards">
          <div className="card offer-card">
            <h4>Total Offered</h4>
            <p>৳ {totals.totalOffer.toLocaleString('en-IN')}</p>
          </div>
          <div className="card bill-card">
            <h4>Total Billed</h4>
            <p>৳ {totals.totalBill.toLocaleString('en-IN')}</p>
          </div>
          <div className="card received-card">
            <h4>Total Received</h4>
            <p>৳ {totals.totalReceived.toLocaleString('en-IN')}</p>
          </div>
          <div className="card due-card">
            <h4>Total Outstanding Due</h4>
            <p>৳ {totals.totalDue.toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Client Table */}
        <div className="table-responsive">
          <table className="client-table">
            <thead>
              <tr>
                <th>SL</th>
                <th>Client / Company Name</th>
                <th>Total Offer</th>
                <th>Total Billed</th>
                <th>Total Received</th>
                <th>Current Due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="no-data">Loading......</td>
                </tr>
              ) : filteredClients.length > 0 ? (
                filteredClients.map((client, index) => (
                  <tr key={client.clientName || index}>
                    <td>{index + 1}</td>
                    <td className="font-bold">
                      <NavLink to={`/Clints/ClientDetails/${encodeURIComponent(client.clientName)}`} style={{color:"#333",fontSize:"14px"}}>
                        {client.clientName}
                      </NavLink>
                    </td>
                    <td>৳ {client.totalOffer.toLocaleString('en-IN')}</td>
                    <td>৳ {client.totalBill.toLocaleString('en-IN')}</td>
                    <td className="text-success">৳ {client.totalReceived.toLocaleString('en-IN')}</td>
                    <td className={client.totalDue > 0 ? 'text-danger font-bold' : ''}>
                      ৳ {client.totalDue.toLocaleString('en-IN')}
                    </td>
                    <td>
                      <span className={`status-badge ${client.totalDue > 0 ? 'badge-due' : 'badge-paid'}`}>
                        {client.totalDue > 0 ? 'Due' : 'Clear'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="no-data">No Clients Found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default ClintList;