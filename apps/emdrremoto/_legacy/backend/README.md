# Resumo geral

## Tecnlogias em uso
- Frontend
- Backend
- Websocket
- Nginx
- Certbot

## Portas em uso
- 3000 - Frontend
- 3001 - Backend
- 3002 - Websocket
- 80 e 443

## Procedimentos
### Deploy da aplicação

```yml
# Listar containers
$ docker ps

# Frontend da aplicação
$ cd /opt/projects/frontend
# Atualizar arquivos locais
$ git pull
# Recriar container
$ docker compose up -d --build

# Backend da aplicação
$ cd /opt/projects/backend
# Atualizar arquivos locais
$ git pull
# Recriar container
$ docker compose up -d --build
```

### Alterar Nginx
```yml
# Alterar arquivo nginx
$ vim /etc/nginx/sites-enabled/emdrremoto.com.br
# Validar alterações
$ nginx -t
# Aplicar alterações
$ service nginx restart
# Para ver os logs
$ vim /var/log/nginx/access.log
$ vim /var/log/nginx/error.log
```

#### Cópia da configuração Nginx

```yml
# https
server {
  server_name emdrremoto.com.br;

  # Websocket
  location /socket.io/ {
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_pass http://localhost:3001/socket.io/;
  }

  # Backend
  location /emdr-api/ {
    proxy_pass http://localhost:3002;
  }

  # Fackend
  location / {
    proxy_pass http://localhost:3000;
  }

  listen [::]:443 ssl ipv6only=on; # managed by Certbot
  listen 443 ssl; # managed by Certbot
  ssl_certificate /etc/letsencrypt/live/emdrremoto.com.br/fullchain.pem; # managed by Certbot
  ssl_certificate_key /etc/letsencrypt/live/emdrremoto.com.br/privkey.pem; # managed by Certbot
  include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

# http
server {
  if ($host = emdrremoto.com.br) {
    return 301 https://$host$request_uri;
  } # managed by Certbot

  listen 80;
  listen [::]:80;

  server_name emdrremoto.com.br;
  return 404; # managed by Certbot
}
```

## Erros mapeados

```yml
# Erro de vídeo e áudio
Verificar API da daily.co se está com salas disponíveis para criação ou se excedeu o limite.

# SSL expirado
$ certbot certonly  --nginx
```
