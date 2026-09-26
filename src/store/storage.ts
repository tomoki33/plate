import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/** ネイティブ：expo-sqlite の kv-store（Webは storage.web.ts） */
export const kvStorage: StateStorage = {
  getItem: (k) => Storage.getItemSync(k),
  setItem: (k, v) => Storage.setItemSync(k, v),
  removeItem: (k) => {
    Storage.removeItemSync(k);
  },
};
