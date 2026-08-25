# SPRINT 09-10: COMISSÕES + SAQUES

**Duração:** 2 semanas  
**Objetivo:** Sistema completo de cálculo de comissões + Sistema de saques  
**Prioridade:** 🔴 CRÍTICA  
**Dependências:** ✅ SPRINT 07-08 concluído

---

## 🎯 OBJETIVOS

### Semana 1: Sistema de Comissões
- [ ] Cálculo automático de comissões
- [ ] Regras graduais (10/15/20/30%)
- [ ] Período de carência (30 dias)
- [ ] Cron job para liberar comissões
- [ ] Dashboard de comissões (revendedor)

### Semana 2: Sistema de Saques
- [ ] Solicitar saque
- [ ] Aprovar/rejeitar saque (admin)
- [ ] Integração Bling (contas a pagar)
- [ ] Histórico de saques
- [ ] Emails de notificação

---

## 📦 PARTE 1: SISTEMA DE COMISSÕES

### 1.1 Backend - Commission Entity

**Criar:** `src/contexts/commission/domain/entities/commission.entity.ts`

```typescript
export enum CommissionStatus {
  PENDING = 'pending',     // Ainda em carência
  AVAILABLE = 'available', // Disponível para saque
  WITHDRAWN = 'withdrawn', // Já sacada
  REVERSED = 'reversed',   // Pedido cancelado
}

export class Commission extends AggregateRoot {
  private constructor(
    private readonly _id: CommissionId,
    private readonly _resellerId: ResellerId,
    private readonly _orderId: OrderId,
    private readonly _amount: number,
    private _status: CommissionStatus,
    private readonly _baseAmount: number, // Valor base (sem frete)
    private readonly _percentage: number, // Percentual aplicado
    private _availableAt: Date,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }
  
  static create(
    resellerId: ResellerId,
    orderId: OrderId,
    baseAmount: number,
    percentage: number,
    carencyDays: number = 30,
  ): Commission {
    const amount = baseAmount * (percentage / 100);
    const availableAt = addDays(new Date(), carencyDays);
    
    const commission = new Commission(
      CommissionId.generate(),
      resellerId,
      orderId,
      amount,
      CommissionStatus.PENDING,
      baseAmount,
      percentage,
      availableAt,
      new Date(),
      new Date(),
    );
    
    commission.addDomainEvent(
      new CommissionCreatedEvent(
        commission.id.value,
        resellerId.value,
        orderId.value,
        amount,
      )
    );
    
    return commission;
  }
  
  release(): void {
    if (this._status !== CommissionStatus.PENDING) {
      throw new InvalidCommissionStatusException('Only pending commissions can be released');
    }
    
    this._status = CommissionStatus.AVAILABLE;
    this._updatedAt = new Date();
    
    this.addDomainEvent(
      new CommissionReleasedEvent(this._id.value, this._resellerId.value, this._amount)
    );
  }
  
  markAsWithdrawn(): void {
    if (this._status !== CommissionStatus.AVAILABLE) {
      throw new InvalidCommissionStatusException('Only available commissions can be withdrawn');
    }
    
    this._status = CommissionStatus.WITHDRAWN;
    this._updatedAt = new Date();
  }
  
  reverse(): void {
    this._status = CommissionStatus.REVERSED;
    this._updatedAt = new Date();
    
    this.addDomainEvent(
      new CommissionReversedEvent(this._id.value, this._resellerId.value)
    );
  }
  
  // Getters...
  get amount(): number { return this._amount; }
  get status(): CommissionStatus { return this._status; }
  get isAvailable(): boolean { return this._status === CommissionStatus.AVAILABLE; }
}
```

### 1.2 Backend - Calculate Commission Use Case

**Criar:** `src/contexts/commission/application/use-cases/calculate-commission/`

