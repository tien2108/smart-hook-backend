# syntax=docker/dockerfile:1

# Comments are provided throughout this file to help you get started.
# If you need more help, visit the Dockerfile reference guide at
# https://docs.docker.com/go/dockerfile-reference/

# Want to help us make this template better? Share your feedback here: https://forms.gle/ybq9Krt8jtBL3iCk7

FROM node:24.14.0-bullseye

# Use production node environment by default.
WORKDIR /app

# Download dependencies as a separate step to take advantage of Docker's caching.
COPY package*.json ./
RUN npm install

# Copy the rest of the source files into the image.
COPY . .

# Declare the folder for persistent DB as a volume
VOLUME /app/data

# Expose the port that the application listens on.
EXPOSE 3000

# Run the application.
CMD ["npm", "start"]
