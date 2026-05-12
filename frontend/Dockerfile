FROM node:20-alpine

WORKDIR /app
COPY package.json /app/package.json
COPY tsconfig.json /app/tsconfig.json
COPY next.config.mjs /app/next.config.mjs
COPY postcss.config.js /app/postcss.config.js
COPY tailwind.config.ts /app/tailwind.config.ts
COPY next-env.d.ts /app/next-env.d.ts
COPY app /app/app
COPY components /app/components
COPY src /app/src
RUN npm install

EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]
