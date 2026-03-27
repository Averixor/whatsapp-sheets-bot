FROM node:20-alpine
WORKDIR /app
COPY . .
CMD ["sh", "-lc", "node scripts/validate-gs-syntax.js && node scripts/static-checks.js"]
