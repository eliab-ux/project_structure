# Ambiente local (MariaDB 10.6 + Adminer)

Este setup usa Docker Compose para subir MariaDB 10.6 e Adminer, e restaurar o dump `dump.sql` no banco `emdr`.

## Pr?-requisitos
- Docker Desktop instalado e funcionando.
- Arquivo `dump.sql` na raiz do projeto.

## Como subir
```powershell
# Sobe containers
# (sem restore)
docker compose up -d
```

## Como restaurar (recomendado)
```powershell
# Sobe containers e restaura o dump
.\restore.ps1
```

## Como resetar (apagando dados)
```powershell
# Remove volumes e restaura do zero
.\reset-db.ps1
```

## Credenciais
- **Banco:** emdr
- **Usu?rio:** emdr
- **Senha:** emdr
- **Root:** root / root

## Acesso Adminer
- URL: http://localhost:8080
- Servidor: emdr_mariadb
- Banco: emdr
- Usu?rio: emdr
- Senha: emdr

## Conex?o direta (localhost)
- Host: 127.0.0.1
- Porta: 3306
- Banco: emdr
- Usu?rio: emdr
- Senha: emdr

## Troubleshooting
### Collation/Charset
Para verificar charset/collation:
```sql
SHOW VARIABLES LIKE 'character_set%';
SHOW VARIABLES LIKE 'collation%';
```

Se precisar ajustar, fa?a isso no dump ou altere o charset/collation no servidor conforme sua necessidade.
