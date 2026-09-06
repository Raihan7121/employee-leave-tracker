# Two stages: the first has a full JDK and Gradle to build the jar, the second has only a
# JRE to run it. Nothing from the build stage ships except the jar itself, so the final
# image carries no source, no Gradle and no compiler.

# ---------- build ----------
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# The Gradle wrapper downloads the exact Gradle version this project expects, so the image
# does not need Gradle preinstalled.
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
COPY src ./src

RUN chmod +x gradlew && ./gradlew bootJar --no-daemon

# ---------- run ----------
FROM eclipse-temurin:21-jre
WORKDIR /app

# Running as root inside a container is an unnecessary risk if the app is ever compromised.
RUN useradd --create-home --shell /bin/bash app
USER app

COPY --from=build /app/build/libs/*.jar app.jar

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
