#!/bin/bash

# Core dependencies
npm install --save \
  @nestjs/config \
  @nestjs/typeorm \
  @nestjs/jwt \
  @nestjs/passport \
  @nestjs/swagger \
  @nestjs/cache-manager \
  @nestjs/throttler \
  @nestjs/platform-express

# Database
npm install --save \
  typeorm \
  pg

# Cache
npm install --save \
  cache-manager \
  cache-manager-redis-yet \
  redis

# Authentication
npm install --save \
  bcrypt \
  passport \
  passport-jwt \
  passport-local \
  @types/passport-jwt \
  @types/passport-local

# Validation
npm install --save \
  class-validator \
  class-transformer

# Security
npm install --save \
  helmet \
  compression

# AI Services
npm install --save \
  openai \
  @google-cloud/vision \
  @google-cloud/speech

# File Upload & Storage
npm install --save \
  @aws-sdk/client-s3 \
  @aws-sdk/s3-request-presigner \
  multer \
  @types/multer

# Utilities
npm install --save \
  date-fns \
  rxjs

# Dev Dependencies
npm install --save-dev \
  @types/express \
  @types/node \
  @types/bcrypt \
  @types/compression

echo "✅ Todas las dependencias instaladas correctamente"