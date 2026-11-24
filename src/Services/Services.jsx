import {
  ArrowRight,
  Clock,
  Cpu,
  Send,
  Settings,
  ShieldCheck,
  Wrench,
  X,
  Zap
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { apiClient, getApiErrorMessage } from '../api/apiClient';
import styles from './Services.module.css';

const servicesData = [
  {
    id: 1,
    title: "New Lift Installation",
    description: "Complete modern elevator setup with high-grade safety standards and smooth operational performance for residential & commercial buildings.",
    details: "We offer end-to-end elevator installation including shaft measurement, structural engineering, high-efficiency traction systems, custom cabin design, and safety certification.",
    icon: <Zap size={24} />,
    tag: "Installation"
  },
  {
    id: 2,
    title: "Automatic Rescue Device (ARD)",
    description: "Advanced ARD systems ensuring safe passenger evacuation to the nearest floor during sudden power outages.",
    details: "Our intelligent ARD units detect power supply failure instantly, switch smoothly to internal battery back-up, and bring the cabin safely to the nearest floor level.",
    icon: <Cpu size={24} />,
    tag: "Power Solution"
  },
  {
    id: 3,
    title: "Generator & Power Backup",
    description: "Reliable industrial and commercial generator supply, setup, and control system integration.",
    details: "High-capacity diesel and industrial power backup integration for heavy duty commercial power requirements, equipped with Automatic Transfer Switches (ATS).",
    icon: <Settings size={24} />,
    tag: "Power Solution"
  },
  {
    id: 4,
    title: "Elevator Spare Parts & Controller",
    description: "Genuine inverters, motherboards, encoders, and door operators for all major elevator brands.",
    details: "We stock authentic components from Fuji, Monarch, Yaskawa, Arkel, and ThyssenKrupp controllers, encoders, guide shoes, door drives, and safety sensors.",
    icon: <Wrench size={24} />,
    tag: "Parts Supply"
  },
  {
    id: 5,
    title: "Comprehensive Maintenance & AMC",
    description: "Routine inspections, testing, preventive repairs, and emergency support to minimize downtime.",
    details: "Annual Maintenance Contracts (AMC) with scheduled periodic checks, lubrications, wire rope inspections, safety gear testing, and priority breakdown assistance.",
    icon: <ShieldCheck size={24} />,
    tag: "Maintenance"
  },
  {
    id: 6,
    title: "24/7 Emergency Technical Support",
    description: "Quick breakdown response and technical troubleshooting by certified engineering specialists.",
    details: "Dedicated emergency rapid-response unit for instant troubleshooting, passenger entrapment relief, controller parameter configuration, and hardware repair.",
    icon: <Clock size={24} />,
    tag: "Support"
  }
];

function Services() {
  const user = useSelector((state) => state.auth?.user);
  const [selectedService, setSelectedService] = useState(null);
  const [formData, setFormData] = useState({
    userName: '',
    email: '',
    whatsapp: '',
    problemDetails: '',
  });
  const [attachments, setAttachments] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    if (selectedService) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedService]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    setAttachments(Array.from(e.target.files || []).slice(0, 5));
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();
    const name = (user?.name || formData.userName).trim();
    const whatsapp = formData.whatsapp.trim();
    const problemDetails = formData.problemDetails.trim();
    if (!name || !whatsapp || !problemDetails) {
      setSubmitError("Please fill in all required fields (Name, WhatsApp, and Problem Details).");
      return;
    }

    if (!user) {
      setSubmitError("Please log in to submit a support request. Anonymous submissions are not available.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');
    try {
      const payload = new FormData();
      payload.append('serviceId', String(selectedService.id));
      payload.append('serviceTitle', selectedService.title);
      payload.append('serviceTag', selectedService.tag);
      payload.append('whatsapp', whatsapp);
      payload.append('problemDetails', problemDetails);
      attachments.forEach((file) => payload.append('attachments', file));
      await apiClient.post('/support/requests', payload);
      alert("Your technical support request has been submitted successfully!");
      setFormData({ userName: '', email: '', whatsapp: '', problemDetails: '' });
      setAttachments([]);
      setSelectedService(null);
    } catch (error) {
      console.error("Error submitting support request:", error);
      setSubmitError(getApiErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={styles.servicesSection}>
      <Helmet>
        <title>Engineering & Elevator Services | Osan Lift</title>
      </Helmet>

      <div className={styles.container}>
        <div className={styles.header}>
          <span className={styles.badge}>Our Expertise</span>
          <h2 className={styles.title}>Engineering & Power Solutions Services</h2>
        </div>

        <div className={styles.grid}>
          {servicesData.map((service) => (
            <div key={service.id} className={styles.card}>
              <div>
                <div className={styles.cardTop}>
                  <div className={styles.iconWrapper}>{service.icon}</div>
                  <span className={styles.tag}>{service.tag}</span>
                </div>
                <h3 className={styles.cardTitle}>{service.title}</h3>
                <p className={styles.cardDescription}>{service.description}</p>
              </div>

              <div 
                className={styles.cardFooter} 
                onClick={() => setSelectedService(service)}
                role="button"
                tabIndex={0}
              >
                <span>Request Support</span>
                <ArrowRight className={styles.arrowIcon} />
              </div>
            </div>
          ))}
        </div>

        {/* Modal Window with Two Columns */}
        {selectedService && (
          <div className={styles.modalOverlay} onClick={() => setSelectedService(null)}>
            <div className={styles.modalContentTwoCol} onClick={(e) => e.stopPropagation()}>
              <button className={styles.closeBtn} onClick={() => setSelectedService(null)}>
                <X size={20} />
              </button>

              {/* Left Column: Service Details */}
              <div className={styles.leftColumn}>
                <div className={styles.modalHeader}>
                  <div className={styles.iconWrapper}>{selectedService.icon}</div>
                  <div>
                    <span className={styles.tag}>{selectedService.tag}</span>
                    <h3 className={styles.modalTitle}>{selectedService.title}</h3>
                  </div>
                </div>

                <div className={styles.modalBody}>
                  <h4>Service Overview</h4>
                  <p>{selectedService.description}</p>
                  
                  <h4>Key Technical Specifications</h4>
                  <p>{selectedService.details}</p>
                </div>
              </div>

              {/* Right Column: Technical Support Request Form */}
              <div className={styles.rightColumn}>
                <h3 className={styles.formTitle}>Request Technical Support</h3>
                <p className={styles.formNote}>
                  {user ? (
                    `Submitting with your signed-in account${user.name ? ` (${user.name})` : ''}.`
                  ) : (
                    <>
                      Please <Link to="/Login">log in</Link> before submitting. Anonymous support requests are not available.
                    </>
                  )}
                </p>
                <form onSubmit={handleSubmitRequest} className={styles.supportForm}>
                  <div className={styles.inputGroup}>
                    <label>Full Name *</label>
                    <input 
                      type="text" 
                      name="userName" 
                      required 
                      value={user?.name || formData.userName}
                      disabled={Boolean(user)}
                      onChange={handleInputChange} 
                      placeholder="Your Name" 
                    />
                  </div>

                  <div className={styles.inputRow}>
                    <div className={styles.inputGroup}>
                      <label>Email</label>
                      <input 
                        type="email" 
                        name="email" 
                        value={user?.email || formData.email}
                        disabled={Boolean(user)}
                        onChange={handleInputChange} 
                        placeholder="email@example.com" 
                      />
                    </div>
                    <div className={styles.inputGroup}>
                      <label>WhatsApp Number *</label>
                      <input 
                        type="text" 
                        name="whatsapp" 
                        required 
                        value={formData.whatsapp} 
                        onChange={handleInputChange} 
                        placeholder="017XXXXXXXX" 
                      />
                    </div>
                  </div>

                  <div className={styles.inputGroup}>
                    <label>Problem / Requirement Details *</label>
                    <textarea 
                      name="problemDetails" 
                      rows="3" 
                      required 
                      value={formData.problemDetails} 
                      onChange={handleInputChange} 
                      placeholder="Describe issue or required service..." 
                    />
                  </div>

                  <div className={styles.inputRow}>
                    <div className={styles.inputGroup}>
                      <label>Ref Picture 1 / আপনার সমস্যার ছবি দেন ।</label>
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileChange} />
                    </div>
                    <div className={styles.inputGroup}>
                      <label>Ref Picture 2 / আপনার সমস্যার ছবি দেন ।</label>
                      <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple onChange={handleFileChange} />
                    </div>
                  </div>

                  {submitError && <p role="alert" className={styles.formError}>{submitError}</p>}
                  <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                    <Send size={16} /> {isSubmitting ? "Submitting..." : "Submit Support Request"}
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}
      </div>
    </section>
  );
}

export default Services;