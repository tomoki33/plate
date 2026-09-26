import { randomUUID } from 'expo-crypto';

/** 全テーブルの id は UUID */
export const uuid = (): string => randomUUID();
