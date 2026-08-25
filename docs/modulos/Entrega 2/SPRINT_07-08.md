# SPRINT 07-08: CHECKOUT + PAGAMENTO + RASTREAMENTO

**Duração:** 2 semanas  
**Objetivo:** Carrinho + Checkout + Pagamento Cielo + Rastreamento de vendas por link  
**Prioridade:** 🔴 CRÍTICA  
**Dependências:** ✅ SPRINT 05-06 concluído

---

## 🎯 OBJETIVOS

### Semana 1: Carrinho + Checkout
- [ ] Carrinho de compras funcional
- [ ] Cálculo de frete (Melhor Envio)
- [ ] Fluxo de checkout (4 steps)
- [ ] Integração Cielo (pagamento)

### Semana 2: Rastreamento
- [ ] Sistema de tracking de links
- [ ] Cookie de rastreamento
- [ ] Vincular pedido ao revendedor
- [ ] Analytics de visitas

---

## 📦 PARTE 1: CARRINHO DE COMPRAS

### 1.1 Backend - Cart Context

**Criar:** `src/contexts/cart/domain/entities/cart.entity.ts`

```typescript
export class Cart extends AggregateRoot {
  private constructor(
    private readonly _id: CartId,
    private readonly _userId: UserId | null,
    private readonly _items: CartItem[],
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }
  
  static create(userId?: UserId): Cart {
    return new Cart(
      CartId.generate(),
      userId || null,
      [],
      new Date(),
      new Date(),
    );
  }
  
  addItem(productId: ProductId, quantity: number, price: Price): void {
    const existingItem = this._items.find(
      item => item.productId.equals(productId)
    );
    
    if (existingItem) {
      existingItem.increaseQuantity(quantity);
    } else {
      this._items.push(new CartItem(productId, quantity, price));
    }
    
    this._updatedAt = new Date();
    this.addDomainEvent(new ItemAddedToCartEvent(this._id.value, productId.value));
  }
  
  removeItem(productId: ProductId): void {
    const index = this._items.findIndex(item => item.productId.equals(productId));
    
    if (index !== -1) {
      this._items.splice(index, 1);
      this._updatedAt = new Date();
    }
  }
  
  updateQuantity(productId: ProductId, quantity: number): void {
    const item = this._items.find(item => item.productId.equals(productId));
    
    if (item) {
      item.setQuantity(quantity);
      this._updatedAt = new Date();
    }
  }
  
  getSubtotal(): number {
    return this._items.reduce((sum, item) => {
      return sum + (item.price.value * item.quantity);
    }, 0);
  }
  
  clear(): void {
    this._items.length = 0;
    this._updatedAt = new Date();
  }
  
  get items(): CartItem[] { return [...this._items]; }
  get itemCount(): number { return this._items.length; }
}

export class CartItem {
  constructor(
    public readonly productId: ProductId,
    private _quantity: number,
    public readonly price: Price,
  ) {}
  
  increaseQuantity(amount: number): void {
    this._quantity += amount;
  }
  
  setQuantity(quantity: number): void {
    if (quantity <= 0) {
      throw new InvalidQuantityException('Quantity must be greater than 0');
    }
    this._quantity = quantity;
  }
  
  get quantity(): number { return this._quantity; }
}
```

### 1.2 Frontend - Carrinho (Drawer)

**Criar:** `src/components/CartDrawer/index.tsx`

