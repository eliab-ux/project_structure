# REVISÃO COMPLETA — CADASTRO E GESTÃO DE REVENDEDORES
## Formulário público + Painel admin + Fluxo de aprovação

> **Objetivo:** Revisar formulário de cadastro público e tela admin para incluir todos dados obrigatórios + fluxo de aprovação/rejeição com emails  
> **Status atual:** Formulário incompleto (só 4 campos) + Admin sem funcionalidade de aprovação  

---

## 📋 SUMÁRIO

1. [Dados Obrigatórios do Revendedor](#1-dados-obrigatórios)
2. [Formulário Público — Cadastro de Revendedor](#2-formulário-público)
3. [Painel Admin — Gestão de Revendedores](#3-painel-admin)
4. [Fluxo de Aprovação e Emails](#4-fluxo-aprovação)
5. [Backend — APIs e Use Cases](#5-backend)
6. [Checklist de Implementação](#6-checklist)

---

# 1. DADOS OBRIGATÓRIOS DO REVENDEDOR

## Campos Necessários

### Tipo de Pessoa
- [ ] **Pessoa Física** ou **Pessoa Jurídica**

### Dados Pessoais/Empresariais
- [ ] **Nome Completo** (PF) ou **Razão Social** (PJ)
- [ ] **CPF** (PF) ou **CNPJ** (PJ)
- [ ] **Email**
- [ ] **Telefone/Celular**
- [ ] **Data de Nascimento** (PF) ou **Data de Abertura** (PJ)

### Endereço Completo
- [ ] **CEP**
- [ ] **Rua/Logradouro**
- [ ] **Número**
- [ ] **Complemento** (opcional)
- [ ] **Bairro**
- [ ] **Cidade**
- [ ] **UF (Estado)**

### Dados Bancários
- [ ] **Banco** (lista ou digitação)
- [ ] **Agência** (com dígito)
- [ ] **Conta** (com dígito)
- [ ] **Tipo de Conta** (Corrente ou Poupança)
- [ ] **Nome do Titular**
- [ ] **CPF do Titular**

### Credenciais
- [ ] **Senha** (para acesso ao portal)
- [ ] **Confirmação de Senha**

---

# 2. FORMULÁRIO PÚBLICO — CADASTRO DE REVENDEDOR

## Layout Atual vs. Novo

### ❌ ATUAL (Incompleto)
```
Campos:
- Nome completo
- Email profissional
- CPF (apenas números)
- Senha para o portal

FALTA: Tipo, Telefone, Endereço, Dados Bancários
```

### ✅ NOVO (Completo)

```
┌────────────────────────────────────────────────────────────────┐
│                    Kaza Tem Imports                            │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│              Cadastre-se como revendedor                       │
│  Aproveite ferramentas exclusivas, divulgando seus links e    │
│  acompanhando comissões em um painel completo.                 │
│                                                                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐          │
│  │QUERO SER     │ │JÁ SOU        │ │PORTAL ADMIN  │          │
│  │REVENDEDOR    │ │REVENDEDOR    │ │              │          │
│  └──────────────┘ └──────────────┘ └──────────────┘          │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │               Torne-se revendedor                        │ │
│  │                                                          │ │
│  │  Preencha seus dados completos. Analisaremos em até     │ │
│  │  24h úteis e você receberá um email de confirmação.     │ │
│  │                                                          │ │
│  │  ETAPA 1 DE 4: Tipo de Cadastro                         │ │
│  │                                                          │ │
│  │  ⚪ Pessoa Física        ⚪ Pessoa Jurídica             │ │
│  │                                                          │ │
│  │  ──────────────────────────────────────────────────     │ │
│  │                                                          │ │
│  │  ETAPA 2 DE 4: Dados Pessoais                           │ │
│  │                                                          │ │
│  │  [Nome completo / Razão Social            ]             │ │
│  │  [CPF / CNPJ                              ]             │ │
│  │  [Email                                   ]             │ │
│  │  [Telefone                                ]             │ │
│  │  [Data de Nascimento / Abertura           ]             │ │
│  │                                                          │ │
│  │  ──────────────────────────────────────────────────     │ │
│  │                                                          │ │
│  │  ETAPA 3 DE 4: Endereço                                 │ │
│  │                                                          │ │
│  │  [CEP          ] [Buscar]                               │ │
│  │  [Rua/Logradouro                          ]             │ │
│  │  [Número   ] [Complemento (opcional)     ]              │ │
│  │  [Bairro                                  ]             │ │
│  │  [Cidade               ] [UF  ▾]                        │ │
│  │                                                          │ │
│  │  ──────────────────────────────────────────────────     │ │
│  │                                                          │ │
│  │  ETAPA 4 DE 4: Dados Bancários                          │ │
│  │                                                          │ │
│  │  [Banco                       ▾]                        │ │
│  │  [Agência (com dígito)        ]                         │ │
│  │  [Conta (com dígito)          ]                         │ │
│  │  [Tipo  ▾] Corrente / Poupança                         │ │
│  │  [Nome do Titular             ]                         │ │
│  │  [CPF do Titular              ]                         │ │
│  │                                                          │ │
│  │  ──────────────────────────────────────────────────     │ │
│  │                                                          │ │
│  │  ETAPA 5 DE 4: Crie sua Senha                           │ │
│  │                                                          │ │
│  │  [Senha (mínimo 8 caracteres) ]                         │ │
│  │  [Confirmar senha             ]                         │ │
│  │                                                          │ │
│  │  [ ✓ ] Li e aceito os Termos de Uso e Política de      │ │
│  │        Privacidade                                      │ │
│  │                                                          │ │
│  │              [ENVIAR INSCRIÇÃO ➤]                       │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## Estrutura do Formulário (Multi-step)

### Step 1: Tipo de Cadastro

```tsx
<FormControl component="fieldset" fullWidth>
  <FormLabel>Tipo de Cadastro</FormLabel>
  <RadioGroup 
    row 
    value={formData.type} 
    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
  >
    <FormControlLabel 
      value="pf" 
      control={<Radio />} 
      label="Pessoa Física" 
    />
    <FormControlLabel 
      value="pj" 
      control={<Radio />} 
      label="Pessoa Jurídica" 
    />
  </RadioGroup>
</FormControl>
```

### Step 2: Dados Pessoais/Empresariais

```tsx
<Grid container spacing={2}>
  <Grid item xs={12}>
    <TextField
      fullWidth
      required
      label={formData.type === 'pf' ? 'Nome Completo' : 'Razão Social'}
      value={formData.name}
      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
    />
  </Grid>

  <Grid item xs={12} sm={6}>
    <TextField
      fullWidth
      required
      label={formData.type === 'pf' ? 'CPF' : 'CNPJ'}
      value={formData.document}
      onChange={(e) => setFormData({ ...formData, document: maskDocument(e.target.value, formData.type) })}
      inputProps={{ maxLength: formData.type === 'pf' ? 14 : 18 }}
      helperText={formData.type === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'}
    />
  </Grid>

  <Grid item xs={12} sm={6}>
    <TextField
      fullWidth
      required
      type="email"
      label="Email"
      value={formData.email}
      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
    />
  </Grid>

  <Grid item xs={12} sm={6}>
    <TextField
      fullWidth
      required
      label="Telefone/Celular"
      value={formData.phone}
      onChange={(e) => setFormData({ ...formData, phone: maskPhone(e.target.value) })}
      helperText="(00) 00000-0000"
    />
  </Grid>

  <Grid item xs={12} sm={6}>
    <TextField
      fullWidth
      required
      type="date"
      label={formData.type === 'pf' ? 'Data de Nascimento' : 'Data de Abertura'}
      value={formData.birthDate}
      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
      InputLabelProps={{ shrink: true }}
    />
  </Grid>
</Grid>
```

### Step 3: Endereço

```tsx
<Grid container spacing={2}>
  <Grid item xs={12} sm={4}>
    <TextField
      fullWidth
      required
      label="CEP"
      value={formData.address.zipCode}
      onChange={(e) => handleZipCodeChange(e.target.value)}
      inputProps={{ maxLength: 9 }}
      helperText="00000-000"
    />
  </Grid>

  <Grid item xs={12} sm={8}>
    <TextField
      fullWidth
      required
      label="Rua/Logradouro"
      value={formData.address.street}
      onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
    />
  </Grid>

  <Grid item xs={12} sm={3}>
    <TextField
      fullWidth
      required
      label="Número"
      value={formData.address.number}
      onChange={(e) => setFormData({ ...formData, address: { ...formData.address, number: e.target.value } })}
    />
  </Grid>

  <Grid item xs={12} sm={9}>
    <TextField
      fullWidth
      label="Complemento (opcional)"
      value={formData.address.complement}
      onChange={(e) => setFormData({ ...formData, address: { ...formData.address, complement: e.target.value } })}
    />
  </Grid>

  <Grid item xs={12} sm={6}>
    <TextField
      fullWidth
      required
      label="Bairro"
      value={formData.address.neighborhood}
      onChange={(e) => setFormData({ ...formData, address: { ...formData.address, neighborhood: e.target.value } })}
    />
  </Grid>

  <Grid item xs={12} sm={4}>
    <TextField
      fullWidth
      required
      label="Cidade"
      value={formData.address.city}
      onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
    />
  </Grid>

  <Grid item xs={12} sm={2}>
    <FormControl fullWidth required>
      <InputLabel>UF</InputLabel>
      <Select
        value={formData.address.state}
        onChange={(e) => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })}
      >
        {BRAZILIAN_STATES.map(state => (
          <MenuItem key={state} value={state}>{state}</MenuItem>
        ))}
      </Select>
    </FormControl>
  </Grid>
</Grid>
```

**Busca de CEP:**
```typescript
async function handleZipCodeChange(zipCode: string) {
  const cleanZipCode = zipCode.replace(/\D/g, '');
  
  setFormData(prev => ({ 
    ...prev, 
    address: { ...prev.address, zipCode: maskZipCode(zipCode) } 
  }));

  if (cleanZipCode.length === 8) {
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanZipCode}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          address: {
            ...prev.address,
            street: data.logradouro,
            neighborhood: data.bairro,
            city: data.localidade,
            state: data.uf,
          },
        }));
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
    }
  }
}
```

### Step 4: Dados Bancários

```tsx
<Grid container spacing={2}>
  <Grid item xs={12}>
    <FormControl fullWidth required>
      <InputLabel>Banco</InputLabel>
      <Select
        value={formData.banking.bank}
        onChange={(e) => setFormData({ ...formData, banking: { ...formData.banking, bank: e.target.value } })}
      >
        {BRAZILIAN_BANKS.map(bank => (
          <MenuItem key={bank.code} value={bank.name}>
            {bank.code} - {bank.name}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  </Grid>

  <Grid item xs={12} sm={4}>
    <TextField
      fullWidth
      required
      label="Agência (com dígito)"
      value={formData.banking.agency}
      onChange={(e) => setFormData({ ...formData, banking: { ...formData.banking, agency: e.target.value } })}
      placeholder="0000-0"
    />
  </Grid>

  <Grid item xs={12} sm={4}>
    <TextField
      fullWidth
      required
      label="Conta (com dígito)"
      value={formData.banking.account}
      onChange={(e) => setFormData({ ...formData, banking: { ...formData.banking, account: e.target.value } })}
      placeholder="00000-0"
    />
  </Grid>

  <Grid item xs={12} sm={4}>
    <FormControl fullWidth required>
      <InputLabel>Tipo de Conta</InputLabel>
      <Select
        value={formData.banking.accountType}
        onChange={(e) => setFormData({ ...formData, banking: { ...formData.banking, accountType: e.target.value } })}
      >
        <MenuItem value="checking">Corrente</MenuItem>
        <MenuItem value="savings">Poupança</MenuItem>
      </Select>
    </FormControl>
  </Grid>

  <Grid item xs={12} sm={8}>
    <TextField
      fullWidth
      required
      label="Nome do Titular"
      value={formData.banking.holderName}
      onChange={(e) => setFormData({ ...formData, banking: { ...formData.banking, holderName: e.target.value } })}
    />
  </Grid>

  <Grid item xs={12} sm={4}>
    <TextField
      fullWidth
      required
      label="CPF do Titular"
      value={formData.banking.holderCpf}
      onChange={(e) => setFormData({ ...formData, banking: { ...formData.banking, holderCpf: maskCpf(e.target.value) } })}
      inputProps={{ maxLength: 14 }}
    />
  </Grid>
</Grid>
```

### Step 5: Senha

```tsx
<Grid container spacing={2}>
  <Grid item xs={12}>
    <TextField
      fullWidth
      required
      type="password"
      label="Senha"
      value={formData.password}
      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
      helperText="Mínimo 8 caracteres, incluindo letras e números"
    />
  </Grid>

  <Grid item xs={12}>
    <TextField
      fullWidth
      required
      type="password"
      label="Confirmar Senha"
      value={formData.passwordConfirmation}
      onChange={(e) => setFormData({ ...formData, passwordConfirmation: e.target.value })}
      error={formData.password !== formData.passwordConfirmation && formData.passwordConfirmation.length > 0}
      helperText={
        formData.password !== formData.passwordConfirmation && formData.passwordConfirmation.length > 0
          ? 'As senhas não coincidem'
          : ''
      }
    />
  </Grid>

  <Grid item xs={12}>
    <FormControlLabel
      control={
        <Checkbox
          checked={formData.acceptedTerms}
          onChange={(e) => setFormData({ ...formData, acceptedTerms: e.target.checked })}
        />
      }
      label={
        <Typography variant="body2">
          Li e aceito os{' '}
          <Link href="/termos" target="_blank">
            Termos de Uso
          </Link>{' '}
          e{' '}
          <Link href="/privacidade" target="_blank">
            Política de Privacidade
          </Link>
        </Typography>
      }
    />
  </Grid>
</Grid>
```

### Navegação entre Steps

```tsx
<Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
  {currentStep > 1 && (
    <Button onClick={() => setCurrentStep(prev => prev - 1)}>
      Voltar
    </Button>
  )}

  <Box sx={{ flex: 1 }} />

  {currentStep < 5 ? (
    <Button 
      variant="contained" 
      onClick={() => setCurrentStep(prev => prev + 1)}
      disabled={!isStepValid(currentStep)}
    >
      Próximo
    </Button>
  ) : (
    <Button 
      variant="contained" 
      onClick={handleSubmit}
      disabled={!formData.acceptedTerms || loading}
    >
      {loading ? <CircularProgress size={24} /> : 'ENVIAR INSCRIÇÃO ➤'}
    </Button>
  )}
</Box>
```

### Indicador de Progresso

```tsx
<Stepper activeStep={currentStep - 1} alternativeLabel sx={{ mb: 4 }}>
  <Step><StepLabel>Tipo</StepLabel></Step>
  <Step><StepLabel>Dados Pessoais</StepLabel></Step>
  <Step><StepLabel>Endereço</StepLabel></Step>
  <Step><StepLabel>Dados Bancários</StepLabel></Step>
  <Step><StepLabel>Senha</StepLabel></Step>
</Stepper>
```

---

# 3. PAINEL ADMIN — GESTÃO DE REVENDEDORES

## Tela de Lista (Atual + Melhorias)

### Mantém:
- ✅ Filtros de status (Todos, Aguardando, Ativos, Suspensos, Rejeitados)
- ✅ Filtros de nível (Todos, Bronze, Prata, Ouro)
- ✅ Busca por nome, CPF ou email
- ✅ Tabela com dados resumidos

### Adiciona:
- ✅ Badge de "Pendentes" no menu lateral
- ✅ Coluna "Status" com cores
- ✅ Botão "Ver Detalhes" ou "Analisar" (se pendente)

```
┌──────────────────────────────────────────────────────────────────┐
│ Revendedores                                                     │
│ Lista completa com filtros de status, nível, busca e ações      │
│ rápidas.                                                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│ [Todos] [Aguardando (3)] [Ativos] [Suspensos] [Rejeitados]     │
│                                                                  │
│ [Todos] [Bronze] [Prata] [Ouro]                                 │
│                                                                  │
│ [🔍 Buscar por nome, CPF ou e-mail                        ]     │
│                                                                  │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │Nome    │CPF         │Email     │Nível│Status      │Ações  │ │
│ ├────────┼────────────┼──────────┼─────┼────────────┼───────┤ │
│ │João    │123.456.789-│joao@... │Bronze│🟡 Aguardando│[Analisar]│
│ │Silva   │00          │          │     │            │       │ │
│ ├────────┼────────────┼──────────┼─────┼────────────┼───────┤ │
│ │Maria   │987.654.321-│maria@...│Prata│🟢 Ativo    │[Detalhes]│
│ │Santos  │00          │          │     │            │       │ │
│ └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│ Mostrando 1-10 de 45                        ◀ 1 2 3 4 5 ▶     │
└──────────────────────────────────────────────────────────────────┘
```

### Código da Tabela

```tsx
<TableContainer component={Paper}>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell>Nome</TableCell>
        <TableCell>CPF/CNPJ</TableCell>
        <TableCell>Email</TableCell>
        <TableCell>Nível</TableCell>
        <TableCell>Status</TableCell>
        <TableCell>Cadastro em</TableCell>
        <TableCell align="center">Ações</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {resellers.map((reseller) => (
        <TableRow key={reseller.id} hover>
          <TableCell>{reseller.name}</TableCell>
          <TableCell>
            <Typography variant="body2" fontFamily="monospace">
              {maskDocument(reseller.document)}
            </Typography>
          </TableCell>
          <TableCell>{reseller.email}</TableCell>
          <TableCell>
            <Chip 
              label={reseller.level} 
              size="small" 
              color={getLevelColor(reseller.level)}
            />
          </TableCell>
          <TableCell>
            <Chip 
              label={getStatusLabel(reseller.status)} 
              size="small" 
              color={getStatusColor(reseller.status)}
            />
          </TableCell>
          <TableCell>
            {formatDate(reseller.createdAt)}
          </TableCell>
          <TableCell align="center">
            {reseller.status === 'pending' ? (
              <Button 
                size="small" 
                variant="contained" 
                onClick={() => handleAnalyze(reseller)}
              >
                Analisar
              </Button>
            ) : (
              <IconButton 
                size="small" 
                onClick={() => handleViewDetails(reseller)}
              >
                <Visibility />
              </IconButton>
            )}
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

## Modal de Análise/Aprovação

Ao clicar em "Analisar", abre Dialog fullScreen ou maxWidth="lg":

```tsx
<Dialog
  open={!!analyzingReseller}
  onClose={() => setAnalyzingReseller(null)}
  maxWidth="lg"
  fullWidth
>
  <DialogTitle>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Typography variant="h6">
        Análise de Cadastro — {analyzingReseller?.name}
      </Typography>
      <IconButton onClick={() => setAnalyzingReseller(null)}>
        <Close />
      </IconButton>
    </Box>
  </DialogTitle>

  <DialogContent dividers>
    <Grid container spacing={3}>
      {/* Seção 1: Dados Pessoais */}
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom>
          Dados Pessoais
        </Typography>
        <Divider sx={{ mb: 2 }} />
      </Grid>

      <Grid item xs={12} sm={3}>
        <Typography variant="caption" color="text.secondary">
          Tipo
        </Typography>
        <Typography variant="body1">
          {analyzingReseller?.type === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={5}>
        <Typography variant="caption" color="text.secondary">
          Nome / Razão Social
        </Typography>
        <Typography variant="body1">
          {analyzingReseller?.name}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={4}>
        <Typography variant="caption" color="text.secondary">
          CPF / CNPJ
        </Typography>
        <Typography variant="body1" fontFamily="monospace">
          {maskDocument(analyzingReseller?.document)}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={6}>
        <Typography variant="caption" color="text.secondary">
          Email
        </Typography>
        <Typography variant="body1">
          {analyzingReseller?.email}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Typography variant="caption" color="text.secondary">
          Telefone
        </Typography>
        <Typography variant="body1">
          {maskPhone(analyzingReseller?.phone)}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Typography variant="caption" color="text.secondary">
          Data de Nascimento / Abertura
        </Typography>
        <Typography variant="body1">
          {formatDate(analyzingReseller?.birthDate)}
        </Typography>
      </Grid>

      {/* Seção 2: Endereço */}
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
          Endereço
        </Typography>
        <Divider sx={{ mb: 2 }} />
      </Grid>

      <Grid item xs={12}>
        <Typography variant="body1">
          {analyzingReseller?.address.street}, {analyzingReseller?.address.number}
          {analyzingReseller?.address.complement && ` - ${analyzingReseller.address.complement}`}
        </Typography>
        <Typography variant="body1">
          {analyzingReseller?.address.neighborhood} — {analyzingReseller?.address.city}/{analyzingReseller?.address.state}
        </Typography>
        <Typography variant="body1">
          CEP: {maskZipCode(analyzingReseller?.address.zipCode)}
        </Typography>
      </Grid>

      {/* Seção 3: Dados Bancários */}
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
          Dados Bancários
        </Typography>
        <Divider sx={{ mb: 2 }} />
      </Grid>

      <Grid item xs={12} sm={4}>
        <Typography variant="caption" color="text.secondary">
          Banco
        </Typography>
        <Typography variant="body1">
          {analyzingReseller?.banking.bank}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={2}>
        <Typography variant="caption" color="text.secondary">
          Agência
        </Typography>
        <Typography variant="body1" fontFamily="monospace">
          {analyzingReseller?.banking.agency}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Typography variant="caption" color="text.secondary">
          Conta
        </Typography>
        <Typography variant="body1" fontFamily="monospace">
          {analyzingReseller?.banking.account}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={3}>
        <Typography variant="caption" color="text.secondary">
          Tipo de Conta
        </Typography>
        <Typography variant="body1">
          {analyzingReseller?.banking.accountType === 'checking' ? 'Corrente' : 'Poupança'}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={6}>
        <Typography variant="caption" color="text.secondary">
          Titular
        </Typography>
        <Typography variant="body1">
          {analyzingReseller?.banking.holderName}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={6}>
        <Typography variant="caption" color="text.secondary">
          CPF do Titular
        </Typography>
        <Typography variant="body1" fontFamily="monospace">
          {maskCpf(analyzingReseller?.banking.holderCpf)}
        </Typography>
      </Grid>

      {/* Seção 4: Informações do Cadastro */}
      <Grid item xs={12}>
        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
          Informações do Cadastro
        </Typography>
        <Divider sx={{ mb: 2 }} />
      </Grid>

      <Grid item xs={12} sm={6}>
        <Typography variant="caption" color="text.secondary">
          Data do Cadastro
        </Typography>
        <Typography variant="body1">
          {formatDateTime(analyzingReseller?.createdAt)}
        </Typography>
      </Grid>

      <Grid item xs={12} sm={6}>
        <Typography variant="caption" color="text.secondary">
          Status Atual
        </Typography>
        <Typography variant="body1">
          <Chip 
            label={getStatusLabel(analyzingReseller?.status)} 
            color={getStatusColor(analyzingReseller?.status)}
            size="small"
          />
        </Typography>
      </Grid>
    </Grid>
  </DialogContent>

  <DialogActions sx={{ p: 2, gap: 1 }}>
    <Button 
      variant="outlined" 
      color="error"
      onClick={() => setRejectDialogOpen(true)}
      startIcon={<Cancel />}
    >
      REJEITAR CADASTRO
    </Button>

    <Box sx={{ flex: 1 }} />

    <Button onClick={() => setAnalyzingReseller(null)}>
      Fechar
    </Button>

    <Button 
      variant="contained" 
      color="success"
      onClick={handleApprove}
      disabled={approvingLoading}
      startIcon={approvingLoading ? <CircularProgress size={20} /> : <CheckCircle />}
    >
      APROVAR CADASTRO
    </Button>
  </DialogActions>
</Dialog>
```

## Dialog de Rejeição

```tsx
<Dialog
  open={rejectDialogOpen}
  onClose={() => setRejectDialogOpen(false)}
  maxWidth="sm"
  fullWidth
>
  <DialogTitle>Rejeitar Cadastro</DialogTitle>
  
  <DialogContent>
    <Alert severity="warning" sx={{ mb: 2 }}>
      O revendedor receberá um email informando a rejeição com o motivo abaixo.
    </Alert>

    <TextField
      fullWidth
      multiline
      rows={4}
      label="Motivo da Rejeição"
      value={rejectReason}
      onChange={(e) => setRejectReason(e.target.value)}
      placeholder="Ex: Dados bancários inconsistentes, documentação incompleta..."
      required
      error={rejectReason.length > 0 && rejectReason.length < 10}
      helperText={
        rejectReason.length > 0 && rejectReason.length < 10
          ? 'O motivo deve ter no mínimo 10 caracteres'
          : `${rejectReason.length} caracteres`
      }
    />
  </DialogContent>

  <DialogActions>
    <Button onClick={() => setRejectDialogOpen(false)}>
      Cancelar
    </Button>
    <Button 
      variant="contained" 
      color="error"
      onClick={handleReject}
      disabled={rejectReason.length < 10 || rejectingLoading}
    >
      {rejectingLoading ? <CircularProgress size={20} /> : 'Confirmar Rejeição'}
    </Button>
  </DialogActions>
</Dialog>
```

---

# 4. FLUXO DE APROVAÇÃO E EMAILS

## Estados do Revendedor

```typescript
type ResellerStatus = 
  | 'pending'      // Aguardando análise
  | 'analyzing'    // Em análise (admin abriu o modal)
  | 'approved'     // Aprovado (recebeu código único)
  | 'active'       // Ativo (criou assinatura)
  | 'suspended'    // Suspenso
  | 'rejected';    // Rejeitado
```

## Fluxo Completo

```
1. Revendedor preenche formulário público
   ↓
2. Submit → POST /api/resellers/register
   ↓
3. Status = 'pending'
   ↓
4. Email #1: "Cadastro recebido, em análise"
   ↓
5. Admin acessa /admin/revendedores
   ↓
6. Clica em "Analisar"
   ↓
7. Status = 'analyzing' (opcional, pode pular)
   ↓
8. Email #2: "Seu cadastro está em análise" (opcional)
   ↓
9a. Admin clica "APROVAR"
    ↓
    - Gera reseller_code único (ex: JOAO_X9A2B4C7)
    - Status = 'approved'
    - Email #3: "Cadastro aprovado! Código: JOAO_X9A2B4C7"
    - Link para criar assinatura

9b. Admin clica "REJEITAR"
    ↓
    - Status = 'rejected'
    - Email #4: "Cadastro rejeitado"
    - Motivo incluído no email
    - Contato do admin para dúvidas
```

## Templates de Email

### Email #1: Cadastro Recebido

```
Assunto: Cadastro Recebido — Kaza Tem Imports

Olá, [Nome]!

Recebemos seu cadastro para se tornar revendedor Kaza Tem Imports.

Nosso time está analisando suas informações e você receberá uma resposta em até 24 horas úteis.

Qualquer dúvida, entre em contato conosco pelo email: suporte@kazatem.shop

Atenciosamente,
Equipe Kaza Tem Imports
```

### Email #2: Em Análise (Opcional)

```
Assunto: Cadastro em Análise — Kaza Tem Imports

Olá, [Nome]!

Seu cadastro está sendo analisado por nossa equipe.

Em breve você receberá uma resposta sobre a aprovação.

Atenciosamente,
Equipe Kaza Tem Imports
```

### Email #3: Aprovado

```
Assunto: 🎉 Cadastro Aprovado — Bem-vindo à Kaza Tem!

Olá, [Nome]!

Parabéns! Seu cadastro foi APROVADO! 🎉

Seu código de revendedor é: [CODIGO_UNICO]

Para começar a vender, você precisa criar sua assinatura mensal (R$ 9,90/mês):

👉 [LINK PARA CRIAR ASSINATURA]

Após ativar sua assinatura, você terá acesso a:
✅ Painel de revendedor
✅ Links personalizados para divulgação
✅ Acompanhamento de comissões
✅ Materiais de marketing exclusivos

Qualquer dúvida, estamos à disposição!

Atenciosamente,
Equipe Kaza Tem Imports
```

### Email #4: Rejeitado

```
Assunto: Cadastro Não Aprovado — Kaza Tem Imports

Olá, [Nome],

Infelizmente seu cadastro não foi aprovado neste momento.

Motivo: [MOTIVO_DA_REJEICAO]

Se você acredita que houve algum erro ou deseja esclarecer dúvidas, entre em contato conosco:

📧 Email: suporte@kazatem.shop
📞 WhatsApp: (XX) XXXXX-XXXX

Atenciosamente,
Equipe Kaza Tem Imports
```

---

# 5. BACKEND — APIs E USE CASES

## POST /api/resellers/register

```typescript
@Controller('api/resellers')
export class ResellersController {
  @Post('register')
  async register(@Body() dto: RegisterResellerDto) {
    const reseller = await this.registerResellerUseCase.execute(dto);

    // Enviar email #1: Cadastro recebido
    await this.emailService.send({
      to: dto.email,
      template: 'reseller-registration-received',
      data: { name: dto.name },
    });

    return {
      success: true,
      message: 'Cadastro realizado com sucesso! Você receberá um email em breve.',
    };
  }
}
```

### RegisterResellerUseCase

```typescript
@Injectable()
export class RegisterResellerUseCase {
  async execute(command: RegisterResellerCommand): Promise<Reseller> {
    // 1. Validar CPF/CNPJ único
    const existing = await this.resellerRepo.findByDocument(command.document);
    if (existing) {
      throw new ConflictException('CPF/CNPJ já cadastrado');
    }

    // 2. Validar email único
    const existingEmail = await this.userRepo.findByEmail(command.email);
    if (existingEmail) {
      throw new ConflictException('Email já cadastrado');
    }

    // 3. Criar User
    const user = User.create(command.email, command.password);

    // 4. Criar Reseller
    const reseller = Reseller.create({
      userId: user.id,
      type: command.type,
      name: command.name,
      document: command.document,
      phone: command.phone,
      birthDate: command.birthDate,
      address: command.address,
      banking: command.banking,
      status: 'pending',
    });

    // 5. Salvar tudo em transação
    return this.unitOfWork.execute(async () => {
      await this.userRepo.save(user);
      return this.resellerRepo.save(reseller);
    });
  }
}
```

## POST /api/admin/resellers/:id/start-analysis

```typescript
@Post(':id/start-analysis')
@UseGuards(AdminGuard)
async startAnalysis(@Param('id') id: string) {
  await this.startAnalysisUseCase.execute({ resellerId: id });

  // Email #2: Em análise
  const reseller = await this.resellerRepo.findById(id);
  await this.emailService.send({
    to: reseller.email,
    template: 'reseller-under-analysis',
    data: { name: reseller.name },
  });

  return { success: true };
}
```

## POST /api/admin/resellers/:id/approve

```typescript
@Post(':id/approve')
@UseGuards(AdminGuard)
async approve(@Param('id') id: string, @CurrentUser() admin: User) {
  const result = await this.approveResellerUseCase.execute({
    resellerId: id,
    approvedBy: admin.id,
  });

  // Email #3: Aprovado
  await this.emailService.send({
    to: result.reseller.email,
    template: 'reseller-approved',
    data: {
      name: result.reseller.name,
      resellerCode: result.resellerCode,
      subscriptionLink: `${process.env.FRONTEND_URL}/subscription/create?code=${result.resellerCode}`,
    },
  });

  return {
    success: true,
    resellerCode: result.resellerCode,
  };
}
```

### ApproveResellerUseCase

```typescript
@Injectable()
export class ApproveResellerUseCase {
  async execute(command: ApproveResellerCommand) {
    const reseller = await this.resellerRepo.findById(command.resellerId);

    if (!reseller) {
      throw new NotFoundException('Revendedor não encontrado');
    }

    if (reseller.status !== 'pending' && reseller.status !== 'analyzing') {
      throw new BadRequestException('Revendedor não está aguardando aprovação');
    }

    // Gerar código único: FIRSTNAME_8RANDOM
    const firstName = reseller.name.split(' ')[0].toUpperCase();
    const randomPart = this.generateRandomCode(8); // A-Z0-9
    const resellerCode = `${firstName}_${randomPart}`;

    // Verificar unicidade
    const existing = await this.resellerRepo.findByCode(resellerCode);
    if (existing) {
      // Gerar novamente recursivamente até encontrar único
      return this.execute(command);
    }

    // Aprovar
    reseller.approve(command.approvedBy, resellerCode);

    // Salvar
    const savedReseller = await this.unitOfWork.execute(async () => {
      return this.resellerRepo.save(reseller);
    });

    return {
      reseller: savedReseller,
      resellerCode,
    };
  }

  private generateRandomCode(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
```

## POST /api/admin/resellers/:id/reject

```typescript
@Post(':id/reject')
@UseGuards(AdminGuard)
async reject(
  @Param('id') id: string,
  @Body() dto: { reason: string },
  @CurrentUser() admin: User,
) {
  // Validar motivo
  if (dto.reason.length < 10) {
    throw new BadRequestException('Motivo deve ter no mínimo 10 caracteres');
  }

  await this.rejectResellerUseCase.execute({
    resellerId: id,
    reason: dto.reason,
    rejectedBy: admin.id,
  });

  // Email #4: Rejeitado
  const reseller = await this.resellerRepo.findById(id);
  await this.emailService.send({
    to: reseller.email,
    template: 'reseller-rejected',
    data: {
      name: reseller.name,
      reason: dto.reason,
    },
  });

  return { success: true };
}
```

---

# 6. CHECKLIST DE IMPLEMENTAÇÃO

## Formulário Público (/cadastro-revendedor)

### Backend
- [ ] RegisterResellerUseCase
- [ ] Validação CPF/CNPJ único
- [ ] Validação email único
- [ ] Criar User + Reseller em transação
- [ ] Email #1: Cadastro recebido

### Frontend
- [ ] Formulário multi-step (5 etapas)
- [ ] Radio Tipo (PF/PJ)
- [ ] Campos dinâmicos baseados no tipo
- [ ] Busca de CEP (ViaCEP)
- [ ] Lista de bancos brasileiros
- [ ] Máscaras: CPF, CNPJ, telefone, CEP
- [ ] Validação de senha (min 8 chars)
- [ ] Checkbox Termos de Uso
- [ ] Stepper com indicador de progresso
- [ ] Submit e feedback

## Painel Admin (/admin/revendedores)

### Backend
- [ ] GET /api/admin/resellers (lista paginada)
- [ ] POST /api/admin/resellers/:id/start-analysis (opcional)
- [ ] POST /api/admin/resellers/:id/approve
- [ ] POST /api/admin/resellers/:id/reject
- [ ] ApproveResellerUseCase (gerar código único)
- [ ] RejectResellerUseCase
- [ ] Email #2: Em análise (opcional)
- [ ] Email #3: Aprovado (com código e link)
- [ ] Email #4: Rejeitado (com motivo)

### Frontend
- [ ] Filtros de status
- [ ] Filtros de nível
- [ ] Busca
- [ ] Tabela com dados resumidos
- [ ] Badge "Pendentes" no menu lateral
- [ ] Botão "Analisar" (se pending)
- [ ] Dialog de análise (fullscreen/lg)
- [ ] Exibir todos dados do revendedor
- [ ] Botão "APROVAR CADASTRO"
- [ ] Botão "REJEITAR CADASTRO"
- [ ] Dialog de rejeição com TextField motivo
- [ ] Validação motivo (min 10 chars)
- [ ] Loading states
- [ ] Toast de sucesso/erro

## Banco de Dados

### Tabela `resellers`
- [ ] Adicionar campos:
  - type (pf/pj)
  - birth_date
  - phone
  - address (JSON ou tabela separada)
  - banking (JSON ou tabela separada)
- [ ] Status: pending, analyzing, approved, active, suspended, rejected
- [ ] reseller_code (unique)
- [ ] approved_by (FK admin_users)
- [ ] approved_at
- [ ] rejected_by (FK admin_users)
- [ ] rejected_at
- [ ] rejected_reason

---

**DOCUMENTO COMPLETO PARA IMPLEMENTAÇÃO DAS TELAS DE CADASTRO E GESTÃO DE REVENDEDORES.**  
**INCLUI: Formulário multi-step + Modal de análise + Fluxo de emails + Backend completo.**
