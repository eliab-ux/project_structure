# Usando uma imagem base do Node.js
FROM node:14.17.3

# Define o diretório de trabalho dentro do container
WORKDIR /usr/src/app

# Copia os arquivos de dependências para o diretório de trabalho
COPY . .

# Limpa o cache do npm e instala as dependências
RUN npm install -g serve

RUN yarn install
RUN yarn build

# Comando para iniciar o aplicativo
CMD ["npm", "start"]
