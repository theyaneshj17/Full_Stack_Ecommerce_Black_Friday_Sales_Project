FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci 

COPY . .

EXPOSE 8002

CMD ["node", "server.js"]