```typescript
export interface CommissionRule {
  minAmount: number;
  maxAmount: number | null;
  percentage: number;
}

const DEFAULT_RULES: CommissionRule[] = [
  { minAmount: 0, maxAmount: 1000, percentage: 10 },
  { minAmount: 1001, maxAmount: 2000, percentage: 15 },
  { minAmount: 2001, maxAmount: 5000, percentage: 20 },
  { minAmount: 5001, maxAmount: null, percentage: 30 },
];

@Injectable()
export class CalculateCommissionUseCase {
  constructor(
    @Inject(COMMISSION_REPOSITORY)
    private readonly commissionRepository: CommissionRepositoryPort,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: OrderRepositoryPort,
    @Inject(COMMISSION_RULES_REPOSITORY)
    private readonly rulesRepository: CommissionRulesRepositoryPort,
  ) {}
  
  async execute(command: CalculateCommissionCommand): Promise<CommissionDto> {
    // 1. Buscar pedido
    const order = await this.orderRepository.findById(
      OrderId.from(command.orderId)
    );
    
    if (!order) {
      throw new OrderNotFoundException(command.orderId);
    }
    
    if (!order.resellerId) {
      throw new InvalidOrderException('Order is not linked to a reseller');
    }
    
    // 2. Calcular base (total - frete - desconto)
    const baseAmount = order.subtotal - (order.discountAmount || 0);
    
    // 3. Buscar vendas do revendedor no mês atual
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    
    const monthlySales = await this.orderRepository.getTotalByResellerAndPeriod(
      order.resellerId,
      monthStart,
      monthEnd,
    );
    
    // 4. Determinar faixa de comissão
    const rules = await this.rulesRepository.getRules() || DEFAULT_RULES;
    const percentage = this.determinePercentage(monthlySales + baseAmount, rules);
    
    // 5. Criar comissão
    const commission = Commission.create(
      order.resellerId,
      OrderId.from(command.orderId),
      baseAmount,
      percentage,
      30, // dias de carência
    );
    
    // 6. Salvar
    const saved = await this.commissionRepository.save(commission);
    
    return CommissionDto.fromDomain(saved);
  }
  
  private determinePercentage(totalAmount: number, rules: CommissionRule[]): number {
    for (const rule of rules) {
      if (
        totalAmount >= rule.minAmount &&
        (rule.maxAmount === null || totalAmount <= rule.maxAmount)
      ) {
        return rule.percentage;
      }
    }
    
    return rules[rules.length - 1].percentage; // Última faixa (maior)
  }
}
```

### 1.3 Backend - Release Commissions Job (Cron)

**Criar:** `src/infrastructure/jobs/release-commissions.job.ts`

```typescript
@Injectable()
export class ReleaseCommissionsJob {
  private readonly logger = new Logger(ReleaseCommissionsJob.name);
  
  constructor(
    @Inject(COMMISSION_REPOSITORY)
    private readonly commissionRepository: CommissionRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}
  
  @Cron('0 0 * * *') // Executa todo dia à meia-noite
  async handleCron() {
    this.logger.log('Starting commission release job...');
    
    try {
      // Buscar comissões pendentes que já passaram do período de carência
      const pendingCommissions = await this.commissionRepository.findPendingToRelease(
        new Date()
      );
      
      this.logger.log(`Found ${pendingCommissions.length} commissions to release`);
      
      for (const commission of pendingCommissions) {
        await this.unitOfWork.execute(async () => {
          commission.release();
          await this.commissionRepository.save(commission);
        });
      }
      
      this.logger.log(`Released ${pendingCommissions.length} commissions`);
    } catch (error) {
      this.logger.error('Error releasing commissions', error);
    }
  }
}
```

### 1.4 Frontend - Dashboard de Comissões (Revendedor)

**Criar:** `src/app/reseller/dashboard/commissions/page.tsx`

```typescript
export function CommissionsPage() {
  const [commissions, setCommissions] = useState({
    pending: [],
    available: [],
    withdrawn: [],
  });
  const [totals, setTotals] = useState({
    totalPending: 0,
    totalAvailable: 0,
    totalWithdrawn: 0,
  });
  
  useEffect(() => {
    loadCommissions();
  }, []);
  
  async function loadCommissions() {
    const response = await commissionService.getMyCommissions();
    setCommissions(response.data.commissions);
    setTotals(response.data.totals);
  }
  
  return (
    <Container>
      <Typography variant="h4">Minhas Comissões</Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Pendente"
            value={formatCurrency(totals.totalPending)}
            subtitle={`Disponível em ${getDaysToRelease(commissions.pending[0])} dias`}
            color="warning"
            icon={<HourglassIcon />}
          />
        </Grid>
        
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Disponível"
            value={formatCurrency(totals.totalAvailable)}
            subtitle="Pronto para saque"
            color="success"
            icon={<CheckCircleIcon />}
          />
        </Grid>
        
        <Grid item xs={12} md={4}>
          <MetricCard
            title="Sacado"
            value={formatCurrency(totals.totalWithdrawn)}
            subtitle="Total já recebido"
            color="info"
            icon={<AccountBalanceIcon />}
          />
        </Grid>
      </Grid>
      
      <Tabs>
        <Tab label={`Pendentes (${commissions.pending.length})`} />
        <Tab label={`Disponíveis (${commissions.available.length})`} />
        <Tab label={`Sacadas (${commissions.withdrawn.length})`} />
      </Tabs>
      
      <TabPanel>
        <CommissionsTable
          commissions={commissions.pending}
          status="pending"
        />
      </TabPanel>
      
      {totals.totalAvailable >= 50 && (
        <WithdrawButton
          variant="contained"
          color="primary"
          onClick={() => router.push('/reseller/withdrawals/create')}
        >
          SOLICITAR SAQUE
        </WithdrawButton>
      )}
    </Container>
  );
}
```

