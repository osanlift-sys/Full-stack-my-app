/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProjects } from '../../Fetures/Inventory/ProjectsSlice';
import { fetchAllSalesData } from '../../Fetures/Inventory/SalesSlice';
import { fetchTotalPurchase } from '../../Fetures/Inventory/TotalPurchaseSlice';
import styles from './Stocks.module.css';

const isNonStockService = (itemName) => {
  const normalizedName = String(itemName || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return /^(vat|tax|ait|service charge|service charges|commissioning|commissioning charge|commissioning charges|installation charge)( \d+( \d+)?( percent)?)?$/.test(normalizedName);
};

const isJobUnit = (unit) => String(unit || '').trim().toLowerCase() === 'job';

const getCurrentDateFilters = () => {
  const today = new Date();
  return {
    month: String(today.getMonth() + 1),
    date: [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-'),
  };
};

function Stocks() {
  const dispatch = useDispatch();
  const [initialDateFilters] = useState(getCurrentDateFilters);

  // Redux Store selectors
  const salesState = useSelector((state) => state.sales);
  const purchaseState = useSelector((state) => state.totalPurchase);
  const projectState = useSelector((state) => state.project);

  const salesList = salesState?.salesList || [];
  const purchaseItems = purchaseState?.items || [];
  const projects = projectState?.projects || [];
  const loading = salesState?.loading || purchaseState?.loading || projectState?.loading;
  const error = salesState?.error || purchaseState?.error || projectState?.error;

  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [selectedMonth, setSelectedMonth] = useState(initialDateFilters.month);
  const [selectedDate, setSelectedDate] = useState(initialDateFilters.date);

  useEffect(() => {
    dispatch(fetchAllSalesData());
    dispatch(fetchTotalPurchase());
    dispatch(fetchProjects());
  }, [dispatch]);

  // Client / Company Dropdown List
  const companyList = useMemo(() => {
    const companies = new Set();
    salesList.forEach((sale) => {
      if (sale.companyName) companies.add(sale.companyName);
    });
    projects.forEach((project) => {
      const companyName = project.whoseProjects || project.projectName;
      if (companyName) companies.add(companyName);
    });
    return Array.from(companies);
  }, [salesList, projects]);

  // Date Parsing Helper
  const parseDate = (dateVal) => {
    if (!dateVal) return null;
    if (typeof dateVal?.toDate === 'function') return dateVal.toDate();
    if (dateVal?.seconds) return new Date(dateVal.seconds * 1000);
    const parsedDate = new Date(dateVal);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  };

  // Stock & Profit Calculation Engine
  const stockData = useMemo(() => {
    const inventoryMap = {};
    const stockNamesById = new Map(
      purchaseItems.map((purchase) => [
        purchase.id,
        purchase.ItemsName || purchase.itemName || purchase.name || 'Unknown Item',
      ])
    );
    const projectUsageByItem = new Map();
    const deductedProjectQtyByStockId = new Map();

    projects.forEach((project) => {
      const companyName = project.whoseProjects || project.projectName || '';
      if (selectedCompany !== 'ALL' && companyName !== selectedCompany) return;

      (project.billList || []).forEach((bill) => {
        const stockId = bill.sparePartsStockId;
        const itemName = stockNamesById.get(stockId) || bill.sparePartsName || '';
        const itemKey = itemName.trim().toLowerCase();
        if (!itemKey) return;

        const quantity = Number(bill.sparePartsQuantity) || 0;
        const billedAmount = Number(bill.sparePartsBill) || 0;
        if (quantity <= 0 && billedAmount <= 0) return;

        const usageDate = parseDate(
          bill.lastServicingDate || bill.servicingDate || bill.date || bill.updatedAt || bill.createdAt
        );
        const billMonth = usageDate
          ? String(usageDate.getMonth() + 1)
          : String(
              [
                'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December',
              ].indexOf(bill.month) + 1
            );
        if (selectedDate && (!usageDate || usageDate.toISOString().slice(0, 10) !== selectedDate)) return;
        if (selectedMonth && billMonth !== selectedMonth) return;

        const soldQuantity = quantity > 0 ? quantity : 1;
        const unitPrice = Number(bill.sparePartsUnitPrice) || 0;
        const revenue = billedAmount || soldQuantity * unitPrice;
        const usage = projectUsageByItem.get(itemKey) || {
          name: itemName.trim(),
          quantity: 0,
          revenue: 0,
        };
        usage.quantity += soldQuantity;
        usage.revenue += revenue;
        projectUsageByItem.set(itemKey, usage);

        if (bill.sparePartsStockDeducted && stockId) {
          deductedProjectQtyByStockId.set(
            stockId,
            (deductedProjectQtyByStockId.get(stockId) || 0) + soldQuantity
          );
        }
      });
    });

    // 1. Process Purchases
    purchaseItems.forEach((purchase) => {
      const pDate = parseDate(purchase.date || purchase.createdAt);
      if (selectedDate && pDate && pDate.toISOString().split('T')[0] !== selectedDate) return;
      if (selectedMonth && pDate && (pDate.getMonth() + 1).toString() !== selectedMonth) return;

      const rawName = purchase.ItemsName || purchase.itemName || purchase.name || 'Unknown Item';
      const itemName = rawName.trim();
      if (isNonStockService(itemName) || isJobUnit(purchase.unit || purchase.Unit)) return;
      const itemKey = itemName.toLowerCase();

      if (searchTerm && !itemKey.includes(searchTerm.toLowerCase())) return;

      const projectDeductedQty = deductedProjectQtyByStockId.get(purchase.id) || 0;
      const qty = (Number(purchase.QTY || purchase.quantity) || 0) + projectDeductedQty;
      const unitPrice = Number(purchase.UnitPrice || purchase.price) || 0;
      const totalCost = qty * unitPrice;

      if (!inventoryMap[itemKey]) {
        inventoryMap[itemKey] = {
          name: itemName,
          purchasedQty: 0,
          totalPurchaseCost: 0,
          soldQty: 0,
          totalSalesRevenue: 0,
        };
      }

      inventoryMap[itemKey].purchasedQty += qty;
      inventoryMap[itemKey].totalPurchaseCost += totalCost;
    });

    // 2. Process project spare parts as stock outflow and billed sales
    projectUsageByItem.forEach((usage, itemKey) => {
      if (!inventoryMap[itemKey]) {
        inventoryMap[itemKey] = {
          name: usage.name,
          purchasedQty: usage.quantity,
          totalPurchaseCost: 0,
          soldQty: 0,
          totalSalesRevenue: 0,
        };
      }
      inventoryMap[itemKey].soldQty += usage.quantity;
      inventoryMap[itemKey].totalSalesRevenue += usage.revenue;
    });

    // 3. Process Sales
    salesList.forEach((sale) => {
      if (selectedCompany !== 'ALL' && sale.companyName !== selectedCompany) return;

      const sDate = parseDate(sale.date || sale.createdAt || sale.invoiceDate);
      if (selectedDate && sDate && sDate.toISOString().split('T')[0] !== selectedDate) return;
      if (selectedMonth && sDate && (sDate.getMonth() + 1).toString() !== selectedMonth) return;

      if (sale.items && Array.isArray(sale.items)) {
        sale.items.forEach((item) => {
          const rawName = item.name || item.itemName || 'Unknown Item';
          const itemName = rawName.trim();
          if (isNonStockService(itemName) || isJobUnit(item.unit || item.Unit)) return;
          const itemKey = itemName.toLowerCase();

          if (searchTerm && !itemKey.includes(searchTerm.toLowerCase())) return;

          const qty = Number(item.quantity || item.qty) || 0;
          const unitPrice = Number(item.price || item.unitPrice || item.rate) || 0;
          const totalRevenue = qty * unitPrice;

          if (!inventoryMap[itemKey]) {
            inventoryMap[itemKey] = {
              name: itemName,
              purchasedQty: 0,
              totalPurchaseCost: 0,
              soldQty: 0,
              totalSalesRevenue: 0,
            };
          }

          inventoryMap[itemKey].soldQty += qty;
          inventoryMap[itemKey].totalSalesRevenue += totalRevenue;
        });
      }
    });

    // 4. Final calculations per item
    return Object.values(inventoryMap).map((item) => {
      const currentStock = item.purchasedQty - item.soldQty;
      const avgPurchasePrice = item.purchasedQty > 0 ? item.totalPurchaseCost / item.purchasedQty : 0;
      const costOfGoodsSold = item.soldQty * avgPurchasePrice;
      const profit = item.totalSalesRevenue - costOfGoodsSold;
      const stockValue = currentStock * avgPurchasePrice;

      return {
        ...item,
        currentStock,
        avgPurchasePrice,
        costOfGoodsSold,
        profit,
        stockValue,
      };
    });
  }, [salesList, purchaseItems, projects, searchTerm, selectedCompany, selectedMonth, selectedDate]);

  // Overall Totals
  const totals = useMemo(() => {
    return stockData.reduce(
      (acc, item) => {
        acc.totalPurchasedQty += item.purchasedQty;
        acc.totalSoldQty += item.soldQty;
        acc.totalStock += item.currentStock;
        acc.totalRevenue += item.totalSalesRevenue;
        acc.totalProfit += item.profit;
        acc.totalStockValue += item.stockValue;
        return acc;
      },
      { totalPurchasedQty: 0, totalSoldQty: 0, totalStock: 0, totalRevenue: 0, totalProfit: 0, totalStockValue: 0 }
    );
  }, [stockData]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedCompany('ALL');
    const currentDateFilters = getCurrentDateFilters();
    setSelectedMonth(currentDateFilters.month);
    setSelectedDate(currentDateFilters.date);
  };

  if (loading) return <div className={styles.loadingState}>⏳ Loading Stock & Profit Analytics...</div>;
  if (error) return <div className={styles.errorState}>⚠️ Error: {error}</div>;

  return (
    <div className={styles.stockContainer}>
      <div className={styles.stockHeader}>
        <h2>📦 Stock & Profit Analytics Dashboard</h2>
        <p>Monitor current stock levels, inventory values, and real-time profit/loss</p>
      </div>

      {/* Summary KPI Cards */}
      <div className={styles.summaryCards}>
        <div className={`${styles.card} ${styles.profitCard}`}>
          <h4>Total Estimated Profit</h4>
          <h3 className={totals.totalProfit >= 0 ? styles.textSuccess : styles.textDanger}>
            BDT {totals.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </h3>
        </div>

        <div className={`${styles.card} ${styles.salesCard}`}>
          <h4>Total Sales Revenue</h4>
          <h3>BDT {totals.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
        </div>

        <div className={`${styles.card} ${styles.stockValCard}`}>
          <h4>Current Stock Value</h4>
          <h3>BDT {totals.totalStockValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}</h3>
        </div>

        <div className={`${styles.card} ${styles.itemsCard}`}>
          <h4>Available Stock Items</h4>
          <h3>{totals.totalStock.toLocaleString()} Pcs</h3>
        </div>
      </div>

      {/* Multi-Filter Bar */}
      <div className={styles.filterCard}>
        <div className={styles.filterGrid}>
          <div className={styles.filterItem}>
            <label>🔍 Item Name:</label>
            <input
              type="text"
              placeholder="Search product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className={styles.filterItem}>
            <label>🏢 Client / Company:</label>
            <select value={selectedCompany} onChange={(e) => setSelectedCompany(e.target.value)}>
              <option value="ALL">All Clients</option>
              {companyList.map((comp, idx) => (
                <option key={idx} value={comp}>
                  {comp}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.filterItem}>
            <label>🗓️ Month:</label>
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
              <option value="">All Months</option>
              <option value="1">January</option>
              <option value="2">February</option>
              <option value="3">March</option>
              <option value="4">April</option>
              <option value="5">May</option>
              <option value="6">June</option>
              <option value="7">July</option>
              <option value="8">August</option>
              <option value="9">September</option>
              <option value="10">October</option>
              <option value="11">November</option>
              <option value="12">December</option>
            </select>
          </div>

          <div className={styles.filterItem}>
            <label>📅 Specific Date:</label>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
          </div>

          <div className={`${styles.filterItem} ${styles.btnBox}`}>
            <button className={styles.resetBtn} onClick={resetFilters}>
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Stock & Profit Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.stockTable}>
          <thead>
            <tr>
              <th className={styles.textCenter} style={{ width: '60px' }}>S.L</th>
              <th>Item Description</th>
              <th className={styles.textCenter}>Purchased Qty</th>
              <th className={styles.textCenter}>Sold Qty</th>
              <th className={styles.textCenter}>Stock In Hand</th>
              <th className={styles.textRight}>Avg Purchase Price</th>
              <th className={styles.textRight}>Sales Revenue</th>
              <th className={styles.textRight}>Profit / Loss</th>
            </tr>
          </thead>
          <tbody>
            {stockData.length > 0 ? (
              stockData.map((item, index) => (
                <tr key={index}>
                  <td className={`${styles.textCenter} ${styles.bold}`}>{index + 1}</td>
                  <td className={styles.bold}>{item.name}</td>
                  <td className={styles.textCenter}>{item.purchasedQty}</td>
                  <td className={styles.textCenter}>{item.soldQty}</td>
                  <td className={styles.textCenter}>
                    <span
                      className={`${styles.badgeStock} ${
                        item.currentStock < 0 ? styles.badgeNegative : styles.badgePositive
                      }`}
                    >
                      {item.currentStock}
                    </span>
                  </td>
                  <td className={styles.textRight}>BDT {item.avgPurchasePrice.toFixed(2)}</td>
                  <td className={styles.textRight}>BDT {item.totalSalesRevenue.toFixed(2)}</td>
                  <td
                    className={`${styles.textRight} ${styles.bold} ${
                      item.profit >= 0 ? styles.textSuccess : styles.textDanger
                    }`}
                  >
                    BDT {item.profit.toFixed(2)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className={`${styles.textCenter} ${styles.noData}`}>
                  No inventory records matched your filters.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan="2" className={`${styles.textRight} ${styles.bold}`}>
                Total Summary:
              </td>
              <td className={`${styles.textCenter} ${styles.bold}`}>{totals.totalPurchasedQty}</td>
              <td className={`${styles.textCenter} ${styles.bold}`}>{totals.totalSoldQty}</td>
              <td className={`${styles.textCenter} ${styles.bold} ${styles.textPrimary}`}>{totals.totalStock}</td>
              <td></td>
              <td className={`${styles.textRight} ${styles.bold}`}>
                BDT {totals.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
              <td
                className={`${styles.textRight} ${styles.bold} ${
                  totals.totalProfit >= 0 ? styles.textSuccess : styles.textDanger
                }`}
              >
                BDT {totals.totalProfit.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default Stocks;