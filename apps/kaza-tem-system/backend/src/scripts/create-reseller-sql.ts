import { MikroORM } from '@mikro-orm/core';
import { createMikroOrmConfig } from '../infrastructure/persistence/mikro-orm/config/mikro-orm.config';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';

async function createResellerSQL() {
  console.log('🚀 Criando cadastro de reseller para eliab@techbs.com.br...\n');

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
    // Buscar usuário pelo email
    const userResult = await em
      .getConnection()
      .execute('SELECT * FROM users WHERE email = ?', ['eliab@techbs.com.br']);

    if (!userResult || userResult.length === 0) {
      console.log('❌ Usuário eliab@techbs.com.br não encontrado!');
      await orm.close();
      return;
    }

    const user = userResult[0];
    console.log(`✅ Usuário encontrado: ${user.id}\n`);

    // Verificar se já existe reseller
    const existingReseller = await em
      .getConnection()
      .execute('SELECT * FROM resellers WHERE user_id = ?', [user.id]);

    if (existingReseller && existingReseller.length > 0) {
      const reseller = existingReseller[0];
      console.log('⚠️  Cadastro de reseller já existe para este usuário!');
      console.log(`\n📋 Dados do Reseller:`);
      console.log(`   ID: ${reseller.id}`);
      console.log(`   CPF: ${reseller.cpf}`);
      console.log(`   Link único: ${reseller.unique_link}`);
      console.log(`   Status: ${reseller.status}`);
      console.log(`   Nível: ${reseller.level}\n`);
      console.log('💡 Você já pode fazer login em AMBOS os portais:\n');
      console.log('   🔹 Portal Admin: http://localhost:3003/admin/login');
      console.log('   🔹 Portal Revendedor: http://localhost:3003/auth/login\n');
      await orm.close();
      return;
    }

    // Criar reseller com SQL direto
    const resellerId = randomUUID();
    const now = new Date().toISOString();

    await em.getConnection().execute(
      `INSERT INTO resellers (
        id, user_id, full_name, cpf, unique_link, level, status,
        approved_at, approved_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resellerId,
        user.id,
        user.name || 'Eliab',
        '12345678900',
        'eliab-admin',
        'gold',
        'active',
        now,
        user.id,
        now,
        now,
      ],
    );

    console.log('✅ Cadastro de reseller criado com sucesso!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 RESELLER CRIADO');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${user.email}`);
    console.log(`🔑 Senha: Eliab@123`);
    console.log(`👤 Nome:  ${user.name}`);
    console.log(`🆔 CPF:   12345678900`);
    console.log(`🔗 Link:  kazatem.shop/r/eliab-admin`);
    console.log(`📊 Status: active`);
    console.log(`⭐ Nível: gold`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Agora você pode fazer login em AMBOS os portais:\n');
    console.log('   🔹 Portal Admin: http://localhost:3003/admin/login');
    console.log('   🔹 Portal Revendedor: http://localhost:3003/auth/login\n');
  } catch (error) {
    console.error('❌ Erro ao criar reseller:', error);
    throw error;
  } finally {
    await orm.close();
  }
}

createResellerSQL()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