---

## 📦 PARTE 2: SISTEMA DE SAQUES

### 2.1 Backend - Withdrawal Entity

**Criar:** `src/contexts/withdrawal/domain/entities/withdrawal.entity.ts`

```typescript
export enum WithdrawalStatus {
  REQUESTED = 'requested',   // Solicitado
  APPROVED = 'approved',     // Aprovado (aguardando pagamento)
  PAID = 'paid',             // Pago
  REJECTED = 'rejected',     // Rejeitado
}

export class Withdrawal extends AggregateRoot {
  private constructor(
    private readonly _id: WithdrawalId,
    private readonly _resellerId: ResellerId,
    private readonly _amount: number,
    private readonly _commissionIds: CommissionId[],
    private readonly _bankData: BankData,
    private _status: WithdrawalStatus,
    private _blingPayableId: string | null,
    private _approvedAt: Date | null,
    private _approvedBy: UserId | null,
    private _paidAt: Date | null,
    private _rejectedAt: Date | null,
    private _rejectedReason: string | null,
    private readonly _createdAt: Date,
    private _updatedAt: Date,
  ) {
    super();
  }
  
  static create(
    resellerId: ResellerId,
    amount: number,
    commissionIds: CommissionId[],
    bankData: BankData,
  ): Withdrawal {
    if (amount < 50) {
      throw new InvalidWithdrawalAmountException('Minimum withdrawal amount is R$ 50.00');
    }
    
    const withdrawal = new Withdrawal(
      WithdrawalId.generate(),
      resellerId,
      amount,
      commissionIds,
      bankData,
      WithdrawalStatus.REQUESTED,
      null,
      null,
      null,
      null,
      null,
      null,
      new Date(),
      new Date(),
    );
    
    withdrawal.addDomainEvent(
      new WithdrawalRequestedEvent(withdrawal.id.value, resellerId.value, amount)
    );
    
    return withdrawal;
  }
  
  approve(adminId: UserId, blingPayableId: string): void {
    if (this._status !== WithdrawalStatus.REQUESTED) {
      throw new InvalidWithdrawalStatusException('Only requested withdrawals can be approved');
    }
    
    this._status = WithdrawalStatus.APPROVED;
    this._approvedAt = new Date();
    this._approvedBy = adminId;
    this._blingPayableId = blingPayableId;
    this._updatedAt = new Date();
    
    this.addDomainEvent(
      new WithdrawalApprovedEvent(this._id.value, this._resellerId.value, this._amount)
    );
  }
  
  markAsPaid(): void {
    if (this._status !== WithdrawalStatus.APPROVED) {
      throw new InvalidWithdrawalStatusException('Only approved withdrawals can be marked as paid');
    }
    
    this._status = WithdrawalStatus.PAID;
    this._paidAt = new Date();
    this._updatedAt = new Date();
    
    this.addDomainEvent(
      new WithdrawalPaidEvent(this._id.value, this._resellerId.value, this._amount)
    );
  }
  
  reject(adminId: UserId, reason: string): void {
    if (this._status !== WithdrawalStatus.REQUESTED) {
      throw new InvalidWithdrawalStatusException('Only requested withdrawals can be rejected');
    }
    
    this._status = WithdrawalStatus.REJECTED;
    this._rejectedAt = new Date();
    this._rejectedReason = reason;
    this._updatedAt = new Date();
    
    this.addDomainEvent(
      new WithdrawalRejectedEvent(this._id.value, this._resellerId.value, reason)
    );
  }
  
  // Getters...
}
```

### 2.2 Backend - Request Withdrawal Use Case

