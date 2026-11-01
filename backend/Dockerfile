FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml .
COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
RUN groupadd --system quantara && useradd --system --gid quantara quantara
COPY --from=build /build/target/backend-0.0.1-SNAPSHOT.jar /app/app.jar
USER quantara
ENV JAVA_TOOL_OPTIONS="-Xms64m -Xmx192m -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=48m -XX:ActiveProcessorCount=1 -Xss512k"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
