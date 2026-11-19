import axios from 'axios';
import {
  isOnline,
  isNetworkError,
  recordOfflineVisit,
  getOfflineVisits,
  registerOfflineFamily,
  getOfflineFamilies,
  addOfflineMember,
  issueOfflineCertificate,
  addOfflineMasterItem,
  syncOfflineRecords,
  saveDoctorOfflineSession,
  getDoctorOfflineSession,
  clearDoctorOfflineSession,
  getStoredPatients,
  saveStoredPatients,
  saveStoredFamilies,
  getStoredFamilies,
  getStoredMasterData,
  saveStoredMasterData,
} from '../utils/offlineSyncManager';

// Support both single-origin ('/api') and separate-service deployment
const baseURL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL,
  withCredentials: true, // Ensures cookies are automatically included with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// ----------------------------------------------------------------------------
// Background Auto-Sync Lifecycle Setup
// ----------------------------------------------------------------------------
if (typeof window !== 'undefined') {
  // 1. Automatically sync whenever the browser regains internet connection
  window.addEventListener('online', () => {
    console.log('[PWA Sync] Network connection restored! Initiating background auto-sync to cloud database...');
    syncOfflineRecords(api).catch((err) =>
      console.warn('[PWA Sync] Error during online auto-sync:', err)
    );
  });

  // 2. Periodic sync check (every 15 seconds) if online
  setInterval(() => {
    if (isOnline()) {
      syncOfflineRecords(api).catch(() => {});
    }
  }, 15000);
}

// Manual trigger export for UI buttons
export const triggerCloudSync = () => syncOfflineRecords(api);

