using System.ComponentModel.DataAnnotations;

namespace TodoApi.Features.Auth;

public sealed record RegisterRequest(
    [property: Required, EmailAddress, StringLength(254)] string Email,
    [property: Required, StringLength(128, MinimumLength = 8)] string Password);

public sealed record LoginRequest(
    [property: Required, StringLength(254)] string Email,
    [property: Required, StringLength(128)] string Password);

public sealed record UserResponse(Guid Id, string Email);
