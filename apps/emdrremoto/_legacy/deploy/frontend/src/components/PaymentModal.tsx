import React, { useState, useEffect, FormEvent, ChangeEvent, useCallback } from 'react';
import { FaCreditCard, FaBarcode, FaTimes, FaLock } from 'react-icons/fa';
import { formatCPF, getCPFValidationError } from '../utils/formatters';
import { 
  detectCardType, 
  formatCreditCardNumber, 
  validateCreditCardNumber 
} from '../utils/creditCard';
import {
  formatExpiryDate,
  validateExpiryDate,
  validateCVV
} from '../utils/creditCardUtils';

type BillingCycle = 'monthly' | 'yearly';

interface Plan {
  id: number;
  name: string;
  price: number;
  cycle: BillingCycle;
  maxInstallments: number;
}

interface CardData {
  number: string;
  name: string;
  expiry: string;
  cvv: string;
}

interface PaymentData {
  paymentMethod: 'credit_card' | 'boleto';
  installments: number;
  cardData?: CardData;
  cpf: string;
  planId: number;
}

interface FormErrors {
  cpf: string;
  cardNumber: string;
  cardName: string;
  expiry: string;
  cvv: string;
  form: string;
}

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan;
  onSubmit: (paymentData: PaymentData) => Promise<void> | void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ 
  isOpen, 
  onClose, 
  plan, 
  onSubmit 
}): JSX.Element | null => {
  const [paymentMethod, setPaymentMethod] = useState<'credit_card' | 'boleto'>('credit_card');
  const [installments, setInstallments] = useState(1);
  const [cardData, setCardData] = useState<CardData>({
    number: '',
    name: '',
    expiry: '',
    cvv: ''
  });
  const [cpf, setCpf] = useState('');
  const [errors, setErrors] = useState<FormErrors>({
    cpf: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
    cardName: '',
    form: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cardType, setCardType] = useState<{ type: string | null; name: string } | null>(null);

  useEffect(() => {
    if (cardData.number) {
      const result = detectCardType(cardData.number);
      setCardType(result);
    } else {
      setCardType(null);
    }
  }, [cardData.number]);

  // Função para formatar o número do cartão
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const cleaned = value.replace(/\D/g, '');
    const formatted = formatCreditCardNumber(cleaned);
    
    setCardData(prev => ({
      ...prev,
      number: formatted
    }));
  };

  // Função para formatar e validar o CPF
  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = e.target;
    const cleaned = value.replace(/\D/g, '');
    const formatted = formatCPF(cleaned);
    
    setCpf(formatted);
    
    // Validação do CPF
    const error = getCPFValidationError(formatted);
    setErrors(prev => ({ ...prev, cpf: error || '' }));
  };

  // Função para formatar a data de validade
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let { value } = e.target;
    value = value.replace(/\D/g, '');
    
    if (value.length > 2) {
      value = `${value.slice(0, 2)}/${value.slice(2, 4)}`;
    }
    
    setCardData(prev => ({
      ...prev,
      expiry: value
    }));
  };

  // Função para validar o formulário
  const validateForm = (): boolean => {
    const newErrors = { ...errors };
    let isValid = true;

    // Validação do CPF
    const cpfError = getCPFValidationError(cpf);
    if (cpfError) {
      newErrors.cpf = cpfError;
      isValid = false;
    } else {
      newErrors.cpf = '';
    }

    // Validação dos campos do cartão se for cartão de crédito
    if (paymentMethod === 'credit_card') {
      if (!validateCreditCardNumber(cardData.number.replace(/\s/g, ''))) {
        newErrors.cardNumber = 'Número do cartão inválido';
        isValid = false;
      } else {
        newErrors.cardNumber = '';
      }

      if (!cardData.name.trim()) {
        newErrors.cardName = 'Nome do titular é obrigatório';
        isValid = false;
      } else {
        newErrors.cardName = '';
      }

      if (!cardData.expiry || !/\d{2}\/\d{2}/.test(cardData.expiry)) {
        newErrors.expiry = 'Data inválida';
        isValid = false;
      } else {
        newErrors.expiry = '';
      }

      if (!cardData.cvv || !/\d{3,4}/.test(cardData.cvv)) {
        newErrors.cvv = 'CVV inválido';
        isValid = false;
      } else {
        newErrors.cvv = '';
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      const paymentData: PaymentData = {
        paymentMethod,
        installments: paymentMethod === 'credit_card' ? installments : 1,
        cpf: cpf.replace(/\D/g, ''),
        planId: plan.id,
        ...(paymentMethod === 'credit_card' && {
          cardData: {
            number: cardData.number.replace(/\s/g, ''),
            name: cardData.name,
            expiry: cardData.expiry,
            cvv: cardData.cvv
          }
        })
      };

      await onSubmit(paymentData);
      onClose();
    } catch (error) {
      console.error('Erro ao processar pagamento:', error);
      setErrors(prev => ({
        ...prev,
        form: 'Ocorreu um erro ao processar seu pagamento. Por favor, tente novamente.'
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg w-full max-w-md relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
          aria-label="Fechar modal"
        >
          <FaTimes />
        </button>
        
        <div className="p-6">
          <h3 className="text-xl font-semibold mb-6">
            Assinatura {plan.name}
          </h3>
          
          <div className="mb-6">
            <p className="text-2xl font-bold text-gray-900">
              R$ {(plan.price / 100).toFixed(2).replace('.', ',')}
              <span className="text-sm font-normal text-gray-600">
                / {plan.cycle === 'monthly' ? 'por mês' : 'por ano'}
              </span>
            </p>
          </div>
          
          <div className="mb-6">
            <div className="flex space-x-2 mb-4">
              <button
                type="button"
                className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center space-x-2 ${
                  paymentMethod === 'credit_card'
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-700 border border-transparent'
                }`}
                onClick={() => setPaymentMethod('credit_card')}
              >
                <FaCreditCard className="mr-2" />
                <span>Cartão de Crédito</span>
              </button>
              <button
                type="button"
                className={`flex-1 py-2 px-4 rounded-md flex items-center justify-center space-x-2 ${
                  paymentMethod === 'boleto'
                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                    : 'bg-gray-100 text-gray-700 border border-transparent'
                }`}
                onClick={() => setPaymentMethod('boleto')}
              >
                <FaBarcode className="mr-2" />
                <span>Boleto</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="cpf" className="block text-sm font-medium text-gray-700 mb-1">
                    CPF
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      id="cpf"
                      value={cpf}
                      onChange={handleCpfChange}
                      placeholder="000.000.000-00"
                      className={`w-full px-3 py-2 border ${
                        errors.cpf ? 'border-red-500' : 'border-gray-300'
                      } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                      maxLength={14}
                    />
                    {errors.cpf && (
                      <p className="mt-1 text-sm text-red-600">{errors.cpf}</p>
                    )}
                  </div>
                </div>

                {paymentMethod === 'credit_card' && (
                  <>
                    <div>
                      <label htmlFor="cardNumber" className="block text-sm font-medium text-gray-700 mb-1">
                        Número do Cartão
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          id="cardNumber"
                          value={cardData.number}
                          onChange={handleCardNumberChange}
                          placeholder="0000 0000 0000 0000"
                          className={`w-full px-3 py-2 border ${
                            errors.cardNumber ? 'border-red-500' : 'border-gray-300'
                          } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                        />
                        {cardType && (
                          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                            <FaCreditCard className="h-6 w-8 text-gray-600" />
                          </div>
                        )}
                        {errors.cardNumber && (
                          <p className="mt-1 text-sm text-red-600">{errors.cardNumber}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="cardName" className="block text-sm font-medium text-gray-700 mb-1">
                        Nome do Titular
                      </label>
                      <input
                        type="text"
                        id="cardName"
                        value={cardData.name}
                        onChange={(e) => setCardData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Como no cartão"
                        className={`w-full px-3 py-2 border ${
                          errors.cardName ? 'border-red-500' : 'border-gray-300'
                        } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                      />
                      {errors.cardName && (
                        <p className="mt-1 text-sm text-red-600">{errors.cardName}</p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="expiry" className="block text-sm font-medium text-gray-700 mb-1">
                          Validade
                        </label>
                        <input
                          type="text"
                          id="expiry"
                          value={cardData.expiry}
                          onChange={handleExpiryChange}
                          placeholder="MM/AA"
                          maxLength={5}
                          className={`w-full px-3 py-2 border ${
                            errors.expiry ? 'border-red-500' : 'border-gray-300'
                          } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                        />
                        {errors.expiry && (
                          <p className="mt-1 text-sm text-red-600">{errors.expiry}</p>
                        )}
                      </div>

                      <div>
                        <label htmlFor="cvv" className="block text-sm font-medium text-gray-700 mb-1">
                          CVV
                        </label>
                        <input
                          type="text"
                          id="cvv"
                          value={cardData.cvv}
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            setCardData(prev => ({ ...prev, cvv: value }));
                          }}
                          placeholder="000"
                          maxLength={4}
                          className={`w-full px-3 py-2 border ${
                            errors.cvv ? 'border-red-500' : 'border-gray-300'
                          } rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500`}
                        />
                        {errors.cvv && (
                          <p className="mt-1 text-sm text-red-600">{errors.cvv}</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label htmlFor="installments" className="block text-sm font-medium text-gray-700 mb-1">
                        Parcelas
                      </label>
                      <select
                        id="installments"
                        value={installments}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        {Array.from({ length: plan.maxInstallments }, (_, i) => i + 1).map((num) => (
                          <option key={`${plan.id}-installment-${num}`} value={num}>
                            {num}x de R$ {((plan.price / 100) / num).toFixed(2).replace('.', ',')} {num > 1 ? '(sem juros)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processando...
                      </span>
                    ) : (
                      `Confirmar ${paymentMethod === 'credit_card' ? 'Pagamento' : 'Boleto'}`
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
