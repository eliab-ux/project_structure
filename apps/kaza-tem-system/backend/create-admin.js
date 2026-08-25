require('dotenv').config();
const { MikroORM } = require('@mikro-orm/core');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
  console.log('🚀 Criando usuário administrador...\n');

  const orm = await MikroORM.init({
    type: 'postgresql',
    clientUrl: process.env.DATABASE_URL,
    entities: ['./dist/**/*-orm.entity.js'],
    debug: false,
  });

  const em = orm.em.fork();

  try {
    // Buscar entidade User
    const UserEntity = require('./dist/infrastructure/persistence/mikro-orm/entities/user-orm.entity').UserOrmEntity;

    // Verificar se admin já existe
    const existing = await em.findOne(UserEntity, { email: 'admin@kazatem.com' });

    if (existing) {
      console.log('⚠️  Usuário admin@kazatem.com já existe!');
      console.log('\n📧 Email: admin@kazatem.com');
      console.log('🔑 Senha: Admin@123 (se não foi alterada)\n');
      await orm.close();
      return;
    }

    // Criar hash da senha
    const passwordHash = await bcrypt.hash('Admin@123', 10);

    // Criar usuário admin
    const admin = em.create(UserEntity, {
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
    console.log('💡 Faça login em: http://localhost:3000/api/auth/login\n');
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error.message);
    console.error('\n💡 Certifique-se de:');
    console.error('   1. O backend foi compilado (npm run build)');
    console.error('   2. DATABASE_URL está configurado no .env');
    console.error('   3. O banco de dados está acessível\n');
    throw error;
  } finally {
    await orm.close();
  }
}

createAdminUser()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
