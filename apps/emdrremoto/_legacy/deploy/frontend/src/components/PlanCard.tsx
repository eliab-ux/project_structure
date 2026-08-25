import React from 'react';

type BillingCycle = 'monthly' | 'yearly';

interface Plan {
  id: number;
  name: string;
  price: number;
  cycle: BillingCycle;
  features: string[];
  isPopular?: boolean;
}

interface PlanCardProps {
  plan: Plan;
  onSubscribe: (planId: number) => void;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, onSubscribe }) => {
  const formatPrice = (price: number): string => {
    return (price / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    });
  };

  const priceInReais = formatPrice(plan.price);
  const isYearly = plan.cycle === 'yearly';

  return (
    <article 
      className={`relative bg-white rounded-lg shadow-md p-8 flex flex-col h-full transition-all duration-300 hover:shadow-lg ${
        plan.isPopular ? 'border-2 border-blue-500 transform -translate-y-1' : 'border border-gray-200'
      }`}
      aria-labelledby={`plan-${plan.id}-title`}
    >
      {plan.isPopular && (
        <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs font-bold px-4 py-1 rounded-bl-lg rounded-tr-lg">
          MAIS POPULAR
        </div>
      )}
      
      <header className="mb-6">
        <h3 
          id={`plan-${plan.id}-title`}
          className="text-2xl font-bold text-gray-900 mb-2 text-center"
        >
          {plan.name}
        </h3>
      </header>
      
      <div className="text-center my-6 flex flex-col items-center">
        <div className="flex items-baseline">
          <span className="text-4xl font-extrabold text-gray-900">
            {priceInReais}
          </span>
          <span className="ml-2 text-lg text-gray-600">
            /{isYearly ? 'ano' : 'mês'}
          </span>
        </div>
        {isYearly && (
          <p className="text-sm text-green-600 mt-2 font-medium">
            Economize 15% com o plano anual
          </p>
        )}
      </div>
      
      <ul className="space-y-3 mb-8 flex-grow">
        {plan.features.map((feature) => {
          const featureId = `${plan.id}-${feature.substring(0, 20).replace(/\s+/g, '-').toLowerCase()}`;
          
          return (
            <li 
              key={featureId}
              className="flex items-start"
              aria-labelledby={`feature-${featureId}`}
            >
              <svg 
                className="h-5 w-5 text-green-500 flex-shrink-0 mr-2 mt-0.5" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                aria-hidden="true"
              >
                <title>Incluído</title>
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M5 13l4 4L19 7" 
                />
              </svg>
              <span id={`feature-${featureId}`}>
                {feature}
              </span>
            </li>
          );
        })}
      </ul>
      
      <div className="mt-auto">
        <button
          onClick={() => onSubscribe(plan.id)}
          className={`w-full px-6 py-3 rounded-md font-medium text-white transition-colors duration-200 ${
            plan.isPopular 
              ? 'bg-blue-600 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2' 
              : 'bg-gray-800 hover:bg-gray-700 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2'
          }`}
          aria-label={`Assinar plano ${plan.name} por ${priceInReais} por ${isYearly ? 'ano' : 'mês'}`}
        >
          Assinar Agora
        </button>
      </div>
    </article>
  );
};

export default PlanCard;
