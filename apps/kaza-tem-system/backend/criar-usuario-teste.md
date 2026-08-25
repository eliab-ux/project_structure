# Como Criar Usuário de Teste

## Opção 1: Via API (Recomendado)

Use o endpoint de registro:

```bash
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "admin@kazatem.com",
  "password": "Admin@123",
  "name": "Administrador"
}
```

## Opção 2: Via Supabase SQL Editor

Execute no Supabase SQL Editor:

```sql
-- Criar usuário admin
INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@kazatem.com',
  'Administrador',
  '$2a$10$YourHashedPasswordHere', -- Use bcrypt para gerar o hash
  'admin',
  true,
  NOW(),
  NOW()
);

-- Criar usuário customer
INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'cliente@kazatem.com',
  'Cliente Teste',
  '$2a$10$YourHashedPasswordHere',
  'customer',
  true,
  NOW(),
  NOW()
);

-- Criar usuário reseller
INSERT INTO users (id, email, name, password_hash, role, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'revendedor@kazatem.com',
  'Revendedor Teste',
  '$2a$10$YourHashedPasswordHere',
  'reseller',
  true,
  NOW(),
  NOW()
);
```

## Opção 3: Usar seeder (Melhor para desenvolvimento)

Vou criar um seeder automático para você!
