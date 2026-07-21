FROM node:20-bullseye-slim

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm install

# Copy application code
COPY . .

# Expose backend port
EXPOSE 5000

# Start backend server
CMD ["npm", "start"]
