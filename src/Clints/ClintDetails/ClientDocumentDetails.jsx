import { Fragment, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import footer from '../../assets/Footer.png';
import header from '../../assets/header.png';
import seal from '../../assets/Seal.png';
import signature from '../../assets/signature.png';
import {
  fetchOfferList,
  fetchSalesList,
  selectClientDetailsByName,
} from '../../Fetures/Inventory/clientSlice';
import './ClientDocumentDetails.css';

const normalizeId = (value) => String(value ?? '').trim().toLowerCase();
const toNumber = (value) => Number(String(value ?? 0).replace(/,/g, '')) || 0;

const documentIds = (document) =>
  [
    document?.id,
    document?.docId,
    document?.offerNo,
    document?.offerId,
    document?.billNo,
    document?.invoiceNo,
    document?.challanNo,
  ]
    .map(normalizeId)
    .filter(Boolean);

const relatedOfferIds = (document) =>
  [document?.offerId, document?.offerNo, document?.offerDocId]
    .map(normalizeId)
    .filter(Boolean);

const getItems = (document) => {
  const items = document?.items || document?.products || [];
  return Array.isArray(items)
    ? items.map((item) => ({
        name: item.name || item.itemName || item.description || item.productName || '',
      quantity: toNumber(item.quantity ?? item.qty ?? item.count),
        unit: item.unit || item.Unit || 'Pcs',
      price: toNumber(item.price ?? item.unitPrice ?? item.rate ?? item.amount),
      }))
    : [];
};

const getTotal = (document, items) => {
  const storedTotal =
    document?.grandTotal ??
    document?.totalAmount ??
    document?.totalBill ??
    document?.billAmount ??
    document?.offerTotal;
  if (storedTotal !== undefined && storedTotal !== null && storedTotal !== '') {
    return toNumber(storedTotal);
  }
  return items.reduce((sum, item) => sum + item.quantity * item.price, 0);
};

const formatDate = (value) => {
  if (!value) return '-';
  if (typeof value === 'object' && value.seconds) {
    value = new Date(value.seconds * 1000);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).split('T')[0];
  return date.toLocaleDateString('en-GB');
};

const getDocumentHeader = (document, clientName, type) => {
  const data = document?.headerData || {};
  return {
    date: formatDate(data.date || document?.date || document?.createdAt),
    company: data.toCompany || document?.toCompany || document?.companyName || clientName,
    address: data.address || document?.address || '',
    subject:
      data.subject ||
      document?.subject ||
      (type === 'challan' ? 'Delivery Challan' : type === 'invoice' ? 'Bill / Invoice for Goods & Services' : ''),
    reference: data.purchaseOrderNo || data.workOrderNo || document?.purchaseOrderNo || document?.workOrderNo || '',
  };
};

function DocumentPaper({ type, document, number, clientName }) {
  const items = getItems(document);
  const total = getTotal(document, items);
  const info = getDocumentHeader(document, clientName, type);
  const isChallan = type === 'challan';
  const isOffer = type === 'offer';
  const paid = Array.isArray(document?.paymentHistory)
    ? document.paymentHistory.reduce((sum, payment) => sum + toNumber(payment.amount), 0)
    : toNumber(document?.paidAmount ?? document?.receivedAmount ?? document?.totalReceived);
  const due = Math.max(toNumber(document?.dueAmount ?? total - paid), 0);
  const notes = Array.isArray(document?.notes) ? document.notes : [];

  return (
    <article className="client-document-paper">
      <div className="client-document-header">
        <img src={header} alt="OSAN LIFT" />
      </div>
      <h3 className="client-document-type">
        {isOffer ? 'PRICE OFFER' : isChallan ? 'DELIVERY CHALLAN' : 'BILL / INVOICE'}
      </h3>

      <section className="client-document-info">
        <div className="client-document-meta">
          <span>
            <strong>{isOffer ? 'Offer No' : isChallan ? 'Challan No' : 'Invoice No'}: </strong>
            {number}
          </span>
          <span><strong>Date: </strong>{info.date}</span>
        </div>
        {info.reference && (
          <p><strong>Purchase Order / Ref: </strong>{info.reference}</p>
        )}
        <div className="client-document-to">
          <strong>To,</strong>
          <div className="client-document-bold">{info.company}</div>
          {info.address && <div>{info.address}</div>}
        </div>
        {info.subject && (
          <p className="client-document-subject"><strong>Subject: </strong>{info.subject}</p>
        )}
        <p className="client-document-greeting">
          Dear Sir,<br />
          {isOffer
            ? 'We are pleased to submit our best price offer for your consideration:'
            : isChallan
              ? 'Please receive the following goods/materials in good condition:'
              : 'We would like to submit our bill as per the following basis:'}
        </p>
      </section>

      <table className="client-document-table">
        <thead>
          <tr>
            <th>SL</th>
            <th>Description of Items</th>
            <th>Qty</th>
            <th>Unit</th>
            {!isChallan && <th>Price (BDT)</th>}
            {!isChallan && <th>Total (BDT)</th>}
          </tr>
        </thead>
        <tbody>
          {items.length ? items.map((item, index) => (
            <tr key={`${item.name}-${index}`}>
              <td>{index + 1}</td>
              <td>{item.name || '-'}</td>
              <td>{item.quantity}</td>
              <td>{item.unit}</td>
              {!isChallan && <td>{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>}
              {!isChallan && (
                <td>{(item.quantity * item.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
              )}
            </tr>
          )) : (
            <tr>
              <td colSpan={isChallan ? 4 : 6}>No item details recorded.</td>
            </tr>
          )}
          {!isChallan && (
            <tr className="client-document-total">
              <td colSpan="5"><strong>Grand Total (BDT)</strong></td>
              <td><strong>{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong></td>
            </tr>
          )}
        </tbody>
      </table>

      {!isChallan && (
        <div className="client-document-summary">
          <p><strong>In Words / Amount: </strong>{total.toLocaleString('en-IN')} BDT</p>
          {!isOffer && (
            <>
              <p><strong>Paid / Advance Amount: </strong>{paid.toLocaleString('en-IN')} BDT</p>
              <p><strong>Net Due Amount: </strong>{due.toLocaleString('en-IN')} BDT</p>
            </>
          )}
          {notes.length > 0 && (
            <div>
              <strong>Terms & Conditions:</strong>
              <ol>{notes.map((note, index) => <li key={`${note}-${index}`}>{note}</li>)}</ol>
            </div>
          )}
          {document?.paymentMode && (
            <p><strong>Mode of Payment: </strong>
              {Array.isArray(document.paymentMode)
                ? document.paymentMode.join(' ')
                : Object.values(document.paymentMode).filter(Boolean).join(' ')}
            </p>
          )}
        </div>
      )}

      <div className="client-document-footer">
        <div className="client-document-signatures">
          <div className="client-document-sender">
            <div className="client-document-seal">
              <img src={seal} alt="Company seal" />
              <img src={signature} alt="Authorized signature" />
            </div>
            <p className="client-document-thanks">Thanking You. Yours Truly</p>
          </div>
          <span className="client-document-receiver">Receiver&apos;s Signature &amp; Seal</span>
        </div>
        <img className="client-document-footer-image" src={footer} alt="Company contact details" />
      </div>
    </article>
  );
}

function ClientDocumentDetails() {
  const { clientName, docId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const clientData = useSelector(selectClientDetailsByName(clientName));
  const loading = useSelector((state) => state.client.loading);
  const error = useSelector((state) => state.client.error);
  const requestedId = normalizeId(docId);

  useEffect(() => {
    dispatch(fetchOfferList());
    dispatch(fetchSalesList());
  }, [dispatch]);

  const { offers, invoices } = useMemo(() => {
    const allOffers = clientData?.offers || [];
    const allSales = clientData?.sales || [];
    const directOffers = allOffers.filter((offer) => documentIds(offer).includes(requestedId));
    const directSales = allSales.filter((sale) => documentIds(sale).includes(requestedId));
    const offerKeys = new Set([
      requestedId,
      ...directOffers.flatMap(documentIds),
      ...directSales.flatMap(relatedOfferIds),
    ]);
    const offers = allOffers.filter((offer) =>
      documentIds(offer).some((id) => offerKeys.has(id))
    );
    const invoiceKeys = new Set([
      requestedId,
      ...offers.flatMap(documentIds),
    ]);
    const invoices = allSales.filter((sale) =>
      documentIds(sale).some((id) => invoiceKeys.has(id)) ||
      relatedOfferIds(sale).some((id) => invoiceKeys.has(id))
    );
    return { offers, invoices };
  }, [clientData, requestedId]);

  const goBack = () => navigate(`/Clints/ClientDetails/${encodeURIComponent(clientData?.clientName || clientName)}`);

  if (!clientData && loading) {
    return <div className="client-document-page"><p>Loading client documents...</p></div>;
  }

  if (!clientData) {
    return (
      <div className="client-document-page">
        <button type="button" className="client-document-back" onClick={() => navigate('/Clints/ClintList')}>
          Back to Client List
        </button>
        <p>{error || 'Client records could not be loaded.'}</p>
      </div>
    );
  }

  return (
    <div className="client-document-page">
      <div className="client-document-page-heading">
        <button type="button" className="client-document-back" onClick={goBack}>← Back to Client Ledger</button>
        <h2>{clientData.clientName} — Document ID: {docId}</h2>
      </div>
      {error && <p className="client-document-error">{error}</p>}
      <div className="client-document-output">
        {offers.map((offer, index) => {
          const key = documentIds(offer)[0] || `${requestedId}-offer-${index}`;
          const number = offer.offerNo || offer.headerData?.offerNo || offer.id || docId;
          return (
            <Fragment key={`offer-${key}`}>
              <DocumentPaper type="offer" document={offer} number={number} clientName={clientData.clientName} />
              <DocumentPaper
                type="challan"
                document={offer}
                number={offer.challanNo || number}
                clientName={clientData.clientName}
              />
            </Fragment>
          );
        })}
        {invoices.map((invoice, index) => {
          const key = documentIds(invoice)[0] || `${requestedId}-invoice-${index}`;
          return (
            <DocumentPaper
              key={`invoice-${key}`}
              type="invoice"
              document={invoice}
              number={invoice.billNo || invoice.invoiceNo || invoice.offerNo || invoice.id || docId}
              clientName={clientData.clientName}
            />
          );
        })}
        {offers.length === 0 && invoices.length === 0 && (
          <p className="client-document-empty">No offer, challan, or invoice records found for this ID.</p>
        )}
      </div>
    </div>
  );
}

export default ClientDocumentDetails;
