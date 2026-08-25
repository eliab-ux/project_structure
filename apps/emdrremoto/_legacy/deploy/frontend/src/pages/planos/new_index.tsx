import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import PlanCard from '../../components/PlanCard';
import PaymentModal from '../../components/PaymentModal';
import './styles.css';

interface Plan {
  id: number;
  name: string;
  price: number;
  cycle: 'monthly' | 'yearly';
  features: string[];
  maxInstallments: number;
  isPopular?: boolean;
}

const Planos: React.FC = () => {
  const history = useHistory();
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const plans: Plan[] = [
    {
      id: 1,
      name: 'Plano Mensal',
      price: 7000, // R$ 70,00 em centavos
      cycle: 'monthly',
      features: [
        'Visual + auditivo bilateral',
        'Videochamada',
        'Gerenciamento de pacientes',
        'Segurança avançada',
        'Atualizações',
        'Suporte WhatsApp',
        'Uso ilimitado'
      ],
      maxInstallments: 1
    },
    {
      id: 2,
      name: 'Plano Anual',
      price: 71500, // R$ 715,00 em centavos
      cycle: 'yearly',
      features: [
        'Tudo do Plano Mensal',
        'Economize 15%',
        'Parcelamento em até 3x',
        'Suporte prioritário',
        'Atualizações ilimitadas',
        'Suporte WhatsApp',
        'Uso ilimitado'
      ],
      maxInstallments: 3,
      isPopular: true
    }
  ];

  const handleVoltar = () => {
    history.goBack();
  };

  const handleSubscribe = (plan: Plan) => {
    setSelectedPlan(plan);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async (paymentData: any) => {
    try {
      // Aqui você faria a chamada para sua API
      console.log('Dados do pagamento:', paymentData);
      
      // Exemplo de chamada para a API (descomente quando a rota estiver disponível)
      // const response = await fetch('/api/subscribe', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${localStorage.getItem('token')}`
      //   },
      //   body: JSON.stringify({
      //     planId: selectedPlan?.id,
      //     ...paymentData
      //   })
      // });
      
      // if (response.ok) {
      //   const data = await response.json();
      //   if (data.paymentUrl) {
      //     window.location.href = data.paymentUrl; // Para boleto
      //   } else {
      //     // Pagamento com cartão processado com sucesso
      //     history.push('/pagamento/sucesso');
      //   }
      // } else {
      //   throw new Error('Erro ao processar pagamento');
      // }
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      alert('Ocorreu um erro ao processar seu pagamento. Tente novamente.');
    } finally {
      setIsPaymentModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">EQUIPAMENTOS PSI</h1>
          <button
            onClick={handleVoltar}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Voltar
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Escolha o Melhor Plano para Você
          </h2>
          <p className="mt-3 max-w-2xl mx-auto text-xl text-gray-500 sm:mt-4">
            Selecione a opção que melhor atende às suas necessidades
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard 
              key={plan.id} 
              plan={plan} 
              onSubscribe={() => handleSubscribe(plan)} 
            />
          ))}
        </div>
      </main>

      {selectedPlan && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          plan={selectedPlan}
          onSubmit={handlePaymentSubmit}
        />
      )}
    </div>
  );
};

export default Planos;
