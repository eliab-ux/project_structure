import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function updatePassword() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar configurados no .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const email = 'eliab@techbs.com.br';
  const newPassword = 'Eliab@123';

  console.log('🔄 Atualizando senha do usuário no Supabase...\n');
  console.log(`📧 Email: ${email}`);
  console.log(`🔑 Nova senha: ${newPassword}\n`);

  try {
    // Buscar usuário pelo email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Erro ao listar usuários:', listError.message);
      process.exit(1);
    }

    const user = users.users.find((u) => u.email === email);

    if (!user) {
      console.error(`❌ Usuário ${email} não encontrado no Supabase!`);
      process.exit(1);
    }

    console.log(`✅ Usuário encontrado: ID ${user.id}\n`);

    // Atualizar senha
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error('❌ Erro ao atualizar senha:', updateError.message);
      process.exit(1);
    }

    console.log('✅ Senha atualizada com sucesso no Supabase!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 CREDENCIAIS ATUALIZADAS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📧 Email: ${email}`);
    console.log(`🔑 Senha: ${newPassword}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('💡 Você pode fazer login agora em:');
    console.log('   POST http://localhost:3000/api/admin/auth/login\n');
  } catch (error: any) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

updatePassword();
