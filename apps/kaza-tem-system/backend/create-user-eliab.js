require('dotenv').config();
const { MikroORM } = require('@mikro-orm/core');
const bcrypt = require('bcryptjs');

async function createUser() {
  const EMAIL = 'eliab@techbs.com.br';
  const PASSWORD = 'Eliab@123';
  const NAME = 'Eliab';
  const ROLE = 'admin'; // Pode ser 'admin', 'customer' ou 'reseller'

  console.log('🔄 Criando usuário...\n');
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`👤 Nome: ${NAME}`);
  console.log(`🏷️  Role: ${ROLE}`);
  console.log(`🔑 Senha: ${PASSWORD}\n`);

  console.log('📦 Inicializando MikroORM...');
  const orm = await MikroORM.init({
    type: 'postgresql',
    clientUrl: process.env.DATABASE_URL,
    entities: ['./dist/**/*-orm.entity.js'],
    debug: false,
  });

  console.log('✅ MikroORM inicializado');
  const em = orm.em.fork();

  try {
    console.log('📂 Carregando entidade User...');
    const UserEntity = require('./dist/infrastructure/persistence/mikro-orm/entities/user-orm.entity').UserOrmEntity;
    console.log('✅ Entidade User carregada');

    // Verificar se usuário já existe
    const existing = await em.findOne(UserEntity, { email: EMAIL });

    if (existing) {
      console.log(`⚠️  Usuário ${EMAIL} já existe!\n`);
      console.log('💡 Use o script reset-password.js para alterar a senha.\n');
      await orm.close();
      return;
    }

    // Criar hash de senha
    const passwordHash = await bcrypt.hash(PASSWORD, 10);

    // Criar usuário
    const user = em.create(UserEntity, {
      email: EMAIL,
      name: NAME,
      passwordHash,
      role: ROLE,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await em.persistAndFlush(user);

    console.log('✅ Usuário criado com sucesso!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 CREDENCIAIS DE ACESSO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${EMAIL}`);
    console.log(`🔑 Senha: ${PASSWORD}`);
    console.log(`👤 Nome:  ${NAME}`);
    console.log(`🏷️  Role:  ${ROLE}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  IMPORTANTE: Este usuário foi criado apenas no PostgreSQL.\n');
    console.log('💡 Para fazer login, você precisa sincronizar com o Supabase:');
    console.log('   POST http://localhost:3000/api/auth/sync-users-to-supabase\n');
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error.message);
    console.error('Stack:', error.stack);
    console.error('\n💡 Certifique-se de:');
    console.error('   1. O backend foi compilado (npm run build)');
    console.error('   2. DATABASE_URL está configurado no .env');
    console.error('   3. O banco de dados está acessível\n');
    throw error;
  } finally {
    await orm.close();
  }
}

createUser()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
