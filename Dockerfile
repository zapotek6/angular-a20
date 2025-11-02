# Step 1: Build the Angular application
FROM docker.io/library/node:22-alpine AS build

WORKDIR /app

RUN apk update && apk add git
# Install dependencies
COPY package.json package-lock.json ./
RUN npm install && \
    npm install --prefix design style-dictionary

# Copy project files and build the app
COPY . .
RUN npm run build

# Step 2: Serve the application with NGINX
FROM docker.io/library/nginx:1.27-alpine

# Copy the build output to NGINX's HTML directory
COPY --from=build /app/dist/a20/browser /usr/share/nginx/html

# Copy custom NGINX configuration if needed
COPY conf.d /etc/nginx/conf.d
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port 80
EXPOSE 80

# Start NGINX
CMD ["nginx", "-g", "daemon off;"]
