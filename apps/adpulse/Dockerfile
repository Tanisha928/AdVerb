FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_PUBLIC_BRAND_API_URL=http://localhost:8800
ARG NEXT_PUBLIC_AD_SERVING_URL=http://localhost:8801
ENV NEXT_PUBLIC_BRAND_API_URL=$NEXT_PUBLIC_BRAND_API_URL
ENV NEXT_PUBLIC_AD_SERVING_URL=$NEXT_PUBLIC_AD_SERVING_URL
ENV BRAND_API_URL=http://brand-api:8000
ENV AD_SERVING_INTERNAL_URL=http://ad-serving:8001
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV BRAND_API_URL=http://brand-api:8000
ENV AD_SERVING_INTERNAL_URL=http://ad-serving:8001
CMD ["node", "server.js"]
