FROM node:16

# Create app directory
WORKDIR /usr/src/editor

COPY package*.json ./

RUN npm install
# RUN npm run all
