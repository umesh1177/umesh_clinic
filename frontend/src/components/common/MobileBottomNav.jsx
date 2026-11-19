import React, { useState } from 'react';
import {
  Home,
  Users,
  Plus,
  TrendingUp,
  MoreHorizontal,
  Award,
  Layers,
  UserCheck,
  UserPlus,
  LogOut,
  X,
  Cloud,
  CloudOff,
  RefreshCw,
  Download,
  Stethoscope,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export const MobileBottomNav = ({
  activeTab,
  onSelectTab,
  onNewConsultation,
  onLogout,
  doctor,
  isOnline = true,
  offlinePendingCount = 0,
  isSyncing = false,
  onTriggerSync,
  installPrompt,
  onInstallApp,
}) => {
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const handleTabClick = (tabId) => {
    setIsMoreOpen(false);
    onSelectTab(tabId);
  };

  const handleFabClick = () => {
    setIsMoreOpen(false);
    if (typeof onNewConsultation === 'function') {
      onNewConsultation();
    } else {
      onSelectTab('patient-record');
    }
  };

  const isPatientsActive =
    activeTab === 'family-head' || activeTab === 'add-member';

  const isMoreActive =
    isMoreOpen ||
    activeTab === 'medical-certificate' ||
    activeTab === 'master-data' ||
    activeTab === 'doctor-profile';

  return (
    <>
      {/* =========================================================================
          1. FIXED BOTTOM NAVIGATION BAR
          ========================================================================= */}
      <nav
        className="mobile-bottom-nav"
        style={styles.navBar}
        aria-label="Mobile Navigation"
      >
        {/* Tab 1: Home / Dashboard */}
        <button
          type="button"
          onClick={() => handleTabClick('dashboard')}
          style={{
            ...styles.navItem,
            color: activeTab === 'dashboard' ? 'var(--primary)' : '#64748B',
          }}
          title="Dashboard"
        >
          <div
            style={{
              ...styles.iconWrapper,
              backgroundColor:
                activeTab === 'dashboard' ? '#DCEFEA' : 'transparent',
            }}
          >
            <Home
              size={20}
              strokeWidth={activeTab === 'dashboard' ? 2.5 : 2}
              color={activeTab === 'dashboard' ? '#146B5C' : '#64748B'}
            />
          </div>
          <span
            style={{
              ...styles.navLabel,
              fontWeight: activeTab === 'dashboard' ? 700 : 500,
              color: activeTab === 'dashboard' ? '#146B5C' : '#64748B',
            }}
          >
            Home
          </span>
        </button>

        {/* Tab 2: Patients / Queue */}
        <button
          type="button"
          onClick={() => handleTabClick('family-head')}
          style={{
            ...styles.navItem,
            color: isPatientsActive ? 'var(--primary)' : '#64748B',
          }}
          title="Patients / Families"
        >
          <div
            style={{
              ...styles.iconWrapper,
              backgroundColor: isPatientsActive ? '#DCEFEA' : 'transparent',
            }}
          >
            <Users
              size={20}
              strokeWidth={isPatientsActive ? 2.5 : 2}
              color={isPatientsActive ? '#146B5C' : '#64748B'}
            />
          </div>
          <span
            style={{
              ...styles.navLabel,
              fontWeight: isPatientsActive ? 700 : 500,
              color: isPatientsActive ? '#146B5C' : '#64748B',
            }}
          >
            Patients
          </span>
        </button>

        {/* Tab 3: Center Elevated FAB (Start OPD Consultation) */}
        <div style={styles.fabWrapper}>
          <button
            type="button"
            onClick={handleFabClick}
            style={{
              ...styles.fabButton,
              transform: activeTab === 'patient-record' ? 'scale(1.05)' : 'scale(1)',
            }}
            title="Start New OPD Consultation"
          >
            <Plus size={26} strokeWidth={3} color="#FFFFFF" />
          </button>
          <span
            style={{
              ...styles.navLabel,
              marginTop: '4px',
              fontWeight: activeTab === 'patient-record' ? 800 : 600,
              color: activeTab === 'patient-record' ? '#146B5C' : '#1E293B',
            }}
          >
            Consult
          </span>
        </div>

        {/* Tab 4: Reports */}
        <button
          type="button"
          onClick={() => handleTabClick('reports')}
          style={{
            ...styles.navItem,
            color: activeTab === 'reports' ? 'var(--primary)' : '#64748B',
          }}
          title="Clinic Reports & OPD Register"
        >
          <div
            style={{
              ...styles.iconWrapper,
              backgroundColor:
                activeTab === 'reports' ? '#DCEFEA' : 'transparent',
            }}
          >
            <TrendingUp
              size={20}
              strokeWidth={activeTab === 'reports' ? 2.5 : 2}
              color={activeTab === 'reports' ? '#146B5C' : '#64748B'}
            />
          </div>
          <span
            style={{
              ...styles.navLabel,
              fontWeight: activeTab === 'reports' ? 700 : 500,
              color: activeTab === 'reports' ? '#146B5C' : '#64748B',
            }}
          >
            Reports
          </span>
        </button>

        {/* Tab 5: More (Bottom Sheet Opener) */}
        <button
          type="button"
          onClick={() => setIsMoreOpen((prev) => !prev)}
          style={{
            ...styles.navItem,
            color: isMoreActive ? 'var(--primary)' : '#64748B',
          }}
          title="More Clinic Tools & Settings"
        >
          <div
            style={{
              ...styles.iconWrapper,
              backgroundColor: isMoreActive ? '#DCEFEA' : 'transparent',
            }}
          >
            <MoreHorizontal
              size={20}
              strokeWidth={isMoreActive ? 2.5 : 2}
              color={isMoreActive ? '#146B5C' : '#64748B'}
            />
          </div>
          <span
            style={{
              ...styles.navLabel,
              fontWeight: isMoreActive ? 700 : 500,
              color: isMoreActive ? '#146B5C' : '#64748B',
            }}
          >
            More
          </span>
        </button>
      </nav>

      {/* =========================================================================
          2. MOBILE "MORE" BOTTOM SHEET MODAL
          ========================================================================= */}
      {isMoreOpen && (
        <div style={styles.sheetOverlay} onClick={() => setIsMoreOpen(false)}>
          <div
            style={styles.sheetContainer}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grab Handle */}
            <div style={styles.dragHandle} />

            {/* Sheet Header */}
            <div style={styles.sheetHeader}>
              <div style={styles.sheetDoctorBadge}>
                <div style={styles.doctorAvatar}>
                  {doctor?.name?.charAt(0) || 'D'}
                </div>
                <div>
                  <h3 style={styles.doctorName}>
                    {doctor?.name || 'Dr. Chirag Paghdal'}
                  </h3>
                  <span style={styles.clinicName}>
                    {doctor?.clinicName || 'Dhyey Clinic & Nursing Home'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMoreOpen(false)}
                style={styles.closeSheetBtn}
                title="Close"
              >
                <X size={18} color="#64748B" />
              </button>
            </div>

            {/* Offline Sync Status Row */}
            <div style={styles.sheetSyncStatusCard}>
              <div style={styles.sheetSyncLeft}>
                {!isOnline ? (
                  <>
                    <CloudOff size={16} color="#D97706" />
                    <div>
                      <span style={styles.syncStatusTitle}>Offline Mode</span>
                      <p style={styles.syncStatusDesc}>
                        Saved to device. Will auto-sync when connected.
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <Cloud size={16} color="#10B981" />
                    <div>
                      <span style={styles.syncStatusTitle}>Cloud Sync Online</span>
                      <p style={styles.syncStatusDesc}>
                        Connected to MongoDB Atlas database.
                      </p>
                    </div>
                  </>
                )}
              </div>
              {offlinePendingCount > 0 && isOnline && (
                <button
                  type="button"
                  onClick={onTriggerSync}
                  disabled={isSyncing}
                  style={styles.sheetSyncActionBtn}
                >
                  <RefreshCw
                    size={13}
                    style={{
                      animation: isSyncing ? 'spin 1s linear infinite' : 'none',
                    }}
                  />
                  <span>{isSyncing ? 'Syncing...' : `Sync (${offlinePendingCount})`}</span>
                </button>
              )}
            </div>

            {/* Grid of Navigation Items */}
            <div style={styles.sheetGrid}>
              {/* Medical Certificate */}
              <button
                type="button"
                onClick={() => handleTabClick('medical-certificate')}
                style={{
                  ...styles.sheetGridItem,
                  borderColor:
                    activeTab === 'medical-certificate'
                      ? 'var(--primary)'
                      : 'var(--border)',
                  backgroundColor:
                    activeTab === 'medical-certificate'
                      ? '#EEF6F4'
                      : '#FFFFFF',
                }}
              >
                <div
                  style={{
                    ...styles.sheetItemIcon,
                    backgroundColor: '#FEF3C7',
                    color: '#B45309',
                  }}
                >
                  <Award size={20} />
                </div>
                <div style={styles.sheetItemText}>
                  <span style={styles.sheetItemTitle}>Medical Certificate</span>
                  <span style={styles.sheetItemSubtitle}>Issue & print fitness</span>
                </div>
                <ChevronRight size={16} color="#94A3B8" />
              </button>

              {/* Master Data Management */}
              <button
                type="button"
                onClick={() => handleTabClick('master-data')}
                style={{
                  ...styles.sheetGridItem,
                  borderColor:
                    activeTab === 'master-data'
                      ? 'var(--primary)'
                      : 'var(--border)',
                  backgroundColor:
                    activeTab === 'master-data' ? '#EEF6F4' : '#FFFFFF',
                }}
              >
                <div
                  style={{
                    ...styles.sheetItemIcon,
                    backgroundColor: '#DCEFEA',
                    color: '#0E4F44',
                  }}
                >
                  <Layers size={20} />
                </div>
                <div style={styles.sheetItemText}>
                  <span style={styles.sheetItemTitle}>Master Data</span>
                  <span style={styles.sheetItemSubtitle}>Medicines & shortcuts</span>
                </div>
                <ChevronRight size={16} color="#94A3B8" />
              </button>

              {/* Add Member */}
              <button
                type="button"
                onClick={() => handleTabClick('add-member')}
                style={{
                  ...styles.sheetGridItem,
                  borderColor:
                    activeTab === 'add-member'
                      ? 'var(--primary)'
                      : 'var(--border)',
                  backgroundColor:
                    activeTab === 'add-member' ? '#EEF6F4' : '#FFFFFF',
                }}
              >
                <div
                  style={{
                    ...styles.sheetItemIcon,
                    backgroundColor: '#EFF6FF',
                    color: '#1D4ED8',
                  }}
                >
                  <UserPlus size={20} />
                </div>
                <div style={styles.sheetItemText}>
                  <span style={styles.sheetItemTitle}>Add Member</span>
                  <span style={styles.sheetItemSubtitle}>Attach to existing family</span>
                </div>
                <ChevronRight size={16} color="#94A3B8" />
              </button>

              {/* Doctor Profile & Credentials */}
              <button
                type="button"
                onClick={() => handleTabClick('doctor-profile')}
                style={{
                  ...styles.sheetGridItem,
                  borderColor:
                    activeTab === 'doctor-profile'
                      ? 'var(--primary)'
                      : 'var(--border)',
                  backgroundColor:
                    activeTab === 'doctor-profile' ? '#EEF6F4' : '#FFFFFF',
                }}
              >
                <div
                  style={{
                    ...styles.sheetItemIcon,
                    backgroundColor: '#F3E8FF',
                    color: '#7E22CE',
                  }}
                >
                  <UserCheck size={20} />
                </div>
                <div style={styles.sheetItemText}>
                  <span style={styles.sheetItemTitle}>Doctor Profile</span>
                  <span style={styles.sheetItemSubtitle}>Letterhead & password</span>
                </div>
                <ChevronRight size={16} color="#94A3B8" />
              </button>

              {/* Install PWA App (If Available) */}
              {installPrompt && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreOpen(false);
                    if (onInstallApp) onInstallApp();
                  }}
                  style={{
                    ...styles.sheetGridItem,
                    backgroundColor: '#F0FDF4',
                    borderColor: '#86EFAC',
                  }}
                >
                  <div
                    style={{
                      ...styles.sheetItemIcon,
                      backgroundColor: '#DCFCE7',
                      color: '#15803D',
                    }}
                  >
                    <Download size={20} />
                  </div>
                  <div style={styles.sheetItemText}>
                    <span style={{ ...styles.sheetItemTitle, color: '#15803D' }}>
                      Install Clinic App
                    </span>
                    <span style={styles.sheetItemSubtitle}>
                      Add to phone home screen
                    </span>
                  </div>
                  <ChevronRight size={16} color="#15803D" />
                </button>
              )}
            </div>

            {/* Logout Row */}
            <div style={styles.sheetFooter}>
              <button
                type="button"
                onClick={() => {
                  setIsMoreOpen(false);
                  if (onLogout) onLogout();
                }}
                style={styles.sheetLogoutBtn}
              >
                <LogOut size={16} color="#B3524A" />
                <span>Sign Out Account</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

const styles = {
  navBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '66px',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)',
    borderTop: '1px solid rgba(220, 234, 231, 0.9)',
    boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    padding: '0 8px',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    zIndex: 9999,
  },
  navItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    background: 'none',
    border: 'none',
    padding: '6px 4px',
    cursor: 'pointer',
    outline: 'none',
    WebkitTapHighlightColor: 'transparent',
    transition: 'all 0.15s ease',
  },
  iconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '38px',
    height: '28px',
    borderRadius: '16px',
    transition: 'all 0.2s ease',
  },
  navLabel: {
    fontSize: '0.68rem',
    letterSpacing: '-0.01em',
    lineHeight: 1.1,
  },
  fabWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    top: '-12px',
  },
  fabButton: {
    width: '52px',
    height: '52px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #146B5C 0%, #0E4F44 100%)',
    border: '3.5px solid #FFFFFF',
    boxShadow: '0 6px 18px rgba(20, 107, 92, 0.42)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    outline: 'none',
    transition: 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)',
    WebkitTapHighlightColor: 'transparent',
  },

  // Bottom Sheet Styles
  sheetOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    backdropFilter: 'blur(4px)',
    WebkitBackdropFilter: 'blur(4px)',
    zIndex: 10000,
    display: 'flex',
    alignItems: 'flex-end',
    animation: 'fadeIn 0.2s ease-out',
  },
  sheetContainer: {
    width: '100%',
    maxHeight: '85vh',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: '24px',
    borderTopRightRadius: '24px',
    padding: '12px 18px 24px 18px',
    paddingBottom: 'calc(env(safe-area-inset-bottom, 16px) + 20px)',
    boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.18)',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    overflowY: 'auto',
    animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  dragHandle: {
    width: '40px',
    height: '4px',
    backgroundColor: '#CBD5E1',
    borderRadius: '4px',
    alignSelf: 'center',
    marginBottom: '4px',
  },
  sheetHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '10px',
    borderBottom: '1px solid var(--border)',
  },
  sheetDoctorBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  doctorAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: 'var(--primary)',
    color: '#FFFFFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 700,
  },
  doctorName: {
    fontSize: '0.95rem',
    fontWeight: 800,
    color: 'var(--text)',
    margin: 0,
  },
  clinicName: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  closeSheetBtn: {
    background: '#F1F5F9',
    border: 'none',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  sheetSyncStatusCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    border: '1px solid #E2E8F0',
    borderRadius: '12px',
    padding: '10px 14px',
  },
  sheetSyncLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  syncStatusTitle: {
    fontSize: '0.8rem',
    fontWeight: 700,
    color: 'var(--text)',
    display: 'block',
  },
  syncStatusDesc: {
    fontSize: '0.7rem',
    color: 'var(--text-muted)',
    margin: 0,
  },
  sheetSyncActionBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: '#DCEFEA',
    color: '#0E4F44',
    border: 'none',
    borderRadius: '8px',
    padding: '6px 10px',
    fontSize: '0.72rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  sheetGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  sheetGridItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '14px',
    border: '1px solid var(--border)',
    backgroundColor: '#FFFFFF',
    cursor: 'pointer',
    textAlign: 'left',
    outline: 'none',
    transition: 'all 0.15s ease',
  },
  sheetItemIcon: {
    width: '38px',
    height: '38px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sheetItemText: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  sheetItemTitle: {
    fontSize: '0.86rem',
    fontWeight: 700,
    color: 'var(--text)',
  },
  sheetItemSubtitle: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  sheetFooter: {
    paddingTop: '6px',
    borderTop: '1px solid var(--border)',
  },
  sheetLogoutBtn: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '11px',
    borderRadius: '12px',
    backgroundColor: '#FEF2F2',
    color: '#B3524A',
    border: '1px solid #FECACA',
    fontSize: '0.85rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
};

export default MobileBottomNav;
