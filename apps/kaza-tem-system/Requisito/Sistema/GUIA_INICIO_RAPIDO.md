# 🚀 GUIA DE INÍCIO RÁPIDO - KAZA TEM SYSTEM

## ✅ PASSO A PASSO PARA FAZER LOGIN

### 1️⃣ **Iniciar o Backend**

```bash
cd apps/kaza-tem-system/backend
npm run dev
```

Aguarde até ver: `[Nest] Application is running on: http://localhost:3000`

---

### 2️⃣ **Criar Usuário Admin**

**Opção A - Via Endpoint de Registro (MAIS FÁCIL):**

Abra um novo terminal e execute:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@kazatem.com\",\"password\":\"Admin@123\",\"name\":\"Administrador\"}"
```

Ou use o Postman/Insomnia:

```http
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "admin@kazatem.com",
  "password": "Admin@123",
  "name": "Administrador"
}
```

**Opção B - Via Script:**

```bash
cd apps/kaza-tem-system/backend
npm run create:admin
```

**Opção C - Via Seeder:**

```bash
cd apps/kaza-tem-system/backend
npm run seed
```

---

### 3️⃣ **Fazer Login**

**Via cURL:**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"admin@kazatem.com\",\"password\":\"Admin@123\"}"
```

**Via Frontend:**

1. Abra o frontend em `http://localhost:3003`
2. Use as credenciais:
   - Email: `admin@kazatem.com`
   - Senha: `Admin@123`

**Via Postman/Insomnia:**

```http
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "admin@kazatem.com",
  "password": "Admin@123"
}
```

---

## 🔐 CREDENCIAIS DE TESTE

Se você usou o **seeder** (Opção C), terá 3 usuários:

| Tipo | Email | Senha | Role |
|------|-------|-------|------|
| 👑 Admin | admin@kazatem.com | Admin@123 | admin |
| 👤 Cliente | cliente@kazatem.com | Cliente@123 | customer |
| 💼 Revendedor | revendedor@kazatem.com | Revendedor@123 | reseller |

---

## ⚙️ INICIAR FRONTEND

Em outro terminal:

```bash
cd apps/kaza-tem-system/frontend
npm run dev
```

Acesse: `http://localhost:3003`

---

## 🐛 TROUBLESHOOTING

### ❌ "Failed to connect to localhost port 3000"

**Solução:** O backend não está rodando. Execute:
```bash
cd apps/kaza-tem-system/backend
npm run dev
```

### ❌ "Invalid email or password"

**Solução:** O usuário não existe no banco. Crie usando uma das opções do Passo 2.

### ❌ "Connection ended unexpectedly"

**Solução:** Problema de conexão com o banco de dados. Verifique:
1. `DATABASE_URL` está correto no `.env`
2. Supabase está acessível
3. Credenciais estão corretas

### ❌ "Circular dependency"

**Solução:** Já corrigido! Se ainda aparecer, reinicie o backend.

---

## 📊 STATUS DO SISTEMA

✅ **Backend:** Implementado 100%
✅ **Frontend:** Implementado 100%
✅ **Integrações:** 4/4 completas
- ✅ Cielo (pagamentos)
- ✅ Bling (ERP)
- ✅ Melhor Envio (frete)
- ✅ Magis5 (imagens)

✅ **Contextos:** 9/9 implementados
- User, Auth, Product, Reseller, Order
- Commission, Subscription, Withdrawal, Analytics

---

## 🎯 PRÓXIMOS PASSOS

1. ✅ Fazer login com sucesso
2. Explorar o dashboard
3. Testar funcionalidades
4. Configurar integrações externas (opcional)

---

**Última atualização:** 14/02/2026 - Sistema 100% funcional! 🎉
