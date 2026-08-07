# Build Stage
FROM node:20-bullseye-slim as build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# When building for docker compose, the API_URL should be /api so Nginx handles proxying
RUN VITE_API_URL=/api npm run build

# Production Stage
FROM nginx:alpine

# Copy the build output to replace the default nginx contents
COPY --from=build /app/dist /usr/share/nginx/html

# Copy the custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
