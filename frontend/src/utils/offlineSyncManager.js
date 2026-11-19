// ============================================================================
// Dhyey Clinic Management System - Offline-First Sync Manager
// Enables full offline PWA usability with local device memory storage
// and automatic background sync to cloud database (MongoDB) when online.
// ============================================================================

const QUEUE_KEY = 'dhyey_offline_sync_queue';
const PATIENTS_CACHE_KEY = 'dhyey_offline_patients';
const FAMILIES_CACHE_KEY = 'dhyey_offline_families';
const VISITS_CACHE_KEY = 'dhyey_offline_visits';
const MASTER_DATA_KEY = 'dhyey_offline_master_data';
const DOCTOR_KEY = 'dhyey_offline_doctor';

// Listeners for sync state changes (UI components can subscribe)
const syncListeners = new Set();

export const addSyncListener = (fn) => {
  if (typeof fn === 'function') syncListeners.add(fn);
  return () => syncListeners.delete(fn);
};

export const notifySyncListeners = (data) => {
  syncListeners.forEach((fn) => {
    try {
      fn(data);
    } catch (e) {
      console.warn('[SyncManager] Listener error:', e);
    }
  });
};

// Network status checker
export const isOnline = () => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  return true;
};

// Check if an error indicates lack of internet connection
export const isNetworkError = (error) => {
  if (!isOnline()) return true;
  if (!error) return false;
  if (error.response && error.response.status === 503 && error.response.data?.offline) {
    return true;
  }
  if (!error.response && (error.code === 'ERR_NETWORK' || error.message?.includes('Network Error'))) {
    return true;
  }
  return false;
};

// ----------------------------------------------------------------------------
// Device Memory Storage Helpers (localStorage-backed persistent storage)
// ----------------------------------------------------------------------------
const loadFromStorage = (key, fallback = []) => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.warn(`[SyncManager] Error reading ${key} from storage:`, err);
    return fallback;
  }
};

const saveToStorage = (key, data) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`[SyncManager] Error saving ${key} to storage:`, err);
  }
};

// ----------------------------------------------------------------------------
// Offline Sync Queue Management
// ----------------------------------------------------------------------------
export const getOfflineQueue = () => loadFromStorage(QUEUE_KEY, []);

export const getOfflineQueueCount = () => {
  const queue = getOfflineQueue();
  return queue.length;
};

export const enqueueOfflineAction = ({
  entityType,
  endpoint,
  method = 'POST',
  payload,
  tempId,
  extra = {},
}) => {
  const queue = getOfflineQueue();
  const syncItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    entityType,
    endpoint,
    method,
    payload,
    tempId,
    extra,
    createdAt: new Date().toISOString(),
  };

  queue.push(syncItem);
  saveToStorage(QUEUE_KEY, queue);

  notifySyncListeners({
    type: 'ENQUEUED',
    count: queue.length,
    item: syncItem,
  });

  return syncItem;
};

export const removeOfflineAction = (actionId) => {
  const queue = getOfflineQueue();
  const filtered = queue.filter((item) => item.id !== actionId);
  saveToStorage(QUEUE_KEY, filtered);

  notifySyncListeners({
    type: 'DEQUEUED',
    count: filtered.length,
    removedId: actionId,
  });
};

export const clearOfflineQueue = () => {
  saveToStorage(QUEUE_KEY, []);
  notifySyncListeners({ type: 'CLEARED', count: 0 });
};

// ----------------------------------------------------------------------------
// Offline Entity Handlers (Saves strictly in device memory when offline)
// ----------------------------------------------------------------------------

