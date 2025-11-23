# backend/Dockerfile

# Etapa 1: build del jar
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:go-offline

COPY src ./src
RUN mvn -q package -DskipTests

# Etapa 2: run
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app
COPY --from=build /app/target/*.jar app.jar

EXPOSE 8080

# OPENAI_API_KEY se inyecta por env (docker-compose)
ENTRYPOINT ["java", "-jar", "app.jar"]
