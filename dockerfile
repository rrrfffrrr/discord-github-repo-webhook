FROM node:alpine
WORKDIR /usr/src/app

# Prepare build tools
RUN apk add --no-cache build-base python3

# install packages
COPY package*.json ./
RUN npm install --production=false

COPY src src
COPY package.json package.json
COPY package-lock.json package-lock.json
COPY tsconfig.json tsconfig.json

RUN npm run build

# Remove unecessary files
RUN npm prune --production
RUN apk del build-base python3

ENV NODE_ENV=production
ENV LOG_LEVEL=info

ENV WEBHOOK_PORT=8080

EXPOSE 80
EXPOSE 443
CMD [ "npm", "start" ]