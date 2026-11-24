const DATABASE_NAME = 'inventory-and-billing-file-storage';
const STORE_NAME = 'directory-handles';
const DIRECTORY_HANDLE_KEY = 'offer-pdf-root';
const APP_FOLDER_NAME = 'Osan Lift';

let rootDirectoryHandle;
let userSelectedDirectory = false;

const openDatabase = () =>
  new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const readStoredDirectoryHandle = async () => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(DIRECTORY_HANDLE_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
};

const storeDirectoryHandle = async (handle) => {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(handle, DIRECTORY_HANDLE_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
};

readStoredDirectoryHandle()
  .then((handle) => {
    if (!userSelectedDirectory) rootDirectoryHandle = handle;
  })
  .catch((error) => {
    console.error('Could not restore the PDF save folder:', error);
  });

export const isOfferPdfStorageSupported = () =>
  typeof window.showDirectoryPicker === 'function' &&
  typeof window.indexedDB !== 'undefined';

export const requestOfferPdfDirectory = () => {
  if (!isOfferPdfStorageSupported()) {
    return Promise.reject(
      new Error('Saving to a selected folder requires Chrome or Edge with folder access enabled.')
    );
  }

  if (rootDirectoryHandle) {
    return rootDirectoryHandle.requestPermission({ mode: 'readwrite' }).then((permission) => {
      if (permission !== 'granted') {
        throw new Error('Folder access was not granted. Please allow access and try again.');
      }
      return rootDirectoryHandle;
    });
  }

  return window.showDirectoryPicker({ id: 'offer-pdf-root', mode: 'readwrite' }).then(async (handle) => {
    userSelectedDirectory = true;
    rootDirectoryHandle = handle;
    await storeDirectoryHandle(handle);
    return handle;
  });
};

const safeName = (value, fallback) => {
  const cleaned = Array.from(String(value || ''))
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || '<>:"/\\|?*'.includes(character) ? '_' : character;
    })
    .join('')
    .replace(/[. ]+$/g, '')
    .trim();

  return cleaned || fallback;
};

const writePdfFile = async (directoryHandle, blob, fileName) => {
  const fileHandle = await directoryHandle.getFileHandle(safeName(fileName, 'Document.pdf'), {
    create: true,
  });
  const writable = await fileHandle.createWritable();

  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    try {
      await writable.abort();
    } catch (abortError) {
      console.error('Could not clean up an incomplete PDF file:', abortError);
    }
    throw error;
  }
};

export const saveOfferRelatedPdf = async (
  rootHandle,
  blob,
  { companyName, offerId, fileName }
) => {
  const appDirectory = await rootHandle.getDirectoryHandle(APP_FOLDER_NAME, { create: true });
  const companyDirectory = await appDirectory.getDirectoryHandle(
    safeName(companyName, 'Unknown Company'),
    { create: true }
  );
  const offerDirectory = await companyDirectory.getDirectoryHandle(
    safeName(offerId, 'Unknown Offer'),
    { create: true }
  );
  await writePdfFile(offerDirectory, blob, fileName);
};

export const saveServicingDocumentPdf = async (
  rootHandle,
  blob,
  { companyName, fileName }
) => {
  const appDirectory = await rootHandle.getDirectoryHandle(APP_FOLDER_NAME, { create: true });
  const servicingBillDirectory = await appDirectory.getDirectoryHandle('Servicing_bill', {
    create: true,
  });
  const companyDirectory = await servicingBillDirectory.getDirectoryHandle(
    safeName(companyName, 'Unknown Company'),
    { create: true }
  );
  await writePdfFile(companyDirectory, blob, fileName);
};