// ----------------------------------------------------------------------------
// 1. Authentication API (with Offline Session Resilience)
// ----------------------------------------------------------------------------
export const authAPI = {
  login: async ({ username, password }) => {
    // If online, perform standard server login
    if (isOnline()) {
      try {
        const response = await api.post('/auth/login', { username, password });
        if (response.data?.success && response.data?.doctor) {
          saveDoctorOfflineSession(response.data.doctor);
        }
        return response.data;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    // Offline Fallback Login: Verify against cached doctor profile in device memory
    const cachedDoctor = getDoctorOfflineSession();
    if (
      cachedDoctor &&
      cachedDoctor.username?.toLowerCase() === (username || '').trim().toLowerCase()
    ) {
      return {
        success: true,
        offline: true,
        message: 'Logged in using cached offline credentials.',
        doctor: cachedDoctor,
      };
    }

    throw new Error(
      isOnline()
        ? 'Invalid username or password.'
        : 'Cannot log in with new credentials while offline. Please connect to the internet or use previously logged in account.'
    );
  },

  getProfile: async () => {
    if (isOnline()) {
      try {
        const response = await api.get('/auth/me');
        if (response.data?.success && response.data?.doctor) {
          saveDoctorOfflineSession(response.data.doctor);
        }
        return response.data;
      } catch (err) {
        // If server explicitly returned 401 Unauthorized, session is invalid
        if (err.response && err.response.status === 401) {
          clearDoctorOfflineSession();
          return { success: false, message: 'Unauthorized session' };
        }
        if (!isNetworkError(err)) throw err;
      }
    }

    // Only return cached doctor session when internet is truly offline
    if (!isOnline()) {
      const cachedDoctor = getDoctorOfflineSession();
      if (cachedDoctor) {
        return {
          success: true,
          offline: true,
          doctor: cachedDoctor,
        };
      }
    }

    return { success: false, message: 'No offline session found' };
  },

  updateProfile: async (profileData) => {
    const response = await api.put('/auth/profile', profileData);
    if (response.data?.success && response.data?.doctor) {
      saveDoctorOfflineSession(response.data.doctor);
    }
    return response.data;
  },

  changeCredentials: async ({ currentPassword, newUsername, newPassword }) => {
    const response = await api.put('/auth/change-credentials', {
      currentPassword,
      newUsername,
      newPassword,
    });
    if (response.data?.success && response.data?.doctor) {
      saveDoctorOfflineSession(response.data.doctor);
    }
    return response.data;
  },

  getSecurityQuestion: async (username) => {
    const response = await api.get(
      `/auth/forgot-password/question/${encodeURIComponent(username)}`
    );
    return response.data;
  },

  verifySecurityAnswer: async ({ username, securityAnswer }) => {
    const response = await api.post('/auth/forgot-password/verify', {
      username,
      securityAnswer,
    });
    return response.data;
  },

  resetPassword: async ({ username, resetToken, newPassword }) => {
    const response = await api.post('/auth/forgot-password/reset', {
      username,
      resetToken,
      newPassword,
    });
    return response.data;
  },

  logout: async () => {
    try {
      if (isOnline()) {
        await api.post('/auth/logout');
      }
    } finally {
      clearDoctorOfflineSession();
    }
    return { success: true, message: 'Logged out successfully' };
  },
};

// ----------------------------------------------------------------------------
// 2. Universal Search API (Online with local memory fallback)
// ----------------------------------------------------------------------------
export const universalSearchAPI = {
  search: async (query = '') => {
    const cleanQuery = (query || '').trim();
    if (isOnline()) {
      try {
        const response = await api.get('/universal-search', {
          params: { q: cleanQuery },
        });
        return response.data;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    // Offline Search: Query locally cached patients in device memory
    const cachedPatients = getStoredPatients();
    if (!cleanQuery) {
      return { success: true, offline: true, data: cachedPatients.slice(0, 15) };
    }

    const q = cleanQuery.toUpperCase();
    const matched = cachedPatients.filter((p) => {
      const name = (p.name || '').toUpperCase();
      const pid = (p.patientId || '').toUpperCase();
      const phone = (p.phone || '').toUpperCase();
      const famId = (p.familyId || '').toUpperCase();
      return name.includes(q) || pid.includes(q) || phone.includes(q) || famId.includes(q);
    });

    return {
      success: true,
      offline: true,
      data: matched.slice(0, 30),
    };
  },
};

// ----------------------------------------------------------------------------
// 3. Family API (Online-first; saves to device memory ONLY when offline)
// ----------------------------------------------------------------------------
export const familyAPI = {
  getNextId: async () => {
    if (isOnline()) {
      try {
        const response = await api.get('/families/next-id');
        return response.data;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    // Offline preview ID
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return {
      success: true,
      offline: true,
      nextFamilyId: `F-OFFLINE-${randomSuffix}`,
    };
  },

  registerHead: async (data) => {
    // Note: Records only store in memory when internet is not available only.
    if (!isOnline()) {
      return registerOfflineFamily(data);
    }

    try {
      const response = await api.post('/families', data);
      return response.data;
    } catch (err) {
      if (isNetworkError(err)) {
        return registerOfflineFamily(data);
      }
      throw err;
    }
  },

  getAll: async (search = '') => {
    if (isOnline()) {
      try {
        const response = await api.get('/families', {
          params: { search: search.trim() },
        });
        if (response.data?.success && Array.isArray(response.data.data)) {
          saveStoredFamilies(response.data.data);
        }
        return response.data;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    // Offline fallback from device memory
    const stored = getOfflineFamilies(search);
    return {
      success: true,
      offline: true,
      data: stored,
    };
  },

  getById: async (familyId) => {
    if (isOnline()) {
      try {
        const response = await api.get(`/families/${familyId}`);
        return response.data;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    const families = getStoredFamilies();
    const found = families.find((f) => f.familyId === familyId || f._id === familyId);
    return {
      success: !!found,
      offline: true,
      data: found || null,
    };
  },

  update: async (familyId, data) => {
    const response = await api.put(`/families/${familyId}`, data);
    return response.data;
  },

  delete: async (familyId) => {
    const response = await api.delete(`/families/${familyId}`);
    return response.data;
  },
};

// ----------------------------------------------------------------------------
// 4. Patient API (Online-first; saves to device memory ONLY when offline)
// ----------------------------------------------------------------------------
export const patientAPI = {
  addMember: async (data) => {
    // Note: Records only store in memory when internet is not available only.
    if (!isOnline()) {
      return addOfflineMember(data);
    }

    try {
      const response = await api.post('/patients', data);
      return response.data;
    } catch (err) {
      if (isNetworkError(err)) {
        return addOfflineMember(data);
      }
      throw err;
    }
  },

  getAll: async (search = '', familyId = '') => {
    if (isOnline()) {
      try {
        const response = await api.get('/patients', {
          params: { search: (search || '').trim(), familyId: (familyId || '').trim() },
        });
        if (response.data?.success && Array.isArray(response.data.data)) {
          saveStoredPatients(response.data.data);
        }
        return response.data;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    // Offline fallback from device memory
    const stored = getStoredPatients();
    let filtered = stored;
    if (familyId) {
      filtered = filtered.filter((p) => p.familyId === familyId);
    }
    if (search && search.trim()) {
      const q = search.trim().toUpperCase();
      filtered = filtered.filter(
        (p) =>
          (p.name || '').toUpperCase().includes(q) ||
          (p.patientId || '').toUpperCase().includes(q) ||
          (p.phone || '').toUpperCase().includes(q)
      );
    }

    return {
      success: true,
      offline: true,
      data: filtered,
    };
  },

  getById: async (id) => {
    if (isOnline()) {
      try {
        const response = await api.get(`/patients/${id}`);
        return response.data;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    const stored = getStoredPatients();
    const found = stored.find((p) => p.patientId === id || p._id === id);
    return {
      success: !!found,
      offline: true,
      data: found || null,
    };
  },

  update: async (id, data) => {
    const response = await api.put(`/patients/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/patients/${id}`);
    return response.data;
  },
};

// ----------------------------------------------------------------------------
// 5. Visit / Prescription API (Online-first; saves to device memory ONLY when offline)
// ----------------------------------------------------------------------------
export const visitAPI = {
  create: async (data) => {
    // Note: Records only store in memory when internet is not available only.
    if (!isOnline()) {
      return recordOfflineVisit(data);
    }

    try {
      const response = await api.post('/visits', data);
      return response.data;
    } catch (err) {
      if (isNetworkError(err)) {
        return recordOfflineVisit(data);
      }
      throw err;
    }
  },

  getByPatient: async (patientId) => {
    const offlineVisits = getOfflineVisits(patientId);

    if (isOnline()) {
      try {
        const response = await api.get('/visits', {
          params: { patientId },
        });
        const onlineVisits = response.data?.data || [];
        return {
          success: true,
          data: [...offlineVisits, ...onlineVisits],
        };
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    return {
      success: true,
      offline: true,
      data: offlineVisits,
    };
  },

  getByFamily: async (familyId) => {
    const offlineVisits = getOfflineVisits(null, familyId);

    if (isOnline()) {
      try {
        const response = await api.get('/visits', {
          params: { familyId },
        });
        const onlineVisits = response.data?.data || [];
        return {
          success: true,
          data: [...offlineVisits, ...onlineVisits],
        };
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    return {
      success: true,
      offline: true,
      data: offlineVisits,
    };
  },

  update: async (id, data) => {
    const response = await api.put(`/visits/${id}`, data);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/visits/${id}`);
    return response.data;
  },
};

// ----------------------------------------------------------------------------
// 6. Reports API
// ----------------------------------------------------------------------------
export const reportAPI = {
  getDashboardSummary: async (params = {}) => {
    const response = await api.get('/reports/dashboard-summary', { params });
    return response.data;
  },
  getAreaWise: async (params = {}) => {
    const response = await api.get('/reports/area-wise', { params });
    return response.data;
  },
  getRefDoctor: async (params = {}) => {
    const response = await api.get('/reports/ref-doctor', { params });
    return response.data;
  },
  getPatientHistory: async (params = {}) => {
    const response = await api.get('/reports/patient-history', { params });
    return response.data;
  },
  getDailyCollections: async (params = {}) => {
    const response = await api.get('/reports/daily-collections', { params });
    return response.data;
  },
  getMonthlyIncome: async (params = {}) => {
    const response = await api.get('/reports/monthly-income', { params });
    return response.data;
  },
  getDues: async (params = {}) => {
    const response = await api.get('/reports/dues', { params });
    return response.data;
  },
};

// ----------------------------------------------------------------------------
// 7. Medical Certificate API (Online-first; saves to device memory ONLY when offline)
// ----------------------------------------------------------------------------
export const certificateAPI = {
  getNextId: async () => {
    if (isOnline()) {
      try {
        const response = await api.get('/certificates/next-id');
        return response.data;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }
    return {
      success: true,
      offline: true,
      nextId: `CERT-OFFLINE-${Date.now().toString().slice(-4)}`,
    };
  },

  getTemplates: async () => {
    const response = await api.get('/certificates/templates');
    return response.data;
  },

  createTemplate: async (data) => {
    const response = await api.post('/certificates/templates', data);
    return response.data;
  },

  getAll: async (search = '', page = 1, limit = 10) => {
    const response = await api.get('/certificates', {
      params: { search: (search || '').trim(), page, limit },
    });
    return response.data;
  },

  issue: async (data) => {
    if (!isOnline()) {
      return issueOfflineCertificate(data);
    }
    try {
      const response = await api.post('/certificates', data);
      return response.data;
    } catch (err) {
      if (isNetworkError(err)) {
        return issueOfflineCertificate(data);
      }
      throw err;
    }
  },

  verify: async (certId) => {
    const response = await api.get(`/certificates/verify/${certId}`);
    return response.data;
  },

  delete: async (id) => {
    const response = await api.delete(`/certificates/${id}`);
    return response.data;
  },
};

// ----------------------------------------------------------------------------
// 8. Master Data API (Online-first; saves to device memory ONLY when offline)
// ----------------------------------------------------------------------------
export const masterDataAPI = {
  getItems: async (type = '', search = '', page = 1, limit = 50) => {
    if (isOnline()) {
      try {
        const response = await api.get('/master-data', {
          params: {
            type,
            search: (search || '').trim(),
            page,
            limit,
          },
        });
        if (response.data?.success && Array.isArray(response.data.data)) {
          const cached = getStoredMasterData();
          cached[type] = response.data.data;
          saveStoredMasterData(cached);
        }
        return response.data;
      } catch (err) {
        if (!isNetworkError(err)) throw err;
      }
    }

    // Offline master data resolution
    const cached = getStoredMasterData();
    const items = cached[type] || [];
    return {
      success: true,
      offline: true,
      data: items,
    };
  },

  addItem: async (data) => {
    if (!isOnline()) {
      return addOfflineMasterItem(data);
    }
    try {
      const response = await api.post('/master-data', data);
      return response.data;
    } catch (err) {
      if (isNetworkError(err)) {
        return addOfflineMasterItem(data);
      }
      throw err;
    }
  },

  updateItem: async (id, data) => {
    const response = await api.put(`/master-data/${id}`, data);
    return response.data;
  },

  deleteItem: async (id) => {
    const response = await api.delete(`/master-data/${id}`);
    return response.data;
  },
};

// ----------------------------------------------------------------------------
// 9. Lab Report API
// ----------------------------------------------------------------------------
export const labReportAPI = {
  create: async (data) => {
    const response = await api.post('/lab-reports', data);
    return response.data;
  },
  getAll: async (params = {}) => {
    const response = await api.get('/lab-reports', { params });
    return response.data;
  },
  getById: async (id) => {
    const response = await api.get(`/lab-reports/${id}`);
    return response.data;
  },
  delete: async (id) => {
    const response = await api.delete(`/lab-reports/${id}`);
    return response.data;
  },
};

export default api;
