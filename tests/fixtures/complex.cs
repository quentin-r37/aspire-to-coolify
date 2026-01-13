// Complex Aspire Program.cs fixture
// Multiple services with cross-references

var builder = DistributedApplication.CreateBuilder(args);

// Database with custom image
var postgres = builder.AddAzurePostgresFlexibleServer("postgreServer")
    .RunAsContainer(a => a
        .WithImage("pgvector/pgvector")
        .WithImageTag("pg17")
        .WithDataVolume()
        .WithHostPort(5432)
    );
var db = postgres.AddDatabase("db");

// Redis cache
var redis = builder.AddRedis("cache")
    .WithDataVolume()
    .WithHostPort(6379);

// Message queue
var rabbitmq = builder.AddRabbitMQ("messaging")
    .WithHostPort(5672);

// Object storage
var minio = builder.AddMinioContainer("storage")
    .WithHostPort(9000);

// API Backend
builder.AddProject<Projects.ApiService>("api")
    .WithEnvironment("ASPNETCORE_ENVIRONMENT", "Production")
    .WithReference(db)
    .WithReference(redis)
    .WithReference(rabbitmq)
    .PublishAsDockerFile();

// SvelteKit Frontend
builder.AddNpmApp("svelte", "../VibeCode.SvelteKit")
    .WithEnvironment("BODY_SIZE_LIMIT", "10M")
    .WithEnvironment("PUBLIC_API_URL", "https://api.example.com")
    .WithHttpEndpoint(env: "PORT")
    .WithReference(db)
    .WithReference(minio)
    .PublishAsDockerFile();

builder.Build().Run();
