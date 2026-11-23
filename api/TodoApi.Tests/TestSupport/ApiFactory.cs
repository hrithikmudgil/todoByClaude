using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;
using Testcontainers.PostgreSql;

namespace TodoApi.Tests.TestSupport;

/// <summary>
/// Boots the real API against a real Postgres. Uses the database in <c>TEST_DB_CONNECTION</c> when set
/// (e.g. a locally running Postgres); otherwise starts a throwaway Postgres 16 container via Testcontainers.
/// The API runs its DbUp migrations on startup, so the schema is always current.
/// </summary>
public sealed class ApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string ExternalConnectionVariable = "TEST_DB_CONNECTION";

    private PostgreSqlContainer? _container;

    public string ConnectionString { get; private set; } = "";

    public async Task InitializeAsync()
    {
        var external = Environment.GetEnvironmentVariable(ExternalConnectionVariable);
        if (!string.IsNullOrWhiteSpace(external))
        {
            ConnectionString = external;
            return;
        }

        _container = new PostgreSqlBuilder("postgres:16").Build();
        await _container.StartAsync();
        ConnectionString = _container.GetConnectionString();
    }

    // Explicit: WebApplicationFactory already has a ValueTask-returning DisposeAsync.
    async Task IAsyncLifetime.DisposeAsync()
    {
        if (_container is not null)
        {
            await _container.DisposeAsync();
        }
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Development so the auth cookie isn't marked Secure (test clients talk plain http).
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
        {
            // Added last, so these win over appsettings*.json.
            ["ConnectionStrings:Default"] = ConnectionString,
            // Tests register/login constantly from one "IP"; the rate-limit test lowers this itself.
            ["RateLimiting:AuthPermitLimitPerMinute"] = "100000",
        }));
    }

    /// <summary>A client with its own cookie jar and no auto-redirects (so a stray 302 would be visible).</summary>
    public HttpClient CreateApiClient() =>
        CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
}
