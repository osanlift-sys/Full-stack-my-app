import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchProjects,
  saveAllProjectsToApi,
  setSelectedMonth,
  setSelectedWhoseProject,
  updateProjectServicingStatus,
} from '../../Fetures/Inventory/ProjectsSlice';
import styles from './Serviced_and_Schedule.module.css';

// Sub Components
import EditModal from '../Project/Component/EditModal';
import HeaderBar from '../Project/Component/HeaderBar';
import MainProjectTable from '../Project/Component/MainProjectTable';
import SummaryCards from '../Project/Component/SummaryCards';
import UpcomingScheduleAlert from '../Project/Component/UpcomingScheduleAlert';

const monthsList = ['All', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const Serviced_and_Schedule = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth || {});
  const { 
    projects = [], 
    selectedMonth = 'All', 
    selectedWhoseProject = 'All', 
    loading = false 
  } = useSelector((state) => state.project || {});

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [dueFilter, setDueFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const initializedMonth = useRef(false);

  // Permission & Admin States
  const hasPermission = (featureKey) => {
    return user?.backendRole === 'ADMIN' || Boolean(user?.permissions?.[featureKey]);
  };

  const initialFormState = {
    projectName: '',
    liftQty: '', 
    whoseProjects: '',
    address: '',
    phoneNo: '',
    month: 'September',
    servicingBill: '',
    sparePartsBill: '',
    lastMonthDue: '',
    collectedBill: '',
    collectedBy: '',
    approvedBy: '',
    servicedBy: '',
    lastServicingDate: '',
    servicingStatus: 'Pending'
  };

  const [formData, setFormData] = useState(initialFormState);

  useEffect(() => {
    dispatch(fetchProjects());
  }, [dispatch]);

  useEffect(() => {
    if (!initializedMonth.current) {
      initializedMonth.current = true;
      if (selectedMonth === 'All') {
        dispatch(setSelectedMonth(monthsList[new Date().getMonth() + 1]));
      }
    }
  }, [dispatch, selectedMonth]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const getLastServicingDateFromProj = (proj, targetMonth = 'All') => {
    if (!proj) return '';
    const bills = proj.billList || [];
    
    if (targetMonth !== 'All') {
      const currentBill = bills.find(b => b.month === targetMonth);
      if (currentBill) {
        const date = currentBill.lastServicingDate || currentBill.servicingDate;
        if (date) return date;
      }
    }

    for (let i = bills.length - 1; i >= 0; i--) {
      const d = bills[i].lastServicingDate || bills[i].servicingDate;
      if (d) return d;
    }

    return proj.lastServicingDate || proj.servicingDate || '';
  };

  const handleEdit = (proj) => {
    if (!hasPermission('projects_action_update')) {
      alert("You don't have permission to edit projects.");
      return;
    }

    setEditingId(proj.id);
    const activeMonth = selectedMonth === 'All' ? monthsList[new Date().getMonth() + 1] : selectedMonth;
    const currentBill = (proj.billList || []).find(b => b.month === activeMonth) || {};
    
    const existingDate = getLastServicingDateFromProj(proj, activeMonth);

    setFormData({
      projectName: proj.projectName || '',
      liftQty: proj.liftQty || '',
      whoseProjects: proj.whoseProjects || '',
      address: proj.address || '',
      phoneNo: proj.phoneNo || '',
      month: activeMonth,
      servicingBill: currentBill.servicingBill || '',
      sparePartsBill: currentBill.sparePartsBill || '',
      lastMonthDue: currentBill.lastMonthDue || '',
      collectedBill: currentBill.collectedBill || '',
      collectedBy: currentBill.collectedBy || '',
      approvedBy: currentBill.approvedBy || '',
      servicedBy: currentBill.servicedBy || '',
      lastServicingDate: existingDate,
      servicingStatus: currentBill.servicingStatus || 'Pending'
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingId) return;
    if (!hasPermission('projects_action_update')) {
      alert("You don't have permission to save projects.");
      return;
    }

    try {
      await dispatch(updateProjectServicingStatus({
        projectId: editingId,
        month: formData.month,
        servicingStatus: formData.servicingStatus,
        lastServicingDate: formData.lastServicingDate
      })).unwrap();
      setShowModal(false);
      setEditingId(null);
      setFormData(initialFormState);
    } catch (error) {
      alert(`Update failed: ${error?.message || error}`);
    }
  };

  const handleSaveToApi = () => {
    if (!hasPermission('projects_action_save')) {
      alert("You don't have permission to save projects.");
      return;
    }

    dispatch(saveAllProjectsToApi())
      .unwrap()
      .then(() => alert('All projects saved successfully!'))
      .catch((err) => alert('Save failed: ' + err));
  };

  const availableWhoseProjects = ['All', ...new Set(projects.map(p => p.whoseProjects).filter(Boolean))];

  // ==================== [ Next Servicing Date Calculation ] ====================
  const getUpcomingSchedules = () => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); 
    const currentMonthName = monthsList[currentMonth + 1];
    const todayDate = new Date(currentYear, currentMonth, today.getDate());

    return projects.map((proj) => {
      const currentMonthBill = (proj.billList || []).find(b => b.month === currentMonthName);

      if (currentMonthBill && currentMonthBill.servicingStatus === 'Complete') {
        return null;
      }

      const dateStr = getLastServicingDateFromProj(proj);
      if (!dateStr) return null;

      const lastDate = new Date(dateStr);
      if (isNaN(lastDate.getTime())) return null;

      const serviceDay = lastDate.getDate();
      const nextServicingDate = new Date(currentYear, currentMonth, serviceDay);

      const formattedYear = nextServicingDate.getFullYear();
      const formattedMonth = String(nextServicingDate.getMonth() + 1).padStart(2, '0');
      const formattedDay = String(nextServicingDate.getDate()).padStart(2, '0');
      const formattedNextServicingDate = `${formattedYear}-${formattedMonth}-${formattedDay}`;

      const diffTime = nextServicingDate.getTime() - todayDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays >= -30 && diffDays <= 5) {
        return {
          ...proj,
          lastServiceDayDate: dateStr,
          nextServicingDate: formattedNextServicingDate,
          daysRemaining: diffDays
        };
      }
      return null;
    }).filter(Boolean).sort((a, b) => a.daysRemaining - b.daysRemaining);
  };

  const upcomingSchedules = getUpcomingSchedules();

  // ==================== [ Main Project Filtering ] ====================
  const filteredProjects = projects.filter((proj) => {
    const matchesWhose = selectedWhoseProject === 'All' || proj.whoseProjects === selectedWhoseProject;
    if (!matchesWhose) return false;

    const targetMonth = selectedMonth === 'All' ? monthsList[new Date().getMonth() + 1] : selectedMonth;
    const bill = (proj.billList || []).find(b => b.month === targetMonth) || {};
    const servicingStatus = bill.servicingStatus || 'Pending';

    if (statusFilter !== 'All' && servicingStatus !== statusFilter) return false;

    const servicingBill = Number(bill.servicingBill) || 0;
    const sparePartsBill = Number(bill.sparePartsBill) || 0;
    const lastMonthDue = Number(bill.lastMonthDue) || 0;
    const totalBill = servicingBill + sparePartsBill + lastMonthDue;
    const collectedBill = Number(bill.collectedBill) || 0;
    const totalDue = totalBill - collectedBill;

    if (dueFilter === 'WithDue') {
      return totalDue > 0;
    } else if (dueFilter === 'NoDue') {
      return totalDue <= 0;
    }

    return true;
  });

  const targetMonthForSummary = selectedMonth === 'All' ? monthsList[new Date().getMonth() + 1] : selectedMonth;
  
  const statusSummary = projects.reduce(
    (acc, proj) => {
      const currentBill = (proj.billList || []).find((b) => b.month === targetMonthForSummary);
      const status = currentBill ? currentBill.servicingStatus : 'Pending';

      if (status === 'Complete') {
        acc.completed += 1;
        acc.completedLiftQty += Number(proj.liftQty) || 1;
      } else {
        acc.incomplete += 1;
        acc.incompleteLiftQty += Number(proj.liftQty) || 1;
      }
      acc.totalLiftQty += Number(proj.liftQty) || 1;
      return acc;
    },
    { total: projects.length, totalLiftQty: 0, completed: 0, completedLiftQty: 0, incomplete: 0, incompleteLiftQty: 0 }
  );

  const totals = filteredProjects.reduce((acc, proj) => {
    const bill = (proj.billList || []).find(b => b.month === targetMonthForSummary) || {};

    const sBill = Number(bill.servicingBill) || 0;
    const pBill = Number(bill.sparePartsBill) || 0;
    const lDue = Number(bill.lastMonthDue) || 0;
    const tBill = sBill + pBill + lDue;
    const cBill = Number(bill.collectedBill) || 0;
    const tDue = tBill - cBill;

    acc.liftQty += Number(proj.liftQty) || 1;
    acc.servicingBill += sBill;
    acc.sparePartsBill += pBill;
    acc.lastMonthDue += lDue;
    acc.totalBill += tBill;
    acc.collectedBill += cBill;
    acc.totalDue += tDue;

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

  const collectorDetailedSummary = filteredProjects.reduce((acc, proj) => {
    const filteredBills = (proj.billList || []).filter(
      b => selectedMonth === 'All' || b.month === selectedMonth
    );

    filteredBills.forEach(bill => {
      const collector = bill.collectedBy?.trim();
      if (!collector) return;

      const collectedAmount = (Number(bill.collectedBill) || 0) + (Number(bill.sparePartsBill) || 0);
      
      const isApproved = bill.approvedBy && bill.approvedBy.trim() !== '' && bill.approvedBy.trim() !== '-';
      const approvedAmount = isApproved ? collectedAmount : 0;

      if (!acc[collector]) {
        acc[collector] = { collected: 0, approved: 0 };
      }

      acc[collector].collected += collectedAmount;
      acc[collector].approved += approvedAmount;
    });

    return acc;
  }, {});

  const approverDetailedSummary = filteredProjects.reduce((acc, proj) => {
    const filteredBills = (proj.billList || []).filter(
      b => selectedMonth === 'All' || b.month === selectedMonth
    );

    filteredBills.forEach(bill => {
      const approver = (bill.approvedBy && bill.approvedBy.trim() && bill.approvedBy.trim() !== '-') 
        ? bill.approvedBy.trim() 
        : null;

      if (approver) {
        const collectedAmount = Number(bill.collectedBill) || 0;
        acc[approver] = (acc[approver] || 0) + collectedAmount;
      }
    });

    return acc;
  }, {});

  return (
    <div className={styles.projectContainer}>
      <UpcomingScheduleAlert
        upcomingSchedules={upcomingSchedules}
        handleEdit={handleEdit}
        hasEditPermission={hasPermission('projects_action_update')}
      />

      <SummaryCards
        targetMonthForSummary={targetMonthForSummary}
        statusSummary={statusSummary}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        collectorDetailedSummary={collectorDetailedSummary}
        approverDetailedSummary={approverDetailedSummary}
      />

      <HeaderBar
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        selectedWhoseProject={selectedWhoseProject}
        setSelectedWhoseProject={setSelectedWhoseProject}
        dueFilter={dueFilter}
        setDueFilter={setDueFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        monthsList={monthsList}
        availableWhoseProjects={availableWhoseProjects}
        handleSaveToApi={handleSaveToApi}
        loading={loading}
        dispatch={dispatch}
        hasSavePermission={hasPermission('projects_action_save')}
      />

      <MainProjectTable
        filteredProjects={filteredProjects}
        selectedMonth={selectedMonth}
        monthsList={monthsList}
        getLastServicingDateFromProj={getLastServicingDateFromProj}
        totals={totals}
      />

      <EditModal
        showModal={showModal}
        formData={formData}
        handleInputChange={handleInputChange}
        handleSubmit={handleSubmit}
        setShowModal={setShowModal}
      />
    </div>
  );
};

export default Serviced_and_Schedule;