# Usando uma imagem base do Node.js
FROM node:18.14.0

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos de dependências para o diretório de trabalho
COPY package*.json ./

# Limpa o cache do npm e instala as dependências
RUN npm cache clean --force
RUN npm install

# Copia o restante dos arquivos do projeto para o diretório de trabalho
COPY . .

RUN npm run build

# Expõe a porta que o aplicativo irá utilizar
EXPOSE 3002

# Comando para iniciar o aplicativo
CMD ["npm", "start"]
