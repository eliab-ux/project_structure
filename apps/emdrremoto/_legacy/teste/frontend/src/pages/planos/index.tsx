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
    const token = localStorage.getItem('token');
    if (!token) {
      // Usuário não autenticado; envia para login. Pode incluir retorno.
      history.push(`/login?redirect=/planos`);
      return;
    }
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

      <section className="max-w-4xl mx-auto px-4 py-12 sm:px-6">
        <h3 className="text-2xl font-bold text-center mb-8">Perguntas Frequentes</h3>
        
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h4 className="text-lg font-semibold mb-2">Como funciona o pagamento?</h4>
            <p className="text-gray-600">Aceitamos cartões de crédito e boleto bancário. Para pacotes, o pagamento é único. Para assinaturas, a cobrança é mensal.</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h4 className="text-lg font-semibold mb-2">Posso cancelar a qualquer momento?</h4>
            <p className="text-gray-600">Sim, você pode cancelar sua assinatura a qualquer momento. O acesso será mantido até o final do período contratado.</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h4 className="text-lg font-semibold mb-2">Como funciona o reembolso?</h4>
            <p className="text-gray-600">Oferecemos reembolso integral em até 7 dias após a compra, desde que o serviço não tenha sido utilizado.</p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h4 className="text-lg font-semibold mb-2">Preciso assinar um contrato?</h4>
            <p className="text-gray-600">Não é necessário assinar contrato. Nossos planos funcionam no sistema de assinatura mensal ou anual, conforme sua preferência.</p>
          </div>
        </div>
      </section>

      <footer className="planos-footer">
        <p> {new Date().getFullYear()} Equipamentos PSI. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
};

export default Planos;