```typescript
export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const { cart, removeItem, updateQuantity, subtotal } = useCart();
  
  return (
    <>
      <IconButton onClick={() => setOpen(true)}>
        <Badge badgeContent={cart.itemCount} color="primary">
          <ShoppingCartIcon />
        </Badge>
      </IconButton>
      
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <DrawerContent>
          <DrawerHeader>
            <Typography variant="h6">Meu Carrinho</Typography>
            <IconButton onClick={() => setOpen(false)}>
              <CloseIcon />
            </IconButton>
          </DrawerHeader>
          
          {cart.items.length === 0 ? (
            <EmptyCart>
              <ShoppingCartIcon fontSize="large" color="disabled" />
              <Typography>Seu carrinho está vazio</Typography>
            </EmptyCart>
          ) : (
            <>
              <CartItems>
                {cart.items.map(item => (
                  <CartItem key={item.productId}>
                    <ItemImage src={item.product.image} />
                    <ItemInfo>
                      <Typography variant="body2">{item.product.name}</Typography>
                      <ItemPrice>{formatCurrency(item.price)}</ItemPrice>
                      
                      <QuantityControl>
                        <IconButton
                          size="small"
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        >
                          <RemoveIcon />
                        </IconButton>
                        <span>{item.quantity}</span>
                        <IconButton
                          size="small"
                          onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        >
                          <AddIcon />
                        </IconButton>
                      </QuantityControl>
                    </ItemInfo>
                    
                    <IconButton onClick={() => removeItem(item.productId)}>
                      <DeleteIcon />
                    </IconButton>
                  </CartItem>
                ))}
              </CartItems>
              
              <DrawerFooter>
                <Subtotal>
                  <Typography variant="body2">Subtotal:</Typography>
                  <Typography variant="h6">{formatCurrency(subtotal)}</Typography>
                </Subtotal>
                
                <CheckoutButton
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={() => router.push('/checkout')}
                >
                  IR PARA O CHECKOUT
                </CheckoutButton>
                
                <ContinueButton onClick={() => setOpen(false)}>
                  Continuar comprando
                </ContinueButton>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </>
  );
}
```

---

## 📦 PARTE 2: CHECKOUT

### 2.1 Frontend - Checkout (4 Steps)

**Criar:** `src/app/checkout/page.tsx`

```typescript
export function CheckoutPage() {
  const [step, setStep] = useState(1);
  const [shippingData, setShippingData] = useState(null);
  const [shippingOption, setShippingOption] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  
  const steps = [
    { label: 'Entrega', component: ShippingStep },
    { label: 'Frete', component: ShippingOptionStep },
    { label: 'Pagamento', component: PaymentStep },
    { label: 'Confirmação', component: ConfirmationStep },
  ];
  
  return (
    <Container>
      <Typography variant="h4">Finalizar Compra</Typography>
      
      <Stepper activeStep={step - 1}>
        {steps.map((s, index) => (
          <Step key={index}>
            <StepLabel>{s.label}</StepLabel>
          </Step>
        ))}
      </Stepper>
      
      <CheckoutContent>
        {step === 1 && (
          <ShippingStep
            onComplete={(data) => {
              setShippingData(data);
              setStep(2);
            }}
          />
        )}
        
        {step === 2 && (
          <ShippingOptionStep
            cep={shippingData.cep}
            onComplete={(option) => {
              setShippingOption(option);
              setStep(3);
            }}
            onBack={() => setStep(1)}
          />
        )}
        
        {step === 3 && (
          <PaymentStep
            onComplete={(data) => {
              setPaymentData(data);
              setStep(4);
            }}
            onBack={() => setStep(2)}
          />
        )}
        
        {step === 4 && (
          <ConfirmationStep
            shippingData={shippingData}
            shippingOption={shippingOption}
            paymentData={paymentData}
            onConfirm={handleConfirmOrder}
            onBack={() => setStep(3)}
          />
        )}
      </CheckoutContent>
      
      <OrderSummary>
        <CartSummary />
        <ShippingSummary option={shippingOption} />
        <TotalSummary />
      </OrderSummary>
    </Container>
  );
}
```

### 2.2 Backend - Integração Melhor Envio (Frete)

**Criar:** `src/infrastructure/integrations/melhor-envio/melhor-envio.client.ts`

```typescript
@Injectable()
export class MelhorEnvioClient {
  constructor(
    private readonly configService: ConfigService,
  ) {}
  
  async calculateShipping(data: CalculateShippingDto): Promise<ShippingOption[]> {
    const token = this.configService.get('MELHOR_ENVIO_TOKEN');
    const apiUrl = this.configService.get('MELHOR_ENVIO_API_URL');
    
    const response = await axios.post(
      `${apiUrl}/shipment/calculate`,
      {
        from: {
          postal_code: '74000000', // CEP da Kaza Tem
        },
        to: {
          postal_code: data.cep,
        },
        package: {
          weight: data.weight,
          width: data.width,
          height: data.height,
          length: data.length,
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    return response.data.map(option => ({
      carrier: option.name,
      service: option.company.name,
      price: option.price,
      deliveryTime: option.delivery_time,
      deliveryDate: option.delivery_range.max,
    }));
  }
}
```

