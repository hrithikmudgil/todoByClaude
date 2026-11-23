using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.Cookies;
using Npgsql;
using TodoApi.Data;
using TodoApi.Features.Auth;
using TodoApi.Features.Todos;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDatabase();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddValidation();
builder.Services.AddSingleton<PasswordService>();

// By default Development *throws* on unbindable input (malformed JSON, bad query values), which our
// exception handler would turn into a 500, while other environments return 400. Always answer 400.
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = false);

// Cookie auth: the browser never exposes the credential to JS, and the SPA is same-origin via the dev proxy.
builder.Services
    .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.Cookie.Name = "todo.auth";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = builder.Environment.IsDevelopment()
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;
        options.ExpireTimeSpan = TimeSpan.FromDays(14);
        options.SlidingExpiration = true;

        // This is an API: answer 401/403 instead of redirecting to a login page.
        options.Events.OnRedirectToLogin = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
            return Task.CompletedTask;
        };
        options.Events.OnRedirectToAccessDenied = ctx =>
        {
            ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
            return Task.CompletedTask;
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy(AuthEndpoints.RateLimitPolicy, http =>
    {
        // Read at request time so the limit can be overridden per host (tests use a high one).
        var permitLimit = http.RequestServices.GetRequiredService<IConfiguration>()
            .GetValue("RateLimiting:AuthPermitLimitPerMinute", 20);

        return RateLimitPartition.GetFixedWindowLimiter(
            http.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = permitLimit,
                Window = TimeSpan.FromMinutes(1),
            });
    });
});

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
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/api/health", async (NpgsqlDataSource dataSource, CancellationToken ct) =>
{
    await using var command = dataSource.CreateCommand("select 1");
    await command.ExecuteScalarAsync(ct);
    return Results.Ok(new { status = "ok" });
});

app.MapAuthEndpoints();
app.MapTodoEndpoints();

app.Run();

// Exposed so integration tests can use WebApplicationFactory<Program>.
public partial class Program;
