-- Atualizar CPF do reseller eliab para um CPF válido
UPDATE resellers 
SET cpf = '11144477735'
WHERE user_id = (SELECT id FROM users WHERE email = 'eliab@techbs.com.br');

-- Verificar
SELECT r.id, r.cpf, r.full_name, r.unique_link, r.status, r.level, u.email
FROM resellers r
JOIN users u ON u.id = r.user_id
WHERE u.email = 'eliab@techbs.com.br';