### 2.3 Backend - Integração Cielo (Pagamento)

**Criar:** `src/infrastructure/integrations/cielo/cielo-checkout.client.ts`

```typescript
@Injectable()
export class CieloCheckoutClient {
  constructor(
    private readonly configService: ConfigService,
  ) {}
  
  async processPayment(data: ProcessPaymentDto): Promise<PaymentResult> {
    const merchantId = this.configService.get('CIELO_MERCHANT_ID');
    const merchantKey = this.configService.get('CIELO_MERCHANT_KEY');
    const apiUrl = this.configService.get('CIELO_API_URL');
    
    const payload = {
      MerchantOrderId: data.orderId,
      Customer: {
        Name: data.customerName,
        Email: data.customerEmail,
      },
      Payment: {
        Type: 'CreditCard',
        Amount: data.amount, // em centavos
        Installments: data.installments,
        SoftDescriptor: 'KAZATEM',
        CreditCard: {
          CardNumber: data.cardNumber,
          Holder: data.cardHolder,
          ExpirationDate: data.cardExpiration,
          SecurityCode: data.cardCvv,
          Brand: this.detectCardBrand(data.cardNumber),
        },
      },
    };
    
    try {
      const response = await axios.post(
        `${apiUrl}/1/sales`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'MerchantId': merchantId,
            'MerchantKey': merchantKey,
          },
        }
      );
      
      const payment = response.data.Payment;
      
      return {
        paymentId: payment.PaymentId,
        status: payment.Status, // 1=Pending, 2=Approved, 3=Denied
        returnCode: payment.ReturnCode,
        returnMessage: payment.ReturnMessage,
        authorizationCode: payment.ProofOfSale,
      };
    } catch (error) {
      this.logger.error('Error processing payment', error);
      throw new CieloIntegrationException('Payment processing failed');
    }
  }
  
  private detectCardBrand(cardNumber: string): string {
    const firstDigit = cardNumber.charAt(0);
    if (firstDigit === '4') return 'Visa';
    if (firstDigit === '5') return 'Master';
    if (firstDigit === '3') return 'Amex';
    if (firstDigit === '6') return 'Elo';
    return 'Visa';
  }
}
```

### 2.4 Backend - Create Order Use Case

**Criar:** `src/contexts/order/application/use-cases/create-order/`

```typescript
@Injectable()
export class CreateOrderUseCase {
  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    @Inject(CART_REPOSITORY)
    private readonly cartRepository: CartRepositoryPort,
    private readonly cieloClient: CieloCheckoutClient,
    private readonly blingClient: BlingClient,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}
  
  async execute(command: CreateOrderCommand): Promise<OrderDto> {
    // 1. Buscar carrinho
    const cart = await this.cartRepository.findByUserId(
      UserId.from(command.userId)
    );
    
    if (!cart || cart.items.length === 0) {
      throw new EmptyCartException();
    }
    
    // 2. Criar pedido
    const order = Order.create(
      CustomerId.from(command.userId),
      cart.items,
      command.shippingAddress,
      command.shippingCost,
      command.resellerId ? ResellerId.from(command.resellerId) : null,
    );
    
    // 3. Processar pagamento
    const paymentResult = await this.cieloClient.processPayment({
      orderId: order.orderNumber,
      customerName: command.customerName,
      customerEmail: command.customerEmail,
      amount: order.totalAmount * 100, // em centavos
      installments: command.installments,
      cardNumber: command.cardNumber,
      cardHolder: command.cardHolder,
      cardExpiration: command.cardExpiration,
      cardCvv: command.cardCvv,
    });
    
    if (paymentResult.status !== 2) { // 2 = Approved
      throw new PaymentFailedException(paymentResult.returnMessage);
    }
    
    order.confirmPayment(paymentResult.paymentId);
    
    // 4. Salvar pedido
    return this.unitOfWork.execute(async () => {
      const saved = await this.orderRepository.save(order);
      
      // 5. Enviar para Bling
      await this.sendOrderToBling(saved);
      
      // 6. Limpar carrinho
      cart.clear();
      await this.cartRepository.save(cart);
      
      return OrderDto.fromDomain(saved);
    });
  }
  
  private async sendOrderToBling(order: Order): Promise<void> {
    await this.blingClient.createOrder({
      numero: order.orderNumber,
      data: order.createdAt,
      cliente: {
        nome: order.customerName,
        email: order.customerEmail,
      },
      itens: order.items.map(item => ({
        codigo: item.productSku,
        descricao: item.productName,
        quantidade: item.quantity,
        valor: item.price,
      })),
      total: order.totalAmount,
    });
  }
}
```