**Criar:** `src/contexts/withdrawal/application/use-cases/request-withdrawal/`

```typescript
@Injectable()
export class RequestWithdrawalUseCase {
  constructor(
    @Inject(WITHDRAWAL_REPOSITORY)
    private readonly withdrawalRepository: WithdrawalRepositoryPort,
    @Inject(COMMISSION_REPOSITORY)
    private readonly commissionRepository: CommissionRepositoryPort,
    @Inject(RESELLER_REPOSITORY)
    private readonly resellerRepository: ResellerRepositoryPort,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}
  
  async execute(command: RequestWithdrawalCommand): Promise<WithdrawalDto> {
    // 1. Buscar revendedor
    const reseller = await this.resellerRepository.findById(
      ResellerId.from(command.resellerId)
    );
    
    if (!reseller) {
      throw new ResellerNotFoundException(command.resellerId);
    }
    
    // 2. Verificar se já tem saque pendente
    const hasPending = await this.withdrawalRepository.hasPendingWithdrawal(
      ResellerId.from(command.resellerId)
    );
    
    if (hasPending) {
      throw new PendingWithdrawalExistsException('You already have a pending withdrawal');
    }
    
    // 3. Buscar comissões disponíveis
    const availableCommissions = await this.commissionRepository.findAvailableByReseller(
      ResellerId.from(command.resellerId)
    );
    
    const totalAvailable = availableCommissions.reduce(
      (sum, c) => sum + c.amount,
      0
    );
    
    if (totalAvailable < 50) {
      throw new InsufficientBalanceException('Minimum withdrawal amount is R$ 50.00');
    }
    
    // 4. Criar saque
    const withdrawal = Withdrawal.create(
      ResellerId.from(command.resellerId),
      totalAvailable,
      availableCommissions.map(c => c.id),
      reseller.bankData,
    );
    
    // 5. Salvar
    return this.unitOfWork.execute(async () => {
      const saved = await this.withdrawalRepository.save(withdrawal);
      return WithdrawalDto.fromDomain(saved);
    });
  }
}
```

### 2.3 Backend - Approve Withdrawal Use Case

**Criar:** `src/contexts/withdrawal/application/use-cases/approve-withdrawal/`

