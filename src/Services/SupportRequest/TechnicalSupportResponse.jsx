import { ExternalLink, Plus, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSelectedRequest } from '../../Fetures/Inventory/supportSlice';
import { apiClient, getApiErrorMessage } from '../../api/apiClient';
import styles from './TechnicalSupportResponse.module.css';

export default function TechnicalSupportResponse() {
  const dispatch = useDispatch();

  const requests = useSelector((state) => state.support?.supportRequests || []);
  const selectedReq = useSelector((state) => state.support?.selectedRequest);

  const [items, setItems] = useState([{ name: '', qty: 1, price: 0, total: 0 }]);
  const [suggestion, setSuggestion] = useState('');
  const [generatedLink, setGeneratedLink] = useState('');
  const [status, setStatus] = useState('pending'); // Status Local State
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (selectedReq) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestion(selectedReq.suggestion || '');
      setStatus(selectedReq.status || 'pending');
      if (selectedReq.quotationItems && selectedReq.quotationItems.length > 0) {
        setItems(selectedReq.quotationItems);
      } else {
        setItems([{ name: '', qty: 1, price: 0, total: 0 }]);
      }

      if (selectedReq.hasUnreadNotification) {
        apiClient.patch(`/support/requests/${encodeURIComponent(selectedReq.id)}/read`)
          .catch((error) => setErrorMessage(getApiErrorMessage(error)));
      }
    }
  }, [selectedReq]);

  const handleSelectRequest = (req) => {
    dispatch(setSelectedRequest(req));
  };

  const handleStatusChange = async (newStatus) => {
    if (!selectedReq) return;
    try {
      const apiStatus = {
        pending: 'OPEN',
        in_progress: 'IN_REVIEW',
        responded: 'QUOTED',
        complete: 'COMPLETE',
        rejected: 'REJECTED',
      }[newStatus];
      await apiClient.patch(`/support/requests/${encodeURIComponent(selectedReq.id)}/status`, {
        status: apiStatus,
      });
      setStatus(newStatus);
      setErrorMessage('');
      alert(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error("Error updating status:", error);
      setErrorMessage(getApiErrorMessage(error));
    }
  };

  const handleItemChange = (index, field, value) => {
    const updated = items.map((item, itemIndex) =>
      itemIndex === index ? { ...item, [field]: value } : item
    );

    if (field === 'qty' || field === 'price') {
      const qty = Number(updated[index].qty) || 0;
      const price = Number(updated[index].price) || 0;
      updated[index].total = qty * price;
    }
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([...items, { name: '', qty: 1, price: 0, total: 0 }]);
  };

  const handleRemoveItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSendResponse = async () => {
    if (!selectedReq) return;
    if (
      items.length === 0 ||
      items.some((item) =>
        !String(item.name || '').trim() ||
        !Number.isFinite(Number(item.qty)) ||
        Number(item.qty) <= 0 ||
        !Number.isFinite(Number(item.price)) ||
        Number(item.price) < 0
      )
    ) {
      setErrorMessage('Add at least one quotation item with a description, positive quantity, and non-negative price.');
      return;
    }

    const quotationUrl = `${window.location.origin}/technical-support-quotation/${selectedReq.id}`;

    try {
      await apiClient.post(`/support/requests/${encodeURIComponent(selectedReq.id)}/quotations`, {
        items: items.map((item) => ({
          name: item.name,
          qty: String(item.qty),
          price: String(item.price),
        })),
        suggestion,
        status: 'SENT',
      });
      setStatus('responded');
      setErrorMessage('');

      setGeneratedLink(quotationUrl);

      const whatsappText = encodeURIComponent(
        `Hello ${selectedReq.userName},\nWe have prepared the quotation for your request (${selectedReq.serviceTitle}).\n\nView and Download Quotation Here: ${quotationUrl}`
      );

      const cleanPhone = selectedReq.whatsapp.replace(/[^0-9]/g, '');
      const formattedPhone = cleanPhone.startsWith('0') ? `88${cleanPhone}` : cleanPhone;

      window.open(`https://wa.me/${formattedPhone}?text=${whatsappText}`, '_blank');
    } catch (error) {
      console.error("Error saving response:", error);
      setErrorMessage(getApiErrorMessage(error));
    }
  };

  return (
    <div className={styles.adminResponseContainer} onClick={(event) => event.stopPropagation()}>
      {/* Sidebar Request List */}
      <div className={styles.requestsSidebar}>
        <h3>Support Requests</h3>
        {requests.map((req) => (
          <div
            key={req.id}
            className={`${styles.requestCard} ${selectedReq?.id === req.id ? styles.active : ''}`}
            onClick={() => handleSelectRequest(req)}
          >
            <strong>{req.userName}</strong>
            <p>{req.serviceTitle}</p>
            <div className={styles.cardFooter}>
              <small>{req.whatsapp}</small>
              <span className={`${styles.statusBadge} ${styles[req.status || 'pending']}`}>
                {req.status || 'pending'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className={styles.responseMain}>
        {selectedReq ? (
          <div className={styles.twoColLayout}>
            {errorMessage && <p role="alert" className={styles.errorMessage}>{errorMessage}</p>}
            {/* Left: User Request Details */}
            <div className={styles.userRequestDetails}>
              <h2>User Request Details</h2>
              <div className={styles.detailRow}>
                <strong>Name:</strong> {selectedReq.userName}
              </div>
              <div className={styles.detailRow}>
                <strong>Email:</strong> {selectedReq.email}
              </div>
              <div className={styles.detailRow}>
                <strong>WhatsApp:</strong> {selectedReq.whatsapp}
              </div>
              <div className={styles.detailRow}>
                <strong>Service:</strong> {selectedReq.serviceTitle}
              </div>
              <div className={styles.detailRow}>
                <strong>Problem:</strong> {selectedReq.problemDetails}
              </div>

              {/* Request Status Dropdown */}
              <div className={styles.detailRow} style={{ marginTop: '16px' }}>
                <strong>Request Status:</strong>
                <select
                  className={styles.statusSelect}
                  value={status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                >
                  <option value="pending">Pending</option>
                  <option value="responded">Responded</option>
                  <option value="in_progress">In Progress</option>
                  <option value="complete">Complete</option>
                </select>
              </div>

              {selectedReq.attachments?.length > 0 && (
                <div className={styles.picPreview}>
                  {selectedReq.attachments.map((attachment) => (
                    <a key={attachment.id} href={attachment.downloadUrl} target="_blank" rel="noreferrer">
                      {attachment.originalName}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Answer / Quotation Form */}
            <div className={styles.adminAnswerForm}>
              <h2>Create Quotation & Response</h2>

              <table className={styles.itemsTable}>
                <thead>
                  <tr>
                    <th>Item Name</th>
                    <th style={{ width: '75px' }}>Qty</th>
                    <th style={{ width: '90px' }}>Price</th>
                    <th style={{ width: '70px' }}>Total</th>
                    <th style={{ width: '40px' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={index}>
                      <td>
                        <input
                          type="text"
                          className={styles.inputField}
                          value={item.name}
                          onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                          placeholder="Item description"
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className={styles.inputField}
                          value={item.qty}
                          onChange={(e) => handleItemChange(index, 'qty', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          className={styles.inputField}
                          value={item.price}
                          onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                        />
                      </td>
                      <td>
                        <strong>৳{item.total}</strong>
                      </td>
                      <td>
                        <button className={styles.deleteBtn} onClick={() => handleRemoveItem(index)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button className={styles.addRowBtn} onClick={handleAddItem}>
                <Plus size={16} /> Add Item
              </button>

              <div className={styles.suggestionBox}>
                <label>Engineering Suggestion / Note:</label>
                <textarea
                  rows="3"
                  value={suggestion}
                  onChange={(e) => setSuggestion(e.target.value)}
                  placeholder="Enter suggestions or technical notes..."
                />
              </div>

              <button className={styles.sendBtn} onClick={handleSendResponse}>
                <Send size={16} /> Save & Send to WhatsApp
              </button>

              {generatedLink && (
                <div className={styles.linkBox}>
                  <p>Quotation Link Generated:</p>
                  <a href={generatedLink} target="_blank" rel="noreferrer">
                    {generatedLink} <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.emptySelection}>
            Please select a support request from the left sidebar to view details and create a response.
          </div>
        )}
      </div>
    </div>
  );
}