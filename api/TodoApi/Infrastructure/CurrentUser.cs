using System.Security.Claims;

namespace TodoApi.Infrastructure;

public static class CurrentUser
{
    /// <summary>
    /// The authenticated user's id, from the auth cookie's NameIdentifier claim.
    /// Only call from endpoints that require authorization.
    /// </summary>
    public static Guid GetUserId(this ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw new InvalidOperationException("Authenticated principal has no valid user id claim.");
}
