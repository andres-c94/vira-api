DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles
      WHERE rolname = 'app_modo_aventura'
   ) THEN
      CREATE ROLE app_modo_aventura LOGIN PASSWORD '6522';
   END IF;
END
$do$;

SELECT 'CREATE DATABASE modo_aventura OWNER app_modo_aventura'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'modo_aventura')
\gexec

GRANT ALL PRIVILEGES ON DATABASE modo_aventura TO app_modo_aventura;