```typescript
@Injectable()
export class ApproveWithdrawalUseCase {
  constructor(
    @Inject(WITHDRAWAL_REPOSITORY)
    private readonly withdrawalRepository: WithdrawalRepositoryPort,
    @Inject(COMMISSION_REPOSITORY)
    private readonly commissionRepository: CommissionRepositoryPort,
    private readonly blingClient: BlingClient,
    @Inject(UNIT_OF_WORK)
    private readonly unitOfWork: UnitOfWorkPort,
  ) {}
  
  async execute(command: ApproveWithdrawalCommand): Promise<WithdrawalDto> {
    // 1. Buscar saque
    const withdrawal = await this.withdrawalRepository.findById(
      WithdrawalId.from(command.withdrawalId)
    );
    
    if (!withdrawal) {
      throw new WithdrawalNotFoundException(command.withdrawalId);
    }
    
    // 2. Criar conta a pagar no Bling
    const blingPayableId = await this.blingClient.createPayable({
      fornecedor: {
        nome: withdrawal.reseller.fullName,
        cpfCnpj: withdrawal.reseller.cpf,
      },
      valor: withdrawal.amount,
      vencimento: addDays(new Date(), 5), // Vence em 5 dias
      categoria: 'Comissão de vendas',
      observacoes: `Saque #${withdrawal.id.value}`,
    });
    
    // 3. Aprovar saque
    withdrawal.approve(UserId.from(command.adminId), blingPayableId);
    
    // 4. Salvar
    return this.unitOfWork.execute(async () => {
      const saved = await this.withdrawalRepository.save(withdrawal);
      return WithdrawalDto.fromDomain(saved);
    });
  }
}
```

### 2.4 Frontend - Gestão de Saques (Admin)

**Criar:** `src/app/admin/saques/page.tsx`

```typescript
export function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [filter, setFilter] = useState('requested');
  
  useEffect(() => {
    loadWithdrawals();
  }, [filter]);
  
  async function loadWithdrawals() {
    const response = await adminWithdrawalService.list({ status: filter });
    setWithdrawals(response.data);
  }
  
  async function handleApprove(id: string) {
    if (confirm('Tem certeza que deseja aprovar este saque?')) {
      await adminWithdrawalService.approve(id);
      showMessage('Saque aprovado! Conta a pagar criada no Bling.', 'success');
      loadWithdrawals();
    }
  }
  
  async function handleReject(id: string) {
    const reason = prompt('Informe o motivo da rejeição:');
    if (reason) {
      await adminWithdrawalService.reject(id, reason);
      showMessage('Saque rejeitado', 'success');
      loadWithdrawals();
    }
  }
  
  async function handleMarkAsPaid(id: string) {
    if (confirm('Confirmar que o pagamento foi efetuado?')) {
      await adminWithdrawalService.markAsPaid(id);
      showMessage('Saque marcado como pago', 'success');
      loadWithdrawals();
    }
  }
  
  return (
    <Container>
      <Typography variant="h4">Gestão de Saques</Typography>
      
      <Tabs value={filter} onChange={(e, v) => setFilter(v)}>
        <Tab label="Pendentes" value="requested" />
        <Tab label="Aprovados" value="approved" />
        <Tab label="Pagos" value="paid" />
        <Tab label="Rejeitados" value="rejected" />
      </Tabs>
      
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Revendedor</TableCell>
            <TableCell>Valor</TableCell>
            <TableCell>Dados Bancários</TableCell>
            <TableCell>Data</TableCell>
            <TableCell>Status</TableCell>
            <TableCell>Ações</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {withdrawals.map(withdrawal => (
            <TableRow key={withdrawal.id}>
              <TableCell>{withdrawal.resellerName}</TableCell>
              <TableCell><strong>{formatCurrency(withdrawal.amount)}</strong></TableCell>
              <TableCell>
                {withdrawal.bankName} - Ag: {withdrawal.bankAgency} - 
                Cc: {withdrawal.bankAccount}
              </TableCell>
              <TableCell>{formatDate(withdrawal.createdAt)}</TableCell>
              <TableCell>
                <StatusBadge status={withdrawal.status} />
              </TableCell>
              <TableCell>
                {withdrawal.status === 'requested' && (
                  <>
                    <IconButton
                      onClick={() => handleApprove(withdrawal.id)}
                      color="success"
                    >
                      <CheckIcon />
                    </IconButton>
                    <IconButton
                      onClick={() => handleReject(withdrawal.id)}
                      color="error"
                    >
                      <CloseIcon />
                    </IconButton>
                  </>
                )}
                {withdrawal.status === 'approved' && (
                  <Button
                    size="small"
                    onClick={() => handleMarkAsPaid(withdrawal.id)}
                  >
                    Marcar como Pago
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Container>
  );
}
```

---

## ✅ CHECKLIST DE CONCLUSÃO

### Backend - Comissões
- [ ] Commission entity
- [ ] Calculate commission use case
- [ ] Release commissions job (cron)
- [ ] Commission repository
- [ ] Reverse commission (pedido cancelado)

### Backend - Saques
- [ ] Withdrawal entity
- [ ] Request withdrawal use case
- [ ] Approve withdrawal use case
- [ ] Reject withdrawal use case
- [ ] Mark as paid use case
- [ ] Integração Bling (contas a pagar)

### Frontend - Comissões
- [ ] Dashboard de comissões (revendedor)
- [ ] Tabela de comissões (pendente/disponível/sacado)
- [ ] Gráficos de evolução

### Frontend - Saques
- [ ] Solicitar saque (revendedor)
- [ ] Lista de saques (revendedor)
- [ ] Gestão de saques (admin)
- [ ] Aprovar/rejeitar (admin)
- [ ] Marcar como pago (admin)

### Emails
- [ ] Email saque solicitado
- [ ] Email saque aprovado
- [ ] Email saque pago
- [ ] Email saque rejeitado

### Testes
- [ ] Comissão calculada corretamente
- [ ] Cron job libera comissões
- [ ] Saque criado
- [ ] Saque aprovado
- [ ] Conta a pagar no Bling
- [ ] Saque pago

---

## 📊 MÉTRICAS

- [ ] Comissões calculadas 100% corretas
- [ ] Cron job executa diariamente
- [ ] Taxa de aprovação de saques > 95%
- [ ] Tempo médio de aprovação < 48h

---

## 🚀 PRÓXIMO SPRINT

⬅️ [SPRINT 07-08](SPRINT_07-08.md)  
➡️ [SPRINT 11-12](SPRINT_11-12.md) - Materiais + Cupons + Finalização

---

**Versão:** 1.0  
**Status:** 📝 Planejado
