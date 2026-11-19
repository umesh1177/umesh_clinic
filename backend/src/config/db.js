import dns from 'dns';
import mongoose from 'mongoose';

// Ensure reliable DNS resolution for mongodb+srv connections across environments
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch {
  // Ignore in environments where setServers is restricted
}

// Automatically sanitize URI: encode any literal '@' in password and target database
export const sanitizeMongoUri = (raw) => {
  if (!raw || !raw.trim()) {
    throw new Error(
      'MONGODB_URI is not defined in environment variables. Please configure MONGODB_URI in your .env file or environment.'
    );
  }
  let uri = raw.trim();

  // If password contains an unescaped '@' (producing multiple '@' characters in URI)
  const atCount = (uri.match(/@/g) || []).length;
  if (atCount > 1) {
    const lastAtIndex = uri.lastIndexOf('@');
    const prefix = uri.substring(0, lastAtIndex);
    const suffix = uri.substring(lastAtIndex);
    const schemeEnd = prefix.indexOf('://') + 3;
    const creds = prefix.substring(schemeEnd);
    const colonIndex = creds.indexOf(':');
    if (colonIndex !== -1) {
      const user = creds.substring(0, colonIndex);
      const rawPassword = creds.substring(colonIndex + 1);
      const encodedPassword = rawPassword.replace(/@/g, '%40');
      uri = `${prefix.substring(0, schemeEnd)}${user}:${encodedPassword}${suffix}`;
    }
  }

  // If URI ends with mongodb.net/ or has no db name before query string
  if (/mongodb\.net\/?(\?.*)?$/i.test(uri)) {
    uri = uri.replace(/mongodb\.net\/?(\?.*)?$/i, (match, query) => {
      return `mongodb.net/dhyey_clinic${query || '?retryWrites=true&w=majority'}`;
    });
  }

  return uri;
};

// Automatically cleanup stale indexes from earlier schema iterations if present
const cleanupStaleIndexes = async (db) => {
  const staleIndexes = [
    { coll: 'patients', index: 'clinicId_1_patientCode_1' },
    { coll: 'patients', index: 'clinicId_1' },
    { coll: 'families', index: 'clinicId_1_familyCode_1' },
    { coll: 'families', index: 'clinicId_1' },
    { coll: 'counters', index: 'clinicId_1' },
    { coll: 'visits', index: 'clinicId_1' },
    { coll: 'dietaries', index: 'clinicId_1_code_1' },
    { coll: 'dietaries', index: 'clinicId_1' },
    { coll: 'certificates', index: 'clinicId_1' },
    { coll: 'certificates', index: 'clinicId_1_certificateId_1' },
  ];

  for (const item of staleIndexes) {
    try {
      await db.collection(item.coll).dropIndex(item.index);
      console.log(`[Stale Index Removed]: ${item.coll}.${item.index}`);
    } catch {
      // Index already absent, normal behavior
    }
  }
};

const connectDB = async () => {
  try {
    const mongoUri = sanitizeMongoUri(process.env.MONGODB_URI);
    const conn = await mongoose.connect(mongoUri);
    console.log(`[MongoDB Connected]: ${conn.connection.host} / ${conn.connection.name}`);

    // Clean any residual stale indexes on connected database
    await cleanupStaleIndexes(conn.connection.db);
  } catch (error) {
    console.error(`[MongoDB Connection Error]: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
