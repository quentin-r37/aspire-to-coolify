// Full-stack Aspire Program.cs fixture
// Complete enterprise application setup

var builder = DistributedApplication.CreateBuilder(args);

// Primary Database
var postgresServer = builder.AddAzurePostgresFlexibleServer("maindb")
    .RunAsContainer(c => c
        .WithImage("postgres")
        .WithImageTag("16-alpine")
        .WithDataVolume()
        .WithHostPort(5432)
    );

var appDb = postgresServer.AddDatabase("appdb");
var analyticsDb = postgresServer.AddDatabase("analytics");

// Cache Layer
var redis = builder.AddRedisContainer("redis")
    .WithDataVolume()
    .WithHostPort(6379);

// Search Engine
var elasticsearch = builder.AddContainer("search", "elasticsearch:8.11.0")
    .WithEnvironment("discovery.type", "single-node")
    .WithEnvironment("xpack.security.enabled", "false")
    .WithHostPort(9200);

// Message Broker
var kafka = builder.AddKafka("kafka")
    .WithHostPort(9092);

// Object Storage
var minio = builder.AddMinioContainer("objects")
    .WithDataVolume()
    .WithHostPort(9000);

// Email Service (dev)
var maildev = builder.AddMailDev("mail")
    .WithHostPort(1025);

// Identity Provider
var keycloak = builder.AddKeycloak("identity")
    .WithDataVolume()
    .WithHostPort(8080);

// Logging
var seq = builder.AddSeq("logging")
    .WithDataVolume()
    .WithHostPort(5341);

// Backend Services
builder.AddProject<Projects.AuthService>("auth")
    .WithReference(appDb)
    .WithReference(redis)
    .WithReference(keycloak)
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

builder.AddProject<Projects.ApiGateway>("gateway")
    .WithReference(redis)
    .WithReference(seq)
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

builder.AddProject<Projects.OrderService>("orders")
    .WithReference(appDb)
    .WithReference(kafka)
    .WithReference(minio)
    .WithReference(maildev)
    .PublishAsDockerFile();

builder.AddProject<Projects.AnalyticsService>("analytics")
    .WithReference(analyticsDb)
    .WithReference(kafka)
    .WithReference(elasticsearch)
    .PublishAsDockerFile();

// Frontend Applications
builder.AddNpmApp("admin", "../AdminPortal")
    .WithEnvironment("VITE_API_URL", "/api")
    .WithHttpEndpoint(3000, env: "PORT")
    .WithReference(appDb)
    .PublishAsDockerFile();

builder.AddNpmApp("storefront", "../Storefront")
    .WithEnvironment("NEXT_PUBLIC_API_URL", "/api")
    .WithHttpEndpoint(3001, env: "PORT")
    .WithExternalHttpEndpoints()
    .PublishAsDockerFile();

builder.Build().Run();
