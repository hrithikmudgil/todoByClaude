using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Dapper;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Configuration;
using Npgsql;
using TodoApi.Tests.TestSupport;

namespace TodoApi.Tests;

[Collection(ApiCollection.Name)]
public sealed class AuthTests(ApiFactory factory)
{
    private sealed record UserDto(Guid Id, string Email);

    private static Task<HttpResponseMessage> Login(HttpClient client, string email, string password) =>
        client.PostAsJsonAsync("/api/auth/login", new { email, password });

    [Fact]
    public async Task Me_WithoutCookie_Returns401_NotARedirect()
    {
        var client = factory.CreateApiClient();

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
    }

    [Fact]
    public async Task Register_Me_Logout_Login_Flow()
    {
        var user = await factory.RegisterAsync();

        // Registering signs the user in.
        var me = await user.Client.GetFromJsonAsync<UserDto>("/api/auth/me");
        Assert.Equal(user.Email, me!.Email);

        // Logout kills the session.
        var logout = await user.Client.PostAsync("/api/auth/logout", content: null);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await user.Client.GetAsync("/api/auth/me")).StatusCode);

        // Logging back in restores it.
        var login = await Login(user.Client, user.Email, user.Password);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await user.Client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task Login_IsCaseInsensitiveOnEmail()
    {
        var user = await factory.RegisterAsync();

        var response = await Login(factory.CreateApiClient(), user.Email.ToUpperInvariant(), user.Password);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task AuthCookie_IsHttpOnly_SameSiteLax()
    {
        var user = await factory.RegisterAsync();

        var response = await Login(factory.CreateApiClient(), user.Email, user.Password);

        var setCookie = Assert.Single(response.Headers.GetValues("Set-Cookie"), c => c.StartsWith("todo.auth=", StringComparison.Ordinal));
        Assert.Contains("httponly", setCookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=lax", setCookie, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Register_DuplicateEmail_Returns409_EvenWithDifferentCase()
    {
        var user = await factory.RegisterAsync();

        var response = await factory.CreateApiClient().PostAsJsonAsync(
            "/api/auth/register", new { email = user.Email.ToUpperInvariant(), password = "another-long-password" });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Theory]
    [InlineData("not-an-email", "long-enough-password")]
    [InlineData("a@example.com", "short")]
    [InlineData("", "long-enough-password")]
    [InlineData("a@example.com", "")]
    public async Task Register_InvalidInput_Returns400(string email, string password)
    {
        var response = await factory.CreateApiClient().PostAsJsonAsync("/api/auth/register", new { email, password });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Login_WrongPasswordAndUnknownEmail_AreIndistinguishable()
    {
        var user = await factory.RegisterAsync();
        var client = factory.CreateApiClient();

        var wrongPassword = await Login(client, user.Email, "definitely-wrong");
        var unknownEmail = await Login(client, TestUsers.NewEmail(), "definitely-wrong");

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        Assert.Equal(await StableBody(wrongPassword), await StableBody(unknownEmail));
    }

    [Fact]
    public async Task Login_LocksAccountAfterFiveFailures_ThenRecoversWhenLockExpires()
    {
        var user = await factory.RegisterAsync();
        var client = factory.CreateApiClient();

        for (var i = 0; i < 5; i++)
        {
            Assert.Equal(HttpStatusCode.Unauthorized, (await Login(client, user.Email, "wrong-password")).StatusCode);
        }

        // Locked: even the correct password is refused, with the same generic answer.
        var locked = await Login(client, user.Email, user.Password);
        Assert.Equal(HttpStatusCode.Unauthorized, locked.StatusCode);
        Assert.Equal("Invalid email or password.", JsonDocument.Parse(await locked.Content.ReadAsStringAsync()).RootElement.GetProperty("title").GetString());

        // Simulate the 15 minutes passing.
        await using (var conn = new NpgsqlConnection(factory.ConnectionString))
        {
            var rows = await conn.ExecuteAsync(
                "update users set locked_until = now() - interval '1 minute' where normalized_email = @email",
                new { email = user.Email.ToLowerInvariant() });
            Assert.Equal(1, rows);
        }

        Assert.Equal(HttpStatusCode.OK, (await Login(client, user.Email, user.Password)).StatusCode);
    }

    [Fact]
    public async Task Login_FormEncodedBody_Returns415()
    {
        var response = await factory.CreateApiClient().PostAsync(
            "/api/auth/login",
            new FormUrlEncodedContent(new Dictionary<string, string> { ["email"] = "a@example.com", ["password"] = "long-enough-pw" }));

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
    }

    [Fact]
    public async Task AuthEndpoints_AreRateLimited()
    {
        using var limited = factory.WithWebHostBuilder(builder => builder.ConfigureAppConfiguration((_, config) =>
            config.AddInMemoryCollection(new Dictionary<string, string?> { ["RateLimiting:AuthPermitLimitPerMinute"] = "3" })));
        var client = limited.CreateClient();

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 5; i++)
        {
            statuses.Add((await Login(client, TestUsers.NewEmail(), "whatever-password")).StatusCode);
        }

        Assert.Equal(3, statuses.Count(s => s == HttpStatusCode.Unauthorized));
        Assert.Equal(2, statuses.Count(s => s == HttpStatusCode.TooManyRequests));
    }

    /// <summary>Response body without the per-request traceId, so two responses can be compared.</summary>
    private static async Task<string> StableBody(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var fields = doc.RootElement.EnumerateObject()
            .Where(p => p.Name != "traceId")
            .Select(p => $"{p.Name}={p.Value}");
        return string.Join("|", fields);
    }
}
