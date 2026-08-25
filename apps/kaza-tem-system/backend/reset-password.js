require('dotenv').config();
const { MikroORM } = require('@mikro-orm/core');
const bcrypt = require('bcryptjs');

async function resetPassword() {
  const EMAIL = process.env.USER_EMAIL || 'eliab@techbs.com.br';
  const NEW_PASSWORD = process.env.NEW_PASSWORD || 'Eliab@123';

  console.log('🔄 Resetando senha do usuário...\n');
  console.log(`📧 Email: ${EMAIL}`);
  console.log(`🔑 Nova senha: ${NEW_PASSWORD}\n`);

  const orm = await MikroORM.init({
    type: 'postgresql',
    clientUrl: process.env.DATABASE_URL,
    entities: ['./dist/**/*-orm.entity.js'],
    debug: false,
  });

  const em = orm.em.fork();

  try {
    const UserEntity = require('./dist/infrastructure/persistence/mikro-orm/entities/user-orm.entity').UserOrmEntity;

    // Buscar usuário
    const user = await em.findOne(UserEntity, { email: EMAIL });

    if (!user) {
      console.log(`❌ Usuário ${EMAIL} não encontrado!\n`);
      console.log('💡 Certifique-se que o email está correto.\n');
      await orm.close();
      return;
    }

    // Criar novo hash de senha
    const newPasswordHash = await bcrypt.hash(NEW_PASSWORD, 10);

    // Atualizar senha
    user.passwordHash = newPasswordHash;
    user.updatedAt = new Date();

    await em.persistAndFlush(user);

    console.log('✅ Senha atualizada com sucesso!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 NOVAS CREDENCIAIS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${EMAIL}`);
    console.log(`🔑 Senha: ${NEW_PASSWORD}`);
    console.log(`👤 Nome:  ${user.name}`);
    console.log(`🏷️  Role:  ${user.role}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Faça login em: http://localhost:3000/api/auth/login\n');
  } catch (error) {
    console.error('❌ Erro ao resetar senha:', error.message);
    console.error('\n💡 Certifique-se de:');
    console.error('   1. O backend foi compilado (npm run build)');
    console.error('   2. DATABASE_URL está configurado no .env');
    console.error('   3. O banco de dados está acessível\n');
    throw error;
  } finally {
    await orm.close();
  }
}

resetPassword()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
