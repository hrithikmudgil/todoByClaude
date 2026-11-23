using System.Net;
using System.Net.Http.Json;

namespace TodoApi.Tests.TestSupport;

public sealed record TestUser(string Email, string Password, HttpClient Client);

public static class TestUsers
{
    public const string DefaultPassword = "correct-horse-battery";

    public static string NewEmail() => $"user-{Guid.NewGuid():N}@example.com";

    /// <summary>Registers a fresh user; the returned client holds that user's auth cookie.</summary>
    public static async Task<TestUser> RegisterAsync(this ApiFactory factory, string? email = null, string password = DefaultPassword)
    {
        email ??= NewEmail();
        var client = factory.CreateApiClient();
        var response = await client.PostAsJsonAsync("/api/auth/register", new { email, password });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return new TestUser(email, password, client);
    }
}
