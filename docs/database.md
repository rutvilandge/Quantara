# Local database startup

`backend/src/main/resources/application.properties` reads `DATABASE_URL`,
`DATABASE_USERNAME`, and `DATABASE_PASSWORD` from the backend process environment.
Flyway uses the same datasource. A successful compilation does not test database
authentication. SQL state `28P01` means PostgreSQL rejected authentication.

From the repository root, run:

```powershell
.\backend\start-local.ps1 -DatabaseUrl '<JDBC URL from Neon, without credentials>' -DatabaseUsername '<Neon role>'
```

The launcher checks for embedded URL credentials and conflicting datasource or
Flyway environment variables, then prompts for the newly rotated Neon password
with hidden input. Enter the password exactly as provided by Neon; do not URL
encode it. The launcher supplies all three variables only to its process and
children and runs `mvnw.cmd spring-boot:run`. It does not save the password or
change persistent Windows environment settings. Keep the terminal open while
running the backend; use Ctrl+C to stop it.

Keep `sslmode=require&channelBinding=require` in the JDBC URL. Do not put `user`,
`username`, or `password` parameters in the URL. Do not paste passwords into chat,
shell commands, source files, or logs. Sanitized startup output is written to
`backend/target/local-startup.log`, which is ignored by Git.

After startup, verify:

```powershell
Invoke-RestMethod http://localhost:8080/actuator/health
Invoke-RestMethod http://localhost:8080/api/auth/csrf
```

Health should report `UP`. The CSRF response should provide `headerName` and
`token`, with an `XSRF-TOKEN` response cookie. Startup runs the existing Flyway
migrations normally; do not edit existing migrations or delete database data to
resolve an authentication error.
