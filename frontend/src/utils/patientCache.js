import { patientAPI } from '../services/api';
import { getStoredPatients, saveStoredPatients } from './offlineSyncManager';

// Initialize global in-memory cache from persistent device memory
export let patientCache = getStoredPatients();
let isPreloading = false;

if (typeof window !== 'undefined') {
  window.patientCache = patientCache;

  // Reload patient cache when background sync completes
  window.addEventListener('dhyey_offline_sync_finished', () => {
    preloadPatients(true).catch(() => {});
  });
}

export const preloadPatients = async (force = false) => {
  if (!force && patientCache.length > 0) {
    return patientCache;
  }
  if (isPreloading) {
    return patientCache;
  }

  isPreloading = true;
  try {
    const res = await patientAPI.getAll('');
    if (res?.success && Array.isArray(res.data)) {
      patientCache = res.data;
      saveStoredPatients(patientCache);
      if (typeof window !== 'undefined') {
        window.patientCache = patientCache;
      }
      return patientCache;
    }
  } catch (err) {
    console.warn('[patientCache] Could not fetch from cloud, using device memory:', err);
    // Fall back to device memory
    patientCache = getStoredPatients();
    if (typeof window !== 'undefined') {
      window.patientCache = patientCache;
    }
  } finally {
    isPreloading = false;
  }
  return patientCache;
};

export const updateCachedPatient = (patient) => {
  if (!patient || (!patient.patientId && !patient._id)) return;
  const pid = patient.patientId || patient._id;
  const idx = patientCache.findIndex((p) => (p.patientId || p._id) === pid);
  if (idx !== -1) {
    patientCache[idx] = { ...patientCache[idx], ...patient };
  } else {
    patientCache.unshift(patient);
  }

  // Persist updated patient list to device memory
  saveStoredPatients(patientCache);

  if (typeof window !== 'undefined') {
    window.patientCache = patientCache;
  }
};

export const searchPatientsInMemory = (rawQuery) => {
  if (!rawQuery || !rawQuery.trim()) return [];
  const query = rawQuery.trim().toUpperCase();
  const tokens = query.split(/\s+/).filter(Boolean);

  return patientCache.filter((p) => {
    const name = (p.name || '').toUpperCase();
    const pid = (p.patientId || '').toUpperCase();
    const phone = (p.phone || '').toUpperCase();
    const famId = (p.familyId || '').toUpperCase();
    const headName = (p.family?.headName || '').toUpperCase();
    const area = (p.area || p.family?.area || '').toUpperCase();
    const society = (p.society || p.family?.society || '').toUpperCase();

    const combined = `${name} ${pid} ${phone} ${famId} ${headName} ${area} ${society}`;
    return tokens.every((token) => combined.includes(token));
  });
};
