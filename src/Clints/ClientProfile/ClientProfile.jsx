import { useEffect, useState } from "react";
import { fetchAllPages } from "../../api/apiResources";
import { apiClient, getApiErrorMessage } from "../../api/apiClient";
import styles from "./ClientProfile.module.css";

const initialData = {
  user: null,
  dashboard: null,
  bills: [],
  offers: [],
  orders: [],
  projects: [],
  supportRequests: [],
};

const formatMoney = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT" }).format(amount)
    : "৳0.00";
};

const formatDate = (value) => {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not available" : date.toLocaleDateString();
};

const displayValue = (value) => value || "Not provided";

function DataSection({ title, count, children, emptyText }) {
  return (
    <section className={styles.dataSection}>
      <div className={styles.sectionHeading}>
        <h2>{title}</h2>
        <span>{count}</span>
      </div>
      {count ? <div className={styles.recordList}>{children}</div> : <p className={styles.empty}>{emptyText}</p>}
    </section>
  );
}

function ClientProfile() {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([
      apiClient.get("/auth/me"),
      apiClient.get("/reports/dashboard"),
      fetchAllPages("/bills"),
      fetchAllPages("/offers"),
      fetchAllPages("/orders"),
      fetchAllPages("/projects"),
      fetchAllPages("/support/requests"),
    ])
      .then(([profileResponse, dashboardResponse, bills, offers, orders, projects, supportRequests]) => {
        if (!active) return;
        setData({
          user: profileResponse.data.user,
          dashboard: dashboardResponse.data,
          bills,
          offers,
          orders,
          projects,
          supportRequests,
        });
      })
      .catch((requestError) => {
        if (active) setError(getApiErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className={styles.stateMessage} role="status">Loading your client profile...</div>;
  }
  if (error) {
    return <div className={styles.stateMessage} role="alert">{error}</div>;
  }

  const { user, dashboard, bills, offers, orders, projects, supportRequests } = data;
  const companies = user?.companies || [];

  return (
    <div className={styles.profilePage}>
      <header className={styles.profileHeader}>
        <div className={styles.avatar} aria-hidden="true">
          {(user?.name || user?.email || "C").trim().charAt(0).toUpperCase()}
        </div>
        <div className={styles.identity}>
          <p className={styles.eyebrow}>CLIENT ACCOUNT</p>
          <h1>{displayValue(user?.name)}</h1>
          <p>{displayValue(user?.email)}</p>
        </div>
        <span className={styles.status}>{user?.status || "Active"}</span>
      </header>

      <section className={styles.accountSection}>
        <div className={styles.sectionHeading}>
          <h2>Account &amp; company</h2>
          <span>{companies.length} {companies.length === 1 ? "company" : "companies"}</span>
        </div>
        {companies.length ? (
          <div className={styles.companyGrid}>
            {companies.map((company) => (
              <article className={styles.companyCard} key={company.id}>
                <h3>{company.name}</h3>
                <dl>
                  <div><dt>Address</dt><dd>{displayValue(company.address)}</dd></div>
                  <div><dt>Phone</dt><dd>{displayValue(company.phone)}</dd></div>
                  <div><dt>Email</dt><dd>{displayValue(company.email)}</dd></div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No company is linked to this account yet.</p>
        )}
      </section>

      <section className={styles.summaryGrid} aria-label="Client account summary">
        <article className={styles.summaryCard}>
          <span>Invoices</span>
          <strong>{dashboard?.billCount ?? bills.length}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Total billed</span>
          <strong>{formatMoney(dashboard?.billedAmount)}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Paid</span>
          <strong>{formatMoney(dashboard?.paidAmount)}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Outstanding</span>
          <strong>{formatMoney(dashboard?.outstandingAmount)}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Orders</span>
          <strong>{dashboard?.orderCount ?? orders.length}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Offers</span>
          <strong>{offers.length}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Projects</span>
          <strong>{projects.length}</strong>
        </article>
        <article className={styles.summaryCard}>
          <span>Open support requests</span>
          <strong>{dashboard?.openSupportCount ?? 0}</strong>
        </article>
      </section>

      <div className={styles.dataGrid}>
        <DataSection title="Invoices" count={bills.length} emptyText="No invoices found.">
          {bills.map((bill) => (
            <article className={styles.recordCard} key={bill.id}>
              <div><h3>{bill.billNo || bill.subject || "Invoice"}</h3><span>{bill.status || bill.paymentStatus}</span></div>
              <p>{bill.companyName} · {formatDate(bill.date || bill.createdAt)}</p>
              <p>Total {formatMoney(bill.grandTotal)} · Paid {formatMoney(bill.paidAmount)} · Due {formatMoney(bill.dueAmount)}</p>
            </article>
          ))}
        </DataSection>

        <DataSection title="Offers" count={offers.length} emptyText="No offers found.">
          {offers.map((offer) => (
            <article className={styles.recordCard} key={offer.docId || offer.id}>
              <div><h3>{offer.offerNo || "Offer"}</h3><span>{formatDate(offer.createdAt)}</span></div>
              <p>{offer.subject || offer.companyName}</p>
              <p>Amount {formatMoney(offer.grandTotal)}</p>
            </article>
          ))}
        </DataSection>

        <DataSection title="Orders" count={orders.length} emptyText="No orders found.">
          {orders.map((order) => (
            <article className={styles.recordCard} key={order.id}>
              <div><h3>Order {order.id}</h3><span>{order.status}</span></div>
              <p>{order.company?.name || "Company"} · {formatDate(order.createdAt)}</p>
              <p>{order.items?.length || 0} items · Total {formatMoney(order.totalAmount)} · Due {formatMoney(order.dueAmount)}</p>
            </article>
          ))}
        </DataSection>

        <DataSection title="Projects" count={projects.length} emptyText="No projects found.">
          {projects.map((project) => (
            <article className={styles.recordCard} key={project.id}>
              <div><h3>{project.projectName}</h3><span>{project.status}</span></div>
              <p>{project.company?.name || "Company"} · {project.liftQuantity ?? 0} lifts</p>
              <p>Service date {formatDate(project.servicingDate)}</p>
            </article>
          ))}
        </DataSection>

        <DataSection title="Support requests" count={supportRequests.length} emptyText="No support requests found.">
          {supportRequests.map((request) => (
            <article className={styles.recordCard} key={request.id}>
              <div><h3>{request.serviceTitle}</h3><span>{request.status}</span></div>
              <p>{request.problemDetails}</p>
              <p>Updated {formatDate(request.updatedAt)}</p>
              {request.grandTotal && <p>Quotation {formatMoney(request.grandTotal)}</p>}
            </article>
          ))}
        </DataSection>
      </div>
    </div>
  );
}

export default ClientProfile;
