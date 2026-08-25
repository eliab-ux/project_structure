import { MikroORM } from '@mikro-orm/core';
import * as bcrypt from 'bcryptjs';
import { createMikroOrmConfig } from '../infrastructure/persistence/mikro-orm/config/mikro-orm.config';
import { ConfigService } from '@nestjs/config';
import { UserOrmEntity } from '../infrastructure/persistence/mikro-orm/entities/user-orm.entity';

async function createAdminUser() {
  console.log('🚀 Criando usuário administrador...\n');

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
    // Verificar se admin já existe
    const existing = await em.findOne(UserOrmEntity, { email: 'admin@kazatem.com' });

    if (existing) {
      console.log('⚠️  Usuário admin@kazatem.com já existe!');
      console.log('\n📧 Email: admin@kazatem.com');
      console.log('🔑 Atualize a senha se necessário usando o hash bcrypt\n');
      await orm.close();
      return;
    }

    // Criar hash da senha
    const passwordHash = await bcrypt.hash('Admin@123', 10);

    // Criar usuário admin
    const admin = em.create(UserOrmEntity, {
      email: 'admin@kazatem.com',
      name: 'Administrador do Sistema',
      passwordHash,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await em.persistAndFlush(admin);

    console.log('✅ Usuário administrador criado com sucesso!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 CREDENCIAIS DE ACESSO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 Email: admin@kazatem.com');
    console.log('🔑 Senha: Admin@123');
    console.log('👤 Role:  admin');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Você pode fazer login agora em:');
    console.log('   POST http://localhost:3000/api/auth/login\n');
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
    throw error;
  } finally {
    await orm.close();
  }
}

createAdminUser()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
