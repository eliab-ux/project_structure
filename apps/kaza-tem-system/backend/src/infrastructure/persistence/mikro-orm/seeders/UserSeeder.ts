import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import * as bcrypt from 'bcryptjs';
import { UserOrmEntity } from '../entities/user-orm.entity';

export class UserSeeder extends Seeder {
  async run(em: EntityManager): Promise<void> {
    // Hash para senha "Admin@123"
    const adminPasswordHash = await bcrypt.hash('Admin@123', 10);
    // Hash para senha "Cliente@123"
    const customerPasswordHash = await bcrypt.hash('Cliente@123', 10);
    // Hash para senha "Revendedor@123"
    const resellerPasswordHash = await bcrypt.hash('Revendedor@123', 10);

    // Criar usuário Admin
    const admin = em.create(UserOrmEntity, {
      email: 'admin@kazatem.com',
      name: 'Administrador do Sistema',
      passwordHash: adminPasswordHash,
      role: 'admin',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Criar usuário Customer
    const customer = em.create(UserOrmEntity, {
      email: 'cliente@kazatem.com',
      name: 'Cliente Teste',
      passwordHash: customerPasswordHash,
      role: 'customer',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Criar usuário Reseller
    const reseller = em.create(UserOrmEntity, {
      email: 'revendedor@kazatem.com',
      name: 'Revendedor Teste',
      passwordHash: resellerPasswordHash,
      role: 'reseller',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Persistir
    await em.persistAndFlush([admin, customer, reseller]);

    console.log('✅ Usuários de teste criados com sucesso!');
    console.log('');
    console.log('🔐 Credenciais de Acesso:');
    console.log('');
    console.log('ADMIN:');
    console.log('  Email: admin@kazatem.com');
    console.log('  Senha: Admin@123');
    console.log('');
    console.log('CLIENTE:');
    console.log('  Email: cliente@kazatem.com');
    console.log('  Senha: Cliente@123');
    console.log('');
    console.log('REVENDEDOR:');
    console.log('  Email: revendedor@kazatem.com');
    console.log('  Senha: Revendedor@123');
    console.log('');
  }
}
