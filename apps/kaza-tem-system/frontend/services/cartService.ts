const STORAGE_KEY = 'kazaTemCart';

export interface CartItem {
  productId: string;
  sku: string;
  name: string;
  image?: string;
  price: number;
  quantity: number;
}

function getStoredCart(): CartItem[] {
  const stored = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch (error) {
    console.warn('failed to parse cart', error);
    return [];
  }
}

function clearCart() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const cartService = {
  getStoredCart,
  clearCart,
};
