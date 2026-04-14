const DB_NAME = 'benam_db';
const STORE_NAME = 'state';
const DB_VERSION = 1;

let cachedDb = null;

export function openDatabase() {
  if (window.IDB?.open) {
    return window.IDB.open();
  }

  if (cachedDb) {
    return Promise.resolve(cachedDb);
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (event) => {
      cachedDb = event.target.result;
      resolve(cachedDb);
    };
    request.onerror = (event) => reject(event);
  });
}

export async function saveRecord(key, data) {
  if (window.IDB?.save) {
    return window.IDB.save(key, data);
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = (error) => reject(error);
    tx.objectStore(STORE_NAME).put(data, key);
  });
}

export async function loadRecord(key) {
  if (window.IDB?.load) {
    return window.IDB.load(key);
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = (error) => reject(error);
  });
}

export function initIndexedDbService() {
  if (!window.BENAM_LEGACY) {
    window.BENAM_LEGACY = {};
  }

  window.BENAM_LEGACY.indexedDbService = {
    openDatabase,
    saveRecord,
    loadRecord,
  };
}