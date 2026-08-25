import { MikroORM } from '@mikro-orm/core';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { createMikroOrmConfig } from '../infrastructure/persistence/mikro-orm/config/mikro-orm.config';
import { ConfigService } from '@nestjs/config';
import { UserOrmEntity } from '../infrastructure/persistence/mikro-orm/entities/user-orm.entity';

async function createUserEliab() {
  console.log('🚀 Criando usuário Eliab...\n');

  // Criar ConfigService mock com variáveis de ambiente
  const configService = {
    get: (key: string) => process.env[key],
    getOrThrow: (key: string) => {
      const value = process.env[key];
      if (!value) throw new Error(`${key} não encontrado`);
      return value;
    },
  } as ConfigService;

  const config = createMikroOrmConfig(configService);
  const orm = await MikroORM.init(config);
  const em = orm.em.fork();

  try {
    // Verificar se usuário já existe
    const existing = await em.findOne(UserOrmEntity, { email: 'eliab@techbs.com.br' });

    if (existing) {
      console.log('⚠️  Usuário eliab@techbs.com.br já existe!');
      console.log('\n📧 Email: eliab@techbs.com.br');
      console.log('🔑 Use o script reset-password.js para atualizar a senha\n');
      await orm.close();
      return;
    }

    // Criar hash da senha
    const passwordHash = await bcrypt.hash('Eliab@123', 10);

    // Criar usuário
    const user = em.create(UserOrmEntity, {
      id: randomUUID(),
      email: 'eliab@techbs.com.br',
      name: 'Eliab',
      passwordHash,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await em.persistAndFlush(user);

    console.log('✅ Usuário criado com sucesso!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 CREDENCIAIS DE ACESSO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email: eliab@techbs.com.br');
    console.log('🔑 Senha: Eliab@123');
    console.log('👤 Role:  admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  IMPORTANTE: Usuário criado apenas no PostgreSQL!');
    console.log('\n💡 Para fazer login, sincronize com o Supabase:');
    console.log('   POST http://localhost:3000/api/auth/sync-users-to-supabase\n');
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
    throw error;
  } finally {
    await orm.close();
  }
}

createUserEliab()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
