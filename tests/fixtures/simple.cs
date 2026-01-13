// Simple Aspire Program.cs fixture
// Single database and application

var builder = DistributedApplication.CreateBuilder(args);

var postgres = builder.AddPostgres("postgres")
    .WithDataVolume()
    .WithHostPort(5432);

var db = postgres.AddDatabase("mydb");

builder.AddNpmApp("webapp", "../WebApp")
    .WithEnvironment("NODE_ENV", "production")
    .WithHttpEndpoint(env: "PORT")
    .WithReference(db);

builder.Build().Run();
