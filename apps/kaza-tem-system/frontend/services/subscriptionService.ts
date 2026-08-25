import api from './api';

const BASE_PATH = '/subscriptions';

export interface CardPayload {
  number: string;
  holder: string;
  expirationDate: string;
  securityCode: string;
  brand: string;
}

export interface CustomerPayload {
  name: string;
  email: string;
  document: string;
}

export interface CreateSubscriptionPayload {
  resellerId: string;
  card: CardPayload;
  customer: CustomerPayload;
  amount?: number;
}

export interface SubscriptionDetails {
  id: string;
  resellerId: string;
  status: 'active' | 'suspended' | 'canceled';
  amount: number;
  nextBillingDate: string;
  startedAt: string;
  canceledAt?: string | null;
}

export async function createSubscription(payload: CreateSubscriptionPayload) {
  const response = await api.post<SubscriptionDetails>(BASE_PATH, payload);
  return response.data;
}

export async function getSubscription(resellerId: string) {
  const response = await api.get<SubscriptionDetails | null>(`${BASE_PATH}/me`, {
    params: { resellerId },
  });
  return response.data;
}

export async function cancelSubscription(subscriptionId: string) {
  await api.delete(BASE_PATH + '/me', {
    params: { subscriptionId },
  });
}
