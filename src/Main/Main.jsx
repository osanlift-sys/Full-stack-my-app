import { Navigate, Route, Routes } from "react-router-dom";
import { useSelector } from "react-redux";
import AdminPanel from "../AdminPannel/AdminPanel";
import Challan from "../Clints/Challan/Challan";
import ClientDetails from "../Clints/ClintDetails/ClintDetails";
import ClientDocumentDetails from "../Clints/ClintDetails/ClientDocumentDetails";
import ClintLisst from "../Clints/ClintList/ClintLisst";
import Clints from "../Clints/Clints";
import ClientProfile from "../Clints/ClientProfile/ClientProfile";
import Invoice from "../Clints/Invoice/Invoice";
import OfferInvoice from "../Clints/Offer/OfferInvoice";
import Attendance from "../EmployeeData/Attendance/Attendance";
import EmployeeData from "../EmployeeData/EmployeeData";
import EmployeeList from "../EmployeeData/EmployeeList/EmployeeList";
import Payroll_Salary from "../EmployeeData/Payroll_Salary/Payroll_Salary";
import YourProfile from "../EmployeeData/YourProfile/YourProfile";
import AIBay, { aiBayIncomeRoutes } from "../AIBay/AIBay";
import AIBayHomePage from "../AIBay/pages/AIBayHomePage";
import BillsAllowancesPage from "../AIBay/pages/BillsAllowancesPage";
import ConveyancePage from "../AIBay/pages/ConveyancePage";
import IncomeFromInstallationPage from "../AIBay/pages/IncomeFromInstallationPage";
import IncomeFromServiceSalesPage from "../AIBay/pages/IncomeFromServiceSalesPage";
import IncomeFromServicingProjectsPage from "../AIBay/pages/IncomeFromServicingProjectsPage";
import IncomeFromSparePartsPage from "../AIBay/pages/IncomeFromSparePartsPage";
import Home from "../Home/Home";
import InventoryBilling from "../InventoryBilling/InventoryBilling";
import Purchase from "../InventoryBilling/Purchase/Purchase";
import Sales from "../InventoryBilling/Sales/Sales";
import Stocks from "../InventoryBilling/Stocks/Stocks";
import TotalPurchase from "../InventoryBilling/TotalPurchase/TotalPurchase";
import Login from "../LoginData/Login/Login";
import SignUp from "../LoginData/SignUp/SignUp";
import VerifyEmail from "../LoginData/Component/VerifyEmail";
import Checklist from "../Projects/Project/Component/Checklist";
import ProjectDetails from "../Projects/Project/ProjectDetails";
import ServiceBill from "../Projects/Project/ServiceBill";
import Serviced_and_Schedule from "../Projects/Project/Serviced_and_Schedule";
import Projects from "../Projects/Projects";
import Summery from "../Projects/Summery";
import Services from "../Services/Services";
import TechnicalSupportQuotation from "../Services/SupportRequest/TechnicalSupportQuotation";
import TechnicalSupportResponse from "../Services/SupportRequest/TechnicalSupportResponse";
import "./Main.css";

export const Main = () => {
  const user = useSelector((state) => state.auth?.user);
  const hasAiBayAccess =
    user?.backendRole === "ADMIN" ||
    user?.role === "Admin" ||
    (user?.backendRole === "EMPLOYEE" && user?.permissions?.nav_ai_bay === true);

  return (
    <div className="main">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/Services" element={<Services />} />
        <Route
          path="/ai-bay"
          element={
            hasAiBayAccess
              ? <AIBay />
              : <Navigate to={user ? "/" : "/Login"} replace />
          }
        >
          <Route index element={<AIBayHomePage />} />
          <Route path={aiBayIncomeRoutes[0].path} element={<IncomeFromServicingProjectsPage />} />
          <Route path={aiBayIncomeRoutes[1].path} element={<IncomeFromSparePartsPage />} />
          <Route path={aiBayIncomeRoutes[2].path} element={<IncomeFromServiceSalesPage />} />
          <Route path={aiBayIncomeRoutes[3].path} element={<IncomeFromInstallationPage />} />
          <Route path={aiBayIncomeRoutes[4].path} element={<ConveyancePage />} />
          <Route path={aiBayIncomeRoutes[5].path} element={<BillsAllowancesPage />} />
        </Route>
        <Route path="/technical-support-response" element={<TechnicalSupportResponse />} />
        <Route path="/technical-support-quotation/:requestId" element={<TechnicalSupportQuotation />} />

        {/* Authentication Routes */}
        <Route path="/Login" element={<Login />} />
        <Route path="/SignUp" element={<SignUp />} />
        <Route path="/verify-email" element={<VerifyEmail />} />

        {/* Clients Route */}
        <Route path="/Clints" element={<Clints />}>
          <Route index element={<Navigate to={user?.backendRole === "CLIENT" ? "ClientProfile" : "Offer"} replace />} />
          <Route path="ClientProfile" element={
            user?.backendRole === "CLIENT"
              ? <ClientProfile />
              : <Navigate to={user ? "/" : "/Login"} replace />
          } />
          <Route path="ClintList" element={<ClintLisst />} />
          <Route path="ClientDetails/:clientName" element={<ClientDetails />} />
          <Route path="ClientDetails/:clientName/document/:docId" element={<ClientDocumentDetails />} />
          <Route path="Offer" element={<OfferInvoice />} />
          <Route path="Invoice" element={<Invoice />} />
          <Route path="Challan" element={<Challan />} />
        </Route>

        {/* Projects Route */}
        <Route path="/Projects" element={<Projects />}>
          <Route index element={<Navigate to="Serviced_and_Schedule" replace />} />
          <Route path="Summery" element={<Summery />} />
          <Route path="project-details/:id" element={<ProjectDetails />} />
          <Route path="Serviced_and_Schedule" element={<Serviced_and_Schedule />} />
        </Route>

        {/* Service Bill Route */}
        <Route path="/service-bill" element={<ServiceBill />} />
        <Route path="/checklist" element={<Checklist />} />

        {/* Inventory Route */}
        <Route path="/InventoryBilling" element={<InventoryBilling />}>
          <Route index element={<Navigate to="Stocks" replace />} />
          <Route path="Purchase" element={<Purchase />} />
          <Route path="TotalPurchase" element={<TotalPurchase />} />
          <Route path="Sales" element={<Sales />} />
          <Route path="Stocks" element={<Stocks />} />
        </Route>

        {/* Employee Data Route */}
        <Route path="/EmployeeData" element={<EmployeeData />}>
          <Route index element={<Navigate to="YourProfile" replace />} />
          <Route path="YourProfile" element={<YourProfile />} />
          <Route path="EmployeeList" element={<EmployeeList />} />
          <Route path="Attendance" element={<Attendance />} />
          <Route path="Payroll" element={<Payroll_Salary />} />
        </Route>

        <Route path="/AdminPanel" element={<AdminPanel />} />
      </Routes>
    </div>
  );
};