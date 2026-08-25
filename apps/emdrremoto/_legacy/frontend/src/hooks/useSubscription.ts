import { useState, useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import subscriptionService from '../services/subscription.service';

interface UseSubscriptionReturn {
  plans: any[];
  isLoading: boolean;
  error: string | null;
  selectedPlan: any | null;
  isProcessing: boolean;
  fetchPlans: () => Promise<void>;
  selectPlan: (plan: any) => void;
  clearSelection: () => void;
  processSubscription: (paymentData: any) => Promise<boolean>;
}

export const useSubscription = (): UseSubscriptionReturn => {
  const [plans, setPlans] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const history = useHistory();

  const fetchPlans = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Em produção, descomente a linha abaixo
      // const data = await subscriptionService.getPlans();
      
      // Dados mockados para desenvolvimento
      const mockPlans = [
        {
          id: 1,
          name: 'Mensal',
          price: 7000, // R$ 70,00 em centavos
          cycle: 'monthly',
          features: [
            'Visual + auditivo bilateral',
            'Videochamada ilimitada',
            'Gerenciamento de pacientes',
            'Segurança avançada',
            'Atualizações constantes',
            'Suporte WhatsApp',
            'Uso ilimitado'
          ],
          isPopular: true,
          maxInstallments: 1
        },
        {
          id: 2,
          name: 'Anual',
          price: 71500, // R$ 715,00 em centavos
          cycle: 'yearly',
          features: [
            'Tudo do Plano Mensal',
            'Economia de 15%',
            'Pagamento em até 3x sem juros',
            'Suporte prioritário',
            'Acesso antecipado a novos recursos',
            'Relatórios avançados',
            'Desconto em treinamentos'
          ],
          maxInstallments: 3
        }
      ];
      
      setPlans(mockPlans);
    } catch (err) {
      console.error('Erro ao buscar planos:', err);
      setError('Não foi possível carregar os planos. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const selectPlan = (plan: any) => {
    setSelectedPlan(plan);
  };

  const clearSelection = () => {
    setSelectedPlan(null);
  };

  const processSubscription = async (paymentData: any): Promise<boolean> => {
    if (!selectedPlan) return false;
    
    setIsProcessing(true);
    setError(null);
    
    try {
      // Em produção, descomente e use o serviço real
      // const subscription = await subscriptionService.subscribe({
      //   planId: selectedPlan.id,
      //   paymentMethod: paymentData.paymentMethod,
      //   installments: paymentData.installments,
      //   card: paymentData.card,
      //   cpf: paymentData.cpf
      // });
      
      // Simulando uma resposta de sucesso
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Navegar para a página de sucesso com os dados da assinatura
      history.push({
        pathname: '/assinatura/sucesso',
        state: {
          plan: selectedPlan,
          paymentMethod: paymentData.paymentMethod,
          installments: paymentData.installments,
          // boletoUrl: subscription.boletoUrl
        }
      });
      
      return true;
    } catch (err) {
      console.error('Erro ao processar assinatura:', err);
      setError('Ocorreu um erro ao processar sua assinatura. Por favor, tente novamente.');
      return false;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    plans,
    isLoading,
    error,
    selectedPlan,
    isProcessing,
    fetchPlans,
    selectPlan,
    clearSelection,
    processSubscription
  };
};

export default useSubscription;
