import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || '/api';

interface Plan {
  id: number;
  name: string;
  price: number;
  cycle: 'monthly' | 'yearly';
  features: string[];
  isPopular?: boolean;
  maxInstallments: number;
}

interface SubscriptionData {
  planId: number;
  paymentMethod: 'credit_card' | 'boleto';
  installments?: number;
  card?: {
    number: string;
    holder_name: string;
    expiration_date: string;
    cvv: string;
  };
  cpf: string;
}

interface SubscriptionResponse {
  id: string;
  status: 'pending' | 'active' | 'cancelled' | 'failed';
  plan: Plan;
  paymentMethod: 'credit_card' | 'boleto';
  installments?: number;
  boletoUrl?: string;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
}

const subscriptionService = {
  // Buscar todos os planos disponíveis
  async getPlans(): Promise<Plan[]> {
    try {
      const response = await axios.get(`${API_URL}/plans`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar planos:', error);
      throw error;
    }
  },

  // Assinar um plano
  async subscribe(subscriptionData: SubscriptionData): Promise<SubscriptionResponse> {
    try {
      const response = await axios.post(`${API_URL}/subscribe`, subscriptionData);
      return response.data;
    } catch (error) {
      console.error('Erro ao assinar plano:', error);
      throw error;
    }
  },

  // Cancelar assinatura
  async cancelSubscription(subscriptionId: string): Promise<void> {
    try {
      await axios.post(`${API_URL}/subscriptions/${subscriptionId}/cancel`);
    } catch (error) {
      console.error('Erro ao cancelar assinatura:', error);
      throw error;
    }
  },

  // Obter detalhes de uma assinatura
  async getSubscription(subscriptionId: string): Promise<SubscriptionResponse> {
    try {
      const response = await axios.get(`${API_URL}/subscriptions/${subscriptionId}`);
      return response.data;
    } catch (error) {
      console.error('Erro ao buscar detalhes da assinatura:', error);
      throw error;
    }
  },

  // Listar todas as assinaturas do usuário
  async listSubscriptions(userId: string): Promise<SubscriptionResponse[]> {
    try {
      const response = await axios.get(`${API_URL}/users/${userId}/subscriptions`);
      return response.data;
    } catch (error) {
      console.error('Erro ao listar assinaturas:', error);
      throw error;
    }
  },

  // Gerar novo boleto para assinatura
  async generateNewBoleto(subscriptionId: string): Promise<{ boletoUrl: string }> {
    try {
      const response = await axios.post(`${API_URL}/subscriptions/${subscriptionId}/generate-boleto`);
      return response.data;
    } catch (error) {
      console.error('Erro ao gerar novo boleto:', error);
      throw error;
    }
  },

  // Atualizar método de pagamento
  async updatePaymentMethod(
    subscriptionId: string, 
    paymentMethod: 'credit_card' | 'boleto', 
    cardData?: any
  ): Promise<void> {
    try {
      await axios.put(`${API_URL}/subscriptions/${subscriptionId}/payment-method`, {
        paymentMethod,
        card: paymentMethod === 'credit_card' ? cardData : null
      });
    } catch (error) {
      console.error('Erro ao atualizar método de pagamento:', error);
      throw error;
    }
  }
};

export default subscriptionService;
