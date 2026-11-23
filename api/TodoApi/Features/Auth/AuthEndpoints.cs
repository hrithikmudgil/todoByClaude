using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using TodoApi.Data;
using TodoApi.Domain;
using TodoApi.Infrastructure;

namespace TodoApi.Features.Auth;

public static class AuthEndpoints
{
    public const string RateLimitPolicy = "auth";

    private const int MaxFailedAttempts = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").RequireRateLimiting(RateLimitPolicy);

        group.MapPost("/register", Register);
        group.MapPost("/login", Login);
        // Cast to Delegate: a lone HttpContext parameter would otherwise bind as a RequestDelegate and drop the IResult.
        group.MapPost("/logout", (Delegate)Logout).Produces(StatusCodes.Status204NoContent);
        group.MapGet("/me", Me).RequireAuthorization();

        return app;
    }

    private static async Task<IResult> Register(
        RegisterRequest request, UserRepository users, PasswordService passwords, HttpContext http, CancellationToken ct)
    {
        var email = request.Email.Trim();
        var user = new User
        {
            Id = Guid.CreateVersion7(),
            Email = email,
            NormalizedEmail = NormalizeEmail(email),
            PasswordHash = passwords.Hash(request.Password),
            CreatedAt = DateTime.UtcNow,
        };

        if (!await users.TryCreateAsync(user, ct))
        {
            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "Email already registered.",
                detail: "An account with this email already exists.");
        }

        await SignInAsync(http, user);
        return Results.Created("/api/auth/me", new UserResponse(user.Id, user.Email));
    }

    private static async Task<IResult> Login(
        LoginRequest request, UserRepository users, PasswordService passwords, HttpContext http, CancellationToken ct)
    {
        var user = await users.FindByNormalizedEmailAsync(NormalizeEmail(request.Email), ct);

        // Unknown email and locked account both look exactly like a wrong password (same body, same cost).
        if (user is null || (user.LockedUntil is { } until && until > DateTime.UtcNow))
        {
            passwords.BurnTime(request.Password);
            return InvalidCredentials();
        }

        var (verified, rehashed) = passwords.Verify(user.PasswordHash, request.Password);
        if (!verified)
        {
            await users.RecordFailedLoginAsync(user.Id, MaxFailedAttempts, LockoutDuration, ct);
            return InvalidCredentials();
        }

        if (rehashed is not null)
        {
            await users.UpdatePasswordHashAsync(user.Id, rehashed, ct);
        }

        if (user.FailedLoginCount > 0 || user.LockedUntil is not null)
        {
            await users.RecordSuccessfulLoginAsync(user.Id, ct);
        }

        await SignInAsync(http, user);
        return Results.Ok(new UserResponse(user.Id, user.Email));
    }

    private static async Task<IResult> Logout(HttpContext http)
    {
        await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Results.NoContent();
    }

    private static async Task<IResult> Me(ClaimsPrincipal principal, HttpContext http, UserRepository users, CancellationToken ct)
    {
        var user = await users.FindByIdAsync(principal.GetUserId(), ct);
        if (user is null)
        {
            // The cookie outlived the account; drop it.
            await http.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Unauthorized();
        }

        return Results.Ok(new UserResponse(user.Id, user.Email));
    }

    private static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();

    private static IResult InvalidCredentials() =>
        Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid email or password.");

    private static Task SignInAsync(HttpContext http, User user)
    {
        var identity = new ClaimsIdentity(
            [new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()), new Claim(ClaimTypes.Email, user.Email)],
            CookieAuthenticationDefaults.AuthenticationScheme);

        return http.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(identity),
            new AuthenticationProperties { IsPersistent = true });
    }
}
