import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * cn() — Hana 版 className 工具
 * 合併 clsx 條件邏輯 + tailwind-merge 衝突解析。
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
