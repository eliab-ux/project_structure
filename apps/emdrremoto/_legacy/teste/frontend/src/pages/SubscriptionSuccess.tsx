import { useEffect } from 'react';
import { useLocation, useHistory } from 'react-router-dom';
import { FaCheckCircle, FaArrowRight, FaHome } from 'react-icons/fa';

interface LocationState {
  plan?: {
    id: number;
    name: string;
    price: number;
    cycle: 'monthly' | 'yearly';
  };
  paymentMethod?: 'credit_card' | 'boleto';
  installments?: number;
  boletoUrl?: string;
}

const SubscriptionSuccess = () => {
  const location = useLocation();
  const history = useHistory();
  const state = location.state as LocationState;

  // Redireciona se não houver estado (acesso direto à URL)
  useEffect(() => {
    if (!state?.plan) {
      history.push('/planos');
    }
  }, [state, history]);

  if (!state?.plan) {
    return null;
  }

  const formatCurrency = (value: number) => {
    return (value / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md text-center">
        <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-green-100">
          <FaCheckCircle className="text-6xl text-green-600" aria-hidden="true" />
        </div>
        
        <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
          Parabéns!
        </h2>
        
        <p className="mt-2 text-gray-600">
          Sua assinatura do plano <strong>{state.plan.name}</strong> foi ativada com sucesso!
        </p>
        
        <div className="mt-6 bg-gray-50 p-4 rounded-md text-left">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Resumo da compra</h3>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Plano:</span>
              <span className="font-medium">{state.plan.name} ({state.plan.cycle === 'monthly' ? 'Mensal' : 'Anual'})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Valor:</span>
              <span className="font-medium">{formatCurrency(state.plan.price)}</span>
            </div>
            {state.paymentMethod === 'credit_card' && state.installments && state.installments > 1 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Parcelado em:</span>
                <span className="font-medium">{state.installments}x de {formatCurrency(state.plan.price / state.installments)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Forma de pagamento:</span>
              <span className="font-medium">
                {state.paymentMethod === 'credit_card' ? 'Cartão de Crédito' : 'Boleto Bancário'}
              </span>
            </div>
          </div>
        </div>

        {state.paymentMethod === 'boleto' && state.boletoUrl && (
          <div className="mt-4 p-4 bg-yellow-50 border-l-4 border-yellow-400">
            <p className="text-yellow-700">
              Seu boleto foi gerado com sucesso. O acesso será liberado após a confirmação do pagamento.
            </p>
            <a
              href={state.boletoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-yellow-600 hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
            >
              Imprimir Boleto
              <FaArrowRight className="ml-2 -mr-1" />
            </a>
          </div>
        )}
        
        <div className="mt-6">
          <p className="text-sm text-gray-500">
            Enviamos os detalhes da sua assinatura para o seu e-mail cadastrado.
          </p>
        </div>
        
        <div className="mt-8 flex justify-center space-x-4">
          <button
            onClick={() => history.push('/dashboard')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Acessar Plataforma
            <svg className="ml-2 -mr-1 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
          
          <button
            onClick={() => history.push('/')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <FaHome className="-ml-1 mr-2" />
            Página Inicial
          </button>
        </div>
        
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Precisa de ajuda?{' '}
            <a href="mailto:suporte@equipamentospsi.com.br" className="font-medium text-blue-600 hover:text-blue-500">
              Entre em contato com nosso suporte
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSuccess;
