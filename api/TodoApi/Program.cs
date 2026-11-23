using Npgsql;
using TodoApi.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDatabase();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();

var app = builder.Build();

// `dotnet TodoApi.dll --migrate` applies migrations and exits (use this outside Development).
if (args.Contains("--migrate"))
{
    DbMigrator.Migrate(app.Configuration.GetRequiredConnectionString());
    return;
}

if (app.Environment.IsDevelopment())
{
    // Auto-migrate only in Development; the script journal makes this idempotent.
    DbMigrator.Migrate(app.Configuration.GetRequiredConnectionString());
    app.MapOpenApi();
}

app.UseExceptionHandler();
app.UseStatusCodePages();

app.MapGet("/api/health", async (NpgsqlDataSource dataSource, CancellationToken ct) =>
{
    await using var command = dataSource.CreateCommand("select 1");
    await command.ExecuteScalarAsync(ct);
    return Results.Ok(new { status = "ok" });
});

app.Run();

// Exposed so integration tests can use WebApplicationFactory<Program>.
public partial class Program;
