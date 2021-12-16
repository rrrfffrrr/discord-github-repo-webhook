FROM node:alpine
WORKDIR /usr/src/app

RUN apk add --no-cache build-base python

# install packages
COPY package*.json ./
RUN npm install --production=false

COPY . .

RUN npm run build

RUN npm prune --production
RUN apk del build-base python

EXPOSE 80
EXPOSE 443
CMD [ "npm", "start" ]