import { MikroORM } from '@mikro-orm/postgresql';

async function updateResellerCPF() {
  console.log('🔄 Atualizando CPF do reseller...\n');

  const orm = await MikroORM.init({
    dbName: 'postgres',
    clientUrl: process.env.DATABASE_URL,
    entities: [],
    connect: true,
    discovery: { warnWhenNoEntities: false },
  });
  const em = orm.em.fork();

  try {
    const knex = em.getKnex();

    // Buscar usuário
    const user = await knex.raw(`SELECT id, email, name FROM users WHERE email = ?`, [
      'eliab@techbs.com.br',
    ]);

    if (!user || !user.rows || user.rows.length === 0) {
      console.log('❌ Usuário não encontrado!');
      await orm.close();
      return;
    }

    const userId = user.rows[0].id;
    console.log(`✅ Usuário encontrado: ${user.rows[0].email}`);
    console.log(`   ID: ${userId}\n`);

    // Atualizar CPF do reseller
    const updateResult = await knex.raw(
      `UPDATE resellers SET cpf = ? WHERE user_id = ? RETURNING id`,
      ['11144477735', userId],
    );

    if (updateResult && updateResult.rows && updateResult.rows.length > 0) {
      console.log('✅ CPF atualizado com sucesso!\n');

      // Verificar dados atualizados
      const reseller = await knex.raw(
        `SELECT r.id, r.cpf, r.full_name, r.unique_link, r.status, r.level, u.email
         FROM resellers r
         JOIN users u ON u.id = r.user_id
         WHERE r.user_id = ?`,
        [userId],
      );

      if (reseller && reseller.rows && reseller.rows.length > 0) {
        const r = reseller.rows[0];
        console.log('📋 Dados do Reseller:');
        console.log(`   ID: ${r.id}`);
        console.log(`   Email: ${r.email}`);
        console.log(`   Nome: ${r.full_name}`);
        console.log(`   CPF: ${r.cpf} (válido: 111.444.777-35)`);
        console.log(`   Link: kazatem.shop/r/${r.unique_link}`);
        console.log(`   Status: ${r.status}`);
        console.log(`   Nível: ${r.level}\n`);

        console.log('✅ Agora você pode fazer login com:');
        console.log('   Email: eliab@techbs.com.br');
        console.log('   Senha: Eliab@123');
        console.log('   Portal Admin: http://localhost:3003/admin/login');
        console.log('   Portal Revendedor: http://localhost:3003/auth/login');
      }
    } else {
      console.log('❌ Nenhum reseller foi atualizado. Registro não encontrado.');
    }
  } catch (error: any) {
    console.error('❌ Erro ao atualizar CPF:', error.message);
    console.error(error);
  } finally {
    await orm.close();
  }
}

updateResellerCPF()
  .then(() => {
    console.log('\n✅ Script finalizado com sucesso!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  });
