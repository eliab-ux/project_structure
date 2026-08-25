import { useState, useEffect, FormEvent } from 'react';
import { FaCreditCard, FaBarcode, FaTimes } from 'react-icons/fa';
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
  
  // Removida a variável 'touched' não utilizada
  const [, setTouched] = useState<Record<string, boolean>>({});

  // Efeito para detectar o tipo de cartão quando o número muda
  useEffect(() => {
    if (cardData.number) {
      const result = detectCardType(cardData.number);
      setCardType(result);
    } else {
      setCardType(null);
    }
  }, [cardData.number]);

  // ... restante do código do componente ...

  
  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${!isOpen ? 'hidden' : ''}`}>
      {/* Conteúdo do modal */}
    </div>
  );
};

export default PaymentModal;