---

## 📦 PARTE 3: RASTREAMENTO DE VENDAS

### 3.1 Backend - Tracking Service

**Criar:** `src/contexts/analytics/application/services/tracking.service.ts`

```typescript
@Injectable()
export class TrackingService {
  constructor(
    @Inject(VISIT_REPOSITORY)
    private readonly visitRepository: VisitRepositoryPort,
  ) {}
  
  async trackVisit(resellerId: string, request: Request): Promise<void> {
    const visit = Visit.create(
      ResellerId.from(resellerId),
      request.ip,
      request.headers['user-agent'],
      request.headers['referer'],
    );
    
    await this.visitRepository.save(visit);
  }
  
  async getResellerIdFromCookie(request: Request): Promise<string | null> {
    const cookies = this.parseCookies(request.headers.cookie);
    return cookies['reseller_id'] || null;
  }
  
  private parseCookies(cookieHeader: string): Record<string, string> {
    if (!cookieHeader) return {};
    
    return cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
  }
}
```

### 3.2 Frontend - Link de Revendedor

**Criar:** `src/app/r/[code]/page.tsx`

```typescript
export function ResellerLinkPage({ params }) {
  const router = useRouter();
  
  useEffect(() => {
    // Salvar reseller_id em cookie
    document.cookie = `reseller_id=${params.code}; max-age=${30 * 24 * 60 * 60}; path=/`;
    
    // Registrar visita
    trackingService.trackVisit(params.code);
    
    // Redirecionar para home
    router.push('/');
  }, [params.code]);
  
  return <LoadingSpinner />;
}
```

### 3.3 Backend - Vincular Pedido ao Revendedor

**Atualizar:** `src/contexts/order/application/use-cases/create-order/`

```typescript
// Adicionar ao CreateOrderUseCase:

async execute(command: CreateOrderCommand): Promise<OrderDto> {
  // ... código existente ...
  
  // NOVO: Buscar reseller_id do cookie
  let resellerId = command.resellerId;
  
  if (!resellerId && command.cookies) {
    resellerId = command.cookies['reseller_id'];
  }
  
  const order = Order.create(
    CustomerId.from(command.userId),
    cart.items,
    command.shippingAddress,
    command.shippingCost,
    resellerId ? ResellerId.from(resellerId) : null, // ← Vincular ao revendedor
  );
  
  // ... resto do código ...
}
```

---

## ✅ CHECKLIST DE CONCLUSÃO

### Backend - Carrinho
- [ ] Cart entity implementada
- [ ] Add/Remove/Update item
- [ ] Cart repository

### Backend - Checkout
- [ ] Create Order use case
- [ ] Integração Cielo (pagamento)
- [ ] Integração Melhor Envio (frete)
- [ ] Envio pedido para Bling

### Backend - Rastreamento
- [ ] Tracking service
- [ ] Visit entity e repository
- [ ] Cookie de rastreamento
- [ ] Vincular pedido ao revendedor

### Frontend
- [ ] Carrinho drawer
- [ ] Checkout 4 steps
- [ ] Cálculo de frete
- [ ] Pagamento com cartão
- [ ] Link de revendedor (tracking)

### Testes
- [ ] Adicionar item ao carrinho
- [ ] Finalizar compra
- [ ] Pagamento aprovado
- [ ] Pedido criado no Bling
- [ ] Link rastreado corretamente

---

## 📊 MÉTRICAS

- [ ] Checkout conversão > 60%
- [ ] Pagamento aprovado > 95%
- [ ] Tempo checkout < 3 min
- [ ] Rastreamento 100% preciso

---

## 🚀 PRÓXIMO SPRINT

⬅️ [SPRINT 05-06](SPRINT_05-06.md)  
➡️ [SPRINT 09-10](SPRINT_09-10.md) - Comissões + Saques

---

**Versão:** 1.0  
**Status:** 📝 Planejado