// 1. Visit / Prescription
export const recordOfflineVisit = (data) => {
  const tempVisitId = `OFFLINE_VISIT_${Date.now()}`;
  const numCharge = Math.max(0, Number(data.charge) || 0);
  const numReceived = Math.max(0, Number(data.received) || 0);
  const numDue = Math.max(0, numCharge - numReceived);

  const offlineVisit = {
    _id: tempVisitId,
    patientId: data.patientId,
    familyId: data.familyId,
    patientName: data.patientName,
    visitDate: data.visitDate || new Date().toISOString().split('T')[0],
    bp: data.bp || '',
    sugar: data.sugar || '',
    other: data.other || '',
    reference: data.reference || '',
    investigation: data.investigation || '',
    complaint: data.complaint || '',
    treatments: data.treatments || [],
    prescriptions: data.prescriptions || [],
    dietary: data.dietary || '',
    charge: numCharge,
    received: numReceived,
    due: numDue,
    labReport: data.labReport || null,
    isOffline: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Persist visit to local device memory
  const visits = loadFromStorage(VISITS_CACHE_KEY, []);
  visits.unshift(offlineVisit);
  saveToStorage(VISITS_CACHE_KEY, visits);

  // Update cached patient's due amount
  if (numDue > 0 && typeof window !== 'undefined' && Array.isArray(window.patientCache)) {
    const p = window.patientCache.find(
      (pat) => (pat.patientId || pat._id) === data.patientId
    );
    if (p) {
      p.totalDue = (Number(p.totalDue) || 0) + numDue;
      saveToStorage(PATIENTS_CACHE_KEY, window.patientCache);
    }
  }

  // Enqueue for cloud synchronization
  enqueueOfflineAction({
    entityType: 'VISIT',
    endpoint: '/visits',
    method: 'POST',
    payload: data,
    tempId: tempVisitId,
  });

  let updatedPatientDue = undefined;
  if (typeof window !== 'undefined' && Array.isArray(window.patientCache)) {
    const p = window.patientCache.find(
      (pat) => (pat.patientId || pat._id) === data.patientId
    );
    if (p) updatedPatientDue = p.totalDue;
  }

  return {
    success: true,
    offline: true,
    message: 'Visit saved to device memory (Offline). Will auto-sync when online.',
    data: offlineVisit,
    visit: offlineVisit,
    totalDue: updatedPatientDue,
  };
};

export const getOfflineVisits = (patientId = null, familyId = null) => {
  const visits = loadFromStorage(VISITS_CACHE_KEY, []);
  return visits.filter((v) => {
    if (patientId && v.patientId !== patientId) return false;
    if (familyId && v.familyId !== familyId) return false;
    return true;
  });
};

// 2. Family Head Registration
export const registerOfflineFamily = (data) => {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const tempFamilyId = `F-OFFLINE-${randomSuffix}`;
  const tempPatientId = `P-OFFLINE-${randomSuffix}-1`;

  const offlineFamily = {
    _id: `temp_fam_${Date.now()}`,
    familyId: tempFamilyId,
    headName: data.headName,
    society: data.society || '',
    area: data.area || '',
    phone: data.phone || '',
    registrationDoneBy: data.registrationDoneBy || 'Self (Head of Family)',
    membersCount: 1,
    familyDue: 0,
    isOffline: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const offlineHeadPatient = {
    _id: `temp_pat_${Date.now()}`,
    patientId: tempPatientId,
    familyId: tempFamilyId,
    name: data.headName,
    age: data.age || '',
    gender: data.gender || 'Male',
    bloodGroup: data.bloodGroup || '',
    allergies: data.allergy ? [data.allergy] : [],
    society: data.society || '',
    area: data.area || '',
    phone: data.phone || '',
    relation: 'Self',
    isHead: true,
    registrationDoneBy: data.registrationDoneBy || 'Self (Head of Family)',
    totalDue: 0,
    isOffline: true,
    family: offlineFamily,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Persist family to device memory
  const families = loadFromStorage(FAMILIES_CACHE_KEY, []);
  families.unshift(offlineFamily);
  saveToStorage(FAMILIES_CACHE_KEY, families);

  // Add head patient to patient cache & device memory
  const patients = loadFromStorage(PATIENTS_CACHE_KEY, []);
  patients.unshift(offlineHeadPatient);
  saveToStorage(PATIENTS_CACHE_KEY, patients);

  if (typeof window !== 'undefined') {
    if (!Array.isArray(window.patientCache)) window.patientCache = [];
    window.patientCache.unshift(offlineHeadPatient);
  }

  // Enqueue for cloud sync
  enqueueOfflineAction({
    entityType: 'FAMILY',
    endpoint: '/families',
    method: 'POST',
    payload: data,
    tempId: tempFamilyId,
    extra: {
      tempPatientId,
    },
  });

  return {
    success: true,
    offline: true,
    message: 'Family Head saved to device memory (Offline). Will auto-sync when online.',
    family: offlineFamily,
    data: offlineFamily,
    patient: offlineHeadPatient,
  };
};

export const getOfflineFamilies = (search = '') => {
  const families = loadFromStorage(FAMILIES_CACHE_KEY, []);
  if (!search || !search.trim()) return families;
  const q = search.trim().toUpperCase();
  return families.filter(
    (f) =>
      (f.headName || '').toUpperCase().includes(q) ||
      (f.familyId || '').toUpperCase().includes(q) ||
      (f.phone || '').toUpperCase().includes(q) ||
      (f.society || '').toUpperCase().includes(q)
  );
};

// 3. Add Family Member
export const addOfflineMember = (data) => {
  const tempPatientId = `P-${data.familyId}-${Date.now().toString().slice(-4)}`;

  const offlinePatient = {
    _id: `temp_pat_${Date.now()}`,
    patientId: tempPatientId,
    familyId: data.familyId,
    name: data.name,
    age: data.age || '',
    gender: data.gender || 'Not Specified',
    bloodGroup: data.bloodGroup || '',
    allergies: Array.isArray(data.allergies) ? data.allergies : data.allergies ? [data.allergies] : [],
    society: data.society || '',
    area: data.area || '',
    phone: data.phone || '',
    relation: data.relation || 'Family Member',
    isHead: false,
    registrationDoneBy: data.registrationDoneBy || 'Family Member',
    totalDue: 0,
    isOffline: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Add to patient cache & device memory
  const patients = loadFromStorage(PATIENTS_CACHE_KEY, []);
  patients.unshift(offlinePatient);
  saveToStorage(PATIENTS_CACHE_KEY, patients);

  if (typeof window !== 'undefined') {
    if (!Array.isArray(window.patientCache)) window.patientCache = [];
    window.patientCache.unshift(offlinePatient);
  }

  // Update member count on cached family
  const families = loadFromStorage(FAMILIES_CACHE_KEY, []);
  const fam = families.find((f) => f.familyId === data.familyId);
  if (fam) {
    fam.membersCount = (Number(fam.membersCount) || 1) + 1;
    saveToStorage(FAMILIES_CACHE_KEY, families);
  }

  // Enqueue for cloud sync
  enqueueOfflineAction({
    entityType: 'PATIENT',
    endpoint: '/patients',
    method: 'POST',
    payload: data,
    tempId: tempPatientId,
  });

  return {
    success: true,
    offline: true,
    message: 'Family member saved to device memory (Offline). Will auto-sync when online.',
    patient: offlinePatient,
    data: offlinePatient,
    family: fam || null,
  };
};

// 4. Medical Certificate
export const issueOfflineCertificate = (data) => {
  const tempCertId = `CERT-OFFLINE-${Date.now().toString().slice(-4)}`;
  const offlineCert = {
    _id: `temp_cert_${Date.now()}`,
    certificateId: tempCertId,
    ...data,
    isOffline: true,
    issueDate: data.issueDate || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
  };

  enqueueOfflineAction({
    entityType: 'CERTIFICATE',
    endpoint: '/certificates',
    method: 'POST',
    payload: data,
    tempId: tempCertId,
  });

  return {
    success: true,
    offline: true,
    message: 'Certificate recorded in device memory (Offline). Will auto-sync when online.',
    data: offlineCert,
  };
};

// 5. Master Data
export const addOfflineMasterItem = (data) => {
  const tempId = `temp_master_${Date.now()}`;
  const offlineItem = {
    _id: tempId,
    ...data,
    isOffline: true,
    createdAt: new Date().toISOString(),
  };

  // Update master data cache in memory & storage
  const masterData = loadFromStorage(MASTER_DATA_KEY, {});
  const type = data.type;
  if (!masterData[type]) masterData[type] = [];
  masterData[type].push(offlineItem);
  saveToStorage(MASTER_DATA_KEY, masterData);

  if (typeof window !== 'undefined' && window.masterDataCache) {
    if (!window.masterDataCache[type]) window.masterDataCache[type] = [];
    window.masterDataCache[type].push(offlineItem);
  }

  enqueueOfflineAction({
    entityType: 'MASTER_DATA',
    endpoint: '/master-data',
    method: 'POST',
    payload: data,
    tempId,
  });

  return {
    success: true,
    offline: true,
    message: 'Master item saved to device memory (Offline). Will auto-sync when online.',
    data: offlineItem,
  };
};

// ----------------------------------------------------------------------------
// Background Auto-Sync Engine
// ----------------------------------------------------------------------------
let isSyncInProgress = false;

export const syncOfflineRecords = async (apiClient) => {
  if (isSyncInProgress) {
    console.log('[SyncManager] Sync already in progress, skipping duplicate call.');
    return;
  }

  if (!isOnline()) {
    console.log('[SyncManager] Cannot sync: Internet is still offline.');
    return;
  }

  const queue = getOfflineQueue();
  if (!queue || queue.length === 0) {
    return;
  }

  isSyncInProgress = true;
  console.log(`[SyncManager] Internet available! Starting auto-sync of ${queue.length} offline record(s) to cloud database...`);

  notifySyncListeners({
    type: 'SYNC_START',
    total: queue.length,
    pending: queue.length,
  });

  // Map to translate client-generated temporary IDs to real MongoDB IDs
  const idMappings = {
    families: {}, // tempFamilyId -> realFamilyId
    patients: {}, // tempPatientId -> realPatientId
  };

  let syncedSuccessCount = 0;
  let failureCount = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    try {
      // Substitute any temporary family or patient IDs with the real IDs assigned by server
      const payload = { ...item.payload };

      if (payload.familyId && idMappings.families[payload.familyId]) {
        payload.familyId = idMappings.families[payload.familyId];
      }
      if (payload.patientId && idMappings.patients[payload.patientId]) {
        payload.patientId = idMappings.patients[payload.patientId];
      }

      let res;
      if (item.method === 'POST') {
        res = await apiClient.post(item.endpoint, payload);
      } else if (item.method === 'PUT') {
        res = await apiClient.put(item.endpoint, payload);
      } else if (item.method === 'DELETE') {
        res = await apiClient.delete(item.endpoint);
      }

      if (res && (res.status === 200 || res.status === 201) && res.data?.success) {
        // Track ID translation for dependent child records
        if (item.entityType === 'FAMILY' && res.data.data?.familyId) {
          if (item.tempId) {
            idMappings.families[item.tempId] = res.data.data.familyId;
          }
          if (item.extra?.tempPatientId && res.data.patient?.patientId) {
            idMappings.patients[item.extra.tempPatientId] = res.data.patient.patientId;
          }
        } else if (item.entityType === 'PATIENT' && res.data.data?.patientId) {
          if (item.tempId) {
            idMappings.patients[item.tempId] = res.data.data.patientId;
          }
        }

        // Successfully stored in MongoDB Atlas! Remove from offline queue
        removeOfflineAction(item.id);
        syncedSuccessCount++;

        notifySyncListeners({
          type: 'SYNC_PROGRESS',
          syncedCount: syncedSuccessCount,
          total: queue.length,
          item,
        });
      } else {
        failureCount++;
      }
    } catch (err) {
      console.error(`[SyncManager] Failed to sync item ${item.id}:`, err);
      // If error is a validation error (400), don't infinitely block the queue
      if (err.response && err.response.status === 400) {
        console.warn(`[SyncManager] Removing invalid item ${item.id} from queue:`, err.response.data);
        removeOfflineAction(item.id);
      }
      failureCount++;
    }
  }

  isSyncInProgress = false;
  const remainingCount = getOfflineQueueCount();

  console.log(`[SyncManager] Auto-sync finished. Synced: ${syncedSuccessCount}, Remaining: ${remainingCount}`);

  notifySyncListeners({
    type: 'SYNC_COMPLETE',
    syncedCount: syncedSuccessCount,
    remainingCount,
  });

  // Notify the app so caches and UI views re-fetch from cloud database
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('dhyey_offline_sync_finished', {
        detail: { syncedCount: syncedSuccessCount, remainingCount },
      })
    );
  }
};

// ----------------------------------------------------------------------------
// Persistent Doctor Session for Offline PWA Access
// ----------------------------------------------------------------------------
export const saveDoctorOfflineSession = (doctor) => {
  if (!doctor) return;
  saveToStorage(DOCTOR_KEY, doctor);
};

export const getDoctorOfflineSession = () => {
  return loadFromStorage(DOCTOR_KEY, null);
};

export const clearDoctorOfflineSession = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(DOCTOR_KEY);
  }
};

// ----------------------------------------------------------------------------
// Persistent Patient Cache Helpers
// ----------------------------------------------------------------------------
export const getStoredPatients = () => loadFromStorage(PATIENTS_CACHE_KEY, []);

export const saveStoredPatients = (patients) => {
  if (Array.isArray(patients)) {
    saveToStorage(PATIENTS_CACHE_KEY, patients);
  }
};

export const getStoredFamilies = () => loadFromStorage(FAMILIES_CACHE_KEY, []);

export const saveStoredFamilies = (families) => {
  if (Array.isArray(families)) {
    saveToStorage(FAMILIES_CACHE_KEY, families);
  }
};

export const getStoredMasterData = () => loadFromStorage(MASTER_DATA_KEY, {});

export const saveStoredMasterData = (data) => {
  saveToStorage(MASTER_DATA_KEY, data);
};

